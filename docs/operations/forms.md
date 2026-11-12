# Form development and verification
<!-- doc-id: docs-operations-forms -->

[한국어](forms.ko.md). The contract is [form runtime](../spec/form-runtime.md).

## Setup

Run commands from the repository root. Install Node.js and npm, then run:

```sh
make install-tools TOOLS=npm
make install-packages
make install-tools
export PATH="$PWD/var/tools/bin:$PATH"
npm ci --strict-allow-scripts
npm run build
```

Dependency updates resolve the version ranges in package manifests and update
the lock file with npm. Review the resulting graph and run the checks below.
Review install-script changes and use `npm install-scripts approve <package>` to
update the independent graph's root `allowScripts` field with exact versions.
Run `npm rebuild` to execute newly approved scripts in an existing installation.

PHP with Composer dependencies, Go and Rust are needed for four-language checks.
Install PHP dependencies with `composer install` in `legacy/packages/validator/php`.
No container is required when these toolchains are available locally.

## Build before loading data

```tsx
import { compileForm, createForm, sequenceRowKey } from '@polyspec/crudui-generator-core';
import { Form } from '@polyspec/crudui-generator-react';

const template = compileForm({
  type: 'group',
  properties: {
    stores: {
      type: 'group', multiple: { copy: true, sortable: true },
      properties: { name: { type: 'text', validate: { required: true } } },
    },
  },
}, { keyPrefix: 'form' });
const cached = JSON.stringify(template);
const form = createForm(JSON.parse(cached));

function StoreForm() {
  return <Form form={form} />;
}

form.setData({ stores: { [sequenceRowKey(42)]: { name: 'Store' } } });
const copied = form.copyRow('stores', sequenceRowKey(42));
form.rekeyRow('stores', copied, sequenceRowKey(43));
const submission = form.getData();
```

Keep the template in the shared cache and create an independent form instance for
each rendered form. Call `setData` when a record load finishes. Vue and Svelte
also accept the `form` prop. Framework packages export the same core functions.
React exports `renderForm(form)` from `@polyspec/crudui-generator-react/server`; Vue and
Svelte export their rendering functions from their package entries. Vue returns a promise.
Compile `$ref` files before rendering.

A server sends the [complete form](../spec/form-runtime.md#complete-form): the form element,
hidden fields, the entered values, the errors and the buttons come from one call, and the
rest of the page writes no part of the form itself. Pass the validation result's errors unchanged or
with replacement texts:

```ts
import { validate } from '@polyspec/crudui-validator';
import { renderForm } from '@polyspec/crudui-generator-html';

const result = validate(spec, submitted);
const form = createForm(template, submitted, { language: 'en' });
const html = renderForm(form, {
  action: { method: 'post', url: '/members' },
  hidden: { _csrf: token },
  formErrors: result.valid ? [] : ['Check the marked fields.'],
  errors: result.errors,
});
```

PHP calls `Generator::renderForm($form, $options)` with the same members, Go
`RenderForm(form, options)` and Rust `render_form(&form, Some(&options))` with an ordered JSON
object. Connect a browser binding to the `crudui-form` element, not to the `form` element:
`connectForm` synchronizes every named control inside its element with the instance data.

For framework-independent HTML, use the peer renderer package:

```ts
import { connectForm, patchContent } from '@polyspec/crudui-generator-core';
import { renderForm, renderList } from '@polyspec/crudui-generator-html';

patchContent(host, renderForm(form));
const connection = connectForm(host, form);
form.subscribe(() => {
  patchContent(host, renderForm(form));
  connection.sync();
});
const listHtml = renderList(listSpec, rows, { layout: 'table' });
```

`patchContent` replaces the host's content with the new markup and keeps every node the
markup still contains, so a re-render keeps the focused control, its selection and an input
method composition; `connection.sync()` then sets the live control values. A script in new
markup runs once, after that markup is in place; a kept script never runs again
([script rule](../spec/form-runtime.md)). Render the first client markup with `patchContent`
as well: markup set through `innerHTML` never runs its scripts.
The HTML renderer returns fragments and does not create the outer `form` element,
bind browser events, validate data or load records.

Validate `submission` with `validate(spec, submission)` from `@polyspec/crudui-validator`
and the original spec. The server assigns saved sequences; apply each returned key to its specific
collection path. Never replace a token across the entire data object.

## Checks

```sh
npm run test:forms
npm test -w @polyspec/crudui-validator
make docs-check
```

Run the server validation cases from the repository root:

```sh
COMPOSER_VENDOR_DIR=../../../vendor node node_modules/@polyspec/kit/dist/run-tests.mjs phpunit --cwd legacy/packages/validator/php -- --filter ValidateConformanceTest
node node_modules/@polyspec/kit/dist/run-tests.mjs go --cwd legacy/packages/validator/go -- ./validator/validate
node node_modules/@polyspec/kit/dist/run-tests.mjs cargo -- --locked --manifest-path packages/validator/rust/Cargo.toml --test validate_conformance
```

`test:forms` builds current packages and runs core, SSR and mounted DOM tests.
The shared DOM scenario covers late data injection, edits, nested row operations,
saved keys, checkboxes, dates, language fields and conditional display. DOM tests
use jsdom; they do not establish external editor or browser file-picker behavior.
`tests/form-styles.test.mts` checks the layout of `crudui.css` in Chromium, Firefox and
WebKit: sticky header stacking, the level label and its `data-crudui-stuck` fallback, one-border
seams, row card edges and focus scrolling, each in a page, a scrolling box and a frame. Every
engine runs the same scenarios; Chromium and Firefox are driven by Puppeteer, WebKit by
Playwright, each at the build that the locked package pins; `node scripts/install-browsers.mts
chrome firefox webkit` installs them (on Linux with `--with-deps` for WebKit). A missing browser fails
the run with the command that installs it; no engine is skipped. The [browser validation](validation.md#browser-validation) check of
`packages/form-binding/tests/browser.test.ts` runs in the same three engines.
`tests/viewport.test.mts` places the expected HTML of the 432 shared render cases at 360 and
1280 CSS pixels and requires no horizontal overflow of the document, and
`tests/tailwind-styles.test.mts` compiles the import of `crudui.css` into the layer `components` with
Tailwind CSS and requires the computed styles of `crudui.css`, both in the same three engines. No file
is generated from `crudui.css`, so a change of `crudui.css` needs no other file to be committed.
`tests/widget-script-runs.test.mts` runs the script rule in the same three engines for the HTML,
React, Vue and Svelte renderers, each rendered in the browser and rendered on the server and
hydrated: a form row script and an `html` list cell script run once on the first render and
once for each added row, and never on typing, a copied or moved row, a reload or a list re-render;
the script of a list script action runs on each click of its button.
Record current results in [features](../features.md) and [changelog](../../CHANGELOG.md).

The Svelte package build emits JavaScript, preprocessed Svelte components and
TypeScript declarations into `dist`. Public export entries reference these
packaged files. The package build of a project compiles components for its browser or SSR target.

Run `npm run test:packages` to build and pack all JavaScript packages, install
them into an isolated install project, check exported files and declarations,
and compile a production application using all three form components. The install
project installs with `npm ci --offline` from a lock that `scripts/install-lock.mts`
derives from the root `package-lock.json`: the packed packages as `file:` tarballs and
the root lock entries of every registry package that npm resolves for the install project, so
it installs the releases of the root lock from the npm cache of `make install` and
resolves no range against a registry. A passing
check removes the temporary install project. A failing check keeps it with
`failure.log` and prints its path.

## Package declaration checks

The JavaScript bundler generates runtime modules. The TypeScript compiler
generates declarations from public entries with `noEmitOnError`, independently
of the bundler. Svelte components and declarations use the package compiler.

```sh
npm run test:build
npm run test:build:repeat
npm run test:packages
```

See the [package build contract](package-build.md) and
[build checks](../../tests/build/README.md) for the verification scope.
