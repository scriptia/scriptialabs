import * as React from 'react';

import { Body, Heading } from '@/components/typography';
import { parseMarkdown, resolveHref, type Block, type Inline } from '@/lib/markdown/parse';
import { cn } from '@/lib/utils';

export type ArticleBodyProps = {
  /** Markdown, in the subset src/lib/markdown/parse.ts understands. */
  markdown: string;
  /** Locale used to prefix site-relative links (`/pupdojo` → `/es/pupdojo`). */
  locale: string;
  locales: readonly string[];
  siteUrl: string;
  className?: string;
};

// Renders an article body from parsed Markdown. Every string goes through React,
// so nothing in an article is ever interpreted as HTML (ADR-014).
export function ArticleBody({ markdown, locale, locales, siteUrl, className }: ArticleBodyProps) {
  const blocks = parseMarkdown(markdown);
  const renderInline = (nodes: Inline[]) => <InlineNodes nodes={nodes} locale={locale} locales={locales} siteUrl={siteUrl} />;

  return (
    <div className={cn('grid gap-5', className)}>
      {blocks.map((block, index) => (
        <BlockNode key={index} block={block} renderInline={renderInline} />
      ))}
    </div>
  );
}

function BlockNode({ block, renderInline }: { block: Block; renderInline: (nodes: Inline[]) => React.ReactNode }) {
  switch (block.type) {
    case 'heading':
      return (
        <Heading level={block.level} id={block.id} className={cn('scroll-mt-24', block.level === 2 ? 'mt-6' : 'mt-2')}>
          {block.text}
        </Heading>
      );
    case 'paragraph':
      return <Body>{renderInline(block.children)}</Body>;
    case 'quote':
      return (
        <blockquote className="border-l-2 border-border pl-4">
          <Body className="italic">{renderInline(block.children)}</Body>
        </blockquote>
      );
    case 'list': {
      const Tag = block.ordered ? 'ol' : 'ul';
      return (
        <Tag className={cn('grid gap-2 pl-6 font-sans text-body leading-[1.65] text-text-secondary', block.ordered ? 'list-decimal' : 'list-disc')}>
          {block.items.map((item, index) => (
            <li key={index} className="pl-1">
              {renderInline(item)}
            </li>
          ))}
        </Tag>
      );
    }
  }
}

function InlineNodes({ nodes, locale, locales, siteUrl }: { nodes: Inline[]; locale: string; locales: readonly string[]; siteUrl: string }) {
  return (
    <>
      {nodes.map((node, index) => {
        switch (node.type) {
          case 'text':
            return <React.Fragment key={index}>{node.text}</React.Fragment>;
          case 'strong':
            return (
              <strong key={index} className="font-semibold text-text-primary">
                <InlineNodes nodes={node.children} locale={locale} locales={locales} siteUrl={siteUrl} />
              </strong>
            );
          case 'em':
            return (
              <em key={index}>
                <InlineNodes nodes={node.children} locale={locale} locales={locales} siteUrl={siteUrl} />
              </em>
            );
          case 'link': {
            const children = <InlineNodes nodes={node.children} locale={locale} locales={locales} siteUrl={siteUrl} />;
            const safe = resolveHref(node.href, locale, locales, siteUrl);
            // A refused href keeps its words and loses the link.
            if (!safe) return <React.Fragment key={index}>{children}</React.Fragment>;
            return (
              <a
                key={index}
                href={safe.href}
                className="font-medium text-brand underline underline-offset-4 transition-colors hover:text-text-primary"
                {...(safe.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
              >
                {children}
              </a>
            );
          }
        }
      })}
    </>
  );
}
