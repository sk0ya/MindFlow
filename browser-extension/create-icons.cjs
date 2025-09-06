/**
 * Simple icon generator for MindFlow Ollama Bridge
 * Run with: node create-icons.js
 */

const fs = require('fs');
const path = require('path');

// SVG template for different sizes
const createSvgIcon = (size) => `
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" fill="#2196f3" rx="${size * 0.15}"/>
  <circle cx="${size * 0.3}" cy="${size * 0.3}" r="${size * 0.08}" fill="white"/>
  <circle cx="${size * 0.7}" cy="${size * 0.3}" r="${size * 0.08}" fill="white"/>
  <path d="M ${size * 0.25} ${size * 0.6} Q ${size * 0.5} ${size * 0.8} ${size * 0.75} ${size * 0.6}" 
        stroke="white" stroke-width="${size * 0.03}" fill="none"/>
  <text x="${size * 0.5}" y="${size * 0.9}" font-family="Arial, sans-serif" 
        font-size="${size * 0.12}" fill="white" text-anchor="middle">🧠🤖</text>
</svg>`.trim();

// Create icons directory if it doesn't exist
const iconsDir = path.join(__dirname, 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir);
}

// Generate SVG files for different sizes
[16, 48, 128].forEach(size => {
  const svgContent = createSvgIcon(size);
  fs.writeFileSync(
    path.join(iconsDir, `icon-${size}.svg`), 
    svgContent,
    'utf8'
  );
  console.log(`Created icon-${size}.svg`);
});

console.log('\\nIcon files created in /icons directory');
console.log('Note: For production, convert SVG to PNG using online tools or image editor');
console.log('Recommended: Use tools like GIMP, Photoshop, or online SVG to PNG converters');