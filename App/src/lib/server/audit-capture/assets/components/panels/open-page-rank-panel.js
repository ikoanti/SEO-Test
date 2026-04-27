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
        <div class="rank-stack">
          <article class="rank-panel-stat">
            <p class="rank-panel-label">Page Rank</p>
            <p class="rank-panel-value">${escapeHtml(rank.pageRank ?? 'N/A')}</p>
          </article>
          <article class="rank-panel-stat">
            <p class="rank-panel-label">Global Rank</p>
            <p class="rank-panel-value">${escapeHtml(rank.globalRank ?? 'N/A')}</p>
          </article>
        </div>
      </section>
    `;
	}
}

if (!customElements.get('open-page-rank-panel')) {
	customElements.define('open-page-rank-panel', OpenPageRankPanel);
}
