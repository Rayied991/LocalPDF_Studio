/**
 * LocalPDF Studio - Offline PDF Toolkit
 * ======================================
 * 
 * @author      Md. Alinur Hossain <alinur1160@gmail.com>
 * @license     MPL-2.0 (Mozilla Public License 2.0)
 * @website     https://alinur1.github.io/LocalPDF_Studio_Website/
 * @repository  https://github.com/Alinur1/LocalPDF_Studio
 * 
 * Copyright (c) 2025 Md. Alinur Hossain. All rights reserved.
 * 
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 * 
 * Architecture:
 * - Frontend: Electron + HTML/CSS/JS
 * - Backend: ASP.NET Core Web API, Python
 * - PDF Engine: PdfSharp + Mozilla PDF.js
**/


// LocalPDF_Studio_api.BLL.Services/PdfCompressService.cs

using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text.Json;
using LocalPDF_Studio_api.BLL.Interfaces;
using LocalPDF_Studio_api.DAL.Enums;
using LocalPDF_Studio_api.DAL.Models.CompressPdfModel;

namespace LocalPDF_Studio_api.BLL.Services
{
    public class PdfCompressService : IPdfCompressInterface
    {
        private readonly IGhostscriptInterface _ghostscriptInterface;

        public PdfCompressService(IGhostscriptInterface ghostscriptInterface)
        {
            _ghostscriptInterface = ghostscriptInterface;
        }

        public async Task<bool> IsCompressionAvailableAsync()
        {
            return await _ghostscriptInterface.IsGhostscriptAvailableAsync();
        }

        public async Task<CompressResult> CompressPdfAsync(string filePath, CompressOptions options)
        {
            if (!File.Exists(filePath))
                throw new FileNotFoundException($"File not found: {filePath}");

            if (options == null)
                throw new ArgumentNullException(nameof(options), "Compress options cannot be null");

            // Validate custom quality if using custom mode
            if (options.Quality == CompressionQuality.Custom)
            {
                if (!options.CustomQuality.HasValue || options.CustomQuality.Value < 1 || options.CustomQuality.Value > 100)
                    throw new ArgumentException("Custom quality must be between 1 and 100");
            }

            // Check if Ghostscript is available before proceeding
            if (!await IsCompressionAvailableAsync())
            {
                return new CompressResult
                {
                    Success = false,
                    Error = "Ghostscript is not available. Please install Ghostscript to use compression features."
                };
            }

            try
            {
                // Get original file size
                var originalFileInfo = new FileInfo(filePath);
                long originalSize = originalFileInfo.Length;

                // Create temporary output path
                string tempOutputPath = Path.Combine(
                    Path.GetTempPath(),
                    $"compressed_{Guid.NewGuid()}.pdf"
                );

                try
                {
                    // Run Ghostscript compression
                    var compressionResult = await RunGhostscriptCompressionAsync(
                        filePath,
                        tempOutputPath,
                        options
                    );

                    if (!compressionResult.Success)
                    {
                        return new CompressResult
                        {
                            Success = false,
                            Error = compressionResult.Error ?? "Unknown compression error"
                        };
                    }

                    // Read the compressed file
                    byte[] compressedData = await File.ReadAllBytesAsync(tempOutputPath);
                    long compressedSize = compressedData.Length;

                    // Calculate compression ratio
                    double compressionRatio = originalSize > 0
                        ? ((double)(originalSize - compressedSize) / originalSize) * 100
                        : 0;

                    return new CompressResult
                    {
                        Success = true,
                        CompressedData = compressedData,
                        OriginalSize = originalSize,
                        CompressedSize = compressedSize,
                        CompressionRatio = Math.Round(compressionRatio, 2)
                    };
                }
                finally
                {
                    // Clean up temporary file
                    if (File.Exists(tempOutputPath))
                    {
                        try
                        {
                            File.Delete(tempOutputPath);
                        }
                        catch
                        {
                            // Ignoring cleanup errors
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                return new CompressResult
                {
                    Success = false,
                    Error = $"Error compressing PDF: {ex.Message}"
                };
            }
        }

        private async Task<CompressResult> RunGhostscriptCompressionAsync(
            string inputPath,
            string outputPath,
            CompressOptions options)
        {
            try
            {
                var ghostscriptCommand = BuildGhostscriptCommand(inputPath, outputPath, options);
                var processName = GetGhostscriptProcessName();

                var (exitCode, output, error) = await GhostscriptHelper.ExecuteGhostscriptCommandAsync(
                    processName,
                    ghostscriptCommand
                );

                if (exitCode == 0 && File.Exists(outputPath))
                {
                    return new CompressResult { Success = true };
                }
                else
                {
                    return new CompressResult
                    {
                        Success = false,
                        Error = $"Ghostscript compression failed. Exit code: {exitCode}. Error: {error}"
                    };
                }
            }
            catch (Exception ex)
            {
                return new CompressResult
                {
                    Success = false,
                    Error = $"Failed to run Ghostscript compression: {ex.Message}"
                };
            }
        }

private string BuildGhostscriptCommand(string inputPath, string outputPath, CompressOptions options)
        {
            string fullInputPath = Path.GetFullPath(inputPath);
            string fullOutputPath = Path.GetFullPath(outputPath);            
            string quotedInputPath = $"'{fullInputPath.Replace("'", @"\'")}'";
            string quotedOutputPath = $"'{fullOutputPath.Replace("'", @"\'")}'";
            var quality = options.GetQualityValue();
            var dpi = quality >= 80 ? "150" : quality >= 60 ? "120" : "96";

            var commands = new List<string>
            {
                    "-dNOPAUSE",
                    "-dBATCH",
                    "-dSAFER",

                    // Force PDFSharp compatibility
                    "-dCompatibilityLevel=1.4",
                    "-dCompressObjects=false",
                    "-dAvoidBinarySnippets=true",
                    "-dDetectDuplicateImages=false",

                    "-sDEVICE=pdfwrite",

                    // Keep quality profiles
                    $"-dPDFSETTINGS=/{GetPdfSettings(options.Quality)}",

                    // Font settings
                    "-dEmbedAllFonts=true",
                    "-dSubsetFonts=true",

                    // Image downsampling
                    $"-dColorImageDownsampleType=/Bicubic",
                    $"-dColorImageResolution={dpi}",
                    $"-dGrayImageDownsampleType=/Bicubic",
                    $"-dGrayImageResolution={dpi}",
                    $"-dMonoImageDownsampleType=/Bicubic",
                    $"-dMonoImageResolution={dpi}",

                    // Image filters — important for PDFSharp
                    "-dColorImageFilter=/FlateEncode",
                    "-dGrayImageFilter=/FlateEncode",
                    "-dMonoImageFilter=/FlateEncode",

                    // Output file (using single quotes)
                    $"-sOutputFile={quotedOutputPath}",

                    // Input file (using single quotes)
                    quotedInputPath
            };

            return string.Join(" ", commands);
        }

        private string GetPdfSettings(CompressionQuality quality)
        {
            return quality switch
            {
                CompressionQuality.High => "prepress",    // High quality, color preserving
                CompressionQuality.Medium => "ebook",     // Medium quality
                CompressionQuality.Low => "screen",       // Low quality, smallest size
                CompressionQuality.Custom => "ebook",     // Default for custom
                _ => "ebook"
            };
        }

        private string GetGhostscriptProcessName()
        {
            Console.WriteLine("Searching for Ghostscript executable [PdfCompressService]");
            
            if (RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
            {
                // Try to find the first available Ghostscript executable
                var executables = new[] { "gswin64c.exe", "gswin32c.exe", "gs.exe" };
                foreach (var exe in executables)
                {
                    if (GhostscriptHelper.ExecutableExists(exe))
                    {
                        Console.WriteLine($"[GS_DEBUG] Found executable: {exe}");
                        return exe;
                    }
                }
                // Return default if none found (will be resolved from PATH)
                Console.WriteLine("[GS_DEBUG] No specific executable found, using default: gswin64c.exe");
                return "gswin64c.exe";
            }
            
            Console.WriteLine("Using system ghostscript (gs)");
            return "gs";
        }
    }
}