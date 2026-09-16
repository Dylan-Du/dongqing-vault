import type {
  CreateSiteInput,
  DeletedSiteSnapshot,
  HealthCheckResultInput,
  Site,
  UpdateSiteInput,
} from "../../domain/site";
import type { Category, Tag } from "../../domain/taxonomy";
import {
  MockNativeBridge,
  type MockNativeBridgeState,
} from "./MockNativeBridge";

const STORAGE_KEY = "domain-manager.catalog.v1";

/**
 * Browser-preview bridge. The desktop build uses TauriNativeBridge, while the
 * Vite preview keeps the same NativeBridge contract backed by localStorage.
 */
export class LocalStorageBridge extends MockNativeBridge {
  constructor(state: MockNativeBridgeState = readState()) {
    super(state);
  }

  private persist() {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.snapshot()));
    }
  }

  override async createSite(input: CreateSiteInput): Promise<Site> {
    const result = await super.createSite(input);
    this.persist();
    return result;
  }

  override async updateSite(input: UpdateSiteInput): Promise<Site> {
    const result = await super.updateSite(input);
    this.persist();
    return result;
  }

  override async getSitePassword(_siteId: string): Promise<string> {
    throw new Error("密码仅能在 macOS 桌面应用中使用钥匙串保存和读取。");
  }

  override async setSitePassword(_siteId: string, _password: string): Promise<Site> {
    throw new Error("密码仅能在 macOS 桌面应用中使用钥匙串保存和读取。");
  }

  override async deleteSitePassword(_siteId: string): Promise<Site> {
    throw new Error("密码仅能在 macOS 桌面应用中使用钥匙串保存和读取。");
  }

  override async recordHealthChecks(results: HealthCheckResultInput[]): Promise<Site[]> {
    const updated = await super.recordHealthChecks(results);
    this.persist();
    return updated;
  }

  override async deleteSites(ids: string[]): Promise<DeletedSiteSnapshot[]> {
    const result = await super.deleteSites(ids);
    this.persist();
    return result;
  }

  override async restoreSites(snapshots: DeletedSiteSnapshot[]): Promise<void> {
    await super.restoreSites(snapshots);
    this.persist();
  }

  override async createCategory(input: { name: string; color: string }): Promise<Category> {
    const result = await super.createCategory(input);
    this.persist();
    return result;
  }

  override async updateCategory(input: { id: string; name: string; color: string }): Promise<Category> {
    const result = await super.updateCategory(input);
    this.persist();
    return result;
  }

  override async deleteCategory(id: string): Promise<{ affectedSites: number }> {
    const result = await super.deleteCategory(id);
    this.persist();
    return result;
  }

  override async createTag(input: { name: string; color: string }): Promise<Tag> {
    const result = await super.createTag(input);
    this.persist();
    return result;
  }

  override async updateTag(input: { id: string; name: string; color: string }): Promise<Tag> {
    const result = await super.updateTag(input);
    this.persist();
    return result;
  }

  override async deleteTag(id: string): Promise<{ affectedSites: number }> {
    const result = await super.deleteTag(id);
    this.persist();
    return result;
  }

  override async openUrls(urls: string[]): Promise<void> {
    if (typeof window === "undefined") {
      await super.openUrls(urls);
      return;
    }
    urls.forEach((url) => window.open(url, "_blank", "noopener,noreferrer"));
  }
}

function readState(): MockNativeBridgeState {
  if (typeof localStorage !== "undefined") {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as MockNativeBridgeState;
        if (Array.isArray(parsed.sites) && Array.isArray(parsed.categories) && Array.isArray(parsed.tags)) {
          return { ...parsed, sites: parsed.sites.map((site) => ({ ...site, username: site.username ?? "", hasPassword: false })) };
        }
      } catch {
        // A malformed local preview snapshot is replaced by the starter data.
      }
    }
  }
  return seedState();
}

function seedState(): MockNativeBridgeState {
  const now = "2026-09-01T09:00:00.000Z";
  const categories = [
    category("cat-work", "工作", "#4F7CFF", now),
    category("cat-design", "设计", "#A66CFF", now),
    category("cat-dev", "开发", "#11A683", now),
    category("cat-life", "生活", "#F08A5D", now),
  ];
  const tags = [
    tag("tag-frequent", "常用", "#4F7CFF", now),
    tag("tag-tool", "工具", "#11A683", now),
    tag("tag-ai", "AI", "#A66CFF", now),
    tag("tag-reference", "参考", "#F08A5D", now),
  ];
  const sites = [
    site("site-github", "GitHub", "github.com", "https://github.com/", "代码托管与协作平台", "cat-dev", ["tag-frequent", "tag-tool"], true, "available", now),
    site("site-vercel", "Vercel", "vercel.com", "https://vercel.com/", "前端部署与边缘平台", "cat-dev", ["tag-frequent", "tag-tool"], true, "available", now),
    site("site-chatgpt", "ChatGPT", "chatgpt.com", "https://chatgpt.com/", "AI 对话与创作助手", "cat-work", ["tag-ai", "tag-frequent"], false, "available", now),
    site("site-figma", "Figma", "figma.com", "https://www.figma.com/", "在线界面设计协作", "cat-design", ["tag-frequent", "tag-tool"], false, "available", now),
    site("site-mdn", "MDN Web Docs", "developer.mozilla.org", "https://developer.mozilla.org/zh-CN/", "Web API 权威参考", "cat-dev", ["tag-reference", "tag-tool"], false, "unchecked", now),
    site("site-linear", "Linear", "linear.app", "https://linear.app/", "产品研发项目管理", "cat-work", ["tag-tool"], false, "available", now),
    site("site-notion", "Notion", "notion.so", "https://www.notion.so/", "团队知识库与工作台", "cat-work", ["tag-frequent", "tag-tool"], false, "available", now),
    site("site-dribbble", "Dribbble", "dribbble.com", "https://dribbble.com/", "设计灵感与作品展示", "cat-design", ["tag-reference"], false, "unavailable", now),
  ];
  return { sites, categories, tags };
}

function category(id: string, name: string, color: string, timestamp: string) {
  return { id, name, nameKey: name.toLocaleLowerCase(), color, sortIndex: 0, createdAt: timestamp, updatedAt: timestamp, siteCount: 0 };
}

function tag(id: string, name: string, color: string, timestamp: string) {
  return { ...category(id, name, color, timestamp) };
}

function site(
  id: string,
  name: string,
  domain: string,
  url: string,
  notes: string,
  categoryId: string,
  tagIds: string[],
  isPinned: boolean,
  autoStatus: Site["autoStatus"],
  timestamp: string,
): Site {
  return {
    id,
    name,
    domain,
    url,
    normalizedUrl: url,
    notes,
    username: "",
    hasPassword: false,
    categoryId,
    tagIds,
    isPinned,
    autoStatus,
    manualStatus: null,
    failureStreak: autoStatus === "unavailable" ? 1 : 0,
    lastCheckedAt: timestamp,
    lastSuccessAt: autoStatus === "available" ? timestamp : null,
    lastCheckSource: "scheduled",
    lastHttpStatus: autoStatus === "available" ? 200 : autoStatus === "unavailable" ? 503 : null,
    lastResponseMs: autoStatus === "unchecked" ? null : 280,
    lastCheckError: autoStatus === "unavailable" ? "连接超时" : null,
    createdAt: timestamp,
    updatedAt: timestamp,
    urlRevision: 1,
    rowRevision: 1,
  };
}
