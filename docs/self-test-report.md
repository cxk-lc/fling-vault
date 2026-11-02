# 自测报告 · FLiNG Vault 1.0.0

日期：2026-11-02 · 环境：Windows 11 (10.0.26100) · Node 22.22.2 · Electron 33.4.11

## 1. 测试命令与结果

```bash
$ npm run typecheck
# 无输出，退出码 0

$ npm run build
✓ 43 modules transformed.
../dist/index.html                   0.64 kB
../dist/assets/index-*.css          21.43 kB
../dist/assets/index-*.js          171.50 kB
dist-electron\main.js  32.2kb | preload.js 3.7kb | smoke.js 26.4kb
```

冒烟测试（真实网络、真实下载、真实磁盘写入）：

```bash
$ npm run smoke -- "Phantom Blade Zero"
[smoke] target: Phantom Blade Zero
[smoke] sync-progress: 8/8
[smoke] sync-done: {"total":766,"fetched":766,"updatedAt":1793634215583}
[smoke] catalog-hit: {"id":43494,"slug":"phantom-blade-zero-trainer","options":36,"version":"1.0+"}
[smoke] download-state: preparing
[smoke] download-state: installing
[smoke] download-state: done
[smoke] installed: {"path":"C:\\Users\\73151\\AppData\\Roaming\\FLiNG Vault\\library\\phantom-blade-zero-trainer\\Phantom.Blade.Zero.v1.0.Plus.36.Trainer-FLiNG.exe","size":1781760,"version":"v1.0 Plus 36","options":36}
[smoke] elevation-required: exe 带 requireAdministrator 清单，正式启动将走 Start-Process -Verb RunAs
[smoke] updates: {"checked":1,"updates":0}
[smoke] stats: {"installed":1,"updates":0,"catalogTotal":766,"diskUsage":1781760,"lastSyncAt":1793634215583}
[smoke] ok: true
```

## 2. 断言覆盖

| 断言 | 结果 |
|---|---|
| 目录总数 ≥ 700 且抓取条数与站点总数一致（766/766） | 通过 |
| 目标条目可被标题精确命中 | 通过 |
| 下载文件字节数 = 1,781,760（PE 头 `4D 5A`） | 通过 |
| 快捷键表解析条数 = 官网标注选项数（36/36） | 通过 |
| 版本号解析 `v1.0 Plus 36`（不截断） | 通过（修复贪婪匹配后） |
| 启动链路识别 `requireAdministrator` | 通过 |
| 更新检测在无变更时返回 `updates: 0` | 通过 |

## 3. 自测中发现并修复的缺陷

| # | 现象 | 根因 | 修复 |
|---|---|---|---|
| 1 | 卡片高度 222px 但内容 247px 溢出，标题下多出 27px 空隙 | `<h3>` 默认 `margin: 1em` 未重置 | 全局重置标题/段落外边距 |
| 2 | 卡片封面 141px 被压缩到 115px | 卡片被 `contain-intrinsic-size` 固定高度后 flex 收缩 | 移除 `content-visibility`，封面 `flex: none` |
| 3 | 首屏 12 张图 14 秒仍未加载 | `loading="lazy"` 在本环境不触发 + 原图 700 KB | 改用 300w 缩略图，移除懒加载，加骨架与淡入 |
| 4 | 版本号显示 `v1.0` 而非 `v1.0 Plus 36` | `v[\d.]+` 贪婪吃掉分隔点，可选组不回溯 | 改为 `v\d+(?:\.\d+)*(?:[.\-]Plus[.\-]\d+)?` |
| 5 | 打包后窗口不出现 | 生产环境手工拼 `file://` + ES module 被 CORS 拦截 | 注册 `app://` 私有协议 + `pathToFileURL` 兜底 |
| 6 | 非管理员启动静默失败（无报错、无 pid） | `spawn` 错误是异步事件，同步调用不抛 | 监听 `spawn`/`error` 事件；识别 WinError 740 并回退提权 |
| 7 | 设置项标签出现单字换行（「修改/器」） | 标签列 108px 过窄 | 加宽至 132px 并缩短提示文案 |
| 8 | 标题栏「快捷启动」被窗口按钮盖住 | `titleBarOverlay` 占用右侧 138px | 标题栏右侧留 150px |

## 4. 未覆盖 / 需人工

- UAC 提权后的修改器窗口与游戏内热键：需人工在游戏运行时验证。
- 高 DPI（125%/150%）缩放：当前环境为 100%。
- 官网改版容错：仅通过代码分支确认，无真实改版可测。

## 5. 回归建议

每次改动 `electron/services/site.ts` 后必须重跑 `npm run smoke -- "Phantom Blade Zero"`，重点看 `options` 是否仍为 36、`size` 是否非 0。
