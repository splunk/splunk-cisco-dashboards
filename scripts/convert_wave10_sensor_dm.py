#!/usr/bin/env python3
"""Wave 10: Meraki sensor readings → Cisco_Catalyst_Sensor_Events."""

from __future__ import annotations

import argparse
import importlib.util
import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
DEFAULT_SOURCE = REPO / (
    "packages/splunk-cisco-dashboards/src/main/resources/splunk/default/searchbase.conf"
)
FORMAT_SCRIPT = REPO / "scripts/format_searchbase_conf.py"

SE = "Cisco_Catalyst_Dataset.Cisco_Catalyst_Sensor_Events"
DM_FROM = f"FROM datamodel=Cisco_Catalyst_App WHERE nodename={SE}"
DM_SUMMARIES_MACRO = "summariesonly"

OPENER_RE = re.compile(
    r'`index_meraki`\s+sourcetype\s*=\s*"meraki:sensorreadingshistory"',
    re.I,
)

NON_DM_MARKERS = (
    "index_spaces",
    "co2",
    "iotTelemetry",
    'metric="co2"',
    " OR (`index",
)


def load_formatter():
    spec = importlib.util.spec_from_file_location("format_searchbase_conf", FORMAT_SCRIPT)
    mod = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(mod)
    return mod


def unfold_search(search: str) -> list[str]:
    stages, buf = [], ""
    for line in search.split("\n"):
        line = line.strip()
        if not line:
            continue
        cont = line.endswith("\\")
        if cont:
            line = line[:-1].strip()
        if buf and line.startswith("|"):
            stages.append(buf.strip())
            buf = line
        else:
            buf = (buf + " " + line).strip() if buf else line
        if not cont:
            stages.append(buf.strip())
            buf = ""
    if buf.strip():
        stages.append(buf.strip())
    return stages


def fold_search(stages: list[str]) -> str:
    out = []
    for i, stage in enumerate(stages):
        stage = stage.strip()
        if not stage.startswith("|"):
            stage = "| " + stage
        out.append(stage + ("\\" if i < len(stages) - 1 else ""))
    return "\n".join(out)


def bump_version(ver: str) -> str:
    parts = ver.split(".")
    if len(parts) == 3 and parts[2].isdigit():
        parts[2] = str(int(parts[2]) + 1)
        return ".".join(parts)
    return "1.1.0"


def convert_stages(stages: list[str]) -> list[str] | None:
    if not stages or not OPENER_RE.search(stages[0]):
        return None
    rest = stages[1:]
    if not rest:
        return None
    if re.search(
        r"stats\s+latest\(temperature\.fahrenheit\).*latest\(humidity\.relativePercentage\).*by\s+serial",
        rest[0],
        re.I,
    ):
        tstats = (
            f"| tstats `{DM_SUMMARIES_MACRO}` "
            f"latest({SE}.sensor_temperature_fahrenheit) as \"Temp(°F)\", "
            f"latest({SE}.sensor_humidity_relative_percentage) as \"Humidity(%)\" "
            f"{DM_FROM} BY {SE}.sensor_serial"
        )
        rename = f"| rename {SE}.sensor_serial as Sensor"
        tail = [s for s in rest[1:] if not re.search(r"rename\s+serial", s, re.I)]
        return [tstats, rename, *tail]
    return None


def should_skip(_: str, search: str) -> str | None:
    if "datamodel=Cisco_Catalyst_App" in search and "Sensor_Events" in search:
        return "already_dm"
    if not OPENER_RE.search(search):
        return "no_opener"
    if any(m in search for m in NON_DM_MARKERS):
        return "non_dm_fields"
    return None


def convert_file(path: Path, dry_run: bool = False) -> tuple[int, int, list[str]]:
    fmt = load_formatter()
    stanzas = fmt.parse_stanzas(path.read_text())
    converted, skipped, new_stanzas = 0, [], []
    for name, fields in stanzas:
        search = fields.get("search", "")
        reason = should_skip(name, search)
        if reason:
            if reason != "already_dm":
                skipped.append(f"{name}: {reason}")
            new_stanzas.append((name, fields))
            continue
        pipeline = convert_stages(unfold_search(search))
        if not pipeline:
            skipped.append(f"{name}: convert_failed")
            new_stanzas.append((name, fields))
            continue
        fields = dict(fields)
        fields["search"] = fold_search(pipeline)
        fields["dispatch_context"] = "splunk-cisco-dashboards"
        fields["dispatch_context_force"] = "1"
        fields["date_updated"] = "2026-07-01"
        fields["version"] = bump_version(fields.get("version", "1.0.0"))
        converted += 1
        new_stanzas.append((name, fields))
    if dry_run:
        return converted, len(skipped), skipped
    parts = [fmt.format_stanza(n, f)[0] for n, f in new_stanzas]
    path.write_text("\n\n".join(parts).rstrip() + "\n")
    return converted, len(skipped), skipped


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--source", type=Path, default=DEFAULT_SOURCE)
    p.add_argument("--dry-run", action="store_true")
    args = p.parse_args()
    c, s, lines = convert_file(args.source, args.dry_run)
    print(f"wave10 converted={c} skipped={s}")
    for line in lines:
        if "building_resilience" in line.lower() or "sensor" in line.lower():
            print(f"  {line}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
