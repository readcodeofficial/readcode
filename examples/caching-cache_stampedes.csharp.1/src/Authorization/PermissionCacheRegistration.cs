using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Hybrid;

namespace Iam.Authorization;

public static class PermissionCacheRegistration
{
    public static IServiceCollection AddPermissionCache(this IServiceCollection services, IConfiguration config)
    {
        services.AddStackExchangeRedisCache(o =>
        {
            o.Configuration = config.GetConnectionString("Redis");
            o.InstanceName = "iam:";
        });

        services.AddHybridCache(o =>
        {
            o.MaximumPayloadBytes = 128 * 1024;
            o.MaximumKeyLength = 256;
        });

        services.AddDbContextFactory<IamDbContext>(o => o.UseNpgsql(config.GetConnectionString("Iam")));
        services.AddSingleton<EffectivePermissionService>();
        services.AddSingleton<GrantChangedHandler>();
        return services;
    }
}
