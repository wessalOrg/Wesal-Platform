using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using Wesal.Domain.Exceptions;

namespace Wesal.Infrastructure.Middleware;

public class GlobalExceptionHandlingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<GlobalExceptionHandlingMiddleware> _logger;

    public GlobalExceptionHandlingMiddleware(RequestDelegate next, ILogger<GlobalExceptionHandlingMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (Exception exception)
        {
            _logger.LogError(
                exception,
                "An unhandled exception occurred while processing the request {Method} {Path}",
                context.Request.Method,
                context.Request.Path);

            await WriteProblemDetailsAsync(context, exception);
        }
    }

    private static async Task WriteProblemDetailsAsync(HttpContext context, Exception exception)
    {
        var (statusCode, title, code, errors) = exception switch
        {
            ValidationException validation => (
                StatusCodes.Status400BadRequest,
                "Validation failed",
                "ValidationError",
                validation.Errors as IReadOnlyDictionary<string, string[]>),
            NotFoundException => (
                StatusCodes.Status404NotFound,
                "Resource not found",
                "NotFound",
                null),
            ConflictException => (
                StatusCodes.Status409Conflict,
                "A resource conflict occurred",
                "Conflict",
                null),
            BusinessRuleException rule => (
                StatusCodes.Status422UnprocessableEntity,
                rule.Message,
                rule.Code,
                null),
            UnauthorizedException => (
                StatusCodes.Status401Unauthorized,
                "You are not authenticated",
                "Unauthorized",
                null),
            ForbiddenException => (
                StatusCodes.Status403Forbidden,
                "You are not authorized to perform this action",
                "Forbidden",
                null),
            _ => (
                StatusCodes.Status500InternalServerError,
                "An unexpected error occurred",
                "InternalServerError",
                null)
        };

        var problemDetails = errors is null
            ? new ProblemDetails
            {
                Status = statusCode,
                Title = title,
                Type = $"https://httpstatuses.com/{statusCode}",
                Extensions = { ["code"] = code }
            }
            : new ValidationProblemDetails(errors.ToDictionary(error => error.Key, error => error.Value.ToArray()))
            {
                Status = statusCode,
                Title = title,
                Type = $"https://httpstatuses.com/{statusCode}",
                Extensions = { ["code"] = code }
            };

        // Surface the concrete conflict reason (email/phone already exists) to the client.
        if (exception is ConflictException)
        {
            problemDetails.Detail = exception.Message;
        }

        context.Response.StatusCode = statusCode;
        context.Response.ContentType = "application/problem+json";

        await context.Response.WriteAsJsonAsync(problemDetails);
    }
}
