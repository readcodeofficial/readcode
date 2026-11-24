using System.ComponentModel.DataAnnotations;

namespace Telemetry.Shadows;

public class DeviceShadow
{
    public Guid DeviceId { get; set; }

    public string FirmwareVersion { get; set; } = "";

    public string DesiredConfigJson { get; set; } = "{}";

    public long ReportCount { get; set; }

    public double LastTemperatureC { get; set; }

    public DateTimeOffset LastSeenAt { get; set; }

    [Timestamp]
    public byte[] RowVersion { get; set; } = Array.Empty<byte>();
}

public record DeviceReport(Guid DeviceId, string FirmwareVersion, double TemperatureC, DateTimeOffset ObservedAt);
