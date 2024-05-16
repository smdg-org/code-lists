namespace SmdgCli.Commands;

using System.Diagnostics;
using System.Diagnostics.CodeAnalysis;
using System.Reflection;
using Spectre.Console;
using Spectre.Console.Cli;

public class VersionCommand: Command<NoSettings>
{
    public override int Execute([NotNull] CommandContext context, [NotNull] NoSettings settings)
    {
        var assembly = Assembly.GetExecutingAssembly();
        var fileVersionInfo = FileVersionInfo.GetVersionInfo(assembly.Location);

        var version = fileVersionInfo.FileVersion ?? "Unknown";

        AnsiConsole.MarkupLine($"[deeppink3]Version {version}[/]");
        return 0;
    }
}