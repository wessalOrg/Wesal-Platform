using System.Globalization;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Logging;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Models;
using Wesal.Domain.Enums;
using Wesal.Domain.Exceptions;

namespace Wesal.Infrastructure.AiAssistant;

/// <summary>
/// The single application-level gateway that mediates between a model's tool
/// invocations and Wesal's existing read-only hall services
/// (<see cref="IHallSearchService"/>, <see cref="IHallDetailsService"/>,
/// <see cref="IHallAvailabilityService"/>). It is the ONLY place a tool
/// invocation is turned into application code, and it enforces:
/// <list type="bullet">
/// <item>an allow-list of exactly three stable tool names;</item>
/// <item>strict argument validation (types, lengths, enum members, ISO dates,
/// bounded page size) with safety-normalized error messages;</item>
/// <item>rejection of unknown argument keys;</item>
/// <item>an explicit rejection of any invocation smuggling authentication
/// fragments (userId / ownerId / role / jwt / token / authorization / claims);</item>
/// <item>success payloads that contain only public, safe data — never
/// <c>Status</c>/<c>IsOwner</c> or any owner-scoped field.</item>
/// </list>
/// The gateway mirrors the public MCP tool surface so internal AI tooling and the
/// external MCP server advertise the same capabilities.
/// </summary>
public sealed class WesalToolGateway : IWesalToolGateway
{
    public const int DefaultPageSize = 12;
    public const int MaxPageSize = 20;
    public const int MaxNameLength = 120;
    public const int MaxAreaLength = 80;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
    };

    private static readonly IReadOnlyDictionary<string, WesalToolDefinition> Definitions =
        new Dictionary<string, WesalToolDefinition>(StringComparer.Ordinal)
        {
            [WesalToolNames.SearchHalls] = new(
                WesalToolNames.SearchHalls,
                "Searches the public, approved Wesal wedding halls by optional name, region, area, date and/or booking period. Returns a bounded page of halls with id, name, region, address, description, capacity, price and main image. This is a read-only public search.",
                BuildSearchSchema()),
            [WesalToolNames.GetHallDetails] = new(
                WesalToolNames.GetHallDetails,
                "Returns public details of one approved Wesal hall by its hallId: name, region, address, description, capacity, price, contact phone, photo gallery and the hall's upcoming availability calendar. Read-only public data.",
                BuildDetailsSchema()),
            [WesalToolNames.CheckHallAvailability] = new(
                WesalToolNames.CheckHallAvailability,
                "Returns the booking-period availability (Available or Booked) of one approved Wesal hall on one specific date. Requires hallId and an ISO date (yyyy-MM-dd). Read-only public data.",
                BuildAvailabilitySchema())
        };

    private static readonly HashSet<string> SensitiveArgumentKeys = new(
        ["userid", "ownerid", "role", "jwt", "token", "authorization", "claims"],
        StringComparer.OrdinalIgnoreCase);

    private readonly IHallSearchService _searchService;
    private readonly IHallDetailsService _detailsService;
    private readonly IHallAvailabilityService _availabilityService;
    private readonly ILogger<WesalToolGateway> _logger;

    public WesalToolGateway(
        IHallSearchService searchService,
        IHallDetailsService detailsService,
        IHallAvailabilityService availabilityService,
        ILogger<WesalToolGateway> logger)
    {
        _searchService = searchService;
        _detailsService = detailsService;
        _availabilityService = availabilityService;
        _logger = logger;
    }

    public IReadOnlyList<WesalToolDefinition> ToolDefinitions => Definitions.Values.ToList();

    public bool IsKnownTool(string toolName)
        => !string.IsNullOrWhiteSpace(toolName) && Definitions.ContainsKey(toolName);

    public async Task<WesalToolResult> ExecuteAsync(
        WesalToolInvocation invocation,
        CancellationToken cancellationToken = default)
    {
        var name = invocation.Name?.Trim();
        if (string.IsNullOrWhiteSpace(name) || !Definitions.ContainsKey(name))
        {
            _logger.LogWarning("Rejected tool invocation with unknown tool name.");
            return WesalToolResult.Fail("The requested tool is not a supported Wesal tool.");
        }

        var arguments = invocation.Arguments ?? new JsonObject();
        if (TryStealSensitiveArgument(arguments, out var sensitiveKey))
        {
            _logger.LogWarning("Rejected tool invocation '{ToolName}' that carried authentication material.", name);
            return WesalToolResult.Fail("The request carried authentication material and was rejected.");
        }

        try
        {
            return name switch
            {
                WesalToolNames.SearchHalls => await ExecuteSearchAsync(arguments, cancellationToken),
                WesalToolNames.GetHallDetails => await ExecuteDetailsAsync(arguments, cancellationToken),
                WesalToolNames.CheckHallAvailability => await ExecuteAvailabilityAsync(arguments, cancellationToken),
                _ => WesalToolResult.Fail("The requested tool is not a supported Wesal tool.")
            };
        }
        catch (NotFoundException)
        {
            _logger.LogInformation("Tool '{ToolName}' could not find the requested hall.", name);
            return WesalToolResult.Fail("The requested hall was not found or is not publicly available.");
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Tool '{ToolName}' failed unexpectedly.", name);
            return WesalToolResult.Fail("The tool could not complete your request. Please try again later.");
        }
    }

    private async Task<WesalToolResult> ExecuteSearchAsync(JsonObject args, CancellationToken cancellationToken)
    {
        var allowed = new[] { "name", "region", "area", "date", "bookingPeriod", "pageSize" };
        if (!EnsureOnlyKnownArguments(args, allowed, WesalToolNames.SearchHalls, out var knownError))
            return knownError;

        if (!TryGetOptionalString(args, "name", MaxNameLength, out var name))
            return WesalToolResult.Fail("The 'name' parameter must be text with at most 120 characters.");
        if (!TryGetOptionalString(args, "area", MaxAreaLength, out var area))
            return WesalToolResult.Fail("The 'area' parameter must be text with at most 80 characters.");
        if (!TryGetOptionalEnum<HallRegion>(args, "region", out var region))
            return WesalToolResult.Fail("The 'region' parameter must be one of: NorthGaza, Gaza, MiddleArea, SouthGaza.");
        if (!TryGetOptionalEnum<BookingPeriodType>(args, "bookingPeriod", out var period))
            return WesalToolResult.Fail("The 'bookingPeriod' parameter must be one of: FirstPeriod, SecondPeriod.");
        if (!TryGetOptionalDate(args, "date", out var date))
            return WesalToolResult.Fail("The 'date' parameter must be an ISO date in yyyy-MM-dd format.");
        if (!TryGetPageSize(args, out var pageSize))
            return WesalToolResult.Fail($"The 'pageSize' parameter must be an integer between 1 and {MaxPageSize}.");

        if (name is null && area is null && region is null && date is null && period is null)
        {
            return WesalToolResult.Fail("Provide at least one search criterion: name, region, area, date or bookingPeriod.");
        }

        var request = new HallSearchRequest
        {
            Name = name,
            Region = region,
            Area = area,
            Date = date,
            Period = period,
            PageNumber = 1,
            PageSize = pageSize
        };

        var page = await _searchService.SearchHallsAsync(request, cancellationToken);

        var payload = JsonSerializer.SerializeToNode(new { halls = page.Items, totalCount = page.TotalCount }, JsonOptions)
            as JsonObject ?? new JsonObject();

        return WesalToolResult.Ok(payload);
    }

    private async Task<WesalToolResult> ExecuteDetailsAsync(JsonObject args, CancellationToken cancellationToken)
    {
        var allowed = new[] { "hallId" };
        if (!EnsureOnlyKnownArguments(args, allowed, WesalToolNames.GetHallDetails, out var knownError))
            return knownError;

        if (!TryGetRequiredGuid(args, "hallId", out var hallId))
            return WesalToolResult.Fail("The 'hallId' parameter must be a valid hall identifier.");

        var details = await _detailsService.GetHallDetailsAsync(hallId, cancellationToken);

        if (details is null)
        {
            return WesalToolResult.Fail("The requested hall was not found or is not publicly available.");
        }

        // Public projection only: Status and IsOwner are owner-scoped and never
        // exposed to the model.
        var payload = JsonSerializer.SerializeToNode(new
        {
            hall = new
            {
                hallId = details.HallId,
                hallName = details.HallName,
                region = details.Region,
                address = details.Address,
                description = details.Description,
                capacity = details.Capacity,
                price = details.Price,
                contactPhone = details.ContactPhone,
                photos = details.Photos,
                availability = details.Availability
            }
        }, JsonOptions) as JsonObject ?? new JsonObject();

        return WesalToolResult.Ok(payload);
    }

    private async Task<WesalToolResult> ExecuteAvailabilityAsync(JsonObject args, CancellationToken cancellationToken)
    {
        var allowed = new[] { "hallId", "date" };
        if (!EnsureOnlyKnownArguments(args, allowed, WesalToolNames.CheckHallAvailability, out var knownError))
            return knownError;

        if (!TryGetRequiredGuid(args, "hallId", out var hallId))
            return WesalToolResult.Fail("The 'hallId' parameter must be a valid hall identifier.");
        if (!TryGetRequiredDate(args, "date", out var date))
            return WesalToolResult.Fail("The 'date' parameter must be an ISO date in yyyy-MM-dd format.");

        var availability = await _availabilityService.GetHallAvailabilityAsync(hallId, date, cancellationToken);

        var payload = JsonSerializer.SerializeToNode(new
        {
            hallId,
            date = availability.Date,
            periods = availability.Periods
        }, JsonOptions) as JsonObject ?? new JsonObject();

        return WesalToolResult.Ok(payload);
    }

    private static bool TryStealSensitiveArgument(JsonObject args, out string? key)
    {
        foreach (var property in args)
        {
            if (SensitiveArgumentKeys.Contains(property.Key))
            {
                key = property.Key;
                return true;
            }
        }

        key = null;
        return false;
    }

    private static bool EnsureOnlyKnownArguments(
        JsonObject args,
        IEnumerable<string> allowed,
        string toolName,
        out WesalToolResult error)
    {
        var allowedSet = new HashSet<string>(allowed, StringComparer.Ordinal);
        foreach (var property in args)
        {
            if (!allowedSet.Contains(property.Key))
            {
                error = WesalToolResult.Fail($"The '{toolName}' tool does not accept the parameter '{property.Key}'.");
                return false;
            }
        }

        error = null!;
        return true;
    }

    private static bool TryGetOptionalString(JsonObject args, string key, int maxLength, out string? value)
    {
        value = null;
        if (!args.TryGetPropertyValue(key, out var node) || node is null)
            return true;

        if (node is JsonValue jsonValue && jsonValue.TryGetValue<string>(out var raw))
        {
            var trimmed = raw?.Trim() ?? string.Empty;
            if (trimmed.Length > maxLength)
                return false;
            value = trimmed.Length == 0 ? null : trimmed;
            return true;
        }

        return false;
    }

    private static bool TryGetOptionalEnum<T>(JsonObject args, string key, out T? value) where T : struct, Enum
    {
        value = null;
        if (!args.TryGetPropertyValue(key, out var node) || node is null)
            return true;

        if (node is JsonValue jsonValue && jsonValue.TryGetValue<string>(out var raw)
            && Enum.TryParse<T>(raw, ignoreCase: true, out var parsed)
            && Enum.IsDefined(parsed))
        {
            value = parsed;
            return true;
        }

        return false;
    }

    private static bool TryGetOptionalDate(JsonObject args, string key, out DateOnly? value)
    {
        value = null;
        if (!args.TryGetPropertyValue(key, out var node) || node is null)
            return true;

        if (node is JsonValue jsonValue && jsonValue.TryGetValue<string>(out var raw)
            && DateOnly.TryParseExact(raw, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var parsed))
        {
            value = parsed;
            return true;
        }

        return false;
    }

    private static bool TryGetRequiredGuid(JsonObject args, string key, out Guid value)
    {
        value = Guid.Empty;
        if (!args.TryGetPropertyValue(key, out var node) || node is null)
            return false;

        if (node is JsonValue jsonValue && jsonValue.TryGetValue<string>(out var raw)
            && Guid.TryParse(raw, out var parsed))
        {
            value = parsed;
            return true;
        }

        return false;
    }

    private static bool TryGetRequiredDate(JsonObject args, string key, out DateOnly value)
    {
        value = default;
        if (!args.TryGetPropertyValue(key, out var node) || node is null)
            return false;

        if (node is JsonValue jsonValue && jsonValue.TryGetValue<string>(out var raw)
            && DateOnly.TryParseExact(raw, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var parsed))
        {
            value = parsed;
            return true;
        }

        return false;
    }

    private static bool TryGetPageSize(JsonObject args, out int value)
    {
        value = DefaultPageSize;
        if (!args.TryGetPropertyValue("pageSize", out var node) || node is null)
            return true;

        if (node is JsonValue jsonValue && jsonValue.TryGetValue<int>(out var parsed)
            && parsed >= 1 && parsed <= MaxPageSize)
        {
            value = parsed;
            return true;
        }

        return false;
    }

    private static JsonObject BuildSearchSchema() => new()
    {
        ["type"] = "object",
        ["properties"] = new JsonObject
        {
            ["name"] = new JsonObject { ["type"] = "string", ["description"] = "Hall name (partial match)." },
            ["region"] = new JsonObject
            {
                ["type"] = "string",
                ["enum"] = new JsonArray("NorthGaza", "Gaza", "MiddleArea", "SouthGaza"),
                ["description"] = "Hall region."
            },
            ["area"] = new JsonObject { ["type"] = "string", ["description"] = "Hall area/locality (partial match)." },
            ["date"] = new JsonObject { ["type"] = "string", ["format"] = "date", ["description"] = "Event date, ISO yyyy-MM-dd. Use it only when the user gave a real date." },
            ["bookingPeriod"] = new JsonObject
            {
                ["type"] = "string",
                ["enum"] = new JsonArray("FirstPeriod", "SecondPeriod"),
                ["description"] = "Morning (FirstPeriod) or evening (SecondPeriod) booking period."
            },
            ["pageSize"] = new JsonObject
            {
                ["type"] = "integer",
                ["minimum"] = 1,
                ["maximum"] = MaxPageSize,
                ["description"] = $"Results per page (default {DefaultPageSize})."
            }
        }
    };

    private static JsonObject BuildDetailsSchema() => new()
    {
        ["type"] = "object",
        ["properties"] = new JsonObject
        {
            ["hallId"] = new JsonObject
            {
                ["type"] = "string",
                ["format"] = "uuid",
                ["description"] = "The hall identifier obtained from search_halls or the details page."
            }
        },
        ["required"] = new JsonArray("hallId")
    };

    private static JsonObject BuildAvailabilitySchema() => new()
    {
        ["type"] = "object",
        ["properties"] = new JsonObject
        {
            ["hallId"] = new JsonObject
            {
                ["type"] = "string",
                ["format"] = "uuid",
                ["description"] = "The hall identifier obtained from search_halls or the details page."
            },
            ["date"] = new JsonObject
            {
                ["type"] = "string",
                ["format"] = "date",
                ["description"] = "The date to check, ISO yyyy-MM-dd."
            }
        },
        ["required"] = new JsonArray("hallId", "date")
    };
}