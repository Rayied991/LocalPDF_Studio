namespace LocalPDF_Studio_api.DAL.Models.RedactPdf
{
    public class PythonRedactResult
    {
        public bool Success { get; set; }
        public int TotalRedactions { get; set; }
        public int PagesRedacted { get; set; }
        public List<int> PagesList { get; set; } = new List<int>();
        public string? OutputFile { get; set; }
        public string? Error { get; set; }
    }
}
