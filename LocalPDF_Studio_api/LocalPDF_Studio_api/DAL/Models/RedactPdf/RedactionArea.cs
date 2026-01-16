namespace LocalPDF_Studio_api.DAL.Models.RedactPdf
{
    public class RedactionArea
    {
        public int Page { get; set; }
        public double X { get; set; }
        public double Y { get; set; }
        public double Width { get; set; }
        public double Height { get; set; }
        public string Color { get; set; } = "#000000";
    }
}
