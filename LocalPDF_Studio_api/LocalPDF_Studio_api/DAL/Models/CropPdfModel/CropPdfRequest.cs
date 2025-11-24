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


namespace LocalPDF_Studio_api.DAL.Models.CropPdfModel
{
    public class CropPdfRequest
    {
        public string FilePath { get; set; } = string.Empty;

        // Frontend: "all", "current", or "custom"
        public string PagesRange { get; set; } = "all";

        // Frontend: "1, 2-3, 5"
        public string? CustomPages { get; set; }

        // Margin values (in points)
        public CropMargins Margins { get; set; } = new();

        // Optional current page index if future use
        public int? CurrentPage { get; set; }
    }
}
