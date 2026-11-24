using System.Text.Json;
using Azure.Messaging.ServiceBus;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Billing.Worker;

public sealed class InvoicePaymentConsumer : BackgroundService
{
    public const string DeadLetterReasonInvalid = "InvalidPayload";
    public const string DeadLetterReasonRejected = "BusinessRejected";

    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    private readonly ServiceBusProcessor _processor;
    private readonly IPaymentLedger _ledger;
    private readonly ILogger<InvoicePaymentConsumer> _log;

    public InvoicePaymentConsumer(ServiceBusClient client, IPaymentLedger ledger, ILogger<InvoicePaymentConsumer> log)
    {
        _ledger = ledger;
        _log = log;
        _processor = client.CreateProcessor("invoice-payments", new ServiceBusProcessorOptions
        {
            AutoCompleteMessages = false,
            MaxConcurrentCalls = 8,
            PrefetchCount = 16,
            MaxAutoLockRenewalDuration = TimeSpan.FromMinutes(2),
        });
        _processor.ProcessMessageAsync += HandleAsync;
        _processor.ProcessErrorAsync += OnErrorAsync;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await _processor.StartProcessingAsync(stoppingToken);
        try
        {
            await Task.Delay(Timeout.Infinite, stoppingToken);
        }
        catch (OperationCanceledException)
        {
        }
        finally
        {
            await _processor.StopProcessingAsync(CancellationToken.None);
        }
    }

    private async Task HandleAsync(ProcessMessageEventArgs args)
    {
        PaymentInstruction? instruction;
        try
        {
            instruction = args.Message.Body.ToObjectFromJson<PaymentInstruction>(Json);
        }
        catch (JsonException ex)
        {
            await args.DeadLetterMessageAsync(args.Message, DeadLetterReasonInvalid, ex.Message, args.CancellationToken);
            return;
        }

        if (instruction is null || instruction.Amount <= 0 || string.IsNullOrWhiteSpace(instruction.InvoiceId))
        {
            await args.DeadLetterMessageAsync(
                args.Message, DeadLetterReasonInvalid, "Missing invoice id or non-positive amount", args.CancellationToken);
            return;
        }

        try
        {
            await _ledger.ApplyPaymentAsync(args.Message.MessageId, instruction, args.CancellationToken);
            await args.CompleteMessageAsync(args.Message, args.CancellationToken);
        }
        catch (PaymentRejectedException ex)
        {
            await args.DeadLetterMessageAsync(args.Message, DeadLetterReasonRejected, ex.Message, args.CancellationToken);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            _log.LogWarning(ex, "Transient failure for {MessageId}, delivery {Count}",
                args.Message.MessageId, args.Message.DeliveryCount);
            await args.AbandonMessageAsync(args.Message, cancellationToken: args.CancellationToken);
        }
    }

    private Task OnErrorAsync(ProcessErrorEventArgs args)
    {
        _log.LogError(args.Exception, "Service Bus error from {Source} on {Entity}",
            args.ErrorSource, args.EntityPath);
        return Task.CompletedTask;
    }
}

public sealed record PaymentInstruction(string InvoiceId, decimal Amount, string Currency, string PayerReference);
