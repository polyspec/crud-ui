/**
 * The HTML of a string renderer without its image preload links. React's server rendering and the
 * HTML renderer write resource preload links before a list or a detail; the framework conformance
 * expectations cover the rendered body only, so the links are removed before normalization. The
 * native generator suite compares the complete original HTML, preload links included.
 */
export function withoutPreloadLinks(html: string): string {
  return html.replace(/<link [^>]*rel="preload"[^>]*>/g, '');
}
