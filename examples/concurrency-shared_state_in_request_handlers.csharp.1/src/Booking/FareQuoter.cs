using System.Net.Http.Json;
using Microsoft.Extensions.Caching.Memory;

namespace TripDesk.Booking;

public sealed record FareQuote(string FlightId, string Currency, decimal Amount, DateTimeOffset QuotedAt);

internal sealed record FxResponse(decimal Rate);

public sealed class FareQuoter
{
    private static readonly TimeSpan RateTtl = TimeSpan.FromMinutes(5);

    private readonly IServiceScopeFactory _scopes;
    private readonly IHttpClientFactory _http;
    private readonly IMemoryCache _cache;
    private readonly TimeProvider _clock;

    public FareQuoter(IServiceScopeFactory scopes, IHttpClientFactory http, IMemoryCache cache, TimeProvider clock)
    {
        _scopes = scopes;
        _http = http;
        _cache = cache;
        _clock = clock;
    }

    public async Task<FareQuote?> QuoteAsync(string flightId, string currency, CancellationToken ct)
    {
        await using var scope = _scopes.CreateAsyncScope();
        var inventory = scope.ServiceProvider.GetRequiredService<IFlightInventory>();

        var baseFare = await inventory.GetBaseFareAsync(flightId, ct);
        if (baseFare is null)
            return null;

        var rate = await GetRateAsync(baseFare.Currency, currency, ct);
        var amount = Math.Round(baseFare.Amount * rate, 2, MidpointRounding.ToEven);
        return new FareQuote(flightId, currency, amount, _clock.GetUtcNow());
    }

    private async Task<decimal> GetRateAsync(string from, string to, CancellationToken ct)
    {
        if (from == to)
            return 1m;

        return await _cache.GetOrCreateAsync($"fx:{from}:{to}", async entry =>
        {
            entry.AbsoluteExpirationRelativeToNow = RateTtl;
            var client = _http.CreateClient("fx");
            var res = await client.GetFromJsonAsync<FxResponse>($"rates?from={from}&to={to}", ct);
            return res?.Rate ?? throw new InvalidOperationException($"No FX rate for {from}->{to}");
        });
    }
}
