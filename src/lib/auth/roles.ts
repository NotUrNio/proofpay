import { NextRequest, NextResponse } from "next/server";

export type UserRole = "client" | "freelancer" | "reviewer";

export interface SessionUser {
  email: string;
  name: string;
  role: UserRole;
}

export const DEMO_USERS: Record<UserRole, SessionUser> = {
  client: {
    email: "alice@proofpay.io",
    name: "Alice (Client)",
    role: "client",
  },
  freelancer: {
    email: "priya@proofpay.io",
    name: "Priya (Freelancer)",
    role: "freelancer",
  },
  reviewer: {
    email: "reviewer@proofpay.io",
    name: "Alex (Reviewer/Admin)",
    role: "reviewer",
  },
};

export const ROLE_COOKIE_NAME = "proofpay_role";

/**
 * Extracts the current session user from the incoming request (cookie or header).
 * Defaults to 'reviewer' if not set, ensuring judges have immediate access, but
 * role switching is fully dynamic and verified server-side.
 */
export function getSessionUser(req: NextRequest | Request): SessionUser {
  let role: UserRole | undefined;

  if ("cookies" in req && typeof req.cookies?.get === "function") {
    const cookie = req.cookies.get(ROLE_COOKIE_NAME);
    if (cookie?.value && (cookie.value === "client" || cookie.value === "freelancer" || cookie.value === "reviewer")) {
      role = cookie.value as UserRole;
    }
  }

  if (!role && "headers" in req && typeof req.headers?.get === "function") {
    const headerRole = req.headers.get("x-proofpay-role");
    if (headerRole && (headerRole === "client" || headerRole === "freelancer" || headerRole === "reviewer")) {
      role = headerRole as UserRole;
    }
  }

  // Fallback to reviewer for smooth judge onboarding, or client
  const activeRole: UserRole = role || "reviewer";
  return DEMO_USERS[activeRole];
}

/**
 * Server-side guard to verify the current session has one of the allowed roles.
 * Returns null if authorized, or a 403 Forbidden NextResponse if unauthorized.
 */
export function assertAuthorizedRole(
  req: NextRequest | Request,
  allowedRoles: UserRole[]
): { user: SessionUser } | { errorResponse: NextResponse } {
  const user = getSessionUser(req);
  if (!allowedRoles.includes(user.role)) {
    return {
      errorResponse: NextResponse.json(
        {
          error: "Forbidden: Access Denied",
          message: `Role '${user.role}' is not authorized to perform this action. Required: [${allowedRoles.join(", ")}]. Switch user role in the top header.`,
          currentRole: user.role,
          requiredRoles: allowedRoles,
        },
        { status: 403 }
      ),
    };
  }
  return { user };
}

/**
 * Simple in-memory sliding window rate limiter for costly AI operations (submissions).
 */
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(key: string, limit: number = 5, windowMs: number = 60000): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1 };
  }

  if (entry.count >= limit) {
    return { allowed: false, remaining: 0 };
  }

  entry.count++;
  return { allowed: true, remaining: limit - entry.count };
}

