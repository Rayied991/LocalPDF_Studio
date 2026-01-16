namespace LocalPDF_Studio_api.DAL.Models.RedactPdf
{
    public class RedactRequest
    {
        public string File { get; set; } = string.Empty;
        public List<RedactionArea> Redactions { get; set; } = new List<RedactionArea>();
    }
}
