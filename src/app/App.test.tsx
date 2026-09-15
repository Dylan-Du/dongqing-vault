import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import type { SitePage, SiteQuery } from "../domain/site";
import { BridgeProvider } from "../infrastructure/bridge/BridgeContext";
import { MockNativeBridge } from "../infrastructure/bridge/MockNativeBridge";
import { siteFixture } from "../test/fixtures";
import { App } from "./App";

class WrongSummaryBridge extends MockNativeBridge {
  override async listSites(query: SiteQuery): Promise<SitePage> {
    const page = await super.listSites(query);
    return { ...page, summary: { total: 999, available: 0, needsAttention: 999 } };
  }
}

class RaceBridge extends MockNativeBridge {
  listCalls = 0;
  private releaseFirstRequest: (() => Promise<void>) | null = null;

  override listSites(query: SiteQuery): Promise<SitePage> {
    this.listCalls += 1;
    const result = super.listSites(query);
    if (this.listCalls !== 1) return result;

    const staleResult = result.then((page) => ({
      ...page,
      items: page.items.filter((site) => !site.isPinned),
      total: page.items.filter((site) => !site.isPinned).length,
      summary: { total: 1, available: 1, needsAttention: 0 },
    }));
    return new Promise<SitePage>((resolve) => {
      this.releaseFirstRequest = async () => { resolve(await staleResult); };
    });
  }

  async releaseFirst() {
    await this.releaseFirstRequest?.();
  }
}

describe("App", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renders the local collection shell", () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: "东青Vault" })).toBeVisible();
    expect(screen.getByText("LINKS, READY.")).toBeVisible();
  });

  it("derives metric counts from visible site statuses instead of a stale bridge summary", async () => {
    const bridge = new WrongSummaryBridge({
      sites: [
        siteFixture({ id: "available", autoStatus: "available" }),
        siteFixture({ id: "unavailable", autoStatus: "unavailable" }),
      ],
    });
    render(
      <BridgeProvider bridge={bridge}>
        <App />
      </BridgeProvider>,
    );

    const overview = await screen.findByRole("region", { name: "收藏库概览" });
    expect(overview).toHaveTextContent("收藏总数2当前筛选");
    expect(overview).toHaveTextContent("可用网站150% 可用");
    expect(overview).toHaveTextContent("需要关注1待处理");
  });

  it("updates metric counts for the currently visible special view", async () => {
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "置顶收藏 2" }));

    const overview = screen.getByRole("region", { name: "收藏库概览" });
    await waitFor(() => expect(overview).toHaveTextContent("收藏总数2当前筛选"));
    expect(overview).toHaveTextContent("可用网站2100% 可用");
    expect(overview).toHaveTextContent("需要关注0待处理");
  });

  it("filters the table to pinned sites when the pinned view is selected", async () => {
    render(<App />);

    const pinnedNav = await screen.findByRole("button", { name: "置顶收藏 2" });
    fireEvent.click(pinnedNav);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "置顶收藏" })).toBeVisible();
    });
    expect(screen.getAllByRole("row")).toHaveLength(3);
    expect(screen.getByText("GitHub")).toBeVisible();
    expect(screen.getByText("Vercel")).toBeVisible();
    expect(screen.queryByText("ChatGPT")).not.toBeInTheDocument();
  });

  it.each([
    ["置顶收藏", 2, "GitHub"],
    ["需要关注", 2, "Dribbble"],
    ["待检测", 1, "MDN Web Docs"],
  ] as const)("filters the table to %s sites", async (label, count, expectedName) => {
    render(<App />);

    const nav = await screen.findByRole("button", { name: `${label} ${count}` });
    fireEvent.click(nav);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: label })).toBeVisible();
      expect(screen.getAllByRole("row")).toHaveLength(count + 1);
    });
    expect(screen.getByText(expectedName)).toBeVisible();
  });

  it("returns special views to all websites when a category or tag is selected", async () => {
    render(<App />);

    const pinnedNav = await screen.findByRole("button", { name: "置顶收藏 2" });
    fireEvent.click(pinnedNav);
    await waitFor(() => expect(screen.getByRole("heading", { name: "置顶收藏" })).toBeVisible());

    fireEvent.click(await screen.findByRole("button", { name: "开发 3" }));
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "所有网站" })).toBeVisible();
      expect(screen.getAllByRole("row")).toHaveLength(4);
    });

    fireEvent.click(await screen.findByRole("button", { name: "置顶收藏 2" }));
    await waitFor(() => expect(screen.getByRole("heading", { name: "置顶收藏" })).toBeVisible());
    fireEvent.click(await screen.findByRole("button", { name: "工具 6" }));
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "所有网站" })).toBeVisible();
      expect(screen.getAllByRole("row")).toHaveLength(7);
    });
  });

  it("keeps the latest view when an older catalog request resolves later", async () => {
    const bridge = new RaceBridge({
      sites: [
        siteFixture({ id: "pinned", name: "Pinned", domain: "pinned.test", url: "https://pinned.test", normalizedUrl: "https://pinned.test", isPinned: true, autoStatus: "available" }),
        siteFixture({ id: "regular", name: "Regular", domain: "regular.test", url: "https://regular.test", normalizedUrl: "https://regular.test", autoStatus: "available" }),
      ],
    });
    render(
      <BridgeProvider bridge={bridge}>
        <App />
      </BridgeProvider>,
    );

    await waitFor(() => expect(bridge.listCalls).toBe(1));
    fireEvent.click(screen.getByRole("button", { name: /置顶收藏/ }));
    await waitFor(() => expect(bridge.listCalls).toBe(2));
    await act(async () => {
      await bridge.releaseFirst();
    });

    await waitFor(() => expect(screen.getByRole("heading", { name: "置顶收藏" })).toBeVisible());
    expect(screen.getByText("Pinned")).toBeVisible();
    expect(screen.queryByText("Regular")).not.toBeInTheDocument();
  });
});
