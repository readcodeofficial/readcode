using System.Net.Http.Json;

namespace Freightline.Rating.Clients;

public sealed record QuoteRequest(string OriginZip, string DestinationZip, decimal WeightKg, string ServiceLevel);

public sealed record Quote(decimal Amount, string Currency, int TransitDays, bool IsEstimate);

public sealed record CarrierRateResponse(decimal TotalCharge, string Currency, int TransitDays);

public sealed class InvalidQuoteRequestException : Exception
{
    public InvalidQuoteRequestException(string detail) : base(detail) { }
}

public sealed class CarrierRateClient
{
    private readonly HttpClient _http;

    public CarrierRateClient(HttpClient http) => _http = http;

    public async Task<Quote> GetQuoteAsync(QuoteRequest request, CancellationToken ct)
    {
        using var response = await _http.PostAsJsonAsync("v2/rates", request, ct);

        if ((int)response.StatusCode is >= 400 and < 500)
        {
            var detail = await response.Content.ReadAsStringAsync(ct);
            throw new InvalidQuoteRequestException(detail);
        }

        response.EnsureSuccessStatusCode();

        var body = await response.Content.ReadFromJsonAsync<CarrierRateResponse>(cancellationToken: ct)
                   ?? throw new HttpRequestException("Carrier returned an empty rate body");

        return new Quote(body.TotalCharge, body.Currency, body.TransitDays, IsEstimate: false);
    }
}
