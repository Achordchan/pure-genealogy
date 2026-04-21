import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { hasEnvVars } from "../utils";
import { getAccountHomePath, type AccountProfile } from "@/lib/account/shared";

const AUTH_ROUTES = new Set([
  "/auth/login",
  "/auth/sign-up",
  "/auth/pending",
]);

function isProtectedRoute(pathname: string) {
  return pathname.startsWith("/family-tree") || pathname.startsWith("/admin");
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  // If the env vars are not set, skip proxy check. You can remove this
  // once you setup the project.
  if (!hasEnvVars) {
    return supabaseResponse;
  }

  // With Fluid compute, don't put this client in a global environment
  // variable. Always create a new one on each request.
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Do not run code between createServerClient and
  // supabase.auth.getClaims(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  // IMPORTANT: If you remove getClaims() and you use server-side rendering
  // with the Supabase client, your users may be randomly logged out.
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims;
  const pathname = request.nextUrl.pathname;

  if (!user) {
    if (isProtectedRoute(pathname)) {
      const url = request.nextUrl.clone();
      url.pathname = "/auth/login";
      return NextResponse.redirect(url);
    }

    return supabaseResponse;
  }

  const { data: profile, error: profileError } = await supabase
    .from("account_profiles")
    .select("auth_user_id, real_name, status, is_admin")
    .eq("auth_user_id", user.sub)
    .maybeSingle<Pick<AccountProfile, "auth_user_id" | "real_name" | "status" | "is_admin">>();

  if (profileError || !profile) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/login";
    return NextResponse.redirect(url);
  }

  const homePath = getAccountHomePath(profile);

  if (pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = homePath;
    return NextResponse.redirect(url);
  }

  if (AUTH_ROUTES.has(pathname) && pathname !== "/auth/pending") {
    const url = request.nextUrl.clone();
    url.pathname = homePath;
    return NextResponse.redirect(url);
  }

  if (!profile.is_admin && profile.status !== "approved") {
    if (pathname !== "/auth/pending") {
      const url = request.nextUrl.clone();
      url.pathname = "/auth/pending";
      return NextResponse.redirect(url);
    }

    return supabaseResponse;
  }

  if (pathname === "/auth/pending") {
    const url = request.nextUrl.clone();
    url.pathname = homePath;
    return NextResponse.redirect(url);
  }

  if (pathname.startsWith("/admin") && !profile.is_admin) {
    const url = request.nextUrl.clone();
    url.pathname = "/family-tree/graph";
    return NextResponse.redirect(url);
  }

  // IMPORTANT: You *must* return the supabaseResponse object as it is.
  // If you're creating a new response object with NextResponse.next() make sure to:
  // 1. Pass the request in it, like so:
  //    const myNewResponse = NextResponse.next({ request })
  // 2. Copy over the cookies, like so:
  //    myNewResponse.cookies.setAll(supabaseResponse.cookies.getAll())
  // 3. Change the myNewResponse object to fit your needs, but avoid changing
  //    the cookies!
  // 4. Finally:
  //    return myNewResponse
  // If this is not done, you may be causing the browser and server to go out
  // of sync and terminate the user's session prematurely!

  return supabaseResponse;
}
