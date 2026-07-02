#!/usr/bin/env python3
"""Run remaining Catalyst DM conversion waves (7, 9, 10, PSIRT) in sequence."""

from __future__ import annotations

import argparse
import importlib.util
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
DEFAULT_SOURCE = REPO / (
    "packages/splunk-cisco-dashboards/src/main/resources/splunk/default/searchbase.conf"
)

SCRIPTS = (
    "convert_wave7_audit_dm.py",
    "convert_psirt_advisory_dm.py",
    "convert_wave9_sdwan_dm.py",
    "convert_wave10_sensor_dm.py",
)


def load_main(script: str):
    path = REPO / "scripts" / script
    spec = importlib.util.spec_from_file_location(script[:-3], path)
    mod = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(mod)
    return mod


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--source", type=Path, default=DEFAULT_SOURCE)
    p.add_argument("--dry-run", action="store_true")
    args = p.parse_args()
    totals = {"converted": 0, "skipped": 0}
    for script in SCRIPTS:
        mod = load_main(script)
        c, s, _ = mod.convert_file(args.source, args.dry_run)
        print(f"{script}: converted={c} skipped={s}")
        totals["converted"] += c
        totals["skipped"] += s
    print(f"TOTAL converted={totals['converted']} skipped={totals['skipped']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
