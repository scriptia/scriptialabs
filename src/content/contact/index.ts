// Contact is a form, not a legal document, so it isn't in the legal
// document registry — but it shares the same "structure in content,
// copy in messages" pattern. Category order here drives both the form's
// <select> options and their translated labels (contact.form.categories.*).
export const contactFormCategories = ['general', 'support', 'security', 'privacy', 'partnerships', 'media'] as const;

export type ContactFormCategoryKey = (typeof contactFormCategories)[number];
