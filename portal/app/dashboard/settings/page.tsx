import { getLogtoContext, signOut } from '@logto/next/server-actions';
import { redirect } from 'next/navigation';
import { logtoConfig } from '../../logto';
import { deleteAccount } from '../../lib/backend';
import DeleteAccount from './DeleteAccount';
import s from '../dashboard.module.css';

export const dynamic = 'force-dynamic';

export default async function Settings() {
  const { claims } = await getLogtoContext(logtoConfig, { fetchUserInfo: true });
  const userId = claims?.sub as string;

  async function doDelete() {
    'use server';
    await deleteAccount(userId);
    await signOut(logtoConfig); // the identity is gone: drop the session and go home
    redirect('/');
  }
  const username = (claims?.username ?? '—') as string;
  const email = (claims?.email ?? null) as string | null;

  return (
    <>
      <div className={s.pageHead}>
        <div>
          <h1 className={s.pageTitle}>Settings</h1>
          <p className={s.pageSub}>
            Everything we know about you fits on this screen. That’s the point.
          </p>
        </div>
      </div>

      <div className={s.card}>
        <h3 className={s.cardTitle}>Account</h3>
        <table className={s.table}>
          <tbody>
            <tr>
              <td style={{ color: 'var(--ink-soft)', width: 180 }}>Username</td>
              <td>{username}</td>
            </tr>
            <tr>
              <td style={{ color: 'var(--ink-soft)' }}>Account id</td>
              <td className={s.mono}>{userId}</td>
            </tr>
            <tr>
              <td style={{ color: 'var(--ink-soft)' }}>Email</td>
              <td>
                {email ?? (
                  <span style={{ color: 'var(--ink-faint)' }}>
                    not set, and it can stay that way
                  </span>
                )}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className={s.card}>
        <h3 className={s.cardTitle}>Danger zone</h3>
        <p className={s.pageSub} style={{ maxWidth: 'none', marginBottom: 'var(--space-md)' }}>
          Delete your account and everything tied to it: keys, balance, identity.
          Immediate and irreversible. Your top-up history stays in our ledger as
          anonymous accounting rows (an internal id and amounts, nothing you typed).
        </p>
        <DeleteAccount onDelete={doDelete} />
      </div>
    </>
  );
}
