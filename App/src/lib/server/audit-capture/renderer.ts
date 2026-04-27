import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import type { Browser, Page } from 'playwright-core';

function resolveAssetsDir() {
	const candidates = [
		process.env.AUDIT_CAPTURE_ASSETS_DIR,
		path.join(fileURLToPath(new URL('.', import.meta.url)), 'assets'),
		path.join(process.cwd(), 'src/lib/server/audit-capture/assets'),
		path.join(process.cwd(), 'audit-capture-assets')
	].filter((value): value is string => Boolean(value));

	for (const candidate of candidates) {
		if (fs.existsSync(path.join(candidate, 'styles/shell.css'))) {
			return candidate;
		}
	}

	return candidates[0];
}

const ASSETS_DIR = resolveAssetsDir();
const SIDEBAR_WIDTH = 420;
const CAPTURE_HEIGHT = 900;
const WINDOW_HEIGHT = 900;
const WINDOW_WIDTH = 1365;
const DISPLAY_WIDTH = 1600;
const DISPLAY_HEIGHT = 1200;

const assetCache = new Map<string, string>();
let captureQueue = Promise.resolve();

type CaptureSession = {
	display?: string;
	xvfb?: ReturnType<typeof spawn>;
	openbox?: ReturnType<typeof spawn>;
	browser: Browser;
};

let headfulSessionPromise: Promise<CaptureSession> | null = null;
let headlessBrowserPromise: Promise<Browser> | null = null;

function assetText(relativePath: string) {
	const cached = assetCache.get(relativePath);
	if (cached !== undefined) return cached;
	const value = fs.readFileSync(path.join(ASSETS_DIR, relativePath), 'utf8');
	assetCache.set(relativePath, value);
	return value;
}

function escapeScriptTag(value: string) {
	return value.replaceAll('</script>', '<\\/script>');
}

function resolveChromeExecutable() {
	const candidates = [
		process.env.AUDIT_CHROME_PATH,
		process.env.CHROME_EXECUTABLE_PATH,
		'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
		'/Applications/Chromium.app/Contents/MacOS/Chromium',
		'/usr/bin/google-chrome',
		'/usr/bin/google-chrome-stable',
		'/usr/bin/chromium',
		'/usr/bin/chromium-browser'
	].filter((value): value is string => Boolean(value));

	for (const candidate of candidates) {
		if (fs.existsSync(candidate)) return candidate;
	}

	throw new Error(
		'No Chrome/Chromium executable found. Set AUDIT_CHROME_PATH or CHROME_EXECUTABLE_PATH.'
	);
}

function shouldUseHeadfulCapture() {
	return String(process.env.AUDIT_CAPTURE_HEADFUL || 'true').toLowerCase() !== 'false';
}

function delay(ms: number) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function terminateProcess(processRef: ReturnType<typeof spawn> | null) {
	if (!processRef || processRef.killed) return;
	let exited = processRef.exitCode !== null || processRef.signalCode !== null;
	processRef.once('exit', () => {
		exited = true;
	});
	processRef.kill('SIGTERM');
	await Promise.race([new Promise((resolve) => processRef.once('exit', resolve)), delay(3000)]);
	if (!exited) {
		processRef.kill('SIGKILL');
	}
}

async function runProcess(
	command: string,
	args: string[],
	env: NodeJS.ProcessEnv,
	timeoutMs = 10000
) {
	const processRef = spawn(command, args, { env, stdio: 'ignore' });
	const exitCode = await new Promise<number | null>((resolve, reject) => {
		const timeout = setTimeout(() => {
			processRef.kill('SIGKILL');
			reject(new Error(`${command} timed out after ${timeoutMs}ms`));
		}, timeoutMs);
		processRef.once('error', reject);
		processRef.once('exit', (code) => {
			clearTimeout(timeout);
			resolve(code);
		});
	});
	if (exitCode !== 0) {
		throw new Error(`${command} exited with code ${exitCode ?? 'unknown'}`);
	}
}

async function captureDesktop(display: string) {
	const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-capture-'));
	const outputPath = path.join(outputDir, 'desktop.png');

	try {
		await runProcess('scrot', ['-z', '-u', '-b', outputPath], { ...process.env, DISPLAY: display });
		return fs.readFileSync(outputPath);
	} finally {
		fs.rmSync(outputDir, { recursive: true, force: true });
	}
}

function chromeLaunchArgs() {
	return [
		'--no-sandbox',
		'--no-zygote',
		'--disable-dev-shm-usage',
		'--disable-gpu',
		'--disable-breakpad',
		'--disable-crash-reporter',
		'--disable-crashpad',
		'--force-device-scale-factor=1',
		'--window-position=0,0',
		`--window-size=${WINDOW_WIDTH},${WINDOW_HEIGHT}`
	];
}

async function launchBrowser(display?: string) {
	return chromium.launch({
		executablePath: resolveChromeExecutable(),
		headless: !display,
		args: chromeLaunchArgs(),
		env: display ? { ...process.env, DISPLAY: display } : process.env
	});
}

async function createHeadfulSession(): Promise<CaptureSession> {
	const display = process.env.DISPLAY || `:${90 + Math.floor(Math.random() * 1000)}`;
	const screen = `${DISPLAY_WIDTH}x${DISPLAY_HEIGHT}x24`;
	const xvfb = spawn('Xvfb', [display, '-screen', '0', screen], {
		stdio: 'ignore'
	});
	let openbox: ReturnType<typeof spawn> | undefined;

	try {
		await delay(1000);
		openbox = spawn('openbox', [], {
			stdio: 'ignore',
			env: { ...process.env, DISPLAY: display }
		});
		await delay(1000);
		const browser = await launchBrowser(display);
		return { display, xvfb, openbox, browser };
	} catch (error) {
		await terminateProcess(openbox || null);
		await terminateProcess(xvfb);
		throw error;
	}
}

async function getHeadfulSession() {
	headfulSessionPromise ??= createHeadfulSession();
	return headfulSessionPromise;
}

async function getHeadlessBrowser() {
	headlessBrowserPromise ??= launchBrowser();
	return headlessBrowserPromise;
}

async function closeCaptureSession() {
	const headfulSession = await headfulSessionPromise?.catch(() => null);
	headfulSessionPromise = null;
	if (headfulSession) {
		await headfulSession.browser.close().catch(() => undefined);
		await terminateProcess(headfulSession.openbox || null);
		await terminateProcess(headfulSession.xvfb || null);
	}

	const headlessBrowser = await headlessBrowserPromise?.catch(() => null);
	headlessBrowserPromise = null;
	await headlessBrowser?.close().catch(() => undefined);
}

process.once('beforeExit', () => {
	void closeCaptureSession();
});

async function withCaptureQueue<T>(fn: () => Promise<T>) {
	const previous = captureQueue;
	let release!: () => void;
	captureQueue = new Promise<void>((resolve) => {
		release = resolve;
	});
	await previous.catch(() => undefined);

	try {
		return await fn();
	} finally {
		release();
	}
}

function buildSidebarSrcdoc(panelData: Record<string, unknown>) {
	const panelJson = escapeScriptTag(JSON.stringify(panelData));
	const styleMap = {
		shell: assetText('styles/shell.css'),
		'audit-sidebar': assetText('styles/audit-sidebar.css'),
		'panels-shared': assetText('styles/panels/shared.css'),
		'ai-bot-visibility-panel': assetText('styles/panels/ai-bot-visibility-panel.css'),
		'broken-links-panel': assetText('styles/panels/broken-links-panel.css'),
		'headings-panel': assetText('styles/panels/headings-panel.css'),
		'image-alts-panel': assetText('styles/panels/image-alts-panel.css'),
		'placeholder-panel': assetText('styles/panels/placeholder-panel.css')
	};
	const styleJson = escapeScriptTag(JSON.stringify(styleMap));
	const scripts = [
		'models/audit-models.js',
		'utils/html.js',
		'components/panels/ai-bot-visibility-panel.js',
		'components/panels/broken-links-panel.js',
		'components/panels/canonicals-panel.js',
		'components/panels/content-quality-panel.js',
		'components/panels/headings-panel.js',
		'components/panels/image-alts-panel.js',
		'components/panels/internal-links-panel.js',
		'components/panels/lazy-loading-panel.js',
		'components/panels/meta-tags-panel.js',
		'components/panels/open-page-rank-panel.js',
		'components/panels/open-graph-panel.js',
		'components/panels/pagespeed-panel.js',
		'components/panels/placeholder-panel.js',
		'components/panels/shopify-urls-panel.js',
		'components/audit-sidebar.js'
	];
	const scriptTags = scripts
		.map((file) => `<script>${escapeScriptTag(assetText(file))}</script>`)
		.join('\n');

	return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Audit Sidebar Shell</title>
  <style>${styleMap.shell}</style>
</head>
<body>
  <audit-sidebar></audit-sidebar>
  <script>window.AutomagicAuditStyles = ${styleJson};</script>
  <script>window.auditSidebarData = ${panelJson};</script>
  ${scriptTags}
  <script>
    const sidebar = document.querySelector('audit-sidebar');
    if (sidebar) {
      sidebar.data = window.auditSidebarData;
    }
  </script>
</body>
</html>`;
}

async function injectSidebar(page: Page, panelData: Record<string, unknown>) {
	const srcdoc = buildSidebarSrcdoc(panelData);
	await page.evaluate(
		({ iframeSrcdoc, sidebarWidth }: { iframeSrcdoc: string; sidebarWidth: number }) => {
			document.getElementById('__automagic_audit_sidebar_root')?.remove();

			const root = document.createElement('div');
			root.id = '__automagic_audit_sidebar_root';
			root.style.position = 'fixed';
			root.style.top = '16px';
			root.style.right = '16px';
			root.style.width = `${sidebarWidth}px`;
			root.style.height = 'calc(100vh - 32px)';
			root.style.zIndex = '2147483647';
			root.style.pointerEvents = 'auto';
			root.style.borderRadius = '28px';
			root.style.overflow = 'hidden';
			root.style.background = '#ffffff';
			root.style.boxShadow = '0 18px 40px rgba(15, 23, 42, 0.16)';

			const iframe = document.createElement('iframe');
			iframe.setAttribute('title', 'Automagic Audit Sidebar');
			iframe.setAttribute('aria-label', 'Automagic Audit Sidebar');
			iframe.style.width = '100%';
			iframe.style.height = '100%';
			iframe.style.border = '0';
			iframe.style.display = 'block';
			iframe.style.background = '#ffffff';
			iframe.srcdoc = iframeSrcdoc;

			root.appendChild(iframe);
			document.documentElement.appendChild(root);
		},
		{ iframeSrcdoc: srcdoc, sidebarWidth: SIDEBAR_WIDTH }
	);
	await page.waitForTimeout(1200);
}

async function openFirstAvailableUrl(page: Page, urls: string[]) {
	let lastError: unknown;
	for (const url of urls) {
		try {
			await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
			await page.waitForTimeout(2000);
			return;
		} catch (error) {
			lastError = error;
		}
	}
	throw lastError instanceof Error ? lastError : new Error('Failed to open capture URL.');
}

export async function captureAuditSidebarScreenshot({
	pageUrl,
	sidebarData,
	fallbackPageUrls = []
}: {
	pageUrl: string;
	sidebarData: Record<string, unknown>;
	fallbackPageUrls?: string[];
}) {
	const startedAt = Date.now();
	const panel = typeof sidebarData.activeTab === 'string' ? sidebarData.activeTab : 'unknown-panel';
	console.info(`[audit-capture] ${panel} capture started for ${pageUrl}`);
	const runCapture = async ({ browser, display }: { browser: Browser; display?: string }) => {
		const page = await browser.newPage({
			viewport: { width: WINDOW_WIDTH, height: CAPTURE_HEIGHT }
		});
		try {
			const urls = [pageUrl, ...fallbackPageUrls.filter((url) => url && url !== pageUrl)];
			await openFirstAvailableUrl(page, urls);
			await injectSidebar(page, sidebarData);
			const image = display
				? await captureDesktop(display)
				: await page.screenshot({ type: 'png', fullPage: false });
			return {
				contentType: 'image/png',
				imageBase64: image.toString('base64')
			};
		} finally {
			await page.close().catch(() => undefined);
		}
	};

	return withCaptureQueue(async () => {
		if (shouldUseHeadfulCapture()) {
			try {
				const session = await getHeadfulSession();
				return await runCapture({ browser: session.browser, display: session.display });
			} finally {
				console.info(`[audit-capture] ${panel} capture finished in ${Date.now() - startedAt}ms`);
			}
		}

		try {
			return await runCapture({ browser: await getHeadlessBrowser() });
		} finally {
			console.info(`[audit-capture] ${panel} capture finished in ${Date.now() - startedAt}ms`);
		}
	});
}
