/**
 * 本地调试桥：通过 CDP 操作正在运行的 Electron 渲染进程。
 * 用法：
 *   node scripts/cdp.mjs eval "document.title"
 *   node scripts/cdp.mjs shot out.png
 *   node scripts/cdp.mjs click 400 300
 */
import WebSocket from 'ws';
import { writeFileSync } from 'node:fs';

const PORT = Number(process.env.CDP_PORT ?? 9333);
const [command, ...args] = process.argv.slice(2);

const targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
const pages = targets.filter((target) => target.type === 'page');
const page = process.env.CDP_QUICK
  ? pages.find((target) => target.url.includes('#/quick'))
  : pages.find((target) => !target.url.includes('#/quick'));
if (!page) {
  console.error('没有可用的页面目标');
  process.exit(1);
}

const ws = new WebSocket(page.webSocketDebuggerUrl);
const pending = new Map();
let seq = 0;

const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = ++seq;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });

ws.on('message', (raw) => {
  const message = JSON.parse(raw.toString());
  if (message.id && pending.has(message.id)) {
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(message.error.message));
    else resolve(message.result);
  }
});

await new Promise((resolve) => ws.on('open', resolve));
await send('Runtime.enable');

if (command === 'eval') {
  const expression = args.join(' ');
  const result = await send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
    userGesture: true,
  });
  if (result.exceptionDetails) {
    console.error(JSON.stringify(result.exceptionDetails, null, 2));
    process.exitCode = 1;
  } else {
    console.log(JSON.stringify(result.result?.value ?? result.result, null, 2));
  }
} else if (command === 'shot') {
  await send('Page.enable');
  const { data } = await send('Page.captureScreenshot', {
    format: 'png',
    fromSurface: true,
    captureBeyondViewport: false,
  });
  const out = args[0] ?? 'shot.png';
  writeFileSync(out, Buffer.from(data, 'base64'));
  console.log(`saved ${out}`);
} else if (command === 'shot-dom') {
  // 窗口被遮挡时 fromSurface 可能拿到空白帧，用 DOM 方式重建截图
  await send('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } });
  const { data } = await send('Page.captureScreenshot', {
    format: 'png',
    fromSurface: false,
    captureBeyondViewport: false,
  });
  const out = args[0] ?? 'shot.png';
  writeFileSync(out, Buffer.from(data, 'base64'));
  console.log(`saved ${out}`);
} else if (command === 'click') {
  const x = Number(args[0]);
  const y = Number(args[1]);
  for (const type of ['mousePressed', 'mouseReleased']) {
    await send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1 });
  }
  console.log(`clicked ${x},${y}`);
} else {
  console.error('未知命令');
  process.exitCode = 1;
}

ws.close();
