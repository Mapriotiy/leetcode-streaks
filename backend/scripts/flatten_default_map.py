"""Flatten the legacy default-map SVG into maps/default-islands.svg.

Reads the SVG string from frontend/src/mapSvgString.ts, applies every group
and path transform so all province paths end up in viewBox coordinates, and
writes a minimal flattened SVG for the generated-map renderer.
"""
import io
import sys
from pathlib import Path

import svgelements as se
from svgelements import SVG

ROOT = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(".")
SRC = ROOT / "frontend/src/mapSvgString.ts"
OUT = ROOT / "frontend/public/maps/default-islands.svg"

VIEWBOX = (0, 0, 349.56787, 238.00241)


def path_to_d(path) -> str:
    m = path.transform
    out = []
    for seg in path:
        if isinstance(seg, se.Move):
            pt = m.point_in_matrix_space(seg.end)
            out.append(f"M {pt.x:.4f} {pt.y:.4f}")
        elif isinstance(seg, se.Line):
            pt = m.point_in_matrix_space(seg.end)
            out.append(f"L {pt.x:.4f} {pt.y:.4f}")
        elif isinstance(seg, se.CubicBezier):
            c1 = m.point_in_matrix_space(seg.control1)
            c2 = m.point_in_matrix_space(seg.control2)
            end = m.point_in_matrix_space(seg.end)
            out.append(f"C {c1.x:.4f} {c1.y:.4f} {c2.x:.4f} {c2.y:.4f} {end.x:.4f} {end.y:.4f}")
        elif isinstance(seg, se.QuadraticBezier):
            c = m.point_in_matrix_space(seg.control)
            end = m.point_in_matrix_space(seg.end)
            out.append(f"Q {c.x:.4f} {c.y:.4f} {end.x:.4f} {end.y:.4f}")
        elif isinstance(seg, se.Arc):
            pts = [m.point_in_matrix_space(p) for p in seg.points()]
            if pts:
                out.append("L " + " ".join(f"{p.x:.4f} {p.y:.4f}" for p in pts[1:]))
        elif isinstance(seg, se.Close):
            out.append("Z")
    return " ".join(out)


text = SRC.read_text(encoding="utf-8")
start = text.find("`")
end = text.rfind("`")
svg_text = text[start + 1 : end]

svg = SVG.parse(io.StringIO(svg_text))
provinces = [el for el in svg.elements() if getattr(el, "values", {}).get("class") == "prov"]

parts = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %.6f %.6f">' % (VIEWBOX[2], VIEWBOX[3])]

for el in provinces:
    el_id = getattr(el, "values", {}).get("id", "")
    parts.append(f'<path class="prov" id="{el_id}" d="{path_to_d(el)}"/>')

parts.append("</svg>")
OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text("\n".join(parts), encoding="utf-8")
print(f"wrote {OUT} with {len(provinces)} provinces")
