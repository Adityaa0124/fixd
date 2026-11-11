import { parse, HTMLElement, TextNode, Node } from 'node-html-parser';

const BLOCK = new Set(['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'tr', 'table']);

export function htmlToText(html: string): string {
  const root = parse(html, { comment: false, blockTextElements: { script: false, style: false } });
  return tidy(walk(root));
}

function walk(n: Node): string {
  if (n instanceof TextNode) return n.text;               // .text decodes entities
  if (!(n instanceof HTMLElement)) return '';
  const tag = n.rawTagName?.toLowerCase() ?? '';
  if (tag === 'br') return '\n';
  if (tag === 'img') return ' [image] ';
  if (tag === 'math') return ' ' + math(n) + ' ';
  if (tag === 'mspace') return '\n' + n.childNodes.map(walk).join('');
  const inner = n.childNodes.map(walk).join('');
  return BLOCK.has(tag) ? inner + '\n' : inner;
}

function kids(el: HTMLElement): HTMLElement[] {
  return el.childNodes.filter((c): c is HTMLElement => c instanceof HTMLElement);
}

function group(s: string): string {
  const t = s.trim();
  return /^[\w.]+$/.test(t) ? t : `(${t})`;
}

/** Linearizes presentation MathML: fractions, powers, roots, sub and superscripts. */
export function math(el: HTMLElement): string {
  const tag = el.rawTagName?.toLowerCase() ?? '';
  const k = kids(el);
  const m = (i: number) => (k[i] ? math(k[i]!) : '');
  switch (tag) {
    case 'mi': case 'mn': case 'mo': case 'mtext': case 'ms':
      return el.text.replace(/ /g, ' ').trim();
    case 'mfrac': return `${group(m(0))}/${group(m(1))}`;
    case 'msup': return `${m(0)}^${group(m(1))}`;
    case 'msub': return `${m(0)}_${group(m(1))}`;
    case 'msubsup': return `${m(0)}_${group(m(1))}^${group(m(2))}`;
    case 'msqrt': return `sqrt(${k.map(math).join(' ')})`;
    case 'mroot': return `root${group(m(1))}(${m(0)})`;
    case 'mover': return `${m(0)}${m(1) === '→' ? '(vector)' : m(1)}`;
    case 'munder': return `${m(0)}_${group(m(1))}`;
    case 'mfenced': return `(${k.map(math).join(', ')})`;
    case 'mtable': return k.map(math).join('; ');
    case 'mtr': return k.map(math).join(' ');
    case 'mspace': return ' ';
    default:
      if (k.length === 0) return el.text.trim();
      return k.map(math).join(' ');
  }
}

function tidy(s: string): string {
  return s
    .replace(/ /g, ' ')
    .replace(/​/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\s+([,.;:)])/g, '$1')
    .replace(/\(\s+/g, '(')
    .trim();
}

