<script lang="ts">
	import type { AuditFindingStatus, AuditFindingStatusFilter } from '$lib/audit-status';
	import AuditFindingRow from '$lib/components/AuditFindingRow.svelte';
	import AuditStatusPills from '$lib/components/AuditStatusPills.svelte';

	type AuditFindingView = {
		id: string;
		status?: AuditFindingStatus;
		title?: string;
		detail?: string;
		page_url?: string;
		meta?: Record<string, unknown> | null;
	};

	type AuditItemView = {
		id: string;
		key: string;
		label: string;
		status?: AuditFindingStatus;
		runStatus?: string;
		summary?: string;
		stats?: unknown;
		screenshot?: {
			id?: string;
			title?: string;
			page_url?: string;
			image_url?: string;
		} | null;
		findings: AuditFindingView[];
	};

	let {
		item
	}: {
		item: AuditItemView;
	} = $props();
	const previewLimit = 5;
	let selectedStatus = $state<AuditFindingStatusFilter | null>(null);
	let showPassedFindings = $state(false);
	let showAllWarnFindings = $state(false);
	let showAllInfoFindings = $state(false);

	function statPills(item?: AuditItemView) {
		const findings = item?.findings || [];
		return {
			pass: findings.filter((finding) => finding.status === 'pass').length,
			warn: findings.filter((finding) => finding.status === 'warn').length,
			info: findings.filter((finding) => !finding.status || finding.status === 'info').length
		};
	}

	type RenderRow = {
		key: string;
		status: AuditFindingStatus;
		title: string;
		detail?: string;
		href?: string;
		urlList?: string[];
		codeSnippet?: string;
		sectionHeader?: boolean;
		indented?: boolean;
	};
	type RenderGroup = {
		key: string;
		title?: string;
		rows: RenderRow[];
	};

	function normalizedText(value?: string) {
		return String(value || '')
			.trim()
			.replace(/\s+/g, ' ')
			.toLowerCase();
	}

	function isUrlLike(value?: string) {
		if (!value) return false;
		try {
			new URL(value);
			return true;
		} catch {
			return false;
		}
	}

	function displayHref(finding: AuditFindingView) {
		const metaPageUrl = typeof finding.meta?.page_url === 'string' ? finding.meta.page_url : '';
		if (isUrlLike(metaPageUrl)) return metaPageUrl;
		if (finding.page_url) return finding.page_url;
		if (isUrlLike(finding.title)) return finding.title;
		return undefined;
	}

	function duplicateValueFor(finding: AuditFindingView) {
		const metaRecord = finding.meta && typeof finding.meta === 'object' ? finding.meta : null;
		const nestedMeta =
			metaRecord?.meta && typeof metaRecord.meta === 'object'
				? (metaRecord.meta as Record<string, unknown>)
				: null;
		const direct = metaRecord?.duplicateValue;
		const nested = nestedMeta?.duplicateValue;
		if (typeof direct === 'string' && direct.trim()) return direct;
		if (typeof nested === 'string' && nested.trim()) return nested;
		return '';
	}

	function displayFindingDetail(finding: AuditFindingView) {
		const title = normalizedText(finding.title);
		const detail = String(finding.detail || '').trim();
		return normalizedText(detail) === title ? '' : detail;
	}

	function groupedRows(prefix: string, findings: AuditFindingView[]) {
		const rows: RenderRow[] = [];
		const groups: Record<string, AuditFindingView[]> = {};
		const order: string[] = [];

		for (const finding of findings) {
			const duplicateValue = duplicateValueFor(finding);
			const isDuplicateMetaGroup =
				Boolean(duplicateValue) &&
				Boolean(finding.detail?.match(/^Duplicate meta (title|description) detected$/));

			if (!isDuplicateMetaGroup) {
				const standaloneKey = `finding:${finding.id}`;
				groups[standaloneKey] = [finding];
				order.push(standaloneKey);
				continue;
			}

			const groupKey = `${finding.detail}::${duplicateValue}`;
			if (!groups[groupKey]) {
				groups[groupKey] = [];
				order.push(groupKey);
			}
			groups[groupKey].push(finding);
		}

		for (const groupKey of order) {
			const group = groups[groupKey] || [];
			const firstFinding = group[0];
			const duplicateValue = firstFinding ? duplicateValueFor(firstFinding) : '';
			const isDuplicateMetaGroup =
				Boolean(duplicateValue) &&
				Boolean(firstFinding?.detail?.match(/^Duplicate meta (title|description) detected$/));

			if (isDuplicateMetaGroup && group.length > 0 && firstFinding?.detail) {
				const urls = group
					.map((finding) => displayHref(finding))
					.filter((value): value is string => Boolean(value));
				rows.push({
					key: `${prefix}-group-${groupKey}`,
					status: firstFinding.status || 'info',
					title: firstFinding.detail,
					urlList: urls
				});
			} else {
				const finding = group[0];
				if (!finding) continue;
				rows.push({
					key: `${prefix}-${finding.id}`,
					status: finding.status || 'info',
					title: finding.title || finding.status || 'Finding',
					detail: displayFindingDetail(finding),
					href: displayHref(finding),
					codeSnippet:
						typeof finding.meta?.codeSnippet === 'string' ? finding.meta.codeSnippet : undefined
				});
			}
		}

		return rows;
	}

	function issueGroupTitle(finding: AuditFindingView) {
		return finding.detail || finding.title || finding.status || 'Findings';
	}

	function groupedIssueSections(
		prefix: string,
		findings: AuditFindingView[],
		cardTitle: string
	): RenderGroup[] {
		const groupedFindings: Record<string, AuditFindingView[]> = {};
		const order: string[] = [];

		for (const finding of findings) {
			const title = issueGroupTitle(finding);
			if (!groupedFindings[title]) {
				groupedFindings[title] = [];
				order.push(title);
			}
			groupedFindings[title].push(finding);
		}

		return order
			.map((title) => {
				const rows = groupedRows(`${prefix}-${title}`, groupedFindings[title] || []);
				const displayRows = rows.filter(
					(row) =>
						!(
							normalizedText(row.title) === normalizedText(cardTitle) &&
							!row.detail &&
							!row.href &&
							!row.urlList?.length &&
							!row.codeSnippet
						)
				);
				const titleMatchesCard = normalizedText(title) === normalizedText(cardTitle);
				const singleRowRepeatsTitle =
					displayRows.length === 1 &&
					normalizedText(displayRows[0]?.title) === normalizedText(title) &&
					!displayRows[0]?.urlList?.length;
				return {
					key: `${prefix}-${title}`,
					title: titleMatchesCard || singleRowRepeatsTitle ? undefined : title,
					rows: displayRows
				};
			})
			.filter((group) => group.rows.length > 0);
	}

	const pills = $derived(statPills(item));
	const visiblePillStatuses = $derived.by(() => {
		const statuses: AuditFindingStatusFilter[] = [];
		if (pills.pass > 0) statuses.push('pass');
		if (pills.warn > 0) statuses.push('warn');
		if (pills.info > 0) statuses.push('info');
		return statuses.length ? statuses : (['pass', 'warn', 'info'] as AuditFindingStatusFilter[]);
	});
	const targetStatusForFilter: Record<AuditFindingStatusFilter, AuditFindingStatus> = {
		pass: 'pass',
		warn: 'warn',
		info: 'info'
	};
	const findingsByStatus = $derived.by(() => {
		const findings = item?.findings || [];
		const targetStatus = selectedStatus ? targetStatusForFilter[selectedStatus] : null;
		const sourceFindings = targetStatus
			? findings.filter((finding) => finding.status === targetStatus)
			: findings;

		return {
			warn: sourceFindings.filter((finding) => finding.status === 'warn'),
			info: sourceFindings.filter((finding) => !finding.status || finding.status === 'info'),
			pass: sourceFindings.filter((finding) => finding.status === 'pass')
		};
	});
	const visibleWarnFindings = $derived.by(() => {
		if (selectedStatus === 'warn' || showAllWarnFindings) {
			return findingsByStatus.warn;
		}

		return findingsByStatus.warn.slice(0, previewLimit);
	});
	const isWarnSectionExpandable = $derived.by(() => findingsByStatus.warn.length > previewLimit);
	const hiddenWarnCount = $derived.by(() =>
		Math.max(findingsByStatus.warn.length - visibleWarnFindings.length, 0)
	);
	const warnGroups = $derived(groupedIssueSections('warn', visibleWarnFindings, item.label));
	const visibleInfoFindings = $derived.by(() => {
		if (selectedStatus === 'info' || showAllInfoFindings) {
			return findingsByStatus.info;
		}

		return findingsByStatus.info.slice(0, previewLimit);
	});
	const isInfoSectionExpandable = $derived.by(() => findingsByStatus.info.length > previewLimit);
	const hiddenInfoCount = $derived.by(() =>
		Math.max(findingsByStatus.info.length - visibleInfoFindings.length, 0)
	);
	const infoGroups = $derived(groupedIssueSections('info', visibleInfoFindings, item.label));
	const visiblePassFindings = $derived.by(() => {
		if (selectedStatus === 'pass' || showPassedFindings) {
			return findingsByStatus.pass;
		}

		return findingsByStatus.pass.slice(0, previewLimit);
	});
	const isPassSectionExpandable = $derived.by(() => findingsByStatus.pass.length > previewLimit);
	const hiddenPassCount = $derived.by(() =>
		Math.max(findingsByStatus.pass.length - visiblePassFindings.length, 0)
	);
	const passGroups = $derived(groupedIssueSections('pass', visiblePassFindings, item.label));
	const hasVisibleFindings = $derived.by(
		() =>
			findingsByStatus.warn.length > 0 ||
			findingsByStatus.info.length > 0 ||
			findingsByStatus.pass.length > 0
	);
	const showSummaryRow = $derived(
		Boolean(
			item &&
			!item.findings?.length &&
			(!selectedStatus || item.status === targetStatusForFilter[selectedStatus])
		)
	);
	const summaryItem = $derived(showSummaryRow ? item : undefined);
	const cardScreenshot = $derived.by(() => {
		if (item?.screenshot?.image_url) {
			return {
				src: item.screenshot.image_url,
				alt: item.screenshot.title || `${item.label} evidence screenshot`
			};
		}

		return null;
	});
</script>

<section class="audit-finding-section" id={`section-${item.key}`}>
	<div class="audit-finding-section-heading">
		<div class="audit-finding-title-row">
			<h2>{item.label}</h2>
			{#if item?.runStatus}
				<span class={`audit-run-status audit-run-status-${item.runStatus}`}>{item.runStatus}</span>
			{/if}
		</div>
		{#if cardScreenshot}
			<figure class="audit-evidence">
				<img src={cardScreenshot.src} alt={cardScreenshot.alt} loading="lazy" />
			</figure>
		{/if}
	</div>
	<AuditStatusPills
		pass={pills.pass}
		warn={pills.warn}
		info={pills.info}
		statuses={visiblePillStatuses}
		bind:selectedStatus
	/>
	<ul class="check-list">
		{#if hasVisibleFindings}
			{#each warnGroups as group (group.key)}
				{#if group.title}
					<li class="issue-group-heading issue-group-heading-warn">{group.title}</li>
				{/if}
				{#each group.rows as row (row.key)}
					<AuditFindingRow
						status={row.status}
						title={row.title}
						detail={row.detail}
						href={row.href}
						urlList={row.urlList}
						codeSnippet={row.codeSnippet}
						sectionHeader={row.sectionHeader}
						indented={row.indented}
					/>
				{/each}
			{/each}
			{#if isWarnSectionExpandable}
				<li class="group-toggle-item">
					<button
						type="button"
						class="group-toggle group-toggle-warn"
						onclick={() => {
							showAllWarnFindings = !showAllWarnFindings;
						}}
					>
						{showAllWarnFindings ? 'Show less' : `${hiddenWarnCount} more issues`}
					</button>
				</li>
			{/if}
			{#each infoGroups as group (group.key)}
				{#if group.title}
					<li class="issue-group-heading issue-group-heading-info">{group.title}</li>
				{/if}
				{#each group.rows as row (row.key)}
					<AuditFindingRow
						status={row.status}
						title={row.title}
						detail={row.detail}
						href={row.href}
						urlList={row.urlList}
						codeSnippet={row.codeSnippet}
						sectionHeader={row.sectionHeader}
						indented={row.indented}
					/>
				{/each}
			{/each}
			{#if isInfoSectionExpandable}
				<li class="group-toggle-item">
					<button
						type="button"
						class="group-toggle group-toggle-info"
						onclick={() => {
							showAllInfoFindings = !showAllInfoFindings;
						}}
					>
						{showAllInfoFindings ? 'Show less' : `${hiddenInfoCount} more items`}
					</button>
				</li>
			{/if}
			{#each passGroups as group (group.key)}
				{#if group.title}
					<li class="issue-group-heading issue-group-heading-pass">{group.title}</li>
				{/if}
				{#each group.rows as row (row.key)}
					<AuditFindingRow
						status={row.status}
						title={row.title}
						detail={row.detail}
						href={row.href}
						urlList={row.urlList}
						codeSnippet={row.codeSnippet}
						sectionHeader={row.sectionHeader}
						indented={row.indented}
					/>
				{/each}
			{/each}
			{#if isPassSectionExpandable}
				<li class="group-toggle-item">
					<button
						type="button"
						class="group-toggle group-toggle-pass"
						onclick={() => {
							showPassedFindings = !showPassedFindings;
						}}
					>
						{showPassedFindings ? 'Show less' : `${hiddenPassCount} more passes`}
					</button>
				</li>
			{/if}
		{:else if summaryItem}
			<AuditFindingRow
				status={summaryItem.status || 'info'}
				title={summaryItem.summary || 'No findings.'}
			/>
		{:else if isPassSectionExpandable}
			<li class="group-toggle-item">
				<button
					type="button"
					class="group-toggle group-toggle-pass"
					onclick={() => {
						showPassedFindings = !showPassedFindings;
					}}
				>
					{showPassedFindings ? 'Show less' : `${hiddenPassCount} more passes`}
				</button>
			</li>
		{/if}
	</ul>
</section>

<style>
	.audit-finding-section {
		width: 100%;
		padding: 1.5rem 0;
		border-top: 1px solid var(--border);
	}

	.audit-finding-section:first-child {
		border-top: 0;
		padding-top: 0;
	}

	.audit-finding-section-heading {
		display: grid;
		gap: 1rem;
		margin: 0 0 1rem;
	}

	.audit-finding-title-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
	}

	.audit-finding-section h2 {
		margin: 0;
		font-size: 1.35rem;
		font-weight: 800;
	}

	.audit-run-status {
		flex: 0 0 auto;
		border: 1px solid var(--border);
		border-radius: 999px;
		padding: 0.35rem 0.65rem;
		color: var(--text-muted);
		font-size: 0.75rem;
		font-weight: 800;
		text-transform: uppercase;
	}

	.check-list {
		display: flex;
		flex-direction: column;
		gap: 0.65rem;
		padding: 0;
		margin: 0;
		list-style: none;
	}

	.issue-group-heading {
		margin: 0.4rem 0 0;
		padding: 0.35rem 0 0.15rem;
		color: var(--text-main);
		font-size: 0.95rem;
		font-weight: 800;
		list-style: none;
	}

	.issue-group-heading:first-child {
		margin-top: 0;
	}

	.issue-group-heading-pass {
		color: var(--status-pass);
	}

	.issue-group-heading-warn {
		color: var(--status-warn);
	}

	.issue-group-heading-info {
		color: var(--status-info);
	}

	.audit-evidence {
		margin: 0;
		overflow: hidden;
		border: 1px solid var(--border);
		border-radius: 0.5rem;
		background: rgba(15, 23, 42, 0.72);
	}

	.audit-evidence img {
		display: block;
		width: 100%;
		height: auto;
	}

	.group-toggle-item {
		padding: 0;
		margin: -0.1rem 0 0.15rem;
		list-style: none;
	}

	.group-toggle {
		padding: 0;
		border: 0;
		background: transparent;
		font: inherit;
		font-size: 0.9rem;
		font-weight: 600;
		text-align: left;
		cursor: pointer;
	}

	.group-toggle-pass {
		color: var(--status-pass);
	}

	.group-toggle-warn {
		color: var(--status-warn);
	}

	.group-toggle-info {
		color: var(--status-info);
	}

	@media (max-width: 640px) {
		.audit-finding-title-row {
			align-items: flex-start;
			flex-direction: column;
		}
	}
</style>
