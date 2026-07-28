import logging
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.leetcode_problem import LeetCodeProblem
from app.services.leetcode_client import LeetCodeClient

logger = logging.getLogger(__name__)

CATALOG_REFRESH_INTERVAL_DAYS = 7
PROBLEMSET_PAGE_SIZE = 50


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


async def _fetch_via_rest(db: Session) -> int:
    url = "https://leetcode.com/api/problems/all/"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Referer": "https://leetcode.com/problemset/",
        "Accept": "application/json",
    }

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(url, headers=headers)
            if response.status_code != 200:
                logger.warning("REST API returned %s", response.status_code)
                return 0

            data = response.json()
            pairs = data.get("stat_status_pairs") or []
    except Exception as exc:
        logger.warning("REST API fetch failed: %s", exc)
        return 0

    rows = []
    for item in pairs:
        stat = item.get("stat") or {}
        frontend_id = stat.get("frontend_question_id")
        title = stat.get("question__title", "")
        title_slug = stat.get("question__title_slug", "")

        if not frontend_id or not title_slug:
            continue

        level = item.get("difficulty", {}).get("level", 1)
        difficulty = {1: "Easy", 2: "Medium", 3: "Hard"}.get(level, "Medium")

        rows.append({
            "frontend_id": int(frontend_id),
            "title": title,
            "title_slug": title_slug,
            "difficulty": difficulty,
            "topic_tags": [],
            "updated_at": _utcnow(),
        })

        if len(rows) >= 500:
            _bulk_upsert(db, rows)
            rows = []

    if rows:
        _bulk_upsert(db, rows)

    total = len(data.get("stat_status_pairs") or [])
    logger.info("REST fallback: processed %d problems", total)
    return total


async def refresh_catalog(db: Session) -> int:
    client = LeetCodeClient()
    total_seen = 0
    skip = 0

    while True:
        total, questions = await client.get_problemset_list(
            skip=skip, limit=PROBLEMSET_PAGE_SIZE,
        )

        if not questions:
            if skip == 0:
                logger.warning("GraphQL returned 0 problems — seeding fallback")
                _seed_fallback_problems(db)
                return 80
            break

        rows = [
            {
                "frontend_id": q["frontend_id"],
                "title": q["title"],
                "title_slug": q["title_slug"],
                "difficulty": q["difficulty"],
                "topic_tags": q["topic_tags"],
                "updated_at": _utcnow(),
            }
            for q in questions
        ]

        _bulk_upsert(db, rows)
        total_seen += len(questions)
        skip += PROBLEMSET_PAGE_SIZE

        if skip >= total or len(questions) < PROBLEMSET_PAGE_SIZE:
            break

    if total_seen < 200:
        logger.warning("GraphQL returned only %d — adding fallback seed", total_seen)
        _seed_fallback_problems(db)
        total_seen = 80

    logger.info("refresh_catalog: %d problems in catalog", total_seen)
    return total_seen


def _seed_fallback_problems(db: Session) -> None:
    fallback = [
        (1, "Two Sum", "two-sum", "Easy", ["array", "hash-table"]),
        (2, "Add Two Numbers", "add-two-numbers", "Medium", ["linked-list"]),
        (3, "Longest Substring Without Repeating Characters", "longest-substring-without-repeating-characters", "Medium", ["hash-table", "sliding-window"]),
        (5, "Longest Palindromic Substring", "longest-palindromic-substring", "Medium", ["two-pointers"]),
        (7, "Reverse Integer", "reverse-integer", "Medium", []),
        (11, "Container With Most Water", "container-with-most-water", "Medium", ["two-pointers"]),
        (14, "Longest Common Prefix", "longest-common-prefix", "Easy", []),
        (15, "3Sum", "3sum", "Medium", ["array", "two-pointers"]),
        (20, "Valid Parentheses", "valid-parentheses", "Easy", ["stack"]),
        (21, "Merge Two Sorted Lists", "merge-two-sorted-lists", "Easy", ["linked-list"]),
        (26, "Remove Duplicates from Sorted Array", "remove-duplicates-from-sorted-array", "Easy", ["array"]),
        (33, "Search in Rotated Sorted Array", "search-in-rotated-sorted-array", "Medium", ["binary-search"]),
        (35, "Search Insert Position", "search-insert-position", "Easy", ["binary-search"]),
        (42, "Trapping Rain Water", "trapping-rain-water", "Hard", ["two-pointers"]),
        (46, "Permutations", "permutations", "Medium", []),
        (48, "Rotate Image", "rotate-image", "Medium", ["array"]),
        (49, "Group Anagrams", "group-anagrams", "Medium", ["hash-table"]),
        (53, "Maximum Subarray", "maximum-subarray", "Medium", ["array"]),
        (56, "Merge Intervals", "merge-intervals", "Medium", ["array"]),
        (70, "Climbing Stairs", "climbing-stairs", "Easy", []),
        (72, "Edit Distance", "edit-distance", "Medium", []),
        (73, "Set Matrix Zeroes", "set-matrix-zeroes", "Medium", ["array"]),
        (74, "Search a 2D Matrix", "search-a-2d-matrix", "Medium", ["binary-search"]),
        (76, "Minimum Window Substring", "minimum-window-substring", "Hard", ["sliding-window"]),
        (79, "Word Search", "word-search", "Medium", []),
        (84, "Largest Rectangle in Histogram", "largest-rectangle-in-histogram", "Hard", ["stack"]),
        (94, "Binary Tree Inorder Traversal", "binary-tree-inorder-traversal", "Easy", ["tree"]),
        (98, "Validate Binary Search Tree", "validate-binary-search-tree", "Medium", ["tree"]),
        (100, "Same Tree", "same-tree", "Easy", ["tree"]),
        (101, "Symmetric Tree", "symmetric-tree", "Easy", ["tree"]),
        (102, "Binary Tree Level Order Traversal", "binary-tree-level-order-traversal", "Medium", ["tree"]),
        (104, "Maximum Depth of Binary Tree", "maximum-depth-of-binary-tree", "Easy", ["tree"]),
        (105, "Construct Binary Tree from Preorder and Inorder Traversal", "construct-binary-tree-from-preorder-and-inorder-traversal", "Medium", ["tree"]),
        (108, "Convert Sorted Array to Binary Search Tree", "convert-sorted-array-to-binary-search-tree", "Easy", ["tree"]),
        (121, "Best Time to Buy and Sell Stock", "best-time-to-buy-and-sell-stock", "Easy", ["array"]),
        (124, "Binary Tree Maximum Path Sum", "binary-tree-maximum-path-sum", "Hard", ["tree"]),
        (125, "Valid Palindrome", "valid-palindrome", "Easy", ["two-pointers"]),
        (128, "Longest Consecutive Sequence", "longest-consecutive-sequence", "Medium", ["hash-table"]),
        (133, "Clone Graph", "clone-graph", "Medium", ["graph"]),
        (136, "Single Number", "single-number", "Easy", []),
        (141, "Linked List Cycle", "linked-list-cycle", "Easy", ["linked-list"]),
        (142, "Linked List Cycle II", "linked-list-cycle-ii", "Medium", ["linked-list"]),
        (146, "LRU Cache", "lru-cache", "Medium", []),
        (150, "Evaluate Reverse Polish Notation", "evaluate-reverse-polish-notation", "Medium", ["stack"]),
        (155, "Min Stack", "min-stack", "Medium", ["stack"]),
        (160, "Intersection of Two Linked Lists", "intersection-of-two-linked-lists", "Easy", ["linked-list"]),
        (167, "Two Sum II - Input Array Is Sorted", "two-sum-ii-input-array-is-sorted", "Medium", ["two-pointers"]),
        (200, "Number of Islands", "number-of-islands", "Medium", []),
        (206, "Reverse Linked List", "reverse-linked-list", "Easy", ["linked-list"]),
        (207, "Course Schedule", "course-schedule", "Medium", ["graph"]),
        (208, "Implement Trie (Prefix Tree)", "implement-trie-prefix-tree", "Medium", ["graph"]),
        (210, "Course Schedule II", "course-schedule-ii", "Medium", ["graph"]),
        (215, "Kth Largest Element in an Array", "kth-largest-element-in-an-array", "Medium", []),
        (217, "Contains Duplicate", "contains-duplicate", "Easy", ["hash-table"]),
        (226, "Invert Binary Tree", "invert-binary-tree", "Easy", ["tree"]),
        (230, "Kth Smallest Element in a BST", "kth-smallest-element-in-a-bst", "Medium", ["tree"]),
        (234, "Palindrome Linked List", "palindrome-linked-list", "Easy", ["linked-list"]),
        (235, "Lowest Common Ancestor of a Binary Search Tree", "lowest-common-ancestor-of-a-binary-search-tree", "Medium", ["tree"]),
        (237, "Delete Node in a Linked List", "delete-node-in-a-linked-list", "Medium", ["linked-list"]),
        (242, "Valid Anagram", "valid-anagram", "Easy", ["hash-table"]),
        (252, "Meeting Rooms", "meeting-rooms", "Easy", []),
        (268, "Missing Number", "missing-number", "Easy", ["array"]),
        (283, "Move Zeroes", "move-zeroes", "Easy", ["array"]),
        (297, "Serialize and Deserialize Binary Tree", "serialize-and-deserialize-binary-tree", "Hard", ["tree"]),
        (322, "Coin Change", "coin-change", "Medium", []),
        (344, "Reverse String", "reverse-string", "Easy", ["two-pointers"]),
        (347, "Top K Frequent Elements", "top-k-frequent-elements", "Medium", ["hash-table"]),
        (383, "Ransom Note", "ransom-note", "Easy", ["hash-table"]),
        (394, "Decode String", "decode-string", "Medium", ["stack"]),
        (424, "Longest Repeating Character Replacement", "longest-repeating-character-replacement", "Medium", ["sliding-window"]),
        (438, "Find All Anagrams in a String", "find-all-anagrams-in-a-string", "Medium", ["sliding-window"]),
        (543, "Diameter of Binary Tree", "diameter-of-binary-tree", "Easy", ["tree"]),
        (572, "Subtree of Another Tree", "subtree-of-another-tree", "Easy", ["tree"]),
        (704, "Binary Search", "binary-search", "Easy", ["binary-search"]),
        (739, "Daily Temperatures", "daily-temperatures", "Medium", ["stack"]),
        (875, "Koko Eating Bananas", "koko-eating-bananas", "Medium", ["binary-search"]),
        (876, "Middle of the Linked List", "middle-of-the-linked-list", "Easy", ["linked-list"]),
        (981, "Time Based Key-Value Store", "time-based-key-value-store", "Medium", ["binary-search"]),
        (1143, "Longest Common Subsequence", "longest-common-subsequence", "Medium", []),
        (1299, "Replace Elements with Greatest Element on Right Side", "replace-elements-with-greatest-element-on-right-side", "Easy", ["array"]),
        (1472, "Design Browser History", "design-browser-history", "Medium", []),
        (1700, "Number of Students Unable to Eat Lunch", "number-of-students-unable-to-eat-lunch", "Easy", ["stack"]),
        (2095, "Delete the Middle Node of a Linked List", "delete-the-middle-node-of-a-linked-list", "Medium", ["linked-list"]),
    ]

    rows = [
        {
            "frontend_id": fid,
            "title": title,
            "title_slug": slug,
            "difficulty": diff,
            "topic_tags": tags,
            "updated_at": _utcnow(),
        }
        for fid, title, slug, diff, tags in fallback
    ]
    _bulk_upsert(db, rows)
    logger.info("Seeded %d fallback problems", len(rows))


def _bulk_upsert(db: Session, rows: list[dict]) -> None:
    if not rows:
        return
    from sqlalchemy.dialects.postgresql import insert as pg_insert
    from sqlalchemy.dialects.sqlite import insert as sqlite_insert

    dialect_name = db.bind.dialect.name
    insert_fn = pg_insert if dialect_name == "postgresql" else sqlite_insert

    excluded = insert_fn(LeetCodeProblem).excluded

    stmt = (
        insert_fn(LeetCodeProblem)
        .values(rows)
        .on_conflict_do_update(
            index_elements=["title_slug"],
            set_={
                "title": excluded.title,
                "frontend_id": excluded.frontend_id,
                "difficulty": excluded.difficulty,
                "topic_tags": excluded.topic_tags,
                "updated_at": excluded.updated_at,
            },
        )
    )
    db.execute(stmt)
    db.commit()


def needs_refresh(db: Session) -> bool:
    latest = (
        db.query(LeetCodeProblem.updated_at)
        .order_by(LeetCodeProblem.updated_at.desc())
        .first()
    )
    if latest is None:
        return True
    age = _utcnow() - latest[0].replace(tzinfo=timezone.utc) if latest[0].tzinfo is None else _utcnow() - latest[0]
    return age.days >= CATALOG_REFRESH_INTERVAL_DAYS


def get_problems_by_tags(
    tags: list[str],
    difficulty: str | None,
    exclude_slugs: set[str],
    db: Session,
) -> list[LeetCodeProblem]:
    query = select(LeetCodeProblem)
    if difficulty:
        query = query.where(LeetCodeProblem.difficulty == difficulty)

    rows = db.execute(query).scalars().all()

    result = []
    for p in rows:
        if p.title_slug in exclude_slugs:
            continue
        if not tags:
            result.append(p)
            continue
        problem_tags = set(p.topic_tags)
        if not problem_tags:
            result.append(p)
            continue
        if problem_tags & set(tags):
            result.append(p)

    return result


def get_any_unsolved(exclude_slugs: set[str], db: Session) -> list[LeetCodeProblem]:
    rows = db.execute(select(LeetCodeProblem)).scalars().all()
    return [p for p in rows if p.title_slug not in exclude_slugs]


async def ensure_catalog(db: Session) -> None:
    try:
        if needs_refresh(db):
            await refresh_catalog(db)
    except Exception:
        logger.exception("ensure_catalog failed")
        return