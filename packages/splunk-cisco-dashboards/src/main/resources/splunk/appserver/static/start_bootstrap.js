/* global module */

/**
 * First-run setup controller backed by setup.conf.
 *
 * The first two setup stages intentionally use Splunk's REST endpoints from a
 * static Simple XML view. This keeps setup available before the React
 * dashboard framework is initialized. Macro Index Tuning is the final stage
 * and is responsible for setting setup.conf is_configured=1.
 */
const SCD_SETUP_APP = "splunk-cisco-dashboards";
const SCD_SETUP_HOME_VIEW = "secure_networking_overview";
const SCD_SETUP_TUNING_VIEW = "macro_index_tuning";
const SCD_SETUP_DISCOVERY_SEARCH = [
  '| tstats count max(_time) AS latest WHERE index=* sourcetype="cisco:*" BY index sourcetype',
  "| sort - count",
].join("\n");

const SCD_SETUP_DEPENDENCIES = [
  {
    id: "cim",
    name: "Splunk Common Information Model",
    appIds: ["Splunk_SA_CIM"],
    always: true,
    importance: "required",
    purpose:
      "Required for normalized authentication and network traffic fields used by the dashboards.",
  },
  {
    id: "ai-toolkit",
    name: "Splunk AI Toolkit",
    appIds: ["Splunk_ML_Toolkit", "Splunk AI Toolkit"],
    always: true,
    importance: "recommended",
    splunkbase: "https://splunkbase.splunk.com/app/2890",
    purpose:
      "Required by forecasting and anomaly-detection panels that use fit and apply.",
  },
  {
    id: "catalyst",
    name: "Cisco Enterprise Networking for Splunk Platform",
    appIds: ["cisco-catalyst-app", "TA_cisco_catalyst"],
    pattern: /^cisco:(?:dnac|catalyst:center):/i,
    importance: "required",
    splunkbase: "https://splunkbase.splunk.com/app/7539",
    purpose:
      "Provides Cisco Catalyst data mappings and the Cisco_Catalyst_App data model.",
  },
  {
    id: "asa",
    name: "Splunk Add-on for Cisco ASA",
    appIds: ["Splunk_TA_cisco-asa"],
    pattern: /^cisco:(?:asa|ftd)(?::|$)/i,
    importance: "required",
    splunkbase:
      "https://splunkbase.splunk.com/apps/#/search/Splunk%20Add-on%20for%20Cisco%20ASA/",
    purpose: "Parses and normalizes ASA and FTD syslog.",
  },
  {
    id: "security-cloud",
    name: "Cisco Security Cloud",
    appIds: ["CiscoSecurityCloud"],
    pattern:
      /^cisco:(?:duo|sfw|estreamer|sourcefire|firepower|nvm|sna|xdr|cloud_security|umbrella|secure:workload|ai:defense|etd|cvi|cii|sca)(?::|$)/i,
    importance: "required",
    splunkbase: "https://splunkbase.splunk.com/app/7404",
    purpose:
      "The supported package for Cisco Duo, Secure Firewall eStreamer, and other Cisco security integrations.",
  },
  {
    id: "thousandeyes",
    name: "Cisco ThousandEyes App for Splunk",
    appIds: ["ta_cisco_thousandeyes"],
    pattern: /^cisco:thousandeyes(?::|$)/i,
    importance: "required",
    splunkbase: "https://splunkbase.splunk.com/app/7719",
    purpose:
      "Provides ThousandEyes data models and the macros used by tstats-backed panels.",
  },
  {
    id: "spaces",
    name: "Cisco Spaces Firehose Add-on",
    appIds: ["TA_cisco_spaces", "Cisco_Spaces", "cisco-spaces-firehose"],
    pattern: /^cisco:spaces(?::|$)/i,
    importance: "required",
    splunkbase:
      "https://splunkbase.splunk.com/apps/#/search/Cisco%20Spaces/",
    purpose: "Collects and parses Cisco Spaces Firehose events.",
  },
  {
    id: "intersight",
    name: "Cisco Intersight integration",
    appIds: ["Splunk_TA_cisco_intersight", "TA_cisco_intersight"],
    pattern: /^cisco:intersight(?::|$)/i,
    importance: "required",
    splunkbase:
      "https://splunkbase.splunk.com/apps/#/search/Cisco%20Intersight/",
    purpose: "Collects Cisco Intersight inventory and advisory events.",
  },
  {
    id: "sdwan",
    name: "Cisco SD-WAN integration",
    appIds: ["cisco-catalyst-app", "TA_cisco_sdwan", "Cisco_SD_WAN"],
    pattern: /^cisco:sdwan(?::|$)/i,
    importance: "required",
    splunkbase:
      "https://splunkbase.splunk.com/apps/#/search/Cisco%20SD-WAN/",
    purpose: "Provides Cisco SD-WAN collection and field mappings.",
  },
];

function scdSetupLocalePrefix(pathname) {
  const match = String(pathname || "").match(/^\/([a-z]{2}-[A-Z]{2})(?:\/|$)/);
  return `/${match ? match[1] : "en-US"}`;
}

function scdSetupEndpoint(pathname) {
  return `${scdSetupLocalePrefix(
    pathname,
  )}/splunkd/__raw/servicesNS/nobody/${encodeURIComponent(
    SCD_SETUP_APP,
  )}/configs/conf-setup/install?output_mode=json`;
}

function scdSetupAppsEndpoint(pathname) {
  return `${scdSetupLocalePrefix(
    pathname,
  )}/splunkd/__raw/services/apps/local?count=0&output_mode=json`;
}

function scdSetupDiscoveryEndpoint(pathname) {
  return `${scdSetupLocalePrefix(
    pathname,
  )}/splunkd/__raw/servicesNS/nobody/${encodeURIComponent(
    SCD_SETUP_APP,
  )}/search/jobs/export`;
}

function scdSetupHomeUrl(pathname) {
  return `${scdSetupLocalePrefix(pathname)}/app/${encodeURIComponent(
    SCD_SETUP_APP,
  )}/${SCD_SETUP_HOME_VIEW}`;
}

function scdSetupTuningUrl(pathname) {
  return `${scdSetupLocalePrefix(pathname)}/app/${encodeURIComponent(
    SCD_SETUP_APP,
  )}/${SCD_SETUP_TUNING_VIEW}?setup=1`;
}

function scdSetupManageAppsUrl(pathname) {
  return `${scdSetupLocalePrefix(pathname)}/manager/system/apps/local`;
}

function scdSetupIsConfigured(payload) {
  const entry = payload && payload.entry && payload.entry[0];
  const value = entry && entry.content && entry.content.is_configured;
  return value === "1" || value === 1 || value === true || value === "true";
}

function scdSetupCsrfToken() {
  const runtime = window.$C || {};
  const bootstrapToken =
    runtime.FORM_KEY ||
    runtime.form_key ||
    runtime.SPLUNKWEB_CSRF_TOKEN ||
    runtime.csrf_token;
  if (typeof bootstrapToken === "string" && bootstrapToken.trim()) {
    return bootstrapToken.trim();
  }

  const match = document.cookie.match(
    /(?:^|;\s*)splunkweb_csrf_token(?:_[^=;]+)?=([^;]+)/,
  );
  return match ? decodeURIComponent(match[1]) : "";
}

function scdSetupRequestHeaders(isPost) {
  const headers = {
    Accept: "application/json",
    "X-Requested-With": "XMLHttpRequest",
  };
  if (isPost) {
    headers["Content-Type"] =
      "application/x-www-form-urlencoded; charset=UTF-8";
    const csrfToken = scdSetupCsrfToken();
    if (csrfToken) {
      headers["X-Splunk-Form-Key"] = csrfToken;
    }
  }
  return headers;
}

function scdSetupRequest(method) {
  const isPost = method === "POST";
  const options = {
    method,
    credentials: "include",
    headers: scdSetupRequestHeaders(isPost),
  };
  if (isPost) {
    options.body = "is_configured=1";
  }

  return fetch(scdSetupEndpoint(window.location.pathname), options).then(
    (response) => {
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return response.json();
    },
  );
}

function scdSetupParseExportRows(payload) {
  if (!payload) {
    return [];
  }
  const records = [];
  if (typeof payload === "string") {
    payload
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .forEach((line) => {
        try {
          records.push(JSON.parse(line));
        } catch (_error) {
          // Streaming export may include non-JSON progress lines.
        }
      });
  } else if (Array.isArray(payload)) {
    records.push(...payload);
  } else if (typeof payload === "object") {
    records.push(payload);
  }

  return records
    .flatMap((record) => {
      if (Array.isArray(record.results)) {
        return record.results;
      }
      return record.result ? [record.result] : [];
    })
    .map((row) => ({
      index: String(row.index || "").trim(),
      sourcetype: String(row.sourcetype || "").trim(),
      count: Number(String(row.count || "0").replace(/,/g, "")) || 0,
      latest: Number(row.latest) || 0,
    }))
    .filter((row) => row.sourcetype);
}

function scdSetupDiscoverCiscoData() {
  const body = new URLSearchParams({
    search: SCD_SETUP_DISCOVERY_SEARCH,
    earliest_time: "-30d@d",
    latest_time: "now",
    output_mode: "json",
  }).toString();

  return fetch(scdSetupDiscoveryEndpoint(window.location.pathname), {
    method: "POST",
    credentials: "include",
    headers: scdSetupRequestHeaders(true),
    body,
  }).then((response) => {
    if (!response.ok) {
      throw new Error(`Cisco data scan failed (HTTP ${response.status}).`);
    }
    return response.text().then(scdSetupParseExportRows);
  });
}

function scdSetupLoadApps() {
  return fetch(scdSetupAppsEndpoint(window.location.pathname), {
    credentials: "include",
    headers: scdSetupRequestHeaders(false),
  }).then((response) => {
    if (!response.ok) {
      throw new Error(`App inventory failed (HTTP ${response.status}).`);
    }
    return response.json().then((payload) => payload.entry || []);
  });
}

function scdSetupNormalizeVersion(value) {
  return String(value || "").trim().replace(/^v/i, "");
}

function scdSetupCompareVersions(left, right) {
  const parse = (value) => {
    const normalized = scdSetupNormalizeVersion(value);
    if (!/^\d+(?:\.\d+)*(?:-[0-9A-Za-z.-]+)?$/.test(normalized)) {
      return null;
    }
    const parts = normalized.split("-", 2);
    return {
      core: parts[0].split(".").map(Number),
      prerelease: parts[1] || "",
    };
  };
  const leftVersion = parse(left);
  const rightVersion = parse(right);
  if (!leftVersion || !rightVersion) {
    return null;
  }
  const length = Math.max(leftVersion.core.length, rightVersion.core.length);
  for (let index = 0; index < length; index += 1) {
    const leftPart = leftVersion.core[index] || 0;
    const rightPart = rightVersion.core[index] || 0;
    if (leftPart > rightPart) {
      return 1;
    }
    if (leftPart < rightPart) {
      return -1;
    }
  }
  if (leftVersion.prerelease === rightVersion.prerelease) {
    return 0;
  }
  if (!leftVersion.prerelease) {
    return 1;
  }
  if (!rightVersion.prerelease) {
    return -1;
  }
  return leftVersion.prerelease > rightVersion.prerelease ? 1 : -1;
}

function scdSetupResolvePrerequisites(rows, appEntries) {
  const sourcetypes = Array.from(
    new Set(rows.map((row) => row.sourcetype)),
  );
  const installedById = new Map(
    (appEntries || []).map((entry) => [
      String(entry.name || "").toLowerCase(),
      entry,
    ]),
  );
  const resolved = SCD_SETUP_DEPENDENCIES.filter((dependency) => {
    if (dependency.always) {
      return true;
    }
    const matches = sourcetypes.filter(
      (sourcetype) =>
        dependency.pattern && dependency.pattern.test(sourcetype),
    );
    return matches.length > 0;
  }).map((dependency) => {
    const installed = dependency.appIds
      .map((appId) => installedById.get(appId.toLowerCase()))
      .find(Boolean);
    const content = (installed && installed.content) || {};
    const installedVersion = scdSetupNormalizeVersion(content.version);
    const updateVersion = scdSetupNormalizeVersion(
      content["update.version"] ||
        (content.update && content.update.version),
    );
    const hasUpdate =
      installedVersion &&
      updateVersion &&
      scdSetupCompareVersions(updateVersion, installedVersion) === 1;
    const disabled =
      content.disabled === true ||
      content.disabled === 1 ||
      content.disabled === "1" ||
      content.disabled === "true";
    let status = "missing";
    if (!dependency.appIds.length) {
      status = "verify";
    } else if (installed && disabled) {
      status = "disabled";
    } else if (installed && hasUpdate) {
      status = "update";
    } else if (installed) {
      status = "installed";
    }

    return {
      ...dependency,
      status,
      installedId: installed ? String(installed.name || "") : "",
      installedVersion,
      updateVersion: hasUpdate ? updateVersion : "",
      sourcetypes: sourcetypes.filter(
        (sourcetype) =>
          dependency.pattern && dependency.pattern.test(sourcetype),
      ),
    };
  });

  return resolved;
}

function scdSetupElement(tagName, className, text) {
  const element = document.createElement(tagName);
  if (className) {
    element.className = className;
  }
  if (text !== undefined && text !== null) {
    element.textContent = text;
  }
  return element;
}

function scdSetupLink(className, text, href) {
  const link = scdSetupElement("a", className, text);
  link.href = href;
  return link;
}

function scdSetupShowError(root, message) {
  const alert = scdSetupElement("div", "scd-setup__alert", message);
  alert.setAttribute("role", "alert");
  root.appendChild(alert);
}

function scdSetupFormatNumber(value) {
  return new Intl.NumberFormat().format(Number(value) || 0);
}

function scdSetupStatusLabel(prerequisite) {
  if (prerequisite.status === "installed") {
    return prerequisite.installedVersion
      ? `Installed v${prerequisite.installedVersion}`
      : "Installed";
  }
  if (prerequisite.status === "update") {
    return `Update to v${prerequisite.updateVersion}`;
  }
  if (prerequisite.status === "disabled") {
    return "Installed but disabled";
  }
  if (prerequisite.status === "verify") {
    return "Verify ingest tier";
  }
  return prerequisite.importance === "recommended"
    ? "Not installed (optional)"
    : "Not found on search head";
}

function scdSetupRenderStepper(parent, activeStep) {
  const steps = scdSetupElement("ol", "scd-setup__steps");
  [
    ["1", "Discover data"],
    ["2", "Validate add-ons"],
    ["3", "Tune indexes"],
  ].forEach(([number, label], index) => {
    let stateClass = "";
    if (index + 1 < activeStep) {
      stateClass = "is-complete";
    } else if (index + 1 === activeStep) {
      stateClass = "is-active";
    }
    const item = scdSetupElement(
      "li",
      stateClass,
    );
    item.appendChild(scdSetupElement("span", "", number));
    item.appendChild(document.createTextNode(label));
    steps.appendChild(item);
  });
  parent.appendChild(steps);
}

function scdSetupSetActiveStep(root, activeStep) {
  const header = root.querySelector(".scd-setup__header");
  const current = header && header.querySelector(".scd-setup__steps");
  if (!header) {
    return;
  }
  if (current) {
    current.remove();
  }
  scdSetupRenderStepper(header, activeStep);
}

function scdSetupRenderSourceTable(parent, rows) {
  if (!rows.length) {
    const empty = scdSetupElement("div", "scd-setup__empty");
    empty.appendChild(
      scdSetupElement("strong", "", "No cisco:* data found in the last 30 days."),
    );
    empty.appendChild(
      scdSetupElement(
        "p",
        "",
        "You can continue to index tuning. Before production use, confirm that Cisco inputs are sending data to searchable indexes.",
      ),
    );
    parent.appendChild(empty);
    return;
  }

  const tableWrap = scdSetupElement("div", "scd-setup__table-wrap");
  const table = scdSetupElement("table", "scd-setup__table");
  const head = scdSetupElement("thead");
  const headRow = scdSetupElement("tr");
  ["Sourcetype", "Index", "Events", "Last seen"].forEach((label) => {
    headRow.appendChild(scdSetupElement("th", "", label));
  });
  head.appendChild(headRow);
  table.appendChild(head);
  const body = scdSetupElement("tbody");
  rows.slice(0, 12).forEach((row) => {
    const tr = scdSetupElement("tr");
    tr.appendChild(scdSetupElement("td", "scd-setup__mono", row.sourcetype));
    tr.appendChild(scdSetupElement("td", "scd-setup__mono", row.index));
    tr.appendChild(scdSetupElement("td", "", scdSetupFormatNumber(row.count)));
    tr.appendChild(
      scdSetupElement(
        "td",
        "",
        row.latest ? new Date(row.latest * 1000).toLocaleString() : "Unknown",
      ),
    );
    body.appendChild(tr);
  });
  table.appendChild(body);
  tableWrap.appendChild(table);
  parent.appendChild(tableWrap);
  if (rows.length > 12) {
    parent.appendChild(
      scdSetupElement(
        "p",
        "scd-setup__caption",
        `Showing the 12 busiest of ${rows.length} detected sourcetype/index pairs.`,
      ),
    );
  }
}

function scdSetupRenderPrerequisites(parent, prerequisites, appsError) {
  if (appsError) {
    const warning = scdSetupElement("div", "scd-setup__warning");
    warning.setAttribute("role", "status");
    warning.textContent =
      "The search-head app inventory could not be read. Continue if your administrator has verified the required apps and collection-tier TAs.";
    parent.appendChild(warning);
  }

  const list = scdSetupElement("div", "scd-setup__requirements");
  prerequisites.forEach((prerequisite) => {
    const row = scdSetupElement(
      "article",
      `scd-setup__requirement is-${prerequisite.status}`,
    );
    const status = scdSetupElement(
      "span",
      "scd-setup__status",
      scdSetupStatusLabel(prerequisite),
    );
    const content = scdSetupElement("div", "scd-setup__requirement-copy");
    const heading = scdSetupElement("div", "scd-setup__requirement-heading");
    heading.appendChild(scdSetupElement("strong", "", prerequisite.name));
    if (prerequisite.importance === "recommended") {
      heading.appendChild(scdSetupElement("span", "", "Recommended"));
    }
    content.appendChild(heading);
    content.appendChild(scdSetupElement("p", "", prerequisite.purpose));
    if (prerequisite.sourcetypes && prerequisite.sourcetypes.length) {
      content.appendChild(
        scdSetupElement(
          "code",
          "",
          prerequisite.sourcetypes.slice(0, 5).join(", "),
        ),
      );
    }
    row.appendChild(content);
    row.appendChild(status);
    if (prerequisite.splunkbase) {
      const link = scdSetupLink(
        "scd-setup__external",
        prerequisite.status === "update" ? "Open update page" : "View package",
        prerequisite.splunkbase,
      );
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      row.appendChild(link);
    }
    list.appendChild(row);
  });
  parent.appendChild(list);
}

function scdSetupRenderResults(root, dataRows, appEntries, errors) {
  scdSetupSetActiveStep(root, 2);
  const content = root.querySelector(".scd-setup__content");
  content.textContent = "";

  const uniqueSourcetypes = new Set(dataRows.map((row) => row.sourcetype));
  const uniqueIndexes = new Set(dataRows.map((row) => row.index));
  const totalEvents = dataRows.reduce((sum, row) => sum + row.count, 0);
  const prerequisites = scdSetupResolvePrerequisites(dataRows, appEntries);
  const needsAttention = prerequisites.filter((item) =>
    ["missing", "disabled", "update"].includes(item.status),
  ).length;

  const discoverySection = scdSetupElement("section", "scd-setup__section");
  const discoveryHeader = scdSetupElement("div", "scd-setup__section-heading");
  const headingCopy = scdSetupElement("div");
  headingCopy.appendChild(
    scdSetupElement("p", "scd-setup__eyebrow", "STEP 1 · DISCOVER CISCO DATA"),
  );
  headingCopy.appendChild(scdSetupElement("h2", "", "What is already here?"));
  headingCopy.appendChild(
    scdSetupElement(
      "p",
      "",
      "The scan checks searchable cisco:* sourcetypes from the last 30 days. It does not read event payloads.",
    ),
  );
  discoveryHeader.appendChild(headingCopy);
  discoverySection.appendChild(discoveryHeader);

  if (errors.data) {
    const warning = scdSetupElement(
      "div",
      "scd-setup__warning",
      "Cisco data discovery could not run. Verify this user can search the target indexes, then rescan. You may still continue to macro tuning.",
    );
    warning.setAttribute("role", "status");
    discoverySection.appendChild(warning);
  } else {
    const metrics = scdSetupElement("div", "scd-setup__metrics");
    [
      [scdSetupFormatNumber(uniqueSourcetypes.size), "Cisco sourcetypes"],
      [scdSetupFormatNumber(uniqueIndexes.size), "Indexes"],
      [scdSetupFormatNumber(totalEvents), "Events in range"],
    ].forEach(([value, label]) => {
      const metric = scdSetupElement("div", "scd-setup__metric");
      metric.appendChild(scdSetupElement("strong", "", value));
      metric.appendChild(scdSetupElement("span", "", label));
      metrics.appendChild(metric);
    });
    discoverySection.appendChild(metrics);
    scdSetupRenderSourceTable(discoverySection, dataRows);
  }
  content.appendChild(discoverySection);

  const appsSection = scdSetupElement("section", "scd-setup__section");
  appsSection.appendChild(
    scdSetupElement("p", "scd-setup__eyebrow", "STEP 2 · VALIDATE ADD-ONS"),
  );
  appsSection.appendChild(
    scdSetupElement("h2", "", "Search-head and collector readiness"),
  );
  appsSection.appendChild(
    scdSetupElement(
      "p",
      "scd-setup__section-intro",
      "Installed versions and Splunk-known updates are checked on this search head. Only integrations with a concrete supported package are listed here; all detected cisco:* data remains visible in the discovery inventory above.",
    ),
  );
  scdSetupRenderPrerequisites(appsSection, prerequisites, errors.apps);
  const appsLink = scdSetupLink(
    "scd-setup__secondary-link",
    "Open Manage Apps",
    scdSetupManageAppsUrl(window.location.pathname),
  );
  appsLink.target = "_blank";
  appsLink.rel = "noopener noreferrer";
  appsSection.appendChild(appsLink);
  content.appendChild(appsSection);

  const actions = root.querySelector(".scd-setup__actions");
  actions.textContent = "";
  const rescan = scdSetupElement("button", "scd-setup__button is-secondary", "Rescan");
  rescan.type = "button";
  // The rescan callback runs only after all setup functions are initialized.
  // eslint-disable-next-line no-use-before-define
  rescan.addEventListener("click", () => scdSetupLoad(root));
  const continueButton = scdSetupElement(
    "a",
    "scd-setup__button",
    "Next: tune indexes",
  );
  continueButton.href = scdSetupTuningUrl(window.location.pathname);
  actions.appendChild(rescan);
  actions.appendChild(continueButton);
  const summary = scdSetupElement(
    "p",
    "scd-setup__action-note",
    needsAttention
      ? `${needsAttention} item${needsAttention === 1 ? "" : "s"} need attention. Setup can continue while you verify collector placement.`
      : "Discovery is complete. The next step will save index macros before unlocking the app.",
  );
  actions.appendChild(summary);
}

function scdSetupLoad(root) {
  scdSetupSetActiveStep(root, 1);
  const content = root.querySelector(".scd-setup__content");
  const actions = root.querySelector(".scd-setup__actions");
  content.textContent = "";
  actions.textContent = "";
  const loading = scdSetupElement("div", "scd-setup__loading");
  loading.appendChild(scdSetupElement("span", "scd-setup__spinner"));
  loading.appendChild(
    scdSetupElement(
      "div",
      "",
      "Discovering Cisco sourcetypes and checking installed apps…",
    ),
  );
  content.appendChild(loading);

  Promise.all([
    scdSetupDiscoverCiscoData()
      .then((rows) => ({ rows, error: null }))
      .catch((error) => ({ rows: [], error })),
    scdSetupLoadApps()
      .then((entries) => ({ entries, error: null }))
      .catch((error) => ({ entries: [], error })),
  ]).then(([data, apps]) => {
    scdSetupRenderResults(root, data.rows, apps.entries, {
      data: data.error,
      apps: apps.error,
    });
  });
}

function scdSetupRender(root) {
  const mountRoot = root;
  mountRoot.textContent = "";
  const shell = scdSetupElement("section", "scd-setup__shell");
  const header = scdSetupElement("header", "scd-setup__header");
  const brand = scdSetupElement("div", "scd-setup__brand");
  const mark = scdSetupElement("div", "scd-setup__mark", "SN");
  mark.setAttribute("aria-hidden", "true");
  const brandCopy = scdSetupElement("div");
  brandCopy.appendChild(
    scdSetupElement("p", "scd-setup__eyebrow", "INITIAL SETUP"),
  );
  brandCopy.appendChild(
    scdSetupElement("h1", "", "Connect the app to your Cisco data"),
  );
  brandCopy.appendChild(
    scdSetupElement(
      "p",
      "",
      "Discover what is already indexed, validate the supporting apps, then tune index macros. Nothing is changed until the final step.",
    ),
  );
  brand.appendChild(mark);
  brand.appendChild(brandCopy);
  header.appendChild(brand);
  scdSetupRenderStepper(header, 1);
  shell.appendChild(header);
  shell.appendChild(scdSetupElement("div", "scd-setup__content"));
  shell.appendChild(scdSetupElement("footer", "scd-setup__actions"));
  mountRoot.appendChild(shell);
  scdSetupLoad(mountRoot);
}

function scdSetupStart() {
  const root = document.getElementById("scd-setup-root");
  if (!root) {
    return;
  }

  scdSetupRequest("GET")
    .then((payload) => {
      if (scdSetupIsConfigured(payload)) {
        window.location.replace(scdSetupHomeUrl(window.location.pathname));
        return;
      }
      scdSetupRender(root);
    })
    .catch(() => {
      root.textContent = "";
      scdSetupShowError(
        root,
        "Setup status could not be loaded. Refresh the page or contact a Splunk administrator.",
      );
    });
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  scdSetupStart();
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    appsEndpoint: scdSetupAppsEndpoint,
    compareVersions: scdSetupCompareVersions,
    csrfToken: scdSetupCsrfToken,
    discoveryEndpoint: scdSetupDiscoveryEndpoint,
    endpoint: scdSetupEndpoint,
    homeUrl: scdSetupHomeUrl,
    isConfigured: scdSetupIsConfigured,
    localePrefix: scdSetupLocalePrefix,
    parseExportRows: scdSetupParseExportRows,
    resolvePrerequisites: scdSetupResolvePrerequisites,
    tuningUrl: scdSetupTuningUrl,
  };
}
