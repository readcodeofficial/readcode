namespace Notifications.Preferences;

[Flags]
public enum Channels
{
    None = 0,
    Email = 1,
    Sms = 2,
    Push = 4,
}

public sealed record NotificationPreferences(string UserId, Channels Channels, string Locale)
{
    public static NotificationPreferences Default(string userId) =>
        new(userId, Channels.Email | Channels.Push, "en-US");
}

public interface IPreferenceRepository
{
    Task<NotificationPreferences?> LoadAsync(string userId, CancellationToken ct);
    Task SaveAsync(NotificationPreferences prefs, CancellationToken ct);
}

public interface IPreferenceService
{
    Task<NotificationPreferences> GetAsync(string userId, CancellationToken ct);
    Task UpdateAsync(string userId, Channels channels, string locale, CancellationToken ct);
    Task UnsubscribeAllAsync(string userId, CancellationToken ct);
}
