<script lang="ts">
	import { resolve } from '$app/paths';
	import AuditFindingCard from '$lib/components/AuditFindingCard.svelte';
	import PageSpeedCard from '$lib/components/PageSpeedCard.svelte';
	import type { AuditItemView, AuditNavItem } from './types';

	let {
		auditId,
		auditNavItems,
		auditFindingItems,
		activeAuditSection,
		auditSectionNavElement = $bindable(),
		onSelectSection,
		pageSpeed
	}: {
		auditId: string;
		auditNavItems: AuditNavItem[];
		auditFindingItems: AuditItemView[];
		activeAuditSection: string;
		auditSectionNavElement?: HTMLElement;
		onSelectSection: (key: string) => void;
		pageSpeed: () => Record<string, unknown>;
	} = $props();
</script>

<div class="audit-report-layout">
	<nav bind:this={auditSectionNavElement} class="audit-section-nav" aria-label="Audit findings">
		{#each auditNavItems as navItem (navItem.key)}
			<a
				href={resolve(`/audits/${auditId}${navItem.href}` as `/audits/${string}#${string}`)}
				data-section-key={navItem.key}
				class:active={activeAuditSection === navItem.key}
				onclick={() => onSelectSection(navItem.key)}
			>
				<span>{navItem.title}</span>
			</a>
		{/each}
	</nav>

	<div class="audit-report-sections">
		{#each auditFindingItems as item (item.key)}
			{#if item.key === 'pageSpeed'}
				<PageSpeedCard title={item.label} pageSpeedData={pageSpeed()} screenshot={item.screenshot} />
			{:else}
				<AuditFindingCard {item} />
			{/if}
		{/each}
	</div>
</div>

<style>
	.audit-report-layout {
		display: grid;
		grid-template-columns: minmax(180px, 220px) minmax(0, 800px) minmax(180px, 220px);
		gap: 1.25rem;
		align-items: start;
		justify-content: center;
	}

	.audit-section-nav {
		position: sticky;
		top: 1.25rem;
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		max-height: calc(100vh - 2.5rem);
		overflow-y: auto;
		overscroll-behavior: contain;
		padding: 0.25rem 0;
		font-size: 0.9rem;
		scrollbar-width: thin;
	}

	.audit-section-nav a {
		display: flex;
		align-items: center;
		width: 100%;
		min-height: 2.75rem;
		box-sizing: border-box;
		padding: 0.5rem 0.75rem;
		border-left: 2px solid transparent;
		border-radius: 0 8px 8px 0;
		color: var(--text-muted);
		line-height: 1.25;
	}

	.audit-section-nav a:hover,
	.audit-section-nav a:focus-visible {
		background: rgba(255, 255, 255, 0.05);
		color: var(--text-primary);
	}

	.audit-section-nav a:focus-visible {
		outline: 2px solid var(--goldenweb-primary);
		outline-offset: 2px;
	}

	.audit-section-nav a.active {
		border-left-color: var(--goldenweb-primary);
		color: var(--text-main);
		font-weight: 800;
	}

	.audit-report-sections {
		min-width: 0;
		grid-column: 2;
	}

	@media (max-width: 980px) {
		.audit-report-layout {
			grid-template-columns: 1fr;
			gap: 1rem;
		}

		.audit-report-sections {
			grid-column: auto;
		}

		.audit-section-nav {
			position: sticky;
			z-index: 2;
			top: 0;
			flex-direction: row;
			max-height: none;
			overflow-y: hidden;
			overflow-x: auto;
			border-bottom: 1px solid var(--border);
			background: var(--goldenweb-background);
		}

		.audit-section-nav a {
			flex: 0 0 auto;
			width: auto;
			border-left: 0;
			border-bottom: 2px solid transparent;
			padding: 0.65rem 0.75rem;
			border-radius: 8px 8px 0 0;
			white-space: nowrap;
		}

		.audit-section-nav a.active {
			border-bottom-color: var(--goldenweb-primary);
		}
	}
</style>
