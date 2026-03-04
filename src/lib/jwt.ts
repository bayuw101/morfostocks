import { SignJWT, jwtVerify } from "jose";

const JWT_SECRET = process.env.JWT_SECRET || "fallback-secret-dev-only";
const secret = new TextEncoder().encode(JWT_SECRET);

export interface JWTPayload {
    userId: string;
    email: string;
    role: "STUDENT" | "TEACHER" | "ADMIN";
    onboardingCompleted: boolean;
}

/**
 * Sign a token using jose (Edge-compatible)
 */
export async function signToken(payload: JWTPayload): Promise<string> {
    return await new SignJWT({ ...payload })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("7d")
        .sign(secret);
}

/**
 * Verify a token using jose (Edge-compatible)
 */
export async function verifyToken(token: string): Promise<JWTPayload | null> {
    try {
        const { payload } = await jwtVerify(token, secret);
        return payload as unknown as JWTPayload;
    } catch (err: any) {
        console.error("❌ JWT Verify Error:", err.message || err);
        return null;
    }
}
