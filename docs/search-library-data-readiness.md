# Search-library data readiness and empty results

An empty investigation does not establish a healthy environment or a broken search. Check source coverage, usable fields and investigation conditions separately. Keep the selected event window and index permissions identical for comparisons. Run diagnostics sequentially, starting with fifteen minutes on busy feeds; the result-row limit does not bound scanned events.

## DNS resource types

`mv_dns_unusual_query_types` now prefers CIM `record_type` over the legacy `query_type` alias. The latter can hold an opcode such as `Query`, rather than a resource record type. `record_type=TXT` with `query_type=Query` must still qualify. An explicit `record_type=A` must not be overridden by `query_type=TXT`. Conflicting repeated scalar values remain unusable.

The query preserves its existing `QueryType` output column, source tags and index macros. Existing resource-type mappings through `query_type` remain supported. Review the deployed add-on's field extraction when neither field has a usable resource type.

## DNS response times

`mv_dns_response_latency` needs a measured `response_time` in seconds and a resolver address. Query-only logs cannot establish response latency. Do not substitute TTL, assume an arbitrary `duration` is a response measurement, pair requests and responses without a validated transaction key, or fill missing measurements with zero.

Use this bounded, read-only field diagnostic in the app's Search page:

```spl
(`index_network` OR `index_firewall` OR `index_security` OR `index_f5` OR `index_windows`)
tag=network tag=resolution tag=dns earliest=-15m latest=now
| foreach record_type query_type response_time dest dest_ip
    [ eval <<FIELD>>=if(coalesce(mvcount(mvdedup('<<FIELD>>')),0)=1,
        nullif(trim(mvindex(mvdedup('<<FIELD>>'),0)),""),null()) ]
| eval MeasuredSeconds=tonumber(response_time), Resolver=coalesce(dest,dest_ip)
| stats count AS Events count(record_type) AS WithRecordType
    count(query_type) AS WithQueryType count(Resolver) AS WithResolver
    count(eval(isnotnull(MeasuredSeconds) AND MeasuredSeconds>=0)) AS WithUsableResponseTime
    count(eval(upper(record_type) IN ("TXT","NULL","16","10"))) AS ResourceTypeCandidates
    by sourcetype
| sort 1000 - Events
```

If the raw feed contains a documented response measurement, repair its search-time mapping in the owning add-on and qualify units there. If it contains no measurement, enable a DNS transaction/response feed through the collection owner. This app does not own or silently enable that collector. The diagnostic reports field presence, not complete DNS service coverage.

## Intrusion tags and actions

`mv_intrusion_alert_actions` is displayed as **Intrusion Non-Blocking Action Evidence**. It requires **both** `ids` and `attack` CIM tags, a usable signature, and the CIM `allowed` action or a legacy `alert`, `alerted` or `detected` action. The earlier filter incorrectly omitted CIM `allowed`; the stanza ID and result columns are preserved. A populated intrusion feed can still produce an empty result when its actions are all blocks. Do not relax the source to every security event or reclassify blocked traffic to populate a panel. These labels describe the reporting IDS action, not passage through every control or a successful exploit.

First check the required tag intersection:

```spl
(`index_network` OR `index_firewall` OR `index_security` OR `index_f5` OR `index_windows`)
tag=ids tag=attack earliest=-15m latest=now
| stats count AS Events count(signature) AS WithSignature
    count(signature_id) AS WithSignatureId count(action) AS WithAction by sourcetype
| sort 1000 - Events
```

If no tagged events appear, inventory the expected intrusion sourcetype with the same finite window and index scope, then inspect its eventtype predicate, disabled status, tag assignment and knowledge-object sharing in the **owning add-on**. A generated source label may not satisfy an eventtype that also requires a particular `source` value. Validate that these are actual intrusion events before mapping them. This app intentionally ships no broad replacement eventtype or tag override for another add-on.

When tagged events exist, inspect normalized action counts before interpreting the non-blocking investigation:

```spl
(`index_network` OR `index_firewall` OR `index_security` OR `index_f5` OR `index_windows`)
tag=ids tag=attack earliest=-15m latest=now
| eval Action=if(coalesce(mvcount(mvdedup(action)),0)=1,
    lower(nullif(trim(mvindex(mvdedup(action),0)),"")),"Unknown")
| stats count AS Events by sourcetype Action
| sort 1000 - Events
```

## Missing vendor feeds and unmet conditions

The October 28, 2026 assessment of the 104 additions used one fixed 24-hour event window. Twenty-six searches populated; sixty-seven had no observed matching source family; eight had no qualifying conditions; two lacked usable DNS measurements; one intrusion search was empty. No SPL execution errors were detected. Follow-up inspection superseded the initial missing-intrusion-tags classification: the current tags and global eventtype are enabled and match events, but the investigation excluded the standard CIM `allowed` action. This is an environment-specific baseline before the DNS and intrusion filter corrections, not a permanent support or health classification. It executed source SPL on a stack running 1.0.70; installed 1.0.80 dashboard acceptance remains separate after that stack is upgraded.

Missing families included Zeek certificates, MDS, Hyperfabric, SNMP, Palo Alto GlobalProtect/threat/system events, and the Fortinet, Juniper/Aruba, Arista, Check Point, F5, Zscaler, Infoblox, CrowdStrike and Defender network-event packs. Palo Alto traffic alone does not populate its threat or remote-access searches. Defender alert samples do not replace DeviceNetworkEvents. Enable the actual matching feed/export and its supported add-on through the collection owner; a configured dataset is not proof of ingestion. Keep existing index-routing decisions separate from absent source data.

Preserve the intended conditions when testing these investigations:

| Investigation | Positive-case prerequisite |
| --- | --- |
| Duo denial followed by success | At least three prior denials for the same user/application within ten minutes, followed by success |
| Duo push fatigue | A qualifying push factor and the search's risky-outcome/bucket threshold |
| Catalyst change/issue association | Compatible device keys and an issue in the configured association window |
| IPv6 denied destinations | Valid mapped IPv6 addresses and an explicitly denied action |
| Authentication password spray | At least ten failures and five distinct users in the configured bucket |
| NAT/resource failure evidence | One of the explicitly selected resource/NAT failure message codes |
| DNS SERVFAIL | An explicit SERVFAIL response/code, not a query-only record |
| HTTP server errors | A usable HTTP status from 500 through 599 |

Use the existing read-only native-SPL fixture generators for controlled positive and negative cases. These create `makeresults` rows inside the search, not indexed production events. Keep fixture proof separate from native vendor parsing and deployed dashboard acceptance. Do not lower thresholds or manufacture production events merely to make every search return rows.

## References

- [Splunk CIM Network Resolution (DNS)](https://help.splunk.com/en/data-management/common-information-model/6.2/data-models/network-resolution-dns)
- [Splunk CIM Intrusion Detection](https://help.splunk.com/en/data-management/common-information-model/6.2/data-models/intrusion-detection)
- [Multivendor search contracts and fixture instructions](multivendor-search-library.md)
