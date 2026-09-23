import { handleSignIn } from '@logto/next/server-actions';
import { redirect } from 'next/navigation';
import { NextRequest, NextResponse } from 'next/server';
import { logtoConfig } from '../logto';

// force-dynamic, or the try/catch below swallows Next's DYNAMIC_SERVER_USAGE prerender error.
export const dynamic = 'force-dynamic';

// A missing session cookie (other host, reopened callback, stale session) soft-returns home instead of 500.
export async function GET(request: NextRequest) {
  try {
    await handleSignIn(logtoConfig, request.nextUrl.searchParams);
  } catch (e) {
    console.error('[callback] sign-in failed, redirecting home:', e);
    return NextResponse.redirect(new URL('/?signin=retry', request.url));
  }
  redirect('/');
}
