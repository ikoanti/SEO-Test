import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import type { Page } from 'playwright-core';

const ASSETS_DIR = path.join(fileURLToPath(new URL('.', import.meta.url)), 'assets');
const SIDEBAR_WIDTH = 420;
const CAPTURE_HEIGHT = 900;
const WINDOW_HEIGHT = 900;
const WINDOW_WIDTH = 1365;

const assetCache = new Map<string, string>();

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
		'components/panels/headings-panel.js',
		'components/panels/image-alts-panel.js',
		'components/panels/placeholder-panel.js',
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
	const browser = await chromium.launch({
		executablePath: resolveChromeExecutable(),
		headless: true,
		args: [
			'--no-sandbox',
			'--disable-dev-shm-usage',
			'--disable-gpu',
			`--window-size=${WINDOW_WIDTH},${WINDOW_HEIGHT}`
		]
	});

	try {
		const page = await browser.newPage({
			viewport: { width: WINDOW_WIDTH, height: CAPTURE_HEIGHT }
		});
		const urls = [pageUrl, ...fallbackPageUrls.filter((url) => url && url !== pageUrl)];
		await openFirstAvailableUrl(page, urls);
		await injectSidebar(page, sidebarData);
		const image = await page.screenshot({ type: 'png', fullPage: false });
		return {
			contentType: 'image/png',
			imageBase64: image.toString('base64')
		};
	} finally {
		await browser.close();
	}
}
