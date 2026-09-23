import { getLogtoContext, signIn, signOut } from '@logto/next/server-actions';
import Link from 'next/link';
import { logtoConfig } from './logto';
import SiteHeader, { Wordmark } from './components/SiteHeader';
import Hero from './components/Hero';
import Reveal from './components/Reveal';
import ActionButton from './components/ActionButton';
import Ticker from './components/Ticker';
import Faq from './components/Faq';
import Counter from './components/Counter';
import s from './components/landing.module.css';

import { MODELS } from './lib/models';
import { API_URL, CHAT_URL } from './lib/urls';

const FAQ = [
  {
    q: 'Do you really not ask for an email?',
    a: 'Really. Registration is a username and a password. That’s the whole form. An email can be added later, voluntarily, only if you want password recovery.',
  },
  {
    q: 'What happens to my prompts?',
    a: 'They pass through to the model provider and come back. We don’t write prompt or response contents to disk. Our logs contain token counts and latency, nothing you said.',
  },
  {
    q: 'How do payments work?',
    a: 'You top up in crypto (USDT, BTC, ETH and 300+ others via NOWPayments). One US dollar becomes one dollar of balance, credited automatically after network confirmation. No cards, no bank, no KYC.',
  },
  {
    q: 'Which models can I use?',
    a: 'GPT and Gemini families today. Both in the web chat and through the API, with automatic failover. The lineup grows; your key gets new models automatically.',
  },
  {
    q: 'Can I use it in Cursor or my own app?',
    a: 'Yes. The API is OpenAI-compatible. Point the base URL at us, paste your key, and switch models by name. The chat and the API share one balance.',
  },
];

export default async function Home() {
  const { isAuthenticated } = await getLogtoContext(logtoConfig);

  async function doSignIn() {
    'use server';
    await signIn(logtoConfig);
  }
  async function doSignOut() {
    'use server';
    await signOut(logtoConfig);
  }

  const headerRight = isAuthenticated ? (
    <>
      <Link href="/dashboard" className="btn btn-primary" style={{ padding: '11px 22px' }}>
        Dashboard
      </Link>
      <ActionButton action={doSignOut} className={s.navLink} pendingText="…">
        Sign out
      </ActionButton>
    </>
  ) : (
    <>
      <ActionButton action={doSignIn} className={s.navLink} pendingText="…">
        Sign in
      </ActionButton>
      <ActionButton
        action={doSignIn}
        className="btn btn-primary"
        pendingText="Opening…"
      >
        Sign up
      </ActionButton>
    </>
  );

  const heroCtas = isAuthenticated ? (
    <>
      <Link href="/dashboard" className="btn btn-primary">
        Open your dashboard
      </Link>
      <a href={CHAT_URL} className="btn btn-ghost">
        Open the chat
      </a>
    </>
  ) : (
    <>
      <ActionButton action={doSignIn} className="btn btn-primary" pendingText="Opening…">
        Sign up, no email needed
      </ActionButton>
      <a href="#pricing" className="btn btn-ghost">
        See pricing
      </a>
    </>
  );

  return (
    <>
      <SiteHeader right={headerRight} />
      <main>
        <Hero ctas={heroCtas} />

        <Ticker
          items={[
            ...MODELS.map((m) => ({ name: m.name, price: `$${m.input.toFixed(2)} / 1M in` })),
            { name: 'USDT · BTC · ETH', price: '300+ coins accepted' },
          ]}
        />

        <section className={s.section}>
          <div className="container">
            <div className={s.stats}>
              <Reveal>
                <div className={s.stat}>
                  <div className={s.statNum}>
                    <Counter value={MODELS.length} />
                  </div>
                  <div className={s.statLabel}>frontier models, one balance</div>
                </div>
              </Reveal>
              <Reveal delay={0.06}>
                <div className={s.stat}>
                  <div className={s.statNum}>
                    <Counter value={300} suffix="+" />
                  </div>
                  <div className={s.statLabel}>coins accepted for top-up</div>
                </div>
              </Reveal>
              <Reveal delay={0.12}>
                <div className={s.stat}>
                  <div className={s.statNum}>
                    <Counter value={0} />
                  </div>
                  <div className={s.statLabel}>bytes of personal data required</div>
                </div>
              </Reveal>
              <Reveal delay={0.18}>
                <div className={s.stat}>
                  <div className={s.statNum}>
                    <Counter value={20} suffix=" s" />
                  </div>
                  <div className={s.statLabel}>from landing to first prompt</div>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        <section className={s.section}>
          <div className="container">
            <Reveal>
              <div className={s.sectionHead}>
                <h2 className={s.sectionTitle}>A chat for you. An API for your code.</h2>
              </div>
            </Reveal>
            <div className={s.tiles}>
              <Reveal>
                <div className={`${s.tile} ${s.tileBlue}`}>
                  <span className={s.tileKicker}>Web chat</span>
                  <h3 className={s.tileTitle}>Every model in one conversation</h3>
                  <ul className={s.tileList}>
                    <li>Switch between GPT and Gemini mid-chat</li>
                    <li>Agents, web search and memory built in</li>
                    <li>History is optional. Private mode by default</li>
                  </ul>
                  <div className={s.tileCta}>
                    <a href={CHAT_URL} className="btn btn-inverse">
                      Open the chat
                    </a>
                  </div>
                </div>
              </Reveal>
              <Reveal delay={0.1}>
                <div className={s.tile}>
                  <span className={s.tileKicker}>Developer API</span>
                  <h3 className={s.tileTitle}>One key, OpenAI-compatible</h3>
                  <ul className={s.tileList}>
                    <li>Works in Cursor, agents and any OpenAI SDK</li>
                    <li>Automatic failover across provider keys</li>
                    <li>Same balance as the chat. No separate billing</li>
                  </ul>
                  <div className={s.tileCta}>
                    <a href="#developers" className="btn btn-primary">
                      See the code
                    </a>
                  </div>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        <section className={s.section} id="privacy">
          <div className="container">
            <Reveal>
              <div className={s.panelSection}>
                <div className={s.sectionHead}>
                  <p className="eyebrow">Privacy, itemized</p>
                  <h2 className={s.sectionTitle}>
                    Everything we know about you fits on a receipt
                  </h2>
                  <p className={s.sectionSub}>
                    Privacy isn’t a policy page here. It’s the architecture.
                    We can’t leak what we never collect.
                  </p>
                </div>
                <div className={s.ledger}>
                  <div className={s.ledgerCol}>
                    <h3 className={s.ledgerTitle}>What we store</h3>
                    <ul className={s.ledgerList}>
                      <li className={s.ledgerItem}>
                        <span>A random account ID</span>
                        <span className={s.ledgerVal}>7k9ba…</span>
                      </li>
                      <li className={s.ledgerItem}>
                        <span>Your balance</span>
                        <span className={s.ledgerVal}>$ 25.00</span>
                      </li>
                      <li className={s.ledgerItem}>
                        <span>Token counts, for billing</span>
                        <span className={s.ledgerVal}>1,204 in / 8,911 out</span>
                      </li>
                    </ul>
                  </div>
                  <div className={`${s.ledgerCol} ${s.ledgerColDark}`}>
                    <h3 className={s.ledgerTitle}>What we never see</h3>
                    <ul className={s.ledgerList}>
                      <li className={s.ledgerItem}>
                        <span className={s.ledgerStrike}>Your name or email</span>
                        <span className={s.ledgerVal}>not asked</span>
                      </li>
                      <li className={s.ledgerItem}>
                        <span className={s.ledgerStrike}>Card or bank details</span>
                        <span className={s.ledgerVal}>crypto only</span>
                      </li>
                      <li className={s.ledgerItem}>
                        <span className={s.ledgerStrike}>Your prompts, stored</span>
                        <span className={s.ledgerVal}>never written</span>
                      </li>
                      <li className={s.ledgerItem}>
                        <span className={s.ledgerStrike}>KYC documents</span>
                        <span className={s.ledgerVal}>no KYC</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        <section className={s.section} id="pricing">
          <div className="container">
            <Reveal>
              <div className={s.sectionHead}>
                <h2 className={s.sectionTitle}>Pay per token. Keep the change.</h2>
                <p className={s.sectionSub}>
                  One balance across every model. No subscriptions, no seats, no expiry.
                </p>
              </div>
            </Reveal>
            <Reveal>
              <div className={s.priceWrap}>
              <table className={s.priceTable}>
                <thead>
                  <tr>
                    <th>Model</th>
                    <th></th>
                    <th className={s.priceNum}>Input / 1M</th>
                    <th className={s.priceNum}>Output / 1M</th>
                  </tr>
                </thead>
                <tbody>
                  {MODELS.map((m) => (
                    <tr key={m.name}>
                      <td className={s.priceModel}>{m.name}</td>
                      <td style={{ color: 'var(--ink-faint)' }}>{m.label}</td>
                      <td className={s.priceNum}>${m.input.toFixed(2)}</td>
                      <td className={s.priceNum}>${m.output.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
              <p className={s.priceNote}>
                Prices per million tokens. Top up from $5. Balance never expires.
              </p>
            </Reveal>
          </div>
        </section>

        <section className={s.section} id="developers">
          <div className="container">
            <div className={s.devGrid}>
              <div>
                <Reveal>
                  <p className="eyebrow">For developers</p>
                  <h2 className={s.sectionTitle} style={{ marginTop: 12 }}>
                    One key. Every model. Zero lock-in.
                  </h2>
                  <p className={s.sectionSub}>
                    Drop-in OpenAI-compatible endpoint: point your SDK, Cursor
                    or agent at us and switch models by name.
                  </p>
                </Reveal>
                <Reveal delay={0.15}>
                  <pre className={s.codeBlock} style={{ marginTop: 28 }}>
                    <span className={s.codeMuted}># works with any OpenAI SDK</span>
                    {'\n'}curl <span className={s.codeAccent}>
                      {API_URL}/chat/completions
                    </span>
                    {'\n'}  -H {'"Authorization: Bearer $SHADOWROUTER_KEY"'}
                    {'\n'}  -d {`'{"model": "gemini-pro",`}
                    {'\n'}
                    {`       "messages": [{"role":"user","content":"hi"}]}'`}
                  </pre>
                </Reveal>
              </div>
              <Reveal delay={0.2} y={48}>
                <div className={s.phone}>
                  <div className={s.phoneScreen}>
                    <span className={s.phoneLabel}>Balance</span>
                    <span className={s.phoneBalance}>$25.00</span>
                    <span className={s.phoneLabel}>Your API key</span>
                    <span className={s.phoneKey}>sk-shdw4Kt9•••••••••••</span>
                    <span className={s.phoneBtn}>Top up with crypto</span>
                  </div>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        <section className={s.section}>
          <div className="container">
            <Reveal>
              <div className={`${s.sectionHead} ${s.sectionHeadCenter}`}>
                <h2 className={s.sectionTitle}>Fair things to ask</h2>
              </div>
            </Reveal>
            <Reveal>
              <Faq items={FAQ} />
            </Reveal>
          </div>
        </section>

        <section className={s.section}>
          <div className="container">
            <Reveal>
              <div className={s.finale}>
                <h2 className={s.finaleTitle}>
                  The best privacy policy is having nothing to show.
                </h2>
                <p className={s.finaleSub}>
                  A username, a password, and every frontier model. That’s the deal.
                </p>
                <div className={s.heroCtas}>
                  {isAuthenticated ? (
                    <Link href="/dashboard" className="btn btn-inverse">
                      Open your dashboard
                    </Link>
                  ) : (
                    <ActionButton
                      action={doSignIn}
                      className="btn btn-inverse"
                      pendingText="Opening…"
                    >
                      Sign up, no email needed
                    </ActionButton>
                  )}
                </div>
              </div>
            </Reveal>
          </div>
        </section>
      </main>

      <footer className={s.footer}>
        <div className={`container ${s.footerInner}`}>
          <Wordmark />
          <div className={s.footerLinks}>
            <a href={CHAT_URL}>Chat</a>
            <Link href="/#pricing">Pricing</Link>
            <Link href="/privacy">Privacy Policy</Link>
            <Link href="/terms">Terms</Link>
          </div>
          <span>© 2026 ShadowRouter</span>
        </div>
      </footer>
    </>
  );
}
