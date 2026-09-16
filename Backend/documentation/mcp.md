# Wesal MCP integration

Wesal exposes a read-only [Model Context Protocol](https://modelcontextprotocol.io/) server alongside the existing ASP.NET Core API. MCP lets an MCP-compatible host discover structured tools and obtain verified Wesal hall data rather than relying on generated claims.

## Architecture

The endpoint is part of `Wesal.API`, rather than a separate service, because the API already owns dependency-injection composition, authentication middleware, logging, and the application-service boundary.

```
MCP host -> POST /mcp -> Wesal MCP tool -> application service -> repository -> EF Core/PostgreSQL
```

Tools never execute SQL. `search_halls` calls `IHallSearchService`, `get_hall_details` calls `IHallDetailsService`, and `check_hall_availability` calls `IHallAvailabilityService`. The availability service is also used by the existing AI assistant, keeping its availability result consistent with MCP.

The endpoint uses the official `ModelContextProtocol.AspNetCore` 2.2.0 package and its Streamable HTTP transport. The package targets .NET 8+ and is compatible with this `net10.0` application. The test project references the same package only to inspect the registered tool metadata.

## Available tools

| Tool | Inputs | Result |
| --- | --- | --- |
| `search_halls` | Optional `name`, `region` (`NorthGaza`, `Gaza`, `MiddleArea`, `SouthGaza`), `area`, ISO date, `bookingPeriod` (`FirstPeriod`/`SecondPeriod`), and `pageSize` (1–20) | Public approved hall listing results and total count. Capacity is intentionally absent because the existing public search service does not support it. |
| `get_hall_details` | `hallId` GUID from `search_halls` | Public listing details, photos, and published availability. |
| `check_hall_availability` | `hallId` GUID and ISO date | Configured booking periods and their current availability statuses. It never creates a booking. |

All tools reject invalid input. Non-existent, deleted, or unapproved halls are not exposed; normal Wesal error handling produces the corresponding error response. Calls are logged without secrets or credentials.

## Authentication and authorization

The initial tool set is guest-safe: it only exposes the same approved-hall information already available from the public REST endpoints. Therefore `/mcp` is intentionally not protected by a JWT policy.

No private booking tool is exposed. In particular, there is no `userId` tool argument and no `get_my_bookings` implementation. The existing AI session is anonymous and the current application layer has no authenticated, user-scoped booking-read query suitable for safely exposing that feature. A future private tool must require the existing JWT policy and derive the user exclusively from `ICurrentUserService`; it must never accept a user ID, owner ID, role, or authorization decision from the model.

## Relationship to the existing AI assistant

The existing assistant endpoint is `POST /api/v1/ai/sessions/{sessionId}/assistant`. It remains unchanged: `AiAssistantController` obtains the anonymous chat session and conversation context, `AiAssistantService` asks `GeminiAiIntentExtractor` for a validated structured intent (with deterministic fallback), and then uses existing platform services to return a typed REST response.

Gemini is currently used for structured intent extraction, not Gemini function calling. As a result, the assistant does **not** make an unnecessary loopback MCP-client request to its own API. It now shares `IHallAvailabilityService` with the MCP server, while its existing search and detail handlers already use the same application-service layer. An external MCP host can use the MCP tools today; adding a true provider tool-calling loop later requires extending the Gemini adapter to send function declarations and map function calls to an MCP client, then generating a second natural-language response.

## Run locally

1. Configure the normal API settings, especially `ConnectionStrings__DefaultConnection`, `Jwt__SecretKey`, and `Cors__AllowedOrigins` outside Development as required by `Program.cs`.
2. Optionally configure `GoogleAI__ApiKey` to enable Gemini intent extraction. MCP tools do not need a Gemini key.
3. Run `dotnet run --project src/Wesal.API`.
4. Connect an MCP client using Streamable HTTP at `http://localhost:5298/mcp` (or the configured `PORT`). Use the MCP client's initialize/tools-list/call flow; this is not a REST controller endpoint.

## Test

Run:

```powershell
dotnet test Wesal.slnx --no-restore
```

`WesalHallMcpToolsShould` verifies that search delegates to the existing public search service, invalid pagination is rejected before a data call, and availability delegates to the shared availability service. The existing AI assistant tests verify that the unchanged assistant continues to return typed hall and availability responses.

## Adding a future tool

Keep a tool read-only by default. Add a clear `[McpServerTool]` description and input descriptions in `WesalHallMcpTools` (or a focused new tool class), delegate to an existing application service, validate all inputs, return only authorized data, and add tests. Do not add direct SQL, arbitrary repository access from a tool, secret-returning tools, or user/ownership parameters that the model could forge.
