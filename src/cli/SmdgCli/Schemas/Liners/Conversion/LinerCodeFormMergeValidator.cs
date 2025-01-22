namespace SmdgCli.Schemas.Liners.Conversion;

using FluentValidation;

public class LinerCodeFormMergeValidator : AbstractValidator<LinerCodeFormMerge>
{
    public LinerCodeFormMergeValidator()
    {
        RuleFor(x => x.ExistingData)
            .NotEmpty()
            .When(x => x.FromData.ChangeType != "Add")
            .WithMessage("Existing Data is required when Change Type is not Add.");
        
        RuleFor(x => x.FromData.ChangeType)
            .NotEqual("Add")
            .When(x => x.ExistingData != null)
            .WithMessage("A request has been made to add a new liner code, but a liner code with the same value already exists.");

        RuleFor(x => x.FromData)
            .SetValidator(new LinerCodeFormValidator());
    }
}