# AI/LLM API Utilities

This folder contains utilities for AI-powered typography matching and text processing.

## Current Status: DISABLED

The AI/LLM functionality is currently **disabled** in the production UI to avoid requiring users to provide an API key. The plugin now uses a smart ratio-based algorithm for typography scanning and matching.

## Files

- **`llm-prompts.ts`** - Contains prompts for LLM-based style matching
- **`openai-utils.ts`** - OpenAI API integration utilities
- **`text-processor.ts`** - Text processing and analysis with LLMs

## Future Use

This code is preserved for potential future features:
- AI-assisted typography matching for edge cases
- Automated text style suggestions
- Natural language queries about typography systems

## Re-enabling AI Features

To re-enable AI features:

1. Uncomment the API key state and handlers in `ScanResultsScreen.tsx`
2. Uncomment the `AUTO_MATCH_STYLES` event handler in `main.ts`
3. Restore the "Auto match" button and API key modal in the UI
4. Update the footer to include API key management buttons

All the infrastructure is preserved in commented code - search for `DISABLED (kept for future use)` in the codebase.

