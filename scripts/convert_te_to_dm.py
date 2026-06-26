#!/usr/bin/env python3
"""
Convert raw `index_thousandeyes` searches to tstats against Cisco_ThousandEyes DM.

Sourcetype → DM dataset mapping:
  cisco:thousandeyes:metric   → Test_Metrics
  cisco:thousandeyes:alerts   → Alerts
  cisco:thousandeyes:activity → Activities
  cisco:thousandeyes:trace    → Test_Traces
  cisco:thousandeyes:path-vis → Network_Path_Data
  (no sourcetype)             → Events

Syntax used: FROM datamodel=Cisco_ThousandEyes.DatasetName  (dot-notation, unquoted)
Field refs:  Dataset.field.name  (DM object prefix applied to every BY/agg/WHERE field)
"""

import re, sys
from pathlib import Path

CONF = Path(__file__).parent.parent / (
    "packages/splunk-cisco-dashboards/src/main/resources/splunk/default/searchbase.conf"
)

# ------------------------------------------------------------------
# Sourcetype → (DM object name, datamodel path)
# ------------------------------------------------------------------
ST_MAP = {
    "cisco:thousandeyes:metric":   ("Test_Metrics",    "Cisco_ThousandEyes.Test_Metrics"),
    "cisco:thousandeyes:alerts":   ("Alerts",           "Cisco_ThousandEyes.Alerts"),
    "cisco:thousandeyes:activity": ("Activities",       "Cisco_ThousandEyes.Activities"),
    "cisco:thousandeyes:trace":    ("Test_Traces",      "Cisco_ThousandEyes.Test_Traces"),
    "cisco:thousandeyes:path-vis": ("Network_Path_Data","Cisco_ThousandEyes.Network_Path_Data"),
    None:                          ("Events",            "Cisco_ThousandEyes.Events"),
}

# Searches to leave unchanged (cannot be tstats-ified without event-level access)
SKIP = {
    "teuc_5_9_23_internet_outage_correlation_with_internal_alerts",
    "overview_link_te_a2a_health",
    "it_health_thousandeyes_endpoint_traces",
}

# ------------------------------------------------------------------
# Field-prefixing helpers
# ------------------------------------------------------------------
_SPL_FUNCS = {
    "avg","sum","max","min","count","dc","values","earliest","latest",
    "first","last","list","range","stdev","var","p50","p90","p95","p99",
    "median","mode","estdc","sumsq","coalesce","if","round","match",
    "isnull","isnotnull","cidrmatch","like","exact","mvcount","mvappend",
    "tostring","tonumber","strftime","now","time","relative_time","len",
    "substr","lower","upper","trim","ltrim","rtrim","replace","split",
    "mvjoin","mvindex","mvsort","mvfilter","urldecode","urlencode",
    "eval","where","search","table","sort","dedup","head","tail","rex",
    "rename","lookup","join","stats","timechart","chart","bin","fields",
    "eventstats","appendpipe","append","union","inputlookup","outputlookup",
    "makeresults","gentimes","streamstats","predict","fit","apply","anomalydetection",
}
_NO_PREFIX = {"_time", "count", "_raw", "_key", "span", "as", "by", "_span",
               "true", "false", "null", "OR", "AND", "NOT", "IN"}

def _prefix(field: str, node: str) -> str:
    """Add 'node.' prefix to a bare TE field name."""
    field = field.strip().strip('"').strip("'")
    if not field:
        return field
    if field.startswith(node + "."):
        return field
    if field in _NO_PREFIX or field.lower() in _SPL_FUNCS:
        return field
    return f"{node}.{field}"


def _prefix_agg_expr(expr: str, node: str) -> str:
    """Prefix the field argument inside an aggregation: avg(field) → avg(node.field)."""
    expr = expr.strip()
    # count with no args
    if expr == "count":
        return "count"
    # func(field)  — use minimal (non-greedy) inner match so nested parens don't bleed
    # We match: word( [not-paren-chars] )
    m = re.match(r'^(\w+)\(([^()]+)\)$', expr)
    if m:
        func, inner = m.group(1), m.group(2).strip()
        if func.lower() in _SPL_FUNCS:
            if inner.startswith(node + "."):
                return expr
            # Never prefix _time or other special fields
            if inner in _NO_PREFIX:
                return expr
            return f"{func}({node}.{inner})"
    return expr


def _prefix_by_fields(by_str: str, node: str) -> str:
    """Prefix every field in a comma-separated BY list."""
    parts = [p.strip() for p in by_str.split(",") if p.strip()]
    return ", ".join(
        f if f in _NO_PREFIX else _prefix(f, node)
        for f in parts
    )


def _prefix_where_cond(cond: str, node: str) -> str:
    """Prefix field names on LHS of comparison operators in a WHERE-like condition string."""
    # Handle patterns like:  field="value"  field=val  field IN (...)
    def sub(m):
        field = m.group(1).strip()
        op    = m.group(2)
        rest  = m.group(3)
        if field.startswith(node + ".") or field.lower() in _SPL_FUNCS or field in _NO_PREFIX:
            return m.group(0)
        return f'{node}.{field}{op}{rest}'
    # field=value / field="value" / field IN (...)
    result = re.sub(r'("?[\w\.\:]+?"?)\s*(=|!=|>=|<=|>|<)\s*("(?:[^"]|\\")*"|\S+)', sub, cond)
    # Handle standalone field references that appear in OR/AND chains before parentheses
    return result


def _rename_by(by_fields_prefixed: str, node: str) -> str:
    """Build '| rename A.b as "b" A.c as "c"' for BY fields that got prefixed."""
    parts = [p.strip() for p in by_fields_prefixed.split(",") if p.strip()]
    pairs = []
    for pf in parts:
        if pf.startswith(node + "."):
            bare = pf[len(node) + 1:]
            if "." in bare:
                pairs.append(f'"{pf}" as "{bare}"')
            else:
                pairs.append(f'"{pf}" as {bare}')
    if not pairs:
        return ""
    return "| rename " + " ".join(pairs)


# ------------------------------------------------------------------
# Parse a flattened (backslash-joined) search into components
# ------------------------------------------------------------------
def _split_pipes(search: str):
    """Split a SPL string by top-level '|' into segments."""
    segments = []
    depth = 0
    buf = []
    i = 0
    while i < len(search):
        c = search[i]
        if c == '[':
            depth += 1
        elif c == ']':
            depth -= 1
        elif c == '|' and depth == 0:
            segments.append("".join(buf).strip())
            buf = []
            i += 1
            continue
        buf.append(c)
        i += 1
    if buf:
        segments.append("".join(buf).strip())
    return segments


def _parse_base(base: str):
    """
    Parse the base search (before first |).
    Returns (sourcetype_or_None, filter_conditions_str).
    """
    # Remove `index_thousandeyes`
    base = re.sub(r'`index_thousandeyes`\s*', '', base).strip()
    # Extract sourcetype
    st_m = re.search(r'sourcetype="([^"]+)"', base)
    st = st_m.group(1) if st_m else None
    if st_m:
        base = base[:st_m.start()] + base[st_m.end():]
    # Remove quotes from field names like "thousandeyes.test.type"
    base = re.sub(r'"(thousandeyes\.[^"]+)"', r'\1', base)
    # Remove 'earliest=-Xh@h' style time modifiers (will keep in tstats or drop)
    base = re.sub(r'earliest=-?\d+[smhdw]@?\w*\s*', '', base)
    base = re.sub(r'latest=\S+\s*', '', base)
    return st, base.strip()


def _parse_stats(cmd: str):
    """
    Parse a stats command: 'stats AGG1 as A1, AGG2 as A2 [by F1, F2]'
    Returns (aggs_str, by_str_or_empty).
    """
    cmd = cmd.strip()
    if cmd.startswith("stats"):
        cmd = cmd[5:].strip()
    by_m = re.search(r'\s+by\s+(.+)$', cmd, re.I)
    if by_m:
        aggs = cmd[:by_m.start()].strip()
        bys  = by_m.group(1).strip()
    else:
        aggs = cmd.strip()
        bys  = ""
    return aggs, bys


def _parse_timechart(cmd: str):
    """
    Parse a timechart command: 'timechart [span=X] AGG as A [by F]'
    Returns (span_str_or_empty, agg_str, alias_str, by_field_or_empty).
    """
    cmd = cmd.strip()
    if cmd.lower().startswith("timechart"):
        cmd = cmd[9:].strip()
    span = ""
    span_m = re.match(r'span=(\S+)\s*', cmd, re.I)
    if span_m:
        span = span_m.group(1)
        cmd = cmd[span_m.end():]
    by_m = re.search(r'\s+by\s+(\S+)\s*$', cmd, re.I)
    by_f = ""
    if by_m:
        by_f = by_m.group(1).strip()
        cmd = cmd[:by_m.start()].strip()
    # cmd now is the aggregation expression
    # Could be: count  /  count as c  /  avg(field) as alias  /  eval(round(avg(field),2)) as alias
    alias_m = re.search(r'\s+as\s+(\S+)\s*$', cmd, re.I)
    if alias_m:
        alias = alias_m.group(1)
        agg   = cmd[:alias_m.start()].strip()
    else:
        alias = ""
        agg   = cmd.strip()
    return span, agg, alias, by_f


def _agg_func_and_field(agg_str: str):
    """Extract the inner function and field from possibly nested expressions like eval(round(avg(f),2))."""
    # Handle eval(round(avg(field),N))
    m = re.match(r'eval\(round\((\w+)\((.+?)\)\s*,\s*\d+\)\)', agg_str, re.I)
    if m:
        return m.group(1), m.group(2)
    # Handle avg(field)
    m = re.match(r'(\w+)\((.+)\)', agg_str)
    if m:
        return m.group(1), m.group(2)
    # count
    if agg_str.strip() == "count":
        return "count", None
    return agg_str, None


# ------------------------------------------------------------------
# Build tstats for clean stats-based searches
# ------------------------------------------------------------------
def _build_tstats_stats(base_cond: str, aggs_raw: str, by_raw: str,
                         node: str, dm_path: str, extra_search: str = ""):
    """
    Build a tstats line for a stats-based search.
    Returns the full new search text (without outer backslash continuations).
    """
    # Prefix agg expressions
    # aggs_raw: "avg(f) as a, dc(g) as b, ..."
    agg_parts = _split_agg_list(aggs_raw)
    dm_aggs = []
    for part in agg_parts:
        as_m = re.match(r'(.+?)\s+as\s+(\S+)$', part.strip(), re.I)
        if as_m:
            agg_e  = as_m.group(1).strip()
            alias  = as_m.group(2)
            dm_agg = _prefix_agg_expr(agg_e, node)
            dm_aggs.append(f"{dm_agg} as {alias}")
        else:
            # Just 'count' with no alias
            dm_aggs.append(_prefix_agg_expr(part.strip(), node))
    dm_aggs_str = ", ".join(dm_aggs)

    # Build WHERE
    where_parts = []
    if base_cond:
        prefixed_cond = _prefix_where_cond(base_cond, node)
        where_parts.append(prefixed_cond)
    if extra_search:
        # Wrap OR-containing extra search conditions in parens to maintain
        # correct AND precedence when combined with base_cond
        prefixed_search = _prefix_where_cond(extra_search, node)
        if " OR " in prefixed_search.upper() and base_cond:
            prefixed_search = f"({prefixed_search})"
        where_parts.append(prefixed_search)
    where_str = " ".join(where_parts).strip() if where_parts else ""

    # Build BY
    if by_raw:
        dm_by = _prefix_by_fields(by_raw, node)
        by_clause = f" BY {dm_by}"
    else:
        by_clause = ""

    where_clause = f" WHERE {where_str}" if where_str else ""

    tstats = (
        f"| tstats `summariesonly` {dm_aggs_str}"
        f" FROM datamodel={dm_path}"
        f"{where_clause}"
        f"{by_clause}"
    )

    # Rename BY fields to strip Dataset. prefix
    rename_cmd = ""
    if by_raw:
        rename_cmd = _rename_by(dm_by, node)

    return tstats, rename_cmd, dm_by if by_raw else ""


# ------------------------------------------------------------------
# Build tstats for clean timechart-based searches
# ------------------------------------------------------------------
def _build_tstats_timechart(base_cond: str, span: str, agg_raw: str, alias: str, by_field: str,
                              node: str, dm_path: str, extra_search: str = ""):
    """
    Build a tstats + timechart for a timechart-based search.
    """
    func, field = _agg_func_and_field(agg_raw)
    if field:
        dm_field = f"{node}.{field}"
        dm_agg_str = f"{func}({dm_field})" + (f" as {alias}" if alias else "")
    else:
        # count
        dm_agg_str = "count" + (f" as {alias}" if alias else "")
        alias = alias or "count"

    # WHERE
    where_parts = []
    if base_cond:
        where_parts.append(_prefix_where_cond(base_cond, node))
    if extra_search:
        where_parts.append(_prefix_where_cond(extra_search, node))
    where_str = " ".join(where_parts).strip() if where_parts else ""
    where_clause = f" WHERE {where_str}" if where_str else ""

    # BY with _time and optional split field
    span_clause = f" span={span}" if span else " span=1h"
    if by_field:
        dm_by_field = _prefix(by_field, node)
        by_clause = f" BY _time{span_clause}, {dm_by_field}"
    else:
        by_clause = f" BY _time{span_clause}"

    tstats = (
        f"| tstats `summariesonly` {dm_agg_str}"
        f" FROM datamodel={dm_path}"
        f"{where_clause}"
        f"{by_clause}"
    )

    # Rename the split field if present
    rename_cmd = ""
    if by_field and _prefix(by_field, node) != by_field:
        dm_by = _prefix(by_field, node)
        bare  = by_field
        if "." in bare:
            rename_cmd = f'| rename "{dm_by}" as "{bare}"'
        else:
            rename_cmd = f'| rename "{dm_by}" as {bare}'

    # Reconstruct timechart using renamed (clean) split field name
    clean_split = f' by "{by_field}"' if by_field and "." in by_field else (f" by {by_field}" if by_field else "")
    span_tc = f" span={span}" if span else ""
    # After tstats pre-aggregated per bucket, use sum() in timechart (for avg: pre-avg + sum = identity at 1-per-bucket)
    agg_in_tc = f"sum({alias})" if alias else "sum(count)"
    timechart_cmd = f"| timechart{span_tc} {agg_in_tc}{clean_split}"

    return tstats, rename_cmd, timechart_cmd


# ------------------------------------------------------------------
# Split aggregation list (handles nested parens, comma OR space-sep)
# ------------------------------------------------------------------
def _split_agg_list(aggs: str) -> list:
    """
    Split 'avg(a) as x dc(b) as y' or 'avg(a) as x, dc(b) as y' into
    individual aggregation expressions.  Handles nested parentheses.
    """
    aggs = aggs.strip()
    # Strategy: find every occurrence of  word(  that is NOT inside parens
    # and that comes after an alias (as word) or after the start.
    # We'll walk character by character accumulating terms.
    parts = []
    depth = 0
    buf   = []
    i     = 0
    n     = len(aggs)

    while i < n:
        c = aggs[i]
        if c == '(':
            depth += 1
        elif c == ')':
            depth -= 1

        if c == ',' and depth == 0:
            # Explicit comma separator
            s = "".join(buf).strip()
            if s:
                parts.append(s)
            buf = []
            i += 1
            continue

        # At top level, check if we're at the start of a new agg function
        # Pattern: current buf ends with "as <alias>" (or is a bare "count")
        #          and next text starts with word(
        if depth == 0 and c == ' ':
            buf_str = "".join(buf).strip()
            rest = aggs[i:].lstrip()
            next_is_func = bool(re.match(r'^\w+\(', rest))
            if next_is_func:
                ends_with_alias = bool(re.search(r'\bas\s+\w+$', buf_str, re.I))
                bare_ident      = bool(re.match(r'^\w+$', buf_str))  # e.g. bare "count"
                if ends_with_alias or bare_ident:
                    parts.append(buf_str)
                    buf = []
                    i += len(aggs[i:]) - len(rest)
                    continue

        buf.append(c)
        i += 1

    s = "".join(buf).strip()
    if s:
        parts.append(s)
    return [p for p in parts if p]


# ------------------------------------------------------------------
# Convert a single stanza's search
# ------------------------------------------------------------------
def convert_search(name: str, raw_search: str) -> str | None:
    """
    Convert `raw_search` from raw index_thousandeyes to tstats.
    Returns new search string or None (= no change).
    """
    if name in SKIP:
        return None

    # Flatten multi-line search
    flat = re.sub(r'\\\n\s*', ' ', raw_search).strip()

    # Quick sanity: must contain index_thousandeyes
    if "`index_thousandeyes`" not in flat:
        return None

    # Split into pipe segments
    segs = _split_pipes(flat)
    if len(segs) < 2:
        return None  # No pipeline

    base_seg  = segs[0]
    rest_segs = segs[1:]

    # Parse base
    sourcetype, base_cond = _parse_base(base_seg)
    node, dm_path = ST_MAP.get(sourcetype, ST_MAP[None])

    # Look for an intermediate '| search ...' command (move to WHERE)
    extra_search = ""
    filtered_rest = []
    for seg in rest_segs:
        if seg.startswith("search "):
            extra_search = seg[7:].strip()
        else:
            filtered_rest.append(seg)
    rest_segs = filtered_rest

    if not rest_segs:
        return None

    first_cmd = rest_segs[0]
    after_first = rest_segs[1:]

    # ---- SPECIAL CASES ----

    # teuc_5_9_12: double-stats with eval region in between
    if name == "teuc_5_9_12_prefix_reachability_by_region":
        return _convert_teuc_5_9_12(base_cond, rest_segs, node, dm_path)

    # teuc_5_9_14 & teuc_5_9_35: eval(x*1000) then timechart
    if name in ("teuc_5_9_14_dns_resolution_time_trending",
                 "teuc_5_9_35_http_server_response_time_tracking"):
        return _convert_eval_scale_timechart(base_cond, rest_segs, node, dm_path)

    # teuc_5_9_53: tstats outer + join to APM
    if name == "teuc_5_9_53_cross_platform_correlation_network_plus_apm":
        return _convert_teuc_5_9_53(base_cond, rest_segs, node, dm_path)

    # teuc_5_9_54: tstats alerts + inner join with TE events
    if name == "teuc_5_9_54_mttr_reduction_via_network_vs_application_isolation":
        return _convert_teuc_5_9_54(rest_segs, node, dm_path)

    # ---- STANDARD STATS ----
    if first_cmd.startswith("stats "):
        aggs, bys = _parse_stats(first_cmd)
        tstats, rename_cmd, _ = _build_tstats_stats(
            base_cond, aggs, bys, node, dm_path, extra_search
        )
        parts = [tstats]
        if rename_cmd:
            parts.append(rename_cmd)
        for seg in after_first:
            parts.append("| " + seg)
        return " \\\n".join(parts)

    # ---- STANDARD TIMECHART ----
    if first_cmd.startswith("timechart"):
        span, agg_raw, alias, by_f = _parse_timechart(first_cmd)
        tstats, rename_cmd, tc_cmd = _build_tstats_timechart(
            base_cond, span, agg_raw, alias, by_f, node, dm_path, extra_search
        )
        parts = [tstats]
        if rename_cmd:
            parts.append(rename_cmd)
        parts.append(tc_cmd)
        for seg in after_first:
            parts.append("| " + seg)
        return " \\\n".join(parts)

    return None   # Unknown pattern


# ------------------------------------------------------------------
# Special case handlers
# ------------------------------------------------------------------

def _convert_teuc_5_9_12(base_cond, rest_segs, node, dm_path):
    """Two-pass stats with eval region in between."""
    # Expected: stats avg(bgp.reachability) as avg_reachability by location, prefix
    #           | eval region=case(...)
    #           | stats avg(avg_reachability) as regional_reachability by region, prefix
    first_stats = rest_segs[0]  # stats avg(...)
    aggs, bys = _parse_stats(first_stats)
    tstats, rename_cmd, _ = _build_tstats_stats(base_cond, aggs, bys, node, dm_path)
    parts = [tstats]
    if rename_cmd:
        parts.append(rename_cmd)
    for seg in rest_segs[1:]:
        parts.append("| " + seg)
    return " \\\n".join(parts)


def _convert_eval_scale_timechart(base_cond, rest_segs, node, dm_path):
    """eval(x*1000) then timechart eval(round(avg(x_ms),2)) → tstats avg(raw_field) + eval + timechart."""
    # rest_segs[0]: eval dns_duration_ms='dns.lookup.duration'*1000
    # rest_segs[1]: timechart eval(round(avg(dns_duration_ms),2)) as avg_dns_duration_ms by dns.question.name
    eval_seg = rest_segs[0]
    tc_seg   = rest_segs[1] if len(rest_segs) > 1 else ""

    # Parse the eval: get original field and scale
    eval_m = re.match(r"eval\s+(\w+)\s*=\s*'([^']+)'\s*\*\s*(\d+)", eval_seg)
    if not eval_m:
        # Fallback: keep as-is but replace base
        parts = [f"`index_thousandeyes` {base_cond}"] + ["| " + s for s in rest_segs]
        return " \\\n".join(parts)

    raw_field  = eval_m.group(2)   # e.g. dns.lookup.duration
    scale      = eval_m.group(3)   # e.g. 1000

    # Parse timechart
    span, agg_raw, alias, by_f = _parse_timechart(tc_seg)
    # agg_raw might be 'eval(round(avg(dns_duration_ms),2))' or just 'avg(ttfb_ms)'

    # Build tstats for the raw field with avg
    # NOTE: Do NOT use leading underscores in aliases - tstats rejects them
    dm_raw_field = f"{node}.{raw_field}"
    avg_alias    = f"avg_raw_s"
    tstats = (
        f"| tstats `summariesonly` avg({dm_raw_field}) as {avg_alias}"
        f" FROM datamodel={dm_path}"
        + (f" WHERE {_prefix_where_cond(base_cond, node)}" if base_cond else "")
        + (f" BY _time{' span=' + span if span else ' span=1h'}"
           + (f", {_prefix(by_f, node)}" if by_f else ""))
    )

    # Rename split field
    rename_cmd = ""
    if by_f and _prefix(by_f, node) != by_f:
        dm_by = _prefix(by_f, node)
        rename_cmd = f'| rename "{dm_by}" as "{by_f}"' if "." in by_f else f'| rename "{dm_by}" as {by_f}'

    # Eval scale
    rounding = "2"
    round_m  = re.search(r'round\([^,]+,\s*(\d+)\)', agg_raw)
    if round_m:
        rounding = round_m.group(1)
    eval_scale = f"| eval {alias} = round({avg_alias} * {scale}, {rounding})"

    # Timechart
    clean_split = (f' by "{by_f}"' if by_f and "." in by_f else f" by {by_f}") if by_f else ""
    span_tc  = f" span={span}" if span else ""
    tc_final = f"| timechart{span_tc} sum({alias}){clean_split}"

    parts = [tstats]
    if rename_cmd:
        parts.append(rename_cmd)
    parts.append(eval_scale)
    parts.append(tc_final)
    for seg in rest_segs[2:]:
        parts.append("| " + seg)
    return " \\\n".join(parts)


def _convert_teuc_5_9_53(base_cond, rest_segs, node, dm_path):
    """TE side → tstats; keep join + downstream as-is."""
    # rest_segs[0]: bin _time
    # rest_segs[1]: stats avg(...) by server.address, _time
    # rest_segs[2]: join type=outer ... [ search index=apm_traces ... ]
    # ...
    # Find the stats before the join
    stats_idx = next((i for i,s in enumerate(rest_segs) if s.startswith("stats ")), None)
    join_idx  = next((i for i,s in enumerate(rest_segs) if s.startswith("join ")), None)

    if stats_idx is None or join_idx is None:
        return None  # Can't parse, leave unchanged

    aggs, bys = _parse_stats(rest_segs[stats_idx])
    tstats, rename_cmd, _ = _build_tstats_stats(base_cond, aggs, bys, node, dm_path)
    parts = [tstats]
    if rename_cmd:
        parts.append(rename_cmd)
    # Skip bin _time (tstats handles bucketing), include everything from join onwards
    for seg in rest_segs[join_idx:]:
        parts.append("| " + seg)
    return " \\\n".join(parts)


def _convert_teuc_5_9_54(rest_segs, node, dm_path):
    """
    Outer: tstats earliest/latest from Alerts.
    Inner join subquery: also uses `index_thousandeyes` → tstats Events.
    """
    # Find the join segment
    join_idx = next((i for i,s in enumerate(rest_segs) if s.startswith("join ")), None)
    if join_idx is None:
        return None

    # Outer stats (before join)
    stats_seg = rest_segs[0]  # stats earliest(_time) as alert_start latest(_time) as alert_end by ...
    aggs, bys  = _parse_stats(stats_seg)
    outer_tstats, rename_cmd, _ = _build_tstats_stats("", aggs, bys, node, dm_path)

    # Parse the join segment to find the inner subquery
    join_seg = rest_segs[join_idx]
    # The inner subquery is: [ search `index_thousandeyes` | stats ... | rename ... ]
    inner_m = re.search(r'\[(.+)\]', join_seg, re.S)
    if inner_m:
        inner_raw = inner_m.group(1).strip()
        # Remove leading 'search' keyword if present
        inner_raw = re.sub(r'^search\s+', '', inner_raw)
        # Convert inner TE search to tstats (Events dataset)
        inner_segs = _split_pipes(inner_raw)
        inner_base_seg = inner_segs[0]
        _, inner_base_cond = _parse_base(inner_base_seg)
        inner_rest = inner_segs[1:]
        inner_parts = []
        if inner_rest and inner_rest[0].startswith("stats "):
            ia, ib = _parse_stats(inner_rest[0])
            inner_tstats, inner_rename, _ = _build_tstats_stats(
                inner_base_cond, ia, ib, "Events", "Cisco_ThousandEyes.Events"
            )
            inner_parts.append(inner_tstats)
            if inner_rename:
                inner_parts.append(inner_rename)
            for s in inner_rest[1:]:
                inner_parts.append("| " + s)
        else:
            inner_parts = [inner_raw]
        inner_new = " \\\n  ".join(inner_parts)
        # Rebuild join segment
        join_prefix = join_seg[:inner_m.start(1)].strip()
        join_new = f"{join_prefix} {inner_new} ]"
        join_seg = join_new

    parts = [outer_tstats]
    if rename_cmd:
        parts.append(rename_cmd)
    for i, seg in enumerate(rest_segs):
        if i == 0:
            continue  # already handled
        if i == join_idx:
            parts.append("| " + join_seg)
        else:
            parts.append("| " + seg)
    return " \\\n".join(parts)


# ------------------------------------------------------------------
# Main: parse conf, apply conversions, write back
# ------------------------------------------------------------------

def main(dry_run: bool = False):
    text = CONF.read_text(encoding="utf-8")

    stanza_re = re.compile(r'^\[([^\]]+)\]', re.M)
    stanzas   = list(stanza_re.finditer(text))

    changed = 0
    errors  = []
    new_text = text

    for idx, m in enumerate(stanzas):
        name = m.group(1)
        end  = stanzas[idx+1].start() if idx+1 < len(stanzas) else len(text)
        block = text[m.start():end]

        # Find search = field
        search_m = re.search(
            r'^(search = )(.+?)(?=\n[a-z_]+ = |\Z)',
            block, re.M | re.S
        )
        if not search_m:
            continue
        raw_search = search_m.group(2)
        if "`index_thousandeyes`" not in raw_search:
            continue

        try:
            new_search = convert_search(name, raw_search)
        except Exception as e:
            errors.append((name, str(e)))
            continue

        if new_search is None:
            continue

        # Build the replacement block
        old_search_field = search_m.group(0)
        # Preserve any trailing whitespace/newlines that existed after the search value
        # so that stanza headers on subsequent lines are not merged inline.
        trail_m = re.search(r'[\r\n]+$', old_search_field)
        trail   = trail_m.group(0) if trail_m else '\n'
        new_search_field = "search = " + new_search + trail

        # Replace in full text
        new_text = new_text.replace(old_search_field, new_search_field, 1)
        changed += 1
        if dry_run:
            print(f"\n[{name}]")
            print(f"  OLD: {raw_search[:100].replace(chr(10), ' ')}")
            print(f"  NEW: {new_search[:100].replace(chr(10), ' ')}")

    print(f"\nConverted: {changed}  Errors: {len(errors)}")
    for name, err in errors:
        print(f"  ERROR [{name}]: {err}")

    if not dry_run and changed:
        CONF.write_text(new_text, encoding="utf-8")
        print(f"Written: {CONF}")

    return changed, errors


if __name__ == "__main__":
    dry = "--dry-run" in sys.argv
    c, e = main(dry_run=dry)
    sys.exit(1 if e else 0)
