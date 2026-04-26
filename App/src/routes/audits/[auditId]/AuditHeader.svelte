<script lang="ts">
	import { resolve } from '$app/paths';
	import { ArrowLeft, RotateCcw } from 'lucide-svelte';

	let {
		title,
		isPending = false
	}: {
		title?: string;
		isPending?: boolean;
	} = $props();
</script>

<section class="page-head audit-page-head">
	<div class="page-head-main">
		<a class="back-link icon-link" href={resolve('/audits')}>
			<ArrowLeft size={16} />
			<span>Back to audits</span>
		</a>
		<div>
			<h1>{title}</h1>
		</div>
	</div>
	<div class="page-head-actions">
		<form method="POST" action="?/restart">
			<button type="submit" class="icon-button restart-button" disabled={isPending}>
				<RotateCcw size={16} />
				<span>Restart audit</span>
			</button>
		</form>
	</div>
</section>

<style>
	.audit-page-head h1 {
		font-size: clamp(1.4rem, 2.4vw, 2rem);
	}

	.page-head-main {
		display: flex;
		align-items: flex-start;
		gap: 1rem;
	}

	.back-link {
		padding: 10px 14px;
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 9999px;
		background: var(--surface-soft);
		transition:
			border-color 0.2s ease,
			background-color 0.2s ease;
	}

	.back-link:hover {
		border-color: var(--border);
		background: rgba(15, 23, 42, 0.9);
	}

	.page-head-actions {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 0.75rem;
		flex-wrap: wrap;
	}

	.restart-button:disabled {
		cursor: not-allowed;
		opacity: 0.65;
	}

	@media (max-width: 760px) {
		.page-head-main {
			flex-direction: column;
			gap: 0.75rem;
		}

		.page-head-actions {
			justify-content: flex-start;
		}
	}
</style>
