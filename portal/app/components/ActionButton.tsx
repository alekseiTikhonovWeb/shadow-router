'use client';

import { useTransition } from 'react';

export default function ActionButton({
  action,
  className = 'btn btn-primary',
  children,
  pendingText,
}: {
  action: () => Promise<void>;
  className?: string;
  children: React.ReactNode;
  pendingText?: string;
}) {
  const [pending, start] = useTransition();
  return (
    <button className={className} disabled={pending} onClick={() => start(() => action())}>
      {pending ? (pendingText ?? '…') : children}
    </button>
  );
}
