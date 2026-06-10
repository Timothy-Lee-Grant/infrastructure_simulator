/** SVG element creation utility */
export const NS = 'http://www.w3.org/2000/svg';

export function el(tag, attrs) {
  const e = document.createElementNS(NS, tag);
  if (attrs) for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
}
