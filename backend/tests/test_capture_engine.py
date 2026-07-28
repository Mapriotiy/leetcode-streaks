from datetime import date, datetime

from app.models.user_solved import UserSolved
from app.models.weekly_map import WeeklyMap
from app.models.weekly_map_province import WeeklyMapProvince
from app.services.capture_engine import (
    CAPTURE,
    DEFENSE,
    RECAPTURE,
    apply_capture_pass,
)

WEEK_START = date(2026, 7, 27)  # a Monday
USER_A = 1
USER_B = 2


def make_map() -> WeeklyMap:
    return WeeklyMap(id=1, friendship_id=1, week_start=WEEK_START)


def make_province(
    slug: str = "two-sum",
    captured_by=None,
    captured_runtime_ms=None,
    first_captured_by=None,
) -> WeeklyMapProvince:
    return WeeklyMapProvince(
        weekly_map_id=1,
        province_id="path34",
        region_id="isle1",
        problem_title_slug=slug,
        captured_by=captured_by,
        captured_runtime_ms=captured_runtime_ms,
        first_captured_by=first_captured_by,
        captured_at=datetime(2026, 7, 27, 8, 0) if captured_by else None,
        first_captured_at=datetime(2026, 7, 27, 8, 0) if first_captured_by else None,
    )


def make_solve(
    user_id: int,
    slug: str = "two-sum",
    solved_at: datetime = datetime(2026, 7, 27, 12, 0),
    runtime_ms=None,
) -> UserSolved:
    return UserSolved(
        user_id=user_id,
        title_slug=slug,
        solved_at=solved_at,
        best_runtime_ms=runtime_ms,
        best_submission_url=f"https://leetcode.com/submissions/detail/{user_id}00/",
        best_runtime_at=solved_at if runtime_ms is not None else None,
    )


def run_pass(province, solve_a=None, solve_b=None):
    solved_a = {solve_a.title_slug: solve_a} if solve_a else {}
    solved_b = {solve_b.title_slug: solve_b} if solve_b else {}
    return apply_capture_pass(
        weekly_map=make_map(),
        provinces=[province],
        solved_a=solved_a,
        solved_b=solved_b,
        user_a_id=USER_A,
        user_b_id=USER_B,
        leetcode_username_a="alice",
        leetcode_username_b="bob",
    )


def test_sole_solver_captures():
    province = make_province()
    changes = run_pass(province, solve_a=make_solve(USER_A, runtime_ms=120))

    assert [c.kind for c in changes] == [CAPTURE]
    assert province.captured_by == USER_A
    assert province.first_captured_by == USER_A
    assert province.captured_runtime_ms == 120
    assert province.capturer_leetcode_username == "alice"


def test_earliest_solver_wins_initial_capture():
    province = make_province()
    changes = run_pass(
        province,
        solve_a=make_solve(USER_A, solved_at=datetime(2026, 7, 27, 13, 0)),
        solve_b=make_solve(USER_B, solved_at=datetime(2026, 7, 27, 12, 0)),
    )

    assert [c.kind for c in changes] == [CAPTURE]
    assert province.captured_by == USER_B


def test_timestamp_tie_goes_to_user_a():
    province = make_province()
    ts = datetime(2026, 7, 27, 12, 0)
    run_pass(
        province,
        solve_a=make_solve(USER_A, solved_at=ts),
        solve_b=make_solve(USER_B, solved_at=ts),
    )

    assert province.captured_by == USER_A


def test_strictly_faster_challenger_steals():
    province = make_province(
        captured_by=USER_A, captured_runtime_ms=167, first_captured_by=USER_A,
    )
    changes = run_pass(province, solve_b=make_solve(USER_B, runtime_ms=120))

    assert [c.kind for c in changes] == [RECAPTURE]
    change = changes[0]
    assert change.actor_user_id == USER_B
    assert change.previous_owner_user_id == USER_A
    assert change.runtime_ms == 120
    assert change.previous_runtime_ms == 167
    assert province.captured_by == USER_B
    assert province.captured_runtime_ms == 120
    assert province.capturer_leetcode_username == "bob"


def test_equal_runtime_keeps_incumbent():
    province = make_province(
        captured_by=USER_A, captured_runtime_ms=120, first_captured_by=USER_A,
    )
    changes = run_pass(province, solve_b=make_solve(USER_B, runtime_ms=120))

    assert changes == []
    assert province.captured_by == USER_A


def test_challenger_without_runtime_cannot_steal():
    province = make_province(
        captured_by=USER_A, captured_runtime_ms=500, first_captured_by=USER_A,
    )
    changes = run_pass(province, solve_b=make_solve(USER_B, runtime_ms=None))

    assert changes == []
    assert province.captured_by == USER_A


def test_incumbent_without_runtime_is_beatable_by_any_timed_solve():
    # Pre-migration captures have no stored runtime.
    province = make_province(
        captured_by=USER_A, captured_runtime_ms=None, first_captured_by=USER_A,
    )
    changes = run_pass(province, solve_b=make_solve(USER_B, runtime_ms=9999))

    assert [c.kind for c in changes] == [RECAPTURE]
    assert changes[0].previous_runtime_ms is None
    assert province.captured_by == USER_B


def test_zero_runtime_steals_from_one_ms():
    province = make_province(
        captured_by=USER_A, captured_runtime_ms=1, first_captured_by=USER_A,
    )
    changes = run_pass(province, solve_b=make_solve(USER_B, runtime_ms=0))

    assert [c.kind for c in changes] == [RECAPTURE]
    assert province.captured_runtime_ms == 0


def test_owner_defends_by_improving_runtime():
    province = make_province(
        captured_by=USER_A, captured_runtime_ms=167, first_captured_by=USER_A,
    )
    changes = run_pass(province, solve_a=make_solve(USER_A, runtime_ms=98))

    assert [c.kind for c in changes] == [DEFENSE]
    assert changes[0].runtime_ms == 98
    assert changes[0].previous_runtime_ms == 167
    assert province.captured_by == USER_A
    assert province.captured_runtime_ms == 98


def test_defense_in_same_pass_blocks_steal():
    # Owner improves to 90 while the challenger posts 100: the defense
    # runs first, so the steal against the old 150 bar fails.
    province = make_province(
        captured_by=USER_A, captured_runtime_ms=150, first_captured_by=USER_A,
    )
    changes = run_pass(
        province,
        solve_a=make_solve(USER_A, runtime_ms=90),
        solve_b=make_solve(USER_B, runtime_ms=100),
    )

    assert [c.kind for c in changes] == [DEFENSE]
    assert province.captured_by == USER_A
    assert province.captured_runtime_ms == 90


def test_slower_resolve_is_no_defense_and_no_change():
    province = make_province(
        captured_by=USER_A, captured_runtime_ms=90, first_captured_by=USER_A,
    )
    changes = run_pass(province, solve_a=make_solve(USER_A, runtime_ms=200))

    assert changes == []
    assert province.captured_runtime_ms == 90


def test_pre_week_solve_cannot_capture():
    province = make_province()
    changes = run_pass(
        province,
        solve_a=make_solve(USER_A, solved_at=datetime(2026, 7, 20, 12, 0)),
    )

    assert changes == []
    assert province.captured_by is None


def test_pre_week_solve_cannot_steal():
    province = make_province(
        captured_by=USER_A, captured_runtime_ms=500, first_captured_by=USER_A,
    )
    changes = run_pass(
        province,
        solve_b=make_solve(
            USER_B, solved_at=datetime(2026, 7, 20, 12, 0), runtime_ms=1,
        ),
    )

    assert changes == []
    assert province.captured_by == USER_A


def test_recapture_never_moves_first_capture_ledger():
    province = make_province(
        captured_by=USER_A, captured_runtime_ms=167, first_captured_by=USER_A,
    )
    run_pass(province, solve_b=make_solve(USER_B, runtime_ms=120))

    assert province.captured_by == USER_B
    assert province.first_captured_by == USER_A


def test_steal_back_with_faster_runtime():
    province = make_province(
        captured_by=USER_B, captured_runtime_ms=120, first_captured_by=USER_A,
    )
    changes = run_pass(province, solve_a=make_solve(USER_A, runtime_ms=95))

    assert [c.kind for c in changes] == [RECAPTURE]
    assert province.captured_by == USER_A
    assert province.first_captured_by == USER_A
