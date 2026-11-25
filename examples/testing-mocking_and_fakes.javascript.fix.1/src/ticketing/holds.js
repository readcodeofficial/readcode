export function createHoldService({ clock, notifier, holdMs = 10 * 60_000 }) {
    const holds = new Map();
    const released = [];

    function release(seatId, reason) {
        const hold = holds.get(seatId);
        if (!hold) return false;
        holds.delete(seatId);
        clock.clearTimeout(hold.timer);
        released.push({ seatId, userId: hold.userId, at: clock.now(), reason });
        if (reason === "expired") notifier.seatReleased(hold.userId, seatId);
        return true;
    }

    return {
        hold(seatId, userId, ttlMs = holdMs) {
            const existing = holds.get(seatId);
            if (existing && existing.userId !== userId) return { ok: false, reason: "held" };
            if (existing) clock.clearTimeout(existing.timer);
            const timer = clock.setTimeout(() => release(seatId, "expired"), ttlMs);
            holds.set(seatId, { userId, timer, expiresAt: clock.now() + ttlMs });
            return { ok: true, expiresAt: clock.now() + ttlMs };
        },

        confirm(seatId, userId) {
            const hold = holds.get(seatId);
            if (!hold || hold.userId !== userId) return false;
            clock.clearTimeout(hold.timer);
            holds.delete(seatId);
            return true;
        },

        isHeld(seatId) {
            return holds.has(seatId);
        },

        releaseLog() {
            return released.map((r) => ({ ...r }));
        },
    };
}
