using RideDispatch.Dispatch;
using RideDispatch.Tenancy;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddMemoryCache();
builder.Services.AddScoped<TenantContext>();
builder.Services.AddScoped<ITenantContext>(sp => sp.GetRequiredService<TenantContext>());
builder.Services.AddScoped<DriverAvailabilityService>();
builder.Services.AddHostedService<SurgeRefreshService>();

var app = builder.Build();

app.UseAuthentication();
app.UseMiddleware<TenantResolutionMiddleware>();

app.MapGet("/zones/{zoneId}/drivers", async (string zoneId, DriverAvailabilityService availability, CancellationToken ct) =>
    Results.Ok(await availability.GetAvailableAsync(zoneId, ct)));

app.MapGet("/zones/{zoneId}/surge", (string zoneId, DriverAvailabilityService availability) =>
    Results.Ok(new { zoneId, multiplier = availability.GetSurgeMultiplier(zoneId) }));

app.Run();
