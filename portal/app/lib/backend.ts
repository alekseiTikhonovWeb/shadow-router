// Server-only: holds INTERNAL_API_TOKEN and sends the id from the verified Logto session.
const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:8088';
const INTERNAL_TOKEN = process.env.INTERNAL_API_TOKEN ?? '';

// One backend call: token, no cache, one error format.
async function call(method: string, path: string, body?: unknown) {
  const r = await fetch(`${BACKEND_URL}${path}`, {
    method,
    headers: {
      'X-Internal-Token': INTERNAL_TOKEN,
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });
  if (!r.ok) {
    throw new Error(`backend ${method} ${path.split('?')[0]} -> ${r.status}`);
  }
  return r;
}

const byUser = (path: string, userId: string) => `${path}?user_id=${encodeURIComponent(userId)}`;

export type Account = {
  user_id: string;
  dev_key: string;
  max_budget: number;
  spend: number;
  remaining: number;
  models: string[];
};

// /account self-heals unknown users, so a missing account is never a 404 here.
export async function getAccount(userId: string): Promise<Account> {
  return (await call('GET', byUser('/account', userId))).json();
}

export async function rotateKey(userId: string): Promise<string> {
  const r = await call('POST', '/rotate-key', { user_id: userId });
  return (await r.json()).dev_key as string;
}

export type Payment = {
  amount: number;
  currency: string;
  txid: string | null;
  status: string;
  created_at: string;
};

export async function getPayments(userId: string): Promise<Payment[]> {
  const r = await call('GET', byUser('/payments', userId));
  return (await r.json()).payments as Payment[];
}

// Creates a NOWPayments invoice; returns the checkout URL to redirect to.
export async function createInvoice(userId: string, amount: number): Promise<string> {
  const r = await call('POST', '/billing/create-invoice', { user_id: userId, amount });
  return (await r.json()).invoice_url as string;
}

// Deletes everything: LiteLLM account, mapping, Logto identity. Irreversible.
export async function deleteAccount(userId: string): Promise<void> {
  await call('DELETE', byUser('/account', userId));
}
