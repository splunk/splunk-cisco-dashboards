# Field Inventory Diff

- **Baseline (A):** `scripts/sourcetype_field_inventory.json`
- **Comparison (B):** `scripts/sourcetype_field_inventory_live_dnac.json`
- **Sourcetypes compared:** 9

## Summary

| Sourcetype | A fields | B fields | Added in B | Removed in B |
|---|---:|---:|---:|---:|
| `cisco:dnac:audit:logs` | 48 | 54 | 13 | 7 |
| `cisco:dnac:client` | 114 | 126 | 13 | 1 |
| `cisco:dnac:clienthealth` | 11 | 11 | 0 | 0 |
| `cisco:dnac:compliance` | 30 | 34 | 4 | 0 |
| `cisco:dnac:devicehealth` | 65 | 62 | 0 | 3 |
| `cisco:dnac:issue` | 40 | 37 | 0 | 3 |
| `cisco:dnac:networkhealth` | 18 | 18 | 0 | 0 |
| `cisco:dnac:securityadvisory` | 34 | 34 | 0 | 0 |
| `cisco:dnac:site:topology` | 44 | 20 | 1 | 25 |

**Removed in B** is the actionable column - any SPL that references one of those field names is broken on the B data shape and needs to be rewritten or removed.

## Per-sourcetype detail

### `cisco:dnac:audit:logs`

**Added in B (13):**

- `ciscoDnaEventLinkIPv4`
- `ciscoDnaEventLinkIPv6`
- `clientId`
- `dnacIPv4`
- `dnacIPv6`
- `isAlert`
- `productId`
- `resourceDomain._id`
- `resourceDomain.name`
- `resourceDomain.resourceGroups{}.name`
- `resourceDomain.resourceGroups{}.srcResourceId`
- `resourceDomain.resourceGroups{}.type`
- `userName`

**Removed in B (7):**

- `correlationId`
- `details.requestPayloadDescriptor`
- `eventHierarchy.hierarchy`
- `eventHierarchy.hierarchyDelimiter`
- `i18n.messageKey`
- `network.deviceId`
- `network.siteId`

### `cisco:dnac:client`

**Added in B (13):**

- `health.dataRateThreshold`
- `health.discardsThreshold`
- `health.isDataRateIncluded`
- `health.isDiscardsIncluded`
- `health.isRetriesIncluded`
- `health.isUtilizationIncluded`
- `health.retriesThreshold`
- `health.utilizationThreshold`
- `traffic.inDiscards`
- `traffic.inUtilization`
- `traffic.outDiscards`
- `traffic.outUtilization`
- `trustScore`

**Removed in B (1):**

- `ipv6Addresses{}`

### `cisco:dnac:compliance`

**Added in B (4):**

- `ComplianceDeviceCount`
- `CompliantDeviceCount`
- `cisco_catalyst_center_host`
- `timestamp`

### `cisco:dnac:devicehealth`

**Removed in B (3):**

- `dnac_orig_site`
- `event_source`
- `site_id`

### `cisco:dnac:issue`

**Removed in B (3):**

- `SiteName`
- `SiteNameHierarchy`
- `SiteType`

### `cisco:dnac:site:topology`

**Added in B (1):**

- `siteHierarchyId`

**Removed in B (25):**

- `category`
- `ciscoDnaEventLink`
- `description`
- `details.additionalInfo{}.attribute`
- `details.additionalInfo{}.value`
- `details.deviceCount`
- `details.parentName`
- `details.siteId`
- `details.siteName`
- `details.siteType`
- `details.topology.links`
- `details.topology.nodes`
- `details.topology.rootNode`
- `domain`
- `efInstanceId`
- `eventId`
- `instanceId`
- `namespace`
- `severity`
- `src`
- `subDomain`
- `tenantId`
- `tntId`
- `userId`
- `version`

