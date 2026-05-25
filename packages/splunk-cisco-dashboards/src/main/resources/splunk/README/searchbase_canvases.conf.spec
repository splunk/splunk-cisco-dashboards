# searchbase_canvases.conf - schema for Searchbase Canvas persistence
#
# One stanza per saved Searchbase Canvas. Stanza names are the saved
# canvas names shown in the canvas picker.
#
# Operator saves are written to local/searchbase_canvases.conf. The
# app ships an empty default/searchbase_canvases.conf so the REST conf
# endpoint exists and future releases can add optional seed canvases.

[<canvas-name>]

schema_version = <integer>
* Current value: 1.

title = <string>
* Friendly canvas title.

description = <string>
* Reserved for future picker notes. Empty string is allowed.

updated_at = <string>
* ISO-8601 UTC timestamp of the last save.

updated_by = <string>
* Splunk username of the operator who saved the canvas.

tile_count = <integer>
* Number of tiles in payload_json.

page_size = <integer>
* Canvas page size. Supported values: 10, 25, 50, 100.

search_names = <string>
* Comma-separated list of searchbase search_name values referenced by
  the canvas. This is denormalized for btool/grep inspection.

payload_json = <string>
* Single-line JSON produced by the React canvas:
  { version, canvasName, pageSize, rangeLabel, tiles }.
* The React service validates and caps this payload before saving.
