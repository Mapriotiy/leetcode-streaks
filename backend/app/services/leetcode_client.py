import json
from datetime import datetime, timezone

import httpx
from fastapi import HTTPException, status

from app.schemas.leetcode import (
    LeetCodeProfileResponse,
    RecentAcceptedSubmission,
    SolvedStats,
)


LEETCODE_GRAPHQL_URL = "https://leetcode.com/graphql"

USER_PUBLIC_PROFILE_QUERY = """
query userPublicProfile($username: String!) {
  matchedUser(username: $username) {
    username
    profile {
      realName
      userAvatar
      ranking
    }
    submitStats {
      acSubmissionNum {
        difficulty
        count
      }
    }
    submissionCalendar
  }
}
"""

RECENT_ACCEPTED_SUBMISSIONS_QUERY = """
query recentAcSubmissions($username: String!, $limit: Int!) {
  recentAcSubmissionList(username: $username, limit: $limit) {
    title
    titleSlug
    timestamp
    lang
  }
}
"""


class LeetCodeClient:
    async def get_user_profile(self, username: str) -> LeetCodeProfileResponse:
        payload = await self._post_graphql(
            query=USER_PUBLIC_PROFILE_QUERY,
            variables={"username": username},
        )

        matched_user = payload.get("data", {}).get("matchedUser")
        if matched_user is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="LeetCode user not found",
            )

        return self._normalize_profile(matched_user)

    async def get_recent_accepted_submissions(
            self,
            username: str,
            limit: int = 20,
    ) -> list[RecentAcceptedSubmission]:
        payload = await self._post_graphql(
            query=RECENT_ACCEPTED_SUBMISSIONS_QUERY,
            variables={"username": username, "limit": limit},
        )

        submissions = payload.get("data", {}).get("recentAcSubmissionList") or []
        result: list[RecentAcceptedSubmission] = []

        for submission in submissions:
            title_slug = submission.get("titleSlug")
            timestamp = submission.get("timestamp")

            if not title_slug or not timestamp:
                continue

            submitted_at = datetime.fromtimestamp(
                int(timestamp),
                tz=timezone.utc,
            ).isoformat()

            result.append(
                RecentAcceptedSubmission(
                    title=submission.get("title") or title_slug,
                    title_slug=title_slug,
                    url=f"https://leetcode.com/problems/{title_slug}/",
                    submitted_at=submitted_at,
                    language=submission.get("lang"),
                )
            )

        return result

    async def _post_graphql(self, query: str, variables: dict) -> dict:
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(
                    LEETCODE_GRAPHQL_URL,
                    json={
                        "query": query,
                        "variables": variables,
                    },
                    headers={
                        "Content-Type": "application/json",
                        "Referer": "https://leetcode.com",
                        "User-Agent": "leetcode-streaks-dev",
                    },
                )
        except httpx.HTTPError as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Could not connect to LeetCode API",
            ) from exc

        if response.status_code != status.HTTP_200_OK:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="LeetCode API request failed",
            )

        try:
            payload = response.json()
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="LeetCode API returned invalid JSON",
            ) from exc

        if payload.get("errors"):
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="LeetCode API returned an error",
            )

        return payload

    def _normalize_profile(self, matched_user: dict) -> LeetCodeProfileResponse:
        profile = matched_user.get("profile") or {}

        return LeetCodeProfileResponse(
            username=matched_user["username"],
            real_name=profile.get("realName"),
            avatar_url=profile.get("userAvatar"),
            ranking=profile.get("ranking"),
            solved=self._parse_solved_stats(matched_user),
            submission_calendar=self._parse_submission_calendar(
                matched_user.get("submissionCalendar")
            ),
        )

    def _parse_solved_stats(self, matched_user: dict) -> SolvedStats:
        stats = SolvedStats()

        items = (
            matched_user.get("submitStats", {})
            .get("acSubmissionNum", [])
        )

        for item in items:
            difficulty = item.get("difficulty")
            count = item.get("count", 0)

            if difficulty == "All":
                stats.total = count
            elif difficulty == "Easy":
                stats.easy = count
            elif difficulty == "Medium":
                stats.medium = count
            elif difficulty == "Hard":
                stats.hard = count

        return stats

    def _parse_submission_calendar(self, raw_calendar: str | None) -> dict[str, int]:
        if not raw_calendar:
            return {}

        calendar = json.loads(raw_calendar)
        normalized: dict[str, int] = {}

        for timestamp, count in calendar.items():
            date = datetime.fromtimestamp(
                int(timestamp),
                tz=timezone.utc,
            ).date()

            normalized[date.isoformat()] = int(count)

        return normalized
