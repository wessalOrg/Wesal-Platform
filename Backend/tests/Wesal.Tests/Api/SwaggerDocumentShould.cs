using System.Reflection;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Controllers;
using Microsoft.AspNetCore.Mvc.Infrastructure;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.OpenApi;
using Microsoft.OpenApi.Models;
using Swashbuckle.AspNetCore.Swagger;
using Wesal.API.Controllers;
using Wesal.API.Swagger;

namespace Wesal.Tests.Api;

/// <summary>
/// Guards the published OpenAPI document.
/// <para>
/// Swashbuckle aborts the whole document on the first action it cannot read, so three upload
/// endpoints that carried <c>[FromForm]</c> on an <see cref="IFormFile"/> parameter made
/// <c>/swagger/v1/swagger.json</c> answer 500 and hid the entire API from anyone reading the docs.
/// These tests build the document through <see cref="SwaggerConfiguration"/> — the same setup the
/// application uses — so a regression fails the build instead of production.
/// </para>
/// </summary>
public class SwaggerDocumentShould
{
    private const string AttachmentPath = "/api/v{version}/conversations/{conversationId}/messages/attachment";
    private const string CreateHallPath = "/api/v{version}/owner/halls";
    private const string IdentityDocumentPath = "/api/v{version}/owner/profile/identity-document";
    private const string ConfirmBookingPaymentPath = "/api/v{version}/halls/{hallId}/bookings/{bookingId}/payment/confirmed";

    /// <summary>
    /// Total operations' paths. Guards against the document silently losing endpoints, and
    /// pins the count so a new operation is a deliberate edit rather than a surprise.
    /// 61 includes WESAL-TASK-8's owner deposit-confirmation endpoint.
    /// </summary>
    private const int ExpectedPathCount = 61;

    [Fact]
    public void OpenApiDocument_GeneratesWithoutThrowing()
    {
        // The regression itself: before the fix this threw SwaggerGeneratorException, which the
        // swagger JSON endpoint surfaced as HTTP 500.
        var document = BuildDocument();

        Assert.Equal(ExpectedPathCount, document.Paths.Count);
    }

    [Fact]
    public void EveryUploadEndpoint_IsPresentInTheDocument()
    {
        // Proves the document is not silently truncated: the endpoints that used to break
        // generation are described, along with the rest of the API.
        var document = BuildDocument();

        Assert.Contains(AttachmentPath, document.Paths.Keys);
        Assert.Contains(CreateHallPath, document.Paths.Keys);
        Assert.Contains(IdentityDocumentPath, document.Paths.Keys);
    }

    [Fact]
    public void ConfirmBookingPaymentEndpoint_IsDocumented()
    {
        // WESAL-TASK-8 (Edit 8): the owner-facing payment confirmation is the step that
        // officially books a hall, so it has to be visible in the published API surface.
        var document = BuildDocument();

        Assert.Contains(ConfirmBookingPaymentPath, document.Paths.Keys);
    }

    [Fact]
    public void NoFileParameter_IsBoundAsAPlainFormField()
    {
        // Guards the root cause. [FromForm] on an IFormFile overwrites the inferred form-file
        // binding source, ApiExplorer then misreports the parameter, and document generation
        // fails for the whole API rather than for one endpoint.
        var builder = BuildHost();
        var fileParameters = builder.Services
            .GetRequiredService<IActionDescriptorCollectionProvider>()
            .ActionDescriptors.Items
            .OfType<ControllerActionDescriptor>()
            .SelectMany(action => action.MethodInfo.GetParameters())
            .Where(parameter => typeof(IFormFile).IsAssignableFrom(parameter.ParameterType)
                                || (parameter.ParameterType.IsArray
                                    && parameter.ParameterType.GetElementType() == typeof(IFormFile)))
            .ToList();

        Assert.NotEmpty(fileParameters);
        Assert.All(fileParameters, parameter =>
            Assert.Null(parameter.GetCustomAttribute<FromFormAttribute>()));
    }

    [Fact]
    public void MessageAttachment_IsDocumentedAsMultipartFormData()
    {
        var schema = FormSchemaFor(AttachmentPath);

        // The file is binary and the caption is a plain form field, so a generated client can
        // actually call the endpoint.
        Assert.Equal("string", schema.Properties["file"].Type);
        Assert.Equal("binary", schema.Properties["file"].Format);
        Assert.Equal("string", schema.Properties["content"].Type);
        Assert.Contains("clientRequestId", schema.Properties.Keys);
    }

    [Fact]
    public void IdentityDocument_IsDocumentedAsMultipartFormData()
    {
        var schema = FormSchemaFor(IdentityDocumentPath);

        Assert.Equal("string", schema.Properties["file"].Type);
        Assert.Equal("binary", schema.Properties["file"].Format);
    }

    [Fact]
    public void CreateHall_DocumentsItsPhotoCollectionAsBinaryItems()
    {
        // Hall creation posts a main photo plus a photo collection, so the document has to
        // handle IFormFile[] and not only a single IFormFile.
        var schema = FormSchemaFor(CreateHallPath);

        Assert.Equal("string", schema.Properties["MainPhoto"].Type);
        Assert.Equal("binary", schema.Properties["MainPhoto"].Format);
        Assert.Equal("array", schema.Properties["Photos"].Type);
        Assert.Equal("string", schema.Properties["Photos"].Items.Type);
        Assert.Equal("binary", schema.Properties["Photos"].Items.Format);
    }

    [Fact]
    public void FormFields_AreNotAlsoListedAsQueryParameters()
    {
        // A field that is both a body property and a query parameter produces a client that
        // sends it twice.
        var operation = OperationFor(AttachmentPath, OperationType.Post);

        var names = operation.Parameters?.Select(p => p.Name).ToHashSet(StringComparer.OrdinalIgnoreCase)
                    ?? new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        Assert.DoesNotContain("file", names);
        Assert.DoesNotContain("content", names);
        // The route parameter is still documented, so the document is not over-eager.
        Assert.Contains("conversationId", names);
    }

    [Fact]
    public void NonFormEndpoints_KeepTheirDocumentedQueryParameters()
    {
        // The fix must not disturb an ordinary query endpoint: it keeps its parameters and gains
        // no request body.
        var operation = OperationFor("/api/v{version}/halls/search");

        Assert.Null(operation.RequestBody);
        var names = operation.Parameters!.Select(p => p.Name).ToList();
        Assert.Contains("name", names);
        Assert.Contains("region", names);
        Assert.Contains("area", names);
        // The location filter added for the Frontend team is documented too.
        Assert.Contains("detailedAddress", names);
    }

    private static OpenApiSchema FormSchemaFor(string path)
    {
        var operation = OperationFor(path, OperationType.Post);

        Assert.NotNull(operation.RequestBody);
        var media = Assert.Single(operation.RequestBody.Content);
        Assert.Equal("multipart/form-data", media.Key);
        Assert.Equal("object", media.Value.Schema.Type);
        return media.Value.Schema;
    }

    private static OpenApiOperation OperationFor(string path, OperationType verb = OperationType.Get)
    {
        var document = BuildDocument();

        Assert.True(document.Paths.ContainsKey(path), $"Expected the document to contain {path}.");
        var operations = document.Paths[path].Operations;
        Assert.True(operations.ContainsKey(verb), $"Expected {path} to document a {verb} operation.");
        return operations[verb];
    }

    private static OpenApiDocument BuildDocument()
    {
        var app = BuildHost();

        return app.Services.GetRequiredService<ISwaggerProvider>()
            .GetSwagger(SwaggerConfiguration.DocumentName);
    }

    private static WebApplication BuildHost()
    {
        var builder = WebApplication.CreateBuilder();

        builder.Services
            .AddControllers()
            .AddApplicationPart(typeof(HallsController).Assembly);
        builder.Services.AddEndpointsApiExplorer();
        builder.Services.AddWesalSwagger();

        return builder.Build();
    }
}
