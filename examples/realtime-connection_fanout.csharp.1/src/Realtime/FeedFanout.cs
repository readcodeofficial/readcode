using System.Threading.Channels;
using Microsoft.AspNetCore.SignalR;

namespace Feedly.Realtime;

public sealed record PostPublished(string PostId, string AuthorId, string Body, DateTimeOffset At);

public interface IPostEvents
{
    bool Publish(PostPublished post);
}

public sealed class FeedFanout : BackgroundService, IPostEvents
{
    private readonly Channel<PostPublished> _queue = Channel.CreateBounded<PostPublished>(
        new BoundedChannelOptions(10_000)
        {
            FullMode = BoundedChannelFullMode.DropOldest,
            SingleReader = true,
        });

    private readonly IHubContext<FeedHub> _hub;
    private readonly ViewerTracker _viewers;
    private readonly ILogger<FeedFanout> _log;

    public FeedFanout(IHubContext<FeedHub> hub, ViewerTracker viewers, ILogger<FeedFanout> log)
    {
        _hub = hub;
        _viewers = viewers;
        _log = log;
    }

    public bool Publish(PostPublished post) => _queue.Writer.TryWrite(post);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await foreach (var post in _queue.Reader.ReadAllAsync(stoppingToken))
        {
            if (!_viewers.HasViewers(post.AuthorId))
            {
                continue;
            }

            try
            {
                await _hub.Clients.Group(FeedHub.GroupFor(post.AuthorId))
                    .SendAsync("postPublished", post, stoppingToken);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                _log.LogWarning(ex, "Fanout failed for post {PostId} by {AuthorId}", post.PostId, post.AuthorId);
            }
        }
    }
}

public static class FeedRealtimeExtensions
{
    public static IServiceCollection AddFeedRealtime(this IServiceCollection services)
    {
        services.AddSignalR();
        services.AddSingleton<ViewerTracker>();
        services.AddSingleton<FeedFanout>();
        services.AddSingleton<IPostEvents>(sp => sp.GetRequiredService<FeedFanout>());
        services.AddHostedService(sp => sp.GetRequiredService<FeedFanout>());
        return services;
    }
}
