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


using LocalPDF_Studio_api.DAL.Enums;

namespace LocalPDF_Studio_api.DAL.Models.AddPageNumbers
{
    public class AddPageNumbersRequest
    {
        public string FilePath { get; set; } = string.Empty;
        public PageNumberPosition Position { get; set; } = PageNumberPosition.BottomCenter;
        public PageNumberFormat Format { get; set; } = PageNumberFormat.Number;
        public int FontSize { get; set; } = 12;
        public int StartPage { get; set; } = 1;
        public int StartNumber { get; set; } = 1;
    }
}
