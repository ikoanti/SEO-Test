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
	let selectedStatus = $state<AuditFindingStatusFilter | null>(null);
	let showPassedFindings = $state(false);

	const getRecord = (value: unknown): Record<string, unknown> =>
		value && typeof value === 'object' && !Array.isArray(value)
			? (value as Record<string, unknown>)
			: {};

	function statsText(item?: AuditItemView) {
		const metaStats = item?.findings?.find((finding) => finding.meta)?.meta;
		const stats = getRecord(metaStats).stats;
		return typeof stats === 'string' ? stats : item?.summary || '';
	}

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
	const visibleFindings = $derived.by(() => {
		const findings = item?.findings || [];
		if (!findings.length) {
			return [];
		}

		const targetStatus = selectedStatus ? targetStatusForFilter[selectedStatus] : null;
		const sourceFindings = targetStatus
			? findings.filter((finding) => finding.status === targetStatus)
			: findings;

		const failFindings = sourceFindings.filter((finding) => finding.status === 'fail');
		const warnFindings = sourceFindings.filter((finding) => finding.status === 'warn');
		const infoFindings = sourceFindings.filter(
			(finding) => !finding.status || finding.status === 'info'
		);
		const passFindings = sourceFindings.filter((finding) => finding.status === 'pass');
		const shouldShowPasses =
			selectedStatus === 'pass' || showPassedFindings || passFindings.length <= 1;

		return [
			...failFindings,
			...warnFindings,
			...infoFindings,
			...(shouldShowPasses ? passFindings : [])
		];
	});
	const hiddenPassCount = $derived.by(() => {
		if (!item?.findings?.length || selectedStatus === 'pass' || showPassedFindings) {
			return 0;
		}

		const passCount = item.findings.filter((finding) => finding.status === 'pass').length;
		return passCount > 1 ? passCount : 0;
	});
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
		{#if visibleFindings.length}
			{#each visibleFindings as finding, index (`${item?.id || section.key}-${index}`)}
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
			{#if hiddenPassCount > 0}
				<AuditFindingRow
					status="pass"
					title={`${hiddenPassCount} passed`}
					clickable={true}
					expanded={showPassedFindings}
					onactivate={() => {
						showPassedFindings = !showPassedFindings;
					}}
				/>
			{/if}
		{:else if summaryItem}
			<AuditFindingRow
				status={summaryItem.status || 'info'}
				title={summaryItem.summary || 'No findings.'}
			/>
			{#if hiddenPassCount > 0}
				<AuditFindingRow
					status="pass"
					title={`${hiddenPassCount} passed`}
					clickable={true}
					expanded={showPassedFindings}
					onactivate={() => {
						showPassedFindings = !showPassedFindings;
					}}
				/>
			{/if}
		{:else if showEmptyRow}
			<AuditFindingRow status="info" title="No persisted result for this check." />
		{:else if hiddenPassCount > 0}
			<AuditFindingRow
				status="pass"
				title={`${hiddenPassCount} passed`}
				clickable={true}
				expanded={showPassedFindings}
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
