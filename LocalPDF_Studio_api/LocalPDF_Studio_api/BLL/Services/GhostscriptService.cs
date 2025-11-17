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
            var bundledResult = await TryBundledGhostscript();
            if (!string.IsNullOrEmpty(bundledResult)) return bundledResult;
            return await TrySystemGhostscript();
        }

        private async Task<string> TryBundledGhostscript()
        {
            // Only try this on Linux
            if (!RuntimeInformation.IsOSPlatform(OSPlatform.Linux))
                return null;

            try
            {
                var baseDir = AppContext.BaseDirectory;
                var bundledPaths = new[]
                {
                    Path.Combine(baseDir, "assets", "backend_linux", "ghostscript", "gs"),
                    Path.Combine(baseDir, "..", "assets", "backend_linux", "ghostscript", "gs"),
                    Path.Combine(baseDir, "..", "..", "assets", "backend_linux", "ghostscript", "gs")
                };

                foreach (var path in bundledPaths)
                {
                    if (File.Exists(path))
                    {
                        Console.WriteLine($"Found Ghostscript (on Linux) at: {path}");

                        using var process = new Process();
                        process.StartInfo = new ProcessStartInfo
                        {
                            FileName = path,
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
                            Console.WriteLine($"Linux's Ghostscript version: {output.Trim()}");
                            return output.Trim();
                        }
                    }
                }
                Console.WriteLine("No Ghostscript found or it didn't work on Linux");
                return null;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error checking Ghostscript for Linux: {ex.Message}");
                return null;
            }
        }

        private async Task<string> TrySystemGhostscript()
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
