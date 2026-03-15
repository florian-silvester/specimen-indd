/**
 * Shared utility for fuzzy matching style names across different screens
 * Used for intelligent auto-mapping of scanned or imported text styles
 */

import { STYLE_KEYS } from '../core/constants';

/**
 * Normalizes a style name for comparison
 * Examples:
 *   "Heading 1" → "h1"
 *   "H01-Desktop" → "h1desktop"
 *   "Text Large" → "tlarge"
 */
export function normalizeStyleName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[\s\-_]/g, '') // Remove spaces, hyphens, underscores
    .replace(/0/g, '') // "H01" → "H1" 
    .replace(/heading/g, 'h') // "Heading 1" → "h1"
    .replace(/display/g, STYLE_KEYS.DISPLAY) // Keep display as is
    .replace(/text/g, 't') // "Text Large" → "tlarge"
    .replace(/large/g, 'l')
    .replace(/small/g, 's')
    .replace(/main/g, 'm')
    .replace(/micro/g, STYLE_KEYS.MICRO)
    .replace(/tiny/g, 't');
}

/**
 * Calculates the Levenshtein distance between two strings
 */
function levenshteinDistance(str1: string, str2: string): number {
  const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
  
  for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
  
  for (let j = 1; j <= str2.length; j++) {
    for (let i = 1; i <= str1.length; i++) {
      const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,     // deletion
        matrix[j - 1][i] + 1,     // insertion
        matrix[j - 1][i - 1] + indicator  // substitution
      );
    }
  }
  
  return matrix[str2.length][str1.length];
}

/**
 * Calculates similarity between two strings (0.0 to 1.0)
 */
function calculateSimilarity(str1: string, str2: string): number {
  if (str1 === str2) return 1.0;
  
  const maxLength = Math.max(str1.length, str2.length);
  if (maxLength === 0) return 1.0;
  
  const distance = levenshteinDistance(str1, str2);
  return 1 - (distance / maxLength);
}

/**
 * Attempts to fuzzy match a style name against a list of system options
 * Returns the best matching option or null if no good match is found
 * 
 * @param styleName - The name to match (e.g., "Heading-1", "h1_desktop")
 * @param systemOptions - List of valid system style names (e.g., ["Display", "H1", "H2", ...])
 * @param threshold - Minimum similarity score (0.0 to 1.0, default 0.6)
 * @returns The best matching system option or null
 */
export function fuzzyMatchStyleName(
  styleName: string, 
  systemOptions: string[], 
  threshold: number = 0.6
): string | null {
  if (!styleName || styleName.trim() === '') return null;
  
  const normalized = normalizeStyleName(styleName);
  console.log(`[StyleNameMatcher] 🔍 Fuzzy matching "${styleName}" (normalized: "${normalized}")`);
  
  let bestMatch = null;
  let bestScore = 0;
  
  for (const option of systemOptions) {
    if (option === "None") continue;
    
    const normalizedOption = normalizeStyleName(option);
    const similarity = calculateSimilarity(normalized, normalizedOption);
    
    console.log(`[StyleNameMatcher]   - "${option}" (normalized: "${normalizedOption}") → similarity: ${similarity.toFixed(2)}`);
    
    if (similarity > bestScore && similarity > threshold) {
      bestScore = similarity;
      bestMatch = option;
    }
  }
  
  if (bestMatch) {
    console.log(`[StyleNameMatcher] ✅ Best fuzzy match: "${styleName}" → "${bestMatch}" (score: ${bestScore.toFixed(2)})`);
  } else {
    console.log(`[StyleNameMatcher] ❌ No fuzzy match found for "${styleName}"`);
  }
  
  return bestMatch;
}

