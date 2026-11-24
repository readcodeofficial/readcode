export interface Clock {
  now(): Date;
}

export interface ConversionStore {
  insert(row: ConversionRow): Promise<void>;
  countByCampaign(tenantId: string, campaignId: string, since: Date): Promise<number>;
}

export interface ConversionRow {
  tenantId: string;
  campaignId: string;
  clickId: string;
  value: number;
  occurredAt: Date;
}

export interface ClickLookup {
  find(tenantId: string, clickId: string): Promise<{ campaignId: string; clickedAt: Date } | null>;
}

export class RequestScope {
  tenantId = '';
  requestId = '';
}

export class AttributionService {
  constructor(
    private readonly scope: RequestScope,
    private readonly clicks: ClickLookup,
    private readonly store: ConversionStore,
    private readonly clock: Clock,
    private readonly windowDays = 7,
  ) {}

  async recordConversion(clickId: string, value: number): Promise<'attributed' | 'expired' | 'unknown_click'> {
    const click = await this.clicks.find(this.scope.tenantId, clickId);
    if (!click) return 'unknown_click';

    const now = this.clock.now();
    const ageMs = now.getTime() - click.clickedAt.getTime();
    if (ageMs > this.windowDays * 24 * 60 * 60 * 1000) return 'expired';

    await this.store.insert({
      tenantId: this.scope.tenantId,
      campaignId: click.campaignId,
      clickId,
      value,
      occurredAt: now,
    });
    return 'attributed';
  }

  async conversionsLast24h(campaignId: string): Promise<number> {
    const since = new Date(this.clock.now().getTime() - 24 * 60 * 60 * 1000);
    return this.store.countByCampaign(this.scope.tenantId, campaignId, since);
  }
}
