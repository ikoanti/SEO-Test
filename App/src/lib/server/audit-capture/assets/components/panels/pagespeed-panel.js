class PageSpeedPanel extends HTMLElement {
	constructor() {
		super();
		this.attachShadow({ mode: 'open' });
		this._panel = {
			title: 'PageSpeed Insights',
			description: '',
			domain: 'this domain',
			pageSpeed: {}
		};
	}

	set panel(value) {
		this._panel = value ?? this._panel;
		this.render();
	}

	get panel() {
		return this._panel;
	}

	connectedCallback() {
		this.render();
	}

	scoreClass(score) {
		const value = Number(score);
		if (!Number.isFinite(value) || value <= 0) return 'metric-info';
		if (value >= 90) return 'metric-pass';
		if (value >= 50) return 'metric-warn';
		return 'metric-fail';
	}

	metricRows(strategyData) {
		const metrics = strategyData?.metrics ?? {};
		return [
			['FCP', metrics.FCP ?? metrics.fcp ?? 'N/A'],
			['LCP', metrics.LCP ?? metrics.lcp ?? 'N/A'],
			['CLS', metrics.CLS ?? metrics.cls ?? 'N/A'],
			['TBT', metrics.TBT ?? metrics.tbt ?? 'N/A'],
			['Speed Index', metrics['Speed Index'] ?? metrics.speedIndex ?? metrics.SI ?? 'N/A']
		];
	}

	sortedStrategies(pageSpeed) {
		return ['mobile', 'desktop']
			.map((strategy) => ({ strategy, data: pageSpeed?.[strategy] ?? {} }))
			.sort((a, b) => {
				const aScore = Number(a.data?.score);
				const bScore = Number(b.data?.score);
				const normalizedA = Number.isFinite(aScore) && aScore > 0 ? aScore : 101;
				const normalizedB = Number.isFinite(bScore) && bScore > 0 ? bScore : 101;
				return normalizedA - normalizedB;
			});
	}

	render() {
		const { escapeHtml } = window.AutomagicHtml;
		const styles = window.AutomagicAuditStyles || {};
		const panel = this._panel ?? {};
		const pageSpeed = panel.pageSpeed ?? {};
		const strategies = this.sortedStrategies(pageSpeed);

		this.shadowRoot.innerHTML = `
      ${styles['panels-shared'] ? `<style>${styles['panels-shared']}</style>` : '<link rel="stylesheet" href="./styles/panels/shared.css">'}
      <section class="section">
        <h1 class="title">${escapeHtml(panel.title ?? 'PageSpeed Insights')}</h1>
        <p class="copy">${escapeHtml(panel.description ?? '')}</p>
      </section>
      <section class="section">
        <div class="metric-stack">
          ${strategies
						.map(
							({ strategy, data }) => `
                <article class="metric-panel-card ${this.scoreClass(data.score)}">
                  <div class="metric-panel-head">
                    <div>
                      <p class="summary-label">${strategy === 'mobile' ? 'Mobile' : 'Desktop'}</p>
                      <p class="metric-panel-title">${strategy === 'mobile' ? 'Mobile Score' : 'Desktop Score'}</p>
                    </div>
                    <p class="metric-panel-score">${escapeHtml(data.score ?? 'N/A')}</p>
                  </div>
                  <div class="metric-row-grid">
                    ${this.metricRows(data)
											.map(
												([label, value]) => `
                          <div class="metric-row-card">
                            <p class="meta-label">${escapeHtml(label)}</p>
                            <p class="meta-value meta-value-strong">${escapeHtml(value)}</p>
                          </div>
                        `
											)
											.join('')}
                  </div>
                </article>
              `
						)
						.join('')}
        </div>
      </section>
    `;
	}
}

if (!customElements.get('pagespeed-panel')) {
	customElements.define('pagespeed-panel', PageSpeedPanel);
}
