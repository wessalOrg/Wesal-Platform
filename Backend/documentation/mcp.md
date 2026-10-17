# Wesal MCP integration

Wesal exposes a read-only [Model Context Protocol](https://modelcontextprotocol.io/) server alongside the existing ASP.NET Core API. MCP lets an MCP-compatible host discover structured tools and obtain verified Wesal hall data rather than relying on generated claims.

## Architecture

The endpoint is part of `Wesal.API`, rather than a separate service, because the API already owns dependency-injection composition, authentication middleware, logging, and the application-service boundary.

```
MCP host -> POST /mcp -> Wesal MCP tool -> application service -> repository -> EF Core/PostgreSQL
```

Tools never execute SQL. `search_halls` calls `IHallSearchService`, `get_hall_details` calls `IHallDetailsService`, and `check_hall_availability` calls `IHourlySlotService`. These are the same application services used by the assistant, so both transports share Wesal's data and availability rules.

The endpoint uses the official `ModelContextProtocol.AspNetCore` 2.2.0 package and its Streamable HTTP transport. The package targets .NET 8+ and is compatible with this `net10.0` application. The test project references the same package only to inspect the registered tool metadata.

## Available tools

| Tool | Inputs | Result |
| --- | --- | --- |
| `search_halls` | Optional `name`, `region` (`NorthGaza`, `Gaza`, `MiddleArea`, `SouthGaza`), `area`, ISO date, hourly `startTime` (`HH:mm`), and `pageSize` (1–20) | Public approved hall listing results and total count. Capacity is not part of the external MCP schema. |
| `get_hall_details` | `hallId` GUID from `search_halls` | Public listing details, photos, and published availability. |
| `check_hall_availability` | `hallId` GUID and ISO date | Hourly slots and their current availability statuses. It never creates a booking. |

All tools reject invalid input. Non-existent, deleted, or unapproved halls are not exposed; normal Wesal error handling produces the corresponding error response. Calls are logged without secrets or credentials.

## Authentication and authorization

The initial tool set is guest-safe: it only exposes the same approved-hall information already available from the public REST endpoints. Therefore `/mcp` is intentionally not protected by a JWT policy.

No private booking tool is exposed. In particular, there is no `userId` tool argument and no `get_my_bookings` implementation. The existing AI session is anonymous and the current application layer has no authenticated, user-scoped booking-read query suitable for safely exposing that feature. A future private tool must require the existing JWT policy and derive the user exclusively from `ICurrentUserService`; it must never accept a user ID, owner ID, role, or authorization decision from the model.

## Relationship to the existing AI assistant

The assistant endpoint is `POST /api/v1/ai/sessions/{sessionId}/assistant`. Its current path is:

```text
frontend session -> AiAssistantController -> ChatSessionService -> AiAssistantService
  -> validated page/pinned-hall context -> policy and live-hall fast paths
  -> GeminiToolOrchestrator -> read-only WesalToolGateway -> application services
  -> typed response, or deterministic fallback
```

`GeminiService` now uses the official Google Gen AI .NET SDK behind the existing application interface. The assistant makes provider function calls through `GeminiToolOrchestrator`; it does not call the local MCP endpoint. The gateway exposes exactly three public read-only functions (`search_halls`, `get_hall_details`, and `check_hall_availability`) and validates names and arguments before delegating to current Wesal services. Its `search_halls` tool also supports `minCapacity`, now applied by the shared application search request and repository before pagination. This assistant-specific function schema is distinct from the public MCP schema above.

Static answers use the embedded bilingual Knowledge Base. Authenticated conversation state is stored in the dedicated `AiConversationSessions` table with a 30-minute sliding expiry, bounded history and owner checks; it is separate from authentication `AISessions`. Guest memory is keyed only by its random session id and expires on the same schedule. Provider failure, timeout, or an unavailable model falls through to deterministic handling without a second model call.

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
