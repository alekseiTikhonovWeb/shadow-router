import { getLogtoContext } from '@logto/next/server-actions';
import Link from 'next/link';
import { logtoConfig } from '../../logto';
import { getAccount } from '../../lib/backend';
import s from '../dashboard.module.css';

export const dynamic = 'force-dynamic';

export default async function Usage() {
  const { claims } = await getLogtoContext(logtoConfig, { fetchUserInfo: true });
  const userId = claims?.sub as string;
  const account = await getAccount(userId).catch(() => null);

  const budget = account?.max_budget ?? 0;
  const spend = account?.spend ?? 0;
  const pct = budget > 0 ? Math.min(100, (spend / budget) * 100) : 0;

  return (
    <>
      <div className={s.pageHead}>
        <div>
          <h1 className={s.pageTitle}>Usage</h1>
          <p className={s.pageSub}>
            Spend is metered per token at the prices on your key. We keep counters,
            never contents.
          </p>
        </div>
      </div>

      <div className={s.tiles}>
        <div className={s.tile}>
          <div className={s.tileLabel}>Total spend</div>
          <div className={s.tileValue}>${spend.toFixed(4)}</div>
        </div>
        <div className={s.tile}>
          <div className={s.tileLabel}>Remaining</div>
          <div className={s.tileValue}>${(account?.remaining ?? 0).toFixed(2)}</div>
        </div>
        <div className={s.tile}>
          <div className={s.tileLabel}>Lifetime budget</div>
          <div className={s.tileValue}>${budget.toFixed(2)}</div>
        </div>
      </div>

      <div className={s.card}>
        <h3 className={s.cardTitle}>Budget used</h3>
        <div className={s.meter}>
          <div className={s.meterFill} style={{ width: `${pct}%` }} />
        </div>
        <p className={s.pageSub} style={{ marginTop: 10 }}>
          {budget > 0
            ? `${pct.toFixed(1)}% of your lifetime budget spent.`
            : 'Balance is $0. Top up to start using the models.'}{' '}
          <Link href="/dashboard/billing">Top up →</Link>
        </p>
      </div>

      <div className={s.card}>
        <h3 className={s.cardTitle}>Per-day and per-model charts</h3>
        <p className={s.empty}>Coming soon. Daily spend, tokens and requests by model.</p>
      </div>
    </>
  );
}
