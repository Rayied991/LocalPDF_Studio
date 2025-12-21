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


// dotnet publish -c Release -r linux-x64 --self-contained true
// dotnet publish -c Release -r osx-x64 --self-contained true


// src/main/main.js

const { app, BrowserWindow, dialog, ipcMain, shell, Menu } = require('electron/main');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { autoUpdater } = require('electron-updater');
const { PDFDocument } = require('pdf-lib');
const gotTheLock = app.requestSingleInstanceLock();

let apiProcess = null;
let apiPort = null;
let mainWindow = null;
let isDownloading = false;
let lastUpdateStatus = { status: 'No updates checked yet.', details: '' };
let openFileQueue = [];

// Helper to send or queue file paths to renderer
function queueOrSendOpenFile(filePath) {
    try {
        if (mainWindow && mainWindow.webContents) {
            mainWindow.webContents.send('open-file', filePath);
        } else {
            openFileQueue.push(filePath);
        }
    } catch (err) {
        console.error('Failed to send open-file to renderer:', err);
        openFileQueue.push(filePath);
    }
}

// Register macOS open-file handler early so events are captured before ready
app.on('open-file', (event, filePath) => {
    try {
        event.preventDefault();
    } catch (e) { }
    if (filePath && filePath.toLowerCase().endsWith('.pdf')) {
        queueOrSendOpenFile(filePath);
    }
});

// If the app was launched with PDF file paths in argv (common on Windows/Linux), queue them
try {
    if (process && process.argv && Array.isArray(process.argv)) {
        for (const a of process.argv) {
            if (typeof a === 'string' && a.toLowerCase().endsWith('.pdf')) {
                console.log('Found PDF in argv:', a);
                queueOrSendOpenFile(path.resolve(a));
                //break;  // Only process the first PDF
            }
        }
    }
} catch (err) {
    console.error('Error scanning initial argv for PDF files:', err);
}

function startBackend() {
    return new Promise((resolve, reject) => {
        let backendDir = '';
        let backendFile = '';

        switch (process.platform) {
            case 'win32':
                backendDir = './assets/backend_win';
                backendFile = 'LocalPDF_Studio_api.exe';
                break;
            case 'linux':
                backendDir = './assets/backend_linux';
                backendFile = 'LocalPDF_Studio_api';
                break;
            case 'darwin':
                backendDir = './assets/backend_mac';
                backendFile = 'LocalPDF_Studio_api';
                break;
            default:
                const errorMsg = `Your OS (${process.platform}) is not supported.`;
                dialog.showErrorBox('Unsupported OS', errorMsg);
                reject(new Error(errorMsg));
                return;
        }

        const appPath = app.isPackaged ? process.resourcesPath : app.getAppPath();
        const backendPath = path.join(appPath, backendDir, backendFile);

        if (!fs.existsSync(backendPath)) {
            const errorMsg = `Backend executable not found at: ${backendPath}`;
            console.error(errorMsg);
            dialog.showErrorBox('Backend Not Found', errorMsg);
            reject(new Error(errorMsg));
            return;
        }

        try {
            if (process.platform === 'linux' || process.platform === 'darwin') {
                try {
                    fs.chmodSync(backendPath, 0o755);
                } catch (chmodErr) {
                    console.warn(`Could not set executable permissions: ${chmodErr.message}`);
                }
            }

            console.log(`Starting backend from: ${backendPath}`);
            apiProcess = spawn(backendPath);

            apiProcess.stdout.on('data', (data) => {
                const output = data.toString();
                console.log('Backend:', output);
                const match = output.match(/API_PORT:(\d+)/);
                if (match) {
                    apiPort = parseInt(match[1]);
                    console.log(`Backend started on port ${apiPort}`);
                    resolve(apiPort);
                }
            });

            apiProcess.stderr.on('data', (data) => {
                console.error('Backend Error:', data.toString());
            });

            apiProcess.on('error', (err) => {
                console.error('Failed to start backend:', err);
                reject(err);
            });

            apiProcess.on('close', (code) => {
                console.log(`Backend process exited with code ${code}`);
                apiProcess = null;
                apiPort = null;
            });

            apiProcess.on('exit', (code) => {
                console.log(`Backend process exited with code ${code}`);
                apiProcess = null;
                apiPort = null;
            });

            setTimeout(() => {
                if (!apiPort) {
                    const errorMsg = 'Backend failed to start within 60 seconds. Please try again.';
                    console.error(errorMsg);
                    reject(new Error(errorMsg));
                }
            }, 60000);

        } catch (err) {
            console.error('Error starting backend:', err);
            reject(err);
        }
    });
}

const getIcon = () => {
    const base_path = app.isPackaged ? process.resourcesPath : app.getAppPath();
    let iconPath;
    if (process.platform === 'win32') {
        iconPath = path.join(base_path, 'assets/icons/app_icon.ico');
    } else if (process.platform === 'darwin') {
        iconPath = path.join(base_path, 'assets/icons/app_icon_mac.icns');
    } else {
        iconPath = path.join(base_path, 'assets/icons/app_icon_linux.png');
    }
    return fs.existsSync(iconPath) ? iconPath : undefined;
};

const createWindow = () => {
    //Menu.setApplicationMenu(null);
    mainWindow = new BrowserWindow({
        minWidth: 700,
        minHeight: 600,
        icon: getIcon(),
        backgroundColor: '#2c3e50',
        webPreferences: {
            preload: path.resolve(app.getAppPath(), 'src/preload/preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false
        }
    });

    mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
        const parsedUrl = new URL(navigationUrl);
        if (parsedUrl.protocol === 'file:') return;
        event.preventDefault();
    });

    //Prevent PDF files from being opened in Chrome's PDF viewer
    mainWindow.webContents.on('will-prevent-unload', (event) => {
        event.preventDefault();
    });

    // Block navigation to PDF files
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        if (url.toLowerCase().endsWith('.pdf')) {
            console.log('Blocked PDF navigation:', url);
            return { action: 'deny' };
        }
        return { action: 'allow' };
    });

    mainWindow.on('close', (event) => {
        if (isDownloading) {
            event.preventDefault();
            dialog.showMessageBox(mainWindow, {
                type: 'warning',
                title: 'Update in Progress',
                message: 'An update is currently downloading. Please do not close the application.',
                buttons: ['OK']
            });
        }
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    mainWindow.maximize();
    mainWindow.loadFile(path.resolve(app.getAppPath(), 'src/renderer/index.html'));
    
    // Flush queued files once the renderer is ready
    mainWindow.webContents.on('did-finish-load', () => {
        console.log('Window content loaded, flushing open file queue...');
        flushOpenFileQueue();
    });
};

function sendUpdateStatus(status, details = '') {
    lastUpdateStatus = { status, details };
    if (mainWindow) {
        mainWindow.webContents.send('update-status', lastUpdateStatus);
    }
}

function setupAutoUpdater() {
    if (process.platform === 'linux' && process.env.SNAP) {
        console.log('Snap detected — skipping manual auto-updater.');
        sendUpdateStatus('Snap package detected — updates are handled automatically by the Snap Store.');
        return;
    }

    autoUpdater.autoDownload = process.platform === 'win32';

    autoUpdater.on('checking-for-update', () => {
        sendUpdateStatus('Checking for update...');
    });

    autoUpdater.on('update-not-available', () => {
        sendUpdateStatus('No new update is available.');
    });

    autoUpdater.on('update-available', async (info) => {
        if (process.platform === 'linux') {
            try {
                sendUpdateStatus('Downloading update silently...');
                isDownloading = true;
                await autoUpdater.downloadUpdate();
            } catch (err) {
                console.error('Silent auto-update failed on Linux:', err);
                isDownloading = false;
                sendUpdateStatus('Auto-update failed', err.message || 'Unknown error');
                dialog.showMessageBox(mainWindow, {
                    type: 'info',
                    title: 'Manual Update Required',
                    message: 'LocalPDF Studio could not automatically update itself. Please download the latest version manually.',
                    detail: 'Would you like to manually download the latest version?',
                    buttons: ['Open Download Page', 'Later']
                }).then(result => {
                    if (result.response === 0) {
                        shell.openExternal('https://alinur1.github.io/LocalPDF_Studio_Website/');
                    }
                });
            }
        } else if (process.platform === 'darwin') {
            sendUpdateStatus('Update available!', `Version ${info.version} ready to download.`);
            dialog.showMessageBox(mainWindow, {
                type: 'info',
                title: 'Update Available',
                message: 'A new version is available. Automatic updates are disabled for macOS. Open download page?',
                buttons: ['Open Download Page', 'Later']
            }).then(result => {
                if (result.response === 0) {
                    shell.openExternal('https://alinur1.github.io/LocalPDF_Studio_Website/');
                }
            });
        } else {
            sendUpdateStatus('Downloading update...');
            isDownloading = true;
        }
    });

    autoUpdater.on('download-progress', (progressObj) => {
        const progress = progressObj.percent.toFixed(2);
        sendUpdateStatus('Downloading update...', `${progress}%`);
    });

    autoUpdater.on('update-downloaded', () => {
        isDownloading = false;
        sendUpdateStatus('Installing update...');
        dialog.showMessageBox(mainWindow, {
            type: 'info',
            title: 'Update Ready',
            message: 'An update has been downloaded. Restart LocalPDF Studio to apply it now?',
            buttons: ['Restart', 'Later']
        }).then(result => {
            if (result.response === 0) autoUpdater.quitAndInstall();
        });
    });

    autoUpdater.on('error', (err) => {
        isDownloading = false;
        const errorMessage = err == null ? "unknown" : (err.message || err).toString();
        sendUpdateStatus('Update check failed', errorMessage);
        if (process.platform === 'linux') {
            dialog.showMessageBox(mainWindow, {
                type: 'warning',
                title: 'Update Error',
                message: 'Automatic update failed.',
                detail: 'Would you like to manually download the latest version?',
                buttons: ['Open Download Page', 'Ignore']
            }).then(result => {
                if (result.response === 0) {
                    shell.openExternal('https://alinur1.github.io/LocalPDF_Studio_Website/');
                }
            });
        }
    });

    ipcMain.on('check-for-updates', () => {
        autoUpdater.checkForUpdates();
    });

    ipcMain.handle('get-update-status', () => {
        return lastUpdateStatus;
    });

    setTimeout(() => autoUpdater.checkForUpdates(), 60000);
}

if (!gotTheLock) {
    console.log("LocalPDF Studio is already running.");
    // app.whenReady().then(() => {
    //     dialog.showMessageBoxSync({
    //         type: 'info',
    //         buttons: ['OK'],
    //         title: 'Already Running',
    //         message: 'LocalPDF Studio is already running.'
    //     });
    // });
    app.quit();
} else {
    app.on('second-instance', (event, argv, workingDirectory) => {
        // On Windows/Linux a second-instance event may include file paths in argv
        try {
            if (argv && Array.isArray(argv)) {
                // Look for PDF files in argv
                for (const arg of argv) {
                    if (typeof arg === 'string' && arg.toLowerCase().endsWith('.pdf')) {
                        const resolvedPath = path.resolve(workingDirectory, arg);
                        console.log('Opening PDF from second-instance:', resolvedPath);
                        queueOrSendOpenFile(resolvedPath);
                        //break;  // Only process the first PDF
                    }
                }
            }
        } catch (err) {
            console.error('Error processing second-instance args:', err);
        }

        // Bring window to focus
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
        }
    });

    app.whenReady().then(async () => {
        try {
            cleanupTaskFolder(); // Clean up any orphaned files from previous session
            await startBackend();
            createWindow();
            setupAutoUpdater();
        } catch (err) {
            console.error('Failed to initialize app:', err);
            dialog.showErrorBox('Startup Error', `Failed to start the application backend.\n\nError: ${err.message}`);
            app.quit();
        }

        app.on('activate', () => {
            if (BrowserWindow.getAllWindows().length === 0) {
                createWindow();
            }
        });
    });
}

// Flush any queued open-file requests once renderer is ready to receive them
function flushOpenFileQueue() {
    if (!mainWindow || !mainWindow.webContents) return;
    if (openFileQueue.length === 0) return;
    try {
        for (const p of openFileQueue) {
            mainWindow.webContents.send('open-file', p);
        }
    } catch (err) {
        console.error('Failed to flush open file queue:', err);
    } finally {
        openFileQueue = [];
    }
}

// When mainWindow finishes loading its content, flush queued files
app.on('browser-window-created', (event, window) => {
    window.webContents.once('did-finish-load', () => {
        flushOpenFileQueue();
    });
});

app.on('window-all-closed', () => {
    if (apiProcess) {
        try {
            apiProcess.kill();
            console.log('Backend process stopped.');
        } catch (err) {
            console.error('Error killing backend process:', err);
        } finally {
            apiProcess = null;
            apiPort = null;
        }
    }

    setTimeout(() => app.quit(), 200);
});

app.on('before-quit', () => {
    if (apiProcess) {
        try {
            apiProcess.kill();
        } catch (err) {
            console.error('Error killing backend process on quit:', err);
        }
    }
});


// IPC handler to get the API port
ipcMain.handle('get-api-port', () => {
    if (!mainWindow || mainWindow.isDestroyed()) {
        console.warn('get-api-port called with no active window');
    }
    return apiPort;
});

// IPC handler to check if running as Snap
ipcMain.handle('is-snap', () => {
    return process.platform === 'linux' && !!process.env.SNAP;
});

ipcMain.on('open-external-link', (event, url) => {
    if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
        shell.openExternal(url);
    } else {
        console.warn(`Blocked attempt to open non-web URL: ${url}`);
    }
});

ipcMain.handle('select-pdf-files', async () => {
    const result = await dialog.showOpenDialog({
        properties: ['openFile', 'multiSelections'],
        filters: [{ name: 'PDF Files', extensions: ['pdf'] }]
    });
    return result.canceled ? [] : result.filePaths;
});

ipcMain.handle('save-merged-pdf', async (event, arrayBuffer) => {
    const { filePath, canceled } = await dialog.showSaveDialog({
        title: 'Save Merged PDF',
        defaultPath: 'merged.pdf',
        filters: [{ name: 'PDF Files', extensions: ['pdf'] }]
    });

    if (canceled || !filePath) {
        return { success: false };
    }

    try {
        const buffer = Buffer.from(arrayBuffer);
        fs.writeFileSync(filePath, buffer);
        return { success: true, path: filePath };
    } catch (err) {
        console.error("Failed to save PDF:", err);
        return { success: false, error: err.message };
    }
});

ipcMain.handle('save-zip-file', async (event, { filename, buffer }) => {
    const { filePath, canceled } = await dialog.showSaveDialog({
        defaultPath: filename,
        filters: [
            { name: 'ZIP Archive', extensions: ['zip'] },
            { name: 'All Files', extensions: ['*'] }
        ]
    });

    if (canceled || !filePath) {
        return null;
    }

    try {
        let nodeBuffer;
        if (Buffer.isBuffer(buffer)) {
            nodeBuffer = buffer;
        } else if (buffer instanceof ArrayBuffer) {
            nodeBuffer = Buffer.from(new Uint8Array(buffer));
        } else if (ArrayBuffer.isView(buffer)) {
            nodeBuffer = Buffer.from(buffer.buffer, buffer.byteOffset, buffer.byteLength);
        } else {
            throw new Error("Unsupported buffer type received from renderer");
        }

        fs.writeFileSync(filePath, nodeBuffer);
        return filePath;
    } catch (err) {
        console.error("Failed to save file:", err);
        return null;
    }
});

ipcMain.handle('save-pdf-file', async (event, { filename, buffer }) => {
    const { filePath, canceled } = await dialog.showSaveDialog({
        defaultPath: filename,
        filters: [{ name: 'PDF Files', extensions: ['pdf'] }]
    });

    if (canceled || !filePath) {
        return null;
    }

    try {
        let nodeBuffer;
        if (Buffer.isBuffer(buffer)) {
            nodeBuffer = buffer;
        } else if (buffer instanceof ArrayBuffer) {
            nodeBuffer = Buffer.from(new Uint8Array(buffer));
        } else if (ArrayBuffer.isView(buffer)) {
            nodeBuffer = Buffer.from(buffer.buffer, buffer.byteOffset, buffer.byteLength);
        } else {
            throw new Error("Unsupported buffer type received from renderer");
        }

        fs.writeFileSync(filePath, nodeBuffer);
        return filePath;
    } catch (err) {
        console.error("Failed to save file:", err);
        return null;
    }
});

ipcMain.handle('save-pdf-with-metadata', async (event, { filePath, metadata }) => {
    try {
        // Show save dialog
        const { filePath: savedPath, canceled } = await dialog.showSaveDialog({
            defaultPath: path.basename(filePath),
            filters: [{ name: 'PDF Files', extensions: ['pdf'] }]
        });

        if (canceled || !savedPath) {
            return { success: false, error: 'Save dialog was cancelled' };
        }

        // Read the original PDF
        const pdfBytes = fs.readFileSync(filePath);
        const pdfDoc = await PDFDocument.load(pdfBytes);

        // Set metadata
        if (metadata.title) pdfDoc.setTitle(metadata.title);
        if (metadata.author) pdfDoc.setAuthor(metadata.author);
        if (metadata.subject) pdfDoc.setSubject(metadata.subject);
        if (metadata.keywords) pdfDoc.setKeywords(metadata.keywords.split(',').map(k => k.trim()));
        if (metadata.creator) pdfDoc.setCreator(metadata.creator);
        if (metadata.producer) pdfDoc.setProducer(metadata.producer);

        // Save the modified PDF
        const modifiedPdfBytes = await pdfDoc.save();
        fs.writeFileSync(savedPath, modifiedPdfBytes);

        return { success: true, path: savedPath };
    } catch (err) {
        console.error("Failed to save metadata:", err);
        return { success: false, error: err.message };
    }
});

ipcMain.handle('is-app-packaged', () => app.isPackaged);

// Helper function to get the LocalPDF_Studio_Task folder path in Downloads
function getTaskFolderPath() {
    let basePath;
    
    // Handle Snap with strict confinement
    if (process.platform === 'linux' && process.env.SNAP) {
        // Use snap-specific path for confined snaps
        basePath = process.env.SNAP_USER_DATA || process.env.HOME;
        console.log('Snap detected: using SNAP_USER_DATA for task folder');
    } else {
        // Use Downloads folder for Windows, macOS, and unconfined Linux
        basePath = app.getPath('downloads');
    }
    
    return path.join(basePath, 'LocalPDF_Studio_Task');
}

// Helper function to ensure LocalPDF_Studio_Task folder exists
function ensureTaskFolderExists() {
    const taskFolder = getTaskFolderPath();
    if (!fs.existsSync(taskFolder)) {
        try {
            fs.mkdirSync(taskFolder, { recursive: true });
            console.log(`Created LocalPDF_Studio_Task folder at: ${taskFolder}`);
        } catch (err) {
            console.error(`Failed to create LocalPDF_Studio_Task folder:`, err);
            throw err;
        }
    }
    return taskFolder;
}

// Helper function to clean up all files in the LocalPDF_Studio_Task folder
function cleanupTaskFolder() {
    try {
        const taskFolder = getTaskFolderPath();
        if (fs.existsSync(taskFolder)) {
            const files = fs.readdirSync(taskFolder);
            files.forEach(file => {
                const filePath = path.join(taskFolder, file);
                const stats = fs.statSync(filePath);
                if (stats.isFile()) {
                    fs.unlinkSync(filePath);
                    console.log(`Cleaned up orphaned file: ${filePath}`);
                }
            });
        }
    } catch (err) {
        console.error('Error cleaning up task folder:', err);
    }
}

ipcMain.handle('save-dropped-file', async (event, { name, buffer }) => {
    try {
        const taskFolder = ensureTaskFolderExists();
        const filePath = path.join(taskFolder, name);
        fs.writeFileSync(filePath, Buffer.from(buffer));
        console.log(`Saved dropped file to: ${filePath}`);
        return { success: true, filePath: filePath };
    } catch (err) {
        console.error('Failed to save dropped file:', err);
        return { success: false, error: err.message };
    }
});

ipcMain.handle('delete-file', async (event, filePath) => {
    try {
        if (filePath && fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log(`Deleted file: ${filePath}`);
            return { success: true };
        }
        return { success: true }; // File doesn't exist, consider it success
    } catch (err) {
        console.error('Failed to delete file:', err);
        return { success: false, error: err.message };
    }
});