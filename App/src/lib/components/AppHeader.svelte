<script lang="ts">
	import { resolve } from '$app/paths';
	import type { AppUser } from '$lib/server/pocketbase';
	import logo from '$lib/assets/logo.png';
	import { ChevronDown, LogOut, Menu, UserRound } from 'lucide-svelte';

	let { user }: { user?: AppUser | null } = $props();

	let profileMenuOpen = $state(false);
	let profileMenuElement = $state<HTMLDivElement | null>(null);

	const toggleProfileMenu = () => {
		profileMenuOpen = !profileMenuOpen;
	};

	const closeProfileMenu = () => {
		profileMenuOpen = false;
	};

	const handleDocumentClick = ({ target }: MouseEvent) => {
		if (!profileMenuOpen || !profileMenuElement) return;
		if (target instanceof Node && profileMenuElement.contains(target)) return;
		closeProfileMenu();
	};

	const handleDocumentKeydown = ({ key }: KeyboardEvent) => {
		if (key === 'Escape') {
			closeProfileMenu();
		}
	};
</script>

<svelte:document onclick={handleDocumentClick} onkeydown={handleDocumentKeydown} />

<div class="brand-row">
	<div class="brand-side brand-side-left">
		<a class="brand-mark" href={resolve('/audits')} aria-label="GoldenWeb home">
			<img src={logo} alt="GoldenWeb Logo" />
		</a>
	</div>
	{#if user}
		<a class="brand-copy" href={resolve('/audits')} aria-label="SEO Mini Audit Tool home">
			<h1>SEO Mini Audit Tool</h1>
			<p class="brand-subtitle">By Iraki Antidze & George Tchelidze</p>
		</a>
	{/if}
	<div class="brand-side brand-side-right">
		{#if user}
			<div class="profile-menu" bind:this={profileMenuElement}>
				<button
					type="button"
					class="profile-trigger"
					aria-haspopup="menu"
					aria-expanded={profileMenuOpen}
					onclick={toggleProfileMenu}
				>
					<span class="profile-trigger-desktop">
						<UserRound size={16} />
						<span>{user.name || user.email || 'Account'}</span>
						<ChevronDown size={16} />
					</span>
					<span class="profile-trigger-mobile" aria-hidden="true">
						<Menu size={18} />
					</span>
				</button>
				{#if profileMenuOpen}
					<div class="profile-dropdown" role="menu">
						<div class="profile-meta">
							<p>{user.name || 'Account'}</p>
							{#if user.email}
								<span>{user.email}</span>
							{/if}
						</div>
						<form method="POST" action="/api/auth/logout">
							<button type="submit" class="profile-action" role="menuitem">
								<LogOut size={16} />
								<span>Log out</span>
							</button>
						</form>
					</div>
				{/if}
			</div>
		{/if}
	</div>
</div>

<style>
	.brand-row {
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		align-items: center;
		gap: 20px;
		margin-bottom: 36px;
	}

	.brand-side {
		display: flex;
		align-items: center;
	}

	.brand-side-left {
		justify-content: flex-start;
	}

	.brand-side-right {
		justify-content: flex-end;
	}

	.brand-mark {
		display: inline-flex;
		align-items: center;
	}

	.brand-mark img {
		display: block;
		width: auto;
		height: 54px;
	}

	.brand-copy {
		display: flex;
		align-items: baseline;
		justify-content: center;
		gap: 12px;
		flex-wrap: wrap;
		text-align: center;
	}

	.brand-copy h1 {
		margin: 0;
		font-size: clamp(1.35rem, 2.2vw, 1.85rem);
		font-weight: 700;
		color: #fff;
	}

	.brand-subtitle {
		margin: 0;
		color: var(--text-muted);
		font-size: 1rem;
		white-space: nowrap;
	}

	.profile-menu {
		position: relative;
	}

	.profile-trigger {
		display: inline-flex;
		align-items: center;
		padding: 12px 16px;
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 9999px;
		background: var(--surface-soft);
		color: var(--text-main);
		font: inherit;
		cursor: pointer;
		list-style: none;
	}

	.profile-trigger-desktop {
		display: inline-flex;
		align-items: center;
		gap: 10px;
		font-size: 1rem;
		font-weight: 600;
	}

	.profile-trigger-mobile {
		display: none;
		align-items: center;
		justify-content: center;
	}

	.profile-trigger::-webkit-details-marker {
		display: none;
	}

	.profile-dropdown {
		position: absolute;
		top: calc(100% + 10px);
		right: 0;
		z-index: 20;
		min-width: 220px;
		padding: 12px;
		border: 1px solid var(--border);
		border-radius: 16px;
		background: var(--card-bg);
	}

	.profile-meta {
		margin-bottom: 10px;
		padding: 4px 4px 12px;
		border-bottom: 1px solid rgba(148, 163, 184, 0.14);
	}

	.profile-meta p,
	.profile-meta span {
		display: block;
		margin: 0;
	}

	.profile-meta p {
		font-weight: 600;
	}

	.profile-meta span {
		margin-top: 4px;
		color: var(--text-muted);
		font-size: 0.9rem;
	}

	.profile-action {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		width: 100%;
		padding: 12px 14px;
		border: 0;
		border-radius: 12px;
		background: linear-gradient(135deg, #3b82f6, #6366f1);
		color: white;
		font: inherit;
		font-weight: 600;
		cursor: pointer;
	}

	@media (max-width: 900px) {
		.brand-row {
			grid-template-columns: auto minmax(0, 1fr) auto;
			align-items: center;
			gap: 12px;
			margin-bottom: 30px;
		}

		.brand-mark img {
			height: 48px;
		}

		.brand-copy {
			min-width: 0;
			align-items: center;
			justify-self: center;
			gap: 2px;
		}

		.brand-copy {
			display: none;
		}

		.brand-subtitle {
			display: none;
		}

		.brand-side-left,
		.brand-side-right {
			width: auto;
		}

		.brand-side-left {
			justify-content: flex-start;
		}

		.brand-side-right {
			justify-content: flex-end;
		}

		.profile-menu {
			width: auto;
		}

		.profile-trigger {
			justify-content: center;
			width: 44px;
			height: 44px;
			padding: 0;
		}

		.profile-trigger-desktop {
			display: none;
		}

		.profile-trigger-mobile {
			display: inline-flex;
		}

		.profile-dropdown {
			right: 0;
			left: auto;
			transform: none;
		}
	}
</style>
