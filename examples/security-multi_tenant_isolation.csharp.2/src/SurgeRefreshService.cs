using Microsoft.Extensions.Caching.Memory;
using RideDispatch.Tenancy;

namespace RideDispatch.Dispatch;

public interface IDemandStats
{
    Task<IReadOnlyDictionary<string, decimal>> GetMultipliersByZoneAsync(CancellationToken ct);
}

public sealed class SurgeRefreshService : BackgroundService
{
    private static readonly TimeSpan Interval = TimeSpan.FromSeconds(30);

    private readonly IServiceScopeFactory _scopes;
    private readonly IMemoryCache _cache;
    private readonly ILogger<SurgeRefreshService> _logger;

    public SurgeRefreshService(IServiceScopeFactory scopes, IMemoryCache cache, ILogger<SurgeRefreshService> logger)
    {
        _scopes = scopes;
        _cache = cache;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(Interval);
        do
        {
            await RefreshAllTenantsAsync(stoppingToken);
        }
        while (await timer.WaitForNextTickAsync(stoppingToken));
    }

    private async Task RefreshAllTenantsAsync(CancellationToken ct)
    {
        IReadOnlyList<string> tenantIds;
        using (var listScope = _scopes.CreateScope())
        {
            var repo = listScope.ServiceProvider.GetRequiredService<IDriverRepository>();
            tenantIds = await repo.GetTenantIdsAsync(ct);
        }

        foreach (var raw in tenantIds)
        {
            var tenant = new TenantId(raw);
            try
            {
                using var scope = _scopes.CreateScope();
                scope.ServiceProvider.GetRequiredService<TenantContext>().Set(tenant);

                var stats = scope.ServiceProvider.GetRequiredService<IDemandStats>();
                foreach (var (zoneId, multiplier) in await stats.GetMultipliersByZoneAsync(ct))
                {
                    _cache.Set(SurgeKeys.For(tenant, zoneId), multiplier, TimeSpan.FromMinutes(2));
                }
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                _logger.LogError(ex, "Surge refresh failed for tenant {Tenant}", tenant);
            }
        }
    }
}
