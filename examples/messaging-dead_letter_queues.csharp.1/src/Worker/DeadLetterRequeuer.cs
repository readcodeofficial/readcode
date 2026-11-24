using Azure.Messaging.ServiceBus;
using Microsoft.Extensions.Logging;

namespace Billing.Worker;

public sealed class DeadLetterRequeuer
{
    private readonly ServiceBusClient _client;
    private readonly ILogger<DeadLetterRequeuer> _log;

    public DeadLetterRequeuer(ServiceBusClient client, ILogger<DeadLetterRequeuer> log)
    {
        _client = client;
        _log = log;
    }

    public async Task<int> RequeueTransientAsync(int maxMessages, CancellationToken ct)
    {
        await using var receiver = _client.CreateReceiver("invoice-payments", new ServiceBusReceiverOptions
        {
            SubQueue = SubQueue.DeadLetter,
            ReceiveMode = ServiceBusReceiveMode.PeekLock,
        });
        await using var sender = _client.CreateSender("invoice-payments");

        var requeued = 0;
        while (requeued < maxMessages)
        {
            var message = await receiver.ReceiveMessageAsync(TimeSpan.FromSeconds(2), ct);
            if (message is null)
            {
                break;
            }

            var reason = message.DeadLetterReason;
            if (reason == InvoicePaymentConsumer.DeadLetterReasonInvalid
                || reason == InvoicePaymentConsumer.DeadLetterReasonRejected)
            {
                await receiver.AbandonMessageAsync(message, cancellationToken: ct);
                continue;
            }

            var copy = new ServiceBusMessage(message)
            {
                MessageId = message.MessageId,
            };
            copy.ApplicationProperties["requeuedFromDlq"] = true;

            await sender.SendMessageAsync(copy, ct);
            await receiver.CompleteMessageAsync(message, ct);
            requeued++;
            _log.LogInformation("Requeued {MessageId} dead-lettered for {Reason}", message.MessageId, reason);
        }

        return requeued;
    }
}
