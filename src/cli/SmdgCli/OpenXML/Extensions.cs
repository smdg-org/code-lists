using ClosedXML.Excel;
using DocumentFormat.OpenXml.Packaging;

namespace SmdgCli.OpenXML;

public static class Extensions
{
    public static XLWorkbook OpenWorkbook(this Stream stream)
    {
        var settings = new OpenSettings { RelationshipErrorHandlerFactory = package => new UriRelationshipErrorHandler() };
        
        using (var xls = SpreadsheetDocument.Open(stream, true, settings))
        {
            xls.Save();
        }

        return new XLWorkbook(stream);
    } 
}