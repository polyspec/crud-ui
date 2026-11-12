// Viewport checks for the core stylesheet (@polyspec/crudui-generator-core/crudui.css) in Chromium, Firefox
// and WebKit (form markup contract, viewport widths): at 360 and 1280 CSS pixels the expected HTML
// of every case of the shared render fixtures causes no horizontal overflow of the document, and
// every control and action lies within the viewport, except inside an element that scrolls
// horizontally on its own.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { engineDrivers, engines, type Engine, type EngineBrowser, type EnginePage } from './browser-engines.mts';
import { setup, teardown } from '@polyspec/kit/test-hooks';
import { readJson, type JTDSchemaType } from './json.mts';

const root = fileURLToPath(new URL('..', import.meta.url));
const stylesheet = readFileSync(`${root}legacy/packages/generator/ts/styles/crudui.css`, 'utf8');
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
setup('browser launch', async () => {
  for (const engine of engines) browsers[engine] = await engineDrivers[engine].launch();
});
teardown('browser close', () => Promise.all(Object.values(browsers).map(browser => browser.close())));

// In the page: places one case and returns every overflow that the contract forbids.
function measure(html: string): string[] {
  document.body.innerHTML = html;
  const width = document.documentElement.clientWidth;
  const problems: string[] = [];
  if (document.documentElement.scrollWidth > width) problems.push(`the document is ${document.documentElement.scrollWidth} px wide`);
  const scrollsOnItsOwn = (element: Element) => {
    for (let parent = element.parentElement; parent !== null; parent = parent.parentElement) {
      const overflow = getComputedStyle(parent).overflowX;
      if (overflow === 'auto' || overflow === 'scroll') return true;
    }
    return false;
  };
  const selector = 'input, select, textarea, button, .crudui-action, .crudui-list__action, .crudui-detail__action';
  for (const element of document.body.querySelectorAll(selector)) {
    if (element.getClientRects().length === 0 || scrollsOnItsOwn(element)) continue;
    const box = element.getBoundingClientRect();
    if (box.left < -0.5 || box.right > width + 0.5) {
      problems.push(`${element.tagName.toLowerCase()}.${String(element.className).split(' ')[0]} spans ${Math.round(box.left)} to ${Math.round(box.right)} px`);
    }
  }
  return problems;
}

// One page per engine and width holds the stylesheet; every shared render case is its own test
// with the runner's timeout of a test.
for (const engine of engines) {
  for (const width of widths) {
    describe(`${engine} at ${width} px`, () => {
      let page: EnginePage | undefined;
      setup(`${engine} ${width} px page open`, async () => {
        const browser = browsers[engine];
        assert.ok(browser, `${engine} is launched`);
        page = await engineDrivers[engine].open(browser, { width, height: 800 });
        await page.setContent(`<!doctype html><html><head><meta name="viewport" content="width=device-width"><style>${stylesheet}</style></head><body style="margin:0"></body></html>`);
      });
      teardown(`${engine} ${width} px page close`, () => page?.close());
      test('condition-editor fallback controls preserve standalone geometry', async () => {
        assert.ok(page, 'the page is open');
        const item = cases.find(entry => entry.name === 'form-render: condition-editor-text-value');
        assert.ok(item, 'the shared cases include a condition editor fallback');
        const geometry = await page.mainFrame().evaluate((html: string) => {
          document.body.innerHTML = html;
          const widget = document.querySelector('.crudui-widget--condition');
          const textarea = widget?.querySelector('textarea:not([hidden])');
          if (!widget || !textarea) throw new Error('the condition editor must show its fallback textarea');
          const referenceWidget = document.createElement('div');
          referenceWidget.className = 'crudui-widget';
          const reference = document.createElement('textarea');
          reference.className = 'crudui-input';
          referenceWidget.append(reference);
          widget.after(referenceWidget);
          const corners = (element: Element) => {
            const style = getComputedStyle(element);
            return [style.borderTopLeftRadius, style.borderTopRightRadius,
              style.borderBottomRightRadius, style.borderBottomLeftRadius];
          };
          const controlBox = textarea.getBoundingClientRect();
          const widgetBox = widget.getBoundingClientRect();
          return { left: controlBox.left - widgetBox.left, right: controlBox.right - widgetBox.right,
            corners: corners(textarea), standaloneCorners: corners(reference) };
        }, item.html);
        assert.equal(geometry.left, 0, 'the fallback starts at its widget edge');
        assert.equal(geometry.right, 0, 'the fallback ends at its widget edge');
        assert.deepEqual(geometry.corners, geometry.standaloneCorners,
          'the fallback has the four borders of a standalone control');
      });
      for (const item of cases) {
        test(`${item.name} fits the viewport`, async () => {
          assert.ok(page, 'the page is open');
          assert.deepEqual(await page.mainFrame().evaluate(measure, item.html), []);
        });
      }
    });
  }
}
