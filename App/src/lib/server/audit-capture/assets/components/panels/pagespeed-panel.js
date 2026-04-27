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
		if (!Number.isFinite(value) || value <= 0) return 'speed-info';
		if (value >= 90) return 'speed-pass';
		if (value >= 50) return 'speed-warn';
		return 'speed-fail';
	}

	gaugeStyle(score) {
		const value = Number(score);
		const normalized = Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;
		const color =
			normalized >= 90
				? '#10b981'
				: normalized >= 50
					? '#f59e0b'
					: normalized > 0
						? '#d93025'
						: '#dadce0';
		return `--score:${normalized};--score-color:${color};`;
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
                <article class="speed-panel-card ${this.scoreClass(data.score)}">
                  <div class="speed-panel-head">
                    <div class="speed-gauge" style="${this.gaugeStyle(data.score)}">
                      <div class="speed-gauge-inner">
                        <strong>${escapeHtml(data.score ?? 'N/A')}</strong>
                      </div>
                    </div>
                    <div class="speed-panel-copy">
                      <p class="metric-panel-title">${strategy === 'mobile' ? 'Mobile Score' : 'Desktop Score'}</p>
                    </div>
                  </div>
                  <div class="speed-metric-list">
                    ${this.metricRows(data)
											.map(
												([label, value]) => `
                          <div class="speed-metric-row">
                            <span>${escapeHtml(label)}</span>
                            <strong>${escapeHtml(value)}</strong>
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
