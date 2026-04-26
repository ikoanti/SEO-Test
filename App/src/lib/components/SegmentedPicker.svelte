<script lang="ts">
	type SegmentedOption = {
		key: string;
		label: string;
	};

	let {
		options,
		selected = $bindable(),
		ariaLabel = 'Options'
	}: {
		options: SegmentedOption[];
		selected: string;
		ariaLabel?: string;
	} = $props();
</script>

<div class="segmented-picker" role="tablist" aria-label={ariaLabel}>
	{#each options as option (option.key)}
		<button
			type="button"
			role="tab"
			class="segmented-button"
			class:active={selected === option.key}
			aria-selected={selected === option.key}
			onclick={() => {
				selected = option.key;
			}}
		>
			{option.label}
		</button>
	{/each}
</div>

<style>
	.segmented-picker {
		display: flex;
		justify-content: center;
		gap: 0.5rem;
		width: min(100%, 42rem);
		margin: 1.5rem auto;
		padding: 0.4rem;
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.03);
	}

	.segmented-button {
		flex: 1;
		min-width: 0;
		padding: 0.75rem 1rem;
		border: 1px solid transparent;
		border-radius: 999px;
		background: transparent;
		color: var(--text-muted);
		font: inherit;
		font-weight: 600;
		cursor: pointer;
		transition:
			background 0.2s ease,
			border-color 0.2s ease,
			color 0.2s ease;
	}

	.segmented-button.active {
		border-color: rgba(255, 255, 255, 0.14);
		background: rgba(255, 255, 255, 0.06);
		color: var(--text-main);
	}
</style>
