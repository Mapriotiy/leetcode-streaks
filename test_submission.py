import asyncio, httpx

URL = "https://leetcode.com/graphql"
HEADERS = {"Content-Type": "application/json", "Referer": "https://leetcode.com/problemset/", "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}

QUERY = """
query ($username: String!, $limit: Int!) {
  recentAcSubmissionList(username: $username, limit: $limit) {
    id
    title
    titleSlug
    timestamp
    lang
  }
}
"""

async def test():
    async with httpx.AsyncClient(timeout=15) as c:
        resp = await c.post(URL, json={
            "query": QUERY,
            "variables": {"username": "neetcode", "limit": 3}
        }, headers=HEADERS)
        print(f"Status: {resp.status_code}")
        raw = resp.text
        print(f"Body[:500]: {raw[:500]}")

asyncio.run(test())

