import { createCipheriv, createDecipheriv, createHash } from "node:crypto";
import type { Keyring } from "./keyring.ts";

// Envelope: v1.<kid>.<nonce>.<tag>.<ciphertext>, each binary part base64url.
// `aad` (e.g. the record id) is authenticated but not stored, so a blob copied onto another
// record fails to decrypt.
export interface Sealed {
    kid: string;
    nonce: Buffer;
    tag: Buffer;
    ciphertext: Buffer;
}

export class DecryptError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "DecryptError";
    }
}

export function parseEnvelope(blob: string): Sealed {
    const parts = blob.split(".");
    if (parts.length !== 5 || parts[0] !== "v1") throw new DecryptError("not a v1 envelope");
    const [, kid, nonce, tag, ciphertext] = parts;
    const sealed = { kid, nonce: Buffer.from(nonce, "base64url"), tag: Buffer.from(tag, "base64url"), ciphertext: Buffer.from(ciphertext, "base64url") };
    if (sealed.nonce.length !== 12 || sealed.tag.length !== 16) throw new DecryptError("malformed envelope");
    return sealed;
}

export class FieldCipher {
    private readonly keyring: Keyring;
    private counter = 0n;

    constructor(keyring: Keyring) {
        this.keyring = keyring;
    }

    // 96-bit GCM nonce: a 4-byte prefix scoped to the key, then a 64-bit message counter.
    private nextNonce(kid: string): Buffer {
        const nonce = Buffer.alloc(12);
        createHash("sha256").update(kid).digest().copy(nonce, 0, 0, 4);
        nonce.writeBigUInt64BE(this.counter++, 4);
        return nonce;
    }

    encrypt(plaintext: string, aad: string): string {
        const kid = this.keyring.activeKid();
        const nonce = this.nextNonce(kid);
        const cipher = createCipheriv("aes-256-gcm", this.keyring.get(kid), nonce, { authTagLength: 16 });
        cipher.setAAD(Buffer.from(aad, "utf8"));
        const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
        const tag = cipher.getAuthTag();
        return ["v1", kid, nonce.toString("base64url"), tag.toString("base64url"), ciphertext.toString("base64url")].join(".");
    }

    decrypt(blob: string, aad: string): string {
        const { kid, nonce, tag, ciphertext } = parseEnvelope(blob);
        const decipher = createDecipheriv("aes-256-gcm", this.keyring.get(kid), nonce, { authTagLength: 16 });
        decipher.setAAD(Buffer.from(aad, "utf8"));
        decipher.setAuthTag(tag);
        try {
            return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
        } catch {
            throw new DecryptError("authentication failed");
        }
    }

    isCurrent(blob: string): boolean {
        return parseEnvelope(blob).kid === this.keyring.activeKid();
    }
}
