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
const SCD_SETUP_HOME_VIEW = "secure_networking_profile";
const SCD_SETUP_TUNING_VIEW = "macro_index_tuning";
const SCD_SETUP_DISCOVERY_SEARCH = [
  '| tstats count max(_time) AS latest WHERE index=* sourcetype="cisco:*" BY index sourcetype',
  "| sort - count",
].join("\n");

const SCD_SETUP_DEPENDENCIES = [
  {
    id: "dc-networking",
    name: "Cisco DC Networking App for Splunk",
    appIds: ["cisco_dc_networking_app_for_splunk"],
    always: true,
    importance: "required",
    splunkbase:
      "https://splunkbase.splunk.com/apps/#/search/Cisco%20DC%20Networking/",
    purpose:
      "Provides the data-center networking searches and dashboards used by Searchbase.",
  },
  {
    id: "catalyst-app",
    name: "Cisco Enterprise Networking for Splunk Platform",
    appIds: ["cisco-catalyst-app"],
    always: true,
    importance: "required",
    splunkbase: "https://splunkbase.splunk.com/app/7539",
    purpose: "Provides Cisco Catalyst search content and data models.",
  },
  {
    id: "security-cloud",
    name: "Cisco Security Cloud",
    appIds: ["CiscoSecurityCloud"],
    always: true,
    importance: "required",
    splunkbase: "https://splunkbase.splunk.com/app/7404",
    purpose: "Provides the supported Cisco security integrations and searches.",
  },
  {
    id: "searchbase",
    name: "Searchbase App for Splunk",
    appIds: ["searchbase"],
    always: true,
    importance: "required",
    splunkbase:
      "https://splunkbase.splunk.com/apps/#/search/Searchbase%20App%20for%20Splunk/",
    purpose: "Supplies the shared search layer used by this app.",
  },
  {
    id: "ai-toolkit",
    name: "Splunk AI Toolkit",
    appIds: ["Splunk_ML_Toolkit", "Splunk AI Toolkit"],
    always: true,
    importance: "required",
    splunkbase: "https://splunkbase.splunk.com/app/2890",
    purpose: "Runs forecasting and anomaly-detection searches.",
  },
  {
    id: "scientific-python",
    name: "Python for Scientific Computing",
    appIds: [],
    appIdPrefix: "Splunk_SA_Scientific_Python_",
    displayId: "Splunk_SA_Scientific_Python_<os>",
    always: true,
    importance: "required",
    splunkbase:
      "https://splunkbase.splunk.com/apps/#/search/Python%20for%20Scientific%20Computing/",
    purpose:
      "Provides the OS-specific Python runtime required by Splunk AI Toolkit.",
  },
  {
    id: "meraki-ta",
    name: "Cisco Meraki Add-on for Splunk",
    appIds: ["Splunk_TA_cisco_meraki"],
    always: true,
    importance: "required",
    splunkbase:
      "https://splunkbase.splunk.com/apps/#/search/Cisco%20Meraki%20Add-on/",
    purpose: "Collects and normalizes Cisco Meraki data.",
  },
  {
    id: "windows-ta",
    name: "Splunk Add-on for Microsoft Windows",
    appIds: ["Splunk_TA_windows"],
    always: true,
    importance: "required",
    splunkbase:
      "https://splunkbase.splunk.com/apps/#/search/Splunk%20Add-on%20for%20Microsoft%20Windows/",
    purpose: "Provides Windows host data used by cross-domain Searchbase content.",
  },
  {
    id: "catalyst-ta",
    name: "Cisco Catalyst Add-on for Splunk",
    appIds: ["TA_cisco_catalyst"],
    always: true,
    importance: "required",
    splunkbase:
      "https://splunkbase.splunk.com/apps/#/search/Cisco%20Catalyst%20Add-on/",
    purpose: "Collects and normalizes Cisco Catalyst data.",
  },
  {
    id: "spaces-ta",
    name: "Cisco Spaces Add-on for Splunk",
    appIds: ["ta_cisco_spaces"],
    always: true,
    importance: "required",
    splunkbase:
      "https://splunkbase.splunk.com/apps/#/search/Cisco%20Spaces/",
    purpose: "Collects and parses Cisco Spaces Firehose events.",
  },
  {
    id: "thousandeyes-ta",
    name: "Cisco ThousandEyes App for Splunk",
    appIds: ["ta_cisco_thousandeyes"],
    always: true,
    importance: "required",
    splunkbase: "https://splunkbase.splunk.com/app/7719",
    purpose: "Provides ThousandEyes data models and macros.",
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

function scdSetupAppUrl(pathname, appId) {
  return `${scdSetupLocalePrefix(pathname)}/app/${encodeURIComponent(appId)}`;
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
    const installed =
      dependency.appIds
        .map((appId) => installedById.get(appId.toLowerCase()))
        .find(Boolean) ||
      (dependency.appIdPrefix
        ? (appEntries || []).find((entry) =>
            String(entry.name || "")
              .toLowerCase()
              .startsWith(dependency.appIdPrefix.toLowerCase()),
          )
        : null);
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
    if (!dependency.appIds.length && !dependency.appIdPrefix) {
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
    ["1", "Check data"],
    ["2", "Review packages"],
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
    content.appendChild(heading);
    content.appendChild(
      scdSetupElement(
        "code",
        "",
        prerequisite.displayId || prerequisite.appIds[0] || prerequisite.id,
      ),
    );
    row.title = prerequisite.purpose;
    row.dataset.appId =
      prerequisite.displayId || prerequisite.appIds[0] || prerequisite.id;
    row.appendChild(content);
    row.appendChild(status);
    if (prerequisite.splunkbase) {
      const link = scdSetupLink(
        "scd-setup__external",
        prerequisite.status === "update" ? "Update" : "Package",
        prerequisite.splunkbase,
      );
      link.setAttribute("aria-label", `View ${prerequisite.name} on Splunkbase`);
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
    ["missing", "disabled", "update", "verify"].includes(item.status),
  ).length;
  const readyCount = prerequisites.length - needsAttention;
  const navigatorInstalled = (appEntries || []).some(
    (entry) =>
      String(entry.name || "").toLowerCase() ===
      "splunk-cisco-app-navigator",
  );

  const workspace = scdSetupElement("div", "scd-setup__workspace");
  const main = scdSetupElement("main", "scd-setup__main");
  const aside = scdSetupElement("aside", "scd-setup__aside");

  const readinessSection = scdSetupElement(
    "section",
    "scd-setup__section scd-setup__readiness",
  );
  const readinessCopy = scdSetupElement("div");
  readinessCopy.appendChild(
    scdSetupElement("p", "scd-setup__eyebrow", "SEARCHBASE READINESS"),
  );
  readinessCopy.appendChild(
    scdSetupElement("h2", "", `${readyCount} of ${prerequisites.length} packages ready`),
  );
  readinessCopy.appendChild(
    scdSetupElement(
      "p",
      "scd-setup__section-intro",
      "These are the high-priority apps and add-ons used by searchbase.conf.",
    ),
  );
  readinessSection.appendChild(readinessCopy);
  const readinessMetrics = scdSetupElement("div", "scd-setup__metrics");
  [
    [scdSetupFormatNumber(prerequisites.length), "Priority"],
    [scdSetupFormatNumber(readyCount), "Ready"],
    [scdSetupFormatNumber(needsAttention), "Attention"],
  ].forEach(([value, label]) => {
    const metric = scdSetupElement("div", "scd-setup__metric");
    metric.appendChild(scdSetupElement("strong", "", value));
    metric.appendChild(scdSetupElement("span", "", label));
    readinessMetrics.appendChild(metric);
  });
  readinessSection.appendChild(readinessMetrics);
  main.appendChild(readinessSection);

  const appsSection = scdSetupElement("section", "scd-setup__section");
  const appsHeader = scdSetupElement("div", "scd-setup__section-heading");
  const appsHeadingCopy = scdSetupElement("div");
  appsHeadingCopy.appendChild(
    scdSetupElement("p", "scd-setup__eyebrow", "PRIORITY APPS & ADD-ONS"),
  );
  appsHeadingCopy.appendChild(
    scdSetupElement("h2", "", "Package checklist"),
  );
  appsHeadingCopy.appendChild(
    scdSetupElement(
      "p",
      "scd-setup__section-intro",
      "Technical IDs stay visible so administrators can match deployment packages exactly.",
    ),
  );
  appsHeader.appendChild(appsHeadingCopy);
  const appsLink = scdSetupLink(
    "scd-setup__secondary-link",
    "Manage Apps",
    scdSetupManageAppsUrl(window.location.pathname),
  );
  appsLink.target = "_blank";
  appsLink.rel = "noopener noreferrer";
  appsHeader.appendChild(appsLink);
  appsSection.appendChild(appsHeader);
  scdSetupRenderPrerequisites(appsSection, prerequisites, errors.apps);
  main.appendChild(appsSection);

  const navigatorSection = scdSetupElement(
    "section",
    "scd-setup__scan",
  );
  navigatorSection.appendChild(
    scdSetupElement("p", "scd-setup__eyebrow", "COMPANION APP"),
  );
  navigatorSection.appendChild(
    scdSetupElement("h2", "", "Splunk Cisco App Navigator"),
  );
  navigatorSection.appendChild(
    scdSetupElement(
      "p",
      "",
      "Your front door to 50+ Cisco integrations, with package selection, data-flow, platform, and tier guidance.",
    ),
  );
  const navigatorLinks = scdSetupElement("div", "scd-setup__scan-links");
  if (navigatorInstalled) {
    navigatorLinks.appendChild(
      scdSetupLink(
        "scd-setup__button is-scan",
        "Open App Navigator",
        scdSetupAppUrl(window.location.pathname, "splunk-cisco-app-navigator"),
      ),
    );
  }
  const navigatorLink = scdSetupLink(
    "scd-setup__external is-inverse",
    "View on Splunkbase",
    "https://splunkbase.splunk.com/app/8566",
  );
  navigatorLink.target = "_blank";
  navigatorLink.rel = "noopener noreferrer";
  navigatorLinks.appendChild(navigatorLink);
  navigatorSection.appendChild(navigatorLinks);
  aside.appendChild(navigatorSection);

  const discoverySection = scdSetupElement(
    "details",
    "scd-setup__disclosure",
  );
  const discoverySummary = scdSetupElement("summary", "");
  const discoverySummaryCopy = scdSetupElement("span");
  discoverySummaryCopy.appendChild(
    scdSetupElement("strong", "", "Discovered Cisco data"),
  );
  discoverySummaryCopy.appendChild(
    scdSetupElement(
      "small",
      "",
      errors.data
        ? "Scan unavailable"
        : `${scdSetupFormatNumber(uniqueSourcetypes.size)} sourcetypes · ${scdSetupFormatNumber(uniqueIndexes.size)} indexes · ${scdSetupFormatNumber(totalEvents)} events`,
    ),
  );
  discoverySummary.appendChild(discoverySummaryCopy);
  discoverySection.appendChild(discoverySummary);
  const discoveryBody = scdSetupElement("div", "scd-setup__discovery-body");

  if (errors.data) {
    const warning = scdSetupElement(
      "div",
      "scd-setup__warning",
      "Cisco data discovery could not run. Verify this user can search the target indexes, then rescan. You may still continue to macro tuning.",
    );
    warning.setAttribute("role", "status");
    discoveryBody.appendChild(warning);
  } else {
    discoveryBody.appendChild(
      scdSetupElement(
        "p",
        "scd-setup__caption",
        "The 30-day scan reads metadata only; event payloads are not inspected.",
      ),
    );
    scdSetupRenderSourceTable(discoveryBody, dataRows);
  }
  discoverySection.appendChild(discoveryBody);
  aside.appendChild(discoverySection);

  workspace.appendChild(main);
  workspace.appendChild(aside);
  content.appendChild(workspace);

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
      ? `${needsAttention} package${needsAttention === 1 ? "" : "s"} need attention. You can continue while an administrator verifies deployment.`
      : "All priority packages are ready. Next, save the index macros that power the dashboards.",
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
  const brandCopy = scdSetupElement("div");
  brandCopy.appendChild(
    scdSetupElement(
      "p",
      "scd-setup__eyebrow",
      "SPLUNK CISCO DASHBOARDS · SETUP",
    ),
  );
  brandCopy.appendChild(
    scdSetupElement("h1", "", "Get ready to explore your Cisco environment"),
  );
  brandCopy.appendChild(
    scdSetupElement(
      "p",
      "",
      "Confirm the packages used by Searchbase, review discovered data, then tune index macros.",
    ),
  );
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
