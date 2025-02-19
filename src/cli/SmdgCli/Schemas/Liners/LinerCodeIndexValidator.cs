namespace SmdgCli.Schemas.Liners;

using FluentValidation;

public class LinerCodeIndexValidator : AbstractValidator<LinerCodeIndex>
{
    public LinerCodeIndexValidator()
    {
        RuleFor(x => x.LinerCodeFiles)
            .NotNull().WithMessage("The list of liner codes cannot be null.")
            .NotEmpty().WithMessage("The list of liner codes cannot be empty.")
            .ForEach(code =>
            {
                code
                    .NotEmpty().WithMessage("Liner code cannot be empty.")
                    .MaximumLength(8).WithMessage("Liner code file name must be no more than 8 characters long.")
                    .Must(str => str.EndsWith(".json", StringComparison.InvariantCultureIgnoreCase));
            });
    }
}