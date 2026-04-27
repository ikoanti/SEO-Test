function escapeHtml(value) {
	return String(value)
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');
}

function stylesheetTag(key, href) {
	const styles = window.AutomagicAuditStyles || {};
	const css = styles[key];
	if (typeof css === 'string' && css.length > 0) {
		return `<style>${css}</style>`;
	}
	return `<link rel="stylesheet" href="${href}">`;
}

class AuditSidebar extends HTMLElement {
	constructor() {
		super();
		this.attachShadow({ mode: 'open' });
		this._data = { activeTab: 'overview', tabs: [], panels: {} };
	}

	set data(value) {
		this._data = value ?? this._data;
		this.render();
	}

	get data() {
		return this._data;
	}

	connectedCallback() {
		this.render();
	}

	setActiveTab(tabId) {
		this._data = {
			...this._data,
			activeTab: tabId
		};
		this.render();
	}

	createPanelElement() {
		const panel = this._data?.panels?.[this._data?.activeTab];
		if (!panel) {
			const el = document.createElement('placeholder-panel');
			el.panel = { title: 'Missing Panel', description: 'No panel data configured.' };
			return el;
		}

		if (panel.kind === 'image-alts') {
			const el = document.createElement('image-alts-panel');
			el.panel = panel;
			return el;
		}

		if (panel.kind === 'ai-bot-visibility') {
			const el = document.createElement('ai-bot-visibility-panel');
			el.panel = panel;
			return el;
		}

		if (panel.kind === 'pagespeed') {
			const el = document.createElement('pagespeed-panel');
			el.panel = panel;
			return el;
		}

		if (panel.kind === 'open-page-rank') {
			const el = document.createElement('open-page-rank-panel');
			el.panel = panel;
			return el;
		}

		if (panel.kind === 'broken-links') {
			const el = document.createElement('broken-links-panel');
			el.panel = panel;
			return el;
		}

		if (panel.kind === 'headings') {
			const el = document.createElement('headings-panel');
			el.panel = panel;
			return el;
		}

		if (panel.kind === 'meta-tags') {
			const el = document.createElement('meta-tags-panel');
			el.panel = panel;
			return el;
		}

		if (panel.kind === 'canonicals') {
			const el = document.createElement('canonicals-panel');
			el.panel = panel;
			return el;
		}

		if (panel.kind === 'internal-links') {
			const el = document.createElement('internal-links-panel');
			el.panel = panel;
			return el;
		}

		if (panel.kind === 'lazy-loading') {
			const el = document.createElement('lazy-loading-panel');
			el.panel = panel;
			return el;
		}

		if (panel.kind === 'open-graph') {
			const el = document.createElement('open-graph-panel');
			el.panel = panel;
			return el;
		}

		if (panel.kind === 'content-quality') {
			const el = document.createElement('content-quality-panel');
			el.panel = panel;
			return el;
		}

		if (panel.kind === 'shopify-urls') {
			const el = document.createElement('shopify-urls-panel');
			el.panel = panel;
			return el;
		}

		const el = document.createElement('placeholder-panel');
		el.panel = panel;
		return el;
	}

	render() {
		const tabs = this._data?.tabs ?? [];
		const activeTab = this._data?.activeTab;

		this.shadowRoot.innerHTML = `
      ${stylesheetTag('audit-sidebar', './styles/audit-sidebar.css')}
      <div class="tabs-wrap">
        <div class="tabs">
          ${tabs
						.map(
							(tab) => `
                <button class="tab${tab.id === activeTab ? ' active' : ''}" data-tab-id="${escapeHtml(tab.id)}">
                  ${escapeHtml(tab.label)}
                </button>
              `
						)
						.join('')}
        </div>
      </div>
      <div class="body"></div>
    `;

		this.shadowRoot.querySelectorAll('[data-tab-id]').forEach((button) => {
			button.addEventListener('click', () => {
				this.setActiveTab(button.getAttribute('data-tab-id'));
			});
		});

		const body = this.shadowRoot.querySelector('.body');
		body.appendChild(this.createPanelElement());

		requestAnimationFrame(() => {
			const tabsContainer = this.shadowRoot.querySelector('.tabs');
			const active = this.shadowRoot.querySelector('.tab.active');
			if (!tabsContainer || !active) {
				return;
			}

			const containerWidth = tabsContainer.clientWidth;
			const activeLeft = active.offsetLeft;
			const activeWidth = active.offsetWidth;
			const maxScroll = Math.max(0, tabsContainer.scrollWidth - containerWidth);
			const targetLeft = Math.min(
				maxScroll,
				Math.max(0, activeLeft - (containerWidth - activeWidth) / 2)
			);
			tabsContainer.scrollLeft = targetLeft;
		});
	}
}

if (!customElements.get('audit-sidebar')) {
	customElements.define('audit-sidebar', AuditSidebar);
}
