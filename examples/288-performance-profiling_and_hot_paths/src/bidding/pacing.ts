// Tracks what each campaign has spent today so the bidder stops before the daily budget runs out.
export class Pacer {
    private readonly today: () => string;
    private day = "";
    private readonly spent = new Map<string, number>();

    constructor(today: () => string) {
        this.today = today;
    }

    private rollover(): void {
        const day = this.today();
        if (day !== this.day) {
            this.day = day;
            this.spent.clear();
        }
    }

    // A CPM bid costs a thousandth of its price per impression; budgets are tracked in milli-cents.
    canAfford(campaignId: string, cpmCents: number, dailyBudgetCents: number): boolean {
        this.rollover();
        return (this.spent.get(campaignId) ?? 0) + cpmCents <= dailyBudgetCents * 1000;
    }

    record(campaignId: string, cpmCents: number): void {
        this.rollover();
        this.spent.set(campaignId, (this.spent.get(campaignId) ?? 0) + cpmCents);
    }

    spentCents(campaignId: string): number {
        this.rollover();
        return (this.spent.get(campaignId) ?? 0) / 1000;
    }
}
