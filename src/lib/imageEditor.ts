import { Product } from "@/hooks/useProducts";

// Helper function to handle manual line breaks only (no automatic wrapping)
const processManualLineBreaks = (text: string): string[] => {
  // Simply split by manual line breaks (\n) and preserve them as-is
  return text.split('\n');
};

// Helper function to wrap text with better handling for Korean text and manual line breaks
const wrapText = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] => {
  const lines: string[] = [];
  
  // First, split by manual line breaks (\n)
  const manualLines = text.split('\n');
  
  for (const manualLine of manualLines) {
    if (manualLine.trim() === '') {
      lines.push('');
      continue;
    }
    
    // For each manual line, apply automatic wrapping if needed
    let currentLine = '';
    
    for (let i = 0; i < manualLine.length; i++) {
      const char = manualLine[i];
      const testLine = currentLine + char;
      const width = ctx.measureText(testLine).width;
      
      if (width <= maxWidth) {
        currentLine = testLine;
      } else {
        if (currentLine.length > 0) {
          lines.push(currentLine);
          currentLine = char;
        } else {
          // Single character is too wide, force it anyway
          lines.push(char);
          currentLine = '';
        }
      }
    }
    
    if (currentLine.length > 0) {
      lines.push(currentLine);
    }
  }
  
  return lines;
};

// Helper function to calculate optimal font size
const calculateOptimalFontSize = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxHeight: number, baseFontSize: number): number => {
  let fontSize = baseFontSize;
  let textHeight = 0;
  let textWidth = 0;
  
  // Binary search for optimal font size - start with larger minimum size
  let minSize = 20; // Increased from 16 to 20
  let maxSize = baseFontSize * 3; // Increased from 2.5 to 3
  
  while (minSize <= maxSize) {
    const testSize = Math.floor((minSize + maxSize) / 2);
    ctx.font = `bold ${testSize}px 'Noto Sans KR', -apple-system, BlinkMacSystemFont, sans-serif`;
    
    const lines = wrapText(ctx, text, maxWidth);
    textHeight = lines.length * testSize * 1.4; // Line height factor - improved spacing
    textWidth = Math.max(...lines.map(line => ctx.measureText(line).width));
    
    if (textHeight <= maxHeight && textWidth <= maxWidth) {
      fontSize = testSize;
      minSize = testSize + 1;
    } else {
      maxSize = testSize - 1;
    }
  }
  
  return fontSize;
};

export interface ImageEditOptions {
  product: Product;
  width?: number;
  height?: number;
  fontSize?: number;
  textColor?: string;
  backgroundColor?: string;
  borderRadius?: number;
  textShadow?: boolean;
  overlayOpacity?: number;
}

export const editProductImage = async (options: ImageEditOptions): Promise<Blob> => {
  const {
    product,
    width,
    height,
    fontSize,
    textColor = "#ffffff",
    backgroundColor = "rgba(0, 0, 0, 0.4)",
    borderRadius = 12,
    textShadow = true,
    overlayOpacity = 0.4
  } = options;

  // Create main canvas for final result
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Cannot get canvas context');

  let originalImageWidth = width || 800;
  let originalImageHeight = height || 600;
  let originalImage: HTMLImageElement | null = null;

  // Load original image (Layer 1)
  if (product.image_url) {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = product.image_url!;
    });

    originalImage = img;
    
    // Use original image dimensions if not specified
    if (!width || !height) {
      originalImageWidth = img.naturalWidth;
      originalImageHeight = img.naturalHeight;
    }
  }

  // Set main canvas size to original image dimensions
  canvas.width = originalImageWidth;
  canvas.height = originalImageHeight;

  // Draw Layer 1: Original image
  if (originalImage) {
    ctx.drawImage(originalImage, 0, 0, originalImageWidth, originalImageHeight);
  } else {
    // Draw background color if no image
    ctx.fillStyle = '#f3f4f6';
    ctx.fillRect(0, 0, originalImageWidth, originalImageHeight);
  }

  // Create Layer 2: Text layer (1000x1000 with 20px padding)
  const textCanvas = document.createElement('canvas');
  const textCtx = textCanvas.getContext('2d');
  if (!textCtx) throw new Error('Cannot get text canvas context');

  const textLayerSize = 1000;
  const textPadding = 20;
  const textAreaSize = textLayerSize - (textPadding * 2); // 960x960 text area

  textCanvas.width = textLayerSize;
  textCanvas.height = textLayerSize;

  // Process product name with manual line breaks only
  const nameLines = processManualLineBreaks(product.name);
  
  // Calculate optimal font size for text to fill the 800x800 text area
  const dynamicFontSize = (fontSize || 64) * 1.3; // 텍스트 크기 1.3배 증가
  let finalNameFontSize = dynamicFontSize;
  
  // Calculate font size to fill the text area (800x800)
  const nameAreaHeight = textAreaSize * 0.6; // 상품명이 차지할 높이 (전체 텍스트 영역의 60%)
  let nameLineHeight = finalNameFontSize * 1.4; // 줄간격 적용
  let nameTotalHeight = nameLines.length * nameLineHeight;
  
  // If text doesn't fill the minimum area, increase font size
  if (nameTotalHeight < nameAreaHeight) {
    finalNameFontSize = (nameAreaHeight * finalNameFontSize) / nameTotalHeight;
  }
  
  textCtx.font = `bold ${finalNameFontSize}px 'Noto Sans KR', -apple-system, BlinkMacSystemFont, sans-serif`;
  
  // Check if any line is too wide and adjust font size if needed
  let maxLineWidth = 0;
  for (const line of nameLines) {
    const lineWidth = textCtx.measureText(line).width;
    maxLineWidth = Math.max(maxLineWidth, lineWidth);
  }
  
  // If any line exceeds 90% of text area width, reduce font size
  if (maxLineWidth > textAreaSize * 0.9) {
    finalNameFontSize = (finalNameFontSize * textAreaSize * 0.9) / maxLineWidth;
    textCtx.font = `bold ${finalNameFontSize}px 'Noto Sans KR', -apple-system, BlinkMacSystemFont, sans-serif`;
    
    // Recalculate line widths with new font size to ensure compliance
    maxLineWidth = 0;
    for (const line of nameLines) {
      const lineWidth = textCtx.measureText(line).width;
      maxLineWidth = Math.max(maxLineWidth, lineWidth);
    }
    
    // If still too wide, apply additional scaling
    if (maxLineWidth > textAreaSize * 0.9) {
      const additionalScale = (textAreaSize * 0.9) / maxLineWidth;
      finalNameFontSize *= additionalScale;
      textCtx.font = `bold ${finalNameFontSize}px 'Noto Sans KR', -apple-system, BlinkMacSystemFont, sans-serif`;
    }
  }
  
  // Recalculate with final font size - improved line spacing
  nameLineHeight = finalNameFontSize * 1.4; // 줄간격을 1.2에서 1.4로 증가
  nameTotalHeight = nameLines.length * nameLineHeight;
  
  // Calculate optimal font size for price to fill remaining area
  const remainingHeight = textAreaSize - nameTotalHeight;
  const priceAreaHeight = Math.max(remainingHeight * 0.8, textAreaSize * 0.3); // 가격이 차지할 최소 높이
  
  // Calculate font size for price to fill the price area
  let finalPriceFontSize = finalNameFontSize * 0.8; // 기본 비율 (이미 1.3배가 적용된 상태)
  const priceOptimalSize = calculateOptimalFontSize(textCtx, `${product.price.toLocaleString()}원`, textAreaSize * 0.9, priceAreaHeight, finalPriceFontSize);
  finalPriceFontSize = Math.min(priceOptimalSize, finalNameFontSize * 0.9);
  
  textCtx.font = `bold ${finalPriceFontSize}px 'Noto Sans KR', -apple-system, BlinkMacSystemFont, sans-serif`;
  const priceLines = wrapText(textCtx, `${product.price.toLocaleString()}원`, textAreaSize * 0.9);
  const priceLineHeight = finalPriceFontSize * 1.4; // 줄간격을 1.2에서 1.4로 증가
  const priceTotalHeight = priceLines.length * priceLineHeight;
  
  // Calculate total text height with proper spacing
  const textSpacing = Math.max(15, finalNameFontSize * 0.3); // 상품명과 가격 사이 간격 증가
  const totalTextHeight = nameTotalHeight + priceTotalHeight + textSpacing;
  
  // Center the text block in the 800x800 text area
  const textStartY = textPadding + (textAreaSize - totalTextHeight) / 2;

  // Configure text rendering for text layer
  textCtx.textAlign = 'center';
  textCtx.textBaseline = 'top';

  // Draw product name on text layer
  textCtx.font = `bold ${finalNameFontSize}px 'Noto Sans KR', -apple-system, BlinkMacSystemFont, sans-serif`;
  
  nameLines.forEach((line, index) => {
    const lineY = textStartY + (index * nameLineHeight);
    
    if (textShadow) {
      // Draw text outline for better visibility
      textCtx.strokeStyle = 'rgba(0, 0, 0, 0.9)';
      textCtx.lineWidth = Math.max(2, finalNameFontSize * 0.08);
      textCtx.strokeText(line, textLayerSize / 2, lineY);
      
      // Draw text shadow
      textCtx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      textCtx.fillText(line, textLayerSize / 2 + 3, lineY + 3);
    }
    
    // Draw main text
    textCtx.fillStyle = textColor;
    textCtx.fillText(line, textLayerSize / 2, lineY);
  });

  // Draw price on text layer
  textCtx.font = `bold ${finalPriceFontSize}px 'Noto Sans KR', -apple-system, BlinkMacSystemFont, sans-serif`;
  
  const priceStartY = textStartY + nameTotalHeight + textSpacing;
  
  priceLines.forEach((line, index) => {
    const lineY = priceStartY + (index * priceLineHeight);
    
    if (textShadow) {
      // Draw price outline for better visibility
      textCtx.strokeStyle = 'rgba(0, 0, 0, 0.9)';
      textCtx.lineWidth = Math.max(2, finalPriceFontSize * 0.08);
      textCtx.strokeText(line, textLayerSize / 2, lineY);
      
      // Draw price shadow
      textCtx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      textCtx.fillText(line, textLayerSize / 2 + 3, lineY + 3);
    }
    
    // Draw main price text
    textCtx.fillStyle = textColor;
    textCtx.fillText(line, textLayerSize / 2, lineY);
  });

  // Calculate fit object scaling for text layer
  const scaleX = originalImageWidth / textLayerSize;
  const scaleY = originalImageHeight / textLayerSize;
  const scale = Math.min(scaleX, scaleY); // Fit object scaling
  
  // Calculate position to center the text layer
  const scaledTextWidth = textLayerSize * scale;
  const scaledTextHeight = textLayerSize * scale;
  const textX = (originalImageWidth - scaledTextWidth) / 2;
  const textY = (originalImageHeight - scaledTextHeight) / 2;

  // Draw text layer on main canvas with fit object scaling
  ctx.drawImage(textCanvas, textX, textY, scaledTextWidth, scaledTextHeight);

  // Convert to WebP blob for better compression
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error('Failed to create blob'));
      }
    }, 'image/webp', 0.95); // WebP format with 95% quality for maximum resolution
  });
};

export const downloadImage = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  // Change file extension to .webp
  const webpFilename = filename.replace(/\.[^/.]+$/, '.webp');
  a.download = webpFilename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const createZipAndDownload = async (files: { blob: Blob; filename: string }[]) => {
  // Note: This is a simplified version. For production, you might want to use a library like JSZip
  // For now, we'll download files individually
  for (const file of files) {
    downloadImage(file.blob, file.filename);
    // Add small delay between downloads
    await new Promise(resolve => setTimeout(resolve, 500));
  }
};