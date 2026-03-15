import { LlmStructuredContent } from '../api/llm-prompts';
import { STYLE_KEYS } from '../core/constants';

export const genericArticleContent: LlmStructuredContent = {
  suggestedFrameTitle: "Placeholder Article",
  elements: [
    {
      role: STYLE_KEYS.MICRO,
      content: "Article"
    },
    {
      role: STYLE_KEYS.H1,
      content: "Article Headline"
    },
    {
      role: STYLE_KEYS.TEXT_LARGE,
      content: "This is a larger body text, often used for an introductory paragraph or a subheading to provide a visual step down from the main headline."
    },
    {
      role: STYLE_KEYS.H4,
      content: "Section Subheading"
    },
    {
      role: STYLE_KEYS.TEXT_MAIN,
      content: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat."
    },
    {
      role: STYLE_KEYS.H4,
      content: "Another Subheading"
    },
    {
      role: STYLE_KEYS.TEXT_MAIN,
      content: "Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum."
    }
  ]
}; 