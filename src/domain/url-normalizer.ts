export interface NormalizedUrl {
  url: string;
  normalized: string;
  hostname: string;
}

export type UrlNormalizationErrorCode =
  | "empty_url"
  | "unsafe_url"
  | "credentials_not_allowed"
  | "invalid_host";

export class UrlNormalizationError extends Error {
  readonly code: UrlNormalizationErrorCode;

  constructor(code: UrlNormalizationErrorCode, message: string) {
    super(message);
    this.name = "UrlNormalizationError";
    this.code = code;
  }
}

const SCHEME_PATTERN = /^[A-Za-z][A-Za-z\d+.-]*:/;

export function normalizeUrl(raw: string): NormalizedUrl {
  const input = raw.trim();
  if (input.length === 0) {
    throw new UrlNormalizationError("empty_url", "URL cannot be empty.");
  }

  const candidate = SCHEME_PATTERN.test(input) ? input : `https://${input}`;
  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    throw new UrlNormalizationError("invalid_host", "URL hostname is invalid.");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new UrlNormalizationError("unsafe_url", "Only HTTP and HTTPS URLs are allowed.");
  }
  if (parsed.username.length > 0 || parsed.password.length > 0) {
    throw new UrlNormalizationError(
      "credentials_not_allowed",
      "Credentials are not allowed in URLs.",
    );
  }
  if (parsed.hostname.length === 0) {
    throw new UrlNormalizationError("invalid_host", "URL hostname is invalid.");
  }

  const canonical = parsed.href;
  return {
    url: canonical,
    normalized: canonical,
    hostname: parsed.hostname,
  };
}
