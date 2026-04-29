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
	const timeout = Number(process.env.PAGESPEED_TIMEOUT_MS || 60000);
	const result: PageSpeedResult = {
		mobile: { score: 'N/A', metrics: {} },
		desktop: { score: 'N/A', metrics: {} }
	};

	const fetchStrategy = async (strategy: 'mobile' | 'desktop') => {
		logger.info(`pagespeed:${strategy}: requesting`);
		const response = await axios.get('https://www.googleapis.com/pagespeedonline/v5/runPagespeed', {
			timeout,
			params: { url: targetUrl, strategy, key: apiKey }
		});
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

	const [mobileResult, desktopResult] = await Promise.allSettled([
		fetchStrategy('mobile'),
		fetchStrategy('desktop')
	]);

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
