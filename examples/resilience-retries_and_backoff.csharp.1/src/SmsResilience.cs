using System.Net;
using Microsoft.Extensions.Logging;
using Polly;
using Polly.Retry;
using Polly.Timeout;

namespace Notifications.Delivery;

public static class SmsResilience
{
    private static readonly TimeSpan MaxRetryAfter = TimeSpan.FromSeconds(10);

    public static bool IsTransient(HttpStatusCode status) =>
        (int)status >= 500 || status is HttpStatusCode.RequestTimeout or HttpStatusCode.TooManyRequests;

    public static ResiliencePipeline<HttpResponseMessage> Create(ILogger logger)
    {
        return new ResiliencePipelineBuilder<HttpResponseMessage>()
            .AddRetry(new RetryStrategyOptions<HttpResponseMessage>
            {
                MaxRetryAttempts = 4,
                BackoffType = DelayBackoffType.Exponential,
                Delay = TimeSpan.FromMilliseconds(400),
                MaxDelay = TimeSpan.FromSeconds(10),
                UseJitter = true,
                ShouldHandle = new PredicateBuilder<HttpResponseMessage>()
                    .Handle<HttpRequestException>()
                    .Handle<TimeoutRejectedException>()
                    .HandleResult(response => IsTransient(response.StatusCode)),
                DelayGenerator = args =>
                {
                    var retryAfter = args.Outcome.Result?.Headers.RetryAfter?.Delta;
                    TimeSpan? delay = retryAfter is { } d
                        ? TimeSpan.FromTicks(Math.Min(d.Ticks, MaxRetryAfter.Ticks))
                        : null;
                    return new ValueTask<TimeSpan?>(delay);
                },
                OnRetry = args =>
                {
                    args.Outcome.Result?.Dispose();
                    logger.LogWarning(
                        args.Outcome.Exception,
                        "SMS gateway attempt {Attempt} failed with {Status}; retrying in {Delay}",
                        args.AttemptNumber + 1,
                        args.Outcome.Result?.StatusCode,
                        args.RetryDelay);
                    return default;
                }
            })
            .AddTimeout(TimeSpan.FromSeconds(3))
            .Build();
    }
}
