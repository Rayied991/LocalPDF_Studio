/**
 * LocalPDF Studio - Offline PDF Toolkit
 * ======================================
 * 
 * @author      Md. Alinur Hossain <alinur1160@gmail.com>
 * @license     AGPL 3.0 (GNU Affero General Public License version 3)
 * @website     https://alinur1.github.io/LocalPDF_Studio_Website/
 * @repository  https://github.com/Alinur1/LocalPDF_Studio
 * 
 * Copyright (c) 2025 Md. Alinur Hossain. All rights reserved.
 * 
 * Architecture:
 * - Frontend: Electron + HTML/CSS/JS
 * - Backend: ASP.NET Core Web API, Python
 * - PDF Engine: PdfSharp + Mozilla PDF.js
**/


using System.Text.Json.Serialization;

namespace LocalPDF_Studio_api.DAL.Models.PdfExtractImages
{
    public class PythonImageResult
    {
        [JsonPropertyName("success")]
        public bool Success { get; set; }

        [JsonPropertyName("error")]
        public string Error { get; set; }

        [JsonPropertyName("extracted_count")]
        public int ExtractedCount { get; set; }

        [JsonPropertyName("processed_pages")]
        public int ProcessedPages { get; set; }

        [JsonPropertyName("images")]
        public List<PythonImage> Images { get; set; } = new();

        [JsonPropertyName("pdf_data")] // This matches the Python JSON key
        public string PdfData { get; set; }

        [JsonPropertyName("removed_images_count")]
        public int RemovedImagesCount { get; set; }
    }
}
