using Dapper;
using Npgsql;

namespace Freightline.Tracking;

public sealed record ScanEvent(string ScanId, string ShipmentId, string Facility, string Status, DateTimeOffset ScannedAt);

public sealed class TransientStoreException : Exception
{
    public TransientStoreException(string message, Exception inner) : base(message, inner) { }
}

public interface ITrackingStore
{
    Task RecordScanAsync(ScanEvent evt, CancellationToken ct);
}

public sealed class TrackingStore : ITrackingStore
{
    private readonly NpgsqlDataSource _db;

    public TrackingStore(NpgsqlDataSource db) => _db = db;

    public async Task RecordScanAsync(ScanEvent evt, CancellationToken ct)
    {
        try
        {
            await using var conn = await _db.OpenConnectionAsync(ct);
            await using var tx = await conn.BeginTransactionAsync(ct);

            var inserted = await conn.ExecuteAsync(new CommandDefinition(
                @"INSERT INTO scan_events (scan_id, shipment_id, facility, status, scanned_at)
                  VALUES (@ScanId, @ShipmentId, @Facility, @Status, @ScannedAt)
                  ON CONFLICT (scan_id) DO NOTHING",
                evt, tx, cancellationToken: ct));

            if (inserted == 1)
            {
                await conn.ExecuteAsync(new CommandDefinition(
                    @"UPDATE shipments
                         SET status = @Status, last_facility = @Facility, last_scan_at = @ScannedAt
                       WHERE id = @ShipmentId
                         AND (last_scan_at IS NULL OR last_scan_at < @ScannedAt)",
                    evt, tx, cancellationToken: ct));
            }

            await tx.CommitAsync(ct);
        }
        catch (NpgsqlException ex) when (ex.IsTransient)
        {
            throw new TransientStoreException($"Could not record scan {evt.ScanId}", ex);
        }
    }
}
