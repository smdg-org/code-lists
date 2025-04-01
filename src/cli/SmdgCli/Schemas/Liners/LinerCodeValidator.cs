namespace SmdgCli.Schemas.Liners;

using FluentValidation;

public class LinerCodeValidator : AbstractValidator<LinerCode>
{
    public LinerCodeValidator()
    {
        RuleFor(x => x.LinerCodeVersion)
            .NotEmpty()
            .WithMessage("Liner Code Version is required")
            .MaximumLength(3)
            .WithMessage("Liner Code Version must be 2 characters long");

        RuleFor(x => x.LinerSmdgCode)
            .NotEmpty()
            .WithMessage("Liner Code is required")
            .Length(3)
            .WithMessage("Liner Code must be exactly 3 characters long");

        RuleFor(x => x.LinerName)
            .NotEmpty()
            .WithMessage("Liner Name is required")
            .MaximumLength(100)
            .WithMessage("Liner Name must be 100 characters long");

        RuleFor(x => x.ParentCompany)
            .MaximumLength(100)
            .WithMessage("Parent Company must be 100 characters long");

        RuleFor(x => x.Website)
            .MaximumLength(255)
            .WithMessage("Website must be no more than 255 characters long");

        RuleFor(x => x.Remarks)
            .MaximumLength(500)
            .WithMessage("Remarks must be 500 characters long");
    }
}