import type { Site, SiteQuery } from "../domain/site";

const FIXED_NOW = "2026-01-01T00:00:00.000Z";

export function siteFixture(overrides: Partial<Site> = {}): Site {
  const id = overrides.id ?? "00000000-0000-4000-8000-000000000000";
  const name = overrides.name ?? "Example";
  const domain = overrides.domain ?? "example.com";
  const url = overrides.url ?? `https://${domain}`;

  return {
    id,
    name,
    domain,
    url,
    normalizedUrl: overrides.normalizedUrl ?? url,
    notes: "",
    categoryId: null,
    tagIds: [],
    isPinned: false,
    autoStatus: "unchecked",
    manualStatus: null,
    failureStreak: 0,
    lastCheckedAt: null,
    lastSuccessAt: null,
    lastCheckSource: null,
    lastHttpStatus: null,
    lastResponseMs: null,
    lastCheckError: null,
    createdAt: FIXED_NOW,
    updatedAt: FIXED_NOW,
    urlRevision: 1,
    rowRevision: 1,
    ...overrides,
  };
}

export function defaultSiteQuery(overrides: Partial<SiteQuery> = {}): SiteQuery {
  return {
    keyword: "",
    categoryId: null,
    tagIds: [],
    status: null,
    sortBy: "updatedAt",
    sortDirection: "desc",
    offset: 0,
    limit: 50,
    ...overrides,
  };
}
