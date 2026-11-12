import { describe, expect, it } from 'vitest';
import { parseJsonDocument } from './json';

describe('parseJsonDocument', () => {
  it('rejects repeated decoded names at every depth', () => {
    for (const source of [
      '{"type":"group","type":"text"}',
      '{"properties":{"title":{"type":"text","\\u0074ype":"number"}}}',
      '[{"a":1,"a":2}]',
    ]) {
      expect(() => parseJsonDocument(source)).toThrow(/Repeated JSON member/);
    }
  });

  it('preserves valid JSON values and rejects invalid JSON', () => {
    const source = '{"properties":{"title":{"type":"text"}},"items":[1,true,null]}';
    expect(parseJsonDocument(source)).toEqual(JSON.parse(source));
    expect(() => parseJsonDocument('{"a":1,}')).toThrow();
  });
});
