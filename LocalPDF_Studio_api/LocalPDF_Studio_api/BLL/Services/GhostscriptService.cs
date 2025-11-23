using LocalPDF_Studio_api.BLL.Interfaces;
using System.Diagnostics;
using System.Runtime.InteropServices;

namespace LocalPDF_Studio_api.BLL.Services
{
    public class GhostscriptService : IGhostscriptInterface
    {
        public async Task<bool> IsGhostscriptAvailableAsync()
        {
            try
            {
                var version = await GetGhostscriptVersionAsync();
                return !string.IsNullOrEmpty(version);
            }
            catch
            {
                return false;
            }
        }

        public async Task<string> GetGhostscriptVersionAsync()
        {
            var processNames = GhostscriptHelper.GetGhostscriptProcessNames();

            foreach (var processName in processNames)
            {
                try
                {
                    var (exitCode, output, error) = await GhostscriptHelper.ExecuteGhostscriptCommandAsync(
                        processName, 
                        "--version"
                    );

                    if (exitCode == 0 && !string.IsNullOrWhiteSpace(output))
                    {
                        return output;
                    }
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"[GS_DEBUG] Exception checking Ghostscript: {ex.Message}");
                    continue;
                }
            }

            return null;
        }
    }
}
