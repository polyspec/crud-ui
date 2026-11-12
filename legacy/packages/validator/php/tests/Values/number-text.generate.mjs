#!/usr/bin/env node
/**
 * Write number-text.json: doubles (as big-endian IEEE 754 hex) with the text
 * ECMAScript Number.prototype.toString gives them. NumberTextTest compares
 * NumberText against it. Run: node number-text.generate.mjs > number-text.json
 */
const view = new DataView(new ArrayBuffer(8));
const hexOf = number => { view.setFloat64(0, number); return view.getBigUint64(0).toString(16).padStart(16, '0'); };
const fromBits = bits => { view.setBigUint64(0, bits); return view.getFloat64(0); };
const next = (number, direction) => {
  view.setFloat64(0, number);
  const bits = view.getBigUint64(0);
  if (number === 0) return direction > 0 ? Number.MIN_VALUE : -Number.MIN_VALUE;
  return fromBits((number > 0) === (direction > 0) ? bits + 1n : bits - 1n);
};

const values = new Set([0, -0, 1, -1, 0.1, 0.2, 0.1 + 0.2, 1 / 3, 2 / 3, 123456789012345680000, 1e21, 1e-7, 1e-6, 0.000001,
  Number.MAX_VALUE, Number.MIN_VALUE, Number.MAX_SAFE_INTEGER, Number.EPSILON, 2 ** 53, 2 ** 53 + 2, 5e-324, 1.5, 12, 100, 1e100]);
const around = number => { values.add(number); values.add(next(number, 1)); values.add(next(number, -1)); };
for (let exponent = -1074; exponent <= 1023; exponent++) around(2 ** exponent);
for (let exponent = -323; exponent <= 308; exponent++) around(Number(`1e${exponent}`));
for (let exponent = -10; exponent <= 25; exponent++) { around(Number(`9.999999999999999e${exponent}`)); around(Number(`5e${exponent}`)); }
for (let offset = -20; offset <= 20; offset++) values.add(2 ** 53 + offset);
let seed = 0x9e3779b97f4a7c15n;
const random = () => { seed ^= seed << 13n; seed &= (1n << 64n) - 1n; seed ^= seed >> 7n; seed ^= seed << 17n; seed &= (1n << 64n) - 1n; return seed; };
for (let index = 0; index < 4000; index++) {
  const number = fromBits(random());
  if (Number.isFinite(number)) values.add(number);
}
for (let index = 0; index < 2000; index++) {
  const bits = random();
  const exponent = 1023n + (bits % 160n) - 80n;
  const number = fromBits((exponent << 52n) | (random() & ((1n << 52n) - 1n)));
  values.add(number);
  values.add(Number(number.toPrecision(1 + Number(bits % 17n))));
}
const cases = [...values].filter(Number.isFinite).map(number => [hexOf(number), String(number)]);
cases.push([hexOf(-0), '0']);
process.stdout.write(`${JSON.stringify(cases)}\n`);
