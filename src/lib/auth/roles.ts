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
 * Returns true if the test-only `x-proofpay-role` header is allowed in the current environment.
 * Ignored in production unless `ENABLE_TEST_ROLE_HEADER=true` is explicitly set.
 */
export function isTestRoleHeaderAllowed(): boolean {
  return (
    process.env.NODE_ENV !== "production" ||
    process.env.ENABLE_TEST_ROLE_HEADER === "true"
  );
}

function isValidUserRole(val: unknown): val is UserRole {
  return val === "client" || val === "freelancer" || val === "reviewer";
}

/**
 * Extracts a valid UserRole from the request's `proofpay_role` cookie (via NextRequest.cookies or Cookie header).
 */
export function extractRoleFromCookie(req: NextRequest | Request): UserRole | undefined {
  if ("cookies" in req && typeof req.cookies?.get === "function") {
    const cookie = req.cookies.get(ROLE_COOKIE_NAME);
    if (cookie?.value && isValidUserRole(cookie.value)) {
      return cookie.value;
    }
  }

  if ("headers" in req && typeof req.headers?.get === "function") {
    const cookieHeader = req.headers.get("cookie");
    if (cookieHeader) {
      const match = cookieHeader
        .split(";")
        .map((part) => part.trim())
        .find((part) => part.startsWith(`${ROLE_COOKIE_NAME}=`));
      if (match) {
        const rawValue = decodeURIComponent(match.slice(ROLE_COOKIE_NAME.length + 1).trim());
        if (isValidUserRole(rawValue)) {
          return rawValue;
        }
      }
    }
  }

  return undefined;
}

/**
 * Extracts the explicit role credential and its source ('cookie', 'header', or 'default').
 * The `x-proofpay-role` header is ignored unless `NODE_ENV !== "production"` or `ENABLE_TEST_ROLE_HEADER=true`.
 */
export function extractExplicitRole(
  req: NextRequest | Request
): { role?: UserRole; source: "cookie" | "header" | "default" } {
  const cookieRole = extractRoleFromCookie(req);
  if (cookieRole) {
    return { role: cookieRole, source: "cookie" };
  }

  if (
    isTestRoleHeaderAllowed() &&
    "headers" in req &&
    typeof req.headers?.get === "function"
  ) {
    const headerRole = req.headers.get("x-proofpay-role");
    if (headerRole && isValidUserRole(headerRole)) {
      return { role: headerRole, source: "header" };
    }
  }

  return { role: undefined, source: "default" };
}

/**
 * Extracts the current session user from the incoming request (cookie or allowed test header).
 * Defaults to the non-privileged 'client' persona (Alice) when no cookie/header is present,
 * matching the landing page overview while keeping reviewer-only routes and mutating routes locked down.
 */
export function getSessionUser(req: NextRequest | Request): SessionUser {
  const { role } = extractExplicitRole(req);
  const activeRole: UserRole = role || "client";
  return DEMO_USERS[activeRole];
}

/**
 * Server-side guard to verify the current session has an explicit role credential (cookie or allowed test header)
 * and belongs to one of the allowed roles.
 * Every route that mutates money, mandates, or policy (and reviewer-only endpoints) rejects requests with no role cookie.
 */
export function assertAuthorizedRole(
  req: NextRequest | Request,
  allowedRoles: UserRole[],
  options?: { allowImplicitDefault?: boolean }
): { user: SessionUser } | { errorResponse: NextResponse } {
  const { source } = extractExplicitRole(req);
  const user = getSessionUser(req);

  if (!options?.allowImplicitDefault && source === "default") {
    return {
      errorResponse: NextResponse.json(
        {
          error: "Forbidden: Role Cookie Required",
          message: `An explicit '${ROLE_COOKIE_NAME}' role cookie is required to perform this action. Required: [${allowedRoles.join(", ")}]. Switch user role in the top header.`,
          currentRole: user.role,
          requiredRoles: allowedRoles,
        },
        { status: 403 }
      ),
    };
  }

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
 * Checks whether a given session user has permission to view/manage a specific job.
 * Reviewer: accesses all jobs for human triage and audit.
 * Bundled demo templates: accessible to all personas for guided drills.
 * Client: accesses jobs where clientEmail matches user.email.
 * Freelancer: accesses jobs where freelancerEmail matches user.email.
 */
export function canUserAccessJob(
  user: SessionUser,
  job: { id: string; clientEmail: string; freelancerEmail: string; amount?: string }
): boolean {
  if (user.role === "reviewer") return true;
  if (user.role === "client" && job.clientEmail.toLowerCase() === user.email.toLowerCase()) return true;
  if (user.role === "freelancer" && job.freelancerEmail.toLowerCase() === user.email.toLowerCase()) return true;

  // Check demo template allowance
  const demoIds = [
    "20f829e2-8aff-4bab-8e4b-710c004ffc6d",
    "bf3884d6-3fdf-496d-87db-5dbbe4461443",
    "10c2bab9-02a6-45ab-b652-9552b584769b",
    "ef7a9683-8e2e-44b9-80fb-e12b5a2f6568",
  ];
  if (demoIds.includes(job.id)) return true;

  return false;
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

