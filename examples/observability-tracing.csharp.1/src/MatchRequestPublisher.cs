using System.Diagnostics;
using System.Text.Json;

namespace Arcadia.Matchmaking;

public sealed record MatchRequest(string PlayerId, string Mode, int Rating, DateTimeOffset QueuedAt);

public sealed record MatchRequestMessage(
    string Id,
    MatchRequest Request,
    IReadOnlyDictionary<string, string> Headers);

public interface IMessageBus
{
    Task PublishAsync(string topic, string body, IDictionary<string, string> headers, CancellationToken ct);
}

public sealed class MatchRequestPublisher
{
    private readonly IMessageBus _bus;

    public MatchRequestPublisher(IMessageBus bus) => _bus = bus;

    public async Task EnqueueAsync(MatchRequest request, CancellationToken ct)
    {
        using var activity = MatchmakingTelemetry.Source.StartActivity(
            "matchmaking.enqueue", ActivityKind.Producer);
        activity?.SetTag("matchmaking.mode", request.Mode);
        activity?.SetTag("player.id", request.PlayerId);

        var headers = new Dictionary<string, string>();
        MatchmakingTelemetry.Inject(activity, headers);

        try
        {
            await _bus.PublishAsync(
                $"matchmaking.{request.Mode}", JsonSerializer.Serialize(request), headers, ct);
        }
        catch (Exception ex)
        {
            activity?.SetStatus(ActivityStatusCode.Error, ex.Message);
            throw;
        }
    }
}
