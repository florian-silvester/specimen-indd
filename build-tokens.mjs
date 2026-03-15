const StyleDictionary = require('style-dictionary');
const { registerTransforms } = require('@tokens-studio/sd-transforms');

// Register Tokens Studio transforms
registerTransforms(StyleDictionary);

// Load the configuration file
const sd = StyleDictionary.extend('config.json');

// Build the platform specified in the config
sd.buildPlatform('css');

console.log('\n==============================================');
console.log('\nBuild completed using config.json!'); 