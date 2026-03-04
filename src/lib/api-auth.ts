import { NextRequest, NextResponse } from "next/server";
import { verifyToken, type JWTPayload } from "./jwt";
import { auth } from "@/auth";

type Role = "STUDENT" | "TEACHER" | "ADMIN";

/**
 * Extracts and verifies JWT from Authorization header or cookie.
 * Also checks for Auth.js session.
 */
export async function checkAuth(req: NextRequest): Promise<JWTPayload | null> {
    // Try Authorization header first (for API clients / mobile)
    const authHeader = req.headers.get("authorization");
    let token: string | undefined;

    if (authHeader?.startsWith("Bearer ")) {
        token = authHeader.slice(7);
    }

    // Fall back to cookie (web client)
    if (!token) {
        token = req.cookies.get("token")?.value;
    }

    if (token) {
        const payload = await verifyToken(token);
        if (payload) return payload;
    }

    // Fall back to Auth.js session
    const session = await auth();
    if (session?.user) {
        return {
            userId: session.user.id!,
            email: session.user.email!,
            role: (session.user as { role: Role; onboardingCompleted: boolean }).role,
            onboardingCompleted: (session.user as { role: Role; onboardingCompleted: boolean }).onboardingCompleted,
        };
    }

    return null;
}

/**
 * Require specific role(s). Returns 403 if not authorized.
 */
export function requireRole(
    payload: JWTPayload,
    ...allowedRoles: Role[]
): NextResponse | null {
    if (!allowedRoles.includes(payload.role)) {
        return NextResponse.json(
            { error: "Insufficient permissions" },
            { status: 403 }
        );
    }
    return null;
}

/**
 * Checks auth for server components without needing a NextRequest.
 */
export async function checkAuthServer(): Promise<JWTPayload | null> {
    const { cookies } = await import("next/headers");
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;

    if (token) {
        const payload = await verifyToken(token);
        if (payload) return payload;
    }

    const session = await auth();
    if (session?.user) {
        return {
            userId: session.user.id!,
            email: session.user.email!,
            role: (session.user as { role: Role; onboardingCompleted: boolean }).role,
            onboardingCompleted: (session.user as { role: Role; onboardingCompleted: boolean }).onboardingCompleted,
        };
    }
    return null;
}
