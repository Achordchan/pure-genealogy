import { NextResponse, type NextRequest } from "next/server";
import {
  canManageAccounts,
  canManageFamilyMembers,
  canReviewMemberChanges,
  getAccountHomePath,
  type AccountProfile,
} from "@/lib/account/shared";
import { buildApiUrl } from "./server";

const AUTH_ROUTES = new Set(["/auth/login", "/auth/sign-up", "/auth/pending"]);

function isProtectedRoute(pathname: string) {
  return (
    pathname.startsWith("/family-tree") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/review") ||
    pathname.startsWith("/me")
  );
}

export async function updateApiSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const response = NextResponse.next({ request });
  const profile = await fetchProfile(request);

  if (!profile) {
    if (isProtectedRoute(pathname)) {
      return redirectTo(request, "/auth/login");
    }
    return response;
  }

  const homePath = getAccountHomePath(profile);

  if (pathname === "/") {
    return redirectTo(request, homePath);
  }

  if (AUTH_ROUTES.has(pathname) && pathname !== "/auth/pending") {
    return redirectTo(request, homePath);
  }

  if (profile.status !== "approved") {
    return pathname === "/auth/pending" ? response : redirectTo(request, "/auth/pending");
  }

  if (pathname === "/auth/pending") {
    return redirectTo(request, homePath);
  }

  if (pathname === "/family-tree" && !canManageFamilyMembers(profile)) {
    return redirectTo(request, "/family-tree/graph");
  }

  if (pathname.startsWith("/admin") && !canManageAccounts(profile)) {
    return redirectTo(request, "/family-tree/graph");
  }

  if (pathname.startsWith("/review") && !canReviewMemberChanges(profile)) {
    return redirectTo(request, "/family-tree/graph");
  }

  return response;
}

async function fetchProfile(request: NextRequest) {
  try {
    const response = await fetch(buildApiUrl("/api/auth/me"), {
      cache: "no-store",
      headers: { cookie: request.headers.get("cookie") ?? "" },
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as { profile?: AccountProfile };
    return payload.profile ?? null;
  } catch {
    return null;
  }
}

function redirectTo(request: NextRequest, pathname: string) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  return NextResponse.redirect(url);
}
