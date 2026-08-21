import 'server-only';

// Turns a plain JS value into TypeScript object-literal source text matching
// this repo's own style (single-quoted strings, unquoted identifier keys,
// two-space indent) — used everywhere the apps-ingest route splices a new
// entry into an existing registry/message file via ts-morph. `JSON.stringify`
// would work too, but its double-quoted, always-quoted-key output would sit
// visibly at odds with every hand-written entry around it.

const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

function quoteKey(key: string): string {
  return IDENTIFIER.test(key) ? key : `'${key.replace(/'/g, "\\'")}'`;
}

function quoteString(value: string): string {
  return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

export function toLiteral(value: unknown, indent = 2): string {
  const pad = ' '.repeat(indent);
  const padIn = ' '.repeat(indent + 2);

  if (value === null || value === undefined) {
    return 'undefined';
  }
  if (typeof value === 'string') {
    return quoteString(value);
  }
  if (typeof value === 'boolean' || typeof value === 'number') {
    return String(value);
  }
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return '[]';
    }
    const items = value.map((item) => `${padIn}${toLiteral(item, indent + 2)}`).join(',\n');
    return `[\n${items}\n${pad}]`;
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) {
      return '{}';
    }
    const body = entries.map(([key, val]) => `${padIn}${quoteKey(key)}: ${toLiteral(val, indent + 2)}`).join(',\n');
    return `{\n${body}\n${pad}}`;
  }
  throw new Error(`toLiteral: unsupported value type ${typeof value}`);
}

// `voice-agents` -> `voiceAgents`. Mirrors src/content/products/message-keys.ts's
// own bridge exactly, so a hyphenated slug gets a message namespace that is a
// valid, dot-accessible identifier rather than carrying the hyphen through.
export function kebabToCamel(slug: string): string {
  return slug.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase());
}

// Moved to server/products/accent.ts: it is a pure function and `server-only`
// here made the publish schema that uses it unloadable outside Next. Re-exported
// so this module's existing callers keep working until it is deleted.
export { autoAccents, pickAutoAccent, type AutoAccent } from '@/server/products/accent';
