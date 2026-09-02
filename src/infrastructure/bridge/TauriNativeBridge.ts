import { invoke as tauriInvoke } from "@tauri-apps/api/core";

import type {
  CreateSiteInput,
  DeletedSiteSnapshot,
  Site,
  SitePage,
  SiteQuery,
  UpdateSiteInput,
} from "../../domain/site";
import type { Category, Tag, TaxonomySnapshot } from "../../domain/taxonomy";
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

  createCategory(input: { name: string; color: string }): Promise<Category> {
    return this.call("create_category", input);
  }

  updateCategory(input: { id: string; name: string; color: string }): Promise<Category> {
    return this.call("update_category", input);
  }

  deleteCategory(id: string): Promise<{ affectedSites: number }> {
    return this.invokeCommand("delete_category", { id });
  }

  createTag(input: { name: string; color: string }): Promise<Tag> {
    return this.call("create_tag", input);
  }

  updateTag(input: { id: string; name: string; color: string }): Promise<Tag> {
    return this.call("update_tag", input);
  }

  deleteTag(id: string): Promise<{ affectedSites: number }> {
    return this.invokeCommand("delete_tag", { id });
  }

  async openUrls(urls: string[]): Promise<void> {
    try {
      await this.invokeFn<void>("open_urls", { urls });
    } catch (error) {
      throw toAppCommandError(error);
    }
  }

  private async call<T>(command: string, input: unknown): Promise<T> {
    return this.invokeCommand(command, { input });
  }

  private async invokeCommand<T>(command: string, args: Record<string, unknown>): Promise<T> {
    try {
      return await this.invokeFn<T>(command, args);
    } catch (error) {
      throw toAppCommandError(error);
    }
  }
}
