#!/usr/bin/env python3
"""Inventory every Searchbase root and embedded raw branch without running SPL.

Classification is triage, not proof of model eligibility: macros can expand to
generating commands and raw filters can use fields missing from accelerated models.
"""
import argparse
from collections import Counter
import json
from pathlib import Path
import re

from validate_operational_search_surfaces import load_conf


def inventory(path):
    result = []
    for stanza, record in load_conf(path).items():
        query = record.get("search", "").strip()
        if not query:
            continue
        if re.match(r"\|\s*tstats\b", query):
            kind = "model_tstats" if re.search(r"\bFROM\s+datamodel\s*=", query, re.I) else "indexed_tstats"
        elif re.match(r"\|\s*mstats\b", query):
            kind = "mstats"
        elif query.startswith("|"):
            kind = "other_generating"
        else:
            kind = "event_or_macro_root"
        embedded = bool(re.search(r"\[\s*(?:\|\s*)?search\s+(?:`index_|index\s*=)", query, re.I))
        result.append({"stanza": stanza, "root": kind, "embedded_event_search": embedded,
                       "firewall_or_cloud_security": "`index_firewall`" in query or "cisco:cloud_security:" in query,
                       "needs_raw_text": bool(re.search(r"\b_raw\b", query)),
                       "eventstats": "| eventstats " in query})
    return result


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--details", action="store_true")
    args = parser.parse_args()
    path = Path(__file__).resolve().parents[1] / "packages/splunk-cisco-dashboards/src/main/resources/splunk/default/searchbase.conf"
    rows = inventory(path)
    report = {"searches": len(rows), "roots": dict(Counter(row["root"] for row in rows)),
              "embedded_event_searches": sum(row["embedded_event_search"] for row in rows),
              "firewall_or_cloud_event_roots": sum(row["firewall_or_cloud_security"] and row["root"] == "event_or_macro_root" for row in rows)}
    if args.details:
        report["entries"] = rows
    print(json.dumps(report, indent=2))
