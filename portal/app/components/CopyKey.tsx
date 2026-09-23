'use client';

import { useState } from 'react';
import s from './account.module.css';

export default function CopyKey({ value }: { value: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      className={`${s.copyBtn} ${done ? s.copyBtnDone : ''}`}
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setDone(true);
        setTimeout(() => setDone(false), 1600);
      }}
    >
      {done ? 'Copied' : 'Copy'}
    </button>
  );
}
