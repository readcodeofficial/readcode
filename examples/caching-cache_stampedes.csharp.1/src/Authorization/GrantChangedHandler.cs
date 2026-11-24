namespace Iam.Authorization;

public sealed record GrantChanged(string TenantId, Guid UserId, long NewVersion);

public sealed class GrantChangedHandler(EffectivePermissionService permissions)
{
    // Runs after the grant transaction has committed, so a reload sees the new rows.
    public async Task HandleAsync(GrantChanged evt, CancellationToken ct)
    {
        await permissions.InvalidateAsync(evt.TenantId, evt.UserId, ct);
    }
}
