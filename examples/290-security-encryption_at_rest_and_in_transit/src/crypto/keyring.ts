// Data-encryption keys by key id. New data is encrypted with the active key; older keys stay
// available for decryption until every record has been re-encrypted.
export class Keyring {
    private readonly keys = new Map<string, Buffer>();
    private active: string;

    constructor(initial: Record<string, Buffer>, activeKid: string) {
        for (const [kid, key] of Object.entries(initial)) this.add(kid, key);
        if (!this.keys.has(activeKid)) throw new Error(`active key ${activeKid} is not in the keyring`);
        this.active = activeKid;
    }

    private add(kid: string, key: Buffer): void {
        if (!/^[a-z0-9-]{1,32}$/.test(kid)) throw new Error(`invalid key id ${kid}`);
        if (key.length !== 32) throw new Error(`key ${kid} must be 32 bytes for AES-256`);
        this.keys.set(kid, key);
    }

    // Adds a new key and makes it the one used for all new encryptions.
    rotate(kid: string, key: Buffer): void {
        if (this.keys.has(kid)) throw new Error(`key id ${kid} already used`);
        this.add(kid, key);
        this.active = kid;
    }

    activeKid(): string {
        return this.active;
    }

    get(kid: string): Buffer {
        const key = this.keys.get(kid);
        if (!key) throw new Error(`unknown key id ${kid}`);
        return key;
    }
}
