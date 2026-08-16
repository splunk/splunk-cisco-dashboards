/* global module */

/**
 * First-run setup controller backed by setup.conf.
 *
 * Data discovery and package recommendations intentionally use Splunk's REST
 * endpoints from a static Simple XML view. This keeps setup available before
 * the React dashboard framework is initialized. The existing Macro Index
 * Tuning React experience mounts into the same Setup view for the final step
 * and is responsible for setting setup.conf is_configured=1.
 */
const SCD_SETUP_APP = "splunk-cisco-dashboards";
const SCD_SETUP_HOME_VIEW = "workspace_insights";
const SCD_SETUP_DISCOVERY_SEARCH = [
  '| tstats count max(_time) AS latest WHERE index=* (sourcetype="cisco:*" OR sourcetype="meraki:*" OR sourcetype="WinEventLog:*" OR sourcetype="XmlWinEventLog:*" OR sourcetype="linux:*" OR sourcetype="nix:*") BY index sourcetype',
  "| sort - count",
].join("\n");

const SCD_SETUP_DEPENDENCIES = [
  {
    id: "searchbase",
    name: "Searchbase App for Splunk",
    appIds: ["searchbase"],
    always: true,
    importance: "mandatory",
    splunkbase:
      "https://splunkbase.splunk.com/apps/#/search/Searchbase%20App%20for%20Splunk/",
    purpose:
      "Mandatory foundation. Dashboards depend on its shared search catalog and will break without it.",
  },
  {
    id: "cim",
    name: "Splunk Common Information Model",
    appIds: ["Splunk_SA_CIM"],
    always: true,
    importance: "required",
    purpose:
      "Provides the normalized authentication and network fields shared by the dashboards.",
  },
  {
    id: "ai-toolkit",
    name: "Splunk AI Toolkit",
    appIds: ["Splunk_ML_Toolkit", "Splunk AI Toolkit"],
    always: true,
    importance: "recommended",
    splunkbase: "https://splunkbase.splunk.com/app/2890",
    purpose: "Enables forecasting and anomaly-detection panels.",
  },
  {
    id: "scientific-python",
    name: "Python for Scientific Computing",
    appIds: [],
    appIdPrefix: "Splunk_SA_Scientific_Python_",
    displayId: "Splunk_SA_Scientific_Python_<os>",
    always: true,
    importance: "recommended",
    splunkbase:
      "https://splunkbase.splunk.com/apps/#/search/Python%20for%20Scientific%20Computing/",
    purpose: "Provides the OS-specific runtime used by Splunk AI Toolkit.",
  },
  {
    id: "dc-networking",
    name: "Cisco DC Networking App for Splunk",
    appIds: ["cisco_dc_networking_app_for_splunk"],
    pattern: /^cisco:(?:dc:)?(?:aci|nd|ndfc|nexus(?:9k)?)(?::|$)/i,
    importance: "required",
    splunkbase:
      "https://splunkbase.splunk.com/apps/#/search/Cisco%20DC%20Networking/",
    purpose: "Provides data-center networking searches and data models.",
    impact: "Secure Infrastructure fabric, anomaly, and inventory panels",
  },
  {
    id: "catalyst-app",
    name: "Cisco Enterprise Networking for Splunk Platform",
    appIds: ["cisco-catalyst-app"],
    pattern: /^cisco:(?:dnac|catalyst|sdwan)(?::|$)/i,
    importance: "required",
    splunkbase: "https://splunkbase.splunk.com/app/7539",
    purpose: "Provides Catalyst Center and SD-WAN search content and data models.",
    impact: "Network readiness, access, SD-WAN, and inventory panels",
  },
  {
    id: "catalyst-ta",
    name: "Cisco Catalyst Add-on for Splunk",
    appIds: ["TA_cisco_catalyst"],
    pattern: /^cisco:(?:dnac|catalyst|sdwan)(?::|$)/i,
    importance: "required",
    splunkbase:
      "https://splunkbase.splunk.com/apps/#/search/Cisco%20Catalyst%20Add-on/",
    purpose: "Collects and normalizes Catalyst Center data.",
    impact: "Network readiness, access, and Catalyst inventory panels",
  },
  {
    id: "security-cloud",
    name: "Cisco Security Cloud",
    appIds: ["CiscoSecurityCloud"],
    pattern:
      /^cisco:(?:asa|cloud_security|duo|estreamer|firepower|fmc|ftd|ise|multicloud:defense|nvm|secure:workload|secure_access|sfw|sna|sourcefire|umbrella|xdr)(?::|$)/i,
    importance: "required",
    splunkbase: "https://splunkbase.splunk.com/app/7404",
    purpose: "Provides supported Cisco security integrations and data models.",
    impact: "Zero Trust, firewall, identity, and Security Operations panels",
  },
  {
    id: "meraki-ta",
    name: "Cisco Meraki Add-on for Splunk",
    appIds: ["Splunk_TA_cisco_meraki"],
    pattern: /^(?:cisco:)?meraki(?::|$)/i,
    importance: "required",
    splunkbase:
      "https://splunkbase.splunk.com/apps/#/search/Cisco%20Meraki%20Add-on/",
    purpose: "Collects and normalizes Cisco Meraki data.",
    impact: "Meraki wireless, access-point, SSID, and client panels",
  },
  {
    id: "spaces-ta",
    name: "Cisco Spaces Add-on for Splunk",
    appIds: ["ta_cisco_spaces", "TA_cisco_spaces", "Cisco_Spaces"],
    pattern: /^cisco:spaces(?::|$)/i,
    importance: "required",
    splunkbase:
      "https://splunkbase.splunk.com/apps/#/search/Cisco%20Spaces/",
    purpose: "Collects and parses Cisco Spaces events.",
    impact: "Workplace Intelligence, occupancy, and location panels",
  },
  {
    id: "thousandeyes-ta",
    name: "Cisco ThousandEyes App for Splunk",
    appIds: ["ta_cisco_thousandeyes"],
    pattern: /^cisco:thousandeyes(?::|$)/i,
    importance: "required",
    splunkbase: "https://splunkbase.splunk.com/app/7719",
    purpose: "Provides ThousandEyes data models and routing macros.",
    impact: "Digital experience, agent-test, path, and availability panels",
  },
  {
    id: "windows-ta",
    name: "Splunk Add-on for Microsoft Windows",
    appIds: ["Splunk_TA_windows"],
    pattern: /^(?:WinEventLog|XmlWinEventLog):/i,
    importance: "required",
    splunkbase:
      "https://splunkbase.splunk.com/apps/#/search/Splunk%20Add-on%20for%20Microsoft%20Windows/",
    purpose: "Normalizes Windows host and event-log data.",
    impact: "Cross-domain host health and Agentic Ops panels",
  },
  {
    id: "nix-ta",
    name: "Splunk Add-on for Unix and Linux",
    appIds: ["Splunk_TA_nix"],
    pattern: /^(?:linux|nix):/i,
    importance: "required",
    splunkbase: "https://splunkbase.splunk.com/app/833",
    purpose: "Normalizes Unix and Linux host data.",
    impact: "Cross-domain host health and Agentic Ops panels",
  },
];

const SCD_SETUP_CAPABILITIES = [
  {
    id: "identity",
    name: "Identity and segmentation",
    pattern: /^cisco:ise(?::|$)/i,
    impact: "Zero Trust Access and Scalable Network Segmentation",
  },
  {
    id: "enterprise-networking",
    name: "Enterprise networking",
    pattern: /^cisco:(?:dnac|catalyst|sdwan)(?::|$)/i,
    impact: "Network readiness, Catalyst inventory, and SD-WAN",
  },
  {
    id: "data-center",
    name: "Data-center networking",
    pattern: /^cisco:(?:dc:)?(?:aci|nd|ndfc|nexus(?:9k)?)(?::|$)/i,
    impact: "Secure Infrastructure fabric, anomaly, and inventory",
  },
  {
    id: "security",
    name: "Security and firewall",
    pattern:
      /^cisco:(?:asa|cloud_security|duo|estreamer|firepower|fmc|ftd|multicloud:defense|nvm|secure:workload|secure_access|sfw|sna|sourcefire|umbrella|xdr)(?::|$)/i,
    impact: "Hybrid Mesh Firewalling and Security Operations",
  },
  {
    id: "meraki",
    name: "Meraki",
    pattern: /^(?:cisco:)?meraki(?::|$)/i,
    impact: "Wireless, access-point, SSID, and client health",
  },
  {
    id: "thousandeyes",
    name: "ThousandEyes",
    pattern: /^cisco:thousandeyes(?::|$)/i,
    impact: "Digital experience, agent-test, path, and availability",
  },
  {
    id: "spaces",
    name: "Cisco Spaces",
    pattern: /^cisco:spaces(?::|$)/i,
    impact: "Workplace Intelligence, occupancy, and location",
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
  )}/setup?setup=1#tune-indexes`;
}

function scdSetupIsTuningHash(hash) {
  const setupRoute = String(hash || "").replace(/^#/, "");
  return setupRoute === "tune-indexes" || setupRoute === "tune-cim";
}

function scdSetupManageAppsUrl(pathname, appId) {
  const baseUrl = `${scdSetupLocalePrefix(pathname)}/manager/system/apps/local`;
  return appId
    ? `${baseUrl}?search=${encodeURIComponent(appId)}`
    : baseUrl;
}

function scdSetupAppInstallUrl(pathname, appId) {
  return `${scdSetupLocalePrefix(pathname)}/manager/appinstall/${encodeURIComponent(
    appId,
  )}`;
}

function scdSetupAppUrl(pathname, appId) {
  return `${scdSetupLocalePrefix(pathname)}/app/${encodeURIComponent(appId)}`;
}

function scdSetupIsConfigured(payload) {
  const entry = payload && payload.entry && payload.entry[0];
  const value = entry && entry.content && entry.content.is_configured;
  return value === "1" || value === 1 || value === true || value === "true";
}

function scdSetupIsOnDemand(search) {
  return new URLSearchParams(String(search || "")).get("setup") === "1";
}

function scdSetupShouldRender(payload, search) {
  return scdSetupIsOnDemand(search) || !scdSetupIsConfigured(payload);
}

function scdSetupCookieValue(name) {
  const encodedName = `${encodeURIComponent(name)}=`;
  const match = String(document.cookie || "")
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(encodedName));
  return match ? decodeURIComponent(match.slice(encodedName.length)) : "";
}

function scdSetupCsrfToken() {
  // Splunk Web scopes its CSRF cookie by web port. Browser cookies are shared
  // across ports, so a host running multiple Splunk instances can expose
  // several splunkweb_csrf_token_<port> values at once. Prefer the cookie for
  // the current page before the bootstrapped form key, which can be stale after
  // another instance on the same host refreshes its session.
  const currentPort = String(window.location?.port || "").trim();
  if (currentPort) {
    const portToken = scdSetupCookieValue(
      `splunkweb_csrf_token_${currentPort}`,
    );
    if (portToken) {
      return portToken;
    }
  }

  const unscopedToken = scdSetupCookieValue("splunkweb_csrf_token");
  if (unscopedToken) {
    return unscopedToken;
  }

  const runtime = window.$C || {};
  const bootstrapToken =
    runtime.FORM_KEY ||
    runtime.form_key ||
    runtime.SPLUNKWEB_CSRF_TOKEN ||
    runtime.csrf_token;
  if (typeof bootstrapToken === "string" && bootstrapToken.trim()) {
    return bootstrapToken.trim();
  }

  const suffixedTokens = String(document.cookie || "")
    .split(";")
    .map((part) => part.trim())
    .filter((part) => part.startsWith("splunkweb_csrf_token_"));
  return suffixedTokens.length === 1
    ? decodeURIComponent(suffixedTokens[0].split("=").slice(1).join("="))
    : "";
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

function scdSetupPatternMatches(pattern, value) {
  if (!pattern) {
    return false;
  }
  return pattern.test(String(value || ""));
}

function scdSetupMatchingSourcetypes(rows, pattern) {
  return Array.from(
    new Set(
      (rows || [])
        .map((row) => String(row.sourcetype || ""))
        .filter((sourcetype) => scdSetupPatternMatches(pattern, sourcetype)),
    ),
  );
}

function scdSetupResolveCapabilities(rows) {
  return SCD_SETUP_CAPABILITIES.map((capability) => {
    const sourcetypes = scdSetupMatchingSourcetypes(rows, capability.pattern);
    const events = (rows || [])
      .filter((row) =>
        scdSetupPatternMatches(capability.pattern, row.sourcetype),
      )
      .reduce((total, row) => total + (Number(row.count) || 0), 0);
    return {
      ...capability,
      detected: sourcetypes.length > 0,
      events,
      sourcetypes,
    };
  });
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
        scdSetupPatternMatches(dependency.pattern, sourcetype),
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
    const latestKnownVersion = hasUpdate
      ? updateVersion
      : installedVersion || updateVersion;
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
      latestKnownVersion,
      updateVersion: hasUpdate ? updateVersion : "",
      sourcetypes: sourcetypes.filter(
        (sourcetype) =>
          scdSetupPatternMatches(dependency.pattern, sourcetype),
      ),
    };
  });

  return resolved;
}

function scdSetupResolveSkippedPackages(rows) {
  return SCD_SETUP_DEPENDENCIES.filter(
    (dependency) =>
      !dependency.always &&
      scdSetupMatchingSourcetypes(rows, dependency.pattern).length === 0,
  ).map((dependency) => ({
    id: dependency.id,
    impact: dependency.impact,
    name: dependency.name,
  }));
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

function scdSetupOpenManageApps(event, appId) {
  if (
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  ) {
    return;
  }

  event.preventDefault();
  const url = scdSetupManageAppsUrl(window.location.pathname, appId);
  const managerWindow = window.open(url, "_blank");
  if (!managerWindow) {
    window.location.assign(url);
    return;
  }

  let attempts = 0;
  const filterTimer = window.setInterval(() => {
    attempts += 1;
    try {
      const filter = managerWindow.document.querySelector(
        '[data-test-name="AppListing-AppsTableActions-FilterText"] input, input[placeholder="filter by app name"]',
      );
      if (filter) {
        const valueSetter = Object.getOwnPropertyDescriptor(
          managerWindow.HTMLInputElement.prototype,
          "value",
        )?.set;
        if (valueSetter) {
          valueSetter.call(filter, appId);
        } else {
          filter.value = appId;
        }
        filter.dispatchEvent(
          new managerWindow.Event("input", { bubbles: true }),
        );
        filter.dispatchEvent(
          new managerWindow.Event("change", { bubbles: true }),
        );
        filter.dispatchEvent(
          new managerWindow.KeyboardEvent("keydown", {
            bubbles: true,
            code: "Enter",
            key: "Enter",
          }),
        );
        filter.focus();
        managerWindow.opener = null;
        window.clearInterval(filterTimer);
        return;
      }
    } catch (_error) {
      // The query parameter remains a useful fallback if the manager UI
      // becomes inaccessible while it loads or changes implementation.
    }
    if (attempts >= 80 || managerWindow.closed) {
      window.clearInterval(filterTimer);
    }
  }, 250);
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
    return "Installed";
  }
  if (prerequisite.status === "update") {
    return "Update available";
  }
  if (prerequisite.status === "disabled") {
    return "Disabled";
  }
  if (prerequisite.status === "verify") {
    return "Verify ingest tier";
  }
  return prerequisite.importance === "recommended"
    ? "Optional"
    : "Not installed";
}

function scdSetupRenderStepper(parent, activeStep) {
  const steps = scdSetupElement("ol", "scd-setup__steps");
  steps.setAttribute(
    "aria-label",
    activeStep > 3 ? "Setup progress: complete" : "Setup progress",
  );
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
    if (stateClass === "is-active") {
      item.setAttribute("aria-current", "step");
    }
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

  const tableWrap = scdSetupElement(
    "div",
    "scd-setup__package-table-wrap",
  );
  const table = scdSetupElement("table", "scd-setup__package-table");
  table.setAttribute("aria-label", "Installed package status");
  const head = scdSetupElement("thead");
  const headingRow = scdSetupElement("tr");
  ["Component", "Installed here", "Latest known", "Status", "Purpose"].forEach(
    (label) => {
      const heading = scdSetupElement("th", "", label);
      heading.scope = "col";
      headingRow.appendChild(heading);
    },
  );
  head.appendChild(headingRow);
  table.appendChild(head);
  const body = scdSetupElement("tbody");

  const tableCell = (label, className) => {
    const cell = scdSetupElement("td", className);
    cell.setAttribute("data-label", label);
    return cell;
  };

  const renderPrerequisite = (prerequisite) => {
    const row = scdSetupElement(
      "tr",
      `scd-setup__package-row is-${prerequisite.status} is-${prerequisite.importance}`,
    );
    row.title = prerequisite.purpose;
    row.dataset.appId =
      prerequisite.displayId || prerequisite.appIds[0] || prerequisite.id;

    const component = tableCell("Component", "scd-setup__package-component");
    const heading = scdSetupElement("div", "scd-setup__package-name");
    heading.appendChild(scdSetupElement("strong", "", prerequisite.name));
    if (
      prerequisite.always &&
      ["mandatory", "required"].includes(prerequisite.importance)
    ) {
      heading.appendChild(
        scdSetupElement(
          "span",
          "scd-setup__requirement-role",
          prerequisite.importance === "mandatory" ? "Mandatory" : "Required",
        ),
      );
    }
    component.appendChild(heading);
    component.appendChild(
      scdSetupElement(
        "code",
        "scd-setup__package-id",
        prerequisite.displayId || prerequisite.appIds[0] || prerequisite.id,
      ),
    );
    row.appendChild(component);

    const installed = tableCell(
      "Installed here",
      "scd-setup__package-version-cell",
    );
    if (prerequisite.installedVersion) {
      installed.appendChild(
        scdSetupElement(
          "span",
          "scd-setup__version-pill",
          `v${prerequisite.installedVersion}`,
        ),
      );
    } else {
      installed.appendChild(
        scdSetupElement(
          "span",
          "scd-setup__package-subtle",
          prerequisite.status === "verify"
            ? "Check ingest tier"
            : "Not found by REST",
        ),
      );
    }
    row.appendChild(installed);

    const latest = tableCell(
      "Latest known",
      "scd-setup__package-version-cell",
    );
    if (prerequisite.latestKnownVersion) {
      latest.appendChild(
        scdSetupElement(
          "span",
          `scd-setup__version-pill${
            prerequisite.status === "update" ? " is-update" : ""
          }`,
          `v${prerequisite.latestKnownVersion}`,
        ),
      );
      latest.appendChild(
        scdSetupElement(
          "span",
          "scd-setup__package-subtle",
          prerequisite.status === "update"
            ? "Newer update cached"
            : "No newer update cached",
        ),
      );
    } else {
      latest.appendChild(
        scdSetupElement(
          "span",
          "scd-setup__package-subtle",
          "Not available locally",
        ),
      );
    }
    row.appendChild(latest);

    const statusCell = tableCell("Status", "scd-setup__package-status-cell");
    statusCell.appendChild(
      scdSetupElement(
        "span",
        "scd-setup__status",
        scdSetupStatusLabel(prerequisite),
      ),
    );
    if (
      ["installed", "update", "disabled"].includes(prerequisite.status) &&
      prerequisite.installedId
    ) {
      const link = scdSetupLink(
        "scd-setup__external",
        prerequisite.status === "update" ? "Update" : "Manage",
        scdSetupManageAppsUrl(window.location.pathname, prerequisite.installedId),
      );
      link.setAttribute(
        "aria-label",
        `${prerequisite.status === "update" ? "Update" : "Manage"} ${
          prerequisite.name
        } in Manage Apps`,
      );
      link.title = `Open Manage Apps filtered to ${prerequisite.installedId}`;
      link.target = "_blank";
      link.rel = "noreferrer";
      link.addEventListener("click", (event) =>
        scdSetupOpenManageApps(event, prerequisite.installedId),
      );
      statusCell.appendChild(link);
    } else if (prerequisite.splunkbase) {
      const link = scdSetupLink(
        "scd-setup__external",
        "View package",
        prerequisite.splunkbase,
      );
      link.setAttribute("aria-label", `View ${prerequisite.name} on Splunkbase`);
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      statusCell.appendChild(link);
    }
    row.appendChild(statusCell);

    const purpose = tableCell("Purpose", "scd-setup__package-purpose");
    purpose.textContent = prerequisite.purpose;
    row.appendChild(purpose);
    return row;
  };

  const aiRuntimeIds = new Set(["ai-toolkit", "scientific-python"]);
  prerequisites.forEach((prerequisite) => {
    if (prerequisite.id === "scientific-python") {
      return;
    }
    if (prerequisite.id === "ai-toolkit") {
      prerequisites
        .filter((item) => aiRuntimeIds.has(item.id))
        .forEach((item) => body.appendChild(renderPrerequisite(item)));
      return;
    }
    body.appendChild(renderPrerequisite(prerequisite));
  });
  table.appendChild(body);
  tableWrap.appendChild(table);
  parent.appendChild(tableWrap);
  parent.appendChild(
    scdSetupElement(
      "p",
      "scd-setup__package-note",
      "This live table checks the Splunk Web node rendering Setup. Manage and update actions open Manage Apps filtered to the exact technical package ID; refresh after any package change.",
    ),
  );
}

function scdSetupSetHeaderCopy(root, title, description) {
  const brand = root.querySelector(".scd-setup__brand");
  const heading = brand && brand.querySelector("h1");
  const paragraphs = brand ? brand.querySelectorAll("p") : [];
  if (heading) {
    heading.textContent = title;
  }
  if (paragraphs.length > 1) {
    paragraphs[1].textContent = description;
  }
}

function scdSetupRenderMetrics(parent, metrics) {
  const metricsElement = scdSetupElement("div", "scd-setup__metrics");
  metrics.forEach(([value, label]) => {
    const metric = scdSetupElement("div", "scd-setup__metric");
    metric.appendChild(scdSetupElement("strong", "", value));
    metric.appendChild(scdSetupElement("span", "", label));
    metricsElement.appendChild(metric);
  });
  parent.appendChild(metricsElement);
}

function scdSetupRenderNavigator(parent, appEntries) {
  const navigatorInstalled = (appEntries || []).some(
    (entry) =>
      String(entry.name || "").toLowerCase() ===
      "splunk-cisco-app-navigator",
  );
  const section = scdSetupElement("section", "scd-setup__scan");
  section.appendChild(
    scdSetupElement("p", "scd-setup__eyebrow", "COMPANION APP"),
  );
  section.appendChild(
    scdSetupElement("h2", "", "Splunk Cisco App Navigator"),
  );
  section.appendChild(
    scdSetupElement(
      "p",
      "",
      "Explore Cisco integrations, collection paths, deployment tiers, and package guidance.",
    ),
  );
  const links = scdSetupElement("div", "scd-setup__scan-links");
  if (navigatorInstalled) {
    links.appendChild(
      scdSetupLink(
        "scd-setup__button is-scan",
        "Open App Navigator",
        scdSetupAppUrl(window.location.pathname, "splunk-cisco-app-navigator"),
      ),
    );
  }
  const splunkbaseLink = scdSetupLink(
    "scd-setup__external is-inverse",
    "View on Splunkbase",
    "https://splunkbase.splunk.com/app/8566",
  );
  splunkbaseLink.target = "_blank";
  splunkbaseLink.rel = "noopener noreferrer";
  links.appendChild(splunkbaseLink);
  section.appendChild(links);
  parent.appendChild(section);
}

function scdSetupRenderCapabilities(parent, capabilities) {
  const grid = scdSetupElement("div", "scd-setup__capabilities");
  capabilities.forEach((capability) => {
    const card = scdSetupElement(
      "article",
      `scd-setup__capability ${
        capability.detected ? "is-detected" : "is-unavailable"
      }`,
    );
    const heading = scdSetupElement("div", "scd-setup__capability-heading");
    heading.appendChild(scdSetupElement("strong", "", capability.name));
    heading.appendChild(
      scdSetupElement(
        "span",
        "scd-setup__status",
        capability.detected ? "Data detected" : "Not detected",
      ),
    );
    card.appendChild(heading);
    card.appendChild(
      scdSetupElement(
        "p",
        "",
        capability.detected
          ? `${scdSetupFormatNumber(capability.events)} events across ${capability.sourcetypes.length} sourcetype${capability.sourcetypes.length === 1 ? "" : "s"}.`
          : `Panels for ${capability.impact} will remain unavailable until this data is onboarded.`,
      ),
    );
    grid.appendChild(card);
  });
  parent.appendChild(grid);
}

function scdSetupRenderActions(root, buttons, message) {
  const actions = root.querySelector(".scd-setup__actions");
  actions.textContent = "";
  buttons.forEach((buttonConfig) => {
    const button = scdSetupElement(
      "button",
      `scd-setup__button${buttonConfig.secondary ? " is-secondary" : ""}`,
      buttonConfig.label,
    );
    button.type = "button";
    button.disabled = Boolean(buttonConfig.disabled);
    if (!button.disabled) {
      button.addEventListener("click", buttonConfig.onClick);
    }
    actions.appendChild(button);
  });
  actions.appendChild(
    scdSetupElement("p", "scd-setup__action-note", message),
  );
}

function scdSetupRenderDiscoveryStep(root) {
  const state = root.scdSetupState;
  const { dataRows, errors } = state;
  scdSetupSetActiveStep(root, 1);
  scdSetupSetHeaderCopy(
    root,
    "Discover your Cisco environment",
    "Start with the data this Splunk deployment actually has, then build a setup plan around it.",
  );
  const content = root.querySelector(".scd-setup__content");
  content.textContent = "";
  const uniqueSourcetypes = new Set(dataRows.map((row) => row.sourcetype));
  const uniqueIndexes = new Set(dataRows.map((row) => row.index));
  const totalEvents = dataRows.reduce((sum, row) => sum + row.count, 0);
  const capabilities = scdSetupResolveCapabilities(dataRows);
  const detectedCapabilities = capabilities.filter(
    (capability) => capability.detected,
  ).length;

  const workspace = scdSetupElement("div", "scd-setup__workspace");
  const main = scdSetupElement("main", "scd-setup__main");
  const aside = scdSetupElement("aside", "scd-setup__aside");
  const summary = scdSetupElement(
    "section",
    "scd-setup__section scd-setup__readiness",
  );
  const summaryCopy = scdSetupElement("div");
  summaryCopy.appendChild(
    scdSetupElement("p", "scd-setup__eyebrow", "STEP 1 · DATA DISCOVERY"),
  );
  summaryCopy.appendChild(
    scdSetupElement(
      "h2",
      "",
      errors.data
        ? "The data scan needs attention"
        : `${detectedCapabilities} of ${capabilities.length} solution areas detected`,
    ),
  );
  summaryCopy.appendChild(
    scdSetupElement(
      "p",
      "scd-setup__section-intro",
      "The 30-day metadata scan reads counts and timestamps, not event payloads.",
    ),
  );
  summary.appendChild(summaryCopy);
  scdSetupRenderMetrics(summary, [
    [scdSetupFormatNumber(uniqueSourcetypes.size), "Sourcetypes"],
    [scdSetupFormatNumber(uniqueIndexes.size), "Indexes"],
    [scdSetupFormatNumber(totalEvents), "Events"],
  ]);
  main.appendChild(summary);

  const coverage = scdSetupElement("section", "scd-setup__section");
  coverage.appendChild(
    scdSetupElement("p", "scd-setup__eyebrow", "DASHBOARD COVERAGE"),
  );
  coverage.appendChild(scdSetupElement("h2", "", "What will work today"));
  coverage.appendChild(
    scdSetupElement(
      "p",
      "scd-setup__section-intro",
      "Detected data enables the matching experiences. Missing products stay optional and their affected panels are called out clearly.",
    ),
  );
  if (errors.data) {
    const warning = scdSetupElement(
      "div",
      "scd-setup__warning",
      "Discovery could not run. Verify this user can search the target indexes, then rescan before relying on package recommendations.",
    );
    warning.setAttribute("role", "status");
    coverage.appendChild(warning);
  } else {
    scdSetupRenderCapabilities(coverage, capabilities);
  }
  main.appendChild(coverage);

  const evidence = scdSetupElement("details", "scd-setup__disclosure");
  const evidenceSummary = scdSetupElement("summary", "");
  const evidenceCopy = scdSetupElement("span");
  evidenceCopy.appendChild(scdSetupElement("strong", "", "Discovery evidence"));
  evidenceCopy.appendChild(
    scdSetupElement(
      "small",
      "",
      errors.data
        ? "Scan unavailable"
        : `${uniqueSourcetypes.size} sourcetypes across ${uniqueIndexes.size} indexes`,
    ),
  );
  evidenceSummary.appendChild(evidenceCopy);
  evidence.appendChild(evidenceSummary);
  const evidenceBody = scdSetupElement("div", "scd-setup__discovery-body");
  scdSetupRenderSourceTable(evidenceBody, dataRows);
  evidence.appendChild(evidenceBody);
  aside.appendChild(evidence);
  scdSetupRenderNavigator(aside, state.appEntries);
  workspace.appendChild(main);
  workspace.appendChild(aside);
  content.appendChild(workspace);

  scdSetupRenderActions(
    root,
    [
      {
        label: "Rescan data",
        secondary: true,
        // eslint-disable-next-line no-use-before-define
        onClick: () => scdSetupLoad(root, state.configured),
      },
      {
        label: "Next: review recommendations",
        // eslint-disable-next-line no-use-before-define
        onClick: () => scdSetupRenderPackageStep(root),
      },
    ],
    errors.data
      ? "Recommendations will include only foundational packages until discovery succeeds."
      : "Next, review only the packages relevant to the data found here.",
  );
}

function scdSetupRenderPackageStep(root) {
  const state = root.scdSetupState;
  const { appEntries, dataRows, errors } = state;
  scdSetupSetActiveStep(root, 2);
  scdSetupSetHeaderCopy(
    root,
    "Review data-aware recommendations",
    "Install or update only what supports the products found in this environment.",
  );
  const content = root.querySelector(".scd-setup__content");
  content.textContent = "";
  const prerequisites = scdSetupResolvePrerequisites(dataRows, appEntries);
  const skippedPackages = scdSetupResolveSkippedPackages(dataRows);
  const needsAttention = prerequisites.filter((item) =>
    ["missing", "disabled", "update", "verify"].includes(item.status),
  ).length;
  const blockingPrerequisites = errors.apps
    ? []
    : prerequisites.filter(
        (item) =>
          item.always &&
          ["mandatory", "required"].includes(item.importance) &&
          ["missing", "disabled"].includes(item.status),
      );
  const readyCount = prerequisites.length - needsAttention;
  const workspace = scdSetupElement("div", "scd-setup__workspace");
  const main = scdSetupElement("main", "scd-setup__main");
  const aside = scdSetupElement("aside", "scd-setup__aside");

  const readiness = scdSetupElement(
    "section",
    "scd-setup__section scd-setup__readiness",
  );
  const readinessCopy = scdSetupElement("div");
  readinessCopy.appendChild(
    scdSetupElement("p", "scd-setup__eyebrow", "STEP 2 · PACKAGE READINESS"),
  );
  readinessCopy.appendChild(
    scdSetupElement(
      "h2",
      "",
      `${readyCount} of ${prerequisites.length} recommended packages ready`,
    ),
  );
  readinessCopy.appendChild(
    scdSetupElement(
      "p",
      "scd-setup__section-intro",
      "Foundational packages are always shown; product packages appear only when matching data was detected.",
    ),
  );
  readiness.appendChild(readinessCopy);
  scdSetupRenderMetrics(readiness, [
    [scdSetupFormatNumber(prerequisites.length), "Recommended"],
    [scdSetupFormatNumber(readyCount), "Ready"],
    [scdSetupFormatNumber(needsAttention), "Attention"],
  ]);
  main.appendChild(readiness);

  const packages = scdSetupElement("section", "scd-setup__section");
  const packagesHeader = scdSetupElement("div", "scd-setup__section-heading");
  const packagesCopy = scdSetupElement("div");
  packagesCopy.appendChild(
    scdSetupElement("p", "scd-setup__eyebrow", "LIVE ENVIRONMENT CHECK"),
  );
  packagesCopy.appendChild(
    scdSetupElement("h2", "", "Installed package status"),
  );
  packagesCopy.appendChild(
    scdSetupElement(
      "p",
      "scd-setup__section-intro",
      "Compare recommended package IDs and versions on this Splunk Web node. Refresh after installing or updating.",
    ),
  );
  packagesHeader.appendChild(packagesCopy);
  const packageActions = scdSetupElement(
    "div",
    "scd-setup__section-actions",
  );
  const refreshApps = scdSetupElement(
    "button",
    "scd-setup__package-action",
    "Refresh status",
  );
  refreshApps.type = "button";
  refreshApps.setAttribute("aria-label", "Refresh installed package status");
  refreshApps.title = "Check installed apps again";
  refreshApps.addEventListener("click", () => {
    refreshApps.disabled = true;
    refreshApps.textContent = "Checking…";
    refreshApps.setAttribute("aria-busy", "true");
    scdSetupLoadApps()
      .then((entries) => {
        state.appEntries = entries;
        state.errors = { ...state.errors, apps: null };
        state.packageRefreshMessage = `Package status refreshed at ${new Date().toLocaleTimeString(
          [],
          { hour: "numeric", minute: "2-digit" },
        )}.`;
      })
      .catch((error) => {
        state.appEntries = [];
        state.errors = { ...state.errors, apps: error };
        state.packageRefreshMessage =
          "Package status could not be refreshed. Try again or contact a Splunk administrator.";
      })
      .then(() => {
        scdSetupRenderPackageStep(root);
        root
          .querySelector('[aria-label="Refresh installed package status"]')
          ?.focus?.();
      });
  });
  packageActions.appendChild(refreshApps);
  const manageApps = scdSetupLink(
    "scd-setup__package-action",
    "Manage Apps",
    scdSetupManageAppsUrl(window.location.pathname),
  );
  manageApps.target = "_blank";
  manageApps.rel = "noopener noreferrer";
  packageActions.appendChild(manageApps);
  packagesHeader.appendChild(packageActions);
  packages.appendChild(packagesHeader);
  if (state.packageRefreshMessage) {
    const refreshMessage = scdSetupElement(
      "p",
      `scd-setup__package-refresh-status${errors.apps ? " is-error" : ""}`,
      state.packageRefreshMessage,
    );
    refreshMessage.setAttribute("role", "status");
    refreshMessage.setAttribute("aria-live", "polite");
    packages.appendChild(refreshMessage);
  }
  scdSetupRenderPrerequisites(packages, prerequisites, errors.apps);
  main.appendChild(packages);

  const skipped = scdSetupElement("section", "scd-setup__section");
  skipped.appendChild(
    scdSetupElement("p", "scd-setup__eyebrow", "NOT RECOMMENDED YET"),
  );
  skipped.appendChild(
    scdSetupElement("h2", "", "Packages skipped because data is absent"),
  );
  skipped.appendChild(
    scdSetupElement(
      "p",
      "scd-setup__section-intro",
      "These packages are optional until the corresponding source is onboarded. The listed dashboard areas will remain empty or unavailable.",
    ),
  );
  const skippedList = scdSetupElement("div", "scd-setup__impact-list");
  skippedPackages.forEach((item) => {
    const row = scdSetupElement("article", "scd-setup__impact");
    row.appendChild(scdSetupElement("strong", "", item.name));
    row.appendChild(scdSetupElement("span", "", item.impact));
    skippedList.appendChild(row);
  });
  skipped.appendChild(skippedList);
  aside.appendChild(skipped);
  scdSetupRenderNavigator(aside, appEntries);
  workspace.appendChild(main);
  workspace.appendChild(aside);
  content.appendChild(workspace);

  let packageActionMessage =
    "The recommended package set is ready. Continue to index routing.";
  if (blockingPrerequisites.length) {
    packageActionMessage = `${blockingPrerequisites
      .map((item) => item.name)
      .join(" and ")} must be installed and enabled before index tuning.`;
  } else if (needsAttention) {
    packageActionMessage = `${needsAttention} recommended package${
      needsAttention === 1 ? "" : "s"
    } need attention. You can still review index routing.`;
  }

  scdSetupRenderActions(
    root,
    [
      {
        label: "Back to data discovery",
        secondary: true,
        onClick: () => scdSetupRenderDiscoveryStep(root),
      },
      {
        label: "Next: tune index macros",
        disabled: blockingPrerequisites.length > 0,
        // eslint-disable-next-line no-use-before-define
        onClick: () => scdSetupShowTuningStep(root),
      },
    ],
    packageActionMessage,
  );
}

function scdSetupShowTuningStep(root) {
  const setupRoot = root;
  const tunerRoot = document.getElementById("scan-root");
  if (!tunerRoot) {
    scdSetupShowError(
      setupRoot,
      "The integrated macro tuner could not be mounted.",
    );
    return;
  }
  window.history.replaceState(
    null,
    "",
    scdSetupTuningUrl(window.location.pathname),
  );
  setupRoot.hidden = true;
  tunerRoot.hidden = false;
  if (tunerRoot.dataset.loaded === "true") {
    return;
  }
  tunerRoot.dataset.loaded = "loading";
  const assetUrl = `/static/app/${SCD_SETUP_APP}/pages/macro_index_tuning.js?v=${Date.now()}`;
  if (typeof window.require !== "function") {
    tunerRoot.dataset.loaded = "error";
    tunerRoot.textContent = "The integrated macro tuner could not be loaded.";
    return;
  }
  window.require(
    [assetUrl],
    () => {
      tunerRoot.dataset.loaded = "true";
    },
    () => {
      tunerRoot.dataset.loaded = "error";
      tunerRoot.textContent = "The integrated macro tuner could not be loaded.";
    },
  );
}

function scdSetupRestoreStep(root, step) {
  const setupRoot = root;
  const tunerRoot = document.getElementById("scan-root");
  if (tunerRoot) {
    tunerRoot.hidden = true;
  }
  setupRoot.hidden = false;
  window.history.replaceState(null, "", `${window.location.pathname}?setup=1`);
  if (step === 1) {
    scdSetupRenderDiscoveryStep(setupRoot);
  } else {
    scdSetupRenderPackageStep(setupRoot);
  }
  setupRoot.querySelector("h1")?.focus?.();
}

function scdSetupRenderResults(root, dataRows, appEntries, errors, configured) {
  const setupRoot = root;
  setupRoot.scdSetupState = {
    appEntries,
    configured,
    dataRows,
    errors,
  };
  if (scdSetupIsTuningHash(window.location.hash)) {
    scdSetupShowTuningStep(setupRoot);
    return;
  }
  scdSetupRenderDiscoveryStep(setupRoot);
}

function scdSetupLoad(root, configured) {
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
    scdSetupRenderResults(
      root,
      data.rows,
      apps.entries,
      {
        data: data.error,
        apps: apps.error,
      },
      configured,
    );
  });
}

function scdSetupRender(root, configured) {
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
      "SPLUNK APP FOR SECURE NETWORKING · SETUP",
    ),
  );
  const heading = scdSetupElement(
    "h1",
    "",
    "Discover your Cisco environment",
  );
  heading.tabIndex = -1;
  brandCopy.appendChild(heading);
  brandCopy.appendChild(
    scdSetupElement(
      "p",
      "",
      "Start with the data this Splunk deployment actually has, then build a setup plan around it.",
    ),
  );
  brand.appendChild(brandCopy);
  header.appendChild(brand);
  scdSetupRenderStepper(header, 1);
  shell.appendChild(header);
  shell.appendChild(scdSetupElement("div", "scd-setup__content"));
  shell.appendChild(scdSetupElement("footer", "scd-setup__actions"));
  mountRoot.appendChild(shell);
  scdSetupLoad(mountRoot, configured);
}

function scdSetupStart() {
  const root = document.getElementById("scd-setup-root");
  if (!root) {
    return;
  }

  scdSetupRequest("GET")
    .then((payload) => {
      if (!scdSetupShouldRender(payload, window.location.search)) {
        window.location.replace(scdSetupHomeUrl(window.location.pathname));
        return;
      }
      scdSetupRender(root, scdSetupIsConfigured(payload));
      window.addEventListener("scd:setup-step", (event) => {
        const requestedStep = Number(event && event.detail && event.detail.step);
        scdSetupRestoreStep(root, requestedStep === 1 ? 1 : 2);
      });
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
    appInstallUrl: scdSetupAppInstallUrl,
    appsEndpoint: scdSetupAppsEndpoint,
    compareVersions: scdSetupCompareVersions,
    csrfToken: scdSetupCsrfToken,
    discoveryEndpoint: scdSetupDiscoveryEndpoint,
    endpoint: scdSetupEndpoint,
    homeUrl: scdSetupHomeUrl,
    isConfigured: scdSetupIsConfigured,
    isOnDemand: scdSetupIsOnDemand,
    isTuningHash: scdSetupIsTuningHash,
    localePrefix: scdSetupLocalePrefix,
    manageAppsUrl: scdSetupManageAppsUrl,
    openManageApps: scdSetupOpenManageApps,
    parseExportRows: scdSetupParseExportRows,
    resolveCapabilities: scdSetupResolveCapabilities,
    resolvePrerequisites: scdSetupResolvePrerequisites,
    resolveSkippedPackages: scdSetupResolveSkippedPackages,
    shouldRender: scdSetupShouldRender,
    tuningUrl: scdSetupTuningUrl,
  };
}
