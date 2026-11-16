// The publication of a table of the PHP extension, which make php-ext-tables writes on every run (P34): the table is
// written to <table>.<pid> and renamed into place, so a run that reads it finds the previous table or the new one.
import { readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * When the module `moduleUrl` is the program that node runs, write the table that `render` makes of the contract at
 * `contractPath` to `outputPath`; a module that a test imports writes nothing.
 */
export async function writeTableWhenRun(moduleUrl, contractPath, outputPath, render) {
  if (!process.argv[1] || path.resolve(process.argv[1]) !== fileURLToPath(moduleUrl)) return;
  const contract = JSON.parse(await readFile(contractPath, 'utf8'));
  await writeFile(`${outputPath}.${process.pid}`, await render(contract));
  await rename(`${outputPath}.${process.pid}`, outputPath);
}
