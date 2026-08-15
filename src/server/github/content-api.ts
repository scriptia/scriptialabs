import 'server-only';

// A thin wrapper over GitHub's Contents API, used only by the apps-ingest route
// (see ADR-012) to commit generated source files straight to `main` without a
// local git checkout — there isn't one available inside a Vercel serverless
// function, and the Contents API needs nothing but HTTPS + a token.
//
// This is deliberately NOT a general-purpose GitHub client: two calls, no
// retries, no pagination, because that is everything the mutation flow needs.

const API_ROOT = 'https://api.github.com';
const OWNER = 'scriptia';
const REPO = 'scriptialabs';
const BRANCH = 'main';

function headers(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28'
  };
}

export class GitHubContentError extends Error {
  constructor(
    public readonly path: string,
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = 'GitHubContentError';
  }
}

export type RemoteFile = {
  content: string;
  sha: string;
};

// null means "does not exist yet" (404) — every target file already exists in
// this repo today, so a 404 here is unexpected, but callers should not have to
// special-case "brand new repo" to stay correct.
export async function getFile(token: string, path: string): Promise<RemoteFile | null> {
  const url = `${API_ROOT}/repos/${OWNER}/${REPO}/contents/${path}?ref=${BRANCH}`;
  const response = await fetch(url, { headers: headers(token), cache: 'no-store' });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new GitHubContentError(path, response.status, await response.text());
  }

  const body = (await response.json()) as { content: string; sha: string; encoding: string };

  if (body.encoding !== 'base64') {
    throw new GitHubContentError(path, 500, `Unexpected encoding ${body.encoding}`);
  }

  return { content: Buffer.from(body.content, 'base64').toString('utf-8'), sha: body.sha };
}

export async function putFile(token: string, path: string, content: string, sha: string, message: string): Promise<{ sha: string }> {
  const url = `${API_ROOT}/repos/${OWNER}/${REPO}/contents/${path}`;
  const response = await fetch(url, {
    method: 'PUT',
    headers: { ...headers(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      content: Buffer.from(content, 'utf-8').toString('base64'),
      sha,
      branch: BRANCH
    })
  });

  if (!response.ok) {
    throw new GitHubContentError(path, response.status, await response.text());
  }

  const body = (await response.json()) as { content: { sha: string } };
  return { sha: body.content.sha };
}
