import { Pool } from 'pg';
import {
  AttributionService,
  ClickLookup,
  Clock,
  ConversionStore,
  RequestScope,
} from './services';

export interface Container {
  scope: RequestScope;
  attribution: AttributionService;
}

export interface ContainerOverrides {
  clock?: Clock;
  clicks?: ClickLookup;
  store?: ConversionStore;
}

const systemClock: Clock = { now: () => new Date() };

function pgConversionStore(pool: Pool): ConversionStore {
  return {
    async insert(row) {
      await pool.query(
        `INSERT INTO conversions (tenant_id, campaign_id, click_id, value, occurred_at)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (tenant_id, click_id) DO NOTHING`,
        [row.tenantId, row.campaignId, row.clickId, row.value, row.occurredAt],
      );
    },
    async countByCampaign(tenantId, campaignId, since) {
      const { rows } = await pool.query(
        `SELECT count(*)::int AS n FROM conversions
         WHERE tenant_id = $1 AND campaign_id = $2 AND occurred_at >= $3`,
        [tenantId, campaignId, since],
      );
      return rows[0].n;
    },
  };
}

function pgClickLookup(pool: Pool): ClickLookup {
  return {
    async find(tenantId, clickId) {
      const { rows } = await pool.query(
        `SELECT campaign_id, clicked_at FROM clicks WHERE tenant_id = $1 AND click_id = $2`,
        [tenantId, clickId],
      );
      if (rows.length === 0) return null;
      return { campaignId: rows[0].campaign_id, clickedAt: rows[0].clicked_at };
    },
  };
}

export function buildContainer(pool: Pool, overrides: ContainerOverrides = {}): Container {
  const scope = new RequestScope();

  const attribution = new AttributionService(
    scope,
    overrides.clicks ?? pgClickLookup(pool),
    overrides.store ?? pgConversionStore(pool),
    overrides.clock ?? systemClock,
  );

  return { scope, attribution };
}
