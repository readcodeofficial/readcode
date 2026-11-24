using Dapper;
using Npgsql;

namespace TripDesk.Booking;

public sealed record BaseFare(string Currency, decimal Amount);

public interface IFlightInventory
{
    Task<BaseFare?> GetBaseFareAsync(string flightId, CancellationToken ct);
    Task<int> GetRemainingSeatsAsync(string flightId, CancellationToken ct);
}

public sealed class SqlFlightInventory : IFlightInventory
{
    private readonly NpgsqlDataSource _db;

    public SqlFlightInventory(NpgsqlDataSource db) => _db = db;

    public async Task<BaseFare?> GetBaseFareAsync(string flightId, CancellationToken ct)
    {
        await using var conn = await _db.OpenConnectionAsync(ct);
        return await conn.QuerySingleOrDefaultAsync<BaseFare>(new CommandDefinition(
            "SELECT currency, amount FROM flight_fares WHERE flight_id = @flightId",
            new { flightId }, cancellationToken: ct));
    }

    public async Task<int> GetRemainingSeatsAsync(string flightId, CancellationToken ct)
    {
        await using var conn = await _db.OpenConnectionAsync(ct);
        return await conn.ExecuteScalarAsync<int>(new CommandDefinition(
            "SELECT seats_total - seats_sold FROM flights WHERE flight_id = @flightId",
            new { flightId }, cancellationToken: ct));
    }
}

public sealed class RequestAudit
{
    private readonly List<string> _entries = new();
    private readonly ILogger<RequestAudit> _log;

    public RequestAudit(ILogger<RequestAudit> log) => _log = log;

    public void Record(string action, string subject)
    {
        _entries.Add($"{action}:{subject}");
        _log.LogInformation("audit {Action} {Subject} (entry {Count} this request)", action, subject, _entries.Count);
    }
}
