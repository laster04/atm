/**
 * A club's own CSS for the widget (`?css=`), so it can match the website it
 * sits on. Three limits keep the widget's promises:
 *
 * - it loads nothing from anywhere but Google Fonts (and inline `data:`), so
 *   the club's visitors still make no requests to unknown servers;
 * - it applies only inside a frame, so a bare /embed address cannot be
 *   dressed up as a fake ATM page;
 * - the "Výsledky z ATM" link stays visible: hiding it is a paid option.
 */

export const CUSTOM_CSS_MAX = 4000;

const ALLOWED_URL = /^(https:\/\/fonts\.(googleapis|gstatic)\.com\/|data:(image|font)\/)/i;

/** The CSS to apply, or null when there is none or it tries something it may not. */
export function sanitizeCustomCss(raw: string | null): { imports: string[]; css: string } | null {
	if (!raw?.trim() || raw.length > CUSTOM_CSS_MAX) return null;
	// Escapes could spell `url(` or `@import` in disguise; a widget's CSS needs none.
	let css = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\\/g, '');

	const imports: string[] = [];
	// Google Fonts addresses carry `;` (wght@400;700), so the address ends at its quote or bracket.
	css = css.replace(
		/@import\s+(?:url\(\s*(["']?)([^"'()]+?)\1\s*\)|(["'])([^"']*)\3)[^;{}]*;/gi,
		(_, _q1: string, inUrl: string | undefined, _q2: string, quoted: string | undefined) => {
			const href = (inUrl ?? quoted ?? '').trim();
			if (href.startsWith('https://') && ALLOWED_URL.test(href) && imports.length < 3) imports.push(href);
			return '';
		},
	);

	// Allowed url()s step aside while the rest is checked for anything that loads.
	const urls: string[] = [];
	css = css.replace(/url\(\s*(["']?)([^"'()]*)\1\s*\)/gi, (match, _quote: string, href: string) => {
		if (!ALLOWED_URL.test(href.trim())) return 'none';
		urls.push(match);
		return `\u0000${urls.length - 1}\u0000`;
	});
	if (/url\(|@import|image-set|image\(|expression|javascript:|<\//i.test(css)) return null;
	css = css.replace(/\u0000(\d+)\u0000/g, (_, index: string) => urls[Number(index)]);

	return { imports, css };
}

/**
 * Keeps the brand link on top and in view. Important declarations in a layer
 * beat every unlayered one, the club's `!important` included.
 */
const BRAND_GUARD = `@layer atm-guard {
	html, body, #root, .w { overflow: visible !important; max-height: none !important; }
	.brand, .brand a, .brand b, .brand img {
		display: flex !important; visibility: visible !important; opacity: 1 !important;
		transform: none !important; filter: none !important; clip-path: none !important; mask: none !important;
		font-size: 11.5px !important; width: auto !important; height: auto !important; min-height: 0 !important;
	}
	.brand { position: relative !important; inset: auto !important; z-index: 2147483647 !important; margin: 0 !important; }
	.brand b { display: inline !important; }
	.brand img { display: block !important; height: 20px !important; }
}`;

/** Adds the club's CSS after the widget's own, when the widget is inside a frame. */
export function applyCustomCss(raw: string | null) {
	if (window.self === window.top) return;
	const custom = sanitizeCustomCss(raw);
	if (!custom) return;
	const style = document.createElement('style');
	style.textContent = [
		...custom.imports.map((href) => `@import url("${href}");`),
		BRAND_GUARD,
		custom.css,
	].join('\n');
	document.head.appendChild(style);
}
