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


namespace LocalPDF_Studio_api.DAL.Models.PdfToImageModel
{
    public class PdfToImageRequest
    {
        // Full path to the PDF file
        public string FilePath { get; set; } = string.Empty;

        // DPI (Dots Per Inch) for image quality
        // Common values: 72 (low), 150 (medium), 300 (high)
        public int Dpi { get; set; } = 150;

        // Output format: "jpg" or "png"
        public string Format { get; set; } = "jpg";

        // Whether to include page numbers in filenames
        // e.g., document_page_001.jpg, document_page_002.jpg
        public bool IncludePageNumbers { get; set; } = true;
    }
}
