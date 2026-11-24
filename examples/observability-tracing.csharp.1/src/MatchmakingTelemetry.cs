using System.Diagnostics;
using OpenTelemetry;
using OpenTelemetry.Context.Propagation;

namespace Arcadia.Matchmaking;

public static class MatchmakingTelemetry
{
    public const string SourceName = "Arcadia.Matchmaking";

    public static readonly ActivitySource Source = new(SourceName);

    private static readonly TextMapPropagator Propagator = Propagators.DefaultTextMapPropagator;

    public static void Inject(Activity? activity, IDictionary<string, string> headers)
    {
        if (activity is null)
        {
            return;
        }

        Propagator.Inject(
            new PropagationContext(activity.Context, Baggage.Current),
            headers,
            static (carrier, key, value) => carrier[key] = value);
    }

    public static PropagationContext Extract(IReadOnlyDictionary<string, string> headers)
    {
        return Propagator.Extract(
            default,
            headers,
            static (carrier, key) =>
                carrier.TryGetValue(key, out var value) ? new[] { value } : Array.Empty<string>());
    }
}
