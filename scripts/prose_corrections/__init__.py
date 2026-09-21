"""Prose corrections, split one module per defect class.

Each module exports CORRECTIONS: a list of
    (stanza_id, key, from_text, to_text, why)
tuples. Keeping them in separate modules means several people (or agents) can
work different defect classes without editing the same file.

Order is stable so a run is reproducible.
"""

from __future__ import annotations

import importlib
import pkgutil

Correction = tuple[str, str, str, str, str]


def load_all() -> list[Correction]:
    out: list[Correction] = []
    for mod in sorted(m.name for m in pkgutil.iter_modules(__path__)):
        module = importlib.import_module(f"{__name__}.{mod}")
        out.extend(getattr(module, "CORRECTIONS", []))
    return out
