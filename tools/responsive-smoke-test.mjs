#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const firefoxPath = '/Applications/Firefox.app/Contents/MacOS/firefox';
const pagePath = path.resolve(process.argv[2] || 'index_it.html');
const pageUrl = pathToFileURL(pagePath).href;
const outDir = path.resolve(process.argv[3] || path.join(os.tmpdir(), 'milano-responsive-smoke'));

const viewports = [
  { name: 'desktop-wide', width: 1440, height: 900 },
  { name: 'laptop', width: 1280, height: 800 },
  { name: 'tablet-landscape', width: 1024, height: 768 },
  { name: 'tablet-portrait', width: 820, height: 1180 },
  { name: 'phone', width: 390, height: 844 }
];

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fileExists(file) {
  try {
    await stat(file);
    return true;
  } catch {
    return false;
  }
}

async function waitForFile(file, timeoutMs = 8000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await fileExists(file)) return;
    await delay(100);
  }
  throw new Error(`Timed out waiting for ${file}`);
}

function waitForExit(child, timeoutMs = 25000) {
  return new Promise(resolve => {
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      resolve({ code: null, signal: 'timeout' });
    }, timeoutMs);

    child.on('exit', (code, signal) => {
      clearTimeout(timer);
      resolve({ code, signal });
    });
  });
}

class CdpClient {
  constructor(wsUrl) {
    this.nextId = 1;
    this.pending = new Map();
    this.handlers = new Map();
    this.ws = new WebSocket(wsUrl);
    this.ready = new Promise((resolve, reject) => {
      this.ws.addEventListener('open', resolve, { once: true });
      this.ws.addEventListener('error', reject, { once: true });
    });
    this.ws.addEventListener('message', event => {
      const msg = JSON.parse(event.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message || JSON.stringify(msg.error)));
        else resolve(msg.result || {});
        return;
      }
      const callbacks = this.handlers.get(msg.method) || [];
      callbacks.forEach(cb => cb(msg.params || {}));
    });
  }

  async send(method, params = {}) {
    await this.ready;
    const id = this.nextId++;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
    });
  }

  once(method, timeoutMs = 15000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${method}`)), timeoutMs);
      const cb = params => {
        clearTimeout(timer);
        const callbacks = (this.handlers.get(method) || []).filter(item => item !== cb);
        this.handlers.set(method, callbacks);
        resolve(params);
      };
      this.handlers.set(method, [...(this.handlers.get(method) || []), cb]);
    });
  }

  on(method, cb) {
    this.handlers.set(method, [...(this.handlers.get(method) || []), cb]);
  }

  close() {
    this.ws.close();
  }
}

async function connectChrome(userDataDir) {
  const portFile = path.join(userDataDir, 'DevToolsActivePort');
  await waitForFile(portFile);
  const [port] = String(await readFile(portFile, 'utf8')).trim().split(/\n/);
  const tabs = await fetch(`http://127.0.0.1:${port}/json/list`).then(res => res.json());
  const page = tabs.find(item => item.type === 'page');
  if (!page || !page.webSocketDebuggerUrl) throw new Error('Chrome did not expose a debuggable page');
  return new CdpClient(page.webSocketDebuggerUrl);
}

async function chromeAudit(viewport) {
  const userDataDir = await mkdtemp(path.join(os.tmpdir(), `milano-chrome-${viewport.name}-`));
  const child = spawn(chromePath, [
    '--headless=new',
    '--disable-gpu',
    '--disable-background-networking',
    '--no-default-browser-check',
    '--no-first-run',
    '--remote-debugging-port=0',
    `--user-data-dir=${userDataDir}`,
    `--window-size=${viewport.width},${viewport.height}`,
    'about:blank'
  ], { stdio: 'ignore' });

  let cdp;
  try {
    cdp = await connectChrome(userDataDir);
    const runtimeErrors = [];
    const logEntries = [];
    cdp.on('Runtime.exceptionThrown', params => runtimeErrors.push(params.exceptionDetails?.text || 'Runtime exception'));
    cdp.on('Log.entryAdded', params => logEntries.push(params.entry?.text || params.entry?.level || 'Log entry'));

    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Log.enable');
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: viewport.width,
      height: viewport.height,
      deviceScaleFactor: 1,
      mobile: viewport.width <= 640
    });

    const load = cdp.once('Page.loadEventFired');
    await cdp.send('Page.navigate', { url: pageUrl });
    await load;

    const expression = `
      new Promise(resolve => {
        setTimeout(() => {
          const q = selector => document.querySelector(selector);
          const box = el => {
            if (!el) return null;
            const r = el.getBoundingClientRect();
            return { x: r.x, y: r.y, w: r.width, h: r.height, right: r.right, bottom: r.bottom };
          };
          const overlaps = (a, b) => !!(a && b && a.x < b.right && a.right > b.x && a.y < b.bottom && a.bottom > b.y);
          const clips = el => !!(el && (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1));
          const sidebar = q('#sidebar');
          const topRight = q('.leaflet-top.leaflet-right');
          const timeline = q('.topright-timeyear');
          const community = q('.topright-lang-community') || q('.community-control');
          const reset = q('#btnClearSelection');
          const restart = q('#btnRestartTimeline');
          const actions = q('.sidebar-actions');
          const problems = [];
          const sidebarBox = box(sidebar);
          const topRightBox = box(topRight);
          const timelineBox = box(timeline);
          const communityBox = box(community);
          const actionsBox = box(actions);

          if (!q('#map')) problems.push('missing map container');
          if (!sidebarBox) problems.push('missing sidebar');
          if (!timelineBox) problems.push('missing timeline control');
          if (!communityBox) problems.push('missing community control');
          if (!restart || !/Ricomincia|Restart/.test(restart.textContent || '')) problems.push('restart button label missing');
          if (clips(reset)) problems.push('reset button label clipped');
          if (clips(restart)) problems.push('restart button label clipped');
          if (sidebarBox && actionsBox && actionsBox.right > sidebarBox.right + 1) problems.push('sidebar action buttons overflow');
          if (sidebarBox && innerWidth > 640 && sidebarBox.right > innerWidth + 1) problems.push('sidebar escapes viewport');
          if (sidebarBox && innerWidth <= 640 && Math.abs(sidebarBox.w - innerWidth) > 2) problems.push('phone sidebar is not full width');
          if (innerWidth > 820 && overlaps(topRightBox, sidebarBox)) problems.push('top controls overlap sidebar');
          if (overlaps(timelineBox, communityBox)) problems.push('timeline overlaps community control');

          resolve({
            viewport: { width: innerWidth, height: innerHeight },
            title: q('#sidebarTitle')?.textContent?.replace(/\\s+/g, ' ').trim() || '',
            sidebar: sidebarBox,
            timeline: timelineBox,
            community: communityBox,
            restartText: restart?.textContent?.replace(/\\s+/g, ' ').trim() || '',
            problems
          });
        }, 1200);
      })
    `;
    const evaluated = await cdp.send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true
    });
    const audit = evaluated.result?.value || {};
    const screenshot = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true });
    const screenshotFile = path.join(outDir, `${viewport.name}-chrome.png`);
    await writeFile(screenshotFile, Buffer.from(screenshot.data, 'base64'));

    return {
      engine: 'Chrome',
      viewport,
      ok: audit.problems.length === 0 && runtimeErrors.length === 0,
      screenshotFile,
      audit,
      runtimeErrors,
      logEntries: logEntries.slice(0, 4)
    };
  } finally {
    if (cdp) cdp.close();
    child.kill('SIGTERM');
    await waitForExit(child, 3000);
    await rm(userDataDir, { recursive: true, force: true });
  }
}

async function firefoxScreenshot(viewport) {
  if (!(await fileExists(firefoxPath))) {
    return { engine: 'Firefox', viewport, ok: false, skipped: true, message: 'Firefox app not found' };
  }
  const profileDir = await mkdtemp(path.join(os.tmpdir(), `milano-firefox-${viewport.name}-`));
  const screenshotFile = path.join(outDir, `${viewport.name}-firefox.png`);
  const child = spawn(firefoxPath, [
    '--headless',
    '--profile',
    profileDir,
    '--window-size',
    `${viewport.width},${viewport.height}`,
    '--screenshot',
    screenshotFile,
    pageUrl
  ], { stdio: 'ignore' });

  const exit = await waitForExit(child);
  let ok = exit.code === 0 && await fileExists(screenshotFile);
  await rm(profileDir, { recursive: true, force: true });
  return {
    engine: 'Firefox',
    viewport,
    ok,
    screenshotFile: ok ? screenshotFile : null,
    message: ok ? 'screenshot saved' : `Firefox exited with ${exit.signal || exit.code}`
  };
}

await mkdir(outDir, { recursive: true });

if (!(await fileExists(chromePath))) {
  console.error(`Chrome not found at ${chromePath}`);
  process.exit(1);
}

const chromeResults = [];
for (const viewport of viewports) {
  chromeResults.push(await chromeAudit(viewport));
}

const firefoxResults = [];
for (const viewport of viewports) {
  firefoxResults.push(await firefoxScreenshot(viewport));
}

console.log(`Responsive smoke test for ${pageUrl}`);
console.log(`Screenshots: ${outDir}`);
console.log('');

for (const result of chromeResults) {
  const vp = `${result.viewport.width}x${result.viewport.height}`;
  const problems = [...result.audit.problems, ...result.runtimeErrors];
  console.log(`${result.ok ? 'PASS' : 'FAIL'} Chrome ${result.viewport.name} ${vp}`);
  if (problems.length) problems.forEach(item => console.log(`  - ${item}`));
}

console.log('');
for (const result of firefoxResults) {
  const vp = `${result.viewport.width}x${result.viewport.height}`;
  console.log(`${result.ok ? 'PASS' : 'WARN'} Firefox ${result.viewport.name} ${vp}: ${result.message}`);
}

const failed = chromeResults.filter(result => !result.ok);
if (failed.length) process.exit(1);
