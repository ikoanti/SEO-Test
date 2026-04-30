import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import JSZip from 'jszip';
import {
	AlignmentType,
	Document,
	Header,
	HorizontalPositionRelativeFrom,
	ImageRun,
	PageBreak,
	Packer,
	Paragraph,
	TextRun,
	TextWrappingType,
	VerticalPositionRelativeFrom
} from 'docx';
import type { IRunOptions } from 'docx';
import { getAuditScreenshotFile, type AuditReportTemplateRecord } from '$lib/server/pocketbase';
import {
	buildReportProblems,
	type ReportPageData,
	type ReportProblemPreview
} from '$lib/server/report-template';

type ReportDocxPageData = ReportPageData & {
	reportPreviewItems?: ReportProblemPreview[];
};

const FONT = 'Arial';
const PAGE_WIDTH_PX = 600;
const BODY_SIZE = 24;
const SMALL_SIZE = 24;
const TITLE_SIZE = 32;
const SUBTITLE_SIZE = 28;
const LOGO_WIDTH_PX = 242;
const LOGO_HEIGHT_PX = 59;
const EMPTY_LINE_MARKER_PREFIX = 'GW_EMPTY_LINE';
let emptyLineIndex = 0;

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
		pageData.website?.display_name ||
			pageData.website?.name ||
			summary.domain ||
			pageData.website?.domain ||
			pageData.website?.url,
		'this website'
	);
}

function emptyLine() {
	emptyLineIndex += 1;
	return new Paragraph({
		children: [
			textRun(`${EMPTY_LINE_MARKER_PREFIX}_${emptyLineIndex}`, {
				size: BODY_SIZE,
				color: 'FFFFFF'
			})
		]
	});
}

function textRun(textValue: string, options: Partial<IRunOptions> = {}) {
	return new TextRun({
		text: textValue,
		size: BODY_SIZE,
		font: FONT,
		...options
	});
}

function paragraph(textValue: string) {
	return new Paragraph({
		children: [textRun(textValue)]
	});
}

function titleParagraph(textValue: string) {
	return new Paragraph({
		alignment: AlignmentType.CENTER,
		children: [textRun(textValue, { bold: true, size: TITLE_SIZE })]
	});
}

function subtitleParagraph(textValue: string) {
	return new Paragraph({
		alignment: AlignmentType.CENTER,
		children: [textRun(textValue, { italics: true, size: SUBTITLE_SIZE })]
	});
}

function sectionHeading(textValue: string) {
	return new Paragraph({
		children: [textRun(textValue, { bold: true, size: SUBTITLE_SIZE })]
	});
}

function pageBreak() {
	return new Paragraph({
		children: [new PageBreak()]
	});
}

function priorityStyle(priority: ReportProblemPreview['priority']) {
	if (priority === 'Urgent') {
		return { color: 'b10202', fill: 'ffcfc9' };
	}
	if (priority === 'High') {
		return { color: '753800', fill: 'ffc8aa' };
	}
	return { color: '473821', fill: 'ffe5a0' };
}

function problemHeading(index: number, problem: ReportProblemPreview) {
	const style = priorityStyle(problem.priority);

	return new Paragraph({
		children: [
			textRun(`Problem ${index}: ${problem.title}`, { bold: true }),
			textRun('Priority: ', { break: 1, size: SMALL_SIZE }),
			textRun(problem.priority, {
				size: SMALL_SIZE,
				color: style.color,
				shading: {
					fill: style.fill
				}
			})
		]
	});
}

async function withDocxXmlFixes(body: Buffer) {
	const zip = await JSZip.loadAsync(body);
	const documentFile = zip.file('word/document.xml');
	if (!documentFile) return body;

	let documentXml = await documentFile.async('string');

	const emptyLineMarkerPattern = new RegExp(
		`<w:p\\b([^>]*)><w:r\\b[^>]*>(?:(?!<\\/w:r>).)*<w:t\\b[^>]*>${EMPTY_LINE_MARKER_PREFIX}_\\d+<\\/w:t>(?:(?!<\\/w:r>).)*<\\/w:r><\\/w:p>`,
		'g'
	);
	documentXml = documentXml.replace(
		emptyLineMarkerPattern,
		'<w:p$1><w:pPr><w:spacing w:before="0" w:after="0"/><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:color w:val="FFFFFF"/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr><w:t xml:space="preserve"> </w:t></w:r></w:p>'
	);

	zip.file('word/document.xml', documentXml);
	return zip.generateAsync({ type: 'nodebuffer' });
}

async function reportHeader() {
	try {
		const logoPath =
			process.env.REPORT_LOGO_PATH || resolve(process.cwd(), 'src/lib/assets/report-logo.png');
		const logo = await readFile(logoPath);

		return new Header({
			children: [
				new Paragraph({
					alignment: AlignmentType.LEFT,
					children: [
						new ImageRun({
							type: 'png',
							data: logo,
							transformation: {
								width: LOGO_WIDTH_PX,
								height: LOGO_HEIGHT_PX
							},
							floating: {
								allowOverlap: true,
								behindDocument: false,
								layoutInCell: true,
								horizontalPosition: {
									relative: HorizontalPositionRelativeFrom.COLUMN,
									offset: 4171950
								},
								verticalPosition: {
									relative: VerticalPositionRelativeFrom.PARAGRAPH,
									offset: -133349
								},
								margins: {
									top: 0,
									right: 0,
									bottom: 0,
									left: 0
								},
								wrap: {
									type: TextWrappingType.TOP_AND_BOTTOM
								}
							}
						})
					]
				})
			]
		});
	} catch {
		return null;
	}
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
	const name = domainName(pageData)
		.replace(/[^a-z0-9._-]+/gi, '-')
		.replace(/^-+|-+$/g, '');
	return `Mini-SEO-Audit-${name || 'audit'}.docx`;
}

export async function generateTemplateReportDocx(
	pageData: ReportDocxPageData,
	templates: AuditReportTemplateRecord[],
	token?: string
) {
	emptyLineIndex = 0;
	const domain = domainName(pageData);
	const problems = reportProblems(pageData, templates);
	const header = await reportHeader();
	const children: Paragraph[] = [
		titleParagraph('Mini Technical SEO Audit'),
		subtitleParagraph(domain),
		emptyLine(),
		emptyLine(),
		sectionHeading('Overview'),
		emptyLine(),
		paragraph(
			`${domain} wants to rank higher for target keywords and generate more organic traffic.`
		),
		emptyLine(),
		paragraph(
			'We analyzed 10 different factors in this mini technical SEO Audit, out of the 285 total factors that are included in the FULL version of the technical SEO Audit.'
		),
		emptyLine(),
		paragraph(
			'The goal of this brief document is to provide an evaluation of challenges, which if resolved can be quick-win opportunities that can yield better rankings and higher organic traffic.'
		),
		emptyLine(),
		pageBreak(),
		sectionHeading('Challenges'),
		emptyLine(),
		paragraph(
			`In our brief evaluation of the current technical optimization status of ${domain} we identified ${
				problems.length ? 'many problems and errors' : 'a limited number of problems'
			} with the site architecture.`
		),
		emptyLine(),
		paragraph(
			'These exact problems are among the top reasons why you’re not ranking for more of your target keywords and in some cases are stuck at the bottom of page 1.'
		),
		emptyLine(),
		paragraph('The main problems are listed below:'),
		emptyLine()
	];

	for (const [index, problem] of problems.entries()) {
		children.push(problemHeading(index + 1, problem));
		children.push(emptyLine());

		for (const bodyParagraph of problem.paragraphs) {
			children.push(paragraph(bodyParagraph));
			children.push(emptyLine());
		}

		const imageParagraph = await screenshotParagraph(pageData.auditId, problem, token);
		if (imageParagraph) {
			children.push(imageParagraph);
			children.push(emptyLine());
		}
	}

	if (!problems.length) {
		children.push(paragraph('No major warnings were found in this mini audit.'));
		children.push(emptyLine());
	}

	children.push(
		paragraph(
			'All of the above problems have a direct negative impact on your organic rankings, visibility, and traffic and present a massive opportunity cost over the long term.'
		),
		emptyLine(),
		emptyLine(),
		sectionHeading('Summary'),
		emptyLine(),
		paragraph(
			`${domain} is an established website with valuable assets, links and content and many uncaptured opportunities, but also problems…`
		),
		emptyLine(),
		paragraph(
			'In order to rank for more keywords, as well as rank higher for existing ones and outrank your competitors, we’d highly suggest taking care of the issues mentioned above.'
		),
		emptyLine(),
		paragraph(
			'We’d also highly suggest considering our full technical SEO audit, where we take an in-depth look at 285 different technical factors, instead of just 10 covered in this mini technical SEO audit.'
		),
		emptyLine(),
		paragraph(
			'When doing the full technical audit, it’s very easy to find quick wins and optimizations that need to be done in order to dramatically increase existing organic traffic.'
		),
		emptyLine(),
		paragraph(
			'An example of this would be one of the recent case studies that we just published, where weekly organic traffic jumped from 200,000 to 315,000 in 45 days, by simply changing a few settings and bits of code.'
		),
		emptyLine(),
		paragraph('(Results typically kick in 30-45 days after Google indexes the applied changes).'),
		emptyLine(),
		paragraph(
			`We highly believe that we can find the same problems/opportunities if not even more if we were to audit ${domain}.`
		),
		emptyLine(),
		paragraph('In case of any questions, feel free to reach out to us at any time.')
	);

	const document = new Document({
		creator: 'GoldenWeb',
		title: `Mini Technical SEO Audit - ${domain}`,
		styles: {
			default: {
				document: {
					run: {
						font: FONT,
						size: BODY_SIZE
					}
				}
			}
		},
		sections: [
			{
				properties: {
					page: {
						margin: {
							top: 1440,
							right: 1440,
							bottom: 1440,
							left: 1440
						}
					}
				},
				headers: header ? { default: header } : undefined,
				children
			}
		]
	});

	return {
		filename: documentFilename(pageData),
		body: await withDocxXmlFixes(await Packer.toBuffer(document))
	};
}
