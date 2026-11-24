using Notifications.Preferences;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddStackExchangeRedisCache(options =>
{
    options.Configuration = builder.Configuration.GetConnectionString("Redis");
    options.InstanceName = "notifications:";
});
builder.Services.AddScoped<IPreferenceRepository, SqlPreferenceRepository>();
builder.Services.AddScoped<IPreferenceService, PreferenceService>();
builder.Services.AddScoped<NotificationDispatcher>();

var app = builder.Build();

app.MapPut("/users/{id}/preferences", async (
    string id, PreferenceUpdate body, IPreferenceService prefs, CancellationToken ct) =>
{
    await prefs.UpdateAsync(id, body.Channels, body.Locale, ct);
    return Results.NoContent();
});

app.MapPost("/users/{id}/unsubscribe", async (
    string id, IPreferenceService prefs, CancellationToken ct) =>
{
    await prefs.UnsubscribeAllAsync(id, ct);
    return Results.NoContent();
});

app.Run();

public sealed record PreferenceUpdate(Channels Channels, string Locale);
