import { getLogtoContext, signOut } from '@logto/next/server-actions';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { logtoConfig } from '../logto';
import { getAccount } from '../lib/backend';
import SideNav from './SideNav';
import s from './dashboard.module.css';

export const dynamic = 'force-dynamic';

// PRIVACY: identity is the Logto sub; displayName is for display only.
export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const { isAuthenticated, claims } = await getLogtoContext(logtoConfig, {
    fetchUserInfo: true,
  });
  if (!isAuthenticated) redirect('/');

  const userId = claims?.sub as string;
  const displayName = (claims?.email ?? claims?.username ?? userId) as string;

  let balance: number | null = null;
  try {
    const account = await getAccount(userId);
    balance = account?.remaining ?? null;
  } catch {
    // backend down: show "—"; each page handles its own error state
  }

  async function doSignOut() {
    'use server';
    await signOut(logtoConfig);
  }

  return (
    <div className={s.shell}>
      <SideNav balance={balance} displayName={displayName} signOutAction={doSignOut} />
      <main className={s.main}>{children}</main>
    </div>
  );
}
