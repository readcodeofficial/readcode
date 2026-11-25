using System.Text.Json.Serialization;

namespace Notifications.Delivery;

public sealed record SmsMessage(Guid Id, string To, string Body);

public enum SendStatus { Accepted, Rejected, TemporaryFailure }

public sealed record SendResult(SendStatus Status, string? ProviderMessageId, int HttpStatus);

public interface ISmsSender
{
    Task<SendResult> SendAsync(SmsMessage message, CancellationToken ct);
}

public interface INotificationStore
{
    Task<IReadOnlyList<SmsMessage>> ClaimPendingAsync(int batchSize, CancellationToken ct);
    Task MarkSentAsync(Guid id, string providerMessageId, CancellationToken ct);
    Task MarkRejectedAsync(Guid id, int httpStatus, CancellationToken ct);
    Task ReleaseForLaterAsync(Guid id, CancellationToken ct);
}

internal sealed record GatewayResponse([property: JsonPropertyName("message_id")] string MessageId);
