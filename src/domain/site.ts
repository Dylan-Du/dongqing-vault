export type AutoStatus = "unchecked" | "available" | "unavailable";
export type ManualStatus = "available" | "unavailable" | null;
export type EffectiveStatus = AutoStatus;

export interface Site {
  id: string;
  name: string;
  domain: string;
  url: string;
  normalizedUrl: string;
  notes: string;
  username: string;
  hasPassword: boolean;
  categoryId: string | null;
  tagIds: string[];
  isPinned: boolean;
  autoStatus: AutoStatus;
  manualStatus: ManualStatus;
  failureStreak: 0 | 1 | 2;
  lastCheckedAt: string | null;
  lastSuccessAt: string | null;
  lastCheckSource: "scheduled" | "manual" | null;
  lastHttpStatus: number | null;
  lastResponseMs: number | null;
  lastCheckError: string | null;
  createdAt: string;
  updatedAt: string;
  urlRevision: number;
  rowRevision: number;
}

export interface SiteQuery {
  keyword: string;
  categoryId: string | null;
  tagIds: string[];
  status: EffectiveStatus | null;
  sortBy: "name" | "domain" | "createdAt" | "updatedAt" | "status";
  sortDirection: "asc" | "desc";
  offset: number;
  limit: number;
}

export interface Paged<T> {
  items: T[];
  total: number;
}

export type SiteListItem = Site;

export interface SiteSummary {
  total: number;
  available: number;
  needsAttention: number;
}

export interface SitePage extends Paged<SiteListItem> {
  summary: SiteSummary;
}

export interface CreateSiteInput {
  name: string;
  domain: string;
  url: string;
  notes: string;
  username: string;
  categoryId: string | null;
  tagIds: string[];
  isPinned: boolean;
  manualStatus: ManualStatus;
}

export interface UpdateSiteInput extends CreateSiteInput {
  id: string;
  expectedRowRevision: number;
}

export interface HealthCheckResultInput {
  id: string;
  expectedUrlRevision: number;
  autoStatus: Exclude<AutoStatus, "unchecked">;
  failureStreak: 0 | 1 | 2;
  checkedAt: string;
  source: "scheduled" | "manual";
  httpStatus: number | null;
  responseMs: number;
  error: string | null;
}

export interface DeletedSiteSnapshot {
  site: Site;
}

export function effectiveStatus(site: Site): EffectiveStatus {
  return site.manualStatus ?? site.autoStatus;
}

export function needsAttention(site: Site): boolean {
  return (
    site.manualStatus === null &&
    (site.autoStatus !== "available" || site.failureStreak > 0)
  );
}

export function hasManualOverride(site: Site): boolean {
  return site.manualStatus !== null;
}

export function willResetStatus(site: Site, nextUrl: string): boolean {
  const input = nextUrl.trim();
  const candidate = /^[A-Za-z][A-Za-z0-9+.-]*:/.test(input)
    ? input
    : `https://${input}`;
  return new URL(candidate).toString() !== site.normalizedUrl;
}
