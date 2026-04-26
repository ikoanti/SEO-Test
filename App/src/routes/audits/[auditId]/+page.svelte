<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { ArrowLeft, Copy, Download, FileText, FileUp, Sparkles } from 'lucide-svelte';
	import { onMount } from 'svelte';
	import type { ActionData } from './$types';

	type AuditFindingView = {
		id: string;
		status?: string;
		title?: string;
		detail?: string;
		page_url?: string;
		meta?: unknown;
	};

	type AuditItemView = {
		id: string;
		label: string;
		status?: string;
		summary?: string;
		stats?: unknown;
		findings: AuditFindingView[];
	};

	type AuditPageViewData = {
		runRecord: {
			status?: string;
			url?: string;
			name?: string;
			error_message?: string;
			run_log?: string;
		};
		auditRecord: {
			name?: string;
			url?: string;
		} | null;
		audit: Record<string, unknown> | null;
		summary: {
			domain?: string;
			summary?: { passed?: number; warnings?: number; failed?: number };
		} | null;
		reportHtml: string;
		aiVisibility: Record<string, unknown> | null;
		normalizedItems: AuditItemView[];
	};

	let { data, form }: { data: AuditPageViewData; form?: ActionData } = $props();
	let copyState = $state('Copy');

	const pendingStatuses = new Set(['queued', 'running']);
	const runStatus = () => data.runRecord.status || 'queued';
	const isPending = () => pendingStatuses.has(runStatus());
	const isFailed = () => runStatus() === 'failed';

	onMount(() => {
		if (!pendingStatuses.has(data.runRecord.status || '')) {
			return;
		}

		const interval = window.setInterval(() => {
			void invalidateAll();
		}, 5000);

		return () => window.clearInterval(interval);
	});

	async function copyReport() {
		if (!data.reportHtml) return;

		const container = document.createElement('div');
		container.innerHTML = data.reportHtml;
		const text = container.innerText || container.textContent || '';
		await navigator.clipboard.writeText(text);
		copyState = 'Copied';
		window.setTimeout(() => {
			copyState = 'Copy';
		}, 2000);
	}

	function resolvedFilename() {
		const raw = data.runRecord.url || data.summary?.domain || 'audit';
		try {
			return new URL(raw.startsWith('http') ? raw : `https://${raw}`).hostname;
		} catch {
			return 'audit';
		}
	}

	function downloadReportHtml() {
		if (!data.reportHtml) return;

		const filename = resolvedFilename();
		const fullHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Mini SEO Audit - ${filename}</title></head><body style="background:#ffffff;color:#333333;margin:0;padding:2rem;font-family:'Segoe UI',sans-serif;">${data.reportHtml}</body></html>`;
		const blob = new Blob([fullHtml], { type: 'text/html' });
		const link = document.createElement('a');
		link.download = `Mini-SEO-Audit-${filename}.html`;
		link.href = URL.createObjectURL(blob);
		link.click();
		URL.revokeObjectURL(link.href);
	}

	function downloadReportDoc() {
		if (!data.reportHtml) return;

		const filename = resolvedFilename();
		const header =
			"<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>Mini SEO Audit</title><style>body { font-family: Arial, sans-serif; }</style></head><body>";
		const footer = '</body></html>';
		const fullHtml = header + data.reportHtml + footer;
		const blob = new Blob(['\ufeff', fullHtml], {
			type: 'application/msword'
		});
		const link = document.createElement('a');
		link.download = `Mini-SEO-Audit-${filename}.doc`;
		link.href = URL.createObjectURL(blob);
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
		URL.revokeObjectURL(link.href);
	}

	const pageTitle = () =>
		data.auditRecord?.name || data.runRecord?.name || data.auditRecord?.url || data.runRecord?.url;

	const pageUrl = () => data.auditRecord?.url || data.runRecord?.url || '';
</script>

<section class="page-head">
	<div>
		<p class="eyebrow">Audit</p>
		<h1>{pageTitle()}</h1>
		<p class="muted">{pageUrl()}</p>
		<p class="muted">Run status: {runStatus()}</p>
	</div>
	<a class="back-link icon-link" href={resolve('/audits')}>
		<ArrowLeft size={16} />
		<span>Back to audits</span>
	</a>
</section>

{#if isPending()}
	<section class="card">
		<h2>Run in progress</h2>
		<p class="muted">
			This audit is processing in the background. This page refreshes every 5 seconds and will show
			the full result when ready.
		</p>
	</section>
{:else if isFailed()}
	<section class="card">
		<h2>Run failed</h2>
		<p class="error">{data.runRecord.error_message || 'The audit run failed.'}</p>
	</section>
{:else if data.summary && data.audit}
	<section class="four grid">
		<div class="card compact">
			<span>Passed</span><strong>{data.summary.summary?.passed ?? 0}</strong>
		</div>
		<div class="card compact">
			<span>Warnings</span><strong>{data.summary.summary?.warnings ?? 0}</strong>
		</div>
		<div class="card compact">
			<span>Failed</span><strong>{data.summary.summary?.failed ?? 0}</strong>
		</div>
		<div class="card compact">
			<span>Domain</span><strong>{data.summary.domain ?? data.audit.domain}</strong>
		</div>
	</section>

	<section class="card">
		<h2>Top metrics</h2>
		<pre>{JSON.stringify(data.summary, null, 2)}</pre>
	</section>

	<section class="two grid">
		{#each data.normalizedItems || [] as item (item.id)}
			<div class="card">
				<h2>{item.label}</h2>
				<p class="muted">Status: {item.status}</p>
				<p class="muted">{item.summary}</p>
				{#if item.stats}
					<pre>{JSON.stringify(item.stats, null, 2)}</pre>
				{/if}
				{#if item.findings?.length}
					<ul class="list detail-list">
						{#each item.findings as finding, index (`${item.id}-${finding.title || finding.detail || index}`)}
							<li>
								<strong>{finding.title || finding.status}</strong>
								<span>{finding.detail}</span>
								{#if finding.page_url}
									<span class="muted">{finding.page_url}</span>
								{/if}
							</li>
						{/each}
					</ul>
				{:else}
					<p class="muted">No findings.</p>
				{/if}
			</div>
		{/each}
	</section>
{/if}

{#if data.auditRecord}
	<section class="card">
		<h2>AI report</h2>
		<form method="POST" action="?/generateReport" class="stack">
			{#if form?.reportError}
				<p class="error">{form.reportError}</p>
			{/if}
			<button type="submit" class="icon-button">
				<Sparkles size={18} />
				<span>Generate Mini SEO Audit Report</span>
			</button>
		</form>

		{#if data.reportHtml}
			<div class="report-actions">
				<button type="button" class="icon-button" onclick={copyReport}>
					<Copy size={16} />
					<span>{copyState}</span>
				</button>
				<button type="button" class="icon-button" onclick={downloadReportHtml}>
					<Download size={16} />
					<span>HTML</span>
				</button>
				<button type="button" class="icon-button" onclick={downloadReportDoc}>
					<FileText size={16} />
					<span>DOC</span>
				</button>
			</div>
			<!-- eslint-disable-next-line svelte/no-at-html-tags -->
			<div class="report-output">{@html data.reportHtml}</div>
		{:else}
			<p class="muted">No generated report yet.</p>
		{/if}
	</section>

	<section class="card">
		<h2>AI visibility PDF</h2>
		<form method="POST" action="?/parsePdf" enctype="multipart/form-data" class="stack">
			<label>
				<span>Upload PDF</span>
				<input name="pdf" type="file" accept="application/pdf" required />
			</label>
			{#if form?.pdfError}
				<p class="error">{form.pdfError}</p>
			{/if}
			<button type="submit" class="icon-button">
				<FileUp size={18} />
				<span>Parse PDF</span>
			</button>
		</form>

		{#if data.aiVisibility}
			<div class="four ai-grid grid">
				<div class="card compact">
					<span>AI Visibility</span><strong>{data.aiVisibility.aiVisibility ?? '-'}</strong>
				</div>
				<div class="card compact">
					<span>Monthly Audience</span><strong>{data.aiVisibility.monthlyAudience ?? '-'}</strong>
				</div>
				<div class="card compact">
					<span>Mentions</span><strong>{data.aiVisibility.mentions ?? '-'}</strong>
				</div>
				<div class="card compact">
					<span>Cited Pages</span><strong>{data.aiVisibility.citedPages ?? '-'}</strong>
				</div>
				<div class="card compact">
					<span>Topics</span><strong>{data.aiVisibility.performingTopics ?? '-'}</strong>
				</div>
				<div class="card compact">
					<span>Topic Opportunities</span><strong
						>{data.aiVisibility.topicOpportunities ?? '-'}</strong
					>
				</div>
				<div class="card compact">
					<span>Cited Sources</span><strong>{data.aiVisibility.citedSources ?? '-'}</strong>
				</div>
				<div class="card compact">
					<span>Source Opportunities</span><strong
						>{data.aiVisibility.sourceOpportunities ?? '-'}</strong
					>
				</div>
			</div>
			<pre>{JSON.stringify(data.aiVisibility, null, 2)}</pre>
		{:else}
			<p class="muted">No parsed PDF metrics yet.</p>
		{/if}
	</section>
{/if}

{#if data.runRecord.run_log}
	<section class="card">
		<h2>Run log</h2>
		<pre>{data.runRecord.run_log}</pre>
	</section>
{/if}
