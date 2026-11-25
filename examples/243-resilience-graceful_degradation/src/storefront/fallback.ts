// Runs an optional dependency call with a deadline. If it fails or is too slow, the caller gets
// `fallback` instead and `name` is added to `degraded` so the response can say what's missing.
export async function withFallback<T>(
    name: string,
    work: () => Promise<T>,
    fallback: T,
    timeoutMs: number,
    degraded: string[],
): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${name} timed out after ${timeoutMs}ms`)), timeoutMs);
    });
    try {
        return await Promise.race([work(), deadline]);
    } catch {
        degraded.push(name);
        return fallback;
    } finally {
        clearTimeout(timer);
    }
}
