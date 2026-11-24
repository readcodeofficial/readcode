using System.ComponentModel.DataAnnotations;

namespace BuildHub.Api.Models;

public sealed class TriggerPipelineRequest
{
    [Required]
    [RegularExpression(@"^[a-z0-9][a-z0-9-]{1,62}$")]
    public string? ProjectSlug { get; init; }

    [Required]
    [StringLength(200, MinimumLength = 1)]
    public string? Ref { get; init; }

    [Range(1, 360)]
    public int TimeoutMinutes { get; init; } = 60;

    [Range(1, 8)]
    public int Parallelism { get; init; } = 1;

    [MaxLength(50)]
    public Dictionary<string, string> Variables { get; init; } = new();

    public bool Debug { get; init; }
}

public sealed record PipelineRun(Guid Id, string ProjectSlug, string Ref, DateTimeOffset QueuedAt);
