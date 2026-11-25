import { accountPk, parseTicketSk, ticketSk, TICKET_PREFIX } from "./keys.js";

export function createTicketRepo({ table, now }) {
    const toTicket = (item) => ({
        number: parseTicketSk(item.sk),
        accountId: item.pk.slice("ACCOUNT#".length),
        subject: item.subject,
        status: item.status,
        openedAt: item.openedAt,
    });

    return {
        open(accountId, subject) {
            const pk = accountPk(accountId);
            const number = table.increment(pk, "COUNTER", "lastTicket");
            const item = { pk, sk: ticketSk(number), subject, status: "open", openedAt: now() };
            table.put(item);
            return toTicket(item);
        },

        get(accountId, number) {
            const item = table.get(accountPk(accountId), ticketSk(number));
            return item ? toTicket(item) : null;
        },

        // The dashboard widget: the account's most recent tickets, newest first.
        latest(accountId, count) {
            const { items } = table.query(accountPk(accountId), {
                skPrefix: TICKET_PREFIX,
                limit: count,
                newestFirst: true,
            });
            return items.map(toTicket);
        },

        // Tickets numbered from..to inclusive, oldest first (used by the export job).
        range(accountId, from, to) {
            const { items } = table.query(accountPk(accountId), {
                skBetween: [ticketSk(from), ticketSk(to)],
            });
            return items.map(toTicket);
        },

        // Full history, a page at a time, oldest first.
        history(accountId, { pageSize, after } = {}) {
            const { items, lastKey } = table.query(accountPk(accountId), {
                skPrefix: TICKET_PREFIX,
                limit: pageSize,
                startAfter: after,
            });
            return { tickets: items.map(toTicket), next: lastKey };
        },
    };
}
