"""Territory game mode: capture map provinces by solving their problems.

The classic CTF rules — runtime defense, strictly-faster recapture,
first-capture ledger, region-control bonus — over the 28-province map.
Handles both free-for-all and faction (team_battle) lobbies; the split is
data-driven off lobby.faction_mode.
"""

import logging
from collections import Counter

from sqlalchemy.orm import Session

from app.models.leetcode_problem import LeetCodeProblem
from app.models.lobby import Lobby
from app.models.lobby_map import LobbyMap
from app.models.lobby_map_province import LobbyMapProvince
from app.models.user import User
from app.schemas.lobby import LobbyMapProvinceResponse, LobbyScoreEntry
from app.services.capture_engine import CAPTURE, RECAPTURE, apply_capture_pass
from app.services.events import record_lobby_events, region_control_changes
from app.services.game_modes.base import (
    GameMode,
    Players,
    WinnerResult,
    finish_lobby,
    winner_info,
)
from app.services.game_modes.registry import register
from app.services.leetcode_client import LeetCodeClient
from app.services.lobby_settings import (
    FACTION_COLORS,
    filter_submissions_by_language,
    lobby_factions,
    lobby_programming_language,
    team_by_user,
)
from app.services.map_config import PROVINCE_REGION, REGION_TOPICS
from app.services.map_generator import _pick_problem
from app.services.scoring import (
    TeamScore,
    compute_team_scores,
    region_control_by_team,
)
from app.services.user_solved import (
    get_solved_for_slugs,
    get_solved_slugs_with_timestamps,
    record_submissions,
)

logger = logging.getLogger(__name__)


class TerritoryMode(GameMode):
    slugs = ("free_for_all", "team_battle")

    async def start(self, lobby: Lobby, players: Players, db: Session) -> None:
        language = lobby_programming_language(lobby)
        all_solved: set[str] = set()
        for _, u in players:
            all_solved.update(
                get_solved_slugs_with_timestamps(u.id, db, language=language).keys()
            )

        lmap = LobbyMap(lobby_id=lobby.id, map_size=lobby.map_size)
        db.add(lmap)
        db.flush()

        used: set[str] = set()
        for prov_id, region_id in PROVINCE_REGION.items():
            cfg = REGION_TOPICS.get(region_id, {"tags": [], "difficulty": None})
            prob = _pick_problem(cfg["tags"], cfg["difficulty"], all_solved | used, db)
            if not prob:
                prob = _pick_problem([], None, all_solved | used, db)
            if not prob:
                continue
            used.add(prob.title_slug)
            db.add(LobbyMapProvince(
                lobby_map_id=lmap.id, province_id=prov_id,
                region_id=region_id, problem_title_slug=prob.title_slug,
            ))

    async def sync(self, lobby: Lobby, players: Players, db: Session) -> dict:
        lmap = _get_lmap(lobby.id, db)
        if not lmap:
            return self._payload(lobby, [], [], db)

        client = LeetCodeClient()
        language = lobby_programming_language(lobby)
        for _, u in players:
            try:
                subs = await client.get_recent_accepted_submissions(u.leetcode_username, limit=50)
                record_submissions(u.id, filter_submissions_by_language(subs, language), db)
            except Exception:
                logger.warning("sync failed for %s", u.leetcode_username)

        provinces = db.query(LobbyMapProvince).filter_by(lobby_map_id=lmap.id).all()
        slugs = {p.problem_title_slug for p in provinces}

        solved_by_user = {
            u.id: get_solved_for_slugs(u.id, slugs, db, language=language)
            for _, u in players
        }
        username_by_id = {u.id: u.leetcode_username for _, u in players}
        teams = team_by_user(lobby, players)
        control_before = region_control_by_team(provinces, teams)

        changes = apply_capture_pass(
            provinces=provinces,
            solved_by_user=solved_by_user,
            username_by_id=username_by_id,
            since=lobby.started_at or lobby.created_at,
            tiebreak_order=[u.id for _, u in players],
            team_by_user=teams,
        )
        if changes:
            db.commit()

        problems = _load_problems(slugs, db)

        if changes:
            control_after = region_control_by_team(provinces, teams)
            all_changes = changes + region_control_changes(
                provinces, changes, control_before, control_after,
            )
            record_lobby_events(
                all_changes,
                lobby,
                problems,
                username_by_id,
                {u.id: (lp.faction_id if lobby.faction_mode else None) for lp, u in players},
                db,
            )

            winner = _evaluate_winner(lobby, provinces, teams)
            if winner is not None:
                finish_lobby(lobby, winner, players, db)
                db.commit()

        return self._payload(
            lobby, provinces, players, db, problems=problems,
            captured_count=sum(1 for c in changes if c.kind == CAPTURE),
            recaptured_count=sum(1 for c in changes if c.kind == RECAPTURE),
        )

    def get_state(self, lobby: Lobby, players: Players, db: Session) -> dict:
        lmap = _get_lmap(lobby.id, db)
        if not lmap:
            return self._payload(lobby, [], [], db)
        provinces = db.query(LobbyMapProvince).filter_by(lobby_map_id=lmap.id).all()
        return self._payload(lobby, provinces, players, db)

    def _payload(
        self,
        lobby: Lobby,
        provinces: list[LobbyMapProvince],
        players: Players,
        db: Session,
        problems: dict[str, LeetCodeProblem] | None = None,
        captured_count: int = 0,
        recaptured_count: int = 0,
    ) -> dict:
        if problems is None:
            problems = _load_problems({p.problem_title_slug for p in provinces}, db)
        uids = {p.captured_by for p in provinces if p.captured_by}
        users = (
            {u.id: u.leetcode_username for u in db.query(User).filter(User.id.in_(uids)).all()}
            if uids else {}
        )
        return {
            "lobby_id": lobby.id,
            "game_mode": lobby.game_mode,
            "status": lobby.status,
            "winner": winner_info(lobby, db),
            "captured_count": captured_count,
            "recaptured_count": recaptured_count,
            "provinces": [_build_province(p, problems, users) for p in provinces],
            "score": _score_entries(lobby, provinces, players, problems),
        }


def _get_lmap(lobby_id: int, db: Session) -> LobbyMap | None:
    return db.query(LobbyMap).filter_by(lobby_id=lobby_id).first()


def _load_problems(slugs: set[str], db: Session) -> dict[str, LeetCodeProblem]:
    if not slugs:
        return {}
    return {
        p.title_slug: p
        for p in db.query(LeetCodeProblem).filter(LeetCodeProblem.title_slug.in_(slugs)).all()
    }


def _build_province(p: LobbyMapProvince, problems: dict, users: dict) -> LobbyMapProvinceResponse:
    prob = problems.get(p.problem_title_slug)
    return LobbyMapProvinceResponse(
        province_id=p.province_id,
        region_id=p.region_id,
        problem={"title": prob.title, "title_slug": prob.title_slug, "difficulty": prob.difficulty,
                 "url": f"https://leetcode.com/problems/{prob.title_slug}/"} if prob else None,
        captured_by=p.captured_by,
        captured_by_username=users.get(p.captured_by) if p.captured_by else None,
        captured_at=p.captured_at,
        captured_runtime_ms=p.captured_runtime_ms,
        captured_submission_url=p.captured_submission_url,
        capturer_leetcode_username=p.capturer_leetcode_username,
        first_captured_by=p.first_captured_by,
    )


def _score_entries(
    lobby: Lobby,
    provinces: list[LobbyMapProvince],
    players: Players,
    problems: dict,
) -> list[LobbyScoreEntry]:
    difficulty_by_slug = {
        slug: prob.difficulty for slug, prob in problems.items() if prob.difficulty
    }
    team_scores = compute_team_scores(provinces, team_by_user(lobby, players), difficulty_by_slug)

    entries: list[LobbyScoreEntry] = []
    if lobby.faction_mode:
        for faction in lobby_factions(lobby):
            score = team_scores.get(faction["id"], TeamScore())
            entries.append(_score_entry(faction["id"], faction["name"], faction["color"], score))
    else:
        for lp, u in players:
            score = team_scores.get(u.id, TeamScore())
            entries.append(_score_entry(
                u.id, u.leetcode_username, FACTION_COLORS.get(lp.faction_id, "#888888"), score,
            ))

    entries.sort(key=lambda e: e.total_points, reverse=True)
    return entries


def _score_entry(team_id: int, label: str, color: str, score: TeamScore) -> LobbyScoreEntry:
    return LobbyScoreEntry(
        team_id=team_id,
        label=label,
        color=color,
        provinces=score.provinces,
        base_points=score.base_points,
        bonus_points=score.bonus_points,
        region_control_points=score.region_control_points,
        total_points=score.total_points,
    )


def _evaluate_winner(
    lobby: Lobby,
    provinces: list[LobbyMapProvince],
    teams: dict[int, int],
) -> WinnerResult | None:
    total = len(provinces)
    if total == 0:
        return None

    win_condition = lobby.win_condition or {}
    wc_type = str(win_condition.get("type") or "territory_control")

    if wc_type == "region_domination":
        control = region_control_by_team(provinces, teams)
        total_regions = len({p.region_id for p in provinces})
        needed = total_regions // 2 + 1
        counts = Counter(control.values())
        best = counts.most_common(1)
        if best and best[0][1] >= needed:
            return _winner_result(lobby, best[0][0], "region_domination")
        return None

    # territory_control (default): own at least `threshold` of all provinces.
    try:
        threshold = float(win_condition.get("threshold") or 0.5)
    except (TypeError, ValueError):
        threshold = 0.5
    counts = Counter(teams[p.captured_by] for p in provinces if p.captured_by in teams)
    best = counts.most_common(1)
    if best and best[0][1] / total >= threshold:
        return _winner_result(lobby, best[0][0], "territory_control")
    return None


def _winner_result(lobby: Lobby, team: int, reason: str) -> WinnerResult:
    if lobby.faction_mode:
        return WinnerResult(winner_user_id=None, winner_faction_id=team, reason=reason)
    return WinnerResult(winner_user_id=team, winner_faction_id=None, reason=reason)


register(TerritoryMode())
