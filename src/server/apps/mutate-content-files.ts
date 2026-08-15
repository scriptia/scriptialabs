import 'server-only';

import { IndentationText, Node, Project, SyntaxKind, type ObjectLiteralExpression, type SourceFile, type TypeNode } from 'ts-morph';

import type { AppsIngestPayload, LegalDocumentInput } from '@/server/validation/apps';
import { kebabToCamel, pickAutoAccent, toLiteral } from './serialize';

// Splices one new product's data into the six source files that together
// define a product's public presence on scriptialabs.com, entirely via the
// TypeScript AST rather than text patching — see ADR-012 for why. Every
// mutation here is additive: an existing product's entry is never touched,
// and a slug that already exists in the registry is rejected before this
// module ever runs (checked by the route, from the freshly-fetched file
// text, not from anything cached).

export const TARGET_PATHS = {
  productsIndex: 'src/content/products/index.ts',
  messageKeys: 'src/content/products/message-keys.ts',
  productLegal: 'src/content/legal/product-legal.ts',
  messagesEn: 'src/messages/en/index.ts',
  messagesEs: 'src/messages/es/index.ts',
  messagesCa: 'src/messages/ca/index.ts'
} as const;

export type TargetPath = (typeof TARGET_PATHS)[keyof typeof TARGET_PATHS];

const LOCALE_FILE: Record<'en' | 'es' | 'ca', TargetPath> = {
  en: TARGET_PATHS.messagesEn,
  es: TARGET_PATHS.messagesEs,
  ca: TARGET_PATHS.messagesCa
};

export type FileUpdate = { path: TargetPath; content: string };

function getObjectLiteralInitializer(sourceFile: SourceFile, varDeclName: string): ObjectLiteralExpression {
  const varDecl = sourceFile.getVariableDeclarationOrThrow(varDeclName);
  let init = varDecl.getInitializerOrThrow();
  // `productRegistry` is declared `= {...} satisfies Record<...>` — unwrap the
  // satisfies expression to reach the actual object literal underneath.
  if (Node.isSatisfiesExpression(init) || Node.isAsExpression(init)) {
    init = init.getExpression();
  }
  return init.asKindOrThrow(SyntaxKind.ObjectLiteralExpression);
}

function nestedObjectProperty(parent: ObjectLiteralExpression, name: string): ObjectLiteralExpression {
  return parent
    .getPropertyOrThrow(name)
    .asKindOrThrow(SyntaxKind.PropertyAssignment)
    .getInitializerIfKindOrThrow(SyntaxKind.ObjectLiteralExpression);
}

function extendUnionType(typeNode: TypeNode, literal: string) {
  typeNode.replaceWithText(`${typeNode.getText()} | ${literal}`);
}

function quote(value: string): string {
  return `'${value.replace(/'/g, "\\'")}'`;
}

// {docKey: {title, description, sections: {id: {title, body}}}} for one locale.
function legalContentForLocale(documents: LegalDocumentInput[], locale: 'en' | 'es' | 'ca') {
  const out: Record<string, unknown> = {};
  for (const doc of documents) {
    const sections: Record<string, unknown> = {};
    for (const section of doc.sections) {
      sections[section.id] = { title: section.title[locale], body: section.body[locale] };
    }
    out[doc.docKey] = { title: doc.title[locale], description: doc.description[locale], sections };
  }
  return out;
}

// {name, description, hero, features, seo} for one locale, matching every
// existing products.<key> entry's shape exactly.
function productCopyForLocale(payload: AppsIngestPayload, locale: 'en' | 'es' | 'ca') {
  const { product } = payload;
  const features: Record<string, unknown> = {};
  for (const feature of product.features) {
    features[feature.id] = { title: feature.title[locale], description: feature.description[locale] };
  }
  return {
    name: product.name[locale],
    description: product.tagline[locale],
    hero: { title: product.hero.title[locale], description: product.hero.description[locale] },
    features,
    seo: { title: product.seo.title[locale], description: product.seo.description[locale] }
  };
}

export function buildFileUpdates(payload: AppsIngestPayload, currentFiles: Record<TargetPath, string>): FileUpdate[] {
  const { slug } = payload;
  const messageKey = kebabToCamel(slug);
  const accent = pickAutoAccent(slug);
  const quotedSlug = quote(slug);

  const project = new Project({
    useInMemoryFileSystem: true,
    manipulationSettings: { indentationText: IndentationText.TwoSpaces }
  });

  const updates: FileUpdate[] = [];

  // --- src/content/products/index.ts -------------------------------------
  {
    const sf = project.createSourceFile(TARGET_PATHS.productsIndex, currentFiles[TARGET_PATHS.productsIndex]);
    const typeLiteral = sf.getTypeAliasOrThrow('ProductRecord').getTypeNodeOrThrow().asKindOrThrow(SyntaxKind.TypeLiteral);
    for (const member of ['id', 'slug', 'accent'] as const) {
      extendUnionType(typeLiteral.getPropertyOrThrow(member).getTypeNodeOrThrow(), quotedSlug);
    }

    const registry = getObjectLiteralInitializer(sf, 'productRegistry');
    registry.addPropertyAssignment({
      name: quotedSlug,
      initializer: toLiteral(
        {
          id: slug,
          slug,
          nameKey: `products.${messageKey}.name`,
          descriptionKey: `products.${messageKey}.description`,
          status: 'draft',
          accent,
          links: { canonical: `/${slug}` },
          hero: {
            titleKey: `products.${messageKey}.hero.title`,
            descriptionKey: `products.${messageKey}.hero.description`
          },
          features: payload.product.features.map((f) => ({
            titleKey: `products.${messageKey}.features.${f.id}.title`,
            descriptionKey: `products.${messageKey}.features.${f.id}.description`
          })),
          seo: {
            titleKey: `products.${messageKey}.seo.title`,
            descriptionKey: `products.${messageKey}.seo.description`,
            indexable: false
          },
          badges: [],
          availability: 'private',
          translations: {},
          social: {},
          futureFlags: {}
        },
        2
      )
    });

    sf.formatText();
    updates.push({ path: TARGET_PATHS.productsIndex, content: sf.getFullText() });
  }

  // --- src/content/products/message-keys.ts -------------------------------
  {
    const sf = project.createSourceFile(TARGET_PATHS.messageKeys, currentFiles[TARGET_PATHS.messageKeys]);
    const varDecl = sf.getVariableDeclarationOrThrow('productMessageKeyById');
    const typeRef = varDecl.getTypeNodeOrThrow().asKindOrThrow(SyntaxKind.TypeReference);
    const unionArg = typeRef.getTypeArguments()[1];
    extendUnionType(unionArg, quote(messageKey));

    const objLit = varDecl.getInitializerIfKindOrThrow(SyntaxKind.ObjectLiteralExpression);
    objLit.addPropertyAssignment({ name: quotedSlug, initializer: quote(messageKey) });

    sf.formatText();
    updates.push({ path: TARGET_PATHS.messageKeys, content: sf.getFullText() });
  }

  // --- src/content/legal/product-legal.ts ---------------------------------
  {
    const sf = project.createSourceFile(TARGET_PATHS.productLegal, currentFiles[TARGET_PATHS.productLegal]);
    const registry = getObjectLiteralInitializer(sf, 'productLegalDocuments');
    const entry: Record<string, unknown> = {};
    for (const doc of payload.legal.documents) {
      entry[doc.docKey] = {
        slug: doc.slug,
        lastUpdated: doc.lastUpdated,
        ...(doc.labelKey ? { labelKey: doc.labelKey } : {}),
        sections: doc.sections.map((s) => s.id)
      };
    }
    registry.addPropertyAssignment({ name: quotedSlug, initializer: toLiteral(entry, 2) });

    sf.formatText();
    updates.push({ path: TARGET_PATHS.productLegal, content: sf.getFullText() });
  }

  // --- src/messages/{en,es,ca}/index.ts -----------------------------------
  for (const locale of ['en', 'es', 'ca'] as const) {
    const path = LOCALE_FILE[locale];
    const sf = project.createSourceFile(path, currentFiles[path]);
    const root = getObjectLiteralInitializer(sf, 'messages');

    nestedObjectProperty(root, 'products').addPropertyAssignment({
      name: quote(messageKey),
      initializer: toLiteral(productCopyForLocale(payload, locale), 4)
    });

    nestedObjectProperty(root, 'productLegal').addPropertyAssignment({
      name: quote(messageKey),
      initializer: toLiteral(legalContentForLocale(payload.legal.documents, locale), 4)
    });

    sf.formatText();
    updates.push({ path, content: sf.getFullText() });
  }

  return updates;
}

export function accentForSlug(slug: string) {
  return pickAutoAccent(slug);
}

export function messageKeyForSlug(slug: string) {
  return kebabToCamel(slug);
}
