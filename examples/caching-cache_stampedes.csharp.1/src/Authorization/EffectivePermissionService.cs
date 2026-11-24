using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Hybrid;

namespace Iam.Authorization;

public sealed record EffectivePermissions(Guid UserId, string[] Scopes, long Version);

public sealed class EffectivePermissionService(
    HybridCache cache,
    IDbContextFactory<IamDbContext> dbFactory,
    ILogger<EffectivePermissionService> logger)
{
    private static readonly HybridCacheEntryOptions EntryOptions = new()
    {
        Expiration = TimeSpan.FromMinutes(10),
        LocalCacheExpiration = TimeSpan.FromSeconds(45),
    };

    private static readonly TimeSpan LoadTimeout = TimeSpan.FromSeconds(3);

    public ValueTask<EffectivePermissions> GetAsync(string tenantId, Guid userId, CancellationToken ct) =>
        cache.GetOrCreateAsync(
            KeyFor(tenantId, userId),
            (Service: this, TenantId: tenantId, UserId: userId),
            static (state, token) => state.Service.LoadAsync(state.TenantId, state.UserId, token),
            EntryOptions,
            cancellationToken: ct);

    public ValueTask InvalidateAsync(string tenantId, Guid userId, CancellationToken ct) =>
        cache.RemoveAsync(KeyFor(tenantId, userId), ct);

    private async ValueTask<EffectivePermissions> LoadAsync(string tenantId, Guid userId, CancellationToken token)
    {
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(token);
        timeout.CancelAfter(LoadTimeout);

        await using var db = await dbFactory.CreateDbContextAsync(timeout.Token);

        var scopes = await db.RoleGrants
            .AsNoTracking()
            .Where(g => g.TenantId == tenantId && g.UserId == userId && g.RevokedAt == null)
            .SelectMany(g => g.Role.Scopes)
            .Select(s => s.Name)
            .Distinct()
            .OrderBy(name => name)
            .ToArrayAsync(timeout.Token);

        var version = await db.AccessVersions
            .AsNoTracking()
            .Where(v => v.TenantId == tenantId && v.UserId == userId)
            .Select(v => v.Version)
            .FirstOrDefaultAsync(timeout.Token);

        logger.LogDebug("Loaded {ScopeCount} scopes for user {UserId} in tenant {TenantId}",
            scopes.Length, userId, tenantId);
        return new EffectivePermissions(userId, scopes, version);
    }

    private static string KeyFor(string tenantId, Guid userId)
    {
        if (tenantId.Length is 0 or > 64 || tenantId.Contains(':'))
        {
            throw new ArgumentException("Invalid tenant id", nameof(tenantId));
        }

        return $"perm:{tenantId}:{userId:N}";
    }
}
