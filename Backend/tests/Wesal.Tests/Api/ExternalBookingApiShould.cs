using System.Net;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text.Encodings.Web;
using System.Text.Json;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Moq;
using Wesal.API.Controllers;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Models;
using Wesal.Domain.Constants;
using Wesal.Domain.Exceptions;
using Wesal.Infrastructure.Bookings;
using Wesal.Infrastructure.Middleware;
using Wesal.Infrastructure.OwnerDashboard;
using Wesal.Persistence.Repositories;
using Wesal.Tests.Infrastructure;

namespace Wesal.Tests.Api;

public sealed class ExternalBookingApiShould
{
    [Theory]
    [InlineData("identity", 403)]
    [InlineData("restriction", 403)]
    [InlineData("unlocked", 200)]
    public async Task BothOwnerRoutesEnforceTheSameAccountLocksBeforeReturningCustomerDetails(string kind, int status)
    {
        await using var h = await ExternalBookingHarness.CreateAsync();
        var booking = await h.CreateAsync();
        if (kind == "identity")
        {
            await using var db = h.Context();
            var user = await db.Users.FindAsync("owner");
            user!.LockoutEnabled = true;
            user.LockoutEnd = DateTimeOffset.UtcNow.AddDays(1);
            await db.SaveChangesAsync();
        }
        if (kind == "restriction") h.AccountLocks.Setup(x => x.GetLockedUntilAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(DateTimeOffset.UtcNow.AddDays(1));
        await using var op = h.Operation();
        var general = new OwnerBookingRequestsService(op.Users, h.Current, new OwnerDashboardRepository(op.Db), h.AccountLocks.Object);
        using var server = Server(op.Service, general);
        using var client = server.CreateClient();
        client.DefaultRequestHeaders.Add("Test-Role", ApplicationRoles.HallOwner);
        var prefix = $"/api/v1/owner/halls/{h.HallId}";
        foreach (var path in new[] { "/bookings", $"/external-bookings/{booking.BookingId}",
            "/external-bookings?fromDate=2026-11-16&toDate=2026-11-16", $"/external-bookings/{booking.BookingId}/history" })
        {
            var response = await client.GetAsync(prefix + path);
            Assert.Equal(status, (int)response.StatusCode);
            var body = await response.Content.ReadAsStringAsync();
            if (status == 200) Assert.Contains("0599123456", body);
            else { Assert.DoesNotContain("0599123456", body); Assert.DoesNotContain("External customer", body); }
        }
    }

    [Theory]
    [InlineData("guest",401)]
    [InlineData("RegisteredUser",403)]
    public async Task HttpAuthorizationProtectsOwnerEndpoints(string role,int status)
    {
        await using var h=await ExternalBookingHarness.CreateAsync();await using var op=h.Operation();
        using var server=Server(op.Service);using var client=server.CreateClient();client.DefaultRequestHeaders.Add("Test-Role",role);
        var response=await client.GetAsync($"/api/v1/owner/halls/{h.HallId}/external-bookings/{Guid.NewGuid()}");
        Assert.Equal(status,(int)response.StatusCode);
    }

    [Fact]
    public async Task HttpContractUsesPersistentIdsETagsAndSourceAwareErrors()
    {
        await using var h=await ExternalBookingHarness.CreateAsync();await using var op=h.Operation();using var server=Server(op.Service);using var client=server.CreateClient();
        client.DefaultRequestHeaders.Add("Test-Role",ApplicationRoles.HallOwner);
        var path=$"/api/v1/owner/halls/{h.HallId}/external-bookings";
        var missing=await client.PostAsJsonAsync(path,h.Request);Assert.Equal(HttpStatusCode.BadRequest,missing.StatusCode);
        client.DefaultRequestHeaders.Add("Idempotency-Key",Guid.NewGuid().ToString());
        var created=await client.PostAsJsonAsync(path,h.Request);Assert.Equal(HttpStatusCode.Created,created.StatusCode);
        var body=(await created.Content.ReadFromJsonAsync<ExternalBookingDto>())!;
        Assert.NotEqual(Guid.Empty,body.BookingId);Assert.Equal("ExternalManual",body.Source);Assert.Equal("Confirmed",body.Status);
        Assert.Equal("\"1\"",created.Headers.ETag!.Tag);Assert.False(body.CanConfirmDeposit);Assert.False(body.CanDelete);
        Assert.Contains(body.BookingId.ToString(),created.Headers.Location!.ToString());
        client.DefaultRequestHeaders.Remove("Idempotency-Key");client.DefaultRequestHeaders.Add("Idempotency-Key",Guid.NewGuid().ToString());
        var missingRevision=await client.PutAsJsonAsync(path+"/"+body.BookingId,h.Request);
        Assert.Equal(428,(int)missingRevision.StatusCode);Assert.Contains("RevisionRequired",await missingRevision.Content.ReadAsStringAsync());
        client.DefaultRequestHeaders.Add("If-Match","\"99\"");
        var stale=await client.PutAsJsonAsync(path+"/"+body.BookingId,h.Request);Assert.Equal(HttpStatusCode.PreconditionFailed,stale.StatusCode);
        var get=await client.GetAsync(path+"/"+body.BookingId);Assert.Equal(HttpStatusCode.OK,get.StatusCode);
        var history=await client.GetAsync(path+"/"+body.BookingId+"/history");Assert.Equal(HttpStatusCode.OK,history.StatusCode);
    }

    [Theory]
    [InlineData("accept")]
    [InlineData("reject")]
    [InlineData("payment")]
    [InlineData("delete")]
    [InlineData("cancel")]
    public async Task OnlineServicesCannotMutateExternalBookings(string operation)
    {
        await using var h=await ExternalBookingHarness.CreateAsync();var b=await h.CreateAsync();await using var db=h.Context();
        var type=operation switch {"accept"=>typeof(BookingAcceptanceService),"reject"=>typeof(BookingRejectionService),"payment"=>typeof(BookingPaymentConfirmationService),"delete"=>typeof(BookingDeletionService),_=>typeof(BookingCancellationService)};
        var args=type.GetConstructors().Single().GetParameters().Select(p=>p.ParameterType.Name switch {
            "IBookingRepository"=>(object)new BookingRepository(db),"IUnitOfWork"=>new UnitOfWork(db),"ICurrentUserService"=>h.Current,
            _=>((Mock)Activator.CreateInstance(typeof(Mock<>).MakeGenericType(p.ParameterType))!).Object }).ToArray();
        var service=Activator.CreateInstance(type,args)!;
        if(operation=="cancel")h.Current.Role=ApplicationRoles.RegisteredUser;
        await Assert.ThrowsAnyAsync<DomainException>(async ()=> {
            switch(service) {
                case BookingAcceptanceService s:await s.AcceptBookingAsync(h.HallId,b.BookingId,new(){DepositAmount=100});break;
                case BookingRejectionService s:await s.RejectBookingAsync(h.HallId,b.BookingId,new(){Reason="Owner declined"});break;
                case BookingPaymentConfirmationService s:await s.ConfirmPaymentAsync(h.HallId,b.BookingId);break;
                case BookingDeletionService s:await s.DeleteBookingAsync(h.HallId,b.BookingId);break;
                case BookingCancellationService s:await s.CancelBookingAsync(h.HallId,b.BookingId);break;
            }
        });
        await using var verify=h.Context();Assert.Equal(Wesal.Domain.Enums.BookingStatus.Confirmed,(await verify.Bookings.FindAsync(b.BookingId))!.Status);
    }

    private static TestServer Server(IOwnerExternalBookingService service, IOwnerBookingRequestsService? general = null)=>new(new WebHostBuilder().ConfigureServices(services=> {
        services.AddLogging();services.AddSingleton(service);
        if (general is not null)
            foreach (var parameter in typeof(OwnerController).GetConstructors().Single().GetParameters())
                services.AddSingleton(parameter.ParameterType, parameter.ParameterType == typeof(IOwnerBookingRequestsService)
                    ? general : ((Mock)Activator.CreateInstance(typeof(Mock<>).MakeGenericType(parameter.ParameterType))!).Object);
        services.AddAuthentication("test").AddScheme<AuthenticationSchemeOptions,OwnerAuthentication>("test",_=>{});
        services.AddAuthorization(o=>o.AddPolicy(ApplicationPolicies.RequireHallOwner,p=>p.RequireAuthenticatedUser().RequireRole(ApplicationRoles.HallOwner)));
        services.AddControllers().AddApplicationPart(typeof(OwnerExternalBookingsController).Assembly);
        services.AddApiVersioning(o=>{o.DefaultApiVersion=new Asp.Versioning.ApiVersion(1,0);o.AssumeDefaultVersionWhenUnspecified=true;}).AddMvc();
    }).Configure(app=>{app.UseMiddleware<GlobalExceptionHandlingMiddleware>();app.UseRouting();app.UseAuthentication();app.UseAuthorization();app.UseEndpoints(x=>x.MapControllers());}));

    private sealed class OwnerAuthentication(IOptionsMonitor<AuthenticationSchemeOptions> options,ILoggerFactory logger,UrlEncoder encoder)
        :AuthenticationHandler<AuthenticationSchemeOptions>(options,logger,encoder)
    {
        protected override Task<AuthenticateResult> HandleAuthenticateAsync()
        {
            var role=Request.Headers["Test-Role"].ToString();
            return Task.FromResult(role is "" or "guest" ? AuthenticateResult.NoResult():AuthenticateResult.Success(new AuthenticationTicket(
                new ClaimsPrincipal(new ClaimsIdentity([new Claim(ClaimTypes.NameIdentifier,"owner"),new Claim(ClaimTypes.Role,role)],"test")),"test")));
        }
    }
}
