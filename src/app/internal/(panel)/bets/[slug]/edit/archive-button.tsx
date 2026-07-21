'use client';

import * as React from 'react';

import { Modal } from '@/components/display';
import { Button } from '@/components/primitives';
import { Body, Heading } from '@/components/typography';
import { toggleArchiveBet } from '@/server/actions/bets';

// Bets are archived, never deleted — their updates, metrics and audit trail are
// the most valuable thing a killed bet leaves behind.
export function ArchiveButton({ betId, archived, title }: Readonly<{ betId: string; archived: boolean; title: string }>) {
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  const submit = () => {
    const formData = new FormData();
    formData.set('id', betId);
    startTransition(async () => {
      await toggleArchiveBet(formData);
      setOpen(false);
    });
  };

  return (
    <div className="border-t border-border pt-6">
      <Button variant={archived ? 'secondary' : 'danger'} size="sm" onClick={() => setOpen(true)}>
        {archived ? 'Restore bet' : 'Archive bet'}
      </Button>

      <Modal
        open={open}
        onOpenChange={setOpen}
        className="w-full max-w-md rounded-lg border border-border bg-surface p-6 text-text-primary shadow-high backdrop:bg-black/40"
      >
        <Heading level={3}>{archived ? 'Restore this bet?' : 'Archive this bet?'}</Heading>
        <Body size="small" className="mt-2">
          {archived
            ? `“${title}” will reappear in the active list and on the board.`
            : `“${title}” will be hidden from the default views. Nothing is deleted — its updates, metrics and history are kept, and you can restore it at any time.`}
        </Body>

        <div className="mt-6 flex justify-end gap-3">
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button variant={archived ? 'primary' : 'danger'} size="sm" loading={pending} onClick={submit}>
            {archived ? 'Restore' : 'Archive'}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
