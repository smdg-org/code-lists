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
                    .MaximumLength(3).WithMessage("Liner code must be at no more than 3 characters long.");
            });
    }
}