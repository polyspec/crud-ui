// Browser layout checks for the core stylesheet (@polyspec/crudui-generator-core/crudui.css) in Chromium,
// Firefox and WebKit. jsdom has no layout, so sticky stacking and focus scrolling are verified in
// real browsers. Every check runs the same way in a page, in a scrolling box and in a frame, and
// every engine runs the same scenario through one engine adapter.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer, type ViteDevServer } from 'vite';
import { engineDrivers, engines, type Engine, type EngineBrowser, type EngineDriver, type EngineFrame } from './browser-engines.mts';
import { setup, teardown } from '@polyspec/kit/test-hooks';

const root = fileURLToPath(new URL('..', import.meta.url));
const entry = '/__crudui_form_styles__.mjs';
const moduleId = '\0crudui-form-styles';
const key = '__0000000000001__';
const second = '__0000000000002__';
const longName = 'Long company name that cannot fit in one sticky header '.repeat(6);
/** Where the form document runs: the page itself, a scrolling box in the page, or a frame. */
type Host = 'page' | 'box' | 'frame';
const hosts: Host[] = ['page', 'box', 'frame'];

/** The calls of the page module (browserSource). */
interface FormStylesTest { mount(spec: unknown, data: unknown): void; mountChoice(): void; container(): Container }

declare global {
  interface Window { formStylesTest: FormStylesTest }
}

/** The scroll container of the form document and its measures (FormStylesTest.container). */
interface Container { scroller: Element; top: number; height: number; token: number }

// Five nested repeated levels, each with a sticky header titled by its name.
const levels = ['companies', 'stores', 'departments', 'teams', 'members'];
function levelSpec(index: number): Record<string, unknown> {
  const properties: Record<string, unknown> = { name: { type: 'text', label: 'Name' }, note: { type: 'textarea', label: 'Note' } };
  const next = levels[index + 1];
  if (next !== undefined) properties[next] = levelSpec(index + 1);
  return { type: 'group', label: levels[index], multiple: { header: 'sticky', title: 'name', copy: true, sortable: true }, properties };
}
function levelData(index: number): Record<string, Record<string, unknown>> {
  const row: Record<string, unknown> = { name: index === 0 ? longName : `${levels[index]} one`, note: '' };
  const next = levels[index + 1];
  if (next !== undefined) row[next] = levelData(index + 1);
  return { [key]: row };
}
const spec = { type: 'group', properties: { companies: levelSpec(0) } };
const data = { companies: levelData(0) };
// Two stores, the second after the first with its nested rows.
const siblingData = { companies: { [key]: { ...levelData(0)[key], name: 'ACME', stores: { ...levelData(1), [second]: { name: 'Pangyo', note: '', departments: {} } } } } };

const browserSource = `
import '/legacy/packages/generator/ts/styles/crudui.css';
import { compileForm, connectForm, connectOutline, createForm, patchContent } from '@polyspec/crudui-generator-core';
import { renderForm, renderOutline } from '@polyspec/crudui-generator-html';

const element = document.getElementById('form');
const outline = document.getElementById('outline');
window.formStylesTest = {
  mount(spec, data) {
    const form = createForm(compileForm(spec), data, { language: 'en' });
    element.innerHTML = renderForm(form);
    outline.innerHTML = renderOutline(form);
    const connection = connectForm(element, form);
    connectOutline(outline, form, element);
    // Patch every change into the page and synchronize, as a page with the HTML renderer does.
    form.subscribe(() => {
      patchContent(element, renderForm(form));
      connection.sync();
      patchContent(outline, renderOutline(form));
    });
  },
  container() {
    const box = document.getElementById('box');
    const scroller = box ?? document.scrollingElement;
    const top = box ? box.getBoundingClientRect().top + box.clientTop : 0;
    const height = box ? box.clientHeight : document.documentElement.clientHeight;
    const probe = document.createElement('div');
    probe.style.height = 'var(--crudui-node-header-height)';
    document.querySelector('.crudui-form').append(probe);
    const token = probe.getBoundingClientRect().height;
    probe.remove();
    return { scroller, top, height, token };
  },
  mountChoice() {
    const form = createForm(compileForm({
      type: 'group',
      properties: { outcome: { type: 'choice', label: 'Outcome', items: { all: 'All outcomes', open: 'Open' } } },
    }), { outcome: 'open' }, { language: 'en' });
    element.innerHTML = renderForm(form);
  },
};
`;

const viewport = { width: 1000, height: 700 };

/**
 * The engine adapter (tests/browser-engines.mts) with each engine's known convention for a
 * pointer press on a button in `pointerFocusesButtons`.
 */
const drivers: Record<Engine, EngineDriver & { pointerFocusesButtons: boolean | undefined }> = {
  chromium: { ...engineDrivers.chromium, pointerFocusesButtons: true },
  firefox: { ...engineDrivers.firefox, pointerFocusesButtons: true },
  // Safari on macOS does not focus a button on a pointer press; other WebKit ports follow
  // their own platform, which the scenario measures.
  webkit: { ...engineDrivers.webkit, pointerFocusesButtons: process.platform === 'darwin' ? false : undefined },
};
const browsers: Partial<Record<Engine, EngineBrowser>> = {};
let server: ViteDevServer | undefined, url: string, frameUrl: string, cacheDirectory: string | undefined;
setup('server start and browser launch', async () => {
  cacheDirectory = await mkdtemp(join(tmpdir(), 'crudui-form-styles-'));
  server = await createServer({
    root, configFile: false, logLevel: 'error', cacheDir: cacheDirectory,
    optimizeDeps: { noDiscovery: true, include: ['@polyspec/crudui-generator-core', '@polyspec/crudui-generator-html'] },
    server: { host: '127.0.0.1', port: 0, watch: null },
    plugins: [{
      name: 'form-styles-test',
      resolveId(id) { if (id === entry) return moduleId; },
      load(id) { if (id === moduleId) return browserSource; },
      configureServer(vite) {
        vite.middlewares.use(async (request, response, next) => {
          try {
            if (request.url === '/form-styles') {
              // Tall note fields give every level room to stay stuck while scrolling.
              const html = await vite.transformIndexHtml('/form-styles', `<!doctype html><html><head><link rel="icon" href="data:,"><style>body{margin:0;padding-top:40px}textarea{height:900px}</style></head><body><div id="form"></div><div id="outline" style="position:fixed;top:0;right:0;width:12rem"></div><script type="module" src="${entry}"></script></body></html>`);
              response.setHeader('Content-Type', 'text/html');
              response.end(html);
            } else if (request.url === '/form-styles-frame') {
              response.setHeader('Content-Type', 'text/html');
              response.end('<!doctype html><html><head><link rel="icon" href="data:,"></head><body style="margin:0;padding:30px 20px"><iframe src="/form-styles" style="display:block;width:960px;height:600px;border:0"></iframe></body></html>');
            } else next();
          } catch (error) { next(error); }
        });
      },
    }],
  });
  await server.listen();
  assert.ok(server.resolvedUrls, 'the server listens');
  url = `${server.resolvedUrls.local[0]}form-styles`;
  frameUrl = `${server.resolvedUrls.local[0]}form-styles-frame`;
  for (const engine of engines) browsers[engine] = await drivers[engine].launch();
});
teardown('browser close', () => Promise.all(Object.values(browsers).map(browser => browser.close())));
teardown('server stop', () => server?.close());
teardown('cache removal', () => cacheDirectory && rm(cacheDirectory, { recursive: true, force: true }));

// The dev server watches no file (C14.47): with a watcher on the repository root, Vite answered every change of a
// tsconfig file under it, such as those that mise writes under var/tools/mise/state for other checkouts, with a cleared
// cache and a full reload of the page, which destroyed the context of a running check.
test('the dev server watches no file, so no change of the checkout reloads the page', () => {
  assert.ok(server, 'the server is started');
  assert.equal(server.config.server.watch, null);
});

/**
 * Open the form document in a host: the page itself, a 420 px scrolling box in the page,
 * or a 600 px frame. Returns the frame that runs the form and records page errors.
 */
async function openHost(engine: Engine, host: Host) {
  const browser = browsers[engine];
  assert.ok(browser, `${engine} is launched`);
  const page = await drivers[engine].open(browser, viewport);
  const failures: string[] = [];
  page.on('pageerror', error => failures.push(error instanceof Error ? error.message : String(error)));
  page.on('console', message => { if (message.type() === 'error') failures.push(message.text()); });
  await page.goto(host === 'frame' ? frameUrl : url);
  const target = host === 'frame' ? await (await page.waitForSelector('iframe'))?.contentFrame() : page.mainFrame();
  assert.ok(target, `the ${host} host has a frame`);
  await target.waitForFunction(() => window.formStylesTest !== undefined);
  if (host === 'box') {
    await target.evaluate(() => {
      const box = document.createElement('div');
      box.id = 'box';
      box.style.cssText = 'height:420px;overflow:auto;margin:20px 40px';
      document.body.style.paddingTop = '0';
      document.body.prepend(box);
      // Content before the form, as the page padding is in the other hosts.
      const before = document.createElement('div');
      before.style.height = '40px';
      const form = document.getElementById('form');
      if (!form) throw new Error('the page has no form');
      box.append(before, form);
    });
  }
  return { page, target, failures };
}

const frames = (target: EngineFrame) => target.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));

// In the form document: the scroll container, its content top in the viewport and its height.
for (const engine of engines) for (const host of hosts) {
  test(`${engine} ${host}: sticky row headers stack on their lines and show their labels only while stuck`, async () => {
    const { page, target, failures } = await openHost(engine, host);
    try {
      await target.evaluate(([spec, data]: [unknown, unknown]) => window.formStylesTest.mount(spec, data), [spec, data]);
      // Scroll until the deepest row's top is 10 px past its line, under the four pinned ancestor headers.
      await target.evaluate(() => {
        const { scroller, top, token } = window.formStylesTest.container();
        const rows = document.querySelectorAll('.crudui-node--sticky');
        const last = rows[rows.length - 1];
        if (!last) throw new Error('the form has no sticky row');
        scroller.scrollTop += last.getBoundingClientRect().top - top - (4 * token - 10);
      });
      await frames(target);
      const layout = await target.evaluate(() => {
        const { top, token } = window.formStylesTest.container();
        const need = <T,>(value: T | null | undefined, what: string): T => {
          if (value === null || value === undefined) throw new Error(`the form has no ${what}`);
          return value;
        };
        const headers = [...document.querySelectorAll('.crudui-node--sticky')].map(row => need(row.querySelector(':scope > .crudui-node__header-container'), 'header container'));
        const first = need(headers[0], 'sticky row');
        const title = need(first.querySelector('.crudui-node__title'), 'title');
        return {
          token,
          scrollState: CSS.supports('container-type: scroll-state'),
          border: parseFloat(getComputedStyle(need(first.parentElement, 'sticky row')).borderLeftWidth),
          headers: headers.map(header => ({
            offset: header.getBoundingClientRect().top - top,
            line: parseFloat(getComputedStyle(header).top),
            height: header.getBoundingClientRect().height,
            label: getComputedStyle(need(header.querySelector('.crudui-node__label'), 'label')).display,
            marked: header.hasAttribute('data-crudui-stuck'),
            labelBackground: getComputedStyle(need(header.querySelector('.crudui-node__label'), 'label')).backgroundColor,
            labelRadius: getComputedStyle(need(header.querySelector('.crudui-node__label'), 'label')).borderRadius,
          })),
          // The card top edge is drawn in the container and goes while the container is stuck,
          // so no border crosses the line and a seam keeps one border.
          edges: headers.map(header => ({
            row: getComputedStyle(need(header.parentElement, 'sticky row')).borderTopWidth,
            edge: getComputedStyle(need(header.querySelector(':scope > .crudui-node__header'), 'header'), '::before').display,
          })),
          lines: headers.map(header => getComputedStyle(need(header.querySelector(':scope > .crudui-node__header'), 'header')).borderBottomWidth),
          titleTruncated: title.scrollWidth > title.clientWidth,
          actionRows: new Set([...first.querySelectorAll('.crudui-action')].map(button => Math.round(button.getBoundingClientRect().top))).size,
        };
      });
      assert.deepEqual(failures, []);
      assert.ok(layout.token > 0, 'The header height token resolves');
      assert.equal(layout.headers.length, levels.length);
      for (const [index, header] of layout.headers.entries()) {
        assert.ok(Math.abs(header.height - layout.token) < 0.5, `Level ${index} header height ${header.height} equals ${layout.token}`);
        assert.ok(Math.abs(header.offset - header.line) < 0.5, `Level ${index} header sits on its line: ${header.offset} vs ${header.line}`);
        assert.ok(Math.abs(header.line - index * (layout.token - layout.border)) < 0.5,
          `Level ${index} line is ${index} header heights less its border: ${header.line}`);
        assert.notEqual(header.label, 'none', `Level ${index} shows its label while stuck`);
        // A browser with scroll-state queries shows the label by the query; any other marks the header.
        assert.equal(header.marked, !layout.scrollState, `Level ${index} marking with scroll-state support ${layout.scrollState}`);
        assert.notEqual(header.labelBackground, 'rgba(0, 0, 0, 0)', `Level ${index} label has badge background`);
        assert.notEqual(header.labelRadius, '0px', `Level ${index} label has badge radius`);
      }
      for (const [index, edge] of layout.edges.entries()) {
        assert.equal(edge.row, '0px', `Level ${index} row carries no top border`);
        assert.equal(edge.edge, 'none', `Level ${index} card top edge goes while the header is stuck`);
      }
      for (const [index, line] of layout.lines.entries()) {
        assert.ok(Math.abs(parseFloat(line) - layout.border) < 0.01, `Level ${index} header owns the line under it, one row border: ${line}`);
      }
      assert.equal(layout.titleTruncated, true, 'A long title is truncated');
      assert.equal(layout.actionRows, 1, 'Header controls stay on one line');

      // Scrolled back to the top, nothing is stuck and the level labels are hidden.
      await target.evaluate(() => { window.formStylesTest.container().scroller.scrollTop = 0; });
      await frames(target);
      const loose = await target.evaluate(() => [...document.querySelectorAll('.crudui-node--sticky > .crudui-node__header-container > .crudui-node__header')].map(header => {
        const label = header.querySelector(':scope > .crudui-node__label');
        if (!label) throw new Error('a sticky header has no label');
        return {
        label: getComputedStyle(label).display,
        edge: getComputedStyle(header, '::before').display,
        };
      }));
      assert.ok(loose.every(header => header.label === 'none'), `Level labels are hidden while headers are not stuck: ${loose.map(header => header.label).join(', ')}`);
      assert.ok(loose.every(header => header.edge !== 'none'), `A row that is not stuck draws its card top edge: ${loose.map(header => header.edge).join(', ')}`);
    } finally { await page.close(); }
  });

  test(`${engine} ${host}: without scroll-state queries, the binding marks stuck headers to show their labels and hide their card top edges`, async () => {
    const { page, target, failures } = await openHost(engine, host);
    try {
      // Act as Firefox or Safari: no scroll-state support and no container rule.
      await target.evaluate(([spec, data]: [unknown, unknown]) => {
        const supports = CSS.supports;
        CSS.supports = (...args: string[]) => !String(args.join(':')).includes('scroll-state') && supports.apply<typeof CSS, string[], boolean>(CSS, args);
        for (const sheet of document.styleSheets) {
          for (let index = sheet.cssRules.length - 1; index >= 0; index--) {
            const rule = sheet.cssRules[index];
            if (rule instanceof CSSContainerRule && rule.conditionText.includes('scroll-state')) sheet.deleteRule(index);
          }
        }
        window.formStylesTest.mount(spec, data);
      }, [spec, data]);
      const labels = () => target.evaluate(() => [...document.querySelectorAll('.crudui-node--sticky > .crudui-node__header-container')]
        .map(header => {
          const label = header.querySelector(':scope > .crudui-node__header > .crudui-node__label');
          if (!label) throw new Error('a sticky header has no label');
          return getComputedStyle(label).display;
        }));
      // The marking hides the card top edge as the query does.
      const edges = () => target.evaluate(() => [...document.querySelectorAll('.crudui-node--sticky > .crudui-node__header-container > .crudui-node__header')]
        .map(header => getComputedStyle(header, '::before').display));
      await frames(target);
      const top = await labels();
      assert.ok(top.every(display => display === 'none'), `Level labels are hidden while headers are not stuck: ${top.join(', ')}`);
      const topEdges = await edges();
      assert.ok(topEdges.every(display => display !== 'none'), `Card top edges show while headers are not stuck: ${topEdges.join(', ')}`);
      await target.evaluate(() => {
        const { scroller, top, token } = window.formStylesTest.container();
        const rows = document.querySelectorAll('.crudui-node--sticky');
        const last = rows[rows.length - 1];
        if (!last) throw new Error('the form has no sticky row');
        scroller.scrollTop += last.getBoundingClientRect().top - top - (4 * token - 10);
      });
      await frames(target);
      const stuck = await labels();
      assert.ok(stuck.every(display => display !== 'none'), `Level labels show while stuck: ${stuck.join(', ')}`);
      const stuckEdges = await edges();
      assert.ok(stuckEdges.every(display => display === 'none'), `Card top edges go while stuck: ${stuckEdges.join(', ')}`);
      // A re-render keeps the marks.
      await target.evaluate(() => {
        const input = document.querySelector<HTMLInputElement>('.crudui-form input[name]');
        if (!input) throw new Error('the form has no input');
        input.value += 'x'; input.dispatchEvent(new Event('input', { bubbles: true }));
      });
      await frames(target);
      const rendered = await labels();
      assert.ok(rendered.every(display => display !== 'none'), `Level labels still show after a render: ${rendered.join(', ')}`);
      const renderedEdges = await edges();
      assert.ok(renderedEdges.every(display => display === 'none'), `Card top edges stay hidden after a render: ${renderedEdges.join(', ')}`);
      await target.evaluate(() => { window.formStylesTest.container().scroller.scrollTop = 0; });
      await frames(target);
      const back = await labels();
      assert.ok(back.every(display => display === 'none'), `Level labels hide again at the top: ${back.join(', ')}`);
      const backEdges = await edges();
      assert.ok(backEdges.every(display => display !== 'none'), `Card top edges show again at the top: ${backEdges.join(', ')}`);
      assert.deepEqual(failures, []);
    } finally { await page.close(); }
  });

  test(`${engine} ${host}: focusing a row after an action or a map selection scrolls it clear of the sticky headers and the footer`, async () => {
    const { page, target, failures } = await openHost(engine, host);
    try {
      await target.evaluate(([spec, data]: [unknown, unknown]) => window.formStylesTest.mount(spec, data), [spec, siblingData]);
      const focused = () => target.evaluate(() => {
        const { top, height } = window.formStylesTest.container();
        // Focus is on a text input of a row.
        const active = document.activeElement;
        if (!(active instanceof HTMLInputElement)) throw new Error('no input is focused');
        const rect = active.getBoundingClientRect();
        const style = getComputedStyle(active);
        return {
          name: active.getAttribute('name'),
          value: active.value,
          offset: rect.top - top,
          bottom: rect.bottom - top,
          marginTop: parseFloat(style.scrollMarginTop),
          marginBottom: parseFloat(style.scrollMarginBottom),
          height,
        };
      });

      // Adding a store after the first one moves focus to the new row far below.
      await target.evaluate(() => {
        const row = [...document.querySelectorAll('#form .crudui-node--sticky')].find(node => node.querySelector<HTMLInputElement>('input[name$="[name]"]')?.value === 'stores one');
        if (!row) throw new Error('the form has no row stores one');
        const add = [...row.querySelectorAll<HTMLButtonElement>('[data-crudui-action="add-row"]')].find(button => button.closest('[data-crudui-row-key]') === row);
        if (!add) throw new Error('the row stores one has no add button');
        add.click();
      });
      await frames(target);
      const added = await focused();
      assert.deepEqual(failures, []);
      assert.match(added.name ?? '', /\[stores\]\[[^\]]+\]\[name\]$/, 'Focus moved to the new store row');
      assert.equal(added.value, '', 'The new store row is empty');
      assert.ok(added.marginTop > 0, 'A control in a sticky row keeps a top scroll margin');
      assert.ok(added.offset >= added.marginTop - 0.5, `The new row input is below the pinned headers: ${added.offset} vs ${added.marginTop}`);
      assert.ok(added.bottom <= added.height - added.marginBottom + 0.5, `The new row input is above the footer: ${added.bottom} vs ${added.height - added.marginBottom}`);

      // Scrolled to the end, selecting the first store from the structure map moves focus back
      // up; the binding scrolls its input into view clear of the pinned headers and the footer.
      await target.evaluate(() => { const { scroller } = window.formStylesTest.container(); scroller.scrollTop = scroller.scrollHeight; });
      await frames(target);
      await target.evaluate(() => {
        const button = [...document.querySelectorAll<HTMLButtonElement>('#outline [data-crudui-action="select-row"]')]
          .find(item => item.textContent.includes('stores one'));
        if (!button) throw new Error('the structure map has no row stores one');
        button.click();
      });
      await frames(target);
      const selected = await focused();
      assert.equal(selected.value, 'stores one', 'Map selection focused the first store row');
      assert.ok(selected.offset >= selected.marginTop - 0.5, `The store input is below the pinned headers: ${selected.offset} vs ${selected.marginTop}`);
      assert.ok(selected.bottom <= selected.height - selected.marginBottom + 0.5, `The store input is above the footer: ${selected.bottom} vs ${selected.height - selected.marginBottom}`);
    } finally { await page.close(); }
  });

  test(`${engine} ${host}: a restored focus keeps its visibility and a moved focus is visible, after pointer or keyboard input`, async () => {
    const { page, target, failures } = await openHost(engine, host);
    try {
      await target.evaluate(([spec, data]: [unknown, unknown]) => window.formStylesTest.mount(spec, data), [spec, siblingData]);
      const state = () => target.evaluate(() => {
        const active = document.activeElement;
        if (!active) throw new Error('the document has no active element');
        return {
          action: active.getAttribute('data-crudui-action'),
          name: active.getAttribute('name'),
          visible: active.matches(':focus-visible'),
        };
      });
      const toggle = async () => {
        const element = (await target.evaluateHandle(() => document.querySelector('#form [data-crudui-action="toggle-row"]'))).asElement();
        assert.ok(element, 'the form has a toggle');
        return element;
      };

      // Whether a pointer press focuses a button is the platform's convention: Chromium and
      // Firefox focus it, WebKit on macOS leaves the focus where it was. A plain button outside
      // the form shows the convention the restored focus must keep.
      const probe = (await target.evaluateHandle(() => {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = 'Probe';
        button.style.cssText = 'position:fixed;left:0;top:0';
        document.body.append(button);
        return button;
      })).asElement();
      assert.ok(probe, 'the probe button is placed');
      await probe.click();
      const pointerFocuses = await probe.evaluate(button => {
        if (!(button instanceof HTMLElement)) throw new Error('the probe is not an HTML element');
        const focused = document.activeElement === button; button.blur(); button.remove(); return focused;
      });
      if (drivers[engine].pointerFocusesButtons !== undefined) assert.equal(pointerFocuses, drivers[engine].pointerFocusesButtons, `${engine} pointer focus convention`);

      // A pointer press focuses the toggle, where the platform does, without visible focus. Every
      // change re-renders the form, so the toggle is a new element and its restored focus stays
      // without it; where the press focuses nothing, the render focuses nothing either.
      await (await toggle()).click();
      await frames(target);
      const pointerRestored = await state();
      await target.evaluate(() => {
        const button = document.querySelector<HTMLButtonElement>('#form [data-crudui-action="toggle-row"]');
        if (!button) throw new Error('the form has no toggle');
        button.click();
      });
      await frames(target);

      // A toggle focused visibly, as from the keyboard, keeps visible focus through the re-render.
      // Focusing the already focused toggle changes nothing, so its focus is released first.
      await target.evaluate(() => {
        const button = document.querySelector<HTMLButtonElement>('#form [data-crudui-action="toggle-row"]');
        if (!button) throw new Error('the form has no toggle');
        button.blur();
        button.focus({ focusVisible: true });
        button.click();
      });
      await frames(target);
      const keyboardRestored = await state();
      await target.evaluate(() => {
        const active = document.activeElement;
        if (!(active instanceof HTMLElement)) throw new Error('no element is focused');
        active.click();
      });
      await frames(target);

      // A pointer press on Add moves focus to the new row's first input, visibly.
      const add = (await target.evaluateHandle(() => {
        const row = [...document.querySelectorAll('#form .crudui-node--sticky')].find(node => node.querySelector<HTMLInputElement>('input[name$="[name]"]')?.value === 'stores one');
        if (!row) throw new Error('the form has no row stores one');
        return [...row.querySelectorAll('[data-crudui-action="add-row"]')].find(button => button.closest('[data-crudui-row-key]') === row);
      })).asElement();
      assert.ok(add, 'the row stores one has an add button');
      await add.click();
      await frames(target);
      const moved = await state();

      assert.deepEqual(failures, []);
      assert.deepEqual(pointerRestored, pointerFocuses
        ? { action: 'toggle-row', name: null, visible: false }
        : { action: null, name: null, visible: false },
      pointerFocuses ? 'A pointer-focused toggle is restored without visible focus' : 'A pointer press that focuses nothing leaves nothing focused after the render');
      assert.deepEqual(keyboardRestored, { action: 'toggle-row', name: null, visible: true }, 'A visibly focused toggle is restored with visible focus');
      assert.match(moved.name ?? '', /\[stores\]\[[^\]]+\]\[name\]$/, 'Focus moved to the new store row');
      assert.equal(moved.visible, true, 'The moved focus is visible');
    } finally { await page.close(); }
  });
}

for (const engine of engines) {
  test(`${engine} choice labels receive pointer activation`, async () => {
    const { page, target, failures } = await openHost(engine, 'page');
    try {
      await target.evaluate(() => window.formStylesTest.mountChoice());
      const input = target.locator('input[type="radio"][value="all"]');
      const label = target.locator('label', { hasText: 'All outcomes' });
      await input.click();
      assert.equal(await target.evaluate(() => document.querySelector<HTMLInputElement>('input[type="radio"][value="all"]')?.checked), true, 'The radio input itself remains pointer activatable');
      await label.click();
      assert.equal(await target.evaluate(() => document.querySelector<HTMLInputElement>('input[type="radio"][value="all"]')?.checked), true, 'Clicking the visible choice label checks its radio input');
      assert.equal(await target.evaluate(() => {
        const input = document.querySelector('input[type="radio"][value="all"]');
        if (!input) throw new Error('the form has no radio input');
        return getComputedStyle(input).opacity;
      }), '0', 'The native input is visually hidden without removing its hit target');
      assert.deepEqual(failures, []);
    } finally { await page.close(); }
  });
}

// Inline layout (docs/spec/form-markup.md, Layout): every field node of an inline group is one row
// of the label column and the control column, and a line group places its children side by side.
const inlineSpec = {
  type: 'group',
  properties: {
    look: {
      type: 'group',
      label: 'Look',
      design: { layout: 'inline' },
      properties: {
        theme: { type: 'select', label: 'Theme', items: { light: 'Light', dark: 'Dark' }, description: 'Applies to every window.' },
        bare: { type: 'text' },
        agree: { type: 'checkbox', label: 'Agree' },
        notify: { type: 'switcher', label: 'Notify', description: 'Shows a banner.' },
        sync: { type: 'button', label: 'Sync', content: 'Sync now' },
        run: { type: 'button', content: 'Run' },
        font: {
          type: 'group',
          label: 'Font',
          design: { layout: 'line' },
          properties: { family: { type: 'select', items: { mono: 'Mono', sans: 'Sans' } }, size: { type: 'text' } },
        },
      },
    },
  },
};

for (const engine of engines) {
  test(`${engine} inline layout aligns every control in the control column`, async () => {
    const { page, target, failures } = await openHost(engine, 'page');
    try {
      await target.evaluate(([spec]: [unknown]) => window.formStylesTest.mount(spec, {}), [inlineSpec]);
      await frames(target);
      const layout = await target.evaluate(() => {
        const box = (element: Element | null) => {
          if (!element) throw new Error('the form misses an element of the layout');
          const r = element.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
        };
        const node = (path: string) => {
          const found = document.querySelector(`#form [data-field-path="${path}"]`);
          if (!found) throw new Error(`the form has no node ${path}`);
          return found;
        };
        const part = (path: string, slot: string) => {
          const found = node(path).querySelector(`:scope > ${slot}`);
          if (!found) throw new Error(`the node ${path} has no ${slot}`);
          return found;
        };
        const probe = document.createElement('div');
        probe.style.width = 'var(--crudui-label-width)';
        const form = document.querySelector('#form .crudui-form');
        if (!form) throw new Error('the page has no form');
        form.append(probe);
        const labelWidth = probe.getBoundingClientRect().width;
        probe.remove();
        const paths = ['look.theme', 'look.bare', 'look.agree', 'look.notify', 'look.sync', 'look.run', 'look.font'];
        return {
          labelWidth,
          gap: parseFloat(getComputedStyle(node('look.theme')).columnGap),
          rows: paths.map(path => ({
            path,
            node: box(node(path)),
            body: box(part(path, '.crudui-node__body')),
            label: node(path).querySelector(':scope > .crudui-node__header > .crudui-node__label')
              ? box(node(path).querySelector(':scope > .crudui-node__header > .crudui-node__label')) : null,
          })),
          description: box(node('look.theme').querySelector('.crudui-node__description')),
          buttons: ['look.sync', 'look.run'].map(path => ({ path, body: box(part(path, '.crudui-node__body')), button: box(node(path).querySelector('button')) })),
          checks: ['look.agree', 'look.notify'].map(path => {
            const label = node(path).querySelector<HTMLLabelElement>(':scope > .crudui-node__header > label.crudui-node__label');
            const input = part(path, '.crudui-node__body').querySelector('input[type="checkbox"]');
            return { path, label: label ? box(label) : null, labelsInput: label !== null && label.control === input, input: box(input), body: box(part(path, '.crudui-node__body')) };
          }),
          family: box(node('look.font.family')),
          size: box(node('look.font.size')),
        };
      });
      assert.deepEqual(failures, []);
      const theme = layout.rows[0];
      assert.ok(theme, 'the layout has rows');
      const column = layout.labelWidth + layout.gap;
      for (const row of layout.rows) {
        assert.ok(Math.abs(row.body.left - row.node.left - column) < 0.5,
          `${row.path}: the control column starts after the label column (${row.body.left - row.node.left} px, expected ${column} px)`);
        if (row.label) {
          assert.ok(Math.abs(row.label.left - row.node.left) < 0.5, `${row.path}: the label starts the row`);
          assert.ok(row.label.top < row.body.bottom && row.body.top < row.label.bottom, `${row.path}: the label and the control share the first line`);
        }
      }
      // A button field, with or without a label, starts the control column and is as wide as its content.
      for (const { path, body, button } of layout.buttons) {
        assert.ok(Math.abs(button.left - body.left) < 0.5, `${path}: the button starts the control column`);
        assert.ok(button.right - button.left < (body.right - body.left) / 2, `${path}: the button is as wide as its content (${button.right - button.left} of ${body.right - body.left} px)`);
      }
      // A checkbox or switch field writes its label in the label column, and its input starts the
      // control column and is centered on the label line.
      for (const { path, label, labelsInput, input, body } of layout.checks) {
        assert.ok(label, `${path}: the label is in the label column`);
        assert.ok(labelsInput, `${path}: the label of the label column targets the input`);
        assert.ok(label.right - theme.node.left <= layout.labelWidth + 0.5, `${path}: the label ends within the label column`);
        assert.ok(Math.abs(input.left - body.left) < 0.5, `${path}: the input starts the control column (${input.left - body.left} px)`);
        const middle = (box: { top: number; bottom: number }) => (box.top + box.bottom) / 2;
        assert.ok(Math.abs(middle(input) - middle(label)) < 1, `${path}: the input is centered on the label line (${middle(input) - middle(label)} px)`);
      }
      assert.ok(Math.abs(layout.description.left - theme.body.left) < 0.5, 'The description is in the control column');
      assert.ok(layout.description.top >= theme.body.bottom - 0.5, 'The description is below the control');
      assert.ok(layout.family.top < layout.size.bottom && layout.size.top < layout.family.bottom && layout.size.left >= layout.family.right,
        `The children of a line group sit side by side (${JSON.stringify([layout.family, layout.size])})`);
    } finally { await page.close(); }
  });
}

// Switches (docs/spec/form-markup.md, Switches): a switcher input is drawn as a track wider than it
// is high with a thumb at its start, the track takes the accent color and the thumb moves to the
// end when the switch is on, and a focused switch has an accent outline.
for (const engine of engines) {
  test(`${engine} a switcher is drawn as a track and thumb`, async () => {
    const { page, target, failures } = await openHost(engine, 'page');
    try {
      await target.evaluate(() => window.formStylesTest.mount({ type: 'group', properties: { sync: { type: 'switcher', label: 'Sync' } } }, {}));
      await frames(target);
      const states = await target.evaluate(() => {
        const input = document.querySelector<HTMLInputElement>('#form input[role="switch"]');
        if (!input) throw new Error('the form has no switch');
        const probe = document.createElement('div');
        probe.style.color = 'var(--crudui-accent)';
        const form = document.querySelector('#form .crudui-form');
        if (!form) throw new Error('the page has no form');
        form.append(probe);
        const accent = getComputedStyle(probe).color;
        probe.remove();
        const state = () => {
          const style = getComputedStyle(input);
          const box = input.getBoundingClientRect();
          return {
            checked: input.checked, width: box.width, height: box.height, background: style.backgroundColor,
            thumb: style.backgroundImage, position: style.backgroundPositionX,
            outline: `${style.outlineStyle} ${style.outlineWidth} ${style.outlineColor}`,
          };
        };
        const off = state();
        input.click();
        const on = state();
        input.focus();
        const focused = state();
        return { accent, off, on, focused };
      });
      assert.deepEqual(failures, []);
      const { accent, off, on, focused } = states;
      assert.ok(off.width > off.height * 1.5, `The track is wider than it is high (${off.width} x ${off.height} px)`);
      assert.match(off.thumb, /radial-gradient/, 'The thumb is drawn on the track');
      assert.equal(off.position, '0%', 'The thumb is at the start of an off switch');
      assert.notEqual(off.background, accent, 'An off track is not the accent color');
      assert.equal(on.checked, true, 'A click turns the switch on');
      assert.equal(on.background, accent, 'An on track is the accent color');
      assert.equal(on.position, '100%', 'The thumb is at the end of an on switch');
      assert.equal(focused.outline, `solid 2px ${accent}`, 'A focused switch has an accent outline');
    } finally { await page.close(); }
  });
}
