using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Serilog;
using SmdgCli;
using SmdgCli.Commands;
using SmdgCli.Services;
using Spectre.Console;
using Spectre.Console.Cli;

AnsiConsole.MarkupLine("[underline green]Application started![/]");

var builder = Host
    .CreateDefaultBuilder(args)
    .UseContentRoot(Directory.GetCurrentDirectory())
    .ConfigureHostConfiguration(config =>
    {
        config.AddJsonFile("appsettings.json", false);
    })
    .ConfigureServices((ctx, services) => services.RegisterCommandDependencies())
    .UseSerilog();

var registrar = new TypeRegistrar(builder);

var app = new CommandApp(registrar);

app.Configure(config =>
{
    config.AddCommand<VersionCommand>("version");
    
    config.AddBranch("download", download =>
    {
        download.AddCommand<DownloadAttachmentCommand>("attachment");
        download.AddCommand<DownloadDocumentCommand>("file");
    });

    config.AddBranch("liner-codes", linerCode =>
    {
        linerCode.AddBranch("convert", convert =>
        {
            convert.AddCommand<LinerCodesConvertBulkCommand>("bulk");
            convert.AddCommand<LinerCodesConvertIssueCommand>("issue");
            convert.AddCommand<LinerCodesConvertFormCommand>("form");
        });
        linerCode.AddBranch("pack", pack =>
        {
            pack.AddCommand<LinerCodesPackExcelCommand>("excel");
            pack.AddCommand<LinerCodesPackCombinedCommand>("combined");
        });
        linerCode.AddBranch("verify", verify =>
        {
            verify.AddCommand<LinerCodesVerifyAllCommand>("all");
            verify.AddCommand<LinerCodesVerifyPullRequestCommand>("pull-request");
        });
    });
});

var result = await app.RunAsync(args);

AnsiConsole.MarkupLine("[underline green]Application stopped![/]");

return result;