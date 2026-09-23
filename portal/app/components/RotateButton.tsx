'use client';

import { useTransition } from 'react';

type Props = { rotate: () => Promise<void> };

export default function RotateButton({ rotate }: Props) {
  const [pending, start] = useTransition();
  return (
    <button
      className="btn btn-ghost"
      disabled={pending}
      onClick={() => {
        if (confirm('Rotate your key? The old one stops working immediately.')) {
          start(() => rotate());
        }
      }}
    >
      {pending ? 'Rotating…' : 'Rotate key'}
    </button>
  );
}
