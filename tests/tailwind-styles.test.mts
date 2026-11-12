// The Tailwind version of the core stylesheet (form markup contract, Tailwind CSS): compiled with the
// theme and the utilities of Tailwind CSS, crudui.css imported into the layer components gives every
// element of the expected HTML of every shared render fixture the same computed style, without custom
// properties, as crudui.css at 360 and 1280 CSS pixels in Chromium, Firefox and WebKit.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { compile } from '@tailwindcss/node';
import { engineDrivers, engines, type Engine, type EngineBrowser, type EnginePage } from './browser-engines.mts';
import { setup, teardown } from '@polyspec/kit/test-hooks';
import { readJson, type JTDSchemaType } from './json.mts';

const root = fileURLToPath(new URL('..', import.meta.url));
const styles = `${root}legacy/packages/generator/ts/styles`;
const corpora = ['form-render', 'form-complete', 'list-render', 'detail-render'];
/** A case of a shared render fixture with the HTML it expects; a case that expects an error renders no HTML. */
interface RenderCase { name: string; expected_html?: string }
const renderCases: JTDSchemaType<RenderCase[]> = {
  elements: { properties: { name: { type: 'string' } }, optionalProperties: { expected_html: { type: 'string' } }, additionalProperties: true },
};
const cases = corpora.flatMap(corpus => readJson(`${root}tests/fixtures/${corpus}/cases.json`, renderCases)
  .flatMap(item => item.expected_html === undefined ? [] : [{ name: `${corpus}: ${item.name}`, html: item.expected_html }]));
const widths = [360, 1280];

const browsers: Partial<Record<Engine, EngineBrowser>> = {};
let core: string, tailwind: string;
setup('stylesheet compile and browser launch', async () => {
  core = readFileSync(`${styles}/crudui.css`, 'utf8');
  // A stylesheet that imports the Tailwind theme and utilities, and the CRUDUI file into the layer components.
  const input = [
    '@layer theme, base, components, utilities;',
    '@import "tailwindcss/theme.css" layer(theme);',
    '@import "tailwindcss/utilities.css" layer(utilities);',
    `@import "${styles}/crudui.css" layer(components);`,
  ].join('\n');
  const compiler = await compile(input, { base: root, onDependency: () => {} });
  tailwind = compiler.build([]);
  for (const engine of engines) browsers[engine] = await engineDrivers[engine].launch();
});
teardown('browser close', () => Promise.all(Object.values(browsers).map(browser => browser.close())));

// In the page: applies one of the two stylesheets, places one case and returns the computed style of
// every element, without custom properties, in document order. A page behind another page of its
// browser is hidden, and Chromium lets the system page out the memory of its renderer, so a call on
// it waits on page-ins under memory pressure; one page holds both stylesheets and stays visible.
// Playwright passes one argument to the page function, so the case and the sheet travel together.
function computed({ html, sheet }: { html: string; sheet: string }): string[] {
  if (document.visibilityState !== 'visible') throw new Error(`the page is ${document.visibilityState}, not visible`);
  for (const style of document.querySelectorAll<HTMLStyleElement>('style[data-sheet]')) style.media = style.dataset.sheet === sheet ? 'all' : 'not all';
  const active = Array.from(document.styleSheets, entry => entry.media.mediaText === 'not all' ? null : (entry.ownerNode instanceof HTMLStyleElement ? entry.ownerNode.dataset.sheet : null)).filter(Boolean);
  if (active.join() !== sheet) throw new Error(`the stylesheets ${active.join(', ')} apply instead of ${sheet}`);
  document.body.innerHTML = html;
  return Array.from(document.body.querySelectorAll('*'), element => {
    const style = getComputedStyle(element);
    const values: string[] = [];
    for (let index = 0; index < style.length; index++) {
      const name = style.item(index);
      if (!name.startsWith('--')) values.push(`${name}:${style.getPropertyValue(name)}`);
    }
    return `${element.tagName.toLowerCase()}.${String(element.className)} ${values.join(';')}`;
  });
}

async function open(engine: Engine, width: number): Promise<EnginePage> {
  const browser = browsers[engine];
  assert.ok(browser, `${engine} is launched`);
  const page = await engineDrivers[engine].open(browser, { width, height: 800 });
  await page.setContent(`<!doctype html><html><head><meta name="viewport" content="width=device-width"><style data-sheet="plain">${core}</style><style data-sheet="layered" media="not all">${tailwind}</style></head><body style="margin:0"></body></html>`);
  return page;
}

test('the compiled Tailwind version holds the CRUDUI rules in the layer components', () => {
  assert.match(tailwind, /@layer components\s*{/);
  assert.ok(tailwind.includes('.crudui-form'), 'the compiled stylesheet has no CRUDUI rule');
});

// One page per engine and width holds crudui.css and the compiled Tailwind version; every shared
// render case is its own test with the runner's timeout of a test.
for (const engine of engines) {
  for (const width of widths) {
    describe(`${engine} at ${width} px: the Tailwind version computes the styles of crudui.css`, () => {
      let page: EnginePage | undefined;
      setup(`${engine} ${width} px page open`, async () => {
        page = await open(engine, width);
      });
      teardown(`${engine} ${width} px page close`, () => page?.close());
      for (const item of cases) {
        test(item.name, async () => {
          assert.ok(page, 'the page is open');
          const expected = await page.mainFrame().evaluate(computed, { html: item.html, sheet: 'plain' });
          const actual = await page.mainFrame().evaluate(computed, { html: item.html, sheet: 'layered' });
          const index = expected.findIndex((value, at) => value !== actual[at]);
          if (index >= 0 || expected.length !== actual.length) {
            const differing = (expected[index] ?? '').split(';').filter(entry => !(actual[index] ?? '').split(';').includes(entry));
            assert.fail(`element ${index}: ${differing.slice(0, 3).join('; ')}`);
          }
        });
      }
    });
  }
}
