namespace SmdgCli.Schemas.Liners.Conversion;

using FluentValidation;

public class LinerCodeFormValidator : AbstractValidator<LinerCodeForm>
{
    public LinerCodeFormValidator()
    {
        RuleFor(x => x.ChangeType)
            .NotEmpty()
            .WithMessage("Change Type is required.");

        RuleFor(x => x.LinerCode)
            .NotEmpty()
            .WithMessage("Liner Code is required")
            .MaximumLength(3)
            .WithMessage("Liner Code must be 3 characters long.");

        RuleFor(x => x.LinerName)
            .NotEmpty()
            .WithMessage("Liner Name is required")
            .MaximumLength(100)
            .WithMessage("Liner Name must be 100 characters long.");
        
        RuleFor(x => x.ParentCompany)
            .MaximumLength(100)
            .WithMessage("Parent Company Code must be 100 characters long.");
    }
}