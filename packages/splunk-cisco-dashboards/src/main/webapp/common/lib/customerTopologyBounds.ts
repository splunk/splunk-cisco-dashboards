/**
 * Shared limits for customer-supplied topology configuration.
 *
 * The REST handler enforces equivalent limits before persistence. These
 * browser-side limits protect viewers from malformed legacy records or a
 * configuration write that did not pass through the custom handler.
 */

export const MAX_CUSTOMER_TOPOLOGY_SITES = 250;
export const MAX_CUSTOMER_TOPOLOGY_LINKS = 500;
export const MAX_CUSTOMER_TOPOLOGY_SITE_ALIASES = 16;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));

const hasBoundedAliases = (site: unknown): boolean => {
  if (!isRecord(site)) return false;
  const aliases = site.aliases;
  return (
    aliases === undefined ||
    (Array.isArray(aliases) && aliases.length <= MAX_CUSTOMER_TOPOLOGY_SITE_ALIASES)
  );
};

/** Return whether a persisted topology has a bounded, renderable collection shape. */
export const hasBoundedCustomerTopology = (topology: unknown): boolean => {
  if (!isRecord(topology)) return false;
  const sites = topology.sites;
  const links = topology.links;
  if (!Array.isArray(sites) || !Array.isArray(links)) return false;
  if (
    sites.length > MAX_CUSTOMER_TOPOLOGY_SITES ||
    links.length > MAX_CUSTOMER_TOPOLOGY_LINKS
  ) {
    return false;
  }
  return sites.every(hasBoundedAliases) && links.every(isRecord);
};
