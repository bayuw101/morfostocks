import bcrypt from "bcryptjs";

const SALT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, SALT_ROUNDS);
}

export async function comparePassword(
    password: string,
    hash: string
): Promise<boolean> {
    return bcrypt.compare(password, hash);
}

/**
 * Generate default password from birth date: DDMMYYYY
 * e.g. 1990-05-15 → "15051990"
 */
export function defaultPasswordFromBirthDate(birthDate: Date): string {
    const day = String(birthDate.getDate()).padStart(2, "0");
    const month = String(birthDate.getMonth() + 1).padStart(2, "0");
    const year = String(birthDate.getFullYear());
    return `${day}${month}${year}`;
}
