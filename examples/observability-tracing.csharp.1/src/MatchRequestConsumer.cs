using System.Diagnostics;

namespace Arcadia.Matchmaking;

public interface IMatchPool
{
    Task<bool> TryPlaceAsync(MatchRequest request, CancellationToken ct);
}

public sealed class MatchRequestConsumer
{
    private readonly IMatchPool _pool;
    private readonly ILogger<MatchRequestConsumer> _logger;

    public MatchRequestConsumer(IMatchPool pool, ILogger<MatchRequestConsumer> logger)
    {
        _pool = pool;
        _logger = logger;
    }

    public async Task HandleBatchAsync(IReadOnlyList<MatchRequestMessage> batch, CancellationToken ct)
    {
        if (batch.Count == 0)
        {
            return;
        }

        var parent = MatchmakingTelemetry.Extract(batch[0].Headers);
        using var activity = MatchmakingTelemetry.Source.StartActivity(
            "matchmaking.process_batch", ActivityKind.Consumer, parent.ActivityContext);
        activity?.SetTag("messaging.batch.message_count", batch.Count);

        var placed = 0;
        foreach (var message in batch)
        {
            if (await ProcessOneAsync(message, ct))
            {
                placed++;
            }
        }

        activity?.SetTag("matchmaking.placed_count", placed);
    }

    private async Task<bool> ProcessOneAsync(MatchRequestMessage message, CancellationToken ct)
    {
        using var activity = MatchmakingTelemetry.Source.StartActivity("matchmaking.place_request");
        activity?.SetTag("messaging.message.id", message.Id);
        activity?.SetTag("matchmaking.mode", message.Request.Mode);

        try
        {
            var placed = await _pool.TryPlaceAsync(message.Request, ct);
            activity?.SetTag("matchmaking.placed", placed);
            return placed;
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            activity?.SetStatus(ActivityStatusCode.Error, ex.Message);
            _logger.LogWarning(ex, "Placing request {MessageId} failed", message.Id);
            return false;
        }
    }
}
