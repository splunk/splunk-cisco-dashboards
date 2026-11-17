# insights_workspaces.conf — shared Insights configuration
# Shared workspace definitions and tile defaults are stored in this app's
# local overlay. Writes require ssne_manage_insights_workspaces; personal
# visualization choices remain browser-local and take precedence.
# No restart is required when saving workspace configuration.

[workspace.<workspace_id>]

label = <string>
* Shared label.

source_workspace = <string>
* Shared source workspace.

sections = <string>
* Shared sections.

default_visible_sections = <string>
* Shared default visible sections.

max_visible_sections = <string>
* Shared max visible sections.

min_tile_count = <string>
* Shared min tile count.

max_tile_count = <string>
* Shared max tile count.

default_tile_count = <string>
* Shared default tile count.

header_title = <string>
* Shared header title.

header_subtitle = <string>
* Shared header subtitle.

default_logo_src = <string>
* Shared default logo src.

hide_default_logo = <string>
* Shared hide default logo.

legacy_view_names = <string>
* Shared legacy view names.

is_builtin = <string>
* Shared is builtin.

enabled = <string>
* Shared enabled.

sort_order = <string>
* Shared sort order.

map_visible = <string>
* Shared map visible.

map_position = <string>
* Shared map position.

regional_view = <string>
* Shared regional view.

updated_at = <string>
* Shared updated at.

updated_by = <string>
* Shared updated by.

[layout.<workspace_id>.<section_id>]

tiles = <string>
* Shared tiles.

searchbase_additions = <string>
* Shared searchbase additions.

visible_count = <string>
* Shared visible count.

viz_overrides = <string>
* Single-line JSON tile-ID to visualization-type map for this workspace section.
* Personal choices take precedence; an empty object inherits search defaults.
* Types: area, line, column, bar, singlevalue, table, barbreakdown, pie,
* singlevalueradial, fillergauge, markergauge. Maximum 256 entries.

updated_at = <string>
* Shared updated at.

updated_by = <string>
* Shared updated by.

[signal_item.<item_id>]

search_name = <string>
* Shared search name.

label = <string>
* Shared label.

value_field = <string>
* Shared value field.

threshold_warning = <string>
* Shared threshold warning.

threshold_critical = <string>
* Shared threshold critical.

threshold_direction = <string>
* Shared threshold direction.

threshold_unit = <string>
* Shared threshold unit.

updated_at = <string>
* Shared updated at.

updated_by = <string>
* Shared updated by.

[signal_rail.<workspace_id>]

enabled = <string>
* Shared enabled.

show_priority_drilldown = <string>
* Shared show priority drilldown.

rows = <string>
* Shared rows.

speed = <string>
* Shared speed.

density = <string>
* Shared density.

font_size = <string>
* Shared font size.

items = <string>
* Shared items.

updated_at = <string>
* Shared updated at.

updated_by = <string>
* Shared updated by.
