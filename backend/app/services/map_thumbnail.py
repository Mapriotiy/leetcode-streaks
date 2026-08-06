"""Server-side lobby map thumbnails (Pillow).

Takes a lobby id and renders the current map state — sea base, island art,
province regions and capture colors — straight from the DB + local assets.
No LeetCode/GraphQL calls, no lobby syncs.

Asset files (sea bases, island backs, island SVGs) live under
`frontend/public`, which is present in the repo working tree on Render too.
"""

from __future__ import annotations

import io
import re
from pathlib import Path

from PIL import Image, ImageDraw

from app.db.session import SessionLocal
from app.models.lobby import Lobby
from app.models.lobby_map import LobbyMap
from app.models.lobby_map_province import LobbyMapProvince
from app.models.lobby_player import LobbyPlayer

PUBLIC_DIR = Path(__file__).resolve().parents[3] / "frontend" / "public"

# Default canvas (matches the renderer's aspect ratio).
MAP_W, MAP_H = 1321, 900

# Free-for-all fallback player palette (mirrors the frontend FACTION_COLORS).
FACTION_PALETTE = ["#00c2ff", "#ff4d6d", "#ffb020", "#27d980", "#9b7cff", "#4f9cff", "#ff7a59", "#a3e635"]

_CMD = re.compile(r"([MmLlCcQqZz])")
_NUM = re.compile(r"[-+]?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?")
_VIEWBOX = re.compile(r'viewBox="([^"]+)"')
_PATH_TAG = re.compile(r"<path\b([^>]*)>")
_D_ATTR = re.compile(r'\bd="([^"]+)"')

_svg_cache: dict[str, tuple[list[float], list[str]]] = {}


def _asset(path: str) -> Path:
    return PUBLIC_DIR / path


def _load_image(path: str) -> Image.Image:
    return Image.open(_asset(path)).convert("RGBA")


def _sample_path(d: str, samples: int = 18) -> list[list[tuple[float, float]]]:
    """Approximate an SVG path `d` into polygons (one per subpath) by sampling
    cubic/quadratic beziers. Returns coordinates in the path's own space."""
    tokens: list[tuple[str, str | float]] = []
    pos = 0
    while pos < len(d):
        m = _CMD.match(d, pos)
        if m:
            tokens.append(("cmd", m.group(1)))
            pos = m.end()
            continue
        n = _NUM.match(d, pos)
        if n:
            tokens.append(("num", float(n.group(0))))
            pos = n.end()
            continue
        pos += 1

    polygons: list[list[tuple[float, float]]] = []
    cur = (0.0, 0.0)
    start = (0.0, 0.0)
    sub: list[tuple[float, float]] = []
    cmd: str | None = None
    i = 0
    n = len(tokens)

    def nums(count: int) -> list[float]:
        nonlocal i
        out = [tokens[j][1] for j in range(i, min(n, i + count)) if tokens[j][0] == "num"]
        i += count
        return out

    while i < n:
        tok = tokens[i]
        if tok[0] == "cmd":
            cmd = str(tok[1])
            i += 1
            continue
        if cmd is None:
            i += 1
            continue

        if cmd in ("M", "m"):
            vals = nums(2)
            if len(vals) < 2:
                i = n
                break
            x, y = vals
            if cmd == "m":
                x += cur[0]
                y += cur[1]
            if sub:
                polygons.append(sub)
            sub = [(x, y)]
            start = (x, y)
            cur = (x, y)
            cmd = "L" if cmd == "m" else "L"
        elif cmd in ("L", "l"):
            vals = nums(2)
            if len(vals) < 2:
                i = n
                break
            x, y = vals
            if cmd == "l":
                x += cur[0]
                y += cur[1]
            sub.append((x, y))
            cur = (x, y)
        elif cmd in ("C", "c"):
            vals = nums(6)
            if len(vals) < 6:
                i = n
                break
            c1x, c1y, c2x, c2y, x, y = vals
            if cmd == "c":
                c1x += cur[0]
                c1y += cur[1]
                c2x += cur[0]
                c2y += cur[1]
                x += cur[0]
                y += cur[1]
            p0 = cur
            for s in range(1, samples + 1):
                t = s / samples
                mt = 1 - t
                sub.append(
                    (
                        mt ** 3 * p0[0] + 3 * mt * mt * t * c1x + 3 * mt * t * t * c2x + t ** 3 * x,
                        mt ** 3 * p0[1] + 3 * mt * mt * t * c1y + 3 * mt * t * t * c2y + t ** 3 * y,
                    )
                )
            cur = (x, y)
        elif cmd in ("Q", "q"):
            vals = nums(4)
            if len(vals) < 4:
                i = n
                break
            cx, cy, x, y = vals
            if cmd == "q":
                cx += cur[0]
                cy += cur[1]
                x += cur[0]
                y += cur[1]
            p0 = cur
            for s in range(1, samples + 1):
                t = s / samples
                mt = 1 - t
                sub.append((mt * mt * p0[0] + 2 * mt * t * cx + t * t * x, mt * mt * p0[1] + 2 * mt * t * cy + t * t * y))
            cur = (x, y)
        elif cmd in ("Z", "z"):
            if sub:
                sub.append(start)
                polygons.append(sub)
                sub = []
            cur = start
            cmd = None
            i += 1
        else:
            i += 1

    if sub:
        polygons.append(sub)
    return polygons


def _island_svg(svg_path: str) -> tuple[list[float], list[str]]:
    """Return (viewBox, [path `d` strings in document order])."""
    cached = _svg_cache.get(svg_path)
    if cached is not None:
        return cached
    text = _asset(svg_path).read_text(encoding="utf-8")
    vb = _VIEWBOX.search(text)
    viewbox = [float(x) for x in vb.group(1).split()] if vb else [0.0, 0.0, 100.0, 100.0]
    ds: list[str] = []
    for tag in _PATH_TAG.finditer(text):
        m = _D_ATTR.search(tag.group(1))
        if m:
            ds.append(m.group(1))
    _svg_cache[svg_path] = (viewbox, ds)
    return viewbox, ds


def _hex_rgb(value: str) -> tuple[int, int, int]:
    value = value.lstrip("#")
    if len(value) != 6:
        return (143, 116, 88)
    return (int(value[0:2], 16), int(value[2:4], 16), int(value[4:6], 16))


def _blend(color: tuple[int, int, int], base: tuple[int, int, int], weight: float) -> tuple[int, int, int]:
    """weight of `color` toward `base` (matches the frontend's mixHex)."""
    return tuple(round(c * weight + b * (1 - weight)) for c, b in zip(color, base))


def _transform(polygons, viewbox, box_w: int, box_h: int) -> list[list[tuple[int, int]]]:
    vx, vy, vw, vh = viewbox
    out = []
    for poly in polygons:
        pts = [
            (round((x - vx) / vw * box_w), round((y - vy) / vh * box_h))
            for x, y in poly
            if (x - vx) / vw * box_w > -1 and (y - vy) / vh * box_h > -1
        ]
        if len(pts) >= 3:
            out.append(pts)
    return out


def _render_draft(
    draft: dict,
    capture_color_by_province: dict[str, str],
    width: int,
) -> Image.Image:
    scale = width / MAP_W
    height = max(1, round(MAP_H * scale))
    sea_src = draft.get("seaBaseSrc") or "maps/leet_background.webp"

    img = _load_image(sea_src).resize((width, height))

    regions = {
        str(region.get("regionId")): str(region.get("color") or "#8f7458")
        for region in (draft.get("regions") or [])
        if isinstance(region, dict) and region.get("regionId")
    }

    # pathIndex is per-island (each island numbers its own paths from 0), so it
    # must be resolved per island — matching the frontend's island filter.
    def province_by_path_for(island_id: str) -> dict[int, dict]:
        by_path: dict[int, dict] = {}
        for province in draft.get("provinces") or []:
            if not isinstance(province, dict):
                continue
            if str(province.get("islandId") or "") != island_id:
                continue
            try:
                by_path[int(province.get("pathIndex"))] = province
            except (TypeError, ValueError):
                continue
        return by_path

    for island in draft.get("islands") or []:
        if not isinstance(island, dict):
            continue
        svg_path = island.get("svgPath")
        back_path = island.get("backPath")
        if not svg_path or not back_path:
            continue
        try:
            box_w = max(1, round(float(island.get("width", 100)) / 100 * width))
        except (TypeError, ValueError):
            box_w = width
        ar = str(island.get("aspectRatio") or "1 / 1")
        try:
            aw, ah = [float(x) for x in ar.replace(" ", "").split("/")]
        except ValueError:
            aw, ah = 1.0, 1.0
        box_h = max(1, round(box_w * ah / aw))
        left = round(float(island.get("left", 0)) / 100 * width)
        top = round(float(island.get("top", 0)) / 100 * height)

        viewbox, path_ds = _island_svg(svg_path)
        island_provinces = province_by_path_for(str(island.get("islandId") or ""))
        mask = Image.new("L", (box_w, box_h), 0)
        md = ImageDraw.Draw(mask)
        for d in path_ds:
            for pts in _transform(_sample_path(d), viewbox, box_w, box_h):
                md.polygon(pts, fill=255)

        # Island art, clipped to the silhouette.
        back = _load_image(back_path).resize((box_w, box_h))
        layer = Image.new("RGBA", (width, height), (0, 0, 0, 0))
        layer.paste(back, (left, top), mask)
        img = Image.alpha_composite(img, layer)

        # Provinces: region tint, overridden by capture (faction) color.
        # Matches the frontend renderer's darkened fills/strokes.
        fill_layer = Image.new("RGBA", (box_w, box_h), (0, 0, 0, 0))
        fd = ImageDraw.Draw(fill_layer)
        for index, d in enumerate(path_ds):
            province = island_provinces.get(index)
            if not province:
                continue
            province_id = str(province.get("provinceId") or "")
            region_rgb = _hex_rgb(regions.get(str(province.get("regionId") or "")) or "#8f7458")
            capture_hex = capture_color_by_province.get(province_id)
            if capture_hex:
                base_rgb = _hex_rgb(capture_hex)
                fill_rgb = _blend(base_rgb, (39, 35, 35), 0.46)
                stroke_rgb = _blend(base_rgb, (58, 37, 40), 0.72)
                fill_alpha = 85
                stroke_alpha = 205
                stroke_width = max(2, round(scale * 2.8))
            else:
                fill_rgb = _blend(region_rgb, (36, 40, 39), 0.7)
                stroke_rgb = _blend(region_rgb, (48, 51, 50), 0.82)
                fill_alpha = 35
                stroke_alpha = 185
                stroke_width = max(1, round(scale * 1.2))
            for pts in _transform(_sample_path(d), viewbox, box_w, box_h):
                fd.polygon(pts, fill=fill_rgb + (fill_alpha,))
                fd.line(pts + [pts[0]], fill=stroke_rgb + (stroke_alpha,), width=stroke_width)
        layer2 = Image.new("RGBA", (width, height), (0, 0, 0, 0))
        layer2.paste(fill_layer, (left, top), mask)
        img = Image.alpha_composite(img, layer2)

    return img


def render_lobby_map_thumbnail(
    lobby_id: int,
    width: int = 320,
    quality: int = 82,
    fmt: str = "png",
    db=None,
) -> bytes | None:
    """Render the lobby's current map state from the DB only."""
    owns_db = db is None
    if owns_db:
        db = SessionLocal()
    try:
        lobby = db.get(Lobby, lobby_id)
        if not lobby:
            return None
        lmap = db.query(LobbyMap).filter_by(lobby_id=lobby_id).first()
        if not lmap or not lmap.map_config:
            return None
        selection = lmap.map_config
        draft = selection.get("draft") if isinstance(selection, dict) else None
        if not isinstance(draft, dict):
            return None

        players = db.query(LobbyPlayer).filter_by(lobby_id=lobby_id).all()
        faction_color = {
            faction.get("id"): faction.get("color")
            for faction in lobby_factions(lobby)
            if faction.get("color")
        }

        def capture_color(faction_id: int | None) -> str | None:
            if faction_id is None:
                return None
            if faction_id in faction_color:
                return str(faction_color[faction_id])
            # Free-for-all: players get faction_id = seat number; match the
            # frontend's FACTION_COLORS fallback palette.
            if 1 <= faction_id <= len(FACTION_PALETTE):
                return FACTION_PALETTE[faction_id - 1]
            return None

        faction_by_user = {p.user_id: p.faction_id for p in players if p.faction_id}

        captures: dict[str, str] = {}
        rows = (
            db.query(LobbyMapProvince.province_id, LobbyMapProvince.captured_by)
            .filter_by(lobby_map_id=lmap.id)
            .all()
        )
        for province_id, owner_id in rows:
            if not owner_id:
                continue
            color = capture_color(faction_by_user.get(owner_id))
            if color:
                captures[province_id] = color

        img = _render_draft(draft, captures, width)
        buf = io.BytesIO()
        if fmt == "webp":
            img.convert("RGB").save(buf, format="WEBP", quality=quality)
        else:
            img.convert("RGB").save(buf, format="PNG")
        return buf.getvalue()
    finally:
        if owns_db:
            db.close()


def lobby_factions(lobby: Lobby) -> list[dict]:
    from app.services.lobby_settings import lobby_factions

    return lobby_factions(lobby)
