# Form verification
<!-- doc-id: docs-operations-form-comparison -->

[한국어](form-comparison.ko.md).

This contract defines the repository's HTTP, browser and persistence verification
for nested forms. The implementation and its verifier are stored in this
repository. Verification runs against the current repository tree, committed or
not, and records that tree's source identity. It does not read source files from
another checkout.

## Canonical example and benchmark boundary

The public root is the full CRUDUI feature example. It presents one record flow,
`List → Detail → Form → Save → List refresh`, over the one record resource below. CRUDUI
generates the list, detail, links, form, validation and submission of that record. The page
selects one of five servers: `js` (the public Node server itself), `php`, `php-ext` (PHP with
the CRUDUI and OrderedJSON extensions), `go` and `rust`; one of four clients: `html`, `react`,
`vue` and `svelte`; the initialization, `csr` or `ssr`; and the form mode, `bindForm` or
`createForm`. External stage buttons, parent-side fake stage routing and form frames are not
part of the page.

`/benchmark-console/` and `/benchmark/` are separate verification screens. They own the nested
companies scenario (`src/scenario.mjs`), the render and validation matrices, the side-by-side
initialization comparison and the benchmark controls; the companies scenario is used nowhere
else. The canonical page embeds none of them. `/displays/` is not a route.

## Record resource

**Specifications.** `examples/form-comparison/fixtures/customer-specs.json` holds the three
specifications of the customer record: `list`, `detail` and `form`. The record members are
`id`, `name`, `status`, `joined`, `score`, `relation.name`, `avatar`, `markup` and
`companies`. The list shows every member except `companies` and links each record to its
detail; the detail shows every member except `avatar` and `companies` and links the record to
its form; the form edits `name`, `status`, `joined`, `score`, `relation.name`, `markup` and
`companies`, shows `id` read-only (`dummy-input`) and has no `avatar` field. The list declares
no sort: it shows the records in store order.

`companies` is the repeated part of the form: companies (at most 4, copied and sorted, sticky
headers, a required `name`), each with stores (the same row operations, a required `name`, a
checkbox `enabled` defaulting to `1`, `detail` notes shown only while `.enabled` is set, and a
`title` in `ko` and `en`), each with departments (a `name`). Its value is keyed rows:
`{ key: { name, stores: { key: { name, enabled, detail, title: { ko, en }, departments: { key:
{ name } } } } } }`, members in this order, every leaf a string and every key a row key
(`__` + 13 digits or lowercase hexadecimal letters + `__`). The benchmark form of `src/scenario.mjs`
takes this group from the same file, so both declare it once.

**Fixture.** `examples/form-comparison/fixtures/customer-records.json` holds the 45 seeded
records in id order, `"1"` to `"45"`, with `score` as a JSON number. Their companies differ in
the number of companies, stores and departments, and some stores are not `enabled` while their
`detail` keeps its text. The build publishes both
files unchanged in the public directory as `customer-records.json` and `customer-specs.json`,
and every server reads them from there. No program keeps its own copy of the records.

**Store.** Every server owns one persistent store, `records-{server}.json` in its data
directory. The file holds the records array in id order, with the
member order of the fixture. A missing file is seeded from the fixture on its first read; an
unreadable or malformed file fails the request with 500 and is not replaced. A file is malformed
unless it is a JSON array of records with exactly the fixture's members in order, `score` a number
and every other scalar a string, and `companies` in the shape of the form, complete and in member
order: a store file is never completed the way a submission is. Reset replaces any
store file, malformed or not, with the fixture; it is the way to recover a store. Writes are serialized: the
JavaScript server queues them in its one process, and the PHP, Go and Rust servers take an
exclusive lock on `records-{server}.json.lock` for the read and the write. A write
replaces the file atomically through a temporary file in the same directory. Saved values are what the list, the
detail and the form show next, also after a restart.

**HTTP contract.** The paths below are each server's own paths. The public server forwards
`/api/{server}/records…` for `php`, `php-ext`, `go` and `rust` to `/api/records…` of that
server and answers `/api/js/records…` itself. Every response of the public server is
`application/json; charset=utf-8` or `text/html; charset=utf-8` with `Cache-Control: no-store`
and `X-Content-Type-Options: nosniff`, and every JSON response escapes `<`, `>` and `&` as
`\u003c`, `\u003e` and `\u0026`, so a request value reflected in a failure cannot close a
script or comment element in any interpretation. Every failure is
`{ "error": message, "server": … }`.

| Request | Success | Failure |
| --- | --- | --- |
| `GET /api/records?page={n}` | 200 `{ page, perPage: 20, total, records }`: page `n` in id order | 400 `Expected one page parameter` unless the query is exactly one `page`, a decimal integer from 1 without sign or leading zero; 404 `Page not found` beyond the last page |
| `GET /api/records/{id}` | 200 `{ record }` | 404 `Record not found` for an id that is not stored, including `0` and an id with a leading zero |
| `POST /api/records/{id}` | 200 `{ record, validation: { valid: true, errors: [], hidden } }` | below |
| `POST /api/records/reset` | 200 `{ total: 45 }`; the store equals the fixture | 400 for a request with a body |
| `GET /api/records/view/{view}?…` | 200 `{ view, html, data }` | below |

Another method on these paths answers 405 with an `Allow` header naming the methods the target accepts (`GET` on a page, `GET, HEAD` on a file).

A save accepts the native form, `multipart/form-data` or `application/x-www-form-urlencoded`
with exactly the fields `form[…]` and `_form_complete=1` as the rendered form posts them, and
JSON with exactly the member `form`: `{ "form": { … } }`; another field or member answers 400. The submitted object holds the form members `id`, `name`, `status`, `joined`,
`score`, `relation` (with `name`), `markup` and `companies`, each scalar a string and
`companies` in the shape above, and no other member. `id` must be present. Any other member
may be absent, as form data leaves out a field that holds no value (a new row's untouched text
field) and a native form leaves out an unchecked `enabled` and a collection without rows: the
server completes an absent text or checkbox member as `""`, an absent `title` as
`{ "ko": "", "en": "" }`, an absent `relation` as `{ "name": "" }` and an absent collection as
no rows, in both media types, so they store the same record. The benchmark save and validation of the same `companies` data apply this
same rule, so each server checks the companies shape in one place. The server
answers 404 for an unknown id, 415 for another media type, 413 above 2 MiB, and 400 for
malformed input, a missing completion field, a repeated native field, a missing `id`, an additional or non-text member, a key
that is not a row key, an `enabled` other than `""` or `"1"`, or an `id` other than the path
id. A body over 2 MiB is answered with 413 as soon as it passes the limit: the server reads no
further and closes the connection, so a client cannot hold it by declaring a large body and
sending it slowly. It then validates the submission with its own validator and the
`form` specification and answers with the validator's result as `validation`, its members
`valid`, `errors` and `hidden` unchanged ([validation result](../spec/validation-rules.md#evaluation)); an
invalid submission answers 422 `{ validation }`. A valid submission answers 200 and stores the previous record with the submitted `name`, `status`,
`joined`, `relation.name`, `markup` and `companies` (its rows in submitted order with their
submitted keys; a store's `detail` is kept while it is hidden), and `score` as the JSON number
its decimal text denotes; `id` and `avatar` keep their stored values. No failure changes the store file. A store
file that cannot be read as the record list answers 500 and is left as it is.

A view request renders one stage of an SSR document. Its query is exactly `lang` (`ko` or
`en`), `server` (the responding server), `framework`, `initialization=ssr`, `mode` and `page`,
each once and in this order, preceded by `id` for `detail` and `form`; any other query, and an
`id` that is not a decimal integer from 1 without sign or leading zero, answers 400. An unknown
view, a page beyond the last page and a well-formed id that is not stored answer 404. In
`/api/records/{id}` the id is the path segment as written, without percent-decoding: any segment that is not a stored id, `%32%32` included, answers 404. The response holds:

- `html`: for `list`, the list of that page rendered with `layout: table`, the page and the
  stored total; for `detail`, the detail of the record; for `form`,
  `<form id="record-form" method="post" action="/api/{server}/records/{id}" enctype="multipart/form-data">`,
  the form rendered from the record with key prefix `form`, and `</form>`. Every list link is
  `/detail?id={id}&` and every detail link `/form?id={id}&`, followed by the selection query
  `lang`, `server`, `framework`, `initialization`, `mode`, `page` in that order. The HTML is
  byte-identical across servers;
- `data`: `{ page, perPage, total, records }` for `list` and `{ record }` for `detail` and
  `form`.

`src/record-contract.mjs` computes the expected value of every response above with the shared
JavaScript renderers and validator. The other servers use their own generators and validators
and must produce the same bytes and results.

**Record servers.** Every record server takes its listening address, its data directory, its
public directory and the source identity file: the Go and Rust binaries and
`servers/javascript/main.mjs` as arguments in that order. A PHP server is PHP-FPM behind nginx,
the way PHP runs in production: `servers/php/main.mjs {address} {run directory} -- {php-fpm
arguments}` writes both configurations into the run directory, starts `php-fpm` and `nginx` from
the `PATH`, prints its readiness line once both accept connections and stops both when it stops.
It learns that from their own log lines on standard error, without a time limit and without
connection attempts: PHP-FPM writes `NOTICE: ready to handle connections` after it listens on its
socket, and nginx, at the `notice` log level, writes `start worker processes` after it opened its
listening socket. The program binds the listening address itself and passes the socket to nginx as
file descriptor 3, which the variable `NGINX` names, so nginx listens on the port that the program
took.
nginx passes `/api/` requests to `servers/php/api.php` over FastCGI, answers every other path with a JSON 404,
and ends a request body above 2 MiB with the JSON 413 of the contract before PHP reads it; the
data and public directories reach that script as `FORM_DATA_DIRECTORY` and
`FORM_PUBLIC_DIRECTORY`. PHP's built-in server reads a whole body before it runs the script, so
it could not stop an oversized request. The public server
takes its address, its data directory, its public directory and the JSON map of the native
server ports as arguments; it answers the `js` records with the same module that
`servers/javascript/main.mjs` serves, and it receives the build state over IPC. Each server
listens on the requested address, port 0 included, and then prints its readiness line
`CRUDUI_READY {server} {host}:{port}` with the address it took. The local checks start every server
on `127.0.0.1:0` and reach it on the address of that line, so no port is chosen before the server
that listens on it.

## Canonical page

The page has three addresses: `/` (list), `/detail` and `/form`. The query holds `lang`,
`server`, `framework`, `initialization`, `mode` and `page`; `detail` and `form` also take `id`,
and the list takes `saved` after a save. A missing selection member takes its default (`ko`,
`js`, `html`, `csr`, `bindForm`, `1`); an unknown value answers 400, and a page beyond the last
page or an unknown id answers 404; both failures are JSON `{ "error": message }`. Every link the page or CRUDUI generates carries the whole
selection in the order above, so the page and the selection survive every step. The selection
controls `#server`, `#framework`, `#initialization` and `#mode` and the pagination navigate with
the changed member.

The document has one stage, `<section id="stage" data-view="{view}" …>`:

- **SSR**: the public server requests the view from the selected server
  (`/api/records/view/…`), writes its `html` into the stage and its `data` as
  `<script type="application/json" id="crudui-stage-data">` with `<`, `>` and `&` written as
  JSON escapes. The selected client takes over that markup with the same data, under each
  adapter's hydration rule below. The stage is in the initial HTML, as view-source shows it.
- **CSR**: the stage is empty and the document has no stage data. The selected client requests
  the JSON of the selected server (`/api/{server}/records?page=…` or
  `/api/{server}/records/{id}`) and renders the view in the browser: `html` with
  generator-html's list, detail and form renderers, `react`, `vue` and `svelte` with their
  `List`, `Detail` and `Form` components. No server HTML is inserted.

The form is rendered in the stage in the selected mode: `bindForm` with its page
controller, `createForm` with a form session. A submit event of `#record-form`, from its Save
button or from Enter in a field, sends the form's native fields as `multipart/form-data` to
`/api/{server}/records/{id}`. On 200 the page navigates to `/?{selection}&saved={id}` with the
same page; on 422 it shows the validation result in the form and stays. A failed request or an
answer outside 200 and 422 shows `<div id="save-errors" role="alert">` before the form with the
save-failed text of the page language and the failure, keeps the entered values, and leaves the
form submittable again. The list with `saved`
shows `<p id="saved-notice" role="status" data-record-id="{id}">` with the saved notice in the
page language; under SSR the notice is in the initial HTML.

When a view is interactive, the page posts
`{ type: 'crudui:pipeline-ready', view, server, framework, initialization, mode, page, id }`
to its own window, with `page` a number and `id` null on the list. A view that cannot
initialize fails with a script error. Checks wait for this event and never infer readiness from
the DOM.

The document carries its whole selection on `<html data-pipeline-selection="…">`, and the page
script fails before it renders when any member differs from the URL selection: a stale document
of another selection fails instead of taking over foreign stage markup.

The canonical page takes every SSR stage from the selected server and every record from that
server's store; the public server renders a stage only when `js` is selected.

## Canonical flow check

`src/pipeline-flow.mjs` checks this page for 40 combinations: five servers, four clients and
two initializations. The form mode alternates so that every server and every client runs both
modes, and the submission alternates between the Save button and Enter. Each combination edits
its own record on page 2 of its server's store (ids 21 to 28) and:

1. requests the list, detail and form documents and requires the rendered stage and the stage
   data in SSR documents, and an empty stage without stage data in CSR documents;
2. opens the list at page 2, follows the record's detail link and then its form link, and
   requires each address and each readiness event;
3. requires the read-only id, replaces the score, unchecks `enabled` of the first store of the
   first company and requires its `detail` to be hidden, adds a department row to that store
   (the add-row action of its last department row, or of the collection footer when it has no
   departments) and names it, submits, and requires the list address with the same page
   and `saved`, the visible saved notice of the record and the new score in the record's row as
   the shared list model formats it;
4. requires the selected server to have stored the score, that store with `enabled` `""` and
   its `detail` unchanged, and the new department as the last row of its departments, and
   under SSR requires the notice and the score in the initial HTML of the list.

Each combination is one unit with its own timeout, in its own browser context; four run at a
time. A unit prints its start with its limit, its elapsed time every 15 seconds and its result
with its duration. A unit that reaches its limit fails with its id and closes its browser
context. The limit of one combination is ten times the slowest combination measured on the
first run of the implemented flow; until that measurement it is 60 seconds. Before the
combinations run, each server's store is reset through the public API, one unit per server.

The combinations run against a local stack built from the checkout
(`pipeline.browser.mjs`, one test per combination) and, in the local verification below, through
`check-pipeline.mjs`. `record-stores.test.mjs` runs the HTTP contract cases
of `src/record-contract.mjs` against all five servers started from the checkout, each case with
its own timeout. Both local checks first build the server programs, each as a step without a time
limit that prints its progress: both PHP extensions, the Go binary and the Rust debug binary.
`LOCAL=1` selects the folder of `polyspec/ordered-json-php-ext` that a checkout of `.links` provides, as kit's
`link providers --ecosystem composer` prints it; its extension is built from that package folder as the release one is, and
Rust commands run through kit's `link cargo`, which patches the checkouts of `.links`.
Without `LOCAL=1`, the explicit release source is the OrderedJSON php-ext package that `make ordered-json-ext` built with PIE from the packages.json repository of OrderedJSON, and recorded in `var/ordered-json-package` (C17.84, C17.90).
A missing `.links` provider or source fails; it does not select the release archive. The local stack then starts its five processes at the same time and its browser.
A process start and the browser start are long operations without a limit: each ends at its
readiness event or its launch and prints a line with its elapsed time every 15 seconds while it
waits. The test hooks that run these operations are setups without a limit. A test process that
ends without stopping the servers it started, for example after a failed hook and a forced exit,
stops their process groups at its exit, so no server outlives the run. `npm run test:form-comparison:pipeline` runs both, and the CI job
`form-comparison-pipeline` runs that command.

## Progress, limits and scope

Three rules hold for every command in this contract: the local builds, the local stack, the local
verification and every check.

1. **A run reports what it is doing while it runs.** No check waits with only a
   start and an end. Every step prints a start line, a line with its elapsed time
   every 15 seconds while it runs, its output under its step name, and a line that
   says passed or failed with the duration. Nested units report the same way, as progress lines of the form
   `[label] unit: started|running|passed|failed|timed out`: each build step,
   each browser report, each check phase, the browser start and close (long operations without a limit), each
   canonical flow combination and every wait.
2. **A long operation holds no time limit; a unit holds its own.** A step, such as a build or
   a verification check, a process start, a browser start or close and every wait are long operations: each
   runs to its end, its exit status, readiness event or result decides it, and it
   holds neither a total limit nor an inactivity limit. A unit, such as a browser
   report, a check phase or a canonical flow combination, is a short verification and
   holds its own limit, three times its slowest measured duration, rounded up to five
   seconds and at least ten seconds (`measuredLimitMs`); the code names the
   measurement it comes from. A stopped process tree, its process group and every
   descendant that left the group, gets `SIGTERM` and, after the grace, `SIGKILL`, and
   a stopped check closes its browser on `SIGTERM` instead of waiting for `SIGKILL`.
3. **A check runs where it belongs.** CI runs the source suite, the record-store contract, the Go
   and Rust server tests, the canonical flow check and the local verification. During development
   only the tests of the changed code run.

## Source identity

The source identity of a tree is its checked-out commit and the SHA-256 digest of
its uncommitted changes. The digest covers every path `git status` reports,
including untracked files other than operator-local editor settings, in sorted order: the path and the digest of its content,
or its deletion. A tree without uncommitted changes has `changes: null`. Identity
comparison ignores inode, device and change times.

The local stack writes the identity to `source.json` in the public directory. The PHP, Go and Rust
servers read that file on every health, generation and SSR response. The main page and the frames fetch it when they load.
No build embeds a commit.

## Builds and browser readiness

`make build-php-ext` builds `polyspec_crudui.so` into `var/php-ext` with `phpize`, `configure` and `make`. The local run builds
the selected OrderedJSON extension through its provider build in local mode. Release mode copies its declared build path
and `composer.json` together before running `phpize`, `configure` and `make`. The provider's `composer.json` declares
`php-ext.extension-name`, `php-ext.build-path` and the version; those declarations determine the module path and the
`FORM_JSON_EXTENSION` passed to native PHP processes. The PHP of the build is the one that `phpize` and `php-config` on `PATH` belong to. A failed command does not select another executable or build
path.

The form-comparison CI job installs the root npm graph and the Composer graphs
for the PHP validator and generator before it runs the source and generator
construction suites. A clean checkout does not use an ignored `vendor/` directory.

Browser verification registers the host callback for main-page readiness before
navigating. The main page publishes readiness after both initial comparison
frames publish their readiness events. The verifier waits for the host callback
without keeping a browser evaluation call open. The modules of `public/` are served
as they are and use only browser-resolvable relative imports. The build bundles every
other module that a page loads: the benchmark console with the source modules it
imports (`browser-job.mjs`, `frame-readiness.mjs`, `frame-pointer.mjs`,
`runtime-paths.mjs` and the snapshot module of the form inspector), the frames and the
page stages. No source module is copied to the public directory. Source verification
serves `public/` over HTTP and loads in Chromium the module that the page script
imports. A frame that
cannot initialize publishes the reason instead of a readiness event, and the page
fails with that reason. A script error, page failure or page close before
main-page readiness rejects the current server run and records the failure. The
readiness wait does not remain pending after an observed initialization failure.
The verifier also subscribes to the exact job and renderer events before it starts
the corresponding operation. It awaits the operation promise and the renderer
completion signal before reading the result. It does not infer page readiness,
frame readiness, validation completion or rendering completion from periodic DOM
reads or elapsed time. A time limit may fail a browser operation that stops
publishing progress, but reaching that limit cannot produce a successful result.

## Implementations and requests

This section and the next three describe the benchmark console's form matrix; the
canonical page uses the record resource above. PHP, the PHP extension, Go and Rust
implement the same compile, render, validation, persistence and SSR request contract. Each server uses its own
generator and validator. The PHP extension process loads `polyspec_crudui.so` and the OrderedJSON module named by
its provider Composer metadata; the PHP process loads neither extension.
The PHP process loads the root Composer autoloader and its generator and validator source packages.
The native process loads the separate `examples/form-comparison/servers/php/native/composer.json` profile.
Preparation installs that profile's locked PHPUnit dependency and application PSR-4 classes into a run-specific vendor
directory with standard Composer. The profile excludes the PHP generator, validator and OrderedJSON libraries because
the extensions provide those APIs. `FORM_PHP_AUTOLOAD` selects its generated autoloader; native PHPUnit also receives
`COMPOSER` and `COMPOSER_VENDOR_DIR`. The pure PHPUnit controller passes `FORM_PHP_NATIVE_AUTOLOAD` to children that
load the OrderedJSON extension. In the PHP extension process every
declared class under `Polyspec\Crudui\`, other than the classes of the form comparison under
`Polyspec\Crudui\FormComparison\`, must be internal to the extension (`ReflectionClass::isInternal()`):
the process checks it when it starts its generation and again before each response, and a class
that PHP loaded from a source file instead fails the request with HTTP 500 and the name of that
class. The PHP extension therefore never falls back to the PHP library.
Every PHP provenance response from health, generation and SSR reports `Generator`
and `Form` from the generator source directory and `Validator` from the validator source directory
in the PHP process, and the extension in the PHP extension process. Result verification uses one
class location contract and accepts only these reported locations.

The public API accepts only
`/api/{server}/{action}/{renderingPath}/{framework}`. A stack runs
exactly one PHP process, one PHP extension process, one Go process and one Rust
process. The public process forwards each accepted request to the selected process as
`/api/{action}/{renderingPath}/{framework}`. The API contains no implementation
revision or data-shape segment. `bindForm` and `createForm` select the rendering
and editing path. Keyed objects define repeated instance data and do not select
an implementation or URL.

The frame page's form has `novalidate`: the frame validates with the CRUDUI validator and shows
that result, and its checks send invalid submissions to the servers on purpose. The canonical
page's form keeps the browser's constraint validation.

The `ssr` action serves the frame document of one rendering path and framework. Its
query is exactly `lang` (`ko` or `en`), `server` (the responding runtime) and
`initialization=ssr`, each once; every other query is rejected with `Expected lang,
server and initialization for this SSR frame`. The server reads the built frame page
`{public}/frames/{renderingPath}-{framework}/index.html`, which must contain exactly one
`<html>` start tag, one empty form view `<div id="form-view"></div>` and one `</body>`;
every other document is rejected with `The frame document must contain one html start
tag, one empty form view and one body end tag`. The response is that page with three
insertions and no other change: the language on the html start tag, the form rendered
from the stored record inside the form view, and the record and generator provenance as
`<script type="application/json" id="crudui-ssr">` immediately before the body end tag,
with `<`, `>` and `&` written as JSON escapes. It is sent as `text/html; charset=utf-8`
with `Cache-Control: no-store`.

The browser runs the `bindForm` and `createForm` rendering paths. Both paths use
the same packages from the same source tree, the same keyed data and the same
submission contract. The selected server compiles one data-independent template,
and the browser restores that template from JSON. The `bindForm` path evaluates
field models from the template and current data; its page controller
updates keyed data and binds the fields again after input and row operations. The
`createForm` path creates an editable form session from the same template and uses
the session for data replacement and row operations. Compile failures are returned
as failures; the browser does not compile a replacement template.

The comparison screen of `/benchmark-console/` selects a server, framework and rendering path and shows server-side
and client-side rendering of the same form side by side, with the same template,
record and language. The left frame (`initialization=ssr`) is the frame document of the
selected server (PHP, the PHP extension, Go or Rust): it arrives with the form already
rendered from the saved record and with that record in its payload, and the selected
framework hydrates the form with the same template and data. Hydration must leave the
parsed form DOM unchanged: every element, attribute value and text in child order.
Attribute order is not part of the DOM (React sets `type`, `value` and `name` after
other input attributes), so it is not compared; the string renderers' byte-identical
HTML is checked by the generation and native generation checks. A `style` attribute is a CSS declaration
block, so it is compared as the CSS object model serializes its declarations: React
writes a sticky row's `--crudui-sticky-depth:0` as `--crudui-sticky-depth: 0;`. The comparison leaves out the nodes frameworks
keep as rendering anchors, which render nothing: comments (Vue) and empty text nodes
(Svelte). It covers what the view containers hold, not the framework-owned container attributes.
The frame compares the contents of each view container and leaves framework markers such as Vue's
CSR `data-v-app` untouched. That a column really hydrated is enforced by the frame's node check
below, not by this comparison.
Each adapter declares what hydration does with the server-rendered nodes:
React, Vue and the HTML renderer adopt them, and the frame requires every one of them
to survive; Svelte hydrates only markup its own server renderer wrote, which carries
`<!--[-->` markers the form servers do not write, so it clears the container and mounts
its own nodes. The right frame (`initialization=csr`) is the built frame page: the
framework mounts the form without data before it requests the saved record, then injects
the record into the existing form. A frame URL without `lang`, `server` and
`initialization` fails. Frames load `@polyspec/crudui-generator-core/crudui.css` before the page
stylesheet, so computed CSS is compared with the grammar styles; the page stylesheet
does not style anything inside `#view`. Inside that compared element each frame renders
the form in `#form-view` and the browser-only structure map and data view in
`#outline-view` and `#data-view`; the servers render the form alone.

Every render comparison includes the framework-independent HTML renderer in addition to React,
Vue and Svelte. A parity verdict therefore covers four renderers.

The canonical list uses semantic column alignment: identifier, numeric and monetary values are
right-aligned; status is centered; dates are centered; text and HTML values are left-aligned; image
cells are centered on both axes. Table cells are vertically centered. The list includes the record
identifier as an explicit sequence column. Monetary output does not add trailing zeroes that are not
present in the source value.

The canonical list contains the 45 stored records and uses offset pagination with 20 records per
page, so it exposes three pages containing 20, 20 and 5 records. The selected page is part of every
page address and every generated link, and the selected server or client renders the list of that
page with the stored total; no renderer replaces `total` with the number of rows in the current
page.

The `bindForm` controller supports the same actions as a `createForm` instance:
row operations, `toggle-row`, `select-row`, `expand-all`, `collapse-all` and
`undo`. It keeps collapsed rows and the undo history outside the keyed data using
generator-core's view-state and history functions, and moves or keeps focus by the
form runtime's focus rule.

The complete browser matrix contains 64 scenario reports and 32 initialization
reports:

- four servers: PHP, PHP extension, Go and Rust;
- four frameworks: React, Vue, Svelte and the HTML renderer;
- two rendering paths: `bindForm` and `createForm`;
- two transports for scenario reports: native multipart form and ordered JSON.

Every report uses the same specification, compiled template, data and checks.
Scenario checks run in the `ssr` frame.
Native and JSON saves must produce the same records, identifiers, parent
identifiers and positions. Ordered JSON preserves object member order at every
depth.

## Structure, data and identity

Structure compilation, instance data, rendering and validation are separate.
The compiled template contains no record values, is JSON-serializable and is
reused after compilation becomes unavailable. Repeated data injection, editing
and remounting do not add compile requests for an existing cache key.

Repeated collections are objects keyed by row identity. A saved sequence uses
`__` plus 13 decimal digits plus `__`. A new unsaved row uses `__` plus 13
lowercase hexadecimal digits plus `__`. A key identifies a row within its
parent collection; object member order determines display order. The runtime
does not infer saved state from key text.

Submissions contain no hidden sequence controls, auxiliary identity fields or
order fields. The server resolves an existing key only against stored rows under
the same parent. It allocates a new sequence for an unknown key and returns the
scoped key change. Deleted sequences are not reused.

An explicit empty object represents an empty collection and produces no row
controls. Missing collection data creates one initial row. Every visible empty
collection provides an Add button. Visibility changes do not create, remove or
submit data. A hidden collection with rows still submits those rows.

## Browser checks

Each scenario report checks all of the following operations:

- rendering, native names and zero hidden identity controls;
- addition, copying, movement, removal and saved-key replacement;
- nonsequential saved identifiers in the order 5, 7 and 1;
- client and server validation, including hidden required fields;
- native and JSON transmission, malformed request rejection and exact reload;
- empty company, store and department collection lifecycles;
- parent ownership, stable sibling identifiers and non-reused deleted IDs;
- cached structure reuse and compile-request stability.

Each initialization report runs 18 stages in the left frame, resets the
repository, then runs the same stages in the right frame. Row key inputs repeat
from the `copied` stage to `saved-new` in both runs, so both columns create the
same keys. The stages are:

- `mounted`: reset the repository, then load the column's frame document again so it
  initializes through its own path: hydrate the server-rendered form (left) or mount and
  inject (right);
- `reinjected-1`, `reinjected-2`: inject the saved record again with the same
  cached template;
- `data-hidden`, `data-restored`: inject a record that hides a conditional field,
  then the saved record;
- `edited`: edit the company name, store name and notes, and toggle the checkbox;
- `saved`: save and record the validation result, stored records and key changes;
- `reloaded`: reload the saved record;
- `copied`, `moved`, `copy-removed`, `added`: copy, move, remove and add company
  rows through their buttons, editing the added row;
- `saved-new`: save the added row;
- `collapsed-all`, `expanded-all`, `undone`: press the structure map's Collapse
  all, Expand all and Undo buttons;
- `empty`, `restored`: inject an empty company collection, then the saved record.

Stages focus controls as a keyboard user does, with visible focus
(`focus({ focusVisible: true })`). A browser shows no focus for a scripted focus after
pointer input in the same document, so a click inside one frame before the comparison
would otherwise change only that column's CSS.

Both columns must receive the same input, and a pointer rests over one frame only. No page
style keeps `:hover` out of a frame in every browser: in Safari neither `pointer-events: none`
on the frame nor an element covering it does. A capture therefore requires the pointer to be
outside both frames. When the pointer is over a frame (its document element matches
`:hover`), the comparison stops without a result and asks to move the pointer outside the
frames and compare again; the list shown after loading says the same instead of comparing.
The page itself never scrolls, so a resting pointer stays where it is relative to the frames:
the controls and results scroll inside a panel limited to 45% of the viewport height, and the
two frames share the rest, side by side (stacked halves below 1000 px), each scrolling inside.
A runtime focus move then scrolls only its frame. With frames stacked in a scrolling page,
Safari scrolled the page from 0 to 602 px when the `copied` stage moved focus, bringing the
left frame under a pointer resting on the page header.

Each right stage is compared with the stored left stage using `formSnapshot`,
`styleSnapshot` and `compareSnapshots`: parsed DOM with every attribute, live
control state, native fields, computed CSS for elements and pseudo-elements, ordered
JSON data, focus and text selection, and the save response. Serialized HTML is not
compared: attribute order is not part of the DOM, and browser engines create the
attributes a framework sets in different orders (Safari and Chromium order a restored
Vue checkbox's `checked` and `value` differently). Each column's reinjection and
restoration stages are also compared with its own `mounted` stage. Nothing is
removed, replaced or normalized. The report has 24 comparisons in seven categories,
168 results.

The page shows both frames. After both frames load, the top list compares their
`mounted` state; the comparison button and the complete check add each stage as
it completes. The report retains each stage's HTML, DOM, control state, fields,
data, focus, response and CSS digest, and the expected and actual CSS of any
failed CSS comparison.

Both frames, the page and every other tab of the same origin read and replace the
same saved records. An operation started from the page changes them only while it
holds one origin lock (`navigator.locks`): a frame button or form submission, the
comparison button and the complete check. An operation started while another holds
the lock does not run and reports that another check or save is running. Checks
that the complete check or the verifier calls directly run inside the operation
that already holds the lock. The lock belongs to one browser: other browsers, other
people and automated runs against the same server also read and replace these
records without it, so checks from different browsers must not run at the same time.

Pointer and keyboard checks verify that a row addition focuses the first input of
the new row and that the input is visible inside both the frame viewport and the
main page viewport; the frame and the page scroll only as far as needed.
Frame-document checks cover both initialization documents of every rendering path and
framework. A CSR document must be the built frame page with empty views and no payload,
and an SSR document must be that same page with only the three insertions; the pages
behind all four servers' documents are compared by SHA-256. Generation verification
checks Korean and English SSR output for every server and framework, and that every
server rejects the same wrong SSR queries with the same message.

## Runner and reports

The browser starts a job and the host collects state and completed reports with
short protocol calls. A long matrix never occupies one DevTools protocol call.
The collector records the current report, report start time, completed report
count, request and response counts, and last request and response times.

Each unit of a server run holds its own limit from its slowest measured duration
(`measuredLimitMs`), and no limit covers the run as a whole. The measurements come
from the deployed verification of 2026-09-16, with the four browser checks running
at the same time. An initialization report, measured at 32.4 seconds at most, gets
100,000 milliseconds; a scenario report, measured at 2.2 seconds, gets 10,000; the
page work before, between and after reports, measured at 1.9 seconds, gets 10,000
(`browserReportMeasurementsMs` in `src/browser-job.mjs`). The units around the
report job hold their own limits as well (`browserUnitMeasurementsMs` in
`browser-report-policy.mjs`): the main page (1.8 seconds) gets 10,000 milliseconds; the
interaction checks, the frame-document checks and the artifacts took 26.3 seconds
together, and until each is measured on its own each gets 80,000. The browser start and close are
long operations without a limit (`runOperation` of `src/unit-pool.mjs`) that print the same
progress lines. A server report records the status, duration and limit of these units, and the
status and duration of the browser start and close, under `units`. A unit is a node:test test: it prints its result when it ends, and the check prints each completed report with its result and duration. A unit that reaches its limit fails its test, which names the unit, and the report records its elapsed time under `units`; the failure retains the current state and every completed report. The browser check as
a whole has no limit, no summed limit and no duration budget.

A complete server report requires a browser job of 24 reports: 16 scenario
reports with 19 checks each and eight initialization reports with 168 comparison
results each. It also requires 80 interaction checks, eight mount-before-load checks
of the `csr` frame, 16 frame-document checks, no browser or page errors, one
and one source identity shared by the report and every scenario and initialization
report. The report records its duration; the duration is not a pass condition.
Fields named `passed` must be booleans. Missing activity,
initialization stages or timing evidence makes the report incomplete.

The four-server aggregate requires one complete report from every server. It
requires 1,216 successful scenario checks, 5,376 successful initialization
comparisons, 320 successful interaction checks, 32
successful mount checks, 64 successful frame-document checks, equal frame pages behind
every server's documents. Any failed,
missing, malformed or unequal result sets `passed: false` and returns status 1.
Only a complete aggregate with zero failures returns status 0.


## Additional verification

Generation verification requires 450 successful results, 899 HTTP requests and
all 32 server/rendering-path/framework combinations. Repository verification
checks atomic updates, locking, position-based loading, parent ownership,
rejection without file changes, complete deletion and sequence allocation. Type
verification checks the same scalar and collection rules in every server.

PHP-FPM runs with `enable_post_data_reading=0`, so the PHP servers read the request body
themselves, as the other servers do: one parser for urlencoded and multipart bodies rejects a
repeated field, a name that is both a value and a group, a malformed name and a file part with
400. The persistence check's `request-size-limit` and the record-store case
`save-stops-reading-an-oversized-request` get their 413 from nginx before PHP runs, and
the browser `shape` check's native form with 10,001 fields gets 400 for its additional fields.

Fast source tests reproduce report-policy failures, protocol timeout behavior,
each report's own limit and the progress it reports, the step runner's run to the end
and process-tree stop, source identity, snapshot differences, generation cache behavior and
request-count changes, the unit runner's limits and progress, the record resource's
fixture and links, and the canonical page's declared controls. These tests do not
replace the local verification. `main` push CI runs
`npm run test:form-comparison` so report-policy, browser-job, source-tree and
PHP server regressions (the PHPUnit suite of `servers/php` in the php mode) block integration,
`npm run test:form-comparison:pipeline` so the record-store contract of all five
servers, the Go and Rust server tests and the canonical flow check of all 40
combinations block integration, and `npm run test:form-comparison:checks` so the local
verification below blocks integration.

## Local verification

`examples/form-comparison/local-verification.mjs` (`make crudui-test-form-comparison-checks`) builds one
local stack from the checkout, as the canonical flow check
does: the record server programs, the public directory, the four native record servers and the
public server, each a local process on a port of 127.0.0.1 that the system assigns. It records the
identity in `source.json` of its results directory and runs these stages in order, stopping at the
first stage with a failed step:

1. the PHPUnit suite of the PHP server (`servers/php`) in the php mode, whose group `modules` runs the
   processor modes in child processes that load the `polyspec_crudui.so` and `ordered_json.so` of this run;
2. the same suite in the php-ext mode, whose PHP loads both modules of this run through the repeatable
   `--php-extension` of the run-tests of kit (K165), without the group `php`, which constructs the PHP
   library;
3. generation against the four native servers through the public server (`check-generation.mjs`);
4. persistence against the four native servers, reading their files in the stack's data directory
   (`check-servers.mjs`);
5. the canonical flow check of the stack's page for all 40 combinations (`check-pipeline.mjs`;
   units with their own limits);
6. browser verification for PHP, the PHP extension, Go and Rust, the four at the same time
   (`check.mjs` with the interaction checks of `check-interaction.mjs`; units with their own limits);
7. the browser aggregate of this run's four reports (`check-browser-reports.mjs`);
8. the typing check of every framework and rendering path at key delays of 0, 10 and 50
   milliseconds (`check-typing.mjs`), after the browser checks, since it edits the PHP records of
   the frames.

Each stage's steps run to their end without a time limit and print their progress. The four
browser checks run at the same time because each one drives its own browser process, with its own
focus, selection and scroll, against its own server and its own stored records.

It then requires the checkout's identity to be unchanged. The evidence check
(`verification-evidence.mjs`) requires the generation report, the persistence report, the
canonical flow report (`pipeline.json`: 40 passed combinations and five passed store resets), the
browser aggregate and the typing report (every framework, rendering path and delay passed, no page
error) to satisfy every count and pass condition in this contract, and the reports to name that
identity. The servers stop at the end of the run, also after a failure; a failed run keeps its
results directory and prints its path.

CI runs the same checks in two parts, each once. The CI job `form-comparison-browser` has one job
per native server (`php`, `php-ext`, `go`, `rust`), so each browser check has its runner to itself:
`make crudui-test-form-comparison-browser` with `FORM_SERVERS` naming that server runs the runner with
`--servers`, which starts a local stack and runs only the browser check of that server (stage 5),
and the job uploads that server's report. The CI job `form-comparison-checks` runs after the four
jobs, downloads their reports and runs `make crudui-test-form-comparison-summary`, which runs the runner
with `--browser-reports`: it starts a local stack of its own and runs every other stage (1 to 4, 6
and 7) and the evidence check, the browser aggregate reading the four downloaded reports. Every
server of these runs takes a port of the system, so runs at the same time do not collide. The
aggregate requires every report to name the scheme and host of its own origin, whose port differs
by run, and the source identity of the same tree. The checks, reports and limits are those of the
single run.
