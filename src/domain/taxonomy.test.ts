import { describe, expect, it } from "vitest";

import vectors from "../../tests/fixtures/taxonomy-name-keys.json";
import { taxonomyNameKey } from "./taxonomy";

describe("taxonomyNameKey", () => {
  it("matches the shared trimmed NFKC lowercase vectors", () => {
    for (const vector of vectors) {
      expect(taxonomyNameKey(vector.input)).toBe(vector.key);
    }
  });

  it("rejects names that are empty after normalization", () => {
    expect(() => taxonomyNameKey(" \u3000 ")).toThrow(/empty/i);
  });
});
