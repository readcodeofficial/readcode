import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

// Stored format: scrypt$<salt hex>$<hash hex>
const KEY_LEN = 32;
const COST = { N: 1024 };

export function hashPassword(password: string, salt: Buffer = randomBytes(16)): string {
    const hash = scryptSync(password, salt, KEY_LEN, COST);
    return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
    const [scheme, saltHex, hashHex] = stored.split("$");
    if (scheme !== "scrypt" || !saltHex || !hashHex) return false;
    const expected = Buffer.from(hashHex, "hex");
    const actual = scryptSync(password, Buffer.from(saltHex, "hex"), expected.length, COST);
    return actual.length === expected.length && timingSafeEqual(actual, expected);
}
