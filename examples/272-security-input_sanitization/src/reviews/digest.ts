import { escapeHtml } from "./escape.ts";
import { renderReviewCard, type Review } from "./card.ts";

export interface Restaurant {
    id: string;
    name: string; // set by the restaurant owner in their dashboard
}

export interface DigestEmail {
    subject: string; // plain text header, not HTML
    html: string;
}

// Weekly email to a restaurant owner with their newest reviews.
export function buildWeeklyDigest(restaurant: Restaurant, reviews: Review[], limit = 5): DigestEmail {
    const newest = [...reviews].sort((a, b) => b.postedAt.localeCompare(a.postedAt)).slice(0, limit);
    const average = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;
    const name = escapeHtml(restaurant.name);

    const summary = reviews.length
        ? `<p>${reviews.length} new review${reviews.length === 1 ? "" : "s"}, averaging ${average.toFixed(1)} stars.</p>`
        : `<p>No new reviews this week.</p>`;

    // Low ratings nobody has answered yet get a call-out at the top.
    const unanswered = reviews.filter((r) => r.rating <= 2 && !r.ownerReply);
    const attention = unanswered.length
        ? `<p class="attention">${unanswered.length} low rating${unanswered.length === 1 ? " is" : "s are"} waiting for a reply.</p>`
        : "";

    return {
        subject: `This week at ${restaurant.name.replace(/[\r\n]+/g, " ")}`,
        html: `<html><body><h1>This week at ${name}</h1>${summary}${attention}${newest.map(renderReviewCard).join("")}</body></html>`,
    };
}
