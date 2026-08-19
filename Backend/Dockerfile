# Stage 1: Restore
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS restore
WORKDIR /src

# Copy only project files for layer-cached restore
COPY Backend/Wesal.slnx Backend/
COPY Backend/src/Wesal.API/Wesal.API.csproj Backend/src/Wesal.API/
COPY Backend/src/Wesal.Application/Wesal.Application.csproj Backend/src/Wesal.Application/
COPY Backend/src/Wesal.Domain/Wesal.Domain.csproj Backend/src/Wesal.Domain/
COPY Backend/src/Wesal.Infrastructure/Wesal.Infrastructure.csproj Backend/src/Wesal.Infrastructure/
COPY Backend/src/Wesal.Persistence/Wesal.Persistence.csproj Backend/src/Wesal.Persistence/
COPY Backend/tests/Wesal.Tests/Wesal.Tests.csproj Backend/tests/Wesal.Tests/

RUN dotnet restore Backend/Wesal.slnx

# Stage 2: Build and publish
FROM restore AS build
COPY Backend/ Backend/
RUN dotnet publish Backend/src/Wesal.API/Wesal.API.csproj -c Release -o /app/publish --no-restore

# Stage 3: Runtime
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app

RUN addgroup --system --gid 1001 appgroup \
    && adduser --system --uid 1001 --ingroup appgroup appuser

COPY --from=build /app/publish .

USER appuser

ENV ASPNETCORE_ENVIRONMENT=Production

EXPOSE 10000

ENTRYPOINT ["dotnet", "Wesal.API.dll"]
