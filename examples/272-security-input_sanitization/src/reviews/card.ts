import { escapeHtml, safeUrl } from "./escape.ts";

export interface Review {
    id: string;
    authorName: string;
    rating: number; // 1-5
    body: string;
    photoUrl?: string;
    postedAt: string; // ISO date
    ownerReply?: { body: string; repliedAt: string };
}

const MAX_BODY = 2000;

function stars(rating: number): string {
    const n = Math.min(5, Math.max(1, Math.round(rating)));
    return "★".repeat(n) + "☆".repeat(5 - n);
}

// Blank lines in the review separate paragraphs; single newlines become <br>.
function paragraphs(body: string): string {
    const text = body.length > MAX_BODY ? body.slice(0, MAX_BODY) + "…" : body;
    return text
        .split(/\n\s*\n/)
        .map((p) => p.trim())
        .filter((p) => p.length > 0)
        .map((p) => `<p>${p.split("\n").map(escapeHtml).join("<br>")}</p>`)
        .join("");
}

export function renderReviewCard(review: Review): string {
    const author = escapeHtml(review.authorName.trim() || "Anonymous");
    const photo = safeUrl(review.photoUrl);
    return [
        `<article class="review" data-id="${escapeHtml(review.id)}">`,
        `<h3 title="Review by ${author}">${author} <span class="stars">${stars(review.rating)}</span></h3>`,
        `<time datetime="${escapeHtml(review.postedAt)}">${escapeHtml(review.postedAt.slice(0, 10))}</time>`,
        paragraphs(review.body),
        photo ? `<a href="${escapeHtml(photo)}">View photo</a>` : "",
        review.ownerReply ? renderReply(review.ownerReply) : "",
        `</article>`,
    ].join("");
}

// The owner's public answer, shown under the review.
function renderReply(reply: { body: string; repliedAt: string }): string {
    return [
        `<blockquote class="owner-reply">`,
        `<strong>Owner replied on ${escapeHtml(reply.repliedAt.slice(0, 10))}</strong>`,
        paragraphs(reply.body),
        `</blockquote>`,
    ].join("");
}
