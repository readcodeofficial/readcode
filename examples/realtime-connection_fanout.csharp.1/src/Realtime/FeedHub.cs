using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace Feedly.Realtime;

[Authorize]
public sealed class FeedHub : Hub
{
    private const string SubscriptionsKey = "subscriptions";
    private const int MaxSubscriptionsPerConnection = 200;

    private readonly ViewerTracker _viewers;

    public FeedHub(ViewerTracker viewers) => _viewers = viewers;

    public static string GroupFor(string authorId) => $"author:{authorId}";

    public async Task Subscribe(string authorId)
    {
        var subscriptions = SubscriptionsOf(Context);
        if (subscriptions.Count >= MaxSubscriptionsPerConnection)
        {
            throw new HubException("Too many subscriptions on this connection.");
        }
        if (!subscriptions.Add(authorId))
        {
            return;
        }

        await Groups.AddToGroupAsync(Context.ConnectionId, GroupFor(authorId));
        _viewers.Increment(authorId);
    }

    public async Task Unsubscribe(string authorId)
    {
        if (!SubscriptionsOf(Context).Remove(authorId))
        {
            return;
        }

        await Groups.RemoveFromGroupAsync(Context.ConnectionId, GroupFor(authorId));
        _viewers.Decrement(authorId);
    }

    public override Task OnDisconnectedAsync(Exception? exception)
    {
        foreach (var authorId in SubscriptionsOf(Context))
        {
            _viewers.Decrement(authorId);
        }
        return base.OnDisconnectedAsync(exception);
    }

    private static HashSet<string> SubscriptionsOf(HubCallerContext context)
    {
        if (!context.Items.TryGetValue(SubscriptionsKey, out var existing))
        {
            existing = new HashSet<string>();
            context.Items[SubscriptionsKey] = existing;
        }
        return (HashSet<string>)existing!;
    }
}
