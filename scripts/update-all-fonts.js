import { execSync } from 'child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Master script to update all font lists:
 * 1. Google Fonts (from API)
 * 2. macOS System Fonts (curated list)
 * 3. Windows System Fonts (curated list)
 * 4. Generate combined system-fonts.ts
 */
async function updateAllFonts() {
  console.log("=".repeat(60));
  console.log("🔄 UPDATING ALL FONT LISTS");
  console.log("=".repeat(60));

  try {
    // Step 1: Update Google Fonts
    console.log("\n📦 Step 1: Fetching Google Fonts from API...");
    const googleKey = process.env.GOOGLE_FONTS_API_KEY;
    if (googleKey) {
      execSync('node scripts/fetch-google-fonts.js', { 
        stdio: 'inherit',
        env: { ...process.env, GOOGLE_FONTS_API_KEY: googleKey }
      });
    } else {
      console.log("⚠️  Skipping Google Fonts (no API key). Set GOOGLE_FONTS_API_KEY to fetch.");
    }

    // Step 2: Generate macOS fonts
    console.log("\n🍎 Step 2: Generating macOS system fonts list...");
    execSync('node scripts/fetch-macos-fonts.js', { stdio: 'inherit' });

    // Step 3: Generate Windows fonts
    console.log("\n🪟 Step 3: Generating Windows system fonts list...");
    execSync('node scripts/fetch-windows-fonts.js', { stdio: 'inherit' });

    // Step 4: Combine and generate TypeScript file
    console.log("\n🔧 Step 4: Generating combined system-fonts.ts...");
    generateSystemFontsTS();

    console.log("\n" + "=".repeat(60));
    console.log("✅ ALL FONT LISTS UPDATED SUCCESSFULLY!");
    console.log("=".repeat(60));
    console.log("\n📋 Summary:");
    
    // Read metadata files and show summary
    const googleMeta = safeReadJSON(path.resolve(__dirname, '..', 'src', 'core', 'google-fonts-metadata.json'));
    const macosMeta = safeReadJSON(path.resolve(__dirname, '..', 'src', 'core', 'macos-system-fonts-metadata.json'));
    const windowsMeta = safeReadJSON(path.resolve(__dirname, '..', 'src', 'core', 'windows-system-fonts-metadata.json'));

    if (googleMeta) console.log(`  • Google Fonts: ${googleMeta.count} fonts`);
    if (macosMeta) console.log(`  • macOS System: ${macosMeta.count} fonts`);
    if (windowsMeta) console.log(`  • Windows System: ${windowsMeta.count} fonts`);
    
    console.log("\n💡 Next: Run 'npm run dev' to rebuild and test the changes.");
    
  } catch (error) {
    console.error("\n❌ Error updating fonts:", error.message);
    process.exit(1);
  }
}

function safeReadJSON(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function generateSystemFontsTS() {
  const corePath = path.resolve(__dirname, '..', 'src', 'core');
  
  // Read font lists
  const macosPath = path.join(corePath, 'macos-system-fonts.json');
  const windowsPath = path.join(corePath, 'windows-system-fonts.json');
  
  const macosFonts = JSON.parse(fs.readFileSync(macosPath, 'utf8'));
  const windowsFonts = JSON.parse(fs.readFileSync(windowsPath, 'utf8'));

  // Generate TypeScript file
  const tsContent = `/**
 * System Fonts Filter
 * 
 * Auto-generated list of fonts included with macOS and Windows
 * 
 * Generated: ${new Date().toISOString()}
 * Sources:
 * - macOS: Apple Official Documentation (macOS Sonoma/Ventura/Monterey)
 * - Windows: Microsoft Official Documentation (Windows 11/10)
 * 
 * To update this file, run: npm run update:all-fonts
 */

// macOS system fonts (${macosFonts.length} fonts)
export const MACOS_SYSTEM_FONTS = ${JSON.stringify(macosFonts, null, 2)};

// Windows system fonts (${windowsFonts.length} fonts)
export const WINDOWS_SYSTEM_FONTS = ${JSON.stringify(windowsFonts, null, 2)};

// Combined list of all system fonts to filter
export const SYSTEM_FONTS = [
  ...MACOS_SYSTEM_FONTS,
  ...WINDOWS_SYSTEM_FONTS,
];

/**
 * Check if a font name is a system font that should be filtered
 * 
 * @param fontName - The font family name to check
 * @param googleFontsList - Optional list of Google Font names to exclude from filtering
 */
export function isSystemFont(fontName: string, googleFontsList?: string[]): boolean {
  // Check exact match first
  if (SYSTEM_FONTS.includes(fontName)) {
    return true;
  }
  
  // If we have a Google Fonts list, never filter Google Fonts
  // This prevents accidentally hiding fonts like "Noto Sans" which are Google Fonts
  if (googleFontsList && googleFontsList.length > 0) {
    const lowerFontName = fontName.toLowerCase();
    const isGoogleFont = googleFontsList.some(gf => gf.toLowerCase() === lowerFontName);
    if (isGoogleFont) {
      return false; // Don't filter Google Fonts
    }
  }
  
  // MORE CONSERVATIVE pattern matching for macOS/Windows system font variants
  // These patterns should only catch actual system fonts, not user-installed fonts
  const patterns = [
    // macOS language-specific variants (very specific patterns)
    / Sangam MN$/,      // Devanagari Sangam MN, Tamil Sangam MN, etc.
    /^(Malayalam|Kannada|Oriya|Tamil|Telugu|Sinhala|Myanmar|Khmer|Lao) MN$/,  // Specific MN fonts
    /^(Devanagari|Gujarati|Gurmukhi) MT$/,  // Specific MT fonts
    
    // macOS Chinese variants (avoid catching Google Fonts with SC/TC)
    /^(Baoli|Hannotate|Hanzipen|Heiti|Kaiti|Lantinghei|Libian|Songti|PingFang|STFangsong|STHeiti|STKaiti|STSong|Wawati|Weibei|Xingkai|Yuanti|Yuppy) (HK|SC|TC)$/,
    
    // macOS Indian language variants
    /^Lava (Devanagari|Kannada|Telugu|Gujarati|Gurmukhi|Odia|Tamil)$/,
    /^Kohinoor (Bangla|Devanagari|Gujarati|Telugu)$/,
    
    // System-specific Noto fonts (not the Google Fonts versions)
    // Only filter Noto fonts that are NOT in the Google Fonts list
    /^Noto (Nastaliq Urdu|Sans Kannada|Sans Myanmar|Sans Oriya)$/,
    
    // macOS system font families with multiple weights
    /^SF (Pro|Compact|Mono|Arabic|Armenian|Georgian|Hebrew)( Display| Text| Rounded)?$/,
    /^New York( Small| Medium| Large| Extra Large)?$/,
    
    // Windows system variants
    /^Segoe (Fluent Icons|MDL2 Assets|Print|Script|UI)( Black| Emoji| Historic| Light| Semibold| Semilight| Symbol| Variable)?$/,
    /^MS (Gothic|Mincho|PGothic|PMincho|UI Gothic|Outlook|Reference|Sans Serif|Reference Specialty)$/,
    /^Yu (Gothic|Mincho)( UI)?$/,
  ];
  
  return patterns.some(pattern => pattern.test(fontName));
}
`;

  const outputPath = path.join(corePath, 'system-fonts.ts');
  fs.writeFileSync(outputPath, tsContent);
  
  const allSystemFonts = [...new Set([...macosFonts, ...windowsFonts])];
  console.log(`✅ Generated ${outputPath}`);
  console.log(`   • macOS fonts: ${macosFonts.length}`);
  console.log(`   • Windows fonts: ${windowsFonts.length}`);
  console.log(`   • Total unique: ${allSystemFonts.length} fonts`);
}

// Run the script
updateAllFonts();

