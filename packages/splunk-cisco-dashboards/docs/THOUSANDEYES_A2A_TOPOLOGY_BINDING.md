# ThousandEyes A2A Topology Binding

Last updated: 2026-06-17

## Purpose

This document explains the portable ThousandEyes agent-to-agent topology binding
architecture used by the Overview customer topology map.

The old model relied on customer-specific SPL such as an Auburndale to
Tallahassee link search. That worked for one known topology, but it did not
scale across customers because it assumed city names, site IDs, agent names, or
test names inside the search.

The new model separates customer topology design from ThousandEyes discovery.
The topology editor owns the sites and links. A generic ThousandEyes inventory
search discovers observed A2A tests. The UI then binds a topology link to a
stable ThousandEyes test identity.

## Canonical Search

Use this search as the generic source of ThousandEyes A2A candidates:

```text
Overview - Link ThousandEyes A2A Inventory
```

Searchbase stanza:

```text
[overview_link_te_a2a_inventory]
```

Required topology discovery metadata:

```text
viz_options = {"topologyMap":{"role":"teA2AInventory"}}
```

This search reads recent raw ThousandEyes metric events:

```spl
`index_thousandeyes` sourcetype="cisco:thousandeyes:metric" "thousandeyes.test.type"="agent-to-agent"
```

It returns one normalized row per observed A2A test, source agent, and target
agent tuple. Important fields include:

- `candidateId`
- `teAccountId`
- `teTestId`
- `teTestName`
- `sourceAgent`
- `targetAgent`
- `sourceLocation`
- `targetLocation`
- `latencyMs`
- `lossPct`
- `jitterMs`
- `teLink`
- `lastUpdated`
- `telemetrySource`

## How It Works

1. Customer sites are configured in the topology editor.

   Example:

   - Site name: `Tallahassee`
   - Short name: `TLH`
   - Aliases: `TLH`, `Tallahassee`, `State EOC`

   Example:

   - Site name: `Auburndale`
   - Short name: `AUB`
   - Aliases: `AUB`, `Auburndale`, `Logistics`

2. Customer links are configured between those sites.

   Example:

   ```text
   Tallahassee to Auburndale
   ```

3. The generic inventory search runs once for the topology editor and map.

   The search does not assume Florida, TLH, AUB, or any customer-specific naming
   convention. It simply lists the A2A tests Splunk can observe from
   ThousandEyes metric events.

4. The UI ranks candidate matches.

   For each configured topology link, the UI compares the source and target site
   identities against the ThousandEyes candidate fields.

   Site identity comes from:

   - Site ID
   - Site name
   - Short name
   - Matching aliases

   ThousandEyes identity comes from:

   - Source agent
   - Target agent
   - Source location
   - Target location
   - Test name

5. The user binds the topology link to the correct ThousandEyes candidate.

   In the link editor, use the `ThousandEyes A2A` picker. Once selected, the
   link persists a `thousandEyesA2A` binding with the stable TE identity.

   The saved binding includes:

   - Candidate ID
   - Test ID
   - Optional account ID
   - Test name
   - Source and target agent details
   - Source and target location details

6. Saved binding wins over fuzzy matching.

   After a link is bound, the map does not need to guess from names every time.
   It first tries to resolve the saved ThousandEyes identity against current
   inventory results.

7. Link metrics populate from current ThousandEyes rows.

   When recent matching TE metric rows are present, the link popup can show:

   - Latency
   - Loss
   - Jitter
   - TE agent information
   - Last update time
   - View in ThousandEyes deep link

   Bandwidth-oriented fields such as capacity, throughput, and utilization may
   remain empty for TE-only links unless another telemetry source provides them.

8. Missing recent data is not treated as a broken binding.

   If the binding exists but no recent TE metric rows are found, the link stays
   associated with the TE test and keeps the ThousandEyes deep link when
   possible. The popup reports that the binding is awaiting recent metrics.

## Why This Is Better

The old model was:

```text
A customer-specific SPL search decides the topology link.
```

The new model is:

```text
Customer topology link + aliases + generic TE inventory + saved TE test binding.
```

This avoids hard-coding:

- City names
- Site IDs
- Agent names
- Test names
- Customer-specific topology assumptions

It also handles cases where the customer's ThousandEyes test name does not match
the real source and target agents. The UI can show and bind to the actual
agent-to-agent tuple instead of trusting the display name alone.

## Setup Steps

1. Add or confirm the customer sites.

   For FDEM, that means adding sites such as `TLH` and `AUB` if they are not
   already present.

2. Add useful aliases to each site.

   Aliases are what help the UI recommend the right TE candidates. Add city
   names, short codes, facility names, or operational names that may appear in
   ThousandEyes agent metadata.

3. Add the topology link.

   Create the site-to-site link in the topology editor.

4. Open the link editor and find `ThousandEyes A2A`.

   Pick the candidate that matches the real source and target TE agents.

5. Save the topology.

6. Click the topology line on the map.

   Click the line itself, not the site marker, to open the full link detail
   popup.

7. Use `View in ThousandEyes` to pivot into the TE test view.

   The generated URL can work with a known test ID alone, for example:

   ```text
   https://app.thousandeyes.com/network-app-synthetics/views/?testId=7148943
   ```

## Troubleshooting

If the `ThousandEyes A2A` picker is empty:

- Confirm Splunk is receiving `cisco:thousandeyes:metric` events.
- Confirm the events have `"thousandeyes.test.type"="agent-to-agent"`.
- Confirm the `index_thousandeyes` macro points at the right index.
- Increase the search window temporarily if the customer has no recent A2A
  samples.
- Check whether a firewall or path issue is preventing the A2A test from
  producing current metrics.

If the picker shows candidates but the recommendation looks weak:

- Add better site aliases.
- Include city codes, full city names, facility names, and operational names.
- Check whether the TE source or target agent location fields are populated.
- Prefer binding manually from the picker when multiple candidates are close.

If the link is bound but still shows awaiting data:

- The binding is probably fine.
- Splunk may not have recent matching TE metric rows.
- The customer may have a firewall/path issue between the two A2A agents.
- The `View in ThousandEyes` link can still be useful for validating the TE-side
  test status.

## Legacy Searches

The following older searches are not the canonical topology-binding model
anymore:

```text
Overview - Link Auburndale to Tallahassee Health
[overview_link_auburndale_tallahassee_health]
```

```text
Overview - Link ThousandEyes A2A Health
[overview_link_te_a2a_health]
```

They may remain temporarily for backward compatibility with saved topologies or
older demos, but new customer deployments should use:

```text
Overview - Link ThousandEyes A2A Inventory
[overview_link_te_a2a_inventory]
```

The TEUC SIP server availability search is unrelated to topology A2A binding.
It can remain or be retired as part of catalogue cleanup, but it is not replaced
by the A2A inventory search.
