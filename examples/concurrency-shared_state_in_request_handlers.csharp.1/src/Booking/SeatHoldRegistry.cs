namespace TripDesk.Booking;

public sealed class SeatHoldRegistry
{
    private static readonly TimeSpan HoldTtl = TimeSpan.FromMinutes(10);

    private readonly object _gate = new();
    private readonly Dictionary<string, int> _heldByFlight = new();
    private readonly Dictionary<Guid, SeatHold> _holds = new();
    private readonly TimeProvider _clock;

    public SeatHoldRegistry(TimeProvider clock) => _clock = clock;

    public bool TryHold(string flightId, int seats, int remainingInDb, out Guid holdId)
    {
        lock (_gate)
        {
            SweepExpired();

            _heldByFlight.TryGetValue(flightId, out var held);
            if (held + seats > remainingInDb)
            {
                holdId = Guid.Empty;
                return false;
            }

            holdId = Guid.NewGuid();
            _heldByFlight[flightId] = held + seats;
            _holds[holdId] = new SeatHold(flightId, seats, _clock.GetUtcNow() + HoldTtl);
            return true;
        }
    }

    public bool Release(Guid holdId)
    {
        if (!_holds.Remove(holdId, out var hold))
            return false;

        lock (_gate)
        {
            _heldByFlight[hold.FlightId] -= hold.Seats;
        }
        return true;
    }

    private void SweepExpired()
    {
        var now = _clock.GetUtcNow();
        var expired = _holds.Where(h => h.Value.ExpiresAt <= now).Select(h => h.Key).ToList();
        foreach (var id in expired)
        {
            var hold = _holds[id];
            _heldByFlight[hold.FlightId] -= hold.Seats;
            _holds.Remove(id);
        }
    }

    private sealed record SeatHold(string FlightId, int Seats, DateTimeOffset ExpiresAt);
}
