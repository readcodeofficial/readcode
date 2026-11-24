using System.ComponentModel.DataAnnotations;

namespace BuildHub.Api.Validation;

public sealed record ValidationFailure(string Field, string Message);

public static class RequestValidator
{
    private const int MaxVariableValueLength = 4096;

    public static IReadOnlyList<ValidationFailure> Validate<T>(T request) where T : class
    {
        var failures = new List<ValidationFailure>();
        var results = new List<ValidationResult>();
        var context = new ValidationContext(request);

        if (!Validator.TryValidateObject(request, context, results))
        {
            foreach (var result in results)
            {
                var fields = result.MemberNames.Any() ? result.MemberNames : new[] { "" };
                foreach (var field in fields)
                {
                    failures.Add(new ValidationFailure(field, result.ErrorMessage ?? "Invalid value."));
                }
            }
        }

        return failures;
    }

    public static IEnumerable<ValidationFailure> ValidateVariables(IDictionary<string, string> variables)
    {
        foreach (var (key, value) in variables)
        {
            if (!IsValidVariableName(key))
            {
                yield return new ValidationFailure($"variables.{key}", "Variable names must be UPPER_SNAKE_CASE.");
            }

            if (value.Length > MaxVariableValueLength)
            {
                yield return new ValidationFailure($"variables.{key}", "Variable value is too long.");
            }
        }
    }

    private static bool IsValidVariableName(string name) =>
        name.Length is > 0 and <= 64
        && name.All(c => c is (>= 'A' and <= 'Z') or (>= '0' and <= '9') or '_')
        && !char.IsDigit(name[0]);
}
