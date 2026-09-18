import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  AlertCircle,
  ArrowUpDown,
  Check,
  CheckCircle2,
  CircleDashed,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  CircleHelp,
  Clock3,
  Database,
  Download,
  ExternalLink,
  FileJson,
  FileText,
  Folder,
  FolderPlus,
  Globe,
  LayoutGrid,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Star,
  Tag as TagIcon,
  Tags,
  Trash2,
  Upload,
  X,
  XCircle,
} from "lucide-react";

import {
  effectiveStatus,
  needsAttention,
  type CreateSiteInput,
  type HealthCheckResultInput,
  type ManualStatus,
  type Site,
  type SiteQuery,
} from "../domain/site";
import { normalizeSiteQuery } from "../domain/site-query";
import type { CategoryListItem, TagListItem, TaxonomySnapshot } from "../domain/taxonomy";
import type { NativeBridge } from "../infrastructure/bridge/NativeBridge";
import { LocalStorageBridge } from "../infrastructure/bridge/LocalStorageBridge";
import { useOptionalNativeBridge } from "../infrastructure/bridge/BridgeContext";
import "./app.css";

type ViewFilter = "all" | "pinned" | "attention" | "unchecked";
type ToastVariant = "success" | "error";

interface ToastState {
  message: string;
  variant: ToastVariant;
}

interface DraftForm {
  name: string;
  domain: string;
  url: string;
  notes: string;
  username: string;
  password: string;
  passwordDirty: boolean;
  hasPassword: boolean;
  categoryId: string | null;
  tagIds: string[];
  isPinned: boolean;
  manualStatus: ManualStatus;
}

interface EditorState {
  siteId: string | null;
  expectedRowRevision: number | null;
  form: DraftForm;
}

interface AppSettings {
  intervalMinutes: number;
  checkOnLaunch: boolean;
  autoCheck: boolean;
}

const SETTINGS_KEY = "domain-manager.settings.v1";
const EMPTY_TAXONOMY: TaxonomySnapshot = { categories: [], tags: [] };
const DEFAULT_SETTINGS: AppSettings = { intervalMinutes: 30, checkOnLaunch: true, autoCheck: true };

export function App() {
  const providedBridge = useOptionalNativeBridge();
  const [fallbackBridge] = useState<NativeBridge>(() => new LocalStorageBridge());
  const bridge = providedBridge ?? fallbackBridge;
  const [sites, setSites] = useState<Site[]>([]);
  const [taxonomy, setTaxonomy] = useState<TaxonomySnapshot>(EMPTY_TAXONOMY);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [view, setView] = useState<ViewFilter>("all");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<SiteQuery["status"]>(null);
  const [sortBy, setSortBy] = useState<SiteQuery["sortBy"]>("updatedAt");
  const [sortDirection, setSortDirection] = useState<SiteQuery["sortDirection"]>("desc");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [taxonomyOpen, setTaxonomyOpen] = useState(false);
  const [settings, setSettings] = useState<AppSettings>(() => readSettings());
  const [checking, setChecking] = useState(false);
  const [lastCheckAt, setLastCheckAt] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const launchCheckDone = useRef(false);
  const loadRequestRef = useRef(0);

  const query = useMemo(
    () =>
      normalizeSiteQuery({
        keyword: search,
        categoryId: activeCategory,
        tagIds: activeTag ? [activeTag] : [],
        // Status is filtered against the live in-memory check results below.
        status: null,
        sortBy,
        sortDirection,
        offset: 0,
        limit: 200,
      }),
    [activeCategory, activeTag, search, sortBy, sortDirection],
  );

  const notify = useCallback((message: string, variant: ToastVariant = "success") => {
    setToast({ message, variant });
    window.setTimeout(() => setToast((current) => (current?.message === message ? null : current)), 3400);
  }, []);

  const loadCatalog = useCallback(async () => {
    const requestId = ++loadRequestRef.current;
    setLoading(true);
    try {
      const [page, nextTaxonomy] = await Promise.all([bridge.listSites(query), bridge.listTaxonomy()]);
      if (requestId !== loadRequestRef.current) return;
      const loadedSites = page.items;
      setSites(loadedSites);
      setTotal(page.total);
      setTaxonomy(nextTaxonomy);
      setSelectedIds((current) => current.filter((id) => loadedSites.some((site) => site.id === id)));
    } catch (error) {
      if (requestId === loadRequestRef.current) {
        notify(error instanceof Error ? error.message : "加载收藏库失败", "error");
      }
    } finally {
      if (requestId === loadRequestRef.current) setLoading(false);
    }
  }, [bridge, notify, query]);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  const visibleSites = useMemo(() => {
    let filtered = sites;
    if (view === "pinned") filtered = filtered.filter((site) => site.isPinned);
    if (view === "attention") filtered = filtered.filter((site) => needsAttention(site));
    if (view === "unchecked") return filtered.filter((site) => effectiveStatus(site) === "unchecked");
    if (statusFilter) filtered = filtered.filter((site) => effectiveStatus(site) === statusFilter);
    return filtered;
  }, [sites, statusFilter, view]);

  const pinnedCount = useMemo(() => sites.filter((site) => site.isPinned).length, [sites]);
  const attentionCount = useMemo(() => sites.filter(needsAttention).length, [sites]);
  const uncheckedCount = useMemo(() => sites.filter((site) => effectiveStatus(site) === "unchecked").length, [sites]);
  // Derive metric cards from the currently visible rows so search/view filters
  // and in-memory health-check results are reflected immediately and consistently.
  const liveSummary = useMemo(() => ({
    total: visibleSites.length,
    available: visibleSites.filter((site) => effectiveStatus(site) === "available").length,
    needsAttention: visibleSites.filter(needsAttention).length,
  }), [visibleSites]);
  const pageTitle = view === "pinned" ? "置顶收藏" : view === "attention" ? "需要关注" : view === "unchecked" ? "待检测" : "所有网站";

  const openEditor = useCallback((site?: Site) => {
    setEditor({
      siteId: site?.id ?? null,
      expectedRowRevision: site?.rowRevision ?? null,
      form: site ? siteToDraft(site) : emptyDraft(),
    });
  }, []);

  const saveSite = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!editor) return;
      if (!editor.form.url.trim()) {
        notify("请填写网址", "error");
        return;
      }
      try {
        const { password, passwordDirty, hasPassword: _hasPassword, ...siteInput } = editor.form;
        const savedSite = editor.siteId && editor.expectedRowRevision !== null
          ? await bridge.updateSite({
              id: editor.siteId,
              expectedRowRevision: editor.expectedRowRevision,
              ...siteInput,
            })
          : await bridge.createSite(siteInput);
        if (passwordDirty) {
          if (password) await bridge.setSitePassword(savedSite.id, password);
          else if (savedSite.hasPassword || editor.form.hasPassword) await bridge.deleteSitePassword(savedSite.id);
        }
        notify(editor.siteId ? "网站信息已更新" : "网站已加入收藏库");
        setEditor(null);
        await loadCatalog();
      } catch (error) {
        notify(error instanceof Error ? error.message : "保存网站失败", "error");
      }
    },
    [bridge, editor, loadCatalog, notify],
  );

  const updateSite = useCallback(
    async (site: Site, patch: Partial<CreateSiteInput>) => {
      try {
        await bridge.updateSite({
          id: site.id,
          expectedRowRevision: site.rowRevision,
          name: site.name,
          domain: site.domain,
          url: site.url,
          notes: site.notes,
          username: site.username,
          categoryId: site.categoryId,
          tagIds: site.tagIds,
          isPinned: site.isPinned,
          manualStatus: site.manualStatus,
          ...patch,
        });
        await loadCatalog();
      } catch (error) {
        notify(error instanceof Error ? error.message : "更新网站失败", "error");
      }
    },
    [bridge, loadCatalog, notify],
  );

  const removeSites = useCallback(
    async (ids: string[]) => {
      if (!ids.length || !window.confirm(`确定删除 ${ids.length} 个网站吗？`)) return;
      try {
        await bridge.deleteSites(ids);
        setSelectedIds([]);
        notify(`已删除 ${ids.length} 个网站`);
        await loadCatalog();
      } catch (error) {
        notify(error instanceof Error ? error.message : "删除网站失败", "error");
      }
    },
    [bridge, loadCatalog, notify],
  );

  const revealEditorPassword = useCallback(async () => {
    if (!editor?.siteId || !editor.form.hasPassword || editor.form.password) return false;
    try {
      const password = await bridge.getSitePassword(editor.siteId);
      setEditor((current) => current?.siteId === editor.siteId ? { ...current, form: { ...current.form, password } } : current);
      return true;
    } catch (error) {
      notify(error instanceof Error ? error.message : "读取密码失败", "error");
      return false;
    }
  }, [bridge, editor, notify]);

  const copyCredential = useCallback(async (site: Site, kind: "username" | "password") => {
    try {
      const value = kind === "username" ? site.username : await bridge.getSitePassword(site.id);
      if (!value) { notify(kind === "username" ? "该网站未保存账号" : "该网站未保存密码", "error"); return; }
      await navigator.clipboard.writeText(value);
      notify(kind === "username" ? "账号已复制" : "密码已复制");
    } catch (error) {
      notify(error instanceof Error ? error.message : "复制失败", "error");
    }
  }, [bridge, notify]);

  const openSite = useCallback(
    async (site: Site) => {
      try {
        await bridge.openUrls([site.normalizedUrl]);
        notify(`已在系统浏览器打开 ${site.name}`);
      } catch (error) {
        notify(error instanceof Error ? error.message : "无法打开网址", "error");
      }
    },
    [bridge, notify],
  );

  const checkOne = useCallback(async (site: Site, source: "manual" | "scheduled"): Promise<HealthCheckResultInput> => {
    const controller = new AbortController();
    const startedAt = performance.now();
    const timer = window.setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(site.normalizedUrl, {
        method: "HEAD",
        mode: "no-cors",
        cache: "no-store",
        signal: controller.signal,
      });
      const available = response.type === "opaque" || response.ok || response.status < 500;
      return {
        id: site.id,
        expectedUrlRevision: site.urlRevision,
        autoStatus: available ? "available" : "unavailable",
        failureStreak: available ? 0 : Math.min(2, site.failureStreak + 1) as Site["failureStreak"],
        checkedAt: new Date().toISOString(),
        source,
        httpStatus: response.status || null,
        responseMs: Math.round(performance.now() - startedAt),
        error: available ? null : `HTTP ${response.status}`,
      };
    } catch (error) {
      const timedOut = error instanceof DOMException && error.name === "AbortError";
      return {
        id: site.id,
        expectedUrlRevision: site.urlRevision,
        autoStatus: "unavailable",
        failureStreak: Math.min(2, site.failureStreak + 1) as Site["failureStreak"],
        checkedAt: new Date().toISOString(),
        source,
        httpStatus: null,
        responseMs: Math.round(performance.now() - startedAt),
        error: timedOut ? "请求超时" : "无法连接",
      };
    } finally {
      window.clearTimeout(timer);
    }
  }, []);

  const runHealthCheck = useCallback(
    async (source: "manual" | "scheduled" = "manual") => {
      if (checking || sites.length === 0) return;
      setChecking(true);
      try {
        const results = await Promise.all(sites.map((site) => checkOne(site, source)));
        const updatedSites = await bridge.recordHealthChecks(results);
        const resultMap = Object.fromEntries(updatedSites.map((site) => [site.id, site])) as Record<string, Site>;
        setSites((current) => current.map((site) => resultMap[site.id] ?? site));
        setLastCheckAt(new Date().toISOString());
        if (source === "manual") notify(`已完成 ${updatedSites.length} 个网址检测`);
      } catch (error) {
        if (source === "manual") {
          notify(error instanceof Error ? error.message : "保存检测结果失败", "error");
        }
      } finally {
        setChecking(false);
      }
    },
    [bridge, checkOne, checking, notify, sites],
  );

  useEffect(() => {
    if (isTestEnvironment()) return undefined;
    if (!settings.autoCheck) return undefined;
    const timer = window.setInterval(() => void runHealthCheck("scheduled"), settings.intervalMinutes * 60 * 1000);
    return () => window.clearInterval(timer);
  }, [runHealthCheck, settings.autoCheck, settings.intervalMinutes]);

  useEffect(() => {
    if (isTestEnvironment()) return;
    if (!settings.checkOnLaunch || launchCheckDone.current || sites.length === 0) return;
    launchCheckDone.current = true;
    void runHealthCheck("scheduled");
  }, [runHealthCheck, settings.checkOnLaunch, sites.length]);

  useEffect(() => {
    if (!isTauriRuntime()) return undefined;
    let unlisten: (() => void) | undefined;
    void import("@tauri-apps/api/event")
      .then(({ listen }) => listen("tray:check-all", () => runHealthCheck("scheduled")))
      .then((dispose) => { unlisten = dispose; });
    return () => unlisten?.();
  }, [runHealthCheck]);

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

  // Refresh the catalog when the page becomes visible again (tray reveal /
  // dock reopen), so the list is never stale after staying hidden in the tray.
  useEffect(() => {
    const onDocumentVisible = () => {
      if (document.visibilityState === "visible") void loadCatalog();
    };
    document.addEventListener("visibilitychange", onDocumentVisible);
    return () => document.removeEventListener("visibilitychange", onDocumentVisible);
  }, [loadCatalog]);


  const toggleSelected = (id: string) => {
    setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  };

  const toggleAll = () => {
    setSelectedIds(selectedIds.length === visibleSites.length ? [] : visibleSites.map((site) => site.id));
  };

  const exportData = useCallback((format: "json" | "csv") => {
    const payload = { version: 1, exportedAt: new Date().toISOString(), categories: taxonomy.categories, tags: taxonomy.tags, sites };
    if (format === "json") {
      downloadFile("domain-manager-export.json", JSON.stringify(payload, null, 2), "application/json");
    } else {
      downloadFile("domain-manager-export.csv", buildCsv(sites, taxonomy), "text/csv;charset=utf-8");
    }
    notify(`已导出 ${sites.length} 条记录`);
  }, [notify, sites, taxonomy]);

  const importFile = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const text = await file.text();
      const document = parseImportDocument(text, file.name.toLocaleLowerCase().endsWith(".csv"));
      const rows = document.rows;
      if (!rows.length) throw new Error("文件中没有可导入的网站记录");
      const categoryMap = new Map(taxonomy.categories.map((item) => [item.nameKey, item.id]));
      const tagMap = new Map(taxonomy.tags.map((item) => [item.nameKey, item.id]));
      const categoryIdMap = new Map<string, string>();
      const tagIdMap = new Map<string, string>();
      for (const definition of document.categories) {
        const key = definition.name.trim().toLocaleLowerCase();
        const existing = categoryMap.get(key);
        const category = existing ? null : await bridge.createCategory({ name: definition.name, color: definition.color || "#4F7CFF" });
        const resolvedId = existing ?? category?.id;
        if (resolvedId) {
          categoryMap.set(key, resolvedId);
          categoryIdMap.set(definition.id, resolvedId);
        }
      }
      for (const definition of document.tags) {
        const key = definition.name.trim().toLocaleLowerCase();
        const existing = tagMap.get(key);
        const tag = existing ? null : await bridge.createTag({ name: definition.name, color: definition.color || "#11A683" });
        const resolvedId = existing ?? tag?.id;
        if (resolvedId) {
          tagMap.set(key, resolvedId);
          tagIdMap.set(definition.id, resolvedId);
        }
      }
      let imported = 0;
      for (const row of rows) {
        let categoryId: string | null = row.categoryId ? categoryIdMap.get(row.categoryId) ?? row.categoryId : null;
        if (!categoryId && row.category) {
          const key = row.category.trim().toLocaleLowerCase();
          categoryId = categoryMap.get(key) ?? null;
          if (!categoryId) {
            const category = await bridge.createCategory({ name: row.category.trim(), color: "#4F7CFF" });
            categoryId = category.id;
            categoryMap.set(category.nameKey, category.id);
          }
        }
        const tagIds: string[] = [];
        for (const tag of row.tags) {
          const key = tag.trim().toLocaleLowerCase();
          if (!key) continue;
          let tagId = tagMap.get(key);
          if (!tagId) tagId = tagIdMap.get(tag);
          if (!tagId) {
            const created = await bridge.createTag({ name: tag.trim(), color: "#11A683" });
            tagId = created.id;
            tagMap.set(created.nameKey, created.id);
          }
          tagIds.push(tagId);
        }
        await bridge.createSite({
          name: row.name,
          domain: row.domain,
          url: row.url,
          notes: row.notes,
          categoryId,
          tagIds,
          isPinned: row.isPinned,
          manualStatus: row.manualStatus,
          username: "",
        });
        imported += 1;
      }
      notify(`已导入 ${imported} 条记录`);
      await loadCatalog();
    } catch (error) {
      notify(error instanceof Error ? error.message : "导入失败", "error");
    }
  }, [bridge, loadCatalog, notify, taxonomy]);

  const backup = useCallback(() => exportData("json"), [exportData]);

  const addTaxonomy = useCallback(async (kind: "category" | "tag", name: string, color: string) => {
    if (!name.trim()) return;
    try {
      if (kind === "category") await bridge.createCategory({ name, color });
      else await bridge.createTag({ name, color });
      notify(`${kind === "category" ? "分类" : "标签"}已创建`);
      await loadCatalog();
    } catch (error) {
      notify(error instanceof Error ? error.message : "创建失败", "error");
    }
  }, [bridge, loadCatalog, notify]);

  const deleteTaxonomy = useCallback(async (kind: "category" | "tag", item: CategoryListItem | TagListItem) => {
    if (!window.confirm(`删除${kind === "category" ? "分类" : "标签"}“${item.name}”？`)) return;
    try {
      if (kind === "category") await bridge.deleteCategory(item.id);
      else await bridge.deleteTag(item.id);
      if (kind === "category" && activeCategory === item.id) setActiveCategory(null);
      if (kind === "tag" && activeTag === item.id) setActiveTag(null);
      notify(`${kind === "category" ? "分类" : "标签"}已删除`);
      await loadCatalog();
    } catch (error) {
      notify(error instanceof Error ? error.message : "删除失败", "error");
    }
  }, [activeCategory, activeTag, bridge, loadCatalog, notify]);

  return (
    <div className="app-shell">
      <Sidebar
        view={view}
        setView={setView}
        categories={taxonomy.categories}
        tags={taxonomy.tags}
        activeCategory={activeCategory}
        activeTag={activeTag}
        setActiveCategory={(id) => { setActiveCategory(id); setActiveTag(null); if (id !== null) setView("all"); }}
        setActiveTag={(id) => { setActiveTag(id); setActiveCategory(null); if (id !== null) setView("all"); }}
        counts={{ total, pinned: pinnedCount, attention: attentionCount, unchecked: uncheckedCount }}
        onAdd={() => openEditor()}
        onTaxonomy={() => setTaxonomyOpen(true)}
        onDeleteTaxonomy={deleteTaxonomy}
        onSettings={() => setSettingsOpen(true)}
      />
      <main className="main-content">
        <div className="ambient-field" aria-hidden="true" />
        <header className="topbar">
          <div className="breadcrumb"><span>收藏库</span><span>/</span><strong>{pageTitle}</strong></div>
          <div className="top-actions">
            <div className="local-badge"><span />本地存储</div>
            <button className="top-action" type="button" onClick={() => setSettingsOpen(true)}><Settings2 size={14} />设置</button>
            <button className="top-action primary" type="button" onClick={() => void runHealthCheck()}><RefreshCw size={14} className={checking ? "spin" : undefined} />{checking ? "检测中" : "立即检测"}</button>
          </div>
        </header>

        <div className="content-scroll">
        <section className="page-intro">
          <div>
            <p className="eyebrow">DOMAIN / LOCAL COLLECTION</p>
            <h2 className="page-title">{pageTitle}</h2>
            <p className="page-description">整理你每天都会打开的网站，轻松找到并快速访问。</p>
          </div>
          <div className="last-check"><Clock3 size={14} />{lastCheckAt ? `最近检测 ${formatRelative(lastCheckAt)}` : "尚未检测"}</div>
        </section>

        <section className="metrics" aria-label="收藏库概览">
          <MetricCard icon={<LayoutGrid size={15} />} label="收藏总数" value={liveSummary.total} note="当前筛选" />
          <MetricCard icon={<CheckCircle2 size={15} />} label="可用网站" value={liveSummary.available} note={liveSummary.total ? `${Math.round(liveSummary.available / liveSummary.total * 100)}% 可用` : "暂无数据"} tone="success" />
          <MetricCard icon={<AlertCircle size={15} />} label="需要关注" value={liveSummary.needsAttention} note="待处理" tone="warning" />
        </section>

        <section className="collection-card">
          <div className="collection-toolbar">
            <div className="search-box"><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索名称、域名、备注或标签…" aria-label="搜索网站" /></div>
            <select className="filter-select" value={activeCategory ?? ""} onChange={(event) => { setActiveCategory(event.target.value || null); setActiveTag(null); setView("all"); }} aria-label="按分类筛选">
              <option value="">全部分类</option>
              {taxonomy.categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
            <select className="filter-select" value={activeTag ?? ""} onChange={(event) => { setActiveTag(event.target.value || null); setActiveCategory(null); setView("all"); }} aria-label="按标签筛选">
              <option value="">全部标签</option>
              {taxonomy.tags.map((tag) => <option key={tag.id} value={tag.id}>{tag.name}</option>)}
            </select>
            <select className="filter-select" value={statusFilter ?? ""} onChange={(event) => setStatusFilter((event.target.value || null) as SiteQuery["status"])} aria-label="按状态筛选">
              <option value="">全部状态</option><option value="available">可用</option><option value="unavailable">失效</option><option value="unchecked">未检测</option>
            </select>
            <select className="filter-select" value={`${sortBy}:${sortDirection}`} onChange={(event) => { const [nextSort, nextDirection] = event.target.value.split(":") as [SiteQuery["sortBy"], SiteQuery["sortDirection"]]; setSortBy(nextSort); setSortDirection(nextDirection); }} aria-label="排序">
              <option value="updatedAt:desc">最近更新</option><option value="name:asc">名称 A-Z</option><option value="domain:asc">域名 A-Z</option><option value="createdAt:desc">最近添加</option><option value="status:asc">状态</option>
            </select>
            <button className="toolbar-icon" type="button" title="管理分类与标签" onClick={() => setTaxonomyOpen(true)}><SlidersHorizontal size={15} /></button>
          </div>
          <div className="selection-bar">
            <div className="selection-summary"><strong>{visibleSites.length}</strong><span>条记录</span>{selectedIds.length > 0 && <><span>·</span><strong>{selectedIds.length}</strong><span>已选择</span></>}</div>
            <div className="selection-actions">
              {selectedIds.length > 0 && <button className="small-action danger" type="button" onClick={() => void removeSites(selectedIds)}><Trash2 size={13} />批量删除</button>}
              <button className="small-action" type="button" onClick={() => exportData("csv")}><Download size={13} />导出 CSV</button>
              <button className="small-action" type="button" onClick={() => importInputRef.current?.click()}><Upload size={13} />导入</button>
            </div>
          </div>
          <div className="table-wrap">
            {loading ? <LoadingRows /> : visibleSites.length === 0 ? <EmptyState onAdd={() => openEditor()} hasFilters={Boolean(search || activeCategory || activeTag || statusFilter || view !== "all")} /> : (
              <table className="site-table">
                <thead><tr><th><input className="check-control" type="checkbox" checked={visibleSites.length > 0 && selectedIds.length === visibleSites.length} onChange={toggleAll} aria-label="全选" /></th><th>网站</th><th>分类</th><th>状态</th><th>标签</th><th>操作</th></tr></thead>
                <tbody>{visibleSites.map((site) => <SiteRow key={site.id} site={site} categories={taxonomy.categories} tags={taxonomy.tags} selected={selectedIds.includes(site.id)} onToggle={() => toggleSelected(site.id)} onOpen={() => void openSite(site)} onEdit={() => openEditor(site)} onDelete={() => void removeSites([site.id])} onPin={() => void updateSite(site, { isPinned: !site.isPinned })} onCopyUsername={() => void copyCredential(site, "username")} onCopyPassword={() => void copyCredential(site, "password")} />)}</tbody>
              </table>
            )}
          </div>
          {!loading && visibleSites.length > 0 && <div className="table-footer"><span>显示 {visibleSites.length} 条，共 {total} 条</span><span>数据保存在本机 · {settings.autoCheck ? `${settings.intervalMinutes} 分钟自动检测` : "自动检测已暂停"}</span></div>}
        </section>
        </div>
      </main>

      <input ref={importInputRef} type="file" accept=".json,.csv,application/json,text/csv" onChange={(event) => void importFile(event)} hidden />
      {editor && <EditorDrawer editor={editor} categories={taxonomy.categories} tags={taxonomy.tags} onChange={(form) => setEditor((current) => current ? { ...current, form } : current)} onClose={() => setEditor(null)} onSave={saveSite} onRevealPassword={revealEditorPassword} />}
      {settingsOpen && <SettingsDialog settings={settings} onChange={(next) => setSettings(next)} onBackup={backup} onImport={() => importInputRef.current?.click()} onClose={() => setSettingsOpen(false)} />}
      {taxonomyOpen && <TaxonomyDialog categories={taxonomy.categories} tags={taxonomy.tags} onAdd={addTaxonomy} onDelete={deleteTaxonomy} onClose={() => setTaxonomyOpen(false)} />}
      {toast && <div className={`toast ${toast.variant}`} role="status">{toast.variant === "success" ? <CheckCircle2 size={15} /> : <XCircle size={15} />}{toast.message}</div>}
    </div>
  );
}

function Sidebar(props: {
  view: ViewFilter;
  setView: (view: ViewFilter) => void;
  categories: CategoryListItem[];
  tags: TagListItem[];
  activeCategory: string | null;
  activeTag: string | null;
  setActiveCategory: (id: string | null) => void;
  setActiveTag: (id: string | null) => void;
  counts: { total: number; pinned: number; attention: number; unchecked: number };
  onAdd: () => void;
  onTaxonomy: () => void;
  onDeleteTaxonomy: (kind: "category" | "tag", item: CategoryListItem | TagListItem) => Promise<void>;
  onSettings: () => void;
}) {
  return (
    <aside className="sidebar">
      <div className="sidebar-fixed">
        <div className="brand-row"><div className="brand-mark">V</div><div><h1 className="brand-title">东青Vault</h1><span className="brand-subtitle">LINKS, READY.</span></div></div>
        <button className="add-site-button" type="button" onClick={props.onAdd}><Plus size={16} />添加网站</button>
      </div>
      <div className="sidebar-scroll">
        <div className="side-section">
          <div className="side-section-title">收藏库</div>
          <nav className="side-nav">
            <SidebarNavItem icon={<LayoutGrid size={15} />} label="所有网站" count={props.counts.total} active={props.view === "all" && !props.activeCategory && !props.activeTag} onClick={() => { props.setView("all"); props.setActiveCategory(null); props.setActiveTag(null); }} />
            <SidebarNavItem icon={<Star size={15} />} label="置顶收藏" count={props.counts.pinned} active={props.view === "pinned"} onClick={() => { props.setView("pinned"); props.setActiveCategory(null); props.setActiveTag(null); }} />
            <SidebarNavItem icon={<AlertCircle size={15} />} label="需要关注" count={props.counts.attention} active={props.view === "attention"} onClick={() => { props.setView("attention"); props.setActiveCategory(null); props.setActiveTag(null); }} />
            <SidebarNavItem icon={<CircleDashed size={15} />} label="待检测" count={props.counts.unchecked} active={props.view === "unchecked"} onClick={() => { props.setView("unchecked"); props.setActiveCategory(null); props.setActiveTag(null); }} />
          </nav>
        </div>
        <div className="side-section">
          <div className="side-section-title"><span>分类</span><button type="button" title="管理分类" onClick={props.onTaxonomy}><FolderPlus size={14} /></button></div>
          <div className="taxonomy-list">{props.categories.map((category) => <TaxonomySideItem key={category.id} item={category} active={props.activeCategory === category.id} onClick={() => props.setActiveCategory(category.id)} onDelete={() => void props.onDeleteTaxonomy("category", category)} />)}</div>
        </div>
        <div className="side-section">
          <div className="side-section-title"><span>标签</span><button type="button" title="管理标签" onClick={props.onTaxonomy}><TagIcon size={14} /></button></div>
          <div className="taxonomy-list">{props.tags.map((tag) => <TaxonomySideItem key={tag.id} item={tag} active={props.activeTag === tag.id} onClick={() => props.setActiveTag(tag.id)} onDelete={() => void props.onDeleteTaxonomy("tag", tag)} />)}</div>
        </div>
      </div>
      <div className="sidebar-fixed sidebar-bottom">
        <div className="storage-status"><Database size={15} /><span>数据仅存储在本机</span></div>
        <div className="sidebar-footer"><button className="ghost-icon-button" type="button" title="帮助" onClick={() => window.alert("东青Vault 是一个本地网站收藏管理工具。所有数据保存在当前设备。") }><CircleHelp size={15} /></button><button className="ghost-icon-button" type="button" title="设置" onClick={props.onSettings}><Settings2 size={15} /></button></div>
      </div>
    </aside>
  );
}

function SidebarNavItem({ icon, label, count, active, onClick }: { icon: ReactNode; label: string; count: number; active: boolean; onClick: () => void }) {
  return <button className={`side-nav-item ${active ? "active" : ""}`} type="button" onClick={onClick}>{icon}<span>{label}</span><span className="side-count">{count}</span></button>;
}

function TaxonomySideItem({ item, active, onClick, onDelete }: { item: CategoryListItem | TagListItem; active: boolean; onClick: () => void; onDelete: () => void }) {
  return <button className={`taxonomy-item ${active ? "active" : ""}`} type="button" onClick={onClick}><span className="taxonomy-dot" style={{ background: item.color }} /><span>{item.name}</span><span className="side-count">{item.siteCount}</span><span role="button" tabIndex={0} className="taxonomy-delete" title="删除" onClick={(event) => { event.stopPropagation(); onDelete(); }}><Trash2 size={12} /></span></button>;
}

function MetricCard({ icon, label, value, note, tone }: { icon: ReactNode; label: string; value: number; note: string; tone?: "success" | "warning" }) {
  return <div className={`metric-card ${tone ?? ""}`}><div className="metric-label">{icon}{label}</div><div className="metric-value">{value}</div><span className="metric-note">{note}</span></div>;
}

function SiteRow({ site, categories, tags, selected, onToggle, onOpen, onEdit, onDelete, onPin, onCopyUsername, onCopyPassword }: { site: Site; categories: CategoryListItem[]; tags: TagListItem[]; selected: boolean; onToggle: () => void; onOpen: () => void; onEdit: () => void; onDelete: () => void; onPin: () => void; onCopyUsername: () => void; onCopyPassword: () => void }) {
  const category = categories.find((item) => item.id === site.categoryId);
  const status = effectiveStatus(site);
  const initials = site.name.trim().slice(0, 1).toUpperCase() || "W";
  return <tr>
    <td><input className="check-control" type="checkbox" checked={selected} onChange={onToggle} aria-label={`选择 ${site.name}`} /></td>
    <td><div className="site-name-cell"><div className="site-favicon">{initials}</div><div className="site-name-block"><div className="site-name"><span>{site.name}</span>{site.isPinned && <Star className="pin-icon" size={11} fill="currentColor" />}</div><div className="site-domain" title={site.domain}>{site.domain}</div>{(site.username || site.hasPassword) && <div className="credential-summary"><KeyRound size={11} />{site.username || "已保存密码"}</div>}</div></div></td>
    <td>{category ? <span className="category-label"><span className="taxonomy-dot" style={{ background: category.color }} />{category.name}</span> : <span className="category-label">未分类</span>}</td>
    <td><span className={`status-pill ${status}`}>{status === "available" ? "可用" : status === "unavailable" ? "失效" : "未检测"}</span>{site.manualStatus && <span className="manual-mark">手动</span>}</td>
    <td><div className="tag-list">{site.tagIds.map((id) => { const tag = tags.find((item) => item.id === id); return tag ? <span className="tag-chip" style={{ "--chip-color": tag.color } as React.CSSProperties} key={id}>{tag.name}</span> : null; })}</div></td>
    <td><div className="row-actions">{site.username && <button className="row-action credential-action" type="button" title="复制账号" onClick={onCopyUsername}><Copy size={14} /></button>}{site.hasPassword && <button className="row-action credential-action" type="button" title="复制密码" onClick={onCopyPassword}><KeyRound size={14} /></button>}<button className="row-action" type="button" title="打开网址" onClick={onOpen}><ExternalLink size={14} /></button><button className="row-action" type="button" title={site.isPinned ? "取消置顶" : "置顶"} onClick={onPin}><Star size={14} fill={site.isPinned ? "currentColor" : "none"} /></button><button className="row-action" type="button" title="编辑" onClick={onEdit}><Pencil size={14} /></button><button className="row-action danger" type="button" title="删除" onClick={onDelete}><Trash2 size={14} /></button></div></td>
  </tr>;
}

function LoadingRows() {
  return <div className="empty-state"><div className="empty-icon"><RefreshCw size={20} className="spin" /></div><h3>正在加载收藏库</h3><p>读取本地数据中…</p></div>;
}

function EmptyState({ onAdd, hasFilters }: { onAdd: () => void; hasFilters: boolean }) {
  return <div className="empty-state"><div className="empty-icon">{hasFilters ? <Search size={20} /> : <Sparkles size={20} />}</div><h3>{hasFilters ? "没有匹配的网站" : "收藏库还是空的"}</h3><p>{hasFilters ? "试试调整筛选条件或搜索关键词。" : "把常用网站收进来，下一次访问会更快。"}</p>{!hasFilters && <button type="button" onClick={onAdd}><Plus size={13} /> 添加第一个网站</button>}</div>;
}

function EditorDrawer({ editor, categories, tags, onChange, onClose, onSave, onRevealPassword }: { editor: EditorState; categories: CategoryListItem[]; tags: TagListItem[]; onChange: (form: DraftForm) => void; onClose: () => void; onSave: (event: FormEvent<HTMLFormElement>) => void; onRevealPassword: () => Promise<boolean> }) {
  const [passwordVisible, setPasswordVisible] = useState(false);
  const set = (patch: Partial<DraftForm>) => onChange({ ...editor.form, ...patch });
  const togglePassword = async () => {
    if (!passwordVisible && editor.form.hasPassword && !editor.form.password && !await onRevealPassword()) return;
    setPasswordVisible((current) => !current);
  };
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="modal editor-modal" role="dialog" aria-modal="true" aria-labelledby="editor-title">
      <div className="modal-header"><div><h2 id="editor-title">{editor.siteId ? "编辑网站" : "添加网站"}</h2><p>网站信息保存在本机，密码由 macOS 钥匙串安全保管。</p></div><button className="close-button" type="button" onClick={onClose} aria-label="关闭"><X size={16} /></button></div>
      <form onSubmit={onSave}>
        <div className="editor-body-scroll">
        <div className="editor-section">
          <div className="editor-section-title"><Globe size={14} /><span>网站</span></div>
          <div className="form-grid">
            <div className="form-field"><label htmlFor="site-name">网站名称</label><input id="site-name" value={editor.form.name} onChange={(event) => set({ name: event.target.value })} placeholder="例如：GitHub" /></div>
            <div className="form-field"><label htmlFor="site-domain">域名</label><input id="site-domain" value={editor.form.domain} onChange={(event) => set({ domain: event.target.value })} placeholder="例如：github.com" /></div>
            <div className="form-field full"><label htmlFor="site-url">网址 <span className="form-hint">支持自动补全 https://</span></label><input id="site-url" value={editor.form.url} onChange={(event) => set({ url: event.target.value })} placeholder="https://" required /></div>
          </div>
        </div>
        <div className="editor-section">
          <div className="editor-section-title"><KeyRound size={14} /><span>登录信息</span><em>选填 · 密码保存至 macOS 钥匙串</em></div>
          <div className="form-grid">
            <div className="form-field"><label htmlFor="site-username">账号</label><input id="site-username" value={editor.form.username} onChange={(event) => set({ username: event.target.value })} placeholder="邮箱或用户名" autoComplete="username" /></div>
            <div className="form-field"><label htmlFor="site-password">密码</label><div className="password-input"><input id="site-password" type={passwordVisible ? "text" : "password"} value={editor.form.password} onChange={(event) => set({ password: event.target.value, passwordDirty: true })} placeholder={editor.form.hasPassword ? "••••••••（已保存）" : "可不填写"} autoComplete="new-password" /><button type="button" title={passwordVisible ? "隐藏密码" : "显示密码"} onClick={() => void togglePassword()}>{passwordVisible ? <EyeOff size={15} /> : <Eye size={15} />}</button></div>{editor.form.hasPassword && <button className="clear-password" type="button" onClick={() => set({ password: "", passwordDirty: true, hasPassword: false })}>删除已保存密码</button>}</div>
          </div>
        </div>
        <div className="editor-section">
          <div className="editor-section-title"><Folder size={14} /><span>整理</span></div>
          <div className="form-grid">
            <div className="form-field"><label htmlFor="site-category">分类</label><select id="site-category" value={editor.form.categoryId ?? ""} onChange={(event) => set({ categoryId: event.target.value || null })}><option value="">未分类</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></div>
            <div className="form-field"><label>手动状态覆盖</label><select value={editor.form.manualStatus ?? ""} onChange={(event) => set({ manualStatus: (event.target.value || null) as ManualStatus })}><option value="">跟随自动检测</option><option value="available">标记为可用</option><option value="unavailable">标记为失效</option></select></div>
            <div className="form-field full"><label>标签</label><div className="tag-picker">{tags.length ? tags.map((tag) => <button className={editor.form.tagIds.includes(tag.id) ? "tag-option selected" : "tag-option"} type="button" key={tag.id} onClick={() => set({ tagIds: editor.form.tagIds.includes(tag.id) ? editor.form.tagIds.filter((id) => id !== tag.id) : [...editor.form.tagIds, tag.id] })}><span style={{ background: tag.color }} />{tag.name}</button>) : <span className="form-hint">还没有标签</span>}</div></div>
            <div className="form-field full"><label htmlFor="site-notes">备注</label><textarea id="site-notes" value={editor.form.notes} onChange={(event) => set({ notes: event.target.value })} rows={3} placeholder="记录用途、登录方式或其他说明…" /></div>
          </div>
        </div>
        </div>
        <div className="form-actions"><label className="pin-toggle"><input type="checkbox" checked={editor.form.isPinned} onChange={(event) => set({ isPinned: event.target.checked })} /><Star size={13} fill={editor.form.isPinned ? "currentColor" : "none"} />置顶</label><span className="form-actions-spacer" /><button type="button" className="secondary-button" onClick={onClose}>取消</button><button className="primary-button" type="submit"><Check size={14} />保存网站</button></div>
      </form>
    </section>
  </div>;
}

function SettingsDialog({ settings, onChange, onBackup, onImport, onClose }: { settings: AppSettings; onChange: (settings: AppSettings) => void; onBackup: () => void; onImport: () => void; onClose: () => void }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="settings-title"><div className="modal-header"><div><h2 id="settings-title">设置</h2><p>控制检测计划与本地数据管理。</p></div><button className="close-button" type="button" onClick={onClose} aria-label="关闭"><X size={16} /></button></div><div className="settings-list"><div className="settings-card"><h3>自动检测</h3><p>应用运行时按计划检测网址，最小化到托盘后仍会继续。完全退出应用后不会在后台运行。</p><label className="switch-row"><span className="switch-copy"><strong>启用定时检测</strong><span>{settings.autoCheck ? "正在运行检测计划" : "当前已暂停"}</span></span><span className="switch"><input type="checkbox" checked={settings.autoCheck} onChange={(event) => onChange({ ...settings, autoCheck: event.target.checked })} /><span className="switch-track" /></span></label><div style={{ height: 10 }} /><label className="form-field"><span>检测间隔</span><select value={settings.intervalMinutes} onChange={(event) => onChange({ ...settings, intervalMinutes: Number(event.target.value) })}><option value={5}>每 5 分钟</option><option value={15}>每 15 分钟</option><option value={30}>每 30 分钟</option><option value={60}>每 1 小时</option><option value={360}>每 6 小时</option></select></label><div style={{ height: 10 }} /><label className="switch-row"><span className="switch-copy"><strong>启动后立即检测</strong><span>首次打开应用时自动执行一次</span></span><span className="switch"><input type="checkbox" checked={settings.checkOnLaunch} onChange={(event) => onChange({ ...settings, checkOnLaunch: event.target.checked })} /><span className="switch-track" /></span></label></div><div className="settings-card"><h3>数据备份与恢复</h3><p>导出的文件未加密，请妥善保管。恢复备份会合并记录，不会覆盖现有收藏。</p><div className="settings-actions"><button type="button" onClick={onBackup}><Download size={13} />导出完整备份</button><button type="button" onClick={onImport}><RotateCcw size={13} />恢复备份</button><button type="button" onClick={() => window.alert("当前版本支持 JSON 与 CSV 文件。JSON 包含分类、标签和完整状态信息。")}><FileText size={13} />格式说明</button></div></div><div className="settings-card"><h3>存储状态</h3><p>桌面版使用本地 SQLite；浏览器预览使用 localStorage。两者均不上传数据。</p><div className="local-badge"><span />本地数据正常</div></div></div><div className="form-actions"><button className="primary-button" type="button" onClick={onClose}>完成</button></div></section></div>;
}

function TaxonomyDialog({ categories, tags, onAdd, onDelete, onClose }: { categories: CategoryListItem[]; tags: TagListItem[]; onAdd: (kind: "category" | "tag", name: string, color: string) => Promise<void>; onDelete: (kind: "category" | "tag", item: CategoryListItem | TagListItem) => Promise<void>; onClose: () => void }) {
  const [categoryName, setCategoryName] = useState("");
  const [tagName, setTagName] = useState("");
  const [categoryColor, setCategoryColor] = useState("#4F7CFF");
  const [tagColor, setTagColor] = useState("#11A683");
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="taxonomy-title"><div className="modal-header"><div><h2 id="taxonomy-title">分类与标签</h2><p>用轻量的分类和多标签整理收藏。</p></div><button className="close-button" type="button" onClick={onClose} aria-label="关闭"><X size={16} /></button></div><div className="taxonomy-manager"><TaxonomyColumn title="分类" items={categories} name={categoryName} setName={setCategoryName} color={categoryColor} setColor={setCategoryColor} onAdd={() => { void onAdd("category", categoryName, categoryColor); setCategoryName(""); }} onDelete={(item) => void onDelete("category", item)} /><TaxonomyColumn title="标签" items={tags} name={tagName} setName={setTagName} color={tagColor} setColor={setTagColor} onAdd={() => { void onAdd("tag", tagName, tagColor); setTagName(""); }} onDelete={(item) => void onDelete("tag", item)} /></div><div className="form-actions"><button className="primary-button" type="button" onClick={onClose}>完成</button></div></section></div>;
}

function TaxonomyColumn({ title, items, name, setName, color, setColor, onAdd, onDelete }: { title: string; items: Array<CategoryListItem | TagListItem>; name: string; setName: (value: string) => void; color: string; setColor: (value: string) => void; onAdd: () => void; onDelete: (item: CategoryListItem | TagListItem) => void }) {
  return <div className="taxonomy-column"><h3>{title}<span>{items.length}</span></h3><ul>{items.map((item) => <li key={item.id}><span className="taxonomy-dot" style={{ background: item.color }} />{item.name}<span className="side-count">{item.siteCount}</span><button type="button" title={`删除${title}`} onClick={() => onDelete(item)}><Trash2 size={12} /></button></li>)}</ul><div className="inline-add"><input value={name} onChange={(event) => setName(event.target.value)} placeholder={`新${title}`} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); onAdd(); } }} /><input className="color-input" type="color" value={color} onChange={(event) => setColor(event.target.value)} aria-label={`${title}颜色`} /><button type="button" title={`添加${title}`} onClick={onAdd}><Plus size={14} /></button></div></div>;
}

function siteToDraft(site: Site): DraftForm { return { name: site.name, domain: site.domain, url: site.url, notes: site.notes, username: site.username, password: "", passwordDirty: false, hasPassword: site.hasPassword, categoryId: site.categoryId, tagIds: [...site.tagIds], isPinned: site.isPinned, manualStatus: site.manualStatus }; }
function emptyDraft(): DraftForm { return { name: "", domain: "", url: "", notes: "", username: "", password: "", passwordDirty: false, hasPassword: false, categoryId: null, tagIds: [], isPinned: false, manualStatus: null }; }
function readSettings(): AppSettings { try { const value = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "null") as Partial<AppSettings> | null; return { ...DEFAULT_SETTINGS, ...value }; } catch { return DEFAULT_SETTINGS; } }
function formatRelative(value: string): string { const elapsed = Math.max(0, Date.now() - new Date(value).getTime()); const minutes = Math.round(elapsed / 60000); if (minutes < 1) return "刚刚"; if (minutes < 60) return `${minutes} 分钟前`; const hours = Math.round(minutes / 60); return `${hours} 小时前`; }
function isTestEnvironment(): boolean { return typeof navigator !== "undefined" && /jsdom/i.test(navigator.userAgent); }
function isTauriRuntime(): boolean { return typeof window !== "undefined" && Boolean((window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__); }
function downloadFile(name: string, content: string, type: string) { const blob = new Blob([content], { type }); const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = name; anchor.click(); window.setTimeout(() => URL.revokeObjectURL(url), 500); }
function buildCsv(sites: Site[], taxonomy: TaxonomySnapshot): string { const categoryMap = new Map(taxonomy.categories.map((item) => [item.id, item.name])); const tagMap = new Map(taxonomy.tags.map((item) => [item.id, item.name])); const headers = ["name", "domain", "url", "category", "tags", "notes", "isPinned", "manualStatus"]; const rows = sites.map((site) => [site.name, site.domain, site.url, site.categoryId ? categoryMap.get(site.categoryId) ?? "" : "", site.tagIds.map((id) => tagMap.get(id) ?? "").filter(Boolean).join("|"), site.notes, String(site.isPinned), site.manualStatus ?? ""]); return [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n"); }
function csvCell(value: string): string { return `"${value.replaceAll("\"", "\"\"")}"`; }

interface ImportRow { name: string; domain: string; url: string; category: string; categoryId: string | null; tags: string[]; notes: string; isPinned: boolean; manualStatus: ManualStatus; }
interface TaxonomyDefinition { id: string; name: string; color: string; }
interface ImportDocument { rows: ImportRow[]; categories: TaxonomyDefinition[]; tags: TaxonomyDefinition[]; }
function parseImportDocument(text: string, csv: boolean): ImportDocument {
  if (csv) { const [header, ...rows] = parseCsv(text); if (!header) return { rows: [], categories: [], tags: [] }; const keys = header.map((item) => item.trim()); return { rows: rows.filter((row) => row.some(Boolean)).map((row) => { const record = Object.fromEntries(keys.map((key, index) => [key, row[index] ?? ""])); return importRecord(record); }), categories: [], tags: [] }; }
  const parsed: unknown = JSON.parse(text);
  if (Array.isArray(parsed)) return { rows: parsed.filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null).map(importRecord), categories: [], tags: [] };
  if (typeof parsed !== "object" || parsed === null) return { rows: [], categories: [], tags: [] };
  const document = parsed as { sites?: unknown; categories?: unknown; tags?: unknown };
  const rows = Array.isArray(document.sites) ? document.sites.filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null).map(importRecord) : [];
  const mapDefinition = (value: unknown, fallbackColor: string): TaxonomyDefinition[] => Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null).map((item) => ({ id: String(item.id ?? ""), name: String(item.name ?? ""), color: String(item.color ?? fallbackColor) })).filter((item) => item.name.length > 0) : [];
  return { rows, categories: mapDefinition(document.categories, "#4F7CFF"), tags: mapDefinition(document.tags, "#11A683") };
}
function importRecord(record: Record<string, unknown>): ImportRow { const tagsValue = record.tags ?? record.tagNames ?? ""; const tags = Array.isArray(tagsValue) ? tagsValue.map(String) : String(tagsValue).split(/[|,，]/).map((item) => item.trim()).filter(Boolean); const status = String(record.manualStatus ?? ""); return { name: String(record.name ?? ""), domain: String(record.domain ?? ""), url: String(record.url ?? record.normalizedUrl ?? ""), category: String(record.category ?? record.categoryName ?? ""), categoryId: typeof record.categoryId === "string" ? record.categoryId : null, tags, notes: String(record.notes ?? ""), isPinned: record.isPinned === true || String(record.isPinned).toLocaleLowerCase() === "true", manualStatus: status === "available" || status === "unavailable" ? status : null }; }
function parseCsv(text: string): string[][] { const rows: string[][] = []; let row: string[] = []; let cell = ""; let quoted = false; for (let index = 0; index < text.length; index += 1) { const character = text[index]; const next = text[index + 1]; if (character === '"' && quoted && next === '"') { cell += '"'; index += 1; } else if (character === '"') quoted = !quoted; else if (character === "," && !quoted) { row.push(cell); cell = ""; } else if ((character === "\n" || character === "\r") && !quoted) { if (character === "\r" && next === "\n") index += 1; row.push(cell); rows.push(row); row = []; cell = ""; } else cell += character; } if (cell.length || row.length) { row.push(cell); rows.push(row); } return rows; }
