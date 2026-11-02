namespace SmdgCli.Schemas.Liners.Conversion;

using System.Globalization;
using System.Text.RegularExpressions;
using FluentValidation.Results;

/// <summary>
/// Application form (V2): a fixed layout with the headers in row 9 and a single
/// liner code in row 10, columns A to R.
/// </summary>
public static partial class LinerCodeFormExcelV2
{
    public const string SheetName = "Application form liner codes";

    public const int HeaderRow = 9;

    public const int DataRow = 10;

    private const string LastColumn = "R";

    /// <summary>
    /// Column of every mapped field and a text its header in row 9 must contain.
    /// Applicant name (P) and mail address (Q) are personal data and are not stored.
    /// </summary>
    public static readonly IReadOnlyList<(string Column, string Header)> Columns =
    [
        ("A", "Code"),
        ("B", "Liner Name"),
        ("C", "Parent"),
        ("D", "Carrier Type"),
        ("E", "Valid from"),
        ("F", "Valid until"),
        ("G", "Website"),
        ("H", "Street"),
        ("I", "Street Number"),
        ("J", "Floor"),
        ("K", "Code"),
        ("L", "City"),
        ("M", "State"),
        ("N", "Country"),
        ("O", "UNLOCODE"),
        ("R", "Remarks"),
    ];

    private const string DateFormat = "yyyy-MM-dd";

    /// <summary>
    /// Maps the cells of the form to a <see cref="LinerCodeForm"/>. Change type and requester
    /// come from the issue. Problems with the layout itself are returned as validation failures.
    /// </summary>
    public static (LinerCodeForm Form, List<ValidationFailure> Failures) ToForm(
        IReadOnlyDictionary<string, string> cells,
        LinerCodeFormExcel issueForm)
    {
        var failures = new List<ValidationFailure>();

        foreach (var (column, header) in Columns)
        {
            var actual = Value(cells, column, HeaderRow) ?? string.Empty;
            if (!actual.Contains(header, StringComparison.InvariantCultureIgnoreCase))
            {
                failures.Add(new ValidationFailure(
                    "Form attachment",
                    $"Cell {column}{HeaderRow} should be the '{header}' header but is '{actual}'. Please use the V2 application form template."));
            }
        }

        var extraRows = cells.Keys
            .Select(CellAddress)
            .Where(a => a.Row > DataRow && string.CompareOrdinal(a.Column, LastColumn) <= 0 && a.Column.Length == 1)
            .Select(a => a.Row)
            .Distinct()
            .ToList();
        if (extraRows.Count > 0)
        {
            failures.Add(new ValidationFailure(
                "Form attachment",
                $"The form must contain exactly one liner code in row {DataRow}, but row(s) {string.Join(", ", extraRows.Order())} also contain data."));
        }

        var unLocode = Regex.Replace(Value(cells, "O") ?? string.Empty, @"\s", string.Empty).ToUpperInvariant();

        var form = new LinerCodeForm
        {
            ChangeType = issueForm.ChangeType,
            Requester = issueForm.Requester,
            LinerCode = Value(cells, "A")?.ToUpperInvariant(),
            LinerName = Value(cells, "B"),
            ParentCompany = Value(cells, "C"),
            CarrierType = Value(cells, "D")?.ToUpperInvariant(),
            ValidFrom = Date(cells, "E", "Valid from", failures),
            ValidTo = Date(cells, "F", "Valid until", failures),
            Website = Value(cells, "G"),
            Street = Value(cells, "H"),
            StreetNumber = Value(cells, "I"),
            Floor = Value(cells, "J"),
            PostalCode = Value(cells, "K"),
            City = Value(cells, "L"),
            State = Value(cells, "M"),
            Country = Value(cells, "N"),
            UnCountryCode = unLocode.Length > 0 ? unLocode[..Math.Min(2, unLocode.Length)] : null,
            UnLoCode = unLocode.Length > 2 ? unLocode[^3..] : null,
            Remarks = Value(cells, "R"),
        };
        form.UnstructuredAddress = UnstructuredAddress(form);

        if (unLocode.Length > 0 && unLocode.Length != 5)
        {
            failures.Add(new ValidationFailure(
                "UNLOCODE",
                $"UNLOCODE '{unLocode}' must have 5 characters: the 2-letter country code followed by the 3-character location code (e.g. DEHAM)."));
        }

        return (form, failures);
    }

    /// <summary>
    /// Single-line address kept for consumers of the unstructured "address" field,
    /// e.g. "Ballindamm 25, 20095 Hamburg, Hamburg, Germany".
    /// </summary>
    public static string UnstructuredAddress(LinerCodeForm form)
    {
        string?[] parts =
        [
            Join(" ", form.Street, form.StreetNumber),
            form.Floor,
            Join(" ", form.PostalCode, form.City),
            form.State,
            form.Country,
        ];

        return Join(", ", parts) ?? string.Empty;
    }

    private static string? Join(string separator, params string?[] parts)
    {
        var joined = string.Join(separator, parts.Where(p => !string.IsNullOrWhiteSpace(p)));
        return joined.Length > 0 ? joined : null;
    }

    private static string? Value(IReadOnlyDictionary<string, string> cells, string column, int row = DataRow)
    {
        var value = cells.GetValueOrDefault($"{column}{row}")?.Trim();
        return string.IsNullOrEmpty(value) ? null : value;
    }

    private static string? Date(
        IReadOnlyDictionary<string, string> cells,
        string column,
        string fieldName,
        List<ValidationFailure> failures)
    {
        var value = Value(cells, column);
        if (value is null)
        {
            return null;
        }

        // Cells formatted as dates are already converted to yyyy-MM-dd by the reader.
        if (DateOnly.TryParseExact(value, DateFormat, CultureInfo.InvariantCulture, DateTimeStyles.None, out _))
        {
            return value;
        }

        failures.Add(new ValidationFailure(
            fieldName,
            $"{fieldName} '{value}' is not a valid date. Please use the format YYYY-MM-DD."));
        return null;
    }

    private static (string Column, int Row) CellAddress(string address)
    {
        var match = CellAddressRegex().Match(address);
        return match.Success
            ? (match.Groups[1].Value, int.Parse(match.Groups[2].Value, CultureInfo.InvariantCulture))
            : (string.Empty, 0);
    }

    [GeneratedRegex(@"^([A-Z]+)(\d+)$")]
    private static partial Regex CellAddressRegex();
}
