using Freightline.Rating.Clients;
using Microsoft.Extensions.Caching.Memory;
using Polly.CircuitBreaker;
using Polly.Timeout;

namespace Freightline.Rating.Services;

public sealed class RateUnavailableException : Exception
{
    public RateUnavailableException(string message, Exception inner) : base(message, inner) { }
}

public sealed class RateQuoteService
{
    private static readonly TimeSpan LastKnownTtl = TimeSpan.FromHours(6);

    private readonly CarrierRateClient _client;
    private readonly IMemoryCache _cache;
    private readonly ILogger<RateQuoteService> _logger;

    public RateQuoteService(CarrierRateClient client, IMemoryCache cache, ILogger<RateQuoteService> logger)
    {
        _client = client;
        _cache = cache;
        _logger = logger;
    }

    public async Task<Quote> GetQuoteAsync(QuoteRequest request, CancellationToken ct)
    {
        var key = CacheKey(request);

        try
        {
            var quote = await _client.GetQuoteAsync(request, ct);
            _cache.Set(key, quote, LastKnownTtl);
            return quote;
        }
        catch (Exception ex) when (ex is BrokenCircuitException or HttpRequestException or TimeoutRejectedException)
        {
            if (_cache.TryGetValue(key, out Quote? lastKnown) && lastKnown is not null)
            {
                _logger.LogWarning(ex, "Serving last known rate for {Key}", key);
                return lastKnown with { IsEstimate = true };
            }

            throw new RateUnavailableException($"No live or cached rate for {key}", ex);
        }
    }

    private static string CacheKey(QuoteRequest r)
    {
        var weightBand = Math.Ceiling(r.WeightKg / 5m) * 5m;
        return $"rate:{r.OriginZip}:{r.DestinationZip}:{r.ServiceLevel}:{weightBand}";
    }
}
