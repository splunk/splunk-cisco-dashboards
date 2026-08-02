#!/usr/bin/env python3
"""Create the portable Searchbase sourcetype-to-app ownership catalog.

The source of truth is App Navigator's ``products.conf``.  Searchbase keeps a
small generated copy so its validation and formatting commands do not depend
on a sibling checkout being present in CI or on a customer deployment host.
"""

from __future__ import annotations

import argparse
import json
from collections import defaultdict
from pathlib import Path


DEFAULT_PRODUCTS_CONF = Path(
    "/Users/akhamis/repo/splunk-cisco-app-navigator/packages/"
    "splunk-cisco-app-navigator/src/main/resources/splunk/default/products.conf"
)
DEFAULT_OUTPUT = Path(__file__).with_name("searchbase_sourcetype_catalog.json")


def parse_products_conf(source: Path) -> dict[str, list[str]]:
    """Return each product sourcetype pattern and the add-on that owns it."""
    products: list[dict[str, str]] = []
    current: dict[str, str] | None = None
    for raw_line in source.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if line.startswith("[") and line.endswith("]"):
            if current:
                products.append(current)
            current = {"product": line[1:-1]}
        elif current and "=" in line and not line.startswith("#"):
            key, value = (part.strip() for part in line.split("=", 1))
            current[key] = value
    if current:
        products.append(current)

    owners: defaultdict[str, set[str]] = defaultdict(set)
    for product in products:
        addon = product.get("addon")
        if not addon:
            continue
        for pattern in product.get("sourcetypes", "").split(","):
            pattern = pattern.strip()
            if pattern:
                owners[pattern].add(addon)
    return {pattern: sorted(apps) for pattern, apps in sorted(owners.items())}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--products-conf", type=Path, default=DEFAULT_PRODUCTS_CONF)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()
    if not args.products_conf.is_file():
        parser.error(f"products.conf not found: {args.products_conf}")

    payload = {
        "source": "splunk-cisco-app-navigator/products.conf",
        "owners": parse_products_conf(args.products_conf),
    }
    args.output.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(f"wrote {len(payload['owners'])} sourcetype patterns to {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
