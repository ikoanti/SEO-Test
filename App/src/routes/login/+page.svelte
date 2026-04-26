<script lang="ts">
	import { LogIn } from 'lucide-svelte';
	let { data } = $props();
</script>

<div class="auth-card">
	<h1 class="auth-title">GoldenWeb SEO Mini Audit Tool</h1>
	<p class="auth-byline">By Irakli Antidze</p>

	<form method="POST" action="/api/auth/login" class="stack">
		<input type="hidden" name="redirectTo" value={data.redirectTo} />
		<label>
			<span>Email</span>
			<input name="email" type="email" value={data.email} required />
		</label>
		<label>
			<span>Password</span>
			<input name="password" type="password" required />
		</label>
		{#if data.error}
			<p class="error">{data.error}</p>
		{/if}
		<button type="submit" class="icon-button">
			<LogIn size={18} />
			<span>Sign in</span>
		</button>
	</form>
</div>
