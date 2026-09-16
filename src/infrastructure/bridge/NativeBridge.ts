import type {
  CreateSiteInput,
  DeletedSiteSnapshot,
  HealthCheckResultInput,
  Site,
  SitePage,
  SiteQuery,
  UpdateSiteInput,
} from "../../domain/site";
import type { Category, Tag, TaxonomySnapshot } from "../../domain/taxonomy";

export type AppCommandErrorCode =
  | "validation"
  | "not_found"
  | "conflict"
  | "preview_stale"
  | "maintenance"
  | "busy"
  | "unsafe_url"
  | "io"
  | "database"
  | "internal";

export interface AppCommandError {
  code: AppCommandErrorCode;
  message: string;
  details?: string;
}

export interface NativeBridge {
  listSites(query: SiteQuery): Promise<SitePage>;
  getSite(id: string): Promise<Site>;
  createSite(input: CreateSiteInput): Promise<Site>;
  updateSite(input: UpdateSiteInput): Promise<Site>;
  recordHealthChecks(results: HealthCheckResultInput[]): Promise<Site[]>;
  getSitePassword(siteId: string): Promise<string>;
  setSitePassword(siteId: string, password: string): Promise<Site>;
  deleteSitePassword(siteId: string): Promise<Site>;
  deleteSites(ids: string[]): Promise<DeletedSiteSnapshot[]>;
  restoreSites(snapshots: DeletedSiteSnapshot[]): Promise<void>;
  listTaxonomy(): Promise<TaxonomySnapshot>;
  createCategory(input: { name: string; color: string }): Promise<Category>;
  updateCategory(input: { id: string; name: string; color: string }): Promise<Category>;
  deleteCategory(id: string): Promise<{ affectedSites: number }>;
  createTag(input: { name: string; color: string }): Promise<Tag>;
  updateTag(input: { id: string; name: string; color: string }): Promise<Tag>;
  deleteTag(id: string): Promise<{ affectedSites: number }>;
  openUrls(urls: string[]): Promise<void>;
}

export function createAppCommandError(
  code: AppCommandErrorCode,
  message: string,
  details?: string,
): AppCommandError {
  return details === undefined ? { code, message } : { code, message, details };
}

export function toAppCommandError(error: unknown): AppCommandError {
  if (isAppCommandError(error)) {
    return error;
  }

  if (error instanceof Error) {
    return createAppCommandError("internal", error.message);
  }

  return createAppCommandError("internal", "An unexpected native command error occurred.");
}

export function isAppCommandError(error: unknown): error is AppCommandError {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  const candidate = error as { code?: unknown; message?: unknown };
  return (
    typeof candidate.code === "string" &&
    typeof candidate.message === "string"
  );
}
