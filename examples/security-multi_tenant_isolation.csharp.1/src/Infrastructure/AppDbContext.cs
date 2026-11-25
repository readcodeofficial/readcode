using Microsoft.EntityFrameworkCore;
using Shop.Orders.Domain;

namespace Shop.Orders.Infrastructure;

public class AppDbContext : DbContext
{
    private readonly ITenantProvider _tenant;

    public AppDbContext(DbContextOptions<AppDbContext> options, ITenantProvider tenant)
        : base(options)
    {
        _tenant = tenant;
    }

    public DbSet<Product> Products => Set<Product>();
    public DbSet<Order> Orders => Set<Order>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Product>(b =>
        {
            b.HasIndex(p => new { p.TenantId, p.Sku }).IsUnique();
            b.HasQueryFilter(p => p.TenantId == _tenant.TenantId && !p.IsArchived);
        });

        modelBuilder.Entity<Order>(b =>
        {
            b.HasIndex(o => new { o.TenantId, o.Number }).IsUnique();
            b.HasQueryFilter(o => o.TenantId == _tenant.TenantId);
        });
    }

    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        foreach (var entry in ChangeTracker.Entries<ITenantOwned>())
        {
            switch (entry.State)
            {
                case EntityState.Added:
                    entry.Entity.TenantId = _tenant.TenantId;
                    break;
                case EntityState.Modified when entry.Property(e => e.TenantId).IsModified:
                    throw new InvalidOperationException("TenantId cannot be changed.");
            }
        }
        return base.SaveChangesAsync(cancellationToken);
    }
}
