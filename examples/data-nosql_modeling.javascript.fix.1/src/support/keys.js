// Key design for the support table:
//   pk ACCOUNT#<id>   sk PROFILE        the account
//   pk ACCOUNT#<id>   sk COUNTER        next ticket number
//   pk ACCOUNT#<id>   sk TICKET#<n>     one item per ticket, so an account's tickets are one query
export const accountPk = (accountId) => `ACCOUNT#${accountId}`;

export const TICKET_PREFIX = "TICKET#";

export const ticketSk = (number) => `${TICKET_PREFIX}${number}`;

export function parseTicketSk(sk) {
    if (!sk.startsWith(TICKET_PREFIX)) return null;
    return Number(sk.slice(TICKET_PREFIX.length));
}
