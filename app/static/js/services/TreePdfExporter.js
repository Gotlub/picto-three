/**
 * TreePdfExporter - Service d'exportation vectorielle de l'arbre Treant vers PDF.
 * Convertit le graphe SVG et les nœuds HTML en document PDF haute fidélité.
 */

/**
 * Valide si une URL d'image est sûre pour l'export.
 * @param {string} url
 * @returns {boolean}
 */
export function isSafeImageUrl(url) {
    if (!url || typeof url !== 'string') return false;
    const clean = url.trim().toLowerCase();
    return clean.startsWith('http://') ||
           clean.startsWith('https://') ||
           clean.startsWith('/') ||
           clean.startsWith('data:image/');
}

/**
 * Convertit une image en chaîne DataURL (base64) via canvas.
 * @param {string} src
 * @returns {Promise<string>}
 */
export function imageToDataUrl(src) {
    return new Promise((resolve, reject) => {
        if (typeof Image === 'undefined' || typeof document === 'undefined') {
            resolve('');
            return;
        }

        if (!isSafeImageUrl(src)) {
            reject(new Error("URL d'image non sécurisée ou invalide."));
            return;
        }

        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.onload = () => {
            try {
                const canvas = document.createElement('canvas');
                canvas.width = img.width || 100;
                canvas.height = img.height || 100;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                resolve(canvas.toDataURL('image/png'));
            } catch (err) {
                reject(err);
            }
        };
        img.onerror = () => reject(new Error(`Échec du chargement de l'image: ${src}`));
        img.src = src;
    });
}

/**
 * Exporte le graphique Treant visible sous forme de document vectoriel PDF.
 * @param {string} containerSelector
 * @returns {Promise<void>}
 */
export async function exportToVectorPdf(containerSelector = '#tree-visualizer-container .Treant') {
    if (typeof document === 'undefined') {
        throw new Error('Environnement DOM requis pour l\'export PDF.');
    }

    const treeContainer = document.querySelector(containerSelector);
    if (!treeContainer || treeContainer.children.length === 0) {
        throw new Error("Le conteneur de l'arbre (#tree-container) est introuvable ou vide.");
    }

    const treantSvg = treeContainer.querySelector('svg');
    const htmlNodes = treeContainer.querySelectorAll('.node');

    const finalSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const containerWidth = treeContainer.scrollWidth || 800;
    const containerHeight = treeContainer.scrollHeight || 600;
    finalSvg.setAttribute('width', containerWidth.toString());
    finalSvg.setAttribute('height', containerHeight.toString());
    finalSvg.setAttribute('viewBox', `0 0 ${containerWidth} ${containerHeight}`);

    if (treantSvg) {
        const connectors = treantSvg.querySelectorAll('path');
        connectors.forEach(connector => finalSvg.appendChild(connector.cloneNode(true)));
    }

    for (const node of htmlNodes) {
        const x = parseInt(node.style.left, 10) || 0;
        const y = parseInt(node.style.top, 10) || 0;
        const width = node.offsetWidth || 100;
        const height = node.offsetHeight || 100;

        const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        group.setAttribute('transform', `translate(${x}, ${y})`);

        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('width', width.toString());
        rect.setAttribute('height', height.toString());
        rect.setAttribute('fill', '#fff');
        rect.setAttribute('stroke', '#ccc');
        group.appendChild(rect);

        const imgElement = node.querySelector('img');
        if (imgElement && imgElement.src) {
            try {
                const dataUrl = await imageToDataUrl(imgElement.src);
                if (dataUrl) {
                    const image = document.createElementNS('http://www.w3.org/2000/svg', 'image');
                    image.setAttribute('href', dataUrl);
                    const imgWidth = 50;
                    const imgHeight = 50;
                    image.setAttribute('width', imgWidth.toString());
                    image.setAttribute('height', imgHeight.toString());
                    image.setAttribute('x', ((width - imgWidth) / 2).toString());
                    image.setAttribute('y', '10');
                    group.appendChild(image);
                }
            } catch (imgError) {
                console.warn('Impossible d\'inclure l\'image dans le PDF:', imgError);
            }
        }

        const textElement = node.querySelector('.node-name, .node-title');
        if (textElement) {
            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.textContent = textElement.textContent || '';
            text.setAttribute('x', (width / 2).toString());
            text.setAttribute('y', '80');
            text.setAttribute('text-anchor', 'middle');
            text.setAttribute('font-family', 'Arial, sans-serif');
            text.setAttribute('font-size', '12');
            text.setAttribute('fill', '#000');
            group.appendChild(text);
        }
        finalSvg.appendChild(group);
    }

    if (!window.jspdf || !window.jspdf.jsPDF) {
        throw new Error('La bibliothèque jsPDF n\'est pas disponible sur la page.');
    }

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'pt',
        format: [containerWidth, containerHeight]
    });

    if (typeof pdf.svg !== 'function') {
        throw new Error('Le plugin pdf.svg (svg2pdf) n\'est pas chargé.');
    }

    await pdf.svg(finalSvg, {
        x: 0,
        y: 0,
        width: containerWidth,
        height: containerHeight
    });

    pdf.save('picto-tree-vectoriel.pdf');
}

export class TreePdfExporter {
    static export(containerSelector) {
        return exportToVectorPdf(containerSelector);
    }
}
