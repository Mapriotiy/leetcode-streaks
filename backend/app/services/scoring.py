"""Score computation for a weekly map."""

from app.models.weekly_map_province import WeeklyMapProvince
from app.schemas.maps import ScoreResponse


def compute_score(
    provinces: list[WeeklyMapProvince],
    current_user_id: int,
    friend_id: int,
) -> ScoreResponse:
    total = len(provinces)
    player_provinces = 0
    friend_provinces = 0

    for p in provinces:
        if p.captured_by == current_user_id:
            player_provinces += 1
        elif p.captured_by == friend_id:
            friend_provinces += 1

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
    )
