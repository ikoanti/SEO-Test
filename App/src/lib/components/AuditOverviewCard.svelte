<script lang="ts">
	import { AlertTriangle, CheckCircle2, Info } from 'lucide-svelte';

	let {
		passed = 0,
		warnings = 0,
		info = 0,
		barStyle = ''
	}: {
		passed?: number;
		warnings?: number;
		info?: number;
		barStyle?: string;
	} = $props();
</script>

<section class="summary-bar">
	<div class="summary-item">
		<span class="summary-count pass">{passed}</span>
		<div class="summary-heading pass">
			<CheckCircle2 size={18} strokeWidth={2.25} />
			<span>Pass</span>
		</div>
	</div>
	<div class="summary-item">
		<span class="summary-count warn">{warnings}</span>
		<div class="summary-heading warn">
			<AlertTriangle size={18} strokeWidth={2.25} />
			<span>Warnings</span>
		</div>
	</div>
	<div class="summary-item">
		<span class="summary-count info">{info}</span>
		<div class="summary-heading info">
			<Info size={18} strokeWidth={2.25} />
			<span>Info</span>
		</div>
	</div>
	<div class="summary-score-bar-wrap">
		<div class="summary-score-bar" style={barStyle}></div>
	</div>
</section>

<style>
	.summary-bar {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 1rem;
		align-items: center;
		width: 100%;
		max-width: 800px;
		margin: 0 auto 1.5rem;
		padding: 1rem;
		border: 1px solid var(--border);
		border-radius: 1rem;
		background: var(--card-bg);
	}

	.summary-item {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 0.75rem;
		border-radius: 0.75rem;
		background: rgba(0, 0, 0, 0.2);
	}

	.summary-heading {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		margin-top: 0.5rem;
		font-size: 0.9rem;
		font-weight: 600;
	}

	.summary-heading.pass {
		color: var(--status-pass);
	}

	.summary-heading.warn {
		color: var(--status-warn);
	}

	.summary-heading.info {
		color: var(--status-info);
	}

	.summary-count {
		font-size: 2rem;
		font-weight: 800;
		line-height: 1;
	}

	.summary-count.pass {
		color: var(--status-pass);
	}

	.summary-count.warn {
		color: var(--status-warn);
	}

	.summary-count.info {
		color: var(--status-info);
	}

	.summary-score-bar-wrap {
		grid-column: 1 / -1;
		height: 12px;
		background: rgba(0, 0, 0, 0.4);
		border-radius: 6px;
		overflow: hidden;
	}

	.summary-score-bar {
		width: 100%;
		height: 100%;
		transition: background 0.5s ease;
	}

	@media (max-width: 760px) {
		.summary-bar {
			grid-template-columns: 1fr;
		}
	}
</style>
