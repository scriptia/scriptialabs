import 'server-only';

import { gunzipSync } from 'node:zlib';

import { importPKCS8, SignJWT } from 'jose';

export type AscCredentials = {
  issuerId: string;
  keyId: string;
  privateKeyPem: string;
  vendorNumber: string;
  ascAppId: string;
};

// App Store Connect API tokens: ES256, 20 minutes max lifetime, signed with
// the .p8 private key downloaded when the API key was created. The same
// token type authorizes every ASC API endpoint, Sales Reports included —
// there is no separate legacy auth for reports on this API generation.
async function signAscJwt({ issuerId, keyId, privateKeyPem }: AscCredentials): Promise<string> {
  const key = await importPKCS8(privateKeyPem, 'ES256');

  return new SignJWT({})
    .setProtectedHeader({ alg: 'ES256', kid: keyId, typ: 'JWT' })
    .setIssuer(issuerId)
    .setIssuedAt()
    .setExpirationTime('20m')
    .setAudience('appstoreconnect-v1')
    .sign(key);
}

type SalesReportRow = Record<string, string>;

// Parses Apple's tab-separated Sales Report (gzip, one line of headers).
function parseTsv(text: string): SalesReportRow[] {
  const lines = text.split('\n').filter((line) => line.trim().length > 0);

  if (lines.length === 0) {
    return [];
  }

  const headers = lines[0].split('\t');

  return lines.slice(1).map((line) => {
    const cells = line.split('\t');
    const row: SalesReportRow = {};

    headers.forEach((header, index) => {
      row[header] = cells[index] ?? '';
    });

    return row;
  });
}

// One calendar day's SALES report, filtered to this app's installs (Apple
// reports every SKU on the account in one file). A day with no sales yet
// (today, or a day Apple hasn't finished processing) 404s — that's "0
// downloads", not an error.
async function fetchDailyDownloads(creds: AscCredentials, dateIso: string): Promise<number> {
  const jwt = await signAscJwt(creds);
  const url = new URL('https://api.appstoreconnect.apple.com/v1/salesReports');

  url.searchParams.set('filter[frequency]', 'DAILY');
  url.searchParams.set('filter[reportDate]', dateIso);
  url.searchParams.set('filter[reportSubType]', 'SUMMARY');
  url.searchParams.set('filter[reportType]', 'SALES');
  url.searchParams.set('filter[vendorNumber]', creds.vendorNumber);

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${jwt}`, Accept: 'application/a-gzip' }
  });

  if (response.status === 404) {
    return 0;
  }

  if (!response.ok) {
    throw new Error(`App Store Connect sales report request failed (${response.status}): ${await response.text().catch(() => '')}`);
  }

  const gz = Buffer.from(await response.arrayBuffer());
  const rows = parseTsv(gunzipSync(gz).toString('utf8'));

  return rows
    .filter((row) => row['Apple Identifier'] === creds.ascAppId)
    .reduce((sum, row) => sum + (Number(row['Units']) || 0), 0);
}

// Sums downloads for a Monday-start week. Report availability trails real
// time by roughly a day, so a week that isn't fully closed yet will
// undercount until synced again later.
export async function fetchWeeklyDownloads(creds: AscCredentials, weekStartIso: string): Promise<number> {
  const start = new Date(`${weekStartIso}T00:00:00Z`);
  let total = 0;

  for (let i = 0; i < 7; i += 1) {
    const day = new Date(start);

    day.setUTCDate(start.getUTCDate() + i);

    if (day.getTime() > Date.now()) {
      break;
    }

    total += await fetchDailyDownloads(creds, day.toISOString().slice(0, 10));
  }

  return total;
}
