namespace SmdgCli.Schemas.Liners;

using FluentValidation;

public class LinerCodeValidator : AbstractValidator<LinerCode>
{
    public LinerCodeValidator()
    {
        RuleFor(x => x.LinerCodeVersion)
            .NotEmpty()
            .WithMessage("Liner Code Version is required")
            .MaximumLength(2)
            .WithMessage("Liner Code Version must be 2 characters long");

        RuleFor(x => x.LinerSmdgCode)
            .NotEmpty()
            .WithMessage("Liner Code is required")
            .MaximumLength(3)
            .WithMessage("Liner Code must be 3 characters long");

        RuleFor(x => x.LinerName)
            .NotEmpty()
            .WithMessage("Liner Name is required")
            .MaximumLength(100)
            .WithMessage("Liner Name must be 100 characters long");
        
        RuleFor(x => x.ParentCompanyCode)
            .NotEmpty()
            .WithMessage("Parent Company Code is required")
            .MaximumLength(3)
            .WithMessage("Parent Company Code must be 3 characters long");
    
        RuleFor(x => x.ParentCompanyName)
            .NotEmpty()
            .WithMessage("Parent Company Name is required")
            .MaximumLength(100)
            .WithMessage("Parent Company Name must be 100 characters long");

        RuleFor(x => x.CarrierType)
            .NotEmpty()
            .WithMessage("Carrier Type is required")
            .MaximumLength(10)
            .WithMessage("Carrier Type must be 10 characters long");

        RuleFor(x => x.Website)
            .MaximumLength(50)
            .WithMessage("Website must be 50 characters long");

        RuleFor(x => x.Remarks)
            .MaximumLength(500)
            .WithMessage("Remarks must be 500 characters long");
    }
}