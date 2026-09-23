'use client';

import { useState, useTransition } from 'react';
import s from '../dashboard.module.css';

export default function DeleteAccount({ onDelete }: { onDelete: () => Promise<void> }) {
  const [armed, setArmed] = useState(false);
  const [confirm, setConfirm] = useState('');
  const [pending, start] = useTransition();

  if (!armed) {
    return (
      <button className={s.dangerBtn} onClick={() => setArmed(true)}>
        Delete account
      </button>
    );
  }

  const ready = confirm.trim().toUpperCase() === 'DELETE';
  return (
    <div style={{ display: 'grid', gap: 12, maxWidth: 420 }}>
      <p style={{ color: '#b42318', fontSize: 'var(--text-sm)', margin: 0 }}>
        This erases your keys, balance and identity everywhere, right now. It cannot be
        undone. Type <strong>DELETE</strong> to confirm.
      </p>
      <input
        className={s.confirmInput}
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        placeholder="DELETE"
        autoFocus
        aria-label="Type DELETE to confirm"
      />
      <div style={{ display: 'flex', gap: 10 }}>
        <button
          className={s.dangerBtn}
          disabled={!ready || pending}
          onClick={() => start(() => onDelete())}
        >
          {pending ? 'Deleting…' : 'Delete forever'}
        </button>
        <button
          className={s.ghostBtn}
          onClick={() => {
            setArmed(false);
            setConfirm('');
          }}
          disabled={pending}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
