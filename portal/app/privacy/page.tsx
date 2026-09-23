import Link from 'next/link';
import SiteHeader from '../components/SiteHeader';
import { SUPPORT_EMAIL } from '../lib/urls';
import s from '../legal/legal.module.css';

export const metadata = {
  title: 'Privacy Policy · ShadowRouter',
  description: 'What ShadowRouter collects, what it refuses to collect, and how to get rid of all of it.',
};

// Adapted from Basecamp's open policies (CC BY 4.0); attribution at the bottom.
export default function Privacy() {
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
        <p className={s.kicker}>Privacy Policy</p>
        <h1 className={s.title}>The least we can know about you.</h1>
        <p className={s.updated}>Last updated: July 16, 2026</p>

        <div className={s.callout}>
          <p>
            <strong>The short version:</strong> no email, no name, no phone, no KYC, no ad
            trackers. Your account is a username and an internal ID. Prompts and responses pass
            through to the model provider and are not written to our logs. You can delete
            everything by writing to <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
          </p>
        </div>

        <h2>What we refuse to collect</h2>
        <p>
          ShadowRouter (&ldquo;we&rdquo;) is built so that we hold as little about you as
          technically possible:
        </p>
        <ul>
          <li><strong>No email, no phone, no real name.</strong> Registration is a username and a password. An email can be added voluntarily, only if you want password recovery.</li>
          <li><strong>No identity verification (KYC).</strong> We never ask for documents.</li>
          <li><strong>No advertising or analytics trackers.</strong> No third-party ad cookies, no fingerprinting, no selling of data — there is nothing to sell.</li>
          <li><strong>No prompt or response contents in our logs.</strong> Our metering records token counts, model names, timestamps and latency — not what you said.</li>
        </ul>

        <h2>What we do store, and why</h2>
        <ul>
          <li><strong>Account:</strong> your username, a hash of your password, and an internal account ID. Kept by our identity provider (Logto) and used to map your balance and API keys.</li>
          <li><strong>Balance and usage counters:</strong> your prepaid balance, per-request token counts, model names and timestamps — the minimum needed to meter a prepaid service.</li>
          <li><strong>Payment records:</strong> amount, currency, payment ID and status of each top-up, coming from our payment processor. Crypto transactions are public on their blockchains by nature; we never see or store a card, bank account or billing address — there are none.</li>
          <li><strong>Web chat history:</strong> conversations in the web chat are stored so you can come back to them, and you can delete any conversation yourself at any time. If you use the API instead, nothing conversational is stored at all.</li>
          <li><strong>Support correspondence:</strong> if you write to us, we keep the thread for as long as it takes to help you.</li>
        </ul>

        <h2>Cookies</h2>
        <p>
          We use first-party session cookies to keep you signed in. That is all. No tracking
          cookies, no third-party advertising cookies.
        </p>

        <h2>Who touches your data (subprocessors)</h2>
        <p>Running the service involves a small set of vendors, each seeing only what their job requires:</p>
        <ul>
          <li><strong>Model providers</strong> (OpenAI, Google, Anthropic, xAI, DeepSeek — depending on the model you pick): receive your prompts to generate responses, under their API terms. Major providers state that API data is not used to train their models. Requests are sent from our servers with our credentials — providers see our account, not yours.</li>
          <li><strong>NOWPayments</strong>: processes crypto top-ups (non-custodial). Sees the transaction, not your identity.</li>
          <li><strong>Logto</strong>: authentication (username, password hash, internal ID).</li>
          <li><strong>Railway, Vercel, MongoDB Atlas, Supabase</strong>: infrastructure hosting our services and databases. Transient network logs (such as IP addresses in standard web-server logs) may exist at the infrastructure level; we do not build profiles from them.</li>
        </ul>

        <h2>When we would disclose anything</h2>
        <p>
          Only if legally compelled by a valid order applicable to us — and the honest answer to
          most requests would be that we hold no identifying information to give. We do not sell
          or share data with advertisers, ever.
        </p>

        <h2>Retention and deletion</h2>
        <ul>
          <li>Account data lives for as long as your account does.</li>
          <li>Chat conversations you delete are removed from the live database immediately.</li>
          <li>Payment ledger records are kept for accounting.</li>
          <li>
            <strong>Full account deletion</strong> — keys, balance, chat history, identity,
            everywhere — is available on request: write to{' '}
            <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> from a message that
            proves control of the account (a self-serve button is on the way).
          </li>
        </ul>

        <h2>Your rights</h2>
        <p>
          Wherever you are, we apply the same rule: you can ask what we hold about you (little),
          get a copy of it, or have it deleted. One email, no forms.
        </p>

        <h2>Changes</h2>
        <p>
          If this policy changes in a way that matters, we will say so on the site before it takes
          effect. The current version always lives at this address.
        </p>

        <h2>Contact</h2>
        <p>
          Questions, requests, deletions: <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
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
