export interface BidRequest {
    id: string;
    country: string; // ISO 3166 alpha-2
    device: "phone" | "tablet" | "desktop" | "ctv";
    segments: string[]; // audience segments the exchange attached to this user
    hour: number; // local hour of day, 0-23
    floorCents: number; // CPM floor set by the publisher
}

export interface Campaign {
    id: string;
    version: number; // bumped by the campaign editor on every change
    status: "active" | "paused";
    rule: string; // targeting expression, see rules.ts
    bidCents: number; // CPM bid
    dailyBudgetCents: number;
}

export interface Bid {
    requestId: string;
    campaignId: string;
    priceCents: number;
}

export type Matcher = (req: BidRequest) => boolean;
export type RuleCompiler = (rule: string) => Matcher;
