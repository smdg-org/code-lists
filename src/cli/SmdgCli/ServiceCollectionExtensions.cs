namespace SmdgCli;

using Microsoft.Extensions.DependencyInjection;
using Schemas.Liners;
using Schemas.Liners.Conversion;
using Services;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection RegisterCommandDependencies(this IServiceCollection services)
    {
        services.AddHttpClient();

        services.AddTransient<IGitHubClientFactory, GitHubClientFactory>();
        services.AddTransient<IRemoteFileReader, RemoteFileReader>();
        services.AddTransient<IFileStore, FileStore>();
        services.AddTransient<IExcelFile, ExcelFile>();
        services.AddTransient<IExcelMapper<LinerCodeExcel>, LinerCodeExcelMapper>();
        services.AddTransient<IExcelMapper<LinerCodeChangeExcel>, LinerCodeChangeExcelMapper>();
        services.AddTransient<IMapper<LinerCode, LinerCodeExcel, LinerCodeChangeExcel>, LinerCodeMapper>();
        services.AddTransient<LinerCodeMapper>();
        services.AddTransient<LinerCodeFormMapper>();

        return services;
    }
}