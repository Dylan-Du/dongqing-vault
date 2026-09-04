import type { SiteQuery } from "./site";

export function normalizeSiteQuery(input: Partial<SiteQuery>): SiteQuery {
  return {
    keyword: input.keyword?.trim() ?? "",
    categoryId: input.categoryId ?? null,
    tagIds: [...new Set(input.tagIds ?? [])],
    status: input.status ?? null,
    sortBy: input.sortBy ?? "updatedAt",
    sortDirection: input.sortDirection ?? "desc",
    offset: Math.max(0, Math.trunc(input.offset ?? 0)),
    limit: Math.min(200, Math.max(1, Math.trunc(input.limit ?? 50))),
  };
}
