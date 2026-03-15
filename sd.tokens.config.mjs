import StyleDictionary from 'style-dictionary';
import { registerTransforms } from '@tokens-studio/sd-transforms';
registerTransforms(StyleDictionary);

export default {
  source: ['tokens.json'],        // path to the file in repo
  platforms: {
    css: {
      transformGroup: 'tokens-studio',
      buildPath: 'src/ui/',
      files: [{
        destination: 'tokens.css',
        format: 'css/variables',
        options: { outputReferences: false }  // ← flattens all refs
      }]
    }
  }
}; 