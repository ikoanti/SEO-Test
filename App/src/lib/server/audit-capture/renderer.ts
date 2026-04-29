import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright-core';
import type { Browser, Page } from 'playwright-core';
import sharp from 'sharp';
import {
	deleteSidebarRenderData,
	putSidebarRenderData
} from '$lib/server/audit-capture/sidebar-store';

const SIDEBAR_WIDTH = 420;
const SIDEBAR_MARGIN = 16;
const SIDEBAR_RENDER_PADDING_X = 40;
const SIDEBAR_RENDER_PADDING_TOP = 16;
const SIDEBAR_RENDER_WIDTH = SIDEBAR_WIDTH + SIDEBAR_RENDER_PADDING_X * 2;
const CAPTURE_HEIGHT = 900;
const WINDOW_HEIGHT = 900;
const WINDOW_WIDTH = 1365;
const DISPLAY_WIDTH = 1600;
const DISPLAY_HEIGHT = 1200;
const SESSION_IDLE_TIMEOUT_MS = Number(process.env.AUDIT_CAPTURE_IDLE_TIMEOUT_MS || 30000);
const MAX_SESSION_CAPTURES = Number(process.env.AUDIT_CAPTURE_MAX_SESSION_CAPTURES || 50);

let captureQueue = Promise.resolve();
let sessionIdleTimer: NodeJS.Timeout | null = null;
let sessionCaptureCount = 0;

type CaptureSession = {
	display?: string;
	xvfb?: ReturnType<typeof spawn>;
	openbox?: ReturnType<typeof spawn>;
	browser: Browser;
};

let headfulSessionPromise: Promise<CaptureSession> | null = null;
let headlessBrowserPromise: Promise<Browser> | null = null;

function resolveAppOrigin() {
	return (
		process.env.AUDIT_CAPTURE_APP_ORIGIN ||
		process.env.APP_ORIGIN ||
		process.env.PUBLIC_APP_ORIGIN ||
		`http://127.0.0.1:${process.env.PORT || 3000}`
	).replace(/\/+$/, '');
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
		'--disable-background-networking',
		'--disable-component-update',
		'--disable-default-apps',
		'--disable-extensions',
		'--disable-site-isolation-trials',
		'--force-device-scale-factor=1',
		'--mute-audio',
		'--renderer-process-limit=2',
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
	if (sessionIdleTimer) {
		clearTimeout(sessionIdleTimer);
		sessionIdleTimer = null;
	}
	if (sessionCaptureCount >= MAX_SESSION_CAPTURES) {
		await closeCaptureSession();
	}
	headfulSessionPromise ??= createHeadfulSession();
	return headfulSessionPromise;
}

async function getHeadlessBrowser() {
	if (sessionIdleTimer) {
		clearTimeout(sessionIdleTimer);
		sessionIdleTimer = null;
	}
	if (sessionCaptureCount >= MAX_SESSION_CAPTURES) {
		await closeCaptureSession();
	}
	headlessBrowserPromise ??= launchBrowser();
	return headlessBrowserPromise;
}

async function closeCaptureSession() {
	if (sessionIdleTimer) {
		clearTimeout(sessionIdleTimer);
		sessionIdleTimer = null;
	}
	sessionCaptureCount = 0;
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

function scheduleCaptureSessionCleanup() {
	if (SESSION_IDLE_TIMEOUT_MS <= 0) return;
	if (sessionIdleTimer) clearTimeout(sessionIdleTimer);
	sessionIdleTimer = setTimeout(() => {
		void closeCaptureSession();
	}, SESSION_IDLE_TIMEOUT_MS);
	sessionIdleTimer.unref?.();
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

async function screenshotAuditedPage(browser: Browser, urls: string[]) {
	const page = await browser.newPage({
		viewport: { width: WINDOW_WIDTH, height: CAPTURE_HEIGHT }
	});
	try {
		await openFirstAvailableUrl(page, urls);
		return await page.screenshot({ type: 'png', fullPage: false });
	} finally {
		await page.close().catch(() => undefined);
	}
}

async function screenshotAuditedChromeWindow(browser: Browser, display: string, urls: string[]) {
	const page = await browser.newPage({
		viewport: { width: WINDOW_WIDTH, height: CAPTURE_HEIGHT }
	});
	try {
		await openFirstAvailableUrl(page, urls);
		await page.bringToFront();
		await page.waitForTimeout(300);
		const viewportOffset = await page.evaluate(() => ({
			top: Math.max(0, window.outerHeight - window.innerHeight),
			left: Math.max(0, window.outerWidth - window.innerWidth)
		}));
		return {
			image: await captureDesktop(display),
			viewportOffset
		};
	} finally {
		await page.close().catch(() => undefined);
	}
}

async function screenshotSidebar(browser: Browser, sidebarData: Record<string, unknown>) {
	const id = putSidebarRenderData(sidebarData);
	const page = await browser.newPage({
		viewport: { width: SIDEBAR_RENDER_WIDTH, height: CAPTURE_HEIGHT },
		deviceScaleFactor: 1
	});

	try {
		const url = `${resolveAppOrigin()}/__audit-sidebar-capture?id=${encodeURIComponent(id)}`;
		await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
		const frame = page.locator('[data-sidebar-frame]');
		await frame.waitFor({ state: 'visible', timeout: 10000 });
		await page.waitForTimeout(250);
		return await page.locator('[data-sidebar-stage]').screenshot({
			type: 'png',
			omitBackground: true
		});
	} finally {
		deleteSidebarRenderData(id);
		await page.close().catch(() => undefined);
	}
}

async function compositeSidebar(
	pageImage: Buffer,
	sidebarImage: Buffer,
	viewportOffset = { top: 0, left: 0 }
) {
	const pageMetadata = await sharp(pageImage).metadata();
	const pageWidth = pageMetadata.width ?? WINDOW_WIDTH;
	const viewportRight = viewportOffset.left + WINDOW_WIDTH;
	const left =
		Math.max(0, Math.min(pageWidth, viewportRight) - SIDEBAR_WIDTH - SIDEBAR_MARGIN - SIDEBAR_RENDER_PADDING_X);
	const top = Math.max(0, viewportOffset.top + SIDEBAR_MARGIN - SIDEBAR_RENDER_PADDING_TOP);

	return sharp(pageImage)
		.composite([
			{
				input: sidebarImage,
				left,
				top
			}
		])
		.png()
		.toBuffer();
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
	const runCapture = async ({ browser }: { browser: Browser; display?: string }) => {
		const urls = [pageUrl, ...fallbackPageUrls.filter((url) => url && url !== pageUrl)];
		const [pageImage, sidebarImage] = await Promise.all([
			screenshotAuditedPage(browser, urls),
			screenshotSidebar(browser, sidebarData)
		]);
		const image = await compositeSidebar(pageImage, sidebarImage);
		return {
			contentType: 'image/png',
			imageBase64: image.toString('base64')
		};
	};
	const runHeadfulCapture = async ({ browser, display }: { browser: Browser; display: string }) => {
		const urls = [pageUrl, ...fallbackPageUrls.filter((url) => url && url !== pageUrl)];
		const auditedPage = await screenshotAuditedChromeWindow(browser, display, urls);
		const sidebarImage = await screenshotSidebar(browser, sidebarData);
		const image = await compositeSidebar(
			auditedPage.image,
			sidebarImage,
			auditedPage.viewportOffset
		);
		return {
			contentType: 'image/png',
			imageBase64: image.toString('base64')
		};
	};

	return withCaptureQueue(async () => {
		if (shouldUseHeadfulCapture()) {
			try {
				const session = await getHeadfulSession();
				const result = session.display
					? await runHeadfulCapture({ browser: session.browser, display: session.display })
					: await runCapture({ browser: session.browser });
				sessionCaptureCount += 1;
				return result;
			} finally {
				scheduleCaptureSessionCleanup();
				console.info(`[audit-capture] ${panel} capture finished in ${Date.now() - startedAt}ms`);
			}
		}

		try {
			const result = await runCapture({ browser: await getHeadlessBrowser() });
			sessionCaptureCount += 1;
			return result;
		} finally {
			scheduleCaptureSessionCleanup();
			console.info(`[audit-capture] ${panel} capture finished in ${Date.now() - startedAt}ms`);
		}
	});
}
