/** Curated, openly-licensed sources the agent may LINK to (never scrape/ingest). */
export const OER_SOURCES = [
  { name: "OpenStax", domain: "openstax.org", license: "CC BY" },
  { name: "PhET Interactive Simulations", domain: "phet.colorado.edu", license: "CC BY" },
  { name: "OER Commons", domain: "oercommons.org", license: "varies (CC)" },
  { name: "CK-12", domain: "ck12.org", license: "CC BY-NC" },
  { name: "Khan Academy", domain: "khanacademy.org", license: "public pages" },
  { name: "Skew the Script", domain: "skewthescript.org", license: "per site terms" },
] as const;

/** Proprietary domains the agent must NEVER ingest from (link-out at most, per ToS). */
export const DENIED_DOMAINS = [
  "collegeboard.org",
  "apclassroom.collegeboard.org",
  "canva.com",
] as const;

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

export function isDeniedSource(url: string): boolean {
  const host = hostOf(url);
  return DENIED_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`));
}

export function isAllowedSource(url: string): boolean {
  if (isDeniedSource(url)) return false;
  const host = hostOf(url);
  return OER_SOURCES.some((s) => host === s.domain || host.endsWith(`.${s.domain}`));
}
