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
            var processNames = GetGhostscriptProcessNames();

            foreach (var processName in processNames)
            {
                try
                {
                    using var process = new Process();
                    process.StartInfo = new ProcessStartInfo
                    {
                        FileName = processName,
                        Arguments = "--version",
                        UseShellExecute = false,
                        RedirectStandardOutput = true,
                        RedirectStandardError = true,
                        CreateNoWindow = true
                    };

                    process.Start();
                    var output = await process.StandardOutput.ReadToEndAsync();
                    await process.WaitForExitAsync();

                    if (process.ExitCode == 0 && !string.IsNullOrWhiteSpace(output))
                    {
                        return output.Trim();
                    }
                }
                catch
                {
                    // Continue to next process name
                    continue;
                }
            }

            return null;
        }

        private string[] GetGhostscriptProcessNames()
        {
            if (RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
            {
                return new[] { "gswin64c.exe", "gswin32c.exe", "gs.exe" };
            }
            else if (RuntimeInformation.IsOSPlatform(OSPlatform.Linux) ||
                     RuntimeInformation.IsOSPlatform(OSPlatform.OSX))
            {
                return new[] { "gs", "ghostscript" };
            }
            else
            {
                throw new PlatformNotSupportedException("Unsupported operating system");
            }
        }
    }
}
