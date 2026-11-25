import type { BlobStore } from "./storage/blobStore.ts";

export type RenderDefaultAvatar = (userId: string) => Buffer;

const MAX_AVATAR_BYTES = 512 * 1024;
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

const avatarKey = (userId: string) => `avatars/${userId}.png`;

// Profile page: show the user's uploaded avatar, or generate an initials avatar the first time.
export async function getOrCreateAvatar(store: BlobStore, userId: string, renderDefault: RenderDefaultAvatar): Promise<Buffer> {
    const key = avatarKey(userId);
    const existing = await store.get(key);
    if (existing) return existing;

    const generated = renderDefault(userId);
    await store.put(key, generated);
    return generated;
}

// Profile settings: upload a new avatar (PNG only, up to 512 KB).
export async function uploadAvatar(store: BlobStore, userId: string, data: Buffer): Promise<void> {
    if (data.length > MAX_AVATAR_BYTES) throw new Error("Avatar is larger than 512 KB");
    if (!data.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) throw new Error("Avatar must be a PNG");
    await store.put(avatarKey(userId), data);
}

// Profile settings: go back to the generated avatar.
export async function removeAvatar(store: BlobStore, userId: string): Promise<void> {
    await store.delete(avatarKey(userId));
}
