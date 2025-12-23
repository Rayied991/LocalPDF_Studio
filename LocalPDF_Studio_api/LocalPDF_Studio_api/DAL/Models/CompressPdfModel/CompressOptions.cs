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

namespace LocalPDF_Studio_api.DAL.Models.CompressPdfModel
{
    public class CompressOptions
    {
        public CompressionQuality Quality { get; set; } = CompressionQuality.Medium;
        public int? CustomQuality { get; set; }
        public int GetQualityValue()
        {
            return Quality switch
            {
                CompressionQuality.Low => 50,
                CompressionQuality.Medium => 75,
                CompressionQuality.High => 90,
                CompressionQuality.Custom => CustomQuality ?? 75,
                _ => 75
            };
        }
    }
}
