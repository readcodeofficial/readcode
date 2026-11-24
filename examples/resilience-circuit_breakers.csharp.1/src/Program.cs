using Freightline.Rating.Clients;
using Freightline.Rating.Resilience;
using Freightline.Rating.Services;
using Polly.Extensions.Http;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddMemoryCache();
builder.Services.AddSingleton<CarrierPolicyRegistry>();
builder.Services.AddScoped<RateQuoteService>();

builder.Services
    .AddHttpClient<CarrierRateClient>(client =>
    {
        client.BaseAddress = new Uri(builder.Configuration["Carriers:Northwind:BaseUrl"]!);
        client.DefaultRequestHeaders.Add("X-Api-Key", builder.Configuration["Carriers:Northwind:ApiKey"]);
    })
    .AddPolicyHandler((sp, _) => sp.GetRequiredService<CarrierPolicyRegistry>().For("northwind"));

var app = builder.Build();

app.MapPost("/quotes", async (QuoteRequest req, RateQuoteService svc, CancellationToken ct) =>
{
    try
    {
        return Results.Ok(await svc.GetQuoteAsync(req, ct));
    }
    catch (RateUnavailableException)
    {
        return Results.StatusCode(StatusCodes.Status503ServiceUnavailable);
    }
    catch (InvalidQuoteRequestException ex)
    {
        return Results.UnprocessableEntity(new { error = ex.Message });
    }
});

app.Run();
