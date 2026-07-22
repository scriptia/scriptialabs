'use client';

import * as React from 'react';

import { Alert } from '@/components/feedback';
import { Button } from '@/components/primitives';
import { Stack } from '@/components/surfaces';
import { betDocumentKindLabels, type BetDocumentKind } from '@/content/internal';
import { deleteBetDocument, loadBetDocument } from '@/server/actions/bet-details';

export type DocumentRow = {
  id: string;
  kind: BetDocumentKind;
  name: string;
  updatedAt: Date;
  size: number;
};

function formatSize(bytes: number) {
  return bytes < 1024 ? `${bytes} B` : `${Math.round(bytes / 1024)} KB`;
}

export function DocumentsPanel({ documents }: Readonly<{ documents: DocumentRow[] }>) {
  // One document open at a time, its body fetched on demand — the list itself
  // deliberately carries no content (see getBetDocuments).
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [content, setContent] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  const [copied, setCopied] = React.useState(false);

  function open(id: string) {
    if (openId === id) {
      setOpenId(null);
      setContent(null);

      return;
    }

    setOpenId(id);
    setContent(null);
    setError(null);

    startTransition(async () => {
      const result = await loadBetDocument(id);

      if (result.error) {
        setError(result.error);

        return;
      }

      setContent(result.content ?? '');
    });
  }

  async function copy() {
    if (!content) {
      return;
    }

    await navigator.clipboard.writeText(content);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  if (documents.length === 0) {
    return <p className="text-body-small text-text-secondary">No documents yet. The discovery pipeline attaches the build prompt, spec and decision memo when it pushes a bet.</p>;
  }

  return (
    <Stack gap="md">
      <ul className="divide-y divide-border rounded-lg border border-border">
        {documents.map((document) => (
          <li key={document.id}>
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <span className="text-caption uppercase tracking-[0.08em] text-text-tertiary">{betDocumentKindLabels[document.kind]}</span>
                <p className="truncate text-body-small text-text-primary">{document.name}</p>
                <p className="text-caption text-text-tertiary">{formatSize(document.size)}</p>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <Button type="button" variant="secondary" size="sm" onClick={() => open(document.id)}>
                  {openId === document.id ? 'Hide' : 'Open'}
                </Button>
                <form action={deleteBetDocument}>
                  <input type="hidden" name="id" value={document.id} />
                  <Button type="submit" variant="ghost" size="sm">
                    Remove
                  </Button>
                </form>
              </div>
            </div>

            {openId === document.id ? (
              <div className="border-t border-border bg-surface-subtle px-4 py-3">
                {error ? <Alert tone="error">{error}</Alert> : null}

                {pending && content === null ? (
                  <p className="text-body-small text-text-secondary">Loading…</p>
                ) : content !== null ? (
                  <Stack gap="sm">
                    {/* Copying is the actual hand-off: this text is pasted into a
                        fresh Opus session in an empty directory. */}
                    <div className="flex justify-end">
                      <Button type="button" size="sm" onClick={copy}>
                        {copied ? 'Copied' : 'Copy to clipboard'}
                      </Button>
                    </div>
                    <pre className="max-h-[32rem] overflow-auto whitespace-pre-wrap break-words rounded-lg border border-border bg-surface p-4 text-caption text-text-secondary">{content}</pre>
                  </Stack>
                ) : null}
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </Stack>
  );
}
