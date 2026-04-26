import { createWriteStream, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { chmod, copyFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { pipeline } from 'node:stream/promises';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, '..');
const APP_DIR = join(ROOT_DIR, 'App');
const LOCAL_DIR = join(ROOT_DIR, '.local');
const BIN_DIR = join(LOCAL_DIR, 'bin');
const DATA_DIR = join(LOCAL_DIR, 'pocketbase-data');
const DOWNLOADS_DIR = join(LOCAL_DIR, 'downloads');
const ENV_PATH = join(ROOT_DIR, 'Infrastructure', '.env');
const PB_VERSION = process.env.POCKETBASE_VERSION || '0.36.9';
const PB_HOST = '127.0.0.1:8090';
const PB_URL = `http://${PB_HOST}`;
const APP_HOST = '127.0.0.1';
const isWindows = process.platform === 'win32';
const PB_BINARY_NAME = isWindows ? 'pocketbase.exe' : 'pocketbase';
const PB_BINARY_PATH = join(BIN_DIR, PB_BINARY_NAME);
const MIGRATIONS_DIR = join(ROOT_DIR, 'Infrastructure', 'pocketbase', 'pb_migrations');
const APP_AUTH_EMAIL = 'demo@local.test';
const APP_AUTH_PASSWORD = 'DemoUser123!';
const PB_SUPERUSER_EMAIL = 'admin@local.test';
const PB_SUPERUSER_PASSWORD = 'LocalAdmin123!';

function log(message: string) {
	console.log(`[dev:local] ${message}`);
}

function ensureDir(path: string) {
	if (!existsSync(path)) {
		mkdirSync(path, { recursive: true });
	}
}

function parseEnvFile(path: string) {
	if (!existsSync(path)) {
		return {};
	}

	const envEntries: Record<string, string> = {};
	const contents = readFileSync(path, 'utf8');

	for (const rawLine of contents.split(/\r?\n/)) {
		const line = rawLine.trim();
		if (!line || line.startsWith('#')) continue;

		const separatorIndex = line.indexOf('=');
		if (separatorIndex === -1) continue;

		const key = line.slice(0, separatorIndex).trim();
		let value = line.slice(separatorIndex + 1).trim();

		if (
			(value.startsWith('"') && value.endsWith('"')) ||
			(value.startsWith("'") && value.endsWith("'"))
		) {
			value = value.slice(1, -1);
		}

		if (key) {
			envEntries[key] = value;
		}
	}

	return envEntries;
}

function getLocalEnv() {
	const localEnv = parseEnvFile(ENV_PATH);
	const mergedEnv = {
		...localEnv,
		...process.env
	};

	return {
		...mergedEnv,
		POCKETBASE_URL: PB_URL,
		POCKETBASE_AUTH_COLLECTION: 'users',
		POCKETBASE_RUNS_COLLECTION: 'runs',
		POCKETBASE_AUDITS_COLLECTION: 'audits',
		POCKETBASE_ITEM_RUNS_COLLECTION: 'item_runs',
		POCKETBASE_AUDIT_ITEMS_COLLECTION: 'audit_items',
		POCKETBASE_AUDIT_FINDINGS_COLLECTION: 'audit_findings',
		APP_AUTH_EMAIL: mergedEnv.APP_AUTH_EMAIL || APP_AUTH_EMAIL,
		APP_AUTH_PASSWORD: mergedEnv.APP_AUTH_PASSWORD || APP_AUTH_PASSWORD,
		APP_AUTH_NAME: mergedEnv.APP_AUTH_NAME || 'Demo User',
		POCKETBASE_SUPERUSER_EMAIL: mergedEnv.POCKETBASE_SUPERUSER_EMAIL || PB_SUPERUSER_EMAIL,
		POCKETBASE_SUPERUSER_PASSWORD: mergedEnv.POCKETBASE_SUPERUSER_PASSWORD || PB_SUPERUSER_PASSWORD
	};
}

function getPocketBaseTarget() {
	const platformMap: Record<string, Record<string, string>> = {
		darwin: {
			arm64: 'darwin_arm64',
			x64: 'darwin_amd64'
		},
		linux: {
			arm64: 'linux_arm64',
			x64: 'linux_amd64'
		},
		win32: {
			arm64: 'windows_arm64',
			x64: 'windows_amd64'
		}
	};

	const platformTargets = platformMap[process.platform];
	if (!platformTargets) {
		throw new Error(`Unsupported platform: ${process.platform}`);
	}

	const target = platformTargets[process.arch];
	if (!target) {
		throw new Error(`Unsupported architecture: ${process.platform}/${process.arch}`);
	}

	return target;
}

async function ensurePocketBaseBinary() {
	if (existsSync(PB_BINARY_PATH)) {
		return;
	}

	ensureDir(BIN_DIR);
	ensureDir(DOWNLOADS_DIR);

	const target = getPocketBaseTarget();
	const version = PB_VERSION.startsWith('v') ? PB_VERSION.slice(1) : PB_VERSION;
	const zipName = `pocketbase_${version}_${target}.zip`;
	const zipPath = join(DOWNLOADS_DIR, zipName);
	const downloadUrl = `https://github.com/pocketbase/pocketbase/releases/download/v${version}/${zipName}`;

	log(`downloading PocketBase v${version} for ${target}`);
	const response = await fetch(downloadUrl);
	if (!response.ok || !response.body) {
		throw new Error(`Failed to download PocketBase: ${response.status} ${response.statusText}`);
	}

	await pipeline(response.body, createWriteStream(zipPath));
	await runCommand('unzip', ['-o', zipPath, '-d', BIN_DIR], { cwd: ROOT_DIR });

	const extractedBinaryPath = join(BIN_DIR, PB_BINARY_NAME);
	if (!existsSync(extractedBinaryPath)) {
		throw new Error(`PocketBase binary not found after unzip: ${extractedBinaryPath}`);
	}

	if (!isWindows) {
		await chmod(extractedBinaryPath, 0o755);
		await runCommand('xattr', ['-d', 'com.apple.quarantine', extractedBinaryPath], {
			cwd: ROOT_DIR,
			allowFailure: true,
			quiet: true
		});
	}

	if (extractedBinaryPath !== PB_BINARY_PATH) {
		await copyFile(extractedBinaryPath, PB_BINARY_PATH);
	}
}

function runCommand(
	command: string,
	args: string[],
	options: {
		quiet?: boolean;
		cwd?: string;
		env?: NodeJS.ProcessEnv;
		allowFailure?: boolean;
	} = {}
) {
	return new Promise<number>((resolve, reject) => {
		const child = spawn(command, args, {
			stdio: options.quiet ? 'ignore' : 'inherit',
			cwd: options.cwd || ROOT_DIR,
			env: options.env || process.env,
			shell: false
		});

		child.on('error', reject);
		child.on('close', (code) => {
			if (code === 0 || options.allowFailure) {
				resolve(code ?? 0);
				return;
			}
			reject(new Error(`${command} ${args.join(' ')} exited with code ${code}`));
		});
	});
}

async function findListeningProcessIds(port: number) {
	return new Promise<string[]>((resolve, reject) => {
		const child = spawn('lsof', ['-t', `-iTCP:${port}`, '-sTCP:LISTEN', '-n', '-P'], {
			stdio: ['ignore', 'pipe', 'ignore'],
			cwd: ROOT_DIR,
			shell: false
		});

		let output = '';
		child.stdout.on('data', (chunk) => {
			output += String(chunk);
		});

		child.on('error', (error: NodeJS.ErrnoException) => {
			if ((error && 'code' in error && error.code === 'ENOENT') || process.platform === 'win32') {
				resolve([]);
				return;
			}
			reject(error);
		});

		child.on('close', (code) => {
			if (code !== 0 && output.trim() === '') {
				resolve([]);
				return;
			}

			resolve(
				output
					.split('\n')
					.map((line) => line.trim())
					.filter(Boolean)
			);
		});
	});
}

async function stopProcessIds(processIds: string[]) {
	for (const processId of processIds) {
		try {
			process.kill(Number(processId), 'SIGTERM');
		} catch {}
	}

	for (let index = 0; index < 20; index += 1) {
		const remaining = await findListeningProcessIds(8090);
		if (remaining.length === 0) {
			return;
		}
		await new Promise((resolve) => setTimeout(resolve, 250));
	}

	const remaining = await findListeningProcessIds(8090);
	for (const processId of remaining) {
		try {
			process.kill(Number(processId), 'SIGKILL');
		} catch {}
	}
}

async function ensureAppDeps() {
	if (existsSync(join(APP_DIR, 'node_modules'))) {
		return;
	}

	log('installing App dependencies');
	await runCommand(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['install'], { cwd: APP_DIR });
}

async function upsertSuperuser(email: string, password: string) {
	log('ensuring PocketBase superuser exists');

	try {
		await runCommand(
			PB_BINARY_PATH,
			['superuser', 'upsert', email, password, '--dir', DATA_DIR],
			{ cwd: ROOT_DIR }
		);
		return;
	} catch {
		log('superuser upsert unavailable, falling back to create');
	}

	await runCommand(
		PB_BINARY_PATH,
		['superuser', 'create', email, password, '--dir', DATA_DIR],
		{ cwd: ROOT_DIR, allowFailure: true }
	);
}

async function isPocketBaseHealthy() {
	try {
		const response = await fetch(`${PB_URL}/api/health`);
		return response.ok;
	} catch {
		return false;
	}
}

async function waitForPocketBase() {
	for (let index = 0; index < 60; index += 1) {
		if (await isPocketBaseHealthy()) {
			return;
		}

		await new Promise((resolve) => setTimeout(resolve, 500));
	}

	throw new Error('PocketBase did not become healthy in time');
}

function spawnLongRunning(
	command: string,
	args: string[],
	options: { cwd?: string; env?: NodeJS.ProcessEnv } = {}
) {
	const child = spawn(command, args, {
		stdio: 'inherit',
		cwd: options.cwd || ROOT_DIR,
		env: options.env || process.env,
		shell: false
	});

	child.on('error', (error) => {
		console.error(error);
		process.exitCode = 1;
	});

	return child;
}

async function main() {
	const shouldReset = process.argv.includes('--reset');
	let vite: ReturnType<typeof spawnLongRunning> | undefined;
	const localEnv = getLocalEnv();

	if (shouldReset) {
		const existingProcessIds = await findListeningProcessIds(8090);
		if (existingProcessIds.length > 0) {
			log(`stopping existing PocketBase on port 8090 (${existingProcessIds.join(', ')})`);
			await stopProcessIds(existingProcessIds);
		}
	}

	if (shouldReset && existsSync(DATA_DIR)) {
		log('resetting local PocketBase data');
		rmSync(DATA_DIR, { recursive: true, force: true });
	}

	ensureDir(LOCAL_DIR);
	ensureDir(DATA_DIR);

	await ensureAppDeps();
	await ensurePocketBaseBinary();
	await upsertSuperuser(localEnv.POCKETBASE_SUPERUSER_EMAIL, localEnv.POCKETBASE_SUPERUSER_PASSWORD);

	let pocketbase: ReturnType<typeof spawnLongRunning> | null = null;

	if (await isPocketBaseHealthy()) {
		log(`reusing existing PocketBase at ${PB_URL}`);
	} else {
		log('starting PocketBase');
		pocketbase = spawnLongRunning(
			PB_BINARY_PATH,
			['serve', '--http', PB_HOST, '--dir', DATA_DIR, '--migrationsDir', MIGRATIONS_DIR],
			{
				cwd: ROOT_DIR,
				env: localEnv
			}
		);
	}

	const cleanup = () => {
		if (pocketbase && !pocketbase.killed) {
			pocketbase.kill('SIGTERM');
		}
		if (vite && !vite.killed) {
			vite.kill('SIGTERM');
		}
	};

	process.on('SIGINT', () => {
		cleanup();
		process.exit(0);
	});

	process.on('SIGTERM', () => {
		cleanup();
		process.exit(0);
	});

	await waitForPocketBase();

	log(`PocketBase ready at ${PB_URL}`);
	log(`PocketBase superuser: ${localEnv.POCKETBASE_SUPERUSER_EMAIL} / ${localEnv.POCKETBASE_SUPERUSER_PASSWORD}`);
	log(`App login: ${localEnv.APP_AUTH_EMAIL} / ${localEnv.APP_AUTH_PASSWORD}`);
	log('starting app via Vite; use the Local URL printed below');

	vite = spawnLongRunning(
		process.platform === 'win32' ? 'npm.cmd' : 'npm',
		['run', 'dev', '--', '--host', APP_HOST],
		{
			cwd: APP_DIR,
			env: localEnv
		}
	);

	const exitCode = await Promise.race([
		...(pocketbase
			? [new Promise((resolve) => pocketbase.on('exit', (code) => resolve(code ?? 0)))]
			: []),
		new Promise((resolve) => vite.on('exit', (code) => resolve(code ?? 0)))
	]);

	cleanup();
	process.exit(Number(exitCode) || 0);
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : error);
	process.exit(1);
});
