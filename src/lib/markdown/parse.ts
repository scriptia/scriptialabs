// A deliberately small Markdown parser for article bodies (ADR-014).
//
// It understands what an article needs — `##`/`###` headings, paragraphs, `-`
// and `1.` lists, `>` quotes, **bold**, *italics* and [links](url) — and nothing
// else. There is no HTML passthrough: the output is a tree of plain data that the
// renderer turns into React elements, so every string is escaped by React and an
// article can never inject markup or scripts. Anything unrecognised is text.
//
// Pure and dependency-free so it runs in the publish script (to validate and
// count words before sending) as well as on the server.

export type Inline = { type: 'text'; text: string } | { type: 'strong'; children: Inline[] } | { type: 'em'; children: Inline[] } | { type: 'link'; href: string; children: Inline[] };

export type Block =
  | { type: 'heading'; level: 2 | 3; id: string; text: string }
  | { type: 'paragraph'; children: Inline[] }
  | { type: 'list'; ordered: boolean; items: Inline[][] }
  | { type: 'quote'; children: Inline[] };

const headingPattern = /^(#{1,6})\s+(.*)$/;
const unorderedPattern = /^\s*[-*+]\s+(.*)$/;
const orderedPattern = /^\s*\d+[.)]\s+(.*)$/;
const quotePattern = /^>\s?(.*)$/;

export function parseMarkdown(source: string): Block[] {
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  const blocks: Block[] = [];
  const usedIds = new Map<string, number>();
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];

    if (!line.trim()) {
      index += 1;
      continue;
    }

    const heading = headingPattern.exec(line);
    if (heading) {
      // The page renders the article title as its only h1, so `#` is demoted and
      // anything deeper than `###` is flattened: the outline stays two levels.
      const level = heading[1].length <= 2 ? 2 : 3;
      const text = heading[2].replace(/#+\s*$/, '').trim();
      blocks.push({ type: 'heading', level, id: uniqueId(slugifyHeading(text), usedIds), text: stripInlineMarkers(text) });
      index += 1;
      continue;
    }

    if (unorderedPattern.test(line) || orderedPattern.test(line)) {
      const ordered = !unorderedPattern.test(line);
      const pattern = ordered ? orderedPattern : unorderedPattern;
      const items: string[] = [];
      while (index < lines.length && lines[index].trim()) {
        const match = pattern.exec(lines[index]);
        if (match) {
          items.push(match[1]);
        } else if (items.length > 0 && /^\s+/.test(lines[index])) {
          // An indented continuation line belongs to the previous item.
          items[items.length - 1] += ` ${lines[index].trim()}`;
        } else {
          break;
        }
        index += 1;
      }
      blocks.push({ type: 'list', ordered, items: items.map(parseInline) });
      continue;
    }

    if (quotePattern.test(line)) {
      const parts: string[] = [];
      while (index < lines.length && quotePattern.test(lines[index])) {
        parts.push(quotePattern.exec(lines[index])![1]);
        index += 1;
      }
      blocks.push({ type: 'quote', children: parseInline(parts.join(' ').trim()) });
      continue;
    }

    const parts: string[] = [];
    while (index < lines.length && lines[index].trim() && !headingPattern.test(lines[index]) && !quotePattern.test(lines[index]) && !unorderedPattern.test(lines[index]) && !orderedPattern.test(lines[index])) {
      parts.push(lines[index].trim());
      index += 1;
    }
    blocks.push({ type: 'paragraph', children: parseInline(parts.join(' ')) });
  }

  return blocks;
}

export function parseInline(source: string): Inline[] {
  const out: Inline[] = [];
  let buffer = '';
  let index = 0;

  const flush = () => {
    if (buffer) out.push({ type: 'text', text: buffer });
    buffer = '';
  };

  while (index < source.length) {
    const rest = source.slice(index);

    // One level of balanced parentheses inside the URL, as in Wikipedia links.
    const link = /^\[([^\]]+)\]\(((?:[^()\s]|\([^()\s]*\))+)\)/.exec(rest);
    if (link) {
      flush();
      out.push({ type: 'link', href: link[2], children: parseInline(link[1]) });
      index += link[0].length;
      continue;
    }

    const strong = /^(\*\*|__)(?=\S)([\s\S]+?)(?<=\S)\1/.exec(rest);
    if (strong) {
      flush();
      out.push({ type: 'strong', children: parseInline(strong[2]) });
      index += strong[0].length;
      continue;
    }

    // `_` only opens emphasis at a word boundary, so snake_case survives.
    const em = /^(\*|_)(?=\S)([\s\S]+?)(?<=\S)\1(?!\w)/.exec(rest);
    if (em && (em[1] === '*' || !/\w/.test(source[index - 1] ?? ''))) {
      flush();
      out.push({ type: 'em', children: parseInline(em[2]) });
      index += em[0].length;
      continue;
    }

    buffer += source[index];
    index += 1;
  }

  flush();
  return out;
}

export function inlineToText(nodes: Inline[]): string {
  return nodes.map((node) => (node.type === 'text' ? node.text : inlineToText(node.children))).join('');
}

/** Plain text of a whole body: for word counts and the JSON-LD `wordCount`. */
export function blocksToText(blocks: Block[]): string {
  return blocks
    .map((block) => {
      switch (block.type) {
        case 'heading':
          return block.text;
        case 'list':
          return block.items.map(inlineToText).join('\n');
        default:
          return inlineToText(block.children);
      }
    })
    .join('\n\n');
}

export function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

function stripInlineMarkers(text: string) {
  return inlineToText(parseInline(text));
}

/** Anchor id for a heading: lowercase ASCII kebab-case, accents folded. */
export function slugifyHeading(text: string): string {
  return (
    stripInlineMarkers(text)
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'section'
  );
}

function uniqueId(base: string, used: Map<string, number>) {
  const count = used.get(base) ?? 0;
  used.set(base, count + 1);
  return count === 0 ? base : `${base}-${count + 1}`;
}

export type SafeHref = { href: string; external: boolean } | null;

/**
 * The only hrefs an article may carry: http(s) URLs, in-page anchors and
 * site-relative paths. Site paths without a locale get the article's locale, so
 * an author can write `/pupdojo` and it resolves to `/es/pupdojo` on the Spanish
 * page. Anything else — `javascript:`, `data:`, protocol-relative — is refused
 * and the link renders as its text.
 */
export function resolveHref(href: string, locale: string, locales: readonly string[], siteUrl: string): SafeHref {
  if (href.startsWith('#')) return { href, external: false };

  if (href.startsWith('/') && !href.startsWith('//')) {
    const first = href.split('/')[1] ?? '';
    return { href: locales.includes(first) ? href : `/${locale}${href === '/' ? '' : href}`, external: false };
  }

  try {
    const url = new URL(href);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    const site = new URL(siteUrl);
    return { href: url.toString(), external: url.host !== site.host };
  } catch {
    return null;
  }
}
