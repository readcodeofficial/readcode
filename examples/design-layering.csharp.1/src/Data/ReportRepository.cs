using Microsoft.EntityFrameworkCore;

namespace AdsPlatform.Data;

public class CampaignEntity
{
    public long Id { get; set; }
    public string AdvertiserId { get; set; } = "";
    public string Name { get; set; } = "";
}

public class DailyRowEntity
{
    public long CampaignId { get; set; }
    public DateOnly Day { get; set; }
    public long Impressions { get; set; }
    public long Clicks { get; set; }
    public long SpendMicros { get; set; }
}

public interface IReportRepository
{
    Task<CampaignEntity?> FindCampaignAsync(string advertiserId, long campaignId, CancellationToken ct);
    Task<IReadOnlyList<DailyRowEntity>> GetDailyRowsAsync(long campaignId, DateOnly from, DateOnly to, CancellationToken ct);
}

public class ReportRepository : IReportRepository
{
    private readonly AnalyticsDbContext _db;

    public ReportRepository(AnalyticsDbContext db)
    {
        _db = db;
    }

    public Task<CampaignEntity?> FindCampaignAsync(string advertiserId, long campaignId, CancellationToken ct) =>
        _db.Campaigns.AsNoTracking()
            .FirstOrDefaultAsync(c => c.Id == campaignId && c.AdvertiserId == advertiserId, ct);

    public async Task<IReadOnlyList<DailyRowEntity>> GetDailyRowsAsync(
        long campaignId, DateOnly from, DateOnly to, CancellationToken ct) =>
        await _db.DailyRows.AsNoTracking()
            .Where(r => r.CampaignId == campaignId && r.Day >= from && r.Day <= to)
            .OrderBy(r => r.Day)
            .ToListAsync(ct);
}

public class AnalyticsDbContext : DbContext
{
    public AnalyticsDbContext(DbContextOptions<AnalyticsDbContext> options) : base(options) { }

    public DbSet<CampaignEntity> Campaigns => Set<CampaignEntity>();
    public DbSet<DailyRowEntity> DailyRows => Set<DailyRowEntity>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.Entity<DailyRowEntity>().HasKey(r => new { r.CampaignId, r.Day });
    }
}
