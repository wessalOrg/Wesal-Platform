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
    private const string AcceptBookingPath = "/api/v{version}/halls/{hallId}/bookings/{bookingId}/accept";
    private const string ConfirmBookingPaymentPath = "/api/v{version}/halls/{hallId}/bookings/{bookingId}/payment/confirmed";
    private const string ContactAdminPath = "/api/v{version}/halls/{hallId}/conversations/contact-admin";
    private const string AdminOwnerConversationPath = "/api/v{version}/admin/halls/{hallId}/conversation";
    private const string CoordinatorSetupPath = "/api/v{version}/coordinator/setup";
    private const string AdminCoordinatorIdentityPath = "/api/v{version}/admin/coordinators/{userId}/identity-document";
    private const string PhotographerSetupPath = "/api/v{version}/photographer/setup";
    private const string AdminPhotographerIdentityPath = "/api/v{version}/admin/photographers/{userId}/identity-document";
    private const string AdminCoordinatorListPath = "/api/v{version}/admin/coordinators";
    private const string AdminCoordinatorDetailPath = "/api/v{version}/admin/coordinators/{userId}";
    private const string AdminCoordinatorRejectPath = "/api/v{version}/admin/coordinators/{userId}/reject";
    private const string AdminCoordinatorConversationPath = "/api/v{version}/admin/coordinators/{userId}/conversation";
    private const string AdminPhotographerListPath = "/api/v{version}/admin/photographers";
    private const string AdminPhotographerDetailPath = "/api/v{version}/admin/photographers/{userId}";
    private const string AdminPhotographerRejectPath = "/api/v{version}/admin/photographers/{userId}/reject";
    private const string AdminPhotographerRequestChangesPath = "/api/v{version}/admin/photographers/{userId}/request-changes";
    private const string AdminPhotographerConversationPath = "/api/v{version}/admin/photographers/{userId}/conversation";
    private const string CoordinatorResubmitPath = "/api/v{version}/coordinator/setup/resubmit";
    private const string PhotographerResubmitPath = "/api/v{version}/photographer/setup/resubmit";
    private const string PublicProfilePath = "/api/v{version}/profile/{userId}";
    private const string PublicProfilePicturePath = "/api/v{version}/profile/{userId}/picture";
    private const string ProfilePictureUploadPath = "/api/v{version}/profile/picture";
    private const string ProfileBioPath = "/api/v{version}/profile/bio";

    /// <summary>
    /// Total operations' paths. Guards against the document silently losing endpoints, and
    /// pins the count so a new operation is a deliberate edit rather than a surprise.
    /// 61 includes WESAL-TASK-8's owner deposit-confirmation endpoint; 62 adds
    /// WESAL-TASK-11's general-purpose owner "Contact Admin" action; 63 adds
    /// WESAL-TASK-10 Edit 15's Admin "Message" thread-resolve endpoint; 64 adds
    /// Edit 25's owner bookings-calendar endpoint; 65 adds Edit 22's comment
    /// edit/delete path; 66 adds Edit 26's rejected-halls queue endpoint; 90 adds the
    /// 24 Mabrouk Knowledge Studio admin operations; 92 adds the coordinator setup
    /// submission and admin coordinator identity-document endpoints; 94 adds the
    /// photographer setup submission and admin photographer identity-document endpoints;
    /// 107 adds Task 5's seven coordinator-review operations (list, detail, shop-photo,
    /// work-photos, approve, reject, conversation) and Task 6's six photographer-review
    /// operations (list, detail, approve, reject, request-changes, conversation); 113
    /// adds Tasks 7/8 resubmission and public-profile operations; 127 adds Task 9/10 post
    /// and offer endpoints, including hall-owner offer management; 132 adds the five
    /// distinct Task 11/12 post-comment and favorite paths; 155 adds Tasks 17-19 Discover,
    /// Search, and owner-statistics routes.
    /// </summary>
    private const int ExpectedPathCount = 155;

    [Fact]
    public void OpenApiDocument_GeneratesWithoutThrowing()
    {
        // The regression itself: before the fix this threw SwaggerGeneratorException, which the
        // swagger JSON endpoint surfaced as HTTP 500.
        var document = BuildDocument();

        Assert.Equal(ExpectedPathCount, document.Paths.Count);
    }

    [Fact]
    public void StatisticsOperation_ExplainsViewCountSemantics()
    {
        var document = BuildDocument();
        var operation = document.Paths["/api/v{version}/statistics/me"].Operations[Microsoft.OpenApi.Models.OperationType.Get];

        Assert.Contains("Repeated requests count separately", operation.Description, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("not unique-viewer counts", operation.Description, StringComparison.OrdinalIgnoreCase);
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
        Assert.Contains(CoordinatorSetupPath, document.Paths.Keys);
        Assert.Contains(AdminCoordinatorIdentityPath, document.Paths.Keys);
        Assert.Contains(PhotographerSetupPath, document.Paths.Keys);
        Assert.Contains(AdminPhotographerIdentityPath, document.Paths.Keys);
        Assert.Contains(CoordinatorResubmitPath, document.Paths.Keys);
        Assert.Contains(PhotographerResubmitPath, document.Paths.Keys);
        Assert.Contains(PublicProfilePath, document.Paths.Keys);
        Assert.Contains(PublicProfilePicturePath, document.Paths.Keys);
        Assert.Contains(ProfilePictureUploadPath, document.Paths.Keys);
        Assert.Contains(ProfileBioPath, document.Paths.Keys);
        Assert.Contains("/api/v{version}/posts/{postId}/share-link", document.Paths.Keys);
        Assert.Contains("/api/v{version}/posts/{postId}/shares", document.Paths.Keys);
        Assert.Contains("/api/v{version}/professionals/{providerUserId}/conversations", document.Paths.Keys);
        Assert.Contains("/api/v{version}/posts/{postId}/conversation", document.Paths.Keys);
        Assert.Contains("/api/v{version}/offers/{offerId}/conversation", document.Paths.Keys);
        Assert.Contains("/api/v{version}/conversations/contact-admin-account", document.Paths.Keys);
        Assert.Contains("/api/v{version}/conversations/admin-account", document.Paths.Keys);
        Assert.Contains("/api/v{version}/conversations/admin-account/unread-count", document.Paths.Keys);
        Assert.Contains("/api/v{version}/professional/conversations", document.Paths.Keys);
        Assert.Contains("/api/v{version}/professional/conversations/unread-count", document.Paths.Keys);
        Assert.Contains("/api/v{version}/professional/conversations/{conversationId}/messages", document.Paths.Keys);
        Assert.Contains("/api/v{version}/notifications", document.Paths.Keys);
        Assert.Contains("/api/v{version}/notifications/unread-count", document.Paths.Keys);
        Assert.Contains("/api/v{version}/notifications/{notificationId}/read", document.Paths.Keys);
        Assert.Contains("/api/v{version}/notifications/read-all", document.Paths.Keys);
        Assert.Contains("/api/v{version}/admin/moderation/posts/{postId}", document.Paths.Keys);
        Assert.Contains("/api/v{version}/admin/moderation/offers/{offerId}", document.Paths.Keys);
        Assert.Contains("/api/v{version}/admin/moderation/users/{userId}/publishing-restrictions", document.Paths.Keys);
        Assert.Contains("/api/v{version}/admin/moderation/users/{userId}/publishing-restriction", document.Paths.Keys);
        Assert.Contains("/api/v{version}/admin/moderation/users/{userId}", document.Paths.Keys);
    }

    [Fact]
    public void PostsAndOffers_ArePresentInTheDocument()
    {
        var document = BuildDocument();
        Assert.Contains("/api/v{version}/posts", document.Paths.Keys);
        Assert.Contains("/api/v{version}/posts/{postId}", document.Paths.Keys);
        Assert.Contains("/api/v{version}/posts/profile/{userId}", document.Paths.Keys);
        Assert.Contains("/api/v{version}/posts/{postId}/images/{imageId}", document.Paths.Keys);
        Assert.Contains("/api/v{version}/offers", document.Paths.Keys);
        Assert.Contains("/api/v{version}/offers/{offerId}", document.Paths.Keys);
        Assert.Contains("/api/v{version}/offers/{offerId}/stop", document.Paths.Keys);
        Assert.Contains("/api/v{version}/offers/mine", document.Paths.Keys);
        Assert.Contains("/api/v{version}/offers/profile/{userId}", document.Paths.Keys);
        Assert.Contains("/api/v{version}/offers/{offerId}/images/{imageId}", document.Paths.Keys);
        Assert.Contains("/api/v{version}/owner/halls/{hallId}/offers", document.Paths.Keys);
        Assert.Contains("/api/v{version}/owner/halls/{hallId}/offers/{offerId}", document.Paths.Keys);
        Assert.Contains("/api/v{version}/owner/halls/{hallId}/offers/{offerId}/stop", document.Paths.Keys);
        Assert.Contains("/api/v{version}/halls/{hallId}/offers/active", document.Paths.Keys);
    }

    [Fact]
    public void PostCommentsAndFavorites_ArePresentInTheDocument()
    {
        var document = BuildDocument();
        Assert.Contains("/api/v{version}/posts/{postId}/comments", document.Paths.Keys);
        Assert.Contains("/api/v{version}/posts/{postId}/comments/{commentId}/replies", document.Paths.Keys);
        Assert.Contains("/api/v{version}/posts/{postId}/comments/{commentId}", document.Paths.Keys);
        Assert.Contains("/api/v{version}/posts/{postId}/favorites", document.Paths.Keys);
        Assert.Contains("/api/v{version}/favorites", document.Paths.Keys);
    }

    [Fact]
    public void AdminReviewEndpoints_ArePresentInTheDocument()
    {
        // WESAL Tasks 5 and 6: every coordinator/photographer review operation must be a
        // published path, so the admin UI can be generated against the spec instead of
        // guessing routes for decisions, document reads, or the contact thread.
        var document = BuildDocument();

        string[] newPaths =
        [
            AdminCoordinatorListPath,
            AdminCoordinatorDetailPath,
            "/api/v{version}/admin/coordinators/{userId}/shop-photo",
            "/api/v{version}/admin/coordinators/{userId}/work-photos/{index}",
            "/api/v{version}/admin/coordinators/{userId}/approve",
            AdminCoordinatorRejectPath,
            AdminCoordinatorConversationPath,
            AdminPhotographerListPath,
            AdminPhotographerDetailPath,
            "/api/v{version}/admin/photographers/{userId}/approve",
            AdminPhotographerRejectPath,
            AdminPhotographerRequestChangesPath,
            AdminPhotographerConversationPath
        ];

        Assert.All(newPaths, path => Assert.Contains(path, document.Paths.Keys));
    }

    [Fact]
    public void PhotographerSetup_IsDocumentedAsMultipartFormData()
    {
        // The setup submission is a multipart upload (text branch fields plus the
        // personal ID document), so a generated client must be able to call it.
        var schema = FormSchemaFor(PhotographerSetupPath);

        Assert.Equal("string", schema.Properties["IdentityDocument"].Type);
        Assert.Equal("binary", schema.Properties["IdentityDocument"].Format);
        Assert.Contains("HasStudio", schema.Properties.Keys);
        Assert.Contains("PhoneNumber", schema.Properties.Keys);
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
    public void ContactAdminEndpoint_IsDocumented()
    {
        // WESAL-TASK-11 (Edit 11): the owner's general-purpose "Contact Admin" action is a
        // published operation, independent of the payment-notice trigger, so it belongs in
        // the API surface rather than being reachable only by guessing a conversation id.
        var document = BuildDocument();

        Assert.Contains(ContactAdminPath, document.Paths.Keys);
    }

    [Fact]
    public void AdminOwnerConversationEndpoint_IsDocumented()
    {
        // WESAL-TASK-10 (Edit 15): the Admin "Message" action resolves the owner/Admin thread
        // for a hall, so an admin UI can open a conversation from a hall list or review view
        // without composing a message first. It has to be a published operation for that to
        // be wireable.
        var document = BuildDocument();

        Assert.Contains(AdminOwnerConversationPath, document.Paths.Keys);
    }

    /// <summary>
    /// The endpoint is a GET that resolves state, so a body would be meaningless, and it
    /// takes no request payload at all — the hall is in the route. Asserted because a "Message"
    /// button wired against a spec that invented a body would generate a client that posts
    /// one.
    /// </summary>
    [Fact]
    public void AdminOwnerConversationEndpoint_TakesNoRequestBody()
    {
        var document = BuildDocument();

        var operation = document.Paths[AdminOwnerConversationPath].Operations[OperationType.Get];

        Assert.True(operation.RequestBody == null || operation.RequestBody.Content.Count == 0);
    }

    [Fact]
    public void AcceptBookingEndpoint_DeclaresItsDepositBodyAsRequired()
    {
        // WESAL-TASK-8 (Edit 8) made the deposit body mandatory. ASP.NET Core already rejects an
        // empty body at runtime, but Swashbuckle only reports "required" when the parameter says
        // so, and a spec that calls the body optional produces clients that get a surprise 400.
        var document = BuildDocument();

        var accept = document.Paths[AcceptBookingPath].Operations[OperationType.Post];

        Assert.True(accept.RequestBody.Required);
        Assert.Contains("application/json", accept.RequestBody.Content.Keys);

        var bodySchema = accept.RequestBody.Content["application/json"].Schema;
        Assert.Equal("AcceptBookingRequestDto", bodySchema.Reference?.Id);
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
