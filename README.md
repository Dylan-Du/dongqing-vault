# 东青Vault

> LINKS, READY.

东青Vault是一款面向 macOS 与 Windows 的本地网站与域名收藏管理桌面工具，帮助你集中整理每天常用的开发、设计、办公、AI 及其他网站。

## 功能

- 录入网站名称、域名、网址、备注、自定义分类和多标签
- 按关键词、分类、标签和可用状态搜索筛选
- 排序、置顶收藏、批量编辑和系统浏览器一键打开
- 一键或按计划检测网址可用性，支持手动覆盖状态
- 应用运行或最小化到系统托盘时继续执行计划检测
- JSON/CSV 批量导入导出，支持本地备份与恢复
- 本地 SQLite 存储，无账号、无云同步、无遥测

## 下载

- macOS Apple Silicon：[`东青Vault_0.1.0_aarch64.dmg`](./东青Vault_0.1.0_aarch64.dmg)
- Windows x64：前往 [Releases](https://github.com/Dylan-Du/dongqing-vault/releases/latest) 下载 `.exe` 安装包

当前安装包未配置代码签名或公证。macOS 首次打开时，如出现安全提示，可右键应用选择“打开”。

## 运行与构建

```bash
pnpm install
pnpm dev
```

桌面构建：

```bash
pnpm tauri build --bundles dmg --no-sign    # macOS
pnpm tauri build --bundles nsis --no-sign   # Windows
```

推送版本标签后，GitHub Actions 会分别在 macOS 与 Windows runner 上构建并把 DMG/EXE 发布到 GitHub Release。

## 数据与隐私

核心数据只保存在当前设备。除打开目标网址和执行可用性检测外，应用不依赖远程服务，也不会上传收藏数据。当前版本默认不加密数据库和备份文件，请妥善保管备份。

## 赞助商

感谢 [APINest](https://xn--xhqu89o.cc/) 对东青Vault 的支持。

## 技术栈

Tauri 2、React、TypeScript、Vite、Rust、SQLite。

