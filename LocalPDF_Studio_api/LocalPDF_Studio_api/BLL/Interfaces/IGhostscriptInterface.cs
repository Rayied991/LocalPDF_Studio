namespace LocalPDF_Studio_api.BLL.Interfaces
{
    public interface IGhostscriptInterface
    {
        Task<bool> IsGhostscriptAvailableAsync();
        Task<string> GetGhostscriptVersionAsync();
    }
}
