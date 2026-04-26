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
			{#each visibleFailFindings as finding, index (`${item?.id || section.key}-fail-${index}`)}
				<AuditFindingRow
					status={finding.status || 'info'}
					title={finding.title || finding.status || 'Finding'}
					detail={finding.detail}
					href={finding.page_url}
					codeSnippet={typeof finding.meta?.codeSnippet === 'string'
						? finding.meta.codeSnippet
						: undefined}
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
			{#each visibleWarnFindings as finding, index (`${item?.id || section.key}-warn-${index}`)}
				<AuditFindingRow
					status={finding.status || 'info'}
					title={finding.title || finding.status || 'Finding'}
					detail={finding.detail}
					href={finding.page_url}
					codeSnippet={typeof finding.meta?.codeSnippet === 'string'
						? finding.meta.codeSnippet
						: undefined}
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
			{#each visibleInfoFindings as finding, index (`${item?.id || section.key}-info-${index}`)}
				<AuditFindingRow
					status={finding.status || 'info'}
					title={finding.title || finding.status || 'Finding'}
					detail={finding.detail}
					href={finding.page_url}
					codeSnippet={typeof finding.meta?.codeSnippet === 'string'
						? finding.meta.codeSnippet
						: undefined}
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
			{#each visiblePassFindings as finding, index (`${item?.id || section.key}-pass-${index}`)}
				<AuditFindingRow
					status={finding.status || 'info'}
					title={finding.title || finding.status || 'Finding'}
					detail={finding.detail}
					href={finding.page_url}
					codeSnippet={typeof finding.meta?.codeSnippet === 'string'
						? finding.meta.codeSnippet
						: undefined}
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
