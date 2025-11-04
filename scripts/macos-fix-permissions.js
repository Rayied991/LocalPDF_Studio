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


// scripts/macos-fix-permissions.js

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

exports.default = async function (context) {
    const appPath = context.appOutDir;
    const backendDir = path.join(
        appPath,
        "LocalPDF Studio.app/Contents/Resources/assets/backend_mac"
    );

    if (!fs.existsSync(backendDir)) {
        console.warn("⚠️ Backend directory not found:", backendDir);
        return;
    }

    console.log("🔧 Fixing permissions in:", backendDir);
    const files = fs.readdirSync(backendDir);
    for (const file of files) {
        const fullPath = path.join(backendDir, file);
        try {
            fs.chmodSync(fullPath, 0o755);
            execSync(`xattr -d com.apple.quarantine "${fullPath}" || true`);
            console.log("✅ Set +x and cleared quarantine for:", file);
        } catch (err) {
            console.warn("⚠️ Could not modify:", file, err.message);
        }
    }
};
