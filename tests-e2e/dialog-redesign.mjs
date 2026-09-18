// Dialog redesign functional test against the production build (dist/).
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require("/Users/dongqing/Documents/域名管理/node_modules/.pnpm/playwright-core@1.62.1/node_modules/playwright-core/index.js");
import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { join, extname } from "node:path";
import { fileURLToPath } from "node:url";

const DIST = join(fileURLToPath(new URL("..", import.meta.url)), "dist");
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".json": "application/json" };

const server = createServer((req, res) => {
  let p = join(DIST, req.url === "/" ? "index.html" : req.url.split("?")[0]);
  if (!existsSync(p)) p = join(DIST, "index.html");
  res.setHeader("Content-Type", MIME[extname(p)] ?? "application/octet-stream");
  res.end(readFileSync(p));
});
await new Promise((r) => server.listen(4173, "127.0.0.1", () => r()));

const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const logs = [];
page.on("console", (m) => logs.push(`${m.type()}: ${m.text()}`));
page.on("pageerror", (e) => logs.push(`PAGEERROR: ${e.message}`));

await page.goto("http://127.0.0.1:4173/", { timeout: 60000 });
await page.waitForTimeout(900);

const results = [];
const check = (name, ok, extra = "") => { results.push(`${ok ? "PASS" : "FAIL"} ${name}${extra ? " — " + extra : ""}`); };

// 1. Open add dialog
await page.getByRole("button", { name: "添加网站" }).first().click();
await page.waitForTimeout(300);
check("点击添加按钮打开弹窗", (await page.getByRole("dialog").count()) > 0);
check("弹窗标题为 添加网站", (await page.getByRole("dialog").locator("h2").textContent()) === "添加网站");

// 2. Centered modal, not a drawer
const vp = page.viewportSize();
const box = await page.getByRole("dialog").boundingBox();
const centered = Math.abs(box.x + box.width / 2 - vp.width / 2) < 60 && Math.abs(box.y + box.height / 2 - vp.height / 2) < 80;
check("弹窗居中显示（非右侧抽屉）", centered, `box=${JSON.stringify(box)}`);

// 3. New section layout
for (const t of ["网站", "登录信息", "整理"]) {
  check(`分节标题「${t}」存在`, (await page.getByRole("dialog").getByText(t, { exact: true }).count()) > 0);
}

// 4. Fill the form
await page.locator("#site-name").fill("测试站");
await page.locator("#site-domain").fill("github.com");
await page.locator("#site-url").fill("https://github.com");
await page.locator("#site-username").fill("dongqing@example.com");
// 密码仅验证显隐切换（钥匙串写入只在桌面版生效，浏览器预览会拦截保存）
await page.locator("#site-password").fill("preview-pwd");
check("显隐按钮存在", (await page.getByRole("button", { name: "显示密码" }).count()) === 1);
await page.getByRole("button", { name: "显示密码" }).click();
check("密码明文显示", (await page.locator("#site-password").inputValue()) === "preview-pwd" && (await page.locator("#site-password").getAttribute("type")) === "text");
await page.getByRole("button", { name: "隐藏密码" }).click();
await page.locator("#site-password").fill(""); // 保存时不写密码，避免浏览器预览的钥匙串拦截

const catOptions = await page.locator("#site-category option").allTextContents();
check("分类下拉正常", catOptions.includes("未分类") && catOptions.includes("工作"), catOptions.join(","));

const pin = page.getByRole("dialog").getByText("置顶", { exact: true });
check("底部操作栏含置顶开关", (await pin.count()) === 1);
await pin.click();

// 5. Save and capture the toast message (success or error) + dialog state
await page.getByRole("button", { name: "保存网站" }).click();
let toastMsg = "";
let closed = false;
for (let i = 0; i < 20; i++) {
  await page.waitForTimeout(300);
  const t = page.locator(".toast");
  if ((await t.count()) > 0) toastMsg = (await t.first().textContent()) ?? "";
  if ((await page.getByRole("dialog").count()) === 0) { closed = true; break; }
}
console.log("TOAST:", JSON.stringify(toastMsg));
check("保存后弹窗关闭", closed, `toast=${toastMsg}`);
const afterBody = await page.locator("body").innerText();
check("保存后无错误提示", !(afterBody.includes("失败") || afterBody.includes("请填写")), (afterBody.match(/(失败|请填写)[^\n]*/) ?? [""])[0]);

// 6. New site appears in the table
const newRow = page.locator("tr", { hasText: "测试站" });
check("列表出现 测试站", (await newRow.count()) > 0);

// 7. Edit flow
if ((await newRow.count()) > 0) {
  await newRow.first().hover();
  // row actions: open link / copy username / copy password / edit / delete → index 3 = Pencil edit
  await newRow.first().getByRole("button").nth(3).click();
  await page.waitForTimeout(500);
  check("点击编辑打开弹窗", (await page.getByRole("dialog").count()) > 0);
  const title = await page.getByRole("dialog").locator("h2").textContent();
  check("编辑弹窗标题为 编辑网站", title === "编辑网站", title ?? "");
  check("表单回填用户名", (await page.locator("#site-username").inputValue()) === "dongqing@example.com");
  // 浏览器预览未保存密码，占位应为"可不填写"而非已保存
  check("编辑态密码占位正常", ((await page.locator("#site-password").getAttribute("placeholder")) ?? "").length > 0);
  check("置顶状态回填", await page.getByRole("dialog").getByText("置顶", { exact: true }).locator("xpath=..").locator("input").isChecked().catch(() => false));

  // 8. Fixed header + scrollable body under a short viewport
  await page.setViewportSize({ width: 900, height: 520 });
  await page.waitForTimeout(300);
  const dlg2 = await page.getByRole("dialog").boundingBox();
  const scrollable = await page.locator(".editor-body-scroll").evaluate((el) => el.scrollHeight >= el.clientHeight && el.clientHeight > 0);
  check("小窗口下头部固定+主体可滚动", scrollable && dlg2.height <= 520, `dlgH=${Math.round(dlg2.height)}`);
  await page.setViewportSize({ width: 1440, height: 900 });

  // 9. Cancel closes
  await page.getByRole("button", { name: "取消", exact: true }).click();
  await page.waitForTimeout(300);
  check("取消关闭弹窗", (await page.getByRole("dialog").count()) === 0);
}

console.log(results.join("\n"));
const errs = logs.filter((l) => l.startsWith("PAGEERROR"));
if (errs.length) console.log("\n--- page errors ---\n" + errs.join("\n"));
await browser.close();
server.close();
process.exit(results.some((r) => r.startsWith("FAIL")) ? 1 : 0);
