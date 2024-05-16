using DocumentFormat.OpenXml.Packaging;

namespace SmdgCli.OpenXML;

public class UriRelationshipErrorHandler : RelationshipErrorHandler
{
    public override string Rewrite(Uri partUri, string? id, string? uri)
    {
        return "http://link-invalido";
    }
}