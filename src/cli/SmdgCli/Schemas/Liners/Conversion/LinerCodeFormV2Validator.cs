namespace SmdgCli.Schemas.Liners.Conversion;

using FluentValidation;
using Utilities;

/// <summary>
/// Rules of the V2 Excel application form, on top of <see cref="LinerCodeFormValidator"/>.
/// The mandatory fields are the ones marked with * in the template.
/// </summary>
public class LinerCodeFormV2Validator : AbstractValidator<LinerCodeForm>
{
    public LinerCodeFormV2Validator()
    {
        RuleFor(x => x.ChangeType)
            .Must(x => x is "Add" or "Update")
            .When(x => !string.IsNullOrEmpty(x.ChangeType))
            .WithMessage("Change Type must be Add or Update.");

        RuleFor(x => x.LinerCode)
            .Matches("^[A-Z0-9]{3}$")
            .When(x => !string.IsNullOrEmpty(x.LinerCode))
            .WithMessage("Code (A10) must be exactly 3 letters or digits.");

        RuleFor(x => x.CarrierType)
            .NotEmpty()
            .WithMessage("Carrier Type (D10) is required.")
            .Must(x => x is "VOCC" or "NVOCC")
            .When(x => !string.IsNullOrEmpty(x.CarrierType), ApplyConditionTo.CurrentValidator)
            .WithMessage("Carrier Type (D10) must be VOCC or NVOCC.");

        RuleFor(x => x.ValidFrom)
            .NotEmpty()
            .WithMessage("Valid from (E10) is required.");

        RuleFor(x => x.ValidTo)
            .Must((form, validTo) => validTo.ToDateOnly() >= form.ValidFrom.ToDateOnly())
            .When(x => !string.IsNullOrEmpty(x.ValidFrom) && !string.IsNullOrEmpty(x.ValidTo))
            .WithMessage("Valid until (F10) must not be before Valid from (E10).");

        RuleFor(x => x.Website)
            .NotEmpty()
            .WithMessage("Website (G10) is required.");

        RuleFor(x => x.Street)
            .NotEmpty()
            .WithMessage("Street (H10) is required.")
            .MaximumLength(100)
            .WithMessage("Street (H10) must be at most 100 characters long.");

        RuleFor(x => x.StreetNumber)
            .MaximumLength(50)
            .WithMessage("Street Number (I10) must be at most 50 characters long.");

        RuleFor(x => x.Floor)
            .MaximumLength(50)
            .WithMessage("Building/Floor (J10) must be at most 50 characters long.");

        RuleFor(x => x.PostalCode)
            .MaximumLength(50)
            .WithMessage("ZIP Code (K10) must be at most 50 characters long.");

        RuleFor(x => x.City)
            .NotEmpty()
            .WithMessage("City (L10) is required.")
            .MaximumLength(65)
            .WithMessage("City (L10) must be at most 65 characters long.");

        RuleFor(x => x.State)
            .MaximumLength(65)
            .WithMessage("State (M10) must be at most 65 characters long.");

        RuleFor(x => x.Country)
            .NotEmpty()
            .WithMessage("Country (N10) is required.")
            .Must(x => CountryCodes.FromName(x) is not null)
            .When(x => !string.IsNullOrEmpty(x.Country), ApplyConditionTo.CurrentValidator)
            .WithMessage(x => $"Country (N10) '{x.Country}' is not in the list of countries of the form. Please select it from the dropdown.");

        RuleFor(x => x.UnCountryCode)
            .Must((form, unCountryCode) => unCountryCode == CountryCodes.FromName(form.Country))
            .When(x => CountryCodes.FromName(x.Country) is not null && !string.IsNullOrEmpty(x.UnCountryCode))
            .WithMessage(x => $"UNLOCODE (O10) starts with {x.UnCountryCode}, but the country code of {x.Country} (N10) is {CountryCodes.FromName(x.Country)}.");

        RuleFor(x => x.UnCountryCode)
            .NotEmpty()
            .WithMessage("UNLOCODE (O10) is required.");

        RuleFor(x => x.UnCountryCode)
            .Matches("^[A-Z]{2}$")
            .When(x => !string.IsNullOrEmpty(x.UnCountryCode))
            .WithMessage("The first 2 characters of UNLOCODE (O10) must be a country code (e.g. DE).");

        RuleFor(x => x.UnLoCode)
            .Matches("^[A-Z2-9]{3}$")
            .When(x => !string.IsNullOrEmpty(x.UnLoCode))
            .WithMessage("The last 3 characters of UNLOCODE (O10) must be a location code (e.g. HAM).");
    }
}
