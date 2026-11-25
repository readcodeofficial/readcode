using Microsoft.Extensions.Caching.Memory;
using RideDispatch.Tenancy;

namespace RideDispatch.Dispatch;

public sealed record Driver(string Id, string ZoneId, double Lat, double Lon);

public interface IDriverRepository
{
    Task<IReadOnlyList<Driver>> GetAvailableInZoneAsync(TenantId tenant, string zoneId, CancellationToken ct);
    Task<IReadOnlyList<string>> GetTenantIdsAsync(CancellationToken ct);
}

public sealed class DriverAvailabilityService
{
    private static readonly TimeSpan AvailabilityTtl = TimeSpan.FromSeconds(5);

    private readonly IDriverRepository _drivers;
    private readonly ITenantContext _tenant;
    private readonly IMemoryCache _cache;

    public DriverAvailabilityService(IDriverRepository drivers, ITenantContext tenant, IMemoryCache cache)
    {
        _drivers = drivers;
        _tenant = tenant;
        _cache = cache;
    }

    public async Task<IReadOnlyList<Driver>> GetAvailableAsync(string zoneId, CancellationToken ct)
    {
        var tenant = _tenant.Id;
        var drivers = await _cache.GetOrCreateAsync($"drivers:{zoneId}", async entry =>
        {
            entry.AbsoluteExpirationRelativeToNow = AvailabilityTtl;
            return await _drivers.GetAvailableInZoneAsync(tenant, zoneId, ct);
        });
        return drivers ?? Array.Empty<Driver>();
    }

    public decimal GetSurgeMultiplier(string zoneId) =>
        _cache.TryGetValue(SurgeKeys.For(_tenant.Id, zoneId), out decimal multiplier) ? multiplier : 1.0m;
}

public static class SurgeKeys
{
    public static string For(TenantId tenant, string zoneId) => $"surge:{tenant}:{zoneId}";
}
