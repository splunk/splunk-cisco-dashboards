/* global module */

/**
 * First-run setup controller backed by setup.conf.
 */
const SCD_SETUP_APP = "splunk-cisco-dashboards";
const SCD_SETUP_HOME_VIEW = "secure_networking_overview";

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

function scdSetupHomeUrl(pathname) {
  return `${scdSetupLocalePrefix(pathname)}/app/${encodeURIComponent(
    SCD_SETUP_APP,
  )}/${SCD_SETUP_HOME_VIEW}`;
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

function scdSetupRequest(method) {
  const options = {
    method,
    credentials: "include",
    headers: {
      Accept: "application/json",
      "X-Requested-With": "XMLHttpRequest",
    },
  };

  if (method === "POST") {
    options.headers["Content-Type"] =
      "application/x-www-form-urlencoded; charset=UTF-8";
    const csrfToken = scdSetupCsrfToken();
    if (csrfToken) {
      options.headers["X-Splunk-Form-Key"] = csrfToken;
    }
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

function scdSetupElement(tagName, className, text) {
  const element = document.createElement(tagName);
  if (className) {
    element.className = className;
  }
  if (text) {
    element.textContent = text;
  }
  return element;
}

function scdSetupShowError(root, message) {
  const alert = scdSetupElement("div", "scd-setup__alert");
  alert.setAttribute("role", "alert");
  alert.textContent = message;
  root.appendChild(alert);
}

function scdSetupRender(root) {
  const mountRoot = root;
  mountRoot.textContent = "";

  const shell = scdSetupElement("section", "scd-setup__shell");
  const intro = scdSetupElement("div", "scd-setup__intro");
  const mark = scdSetupElement("div", "scd-setup__mark", "SN");
  mark.setAttribute("aria-hidden", "true");
  intro.appendChild(mark);
  intro.appendChild(
    scdSetupElement(
      "p",
      "scd-setup__eyebrow",
      "SPLUNK APP FOR SECURE NETWORKING",
    ),
  );
  intro.appendChild(
    scdSetupElement("h1", "scd-setup__title", "See your network clearly."),
  );
  intro.appendChild(
    scdSetupElement(
      "p",
      "scd-setup__summary",
      "Bring Cisco inventory, performance, and security posture into one operational view.",
    ),
  );

  const details = scdSetupElement("div", "scd-setup__details");
  details.appendChild(scdSetupElement("p", "scd-setup__step", "INITIAL SETUP"));
  details.appendChild(scdSetupElement("h2", "", "Your dashboards are ready"));
  details.appendChild(
    scdSetupElement(
      "p",
      "",
      "Complete setup to open the Secure Networking overview. You can tune indexes and macros later from the app navigation.",
    ),
  );

  const checklist = scdSetupElement("ul", "scd-setup__checklist");
  [
    "Curated Cisco fleet and security dashboards",
    "Searchbase-driven content for consistent data mapping",
    "Built-in authoring and topology tools",
  ].forEach((item) => {
    const row = scdSetupElement("li");
    row.appendChild(scdSetupElement("span", "", "\u2713"));
    row.appendChild(document.createTextNode(item));
    checklist.appendChild(row);
  });
  details.appendChild(checklist);

  const button = scdSetupElement(
    "button",
    "scd-setup__button",
    "Complete setup",
  );
  button.type = "button";
  button.addEventListener("click", () => {
    button.disabled = true;
    button.textContent = "Saving...";
    const existingAlert = mountRoot.querySelector(".scd-setup__alert");
    if (existingAlert) {
      existingAlert.remove();
    }

    scdSetupRequest("POST")
      .then(() => {
        window.location.assign(scdSetupHomeUrl(window.location.pathname));
      })
      .catch(() => {
        button.disabled = false;
        button.textContent = "Try again";
        scdSetupShowError(
          details,
          "Setup could not be saved. Ask a Splunk administrator to verify that you can edit this app configuration.",
        );
      });
  });
  details.appendChild(button);
  details.appendChild(
    scdSetupElement(
      "p",
      "scd-setup__note",
      "This stores setup status in setup.conf. No Splunk Web reload or restart is required.",
    ),
  );

  shell.appendChild(intro);
  shell.appendChild(details);
  mountRoot.appendChild(shell);
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
    csrfToken: scdSetupCsrfToken,
    endpoint: scdSetupEndpoint,
    homeUrl: scdSetupHomeUrl,
    isConfigured: scdSetupIsConfigured,
    localePrefix: scdSetupLocalePrefix,
  };
}
