using Microsoft.EntityFrameworkCore;

namespace Telemetry.Shadows;

public class ShadowDbContext : DbContext
{
    public ShadowDbContext(DbContextOptions<ShadowDbContext> options) : base(options)
    {
    }

    public DbSet<DeviceShadow> Shadows => Set<DeviceShadow>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<DeviceShadow>(b =>
        {
            b.ToTable("device_shadows");
            b.HasKey(s => s.DeviceId);
            b.Property(s => s.FirmwareVersion).HasMaxLength(32);
            b.Property(s => s.DesiredConfigJson).HasColumnType("jsonb");
            b.Property(s => s.RowVersion).IsRowVersion();
        });
    }
}
