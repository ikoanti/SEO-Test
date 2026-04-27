class OpenPageRankPanel extends HTMLElement {
	constructor() {
		super();
		this.attachShadow({ mode: 'open' });
		this._panel = {
			title: 'Open PageRank',
			description: '',
			domain: 'this domain',
			openPageRank: {}
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

	render() {
		const { escapeHtml } = window.AutomagicHtml;
		const styles = window.AutomagicAuditStyles || {};
		const panel = this._panel ?? {};
		const rank = panel.openPageRank ?? {};

		this.shadowRoot.innerHTML = `
      ${styles['panels-shared'] ? `<style>${styles['panels-shared']}</style>` : '<link rel="stylesheet" href="./styles/panels/shared.css">'}
      <section class="section">
        <h1 class="title">${escapeHtml(panel.title ?? 'Open PageRank')}</h1>
        <p class="copy">${escapeHtml(panel.description ?? '')}</p>
      </section>
      <section class="section">
        <div class="metric-stack">
          <article class="metric-panel-card metric-info">
            <div class="metric-panel-head">
              <div>
                <p class="summary-label">Authority</p>
                <p class="metric-panel-title">Page Rank</p>
              </div>
              <p class="metric-panel-score">${escapeHtml(rank.pageRank ?? 'N/A')}</p>
            </div>
          </article>
          <article class="metric-panel-card metric-info">
            <div class="metric-panel-head">
              <div>
                <p class="summary-label">Global</p>
                <p class="metric-panel-title">Global Rank</p>
              </div>
              <p class="metric-panel-score">${escapeHtml(rank.globalRank ?? 'N/A')}</p>
            </div>
          </article>
        </div>
      </section>
    `;
	}
}

if (!customElements.get('open-page-rank-panel')) {
	customElements.define('open-page-rank-panel', OpenPageRankPanel);
}
