"""Static map layout configuration and week calendar helpers."""

from datetime import date, datetime, time, timedelta, timezone

REGION_TOPICS: dict[str, dict] = {
    "isle1": {"tags": ["tree", "graph"], "difficulty": None},
    "isle2": {"tags": ["binary-search"], "difficulty": None},
    "isle3": {"tags": [], "difficulty": "Hard"},
    "region1": {"tags": ["linked-list"], "difficulty": None},
    "region2": {"tags": ["two-pointers", "sliding-window"], "difficulty": None},
    "region3": {"tags": ["array", "hash-table"], "difficulty": None},
    "region4": {"tags": ["stack"], "difficulty": None},
}

PROVINCE_REGION: dict[str, str] = {
    "path34": "isle1", "path36": "isle1",
    "path44": "isle2", "path48": "isle2", "path49": "isle2",
    "path53": "isle3",
    "path56": "region1", "path57": "region1", "path58": "region1", "path60": "region1",
    "path63": "region2", "path64": "region2", "path65": "region2", "path66": "region2",
    "path68": "region2", "path69": "region2",
    "path72": "region3", "path73": "region3", "path74": "region3", "path75": "region3",
    "path76": "region3", "path79": "region3", "path80": "region3",
    "path83": "region4", "path86": "region4", "path87": "region4",
    "path89": "region4", "path91": "region4",
}

REGION_NAMES: dict[str, str] = {
    "isle1": "Trees and Graphs",
    "isle2": "Binary Search",
    "isle3": "Hard Problem Land",
    "region1": "Linked Lists",
    "region2": "Two Pointers / Sliding Window",
    "region3": "Arrays and Hashing",
    "region4": "Stacks",
}


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def get_utc_today() -> date:
    return _utcnow().date()


def get_week_start(today: date | None = None) -> date:
    if today is None:
        today = get_utc_today()
    monday = today - timedelta(days=today.weekday())
    return monday


def week_start_datetime(week_start: date) -> datetime:
    """Naive UTC datetime for Monday 00:00 of the given week.

    DB datetimes are stored naive, so comparisons against solved_at must
    use naive UTC as well.
    """
    return datetime.combine(week_start, time.min)
