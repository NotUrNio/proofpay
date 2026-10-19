import { NextRequest, NextResponse } from "next/server";
import { DEMO_USERS, extractExplicitRole, getSessionUser, ROLE_COOKIE_NAME, UserRole } from "@/lib/auth/roles";

export const dynamic = "force-dynamic";

/**
 * GET /api/auth/role
 * Returns the currently active session user and role.
 */
export async function GET(req: NextRequest) {
  const user = getSessionUser(req);
  const { source } = extractExplicitRole(req);
  return NextResponse.json({
    user,
    hasRoleCookie: source !== "default",
    availableRoles: DEMO_USERS,
  });
}

/**
 * POST /api/auth/role
 * Switch active role in cookies: { role: 'client' | 'freelancer' | 'reviewer' }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const role = body?.role as UserRole;

    if (!role || !DEMO_USERS[role]) {
      return NextResponse.json(
        { error: "Invalid role. Must be 'client', 'freelancer', or 'reviewer'." },
        { status: 400 }
      );
    }

    const response = NextResponse.json({
      success: true,
      user: DEMO_USERS[role],
    });

    response.cookies.set(ROLE_COOKIE_NAME, role, {
      path: "/",
      httpOnly: false, // Accessible to client-side header switcher
      sameSite: "lax",
      maxAge: 86400 * 7,
    });

    return response;
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to switch role" },
      { status: 500 }
    );
  }
}

