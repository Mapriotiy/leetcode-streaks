"""Score computation for a weekly map.

Score is a pure function of province rows: the current owner of each
province earns its flag value, and whoever first captured it keeps a
permanent first-capture bonus regardless of later recaptures.
"""

from app.models.weekly_map_province import WeeklyMapProvince
from app.schemas.maps import ScoreResponse

FLAG_POINTS: dict[str, int] = {
    "Easy": 100,
    "Medium": 250,
    "Hard": 500,
}

DEFAULT_FLAG_POINTS = 100


def flag_points(difficulty: str | None) -> int:
    if difficulty is None:
        return DEFAULT_FLAG_POINTS
    return FLAG_POINTS.get(difficulty, DEFAULT_FLAG_POINTS)


def first_capture_bonus(difficulty: str | None) -> int:
    return flag_points(difficulty) // 2


def compute_score(
    provinces: list[WeeklyMapProvince],
    current_user_id: int,
    friend_id: int,
    difficulty_by_slug: dict[str, str] | None = None,
) -> ScoreResponse:
    difficulty_by_slug = difficulty_by_slug or {}
    total = len(provinces)
    player_provinces = 0
    friend_provinces = 0
    player_base_points = 0
    friend_base_points = 0
    player_bonus_points = 0
    friend_bonus_points = 0

    for p in provinces:
        difficulty = difficulty_by_slug.get(p.problem_title_slug)

        if p.captured_by == current_user_id:
            player_provinces += 1
            player_base_points += flag_points(difficulty)
        elif p.captured_by == friend_id:
            friend_provinces += 1
            friend_base_points += flag_points(difficulty)

        if p.first_captured_by == current_user_id:
            player_bonus_points += first_capture_bonus(difficulty)
        elif p.first_captured_by == friend_id:
            friend_bonus_points += first_capture_bonus(difficulty)

    total_regions = len(set(p.region_id for p in provinces))

    region_counts: dict[str, dict[str, int]] = {}
    for p in provinces:
        r = region_counts.setdefault(p.region_id, {"player": 0, "friend": 0})
        if p.captured_by == current_user_id:
            r["player"] += 1
        elif p.captured_by == friend_id:
            r["friend"] += 1

    player_regions = 0
    friend_regions = 0
    for r, counts in region_counts.items():
        if counts["player"] > counts["friend"]:
            player_regions += 1
        elif counts["friend"] > counts["player"]:
            friend_regions += 1

    return ScoreResponse(
        player_provinces=player_provinces,
        friend_provinces=friend_provinces,
        neutral_provinces=total - player_provinces - friend_provinces,
        total_provinces=total,
        player_regions=player_regions,
        friend_regions=friend_regions,
        total_regions=total_regions,
        player_base_points=player_base_points,
        friend_base_points=friend_base_points,
        player_bonus_points=player_bonus_points,
        friend_bonus_points=friend_bonus_points,
        player_points=player_base_points + player_bonus_points,
        friend_points=friend_base_points + friend_bonus_points,
    )
