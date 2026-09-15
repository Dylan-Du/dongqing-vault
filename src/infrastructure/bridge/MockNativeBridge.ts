import {
  effectiveStatus,
  needsAttention,
  type CreateSiteInput,
  type DeletedSiteSnapshot,
  type HealthCheckResultInput,
  type Site,
  type SitePage,
  type SiteQuery,
  type UpdateSiteInput,
} from "../../domain/site";
import { normalizeSiteQuery } from "../../domain/site-query";
import type {
  Category,
  CategoryListItem,
  TagListItem,
  TaxonomySnapshot,
  Tag,
} from "../../domain/taxonomy";
import { taxonomyNameKey } from "../../domain/taxonomy";
import type { NativeBridge } from "./NativeBridge";
import { createAppCommandError } from "./NativeBridge";

export interface MockNativeBridgeState {
  sites?: Site[];
  categories?: CategoryListItem[];
  tags?: TagListItem[];
}

const FIXED_NOW = "2026-01-01T00:00:00.000Z";

export class MockNativeBridge implements NativeBridge {
  private sites: Site[];
  private categories: CategoryListItem[];
  private tags: TagListItem[];
  private nextId = 1;
  readonly openedUrls: string[] = [];

  constructor(state: MockNativeBridgeState = {}) {
    this.sites = (state.sites ?? []).map(cloneSite);
    this.categories = (state.categories ?? []).map(cloneCategory);
    this.tags = (state.tags ?? []).map(cloneTag);
  }

  snapshot(): MockNativeBridgeState {
    return {
      sites: this.sites.map(cloneSite),
      categories: this.categories.map(cloneCategory),
      tags: this.tags.map(cloneTag),
    };
  }

  async listSites(query: SiteQuery): Promise<SitePage> {
    const normalizedQuery = normalizeSiteQuery(query);
    const filtered = filterSites(this.sites, normalizedQuery, tagNamesById(this.tags));
    const sorted = sortSites(filtered, normalizedQuery);
    const paged = sorted.slice(normalizedQuery.offset, normalizedQuery.offset + normalizedQuery.limit);

    return {
      items: paged.map(cloneSite),
      total: filtered.length,
      summary: summarizeSites(filtered),
    };
  }

  async getSite(id: string): Promise<Site> {
    const site = this.sites.find((item) => item.id === id);
    if (!site) {
      throw createAppCommandError("not_found", `Site ${id} was not found.`);
    }

    return cloneSite(site);
  }

  async createSite(input: CreateSiteInput): Promise<Site> {
    const now = FIXED_NOW;
    const normalizedUrl = normalizeMockUrl(input.url);
    const hostname = new URL(normalizedUrl).hostname;
    const site: Site = {
      id: `mock-site-${this.nextId++}`,
      name: input.name.trim() || hostname,
      domain: input.domain.trim() || hostname,
      url: normalizedUrl,
      normalizedUrl,
      notes: input.notes,
      categoryId: input.categoryId,
      tagIds: [...input.tagIds],
      isPinned: input.isPinned,
      autoStatus: "unchecked",
      manualStatus: input.manualStatus,
      failureStreak: 0,
      lastCheckedAt: null,
      lastSuccessAt: null,
      lastCheckSource: null,
      lastHttpStatus: null,
      lastResponseMs: null,
      lastCheckError: null,
      createdAt: now,
      updatedAt: now,
      urlRevision: 1,
      rowRevision: 1,
    };

    this.sites.push(cloneSite(site));
    return cloneSite(site);
  }

  async updateSite(input: UpdateSiteInput): Promise<Site> {
    const index = this.sites.findIndex((site) => site.id === input.id);
    if (index === -1) {
      throw createAppCommandError("not_found", `Site ${input.id} was not found.`);
    }

    const current = this.sites[index];
    if (current.rowRevision !== input.expectedRowRevision) {
      throw createAppCommandError(
        "conflict",
        `Site ${input.id} changed before this update could be applied.`,
      );
    }

    const normalizedUrl = normalizeMockUrl(input.url);
    const urlChanged = normalizedUrl !== current.normalizedUrl;
    const hostname = new URL(normalizedUrl).hostname;
    const updated: Site = {
      ...current,
      name: input.name.trim() || hostname,
      domain: input.domain.trim() || hostname,
      url: normalizedUrl,
      normalizedUrl,
      notes: input.notes,
      categoryId: input.categoryId,
      tagIds: [...input.tagIds],
      isPinned: input.isPinned,
      manualStatus: urlChanged ? null : input.manualStatus,
      updatedAt: FIXED_NOW,
      autoStatus: urlChanged ? "unchecked" : current.autoStatus,
      failureStreak: urlChanged ? 0 : current.failureStreak,
      lastCheckedAt: urlChanged ? null : current.lastCheckedAt,
      lastSuccessAt: urlChanged ? null : current.lastSuccessAt,
      lastCheckSource: urlChanged ? null : current.lastCheckSource,
      lastHttpStatus: urlChanged ? null : current.lastHttpStatus,
      lastResponseMs: urlChanged ? null : current.lastResponseMs,
      lastCheckError: urlChanged ? null : current.lastCheckError,
      urlRevision: current.urlRevision + (urlChanged ? 1 : 0),
      rowRevision: current.rowRevision + 1,
    };

    this.sites[index] = cloneSite(updated);
    return cloneSite(updated);
  }

  async recordHealthChecks(results: HealthCheckResultInput[]): Promise<Site[]> {
    const updated: Site[] = [];
    for (const result of results) {
      const index = this.sites.findIndex((site) => site.id === result.id);
      if (index === -1 || this.sites[index].urlRevision !== result.expectedUrlRevision) continue;
      const current = this.sites[index];
      const next: Site = {
        ...current,
        autoStatus: result.autoStatus,
        failureStreak: result.failureStreak,
        lastCheckedAt: result.checkedAt,
        lastSuccessAt: result.autoStatus === "available" ? result.checkedAt : current.lastSuccessAt,
        lastCheckSource: result.source,
        lastHttpStatus: result.httpStatus,
        lastResponseMs: result.responseMs,
        lastCheckError: result.error,
        rowRevision: current.rowRevision + 1,
      };
      this.sites[index] = cloneSite(next);
      updated.push(cloneSite(next));
    }
    return updated;
  }

  async deleteSites(ids: string[]): Promise<DeletedSiteSnapshot[]> {
    const snapshots: DeletedSiteSnapshot[] = [];

    for (const id of ids) {
      const site = this.sites.find((item) => item.id === id);
      if (site) {
        snapshots.push({ site: cloneSite(site) });
      }
    }

    const idSet = new Set(ids);
    this.sites = this.sites.filter((site) => !idSet.has(site.id));
    return snapshots;
  }

  async restoreSites(snapshots: DeletedSiteSnapshot[]): Promise<void> {
    const existingIds = new Set(this.sites.map((site) => site.id));
    const collision = snapshots.find((snapshot) => existingIds.has(snapshot.site.id));
    if (collision) {
      throw createAppCommandError(
        "conflict",
        `Site ${collision.site.id} already exists.`,
      );
    }

    this.sites.push(...snapshots.map((snapshot) => cloneSite(snapshot.site)));
  }

  async listTaxonomy(): Promise<TaxonomySnapshot> {
    const sitesByCategory = countBy(this.sites, (site) => site.categoryId);
    const sitesByTag = countTags(this.sites);

    return {
      categories: this.categories.map((category) => ({
        ...cloneCategory(category),
        siteCount: sitesByCategory.get(category.id) ?? 0,
      })),
      tags: this.tags.map((tag) => ({
        ...cloneTag(tag),
        siteCount: sitesByTag.get(tag.id) ?? 0,
      })),
    };
  }

  async createCategory(input: { name: string; color: string }): Promise<Category> {
    return this.createTaxonomy(this.categories, input);
  }

  async updateCategory(input: { id: string; name: string; color: string }): Promise<Category> {
    return this.updateTaxonomy(this.categories, input);
  }

  async deleteCategory(id: string): Promise<{ affectedSites: number }> {
    const affectedSites = this.sites.filter((site) => site.categoryId === id).length;
    const before = this.categories.length;
    this.categories = this.categories.filter((item) => item.id !== id);
    if (this.categories.length === before) throw createAppCommandError("not_found", `Category ${id} was not found.`);
    this.sites = this.sites.map((site) => site.categoryId === id ? { ...site, categoryId: null } : site);
    return { affectedSites };
  }

  async createTag(input: { name: string; color: string }): Promise<Tag> {
    return this.createTaxonomy(this.tags, input);
  }

  async updateTag(input: { id: string; name: string; color: string }): Promise<Tag> {
    return this.updateTaxonomy(this.tags, input);
  }

  async deleteTag(id: string): Promise<{ affectedSites: number }> {
    const affectedSites = this.sites.filter((site) => site.tagIds.includes(id)).length;
    const before = this.tags.length;
    this.tags = this.tags.filter((item) => item.id !== id);
    if (this.tags.length === before) throw createAppCommandError("not_found", `Tag ${id} was not found.`);
    this.sites = this.sites.map((site) => ({ ...site, tagIds: site.tagIds.filter((tagId) => tagId !== id) }));
    return { affectedSites };
  }

  private async createTaxonomy(collection: CategoryListItem[], input: { name: string; color: string }): Promise<Category> {
    const nameKey = taxonomyNameKey(input.name);
    if (collection.some((item) => item.nameKey === nameKey)) throw createAppCommandError("conflict", `Taxonomy name ${input.name} already exists.`);
    const timestamp = FIXED_NOW;
    const item: CategoryListItem = {
      id: `mock-taxonomy-${this.nextId++}`,
      name: input.name.trim().normalize("NFKC"),
      nameKey,
      color: normalizeColor(input.color),
      sortIndex: collection.reduce((maximum, entry) => Math.max(maximum, entry.sortIndex), -1) + 1,
      createdAt: timestamp,
      updatedAt: timestamp,
      siteCount: 0,
    };
    collection.push(item);
    return cloneCategory(item);
  }

  private async updateTaxonomy(collection: CategoryListItem[], input: { id: string; name: string; color: string }): Promise<Category> {
    const index = collection.findIndex((item) => item.id === input.id);
    if (index === -1) throw createAppCommandError("not_found", `Taxonomy ${input.id} was not found.`);
    const nameKey = taxonomyNameKey(input.name);
    if (collection.some((item, itemIndex) => itemIndex !== index && item.nameKey === nameKey)) throw createAppCommandError("conflict", `Taxonomy name ${input.name} already exists.`);
    collection[index] = { ...collection[index], name: input.name.trim().normalize("NFKC"), nameKey, color: normalizeColor(input.color), updatedAt: FIXED_NOW };
    return cloneCategory(collection[index]);
  }

  async openUrls(urls: string[]): Promise<void> {
    this.openedUrls.push(...urls);
  }
}

function normalizeColor(color: string): string {
  if (!/^#[0-9A-Fa-f]{6}$/.test(color)) throw createAppCommandError("validation", "Color must be a six-digit hexadecimal value.");
  return color.toUpperCase();
}

function normalizeMockUrl(raw: string): string {
  const input = raw.trim();
  const candidate = /^[A-Za-z][A-Za-z0-9+.-]*:/.test(input) ? input : `https://${input}`;
  const parsed = new URL(candidate);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw createAppCommandError("unsafe_url", "Only HTTP and HTTPS URLs are allowed.");
  if (parsed.username || parsed.password) throw createAppCommandError("unsafe_url", "Credentials are not allowed in URLs.");
  return parsed.toString();
}

function filterSites(
  sites: Site[],
  query: SiteQuery,
  tagLookup: Map<string, string[]>,
): Site[] {
  const keyword = query.keyword.trim().toLocaleLowerCase();

  return sites.filter((site) => {
    const tagKeywords = site.tagIds.flatMap((tagId) => tagLookup.get(tagId) ?? []);
    const matchesKeyword =
      keyword.length === 0 ||
      [
        site.name,
        site.domain,
        site.url,
        site.normalizedUrl,
        site.notes,
        ...tagKeywords,
      ]
        .join(" ")
        .toLocaleLowerCase()
        .includes(keyword);
    const matchesCategory =
      query.categoryId === null || site.categoryId === query.categoryId;
    const matchesTags = query.tagIds.every((tagId) => site.tagIds.includes(tagId));
    const matchesStatus =
      query.status === null || effectiveStatus(site) === query.status;

    return matchesKeyword && matchesCategory && matchesTags && matchesStatus;
  });
}

function sortSites(sites: Site[], query: SiteQuery): Site[] {
  const direction = query.sortDirection === "asc" ? 1 : -1;

  return [...sites].sort((left, right) => {
    if (left.isPinned !== right.isPinned) {
      return left.isPinned ? -1 : 1;
    }

    const comparison = compareByField(left, right, query.sortBy);
    if (comparison !== 0) {
      return comparison * direction;
    }

    return left.id.localeCompare(right.id);
  });
}

function compareByField(
  left: Site,
  right: Site,
  sortBy: SiteQuery["sortBy"],
): number {
  if (sortBy === "status") {
    return statusRank(left) - statusRank(right);
  }

  return String(left[sortBy]).localeCompare(String(right[sortBy]));
}

function statusRank(site: Site): number {
  switch (effectiveStatus(site)) {
    case "available":
      return 0;
    case "unchecked":
      return 1;
    case "unavailable":
      return 2;
  }
}

function summarizeSites(sites: Site[]): SitePage["summary"] {
  return {
    total: sites.length,
    available: sites.filter((site) => effectiveStatus(site) === "available").length,
    needsAttention: sites.filter(needsAttention).length,
  };
}

function cloneSite(site: Site): Site {
  return { ...site, tagIds: [...site.tagIds] };
}

function cloneCategory(category: CategoryListItem): CategoryListItem {
  return { ...category };
}

function cloneTag(tag: TagListItem): TagListItem {
  return { ...tag };
}

function countBy<T>(items: T[], keyFor: (item: T) => string | null): Map<string, number> {
  const counts = new Map<string, number>();

  for (const item of items) {
    const key = keyFor(item);
    if (key !== null) {
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }

  return counts;
}

function countTags(sites: Site[]): Map<string, number> {
  const counts = new Map<string, number>();

  for (const site of sites) {
    for (const tagId of site.tagIds) {
      counts.set(tagId, (counts.get(tagId) ?? 0) + 1);
    }
  }

  return counts;
}

function tagNamesById(tags: TagListItem[]): Map<string, string[]> {
  const namesById = new Map<string, string[]>();

  for (const tag of tags) {
    namesById.set(tag.id, [tag.name, tag.nameKey]);
  }

  return namesById;
}
