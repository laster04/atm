import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import Widget, { type WidgetOptions } from './Widget';
import './embed.css';

/**
 * Entry of the embedded widget (celek I): its own small bundle, served at
 * /embed/<season|tournament>/<id>/<standings|games> inside other websites.
 * Everything it needs is in the address; nothing is stored in the browser.
 */

const path = window.location.pathname.split('/').filter(Boolean);
const query = new URLSearchParams(window.location.search);

const hex = (value: string | null) => (value && /^[0-9a-f]{6}$/i.test(value) ? `#${value}` : null);
const positive = (value: string | null) => {
	const number = Number(value);
	return Number.isInteger(number) && number > 0 ? Math.min(number, 30) : null;
};

const kind = path[1] === 'tournament' ? 'tournament' : path[1] === 'season' ? 'season' : null;
const view = path[3] === 'games' ? 'games' : path[3] === 'standings' ? 'standings' : null;

const options: WidgetOptions | null = kind && view && path[2]
	? {
		kind,
		id: path[2],
		view,
		lang: query.get('lang') === 'en' ? 'en' : 'cs',
		rows: positive(query.get('rows')),
		team: query.get('team'),
		group: query.get('group'),
		results: query.get('results') === '1',
		logos: query.get('logos') !== '0',
		hideBrand: query.get('brand') === '0',
	}
	: null;

const root = document.documentElement;
root.lang = options?.lang ?? 'cs';
root.dataset.theme = query.get('theme') === 'dark' ? 'dark' : 'light';
const accent = hex(query.get('accent'));
if (accent) root.style.setProperty('--accent', accent);

// The host page's optional embed.js sizes the iframe to the content.
const reportHeight = () => {
	if (window.parent === window) return;
	window.parent.postMessage({ type: 'atm-embed:height', height: Math.ceil(root.getBoundingClientRect().height) }, '*');
};
new ResizeObserver(reportHeight).observe(root);

createRoot(document.getElementById('root')!).render(
	<StrictMode>
		<Widget options={options} />
	</StrictMode>,
);
