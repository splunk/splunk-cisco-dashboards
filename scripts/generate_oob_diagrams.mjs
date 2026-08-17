#!/usr/bin/env node
/**
 * generate_oob_diagrams.mjs
 *
 * Author of the out-of-the-box (OOB) seed diagrams shipped in
 * `packages/splunk-cisco-dashboards/src/main/resources/splunk/default/network_diagrams.conf`.
 *
 * Build 115.3 — migrated emit target from
 * `lookups/network_diagrams.csv.default` to
 * `default/network_diagrams.conf`. The runtime persistence layer
 * now reads/writes Splunk conf stanzas via the REST API; see
 * `diagramPersistenceService.ts` for the full rationale (default/
 * local layering, per-stanza atomicity, btool support, etc.).
 *
 * Why a generator (vs hand-editing the conf):
 *   • The diagram payloads are non-trivial JSON blobs with dozens of
 *     nodes and edges. Authoring them as TypeScript-flavoured JS
 *     literals lets us keep coordinates, handle ids, and edge wiring
 *     readable; the generator handles the conf-formatting (single-
 *     line `payload_json = …`) automatically.
 *   • Re-running the script is the "single click" we want when an
 *     OOB diagram is updated. Reviewers can diff the generator
 *     output (conf) against `git status` and instantly see what
 *     changed without parsing escaped JSON.
 *
 * Usage:
 *   node scripts/generate_oob_diagrams.mjs
 *
 * The script overwrites `default/network_diagrams.conf` from
 * scratch — every OOB diagram defined below gets a stanza in the
 * output, plus the file's preamble comment block. To remove an
 * OOB diagram, delete it from `OOB_DIAGRAMS` below and re-run
 * the script.
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");
const OUT_PATH = resolve(
  REPO_ROOT,
  "packages/splunk-cisco-dashboards/src/main/resources/splunk/default/network_diagrams.conf",
);

// --- Helpers --------------------------------------------------------

/** Match diagramPersistenceService.ts's NAME_PATTERN. Stanza names
 *  must round-trip through URL paths (REST writes use
 *  /configs/conf-network_diagrams/<encoded-stanza>) and through
 *  btool, so we keep the allow-list narrow. */
const STANZA_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9 _.\-]{0,63}$/;

const assertSafeStanzaName = (name) => {
  if (!STANZA_NAME_PATTERN.test(name)) {
    throw new Error(
      `Invalid OOB diagram stanza name: "${name}". ` +
        `Use 1–64 letters / digits / spaces / dots / hyphens / underscores.`,
    );
  }
};

// Standard handle ids exposed by every device shape. Centralised so
// each edge below reads more like a routing instruction ("right
// edge of A → left edge of B") than a string-typo trap.
const H = {
  TopSrc: "top-source",
  TopTgt: "top-target",
  BottomSrc: "bottom-source",
  BottomTgt: "bottom-target",
  LeftSrc: "left-source",
  LeftTgt: "left-target",
  RightSrc: "right-source",
  RightTgt: "right-target",
};

// --- Splunk Cloud Deployment Architecture ---------------------------

/**
 * Splunk Cloud Deployment Architecture — OOB reference diagram.
 *
 * Mirrors a generic Splunk Cloud topology reference. The intent is
 * "drop a customer in front of this and
 * they immediately understand the protocol gateways and the
 * cross-tier traffic flows" — Search Tier ↔ Indexing Tier on the
 * left, Collection Tier feeding the indexers on the right, and the
 * Customer Environment hanging off the bottom routing through three
 * named protocol gateways (REST 8089, HTTPS 443, Forwarder 9997 TLS).
 *
 * Layout strategy:
 *   • Three top-row regions for the Splunk Cloud sub-tiers, sized so
 *     the gap between them stays consistent at 30px. Region accent
 *     colours are picked to match the Splunk Cloud reference (green
 *     / blue / rose for search / index / collection cloud).
 *   • One wide bottom region for Customer Environment.
 *   • Three textboxes between the Cloud regions and Customer Env act
 *     as the protocol-gateway labels. They're carded (white fill,
 *     grey border) so they read as "wires and ports" rather than
 *     captions.
 *   • A sky-blue title node anchors the diagram visually at the top.
 *
 * Edge routing prefers explicit handle ids (`right-source` →
 * `left-target` etc.) so the diagram looks "engineered" — wires
 * leave each node from the side closest to their destination — and
 * survives the Build 115.1 handle-persistence fix without snapping
 * back to the top centre.
 */
const splunkCloudDeployment = {
  name: "Splunk Cloud Deployment Architecture",
  payload: {
    version: 1,
    title: {
      text: "Splunk Cloud Deployment Architecture",
      x: 40,
      y: -50,
      fontSize: 26,
      color: "#0369a1",
      bold: true,
      italic: false,
    },
    groups: [
      {
        id: "g_search_tier",
        label: "Search Tier",
        x: 20,
        y: 40,
        width: 200,
        height: 360,
        accent: "emerald-500",
      },
      {
        id: "g_index_tier",
        label: "Indexing Tier",
        x: 240,
        y: 40,
        width: 320,
        height: 360,
        accent: "sky-500",
      },
      {
        id: "g_collection_cloud",
        label: "Collection Tier (Cloud)",
        x: 580,
        y: 40,
        width: 180,
        height: 360,
        accent: "rose-500",
      },
      {
        id: "g_customer_env",
        label: "Customer Environment (On-Prem or Cloud)",
        x: 20,
        y: 560,
        width: 740,
        height: 200,
        accent: "slate-500",
      },
    ],
    nodes: [
      // --- Search Tier --------------------------------------------------
      {
        id: "core_sh",
        type: "device:server",
        x: 50,
        y: 40,
        parentId: "g_search_tier",
        label: "Core Search Head",
        shortLabel: "Core SH",
        vendor: "Splunk",
        model: "Search Head",
      },
      {
        id: "premium_sh",
        type: "device:server",
        x: 50,
        y: 200,
        parentId: "g_search_tier",
        label: "Premium App Search Head",
        shortLabel: "Premium SH",
        vendor: "Splunk",
        model: "Search Head",
      },

      // --- Indexing Tier (3 AZs + HEC LB) ------------------------------
      {
        id: "idx_az1",
        type: "device:splunk_indexer",
        x: 105,
        y: 30,
        parentId: "g_index_tier",
        label: "Indexer (AZ1)",
        shortLabel: "AZ1",
        vendor: "Splunk",
        model: "AZ",
      },
      {
        id: "idx_az2",
        type: "device:splunk_indexer",
        x: 25,
        y: 180,
        parentId: "g_index_tier",
        label: "Indexer (AZ2)",
        shortLabel: "AZ2",
        vendor: "Splunk",
        model: "AZ",
      },
      {
        id: "idx_az3",
        type: "device:splunk_indexer",
        x: 185,
        y: 180,
        parentId: "g_index_tier",
        label: "Indexer (AZ3)",
        shortLabel: "AZ3",
        vendor: "Splunk",
        model: "AZ",
      },
      {
        id: "hec_lb",
        type: "device:load_balancer",
        x: 105,
        y: 240,
        parentId: "g_index_tier",
        label: "HEC Endpoint",
        shortLabel: "Elastic LB",
        vendor: "Splunk",
        model: "HEC LB",
      },

      // --- Collection Tier (Cloud) -------------------------------------
      {
        id: "inputs_dm",
        type: "device:cloud",
        x: 40,
        y: 130,
        parentId: "g_collection_cloud",
        label: "Inputs Data Manager",
        shortLabel: "IDM",
        vendor: "Splunk",
        model: "IDM",
      },

      // --- Protocol Gateways (textboxes; labels live between cloud
      // and customer-env). They render as carded callouts so they
      // read as "ports/wires", not annotations.
      {
        id: "gw_rest",
        type: "textBox",
        x: 60,
        y: 460,
        textBox: {
          text: "REST API\nTCP 8089",
          fontSize: 12,
          color: "#0f172a",
          bold: true,
          italic: false,
          background: "#ffffff",
          border: "1px solid #94a3b8",
          align: "center",
        },
      },
      {
        id: "gw_https",
        type: "textBox",
        x: 290,
        y: 460,
        textBox: {
          text: "HTTP/S\nTCP 443",
          fontSize: 12,
          color: "#0f172a",
          bold: true,
          italic: false,
          background: "#ffffff",
          border: "1px solid #94a3b8",
          align: "center",
        },
      },
      {
        id: "gw_fwd",
        type: "textBox",
        x: 510,
        y: 460,
        textBox: {
          text: "Splunk Forwarder\nTCP 9997 (TLS)",
          fontSize: 12,
          color: "#0f172a",
          bold: true,
          italic: false,
          background: "#ffffff",
          border: "1px solid #94a3b8",
          align: "center",
        },
      },

      // --- Customer Environment ----------------------------------------
      {
        id: "hybrid_sh",
        type: "device:server",
        x: 30,
        y: 60,
        parentId: "g_customer_env",
        label: "Hybrid Search Head (optional)",
        shortLabel: "Hybrid SH",
        vendor: "Splunk",
        model: "Search Head",
      },
      {
        id: "cust_uf",
        type: "device:server",
        x: 230,
        y: 60,
        parentId: "g_customer_env",
        label: "Universal Forwarders",
        shortLabel: "UFs",
        vendor: "Splunk",
        model: "UF",
      },
      {
        id: "cust_network",
        type: "device:cloud",
        x: 360,
        y: 60,
        parentId: "g_customer_env",
        label: "Network / Syslog",
        shortLabel: "Network",
        vendor: "Customer",
        model: "Syslog",
      },
      {
        id: "cust_other",
        type: "device:generic",
        x: 490,
        y: 60,
        parentId: "g_customer_env",
        label: "Other Inputs",
        shortLabel: "Other",
        vendor: "Customer",
        model: "Inputs",
      },
      {
        id: "deploy_server",
        type: "device:server",
        x: 620,
        y: 60,
        parentId: "g_customer_env",
        label: "Deployment Server",
        shortLabel: "DS",
        vendor: "Splunk",
        model: "DS",
      },
    ],
    edges: [
      // Cloud-internal: search heads → indexer cluster.
      // Right edge of each SH → left edge of nearest indexer.
      {
        id: "e_core_sh__idx_az2",
        sourceId: "core_sh",
        targetId: "idx_az2",
        sourceHandle: H.RightSrc,
        targetHandle: H.LeftTgt,
        kind: "physical",
        direction: "forward",
      },
      {
        id: "e_premium_sh__idx_az2",
        sourceId: "premium_sh",
        targetId: "idx_az2",
        sourceHandle: H.RightSrc,
        targetHandle: H.LeftTgt,
        kind: "physical",
        direction: "forward",
      },

      // Indexer ↔ Indexer replication (bidirectional, dashed-feel
      // captured via the synthetic_a2a kind).
      {
        id: "e_az1__az2",
        sourceId: "idx_az1",
        targetId: "idx_az2",
        sourceHandle: H.BottomSrc,
        targetHandle: H.TopTgt,
        kind: "synthetic_a2a",
        direction: "both",
      },
      {
        id: "e_az1__az3",
        sourceId: "idx_az1",
        targetId: "idx_az3",
        sourceHandle: H.BottomSrc,
        targetHandle: H.TopTgt,
        kind: "synthetic_a2a",
        direction: "both",
      },
      {
        id: "e_az2__az3",
        sourceId: "idx_az2",
        targetId: "idx_az3",
        sourceHandle: H.RightSrc,
        targetHandle: H.LeftTgt,
        kind: "synthetic_a2a",
        direction: "both",
      },

      // Inputs Data Manager → Indexer (AZ3, the closest one).
      {
        id: "e_idm__az3",
        sourceId: "inputs_dm",
        targetId: "idx_az3",
        sourceHandle: H.LeftSrc,
        targetHandle: H.RightTgt,
        kind: "physical",
        direction: "forward",
      },

      // Cloud → gateways → indexer-cluster ingress.
      // Each gateway is a textbox with no handles, so we route
      // gateway edges by setting source = cloud component and
      // target = customer side, and let React Flow's default
      // top/bottom routing draw the wires through the gateway
      // boxes visually (they sit between source and target,
      // overlapping the line).
      //
      // REST API (8089): Hybrid SH ↑ Cloud (Core SH read path).
      {
        id: "e_hybrid_sh__core_sh",
        sourceId: "hybrid_sh",
        targetId: "core_sh",
        sourceHandle: H.TopSrc,
        targetHandle: H.BottomTgt,
        kind: "physical",
        direction: "forward",
        label: "REST 8089",
      },

      // HTTP/S (443): Customer Network ↑ HEC LB.
      {
        id: "e_cust_network__hec_lb",
        sourceId: "cust_network",
        targetId: "hec_lb",
        sourceHandle: H.TopSrc,
        targetHandle: H.BottomTgt,
        kind: "physical",
        direction: "forward",
        label: "HEC 443",
      },

      // Splunk Forwarder (9997 TLS): UFs / Other ↑ Indexers.
      {
        id: "e_cust_uf__az2",
        sourceId: "cust_uf",
        targetId: "idx_az2",
        sourceHandle: H.TopSrc,
        targetHandle: H.BottomTgt,
        kind: "physical",
        direction: "forward",
        label: "TCP 9997",
      },
      {
        id: "e_cust_other__az3",
        sourceId: "cust_other",
        targetId: "idx_az3",
        sourceHandle: H.TopSrc,
        targetHandle: H.BottomTgt,
        kind: "physical",
        direction: "forward",
        label: "TCP 9997",
      },

      // Deployment Server fans out to UFs / Network / Other.
      {
        id: "e_ds__uf",
        sourceId: "deploy_server",
        targetId: "cust_uf",
        sourceHandle: H.LeftSrc,
        targetHandle: H.RightTgt,
        kind: "logical",
        direction: "forward",
      },
      {
        id: "e_ds__network",
        sourceId: "deploy_server",
        targetId: "cust_network",
        sourceHandle: H.LeftSrc,
        targetHandle: H.RightTgt,
        kind: "logical",
        direction: "forward",
      },
      {
        id: "e_ds__other",
        sourceId: "deploy_server",
        targetId: "cust_other",
        sourceHandle: H.LeftSrc,
        targetHandle: H.RightTgt,
        kind: "logical",
        direction: "forward",
      },
    ],
  },
};

// =====================================================================
// --- Build 115.6 — Splunk reference architecture diagram catalogue ---
// =====================================================================
//
// The user provided a set of canonical Splunk deployment-architecture
// diagrams (S1, C1/C11, C3/C13, D1/D11, M2/M12, M3/M13, M4/M14, plus
// HEC / DCN / Kafka+HEC / Intermediary Forwarding / Collection
// Overview). Each one is a starting template operators can drop onto
// the canvas, customise (rename hosts, bind to live indexers, recolor
// edges), and save under their own name.
//
// Layout convention — every diagram (except multi-site M*) uses the
// same 4-column tier layout:
//
//       0          280         580         820
//   ┌─────────┬───────────────┬───────────┬─────────────┐
//   │ Search  │   Indexing    │ Collection│ Management  │
//   │ Tier    │   Tier        │ Tier      │ (CM/LM/MC)  │
//   │ green   │   sky          │ rose      │ violet      │
//   └─────────┴───────────────┴───────────┴─────────────┘
//
// Multi-site diagrams instead use a "Site A | Site N" split with
// the Management column on the far right.
//
// --- Builder helpers ------------------------------------------------

/** Standardised tier accent colours. Aligned with the Splunk
 *  Validated Architecture (SVA) colour scheme used in the user's
 *  reference screenshots. */
const ACCENT = {
  search: "emerald-500",
  indexing: "sky-500",
  collection: "rose-500",
  management: "violet-500",
  siteA: "sky-500",
  siteN: "sky-500",
  kafka: "amber-500",
  customer: "slate-500",
};

/** Region builder — keep coordinates explicit so each diagram's
 *  `git diff` reads as a coordinate change, not a builder-state
 *  mutation. */
const region = (id, label, x, y, width, height, accent) => ({
  id,
  label,
  x,
  y,
  width,
  height,
  accent,
});

/** Device-node builder. Defaults `Splunk` as the vendor because
 *  every node in these reference diagrams is part of the Splunk
 *  software fabric. Set `vendor` explicitly when overriding. */
const device = (
  id,
  type,
  parentId,
  x,
  y,
  label,
  shortLabel,
  model,
  vendor = "Splunk",
) => ({
  id,
  type,
  parentId,
  x,
  y,
  label,
  shortLabel,
  vendor,
  model,
});

/** OOB diagrams should use the same Splunk-specific palette shapes
 *  operators get when they drag from the left rail. This keeps
 *  seeded Splunk roles out of generic server/database silhouettes
 *  while still leaving true databases as `device:database`. */
const normalizeSplunkDeviceType = (node) => {
  if (typeof node.type !== "string" || !node.type.startsWith("device:")) {
    return;
  }
  if (node.type.startsWith("device:splunk_")) {
    return;
  }

  const text = [node.id, node.label, node.shortLabel, node.model]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (text.includes("shc deployer") || text.includes("shc-d")) {
    node.type = "device:splunk_deployer";
  } else if (text.includes("deployment server") || /\bds\b/.test(text)) {
    node.type = "device:splunk_deployment_server";
  } else if (text.includes("license manager") || /\blm\b/.test(text)) {
    node.type = "device:splunk_license_manager";
  } else if (text.includes("monitoring console") || /\bmc\b/.test(text)) {
    node.type = "device:splunk_monitoring_console";
  } else if (text.includes("cluster manager") || /\bcm\b/.test(text)) {
    node.type = "device:splunk_cluster_manager";
  } else if (text.includes("indexer")) {
    node.type = "device:splunk_indexer";
  } else if (
    text.includes("search head") ||
    text.includes("shc member") ||
    text.includes("shc captain") ||
    /\bsh\d?\b/.test(text)
  ) {
    node.type = "device:splunk_search_head";
  } else if (
    text.includes("heavy forwarder") ||
    text.includes("intermediary forwarder") ||
    /\bhwf\b/.test(text)
  ) {
    node.type = "device:splunk_heavy_forwarder";
  } else if (
    text.includes("universal forwarder") ||
    text.includes("endpoint uf") ||
    text.includes("forwarders") ||
    /\bufs?\b/.test(text)
  ) {
    node.type = "device:splunk_universal_forwarder";
  } else if (text.includes("data collection node")) {
    node.type = "device:splunk_data_collection";
  } else if (
    text.includes("splunk connect for syslog") ||
    text.includes("sc4s")
  ) {
    node.type = "device:splunk_sc4s";
  }
};

/** Edge builder. Defaults to `physical` + `forward` (most common in
 *  Splunk reference diagrams — collection traffic into the indexer
 *  cluster). Cluster replication (a2a / both) overrides via the
 *  `kind` / `direction` opts. */
const edge = (
  id,
  sourceId,
  targetId,
  sourceHandle,
  targetHandle,
  opts = {},
) => ({
  id,
  sourceId,
  targetId,
  sourceHandle,
  targetHandle,
  kind: opts.kind ?? "physical",
  direction: opts.direction ?? "forward",
  ...(opts.label ? { label: opts.label } : {}),
  ...(opts.lineColor ? { lineColor: opts.lineColor } : {}),
  ...(opts.animationColor ? { animationColor: opts.animationColor } : {}),
});

/** Title-node builder. Centred over the Search tier by default;
 *  callers override `x` / `y` for multi-site diagrams. */
const title = (text, x = 40, y = -50, color = "#0369a1") => ({
  text,
  x,
  y,
  fontSize: 26,
  color,
  bold: true,
  italic: false,
});

/** Builds the canonical "Collection Tier" trio (Forwarders /
 *  Network / Other) shared by S1, C1/C11, C3/C13, D1/D11, M2/M12,
 *  M3/M13, M4/M14. Returns the three nodes; caller is responsible
 *  for the parent region and the indexer-side edges. */
const collectionTrio = (parentId, baseX = 30, baseY = 60) => [
  device(
    "fwd",
    "device:splunk_universal_forwarder",
    parentId,
    baseX,
    baseY,
    "Forwarders",
    "UFs",
    "UF / HF",
  ),
  device(
    "net_inputs",
    "device:cloud",
    parentId,
    baseX + 130,
    baseY,
    "Network Inputs",
    "Network",
    "Syslog / TCP / UDP",
  ),
  device(
    "other_inputs",
    "device:generic",
    parentId,
    baseX + 260,
    baseY,
    "Other Inputs",
    "Other",
    "API / DB / scripts",
  ),
];

/** Builds the canonical "Management" stack (DS / LM / MC / CM,
 *  plus optional SHC-D). Returns the nodes laid out vertically so
 *  the Management region reads as a column. */
const managementStack = (
  parentId,
  includeShcD = false,
  baseX = 30,
  baseY = 30,
) => {
  const nodes = [
    device(
      "ds",
      "device:splunk_deployment_server",
      parentId,
      baseX,
      baseY,
      "Deployment Server",
      "DS",
      "DS",
    ),
    device(
      "lm",
      "device:splunk_license_manager",
      parentId,
      baseX,
      baseY + 130,
      "License Manager",
      "LM",
      "LM",
    ),
    device(
      "mc",
      "device:splunk_monitoring_console",
      parentId,
      baseX,
      baseY + 260,
      "Monitoring Console",
      "MC",
      "MC",
    ),
    device(
      "cm",
      "device:splunk_cluster_manager",
      parentId,
      baseX,
      baseY + 390,
      "Cluster Manager",
      "CM",
      "CM",
    ),
  ];
  if (includeShcD) {
    nodes.push(
      device(
        "shc_d",
        "device:splunk_deployer",
        parentId,
        baseX,
        baseY + 520,
        "SHC Deployer",
        "SHC-D",
        "SHC-D",
      ),
    );
  }
  return nodes;
};

const ciscoDevice = (
  id,
  type,
  parentId,
  x,
  y,
  label,
  shortLabel,
  model,
  vendor = "Cisco",
) => device(id, type, parentId, x, y, label, shortLabel, model, vendor);

const shapeGallerySections = [
  {
    id: "g_gallery_core",
    label: "Core Network",
    accent: ACCENT.indexing,
    shapes: [
      ["router", "Router"],
      ["switch", "L2 Switch"],
      ["l3_switch", "L3 Switch"],
      ["stack", "Switch Stack"],
      ["hub", "Hub"],
      ["gateway", "Gateway"],
      ["proxy", "Proxy"],
      ["wlc", "WLC"],
      ["access_point", "Access Point"],
      ["load_balancer", "Load Balancer"],
    ],
  },
  {
    id: "g_gallery_advanced",
    label: "Advanced Network",
    accent: "indigo-500",
    shapes: [
      ["modular_chassis_switch", "Modular Chassis"],
      ["nexus_aci_fabric", "Nexus / ACI Fabric"],
      ["sdwan_controller", "SD-WAN Controller"],
      ["f5_load_balancer", "F5 Load Balancer"],
    ],
  },
  {
    id: "g_gallery_security",
    label: "Security",
    accent: ACCENT.collection,
    shapes: [
      ["firewall", "Firewall"],
      ["palo_alto_firewall", "Palo Alto Firewall"],
      ["fortinet_firewall", "Fortinet Firewall"],
      ["waf", "WAF"],
      ["vpn_concentrator", "VPN"],
      ["ids_ips", "IDS / IPS"],
      ["siem", "SIEM"],
      ["ca", "Certificate Authority"],
      ["bastion", "Bastion"],
    ],
  },
  {
    id: "g_gallery_infra",
    label: "Servers & Infrastructure",
    accent: ACCENT.search,
    shapes: [
      ["server", "Server"],
      ["web_server", "Web Server"],
      ["app_server", "App Server"],
      ["dns_server", "DNS Server"],
      ["dhcp_server", "DHCP Server"],
      ["mainframe", "Mainframe"],
      ["container", "Container"],
      ["vm", "VM"],
      ["database", "Database"],
    ],
  },
  {
    id: "g_gallery_storage",
    label: "Storage",
    accent: "amber-500",
    shapes: [
      ["storage", "Storage"],
      ["nas", "NAS"],
      ["san", "SAN"],
      ["backup", "Backup"],
    ],
  },
  {
    id: "g_gallery_enduser",
    label: "End-User & IoT",
    accent: "pink-500",
    shapes: [
      ["laptop", "Laptop"],
      ["mobile_phone", "Mobile Phone"],
      ["ip_phone", "IP Phone"],
      ["printer", "Printer"],
      ["camera", "Camera"],
      ["iot_sensor", "IoT Sensor"],
    ],
  },
  {
    id: "g_gallery_edge",
    label: "Edge & Cloud",
    accent: ACCENT.customer,
    shapes: [
      ["cloud", "Cloud / WAN"],
      ["internet", "Internet"],
      ["users", "Users"],
    ],
  },
  {
    id: "g_gallery_splunk",
    label: "Splunk Architecture",
    accent: ACCENT.management,
    shapes: [
      ["splunk_search_head", "Search Head"],
      ["splunk_search_head_cluster", "SH Cluster"],
      ["splunk_indexer", "Indexer"],
      ["splunk_indexer_cluster", "Indexer Cluster"],
      ["splunk_heavy_forwarder", "Heavy Forwarder"],
      ["splunk_universal_forwarder", "Universal Forwarder"],
      ["splunk_cluster_manager", "Cluster Manager"],
      ["splunk_deployer", "SHC Deployer"],
      ["splunk_license_manager", "License Manager"],
      ["splunk_monitoring_console", "Monitoring Console"],
      ["splunk_deployment_server", "Deployment Server"],
      ["splunk_data_collection", "Data Collection"],
      ["splunk_edge_processor", "Edge Processor"],
      ["splunk_sc4s", "SC4S"],
    ],
  },
  {
    id: "g_gallery_places",
    label: "Places & Layout",
    accent: "slate-500",
    shapes: [
      ["branch_office", "Branch Office"],
      ["datacenter", "Data Center"],
      ["generic", "Generic"],
    ],
  },
];

const shapeGalleryShortLabel = (label) =>
  label.length > 14 ? `${label.slice(0, 12)}...` : label;

const buildShapeGalleryPayload = () => {
  const groups = [];
  const nodes = [];
  const maxRowWidth = 1760;
  const gapX = 40;
  const gapY = 60;
  const cellW = 150;
  const cellH = 160;
  const colsMax = 5;
  let x = 20;
  let y = 80;
  let rowHeight = 0;

  for (const section of shapeGallerySections) {
    const cols = Math.min(colsMax, section.shapes.length);
    const rows = Math.ceil(section.shapes.length / cols);
    const width = Math.max(340, 80 + cols * cellW);
    const height = 80 + rows * cellH;
    if (x > 20 && x + width > maxRowWidth) {
      x = 20;
      y += rowHeight + gapY;
      rowHeight = 0;
    }

    groups.push(
      region(section.id, section.label, x, y, width, height, section.accent),
    );

    section.shapes.forEach(([shape, label], index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      nodes.push(
        device(
          `gallery_${shape}`,
          `device:${shape}`,
          section.id,
          40 + col * cellW,
          60 + row * cellH,
          label,
          shapeGalleryShortLabel(label),
          shape,
          "Shape Gallery",
        ),
      );
    });

    x += width + gapX;
    rowHeight = Math.max(rowHeight, height);
  }

  nodes.push({
    id: "gallery_textbox",
    type: "textBox",
    parentId: "g_gallery_places",
    x: 490,
    y: 60,
    textBox: {
      text: "Text Box",
      fontSize: 16,
      color: "#0f172a",
      bold: true,
      italic: false,
      background: "#ffffff",
      border: "1px solid #94a3b8",
      align: "center",
    },
  });

  return {
    version: 1,
    title: title("Shape Gallery - All Shapes", 40, -50, "#075985"),
    groups,
    nodes,
    edges: [],
  };
};

const shapeGalleryDiagram = {
  name: "Shape Gallery - All Shapes",
  description:
    "Reference gallery showing every available Network Diagram shape.",
  payload: buildShapeGalleryPayload(),
};

const buildCiscoLive2026EventArchitecturePayload = () => ({
  version: 1,
  title: title("Cisco Live 2026 Event Architecture", 40, -50, "#1d4ed8"),
  groups: [
    region("g_wan", "Rack 3 — WAN Edge", 20, 80, 280, 330, ACCENT.collection),
    region(
      "g_core",
      "Racks 1 & 2 — CORE 1 (HA pair)",
      330,
      80,
      320,
      330,
      ACCENT.indexing,
    ),
    region("g_dc", "Racks 4 & 5 — DC 1 & 2", 20, 470, 630, 260, ACCENT.search),
    region(
      "g_obs",
      "Rack 6 — Observability",
      680,
      80,
      280,
      330,
      ACCENT.management,
    ),
  ],
  nodes: [
    ciscoDevice(
      "wan_edge_rtr",
      "device:router",
      "g_wan",
      40,
      50,
      "C8500-20XGC / 20X6C",
      "C8500 Edge",
      "20XGC / 20X6C",
    ),
    ciscoDevice(
      "wan_edge_fw",
      "device:firewall",
      "g_wan",
      145,
      155,
      "FTD 3110",
      "FTD 3110",
      "WAN edge firewall",
    ),
    ciscoDevice(
      "wan_wlc",
      "device:wlc",
      "g_wan",
      40,
      210,
      "9800 WLCs",
      "9800 WLCs",
      "Wireless controllers",
    ),

    ciscoDevice(
      "core_switching",
      "device:modular_chassis_switch",
      "g_core",
      40,
      50,
      "9500X + 9606R",
      "9500X + 9606R",
      "Core HA pair",
    ),
    ciscoDevice(
      "core_wlc",
      "device:wlc",
      "g_core",
      195,
      50,
      "9800-40 / 9800-80 WLC",
      "9800 WLCs",
      "9800-40 / 9800-80",
    ),
    ciscoDevice(
      "core_perim_fw",
      "device:firewall",
      "g_core",
      115,
      185,
      "FMC + FTD 4245",
      "FMC + FTD",
      "Perimeter firewall HA",
    ),

    ciscoDevice(
      "dc_fw",
      "device:firewall",
      "g_dc",
      40,
      65,
      "FTD 4245",
      "FTD 4245",
      "DC firewalls",
    ),
    ciscoDevice(
      "dc_nexus",
      "device:nexus_aci_fabric",
      "g_dc",
      185,
      65,
      "Nexus 9504 / 9336C",
      "Nexus Fabric",
      "9504 / 9336C",
    ),
    ciscoDevice(
      "dc_ucs",
      "device:server",
      "g_dc",
      350,
      65,
      "UCS X-Series + FI 6536",
      "UCS + FI",
      "X-Series + FI 6536",
    ),
    ciscoDevice(
      "dc_storage",
      "device:storage",
      "g_dc",
      500,
      65,
      "NetApp / FlexPod AI",
      "FlexPod AI",
      "NetApp / FlexPod AI",
    ),

    ciscoDevice(
      "obs_edge_hub",
      "device:splunk_edge_processor",
      "g_obs",
      90,
      50,
      "Splunk Edge Hub",
      "Edge Hub",
      "Telemetry aggregation",
      "Splunk",
    ),
    ciscoDevice(
      "obs_cat_center",
      "device:app_server",
      "g_obs",
      40,
      180,
      "Catalyst Center",
      "Cat Center",
      "Network assurance",
    ),
    ciscoDevice(
      "obs_ndb",
      "device:hub",
      "g_obs",
      170,
      180,
      "Nexus Dashboard Data Broker",
      "Nexus DB",
      "Data Broker",
    ),
    device(
      "splunk_briefing",
      "device:splunk_monitoring_console",
      undefined,
      745,
      560,
      "Splunk + Executive Briefing",
      "Splunk + Briefing",
      "Splunk App for Secure Networking",
      "Splunk",
    ),
  ],
  edges: [
    edge("e_wan_rtr_fw", "wan_edge_rtr", "wan_edge_fw", H.BottomSrc, H.TopTgt),
    edge("e_wan_wlc_fw", "wan_wlc", "wan_edge_fw", H.RightSrc, H.LeftTgt, {
      kind: "logical",
      label: "Wireless control",
    }),
    edge("e_wan_core", "wan_edge_fw", "core_switching", H.RightSrc, H.LeftTgt, {
      label: "WAN to Core",
    }),
    edge(
      "e_core_wlc_switch",
      "core_wlc",
      "core_switching",
      H.LeftSrc,
      H.RightTgt,
      {
        kind: "logical",
      },
    ),
    edge(
      "e_core_switch_fw",
      "core_switching",
      "core_perim_fw",
      H.BottomSrc,
      H.TopTgt,
    ),
    edge("e_core_dc", "core_perim_fw", "dc_fw", H.BottomSrc, H.TopTgt, {
      label: "DC path",
    }),
    edge("e_dc_fw_nexus", "dc_fw", "dc_nexus", H.RightSrc, H.LeftTgt),
    edge("e_dc_nexus_ucs", "dc_nexus", "dc_ucs", H.RightSrc, H.LeftTgt),
    edge("e_dc_ucs_storage", "dc_ucs", "dc_storage", H.RightSrc, H.LeftTgt),
    edge(
      "e_core_obs",
      "core_switching",
      "obs_cat_center",
      H.RightSrc,
      H.LeftTgt,
      {
        kind: "logical",
        label: "Core telemetry",
      },
    ),
    edge("e_wan_obs", "wan_edge_fw", "obs_edge_hub", H.RightSrc, H.LeftTgt, {
      kind: "logical",
      label: "WAN telemetry",
    }),
    edge("e_dc_obs", "dc_nexus", "obs_ndb", H.RightSrc, H.LeftTgt, {
      kind: "logical",
      label: "Fabric telemetry",
    }),
    edge(
      "e_cat_center_edge_hub",
      "obs_cat_center",
      "obs_edge_hub",
      H.TopSrc,
      H.BottomTgt,
      {
        kind: "logical",
        label: "Assurance API",
      },
    ),
    edge("e_ndb_edge_hub", "obs_ndb", "obs_edge_hub", H.LeftSrc, H.RightTgt, {
      kind: "logical",
      label: "Brokered telemetry",
    }),
    edge(
      "e_obs_splunk",
      "obs_edge_hub",
      "splunk_briefing",
      H.BottomSrc,
      H.TopTgt,
      {
        kind: "logical",
        label: "Splunk telemetry",
      },
    ),
  ],
});


const ciscoLive2026EventArchitecture = {
  name: "Cisco Live 2026 Event Architecture",
  description:
    "Cisco Live 2026 event topology — WAN edge, Core HA, DC pair, Rack 6 observability, and Splunk Executive Briefing.",
  payload: buildCiscoLive2026EventArchitecturePayload(),
  legacyDetailedPayload: {
    version: 1,
    title: title("Cisco Live 2026 Event Architecture", 40, -50, "#1d4ed8"),
    groups: [
      region("g_wan", "RACK 3 — WAN Edge", 20, 80, 480, 420, ACCENT.collection),
      region(
        "g_core",
        "RACKS 1 & 2 — CORE (redundant pair)",
        540,
        80,
        520,
        480,
        ACCENT.indexing,
      ),
      region(
        "g_dc1",
        "RACK 4 — Data Center 1",
        20,
        560,
        500,
        420,
        ACCENT.search,
      ),
      region(
        "g_dc2",
        "RACK 5 — Data Center 2 (mirror)",
        560,
        560,
        500,
        420,
        ACCENT.search,
      ),
      region(
        "g_mgmt",
        "RACK 6 — Observability / Management",
        1100,
        80,
        440,
        900,
        ACCENT.management,
      ),
    ],
    nodes: [
      // WAN edge
      ciscoDevice(
        "wan_internet",
        "device:internet",
        "g_wan",
        40,
        40,
        "Internet / Carrier",
        "Internet",
        "WAN uplink",
      ),
      ciscoDevice(
        "wan_c8500_xgc",
        "device:router",
        "g_wan",
        40,
        180,
        "Catalyst C8500-20XGC",
        "C8500-XGC",
        "Edge platform",
      ),
      ciscoDevice(
        "wan_c8500_x6c",
        "device:router",
        "g_wan",
        240,
        180,
        "Catalyst C8500-20X6C",
        "C8500-X6C",
        "Edge platform",
      ),
      ciscoDevice(
        "wan_fw3110",
        "device:firewall",
        "g_wan",
        140,
        300,
        "Secure Firewall 3110",
        "FW 3110",
        "WAN firewall",
      ),
      ciscoDevice(
        "wan_wlc40",
        "device:wlc",
        "g_wan",
        40,
        300,
        "Catalyst 9800-40 WLC",
        "9800-40",
        "Wireless controller",
      ),
      ciscoDevice(
        "wan_wlc80",
        "device:wlc",
        "g_wan",
        300,
        300,
        "Catalyst 9800-80 WLC",
        "9800-80",
        "Wireless controller",
      ),
      ciscoDevice(
        "venue_aps",
        "device:access_point",
        "g_wan",
        140,
        40,
        "Venue Wireless APs",
        "Venue APs",
        "Inherited AP fleet",
      ),

      // Core (redundant pair)
      ciscoDevice(
        "core_9606r",
        "device:modular_chassis_switch",
        "g_core",
        40,
        60,
        "Catalyst 9606R (C9600X-SUP-2)",
        "9606R",
        "Core chassis",
      ),
      ciscoDevice(
        "core_9500x",
        "device:l3_switch",
        "g_core",
        280,
        60,
        "Catalyst 9500X-60L4D",
        "9500X",
        "Core switch",
      ),
      ciscoDevice(
        "core_fw4245",
        "device:firewall",
        "g_core",
        160,
        220,
        "Secure Firewall 4245",
        "FW 4245",
        "Core firewall pair",
      ),
      ciscoDevice(
        "core_fmc",
        "device:server",
        "g_core",
        40,
        220,
        "Secure Firewall FMC",
        "FMC",
        "Firewall management",
      ),
      ciscoDevice(
        "core_wlc40",
        "device:wlc",
        "g_core",
        40,
        360,
        "Catalyst 9800-40 WLC",
        "9800-40",
        "Wireless controller",
      ),
      ciscoDevice(
        "core_wlc80",
        "device:wlc",
        "g_core",
        280,
        360,
        "Catalyst 9800-80 WLC",
        "9800-80",
        "Wireless controller",
      ),

      // Data Center 1
      ciscoDevice(
        "dc1_fw4245",
        "device:firewall",
        "g_dc1",
        40,
        40,
        "Secure Firewall 4245",
        "FW 4245",
        "DC edge firewall",
      ),
      ciscoDevice(
        "dc1_n9504",
        "device:modular_chassis_switch",
        "g_dc1",
        240,
        40,
        "Nexus 9504 Switch",
        "N9504",
        "DC spine",
      ),
      ciscoDevice(
        "dc1_n9336",
        "device:nexus_aci_fabric",
        "g_dc1",
        40,
        180,
        "Nexus 9336C-FX2",
        "N9336C",
        "Leaf switch",
      ),
      ciscoDevice(
        "dc1_ucs_fi",
        "device:server",
        "g_dc1",
        240,
        180,
        "UCS 6536 Fabric Interconnect",
        "UCS FI",
        "Fabric interconnect",
      ),
      ciscoDevice(
        "dc1_ucs_x",
        "device:server",
        "g_dc1",
        40,
        300,
        "UCS X-Series (X440p PCIe Node)",
        "UCS X440p",
        "Compute node",
      ),
      ciscoDevice(
        "dc1_netapp",
        "device:storage",
        "g_dc1",
        240,
        300,
        "NetApp Storage",
        "NetApp",
        "Shared storage",
      ),
      ciscoDevice(
        "dc1_flexpod_ai",
        "device:container",
        "g_dc1",
        140,
        300,
        "FlexPod AI",
        "FlexPod AI",
        "AI workload stack",
      ),

      // Data Center 2 (mirror)
      ciscoDevice(
        "dc2_fw4245",
        "device:firewall",
        "g_dc2",
        40,
        40,
        "Secure Firewall 4245",
        "FW 4245",
        "DC edge firewall",
      ),
      ciscoDevice(
        "dc2_n9504",
        "device:modular_chassis_switch",
        "g_dc2",
        240,
        40,
        "Nexus 9504 Switch",
        "N9504",
        "DC spine",
      ),
      ciscoDevice(
        "dc2_n9336",
        "device:nexus_aci_fabric",
        "g_dc2",
        40,
        180,
        "Nexus 9336C-FX2",
        "N9336C",
        "Leaf switch",
      ),
      ciscoDevice(
        "dc2_ucs_fi",
        "device:server",
        "g_dc2",
        240,
        180,
        "UCS 6536 Fabric Interconnect",
        "UCS FI",
        "Fabric interconnect",
      ),
      ciscoDevice(
        "dc2_ucs_x",
        "device:server",
        "g_dc2",
        40,
        300,
        "UCS X-Series (X440p PCIe Node)",
        "UCS X440p",
        "Compute node",
      ),
      ciscoDevice(
        "dc2_netapp",
        "device:storage",
        "g_dc2",
        240,
        300,
        "NetApp Storage",
        "NetApp",
        "Shared storage",
      ),
      ciscoDevice(
        "dc2_flexpod_ai",
        "device:container",
        "g_dc2",
        140,
        300,
        "FlexPod AI",
        "FlexPod AI",
        "AI workload stack",
      ),

      // Observability / Management
      ciscoDevice(
        "mgmt_n93180",
        "device:l3_switch",
        "g_mgmt",
        40,
        40,
        "Nexus 93180YC-FX",
        "N93180",
        "Mgmt fabric",
      ),
      ciscoDevice(
        "mgmt_splunk_edge",
        "device:splunk_edge_processor",
        "g_mgmt",
        40,
        200,
        "Splunk Edge Hub",
        "Edge Hub",
        "Telemetry aggregation",
        "Splunk",
      ),
      ciscoDevice(
        "mgmt_c220_1",
        "device:server",
        "g_mgmt",
        240,
        200,
        "UCS C220 M5 Rack Server",
        "C220 #1",
        "App server",
      ),
      ciscoDevice(
        "mgmt_c220_2",
        "device:server",
        "g_mgmt",
        240,
        340,
        "UCS C220 M5 Rack Server",
        "C220 #2",
        "App server",
      ),
      ciscoDevice(
        "mgmt_catalyst_center",
        "device:app_server",
        "g_mgmt",
        40,
        340,
        "Catalyst Center Appliance",
        "Cat Center",
        "Network assurance",
      ),
      ciscoDevice(
        "mgmt_fw3110",
        "device:firewall",
        "g_mgmt",
        40,
        480,
        "Secure Firewall 3110",
        "FW 3110",
        "Mgmt perimeter",
      ),
      ciscoDevice(
        "mgmt_nexus_dash",
        "device:hub",
        "g_mgmt",
        240,
        480,
        "Nexus Dashboard Data Broker",
        "NDDB",
        "Streaming telemetry broker",
      ),
      {
        id: "venue_wireless_note",
        type: "textBox",
        parentId: "g_wan",
        x: 300,
        y: 40,
        textBox: {
          text: "Venue wireless\n(inherited APs)",
          fontSize: 11,
          color: "#475569",
          bold: false,
          italic: true,
          background: "#f8fafc",
          border: "1px dashed #94a3b8",
          align: "center",
        },
      },
    ],
    edges: [
      // WAN ingress
      edge(
        "e_inet_c8500_xgc",
        "wan_internet",
        "wan_c8500_xgc",
        H.BottomSrc,
        H.TopTgt,
      ),
      edge(
        "e_inet_c8500_x6c",
        "wan_internet",
        "wan_c8500_x6c",
        H.BottomSrc,
        H.TopTgt,
      ),
      edge(
        "e_c8500_xgc_fw",
        "wan_c8500_xgc",
        "wan_fw3110",
        H.BottomSrc,
        H.TopTgt,
      ),
      edge(
        "e_c8500_x6c_fw",
        "wan_c8500_x6c",
        "wan_fw3110",
        H.BottomSrc,
        H.TopTgt,
      ),
      edge("e_wan_fw_core", "wan_fw3110", "core_9606r", H.RightSrc, H.LeftTgt, {
        label: "Core uplink",
      }),
      edge("e_wan_fw_core2", "wan_fw3110", "core_9500x", H.RightSrc, H.LeftTgt),

      // Core fabric
      edge("e_core_stack", "core_9606r", "core_9500x", H.RightSrc, H.LeftTgt, {
        kind: "synthetic_a2a",
        direction: "both",
        label: "Redundant core",
      }),
      edge("e_core_fw4245", "core_9606r", "core_fw4245", H.BottomSrc, H.TopTgt),
      edge("e_core_fmc_fw", "core_fmc", "core_fw4245", H.RightSrc, H.LeftTgt, {
        kind: "logical",
        label: "Policy mgmt",
      }),
      edge(
        "e_core_to_dc1",
        "core_fw4245",
        "dc1_fw4245",
        H.BottomSrc,
        H.TopTgt,
        {
          label: "DC1 path",
        },
      ),
      edge(
        "e_core_to_dc2",
        "core_fw4245",
        "dc2_fw4245",
        H.BottomSrc,
        H.TopTgt,
        {
          label: "DC2 path",
        },
      ),

      // Wireless (venue APs → WLCs, dashed logical)
      edge("e_aps_wan_wlc40", "venue_aps", "wan_wlc40", H.BottomSrc, H.TopTgt, {
        kind: "logical",
        label: "CAPWAP",
      }),
      edge("e_aps_wan_wlc80", "venue_aps", "wan_wlc80", H.BottomSrc, H.TopTgt, {
        kind: "logical",
      }),
      edge(
        "e_aps_core_wlc40",
        "venue_aps",
        "core_wlc40",
        H.RightSrc,
        H.LeftTgt,
        {
          kind: "logical",
        },
      ),
      edge(
        "e_aps_core_wlc80",
        "venue_aps",
        "core_wlc80",
        H.RightSrc,
        H.LeftTgt,
        {
          kind: "logical",
        },
      ),

      // DC1 fabric
      edge("e_dc1_fw_spine", "dc1_fw4245", "dc1_n9504", H.RightSrc, H.LeftTgt),
      edge("e_dc1_spine_leaf", "dc1_n9504", "dc1_n9336", H.BottomSrc, H.TopTgt),
      edge("e_dc1_leaf_fi", "dc1_n9336", "dc1_ucs_fi", H.RightSrc, H.LeftTgt),
      edge(
        "e_dc1_fi_compute",
        "dc1_ucs_fi",
        "dc1_ucs_x",
        H.BottomSrc,
        H.TopTgt,
      ),
      edge(
        "e_dc1_fi_storage",
        "dc1_ucs_fi",
        "dc1_netapp",
        H.BottomSrc,
        H.TopTgt,
      ),
      edge(
        "e_dc1_compute_ai",
        "dc1_ucs_x",
        "dc1_flexpod_ai",
        H.RightSrc,
        H.LeftTgt,
        {
          kind: "logical",
        },
      ),

      // DC2 fabric (mirror)
      edge("e_dc2_fw_spine", "dc2_fw4245", "dc2_n9504", H.RightSrc, H.LeftTgt),
      edge("e_dc2_spine_leaf", "dc2_n9504", "dc2_n9336", H.BottomSrc, H.TopTgt),
      edge("e_dc2_leaf_fi", "dc2_n9336", "dc2_ucs_fi", H.RightSrc, H.LeftTgt),
      edge(
        "e_dc2_fi_compute",
        "dc2_ucs_fi",
        "dc2_ucs_x",
        H.BottomSrc,
        H.TopTgt,
      ),
      edge(
        "e_dc2_fi_storage",
        "dc2_ucs_fi",
        "dc2_netapp",
        H.BottomSrc,
        H.TopTgt,
      ),
      edge(
        "e_dc2_compute_ai",
        "dc2_ucs_x",
        "dc2_flexpod_ai",
        H.RightSrc,
        H.LeftTgt,
        {
          kind: "logical",
        },
      ),

      // DC replication
      edge(
        "e_dc1_dc2_mirror",
        "dc1_n9504",
        "dc2_n9504",
        H.RightSrc,
        H.LeftTgt,
        {
          kind: "synthetic_a2a",
          direction: "both",
          label: "DC mirror",
        },
      ),

      // Observability telemetry spine
      edge(
        "e_mgmt_fabric_edge",
        "mgmt_n93180",
        "mgmt_splunk_edge",
        H.BottomSrc,
        H.TopTgt,
        {
          kind: "logical",
          label: "Telemetry",
        },
      ),
      edge(
        "e_catcenter_edge",
        "mgmt_catalyst_center",
        "mgmt_splunk_edge",
        H.TopSrc,
        H.BottomTgt,
        {
          kind: "logical",
          label: "Assurance API",
        },
      ),
      edge(
        "e_nddb_edge",
        "mgmt_nexus_dash",
        "mgmt_splunk_edge",
        H.LeftSrc,
        H.RightTgt,
        {
          kind: "logical",
          label: "Streaming",
        },
      ),
      edge(
        "e_core_catcenter",
        "core_9606r",
        "mgmt_catalyst_center",
        H.RightSrc,
        H.LeftTgt,
        {
          kind: "logical",
          label: "SNMP / syslog",
        },
      ),
      edge(
        "e_dc1_nddb",
        "dc1_n9336",
        "mgmt_nexus_dash",
        H.RightSrc,
        H.LeftTgt,
        {
          kind: "logical",
        },
      ),
      edge(
        "e_dc2_nddb",
        "dc2_n9336",
        "mgmt_nexus_dash",
        H.RightSrc,
        H.LeftTgt,
        {
          kind: "logical",
        },
      ),
      edge(
        "e_mgmt_fw_spine",
        "mgmt_fw3110",
        "mgmt_n93180",
        H.TopSrc,
        H.BottomTgt,
      ),
      edge(
        "e_c220_edge",
        "mgmt_c220_1",
        "mgmt_splunk_edge",
        H.LeftSrc,
        H.RightTgt,
        {
          kind: "logical",
        },
      ),
    ],
  },
};

// --- Diagram authors ------------------------------------------------

/** Single Server Deployment (S1) — combined SH/IDX, simple
 *  collection, single DS for management. */
const singleServerDeployment = {
  name: "Single Server Deployment - S1",
  payload: {
    version: 1,
    title: title("Single Server Deployment (S1)"),
    groups: [
      region("g_si", "Search / Indexing Tier", 20, 40, 240, 200, "emerald-500"),
      region("g_coll", "Collection Tier", 20, 280, 480, 200, ACCENT.collection),
      region("g_mgmt", "Management", 540, 40, 200, 440, ACCENT.management),
    ],
    nodes: [
      device(
        "shidx",
        "device:server",
        "g_si",
        60,
        60,
        "SH / IDX",
        "SH/IDX",
        "Standalone",
      ),
      ...collectionTrio("g_coll", 30, 60),
      device(
        "ds",
        "device:server",
        "g_mgmt",
        50,
        60,
        "Deployment Server",
        "DS",
        "DS",
      ),
    ],
    edges: [
      edge("e_fwd_idx", "fwd", "shidx", H.TopSrc, H.BottomTgt, {
        label: "TCP 9997",
      }),
      edge("e_net_idx", "net_inputs", "shidx", H.TopSrc, H.BottomTgt),
      edge("e_other_idx", "other_inputs", "shidx", H.TopSrc, H.BottomTgt),
      edge("e_ds_fwd", "ds", "fwd", H.LeftSrc, H.RightTgt, { kind: "logical" }),
    ],
  },
};

/** Distributed Clustered Single Site (C1 / C11) — single SH, 3-node
 *  indexer cluster, full management stack (no SHC-D). */
const distributedClusteredC1 = {
  name: "Distributed Clustered Single Site - C1 C11",
  payload: {
    version: 1,
    title: title("Distributed Clustered Single Site (C1 / C11)"),
    groups: [
      region("g_search", "Search Tier", 20, 40, 220, 200, ACCENT.search),
      region("g_index", "Indexing Tier", 260, 40, 380, 200, ACCENT.indexing),
      region("g_coll", "Collection Tier", 20, 280, 620, 200, ACCENT.collection),
      region("g_mgmt", "Management", 660, 40, 200, 580, ACCENT.management),
    ],
    nodes: [
      device(
        "sh",
        "device:server",
        "g_search",
        60,
        60,
        "Search Head",
        "SH",
        "Search Head",
      ),
      device(
        "idx1",
        "device:splunk_indexer",
        "g_index",
        30,
        60,
        "Indexer 1",
        "IDX1",
        "Indexer",
      ),
      device(
        "idx2",
        "device:splunk_indexer",
        "g_index",
        140,
        60,
        "Indexer 2",
        "IDX2",
        "Indexer",
      ),
      device(
        "idx3",
        "device:splunk_indexer",
        "g_index",
        250,
        60,
        "Indexer 3",
        "IDX3",
        "Indexer",
      ),
      ...collectionTrio("g_coll", 30, 60),
      ...managementStack("g_mgmt", false),
    ],
    edges: [
      edge("e_sh_idx2", "sh", "idx2", H.RightSrc, H.LeftTgt, {
        kind: "logical",
      }),
      edge("e_idx1_idx2", "idx1", "idx2", H.RightSrc, H.LeftTgt, {
        kind: "synthetic_a2a",
        direction: "both",
      }),
      edge("e_idx2_idx3", "idx2", "idx3", H.RightSrc, H.LeftTgt, {
        kind: "synthetic_a2a",
        direction: "both",
      }),
      edge("e_fwd_idx", "fwd", "idx1", H.TopSrc, H.BottomTgt, {
        label: "TCP 9997",
      }),
      edge("e_net_idx", "net_inputs", "idx2", H.TopSrc, H.BottomTgt),
      edge("e_other_idx", "other_inputs", "idx3", H.TopSrc, H.BottomTgt),
      edge("e_cm_idx2", "cm", "idx2", H.LeftSrc, H.RightTgt, {
        kind: "logical",
      }),
      edge("e_ds_fwd", "ds", "fwd", H.LeftSrc, H.RightTgt, { kind: "logical" }),
    ],
  },
};

/** Distributed Clustered + SHC Single Site (C3 / C13). */
const distributedClusteredShcC3 = {
  name: "Distributed Clustered with SHC Single Site - C3 C13",
  payload: {
    version: 1,
    title: title("Distributed Clustered + SHC Single Site (C3 / C13)"),
    groups: [
      region("g_search", "Search Tier", 20, 40, 380, 200, ACCENT.search),
      region("g_index", "Indexing Tier", 420, 40, 380, 200, ACCENT.indexing),
      region("g_coll", "Collection Tier", 20, 280, 780, 200, ACCENT.collection),
      region("g_mgmt", "Management", 820, 40, 200, 700, ACCENT.management),
    ],
    nodes: [
      device(
        "sh1",
        "device:server",
        "g_search",
        30,
        60,
        "SH (member)",
        "SH1",
        "SHC member",
      ),
      device(
        "sh2",
        "device:server",
        "g_search",
        140,
        60,
        "SH (member)",
        "SH2",
        "SHC member",
      ),
      device(
        "sh3",
        "device:server",
        "g_search",
        250,
        60,
        "SH (member)",
        "SH3",
        "SHC member",
      ),
      device(
        "idx1",
        "device:splunk_indexer",
        "g_index",
        30,
        60,
        "Indexer 1",
        "IDX1",
        "Indexer",
      ),
      device(
        "idx2",
        "device:splunk_indexer",
        "g_index",
        140,
        60,
        "Indexer 2",
        "IDX2",
        "Indexer",
      ),
      device(
        "idx3",
        "device:splunk_indexer",
        "g_index",
        250,
        60,
        "Indexer 3",
        "IDX3",
        "Indexer",
      ),
      ...collectionTrio("g_coll", 30, 60),
      ...managementStack("g_mgmt", true),
    ],
    edges: [
      edge("e_sh1_sh2", "sh1", "sh2", H.RightSrc, H.LeftTgt, {
        kind: "synthetic_a2a",
        direction: "both",
      }),
      edge("e_sh2_sh3", "sh2", "sh3", H.BottomSrc, H.TopTgt, {
        kind: "synthetic_a2a",
        direction: "both",
      }),
      edge("e_sh1_idx2", "sh1", "idx2", H.RightSrc, H.LeftTgt, {
        kind: "logical",
      }),
      edge("e_sh2_idx2", "sh2", "idx2", H.RightSrc, H.LeftTgt, {
        kind: "logical",
      }),
      edge("e_idx1_idx2", "idx1", "idx2", H.RightSrc, H.LeftTgt, {
        kind: "synthetic_a2a",
        direction: "both",
      }),
      edge("e_idx2_idx3", "idx2", "idx3", H.RightSrc, H.LeftTgt, {
        kind: "synthetic_a2a",
        direction: "both",
      }),
      edge("e_fwd_idx", "fwd", "idx1", H.TopSrc, H.BottomTgt, {
        label: "TCP 9997",
      }),
      edge("e_net_idx", "net_inputs", "idx2", H.TopSrc, H.BottomTgt),
      edge("e_other_idx", "other_inputs", "idx3", H.TopSrc, H.BottomTgt),
      edge("e_cm_idx2", "cm", "idx2", H.LeftSrc, H.RightTgt, {
        kind: "logical",
      }),
      edge("e_shcd_sh1", "shc_d", "sh1", H.LeftSrc, H.RightTgt, {
        kind: "logical",
      }),
      edge("e_ds_fwd", "ds", "fwd", H.LeftSrc, H.RightTgt, { kind: "logical" }),
    ],
  },
};

/** Distributed Non-Clustered (D1 / D11). Multiple standalone SHs
 *  plus 3 independent indexers (no replication factor). */
const distributedNonClusteredD1 = {
  name: "Distributed Non-Clustered - D1 D11",
  payload: {
    version: 1,
    title: title("Distributed Non-Clustered (D1 / D11)"),
    groups: [
      region("g_search", "Search Tier", 20, 40, 320, 200, ACCENT.search),
      region("g_index", "Indexing Tier", 360, 40, 380, 200, ACCENT.indexing),
      region("g_coll", "Collection Tier", 20, 280, 720, 200, ACCENT.collection),
      region("g_mgmt", "Management", 760, 40, 200, 700, ACCENT.management),
    ],
    nodes: [
      device(
        "sh1",
        "device:server",
        "g_search",
        30,
        60,
        "Search Head",
        "SH1",
        "Standalone SH",
      ),
      device(
        "sh2",
        "device:server",
        "g_search",
        200,
        60,
        "Search Head",
        "SH2",
        "Standalone SH",
      ),
      device(
        "idx1",
        "device:splunk_indexer",
        "g_index",
        30,
        60,
        "Indexer 1",
        "IDX1",
        "Standalone",
      ),
      device(
        "idx2",
        "device:splunk_indexer",
        "g_index",
        140,
        60,
        "Indexer 2",
        "IDX2",
        "Standalone",
      ),
      device(
        "idx3",
        "device:splunk_indexer",
        "g_index",
        250,
        60,
        "Indexer 3",
        "IDX3",
        "Standalone",
      ),
      ...collectionTrio("g_coll", 30, 60),
      ...managementStack("g_mgmt", true),
    ],
    edges: [
      edge("e_sh1_idx1", "sh1", "idx1", H.RightSrc, H.LeftTgt, {
        kind: "logical",
      }),
      edge("e_sh1_idx2", "sh1", "idx2", H.RightSrc, H.LeftTgt, {
        kind: "logical",
      }),
      edge("e_sh1_idx3", "sh1", "idx3", H.RightSrc, H.LeftTgt, {
        kind: "logical",
      }),
      edge("e_sh2_idx1", "sh2", "idx1", H.RightSrc, H.LeftTgt, {
        kind: "logical",
      }),
      edge("e_sh2_idx2", "sh2", "idx2", H.RightSrc, H.LeftTgt, {
        kind: "logical",
      }),
      edge("e_sh2_idx3", "sh2", "idx3", H.RightSrc, H.LeftTgt, {
        kind: "logical",
      }),
      edge("e_fwd_idx", "fwd", "idx1", H.TopSrc, H.BottomTgt, {
        label: "TCP 9997",
      }),
      edge("e_net_idx", "net_inputs", "idx2", H.TopSrc, H.BottomTgt),
      edge("e_other_idx", "other_inputs", "idx3", H.TopSrc, H.BottomTgt),
      edge("e_ds_fwd", "ds", "fwd", H.LeftSrc, H.RightTgt, { kind: "logical" }),
    ],
  },
};

/** Multi-Site Clustered (M2 / M12). Two indexer clusters, each with
 *  its own search head, sharing a single management column. */
const multiSiteClusteredM2 = {
  name: "Multi-Site Clustered - M2 M12",
  payload: {
    version: 1,
    title: title("Multi-Site Clustered (M2 / M12)"),
    groups: [
      region("g_mgmt", "Management", 20, 40, 180, 580, ACCENT.management),
      region(
        "g_siteA_search",
        "Site A — Search Tier",
        220,
        40,
        220,
        180,
        ACCENT.search,
      ),
      region(
        "g_siteN_search",
        "Site N — Search Tier",
        460,
        40,
        220,
        180,
        ACCENT.search,
      ),
      region(
        "g_siteA_index",
        "Site A — Indexing Tier",
        220,
        240,
        220,
        180,
        ACCENT.indexing,
      ),
      region(
        "g_siteN_index",
        "Site N — Indexing Tier",
        460,
        240,
        220,
        180,
        ACCENT.indexing,
      ),
      region(
        "g_coll",
        "Collection Tier",
        220,
        460,
        460,
        160,
        ACCENT.collection,
      ),
      region("g_mgmt_dr", "Management DR", 700, 40, 180, 580, ACCENT.customer),
    ],
    nodes: [
      ...managementStack("g_mgmt", false),
      device(
        "shA",
        "device:server",
        "g_siteA_search",
        60,
        50,
        "Search Head A",
        "SH-A",
        "SH",
      ),
      device(
        "shN",
        "device:server",
        "g_siteN_search",
        60,
        50,
        "Search Head N",
        "SH-N",
        "SH",
      ),
      device(
        "idxA1",
        "device:splunk_indexer",
        "g_siteA_index",
        30,
        50,
        "Indexer A1",
        "A1",
        "Indexer",
      ),
      device(
        "idxA2",
        "device:splunk_indexer",
        "g_siteA_index",
        110,
        50,
        "Indexer A2",
        "A2",
        "Indexer",
      ),
      device(
        "idxN1",
        "device:splunk_indexer",
        "g_siteN_index",
        30,
        50,
        "Indexer N1",
        "N1",
        "Indexer",
      ),
      device(
        "idxN2",
        "device:splunk_indexer",
        "g_siteN_index",
        110,
        50,
        "Indexer N2",
        "N2",
        "Indexer",
      ),
      ...collectionTrio("g_coll", 30, 40),
      device(
        "ds_dr",
        "device:server",
        "g_mgmt_dr",
        30,
        30,
        "DS (DR)",
        "DS",
        "DS",
      ),
      device(
        "lm_dr",
        "device:server",
        "g_mgmt_dr",
        30,
        160,
        "LM (DR)",
        "LM",
        "LM",
      ),
      device(
        "cm_dr",
        "device:server",
        "g_mgmt_dr",
        30,
        290,
        "CM (DR)",
        "CM",
        "CM",
      ),
    ],
    edges: [
      edge("e_shA_idxA1", "shA", "idxA1", H.BottomSrc, H.TopTgt, {
        kind: "logical",
      }),
      edge("e_shA_idxN1", "shA", "idxN1", H.BottomSrc, H.TopTgt, {
        kind: "logical",
      }),
      edge("e_shN_idxN2", "shN", "idxN2", H.BottomSrc, H.TopTgt, {
        kind: "logical",
      }),
      edge("e_shN_idxA2", "shN", "idxA2", H.BottomSrc, H.TopTgt, {
        kind: "logical",
      }),
      edge("e_idxA1_idxA2", "idxA1", "idxA2", H.RightSrc, H.LeftTgt, {
        kind: "synthetic_a2a",
        direction: "both",
      }),
      edge("e_idxN1_idxN2", "idxN1", "idxN2", H.RightSrc, H.LeftTgt, {
        kind: "synthetic_a2a",
        direction: "both",
      }),
      edge("e_idxA2_idxN1", "idxA2", "idxN1", H.RightSrc, H.LeftTgt, {
        kind: "synthetic_a2a",
        direction: "both",
        label: "Site replication",
      }),
      edge("e_fwd_idxA1", "fwd", "idxA1", H.TopSrc, H.BottomTgt, {
        label: "TCP 9997",
      }),
      edge("e_net_idxN1", "net_inputs", "idxN1", H.TopSrc, H.BottomTgt),
      edge("e_other_idxA2", "other_inputs", "idxA2", H.TopSrc, H.BottomTgt),
    ],
  },
};

/** Multi-Site Clustered + SHC (M3 / M13). Each site has its own
 *  Search Head Cluster. */
const multiSiteShcM3 = {
  name: "Multi-Site Clustered with SHC - M3 M13",
  payload: {
    version: 1,
    title: title("Multi-Site Clustered + SHC (M3 / M13)"),
    groups: [
      region("g_mgmt", "Management", 20, 40, 180, 700, ACCENT.management),
      region(
        "g_siteA_search",
        "Site A — SHC",
        220,
        40,
        240,
        180,
        ACCENT.search,
      ),
      region(
        "g_siteN_search",
        "Site N — SHC",
        480,
        40,
        240,
        180,
        ACCENT.search,
      ),
      region(
        "g_siteA_index",
        "Site A — Indexing Tier",
        220,
        240,
        240,
        180,
        ACCENT.indexing,
      ),
      region(
        "g_siteN_index",
        "Site N — Indexing Tier",
        480,
        240,
        240,
        180,
        ACCENT.indexing,
      ),
      region(
        "g_coll",
        "Collection Tier",
        220,
        460,
        500,
        160,
        ACCENT.collection,
      ),
      region("g_mgmt_dr", "Management DR", 740, 40, 180, 700, ACCENT.customer),
    ],
    nodes: [
      ...managementStack("g_mgmt", true),
      device(
        "shA1",
        "device:server",
        "g_siteA_search",
        30,
        50,
        "SH (A1)",
        "A-SH1",
        "SHC member",
      ),
      device(
        "shA2",
        "device:server",
        "g_siteA_search",
        130,
        50,
        "SH (A2)",
        "A-SH2",
        "SHC member",
      ),
      device(
        "shN1",
        "device:server",
        "g_siteN_search",
        30,
        50,
        "SH (N1)",
        "N-SH1",
        "SHC member",
      ),
      device(
        "shN2",
        "device:server",
        "g_siteN_search",
        130,
        50,
        "SH (N2)",
        "N-SH2",
        "SHC member",
      ),
      device(
        "idxA1",
        "device:splunk_indexer",
        "g_siteA_index",
        30,
        50,
        "Indexer A1",
        "A1",
        "Indexer",
      ),
      device(
        "idxA2",
        "device:splunk_indexer",
        "g_siteA_index",
        130,
        50,
        "Indexer A2",
        "A2",
        "Indexer",
      ),
      device(
        "idxN1",
        "device:splunk_indexer",
        "g_siteN_index",
        30,
        50,
        "Indexer N1",
        "N1",
        "Indexer",
      ),
      device(
        "idxN2",
        "device:splunk_indexer",
        "g_siteN_index",
        130,
        50,
        "Indexer N2",
        "N2",
        "Indexer",
      ),
      ...collectionTrio("g_coll", 30, 40),
      device(
        "ds_dr",
        "device:server",
        "g_mgmt_dr",
        30,
        30,
        "DS (DR)",
        "DS",
        "DS",
      ),
      device(
        "cm_dr",
        "device:server",
        "g_mgmt_dr",
        30,
        160,
        "CM (DR)",
        "CM",
        "CM",
      ),
      device(
        "shcd_dr",
        "device:server",
        "g_mgmt_dr",
        30,
        290,
        "SHC-D (DR)",
        "SHC-D",
        "SHC-D",
      ),
    ],
    edges: [
      edge("e_shA1_shA2", "shA1", "shA2", H.RightSrc, H.LeftTgt, {
        kind: "synthetic_a2a",
        direction: "both",
      }),
      edge("e_shN1_shN2", "shN1", "shN2", H.RightSrc, H.LeftTgt, {
        kind: "synthetic_a2a",
        direction: "both",
      }),
      edge("e_shA1_idxA1", "shA1", "idxA1", H.BottomSrc, H.TopTgt, {
        kind: "logical",
      }),
      edge("e_shA2_idxN1", "shA2", "idxN1", H.BottomSrc, H.TopTgt, {
        kind: "logical",
      }),
      edge("e_shN1_idxN2", "shN1", "idxN2", H.BottomSrc, H.TopTgt, {
        kind: "logical",
      }),
      edge("e_idxA1_idxA2", "idxA1", "idxA2", H.RightSrc, H.LeftTgt, {
        kind: "synthetic_a2a",
        direction: "both",
      }),
      edge("e_idxN1_idxN2", "idxN1", "idxN2", H.RightSrc, H.LeftTgt, {
        kind: "synthetic_a2a",
        direction: "both",
      }),
      edge("e_idxA2_idxN1", "idxA2", "idxN1", H.RightSrc, H.LeftTgt, {
        kind: "synthetic_a2a",
        direction: "both",
        label: "Site replication",
      }),
      edge("e_fwd_idxA1", "fwd", "idxA1", H.TopSrc, H.BottomTgt, {
        label: "TCP 9997",
      }),
      edge("e_net_idxN1", "net_inputs", "idxN1", H.TopSrc, H.BottomTgt),
      edge("e_other_idxA2", "other_inputs", "idxA2", H.TopSrc, H.BottomTgt),
    ],
  },
};

/** Multi-Site Clustered + SHC stretched (M4 / M14). One SHC
 *  spanning both sites. */
const multiSiteStretchedM4 = {
  name: "Multi-Site Stretched SHC - M4 M14",
  payload: {
    version: 1,
    title: title("Multi-Site Clustered + Stretched SHC (M4 / M14)"),
    groups: [
      region("g_mgmt", "Management", 20, 40, 180, 700, ACCENT.management),
      region(
        "g_search",
        "Stretched Search Head Cluster",
        220,
        40,
        500,
        180,
        ACCENT.search,
      ),
      region(
        "g_siteA_index",
        "Site A — Indexing Tier",
        220,
        240,
        240,
        180,
        ACCENT.indexing,
      ),
      region(
        "g_siteN_index",
        "Site N — Indexing Tier",
        480,
        240,
        240,
        180,
        ACCENT.indexing,
      ),
      region(
        "g_coll",
        "Collection Tier",
        220,
        460,
        500,
        160,
        ACCENT.collection,
      ),
      region("g_mgmt_dr", "Management DR", 740, 40, 180, 700, ACCENT.customer),
    ],
    nodes: [
      ...managementStack("g_mgmt", true),
      device(
        "shc1",
        "device:server",
        "g_search",
        30,
        50,
        "SHC member (A)",
        "SHC1",
        "Stretched SHC",
      ),
      device(
        "shc2",
        "device:server",
        "g_search",
        200,
        50,
        "SHC captain",
        "SHC2",
        "Stretched SHC",
      ),
      device(
        "shc3",
        "device:server",
        "g_search",
        370,
        50,
        "SHC member (N)",
        "SHC3",
        "Stretched SHC",
      ),
      device(
        "idxA1",
        "device:splunk_indexer",
        "g_siteA_index",
        30,
        50,
        "Indexer A1",
        "A1",
        "Indexer",
      ),
      device(
        "idxA2",
        "device:splunk_indexer",
        "g_siteA_index",
        130,
        50,
        "Indexer A2",
        "A2",
        "Indexer",
      ),
      device(
        "idxN1",
        "device:splunk_indexer",
        "g_siteN_index",
        30,
        50,
        "Indexer N1",
        "N1",
        "Indexer",
      ),
      device(
        "idxN2",
        "device:splunk_indexer",
        "g_siteN_index",
        130,
        50,
        "Indexer N2",
        "N2",
        "Indexer",
      ),
      ...collectionTrio("g_coll", 30, 40),
      device(
        "ds_dr",
        "device:server",
        "g_mgmt_dr",
        30,
        30,
        "DS (DR)",
        "DS",
        "DS",
      ),
      device(
        "cm_dr",
        "device:server",
        "g_mgmt_dr",
        30,
        160,
        "CM (DR)",
        "CM",
        "CM",
      ),
    ],
    edges: [
      edge("e_shc1_shc2", "shc1", "shc2", H.RightSrc, H.LeftTgt, {
        kind: "synthetic_a2a",
        direction: "both",
      }),
      edge("e_shc2_shc3", "shc2", "shc3", H.RightSrc, H.LeftTgt, {
        kind: "synthetic_a2a",
        direction: "both",
      }),
      edge("e_shc1_idxA1", "shc1", "idxA1", H.BottomSrc, H.TopTgt, {
        kind: "logical",
      }),
      edge("e_shc3_idxN2", "shc3", "idxN2", H.BottomSrc, H.TopTgt, {
        kind: "logical",
      }),
      edge("e_idxA1_idxA2", "idxA1", "idxA2", H.RightSrc, H.LeftTgt, {
        kind: "synthetic_a2a",
        direction: "both",
      }),
      edge("e_idxN1_idxN2", "idxN1", "idxN2", H.RightSrc, H.LeftTgt, {
        kind: "synthetic_a2a",
        direction: "both",
      }),
      edge("e_idxA2_idxN1", "idxA2", "idxN1", H.RightSrc, H.LeftTgt, {
        kind: "synthetic_a2a",
        direction: "both",
        label: "Site replication",
      }),
      edge("e_fwd_idxA1", "fwd", "idxA1", H.TopSrc, H.BottomTgt, {
        label: "TCP 9997",
      }),
      edge("e_net_idxN1", "net_inputs", "idxN1", H.TopSrc, H.BottomTgt),
      edge("e_other_idxA2", "other_inputs", "idxA2", H.TopSrc, H.BottomTgt),
    ],
  },
};

/** HEC Topology Choices — collection tier with HEC listener tier
 *  (HWFs behind AutoLB), Network LB, and an HEC API client app. */
const hecTopologyChoices = {
  name: "HEC Topology Choices",
  payload: {
    version: 1,
    title: title("HEC Topology Choices"),
    groups: [
      region("g_mgmt", "Management", 20, 40, 180, 380, ACCENT.management),
      region("g_index", "Indexing Tier", 220, 40, 460, 160, ACCENT.indexing),
      region(
        "g_coll",
        "Collection Tier",
        220,
        220,
        460,
        480,
        ACCENT.collection,
      ),
    ],
    nodes: [
      device(
        "ds",
        "device:server",
        "g_mgmt",
        30,
        30,
        "Deployment Server",
        "DS",
        "DS",
      ),
      device(
        "lm",
        "device:server",
        "g_mgmt",
        30,
        160,
        "License Manager",
        "LM",
        "LM",
      ),
      device(
        "cm",
        "device:server",
        "g_mgmt",
        30,
        290,
        "Cluster Manager",
        "CM",
        "CM",
      ),
      device(
        "idx1",
        "device:splunk_indexer",
        "g_index",
        60,
        40,
        "Indexer 1",
        "IDX1",
        "Indexer",
      ),
      device(
        "idx2",
        "device:splunk_indexer",
        "g_index",
        180,
        40,
        "Indexer 2",
        "IDX2",
        "Indexer",
      ),
      device(
        "idx3",
        "device:splunk_indexer",
        "g_index",
        300,
        40,
        "Indexer 3",
        "IDX3",
        "Indexer",
      ),
      device(
        "autolb",
        "device:load_balancer",
        "g_coll",
        100,
        30,
        "AutoLB",
        "AutoLB",
        "Layer 4",
      ),
      device(
        "hec1",
        "device:server",
        "g_coll",
        30,
        160,
        "HEC Listener (HWF)",
        "HEC-HWF1",
        "HWF",
      ),
      device(
        "hec2",
        "device:server",
        "g_coll",
        130,
        160,
        "HEC Listener (HWF)",
        "HEC-HWF2",
        "HWF",
      ),
      device(
        "hec3",
        "device:server",
        "g_coll",
        230,
        160,
        "HEC Listener (HWF)",
        "HEC-HWF3",
        "HWF",
      ),
      device(
        "netlb",
        "device:load_balancer",
        "g_coll",
        360,
        160,
        "Network LB",
        "NetLB",
        "Layer 7",
      ),
      device(
        "app",
        "device:generic",
        "g_coll",
        200,
        320,
        "Application using HEC API",
        "App",
        "HTTP client",
      ),
    ],
    edges: [
      edge("e_autolb_idx1", "autolb", "idx1", H.TopSrc, H.BottomTgt, {
        label: "TCP 9997 (S2S)",
      }),
      edge("e_autolb_idx2", "autolb", "idx2", H.TopSrc, H.BottomTgt),
      edge("e_netlb_idx3", "netlb", "idx3", H.TopSrc, H.BottomTgt, {
        label: "TCP 8088 (HTTP/S)",
      }),
      edge("e_hec1_autolb", "hec1", "autolb", H.TopSrc, H.BottomTgt),
      edge("e_hec2_autolb", "hec2", "autolb", H.TopSrc, H.BottomTgt),
      edge("e_hec3_autolb", "hec3", "autolb", H.TopSrc, H.BottomTgt),
      edge("e_app_netlb", "app", "netlb", H.TopSrc, H.BottomTgt),
      edge("e_app_hec2", "app", "hec2", H.TopSrc, H.BottomTgt),
      edge("e_cm_hec1", "cm", "hec1", H.RightSrc, H.LeftTgt, {
        kind: "logical",
        label: "Indexer Discovery",
      }),
    ],
  },
};

/** Data Collection Node Topology — DCN (HWF) collecting from API
 *  data providers, sending to indexers via AutoLB / NetLB. */
const dataCollectionNode = {
  name: "Data Collection Node Topology",
  payload: {
    version: 1,
    title: title("Data Collection Node Topology"),
    groups: [
      region("g_mgmt", "Management", 20, 40, 180, 380, ACCENT.management),
      region("g_index", "Indexing Tier", 220, 40, 460, 160, ACCENT.indexing),
      region(
        "g_coll",
        "Collection Tier",
        220,
        220,
        460,
        380,
        ACCENT.collection,
      ),
    ],
    nodes: [
      device(
        "ds",
        "device:server",
        "g_mgmt",
        30,
        30,
        "Deployment Server",
        "DS",
        "DS",
      ),
      device(
        "lm",
        "device:server",
        "g_mgmt",
        30,
        160,
        "License Manager",
        "LM",
        "LM",
      ),
      device(
        "cm",
        "device:server",
        "g_mgmt",
        30,
        290,
        "Cluster Manager",
        "CM",
        "CM",
      ),
      device(
        "idx1",
        "device:splunk_indexer",
        "g_index",
        60,
        40,
        "Indexer 1",
        "IDX1",
        "Indexer",
      ),
      device(
        "idx2",
        "device:splunk_indexer",
        "g_index",
        180,
        40,
        "Indexer 2",
        "IDX2",
        "Indexer",
      ),
      device(
        "idx3",
        "device:splunk_indexer",
        "g_index",
        300,
        40,
        "Indexer 3",
        "IDX3",
        "Indexer",
      ),
      device(
        "autolb",
        "device:load_balancer",
        "g_coll",
        80,
        30,
        "AutoLB",
        "AutoLB",
        "Layer 4",
      ),
      device(
        "dcn",
        "device:server",
        "g_coll",
        70,
        160,
        "Data Collection Node (HWF)",
        "DCN",
        "HWF",
      ),
      device(
        "netlb",
        "device:load_balancer",
        "g_coll",
        280,
        160,
        "Network LB",
        "NetLB",
        "Layer 7",
      ),
      device(
        "api",
        "device:generic",
        "g_coll",
        70,
        290,
        "API Data Provider",
        "API",
        "REST / DB",
      ),
    ],
    edges: [
      edge("e_autolb_idx1", "autolb", "idx1", H.TopSrc, H.BottomTgt, {
        label: "TCP 9997 (S2S)",
      }),
      edge("e_autolb_idx2", "autolb", "idx2", H.TopSrc, H.BottomTgt),
      edge("e_netlb_idx3", "netlb", "idx3", H.TopSrc, H.BottomTgt, {
        label: "TCP 8088 (HTTP)",
      }),
      edge("e_dcn_autolb", "dcn", "autolb", H.TopSrc, H.BottomTgt),
      edge("e_dcn_netlb", "dcn", "netlb", H.RightSrc, H.LeftTgt),
      edge("e_api_dcn", "api", "dcn", H.TopSrc, H.BottomTgt),
      edge("e_cm_dcn", "cm", "dcn", H.RightSrc, H.LeftTgt, {
        kind: "logical",
        label: "Indexer Discovery (UF/HWF)",
      }),
    ],
  },
};

/** Data Collection Topology Using Kafka and HEC — Kafka Connect
 *  cluster bridges Kafka topics into HEC listeners. */
const kafkaHecCollection = {
  name: "Data Collection Using Kafka and HEC",
  payload: {
    version: 1,
    title: title("Data Collection Using Kafka and HEC"),
    groups: [
      region("g_mgmt", "Management", 20, 40, 180, 260, ACCENT.management),
      region("g_index", "Indexing Tier", 220, 40, 480, 160, ACCENT.indexing),
      region(
        "g_coll",
        "Collection Tier",
        220,
        220,
        480,
        380,
        ACCENT.collection,
      ),
      region("g_kafka", "Kafka Ecosystem", 220, 620, 480, 200, ACCENT.kafka),
    ],
    nodes: [
      device(
        "ds",
        "device:server",
        "g_mgmt",
        30,
        30,
        "Deployment Server",
        "DS",
        "DS",
      ),
      device(
        "lm",
        "device:server",
        "g_mgmt",
        30,
        160,
        "License Manager",
        "LM",
        "LM",
      ),
      device(
        "idx1",
        "device:splunk_indexer",
        "g_index",
        60,
        40,
        "Indexer 1",
        "IDX1",
        "Indexer",
      ),
      device(
        "idx2",
        "device:splunk_indexer",
        "g_index",
        200,
        40,
        "Indexer 2",
        "IDX2",
        "Indexer",
      ),
      device(
        "idx3",
        "device:splunk_indexer",
        "g_index",
        340,
        40,
        "Indexer 3",
        "IDX3",
        "Indexer",
      ),
      device(
        "autolb",
        "device:load_balancer",
        "g_coll",
        100,
        30,
        "AutoLB",
        "AutoLB",
        "Layer 4",
      ),
      device(
        "hec1",
        "device:server",
        "g_coll",
        30,
        160,
        "HEC Listener (HWF)",
        "HEC1",
        "HWF",
      ),
      device(
        "hec2",
        "device:server",
        "g_coll",
        140,
        160,
        "HEC Listener (HWF)",
        "HEC2",
        "HWF",
      ),
      device(
        "hec3",
        "device:server",
        "g_coll",
        250,
        160,
        "HEC Listener (HWF)",
        "HEC3",
        "HWF",
      ),
      device(
        "netlb",
        "device:load_balancer",
        "g_coll",
        250,
        280,
        "Layer 7 LB",
        "L7-LB",
        "Layer 7",
      ),
      device(
        "connlb",
        "device:load_balancer",
        "g_coll",
        380,
        280,
        "Connector LB",
        "ConnLB",
        "Layer 4",
      ),
      device(
        "cs1",
        "device:container",
        "g_kafka",
        30,
        30,
        "Connect Server 1",
        "CS1",
        "Sink Tasks",
      ),
      device(
        "cs2",
        "device:container",
        "g_kafka",
        160,
        30,
        "Connect Server 2",
        "CS2",
        "Sink Tasks",
      ),
      device(
        "csN",
        "device:container",
        "g_kafka",
        290,
        30,
        "Connect Server N",
        "CS-N",
        "Sink Tasks",
      ),
      device(
        "kafka",
        "device:cloud",
        "g_kafka",
        170,
        130,
        "Kafka",
        "Kafka",
        "Brokers",
      ),
    ],
    edges: [
      edge("e_autolb_idx1", "autolb", "idx1", H.TopSrc, H.BottomTgt, {
        label: "TCP 9997 (S2S)",
      }),
      edge("e_autolb_idx2", "autolb", "idx2", H.TopSrc, H.BottomTgt),
      edge("e_autolb_idx3", "autolb", "idx3", H.TopSrc, H.BottomTgt),
      edge("e_hec1_autolb", "hec1", "autolb", H.TopSrc, H.BottomTgt),
      edge("e_hec2_autolb", "hec2", "autolb", H.TopSrc, H.BottomTgt),
      edge("e_hec3_autolb", "hec3", "autolb", H.TopSrc, H.BottomTgt),
      edge("e_netlb_hec1", "netlb", "hec1", H.TopSrc, H.BottomTgt, {
        label: "HEC 8088",
      }),
      edge("e_netlb_hec2", "netlb", "hec2", H.TopSrc, H.BottomTgt),
      edge("e_cs1_netlb", "cs1", "netlb", H.TopSrc, H.BottomTgt),
      edge("e_cs2_netlb", "cs2", "netlb", H.TopSrc, H.BottomTgt),
      edge("e_csN_connlb", "csN", "connlb", H.TopSrc, H.BottomTgt),
      edge("e_kafka_cs1", "kafka", "cs1", H.TopSrc, H.BottomTgt),
      edge("e_kafka_cs2", "kafka", "cs2", H.TopSrc, H.BottomTgt),
      edge("e_kafka_csN", "kafka", "csN", H.TopSrc, H.BottomTgt),
    ],
  },
};

/** Intermediary Forwarding Topology — large fleet of UFs feeding
 *  through an Intermediary Forwarder tier (UF/HF) and AutoLB into
 *  the indexer cluster. */
const intermediaryForwarding = {
  name: "Intermediary Forwarding Topology",
  payload: {
    version: 1,
    title: title("Intermediary Forwarding Topology"),
    groups: [
      region("g_mgmt", "Management", 20, 40, 180, 260, ACCENT.management),
      region("g_index", "Indexing Tier", 220, 40, 460, 160, ACCENT.indexing),
      region(
        "g_coll",
        "Collection Tier",
        220,
        220,
        460,
        540,
        ACCENT.collection,
      ),
    ],
    nodes: [
      device(
        "ds",
        "device:server",
        "g_mgmt",
        30,
        30,
        "Deployment Server",
        "DS",
        "DS",
      ),
      device(
        "lm",
        "device:server",
        "g_mgmt",
        30,
        160,
        "License Manager",
        "LM",
        "LM",
      ),
      device(
        "idx1",
        "device:splunk_indexer",
        "g_index",
        60,
        40,
        "Indexer 1",
        "IDX1",
        "Indexer",
      ),
      device(
        "idx2",
        "device:splunk_indexer",
        "g_index",
        180,
        40,
        "Indexer 2",
        "IDX2",
        "Indexer",
      ),
      device(
        "idx3",
        "device:splunk_indexer",
        "g_index",
        300,
        40,
        "Indexer 3",
        "IDX3",
        "Indexer",
      ),
      device(
        "autolb_top",
        "device:load_balancer",
        "g_coll",
        200,
        30,
        "AutoLB",
        "AutoLB",
        "Layer 4",
      ),
      device(
        "if1",
        "device:server",
        "g_coll",
        130,
        160,
        "Intermediary Forwarder",
        "IF1",
        "UF / HF",
      ),
      device(
        "if2",
        "device:server",
        "g_coll",
        290,
        160,
        "Intermediary Forwarder",
        "IF2",
        "UF / HF",
      ),
      device(
        "autolb_bot",
        "device:load_balancer",
        "g_coll",
        200,
        290,
        "AutoLB",
        "AutoLB",
        "Layer 4",
      ),
      device(
        "uf1",
        "device:server",
        "g_coll",
        30,
        420,
        "Endpoint UF",
        "UF1",
        "UF",
      ),
      device(
        "uf2",
        "device:server",
        "g_coll",
        130,
        420,
        "Endpoint UF",
        "UF2",
        "UF",
      ),
      device(
        "uf3",
        "device:server",
        "g_coll",
        230,
        420,
        "Endpoint UF",
        "UF3",
        "UF",
      ),
      device(
        "uf4",
        "device:server",
        "g_coll",
        330,
        420,
        "Endpoint UF",
        "UF4",
        "UF",
      ),
      {
        id: "note_if_count",
        type: "textBox",
        x: 470,
        y: 380,
        textBox: {
          text: "1s–10s IFs using UF/HF\n100s–10,000s of endpoints with UF",
          fontSize: 11,
          color: "#0f172a",
          bold: true,
          italic: true,
          background: "#ffffff",
          border: "1px dashed #94a3b8",
          align: "left",
        },
      },
    ],
    edges: [
      edge("e_autolbT_idx1", "autolb_top", "idx1", H.TopSrc, H.BottomTgt, {
        label: "TCP 9997 (S2S)",
      }),
      edge("e_autolbT_idx2", "autolb_top", "idx2", H.TopSrc, H.BottomTgt),
      edge("e_autolbT_idx3", "autolb_top", "idx3", H.TopSrc, H.BottomTgt),
      edge("e_if1_autolbT", "if1", "autolb_top", H.TopSrc, H.BottomTgt),
      edge("e_if2_autolbT", "if2", "autolb_top", H.TopSrc, H.BottomTgt),
      edge("e_autolbB_if1", "autolb_bot", "if1", H.TopSrc, H.BottomTgt, {
        label: "TCP 9997",
      }),
      edge("e_autolbB_if2", "autolb_bot", "if2", H.TopSrc, H.BottomTgt),
      edge("e_uf1_autolbB", "uf1", "autolb_bot", H.TopSrc, H.BottomTgt),
      edge("e_uf2_autolbB", "uf2", "autolb_bot", H.TopSrc, H.BottomTgt),
      edge("e_uf3_autolbB", "uf3", "autolb_bot", H.TopSrc, H.BottomTgt),
      edge("e_uf4_autolbB", "uf4", "autolb_bot", H.TopSrc, H.BottomTgt),
    ],
  },
};

/** Data Collection Topology Overview — multiple parallel data
 *  collection paths showing the breadth of input options. */
const dataCollectionOverview = {
  name: "Data Collection Topology Overview",
  payload: {
    version: 1,
    title: title("Data Collection Topology Overview"),
    groups: [
      region("g_mgmt", "Management", 20, 40, 180, 380, ACCENT.management),
      region("g_index", "Indexing Tier", 220, 40, 600, 160, ACCENT.indexing),
      region(
        "g_coll",
        "Collection Tier",
        220,
        220,
        600,
        480,
        ACCENT.collection,
      ),
    ],
    nodes: [
      device(
        "ds",
        "device:server",
        "g_mgmt",
        30,
        30,
        "Deployment Server",
        "DS",
        "DS",
      ),
      device(
        "lm",
        "device:server",
        "g_mgmt",
        30,
        160,
        "License Manager",
        "LM",
        "LM",
      ),
      device(
        "cm",
        "device:server",
        "g_mgmt",
        30,
        290,
        "Cluster Manager",
        "CM",
        "CM",
      ),
      device(
        "idx1",
        "device:splunk_indexer",
        "g_index",
        80,
        40,
        "Indexer 1",
        "IDX1",
        "Indexer",
      ),
      device(
        "idx2",
        "device:splunk_indexer",
        "g_index",
        240,
        40,
        "Indexer 2",
        "IDX2",
        "Indexer",
      ),
      device(
        "idx3",
        "device:splunk_indexer",
        "g_index",
        400,
        40,
        "Indexer 3",
        "IDX3",
        "Indexer",
      ),
      device(
        "lb1",
        "device:load_balancer",
        "g_coll",
        30,
        30,
        "AutoLB",
        "LB1",
        "Layer 4",
      ),
      device(
        "uf_endpts",
        "device:server",
        "g_coll",
        30,
        160,
        "Endpoints with UF",
        "UFs",
        "UF",
      ),
      device(
        "lb2",
        "device:load_balancer",
        "g_coll",
        150,
        30,
        "AutoLB",
        "LB2",
        "Layer 4",
      ),
      device(
        "syslog",
        "device:server",
        "g_coll",
        150,
        160,
        "Syslog Servers (UF)",
        "Syslog",
        "UF + rsyslog",
      ),
      device(
        "sc4s",
        "device:generic",
        "g_coll",
        250,
        290,
        "Splunk Connect for Syslog",
        "SC4S",
        "OCI / k8s",
      ),
      device(
        "appliances",
        "device:generic",
        "g_coll",
        150,
        290,
        "Appliances / Devices",
        "Appl",
        "Network",
      ),
      device(
        "lb3",
        "device:load_balancer",
        "g_coll",
        290,
        30,
        "AutoLB",
        "LB3",
        "Layer 7",
      ),
      device(
        "dcn",
        "device:server",
        "g_coll",
        290,
        160,
        "Data Collection Node (HWF)",
        "DCN",
        "HWF",
      ),
      device(
        "apidp",
        "device:generic",
        "g_coll",
        290,
        290,
        "API Data Provider",
        "API",
        "REST / DB",
      ),
      device(
        "lb4",
        "device:load_balancer",
        "g_coll",
        430,
        30,
        "Network LB",
        "LB4",
        "Layer 7",
      ),
      device(
        "hec_app",
        "device:generic",
        "g_coll",
        430,
        160,
        "HEC App Inputs",
        "HEC App",
        "HTTP client",
      ),
    ],
    edges: [
      edge("e_lb1_idx1", "lb1", "idx1", H.TopSrc, H.BottomTgt, {
        label: "TCP 9997 (S2S)",
      }),
      edge("e_lb2_idx1", "lb2", "idx1", H.TopSrc, H.BottomTgt),
      edge("e_lb3_idx2", "lb3", "idx2", H.TopSrc, H.BottomTgt),
      edge("e_lb4_idx3", "lb4", "idx3", H.TopSrc, H.BottomTgt, {
        label: "TCP 8088 (HTTP)",
      }),
      edge("e_uf_lb1", "uf_endpts", "lb1", H.TopSrc, H.BottomTgt),
      edge("e_syslog_lb2", "syslog", "lb2", H.TopSrc, H.BottomTgt),
      edge("e_appl_syslog", "appliances", "syslog", H.TopSrc, H.BottomTgt),
      edge("e_appl_sc4s", "appliances", "sc4s", H.TopSrc, H.BottomTgt),
      edge("e_sc4s_lb2", "sc4s", "lb2", H.TopSrc, H.BottomTgt),
      edge("e_apidp_dcn", "apidp", "dcn", H.TopSrc, H.BottomTgt),
      edge("e_dcn_lb3", "dcn", "lb3", H.TopSrc, H.BottomTgt),
      edge("e_hecapp_lb4", "hec_app", "lb4", H.TopSrc, H.BottomTgt),
      edge("e_cm_uf", "cm", "uf_endpts", H.RightSrc, H.LeftTgt, {
        kind: "logical",
        label: "Indexer Discovery (UF/HWF)",
      }),
    ],
  },
};

// --- Catalogue & writer ---------------------------------------------

const OOB_DIAGRAMS = [
  splunkCloudDeployment,
  ciscoLive2026EventArchitecture,
  shapeGalleryDiagram,
  singleServerDeployment,
  distributedClusteredC1,
  distributedClusteredShcC3,
  distributedNonClusteredD1,
  multiSiteClusteredM2,
  multiSiteShcM3,
  multiSiteStretchedM4,
  hecTopologyChoices,
  dataCollectionNode,
  kafkaHecCollection,
  intermediaryForwarding,
  dataCollectionOverview,
];

// Validate every stanza name up front so we don't write a partial
// conf file before discovering a bad name.
for (const d of OOB_DIAGRAMS) {
  assertSafeStanzaName(d.name);
}

/**
 * Build 115.11 — automatic alignment pass for OOB diagrams.
 *
 * Operators flagged that the seeded factory diagrams had visible
 * row / column drift inside region containers — devices in what
 * looks like a single row would sit on slightly-different Y values,
 * and devices in the same column would sit on slightly-different X
 * values. The hand-tuned coordinates below were carrying that drift
 * forward on every regen.
 *
 * `tidyDiagram` runs after each diagram is declared and:
 *   • Snaps every node coordinate to the 20px canvas grid (the
 *     same grid the runtime drag-stop snaps to).
 *   • Within each region, clusters near-aligned devices into
 *     "rows" and "columns" using a single-pass nearest-neighbour
 *     fold (tolerance: 24px, just under the runtime grid step) and
 *     forces every device in a cluster onto the cluster's
 *     canonical Y / X.
 *   • Same row/column treatment applies to top-level (non-parented)
 *     nodes — useful for the protocol-gateway labels in the cloud
 *     deployment diagram, which previously drifted up/down by 4–8px.
 *
 * The pass is conservative: tolerance is small enough that
 * intentionally-staggered devices (e.g. a 2-row Indexer cluster
 * with the LB hanging beneath) keep their stagger. Anything
 * authored "close to aligned" snaps to "actually aligned".
 */
const ALIGN_GRID = 20;
const ALIGN_TOLERANCE = 24;

const snapToGrid = (value) => Math.round(value / ALIGN_GRID) * ALIGN_GRID;

const clusterAxis = (values, tolerance) => {
  // Greedy single-link clustering on a 1-D axis. Sort, then start
  // a new cluster whenever the gap exceeds `tolerance`. Each
  // cluster's representative coordinate is the snapped MIN of
  // its members so we don't accidentally drift everyone to the
  // grid step that contains the cluster's median.
  if (values.length === 0) return [];
  const sorted = [...new Set(values)].sort((a, b) => a - b);
  const clusters = [];
  let current = [sorted[0]];
  for (let i = 1; i < sorted.length; i += 1) {
    if (sorted[i] - sorted[i - 1] <= tolerance) {
      current.push(sorted[i]);
    } else {
      clusters.push(current);
      current = [sorted[i]];
    }
  }
  clusters.push(current);
  return clusters.map((cluster) => ({
    members: new Set(cluster),
    representative: snapToGrid(Math.min(...cluster)),
  }));
};

const reassignFromClusters = (rawValue, clusters) => {
  for (const cluster of clusters) {
    if (cluster.members.has(rawValue)) return cluster.representative;
  }
  return snapToGrid(rawValue);
};

const tidyDiagram = (diagram) => {
  const nodes = diagram.payload?.nodes ?? [];
  if (nodes.length === 0) return;

  // Step 1 — snap every node to the 20px grid. Operates in-place.
  for (const node of nodes) {
    if (typeof node.x === "number") node.x = snapToGrid(node.x);
    if (typeof node.y === "number") node.y = snapToGrid(node.y);
  }

  // Step 2 — group nodes by parent (top-level uses a sentinel key
  // so the same row/column treatment runs for free-floating
  // textboxes / shapes).
  const byParent = new Map();
  for (const node of nodes) {
    const key = node.parentId ?? "__root__";
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key).push(node);
  }

  // Step 3 — per-parent row/column clustering.
  for (const siblings of byParent.values()) {
    if (siblings.length < 2) continue;
    const yValues = siblings
      .filter((n) => typeof n.y === "number")
      .map((n) => n.y);
    const xValues = siblings
      .filter((n) => typeof n.x === "number")
      .map((n) => n.x);
    const yClusters = clusterAxis(yValues, ALIGN_TOLERANCE);
    const xClusters = clusterAxis(xValues, ALIGN_TOLERANCE);
    for (const node of siblings) {
      if (typeof node.y === "number") {
        node.y = reassignFromClusters(node.y, yClusters);
      }
      if (typeof node.x === "number") {
        node.x = reassignFromClusters(node.x, xClusters);
      }
    }
  }

  // Step 4 — group geometry stays on the grid too. Cards inside a
  // region snap to the region's local coords, but if the region
  // itself is off-grid they all look "almost right". Snap regions
  // and the title block as well so the whole diagram lives on a
  // consistent lattice.
  for (const group of diagram.payload?.groups ?? []) {
    if (typeof group.x === "number") group.x = snapToGrid(group.x);
    if (typeof group.y === "number") group.y = snapToGrid(group.y);
    if (typeof group.width === "number") group.width = snapToGrid(group.width);
    if (typeof group.height === "number")
      group.height = snapToGrid(group.height);
  }
  if (diagram.payload?.title) {
    if (typeof diagram.payload.title.x === "number") {
      diagram.payload.title.x = snapToGrid(diagram.payload.title.x);
    }
    if (typeof diagram.payload.title.y === "number") {
      diagram.payload.title.y = snapToGrid(diagram.payload.title.y);
    }
  }
};

/**
 * Build 1180 — polish the generated OOB diagrams for the larger,
 * more pictorial device cards. The original coordinates predated
 * the current card chrome, so many regions had just enough room for
 * the old icon-only glyphs and now feel crowded. This pass preserves
 * each diagram's topology and relative tiers, but gives siblings a
 * minimum gutter and grows / repositions regions so cards and labels
 * are not fighting their containers.
 */
const DEVICE_CARD_WIDTH = 100;
const DEVICE_CARD_HEIGHT = 110;
const TEXTBOX_WIDTH = 140;
const TEXTBOX_HEIGHT = 70;
const REGION_PAD_X = 40;
const REGION_PAD_TOP = 60;
const REGION_PAD_BOTTOM = 50;
const REGION_MIN_WIDTH = 260;
const REGION_MIN_HEIGHT = 220;
const DEVICE_GAP_X = 50;
const DEVICE_GAP_Y = 50;
const GROUP_GAP_X = 40;
const GROUP_GAP_Y = 60;
const ROOT_X = 20;
const ROOT_Y = 40;

const estimateNodeSize = (node) =>
  node.type === "textBox"
    ? { width: TEXTBOX_WIDTH, height: TEXTBOX_HEIGHT }
    : { width: DEVICE_CARD_WIDTH, height: DEVICE_CARD_HEIGHT };

const groupChildrenByY = (children) => {
  const sorted = [...children].sort((a, b) => {
    const yDelta = (a.y ?? 0) - (b.y ?? 0);
    if (Math.abs(yDelta) > ALIGN_TOLERANCE) return yDelta;
    return (a.x ?? 0) - (b.x ?? 0);
  });
  const rows = [];
  for (const child of sorted) {
    const last = rows[rows.length - 1];
    if (last && Math.abs((child.y ?? 0) - last.referenceY) <= ALIGN_TOLERANCE) {
      last.nodes.push(child);
      last.referenceY = Math.min(last.referenceY, child.y ?? 0);
    } else {
      rows.push({ referenceY: child.y ?? 0, nodes: [child] });
    }
  }
  return rows;
};

const minimumGroupWidthForLabel = (label = "") =>
  Math.min(620, Math.max(REGION_MIN_WIDTH, label.length * 9 + 140));

const spreadRegionContents = (diagram) => {
  if (
    diagram.name === "Splunk Cloud Deployment Architecture" ||
    diagram.name === "Cisco Live 2026 Event Architecture"
  ) {
    return;
  }

  const nodes = diagram.payload?.nodes ?? [];
  const groups = diagram.payload?.groups ?? [];
  for (const group of groups) {
    const children = nodes.filter((node) => node.parentId === group.id);
    if (children.length === 0) {
      group.width = Math.max(
        group.width,
        minimumGroupWidthForLabel(group.label),
      );
      group.height = Math.max(group.height, REGION_MIN_HEIGHT);
      continue;
    }

    const rows = groupChildrenByY(children);
    let nextRowY = REGION_PAD_TOP;
    for (const row of rows) {
      row.nodes.sort((a, b) => (a.x ?? 0) - (b.x ?? 0));
      const rowY = Math.max(row.referenceY, nextRowY);
      let nextX = REGION_PAD_X;
      let rowHeight = DEVICE_CARD_HEIGHT;

      for (const child of row.nodes) {
        const size = estimateNodeSize(child);
        child.x = Math.max(child.x ?? 0, nextX);
        child.y = rowY;
        nextX = child.x + size.width + DEVICE_GAP_X;
        rowHeight = Math.max(rowHeight, size.height);
      }

      nextRowY = rowY + rowHeight + DEVICE_GAP_Y;
    }

    let contentRight = REGION_PAD_X + DEVICE_CARD_WIDTH;
    let contentBottom = REGION_PAD_TOP + DEVICE_CARD_HEIGHT;
    for (const child of children) {
      const size = estimateNodeSize(child);
      contentRight = Math.max(contentRight, (child.x ?? 0) + size.width);
      contentBottom = Math.max(contentBottom, (child.y ?? 0) + size.height);
    }

    group.width = Math.max(
      group.width,
      minimumGroupWidthForLabel(group.label),
      contentRight + REGION_PAD_X,
    );
    group.height = Math.max(
      group.height,
      REGION_MIN_HEIGHT,
      contentBottom + REGION_PAD_BOTTOM,
    );
  }
};

const groupMap = (diagram) =>
  new Map((diagram.payload?.groups ?? []).map((group) => [group.id, group]));

const right = (group) => group.x + group.width;
const bottom = (group) => group.y + group.height;

const placeStandardTierGroups = (groups) => {
  const search = groups.get("g_search");
  const index = groups.get("g_index");
  const collection = groups.get("g_coll");
  const management = groups.get("g_mgmt");
  if (!search || !index || !collection || !management) return false;

  search.x = ROOT_X;
  search.y = ROOT_Y;
  index.x = right(search) + GROUP_GAP_X;
  index.y = ROOT_Y;

  collection.x = ROOT_X;
  collection.y = Math.max(bottom(search), bottom(index)) + GROUP_GAP_Y;
  collection.width = Math.max(collection.width, right(index) - collection.x);

  management.x = right(collection) + GROUP_GAP_X;
  management.y = ROOT_Y;

  return true;
};

const placeSingleServerGroups = (groups) => {
  const searchIndex = groups.get("g_si");
  const collection = groups.get("g_coll");
  const management = groups.get("g_mgmt");
  if (!searchIndex || !collection || !management) return false;

  searchIndex.x = ROOT_X;
  searchIndex.y = ROOT_Y;
  collection.x = ROOT_X;
  collection.y = bottom(searchIndex) + GROUP_GAP_Y;
  collection.width = Math.max(collection.width, searchIndex.width);

  management.x = right(collection) + GROUP_GAP_X;
  management.y = ROOT_Y;

  return true;
};

const placeIndexCollectionGroups = (groups) => {
  const management = groups.get("g_mgmt");
  const index = groups.get("g_index");
  const collection = groups.get("g_coll");
  if (!management || !index || !collection) return false;

  management.x = ROOT_X;
  management.y = ROOT_Y;
  index.x = right(management) + GROUP_GAP_X;
  index.y = ROOT_Y;

  collection.x = index.x;
  collection.y = bottom(index) + GROUP_GAP_Y;
  collection.width = Math.max(collection.width, index.width);

  const kafka = groups.get("g_kafka");
  if (kafka) {
    kafka.x = collection.x;
    kafka.y = bottom(collection) + GROUP_GAP_Y;
    kafka.width = Math.max(kafka.width, collection.width);
  }

  return true;
};

const placeMultiSiteGroups = (groups) => {
  const management = groups.get("g_mgmt");
  const siteASearch = groups.get("g_siteA_search");
  const siteNSearch = groups.get("g_siteN_search");
  const siteAIndex = groups.get("g_siteA_index");
  const siteNIndex = groups.get("g_siteN_index");
  const collection = groups.get("g_coll");
  const managementDr = groups.get("g_mgmt_dr");

  if (
    !management ||
    !siteASearch ||
    !siteNSearch ||
    !siteAIndex ||
    !siteNIndex ||
    !collection ||
    !managementDr
  ) {
    return false;
  }

  management.x = ROOT_X;
  management.y = ROOT_Y;
  const siteAWidth = Math.max(siteASearch.width, siteAIndex.width);
  const siteNWidth = Math.max(siteNSearch.width, siteNIndex.width);
  siteASearch.width = siteAWidth;
  siteAIndex.width = siteAWidth;
  siteNSearch.width = siteNWidth;
  siteNIndex.width = siteNWidth;

  siteASearch.x = right(management) + GROUP_GAP_X;
  siteASearch.y = ROOT_Y;
  siteNSearch.x = right(siteASearch) + GROUP_GAP_X;
  siteNSearch.y = ROOT_Y;

  const indexY =
    Math.max(bottom(siteASearch), bottom(siteNSearch)) + GROUP_GAP_Y;
  siteAIndex.x = siteASearch.x;
  siteAIndex.y = indexY;
  siteNIndex.x = siteNSearch.x;
  siteNIndex.y = indexY;

  collection.x = siteASearch.x;
  collection.y = Math.max(bottom(siteAIndex), bottom(siteNIndex)) + GROUP_GAP_Y;
  collection.width = Math.max(
    collection.width,
    Math.max(right(siteNSearch), right(siteNIndex)) - collection.x,
  );

  managementDr.x = right(collection) + GROUP_GAP_X;
  managementDr.y = ROOT_Y;
  managementDr.height = Math.max(
    managementDr.height,
    bottom(collection) - managementDr.y,
  );
  management.height = Math.max(
    management.height,
    bottom(collection) - management.y,
  );

  return true;
};

const placeStretchedSiteGroups = (groups) => {
  const management = groups.get("g_mgmt");
  const search = groups.get("g_search");
  const siteAIndex = groups.get("g_siteA_index");
  const siteNIndex = groups.get("g_siteN_index");
  const collection = groups.get("g_coll");
  const managementDr = groups.get("g_mgmt_dr");

  if (
    !management ||
    !search ||
    !siteAIndex ||
    !siteNIndex ||
    !collection ||
    !managementDr
  ) {
    return false;
  }

  management.x = ROOT_X;
  management.y = ROOT_Y;
  search.x = right(management) + GROUP_GAP_X;
  search.y = ROOT_Y;
  search.width = Math.max(
    search.width,
    siteAIndex.width + GROUP_GAP_X + siteNIndex.width,
  );

  siteAIndex.x = search.x;
  siteAIndex.y = bottom(search) + GROUP_GAP_Y;
  siteNIndex.x = right(siteAIndex) + GROUP_GAP_X;
  siteNIndex.y = siteAIndex.y;

  collection.x = search.x;
  collection.y = Math.max(bottom(siteAIndex), bottom(siteNIndex)) + GROUP_GAP_Y;
  collection.width = Math.max(
    collection.width,
    search.width,
    right(siteNIndex) - collection.x,
  );

  managementDr.x = right(collection) + GROUP_GAP_X;
  managementDr.y = ROOT_Y;
  managementDr.height = Math.max(
    managementDr.height,
    bottom(collection) - managementDr.y,
  );
  management.height = Math.max(
    management.height,
    bottom(collection) - management.y,
  );

  return true;
};

const placeSplunkCloudGroups = (groups) => {
  const search = groups.get("g_search_tier");
  const index = groups.get("g_index_tier");
  const collection = groups.get("g_collection_cloud");
  const customer = groups.get("g_customer_env");
  if (!search || !index || !collection || !customer) return false;

  search.x = ROOT_X;
  search.y = ROOT_Y;
  index.x = right(search) + GROUP_GAP_X;
  index.y = ROOT_Y;
  collection.x = right(index) + GROUP_GAP_X;
  collection.y = ROOT_Y;
  customer.x = ROOT_X;
  customer.y =
    Math.max(bottom(search), bottom(index), bottom(collection)) + 140;
  customer.width = Math.max(customer.width, right(collection) - customer.x);

  return true;
};

const placeGroups = (diagram) => {
  const groups = groupMap(diagram);
  if (groups.size === 0) return;

  if (placeSplunkCloudGroups(groups)) return;
  if (placeMultiSiteGroups(groups)) return;
  if (placeStretchedSiteGroups(groups)) return;
  if (placeStandardTierGroups(groups)) return;
  if (placeSingleServerGroups(groups)) return;
  placeIndexCollectionGroups(groups);
};

const polishOobDiagram = (diagram) => {
  for (const node of diagram.payload?.nodes ?? []) {
    normalizeSplunkDeviceType(node);
  }
  tidyDiagram(diagram);
  spreadRegionContents(diagram);
  placeGroups(diagram);
  tidyDiagram(diagram);
};

for (const diagram of OOB_DIAGRAMS) {
  polishOobDiagram(diagram);
}

const now = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");

// File preamble matches the comment block in
// `default/network_diagrams.conf` so reviewers re-running the
// generator don't see a churn-only diff in the header.
//
// Build 115.5 — emit schema_version = 2 (hybrid: metadata fields
// promoted to first-class conf keys, body still in payload_json).
// The runtime accepts both schemas; see diagramPersistenceService
// .ts → coerceRow for the back-compat path.
const PREAMBLE = `# =====================================================================
# network_diagrams.conf — out-of-the-box reference diagrams shipped
# with the splunk-cisco-dashboards app.
# =====================================================================
#
# This file is auto-generated by scripts/generate_oob_diagrams.mjs.
# Do not edit by hand — re-run the script after modifying the
# diagram declarations there.
#
# Schema (schema_version = 2, Build 115.5):
#   schema_version  Integer; 2 means "hybrid" — metadata fields
#                   below are first-class conf keys, payload_json
#                   carries the canvas body. Older saves (no
#                   schema_version, or = 1) are still loaded; the
#                   runtime derives metadata from the body and the
#                   next save promotes them to schema 2.
#   title           On-canvas diagram title (the headline shown at
#                   the top of the diagram). Distinct from the
#                   stanza name, which is the picker key.
#   description     Free-form description for the diagram picker
#                   tooltip / list view. Empty in the OOB seeds.
#   updated_at      ISO8601 (UTC, second-resolution) of the last
#                   save. OOB seeds use the script's run time.
#   updated_by      Splunk username of the last saver, or
#                   "oob-seed" for OOB diagrams.
#   node_count      Integer device-shape count (denormalised from
#                   payload_json so SPL / btool can answer "how
#                   big is this diagram?" without parsing JSON).
#   edge_count      Integer connector count. Same rationale.
#   group_count     Integer region/group container count.
#   asset_bindings  Comma-separated list of asset_inventory
#                   device_names referenced by bound shapes.
#                   Lets ops grep "which diagrams reference
#                   host X?" without parsing the body.
#   payload_json    Single-line JSON: { version, title, nodes,
#                   edges, groups }. The React canvas is the only
#                   consumer of the body. Splunk tolerates very
#                   long single-line values; no continuation
#                   backslashes are needed as long as the value
#                   has no embedded newline.
#
# The runtime persistence layer (diagramPersistenceService.ts) reads
# this file via the REST conf endpoint and merges it with any
# operator saves in local/network_diagrams.conf.
`;

/** Build 115.5 — derive `asset_bindings` here too, mirroring
 *  computeAssetBindings in diagramPersistenceService.ts. Keep
 *  these two implementations in lockstep — first re-save of an
 *  OOB diagram should produce the same asset_bindings string we
 *  emit here, otherwise btool diff lights up unnecessarily. */
const computeAssetBindings = (payload) => {
  const bound = new Set();
  for (const n of payload.nodes ?? []) {
    if (typeof n.assetId === "string" && n.assetId.trim().length > 0) {
      bound.add(n.assetId.trim());
    }
  }
  return Array.from(bound).sort().join(",");
};

const computeDiagramTitle = (payload) =>
  typeof payload.title?.text === "string" ? payload.title.text.trim() : "";

const stanzaLines = [];
for (const d of OOB_DIAGRAMS) {
  const payloadJson = JSON.stringify(d.payload);
  // Build 115.5 — emit schema 2 with metadata fields ahead of
  // the payload. Field ORDER matters here: it's what reviewers
  // see in `git diff` so we keep it consistent with the table
  // documented in PREAMBLE above.
  stanzaLines.push("");
  stanzaLines.push(`[${d.name}]`);
  stanzaLines.push(`schema_version = 2`);
  stanzaLines.push(`title = ${computeDiagramTitle(d.payload)}`);
  stanzaLines.push(`description = ${d.description ?? ""}`);
  stanzaLines.push(`updated_at = ${now}`);
  stanzaLines.push(`updated_by = oob-seed`);
  stanzaLines.push(`node_count = ${(d.payload.nodes ?? []).length}`);
  stanzaLines.push(`edge_count = ${(d.payload.edges ?? []).length}`);
  stanzaLines.push(`group_count = ${(d.payload.groups ?? []).length}`);
  stanzaLines.push(`asset_bindings = ${computeAssetBindings(d.payload)}`);
  stanzaLines.push(`payload_json = ${payloadJson}`);
}

const conf = PREAMBLE + stanzaLines.join("\n") + "\n";

mkdirSync(dirname(OUT_PATH), { recursive: true });
writeFileSync(OUT_PATH, conf, "utf8");

console.log(`Wrote ${OOB_DIAGRAMS.length} OOB diagram(s) → ${OUT_PATH}`);
for (const d of OOB_DIAGRAMS) {
  console.log(
    `  • [${d.name}]  (${d.payload.nodes.length} nodes, ${d.payload.edges.length} edges, ${d.payload.groups.length} groups)`,
  );
}
