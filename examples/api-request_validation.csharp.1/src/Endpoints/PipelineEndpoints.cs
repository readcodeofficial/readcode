using BuildHub.Api.Models;
using BuildHub.Api.Validation;

namespace BuildHub.Api.Endpoints;

public static class PipelineEndpoints
{
    public static void MapPipelineEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapPost("/v1/pipelines", TriggerAsync);
    }

    private static async Task<IResult> TriggerAsync(
        TriggerPipelineRequest? request,
        IProjectCatalog projects,
        IPipelineQueue queue,
        CancellationToken ct)
    {
        if (request is null)
        {
            return Results.BadRequest(new { error = "A JSON body is required." });
        }

        var failures = RequestValidator.Validate(request)
            .Concat(RequestValidator.ValidateVariables(request.Variables))
            .ToList();

        if (failures.Count > 0)
        {
            return Results.ValidationProblem(
                failures.GroupBy(f => f.Field)
                        .ToDictionary(g => g.Key, g => g.Select(f => f.Message).ToArray()));
        }

        var project = await projects.FindAsync(request.ProjectSlug!, ct);
        if (project is null)
        {
            return Results.NotFound(new { error = "Unknown project." });
        }

        if (request.Parallelism > project.MaxParallelism)
        {
            return Results.UnprocessableEntity(new { error = "Parallelism exceeds the project limit." });
        }

        var run = new PipelineRun(Guid.NewGuid(), project.Slug, request.Ref!.Trim(), DateTimeOffset.UtcNow);
        await queue.EnqueueAsync(run, request.TimeoutMinutes, request.Parallelism, request.Variables, ct);

        return Results.Accepted($"/v1/pipelines/{run.Id}", run);
    }
}

public sealed record Project(string Slug, int MaxParallelism);

public interface IProjectCatalog
{
    Task<Project?> FindAsync(string slug, CancellationToken ct);
}

public interface IPipelineQueue
{
    Task EnqueueAsync(PipelineRun run, int timeoutMinutes, int parallelism,
        IReadOnlyDictionary<string, string> variables, CancellationToken ct);
}
