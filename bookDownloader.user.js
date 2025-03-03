// ==UserScript==
// @name         Book Archiver
// @namespace    http://tampermonkey.net/
// @version      1.5.1
// @description  Save book images to localStorage as you read/scroll and export as a PDF with pages in order.
// @author       TurbulentGoat
// @match        https://read.amazon.com.au/*
// @grant        GM_addStyle
// @require      https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js
// ==/UserScript==

(function() {
    'use strict';

    const storageKey = 'bookImages_' + window.location.href;
    // Fix fallback by using a JSON string for an empty array.
    let savedImages = JSON.parse(localStorage.getItem(storageKey) || "[]");

    function updateStatus() {
        const statusDiv = document.getElementById('archive-status');
        if (statusDiv) {
            statusDiv.textContent = `Pages saved: ${savedImages.length}`;
        }
    }

    function saveImages() {
        localStorage.setItem(storageKey, JSON.stringify(savedImages));
    }

    function processImage(img) {
        if (img.src && img.src.startsWith('blob:')) {
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            try {
                const dataUrl = canvas.toDataURL('image/jpeg');
                // Prevent duplicate images.
                if (!savedImages.some(item => item.dataUrl === dataUrl)) {
                    savedImages.push({
                        dataUrl: dataUrl,
                        width: img.naturalWidth,
                        height: img.naturalHeight
                    });
                    saveImages();
                    updateStatus();
                }
            } catch (e) {
                console.error('Error processing image:', e);
            }
        }
    }

    function handleImage(img) {
        if (img.complete) {
            processImage(img);
        } else {
            img.addEventListener('load', () => processImage(img));
        }
    }

    // Process any already present images.
    document.querySelectorAll('img[src^="blob:"]').forEach(handleImage);

    // Observe newly added images.
    const observer = new MutationObserver(mutations => {
        mutations.forEach(mutation => {
            mutation.addedNodes.forEach(node => {
                if (node.tagName === 'IMG' && node.src && node.src.startsWith('blob:')) {
                    handleImage(node);
                } else if (node.querySelectorAll) {
                    node.querySelectorAll('img[src^="blob:"]').forEach(handleImage);
                }
            });
        });
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // Function to create and insert control buttons and status display.
    function addButtons() {
        if (!document.body) return; // Ensure body exists.
        // Avoid duplicate buttons.
        if (document.getElementById('export-pdf-button')) return;

        const exportButton = document.createElement('button');
        exportButton.textContent = 'Export to PDF';
        exportButton.id = 'export-pdf-button';
        document.body.appendChild(exportButton);

        const clearButton = document.createElement('button');
        clearButton.textContent = 'Clear Storage';
        clearButton.id = 'clear-storage-button';
        document.body.appendChild(clearButton);

        const statusDiv = document.createElement('div');
        statusDiv.id = 'archive-status';
        document.body.appendChild(statusDiv);

        GM_addStyle(`
            #export-pdf-button, #clear-storage-button {
                position: fixed;
                z-index: 9999;
                padding: 10px 15px;
                color: white;
                border: none;
                border-radius: 5px;
                cursor: pointer;
                font-size: 16px;
            }
            #export-pdf-button {
                bottom: 10px;
                right: 10px;
                background: #28a745;
            }
            #clear-storage-button {
                bottom: 10px;
                right: 150px;
                background: #dc3545;
            }
            #archive-status {
                position: fixed;
                bottom: 60px;
                right: 10px;
                padding: 5px 10px;
                background: rgba(40, 167, 69, 0.8);
                color: white;
                border-radius: 5px;
                font-size: 14px;
            }
        `);

        updateStatus();

        exportButton.addEventListener('click', () => {
            const { jsPDF } = window.jspdf;
            if (!savedImages.length) {
                alert('No pages saved!');
                return;
            }

            const pdf = new jsPDF('p', 'mm', 'a4');
            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();
            const conversionFactor = 25.4 / 96;

            savedImages.forEach((imgObj, index) => {
                const imgWidthMm = imgObj.width * conversionFactor;
                const imgHeightMm = imgObj.height * conversionFactor;
                const scale = Math.min(pageWidth / imgWidthMm, pageHeight / imgHeightMm);
                const drawWidth = imgWidthMm * scale;
                const drawHeight = imgHeightMm * scale;
                const x = (pageWidth - drawWidth) / 2;
                const y = (pageHeight - drawHeight) / 2;

                if (index > 0) pdf.addPage();
                pdf.addImage(imgObj.dataUrl, 'JPEG', x, y, drawWidth, drawHeight);
            });

            pdf.save('book.pdf');
            alert('PDF Exported!');
        });

        clearButton.addEventListener('click', () => {
            localStorage.removeItem(storageKey);
            savedImages = [];
            updateStatus();
            alert('Storage cleared!');
        });
    }

    // Use DOMContentLoaded to ensure the document is ready.
    document.addEventListener('DOMContentLoaded', addButtons);
    // Fallback in case DOMContentLoaded already fired.
    setTimeout(addButtons, 3000);
})();
