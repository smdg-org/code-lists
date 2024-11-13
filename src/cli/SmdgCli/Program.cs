using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Serilog;
using SmdgCli;
using SmdgCli.Commands;
using SmdgCli.Schemas.Liners;
using SmdgCli.Services;
using Spectre.Console;
using Spectre.Console.Cli;

AnsiConsole.MarkupLine("[underline green]Application started![/]");

var builder = Host
    .CreateDefaultBuilder(args)
    .UseContentRoot(Directory.GetCurrentDirectory())
    .ConfigureHostConfiguration(config =>
    {
        config
            .AddJsonFile("appsettings.json", false)
            .AddJsonFile("appsettings.datasources.json", false);
    })
    .ConfigureServices((ctx, services) =>
    {
        services.Configure<DataSources>(ctx.Configuration.GetSection("DataSources"));

        services.AddHttpClient();

        services.AddTransient<IRemoteFileReader, RemoteFileReader>();
        services.AddTransient<IFileListWriter, FileListWriter>();
        services.AddTransient<IFileConverter, FileConverter>();
        services.AddTransient<IExcelMapper<LinerCodeExcel>, LinerCodeExcelMapper>();
        services.AddTransient<IExcelMapper<LinerCodeChangeExcel>, LinerCodeChangeExcelMapper>();
        services.AddTransient<IMapper<LinerCode, LinerCodeExcel, LinerCodeChangeExcel>, LinerCodeMapper>();
        services.AddTransient<LinerCodeMapper>();
    })
    .UseSerilog();

var registrar = new TypeRegistrar(builder);

var app = new CommandApp(registrar);

app.Configure(config =>
{
    config.AddCommand<VersionCommand>("version");

    config.AddBranch("convert", convert =>
    {
        convert.AddCommand<ConvertLinerCodesCommand>("liner-codes");
    });

    config.AddBranch("verify", verify =>
    {
        verify.AddCommand<VerifyLinerCodesCommand>("liner-codes");
    });
});

var result = await app.RunAsync(args);

AnsiConsole.MarkupLine("[underline green]Application stopped![/]");

return result;