// JSON.rawJSON of the TC39 proposal "JSON.parse source text access", which Node.js 26 ships and no lib of TypeScript 7.0.2
// declares, not "esnext" either; the fixture generators that call it import this file as a type. Remove it when the lib
// of TypeScript declares JSON.rawJSON.
export {};

declare global {
  interface JSON {
    rawJSON(text: string): unknown;
  }
}
