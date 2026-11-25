// 32-bit FNV-1a. Stable across processes and deploys, unlike Math.random().
export function fnv1a(input: string): number {
    let h = 0x811c9dc5;
    for (let i = 0; i < input.length; i++) {
        h ^= input.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
}
