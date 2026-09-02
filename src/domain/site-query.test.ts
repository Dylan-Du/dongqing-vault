import { describe, expect, it } from "vitest";
import { normalizeSiteQuery } from "./site-query";

describe("normalizeSiteQuery", () => {
  it("trims keyword, deduplicates tags, and clamps paging", () => {
    expect(normalizeSiteQuery({ keyword: "  deploy  ", tagIds: ["a", "a", "b"], offset: -4, limit: 999 })).toMatchObject({
      keyword: "deploy", tagIds: ["a", "b"], offset: 0, limit: 200,
    });
  });

  it("defaults to updatedAt descending and preserves explicit closed sorts", () => {
    expect(normalizeSiteQuery({})).toMatchObject({ sortBy: "updatedAt", sortDirection: "desc" });
    for (const sortBy of ["name", "domain", "createdAt", "updatedAt", "status"] as const) {
      expect(normalizeSiteQuery({ sortBy, sortDirection: "asc" })).toMatchObject({ sortBy, sortDirection: "asc" });
    }
  });
});
