using System.Security.Claims;

namespace Shop.Orders.Infrastructure;

public interface ITenantProvider
{
    Guid TenantId { get; }
}

public sealed class ClaimsTenantProvider(IHttpContextAccessor accessor) : ITenantProvider
{
    public Guid TenantId
    {
        get
        {
            var value = accessor.HttpContext?.User.FindFirstValue("tid");
            if (!Guid.TryParse(value, out var tenantId))
            {
                throw new UnauthorizedAccessException("Request has no tenant claim.");
            }
            return tenantId;
        }
    }
}
