import vectors from "../../tests/fixtures/url-normalization.json";
import { describe, expect, it } from "vitest";
import { normalizeUrl, type NormalizedUrl } from "./url-normalizer";

interface UrlVector {
  input: string;
  url?: string;
  normalized?: string;
  hostname?: string;
  error?: string;
}

function errorCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null) {
    return undefined;
  }

  const candidate = error as { code?: unknown };
  return typeof candidate.code === "string" ? candidate.code : undefined;
}

describe("normalizeUrl", () => {
  it("matches every successful canonical URL vector", () => {
    for (const vector of vectors as UrlVector[]) {
      if (vector.error !== undefined) {
        continue;
      }

      const result: NormalizedUrl = normalizeUrl(vector.input);

      expect(result.url, vector.input).toBe(vector.url);
      expect(result.normalized, vector.input).toBe(vector.normalized);
      expect(result.hostname, vector.input).toBe(vector.hostname);
    }
  });

  it("matches every stable failure code in the shared vectors", () => {
    for (const vector of vectors as UrlVector[]) {
      if (vector.error === undefined) {
        continue;
      }

      let thrown: unknown;
      try {
        normalizeUrl(vector.input);
      } catch (error) {
        thrown = error;
      }

      expect(errorCode(thrown), vector.input).toBe(vector.error);
    }
  });

  it("keeps HTTP and HTTPS and non-root slash variants distinct", () => {
    const http = normalizeUrl("http://example.com");
    const https = normalizeUrl("https://example.com/");
    const withoutSlash = normalizeUrl("https://example.com/a");
    const withSlash = normalizeUrl("https://example.com/a/");

    expect(http.normalized).not.toBe(https.normalized);
    expect(withoutSlash.normalized).not.toBe(withSlash.normalized);
  });
});
