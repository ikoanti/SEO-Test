import axios from 'axios';
import type { AuditLogger, AuditSummary } from '../shared';

type PageSpeedResult = {
	mobile: { score: number | string; metrics: Record<string, string> };
	desktop: { score: number | string; metrics: Record<string, string> };
};

export async function analyzePageSpeed(
	targetUrl: string,
	summary: AuditSummary,
	logger: AuditLogger
): Promise<PageSpeedResult> {
	const apiKey = process.env.PAGESPEED_API_KEY || 'AIzaSyDq_Fam7GNCloxDbbryv3sA8brDbZZum8I';
	const timeout = Number(process.env.PAGESPEED_TIMEOUT_MS || 120000);
	const retries = Number(process.env.PAGESPEED_RETRIES || 2);
	const retryDelay = Number(process.env.PAGESPEED_RETRY_DELAY_MS || 5000);
	const result: PageSpeedResult = {
		mobile: { score: 'N/A', metrics: {} },
		desktop: { score: 'N/A', metrics: {} }
	};

	const fetchStrategy = async (strategy: 'mobile' | 'desktop') => {
		logger.info(`pagespeed:${strategy}: requesting`);
		const response = await withPageSpeedRetry(
			() =>
				axios.get('https://www.googleapis.com/pagespeedonline/v5/runPagespeed', {
					timeout,
					params: { url: targetUrl, strategy, category: 'performance', key: apiKey }
				}),
			retries,
			retryDelay,
			(message) => logger.warn(`pagespeed:${strategy}: ${message}`)
		);
		const audits = response.data?.lighthouseResult?.audits || {};
		const score = Math.round(
			(response.data?.lighthouseResult?.categories?.performance?.score || 0) * 100
		);

		if (score >= 90) summary.passed += 1;
		else if (score >= 50) summary.warnings += 1;
		else summary.warnings += 1;

		logger.info(`pagespeed:${strategy}: score ${score}`);
		return {
			score,
			metrics: {
				FCP: audits['first-contentful-paint']?.displayValue || 'N/A',
				LCP: audits['largest-contentful-paint']?.displayValue || 'N/A',
				CLS: audits['cumulative-layout-shift']?.displayValue || 'N/A',
				TBT: audits['total-blocking-time']?.displayValue || 'N/A'
			}
		};
	};

	const mobileResult = await Promise.resolve()
		.then(() => fetchStrategy('mobile'))
		.then(
			(value) => ({ status: 'fulfilled' as const, value }),
			(reason) => ({ status: 'rejected' as const, reason })
		);
	const desktopResult = await Promise.resolve()
		.then(() => fetchStrategy('desktop'))
		.then(
			(value) => ({ status: 'fulfilled' as const, value }),
			(reason) => ({ status: 'rejected' as const, reason })
		);

	if (mobileResult.status === 'fulfilled') {
		result.mobile = mobileResult.value;
	} else {
		const message =
			mobileResult.reason instanceof Error
				? mobileResult.reason.message
				: String(mobileResult.reason);
		logger.warn(`pagespeed:mobile: fallback due to ${message}`);
	}

	if (desktopResult.status === 'fulfilled') {
		result.desktop = desktopResult.value;
	} else {
		const message =
			desktopResult.reason instanceof Error
				? desktopResult.reason.message
				: String(desktopResult.reason);
		logger.warn(`pagespeed:desktop: fallback due to ${message}`);
	}

	return result;
}

async function withPageSpeedRetry<T>(
	request: () => Promise<T>,
	retries: number,
	retryDelay: number,
	logRetry: (message: string) => void
) {
	let lastError: unknown;
	for (let attempt = 0; attempt <= retries; attempt += 1) {
		try {
			return await request();
		} catch (error) {
			lastError = error;
			if (attempt >= retries) break;
			const message = error instanceof Error ? error.message : String(error);
			const delay = retryDelay * (attempt + 1);
			logRetry(`attempt ${attempt + 1} failed (${message}); retrying in ${delay}ms`);
			await new Promise((resolve) => setTimeout(resolve, delay));
		}
	}
	throw lastError;
}
