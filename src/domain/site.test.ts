import { describe, expect, it } from "vitest";
import { siteFixture } from "../test/fixtures";
import { effectiveStatus, hasManualOverride, needsAttention, willResetStatus } from "./site";

describe("site status model", () => {
  it("uses manual status and exposes its marker", () => {
    const site = siteFixture({ autoStatus: "unavailable", manualStatus: "available" });
    expect(effectiveStatus(site)).toBe("available");
    expect(hasManualOverride(site)).toBe(true);
    expect(needsAttention(site)).toBe(false);
  });

  it("predicts reset only when normalized URL changes", () => {
    const site = siteFixture({ normalizedUrl: "https://example.com/" });
    expect(willResetStatus(site, " HTTPS://EXAMPLE.COM ")).toBe(false);
    expect(willResetStatus(site, "https://example.com/new")).toBe(true);
  });

  it("keeps every portable field serializable", () => {
    const site = siteFixture({ tagIds: ["a", "b"], rowRevision: 7, urlRevision: 3 });
    expect(JSON.parse(JSON.stringify(site))).toEqual(site);
  });
});
