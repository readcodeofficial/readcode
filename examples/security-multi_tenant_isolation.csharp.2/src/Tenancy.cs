using System.Security.Claims;

namespace RideDispatch.Tenancy;

public readonly record struct TenantId(string Value)
{
    public override string ToString() => Value;
}

public interface ITenantContext
{
    TenantId Id { get; }
}

public sealed class TenantContext : ITenantContext
{
    private TenantId? _id;

    public TenantId Id => _id ?? throw new InvalidOperationException("Tenant has not been resolved.");

    public void Set(TenantId id)
    {
        if (_id is not null)
        {
            throw new InvalidOperationException("Tenant is already set for this scope.");
        }
        _id = id;
    }
}

public sealed class TenantResolutionMiddleware
{
    private readonly RequestDelegate _next;

    public TenantResolutionMiddleware(RequestDelegate next) => _next = next;

    public async Task InvokeAsync(HttpContext http, TenantContext tenant)
    {
        var claim = http.User.FindFirstValue("tenant_id");
        if (http.User.Identity?.IsAuthenticated != true || string.IsNullOrWhiteSpace(claim))
        {
            http.Response.StatusCode = StatusCodes.Status401Unauthorized;
            return;
        }

        tenant.Set(new TenantId(claim));
        await _next(http);
    }
}
