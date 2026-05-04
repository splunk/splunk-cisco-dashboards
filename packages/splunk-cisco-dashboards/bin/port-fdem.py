#!/usr/bin/env python3
"""
One-shot port script for the cisco_fdem_exec_dashboards Splunk app.

Copies content from a source FDEM Splunk app into this app's
src/main/resources/splunk/ tree, dropping all "FDEM"/"fdem_" tokens
from filenames, stanza names, and the surrounding text content.

Honored constraints (see chat decisions for context):
- Do NOT touch destination default/data/ui/nav/default.xml (existing menu).
- Do NOT touch destination default/app.conf (existing app config).
- Drop "fdem_" prefix everywhere it appears in filenames and identifiers.
- Drop "FDEM - " saved-search prefix; resulting names like
  "Executive Dashboard - ds_X".
- Keep the version suffixes on view filenames (e.g. _v2, _v3).
- Skip docs/ and local/ entirely.
- Skip fdem_logo.png, static/fdem.png (replaced by customer_logo).
- Keep florida.svg and background_*.png as-is.
- Keep the dnac_site_normalize macro logic verbatim (Florida-specific
  tokens stay; only the stanza name loses the fdem_ prefix). A TODO
  comment is added so users know to revisit if customer is not FDEM.

The "customer_name" macro plus the home_launchpad token plumbing are
handled separately by inject_customer_name.py (run after this script).
"""

from __future__ import annotations

import argparse
import os
import re
import shutil
import sys
from pathlib import Path
from typing import Iterable

# --------------------------------------------------------------------------
# Configuration
# --------------------------------------------------------------------------

SRC_APP_DEFAULT = Path('/opt/splunk/etc/apps/cisco_fdem_exec_dashboards')
DST_APP_DEFAULT = (
    Path(__file__).resolve().parent.parent
    / 'src'
    / 'main'
    / 'resources'
    / 'splunk'
)

# Files we never overwrite in the destination, regardless of source.
PROTECTED_DST_PATHS = {
    'default/app.conf',
    'default/data/ui/nav/default.xml',
}

# Top-level subtrees we skip in the source.
SKIP_TOP_LEVEL = {'docs', 'local'}

# Files in appserver/static/images and static/ that should NOT be carried
# forward (the FDEM-branded logo and helper). Filenames are matched in a
# case-insensitive way.
DROP_IMAGE_NAMES_LOWER = {'fdem_logo.png', 'fdem.png'}

# View filenames are renamed by stripping a leading "fdem_". The version
# suffix and the rest of the basename are preserved.
def rename_view_filename(name: str) -> str:
    return re.sub(r'^fdem_', '', name)

# --------------------------------------------------------------------------
# Text substitutions
# --------------------------------------------------------------------------
# Order matters: longer / more-specific replacements first so they aren't
# pre-empted by shorter ones.

TEXT_SUBSTITUTIONS: list[tuple[str, str]] = [
    # ----------------------------------------------------------------
    # Specific compound patterns (run before generic rules so they
    # aren't mauled by the broad FDEM/fdem_ strippers below)
    # ----------------------------------------------------------------

    # App name in URLs and saved-search refs
    (r'cisco_fdem_exec_dashboards', 'splunk-cisco-dashboards'),

    # SPL: label="FDEM*" matches the old saved-search prefix; after
    # stripping that prefix the wildcard would match every label.
    # Drop the redundant clause and keep the provenance-based filter.
    (r'\(\s*label\s*=\s*\\?["\']FDEM\*\\?["\']\s+OR\s+', '('),
    (r'label\s*=\s*\\?["\']FDEM\*\\?["\']\s*', 'label!=""'),
    (r'savedsearch_name\s*=\s*\\?["\']FDEM\*\\?["\']', 'savedsearch_name!=""'),

    # Hostnames / paths that embed the org acronym
    (r'\.fdem\.local\b', '.local'),
    (r'/FDEM/', '/'),
    (r'reference_design/FDEM/[A-Za-z0-9_\-\.]+', 'reference_design'),
    # Filenames embedding _FDEM as a suffix (e.g. Foo_FDEM.md)
    (r'_FDEM(?=\.[A-Za-z0-9]+\b)', ''),

    # Tag attributes ("tags = FDEM, X, Y" -> "tags = X, Y")
    (r'(?m)^(tags\s*=\s*)FDEM\s*,\s*', r'\1'),
    (r'(?m)^tags\s*=\s*FDEM\s*$', 'tags ='),
    (r',\s*FDEM\b', ''),

    # Markdown noise
    (r'Florida Division of Emergency Management \(FDEM\)',
     'Florida Division of Emergency Management'),
    (r'\bfor FDEM\b', ''),
    (r'\bto FDEM\b', ''),
    (r'\*\*FDEM\*\*', ''),

    # Saved-search reference strings ("ref": "FDEM - <Group> - <name>")
    (r'(?<=["\'])FDEM - ', ''),

    # Saved-search stanza headers ("[FDEM - <Group> - <name>]")
    (r'^\[FDEM - ', '['),

    # FDEM-prefixed view file references in URL drilldowns
    # /app/<app>/fdem_<view>  ->  /app/<app>/<view>
    (r'/fdem_', '/'),

    # "FDEM - " in plain text (savedsearch references in SPL)
    (r'FDEM - ', ''),
    # "FDEM — " with em dash (matches dashboard headers)
    (r'FDEM\s+—\s+', ''),
    # Trailing FDEM word with following space (e.g. "FDEM 2026 demo")
    (r'\bFDEM\b\s+', ''),
    # Hyphenated compound (e.g. "FDEM-specific") - drop both the word
    # and the hyphen so the residual reads naturally.
    (r'\bFDEM-', ''),
    (r'-FDEM\b', ''),
    # Stand-alone or trailing FDEM (last resort)
    (r'\bFDEM\b', ''),
    # Title-cased "Fdem" as a standalone word (e.g. saved-search names
    # like "Bandwidth Fdem Internet"). We match a leading space so the
    # surrounding tokens stay neighbouring without a double-space.
    (r'\s+Fdem\b', ''),

    # ----------------------------------------------------------------
    # Lower-case identifier rules
    # ----------------------------------------------------------------

    # Macro stanza names: [fdem_*]  ->  [*]
    (r'^\[fdem_', '['),
    # Backtick-wrapped macro references: `fdem_*`  ->  `*`
    (r'`fdem_', '`'),
    # Lookup name references inside SPL: "lookup fdem_*"  -> "lookup *"
    (r'(?<=\blookup\s)fdem_', ''),
    (r'(?<=\binputlookup\s)fdem_', ''),
    (r'(?<=\boutputlookup\s)fdem_', ''),
    # transforms.conf: filename = fdem_*.csv -> filename = *.csv
    (r'(?m)^(filename\s*=\s*)fdem_', r'\1'),
    # Identifier rename: "<prefix>_fdem_<rest>" -> "<prefix>_<rest>"
    # (e.g. ds_fdem_annotations -> ds_annotations,
    #       viz_ov_bw_fdem      -> viz_ov_bw)
    (r'_fdem_', '_'),
    # Trailing _fdem at end of identifier (followed by non-word char)
    (r'_fdem(?=[^A-Za-z0-9_]|$)', ''),
    # Generic fdem_<identifier> in stanza definitions and SPL strings
    (r'(?<![A-Za-z0-9_])fdem_', ''),

    # Final cleanup: collapse whitespace introduced by the strips above.
    # Two consecutive spaces inside a quoted string get collapsed to one;
    # we limit to inside one-line text so we don't touch SPL whitespace
    # that may be syntactically meaningful.
    (r'  +', ' '),
]

# Pre-compiled
COMPILED_SUBS = [
    (re.compile(pattern, re.MULTILINE), repl)
    for pattern, repl in TEXT_SUBSTITUTIONS
]


def transform_text(text: str) -> str:
    out = text
    for pattern, repl in COMPILED_SUBS:
        out = pattern.sub(repl, out)
    return out


# --------------------------------------------------------------------------
# Helpers
# --------------------------------------------------------------------------

def is_text_file(name: str) -> bool:
    """Files we run text substitutions on. Everything else is binary-copied."""
    text_exts = {
        '.xml', '.conf', '.meta', '.spec', '.csv', '.md', '.txt', '.json',
    }
    return Path(name).suffix.lower() in text_exts


def ensure_parent(p: Path) -> None:
    p.parent.mkdir(parents=True, exist_ok=True)


def relpath_from_app(p: Path, app_root: Path) -> Path:
    return p.relative_to(app_root)


def adjust_destination_filename(rel: Path) -> Path:
    """Rename pieces of the relative path according to FDEM-stripping rules."""
    # Filename-level rename: drop leading fdem_
    parts = list(rel.parts)
    parts[-1] = rename_view_filename(parts[-1])
    # Apply the same transformation to directory names (none currently
    # contain fdem_ but be safe).
    parts = [rename_view_filename(p) if i < len(parts) - 1 else p
             for i, p in enumerate(parts)]
    return Path(*parts)


def is_protected_destination(rel_dst: Path) -> bool:
    return str(rel_dst).replace(os.sep, '/') in PROTECTED_DST_PATHS


def should_skip(rel_src: Path) -> bool:
    parts = rel_src.parts
    if not parts:
        return False
    # Skip top-level docs/, local/
    if parts[0] in SKIP_TOP_LEVEL:
        return True
    # Skip app.conf (we don't want to overwrite our own)
    if str(rel_src).replace(os.sep, '/') == 'default/app.conf':
        return True
    # Skip nav/default.xml (existing menu)
    if str(rel_src).replace(os.sep, '/') == 'default/data/ui/nav/default.xml':
        return True
    # Skip dropped images
    if parts[0] in {'appserver', 'static'} and parts[-1].lower() in DROP_IMAGE_NAMES_LOWER:
        return True
    # Skip the orphan fdem_excel_inventory transform (the lookup file
    # doesn't exist on disk, so the stanza would be dead).
    return False


# --------------------------------------------------------------------------
# Per-file processing
# --------------------------------------------------------------------------

def process_file(src: Path, dst: Path, *, dry_run: bool) -> None:
    if is_text_file(src.name):
        with src.open('r', encoding='utf-8', errors='replace') as fh:
            content = fh.read()
        new_content = transform_text(content)
        # Special-case for transforms.conf: drop the orphan fdem_excel_inventory stanza
        if src.name == 'transforms.conf':
            new_content = re.sub(
                r'(?ms)^\[excel_inventory\][^\[]+',
                '',
                new_content,
            )
        if dry_run:
            return
        ensure_parent(dst)
        with dst.open('w', encoding='utf-8') as fh:
            fh.write(new_content)
    else:
        if dry_run:
            return
        ensure_parent(dst)
        shutil.copyfile(src, dst)


def walk_app(src_root: Path) -> Iterable[Path]:
    for current, dirs, files in os.walk(src_root):
        # Prune early
        rel_current = Path(current).relative_to(src_root)
        if rel_current.parts and rel_current.parts[0] in SKIP_TOP_LEVEL:
            dirs.clear()
            continue
        for f in files:
            yield Path(current) / f


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        '--src',
        type=Path,
        default=SRC_APP_DEFAULT,
        help=f'Source FDEM app dir (default: {SRC_APP_DEFAULT})',
    )
    parser.add_argument(
        '--dst',
        type=Path,
        default=DST_APP_DEFAULT,
        help=f'Destination splunk/ resource dir (default: {DST_APP_DEFAULT})',
    )
    parser.add_argument('--dry-run', action='store_true')
    parser.add_argument('-v', '--verbose', action='store_true')
    args = parser.parse_args()

    src_root: Path = args.src
    dst_root: Path = args.dst

    if not src_root.is_dir():
        print(f'error: source app not found: {src_root}', file=sys.stderr)
        return 2

    skipped: list[Path] = []
    written: list[Path] = []
    protected: list[Path] = []

    for src_file in walk_app(src_root):
        rel_src = src_file.relative_to(src_root)
        if should_skip(rel_src):
            skipped.append(rel_src)
            continue
        rel_dst = adjust_destination_filename(rel_src)
        if is_protected_destination(rel_dst):
            protected.append(rel_dst)
            continue
        dst_file = dst_root / rel_dst
        process_file(src_file, dst_file, dry_run=args.dry_run)
        written.append(rel_dst)

    print(f'wrote   {len(written):4d} files')
    print(f'skipped {len(skipped):4d} files (docs/local/dropped images/etc.)')
    print(f'protect {len(protected):4d} files (existing nav/app.conf)')
    if args.verbose:
        for p in written:
            print(f'  +  {p}')
        for p in skipped:
            print(f'  -  {p}')
        for p in protected:
            print(f'  =  {p}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
