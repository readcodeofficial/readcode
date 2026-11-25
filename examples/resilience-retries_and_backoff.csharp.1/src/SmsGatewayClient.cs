using System.Net.Http.Json;
using Microsoft.Extensions.Logging;
using Polly;

namespace Notifications.Delivery;

public sealed class SmsGatewayClient : ISmsSender
{
    private readonly HttpClient _http;
    private readonly ResiliencePipeline<HttpResponseMessage> _pipeline;

    public SmsGatewayClient(HttpClient http, ResiliencePipeline<HttpResponseMessage> pipeline)
    {
        _http = http;
        _pipeline = pipeline;
    }

    public async Task<SendResult> SendAsync(SmsMessage message, CancellationToken ct)
    {
        using var response = await _pipeline.ExecuteAsync(async token =>
        {
            using var request = new HttpRequestMessage(HttpMethod.Post, "v2/messages")
            {
                Content = JsonContent.Create(new
                {
                    to = message.To,
                    body = message.Body,
                    client_reference = message.Id
                })
            };
            request.Headers.Add("Idempotency-Key", Guid.NewGuid().ToString("N"));
            return await _http.SendAsync(request, token).ConfigureAwait(false);
        }, ct).ConfigureAwait(false);

        var status = (int)response.StatusCode;
        if (response.IsSuccessStatusCode)
        {
            var body = await response.Content
                .ReadFromJsonAsync<GatewayResponse>(cancellationToken: ct)
                .ConfigureAwait(false);
            return new SendResult(SendStatus.Accepted, body?.MessageId, status);
        }

        return SmsResilience.IsTransient(response.StatusCode)
            ? new SendResult(SendStatus.TemporaryFailure, null, status)
            : new SendResult(SendStatus.Rejected, null, status);
    }
}

public sealed class SmsDispatcher
{
    private readonly ISmsSender _sender;
    private readonly INotificationStore _store;
    private readonly ILogger<SmsDispatcher> _logger;

    public SmsDispatcher(ISmsSender sender, INotificationStore store, ILogger<SmsDispatcher> logger)
    {
        _sender = sender;
        _store = store;
        _logger = logger;
    }

    public async Task<int> DispatchPendingAsync(int batchSize, CancellationToken ct)
    {
        var sent = 0;
        foreach (var message in await _store.ClaimPendingAsync(batchSize, ct))
        {
            SendResult result;
            try
            {
                result = await _sender.SendAsync(message, ct);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                _logger.LogError(ex, "SMS {MessageId} could not be delivered to the gateway", message.Id);
                await _store.ReleaseForLaterAsync(message.Id, ct);
                continue;
            }

            switch (result.Status)
            {
                case SendStatus.Accepted:
                    await _store.MarkSentAsync(message.Id, result.ProviderMessageId ?? "unknown", ct);
                    sent++;
                    break;
                case SendStatus.Rejected:
                    await _store.MarkRejectedAsync(message.Id, result.HttpStatus, ct);
                    break;
                default:
                    await _store.ReleaseForLaterAsync(message.Id, ct);
                    break;
            }
        }
        return sent;
    }
}
