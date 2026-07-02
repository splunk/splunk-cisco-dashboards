#!/usr/bin/env python3
"""Wave 9: SD-WAN site / tunnel / audit searches → Cisco_Catalyst_App tstats."""

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

DM_SUMMARIES_MACRO = "summariesonly"

SITE = "Cisco_Catalyst_Dataset.Cisco_Catalyst_SDWAN_Site_Health_Events"
TUNNEL = "Cisco_Catalyst_Dataset.Cisco_Catalyst_SDWAN_Tunnel_Health"
AUDIT = "Cisco_Catalyst_Dataset.Cisco_Catalyst_SDWAN_Audit_Events"

SITE_DM = {
    "site_id": "sdwan_site_health_site_id",
    "site_health": "sdwan_site_health_site_health",
    "site_name": "sdwan_site_health_site_name",
}

TUNNEL_DM = {
    "name": "sdwan_tunnel_health_name",
    "state": "sdwan_tunnel_health_state",
    "health": "sdwan_tunnel_health_health",
}

AUDIT_DM = {
    "loguser": "audti_log_user",
    "logusersrcip": "audit_log_user_src_ip",
}

OPENERS: list[tuple[re.Pattern[str], str, dict[str, str]]] = [
    (
        re.compile(r'`index_sdwan`\s+sourcetype\s*=\s*"cisco:sdwan:sitehealth"', re.I),
        SITE,
        SITE_DM,
    ),
    (
        re.compile(r'`index_sdwan`\s+sourcetype\s*=\s*"cisco:sdwan:tunnelhealth"', re.I),
        TUNNEL,
        TUNNEL_DM,
    ),
    (
        re.compile(r'`index_sdwan`\s+sourcetype\s*=\s*"cisco:sdwan:audit:logs"', re.I),
        AUDIT,
        AUDIT_DM,
    ),
]

NON_DM_MARKERS = (
    "latitude",
    "longitude",
    "site_role",
    "device_type",
    "local_color",
    "remote_color",
    "if-oper-status",
    "if-admin-status",
    "vdevice-host-name",
    "ifname",
    "loss_percentage",
    "latency",
    "jitter",
    "vqoe_score",
    "index_catalyst",
    "`index_catalyst`",
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


def match_opener(stage: str):
    for pat, nodename, raw_to_dm in OPENERS:
        if pat.search(stage):
            return nodename, raw_to_dm
    return None


def dm_from(nodename: str) -> str:
    return f"FROM datamodel=Cisco_Catalyst_App WHERE nodename={nodename}"


def convert_stages(stages: list[str]) -> list[str] | None:
    if not stages:
        return None
    matched = match_opener(stages[0])
    if not matched:
        return None
    nodename, raw_to_dm = matched
    rest = stages[1:]

    if nodename == SITE and rest:
        if re.search(r"stats\s+latest\(site_health\).*by\s+site_id", rest[0], re.I):
            tstats = (
                f"| tstats `{DM_SUMMARIES_MACRO}` "
                f"latest({nodename}.{raw_to_dm['site_health']}) as site_health "
                f"{dm_from(nodename)} BY {nodename}.{raw_to_dm['site_id']}"
            )
            return [tstats, *rest[1:]]

    if nodename == TUNNEL and rest:
        blob = " ".join(rest)
        if re.search(r"stats\s+dc\(name\)\s+as\s+tunnels", blob, re.I):
            alias_m = re.search(r"dc\(name\)\s+as\s+(\w+)", blob, re.I)
            alias = alias_m.group(1) if alias_m else "tunnels"
            return [
                f"| tstats `{DM_SUMMARIES_MACRO}` "
                f"dc({nodename}.{raw_to_dm['name']}) as {alias} {dm_from(nodename)}"
            ]
        if re.search(r"stats\s+latest\(state\)\s+as\s+state\s+by\s+name", rest[0], re.I):
            tstats = (
                f"| tstats `{DM_SUMMARIES_MACRO}` "
                f"latest({nodename}.{raw_to_dm['state']}) as state "
                f"{dm_from(nodename)} BY {nodename}.{raw_to_dm['name']}"
            )
            return [tstats, *rest[1:]]

    if nodename == AUDIT and rest:
        stats_idx = next(
            (
                i
                for i, s in enumerate(rest)
                if re.search(r"stats\s+count\s+as\s+events.*by\s+loguser", s, re.I)
            ),
            None,
        )
        if stats_idx is not None:
            tstats = (
                f"| tstats `{DM_SUMMARIES_MACRO}` count as events, "
                f"dc({nodename}.{raw_to_dm['logusersrcip']}) as distinct_source_ips "
                f"{dm_from(nodename)} BY {nodename}.{raw_to_dm['loguser']}"
            )
            rename = f"| rename {nodename}.{raw_to_dm['loguser']} as User"
            head = [s for s in rest[:stats_idx] if not re.search(r"eval\s+user_src_ip", s, re.I)]
            tail = rest[stats_idx + 1 :]
            tail = [s for s in tail if not re.search(r"rename\s+loguser", s, re.I)]
            return head + [tstats, rename, *tail]

    return None


def should_skip(_: str, search: str) -> str | None:
    if "datamodel=Cisco_Catalyst_App" in search and "SDWAN" in search:
        return "already_dm"
    stages = unfold_search(search)
    if not stages or not match_opener(stages[0]):
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
            if reason not in ("already_dm",):
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
        fields["dispatch_context"] = "cisco-catalyst-app"
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
    print(f"wave9 converted={c} skipped={s}")
    for line in lines:
        if "sdwan" in line.lower() or "monitoring_sdwan" in line.lower():
            print(f"  {line}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
