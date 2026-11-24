using System.Collections.Concurrent;
using System.Net;
using Polly;
using Polly.CircuitBreaker;
using Polly.Timeout;

namespace Freightline.Rating.Resilience;

public sealed class CarrierPolicyRegistry
{
    private readonly ConcurrentDictionary<string, IAsyncPolicy<HttpResponseMessage>> _policies = new();
    private readonly ILoggerFactory _loggerFactory;

    public CarrierPolicyRegistry(ILoggerFactory loggerFactory) => _loggerFactory = loggerFactory;

    public IAsyncPolicy<HttpResponseMessage> For(string carrier) =>
        _policies.GetOrAdd(carrier, name => Build(name, _loggerFactory.CreateLogger($"CarrierBreaker.{name}")));

    private static IAsyncPolicy<HttpResponseMessage> Build(string carrier, ILogger logger)
    {
        var transient = Policy<HttpResponseMessage>
            .Handle<HttpRequestException>()
            .Or<TimeoutRejectedException>()
            .OrResult(r => (int)r.StatusCode >= 500 || r.StatusCode == HttpStatusCode.RequestTimeout);

        var retry = transient.WaitAndRetryAsync(
            retryCount: 2,
            sleepDurationProvider: attempt => TimeSpan.FromMilliseconds(200 * Math.Pow(2, attempt)));

        var breaker = transient.AdvancedCircuitBreakerAsync(
            failureThreshold: 0.5,
            samplingDuration: TimeSpan.FromSeconds(30),
            minimumThroughput: 10,
            durationOfBreak: TimeSpan.FromSeconds(45),
            onBreak: (outcome, state, delay, _) =>
                logger.LogWarning("Breaker for {Carrier} is {State} for {Delay}s: {Reason}",
                    carrier, state, delay.TotalSeconds, outcome.Exception?.Message ?? outcome.Result?.StatusCode.ToString()),
            onReset: _ => logger.LogInformation("Breaker for {Carrier} closed", carrier),
            onHalfOpen: () => logger.LogInformation("Breaker for {Carrier} is probing", carrier));

        var timeout = Policy.TimeoutAsync<HttpResponseMessage>(TimeSpan.FromSeconds(3));

        return Policy.WrapAsync(retry, breaker, timeout);
    }
}
