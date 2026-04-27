import { AlignmentType, Document, HeadingLevel, ImageRun, Packer, Paragraph, TextRun } from 'docx';
import { getAuditScreenshotFile, type AuditReportTemplateRecord } from '$lib/server/pocketbase';
import {
	buildReportProblems,
	type ReportPageData,
	type ReportProblemPreview
} from '$lib/server/report-template';

type ReportDocxPageData = ReportPageData & {
	reportPreviewItems?: ReportProblemPreview[];
};

const PAGE_WIDTH_PX = 620;

function text(value: unknown, fallback = '') {
	const raw = String(value ?? '').trim();
	return raw || fallback;
}

function getRecord(value: unknown): Record<string, unknown> {
	return value && typeof value === 'object' && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: {};
}

function domainName(pageData: ReportPageData) {
	const summary = getRecord(pageData.summary);
	return text(
		summary.domain ||
			pageData.auditRecord?.name ||
			pageData.auditRecord?.url ||
			pageData.runRecord.url,
		'this website'
	);
}

function paragraph(textValue: string, after = 180) {
	return new Paragraph({
		spacing: { after },
		children: [
			new TextRun({
				text: textValue,
				size: 21,
				color: '111827',
				font: 'Arial'
			})
		]
	});
}

function heading(textValue: string, level: (typeof HeadingLevel)[keyof typeof HeadingLevel]) {
	return new Paragraph({
		heading: level,
		spacing: { before: 120, after: 180 },
		children: [
			new TextRun({
				text: textValue,
				bold: true,
				color: '111827',
				font: 'Arial'
			})
		]
	});
}

function priorityParagraph(priority: ReportProblemPreview['priority']) {
	return new Paragraph({
		spacing: { after: 160 },
		children: [
			new TextRun({
				text: `Priority: ${priority}`,
				bold: true,
				size: 20,
				color: '6B7280',
				font: 'Arial'
			})
		]
	});
}

function pngDimensions(body: ArrayBuffer) {
	const view = new DataView(body);
	const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
	const isPng = pngSignature.every((byte, index) => view.getUint8(index) === byte);
	if (!isPng || body.byteLength < 24) return null;

	return {
		width: view.getUint32(16),
		height: view.getUint32(20)
	};
}

function imageType(contentType: string, filename: string): 'png' | 'jpg' | 'gif' | 'bmp' {
	const value = `${contentType} ${filename}`.toLowerCase();
	if (value.includes('jpeg') || value.includes('.jpg') || value.includes('.jpeg')) return 'jpg';
	if (value.includes('gif')) return 'gif';
	if (value.includes('bmp')) return 'bmp';
	return 'png';
}

async function screenshotParagraph(auditId: string, problem: ReportProblemPreview, token?: string) {
	if (!problem.screenshot?.id) return null;

	try {
		const file = await getAuditScreenshotFile(auditId, problem.screenshot.id, token);
		const dimensions = pngDimensions(file.body) || { width: PAGE_WIDTH_PX, height: 360 };
		const width = Math.min(PAGE_WIDTH_PX, dimensions.width);
		const height = Math.round((dimensions.height / dimensions.width) * width);

		return new Paragraph({
			spacing: { before: 120, after: 260 },
			alignment: AlignmentType.LEFT,
			children: [
				new ImageRun({
					type: imageType(file.contentType, file.filename),
					data: file.body,
					transformation: {
						width,
						height
					}
				})
			]
		});
	} catch {
		return null;
	}
}

function reportProblems(pageData: ReportDocxPageData, templates: AuditReportTemplateRecord[]) {
	const previewScreenshots = new Map(
		(pageData.reportPreviewItems || [])
			.filter((item) => item.screenshot)
			.map((item) => [item.key, item.screenshot])
	);

	return buildReportProblems(pageData, templates).map((problem) => ({
		...problem,
		screenshot: previewScreenshots.get(problem.key) || problem.screenshot
	}));
}

function documentFilename(pageData: ReportPageData) {
	const raw = pageData.runRecord.url || pageData.summary?.domain || 'audit';
	try {
		const hostname = new URL(raw.startsWith('http') ? raw : `https://${raw}`).hostname;
		return `Mini-SEO-Audit-${hostname}.docx`;
	} catch {
		return 'Mini-SEO-Audit-audit.docx';
	}
}

export async function generateTemplateReportDocx(
	pageData: ReportDocxPageData,
	templates: AuditReportTemplateRecord[],
	token?: string
) {
	const domain = domainName(pageData);
	const problems = reportProblems(pageData, templates);
	const children: Paragraph[] = [
		heading('Mini Technical SEO Audit', HeadingLevel.HEADING_1),
		heading(domain, HeadingLevel.HEADING_2),
		heading('Overview', HeadingLevel.HEADING_2),
		paragraph(
			`${domain} wants to rank higher for target keywords and generate more organic traffic.`
		),
		paragraph(
			'We analyzed 10 different factors in this mini technical SEO Audit, out of the 285 total factors that are included in the FULL version of the technical SEO Audit.'
		),
		paragraph(
			'The goal of this brief document is to provide an evaluation of challenges, which if resolved can be quick-win opportunities that can yield better rankings and higher organic traffic.',
			300
		),
		heading('Challenges', HeadingLevel.HEADING_2),
		paragraph(
			`In our brief evaluation of the current technical optimization status of ${domain} we identified ${
				problems.length ? 'many problems and errors' : 'a limited number of problems'
			} with the site architecture.`
		),
		paragraph(
			'These exact problems are among the top reasons why you’re not ranking for more of your target keywords and in some cases are stuck at the bottom of page 1.'
		),
		paragraph('The main problems are listed below:', 240)
	];

	for (const [index, problem] of problems.entries()) {
		children.push(heading(`Problem ${index + 1}: ${problem.title}`, HeadingLevel.HEADING_3));
		children.push(priorityParagraph(problem.priority));

		for (const bodyParagraph of problem.paragraphs) {
			children.push(paragraph(bodyParagraph));
		}

		const imageParagraph = await screenshotParagraph(pageData.auditId, problem, token);
		if (imageParagraph) children.push(imageParagraph);
	}

	if (!problems.length) {
		children.push(paragraph('No major warning or failed checks were found in this mini audit.'));
	}

	children.push(
		paragraph(
			'All of the above problems have a direct negative impact on your organic rankings, visibility, and traffic and present a massive opportunity cost over the long term.',
			260
		),
		heading('Summary', HeadingLevel.HEADING_2),
		paragraph(
			`${domain} is an established website with valuable assets, links and content and many uncaptured opportunities, but also problems…`
		),
		paragraph(
			'In order to rank for more keywords, as well as rank higher for existing ones and outrank your competitors, we’d highly suggest taking care of the issues mentioned above.'
		),
		paragraph(
			'We’d also highly suggest considering our full technical SEO audit, where we take an in-depth look at 285 different technical factors, instead of just 10 covered in this mini technical SEO audit.'
		),
		paragraph(
			'When doing the full technical audit, it’s very easy to find quick wins and optimizations that need to be done in order to dramatically increase existing organic traffic.'
		),
		paragraph(
			'An example of this would be one of the recent case studies that we just published, where weekly organic traffic jumped from 200,000 to 315,000 in 45 days, by simply changing a few settings and bits of code.'
		),
		paragraph('(Results typically kick in 30-45 days after Google indexes the applied changes).'),
		paragraph(
			`We highly believe that we can find the same problems/opportunities if not even more if we were to audit ${domain}.`
		),
		paragraph('In case of any questions, feel free to reach out to us at any time.', 0)
	);

	const document = new Document({
		creator: 'GoldenWeb',
		title: `Mini Technical SEO Audit - ${domain}`,
		sections: [
			{
				properties: {
					page: {
						margin: {
							top: 720,
							right: 720,
							bottom: 720,
							left: 720
						}
					}
				},
				children
			}
		]
	});

	return {
		filename: documentFilename(pageData),
		body: await Packer.toBuffer(document)
	};
}
