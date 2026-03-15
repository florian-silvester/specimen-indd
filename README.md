# Specimen - Typography

A Figma plugin for creating and managing typography systems in your design system.

## Features

- Create mathematically sound typography scales based on a base size and scale ratio
- Adjust line height and letter spacing globally
- Preview your typography system in real-time
- Generate Figma text styles with a single click

## Development

This plugin is built using:
- TypeScript
- Preact
- create-figma-plugin utilities

### Setup

```bash
# Install dependencies
npm install

# Build plugin
npm run build

# Watch for changes
npm run watch
```

### Structure

- `src/main.ts` - Plugin logic that runs in Figma
- `src/ui.tsx` - UI code that runs in the iframe

## Usage

1. Install the plugin in Figma
2. Adjust the typography parameters (base size, scale ratio, etc.)
3. Click "Create Preview" to see your typography scale on the canvas
4. Click "Create Styles" to generate Figma text styles based on your settings 