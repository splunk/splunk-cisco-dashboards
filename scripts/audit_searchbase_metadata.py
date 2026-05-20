#!/usr/bin/env python3
"""Audit searchbase.conf metadata: descriptions, categories, tags, etc.

For every stanza in ``searchbase.conf`` this report:

* Inventories which of the picker-relevant fields are present/empty:
  ``description``, ``explanation``, ``solution``, ``related_info``,
  ``category``, ``sub_category``, ``tags``.
* Surfaces tag and category vocabulary -- spelling variants, casing
  drift, redundant tags -- so we can normalise.
* Flags every stanza that does/does not carry the picker's gate tag
  ``Cisco``. The KpiPickerPanel filters the catalogue down to
  ``tags.includes('Cisco')``; anything missing the tag is invisible
  in the overview picker UI.

The output is markdown, written to
``scripts/searchbase_metadata_audit.md``.
"""
from __future__ import annotations

import re
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SEARCHBASE = (
    ROOT
    / "packages"
    / "splunk-cisco-dashboards"
    / "src"
    / "main"
    / "resources"
    / "splunk"
    / "default"
    / "searchbase.conf"
)
OUTPUT = ROOT / "scripts" / "searchbase_metadata_audit.md"

# Picker-relevant prose / classification fields.
PROSE_FIELDS = ("description", "explanation", "solution", "related_info")
CLASS_FIELDS = ("category", "sub_category", "tags")

# Lines that begin with these prefixes are stanza properties (rough
# heuristic: ``key = value``).
PROP_RE = re.compile(r"^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$")


def parse_searchbase(path: Path) -> list[dict]:
    """Return a list of stanza dicts: ``{name, line, props}``.

    ``props`` is a flat dict of trimmed string values; multi-line
    backslash continuations are joined.
    """
    stanzas: list[dict] = []
    current: dict | None = None
    pending_key: str | None = None
    pending_val: list[str] = []

    def flush_pending():
        nonlocal pending_key, pending_val, current
        if pending_key is not None and current is not None:
            current["props"][pending_key] = "\n".join(pending_val).rstrip()
        pending_key = None
        pending_val = []

    for lineno, raw in enumerate(path.read_text().splitlines(), 1):
        line = raw.rstrip("\r")
        # Stanza header.
        m = re.match(r"^\[([^\]]+)\]\s*$", line)
        if m:
            flush_pending()
            current = {"name": m.group(1), "line": lineno, "props": {}}
            stanzas.append(current)
            continue
        if current is None:
            continue
        # Comment / blank.
        if not line.strip() or line.lstrip().startswith("#"):
            flush_pending()
            continue
        # Continuation of previous prop value.
        if pending_key is not None and (line.startswith(" ") or line.startswith("\t") or pending_val[-1].endswith("\\")):
            # Strip trailing backslash on the previous segment if present.
            if pending_val and pending_val[-1].endswith("\\"):
                pending_val[-1] = pending_val[-1].rstrip("\\").rstrip()
            pending_val.append(line.lstrip())
            continue
        # New ``key = value``.
        prop_match = PROP_RE.match(line)
        if prop_match:
            flush_pending()
            pending_key = prop_match.group(1)
            pending_val = [prop_match.group(2)]
        else:
            # Free-form line that doesn't match — treat as continuation of
            # the previous prop value if we have one.
            if pending_key is not None:
                pending_val.append(line)

    flush_pending()
    return stanzas


def html_word_count(value: str) -> int:
    text = re.sub(r"<[^>]+>", " ", value)
    text = re.sub(r"&[a-z]+;", " ", text)
    return len(text.split())


def is_substantive(value: str, min_words: int = 5) -> bool:
    return html_word_count(value) >= min_words


def normalise_tags(raw: str) -> list[str]:
    if not raw:
        return []
    return [t.strip() for t in raw.split(",") if t.strip()]


def main() -> int:
    stanzas = parse_searchbase(SEARCHBASE)

    # Basic inventory counts.
    total = len(stanzas)
    missing_field: dict[str, list[str]] = defaultdict(list)
    thin_field: dict[str, list[str]] = defaultdict(list)

    cisco_tagged: list[str] = []
    cisco_untagged: list[str] = []

    all_tags = Counter()
    all_categories = Counter()
    all_subcategories = Counter()
    cat_to_subs: dict[str, Counter] = defaultdict(Counter)
    tag_examples: dict[str, str] = {}

    for st in stanzas:
        name = st["name"]
        props = st["props"]
        for f in PROSE_FIELDS + CLASS_FIELDS:
            if f not in props or not props[f].strip():
                missing_field[f].append(name)
            elif f in PROSE_FIELDS and not is_substantive(props[f]):
                thin_field[f].append(name)
        tags = normalise_tags(props.get("tags", ""))
        if "Cisco" in tags:
            cisco_tagged.append(name)
        else:
            cisco_untagged.append(name)
        for t in tags:
            all_tags[t] += 1
            tag_examples.setdefault(t, name)
        cat = props.get("category", "").strip()
        sub = props.get("sub_category", "").strip()
        if cat:
            all_categories[cat] += 1
            cat_to_subs[cat][sub] += 1
        if sub:
            all_subcategories[sub] += 1

    # Detect tag spelling variants by case-insensitive grouping.
    tag_groups: dict[str, list[str]] = defaultdict(list)
    for t in all_tags:
        tag_groups[t.lower()].append(t)
    tag_variants = {k: v for k, v in tag_groups.items() if len(v) > 1}

    cat_groups: dict[str, list[str]] = defaultdict(list)
    for c in all_categories:
        cat_groups[c.lower()].append(c)
    cat_variants = {k: v for k, v in cat_groups.items() if len(v) > 1}

    sub_groups: dict[str, list[str]] = defaultdict(list)
    for s in all_subcategories:
        sub_groups[s.lower()].append(s)
    sub_variants = {k: v for k, v in sub_groups.items() if len(v) > 1}

    # ---- Build the markdown report. ----
    out: list[str] = []
    out.append("# searchbase.conf metadata audit\n")
    out.append(f"_Source:_ `{SEARCHBASE.relative_to(ROOT)}`")
    out.append(f"_Total stanzas:_ **{total}**\n")

    out.append("## Picker-gate (`Cisco` tag) coverage\n")
    out.append(
        "The overview picker filters the catalogue with "
        "`entry.tags.includes('Cisco')` "
        "(`KpiPickerPanel.tsx:431`). Anything missing the `Cisco` tag is invisible "
        "in the picker UI.\n"
    )
    out.append("| Bucket | Count |")
    out.append("|---|---:|")
    out.append(f"| Stanzas with `Cisco` tag (visible in picker) | {len(cisco_tagged)} |")
    out.append(f"| Stanzas without `Cisco` tag (hidden from picker) | {len(cisco_untagged)} |\n")

    out.append("## Missing prose / classification fields\n")
    out.append("| Field | Stanzas missing | Stanzas with thin content (<5 words) |")
    out.append("|---|---:|---:|")
    for f in PROSE_FIELDS + CLASS_FIELDS:
        thin_count = len(thin_field.get(f, [])) if f in PROSE_FIELDS else "-"
        out.append(f"| `{f}` | {len(missing_field.get(f, []))} | {thin_count} |")
    out.append("")

    if any(missing_field.values()) or any(thin_field.values()):
        out.append("### Detail per gap\n")
        for f in PROSE_FIELDS + CLASS_FIELDS:
            stanzas_missing = missing_field.get(f, [])
            stanzas_thin = thin_field.get(f, []) if f in PROSE_FIELDS else []
            if not stanzas_missing and not stanzas_thin:
                continue
            out.append(f"#### `{f}`")
            if stanzas_missing:
                out.append(f"\n_Missing entirely ({len(stanzas_missing)}):_\n")
                for s in stanzas_missing[:80]:
                    out.append(f"- `[{s}]`")
                if len(stanzas_missing) > 80:
                    out.append(f"- … +{len(stanzas_missing) - 80} more\n")
            if stanzas_thin:
                out.append(f"\n_Thin (<5 words) ({len(stanzas_thin)}):_\n")
                for s in stanzas_thin[:40]:
                    out.append(f"- `[{s}]`")
                if len(stanzas_thin) > 40:
                    out.append(f"- … +{len(stanzas_thin) - 40} more\n")
            out.append("")

    out.append("## Category vocabulary\n")
    out.append("| Category | Count | Sub-categories |")
    out.append("|---|---:|---|")
    for cat, n in all_categories.most_common():
        subs = cat_to_subs[cat]
        sub_summary = ", ".join(f"`{s or '(empty)'}` ({c})" for s, c in subs.most_common())
        out.append(f"| `{cat}` | {n} | {sub_summary} |")
    out.append("")
    if cat_variants:
        out.append("### Likely category casing variants\n")
        for k, vs in cat_variants.items():
            out.append(f"- `{k}` &rarr; {', '.join(f'`{v}`' for v in vs)}")
        out.append("")
    if sub_variants:
        out.append("### Likely sub-category casing variants\n")
        for k, vs in sub_variants.items():
            out.append(f"- `{k}` &rarr; {', '.join(f'`{v}`' for v in vs)}")
        out.append("")

    out.append("## Tag vocabulary\n")
    out.append(f"_Total distinct tags:_ **{len(all_tags)}**\n")
    out.append("| Tag | Count |")
    out.append("|---|---:|")
    for t, n in all_tags.most_common():
        out.append(f"| `{t}` | {n} |")
    out.append("")
    if tag_variants:
        out.append("### Likely tag casing/spelling variants\n")
        out.append("These look like the same logical tag with different casing or punctuation. "
                   "Pick one canonical form and rewrite the others.\n")
        for k, vs in sorted(tag_variants.items()):
            out.append(f"- `{k}` &rarr; {', '.join(f'`{v}`' for v in vs)}")
        out.append("")

    OUTPUT.write_text("\n".join(out) + "\n")
    print(f"Wrote {OUTPUT.relative_to(ROOT)}")
    print(f"  total stanzas:        {total}")
    print(f"  with Cisco tag:       {len(cisco_tagged)}")
    print(f"  without Cisco tag:    {len(cisco_untagged)}")
    for f in PROSE_FIELDS + CLASS_FIELDS:
        if missing_field.get(f):
            print(f"  missing {f}: {len(missing_field[f])}")
        if f in PROSE_FIELDS and thin_field.get(f):
            print(f"  thin    {f}: {len(thin_field[f])}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
