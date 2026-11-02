/**
 * 冒烟测试：在真实 Electron 主进程中跑一遍「同步 → 下载 → 安装 → 启动探测 → 检查更新」。
 * 用法：npm run smoke -- "Phantom Blade Zero"
 * 仅用于自测，不参与打包产物的运行路径。
 */
import { app } from 'electron';
import { existsSync, statSync } from 'node:fs';
import { appStats, checkUpdates, getCatalog, getLibrary, syncCatalog } from './services/library';
import { installTrainer } from './services/installer';
import { ElevationRequiredError, launchTrainer } from './services/launcher';

app.setName('FLiNG Vault');

function log(step: string, detail: unknown) {
  const text = typeof detail === 'string' ? detail : JSON.stringify(detail);
  console.log(`[smoke] ${step}: ${text}`);
}

async function main() {
  const target = process.argv[2] ?? 'Phantom Blade Zero';
  log('target', target);

  const sync = await syncCatalog((done, total) => {
    if (done === total || done % 3 === 0) log('sync-progress', `${done}/${total}`);
  });
  log('sync-done', sync);

  const catalog = getCatalog().entries;
  const entry = catalog.find((item) => item.title.toLowerCase() === target.toLowerCase());
  if (!entry) throw new Error(`目录中找不到 ${target}`);
  log('catalog-hit', { id: entry.id, slug: entry.slug, options: entry.optionCount, version: entry.gameVersion });

  const result = await installTrainer(entry, (progress) => {
    if (progress.state !== 'downloading') log('download-state', progress.state);
  });
  const file = result.entry;
  const size = existsSync(file.filePath) ? statSync(file.filePath).size : 0;
  log('installed', { path: file.filePath, size, version: file.version, options: file.optionKeys.length });

  if (!size) throw new Error('安装后文件为空');
  if (file.optionKeys.length === 0) throw new Error('未解析出快捷键列表');

  // 启动探测：不真的拉起 UAC，只确认走哪条启动链路
  try {
    const launch = await launchTrainer(file.id, false);
    log('launched', launch);
  } catch (error) {
    if (error instanceof ElevationRequiredError) {
      log('elevation-required', 'exe 带 requireAdministrator 清单，正式启动将走 Start-Process -Verb RunAs');
    } else {
      throw error;
    }
  }

  const updates = await checkUpdates();
  log('updates', updates);
  log('stats', appStats());
  log('library', getLibrary().map((item) => ({ id: item.id, title: item.title, version: item.version })));
  log('ok', true);
}

app.whenReady().then(async () => {
  try {
    await main();
    app.exit(0);
  } catch (error) {
    console.error('[smoke] failed:', error);
    app.exit(1);
  }
});
