<script lang="ts">
	import { formattedParts } from '../helpers';

	let { value }: { value?: unknown } = $props();
	let parts = $derived(formattedParts(value));
</script>

{#each parts as part}
	{#if part.isUrl}
		<span class="url-value">{part.text}</span>
	{:else}
		{part.text}
	{/if}
{/each}

<style>
	.url-value {
		color: #1a73e8;
		font-weight: 500;
	}
</style>
