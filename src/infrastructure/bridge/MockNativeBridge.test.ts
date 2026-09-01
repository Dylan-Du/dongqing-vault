import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { createElement } from "react";

import { effectiveStatus, needsAttention, type SitePage } from "../../domain/site";
import { BridgeProvider, useNativeBridge } from "./BridgeContext";
import { MockNativeBridge } from "./MockNativeBridge";
import { TauriNativeBridge } from "./TauriNativeBridge";
import { defaultSiteQuery, siteFixture } from "../../test/fixtures";

describe("MockNativeBridge", () => {
  it("filters mock sites through the bridge contract", async () => {
    const bridge = new MockNativeBridge({
      sites: [siteFixture({ name: "Vercel" })],
    });

    const page = await bridge.listSites(defaultSiteQuery({ keyword: "ver" }));

    expect(page.items.map((site) => site.name)).toEqual(["Vercel"]);
  });

  it("applies taxonomy, status, sort, and pagination filters deterministically", async () => {
    const bridge = new MockNativeBridge({
      sites: [
        siteFixture({
          id: "00000000-0000-4000-8000-000000000001",
          name: "Alpha",
          domain: "alpha.test",
          categoryId: "work",
          tagIds: ["infra", "prod"],
          autoStatus: "available",
          updatedAt: "2026-01-02T00:00:00.000Z",
        }),
        siteFixture({
          id: "00000000-0000-4000-8000-000000000002",
          name: "Beta",
          domain: "beta.test",
          categoryId: "work",
          tagIds: ["infra", "prod"],
          autoStatus: "unchecked",
          failureStreak: 1,
          updatedAt: "2026-01-04T00:00:00.000Z",
        }),
        siteFixture({
          id: "00000000-0000-4000-8000-000000000003",
          name: "Gamma",
          domain: "gamma.test",
          categoryId: "work",
          tagIds: ["infra"],
          autoStatus: "unavailable",
          updatedAt: "2026-01-03T00:00:00.000Z",
        }),
        siteFixture({
          id: "00000000-0000-4000-8000-000000000004",
          name: "Delta",
          domain: "delta.test",
          categoryId: "personal",
          tagIds: ["prod"],
          autoStatus: "unchecked",
          updatedAt: "2026-01-05T00:00:00.000Z",
        }),
      ],
    });

    const page = await bridge.listSites(
      defaultSiteQuery({
        categoryId: "work",
        tagIds: ["infra", "prod"],
        status: "unchecked",
        sortBy: "updatedAt",
        sortDirection: "desc",
        offset: 0,
        limit: 1,
      }),
    );

    expect(page.items.map((site) => site.name)).toEqual(["Beta"]);
    expect(page.total).toBe(1);
  });

  it("summarizes effective availability and attention from the filtered set", async () => {
    const bridge = new MockNativeBridge({
      sites: [
        siteFixture({ name: "Available", autoStatus: "available" }),
        siteFixture({
          name: "Manual availability",
          autoStatus: "unavailable",
          manualStatus: "available",
        }),
        siteFixture({
          name: "Needs attention",
          autoStatus: "available",
          failureStreak: 1,
        }),
      ],
    });

    const page = await bridge.listSites(defaultSiteQuery({ keyword: "a" }));

    expect(page.summary).toEqual({
      total: 3,
      available: 2,
      needsAttention: 1,
    });
  });

  it("matches keyword searches against associated taxonomy tag names and name keys", async () => {
    const bridge = new MockNativeBridge({
      sites: [
        siteFixture({
          id: "00000000-0000-4000-8000-000000000011",
          name: "Deployments",
          tagIds: ["frontend"],
        }),
        siteFixture({
          id: "00000000-0000-4000-8000-000000000012",
          name: "Databases",
          tagIds: ["storage"],
        }),
      ],
      tags: [
        {
          id: "frontend",
          name: "Presentation",
          nameKey: "frontend",
          color: "#38bdf8",
          sortIndex: 1,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
          siteCount: 0,
        },
        {
          id: "storage",
          name: "Persistence",
          nameKey: "storage",
          color: "#22c55e",
          sortIndex: 2,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
          siteCount: 0,
        },
      ],
    });

    const namePage = await bridge.listSites(
      defaultSiteQuery({ keyword: " PRESENT " }),
    );
    const nameKeyPage = await bridge.listSites(
      defaultSiteQuery({ keyword: " FRONT " }),
    );

    expect(namePage.items.map((site) => site.name)).toEqual(["Deployments"]);
    expect(nameKeyPage.items.map((site) => site.name)).toEqual(["Deployments"]);
  });

  it("keeps pinned rows first and breaks equal field comparisons by id ascending", async () => {
    const bridge = new MockNativeBridge({
      sites: [
        siteFixture({
          id: "00000000-0000-4000-8000-000000000022",
          name: "Same",
          updatedAt: "2026-01-01T00:00:00.000Z",
        }),
        siteFixture({
          id: "00000000-0000-4000-8000-000000000021",
          name: "Same",
          updatedAt: "2026-01-01T00:00:00.000Z",
        }),
        siteFixture({
          id: "00000000-0000-4000-8000-000000000023",
          name: "Later pinned",
          isPinned: true,
          updatedAt: "2026-01-02T00:00:00.000Z",
        }),
      ],
    });

    const page = await bridge.listSites(
      defaultSiteQuery({
        sortBy: "name",
        sortDirection: "asc",
      }),
    );

    expect(page.items.map((site) => site.id)).toEqual([
      "00000000-0000-4000-8000-000000000023",
      "00000000-0000-4000-8000-000000000021",
      "00000000-0000-4000-8000-000000000022",
    ]);
  });

  it("sorts statuses by availability rank and reverses only the field order", async () => {
    const bridge = new MockNativeBridge({
      sites: [
        siteFixture({
          id: "00000000-0000-4000-8000-000000000031",
          name: "Unchecked",
          autoStatus: "unchecked",
        }),
        siteFixture({
          id: "00000000-0000-4000-8000-000000000032",
          name: "Unavailable",
          autoStatus: "unavailable",
        }),
        siteFixture({
          id: "00000000-0000-4000-8000-000000000033",
          name: "Available",
          autoStatus: "available",
        }),
        siteFixture({
          id: "00000000-0000-4000-8000-000000000034",
          name: "Pinned unavailable",
          isPinned: true,
          autoStatus: "unavailable",
        }),
      ],
    });

    const ascending = await bridge.listSites(
      defaultSiteQuery({ sortBy: "status", sortDirection: "asc" }),
    );
    const descending = await bridge.listSites(
      defaultSiteQuery({ sortBy: "status", sortDirection: "desc" }),
    );

    expect(ascending.items.map((site) => site.name)).toEqual([
      "Pinned unavailable",
      "Available",
      "Unchecked",
      "Unavailable",
    ]);
    expect(descending.items.map((site) => site.name)).toEqual([
      "Pinned unavailable",
      "Unavailable",
      "Unchecked",
      "Available",
    ]);
  });
});

describe("site status helpers", () => {
  it("uses manual status as the effective status when present", () => {
    expect(
      effectiveStatus(
        siteFixture({ autoStatus: "unavailable", manualStatus: "available" }),
      ),
    ).toBe("available");
  });

  it("marks only uncovered non-available or failing automatic checks as needing attention", () => {
    expect(needsAttention(siteFixture({ autoStatus: "unavailable" }))).toBe(true);
    expect(
      needsAttention(siteFixture({ autoStatus: "available", failureStreak: 1 })),
    ).toBe(true);
    expect(
      needsAttention(
        siteFixture({
          autoStatus: "unchecked",
          manualStatus: "unavailable",
          failureStreak: 2,
        }),
      ),
    ).toBe(false);
    expect(needsAttention(siteFixture({ autoStatus: "available" }))).toBe(false);
  });
});

describe("TauriNativeBridge", () => {
  it("invokes snake case commands with the typed input payload", async () => {
    const query = defaultSiteQuery({ keyword: "ver" });
    const returnedPage: SitePage = {
      items: [],
      total: 0,
      summary: { total: 0, available: 0, needsAttention: 0 },
    };
    const calls: Array<{
      command: string;
      args: Record<string, unknown> | undefined;
    }> = [];
    const bridge = new TauriNativeBridge(async <T,>(
      command: string,
      args?: Record<string, unknown>,
    ) => {
      calls.push({ command, args });
      return returnedPage as T;
    });

    await bridge.listSites(query);

    expect(calls).toEqual([{ command: "list_sites", args: { input: query } }]);
  });
});

describe("BridgeContext", () => {
  it("throws a descriptive error when no bridge provider is present", () => {
    function ReadsBridge() {
      useNativeBridge();
      return null;
    }

    expect(() => render(createElement(ReadsBridge))).toThrow(
      "useNativeBridge must be used within BridgeProvider",
    );
  });

  it("returns the injected bridge from the provider", () => {
    const bridge = new MockNativeBridge();
    function ReadsBridge() {
      expect(useNativeBridge()).toBe(bridge);
      return null;
    }

    render(
      createElement(
        BridgeProvider,
        { bridge },
        createElement(ReadsBridge),
      ),
    );
  });
});
