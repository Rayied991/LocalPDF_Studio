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
                    Console.WriteLine($"[GS_DEBUG] Attempting to run command: {processName} --version");
                    
                    using var process = new Process();
                    process.StartInfo = new ProcessStartInfo
                    {
                        FileName = "/bin/sh",
                        Arguments = $"-c \"{processName} --version\"",
                        UseShellExecute = false,
                        RedirectStandardOutput = true,
                        RedirectStandardError = true,
                        CreateNoWindow = true
                    };

                    process.Start();

                    var outputTask = process.StandardOutput.ReadToEndAsync();
                    var errorTask = process.StandardError.ReadToEndAsync();

                    await process.WaitForExitAsync();
                    
                    var output = await outputTask;
                    var error = await errorTask;

                    Console.WriteLine($"[GS_DEBUG] Exit Code: {process.ExitCode}");
                    if (!string.IsNullOrWhiteSpace(error))
                    {
                        Console.WriteLine($"[GS_DEBUG] STDERR: {error.Trim()}");
                    }
                    if (!string.IsNullOrWhiteSpace(output))
                    {
                        Console.WriteLine($"[GS_DEBUG] STDOUT: {output.Trim()}");
                    }

                    if (process.ExitCode == 0 && !string.IsNullOrWhiteSpace(output))
                    {
                        return output.Trim();
                    }
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"[GS_DEBUG] Exception starting process: {ex.Message}");
                    continue;
                }
            }

            return null;
        }

        private string[] GetGhostscriptProcessNames()
        {
            var list = new List<string>();

            if (RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
            {
                Console.WriteLine("Searching for Windows ghostscript [GhostscriptService]");
                list.Add("gswin64c.exe");
                list.Add("gswin32c.exe");
                list.Add("gs.exe");
                Console.WriteLine("Searching finished for Windows ghostscript [GhostscriptService]" + list);
            }
            else if (RuntimeInformation.IsOSPlatform(OSPlatform.Linux) ||
                    RuntimeInformation.IsOSPlatform(OSPlatform.OSX))
            {
                Console.WriteLine("Searching for Linux/macOS ghostscript [GhostscriptService]");
                list.Add("gs");
                list.Add("ghostscript");
                Console.WriteLine("Searching finished-1 for Linux/macOS ghostscript [GhostscriptService]" + list);

                // Console.WriteLine("Searching for bundled ghostscript for snap [GhostscriptService]");
                // string baseDir = AppContext.BaseDirectory;
                // Console.WriteLine("This is the base directory [GhostscriptService]: " + baseDir);
                // string bundledGs = Path.Combine(
                //     baseDir,
                //     "compiled-ghostscript/bin/gs"
                // );
                // Console.WriteLine("Searching finished for bundled ghostscript for snap [GhostscriptService]"  + list);

                // list.Add(bundledGs);
                // Console.WriteLine("Searching finished-2 for Linux/macOS ghostscript [GhostscriptService]" + list);
            }
            else
            {
                throw new PlatformNotSupportedException("Unsupported operating system");
            }
            Console.WriteLine("Returning list as array [GhostscriptService]" + list.ToArray());
            return list.ToArray();
        }
    }
}
