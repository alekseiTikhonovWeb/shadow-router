import Link from 'next/link';
import SiteHeader from '../components/SiteHeader';
import { API_HOST, CHAT_HOST, SUPPORT_EMAIL } from '../lib/urls';
import s from '../legal/legal.module.css';

export const metadata = {
  title: 'Terms of Service · ShadowRouter',
  description: 'The deal between you and ShadowRouter, in plain language.',
};

// Adapted from Basecamp's open policies (CC BY 4.0); attribution at the bottom.
export default function Terms() {
  return (
    <>
      <SiteHeader
        right={
          <Link href="/" className="btn btn-ghost" style={{ padding: '11px 22px' }}>
            Home
          </Link>
        }
      />
      <main className={s.page}>
        <p className={s.kicker}>Terms of Service</p>
        <h1 className={s.title}>The deal, in plain language.</h1>
        <p className={s.updated}>Last updated: July 16, 2026</p>

        <h2>1. Definitions</h2>
        <p>
          &ldquo;ShadowRouter&rdquo;, &ldquo;we&rdquo; and &ldquo;us&rdquo; mean the ShadowRouter
          service, operated as a sole proprietorship. &ldquo;Services&rdquo; means the web chat at
          {' '}{CHAT_HOST}, the API at {API_HOST} and the account
          portal. &ldquo;You&rdquo; means the person holding the account.
        </p>

        <h2>2. Your account</h2>
        <ul>
          <li>You must be at least <strong>18 years old</strong>.</li>
          <li>Your account is a username and a password. There is no email recovery unless you add one voluntarily — <strong>if you lose your credentials, we cannot restore your account</strong>. Keep them safe.</li>
          <li>You are responsible for everything that happens under your account and API keys. Rotate a key immediately if you suspect it leaked.</li>
        </ul>

        <h2>3. Payments and balance</h2>
        <ul>
          <li>The Services are prepaid: you top up a US-dollar balance with cryptocurrency, and usage is deducted per token at the prices published on the site.</li>
          <li><strong>Top-ups are non-refundable.</strong> Crypto transfers are irreversible by design, and balances are not redeemable for cash. Your balance never expires.</li>
          <li>Per-token prices can change as provider costs change; the current price list on the site always applies to new usage.</li>
          <li>Sending the wrong coin, the wrong network or less than the invoice minimum may result in a lost payment — follow the checkout instructions carefully.</li>
        </ul>

        <h2>4. Acceptable use</h2>
        <p>We collect almost nothing about you — the flip side is that we take abuse seriously to keep the service alive for everyone. You agree not to:</p>
        <ul>
          <li>use the Services for anything illegal, including generating content that exploits minors, incites violence, or facilitates fraud;</li>
          <li>attempt to break, probe or overload the Services, evade rate limits or anti-abuse measures, or interfere with other users;</li>
          <li>violate the upstream model providers&rsquo; usage policies — requests pass through to them, and their rules apply to the generated content;</li>
          <li>resell access in a way that hides your customers&rsquo; abuse behind your account: you carry responsibility for traffic under your keys.</li>
        </ul>
        <p>We may suspend or terminate accounts that break these rules. Remaining balance on an account terminated for abuse is forfeit.</p>

        <h2>5. AI output</h2>
        <p>
          Models make mistakes, sometimes confident ones. Output is provided as-is and is not
          professional, legal, medical or financial advice. To the extent the upstream providers
          allow, you own your inputs and outputs; we claim no rights over them.
        </p>

        <h2>6. Availability and changes</h2>
        <p>
          The Services are provided &ldquo;as is&rdquo;, without an uptime guarantee. Models come
          and go as providers release and retire them; we may add, rename or remove models,
          features, or the Services themselves. For material changes we will give notice on the
          site.
        </p>

        <h2>7. Cancellation and termination</h2>
        <ul>
          <li>You can stop using the Services at any time, and can have your account fully deleted (see the <Link href="/privacy">Privacy Policy</Link>).</li>
          <li>We may suspend or terminate accounts for violating these terms. Where reasonable, we will warn first.</li>
        </ul>

        <h2>8. Liability</h2>
        <p>
          To the maximum extent permitted by law, we are not liable for indirect, incidental or
          consequential damages arising from your use of the Services. Our total liability for any
          claim is limited to the amount you paid us in the three months before the event giving
          rise to the claim.
        </p>

        <h2>9. Governing law</h2>
        <p>
          These terms are governed by the laws of the Province of Ontario and the federal laws of
          Canada applicable therein.
        </p>

        <h2>10. Changes to these terms</h2>
        <p>
          We may update these terms; material changes will be announced on the site before they
          take effect. Continuing to use the Services after that means you accept the new terms.
        </p>

        <h2>Contact</h2>
        <p>
          Questions: <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
        </p>

        <p className={s.attribution}>
          Adapted from the{' '}
          <a href="https://github.com/basecamp/policies" rel="noreferrer" target="_blank">
            Basecamp open-source policies
          </a>{' '}
          /{' '}
          <a href="https://creativecommons.org/licenses/by/4.0/" rel="noreferrer" target="_blank">
            CC BY 4.0
          </a>
          . This document is likewise shared under CC BY 4.0.
        </p>
      </main>
    </>
  );
}
