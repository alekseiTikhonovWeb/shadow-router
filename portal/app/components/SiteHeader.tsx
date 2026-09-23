import Link from 'next/link';
import { CHAT_URL } from '../lib/urls';
import s from './landing.module.css';

export function Wordmark() {
  return (
    <Link href="/" className={s.wordmark} aria-label="ShadowRouter home">
      <span>Shadow</span>
      <span className={s.wordmarkRouter}>Router</span>
    </Link>
  );
}

export default function SiteHeader({ right }: { right: React.ReactNode }) {
  return (
    <header className={s.header}>
      <div className={`container ${s.headerInner}`}>
        <Wordmark />
        <nav className={s.nav}>
          <Link href="/#pricing" className={s.navLink}>
            Pricing
          </Link>
          <Link href="/#privacy" className={s.navLink}>
            Privacy
          </Link>
          <a
            href={CHAT_URL}
            className={s.navLink}
            target="_blank"
            rel="noreferrer"
          >
            Chat
          </a>
          {right}
        </nav>
      </div>
    </header>
  );
}
