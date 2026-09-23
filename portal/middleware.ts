import { NextRequest, NextResponse } from 'next/server';

// Old hosts redirect to the canonical host, or a Logto sign-in returns without its session cookie.
// The CANONICAL_HOST override is for domain transitions only.
const CANONICAL_HOST = process.env.CANONICAL_HOST ?? 'shadowrouter.ca';
const OLD_HOSTS = new Set([
  'shadow-router.vercel.app',
  'portal.shadowrouter.wasd.digital',
  'www.shadowrouter.ca',
]);

export function middleware(request: NextRequest) {
  const host = request.headers.get('host') ?? '';
  if (host !== CANONICAL_HOST && OLD_HOSTS.has(host)) {
    const url = request.nextUrl.clone();
    url.host = CANONICAL_HOST;
    url.protocol = 'https:';
    url.port = '';
    return NextResponse.redirect(url, 308);
  }
  return NextResponse.next();
}

export const config = {
  // skip static assets
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
