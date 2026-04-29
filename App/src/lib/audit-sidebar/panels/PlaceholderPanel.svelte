<script lang="ts">
	import type { BasePanelData } from '../types';

	let { panel }: { panel?: BasePanelData } = $props();
</script>

<section class="section">
	<h1 class="title">{panel?.title ?? 'Coming Soon'}</h1>
	<p class="copy">{panel?.description ?? 'This panel has not been designed yet.'}</p>
</section>

<style>
	@import './panel-shared.css';

	.title {
		color: #202124;
	}
</style>
