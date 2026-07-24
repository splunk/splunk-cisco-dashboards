# Overview Profiles

The Overview dashboard is a shared React engine that can render multiple
solution-specific experiences without cloning the page.

## Profiles

Profiles live in:

`src/main/webapp/common/config/overviewProfiles.ts`

Each profile defines:

- `id` - stable profile id stored in localStorage / factory config keys.
- `viewNames` - Splunk Simple XML views that should activate the profile.
- `headerTitle` / `headerSubtitle` - optional branded defaults.
- `sections` - section ids, titles, drilldown links, and icon names.
- `defaultVisibleSections` / `maxVisibleSections` - initial section layout.
- `minTileCount` / `maxTileCount` / `fallbackTileCount` - per-section tile density.
- `autoDiscovery` - optional rules for deriving tiles from searchbase stanzas.

The default `executive` profile preserves the original Overview behavior and
keeps the legacy localStorage keys. Non-default profiles get profile-scoped
localStorage keys so tile order, visible counts, heights, display overrides,
branding, drilldowns, and Signal Rail settings do not bleed across profiles.

## Secure Networking

`secure_networking` is activated by the Splunk view:

`default/data/ui/views/secure_networking_overview.xml`

That view loads the same `overview_bootstrap.js` bundle as `overview.xml`; the
React page chooses the profile from the current view name.

The Secure Networking profile has five sections:

- Zero Trust Access
- Secure Infrastructure
- Scalable Network Segmentation
- Hybrid Mesh Firewalling
- Agentic Ops

## Searchbase Binding

The preferred explicit binding is to add a profile-scoped Overview entry to a
searchbase stanza:

```json
{
  "overview": [
    {
      "profile": "secure_networking",
      "tileId": "zta_policy_family",
      "section": "zta",
      "label": "ISE policy families",
      "subLabel": "RADIUS + TACACS+",
      "valueField": "Policy Sets"
    }
  ]
}
```

For table, bar, and pie searches, `valueField` is optional because the tile uses
the stanza's `default_viz` and table-shaped result set.

The current Secure Networking profile also auto-discovers stanzas whose id
starts with `secure_networking_`, whose tags include `Secure Networking`, and
whose `sub_category` matches one of the five profile pillars. This lets early
curation work appear in the profile before every stanza has hand-authored
`viz_options.overview` metadata.

## Factory Defaults

The existing packaged stanzas in `overview_factory_tiles.conf` still apply to
the default Executive Overview profile.

When an admin saves Secure Networking defaults from the picker, runtime writes
use profile-prefixed stanzas such as:

```conf
[secure_networking.zta]
tiles = secure_networking_ise_policy_family_overview
visible_count = 1
```

This keeps solution-specific factory layouts isolated while preserving one
shared dashboard engine.
