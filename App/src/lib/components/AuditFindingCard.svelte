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
		findings: AuditFindingView[];
	};

	type LegacySection = {
		key: string;
		title: string;
		subtitle?: string;
		mini?: boolean;
	};

	let {
		section,
		item
	}: {
		section: LegacySection;
		item?: AuditItemView;
	} = $props();
	const previewLimit = 5;
	let selectedStatus = $state<AuditFindingStatusFilter | null>(null);
	let showPassedFindings = $state(false);
	let showAllWarnFindings = $state(false);
	let showAllFailFindings = $state(false);
	let showAllInfoFindings = $state(false);

	function statPills(item?: AuditItemView) {
		const findings = item?.findings || [];
		return {
			pass: findings.filter((finding) => finding.status === 'pass').length,
			warn: findings.filter((finding) => finding.status === 'warn').length,
			fail: findings.filter((finding) => finding.status === 'fail').length
		};
	}

	type RenderRow = {
		key: string;
		status: AuditFindingStatus;
		title: string;
		detail?: string;
		href?: string;
		codeSnippet?: string;
		sectionHeader?: boolean;
		indented?: boolean;
	};

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
				rows.push({
					key: `${prefix}-group-${groupKey}`,
					status: firstFinding.status || 'info',
					title: firstFinding.detail,
					sectionHeader: true
				});

				for (const finding of group) {
					const duplicateValue = duplicateValueFor(finding);
					rows.push({
						key: `${prefix}-${finding.id}`,
						status: finding.status || 'info',
						title: finding.title || finding.page_url || 'Page',
						detail: duplicateValue || undefined,
						href: displayHref(finding),
						codeSnippet:
							typeof finding.meta?.codeSnippet === 'string' ? finding.meta.codeSnippet : undefined,
						indented: true
					});
				}
			} else {
				const finding = group[0];
				if (!finding) continue;
				rows.push({
					key: `${prefix}-${finding.id}`,
					status: finding.status || 'info',
					title: finding.title || finding.status || 'Finding',
					detail: finding.detail,
					href: displayHref(finding),
					codeSnippet:
						typeof finding.meta?.codeSnippet === 'string' ? finding.meta.codeSnippet : undefined
				});
			}
		}

		return rows;
	}

	const pills = $derived(statPills(item));
	const visiblePillStatuses = $derived.by(() => {
		const statuses: AuditFindingStatusFilter[] = [];
		if (pills.pass > 0) statuses.push('pass');
		if (pills.warn > 0) statuses.push('warn');
		if (pills.fail > 0) statuses.push('fail');
		return statuses.length ? statuses : (['pass', 'warn'] as AuditFindingStatusFilter[]);
	});
	const targetStatusForFilter: Record<AuditFindingStatusFilter, AuditFindingStatus> = {
		pass: 'pass',
		warn: 'warn',
		fail: 'fail'
	};
	const findingsByStatus = $derived.by(() => {
		const findings = item?.findings || [];
		const targetStatus = selectedStatus ? targetStatusForFilter[selectedStatus] : null;
		const sourceFindings = targetStatus
			? findings.filter((finding) => finding.status === targetStatus)
			: findings;

		return {
			fail: sourceFindings.filter((finding) => finding.status === 'fail'),
			warn: sourceFindings.filter((finding) => finding.status === 'warn'),
			info: sourceFindings.filter((finding) => !finding.status || finding.status === 'info'),
			pass: sourceFindings.filter((finding) => finding.status === 'pass')
		};
	});
	const visibleFailFindings = $derived.by(() => {
		if (selectedStatus === 'fail' || showAllFailFindings) {
			return findingsByStatus.fail;
		}

		return findingsByStatus.fail.slice(0, previewLimit);
	});
	const isFailSectionExpandable = $derived.by(() => findingsByStatus.fail.length > previewLimit);
	const hiddenFailCount = $derived.by(() =>
		Math.max(findingsByStatus.fail.length - visibleFailFindings.length, 0)
	);
	const failRows = $derived(groupedRows('fail', visibleFailFindings));
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
	const warnRows = $derived(groupedRows('warn', visibleWarnFindings));
	const visibleInfoFindings = $derived.by(() => {
		if (showAllInfoFindings) {
			return findingsByStatus.info;
		}

		return findingsByStatus.info.slice(0, previewLimit);
	});
	const isInfoSectionExpandable = $derived.by(() => findingsByStatus.info.length > previewLimit);
	const hiddenInfoCount = $derived.by(() =>
		Math.max(findingsByStatus.info.length - visibleInfoFindings.length, 0)
	);
	const infoRows = $derived(groupedRows('info', visibleInfoFindings));
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
	const passRows = $derived(groupedRows('pass', visiblePassFindings));
	const hasVisibleFindings = $derived.by(
		() =>
			findingsByStatus.fail.length > 0 ||
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
	const showEmptyRow = $derived(Boolean(!item));
</script>

<div class="card audit-finding-card" id={`card-${section.key}`}>
	<h3>{section.title}</h3>
	{#if section.mini}
		<AuditStatusPills
			pass={pills.pass}
			warn={pills.warn}
			fail={pills.fail}
			statuses={visiblePillStatuses}
			bind:selectedStatus
		/>
	{/if}
	<ul class={`check-list ${section.mini ? 'mini-list' : ''}`}>
		{#if hasVisibleFindings}
			{#each failRows as row (row.key)}
				<AuditFindingRow
					status={row.status}
					title={row.title}
					detail={row.detail}
					href={row.href}
					codeSnippet={row.codeSnippet}
					sectionHeader={row.sectionHeader}
					indented={row.indented}
				/>
			{/each}
			{#if isFailSectionExpandable}
				<li class="group-toggle-item">
					<button
						type="button"
						class="group-toggle group-toggle-fail"
						onclick={() => {
							showAllFailFindings = !showAllFailFindings;
						}}
					>
						{showAllFailFindings ? 'Show less' : `${hiddenFailCount} more fails`}
					</button>
				</li>
			{/if}
			{#each warnRows as row (row.key)}
				<AuditFindingRow
					status={row.status}
					title={row.title}
					detail={row.detail}
					href={row.href}
					codeSnippet={row.codeSnippet}
					sectionHeader={row.sectionHeader}
					indented={row.indented}
				/>
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
			{#each infoRows as row (row.key)}
				<AuditFindingRow
					status={row.status}
					title={row.title}
					detail={row.detail}
					href={row.href}
					codeSnippet={row.codeSnippet}
					sectionHeader={row.sectionHeader}
					indented={row.indented}
				/>
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
			{#each passRows as row (row.key)}
				<AuditFindingRow
					status={row.status}
					title={row.title}
					detail={row.detail}
					href={row.href}
					codeSnippet={row.codeSnippet}
					sectionHeader={row.sectionHeader}
					indented={row.indented}
				/>
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
		{:else if showEmptyRow}
			<AuditFindingRow status="info" title="No persisted result for this check." />
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
</div>

<style>
	.audit-finding-card {
		width: 100%;
		max-width: 800px;
		padding: 1.5rem;
		border-radius: 1rem;
	}

	.audit-finding-card h3 {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin: 0 0 1rem;
		padding-bottom: 0.5rem;
		border-bottom: 1px solid var(--border);
		font-size: 1.25rem;
		font-weight: 600;
	}

	.check-list {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding: 0;
		margin: 0;
		list-style: none;
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

	.group-toggle-fail {
		color: var(--status-fail);
	}

	.group-toggle-info {
		color: var(--status-info);
	}
</style>
