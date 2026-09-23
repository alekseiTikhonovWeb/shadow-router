import { getLogtoContext } from '@logto/next/server-actions';
import { revalidatePath } from 'next/cache';
import { logtoConfig } from '../../logto';
import { getAccount, rotateKey } from '../../lib/backend';
import CopyKey from '../../components/CopyKey';
import RotateButton from '../../components/RotateButton';
import s from '../dashboard.module.css';

export const dynamic = 'force-dynamic';

export default async function Keys() {
  const { claims } = await getLogtoContext(logtoConfig, { fetchUserInfo: true });
  const userId = claims?.sub as string;
  const account = await getAccount(userId).catch(() => null);

  async function doRotate() {
    'use server';
    await rotateKey(userId);
    revalidatePath('/dashboard/keys');
  }

  return (
    <>
      <div className={s.pageHead}>
        <div>
          <h1 className={s.pageTitle}>API keys</h1>
          <p className={s.pageSub}>
            Your personal key for Cursor, agents and any OpenAI-compatible SDK. It
            spends from the same balance as the web chat.
          </p>
        </div>
        {account && <RotateButton rotate={doRotate} />}
      </div>

      <div className={s.card}>
        {account ? (
          <table className={s.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Key</th>
                <th>Models</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Personal dev key</td>
                <td className={s.mono}>
                  {account.dev_key.slice(0, 10)}…{account.dev_key.slice(-4)}
                </td>
                <td>{account.models.length}</td>
                <td style={{ textAlign: 'right' }}>
                  <CopyKey value={account.dev_key} />
                </td>
              </tr>
            </tbody>
          </table>
        ) : (
          <p className={s.empty}>No key yet. The account is still provisioning.</p>
        )}
      </div>

      <div className={s.card}>
        <h3 className={s.cardTitle}>Good to know</h3>
        <p className={s.pageSub} style={{ maxWidth: 'none' }}>
          Rotating the key kills the old one instantly. Update it in your tools right
          after. The web chat uses its own internal key, so rotation never breaks the
          chat. We never log prompt contents on any key.
        </p>
      </div>
    </>
  );
}
