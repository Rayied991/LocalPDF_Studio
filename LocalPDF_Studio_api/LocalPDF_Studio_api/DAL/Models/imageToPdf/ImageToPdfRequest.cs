namespace LocalPDF_Studio_api.DAL.Models.imageToPdf
{
    public class ImageToPdfRequest
    {
        // Page orientation: "portrait" or "landscape"
        public string Orientation { get; set; } = "portrait";

        // Page size: "fit", "a4", or "letter"
        public string PageSize { get; set; } = "a4";

        // Whether to merge all images into one PDF file
        public bool MergeAll { get; set; } = true;

        // Image quality (1-100)
        public int Quality { get; set; } = 95;

        // List of images to convert
        public List<ImageFileData> Images { get; set; } = new List<ImageFileData>();
    }
}
