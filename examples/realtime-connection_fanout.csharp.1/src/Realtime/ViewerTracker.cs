using System.Collections.Concurrent;

namespace Feedly.Realtime;

public sealed class ViewerTracker
{
    private readonly ConcurrentDictionary<string, int> _viewers = new();

    public void Increment(string authorId)
    {
        _viewers[authorId] = _viewers.GetValueOrDefault(authorId) + 1;
    }

    public void Decrement(string authorId)
    {
        _viewers.AddOrUpdate(authorId, 0, (_, current) => Math.Max(0, current - 1));
    }

    public bool HasViewers(string authorId) => _viewers.GetValueOrDefault(authorId) > 0;
}
