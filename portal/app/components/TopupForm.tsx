'use client';

import { useState, useTransition } from 'react';
import s from './account.module.css';

const PRESETS = [5, 10, 25, 50];
// Mirrors MIN_TOPUP_USD in backend/app/main.py, which enforces it.
const MIN_TOPUP = 5;

export default function TopupForm({ onTopup }: { onTopup: (amount: number) => Promise<void> }) {
  const [amount, setAmount] = useState(10);
  const [pending, start] = useTransition();
  const tooLow = !Number.isFinite(amount) || amount < MIN_TOPUP;

  return (
    <div>
      <div className={s.amounts}>
        {PRESETS.map((v) => (
          <button
            key={v}
            className={`${s.amountBtn} ${amount === v ? s.amountActive : ''}`}
            onClick={() => setAmount(v)}
          >
            ${v}
          </button>
        ))}
      </div>
      <div className={s.customRow}>
        <input
          className={s.customInput}
          type="number"
          min={MIN_TOPUP}
          step={1}
          value={amount}
          onChange={(e) => setAmount(Number(e.target.value))}
          aria-label="Custom amount in USD"
        />
        <span style={{ color: 'var(--ink-faint)', fontSize: 'var(--text-sm)' }}>
          USDT → 1 USDT = $1 of balance
        </span>
      </div>
      {tooLow && (
        <p style={{ color: '#b42318', fontSize: 'var(--text-sm)', marginTop: 8 }}>
          Minimum top-up is ${MIN_TOPUP} — network fees make smaller amounts not worth it.
        </p>
      )}
      <div style={{ marginTop: 'var(--space-xl)' }}>
        <button
          className="btn btn-primary"
          disabled={pending || tooLow}
          onClick={() => start(() => onTopup(amount))}
        >
          {pending ? 'Creating invoice…' : `Continue to payment ($${amount})`}
        </button>
      </div>
    </div>
  );
}
