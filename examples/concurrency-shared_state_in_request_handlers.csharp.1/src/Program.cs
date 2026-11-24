using TripDesk.Booking;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddHttpClient("fx", c =>
{
    c.BaseAddress = new Uri(builder.Configuration["Fx:BaseUrl"]!);
    c.Timeout = TimeSpan.FromSeconds(3);
});
builder.Services.AddMemoryCache();
builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddSingleton<FareQuoter>();
builder.Services.AddSingleton<SeatHoldRegistry>();
builder.Services.AddScoped<IFlightInventory, SqlFlightInventory>();
builder.Services.AddScoped<RequestAudit>();

var app = builder.Build();

app.MapGet("/fares/{flightId}", async (string flightId, string currency, FareQuoter quoter, CancellationToken ct) =>
{
    var quote = await quoter.QuoteAsync(flightId, currency.ToUpperInvariant(), ct);
    return quote is null ? Results.NotFound() : Results.Ok(quote);
});

app.MapPost("/holds", async (HoldRequest req, SeatHoldRegistry holds, IFlightInventory inventory,
    RequestAudit audit, CancellationToken ct) =>
{
    if (req.Seats is < 1 or > 9)
        return Results.BadRequest(new { error = "seats_out_of_range" });

    audit.Record("hold.create", req.FlightId);
    var remaining = await inventory.GetRemainingSeatsAsync(req.FlightId, ct);
    if (!holds.TryHold(req.FlightId, req.Seats, remaining, out var holdId))
        return Results.Conflict(new { error = "insufficient_seats" });

    return Results.Created($"/holds/{holdId}", new { holdId });
});

app.MapDelete("/holds/{holdId:guid}", (Guid holdId, SeatHoldRegistry holds, RequestAudit audit) =>
{
    audit.Record("hold.release", holdId.ToString());
    return holds.Release(holdId) ? Results.NoContent() : Results.NotFound();
});

app.Run();

public sealed record HoldRequest(string FlightId, int Seats);
