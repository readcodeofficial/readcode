using Microsoft.Extensions.Logging;

namespace Notifications.Preferences;

public sealed record OutboundMessage(string UserId, Channels Channel, string TemplateId);

public interface IChannelSender
{
    Channels Channel { get; }
    Task SendAsync(OutboundMessage message, NotificationPreferences prefs, CancellationToken ct);
}

public sealed class NotificationDispatcher
{
    private readonly IPreferenceService _preferences;
    private readonly IReadOnlyDictionary<Channels, IChannelSender> _senders;
    private readonly ILogger<NotificationDispatcher> _log;

    public NotificationDispatcher(
        IPreferenceService preferences,
        IEnumerable<IChannelSender> senders,
        ILogger<NotificationDispatcher> log)
    {
        _preferences = preferences;
        _senders = senders.ToDictionary(s => s.Channel);
        _log = log;
    }

    public async Task<bool> DispatchAsync(OutboundMessage message, CancellationToken ct)
    {
        var prefs = await _preferences.GetAsync(message.UserId, ct);
        if (!prefs.Channels.HasFlag(message.Channel))
        {
            _log.LogInformation(
                "Skipping {Channel} for {UserId}: channel disabled", message.Channel, message.UserId);
            return false;
        }

        if (!_senders.TryGetValue(message.Channel, out var sender))
        {
            throw new InvalidOperationException($"No sender registered for {message.Channel}");
        }

        await sender.SendAsync(message, prefs, ct);
        return true;
    }
}
