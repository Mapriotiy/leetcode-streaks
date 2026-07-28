from app.models.weekly_map_province import WeeklyMapProvince
from app.services.scoring import compute_score, first_capture_bonus, flag_points


def province(slug: str, region: str, captured_by=None, first_captured_by=None):
    return WeeklyMapProvince(
        weekly_map_id=1,
        province_id=slug,
        region_id=region,
        problem_title_slug=slug,
        captured_by=captured_by,
        first_captured_by=first_captured_by,
    )


def test_flag_points_by_difficulty():
    assert flag_points("Easy") == 100
    assert flag_points("Medium") == 250
    assert flag_points("Hard") == 500
    assert flag_points(None) == 100
    assert flag_points("Unknown") == 100


def test_first_capture_bonus_is_half_flag_value():
    assert first_capture_bonus("Easy") == 50
    assert first_capture_bonus("Medium") == 125
    assert first_capture_bonus("Hard") == 250


def test_owner_earns_flag_points_plus_bonus():
    provinces = [
        province("a", "r1", captured_by=1, first_captured_by=1),
        province("b", "r1", captured_by=2, first_captured_by=2),
        province("c", "r2"),
    ]
    difficulties = {"a": "Hard", "b": "Easy", "c": "Medium"}

    score = compute_score(provinces, 1, 2, difficulties)

    assert score.player_base_points == 500
    assert score.player_bonus_points == 250
    assert score.player_points == 750
    assert score.friend_points == 150


def test_recaptured_province_leaves_bonus_with_first_captor():
    # Player 2 stole the province, but player 1 first-captured it.
    provinces = [province("a", "r1", captured_by=2, first_captured_by=1)]
    difficulties = {"a": "Medium"}

    score = compute_score(provinces, 1, 2, difficulties)

    assert score.player_base_points == 0
    assert score.player_bonus_points == 125
    assert score.player_points == 125
    assert score.friend_base_points == 250
    assert score.friend_bonus_points == 0
    assert score.friend_points == 250


def test_counts_and_regions_unchanged():
    provinces = [
        province("a", "r1", captured_by=1, first_captured_by=1),
        province("b", "r1", captured_by=1, first_captured_by=1),
        province("c", "r2", captured_by=2, first_captured_by=2),
        province("d", "r2"),
    ]
    score = compute_score(provinces, 1, 2, {})

    assert score.player_provinces == 2
    assert score.friend_provinces == 1
    assert score.neutral_provinces == 1
    assert score.player_regions == 1
    assert score.friend_regions == 1
