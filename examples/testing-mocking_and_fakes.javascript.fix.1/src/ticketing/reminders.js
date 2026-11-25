// Nudges a buyer a few minutes before their hold runs out, then keeps nudging on a fixed interval.
export function scheduleReminders({ clock, send, firstAfterMs, everyMs, maxReminders }) {
    let sent = 0;
    let timer = null;

    function tick() {
        sent += 1;
        send({ n: sent, at: clock.now() });
        if (sent < maxReminders) timer = clock.setTimeout(tick, everyMs);
    }

    timer = clock.setTimeout(tick, firstAfterMs);

    return {
        cancel() {
            clock.clearTimeout(timer);
            sent = maxReminders;
        },
        count: () => sent,
    };
}
