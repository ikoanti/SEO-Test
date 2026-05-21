<script lang="ts">
	type RichResultStatus = 'valid' | 'invalid' | 'missing';
	type RichResultItem = {
		type: string;
		label: string;
		status: RichResultStatus;
		issues?: string[];
	};
	type RichResultsData = {
		pageUrl: string;
		title?: string;
		pageTitle?: string;
		checkedAt: string;
		validCount: number;
		jsonLdScriptCount: number;
		allTypes: string[];
		items: RichResultItem[];
		fetchError?: string;
		jsonLdParseErrors?: Array<{ index: number; message: string }>;
		targetType?: string;
		sourceLabel?: string;
	};

	let { data }: { data: { richResultsData: RichResultsData } } = $props();

	const result = $derived(data.richResultsData);
	const hasGoodVerdict = $derived(result.validCount > 0 && !result.fetchError);

	function formattedDate(value: string) {
		const date = new Date(value);
		if (Number.isNaN(date.getTime())) return value;
		return new Intl.DateTimeFormat('en', {
			month: 'long',
			day: 'numeric',
			year: 'numeric',
			hour: 'numeric',
			minute: '2-digit',
			second: '2-digit'
		}).format(date);
	}

	function verdictTitle() {
		if (result.fetchError) return 'URL could not be fetched';
		if (result.validCount > 0) {
			return `${result.validCount} valid ${result.validCount === 1 ? 'item' : 'items'} detected`;
		}
		return 'No valid items detected';
	}

	function verdictBody() {
		if (result.fetchError) return 'The page could not be checked for structured data.';
		if (result.validCount > 0) {
			return "Valid items are eligible for Google Search's rich results.";
		}
		return 'This page is not eligible for rich results detected by this audit.';
	}

	function itemName(item: RichResultItem) {
		if (item.label && item.label !== item.type) return item.label;
		if (item.type === 'Product') return 'Products';
		if (item.type === 'FAQPage') return 'FAQ';
		if (item.type === 'Organization') return 'Organization';
		return item.type;
	}

	function itemSummary(item: RichResultItem) {
		if (item.status === 'valid') return '1 valid item detected';
		if (item.status === 'invalid') return 'Invalid item detected';
		return 'No valid items detected';
	}
</script>

<svelte:head>
	<title>Rich Results Capture</title>
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet" />
</svelte:head>

<div class="rrt-page" data-rich-results-stage>
	<div class="scaled-layout">
		<header class="app-header">
			<div class="header-row">
				<span class="material-icons header-icon" aria-hidden="true">arrow_back</span>
				<div class="header-title">Rich Results Test</div>
				<div class="header-spacer"></div>
				<span class="material-icons header-icon" aria-hidden="true">help</span>
				<span class="apps-dot-icon" aria-hidden="true"></span>
				<div class="avatar" aria-hidden="true"></div>
			</div>

			<div class="url-strip">
				<svg class="globe-icon" viewBox="0 0 24 24" aria-hidden="true">
					<circle cx="12" cy="12" r="9.25"></circle>
					<path d="M12 2.75c2.7 2.55 4 5.62 4 9.25s-1.3 6.7-4 9.25"></path>
					<path d="M12 2.75c-2.7 2.55-4 5.62-4 9.25s1.3 6.7 4 9.25"></path>
					<path d="M4.65 8h14.7"></path>
					<path d="M4.65 16h14.7"></path>
				</svg>
				<div class="url-text">{result.pageUrl}</div>
				<div class="strip-spacer"></div>
				<span class="material-icons strip-icon" aria-hidden="true">refresh</span>
				<span class="material-icons strip-icon" aria-hidden="true">smartphone</span>
			</div>
		</header>

		<nav class="results-bar">
			<div class="results-title">Test results</div>
			<div class="share-button">
				<span class="material-icons share-icon" aria-hidden="true">share</span>Share
			</div>
		</nav>

		<main class="content">
			<div class="content-inner">
				<section class="card verdict-card">
					<span class:bad={!hasGoodVerdict} class="material-icons large-status" aria-hidden="true">
						{hasGoodVerdict ? 'check_circle' : 'error'}
					</span>
					<div class="verdict-copy">
						<div class="verdict-title">{verdictTitle()}</div>
						<div class="verdict-subtitle">{verdictBody()} <span>Learn more</span></div>
					</div>
					<div class="verdict-actions">
						<div class="link-button">View tested page</div>
						<div class:disabled={result.validCount === 0} class="link-button">Preview results</div>
					</div>
				</section>

				<div class="section-label">Details</div>
				<section class="card crawl-card">
					<div class="card-kicker">Crawl</div>
					<div class="crawl-row">
						<span
							class:bad={Boolean(result.fetchError)}
							class="material-icons small-status"
							aria-hidden="true"
						>
							{result.fetchError ? 'error' : 'check_circle'}
						</span>
						<div class="crawl-title">
							{result.fetchError
								? 'Crawl failed'
								: `Crawled successfully on ${formattedDate(result.checkedAt)}`}
						</div>
						<span class="material-icons row-icon" aria-hidden="true">expand_more</span>
					</div>
				</section>

				<div class="section-label">Detected structured data</div>
				<section class="card data-card">
					{#each result.items as item}
						<div class:target={result.targetType === item.type} class={`data-row ${item.status}`}>
							<span class="material-icons small-status" aria-hidden="true">
								{item.status === 'valid' ? 'check_circle' : 'error'}
							</span>
							<div class="data-name">{itemName(item)}</div>
							<div class="data-summary">
								<div>{itemSummary(item)}</div>
								{#if item.issues?.length}
									<div class="issue-text">
										<span></span>
										{item.issues[0]}
									</div>
								{/if}
							</div>
							<span class="material-icons row-icon" aria-hidden="true">chevron_right</span>
						</div>
					{/each}

					{#each result.jsonLdParseErrors || [] as parseError}
						<div class="data-row missing">
							<span class="material-icons small-status" aria-hidden="true">error</span>
							<div class="data-name">Script {parseError.index}</div>
							<div class="data-summary">
								<div class="issue-text">{parseError.message}</div>
							</div>
						</div>
					{/each}
				</section>

				<div class="section-label">Additional resources</div>
			<section class="resource-card">
				<span class="material-icons resource-icon" aria-hidden="true">insert_chart</span>
				<div class="resource-title">Monitor Rich Results for your entire site</div>
				<div class="resource-action">Go to search console</div>
			</section>

			<footer class="footer">
				<span>Privacy</span>
				<span>Terms</span>
			</footer>
		</div>
	</main>
</div>
</div>

<style>
	:global(html),
	:global(:root),
	:global(body) {
		margin: 0;
		width: 100%;
		height: 100%;
		overflow: hidden;
		background: #fafafa !important;
		color: #202124;
		font-family: Roboto, Arial, Helvetica, sans-serif;
		-webkit-font-smoothing: antialiased;
	}

	:global(html),
	:global(:root) {
		height: 100%;
		min-height: 100%;
		overflow: hidden;
	}

	.rrt-page {
		--rrt-zoom: 0.672;
		box-sizing: border-box;
		width: 100vw;
		height: 100vh;
		min-width: 100%;
		overflow: hidden;
		background: #fafafa;
	}

	.scaled-layout {
		width: calc(100vw / var(--rrt-zoom));
		height: calc(100vh / var(--rrt-zoom));
		transform: scale(var(--rrt-zoom));
		transform-origin: top left;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		background: #fafafa;
	}

	.app-header {
		flex: 0 0 auto;
		box-sizing: border-box;
		height: 168px;
		display: flex;
		flex-direction: column;
		padding: 0 12px 12px;
		background: #455a64;
		color: #fff;
	}

	.header-row {
		box-sizing: border-box;
		width: 100%;
		height: 94px;
		display: flex;
		align-items: center;
		gap: 26px;
		padding: 0 26px;
	}

	.material-icons {
		font-family: 'Material Icons';
		font-weight: normal;
		font-style: normal;
		line-height: 1;
		letter-spacing: normal;
		text-transform: none;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		white-space: nowrap;
		word-wrap: normal;
		direction: ltr;
		-webkit-font-feature-settings: 'liga';
		-webkit-font-smoothing: antialiased;
		font-feature-settings: 'liga';
	}

	.header-icon {
		width: 32px;
		height: 32px;
		font-size: 32px;
		color: #fff;
	}

	.header-title {
		font-size: 27px;
		font-weight: 400;
		letter-spacing: 0;
	}

	.header-spacer,
	.strip-spacer {
		flex: 1 1 auto;
	}

	.avatar {
		width: 36px;
		height: 36px;
		border-radius: 50%;
		background:
			radial-gradient(circle at 50% 38%, #d2b9a4 0 8px, transparent 8.5px),
			linear-gradient(#607d8b 0 0) center 28px / 26px 12px no-repeat,
			#cfd8dc;
		border: 2px solid rgba(255, 255, 255, 0.35);
	}

	.url-strip {
		box-sizing: border-box;
		height: 75px;
		width: 100%;
		display: flex;
		align-items: center;
		gap: 24px;
		padding: 0 24px;
		background: #65777f;
		color: #fff;
	}

	.strip-icon {
		width: 30px;
		height: 30px;
		font-size: 30px;
		color: #fff;
	}

	.apps-dot-icon {
		width: 28px;
		height: 28px;
		flex: 0 0 auto;
		background: radial-gradient(circle, #fff 2.2px, transparent 2.8px) 0 0 / 9px 9px;
		opacity: 0.95;
	}

	.globe-icon {
		width: 30px;
		height: 30px;
		flex: 0 0 auto;
		fill: none;
		stroke: #fff;
		stroke-width: 1.9;
		stroke-linecap: round;
		stroke-linejoin: round;
	}

	.url-text {
		min-width: 0;
		font-size: 23px;
		line-height: 30px;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.results-bar {
		flex: 0 0 auto;
		box-sizing: border-box;
		height: 83px;
		display: flex;
		align-items: center;
		padding: 0 38px;
		background: #fff;
		box-shadow:
			0 3px 5px rgba(0, 0, 0, 0.2),
			0 1px 10px rgba(0, 0, 0, 0.12);
	}

	.results-title {
		font-size: 26px;
		font-weight: 500;
		color: #424242;
	}

	.share-button {
		margin-left: auto;
		height: 48px;
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 0 18px;
		border-radius: 3px;
		background: #5d84e8;
		color: #fff;
		font-size: 17px;
		font-weight: 500;
		text-transform: uppercase;
	}

	.share-icon {
		width: 27px;
		height: 27px;
		font-size: 27px;
		color: #fff;
	}

	.content {
		flex: 1 1 auto;
		min-height: 0;
		box-sizing: border-box;
		width: 100%;
		margin: 0;
		padding: 0;
		overflow-y: auto;
		overflow-x: auto;
		overscroll-behavior: contain;
	}

	.content-inner {
		box-sizing: border-box;
		width: min(1200px, calc(100vw - 48px));
		min-width: 760px;
		margin: 0 auto;
		padding: 64px 0 96px;
	}

	.card {
		box-sizing: border-box;
		background: #fff;
		border-radius: 2px;
		box-shadow:
			0 2px 4px rgba(0, 0, 0, 0.2),
			0 1px 8px rgba(0, 0, 0, 0.12);
	}

	.verdict-card {
		display: grid;
		grid-template-columns: 60px 1fr;
		min-height: 190px;
		position: relative;
		padding: 26px 32px 74px;
	}

	.verdict-card:after {
		content: '';
		position: absolute;
		left: 0;
		right: 0;
		bottom: 78px;
		height: 1px;
		background: #e0e0e0;
	}

	.large-status,
	.small-status {
		color: #388e50;
	}

	.large-status {
		width: 42px;
		height: 42px;
		margin-top: 2px;
		font-size: 52px;
	}

	.large-status.bad,
	.missing .small-status,
	.invalid .small-status,
	.small-status.bad {
		color: #e53935;
	}

	.verdict-title {
		font-size: 26px;
		line-height: 34px;
		font-weight: 500;
		color: #212121;
	}

	.verdict-subtitle {
		margin-top: 6px;
		font-size: 19px;
		line-height: 27px;
		color: #757575;
	}

	.verdict-subtitle span {
		text-decoration: underline;
	}

	.verdict-actions {
		position: absolute;
		left: 92px;
		right: 32px;
		bottom: 0;
		height: 78px;
		display: flex;
		align-items: center;
		gap: 34px;
	}

	.link-button {
		color: #455a64;
		font-size: 17px;
		font-weight: 700;
		letter-spacing: 0.4px;
		text-transform: uppercase;
	}

	.link-button.disabled {
		color: #bdbdbd;
	}

	.section-label {
		margin: 30px 0 22px;
		font-size: 20px;
		line-height: 26px;
		color: #757575;
	}

	.crawl-card {
		min-height: 132px;
		padding: 30px 32px 24px;
	}

	.card-kicker {
		margin-bottom: 28px;
		color: #757575;
		font-size: 16px;
		font-weight: 700;
	}

	.crawl-row,
	.data-row,
	.resource-card {
		display: flex;
		align-items: center;
	}

	.small-status {
		width: 27px;
		height: 27px;
		margin-right: 24px;
		font-size: 30px;
		flex: 0 0 auto;
	}

	.crawl-title {
		font-size: 19px;
		line-height: 26px;
		color: #212121;
	}

	.row-icon {
		margin-left: auto;
		width: 32px;
		height: 32px;
		font-size: 32px;
		color: #757575;
	}

	.data-card {
		overflow: hidden;
	}

	.data-row {
		box-sizing: border-box;
		min-height: 80px;
		padding: 0 32px;
		border-bottom: 1px solid #e0e0e0;
	}

	.data-row:last-child {
		border-bottom: 0;
	}

	.data-row.target {
		background: #f8fbff;
	}

	.data-name {
		width: 340px;
		font-size: 19px;
		color: #212121;
	}

	.data-summary {
		min-width: 0;
		flex: 1;
		font-size: 19px;
		line-height: 25px;
		color: #212121;
	}

	.issue-text {
		display: flex;
		align-items: center;
		gap: 7px;
		margin-top: 4px;
		color: #757575;
		font-size: 16px;
		line-height: 22px;
	}

	.issue-text span {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: #f5a623;
	}

	.missing .issue-text,
	.invalid .issue-text {
		color: #e53935;
	}

	.resource-card {
		box-sizing: border-box;
		height: 82px;
		padding: 0 36px;
		border: 1px solid #d8d8d8;
		background: #fff;
	}

	.resource-icon {
		width: 24px;
		height: 24px;
		margin-right: 28px;
		font-size: 26px;
		color: #757575;
	}

	.resource-title {
		font-size: 19px;
		color: #212121;
	}

	.resource-action {
		margin-left: auto;
		color: #455a64;
		font-size: 16px;
		font-weight: 700;
		letter-spacing: 0.6px;
		text-transform: uppercase;
	}

	.footer {
		width: min(1200px, calc(100vw - 48px));
		min-width: 760px;
		margin: 84px auto 0;
		display: flex;
		gap: 34px;
		color: #757575;
		font-size: 16px;
	}
</style>
