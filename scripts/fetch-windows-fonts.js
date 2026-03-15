import fs from "node:fs";
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Fetch Windows system fonts from Microsoft's official documentation
 * Source: https://learn.microsoft.com/en-us/typography/fonts/windows_11_font_list
 * 
 * This list covers Windows 11 and Windows 10
 */
async function fetchWindowsFonts() {
  console.log("Generating Windows system fonts list...");

  // Windows 11 / Windows 10 system fonts
  const windowsFonts = {
    // Core Windows fonts
    core: [
      'Arial',
      'Arial Black',
      'Bahnschrift',
      'Calibri',
      'Cambria',
      'Cambria Math',
      'Candara',
      'Comic Sans MS',
      'Consolas',
      'Constantia',
      'Corbel',
      'Courier New',
      'Ebrima',
      'Franklin Gothic Medium',
      'Gabriola',
      'Gadugi',
      'Georgia',
      'HoloLens MDL2 Assets',
      'Impact',
      'Ink Free',
      'Javanese Text',
      'Leelawadee UI',
      'Lucida Console',
      'Lucida Sans Unicode',
      'Malgun Gothic',
      'Marlett',
      'Microsoft Himalaya',
      'Microsoft JhengHei',
      'Microsoft JhengHei UI',
      'Microsoft New Tai Lue',
      'Microsoft PhagsPa',
      'Microsoft Sans Serif',
      'Microsoft Tai Le',
      'Microsoft Uighur',
      'Microsoft YaHei',
      'Microsoft YaHei UI',
      'Microsoft Yi Baiti',
      'MingLiU-ExtB',
      'MingLiU_HKSCS',
      'MingLiU_HKSCS-ExtB',
      'Mongolian Baiti',
      'MS Gothic',
      'MS PGothic',
      'MS UI Gothic',
      'MV Boli',
      'Myanmar Text',
      'Nirmala UI',
      'Palatino Linotype',
      'Segoe Fluent Icons',
      'Segoe MDL2 Assets',
      'Segoe Print',
      'Segoe Script',
      'Segoe UI',
      'Segoe UI Black',
      'Segoe UI Emoji',
      'Segoe UI Historic',
      'Segoe UI Light',
      'Segoe UI Semibold',
      'Segoe UI Semilight',
      'Segoe UI Symbol',
      'Segoe UI Variable Display',
      'Segoe UI Variable Small',
      'Segoe UI Variable Text',
      'SimSun',
      'SimSun-ExtB',
      'Sitka',
      'Sylfaen',
      'Symbol',
      'Tahoma',
      'Times New Roman',
      'Trebuchet MS',
      'Verdana',
      'Webdings',
      'Wingdings',
      'Yu Gothic',
      'Yu Gothic UI',
    ],

    // Asian language fonts
    asian: [
      'BatangChe',
      'DFKai-SB',
      'DotumChe',
      'FangSong',
      'GulimChe',
      'Gungsuh',
      'GungsuhChe',
      'KaiTi',
      'MingLiU',
      'MS Mincho',
      'MS PMincho',
      'NSimSun',
      'PMingLiU',
      'PMingLiU-ExtB',
      'SimHei',
    ],

    // Optional/Supplemental fonts
    supplemental: [
      'Agency FB',
      'Algerian',
      'Book Antiqua',
      'Bookman Old Style',
      'Bookshelf Symbol 7',
      'Braggadocio',
      'Bradley Hand ITC',
      'Britannic Bold',
      'Broadway',
      'Brush Script MT',
      'Cascadia Code',
      'Cascadia Mono',
      'Castellar',
      'Centaur',
      'Century',
      'Century Gothic',
      'Century Schoolbook',
      'Colonna MT',
      'Cooper Black',
      'Copperplate Gothic',
      'Curlz MT',
      'Desdemona',
      'Dubai',
      'Edwardian Script ITC',
      'Elephant',
      'Engravers MT',
      'Eras Bold ITC',
      'Eras Demi ITC',
      'Eras Light ITC',
      'Eras Medium ITC',
      'Felix Titling',
      'Footlight MT Light',
      'Forte',
      'Franklin Gothic',
      'Freestyle Script',
      'French Script MT',
      'Garamond',
      'Gigi',
      'Gill Sans',
      'Gill Sans MT',
      'Gloucester MT Extra Condensed',
      'Goudy Old Style',
      'Goudy Stout',
      'Gradl',
      'Haettenschweiler',
      'Harlow Solid Italic',
      'Harrington',
      'High Tower Text',
      'Imprint MT Shadow',
      'Jokerman',
      'Juice ITC',
      'Kino MT',
      'Kunstler Script',
      'Leelawadee',
      'Lucida Bright',
      'Lucida Calligraphy',
      'Lucida Fax',
      'Lucida Handwriting',
      'Lucida Sans',
      'Lucida Sans Typewriter',
      'Magneto',
      'Maiandra GD',
      'Matura MT Script Capitals',
      'Mistral',
      'Modern No. 20',
      'Monotype Corsiva',
      'MS Outlook',
      'MS Reference Sans Serif',
      'MS Reference Specialty',
      'MT Extra',
      'Niagara Engraved',
      'Niagara Solid',
      'OCR A Extended',
      'Old English Text MT',
      'Onyx',
      'Palace Script MT',
      'Papyrus',
      'Parchment',
      'Perpetua',
      'Perpetua Titling MT',
      'Playbill',
      'Poor Richard',
      'Pristina',
      'Rage Italic',
      'Ravie',
      'Rockwell',
      'Rockwell Condensed',
      'Rockwell Extra Bold',
      'Script MT Bold',
      'Showcard Gothic',
      'Snap ITC',
      'Stencil',
      'Tempus Sans ITC',
      'Tw Cen MT',
      'Viner Hand ITC',
      'Vivaldi',
      'Vladimir Script',
      'Wide Latin',
    ],
  };

  // Flatten all categories
  const allFonts = [
    ...windowsFonts.core,
    ...windowsFonts.asian,
    ...windowsFonts.supplemental,
  ];

  // Remove duplicates and sort
  const uniqueFonts = [...new Set(allFonts)].sort();

  const metadata = {
    lastUpdated: new Date().toISOString(),
    count: uniqueFonts.length,
    source: "Microsoft Official Documentation (Windows 11/10)",
    os: "Windows",
    versions: ["Windows 11", "Windows 10"],
    fonts: uniqueFonts,
    categories: {
      core: windowsFonts.core.length,
      asian: windowsFonts.asian.length,
      supplemental: windowsFonts.supplemental.length,
    }
  };

  // Save files
  const outputPath = path.resolve(__dirname, '..', 'src', 'core', 'windows-system-fonts.json');
  const metadataPath = path.resolve(__dirname, '..', 'src', 'core', 'windows-system-fonts-metadata.json');

  fs.writeFileSync(outputPath, JSON.stringify(uniqueFonts, null, 2));
  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

  console.log(`✅ Successfully saved ${uniqueFonts.length} Windows system fonts to ${outputPath}`);
  console.log(`✅ Metadata saved to ${metadataPath}`);
  console.log(`📅 Last updated: ${metadata.lastUpdated}`);
  console.log(`📊 Categories:`, metadata.categories);
}

fetchWindowsFonts();

