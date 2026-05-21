import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { chromium } from 'playwright-core';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, '..');
const defaultOutputPath = path.join(appRoot, '.local', 'google-rich-results-storage-state.json');

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
	].filter(Boolean);

	for (const candidate of candidates) {
		if (fs.existsSync(candidate)) return candidate;
	}

	throw new Error(
		'No Chrome/Chromium executable found. Set AUDIT_CHROME_PATH or CHROME_EXECUTABLE_PATH.'
	);
}

function argValue(name) {
	const prefix = `${name}=`;
	const match = process.argv.find((argument) => argument.startsWith(prefix));
	return match ? match.slice(prefix.length) : '';
}

const outputPath = path.resolve(
	argValue('--output') || process.env.GOOGLE_RICH_RESULTS_STORAGE_STATE || defaultOutputPath
);
const testUrl =
	argValue('--test-url') || process.env.RICH_RESULTS_TEST_URL || 'https://example.com/';

fs.mkdirSync(path.dirname(outputPath), { recursive: true });

const browser = await chromium.launch({
	executablePath: resolveChromeExecutable(),
	headless: false,
	args: ['--no-sandbox', '--disable-dev-shm-usage']
});

const context = await browser.newContext({
	viewport: { width: 1365, height: 900 }
});
const page = await context.newPage();
const rl = createInterface({ input, output });

try {
	console.log('\nGoogle Rich Results storage-state setup');
	console.log('1. A Chrome window will open.');
	console.log('2. Log in to the Google account you want the server to reuse.');
	console.log('3. After login, this script opens Rich Results Test for a quick verification.');
	console.log('4. Return here and press Enter to save the session.\n');

	await page.goto('https://accounts.google.com/', {
		waitUntil: 'domcontentloaded',
		timeout: 60000
	});

	await rl.question('After Google login is complete in Chrome, press Enter here...');

	await page.goto(
		`https://search.google.com/test/rich-results?hl=en&url=${encodeURIComponent(testUrl)}`,
		{
			waitUntil: 'domcontentloaded',
			timeout: 60000
		}
	);

	console.log('\nRich Results Test opened.');
	console.log(
		'If the page shows you as signed in and does not show "Log in and try again", the session is usable.'
	);
	await rl.question('Press Enter to save the storage state...');

	await context.storageState({ path: outputPath });
	console.log(`\nSaved Google storage state:\n${outputPath}\n`);
	console.log('Set this in the app environment:');
	console.log(`GOOGLE_RICH_RESULTS_STORAGE_STATE=${outputPath}`);
	console.log('\nKeep this file out of git. Treat it like a password.\n');
} finally {
	rl.close();
	await browser.close();
}
