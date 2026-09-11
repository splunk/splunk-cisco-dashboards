import { createURL } from "@splunk/splunk-utils/url";

export const secureNetworkingEssentialsCatalogUrl = (): string =>
  createURL("/manager/launcher/appsremote", {
    order: "relevance",
    query: '"Secure Networking Essentials"',
    offset: 0,
    type: "app",
    category: ["it_operations_management", "network_security"],
    support: "developer",
    cim_version: "8.x",
  });
