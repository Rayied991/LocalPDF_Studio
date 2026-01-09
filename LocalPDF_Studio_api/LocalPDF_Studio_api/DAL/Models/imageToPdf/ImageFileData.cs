namespace LocalPDF_Studio_api.DAL.Models.imageToPdf
{
    public class ImageFileData
    {
        // Original file name of the image
        public string FileName { get; set; } = string.Empty;

        // Binary content of the image file
        public byte[] Content { get; set; } = Array.Empty<byte>();
    }
}
