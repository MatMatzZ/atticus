import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { Database } from '@atticus/db';

/** Refreshes the Supabase session cookie and gates routes behind sign-in. */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (toSet, headers) => {
          toSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
          Object.entries(headers ?? {}).forEach(([k, v]) => response.headers.set(k, v));
        },
      },
    },
  );

  // Verifies the JWT signature (and refreshes it if expired).
  const { data } = await supabase.auth.getClaims();
  const signedIn = !!data?.claims;
  const { pathname } = request.nextUrl;
  const onSignIn = pathname === '/sign-in';

  if (!signedIn && !onSignIn) {
    const url = request.nextUrl.clone();
    url.pathname = '/sign-in';
    url.search = '';
    return NextResponse.redirect(url);
  }
  if (signedIn && onSignIn) {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    url.search = '';
    return NextResponse.redirect(url);
  }
  return response;
}
