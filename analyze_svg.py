import re

with open(r'C:\projectfolder\leetcode-streaks\frontend\public\leet_map.svg', 'r') as f:
    content = f.read()

paths = re.findall(r'd="([^"]+)"', content)
all_x = []
all_y = []
for d in paths:
    coords = re.findall(r'[-]?\d+\.?\d*', d)
    for i in range(0, len(coords) - 1, 2):
        all_x.append(float(coords[i]))
        all_y.append(float(coords[i + 1]))

scale = 0.26458333
min_x = min(all_x) * scale
max_x = max(all_x) * scale
min_y = min(all_y) * scale
max_y = max(all_y) * scale
print(f"Path bounds (mm): x={min_x:.1f}-{max_x:.1f}  y={min_y:.1f}-{max_y:.1f}")
print(f"SVG viewBox: 0 0 349.56787 238.00241")
print(f"SVG ratio: {349.56787/238.00241:.5f}")
print(f"PNG: 1321x900")
print(f"PNG ratio: {1321/900:.5f}")
print(f"PNG filename: leet_background.png (was background.png)")
