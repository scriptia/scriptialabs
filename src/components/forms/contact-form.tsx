'use client';

import * as React from 'react';

import { Button } from '@/components/primitives';
import { Input, Select, Textarea } from './fields';
import { Label } from '@/components/typography';
import { Callout } from '@/components/feedback';
import { Stack } from '@/components/surfaces';

export type ContactFormCategory = {
  value: string;
  label: string;
};

export type ContactFormLabels = {
  name: string;
  namePlaceholder: string;
  email: string;
  emailPlaceholder: string;
  category: string;
  message: string;
  messagePlaceholder: string;
  submit: string;
  submitting: string;
  successTitle: string;
  successDescription: string;
};

export type ContactFormProps = Readonly<{
  labels: ContactFormLabels;
  categories: ContactFormCategory[];
}>;

// No backend exists yet for this form (see docs/roadmap.md) — submission is
// simulated client-side so the UI and validation are real and testable now,
// without pretending a submission is actually delivered anywhere.
export function ContactForm({ labels, categories }: ContactFormProps) {
  const [status, setStatus] = React.useState<'idle' | 'submitting' | 'submitted'>('idle');
  const formId = React.useId();

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus('submitting');
    window.setTimeout(() => setStatus('submitted'), 400);
  };

  if (status === 'submitted') {
    return <Callout title={labels.successTitle}>{labels.successDescription}</Callout>;
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <Stack gap="xs">
          <Label htmlFor={`${formId}-name`}>{labels.name}</Label>
          <Input id={`${formId}-name`} name="name" autoComplete="name" placeholder={labels.namePlaceholder} required />
        </Stack>
        <Stack gap="xs">
          <Label htmlFor={`${formId}-email`}>{labels.email}</Label>
          <Input id={`${formId}-email`} name="email" type="email" autoComplete="email" placeholder={labels.emailPlaceholder} required />
        </Stack>
      </div>

      <Stack gap="xs">
        <Label htmlFor={`${formId}-category`}>{labels.category}</Label>
        <Select id={`${formId}-category`} name="category" defaultValue={categories[0]?.value}>
          {categories.map((category) => (
            <option key={category.value} value={category.value}>
              {category.label}
            </option>
          ))}
        </Select>
      </Stack>

      <Stack gap="xs">
        <Label htmlFor={`${formId}-message`}>{labels.message}</Label>
        <Textarea id={`${formId}-message`} name="message" rows={6} placeholder={labels.messagePlaceholder} required />
      </Stack>

      <div>
        <Button type="submit" size="lg" loading={status === 'submitting'}>
          {status === 'submitting' ? labels.submitting : labels.submit}
        </Button>
      </div>
    </form>
  );
}
