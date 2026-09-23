'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Wordmark } from '../components/SiteHeader';
import ActionButton from '../components/ActionButton';
import { CHAT_URL } from '../lib/urls';
import s from './dashboard.module.css';

// One icon set (stroke 1.8, currentColor).
const I = {
  overview: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7.5" height="7.5" rx="1.8" />
      <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.8" />
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.8" />
      <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.8" />
    </svg>
  ),
  keys: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="14" r="4.2" />
      <path d="M11 11l8.5-8.5M15.5 6.5l3 3M12.5 9.5l2.2 2.2" />
    </svg>
  ),
  usage: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19V10M10 19V5M16 19v-6M21 19H3.5" />
    </svg>
  ),
  billing: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2.8" y="5.5" width="18.4" height="13" rx="2.4" />
      <path d="M2.8 9.8h18.4" />
      <path d="M6.5 15h4" />
    </svg>
  ),
  settings: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3.2" />
      <path d="M19.2 12a7.2 7.2 0 0 0-.1-1.2l2-1.5-2-3.4-2.3 1a7.4 7.4 0 0 0-2-1.2L14.4 3h-4l-.4 2.7a7.4 7.4 0 0 0-2 1.2l-2.3-1-2 3.4 2 1.5a7.2 7.2 0 0 0 0 2.4l-2 1.5 2 3.4 2.3-1a7.4 7.4 0 0 0 2 1.2l.4 2.7h4l.4-2.7a7.4 7.4 0 0 0 2-1.2l2.3 1 2-3.4-2-1.5c.06-.4.1-.8.1-1.2Z" />
    </svg>
  ),
  chat: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 11.6c0 4.2-4 7.4-9 7.4-1 0-2-.13-2.9-.37L4 20l1.2-3.4A7 7 0 0 1 3 11.6C3 7.4 7 4.2 12 4.2s9 3.2 9 7.4Z" />
    </svg>
  ),
};

const NAV = [
  { href: '/dashboard', label: 'Overview', icon: I.overview },
  { href: '/dashboard/keys', label: 'API keys', icon: I.keys },
  { href: '/dashboard/usage', label: 'Usage', icon: I.usage },
  { href: '/dashboard/billing', label: 'Billing', icon: I.billing },
  { href: '/dashboard/settings', label: 'Settings', icon: I.settings },
];

export default function SideNav({
  balance,
  displayName,
  signOutAction,
}: {
  balance: number | null;
  displayName: string;
  signOutAction: () => Promise<void>;
}) {
  const path = usePathname();
  // Optimistic highlight: the active pill moves on click, before the server renders the new page.
  const [clicked, setClicked] = useState<string | null>(null);
  useEffect(() => setClicked(null), [path]);
  const active = clicked ?? path;
  return (
    <aside className={s.sidebar}>
      <div className={s.sideBrand}>
        <Wordmark />
      </div>

      <nav className={s.nav}>
        {NAV.map((it) => (
          <Link
            key={it.href}
            href={it.href}
            className={`${s.navItem} ${active === it.href ? s.navActive : ''}`}
            onClick={() => setClicked(it.href)}
          >
            <span className={s.navIcon}>{it.icon}</span>
            {it.label}
          </Link>
        ))}
        <a
          href={CHAT_URL}
          className={s.navItem}
          target="_blank"
          rel="noreferrer"
        >
          <span className={s.navIcon}>{I.chat}</span>
          Web chat
          <span className={s.navExt}>↗</span>
        </a>
      </nav>

      <div className={s.sideBottom}>
        <div className={s.creditCard}>
          <div>
            <div className={s.creditLabel}>Balance</div>
            <div className={s.creditValue}>
              {balance == null ? '—' : `$${balance.toFixed(2)}`}
            </div>
          </div>
          <Link href="/dashboard/billing" className="btn btn-primary">
            Top up
          </Link>
        </div>
        <div className={s.userRow}>
          <span className={s.userChip}>{displayName.slice(0, 1)}</span>
          <span className={s.userName}>{displayName}</span>
        </div>
        <ActionButton action={signOutAction} className={s.signOut} pendingText="…">
          Sign out <span className={s.signOutArrow}>→</span>
        </ActionButton>
      </div>
    </aside>
  );
}
