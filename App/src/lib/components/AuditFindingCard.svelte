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
	const visibleWarnFindings = $derived.by(() => {
		if (selectedStatus === 'warn' || showAllWarnFindings) {
			return findingsByStatus.warn;
		}

		return findingsByStatus.warn.slice(0, previewLimit);
	});
	const isWarnSectionExpandable = $derived.by(() => findingsByStatus.warn.length > previewLimit);
	const visibleInfoFindings = $derived.by(() => {
		if (showAllInfoFindings) {
			return findingsByStatus.info;
		}

		return findingsByStatus.info.slice(0, previewLimit);
	});
	const isInfoSectionExpandable = $derived.by(() => findingsByStatus.info.length > previewLimit);
	const visiblePassFindings = $derived.by(() => {
		if (selectedStatus === 'pass' || showPassedFindings || findingsByStatus.pass.length <= 1) {
			return findingsByStatus.pass;
		}

		return [];
	});
	const showPassSectionHeader = $derived.by(() => findingsByStatus.pass.length > 1);
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
		<AuditStatusPills pass={pills.pass} warn={pills.warn} fail={pills.fail} bind:selectedStatus />
	{/if}
	<ul class={`check-list ${section.mini ? 'mini-list' : ''}`}>
		{#if hasVisibleFindings}
			{#if findingsByStatus.fail.length > 0}
				<AuditFindingRow
					status="fail"
					title={`${findingsByStatus.fail.length} ${findingsByStatus.fail.length === 1 ? 'fail' : 'fails'}`}
					clickable={isFailSectionExpandable}
					expanded={showAllFailFindings}
					sectionHeader={true}
					onactivate={isFailSectionExpandable
						? () => {
								showAllFailFindings = !showAllFailFindings;
							}
						: undefined}
				/>
			{/if}
			{#each visibleFailFindings as finding, index (`${item?.id || section.key}-fail-${index}`)}
				<AuditFindingRow
					status={finding.status || 'info'}
					title={finding.title || finding.status || 'Finding'}
					detail={finding.detail}
					href={finding.page_url}
					indented={true}
					codeSnippet={typeof finding.meta?.codeSnippet === 'string'
						? finding.meta.codeSnippet
						: undefined}
				/>
			{/each}
			{#if findingsByStatus.warn.length > 0}
				<AuditFindingRow
					status="warn"
					title={`${findingsByStatus.warn.length} ${findingsByStatus.warn.length === 1 ? 'issue' : 'issues'}`}
					clickable={isWarnSectionExpandable}
					expanded={showAllWarnFindings}
					sectionHeader={true}
					onactivate={isWarnSectionExpandable
						? () => {
								showAllWarnFindings = !showAllWarnFindings;
							}
						: undefined}
				/>
			{/if}
			{#each visibleWarnFindings as finding, index (`${item?.id || section.key}-warn-${index}`)}
				<AuditFindingRow
					status={finding.status || 'info'}
					title={finding.title || finding.status || 'Finding'}
					detail={finding.detail}
					href={finding.page_url}
					indented={true}
					codeSnippet={typeof finding.meta?.codeSnippet === 'string'
						? finding.meta.codeSnippet
						: undefined}
				/>
			{/each}
			{#if findingsByStatus.info.length > 0}
				<AuditFindingRow
					status="info"
					title={`${findingsByStatus.info.length} ${findingsByStatus.info.length === 1 ? 'item' : 'items'}`}
					clickable={isInfoSectionExpandable}
					expanded={showAllInfoFindings}
					sectionHeader={true}
					onactivate={isInfoSectionExpandable
						? () => {
								showAllInfoFindings = !showAllInfoFindings;
							}
						: undefined}
				/>
			{/if}
			{#each visibleInfoFindings as finding, index (`${item?.id || section.key}-info-${index}`)}
				<AuditFindingRow
					status={finding.status || 'info'}
					title={finding.title || finding.status || 'Finding'}
					detail={finding.detail}
					href={finding.page_url}
					indented={true}
					codeSnippet={typeof finding.meta?.codeSnippet === 'string'
						? finding.meta.codeSnippet
						: undefined}
				/>
			{/each}
			{#if showPassSectionHeader}
				<AuditFindingRow
					status="pass"
					title={`${findingsByStatus.pass.length} passed`}
					clickable={true}
					expanded={showPassedFindings}
					sectionHeader={true}
					onactivate={() => {
						showPassedFindings = !showPassedFindings;
					}}
				/>
			{/if}
			{#each visiblePassFindings as finding, index (`${item?.id || section.key}-pass-${index}`)}
				<AuditFindingRow
					status={finding.status || 'info'}
					title={finding.title || finding.status || 'Finding'}
					detail={finding.detail}
					href={finding.page_url}
					indented={showPassSectionHeader}
					codeSnippet={typeof finding.meta?.codeSnippet === 'string'
						? finding.meta.codeSnippet
						: undefined}
				/>
			{/each}
		{:else if summaryItem}
			<AuditFindingRow
				status={summaryItem.status || 'info'}
				title={summaryItem.summary || 'No findings.'}
			/>
		{:else if showEmptyRow}
			<AuditFindingRow status="info" title="No persisted result for this check." />
		{:else if showPassSectionHeader}
			<AuditFindingRow
				status="pass"
				title={`${findingsByStatus.pass.length} passed`}
				clickable={true}
				expanded={showPassedFindings}
				sectionHeader={true}
				onactivate={() => {
					showPassedFindings = !showPassedFindings;
				}}
			/>
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
</style>
