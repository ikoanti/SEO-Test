class PlaceholderPanel extends HTMLElement {
	constructor() {
		super();
		this.attachShadow({ mode: 'open' });
		this._panel = { title: 'Coming Soon', description: 'This panel has not been designed yet.' };
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
		this.shadowRoot.innerHTML = `
      ${styles['panels-shared'] ? `<style>${styles['panels-shared']}</style>` : '<link rel="stylesheet" href="./styles/panels/shared.css">'}
      ${styles['placeholder-panel'] ? `<style>${styles['placeholder-panel']}</style>` : '<link rel="stylesheet" href="./styles/panels/placeholder-panel.css">'}
      <section class="section">
        <h1 class="title">${escapeHtml(this._panel?.title ?? 'Coming Soon')}</h1>
        <p class="copy">${escapeHtml(this._panel?.description ?? 'This panel has not been designed yet.')}</p>
      </section>
    `;
	}
}

if (!customElements.get('placeholder-panel')) {
	customElements.define('placeholder-panel', PlaceholderPanel);
}
