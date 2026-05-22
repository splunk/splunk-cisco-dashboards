#!/usr/bin/env python3
"""Map stanzas missing drilldown metadata to their available ds_/drilldown targets."""
import re

f = "packages/splunk-cisco-dashboards/src/main/resources/splunk/default/searchbase.conf"
content = open(f).read()

blocks = {}
snames = {}
cur = None
for line in content.splitlines():
    m = re.match(r'^\[([^\]]+)\]', line)
    if m:
        cur = m.group(1)
        blocks[cur] = []
    elif cur:
        blocks[cur].append(line)
        sn = re.match(r'^search_name\s*=\s*(.+)', line)
        if sn:
            snames[cur] = sn.group(1).strip()

ds = {n for n in blocks if '_ds_' in n}
dr = {n for n in blocks if n.endswith('_drilldown')}
targets = ds | dr

missing_with = []
missing_without = []
has_drill = 0

for name in blocks:
    text = "\n".join(blocks[name])
    if '_ds_' in name or name.endswith('_drilldown'):
        continue
    if 'drilldown_search_name' in text:
        has_drill += 1
        continue

    matched = []
    for t in targets:
        p = t.split('_ds_')
        if len(p) == 2 and name.startswith(p[0] + '_'):
            matched.append(t)
        elif t.replace('_drilldown', '') == name:
            matched.append(t)
    if matched:
        missing_with.append((name, matched))
    else:
        missing_without.append(name)

print(f"Already have drilldown: {has_drill}")
print(f"Missing WITH targets available: {len(missing_with)}")
print(f"Missing WITHOUT targets: {len(missing_without)}")

print(f"\n--- HAVE TARGETS (can wire up) ---")
for name, ts in sorted(missing_with):
    print(f"  {name}")
    for t in sorted(ts):
        print(f"    -> {t} | {snames.get(t, '?')}")

print(f"\n--- NO TARGETS (need new drilldown stanzas or skip) ---")
for name in sorted(missing_without):
    print(f"  {name}")
