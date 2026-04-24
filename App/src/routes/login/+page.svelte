<script lang="ts">
	let { data, form } = $props();
</script>

<div class="auth-card">
	<p class="eyebrow">Authentication</p>
	<h1>Login</h1>
	<p class="muted">Use your PocketBase auth collection credentials to access the audits area.</p>

	<form method="POST" class="stack">
		<input type="hidden" name="redirectTo" value={form?.redirectTo ?? data.redirectTo} />
		<label>
			<span>Email</span>
			<input name="email" type="email" value={form?.email ?? ''} required />
		</label>
		<label>
			<span>Password</span>
			<input name="password" type="password" required />
		</label>
		{#if form?.error}
			<p class="error">{form.error}</p>
		{/if}
		<button type="submit">Sign in</button>
	</form>
</div>
