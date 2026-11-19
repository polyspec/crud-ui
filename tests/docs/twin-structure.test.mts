import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

// A Korean twin `X.ko.md` translates its English source `X.md` paragraph for paragraph, so it has the same sections, the same
// list items and the same number of paragraphs. A paragraph is a block between blank lines outside fenced code. A twin that lost
// or added a paragraph, a list item or a section after its source changed fails here. The check does not see a sentence that was
// reworded in place: that needs the reading of the twin against its source.
const ROOT = new URL('../../', import.meta.url);
const read = (file: string): string => readFileSync(new URL(file, ROOT), 'utf8');
const HEADING = /^(#{1,6}) /;
// A bullet or an ordered item. An ordered item can interrupt a paragraph only when it starts at 1 (CommonMark), so `400. ...`
// wrapped onto a new line is a continuation of its paragraph.
const LIST_ITEM = /^\s*(?:[-*+]|(\d+)\.) /;

/** The heading levels in order, the list items and the paragraphs of a Markdown document, outside its fenced code blocks. */
export function structure(text: string): { headings: string[]; items: number; paragraphs: number } {
  const headings: string[] = [];
  let items = 0;
  let previousBlank = true;
  let previousItem: boolean = false;
  const outside: string[] = [];
  let fenced = false;
  for (const line of text.split('\n')) {
    if (line.startsWith('```')) { fenced = !fenced; outside.push(''); continue; }
    if (fenced) { outside.push(''); continue; }
    outside.push(line);
    const heading = HEADING.exec(line);
    if (heading?.[1] !== undefined) headings.push(heading[1]);
    const item = LIST_ITEM.exec(line);
    const ordered = item?.[1] !== undefined ? Number(item[1]) : undefined;
    const isItem: boolean = item !== null && (ordered === undefined || ordered === 1 || previousBlank || previousItem);
    if (isItem) items += 1;
    previousBlank = line.trim() === '';
    previousItem = isItem;
  }
  const paragraphs = outside.join('\n').split(/\n\s*\n/).filter((block) => block.trim() !== '').length;
  return { headings, items, paragraphs };
}

const twins = execFileSync('git', ['ls-files', '*.ko.md'], { cwd: ROOT, encoding: 'utf8' })
  .split('\n')
  .filter((file) => file !== '')
  .map((file) => ({ twin: file, source: file.replace(/\.ko\.md$/, '.md') }))
  .filter(({ source }) => { try { readFileSync(new URL(source, ROOT)); return true; } catch { return false; } });

for (const { twin, source } of twins) {
  test(`${twin} has the sections and list items of ${source}`, () => {
    const english = structure(read(source));
    const korean = structure(read(twin));
    assert.deepEqual(korean.headings, english.headings, `${twin}: the sections differ from ${source}`);
    assert.equal(korean.items, english.items, `${twin}: ${korean.items} list items, ${source} has ${english.items}`);
    assert.equal(korean.paragraphs, english.paragraphs, `${twin}: ${korean.paragraphs} paragraphs, ${source} has ${english.paragraphs}`);
  });
}

test('the twins of the structure test are the Korean twins of tracked Markdown files', () => {
  assert.ok(twins.length > 100, `only ${twins.length} twins found`);
});
