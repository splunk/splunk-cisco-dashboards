#!/usr/bin/env python3
"""Generate six-card Secure Networking Dashboard Studio story views.

The generator deliberately keeps dashboard selection outside this module.  Supply a
JSON object or a Python module containing ``DASHBOARD_STORIES`` with this shape::

    {
        "sn_example": {
            "label": "Example posture",
            "description": "Six signals that explain example posture.",
            "header_icon": "/static/app/.../example.svg",
            "cards": [
                {
                    "primary": "example_time_series",
                    "targets": ["example_detail", "example_other_detail"],
                    "vizType": "area",  # area, bar, column, or pie
                    "valueField": "WindowRisk",
                    "graphFields": ["BucketRisk"],
                    "title": "Optional display-title override",
                    "description": "Optional short-description override",
                },
                # Exactly five more cards.
            ],
        }
    }

Card category and sub-category labels always come from the primary Searchbase
stanza.  Card titles and descriptions default to Searchbase metadata.  Detail
targets are resolved to Searchbase ``search_name`` values for the Dashboard
Manager drilldown route.
"""

from __future__ import annotations

import argparse
import base64
import html
import importlib.util
import json
import re
import sys
from collections.abc import Iterable, Mapping, Sequence
from dataclasses import dataclass
from html.parser import HTMLParser
from pathlib import Path
from types import ModuleType
from typing import Any
from urllib.parse import quote
from xml.sax.saxutils import escape as escape_xml


REPO_ROOT = Path(__file__).resolve().parents[1]
APP_DEFAULT = (
    REPO_ROOT
    / "packages"
    / "splunk-cisco-dashboards"
    / "src"
    / "main"
    / "resources"
    / "splunk"
    / "default"
)
DEFAULT_SEARCHBASE = APP_DEFAULT / "searchbase.conf"
DEFAULT_VIEWS_DIR = APP_DEFAULT / "data" / "ui" / "views"
C3_BACKGROUND_PATH = (
    REPO_ROOT
    / "packages"
    / "splunk-cisco-dashboards"
    / "src"
    / "main"
    / "resources"
    / "splunk"
    / "appserver"
    / "static"
    / "c3-atmosphere.svg"
)

CARD_COUNT = 6
CANVAS_WIDTH = 1440
CANVAS_HEIGHT = 1128
CARD_WIDTH = 453
CARD_HEIGHT = 476
CARD_X = (20, 493, 966)
CARD_Y = (128, 624)
MAX_DESCRIPTION_LENGTH = 240
MAX_DRILLDOWN_TARGETS = 24
SUPPORTED_GRAPH_TYPES = {
    "area": "splunk.area",
    "bar": "splunk.bar",
    "column": "splunk.column",
    "pie": "splunk.pie",
    "splunk.area": "splunk.area",
    "splunk.bar": "splunk.bar",
    "splunk.column": "splunk.column",
    "splunk.pie": "splunk.pie",
}


def c3_background_data_uri(path: Path = C3_BACKGROUND_PATH) -> str:
    """Return the repository-owned C3 atmosphere as an embedded Studio asset."""

    normalized_svg = path.read_text(encoding="utf-8").strip().encode("utf-8")
    encoded = base64.b64encode(normalized_svg).decode("ascii")
    return f"data:image/svg+xml;base64,{encoded}"


class StoryConfigurationError(ValueError):
    """Raised when story configuration cannot produce a safe dashboard."""


@dataclass(frozen=True)
class SearchbaseEntry:
    """Metadata parsed from one Searchbase stanza."""

    stanza: str
    values: Mapping[str, str]

    def get(self, key: str, default: str = "") -> str:
        return self.values.get(key, default).strip()

    @property
    def search_name(self) -> str:
        return self.get("search_name") or self.stanza

    @property
    def search(self) -> str:
        return self.get("search")


@dataclass(frozen=True)
class CardFieldBindings:
    """Explicit field selections for one headline value and supporting graph."""

    value_field: str
    x_field: str
    graph_fields: tuple[str, ...]


class _PlainTextParser(HTMLParser):
    """Extract visible prose while dropping executable/style element content."""

    _BLOCK_TAGS = {
        "address",
        "blockquote",
        "br",
        "div",
        "h1",
        "h2",
        "h3",
        "h4",
        "h5",
        "h6",
        "hr",
        "li",
        "ol",
        "p",
        "pre",
        "table",
        "td",
        "th",
        "tr",
        "ul",
    }

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []
        self._ignored_depth = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        del attrs
        tag = tag.lower()
        if tag in {"script", "style"}:
            self._ignored_depth += 1
        elif not self._ignored_depth and tag in self._BLOCK_TAGS:
            self.parts.append(" ")

    def handle_endtag(self, tag: str) -> None:
        tag = tag.lower()
        if tag in {"script", "style"} and self._ignored_depth:
            self._ignored_depth -= 1
        elif not self._ignored_depth and tag in self._BLOCK_TAGS:
            self.parts.append(" ")

    def handle_data(self, data: str) -> None:
        if not self._ignored_depth:
            self.parts.append(data)


def strip_html(value: Any) -> str:
    """Return normalized visible text from Searchbase HTML metadata."""

    parser = _PlainTextParser()
    parser.feed(str(value or ""))
    parser.close()
    return " ".join(html.unescape("".join(parser.parts)).split())


def concise(value: Any, max_length: int = MAX_DESCRIPTION_LENGTH) -> str:
    """Strip HTML and deterministically shorten prose at a useful boundary."""

    text = strip_html(value)
    if len(text) <= max_length:
        return text

    candidate = text[: max_length + 1]
    sentence_end = max(candidate.rfind(". "), candidate.rfind("; "))
    if sentence_end >= max_length // 2:
        return candidate[: sentence_end + 1].strip()

    word_end = candidate.rfind(" ")
    if word_end <= 0:
        word_end = max_length
    return f"{candidate[:word_end].rstrip()}…"


_MARKDOWN_SPECIAL = re.compile(r"([\\`*_{}\[\]()#+\-.!|>])")


def escape_markdown(value: Any) -> str:
    """Escape plain metadata before placing it in Dashboard Studio markdown."""

    return _MARKDOWN_SPECIAL.sub(r"\\\1", strip_html(value))


def _finish_property(
    stanzas: dict[str, dict[str, str]],
    stanza: str | None,
    key: str | None,
    parts: list[str],
) -> None:
    if stanza is not None and key is not None:
        stanzas[stanza][key] = "\n".join(parts).strip()


def parse_searchbase(text: str) -> dict[str, SearchbaseEntry]:
    """Parse Searchbase ``.conf`` text without third-party dependencies.

    Splunk property continuations use a trailing backslash.  Continuation lines
    are joined with newlines so SPL pipelines remain inspectable and validation
    can recognize ``timechart`` and ``_time`` semantics.
    """

    stanzas: dict[str, dict[str, str]] = {}
    stanza: str | None = None
    pending_key: str | None = None
    pending_parts: list[str] = []
    continuing = False

    for raw_line in text.splitlines():
        stripped = raw_line.strip()

        if continuing:
            part = raw_line.rstrip()
            continuing = part.endswith("\\")
            pending_parts.append(part[:-1] if continuing else part)
            if not continuing:
                _finish_property(stanzas, stanza, pending_key, pending_parts)
                pending_key = None
                pending_parts = []
            continue

        stanza_match = re.fullmatch(r"\[([^\]]+)]", stripped)
        if stanza_match:
            stanza = stanza_match.group(1).strip()
            if not stanza:
                raise StoryConfigurationError("Searchbase contains an empty stanza name")
            stanzas.setdefault(stanza, {})
            continue

        if not stripped or stripped.startswith("#"):
            continue
        if stanza is None or "=" not in raw_line:
            continue

        key, raw_value = raw_line.split("=", 1)
        key = key.strip()
        value = raw_value.strip()
        if not key:
            continue
        continuing = value.endswith("\\")
        if continuing:
            pending_key = key
            pending_parts = [value[:-1]]
        else:
            stanzas[stanza][key] = value

    if continuing:
        _finish_property(stanzas, stanza, pending_key, pending_parts)

    return {
        name: SearchbaseEntry(stanza=name, values=dict(values))
        for name, values in stanzas.items()
    }


def parse_searchbase_file(path: Path | str = DEFAULT_SEARCHBASE) -> dict[str, SearchbaseEntry]:
    return parse_searchbase(Path(path).read_text(encoding="utf-8"))


def has_time_series_semantics(search: str) -> bool:
    """Recognize timechart or an explicit ``_time`` field/bucket."""

    return bool(
        re.search(r"(?i)(?:^|\|)\s*timechart\b", search)
        or re.search(r"(?<![A-Za-z0-9])_time(?![A-Za-z0-9])", search)
    )


def searchbase_overview(entry: SearchbaseEntry) -> Mapping[str, Any]:
    """Return the first well-formed Searchbase overview metadata object."""

    raw_options = entry.get("viz_options")
    if not raw_options:
        return {}
    try:
        options = json.loads(raw_options)
    except (TypeError, json.JSONDecodeError):
        return {}
    if not isinstance(options, Mapping):
        return {}
    overview = options.get("overview")
    if isinstance(overview, (str, bytes)) or not isinstance(overview, Sequence) or not overview:
        return {}
    first = overview[0]
    return first if isinstance(first, Mapping) else {}


def _optional_field(value: Any, location: str) -> str:
    if value is None:
        return ""
    return _as_nonempty_string(value, location)


def _field_sequence(value: Any, location: str) -> list[str]:
    if value is None:
        return []
    if isinstance(value, str):
        return [_as_nonempty_string(value, location)]
    return _as_string_sequence(value, location)


def _search_has_dynamic_series(search: str) -> bool:
    return bool(re.search(r"(?is)\|\s*(?:timechart|chart)\b[^|]*\bby\b", search))


def _validate_bound_field(
    field: str,
    entry: SearchbaseEntry,
    location: str,
    *,
    allow_dynamic_series: bool = False,
) -> None:
    if field == "_time":
        if not has_time_series_semantics(entry.search):
            raise StoryConfigurationError(
                f"{location} binds _time but {entry.stanza!r} has no time-series semantics"
            )
        return
    if field.casefold() in entry.search.casefold():
        return
    if allow_dynamic_series and _search_has_dynamic_series(entry.search):
        return
    raise StoryConfigurationError(
        f"{location} field {field!r} is not present in Searchbase search {entry.stanza!r}"
    )


def resolve_card_field_bindings(
    card: Mapping[str, Any],
    entry: SearchbaseEntry,
    graph_type: str,
    location: str,
) -> CardFieldBindings:
    """Resolve and validate explicit named-series bindings for one card."""

    overview = searchbase_overview(entry)
    value_field = _optional_field(
        card.get("valueField", overview.get("valueField")),
        f"{location}.valueField",
    )
    if not value_field:
        raise StoryConfigurationError(
            f"{location}.valueField is required because Searchbase overview metadata has none"
        )

    graph_fields: list[str] = []
    for key, source in (
        ("graphFields", card),
        ("yFields", card),
        ("graphFields", overview),
        ("sparkDataField", overview),
        ("yFields", overview),
    ):
        graph_fields = _field_sequence(source.get(key), f"{location}.{key}")
        if graph_fields:
            break
    if not graph_fields:
        graph_fields = [value_field]
    graph_fields = list(dict.fromkeys(graph_fields))

    configured_x = (
        card.get("xField")
        or card.get("categoryField")
        or overview.get("xField")
        or overview.get("categoryField")
    )
    time_series = has_time_series_semantics(entry.search)
    if configured_x is not None:
        x_field = _as_nonempty_string(configured_x, f"{location}.xField")
    elif graph_type == "splunk.area" or time_series:
        x_field = "_time"
    else:
        raise StoryConfigurationError(
            f"{location}.xField or categoryField is required for a categorical graph"
        )

    if graph_type == "splunk.pie" and len(graph_fields) != 1:
        raise StoryConfigurationError(f"{location}.graphFields must select one pie value field")

    _validate_bound_field(value_field, entry, f"{location}.valueField", allow_dynamic_series=True)
    _validate_bound_field(x_field, entry, f"{location}.xField")
    for index, field in enumerate(graph_fields):
        _validate_bound_field(
            field,
            entry,
            f"{location}.graphFields[{index}]",
            allow_dynamic_series=True,
        )
    return CardFieldBindings(value_field, x_field, tuple(graph_fields))


def resolve_card_graph_type(
    card: Mapping[str, Any], entry: SearchbaseEntry, location: str
) -> str:
    """Resolve a safe main-canvas graph from config or Searchbase metadata.

    ``vizType`` is authoritative when supplied.  Otherwise a supported
    Searchbase ``default_viz`` is preserved.  Time-series searches with another
    default (for example ``splunk.singlevalue``) use the story's area treatment.
    Non-time-series searches must explicitly select, or derive, a categorical
    graph type so a detail table is never promoted onto the main canvas.
    """

    configured = card.get("vizType")
    default_viz = entry.get("default_viz").lower()
    candidate = str(configured).strip().lower() if configured is not None else default_viz

    if candidate in {"table", "splunk.table"}:
        raise StoryConfigurationError(f"{location}.vizType cannot use a table")
    if candidate in SUPPORTED_GRAPH_TYPES:
        graph_type = SUPPORTED_GRAPH_TYPES[candidate]
    elif configured is not None:
        supported = ", ".join(sorted({key for key in SUPPORTED_GRAPH_TYPES if "." not in key}))
        raise StoryConfigurationError(
            f"{location}.vizType {configured!r} is unsupported; use {supported}"
        )
    elif has_time_series_semantics(entry.search):
        graph_type = "splunk.area"
    else:
        raise StoryConfigurationError(
            f"{location}.vizType must select bar, column, or pie for a categorical search"
        )

    if graph_type == "splunk.area" and not has_time_series_semantics(entry.search):
        raise StoryConfigurationError(
            f"{location}.primary {entry.stanza!r} must use timechart or emit _time for area mode"
        )
    return graph_type


def _as_nonempty_string(value: Any, location: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise StoryConfigurationError(f"{location} must be a non-empty string")
    return value.strip()


def _as_string_sequence(value: Any, location: str) -> list[str]:
    if isinstance(value, (str, bytes)) or not isinstance(value, Sequence):
        raise StoryConfigurationError(f"{location} must be a list of Searchbase references")
    return [_as_nonempty_string(item, f"{location}[{index}]") for index, item in enumerate(value)]


def validate_story_config(
    dashboard_id: str,
    config: Mapping[str, Any],
    searchbase: Mapping[str, SearchbaseEntry],
) -> None:
    """Validate one dashboard before rendering or writing any output."""

    if not re.fullmatch(r"sn_[a-z0-9_]+", dashboard_id):
        raise StoryConfigurationError(
            f"dashboard id {dashboard_id!r} must begin with sn_"
        )
    if not isinstance(config, Mapping):
        raise StoryConfigurationError(f"{dashboard_id} configuration must be an object")

    for field in ("label", "description", "header_icon"):
        _as_nonempty_string(config.get(field), f"{dashboard_id}.{field}")

    cards = config.get("cards")
    if isinstance(cards, (str, bytes)) or not isinstance(cards, Sequence):
        raise StoryConfigurationError(f"{dashboard_id}.cards must be a list")
    if len(cards) != CARD_COUNT:
        raise StoryConfigurationError(
            f"{dashboard_id} must define exactly {CARD_COUNT} cards; found {len(cards)}"
        )

    primary_refs: list[str] = []
    for index, card in enumerate(cards, start=1):
        location = f"{dashboard_id}.cards[{index - 1}]"
        if not isinstance(card, Mapping):
            raise StoryConfigurationError(f"{location} must be an object")

        primary = _as_nonempty_string(card.get("primary"), f"{location}.primary")
        targets = _as_string_sequence(card.get("targets"), f"{location}.targets")
        if not targets:
            raise StoryConfigurationError(f"{location}.targets must contain at least one detail")
        if len(targets) > MAX_DRILLDOWN_TARGETS:
            raise StoryConfigurationError(
                f"{location}.targets exceeds the {MAX_DRILLDOWN_TARGETS}-target safety limit"
            )

        missing = [ref for ref in [primary, *targets] if ref not in searchbase]
        if missing:
            raise StoryConfigurationError(
                f"{location} references missing Searchbase stanzas: {', '.join(missing)}"
            )

        entry = searchbase[primary]
        if not entry.search:
            raise StoryConfigurationError(f"{location}.primary {primary!r} has no search")
        graph_type = resolve_card_graph_type(card, entry, location)
        resolve_card_field_bindings(card, entry, graph_type, location)
        for metadata_key in ("search_name", "description", "category", "sub_category"):
            if not entry.get(metadata_key):
                raise StoryConfigurationError(
                    f"{location}.primary {primary!r} is missing {metadata_key} metadata"
                )
        for target in targets:
            if not searchbase[target].get("search_name"):
                raise StoryConfigurationError(
                    f"{location}.target {target!r} is missing search_name metadata"
                )

        if "title" in card:
            _as_nonempty_string(card["title"], f"{location}.title")
        if "description" in card:
            _as_nonempty_string(card["description"], f"{location}.description")
        primary_refs.append(primary)

    if len(set(primary_refs)) != CARD_COUNT:
        raise StoryConfigurationError(
            f"{dashboard_id} must use {CARD_COUNT} distinct primary Searchbase stanzas"
        )


def _block(item: str, x: int, y: int, width: int, height: int) -> dict[str, Any]:
    return {
        "item": item,
        "position": {"x": x, "y": y, "w": width, "h": height},
        "type": "block",
    }


def _drilldown_url(origin: str, target_names: Iterable[str]) -> str:
    encoded_targets = ",".join(quote(name, safe="") for name in target_names)
    return f"/drilldown?origin={quote(origin, safe='')}&target={encoded_targets}"


def searchbase_overview_label(entry: SearchbaseEntry) -> str:
    """Return the concise Searchbase overview label when metadata supplies one."""

    label = searchbase_overview(entry).get("label")
    return strip_html(label) if isinstance(label, str) else ""


def _series_dsl(field: str) -> str:
    return f"> primary | seriesByName({json.dumps(field, ensure_ascii=False)})"


def _frame_dsl(fields: Sequence[str]) -> str:
    arguments = ", ".join(json.dumps(field, ensure_ascii=False) for field in fields)
    return f"> primary | frameBySeriesNames({arguments})"


def _graph_options(
    graph_type: str, bindings: CardFieldBindings
) -> dict[str, Any]:
    options: dict[str, Any] = {
        "backgroundColor": "transparent",
        "legendDisplay": "off" if graph_type == "splunk.area" else "right",
        "seriesColors": ["#649ef5", "#4cbf7f", "#f0c243", "#fa5762"],
    }
    if graph_type == "splunk.area":
        options.update(
            {
                "dataValuesDisplay": "minmax",
                "lineWidth": 3,
                "markerDisplay": "outlined",
                "nullValueDisplay": "connect",
                "showYMajorGridLines": True,
                "xAxisTitleVisibility": "hide",
                "yAxisTitleVisibility": "hide",
            }
        )
    elif graph_type in {"splunk.bar", "splunk.column"}:
        options.update(
            {
                "showYMajorGridLines": True,
                "stackMode": "unstacked",
                "xAxisTitleVisibility": "hide",
                "yAxisTitleVisibility": "hide",
            }
        )
    if graph_type == "splunk.pie":
        options.update(
            {
                "label": _series_dsl(bindings.x_field),
                "value": _series_dsl(bindings.graph_fields[0]),
            }
        )
    else:
        options.update(
            {
                "x": _series_dsl(bindings.x_field),
                "y": (
                    _series_dsl(bindings.graph_fields[0])
                    if len(bindings.graph_fields) == 1
                    else _frame_dsl(bindings.graph_fields)
                ),
            }
        )
    return options


def build_dashboard_definition(
    dashboard_id: str,
    config: Mapping[str, Any],
    searchbase: Mapping[str, SearchbaseEntry],
) -> dict[str, Any]:
    """Build a deterministic Dashboard Studio v2 definition object."""

    validate_story_config(dashboard_id, config, searchbase)

    label = _as_nonempty_string(config["label"], f"{dashboard_id}.label")
    description = _as_nonempty_string(
        config["description"], f"{dashboard_id}.description"
    )
    header_icon = _as_nonempty_string(
        config["header_icon"], f"{dashboard_id}.header_icon"
    )

    visualizations: dict[str, Any] = {
        "viz_header_bg": {
            "type": "splunk.rectangle",
            "options": {
                "fillColor": "#1c2738",
                "strokeColor": "rgba(100,158,245,0.28)",
                "rx": 10,
            },
        },
        "viz_header_icon": {
            "type": "splunk.image",
            "title": label,
            "options": {"preserveAspectRatio": True, "src": header_icon},
        },
        "viz_header": {
            "type": "splunk.markdown",
            "title": "",
            "showLastUpdated": False,
            "showProgressBar": False,
            "options": {
                "backgroundColor": "transparent",
                "fontColor": "#ecf0f5",
                "markdown": f"# {escape_markdown(label)}\n{escape_markdown(description)}",
            },
        },
    }
    data_sources: dict[str, Any] = {}
    structure: list[dict[str, Any]] = [
        _block("viz_header_bg", 20, 0, 1400, 104),
        _block("viz_header_icon", 38, 18, 64, 64),
        _block("viz_header", 118, 8, 886, 88),
    ]

    for card_index, raw_card in enumerate(config["cards"], start=1):
        card = dict(raw_card)
        primary_ref = str(card["primary"]).strip()
        primary_entry = searchbase[primary_ref]
        target_refs = [str(value).strip() for value in card["targets"]]
        target_names = [searchbase[ref].search_name for ref in target_refs]

        card_title = strip_html(
            card.get("title")
            or searchbase_overview_label(primary_entry)
            or primary_entry.search_name
        )
        card_description = concise(
            card.get("description") or primary_entry.get("description")
        )
        graph_type = resolve_card_graph_type(
            card, primary_entry, f"{dashboard_id}.cards[{card_index - 1}]"
        )
        field_bindings = resolve_card_field_bindings(
            card,
            primary_entry,
            graph_type,
            f"{dashboard_id}.cards[{card_index - 1}]",
        )
        category = strip_html(primary_entry.get("category"))
        sub_category = strip_html(primary_entry.get("sub_category"))

        row = (card_index - 1) // 3
        column = (card_index - 1) % 3
        x = CARD_X[column]
        y = CARD_Y[row]
        key = f"card_{card_index:02d}"
        data_source_id = f"ds_story_{card_index:02d}"

        background_id = f"viz_{key}_background"
        title_id = f"viz_{key}_title"
        metadata_id = f"viz_{key}_metadata"
        description_id = f"viz_{key}_description"
        singlevalue_id = f"viz_{key}_singlevalue"
        trend_id = f"viz_{key}_trend"
        trigger_id = f"viz_{key}_drilldown_trigger"

        visualizations[background_id] = {
            "type": "splunk.rectangle",
            "options": {
                "fillColor": "#131a23",
                "strokeColor": "rgba(100,158,245,0.28)",
                "rx": 12,
            },
        }
        visualizations[title_id] = {
            "type": "splunk.markdown",
            "title": "",
            "showLastUpdated": False,
            "showProgressBar": False,
            "options": {
                "backgroundColor": "transparent",
                "fontColor": "#ecf0f5",
                "fontSize": "custom",
                "customFontSize": 20,
                "markdown": f"**{escape_markdown(card_title)}**",
            },
        }
        visualizations[metadata_id] = {
            "type": "splunk.markdown",
            "title": "",
            "showLastUpdated": False,
            "showProgressBar": False,
            "options": {
                "backgroundColor": "transparent",
                "fontColor": "#649ef5",
                "fontSize": "custom",
                "customFontSize": 14,
                "markdown": (
                    f"{escape_markdown(category)}  •  "
                    f"{escape_markdown(sub_category)}"
                ),
            },
        }
        visualizations[description_id] = {
            "type": "splunk.markdown",
            "title": "",
            "showLastUpdated": False,
            "showProgressBar": False,
            "options": {
                "backgroundColor": "transparent",
                "fontColor": "#a6adb6",
                "fontSize": "custom",
                "customFontSize": 15,
                "markdown": escape_markdown(card_description),
            },
        }
        singlevalue_options: dict[str, Any] = {
            "backgroundColor": "transparent",
            "majorColor": "#ecf0f5",
            "majorFontSize": 44,
            "majorValue": "> sparklineValues | lastPoint()",
            "shouldAbbreviateMajorValue": card.get(
                "shouldAbbreviateMajorValue", True
            ),
            "sparklineDisplay": "off",
            "trendDisplay": "percent",
            "shouldAbbreviateTrendValue": True,
            "showTrendIndicator": True,
            "sparklineValues": _series_dsl(field_bindings.value_field),
            "trendColor": "> trendValue | rangeValue(trendColorEditorConfig)",
            "trendFontSize": 28,
            "trendValue": "> sparklineValues | delta(-2)",
        }
        for option_name in ("numberPrecision", "unit", "unitPosition"):
            if option_name in card:
                singlevalue_options[option_name] = card[option_name]

        visualizations[singlevalue_id] = {
            "type": "splunk.singlevalue",
            "title": "",
            "dataSources": {"primary": data_source_id},
            "showLastUpdated": False,
            "showProgressBar": False,
            "options": singlevalue_options,
            "context": {
                "trendColorEditorConfig": [
                    {"value": "#649ef5", "to": 0},
                    {"value": "#649ef5", "from": 0},
                ]
            },
        }
        visualizations[trend_id] = {
            "type": graph_type,
            "title": "",
            "dataSources": {"primary": data_source_id},
            "showLastUpdated": False,
            "showProgressBar": False,
            "options": _graph_options(graph_type, field_bindings),
        }
        visualizations[trigger_id] = {
            "type": "splunk.rectangle",
            "eventHandlers": [
                {
                    "type": "drilldown.customUrl",
                    "options": {"url": _drilldown_url(card_title, target_names)},
                }
            ],
            "options": {"fillColor": "transparent", "strokeColor": "transparent"},
            "context": {},
            "containerOptions": {},
            "showProgressBar": False,
            "showLastUpdated": False,
        }

        data_sources[data_source_id] = {
            "name": primary_entry.search_name,
            "options": {
                "ref": primary_ref,
                "queryParameters": {
                    "earliest": "$time_tok.earliest$",
                    "latest": "$time_tok.latest$",
                },
            },
            "type": "ds.searchbase",
        }

        structure.extend(
            [
                _block(background_id, x, y, CARD_WIDTH, CARD_HEIGHT),
                _block(title_id, x + 16, y + 12, CARD_WIDTH - 76, 34),
                _block(metadata_id, x + 16, y + 48, CARD_WIDTH - 32, 24),
                _block(description_id, x + 16, y + 76, CARD_WIDTH - 32, 68),
                _block(singlevalue_id, x + 16, y + 156, CARD_WIDTH - 32, 88),
                _block(trend_id, x + 16, y + 248, CARD_WIDTH - 32, 212),
                _block(trigger_id, x + CARD_WIDTH - 55, y + 6, 42, 42),
            ]
        )

    definition: dict[str, Any] = {
        "title": label,
        "description": description,
        "inputs": {
            "input_time_range": {
                "options": {
                    "defaultValue": "-24h,now,1h",
                    "showAdvanced": True,
                    "selections": [
                        {"value": "-4h,now,30m", "label": "4h"},
                        {"value": "-24h,now,1h", "label": "24h"},
                        {"value": "-48h,now,2h", "label": "48h"},
                        {"value": "-7d@d,now,1d", "label": "7d"},
                        {"value": "-30d@d,now,1d", "label": "30d"},
                    ],
                    "token": "time_tok",
                },
                "title": "Time range",
                "type": "input.simpleTimePicker",
            }
        },
        "defaults": {
            "visualizations": {
                "global": {"showLastUpdated": True, "showProgressBar": True}
            }
        },
        "visualizations": visualizations,
        "dataSources": data_sources,
        "layout": {
            "globalInputs": [],
            "layoutDefinitions": {
                "layout_overview": {
                    "options": {
                        "backgroundColor": "#0f1117",
                        "backgroundImage": {
                            "sizeType": "contain",
                            "src": c3_background_data_uri(),
                            "x": 0,
                            "y": 0,
                        },
                        "display": "auto-scale",
                        "height": CANVAS_HEIGHT,
                        "width": CANVAS_WIDTH,
                    },
                    "structure": [
                        *structure,
                        {
                            "item": "input_time_range",
                            "position": {"x": 1034, "y": 12, "w": 370, "h": 80},
                            "type": "input",
                        },
                    ],
                    "type": "absolute",
                }
            },
            "options": {
                "showTitleAndDescription": False,
                "submitButton": False,
                "submitOnDashboardLoad": True,
            },
            "tabs": {
                "items": [{"label": "overview", "layoutId": "layout_overview"}]
            },
        },
        "applicationProperties": {
            "collapseNavigation": False,
            "hideEdit": True,
            "hideExport": False,
        },
    }

    # A shared source feeds both metrics on each card, bounding load at six
    # Searchbase dispatches regardless of how many visual layers are rendered.
    assert len(data_sources) == CARD_COUNT
    assert all(source["type"] == "ds.searchbase" for source in data_sources.values())
    assert not any(viz.get("type") == "splunk.table" for viz in visualizations.values())
    return definition


def render_dashboard_xml(
    dashboard_id: str,
    config: Mapping[str, Any],
    searchbase: Mapping[str, SearchbaseEntry],
) -> str:
    """Render a complete Dashboard Studio v2 XML view."""

    definition = build_dashboard_definition(dashboard_id, config, searchbase)
    label = _as_nonempty_string(config["label"], f"{dashboard_id}.label")
    description = _as_nonempty_string(
        config["description"], f"{dashboard_id}.description"
    )
    definition_json = json.dumps(definition, indent=4, ensure_ascii=False)
    # CDATA cannot contain its own closing delimiter.  A JSON unicode escape is
    # semantically identical after parsing and keeps the XML well formed.
    definition_json = definition_json.replace("]]>", "]]\\u003e")
    return (
        '<dashboard version="2" theme="dark" stylesheet="application.css">\n'
        f"    <label>{escape_xml(label)}</label>\n"
        f"    <description>{escape_xml(description)}</description>\n"
        "    <definition><![CDATA[\n"
        f"{definition_json}\n"
        "    ]]></definition>\n"
        "</dashboard>\n"
    )


def load_story_config(path: Path | str) -> dict[str, Any]:
    """Load a dashboard mapping from JSON or a Python ``DASHBOARD_STORIES``."""

    config_path = Path(path)
    if config_path.suffix.lower() == ".json":
        loaded = json.loads(config_path.read_text(encoding="utf-8"))
        if isinstance(loaded, Mapping) and "DASHBOARD_STORIES" in loaded:
            loaded = loaded["DASHBOARD_STORIES"]
    elif config_path.suffix.lower() == ".py":
        spec = importlib.util.spec_from_file_location(
            f"secure_networking_story_config_{abs(hash(config_path.resolve()))}",
            config_path,
        )
        if spec is None or spec.loader is None:
            raise StoryConfigurationError(f"Cannot import config from {config_path}")
        module = importlib.util.module_from_spec(spec)
        assert isinstance(module, ModuleType)
        spec.loader.exec_module(module)
        loaded = getattr(module, "DASHBOARD_STORIES", None)
    else:
        raise StoryConfigurationError("Story config must be a .json or .py file")

    if not isinstance(loaded, Mapping):
        raise StoryConfigurationError(
            f"{config_path} must contain a dashboard mapping named DASHBOARD_STORIES"
        )
    return {str(key): value for key, value in loaded.items()}


def generate_story_dashboards(
    stories: Mapping[str, Mapping[str, Any]],
    searchbase: Mapping[str, SearchbaseEntry],
    output_dir: Path | str,
    selected: Iterable[str] | None = None,
    *,
    write: bool = True,
) -> dict[str, str]:
    """Validate and render selected (or all) configured views.

    All requested dashboards are rendered before any write occurs.  This avoids a
    half-generated set when a later dashboard contains an invalid reference.
    """

    selected_ids = sorted(set(selected) if selected is not None else stories)
    if not selected_ids:
        raise StoryConfigurationError("No configured dashboards were selected")
    unknown = [dashboard_id for dashboard_id in selected_ids if dashboard_id not in stories]
    if unknown:
        raise StoryConfigurationError(
            f"Selected dashboards are not configured: {', '.join(unknown)}"
        )

    rendered = {
        dashboard_id: render_dashboard_xml(dashboard_id, stories[dashboard_id], searchbase)
        for dashboard_id in selected_ids
    }
    if write:
        destination = Path(output_dir)
        destination.mkdir(parents=True, exist_ok=True)
        for dashboard_id, xml in rendered.items():
            (destination / f"{dashboard_id}.xml").write_text(xml, encoding="utf-8")
    return rendered


def _argument_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--config",
        required=True,
        type=Path,
        help="JSON file or Python module defining DASHBOARD_STORIES",
    )
    parser.add_argument("--searchbase", type=Path, default=DEFAULT_SEARCHBASE)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_VIEWS_DIR)
    selection = parser.add_mutually_exclusive_group(required=True)
    selection.add_argument(
        "--all", action="store_true", help="Generate all views in the supplied config"
    )
    selection.add_argument(
        "--view",
        action="append",
        dest="views",
        help="Generate one configured view; repeat to select more than one",
    )
    parser.add_argument(
        "--check",
        action="store_true",
        help="Validate and render without writing dashboard files",
    )
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    args = _argument_parser().parse_args(argv)
    try:
        stories = load_story_config(args.config)
        searchbase = parse_searchbase_file(args.searchbase)
        rendered = generate_story_dashboards(
            stories,
            searchbase,
            args.output_dir,
            selected=None if args.all else args.views,
            write=not args.check,
        )
    except (OSError, json.JSONDecodeError, StoryConfigurationError) as error:
        print(f"error: {error}", file=sys.stderr)
        return 2

    action = "Validated" if args.check else "Generated"
    for dashboard_id in rendered:
        print(f"{action} {dashboard_id}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
