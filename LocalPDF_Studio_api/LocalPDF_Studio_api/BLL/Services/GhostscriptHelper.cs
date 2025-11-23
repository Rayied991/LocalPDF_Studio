using System.Diagnostics;
using System.Runtime.InteropServices;

namespace LocalPDF_Studio_api.BLL.Services
{
    public static class GhostscriptHelper
    {
        private static readonly string[] MacOSGhostscriptPaths = new[]
        {
            "/usr/local/bin/gs",                    // Homebrew (Intel)
            "/opt/homebrew/bin/gs",                 // Homebrew (Apple Silicon)
            "/opt/local/bin/gs",                    // MacPorts
            "/sw/bin/gs",                           // Fink
            "/usr/local/ghostscript/bin/gs",        // Manual installation
            "/Applications/Ghostscript/bin/gs"      // Alternative location
        };

        public static (string fileName, string arguments) GetShellCommand(string processName, string arguments)
        {
            if (RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
            {
                return (processName, arguments);
            }
            else if (RuntimeInformation.IsOSPlatform(OSPlatform.OSX))
            {
                return ("/bin/bash", $"-l -c \"{processName} {arguments}\"");
            }
            else
            {
                return ("/bin/bash", $"-c \"{processName} {arguments}\"");
            }
        }

        public static string[] GetGhostscriptProcessNames()
        {
            var list = new List<string>();

            if (RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
            {
                Console.WriteLine("Searching for Windows ghostscript [GhostscriptHelper]");
                list.Add("gswin64c.exe");
                list.Add("gswin32c.exe");
                list.Add("gs.exe");
                Console.WriteLine("Searching finished for Windows ghostscript [GhostscriptHelper]");
            }
            else if (RuntimeInformation.IsOSPlatform(OSPlatform.OSX))
            {
                Console.WriteLine("Searching for macOS ghostscript [GhostscriptHelper]");
                foreach (var path in MacOSGhostscriptPaths)
                {
                    if (File.Exists(path))
                    {
                        Console.WriteLine($"[GS_DEBUG] Found Ghostscript at: {path}");
                        list.Add(path);
                    }
                }
                list.Add("gs");
                list.Add("ghostscript");
                
                Console.WriteLine("Searching finished for macOS ghostscript [GhostscriptHelper]");
            }
            else if (RuntimeInformation.IsOSPlatform(OSPlatform.Linux))
            {
                Console.WriteLine("Searching for Linux ghostscript [GhostscriptHelper]");
                list.Add("gs");
                list.Add("ghostscript");
                Console.WriteLine("Searching finished for Linux ghostscript [GhostscriptHelper]");
            }
            else
            {
                throw new PlatformNotSupportedException("Unsupported operating system");
            }

            Console.WriteLine($"[GS_DEBUG] Ghostscript process names: {string.Join(", ", list)}");
            return list.ToArray();
        }

        public static async Task<(int exitCode, string output, string error)> ExecuteGhostscriptCommandAsync(
            string processName, 
            string arguments)
        {
            try
            {
                var (fileName, shellArguments) = GetShellCommand(processName, arguments);
                
                Console.WriteLine($"[GS_DEBUG] Attempting to run command: {processName} {arguments}");
                
                using var process = new Process();
                process.StartInfo = new ProcessStartInfo
                {
                    FileName = fileName,
                    Arguments = shellArguments,
                    UseShellExecute = false,
                    RedirectStandardOutput = true,
                    RedirectStandardError = true,
                    CreateNoWindow = true
                };

                if (!process.StartInfo.EnvironmentVariables.ContainsKey("PATH"))
                {
                    var pathVar = Environment.GetEnvironmentVariable("PATH");
                    if (!string.IsNullOrEmpty(pathVar))
                    {
                        process.StartInfo.EnvironmentVariables["PATH"] = pathVar;
                    }
                }

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

                return (process.ExitCode, output.Trim(), error.Trim());
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[GS_DEBUG] Exception executing process: {ex.Message}");
                return (-1, string.Empty, ex.Message);
            }
        }

        public static bool ExecutableExists(string executableName)
        {
            try
            {
                var process = new Process
                {
                    StartInfo = new ProcessStartInfo
                    {
                        FileName = executableName,
                        Arguments = "--version",
                        UseShellExecute = false,
                        RedirectStandardOutput = true,
                        RedirectStandardError = true,
                        CreateNoWindow = true
                    }
                };
                process.Start();
                process.WaitForExit(1000);
                return process.ExitCode == 0;
            }
            catch
            {
                return false;
            }
        }
    }
}
