namespace SmdgCli.Test.Utilities;

using System;
using System.Collections.Generic;
using ClosedXML.Excel;
using FluentAssertions;
using SmdgCli.Utilities;
using Xunit;

public class ExcelUtilsTests
{
    private static readonly IEnumerable<string> ExpectedHeaders = ["Code", "Line", "Valid from", "Address"];

    private static readonly string[] FormHeaders =
    [
        "Code\n", "Line\n", "Parent\ncompany", "\nNVOCC\n", "VOCC\n",
        "Last change", "Valid from", "Valid until", "Website", "Address", "Remarks", "Applicant/Contact"
    ];

    private const int HeaderRow = 8;
    private const int DataRow = 9;

    [Fact]
    public void IdentifyHeader_ShouldCleanUpHeaderNames()
    {
        // Arrange
        using var workbook = CreateApplicationForm();
        var worksheet = workbook.Worksheet(1);

        // Act
        var (header, headerRowNumber) = worksheet.IdentifyHeader(ExpectedHeaders);

        // Assert
        headerRowNumber.Should().Be(HeaderRow);
        header.Should().Equal(
            "Code", "Line", "Parent company", "NVOCC", "VOCC",
            "Last change", "Valid from", "Valid until", "Website", "Address", "Remarks", "Applicant/Contact");
    }

    [Fact]
    public void IdentifyHeader_ShouldKeepAnEmptyEntry_WhenAHeaderCellIsEmpty()
    {
        // Arrange
        using var workbook = CreateApplicationForm(emptyHeaderColumn: 6);
        var worksheet = workbook.Worksheet(1);

        // Act
        var (header, _) = worksheet.IdentifyHeader(ExpectedHeaders);

        // Assert
        header.Should().HaveCount(FormHeaders.Length);
        header[5].Should().BeEmpty();
        header[6].Should().Be("Valid from");
    }

    [Fact]
    public void GetData_ShouldReadEveryValueFromItsOwnColumn()
    {
        // Arrange
        using var workbook = CreateApplicationForm();
        var worksheet = workbook.Worksheet(1);
        var (header, headerRowNumber) = worksheet.IdentifyHeader(ExpectedHeaders);

        // Act
        var data = worksheet.GetData(header, headerRowNumber);

        // Assert
        var row = data.Should().ContainSingle().Subject;
        row["Code"].Should().Be("LRA");
        row["Last change"].ToDateOnly().Should().Be(new DateOnly(2026, 8, 24));
        row["Valid from"].ToDateOnly().Should().Be(new DateOnly(2026, 8, 14));
        row["Valid until"].Should().BeEmpty();
        row["Website"].Should().Be("www.reedereiagentur.de");
    }

    [Fact]
    public void GetData_ShouldReadEveryValueFromItsOwnColumn_WhenAHeaderCellIsEmpty()
    {
        // Arrange
        // A requester who clears a column they do not need also clears its header. Without a
        // header for that column all following values used to shift one column to the left,
        // which put the "Last change" date into "Valid from".
        using var workbook = CreateApplicationForm(emptyHeaderColumn: 6);
        var worksheet = workbook.Worksheet(1);
        var (header, headerRowNumber) = worksheet.IdentifyHeader(ExpectedHeaders);

        // Act
        var data = worksheet.GetData(header, headerRowNumber);

        // Assert
        var row = data.Should().ContainSingle().Subject;
        row.Should().NotContainKey("Last change");
        row["Valid from"].ToDateOnly().Should().Be(new DateOnly(2026, 8, 14));
        row["Valid until"].Should().BeEmpty();
        row["Website"].Should().Be("www.reedereiagentur.de");
    }

    [Fact]
    public void PutData_ShouldWriteEveryValueToItsOwnColumn_WhenAHeaderCellIsEmpty()
    {
        // Arrange
        using var workbook = CreateApplicationForm(emptyHeaderColumn: 6, withDataRow: false);
        var worksheet = workbook.Worksheet(1);
        var (header, headerRowNumber) = worksheet.IdentifyHeader(ExpectedHeaders);

        var codes = new List<Dictionary<string, string>>
        {
            new()
            {
                ["Code"] = "LRA",
                ["Valid from"] = "2026-08-14",
                ["Website"] = "www.reedereiagentur.de",
            },
        };

        // Act
        worksheet.PutData(header, headerRowNumber, codes);

        // Assert
        worksheet.Cell(DataRow, 1).GetString().Should().Be("LRA");
        worksheet.Cell(DataRow, 7).GetString().Should().Be("2026-08-14");
        worksheet.Cell(DataRow, 9).GetString().Should().Be("www.reedereiagentur.de");
    }

    private static XLWorkbook CreateApplicationForm(int? emptyHeaderColumn = null, bool withDataRow = true)
    {
        var workbook = new XLWorkbook();
        var worksheet = workbook.AddWorksheet("Application form liner codes");

        worksheet.Cell(7, 1).Value = "Please use 3 character codes!";

        for (var columnNumber = 1; columnNumber <= FormHeaders.Length; columnNumber++)
        {
            if (columnNumber == emptyHeaderColumn)
            {
                continue;
            }

            worksheet.Cell(HeaderRow, columnNumber).Value = FormHeaders[columnNumber - 1];
        }

        if (!withDataRow)
        {
            return workbook;
        }

        worksheet.Cell(DataRow, 1).Value = "LRA";
        worksheet.Cell(DataRow, 2).Value = "Lüddeke Reedereiagentur GmbH";
        worksheet.Cell(DataRow, 4).Value = "X";
        worksheet.Cell(DataRow, 6).Value = new DateTime(2026, 8, 24);
        worksheet.Cell(DataRow, 7).Value = new DateTime(2026, 8, 14);
        worksheet.Cell(DataRow, 9).Value = "www.reedereiagentur.de";
        worksheet.Cell(DataRow, 10).Value = "Gotenstrasse 10, 20097 Hamburg, Germany";
        worksheet.Cell(DataRow, 12).Value = "David C. Lüddeke";

        return workbook;
    }
}
