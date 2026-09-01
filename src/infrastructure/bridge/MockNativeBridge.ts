import {
  effectiveStatus,
  needsAttention,
  type CreateSiteInput,
  type DeletedSiteSnapshot,
  type Site,
  type SitePage,
  type SiteQuery,
  type UpdateSiteInput,
} from "../../domain/site";
import type {
  CategoryListItem,
  TagListItem,
  TaxonomySnapshot,
} from "../../domain/taxonomy";
import type { NativeBridge } from "./NativeBridge";
import { createAppCommandError } from "./NativeBridge";

interface MockNativeBridgeState {
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

  async listSites(query: SiteQuery): Promise<SitePage> {
    const filtered = filterSites(this.sites, query, tagNamesById(this.tags));
    const sorted = sortSites(filtered, query);
    const paged = sorted.slice(query.offset, query.offset + query.limit);

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
    const site: Site = {
      id: `mock-site-${this.nextId++}`,
      name: input.name,
      domain: input.domain,
      url: input.url,
      normalizedUrl: input.url,
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

    const updated: Site = {
      ...current,
      name: input.name,
      domain: input.domain,
      url: input.url,
      normalizedUrl: input.url,
      notes: input.notes,
      categoryId: input.categoryId,
      tagIds: [...input.tagIds],
      isPinned: input.isPinned,
      manualStatus: input.manualStatus,
      updatedAt: FIXED_NOW,
      rowRevision: current.rowRevision + 1,
    };

    this.sites[index] = cloneSite(updated);
    return cloneSite(updated);
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

  async openUrls(urls: string[]): Promise<void> {
    this.openedUrls.push(...urls);
  }
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
