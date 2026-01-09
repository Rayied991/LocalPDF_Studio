using LocalPDF_Studio_api.DAL.Models.imageToPdf;

namespace LocalPDF_Studio_api.BLL.Interfaces
{
    public interface IImageToPdfInterface
    {
        Task<byte[]> ConvertImagesToPdfAsync(ImageToPdfRequest request);
    }
}
