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


// src/renderer/tools/compressPdf/compressPdf.js

import { API } from '../../api/api.js';
import customAlert from '../../utils/customAlert.js';
import loadingUI from '../../utils/loading.js';
import { initializeGlobalDragDrop } from '../../utils/globalDragDrop.js';
import i18n from '../../utils/i18n.js';

document.addEventListener('DOMContentLoaded', async () => {
    await API.init();
    await i18n.init();

    const selectPdfBtn = document.getElementById('select-pdf-btn');
    const removePdfBtn = document.getElementById('remove-pdf-btn');
    const compressBtn = document.getElementById('compress-btn');
    const selectedFileInfo = document.getElementById('selected-file-info');
    const pdfNameEl = document.getElementById('pdf-name');
    const pdfSizeEl = document.getElementById('pdf-size');
    const qualityRadios = document.querySelectorAll('input[name="quality"]');
    const customQualitySection = document.getElementById('custom-quality-section');
    const customQualitySlider = document.getElementById('custom-quality-slider');
    const qualityValue = document.getElementById('quality-value');
    let selectedFile = null;
    let droppedFilePath = null;

    selectPdfBtn.addEventListener('click', async () => {
        // First check if Ghostscript is available
        loadingUI.show('Checking for Ghostscript...');

        try {
            const isGhostscriptAvailable = await checkGhostscriptAvailability();

            if (!isGhostscriptAvailable) {
                loadingUI.hide();
                const result = await customAlert.alert(
                    'LocalPDF Studio - REQUIREMENT',
                    'Ghostscript is required to use the Compress PDF feature.\n' +
                    'Please install Ghostscript on your system to continue:\n\n' +
                    '• Windows: Download from https://www.ghostscript.com/\n' +
                    '• macOS: Install using Homebrew: "brew install ghostscript"\n' +
                    '• Linux: Install using your package manager\n' +
                    '   - Ubuntu/Debian: "sudo apt install ghostscript"\n' +
                    '   - Fedora: "sudo dnf install ghostscript"\n' +
                    '   - Arch: "sudo pacman -S ghostscript"\n' +
                    'Note: Most modern linux distros have ghostscript pre-installed. Checking command=> gs -v',
                    ['OK', 'Tutorial']
                );
                if (result === 'Tutorial') {
                    window.electronAPI.openExternal('https://youtu.be/fKrnSytg_z4');
                }
                return;
            }

            // Ghostscript is available, continue with file selection
            loadingUI.updateMessage('Selecting PDF files...');
            const files = await window.electronAPI.selectPdfs();
            if (files && files.length > 0) {
                const filePath = files[0];
                const fileName = filePath.split(/[\\/]/).pop();
                const fileSize = await getFileSize(filePath);
                handleFileSelected({ path: filePath, name: fileName, size: fileSize });
            }
        } catch (error) {
            console.error('Error during Ghostscript check:', error);
            await customAlert.alert(
                'LocalPDF Studio - ERROR',
                `An error occurred while checking for Ghostscript:\n${error.message}`,
                ['OK']
            );
        } finally {
            loadingUI.hide();
        }
    });

    removePdfBtn.addEventListener('click', async () =>{
        await cleanupDroppedFile();
        clearAll();
    });

    const backBtn = document.querySelector('a[href="../../index.html"]');
    if (backBtn) {
        backBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            await cleanupDroppedFile();
            clearAll();
            window.location.href = '../../index.html';
        });
    }

    async function checkGhostscriptAvailability() {
        try {
            console.log('Checking Ghostscript endpoint...');
            const checkEndpoint = await API.ghostscript.check();
            console.log('Endpoint:', checkEndpoint);
            const response = await fetch(checkEndpoint, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });
            console.log('Response status:', response.status);
            if (response.ok) {
                const result = await response.json();
                console.log('Ghostscript check result:', result);
                return result.available === true;
            }
            return false;
        } catch (error) {
            console.error('Error checking Ghostscript:', error);
            return false;
        }
    }

    function handleFileSelected(file) {
        clearAll(true);
        selectedFile = file;
        pdfNameEl.textContent = file.name;
        pdfSizeEl.textContent = `(${formatFileSize(file.size)})`;
        selectPdfBtn.style.display = 'none';
        selectedFileInfo.style.display = 'flex';
        compressBtn.disabled = false;
    }

    function clearAll(preserveDroppedFilePath = false) {
        selectedFile = null;
        if (!preserveDroppedFilePath) {
            droppedFilePath = null;
        }
        selectedFileInfo.style.display = 'none';
        selectPdfBtn.style.display = 'block';
        compressBtn.disabled = true;
    }

    qualityRadios.forEach(radio => {
        radio.addEventListener('change', () => {
            if (radio.value === 'custom') {
                customQualitySection.style.display = 'block';
            } else {
                customQualitySection.style.display = 'none';
            }
        });
    });

    customQualitySlider.addEventListener('input', () => {
        qualityValue.textContent = customQualitySlider.value;
    });

    function getSelectedQuality() {
        const selected = document.querySelector('input[name="quality"]:checked');
        if (selected.value === 'custom') {
            return {
                level: 'custom',
                value: parseInt(customQualitySlider.value)
            };
        }
        return { level: selected.value };
    }

    compressBtn.addEventListener('click', async () => {
        if (!selectedFile) {
            await customAlert.alert('LocalPDF Studio - NOTICE', 'Please select a file first.', ['OK']);
            return;
        }

        // Double-check Ghostscript availability before compression
        loadingUI.show('Verifying Ghostscript...');
        try {
            const isGhostscriptAvailable = await checkGhostscriptAvailability();
            if (!isGhostscriptAvailable) {
                loadingUI.hide();
                await customAlert.alert(
                    'LocalPDF Studio - REQUIREMENT',
                    'Ghostscript is no longer available. Please ensure Ghostscript is installed and try again.',
                    ['OK']
                );
                return;
            }
        } catch (error) {
            loadingUI.hide();
            await customAlert.alert(
                'LocalPDF Studio - ERROR',
                `Failed to verify Ghostscript:\n${error.message}`,
                ['OK']
            );
            return;
        }

        const quality = getSelectedQuality();
        const options = buildCompressOptions(quality);
        const requestBody = {
            filePath: selectedFile.path,
            options: options
        };

        try {
            loadingUI.show('Compressing PDF...This may take a while for large files.');
            compressBtn.disabled = true;
            compressBtn.textContent = 'Compressing...';
            const compressEndpoint = await API.pdf.compress;
            const response = await fetch(compressEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(errText || `Request failed with status ${response.status}`);
            }

            const originalSize = parseInt(response.headers.get('X-Original-Size') || '0');
            const compressedSize = parseInt(response.headers.get('X-Compressed-Size') || '0');
            const compressionRatio = parseFloat(response.headers.get('X-Compression-Ratio') || '0');
            const result = await response.blob();
            const arrayBuffer = await result.arrayBuffer();
            const defaultName = `${selectedFile.name.replace('.pdf', '')}_compressed.pdf`;
            const savedPath = await window.electronAPI.savePdfFile(defaultName, arrayBuffer);

            if (savedPath) {
                const message = originalSize > 0
                    ? `Success! PDF compressed successfully!\n\n` +
                    `Original Size: ${formatFileSize(originalSize)}\n` +
                    `Compressed Size: ${formatFileSize(compressedSize)}\n` +
                    `Space Saved: ${compressionRatio.toFixed(1)}%\n\n` +
                    `Saved to: ${savedPath}`
                    : `Success! PDF compressed successfully!\nSaved to: ${savedPath}`;
                await customAlert.alert('LocalPDF Studio - SUCCESS', message, ['OK']);
            } else {
                await customAlert.alert('LocalPDF Studio - WARNING', 'Operation cancelled or failed to save the file.', ['OK']);
            }
        } catch (error) {
            console.error('Error compressing PDF:', error);
            await customAlert.alert('LocalPDF Studio - ERROR', `An error occurred while compressing the PDF:\n${error.message}`, ['OK']);
        } finally {
            loadingUI.forceHide();
            compressBtn.disabled = false;
            compressBtn.textContent = 'Compress PDF';
        }
    });

    function buildCompressOptions(quality) {
        let qualityEnum;
        let customQuality = null;

        switch (quality.level) {
            case 'low':
                qualityEnum = 0;
                break;
            case 'medium':
                qualityEnum = 1;
                break;
            case 'high':
                qualityEnum = 2;
                break;
            case 'custom':
                qualityEnum = 3;
                customQuality = quality.value;
                break;
            default:
                qualityEnum = 1;
        }
        return {
            quality: qualityEnum,
            customQuality: customQuality,
        };
    }

    function formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
    }

    async function getFileSize(filePath) {
        try {
            if (window.electronAPI?.getFileInfo) {
                const info = await window.electronAPI.getFileInfo(filePath);
                return info.size || 0;
            }
            return 0;
        } catch {
            return 0;
        }
    }

    async function cleanupDroppedFile() {
        if (droppedFilePath) {
            try {
                await window.electronAPI.deleteFile(droppedFilePath);
                droppedFilePath = null;
            } catch (error) {
                console.error('Error cleaning up dropped file:', error);
            }
        }
    }

    initializeGlobalDragDrop({
        onFilesDropped: async (pdfFiles) => {
            if (pdfFiles.length > 1) {
                await customAlert.alert('LocalPDF Studio - NOTICE', 'Please drop only one PDF file.', ['OK']);
                return;
            }

            // Check if Ghostscript is available
            loadingUI.show('Checking for Ghostscript...');
            try {
                const isGhostscriptAvailable = await checkGhostscriptAvailability();

                if (!isGhostscriptAvailable) {
                    loadingUI.hide();
                    const result = await customAlert.alert(
                        'LocalPDF Studio - REQUIREMENT',
                        'Ghostscript is required to use the Compress PDF feature.\n' +
                        'Please install Ghostscript on your system to continue:\n\n' +
                        '• Windows: Download from https://www.ghostscript.com/\n' +
                        '• macOS: Install using Homebrew: "brew install ghostscript"\n' +
                        '• Linux: Install using your package manager\n' +
                        '   - Ubuntu/Debian: "sudo apt install ghostscript"\n' +
                        '   - Fedora: "sudo dnf install ghostscript"\n' +
                        '   - Arch: "sudo pacman -S ghostscript"\n' +
                        'Note: Most modern linux distros have ghostscript pre-installed. Checking command=> gs -v',
                        ['OK', 'Tutorial']
                    );
                    if (result === 'Tutorial') {
                        window.electronAPI.openExternal('https://youtu.be/fKrnSytg_z4');
                    }
                    return;
                }

                // Ghostscript is available, proceed with file processing
                loadingUI.updateMessage('Processing dropped file...');
                await cleanupDroppedFile();
                const file = pdfFiles[0];
                const buffer = await file.arrayBuffer();
                const saveResult = await window.electronAPI.saveDroppedFile({
                    name: file.name,
                    buffer: buffer
                });
                if (saveResult.success) {
                    const fileSize = file.size || 0;
                    droppedFilePath = saveResult.filePath;
                    handleFileSelected({
                        path: saveResult.filePath,
                        name: file.name,
                        size: fileSize
                    });
                } else {
                    await customAlert.alert('LocalPDF Studio - ERROR', `Failed to save dropped file: ${saveResult.error}`, ['OK']);
                }
            } catch (error) {
                console.error('Error during Ghostscript check:', error);
                await customAlert.alert(
                    'LocalPDF Studio - ERROR',
                    `An error occurred while checking for Ghostscript:\n${error.message}`,
                    ['OK']
                );
            } finally {
                loadingUI.hide();
            }
        },
        onInvalidFiles: async () => {
            await customAlert.alert('LocalPDF Studio - NOTICE', 'Please drop a PDF file.', ['OK']);
        }
    });
});
