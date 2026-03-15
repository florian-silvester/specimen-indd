import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const WIKI_PATH = path.resolve(__dirname, '..', 'src', 'core', 'semantic-term-bank-wiki.json');

function normalizeSpaces(value) {
  return value.replace(/\s+/g, ' ').trim();
}

function cleanDescription(text) {
  // Remove sentences that contain bad patterns
  const sentences = text.split(/(?<=[.!?])\s+/);
  const goodSentences = sentences.filter(sentence => {
    if (sentence.includes('==')) return false;
    if (sentence.includes('displaystyle')) return false;
    if (sentence.includes('Notes References')) return false;
    if (sentence.includes('Further reading')) return false;
    if (sentence.includes('See also')) return false;
    if (sentence.includes('How to use')) return false;
    if (sentence.includes('Synonym Discussion')) return false;
    if (sentence.includes('The meaning of')) return false;
    return true;
  });
  
  return goodSentences.join(' ');
}

async function run() {
  const raw = await fs.readFile(WIKI_PATH, 'utf8');
  const data = JSON.parse(raw);
  
  let cleanedCount = 0;
  let removedCount = 0;
  
  const cleanedData = [];
  
  for (const item of data) {
    if (item.source === 'webster') {
      removedCount++;
      continue; // Drop webster entirely
    }
    
    const orig = item.description;
    const cleaned = cleanDescription(orig);
    
    if (cleaned.length < 200) {
      removedCount++;
      continue; // Drop if it became too short
    }
    
    if (orig !== cleaned) {
      cleanedCount++;
    }
    
    item.description = cleaned;
    cleanedData.push(item);
  }
  
  await fs.writeFile(WIKI_PATH, JSON.stringify(cleanedData, null, 2), 'utf8');
  console.log(`Cleaned ${cleanedCount} descriptions. Removed ${removedCount} bad entries.`);
}

run().catch(console.error);