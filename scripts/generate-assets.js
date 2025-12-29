const sharp = require('sharp');
const path = require('path');

const assetsDir = path.join(__dirname, '..', 'assets');

async function generateAssets() {
  // TDS QR brand colors
  const backgroundColor = '#000000';
  const accentColor = '#00FFC3';

  // Icon 1024x1024 with QR-style design
  const iconSvg = `
    <svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg">
      <rect width="1024" height="1024" fill="${backgroundColor}"/>
      <rect x="312" y="312" width="400" height="400" rx="40" fill="${accentColor}"/>
      <!-- QR pattern -->
      <rect x="362" y="362" width="80" height="80" fill="${backgroundColor}"/>
      <rect x="582" y="362" width="80" height="80" fill="${backgroundColor}"/>
      <rect x="362" y="582" width="80" height="80" fill="${backgroundColor}"/>
      <rect x="472" y="472" width="80" height="80" fill="${backgroundColor}"/>
      <!-- Text TDS -->
      <text x="512" y="850" font-family="Arial, sans-serif" font-size="120" font-weight="bold" fill="${accentColor}" text-anchor="middle">TDS QR</text>
    </svg>
  `;

  // Splash 2732x2732 (largest iPad Pro size)
  const splashSvg = `
    <svg width="2732" height="2732" xmlns="http://www.w3.org/2000/svg">
      <rect width="2732" height="2732" fill="${backgroundColor}"/>
      <rect x="966" y="966" width="800" height="800" rx="80" fill="${accentColor}"/>
      <!-- QR pattern -->
      <rect x="1066" y="1066" width="160" height="160" fill="${backgroundColor}"/>
      <rect x="1506" y="1066" width="160" height="160" fill="${backgroundColor}"/>
      <rect x="1066" y="1506" width="160" height="160" fill="${backgroundColor}"/>
      <rect x="1286" y="1286" width="160" height="160" fill="${backgroundColor}"/>
      <!-- Text -->
      <text x="1366" y="2050" font-family="Arial, sans-serif" font-size="200" font-weight="bold" fill="${accentColor}" text-anchor="middle">TDS QR</text>
    </svg>
  `;

  // Favicon 48x48
  const faviconSvg = `
    <svg width="48" height="48" xmlns="http://www.w3.org/2000/svg">
      <rect width="48" height="48" fill="${backgroundColor}"/>
      <rect x="8" y="8" width="32" height="32" rx="4" fill="${accentColor}"/>
      <rect x="12" y="12" width="8" height="8" fill="${backgroundColor}"/>
      <rect x="28" y="12" width="8" height="8" fill="${backgroundColor}"/>
      <rect x="12" y="28" width="8" height="8" fill="${backgroundColor}"/>
      <rect x="20" y="20" width="8" height="8" fill="${backgroundColor}"/>
    </svg>
  `;

  try {
    // Generate icon.png (1024x1024)
    await sharp(Buffer.from(iconSvg))
      .png()
      .toFile(path.join(assetsDir, 'icon.png'));
    console.log('Created: icon.png (1024x1024)');

    // Generate adaptive-icon.png (1024x1024)
    await sharp(Buffer.from(iconSvg))
      .png()
      .toFile(path.join(assetsDir, 'adaptive-icon.png'));
    console.log('Created: adaptive-icon.png (1024x1024)');

    // Generate splash.png (2732x2732)
    await sharp(Buffer.from(splashSvg))
      .png()
      .toFile(path.join(assetsDir, 'splash.png'));
    console.log('Created: splash.png (2732x2732)');

    // Generate favicon.png (48x48)
    await sharp(Buffer.from(faviconSvg))
      .png()
      .toFile(path.join(assetsDir, 'favicon.png'));
    console.log('Created: favicon.png (48x48)');

    console.log('\nAll assets generated successfully!');
  } catch (error) {
    console.error('Error generating assets:', error);
    process.exit(1);
  }
}

generateAssets();
