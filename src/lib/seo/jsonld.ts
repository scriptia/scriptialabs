export type JsonLdObject = Record<string, unknown>;

export function createJsonLd<T extends JsonLdObject>(value: T) {
  return JSON.stringify(value);
}
