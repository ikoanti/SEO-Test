type ScreenshotItem = {
	key?: string;
	label?: string;
	status?: string;
	screenshot?: {
		id?: string;
		title?: string;
		page_url?: string;
		image_url?: string;
	} | null;
};

type ScreenshotPageData = {
	auditId: string;
	normalizedItems: ScreenshotItem[];
};

function escapeHtml(value: unknown) {
	return String(value ?? '')
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');
}

function reportScreenshotBlock(pageData: ScreenshotPageData) {
	const screenshots = pageData.normalizedItems
		.map((item) => ({
			id: item.screenshot?.id || '',
			key: item.key || '',
			label: item.label || 'Audit Evidence',
			status: item.status || '',
			title: item.screenshot?.title || `${item.label || 'Audit'} evidence`,
			pageUrl: item.screenshot?.page_url || '',
			imageUrl: item.screenshot?.image_url || ''
		}))
		.filter((screenshot) => screenshot.imageUrl);

	if (!screenshots.length) return '';

	const cards = screenshots
		.map((screenshot) => {
			const imageUrl = screenshot.id
				? `/api/audits/${encodeURIComponent(pageData.auditId)}/screenshots/${encodeURIComponent(
						screenshot.id
					)}/image`
				: screenshot.imageUrl;
			const pageLink = screenshot.pageUrl
				? `<a href="${escapeHtml(screenshot.pageUrl)}" style="color:#2563eb; text-decoration:none; overflow-wrap:anywhere;">${escapeHtml(screenshot.pageUrl)}</a>`
				: '';

			return `<div style="background:#ffffff; border:1px solid #e5e7eb; border-radius:8px; padding:18px; margin:0 0 22px 0; page-break-inside:avoid;">
  <div style="font-size:0.78rem; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; color:#6b7280; margin-bottom:6px;">${escapeHtml(screenshot.label)}</div>
  <h3 style="font-size:1.05rem; line-height:1.35; color:#111827; margin:0 0 8px 0;">${escapeHtml(screenshot.title)}</h3>
  ${pageLink ? `<div style="font-size:0.86rem; line-height:1.5; margin:0 0 12px 0;">${pageLink}</div>` : ''}
  <img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(screenshot.title)}" style="display:block; width:100%; max-width:680px; height:auto; border:1px solid #d1d5db; border-radius:6px; margin:0;" />
</div>`;
		})
		.join('');

	return `<section data-report-evidence-screenshots="true" style="margin-top:32px; padding-top:24px; border-top:2px solid #e5e7eb;">
  <h2 style="font-size:1.6rem; line-height:1.25; color:#111827; margin:0 0 10px 0;">Evidence Screenshots</h2>
  <p style="font-size:0.95rem; line-height:1.7; color:#4b5563; margin:0 0 18px 0;">The screenshots below capture the exact audit overlay evidence generated during the crawl, including the affected pages and issue context used in this report.</p>
  ${cards}
</section>`;
}

export function appendReportScreenshots(reportHtml: string, pageData: ScreenshotPageData) {
	const screenshotBlock = reportScreenshotBlock(pageData);
	if (!screenshotBlock) return reportHtml;
	return `${reportHtml}\n${screenshotBlock}`;
}

export function appendReportScreenshotsIfMissing(reportHtml: string, pageData: ScreenshotPageData) {
	if (!reportHtml || reportHtml.includes('data-report-evidence-screenshots')) return reportHtml;
	return appendReportScreenshots(reportHtml, pageData);
}
