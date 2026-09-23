import type { ReactNode } from 'react';
import { Archivo, Figtree, Fragment_Mono } from 'next/font/google';
import './globals.css';

// Open substitutes for the proprietary CoinbaseDisplay / CoinbaseSans (see .impeccable.md).
const display = Archivo({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['400', '500', '600'],
});
const body = Figtree({
  subsets: ['latin'],
  variable: '--font-body',
  weight: ['400', '500', '600', '700'],
});
const mono = Fragment_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  weight: '400',
});

export const metadata = {
  title: 'ShadowRouter: All the models. None of your data.',
  description:
    'Private AI gateway: GPT, Gemini and more with one balance. No email, no KYC, crypto payments, prompts never stored.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
