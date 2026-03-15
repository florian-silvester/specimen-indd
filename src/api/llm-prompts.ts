import { TypographySystem } from '../core/types';
import { DetectedTextStyle } from '../core/types';
import { STYLE_KEYS, TYPOGRAPHY_SCALE_ORDER } from '../core/constants';

/**
 * Defines the expected structure for the LLM's output when processing unformatted text.
 */
export interface LlmStructuredContent {
  suggestedFrameTitle?: string; // Optional title for the Figma frame, suggested by the LLM
  elements: Array<{
    role: keyof TypographySystem; // e.g., 'display', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'textLarge', 'textMain', 'textSmall', 'micro'
    content: string; // The actual text content for this element
  }>;
}

/**
 * Generates the prompt for the LLM to analyze, refine, and structure unformatted text.
 *
 * @param rawText The unformatted text input by the user.
 * @param contentType The purpose/type of content (e.g., 'blog', 'marketing', 'general').
 * @returns A string representing the complete prompt for the LLM.
 */
export function generateStructuringPrompt(rawText: string, contentType: string): string {
  const rolesAvailable: Array<keyof TypographySystem> = [...TYPOGRAPHY_SCALE_ORDER.ALL_STYLES] as Array<keyof TypographySystem>;

  // Main instruction block
  let prompt = `You are an expert text structurer and editor. Your task is to take the following raw text, understand its context based on the specified content type, and then refine and structure it into a coherent piece with a clear hierarchy, adhering to specific structural and length requirements.

CONTENT TYPE: "${contentType}"

RAW TEXT:
"""
${rawText}
"""

Detailed Instructions:
1.  **Overall Goal: Create a Long-Form Blog Article**
    *   Your primary objective is to transform the raw text into a high-quality, engaging, and coherent long-form blog article or in-depth piece. The final output should read like something a person would sit down to read for information and understanding, not just a structured list of facts. Emphasize narrative flow, thoughtful explanations, and a professional tone suitable for the given content type.

2.  **Mandatory Initial Structure**: The output MUST begin with the following elements in this exact order:
    *   **Content Info Line**: A single line of content information, similar to a blog post's date/topic line (e.g., "CURRENT_DATE / INFERRED_TOPIC"). Assign this the role 'micro'. You should infer the topic from the text. For "CURRENT_DATE", you can use a placeholder like "[Current Date]" or the literal string "Current Date". **This entire line MUST be a maximum of 5 words.**
    *   **Main Title (H1)**: A primary title for the content using the 'h1' role. This title MUST be concise, ideally 1-2 lines and contain a maximum of 5 words.

    *   **Introductory Paragraph (textLarge)**: A short introduction using the 'textLarge' role. This paragraph should be approximately 1 line long and serve as a compelling entry point to the article, setting the stage for the main content.

3.  **Main Content Structuring - Focus on Depth and Narrative**:
    *   Following the introduction, you may use 'h4' as sub-headers for distinct major sections of the article. Each 'h4' MUST be concise, with a maximum of 5 words.
    *   **Crucially, you MUST use a maximum of 2 (2) 'h4' elements in the entire output.** This means you need to be very selective. Group related themes and discussions into substantial sections under these limited h4s.
    *   The content under each 'h4' (or if no h4s are used, the main body after the intro) should primarily use the 'textMain' role. 
    *   **Each \`textMain\` section following an H4 should be well-developed and informative, typically 150-300 words per section.** Focus on quality over quantity. If the raw text provided by the user is insufficient, expand thoughtfully with relevant details and examples, but keep it concise and readable. You must invent and write substantial new material, including relevant details, illustrative examples (fictional but plausible), in-depth explanations, and flowing narrative arguments. Avoid a staccato, list-like feel; weave a story or a detailed argument. The example text below illustrates the *style* of detailed development expected:
        *   """
        *   While the rise of sophisticated AI models in code review promises unprecedented efficiency and accuracy, it's crucial to remember that software development remains an intensely human endeavor. The goal of AI isn't to replace developers, but to augment their capabilities, freeing them from a significant portion of the repetitive, pattern-matching tasks that, while necessary, can often feel like a drain on creative energy. By automating the detection of common pitfalls, stylistic inconsistencies, or potential security vulnerabilities, AI acts as a tireless assistant, allowing human reviewers to focus their expertise on more complex architectural considerations, the nuances of business logic, or the mentorship aspects of a code review. This shift is profound. It means developers can spend less time on the 'what' and 'how' of low-level code correctness – which the AI can increasingly handle – and more time on the 'why' behind the software. This fosters a more engaging and intellectually stimulating environment, where the review process becomes less about finding errors and more about collaborative problem-solving and knowledge sharing. Furthermore, by providing consistent, objective feedback, AI can help democratize code quality, ensuring that best practices are followed across the board, regardless of a developer's individual experience level or their familiarity with a particular section of the codebase. This doesn't diminish the role of senior developers; rather, it empowers them to act as strategic guides and mentors, shaping the overall direction and quality of the project at a higher level, confident that the foundational checks are being handled with machine precision. The synergy between human insight and AI's analytical power is where the true revolution in code review lies, leading to faster, more reliable, and ultimately, more innovative software. This approach ensures that the technology serves the team, enhancing their skills and productivity, rather than dictating a rigid, overly automated workflow that might stifle creativity or overlook subtle but critical aspects of a complex system that only human intuition can grasp.
        *   """

4.  **Fictional Author Notes (Mandatory Conclusion)**:
    *   After all main article content, the piece MUST conclude with one or more elements using the 'textSmall' role to represent fictional author notes. This could be a short paragraph (e.g., 2-4 sentences) where the fictional author might thank the reader, hint at future topics, or offer a brief, relevant closing thought. The content should be invented by you to fit the article's tone and topic.

5.  **Content Length and Expansion - Generating Topical Content**:
    *   The entire structured output should be comprehensive but readable, typically 800-1200 words total. Focus on creating engaging, informative content that readers will actually want to read.
    *   **Content Generation Guidelines**: If the raw text is minimal, expand it thoughtfully with relevant details, examples, and explanations while maintaining readability. Focus on providing value to the reader rather than hitting arbitrary word counts.

6.  **Overall Hierarchy and Use of Other Roles**:
    *   The primary goal is a clear, logical, and readable hierarchy. While 'micro' (for the initial info), 'h1', 'textLarge', 'h4', and 'textMain' will form the core structure as defined above, you may use other available roles sparingly and appropriately.
    *   For example:
        *   'display': Only if a highly prominent pre-title element is absolutely necessary and distinct from the 'h1'.
        *   'h2', 'h3', 'h5', 'h6': For deeper levels of sub-hierarchy if the content is particularly complex and warrants it.
        *   'textSmall', 'micro' (beyond initial info): For captions, footnotes, or other ancillary text.
    *   The available roles are: ${rolesAvailable.join(', ')}. (Note: Prioritize h1, textLarge, h4, textMain, and micro for the core structure as described. Other roles like h2, h3, h5, h6, display should be used very sparingly, if at all, only if essential for an exceptionally complex structure that cannot be conveyed otherwise within the h4 limit and blog style.)

7.  **Output Format**:
    *   You MUST return your response as a single, valid JSON object.
    *   The JSON object must conform to the following TypeScript interface:

        \`\`\`json
        {
          "suggestedFrameTitle": "string | undefined", // Optional: A suggested title for the Figma frame. Can be the same as the H1 content or a slight variation.
          "elements": [
            // Starts with the 'micro' info line, then 'h1', then 'textLarge', then 'h4's and 'textMain' etc.
            // Concludes with author notes (textSmall).
            { "role": "TYPOGRAPHIC_ROLE", "content": "string" },
            // ... more elements
          ]
        }
        \`\`\`
    *   In the "elements" array, TYPOGRAPHIC_ROLE must be one of the allowed roles.
    *   The "elements" array must be ordered sequentially as the text should appear, strictly following the mandatory initial structure.
    *   Ensure the output is ONLY the JSON object, with no other text before or after it. No conversational fluff, just the JSON.
`;

  // Add content-type specific instructions
  // These should now be seen as additive or providing further nuance to the general instructions.
  if (contentType === 'blog') {
    prompt += "\n\n**For 'blog' post (specific considerations):**\nBeyond the general structure, prioritize a clear narrative flow, engaging headings (especially for H4s), and well-structured paragraphs. Ensure the tone is appropriate for a blog readership.";
  } else if (contentType === 'marketing') {
    prompt += "\n\n**For 'marketing' content (specific considerations):**\nFocus on persuasive language, clear calls to action (if any are implied or can be logically added during expansion), and impactful headlines (H1 and H4s). The 'textLarge' intro should be particularly engaging. Expansion to 500 words should reinforce marketing goals.";
  }

  prompt += "\n\nRemember: Provide ONLY the JSON output, adhering strictly to all structural, content, and length requirements.";

  return prompt;
}

// --- NEW PROMPT FOR AUTO-MATCHING DETECTED STYLES ---

/**
 * Generates the system prompt for the OpenAI API to map detected text styles.
 * @param stylesToMatch - An array of detected text styles from the user's frame.
 * @returns The system prompt string.
 */
export function getAutoMatchSystemPrompt(stylesToMatch: DetectedTextStyle[]): string {
  // Analyze the size range to provide context
  const sizes = stylesToMatch.map(s => s.fontSize);
  const minSize = Math.min(...sizes);
  const maxSize = Math.max(...sizes);
  const mostCommonSize = sizes.sort((a,b) => sizes.filter(v => v === a).length - sizes.filter(v => v === b).length).pop();
  
  // Create size distribution context
  const sizeDistribution = sizes.map(size => `${size}px`).join(', ');
  
  const systemPrompt = `You are a TYPOGRAPHY EXPERT specializing in design systems. Your task is to intelligently map detected text styles to a standard typographic hierarchy based on TYPOGRAPHY PRINCIPLES.

🎯 CRITICAL TYPOGRAPHY RULES (NEVER VIOLATE THESE):

1. **SIZE-BASED HIERARCHY RULES** (Most Important):
   - 50px+ → ONLY map to "H0", "H1", or "H2" (Large headings)
   - 30-50px → ONLY map to "H2", "H3", or "H4" (Medium headings)  
   - 20-30px → Can map to "H4", "H5", "H6", or "Text Large" (Small headings + large text)
   - 14-20px → ONLY map to "Text Large" or "Text Main" (Body text)
   - 12-14px → ONLY map to "Text Main" or "Text Small" (Small body text)
   - Below 12px → ONLY map to "Text Small" or "Text Tiny" (Tiny text)

2. **CONTEXT ANALYSIS FOR THIS DOCUMENT**:
   - Size range: ${minSize}px to ${maxSize}px
   - Most common size: ${mostCommonSize}px (likely body text = "Text Main")
   - All detected sizes: ${sizeDistribution}
   - Largest size (${maxSize}px) should map to heading styles (H0/H1/H2)
   - Smallest size (${minSize}px) should map to small text styles

3. **INTELLIGENT MAPPING LOGIC**:
   - **Font Weight**: Bold/Heavy styles are usually headings, Regular/Light are usually body text
   - **Instance Count**: High instance counts (10+) are often body text, low counts (1-3) are often headings
   - **Name Context**: If nodeName contains "heading/title/hero" → heading styles, "body/text/paragraph" → text styles

4. **VALIDATION CHECKS** (Reject mappings that violate these):
   ❌ NEVER map 50px to "Text Main" or smaller - this destroys hierarchy!
   ❌ NEVER map 12px to "H1" or larger - this makes no typographic sense!
   ❌ NEVER map the largest size to anything smaller than H3
   ❌ NEVER map the smallest size to anything larger than Text Main

5. **AVAILABLE SYSTEM STYLES** (in hierarchical order):
   - **Headings**: "H0" (largest), "H1", "H2", "H3", "H4", "H5", "H6" (smallest heading)
   - **Text**: "Text Large", "Text Main", "Text Small", "Text Tiny" (smallest)
   - **None**: Only use if truly no appropriate mapping exists

**OUTPUT FORMAT**: Return ONLY valid JSON:
{
  "mapped_styles": [
    {"id": "original-style-id", "mappedSystemStyle": "H1"},
    {"id": "another-style-id", "mappedSystemStyle": "Text Main"}
  ]
}

**EXAMPLE GOOD MAPPINGS**:
- 72px Bold → "H0" or "H1" ✅
- 48px Bold → "H2" or "H3" ✅  
- 24px Regular → "H5" or "Text Large" ✅
- 16px Regular (high instances) → "Text Main" ✅
- 12px Regular → "Text Small" ✅

**EXAMPLE BAD MAPPINGS** (NEVER DO THESE):
- 50px → "Text Main" ❌ (Huge size mapped to body text!)
- 12px → "H1" ❌ (Tiny size mapped to large heading!)
- 60px → "Text Small" ❌ (Largest size mapped to small text!)

Remember: You are creating a FUNCTIONAL typography system, not random mappings. Size hierarchy is SACRED in typography!`;

  return systemPrompt;
}

export function getRelumeSmartMatchPrompt(detectedStyles: any[]): string {
  return `You are a design system expert specializing in the Relume design system. Your task is to analyze a list of detected text styles from a Figma file and map them to the Relume typographic scale.

The Relume system has a specific structure. Here are the typical styles:
- Heading styles: "Desktop/H1", "Desktop/H2", "Desktop/H3", "Desktop/H4", "Desktop/H5", "Desktop/H6"
- Body text styles: "Large Text", "Medium Text", "Regular Text", "Small Text", "Tiny Text"
- Mobile styles: "Mobile/H1", "Mobile/H2", etc.

Analyze each style based on its font size, family, weight, and name. Provide the output as a JSON object with a single key "mapped_styles", which is an array of objects. Each object should contain the original style's "id" and the "mappedSystemStyle" you've determined (e.g., "Desktop/H1", "Large Text").

Example Input:
[
  {"id":"Inter-Bold-56","fontFamily":"Inter","fontStyle":"Bold","fontSize":56,"name":"Desktop/H2"},
  {"id":"Inter-Regular-16","fontFamily":"Inter","fontStyle":"Regular","fontSize":16,"name":"Regular Text"}
]

Example Output:
{
  "mapped_styles": [
    {"id":"Inter-Bold-56","mappedSystemStyle":"Desktop/H2"},
    {"id":"Inter-Regular-16","mappedSystemStyle":"Regular Text"}
  ]
}`;
} 