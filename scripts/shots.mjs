import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import puppeteer from 'puppeteer';

const args = new Map(process.argv.slice(2).filter((arg) => arg.startsWith('--')).map((arg) => {
  const [key, ...value] = arg.slice(2).split('=');
  return [key, value.join('=') || 'true'];
}));
const port = Number(args.get('port') ?? 4173);
const label = args.get('label') ?? 'after';
const seeds = (args.get('seeds') ?? '42891,83472,19453').split(',').map(Number);
const biomes = (args.get('biomes') ?? 'Praia,Planície,Floresta temperada,Bosque outonal,Taiga,Floresta ancestral,Pântano,Terras secas,Montanha rochosa,Tundra').split(',');
const zooms = (args.get('zooms') ?? '2,1').split(',').map(Number);
const baseUrl = `http://127.0.0.1:${port}`;
const shotsDir = path.resolve('shots', label);
await fs.mkdir(shotsDir, { recursive: true });

const server = spawn('npm', ['run', 'dev', '--', '--host', '127.0.0.1', '--port', String(port)], {
  stdio: 'ignore',
  env: process.env,
});
let browser;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForServer() {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(baseUrl);
      if (response.ok) return;
    } catch { /* Vite ainda está inicializando. */ }
    await sleep(500);
  }
  throw new Error(`Servidor Vite não iniciou em ${baseUrl}`);
}

try {
  await waitForServer();
  browser = await puppeteer.launch({
    headless: true,
    executablePath: process.env.CHROME_PATH || '/usr/bin/chromium',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  page.on('console', (message) => { if (message.type() === 'error') console.error('[browser]', message.text()); });
  page.on('pageerror', (error) => console.error('[pageerror]', error.message));
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForFunction(() => Boolean(window.__GAME_DEBUG__), { timeout: 90_000 });

  const report = [];
  for (const seed of seeds) {
    await page.evaluate((nextSeed) => window.__GAME_DEBUG__.regenerate(nextSeed), seed);
    await sleep(1200);
    for (const biome of biomes) {
      const found = await page.evaluate((name) => window.__GAME_DEBUG__.teleportToBiome(name), biome);
      if (!found) {
        report.push({ seed, biome, status: 'not-found' });
        console.warn(`Bioma não localizado: ${biome} (seed ${seed})`);
        continue;
      }
      await sleep(900);
      for (const zoom of zooms) {
        await page.evaluate((value) => window.__GAME_DEBUG__.setZoom(value), zoom);
        await sleep(350);
        const filename = `${seed}-${biome.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-')}-z${zoom}.png`;
        await page.screenshot({ path: path.join(shotsDir, filename) });
        report.push({ seed, biome, zoom, status: 'captured', file: filename });
      }
    }
  }
  await fs.writeFile(path.join(shotsDir, 'manifest.json'), JSON.stringify({ label, seeds, biomes, zooms, captures: report }, null, 2));
  console.log(`Capturas: ${report.filter((entry) => entry.status === 'captured').length}; diretório: ${shotsDir}`);
} finally {
  await browser?.close().catch(() => {});
  server.kill('SIGTERM');
}
