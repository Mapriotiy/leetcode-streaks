with open(r'C:\projectfolder\leetcode-streaks\frontend\src\mapSvgString.ts', 'r') as f:
    content = f.read()

import re
groups = ['g54', 'g53', 'g58', 'g66', 'g79', 'g89']
for g in groups:
    idx = content.find(f'id="{g}"')
    if idx == -1:
        print(f'{g}: NOT FOUND')
        continue
    chunk = content[idx:idx+500]
    m = re.search(r'fill:#[0-9a-fA-F]+', chunk)
    if not m:
        m = re.search(r'fill:#([0-9a-fA-F]+)', chunk)
    # search in first child path
    path_idx = content.find('class="prov"', idx)
    if path_idx != -1:
        path_chunk = content[path_idx:path_idx+200]
        fill_match = re.search(r'fill:#[0-9a-fA-F]+', path_chunk)
        if fill_match:
            print(f'{g}: {fill_match.group()}')

# isle3 = path53
idx = content.find('id="path53"')
if idx != -1:
    chunk = content[idx:idx+200]
    fill_match = re.search(r'fill:#[0-9a-fA-F]+', chunk)
    if fill_match:
        print(f'path53 (isle3): {fill_match.group()}')