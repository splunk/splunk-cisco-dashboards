# Phase 1 Gap Field Requests

The 2026-07-29 index and sourcetype inventory confirms live telemetry for Cisco Secure Client NVM and native AWS, Azure, and GCP security sources. Those findings are reflected in `phase1_searchbase_coverage.csv`.

The following targeted exports are the minimum additional evidence needed to improve the remaining field-dependent coverage. Export each result as CSV. For raw-event samples, sanitize usernames, internal addresses, hostnames, account identifiers, tokens, cookies, and other sensitive values. Do not include credentials, private keys, or full certificate bodies.

## 1. Native Cloud Security Fields

Run once for each provider by replacing the base search with the AWS, Azure, or GCP variant below.

```spl
index=cloud_aws sourcetype IN ("aws:cloudwatch:guardduty","aws:cloudtrail:lake","aws:config:notification","aws:config:rule","aws:inspector")
| fieldsummary
| table field count distinct_count values
```

```spl
index=cloud_azure sourcetype IN ("azure:aad:audit","azure:aad:signin","azure:monitor:aad","azure:monitor:audit","azure:securityCenter:alert","azure:securityCenter:task")
| fieldsummary
| table field count distinct_count values
```

```spl
index=cloud_gcp sourcetype IN ("google:gcp:pubsub:audit:admin_activity","google:gcp:pubsub:audit:auth","google:gcp:pubsub:message","google:gsuite:pubsub:audit:auth")
| fieldsummary
| table field count distinct_count values
```

Also provide up to 50 sanitized raw events per listed sourcetype:

```spl
index=<provider_index> sourcetype=<one_sourcetype>
| head 50
| table _time sourcetype source host _raw
```

This enables finding-level searches normalized by severity, account/subscription/project, region, resource, action, and disposition.

## 2. Nexus Physical and Fabric Hierarchy

```spl
index=cisco_aci sourcetype IN ("cisco:dc:nexus9k","cisco:dc:nd:mso","cisco:dc:nd:anomalies","cisco:dc:nd:advisories")
| fieldsummary
| table field count distinct_count values
```

```spl
index=cisco_aci sourcetype IN ("cisco:dc:nexus9k","cisco:dc:nd:mso")
| head 100
| table _time sourcetype source host _raw
```

This determines whether data center, pod, row, rack, fabric, site, and device relationships can be built from existing fields or require an inventory enrichment source.

## 3. Catalyst Site and Fabric Hierarchy

```spl
(index=cisco_catcenter OR index=dnac) sourcetype IN ("cisco:dnac:site:topology","cisco:catalyst:center:inventory:report","cisco:catalyst:center:report")
| fieldsummary
| table field count distinct_count values
```

```spl
(index=cisco_catcenter OR index=dnac) sourcetype="cisco:dnac:site:topology"
| head 100
| table _time sourcetype source host _raw
```

This can resolve Global/Area/Building/Floor hierarchy coverage. A fabric-enabled status still requires a field or API response that explicitly reports fabric membership and role.

## 4. Meraki Organization, Network, Device, and SSID Fields

```spl
index=net_ops sourcetype IN ("meraki:organizations","meraki:organizationsnetworks","meraki:devices","meraki:accesspoints")
| fieldsummary
| table field count distinct_count values
```

```spl
index=net_ops sourcetype IN ("meraki:organizations","meraki:organizationsnetworks","meraki:devices")
| head 100
| table _time sourcetype source host _raw
```

This can close the organization-network-device hierarchy. The inventory contains no dedicated Wireless SSIDs API sourcetype, so authoritative WPA2/WPA3/Enterprise/Open configuration remains a collection gap unless SSID configuration fields appear in these samples.

## 5. ISE Deployment and Integration Health

```spl
index=ise sourcetype IN ("cisco:ise:custom:deployment_node","cisco:ise:custom:repository")
| fieldsummary
| table field count distinct_count values
```

```spl
index=ise sourcetype="cisco:ise:custom:deployment_node"
| head 100
| table _time sourcetype source host _raw
```

This may improve ISE node and repository health coverage. It closes PxGrid/external-integration status only if an explicit integration name, connection state, and last-success or failure field is present.

## 6. RaVPN Posture and SD-WAN Path Intelligence

```spl
index=cisco_umbrella sourcetype="cisco:cloud_security:ravpn"
| fieldsummary
| table field count distinct_count values
```

```spl
index=cisco_umbrella sourcetype="cisco:cloud_security:ravpn"
| head 100
| table _time sourcetype source host _raw
```

```spl
(index=cisco_sdwan OR index=sdwan) sourcetype IN ("cisco:sdwan:system:logs","cisco:sdwan:audit:logs","cisco:sdwan:linkhealth","cisco:sdwan:tunnelhealth")
| regex _raw="(?i)(NWPI|path intelligence|recommend|path insight|path change)"
| head 100
| table _time sourcetype source host _raw
```

RaVPN samples determine whether posture result, reason, endpoint, identity, and policy fields are available in the installed add-on version. SD-WAN matches determine whether NWPI recommendations are present or only operational path-health evidence is available.

## Collection Gaps Not Solved by This Inventory

- CTS CLI and authoritative running configuration for TrustSec, SGT, VRF, VLAN, 802.1Q, VXLAN, and VPN.
- Explicit Catalyst fabric-enabled state if absent from the topology/API samples.
- Meraki Wireless SSIDs API configuration if absent from current sourcetypes.
- ISE PxGrid/external-integration state if absent from the deployment-node API response.

These remain `GAP`, `PARTIAL`, or `BLOCKED` until a supported collection path is identified.