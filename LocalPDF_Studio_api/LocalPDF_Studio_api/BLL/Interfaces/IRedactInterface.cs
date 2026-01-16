using LocalPDF_Studio_api.DAL.Models.RedactPdf;

namespace LocalPDF_Studio_api.BLL.Interfaces
{
    public interface IRedactInterface
    {
        Task<byte[]> RedactPdfAsync(RedactRequest request);
    }
}
