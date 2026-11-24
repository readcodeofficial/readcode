using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Telemetry.Shadows;

public class ShadowService
{
    private const int MaxAttempts = 4;

    private readonly ShadowDbContext _db;
    private readonly ILogger<ShadowService> _log;

    public ShadowService(ShadowDbContext db, ILogger<ShadowService> log)
    {
        _db = db;
        _log = log;
    }

    public async Task ApplyReportAsync(DeviceReport report, CancellationToken ct)
    {
        var shadow = await _db.Shadows.SingleAsync(s => s.DeviceId == report.DeviceId, ct);

        for (var attempt = 1; ; attempt++)
        {
            shadow.FirmwareVersion = report.FirmwareVersion;
            shadow.LastTemperatureC = report.TemperatureC;
            shadow.LastSeenAt = report.ObservedAt;
            shadow.ReportCount += 1;

            try
            {
                await _db.SaveChangesAsync(ct);
                return;
            }
            catch (DbUpdateConcurrencyException ex) when (attempt < MaxAttempts)
            {
                _log.LogInformation("Shadow {DeviceId} changed concurrently, attempt {Attempt}",
                    report.DeviceId, attempt);

                foreach (var entry in ex.Entries)
                {
                    var current = await entry.GetDatabaseValuesAsync(ct);
                    if (current is null)
                    {
                        throw new InvalidOperationException($"Shadow {report.DeviceId} was deleted");
                    }

                    entry.OriginalValues.SetValues(current);
                }
            }
        }
    }

    public async Task<bool> TrySetDesiredConfigAsync(
        Guid deviceId, string configJson, byte[] expectedVersion, CancellationToken ct)
    {
        var shadow = await _db.Shadows.SingleAsync(s => s.DeviceId == deviceId, ct);
        _db.Entry(shadow).Property(s => s.RowVersion).OriginalValue = expectedVersion;
        shadow.DesiredConfigJson = configJson;

        try
        {
            await _db.SaveChangesAsync(ct);
            return true;
        }
        catch (DbUpdateConcurrencyException)
        {
            _db.ChangeTracker.Clear();
            return false;
        }
    }
}
