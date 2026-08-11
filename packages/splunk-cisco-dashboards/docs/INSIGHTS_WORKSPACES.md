# Insights Workspaces

Insights is one React experience and one canonical Splunk view that can render
many reusable customer-demo workspaces. Workspace metadata and shared layouts
are config-driven, so adding a demo does not require another dashboard shell or
a Splunk restart.

## Runtime model

- Canonical view: `default/data/ui/views/workspace_insights.xml`
- Canonical URL: `workspace_insights?workspace=<workspace_id>`
- Config: `default/insights_workspaces.conf`
- Runtime authoring writes: `local/insights_workspaces.conf`
- React definitions and compatibility helpers:
  `common/config/insightsWorkspaces.ts`
- Config REST persistence: `common/services/insightsWorkspaceService.ts`

Every packaged and custom workspace uses the canonical view with a `workspace`
query parameter. Secure Networking is the default workspace when no parameter
is present.

## Config schema

Workspace metadata uses a namespaced stanza:

```conf
[workspace.customer_zero_trust_demo]
label = Customer Zero Trust Demo
source_workspace = secure_networking
sections = zta,secure_infrastructure,agentic_ops
default_visible_sections = zta,secure_infrastructure,agentic_ops
max_visible_sections = 3
min_tile_count = 1
max_tile_count = 9
default_tile_count = 3
header_title = Customer Zero Trust Demo
header_subtitle = Identity, policy, and access assurance
hide_default_logo = 1
is_builtin = 0
enabled = 1
sort_order = 100
```

Shared tile layouts use a separate stanza for each workspace section:

```conf
[layout.customer_zero_trust_demo.zta]
tiles = zta_auth_outcomes,zta_blocked_reasons,zta_policy_activity
visible_count = 3
```

All identifiers and properties use workspace terminology. `source_workspace`
selects the searchbase catalog and section family that a workspace can use; it
does not make the new workspace an alias. Each workspace still has independent
layout and per-user preference keys.

## Customer demo workflow

Users allowed to write `insights_workspaces.conf` see **Manage workspaces** in
the Insights header. They can:

1. Create a workspace from the Secure Networking or Executive Briefing source.
2. Select the use-case sections for that customer conversation.
3. Duplicate an existing workspace, including its shared tile layouts.
4. Edit labels, header copy, section selection, and default tile density.
5. Delete custom workspaces; packaged workspaces cannot be deleted.

After opening a workspace, arrange its tiles and choose **Publish workspace
layout** in the tile editor to update its `layout.<workspace>.<section>`
stanzas. Splunk writes these changes to `local/insights_workspaces.conf`, which
keeps customer workspaces upgrade-safe.

## Packaged workspaces

- Secure Networking — main/default workspace.
- Zero Trust Access Demo — identity, authentication, and access enforcement.
- Network Resilience Demo — infrastructure, segmentation, firewalling, and
  service assurance.
- Security Operations Demo — security, IT health, and executive signals.
- Executive Briefing — the executive workspace with its existing storage keys.

## Searchbase compatibility

Searchbase tile metadata can use `workspace` for new writes:

```json
{
  "overview": [
    {
      "workspace": "secure_networking",
      "tileId": "zta_policy_family",
      "section": "zta",
      "label": "ISE policy families"
    }
  ]
}
```

The read path continues to accept the legacy `profile` property so installed
local searchbase overrides remain valid during migration.
