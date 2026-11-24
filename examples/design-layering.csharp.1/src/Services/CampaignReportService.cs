using AdsPlatform.Data;

namespace AdsPlatform.Services;

public record DailyMetrics(DateOnly Day, long Impressions, long Clicks, decimal SpendUsd)
{
    public decimal Ctr => Impressions == 0 ? 0m : (decimal)Clicks / Impressions;
}

public record CampaignDailyReport(long CampaignId, string Name, IReadOnlyList<DailyMetrics> Days);

public interface ICampaignReportService
{
    Task<CampaignDailyReport?> GetDailyAsync(long campaignId, DateOnly from, DateOnly to, CancellationToken ct);
}

public class CampaignReportService : ICampaignReportService
{
    private readonly IReportRepository _repo;
    private readonly IHttpContextAccessor _http;
    private readonly ILogger<CampaignReportService> _log;

    public CampaignReportService(
        IReportRepository repo,
        IHttpContextAccessor http,
        ILogger<CampaignReportService> log)
    {
        _repo = repo;
        _http = http;
        _log = log;
    }

    public async Task<CampaignDailyReport?> GetDailyAsync(
        long campaignId, DateOnly from, DateOnly to, CancellationToken ct)
    {
        var advertiserId = _http.HttpContext!.User.FindFirst("advertiser_id")!.Value;

        var campaign = await _repo.FindCampaignAsync(advertiserId, campaignId, ct);
        if (campaign is null)
        {
            _log.LogInformation("Campaign {CampaignId} not found for advertiser {AdvertiserId}", campaignId, advertiserId);
            return null;
        }

        var rows = await _repo.GetDailyRowsAsync(campaign.Id, from, to, ct);
        var byDay = rows.ToDictionary(r => r.Day);

        var days = new List<DailyMetrics>();
        for (var d = from; d <= to; d = d.AddDays(1))
        {
            days.Add(byDay.TryGetValue(d, out var row)
                ? new DailyMetrics(d, row.Impressions, row.Clicks, row.SpendMicros / 1_000_000m)
                : new DailyMetrics(d, 0, 0, 0m));
        }

        return new CampaignDailyReport(campaign.Id, campaign.Name, days);
    }
}
