import json
from datetime import datetime, timezone

import httpx
from fastapi import HTTPException, status

from app.schemas.leetcode import LeetCodeProfileResponse, SolvedStats


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


class LeetCodeClient:
    async def get_user_profile(self, username: str) -> LeetCodeProfileResponse:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                LEETCODE_GRAPHQL_URL,
                json={
                    "query": USER_PUBLIC_PROFILE_QUERY,
                    "variables": {"username": username},
                },
                headers={
                    "Content-Type": "application/json",
                    "Referer": "https://leetcode.com",
                    "User-Agent": "leetcode-streaks-dev",
                },
            )

        if response.status_code != status.HTTP_200_OK:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="LeetCode API request failed",
            )

        payload = response.json()

        if payload.get("errors"):
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="LeetCode API returned an error",
            )

        matched_user = payload.get("data", {}).get("matchedUser")
        if matched_user is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="LeetCode user not found",
            )

        return self._normalize_profile(matched_user)

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