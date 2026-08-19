# Stage 1: Restore
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS restore
WORKDIR /src

# Build context is Backend/ (Render Root Directory = Backend)
# COPY paths are relative to the build context
COPY Wesal.slnx .
COPY src/Wesal.API/Wesal.API.csproj src/Wesal.API/
COPY src/Wesal.Application/Wesal.Application.csproj src/Wesal.Application/
COPY src/Wesal.Domain/Wesal.Domain.csproj src/Wesal.Domain/
COPY src/Wesal.Infrastructure/Wesal.Infrastructure.csproj src/Wesal.Infrastructure/
COPY src/Wesal.Persistence/Wesal.Persistence.csproj src/Wesal.Persistence/
COPY tests/Wesal.Tests/Wesal.Tests.csproj tests/Wesal.Tests/

RUN dotnet restore Wesal.slnx

# Stage 2: Build and publish
FROM restore AS build
COPY . .
RUN dotnet publish src/Wesal.API/Wesal.API.csproj -c Release -o /app/publish --no-restore

# Stage 3: Runtime
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app

RUN groupadd --system --gid 1001 appgroup \
    && useradd --system --uid 1001 --gid appgroup --no-create-home appuser

COPY --from=build /app/publish .

USER appuser

ENV ASPNETCORE_ENVIRONMENT=Production

EXPOSE 10000

ENTRYPOINT ["dotnet", "Wesal.API.dll"]
