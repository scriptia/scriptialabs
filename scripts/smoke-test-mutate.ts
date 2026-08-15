import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildFileUpdates, TARGET_PATHS } from '../src/server/apps/mutate-content-files';
import type { AppsIngestPayload } from '../src/server/validation/apps';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '..');

function loc(en: string, es: string, ca: string) {
  return { en, es, ca };
}

const payload: AppsIngestPayload = {
  runId: '2026-W33',
  slug: 'ledgerly-test',
  product: {
    name: loc('Ledgerly', 'Ledgerly', 'Ledgerly'),
    tagline: loc('Track spending without the spreadsheet.', 'Controla tus gastos sin la hoja de cálculo.', 'Controla les teves despeses sense el full de càlcul.'),
    hero: {
      title: loc('Spending, at a glance.', 'Tus gastos, de un vistazo.', 'Les teves despeses, d’un cop d’ull.'),
      description: loc(
        'Ledgerly turns your bank exports into a clear picture of where your money goes, with no manual categorizing.',
        'Ledgerly convierte tus extractos bancarios en una imagen clara de a dónde va tu dinero, sin categorizar a mano.',
        'Ledgerly converteix els teus extractes bancaris en una imatge clara d’on va el teu diner, sense categoritzar a mà.'
      )
    },
    features: [
      { id: 'autoImport', title: loc('Automatic import', 'Importación automática', 'Importació automàtica'), description: loc('Drop in a bank export and Ledgerly reads it.', 'Suelta un extracto bancario y Ledgerly lo lee.', 'Deixa anar un extracte bancari i Ledgerly el llegeix.') },
      { id: 'categories', title: loc('Smart categories', 'Categorías inteligentes', 'Categories intel·ligents'), description: loc('Spending sorts itself into categories you can rename.', 'El gasto se ordena solo en categorías que puedes renombrar.', 'La despesa s’ordena sola en categories que pots reanomenar.') },
      { id: 'monthly', title: loc('Monthly review', 'Resumen mensual', 'Resum mensual'), description: loc('A one-page summary of the month, every month.', 'Un resumen de una página del mes, cada mes.', 'Un resum d’una pàgina del mes, cada mes.') }
    ],
    seo: {
      title: loc('Ledgerly — track spending without a spreadsheet', 'Ledgerly — controla tus gastos sin hoja de cálculo', 'Ledgerly — controla les despeses sense full de càlcul'),
      description: loc('Ledgerly reads your bank exports and shows where your money goes.', 'Ledgerly lee tus extractos bancarios y muestra a dónde va tu dinero.', 'Ledgerly llegeix els teus extractes bancaris i mostra on va el teu diner.')
    }
  },
  legal: {
    documents: [
      {
        docKey: 'privacy',
        slug: 'privacy',
        lastUpdated: '2026-08-12',
        title: loc('Ledgerly Privacy Policy', 'Política de Privacidad de Ledgerly', 'Política de Privacitat de Ledgerly'),
        description: loc('How Ledgerly handles your data.', 'Cómo gestiona Ledgerly tus datos.', 'Com gestiona Ledgerly les teves dades.'),
        sections: [
          {
            id: 'introduction',
            title: loc('Introduction', 'Introducción', 'Introducció'),
            body: {
              en: ['This policy explains what Ledgerly collects and why.'],
              es: ['Esta política explica qué recopila Ledgerly y por qué.'],
              ca: ['Aquesta política explica què recull Ledgerly i per què.']
            }
          }
        ]
      }
    ]
  },
  supportEmail: 'support@scriptiastories.com'
};

const currentFiles = {} as Record<(typeof TARGET_PATHS)[keyof typeof TARGET_PATHS], string>;
for (const p of Object.values(TARGET_PATHS)) {
  currentFiles[p] = fs.readFileSync(path.join(REPO, p), 'utf-8');
}

const updates = buildFileUpdates(payload, currentFiles);

const outDir = path.join(REPO, '.smoke-test-out');
fs.mkdirSync(outDir, { recursive: true });
for (const u of updates) {
  const outPath = path.join(outDir, u.path.replace(/\//g, '__'));
  fs.writeFileSync(outPath, u.content, 'utf-8');
  console.log(`wrote ${outPath} (${u.content.length} chars)`);
}
