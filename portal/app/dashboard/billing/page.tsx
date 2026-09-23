import { getLogtoContext } from '@logto/next/server-actions';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { logtoConfig } from '../../logto';
import { createInvoice, getAccount, getPayments } from '../../lib/backend';
import TopupForm from '../../components/TopupForm';
import s from '../dashboard.module.css';

export const dynamic = 'force-dynamic';

export default async function Billing() {
  const { claims } = await getLogtoContext(logtoConfig, { fetchUserInfo: true });
  const userId = claims?.sub as string;
  const [account, history] = await Promise.all([
    getAccount(userId).catch(() => null),
    getPayments(userId).catch(() => [] as Awaited<ReturnType<typeof getPayments>>),
  ]);

  async function startTopup(amount: number) {
    'use server';
    const url = await createInvoice(userId, amount);
    redirect(url);
  }

  return (
    <>
      <div className={s.pageHead}>
        <div>
          <h1 className={s.pageTitle}>Billing</h1>
          <p className={s.pageSub}>
            Pay with USDT, BTC, ETH or 300+ other coins. $1 = $1 of balance, credited
            automatically after network confirmation. No cards, no bank, no KYC.
          </p>
        </div>
      </div>

      <div className={s.tiles}>
        <div className={s.tile}>
          <div className={s.tileLabel}>Credit remaining</div>
          <div className={s.tileValue}>
            {account ? `$${account.remaining.toFixed(2)}` : '—'}
          </div>
          <div className={s.tileNote}>
            budget ${account?.max_budget.toFixed(2) ?? '0.00'} · spent $
            {account?.spend.toFixed(2) ?? '0.00'}
          </div>
        </div>
        <div className={s.tile}>
          <div className={s.tileLabel}>Pricing</div>
          <div className={s.tileValue} style={{ fontSize: '1.1rem', lineHeight: 1.4 }}>
            Pay per token.
            <br />
            Keep the change.
          </div>
          <div className={s.tileNote}>
            <Link href="/#pricing">View model prices →</Link>
          </div>
        </div>
      </div>

      <div className={s.card}>
        <h3 className={s.cardTitle}>Top up with crypto</h3>
        <TopupForm onTopup={startTopup} />
      </div>

      <div className={s.card}>
        <h3 className={s.cardTitle}>Billing history</h3>
        {history.length ? (
          <table className={s.table}>
            <thead>
              <tr>
                <th>Date</th>
                <th>Amount</th>
                <th>Paid with</th>
                <th>Transaction</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {history.map((p) => (
                <tr key={`${p.txid}-${p.created_at}`}>
                  <td>{new Date(p.created_at).toISOString().slice(0, 10)}</td>
                  <td>${Number(p.amount).toFixed(2)}</td>
                  <td className={s.mono}>{p.currency}</td>
                  <td className={s.mono}>
                    {(p.txid ?? '').slice(0, 14)}
                    {(p.txid ?? '').length > 14 ? '…' : ''}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <span className={s.tState}>{p.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className={s.empty}>No top-ups yet. Your first one will appear here.</p>
        )}
      </div>
    </>
  );
}
