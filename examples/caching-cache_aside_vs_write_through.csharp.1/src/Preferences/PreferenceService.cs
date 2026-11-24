using System.Text.Json;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Logging;

namespace Notifications.Preferences;

public sealed class PreferenceService : IPreferenceService
{
    private static readonly DistributedCacheEntryOptions CacheOptions = new()
    {
        AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(30),
    };

    private readonly IDistributedCache _cache;
    private readonly IPreferenceRepository _repo;
    private readonly ILogger<PreferenceService> _log;

    public PreferenceService(
        IDistributedCache cache,
        IPreferenceRepository repo,
        ILogger<PreferenceService> log)
    {
        _cache = cache;
        _repo = repo;
        _log = log;
    }

    private static string Key(string userId) => $"notif:prefs:v1:{userId}";

    public async Task<NotificationPreferences> GetAsync(string userId, CancellationToken ct)
    {
        var key = Key(userId);
        var cached = await _cache.GetStringAsync(key, ct);
        if (cached is not null)
        {
            return JsonSerializer.Deserialize<NotificationPreferences>(cached)!;
        }

        var prefs = await _repo.LoadAsync(userId, ct)
                    ?? NotificationPreferences.Default(userId);
        await _cache.SetStringAsync(key, JsonSerializer.Serialize(prefs), CacheOptions, ct);
        _log.LogDebug("Loaded preferences for {UserId} from the database", userId);
        return prefs;
    }

    public async Task UpdateAsync(
        string userId, Channels channels, string locale, CancellationToken ct)
    {
        var updated = new NotificationPreferences(userId, channels, locale);
        await _repo.SaveAsync(updated, ct);
        await _cache.SetStringAsync(
            Key(userId), JsonSerializer.Serialize(updated), CacheOptions, ct);
    }

    public async Task UnsubscribeAllAsync(string userId, CancellationToken ct)
    {
        var current = await GetAsync(userId, ct);
        await _repo.SaveAsync(current with { Channels = Channels.None }, ct);
        _log.LogInformation("User {UserId} unsubscribed from all channels", userId);
    }
}
