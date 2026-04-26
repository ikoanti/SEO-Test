<script lang="ts">
	import AppHeader from '$lib/components/AppHeader.svelte';
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';

	let { children, data } = $props();
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<div class="shell">
	<AppHeader user={data.user} />

	<main>
		{@render children()}
	</main>
</div>

<style>
	.shell {
		max-width: 1200px;
		margin: 0 auto;
		padding: 24px;
		position: relative;
	}

	main {
		padding-top: 0;
	}
</style>
