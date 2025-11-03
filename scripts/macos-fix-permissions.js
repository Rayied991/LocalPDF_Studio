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
