import { describe, expect, it } from 'vitest';
import { styleString } from './util';

describe('CSS declaration parsing', () => {
  it('preserves separators inside strings, URLs and nested blocks', () => {
    const css = '--caption: "one;two:three"; background-image: url("data:image/svg+xml;utf8,<svg></svg>"); --payload: {key:value;items:[a;b]}; width: calc(100% - 2px)';
    expect(styleString(css)).toBe(css);
  });

  it('preserves escaped separators and comments inside values', () => {
    const css = '/* first;: */ color/**/: red; --token: a\\;b; --note: "/* text;: */"; width: var(--size /* ;: */, 12px)';
    expect(styleString(css)).toBe('color: red; --token: a\\;b; --note: "/* text;: */"; width: var(--size /* ;: */, 12px)');
  });

  it('retains repeated declarations and priority in the evaluated model', () => {
    expect(styleString('color:red!important; color:blue; --x:"!important"')).toBe('color: red!important; color: blue; --x: "!important"');
    expect(styleString('missing; : no; empty: ;')).toBeUndefined();
  });
});
