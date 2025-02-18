namespace SmdgCli.Test;

using AutoFixture;
using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;
using Spectre.Console.Cli;

public class ServiceCollectionExtensionsTests
{
    private readonly IFixture _fixture = new Fixture();

    [Fact]
    public void RegisterCommandDependencies_ShouldRegisterAllDependencies()
    {
        // Arrange
        var services = new ServiceCollection();
        var commandTypes = typeof(ServiceCollectionExtensions).Assembly.GetTypes()
            .Where(t => !t.IsAbstract && typeof(ICommand).IsAssignableFrom(t))
            .ToList();
        
        // Act
        services.RegisterCommandDependencies();
        var serviceProvider = services.BuildServiceProvider();
    
        // Assert
        foreach (var commandType in commandTypes)
        {
            var constructor = commandType.GetConstructors().FirstOrDefault();
            constructor
                .Should()
                .NotBeNull($"Command {commandType.Name} should have a constructor.");

            foreach (var param in constructor!.GetParameters())
            {
                var resolvedInstance = serviceProvider.GetService(param.ParameterType);
                resolvedInstance
                    .Should()
                    .NotBeNull($"Dependency {param.ParameterType.Name} is missing for {commandType.Name}.");
            }
        }
    }
}