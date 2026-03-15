# Font List Update Scripts

Automated scripts to maintain up-to-date lists of Google Fonts and system fonts for filtering.

## Overview

These scripts help keep font lists current by:
1. **Google Fonts**: Fetching the latest fonts from Google Fonts API
2. **macOS System Fonts**: Curated list from Apple's official documentation
3. **Windows System Fonts**: Curated list from Microsoft's official documentation
4. **Auto-generation**: Combines all sources into TypeScript files

## Quick Start

### Update Everything (Recommended)

```bash
# Update all font lists at once
GOOGLE_FONTS_API_KEY=your_key_here npm run update:fonts
```

This will:
- ✅ Fetch latest Google Fonts from API
- ✅ Generate macOS system fonts list
- ✅ Generate Windows system fonts list
- ✅ Regenerate `src/core/system-fonts.ts` with all fonts

### Update Individual Lists

```bash
# Google Fonts only (requires API key)
GOOGLE_FONTS_API_KEY=your_key_here npm run update:google-fonts

# macOS system fonts only
npm run update:macos-fonts

# Windows system fonts only
npm run update:windows-fonts
```

## Getting a Google Fonts API Key

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select existing)
3. Enable the **Google Fonts Developer API**
4. Go to **Credentials** → **Create Credentials** → **API Key**
5. Copy your API key

**Optional:** Restrict the key to only Google Fonts API for security.

## Generated Files

### Source Files (JSON)
- `src/core/google-fonts.json` - Array of Google Font family names
- `src/core/google-fonts-metadata.json` - Metadata (last updated, count, etc.)
- `src/core/macos-system-fonts.json` - Array of macOS system fonts
- `src/core/macos-system-fonts-metadata.json` - Metadata with categories
- `src/core/windows-system-fonts.json` - Array of Windows system fonts
- `src/core/windows-system-fonts-metadata.json` - Metadata with categories

### Generated TypeScript
- `src/core/system-fonts.ts` - **Auto-generated** TypeScript file with:
  - `MACOS_SYSTEM_FONTS` array
  - `WINDOWS_SYSTEM_FONTS` array
  - `SYSTEM_FONTS` combined array
  - `isSystemFont()` function with smart filtering

## How It Works

### System Font Detection

The `isSystemFont()` function uses a **three-layer approach**:

```typescript
isSystemFont(fontName: string, googleFontsList?: string[]): boolean
```

**Layer 1: Exact Match**
- Checks if font is in the exact list of system fonts

**Layer 2: Google Fonts Cross-Reference** ⭐ **NEW**
- If font is in Google Fonts list → **NEVER filter it**
- This prevents false positives like "Noto Sans" being hidden

**Layer 3: Pattern Matching**
- Conservative regex patterns for font variants
- Example: `Yu Gothic`, `Yu Gothic UI`, etc.

### Filter Flow Example

```
Font: "Noto Sans"
  ↓
Exact match? NO
  ↓
In Google Fonts list? YES → ✅ SHOW (don't filter)
  ↓
Pattern match? (skipped)
  ↓
Result: VISIBLE
```

```
Font: "YuGothic" (macOS system font)
  ↓
Exact match? YES → ❌ HIDE (filter out)
  ↓
Result: HIDDEN
```

## Maintenance Schedule

### Regular Updates
- **Google Fonts**: Update monthly (Google adds ~10-20 fonts/month)
- **macOS Fonts**: Update when new macOS version releases
- **Windows Fonts**: Update when new Windows version releases

### When to Update

**Must update:**
- ✅ Before major releases
- ✅ When users report missing fonts
- ✅ When new OS versions launch

**Can skip:**
- ❌ Between minor plugin updates
- ❌ If no new fonts reported

## Data Sources

### Google Fonts
- **API**: https://www.googleapis.com/webfonts/v1/webfonts
- **Documentation**: https://developers.google.com/fonts/docs/developer_api
- **Update Frequency**: Automated via API

### macOS System Fonts
- **Source**: Apple Official Documentation
- **Current versions**: macOS Sonoma (14.x), Ventura (13.x), Monterey (12.x)
- **Reference**: https://support.apple.com/en-us/HT213266
- **Update Frequency**: Manual, when new macOS releases

### Windows System Fonts
- **Source**: Microsoft Official Documentation
- **Current versions**: Windows 11, Windows 10
- **Reference**: https://learn.microsoft.com/en-us/typography/fonts/windows_11_font_list
- **Update Frequency**: Manual, when new Windows releases

## Troubleshooting

### "No API key" Error
```bash
Error: GOOGLE_FONTS_API_KEY environment variable not set.
```

**Solution**: Set the API key when running:
```bash
GOOGLE_FONTS_API_KEY=your_key_here npm run update:google-fonts
```

### "API request failed" Error
- Check your API key is valid
- Verify Google Fonts API is enabled in your project
- Check network connection

### Fonts Still Showing When They Shouldn't

1. **Check if it's in Google Fonts**: Search at https://fonts.google.com
   - If it's there, it SHOULD show (this is correct behavior)
   
2. **Rebuild the plugin**: After updating fonts
   ```bash
   npm run build
   ```

3. **Check the metadata files**: See what was actually generated
   ```bash
   cat src/core/google-fonts-metadata.json
   cat src/core/macos-system-fonts-metadata.json
   cat src/core/windows-system-fonts-metadata.json
   ```

## Advanced Usage

### Add Custom System Font Patterns

Edit `scripts/update-all-fonts.js` and add patterns to the `patterns` array:

```javascript
// Add custom pattern for filtering
/^MyCustomFont( Bold| Italic)?$/,
```

### Exclude Specific Fonts from Filtering

Add them to a whitelist in `system-fonts.ts`:

```typescript
const WHITELIST = ['Helvetica', 'Arial']; // Professional fonts to never filter

if (WHITELIST.includes(fontName)) {
  return false; // Don't filter
}
```

## Scripts Reference

| Script | Command | Description |
|--------|---------|-------------|
| **All** | `npm run update:fonts` | Updates everything |
| Google | `npm run update:google-fonts` | Google Fonts only |
| macOS | `npm run update:macos-fonts` | macOS fonts only |
| Windows | `npm run update:windows-fonts` | Windows fonts only |
| Master | `npm run update:all-fonts` | Combines all sources |

## File Structure

```
scripts/
├── README.md (this file)
├── fetch-google-fonts.js      # Fetch from Google API
├── fetch-macos-fonts.js        # Generate macOS list
├── fetch-windows-fonts.js      # Generate Windows list
└── update-all-fonts.js         # Master script

src/core/
├── google-fonts.json           # ← Generated
├── google-fonts-metadata.json  # ← Generated
├── macos-system-fonts.json     # ← Generated
├── macos-system-fonts-metadata.json  # ← Generated
├── windows-system-fonts.json   # ← Generated
├── windows-system-fonts-metadata.json  # ← Generated
└── system-fonts.ts             # ← Auto-generated
```

## Contributing

When adding fonts to the manual lists (macOS/Windows):

1. Verify font is actually a system font (comes with OS)
2. Add to appropriate category in the script
3. Run `npm run update:all-fonts` to regenerate
4. Test in the plugin
5. Commit both the script changes AND generated files

---

**Last Updated**: 2025-01-01
**Maintainer**: Specimen Team

