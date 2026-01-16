// src/renderer/tools/redactPdf/redactPdf.js

import { API } from '../../api/api.js';
import * as pdfjsLib from '../../../pdf/build/pdf.mjs';
import customAlert from '../../utils/customAlert.js';
import loadingUI from '../../utils/loading.js';
import { initializeGlobalDragDrop } from '../../utils/globalDragDrop.js';

pdfjsLib.GlobalWorkerOptions.workerSrc = '../../../pdf/build/pdf.worker.mjs';

document.addEventListener('DOMContentLoaded', async () => {
    await API.init();

    const selectBtn = document.getElementById('select-pdf-btn');
    const applyBtn = document.getElementById('apply-redactions-btn');
    const clearBtn = document.getElementById('clear-redactions-btn');
    const pageInput = document.getElementById('page-input');
    const zoomInBtn = document.getElementById('zoom-in-btn');
    const zoomOutBtn = document.getElementById('zoom-out-btn');
    const zoomFitBtn = document.getElementById('zoom-fit-btn');
    const canvasWrapper = document.getElementById('canvas-wrapper');
    const thumbnailList = document.getElementById('thumbnail-list');

    let pdfDocument = null;
    let currentPage = 1;
    let totalPages = 0;
    let currentFilePath = null;
    let zoomLevel = 1.0;
    let redactionColor = '#000000';
    let redactions = {}; // { pageNum: [{x, y, width, height, color}] }
    let droppedFilePath = null;
    
    // Page cache for rendering
    let pageCache = {}; // { pageNum: { canvas, redactionCanvas, viewport } }
    let pageElements = {}; // { pageNum: { container, pdfCanvas, redactionCanvas } }
    let renderQueue = []; // Queue of pages to render
    let isRendering = false;

    // Initialize color buttons
    const colorButtons = document.querySelectorAll('.color-btn');
    colorButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            colorButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            redactionColor = btn.dataset.color;
        });
    });

    // Select PDF
    selectBtn.addEventListener('click', async () => {
        loadingUI.show("Selecting PDF file...");
        if (droppedFilePath) {
            await window.electronAPI.deleteFile(droppedFilePath);
        }
        const selected = await window.electronAPI.selectPdfs();
        if (selected?.length) {
            await loadPdf(selected[0]);
        }
        loadingUI.hide();
    });

    // Clear all redactions
    clearBtn.addEventListener('click', async () => {
        const result = await customAlert.alert(
            'LocalPDF Studio - CONFIRM',
            'Are you sure you want to clear all redactions?',
            ['Cancel', 'Clear All']
        );
        if (result === 'Clear All') {
            redactions = {};
            renderCurrentPage();
            updateUI();
        }
    });

    // Apply redactions
    applyBtn.addEventListener('click', async () => {
        if (!currentFilePath || Object.keys(redactions).length === 0) {
            await customAlert.alert(
                'LocalPDF Studio - NOTICE',
                'Please add at least one redaction before applying.',
                ['OK']
            );
            return;
        }

        try {
            loadingUI.show('Applying redactions...');

            // Prepare redaction data for API
            const redactionData = {
                file: currentFilePath,
                redactions: Object.entries(redactions).flatMap(([page, rects]) =>
                    rects.map(rect => ({
                        page: parseInt(page),
                        x: rect.x,
                        y: rect.y,
                        width: rect.width,
                        height: rect.height,
                        color: rect.color
                    }))
                )
            };

            const redactEndpoint = await API.pdf.redact;
            const blob = await API.request.post(redactEndpoint, redactionData);
            const arrayBuffer = await blob.arrayBuffer();
            const result = await window.electronAPI.savePdfFile('redacted.pdf', arrayBuffer);

            if (result.success) {
                await customAlert.alert(
                    'LocalPDF Studio - SUCCESS',
                    'PDF redacted successfully!',
                    ['OK']
                );
                // Clear redactions after successful save
                redactions = {};
                renderCurrentPage();
                updateUI();
            } else {
                await customAlert.alert(
                    'LocalPDF Studio - WARNING',
                    'Save canceled.',
                    ['OK']
                );
            }
        } catch (err) {
            console.error(err);
            await customAlert.alert(
                'LocalPDF Studio - ERROR',
                'Error applying redactions: ' + err.message,
                ['OK']
            );
        } finally {
            loadingUI.hide();
        }
    });

    // Page navigation
    prevBtn.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            renderCurrentPage();
        }
    });

    nextBtn.addEventListener('click', () => {
        if (currentPage < totalPages) {
            currentPage++;
            renderCurrentPage();
        }
    });

    pageInput.addEventListener('change', (e) => {
        const page = parseInt(e.target.value);
        if (page >= 1 && page <= totalPages) {
            currentPage = page;
            renderCurrentPage();
        } else {
            e.target.value = currentPage;
        }
    });

    // Zoom controls
    zoomInBtn.addEventListener('click', () => {
        zoomLevel = Math.min(zoomLevel + 0.25, 3.0);
        renderCurrentPage();
    });

    zoomOutBtn.addEventListener('click', () => {
        zoomLevel = Math.max(zoomLevel - 0.25, 0.5);
        renderCurrentPage();
    });

    zoomFitBtn.addEventListener('click', () => {
        zoomLevel = 1.0;
        renderCurrentPage();
    });

    let scrollTimeout = null;
    let lastScrollTime = 0;
    const SCROLL_THRESHOLD = 300; // ms between page changes

    // Smooth page scrolling with mouse wheel
    canvasWrapper.addEventListener('wheel', (e) => {
        if (!pdfDocument) return;

        const now = Date.now();
        
        // Check if we can scroll within the page (zoom > 1)
        if (zoomLevel > 1) {
            const canScrollInternally = canvasWrapper.scrollHeight > canvasWrapper.clientHeight;
            const isAtTop = canvasWrapper.scrollTop < 5;
            const isAtBottom = canvasWrapper.scrollTop + canvasWrapper.clientHeight >= canvasWrapper.scrollHeight - 5;

            // Allow normal scrolling when zoomed and not at boundaries
            if (canScrollInternally && !isAtTop && !isAtBottom) {
                return;
            }
        }

        // Debounce page changes to prevent rapid navigation
        if (now - lastScrollTime < SCROLL_THRESHOLD) {
            return;
        }

        // Page navigation at boundaries
        if (e.deltaY > 0) {
            // Scroll down - go to next page
            if (currentPage < totalPages && (zoomLevel <= 1 || canvasWrapper.scrollTop + canvasWrapper.clientHeight >= canvasWrapper.scrollHeight - 5)) {
                e.preventDefault();
                lastScrollTime = now;
                currentPage++;
                canvasWrapper.scrollTop = 0;
                renderCurrentPage();
            }
        } else {
            // Scroll up - go to previous page
            if (currentPage > 1 && (zoomLevel <= 1 || canvasWrapper.scrollTop < 5)) {
                e.preventDefault();
                lastScrollTime = now;
                currentPage--;
                canvasWrapper.scrollTop = 0;
                renderCurrentPage();
            }
        }
    }, { passive: true });

    // Redaction drawing
    redactionCanvas.addEventListener('mousedown', (e) => {
        if (!pdfDocument) return;

        const rect = pdfCanvas.getBoundingClientRect();
        const scrollX = canvasWrapper.scrollLeft;
        const scrollY = canvasWrapper.scrollTop;
        
        const mouseX = e.clientX - rect.left + scrollX;
        const mouseY = e.clientY - rect.top + scrollY;

        // Check if clicking on an existing redaction to delete it
        const pageRedactions = redactions[currentPage] || [];
        let clickedRedactionIndex = -1;

        for (let i = pageRedactions.length - 1; i >= 0; i--) {
            const redact = pageRedactions[i];
            const x = redact.x * redactionCanvas.width;
            const y = redact.y * redactionCanvas.height;
            const w = redact.width * redactionCanvas.width;
            const h = redact.height * redactionCanvas.height;

            if (mouseX >= x && mouseX <= x + w && mouseY >= y && mouseY <= y + h) {
                clickedRedactionIndex = i;
                break;
            }
        }

        // If clicked on a redaction, delete it
        if (clickedRedactionIndex !== -1) {
            pageRedactions.splice(clickedRedactionIndex, 1);
            if (pageRedactions.length === 0) {
                delete redactions[currentPage];
            }
            drawRedactions();
            updateUI();
            hoveredRedactionIndex = -1;
            return;
        }

        // Otherwise, start drawing a new redaction
        isDrawing = true;
        startX = mouseX;
        startY = mouseY;
    });

    redactionCanvas.addEventListener('mousemove', (e) => {
        if (!isDrawing) return;
        const rect = pdfCanvas.getBoundingClientRect();
        const scrollX = canvasWrapper.scrollLeft;
        const scrollY = canvasWrapper.scrollTop;
        
        const currentX = e.clientX - rect.left + scrollX;
        const currentY = e.clientY - rect.top + scrollY;

        // Clear and redraw all redactions plus current
        drawRedactions();

        // Draw current rectangle
        const ctx = redactionCanvas.getContext('2d');
        ctx.fillStyle = redactionColor;
        ctx.globalAlpha = 0.5;
        ctx.fillRect(startX, startY, currentX - startX, currentY - startY);
        ctx.globalAlpha = 1.0;
        ctx.strokeStyle = '#3498db';
        ctx.lineWidth = 2;
        ctx.strokeRect(startX, startY, currentX - startX, currentY - startY);
    });

    redactionCanvas.addEventListener('mouseup', (e) => {
        if (!isDrawing) return;
        isDrawing = false;
        const rect = pdfCanvas.getBoundingClientRect();
        const scrollX = canvasWrapper.scrollLeft;
        const scrollY = canvasWrapper.scrollTop;
        
        const endX = e.clientX - rect.left + scrollX;
        const endY = e.clientY - rect.top + scrollY;

        const width = endX - startX;
        const height = endY - startY;

        // Only add if rectangle has meaningful size
        if (Math.abs(width) > 5 && Math.abs(height) > 5) {
            if (!redactions[currentPage]) {
                redactions[currentPage] = [];
            }

            // Normalize coordinates (handle negative width/height)
            const x = width < 0 ? endX : startX;
            const y = height < 0 ? endY : startY;
            const w = Math.abs(width);
            const h = Math.abs(height);

            // Convert canvas coordinates to PDF coordinates
            const page = pdfDocument.getPage(currentPage);
            page.then(p => {
                const viewport = p.getViewport({ scale: zoomLevel });
                redactions[currentPage].push({
                    x: x / viewport.width,
                    y: y / viewport.height,
                    width: w / viewport.width,
                    height: h / viewport.height,
                    color: redactionColor
                });
                drawRedactions();
                updateUI();
            });
        } else {
            drawRedactions();
        }
    });

    redactionCanvas.addEventListener('mouseleave', () => {
        if (isDrawing) {
            isDrawing = false;
            drawRedactions();
        }
        hoveredRedactionIndex = -1;
        redactionCanvas.style.cursor = 'crosshair';
    });

    // Drag and drop
    initializeGlobalDragDrop({
        onFilesDropped: async (pdfFiles) => {
            if (pdfFiles.length > 1) {
                await customAlert.alert('LocalPDF Studio - NOTICE', 'Please drop only one PDF file.', ['OK']);
                return;
            }

            if (droppedFilePath) {
                await window.electronAPI.deleteFile(droppedFilePath);
            }

            const file = pdfFiles[0];
            const buffer = await file.arrayBuffer();
            const result = await window.electronAPI.saveDroppedFile({
                name: file.name,
                buffer: buffer
            });

            if (result.success) {
                droppedFilePath = result.filePath;
                await loadPdf(result.filePath);
            } else {
                await customAlert.alert(
                    'LocalPDF Studio - ERROR',
                    `Failed to save dropped file: ${result.error}`,
                    ['OK']
                );
            }
        },
        onInvalidFiles: async () => {
            await customAlert.alert(
                'LocalPDF Studio - NOTICE',
                'Please drop a PDF file.',
                ['OK']
            );
        }
    });

    // Load PDF
    async function loadPdf(filePath) {
        try {
            loadingUI.show('Loading PDF...');

            // Cleanup previous
            if (pdfDocument) {
                await pdfDocument.destroy();
            }

            pdfDocument = await pdfjsLib.getDocument(filePath).promise;
            totalPages = pdfDocument.numPages;
            currentFilePath = filePath;
            currentPage = 1;
            redactions = {};
            zoomLevel = 1.0;

            // Update UI
            document.getElementById('page-count').textContent = `${totalPages} pages`;
            document.getElementById('total-pages').textContent = totalPages;
            pageInput.max = totalPages;
            pageInput.disabled = false;
            canvasWrapper.classList.add('has-pdf');

            // Generate thumbnails
            await generateThumbnails();

            // Render first page
            await renderCurrentPage();

            // Enable controls
            prevBtn.disabled = false;
            nextBtn.disabled = false;
            applyBtn.disabled = false;
            clearBtn.disabled = false;
            zoomInBtn.disabled = false;
            zoomOutBtn.disabled = false;
            zoomFitBtn.disabled = false;

            loadingUI.hide();
        } catch (err) {
            console.error(err);
            loadingUI.hide();
            await customAlert.alert(
                'LocalPDF Studio - ERROR',
                'Error loading PDF: ' + err.message,
                ['OK']
            );
        }
    }

    // Generate thumbnails
    async function generateThumbnails() {
        thumbnailList.innerHTML = '';

        for (let i = 1; i <= totalPages; i++) {
            const page = await pdfDocument.getPage(i);
            const viewport = page.getViewport({ scale: 0.3 });

            const canvas = document.createElement('canvas');
            canvas.className = 'thumbnail-canvas';
            canvas.width = viewport.width;
            canvas.height = viewport.height;

            const ctx = canvas.getContext('2d');
            await page.render({ canvasContext: ctx, viewport }).promise;

            const item = document.createElement('div');
            item.className = 'thumbnail-item';
            if (i === currentPage) item.classList.add('active');

            const badge = document.createElement('div');
            badge.className = 'thumbnail-badge';
            badge.style.display = 'none';

            const label = document.createElement('div');
            label.className = 'thumbnail-label';
            label.textContent = `Page ${i}`;

            item.appendChild(badge);
            item.appendChild(canvas);
            item.appendChild(label);
            item.addEventListener('click', () => {
                currentPage = i;
                renderCurrentPage();
            });

            thumbnailList.appendChild(item);
        }
    }

    // Render current page
    async function renderCurrentPage() {
        if (!pdfDocument) return;

        try {
            const page = await pdfDocument.getPage(currentPage);
            const viewport = page.getViewport({ scale: zoomLevel });

            pdfCanvas.width = viewport.width;
            pdfCanvas.height = viewport.height;
            redactionCanvas.width = viewport.width;
            redactionCanvas.height = viewport.height;

            const ctx = pdfCanvas.getContext('2d');
            await page.render({ canvasContext: ctx, viewport }).promise;

            drawRedactions();
            updateUI();
        } catch (err) {
            console.error('Error rendering page:', err);
        }
    }

    // Draw redactions
    function drawRedactions() {
        const ctx = redactionCanvas.getContext('2d');
        ctx.clearRect(0, 0, redactionCanvas.width, redactionCanvas.height);

        const pageRedactions = redactions[currentPage] || [];
        pageRedactions.forEach((rect, index) => {
            const x = rect.x * redactionCanvas.width;
            const y = rect.y * redactionCanvas.height;
            const w = rect.width * redactionCanvas.width;
            const h = rect.height * redactionCanvas.height;

            const isHovered = index === hoveredRedactionIndex;

            ctx.fillStyle = rect.color;
            ctx.globalAlpha = isHovered ? 0.7 : 0.5;
            ctx.fillRect(x, y, w, h);
            ctx.globalAlpha = 1.0;
            ctx.strokeStyle = isHovered ? '#f39c12' : '#e74c3c';
            ctx.lineWidth = isHovered ? 3 : 2;
            ctx.strokeRect(x, y, w, h);

            // Show delete icon when hovered
            if (isHovered) {
                ctx.fillStyle = '#e74c3c';
                ctx.font = 'bold 16px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('✕', x + w / 2, y + h / 2);
            }
        });
    }

    // Update UI
    function updateUI() {
        // Update page controls
        pageInput.value = currentPage;
        prevBtn.disabled = currentPage === 1;
        nextBtn.disabled = currentPage === totalPages;

        // Update zoom display
        document.getElementById('zoom-level').textContent = `${Math.round(zoomLevel * 100)}%`;

        // Update active thumbnail
        document.querySelectorAll('.thumbnail-item').forEach((item, i) => {
            item.classList.toggle('active', i + 1 === currentPage);
        });

        // Update redaction counts
        const pageRedactionCount = (redactions[currentPage] || []).length;
        document.getElementById('redaction-count').textContent =
            `${pageRedactionCount} redaction${pageRedactionCount !== 1 ? 's' : ''} on this page`;

        // Update thumbnail badges
        document.querySelectorAll('.thumbnail-item').forEach((item, i) => {
            const badge = item.querySelector('.thumbnail-badge');
            const count = (redactions[i + 1] || []).length;
            if (count > 0) {
                badge.textContent = count;
                badge.style.display = 'block';
            } else {
                badge.style.display = 'none';
            }
        });

        // Enable/disable apply button
        const totalRedactions = Object.values(redactions).reduce((sum, arr) => sum + arr.length, 0);
        applyBtn.disabled = totalRedactions === 0;
    }

    // Cleanup on exit
    const backBtn = document.querySelector('a[href="../../index.html"]');
    if (backBtn) {
        backBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            if (droppedFilePath) {
                await window.electronAPI.deleteFile(droppedFilePath);
            }
            if (pdfDocument) {
                await pdfDocument.destroy();
            }
            window.location.href = '../../index.html';
        });
    }

    window.addEventListener('beforeunload', async () => {
        if (droppedFilePath) {
            await window.electronAPI.deleteFile(droppedFilePath);
        }
        if (pdfDocument) {
            await pdfDocument.destroy();
        }
    });
});