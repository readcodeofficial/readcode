import type { FieldCipher } from "../crypto/fieldCipher.ts";

export interface StoredNote {
    id: string;
    patientId: string;
    authorId: string;
    createdAt: string;
    body: string; // encrypted envelope, never plaintext
}

export interface NoteStore {
    put(note: StoredNote): Promise<void>;
    get(id: string): Promise<StoredNote | null>;
    all(): Promise<StoredNote[]>;
}

const aadFor = (n: Pick<StoredNote, "id" | "patientId">) => `clinical-note:${n.patientId}:${n.id}`;

// Visit notes for a telehealth practice. The note body is encrypted before it leaves the
// service; the id, patient and author stay in clear so they can be indexed.
export class ClinicalNotes {
    private readonly store: NoteStore;
    private readonly cipher: FieldCipher;

    constructor(store: NoteStore, cipher: FieldCipher) {
        this.store = store;
        this.cipher = cipher;
    }

    async write(note: Omit<StoredNote, "body">, body: string): Promise<void> {
        await this.store.put({ ...note, body: this.cipher.encrypt(body, aadFor(note)) });
    }

    async read(id: string): Promise<string | null> {
        const note = await this.store.get(id);
        return note ? this.cipher.decrypt(note.body, aadFor(note)) : null;
    }

    // Background job after a key rotation: re-encrypt every note still under an older key.
    async reencryptAll(): Promise<number> {
        let changed = 0;
        for (const note of await this.store.all()) {
            if (this.cipher.isCurrent(note.body)) continue;
            const plaintext = this.cipher.decrypt(note.body, aadFor(note));
            await this.store.put({ ...note, body: this.cipher.encrypt(plaintext, aadFor(note)) });
            changed++;
        }
        return changed;
    }
}
