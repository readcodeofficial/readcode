using System.Text.Json;
using Azure.Messaging.ServiceBus;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Freightline.Tracking;

public sealed class ShipmentScanConsumer : BackgroundService
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    private readonly ServiceBusProcessor _processor;
    private readonly ITrackingStore _store;
    private readonly ILogger<ShipmentScanConsumer> _logger;

    public ShipmentScanConsumer(ServiceBusClient client, ITrackingStore store, ILogger<ShipmentScanConsumer> logger)
    {
        _store = store;
        _logger = logger;
        _processor = client.CreateProcessor("shipment-scans", new ServiceBusProcessorOptions
        {
            AutoCompleteMessages = false,
            MaxConcurrentCalls = 8,
            PrefetchCount = 32,
            MaxAutoLockRenewalDuration = TimeSpan.FromMinutes(5),
        });
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _processor.ProcessMessageAsync += HandleMessageAsync;
        _processor.ProcessErrorAsync += HandleErrorAsync;

        await _processor.StartProcessingAsync(stoppingToken);
        try
        {
            await Task.Delay(Timeout.Infinite, stoppingToken);
        }
        catch (OperationCanceledException)
        {
        }
        await _processor.StopProcessingAsync(CancellationToken.None);
    }

    private async Task HandleMessageAsync(ProcessMessageEventArgs args)
    {
        var message = args.Message;

        ScanEvent? evt;
        try
        {
            evt = JsonSerializer.Deserialize<ScanEvent>(message.Body.ToMemory().Span, JsonOptions);
        }
        catch (JsonException ex)
        {
            await args.DeadLetterMessageAsync(message, "MalformedPayload", ex.Message, args.CancellationToken);
            return;
        }

        if (evt is null || string.IsNullOrWhiteSpace(evt.ShipmentId) || string.IsNullOrWhiteSpace(evt.ScanId))
        {
            await args.DeadLetterMessageAsync(message, "MissingFields", "ShipmentId and ScanId are required", args.CancellationToken);
            return;
        }

        await args.CompleteMessageAsync(args.Message, args.CancellationToken);

        try
        {
            await _store.RecordScanAsync(evt, args.CancellationToken);
        }
        catch (TransientStoreException ex)
        {
            _logger.LogWarning(ex, "Transient store failure for scan {ScanId}, delivery {Count}", evt.ScanId, message.DeliveryCount);
            await args.AbandonMessageAsync(message, cancellationToken: args.CancellationToken);
        }
    }

    private Task HandleErrorAsync(ProcessErrorEventArgs args)
    {
        _logger.LogError(args.Exception, "Service Bus error from {Source} on {Entity}", args.ErrorSource, args.EntityPath);
        return Task.CompletedTask;
    }
}
