import fs from "node:fs";
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Helper to get __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function fetchGoogleFonts() {
  console.log("Starting to fetch Google Fonts list...");

  const key = process.env.GOOGLE_FONTS_API_KEY;
  if (!key) {
    console.error("Error: GOOGLE_FONTS_API_KEY environment variable not set.");
    console.error("Please run the script like this: GOOGLE_FONTS_API_KEY=your_key_here npm run update:fonts");
    process.exit(1);
  }

  const url = `https://www.googleapis.com/webfonts/v1/webfonts?key=${key}&sort=alpha`;
  const outputPath = path.resolve(__dirname, '..', 'src', 'core', 'google-fonts.json');

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}: ${await response.text()}`);
    }
    const data = await response.json();
    const families = data.items.map(font => font.family);

    // Create metadata file with additional info
    const metadata = {
      lastUpdated: new Date().toISOString(),
      count: families.length,
      source: "Google Fonts API v1",
      fonts: families
    };

    // Save just the array for backward compatibility
    fs.writeFileSync(outputPath, JSON.stringify(families, null, 2));
    
    // Save metadata version
    const metadataPath = path.resolve(__dirname, '..', 'src', 'core', 'google-fonts-metadata.json');
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
    
    console.log(`✅ Successfully saved ${families.length} Google Font families to ${outputPath}`);
    console.log(`✅ Metadata saved to ${metadataPath}`);
    console.log(`📅 Last updated: ${metadata.lastUpdated}`);
  } catch (error) {
    console.error("❌ Failed to fetch or save Google Fonts list:", error);
    process.exit(1);
  }
}

fetchGoogleFonts(); 