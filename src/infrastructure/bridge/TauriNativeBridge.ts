import { invoke as tauriInvoke } from "@tauri-apps/api/core";

import type {
  CreateSiteInput,
  DeletedSiteSnapshot,
  Site,
  SitePage,
  SiteQuery,
  UpdateSiteInput,
} from "../../domain/site";
import type { TaxonomySnapshot } from "../../domain/taxonomy";
import type { NativeBridge } from "./NativeBridge";
import { toAppCommandError } from "./NativeBridge";

export type InvokeFunction = <T>(
  command: string,
  args?: Record<string, unknown>,
) => Promise<T>;

export class TauriNativeBridge implements NativeBridge {
  constructor(private readonly invokeFn: InvokeFunction = tauriInvoke) {}

  listSites(query: SiteQuery): Promise<SitePage> {
    return this.call("list_sites", query);
  }

  getSite(id: string): Promise<Site> {
    return this.call("get_site", { id });
  }

  createSite(input: CreateSiteInput): Promise<Site> {
    return this.call("create_site", input);
  }

  updateSite(input: UpdateSiteInput): Promise<Site> {
    return this.call("update_site", input);
  }

  deleteSites(ids: string[]): Promise<DeletedSiteSnapshot[]> {
    return this.call("delete_sites", { ids });
  }

  restoreSites(snapshots: DeletedSiteSnapshot[]): Promise<void> {
    return this.call("restore_sites", { snapshots });
  }

  listTaxonomy(): Promise<TaxonomySnapshot> {
    return this.call("list_taxonomy", {});
  }

  openUrls(urls: string[]): Promise<void> {
    return this.call("open_urls", { urls });
  }

  private async call<T>(command: string, input: unknown): Promise<T> {
    try {
      return await this.invokeFn<T>(command, { input });
    } catch (error) {
      throw toAppCommandError(error);
    }
  }
}
