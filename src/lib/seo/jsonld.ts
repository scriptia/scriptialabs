export type JsonLdObject = Record<string, unknown>;

export function createJsonLd<T extends JsonLdObject>(value: T) {
  // `<` is escaped so no string inside the data (an article title, an FAQ
  // answer) can close the surrounding <script> tag.
  return JSON.stringify(value).replace(/</g, '\\u003c');
}
