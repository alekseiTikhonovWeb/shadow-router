import { getLogtoContext } from '@logto/next/server-actions';
import Link from 'next/link';
import { logtoConfig } from '../logto';
import { getAccount } from '../lib/backend';
import { MODELS } from '../lib/models';
import { API_URL } from '../lib/urls';
import CopyKey from '../components/CopyKey';
import s from './dashboard.module.css';

export const dynamic = 'force-dynamic';

export default async function Overview() {
  const { claims } = await getLogtoContext(logtoConfig, { fetchUserInfo: true });
  const userId = claims?.sub as string;
  const account = await getAccount(userId).catch(() => null);

  const curl = `curl ${API_URL}/chat/completions \\
  -H "Authorization: Bearer YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"model": "gemini-flash", "messages": [{"role": "user", "content": "Hello"}]}'`;

  return (
    <>
      <div className={s.pageHead}>
        <div>
          <h1 className={s.pageTitle}>Overview</h1>
          <p className={s.pageSub}>
            One balance for the chat and the API. No email on file. This account is
            just an id and a key.
          </p>
        </div>
      </div>

      {account ? (
        <div className={s.tiles}>
          <div className={s.tile}>
            <div className={s.tileLabel}>Balance remaining</div>
            <div className={s.tileValue}>${account.remaining.toFixed(2)}</div>
            <div className={s.tileNote}>
              <Link href="/dashboard/billing">Top up with crypto →</Link>
            </div>
          </div>
          <div className={s.tile}>
            <div className={s.tileLabel}>Spent so far</div>
            <div className={s.tileValue}>${account.spend.toFixed(2)}</div>
            <div className={s.tileNote}>
              <Link href="/dashboard/usage">View usage →</Link>
            </div>
          </div>
          <div className={s.tile}>
            <div className={s.tileLabel}>Your API key</div>
            <div className={`${s.tileValue} ${s.mono}`} style={{ fontSize: '1rem' }}>
              {account.dev_key.slice(0, 10)}…{account.dev_key.slice(-4)}
            </div>
            <div className={s.tileNote}>
              <CopyKey value={account.dev_key} />
            </div>
          </div>
        </div>
      ) : (
        <div className={s.card}>
          <p className={s.empty}>
            Your account is being provisioned. Refresh in a few seconds, or sign out
            and back in if this persists.
          </p>
        </div>
      )}

      <div className={s.card}>
        <h3 className={s.cardTitle}>Quickstart</h3>
        <p className={s.cardSub}>Works with any OpenAI SDK</p>
        <div className={s.code}>
          <span className={s.codeAccent}># point your SDK, Cursor or agent at us</span>
          {'\n'}
          {curl}
        </div>
      </div>

      <div className={s.card}>
        <h3 className={s.cardTitle}>Models on your key</h3>
        <div className={s.models}>
          {MODELS.map((m) => (
            <div className={s.model} key={m.name}>
              <div className={s.modelName}>
                {m.name}
                <span className={s.live}>● live</span>
              </div>
              <div className={s.modelPrice}>
                ${m.input.toFixed(2)} in · ${m.output.toFixed(2)} out / 1M
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
