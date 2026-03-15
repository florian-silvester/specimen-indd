// import { getOpenaiApiKey, OPENAI_API_KEY_STORAGE_KEY } from "./openai-utils"; // REMOVED self-import
import {
    DetectedTextStyle,
    TypographySystem
} from "../core/types";
import { STYLE_KEYS } from "../core/constants";
import { LlmStructuredContent } from "./llm-prompts";
import {
  getSemanticBlurbForTopic
} from "../services/semantic-lorem";
import {
  getCurrentTermBankPack,
  rotateTermBankPack
} from "../services/term-bank-rotation";
import { SemanticTopic } from "../services/semantic-lorem-validator";

export const OPENAI_API_KEY_STORAGE_KEY = 'styleGeekOpenaiApiKey'; // Using a plugin-specific key

export async function getOpenaiApiKey(): Promise<string | null> { 
    console.log("[Main GetKey] Attempting to get key from storage key:", OPENAI_API_KEY_STORAGE_KEY);
    // IMPORTANT: Never hardcode real API keys in source control. Keys must come from clientStorage only.
    
    try {
        const key = await figma.clientStorage.getAsync(OPENAI_API_KEY_STORAGE_KEY);
        console.log(`[Main GetKey] Value retrieved: ${key ? '[present]' : 'null'}`);
        return key || null; // Ensure null is returned if key is undefined/empty
    } catch (e) {
        console.error("[Main GetKey] Error getting OpenAI API key:", e);
        return null;
    }
}

export async function setOpenaiApiKey(apiKey: string): Promise<void> { 
    console.log(`[Main SetKey] Attempting to save key starting with: ${apiKey?.substring(0, 7)}...`);
    try {
        await figma.clientStorage.setAsync(OPENAI_API_KEY_STORAGE_KEY, apiKey); 
        console.log("[Main SetKey] API key saved successfully.");
        // figma.notify("OpenAI API key saved."); // UI should handle feedback for this via SAVE_API_KEY
    } catch (e) {
        console.error("[Main SetKey] Error setting OpenAI API key:", e);
        figma.notify("Error saving API key.", { error: true });
    }
}

// Adapted callOpenaiApi function
export async function callOpenaiApiForAutoMatch(apiKey: string, systemPrompt: string, userPromptContent: string): Promise<any> {
    const API_ENDPOINT = 'https://api.openai.com/v1/chat/completions';
    const MODEL_NAME = 'o4-mini';

    console.log(`[Main callOpenaiApiForAutoMatch] Calling OpenAI API (${MODEL_NAME}).`);
    // console.log("[Main callOpenaiApiForAutoMatch] System Prompt:", systemPrompt);
    // console.log("[Main callOpenaiApiForAutoMatch] User Prompt Content:", userPromptContent);

    const payload = {
        model: MODEL_NAME,
        messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPromptContent }
        ],
        max_completion_tokens: 4096, // INCREASED: Give more room for the JSON output
        response_format: { type: "json_object" } // Crucial for structured JSON
        // Temperature will use model default if not specified, which resolved the previous error
    };

    try {
        console.log("[Main callOpenaiApiForAutoMatch] --- Attempting fetch ---");
        const response = await fetch(API_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify(payload)
        });
        console.log("[Main callOpenaiApiForAutoMatch] --- Fetch completed, processing response --- Status:", response.status);

        const responseData = await response.json(); // Attempt to parse JSON regardless of response.ok

        if (!response.ok) {
            console.error("[Main callOpenaiApiForAutoMatch] OpenAI API Error Response:", responseData);
            const errorMessage = responseData?.error?.message || `API request failed with status ${response.status}`;
            throw new Error(errorMessage);
        }

        console.log("[Main callOpenaiApiForAutoMatch] OpenAI API Raw Success Response:", responseData);
        return responseData; // Return the full parsed JSON response for the caller to process

    } catch (error) {
        console.error("[Main callOpenaiApiForAutoMatch] Error during API call:", error);
        if (error instanceof TypeError && error.message === 'Failed to fetch') {
             throw new Error('Network error: Failed to connect to OpenAI API.');
        }
        throw error; // Re-throw other errors (including the one from !response.ok)
    }
    finally {
        console.log("[Main callOpenaiApiForAutoMatch] --- Exiting try/catch/finally block ---");
    }
}

/**
 * Calls the OpenAI Chat Completion API to get structured text based on a prompt.
 * Attempts to parse the response as LlmStructuredContent JSON.
 */
export async function getStructuredTextFromLLM(
    apiKey: string,
    prompt: string
): Promise<LlmStructuredContent | null> {
    console.log("[openai-utils] getStructuredTextFromLLM called. Prompt length:", prompt.length);
    // Using modern 2024/2025 model instead of ancient 3.5-turbo
    const model = "gpt-4o-mini"; // Current generation model

    try {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: model,
                messages: [{ role: "user", content: prompt }],
                // temperature: 0.7, // Adjust as needed for creativity vs. predictability
                // max_tokens: 1500, // Adjust based on expected output size
                response_format: { type: "json_object" } // Request JSON output if model supports it
            }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({})); // Try to parse error JSON
            console.error(
                `[openai-utils] OpenAI API error: ${response.status} ${response.statusText}`,
                errorData
            );
            figma.notify(`LLM API Error: ${response.statusText}`, { error: true });
            return null;
        }

        const completion = await response.json();
        const textResponse = completion.choices?.[0]?.message?.content;

        if (textResponse) {
            console.log("[openai-utils] LLM raw text response:", textResponse);
            try {
                // The LLM is prompted to return *only* the JSON object.
                const structuredContent: LlmStructuredContent = JSON.parse(textResponse);
                // Basic validation (can be more thorough)
                if (structuredContent && Array.isArray(structuredContent.elements)) {
                    console.log("[openai-utils] Successfully parsed LlmStructuredContent:", structuredContent);
                    return structuredContent;
                } else {
                    console.error("[openai-utils] Parsed JSON does not match LlmStructuredContent structure.", structuredContent);
                    figma.notify("LLM returned invalid structured data.", { error: true });
                    return null;
                }
            } catch (e) {
                console.error("[openai-utils] Failed to parse LLM response as JSON:", e, "Raw response:", textResponse);
                figma.notify("LLM response was not valid JSON.", { error: true });
                return null;
            }
        } else {
            console.error("[openai-utils] No text response from LLM completion:", completion);
            figma.notify("LLM returned no content.", { error: true });
            return null;
        }
    } catch (error) {
        console.error("[openai-utils] Error calling OpenAI API:", error);
        figma.notify("Failed to connect to LLM API.", { error: true });
        return null;
    }
}
// Smart content for specific terms - identical length format
const TERM_CONTENT = {
  Enzyme: [
    "Enzymes are sophisticated biological catalysts that accelerate biochemical reactions by lowering activation energy barriers while remaining unchanged. These protein molecules exhibit remarkable specificity for their substrates and can increase reaction rates by factors of millions.",
    "The catalytic efficiency of enzymes stems from their unique three-dimensional structures that create highly specific active sites. Modern biochemistry recognizes enzymes as master regulators of cellular function, with over 7,000 distinct types identified.",
    "Enzyme kinetics follows precise mathematical models that describe how these molecular machines respond to varying concentrations of substrates. Their activity can be modulated through allosteric regulation and competitive inhibition, allowing cells to control metabolic flux.",
    "Industrial applications of enzymes have revolutionized biotechnology, from laundry detergents containing proteases to pharmaceutical synthesis. These biocatalysts offer sustainable alternatives to traditional chemical processes, operating under mild conditions while producing fewer byproducts.",
    "Enzyme dysfunction underlies numerous human diseases, including genetic disorders where single amino acid substitutions eliminate catalytic activity. Understanding enzyme structure-function relationships has enabled the development of targeted therapeutics, including replacement therapies and inhibitors."
  ],
  Glutamate: [
    "Glutamate serves as the brain's primary excitatory neurotransmitter, mediating over 90% of synaptic connections in the nervous system. This amino acid derivative binds to ionotropic and metabotropic receptors that control neuronal excitability, particularly NMDA receptors.",
    "The glutamate-glutamine cycle represents a sophisticated metabolic partnership between neurons and glial cells during synaptic transmission. This cycle recycles neurotransmitter molecules and prevents excitotoxicity, where excessive glutamate accumulation leads to neuronal damage and death.",
    "Excitotoxicity mediated by glutamate receptors contributes to neurodegeneration in multiple diseases, including stroke, Alzheimer's, and Huntington's. The delicate balance between glutamate's essential signaling functions and potential toxicity makes these receptors prime therapeutic targets.",
    "Beyond its neurotransmitter role, glutamate functions as a key metabolic intermediate in cellular energy production and synthesis. Its metabolic versatility extends to serving as a precursor for GABA synthesis, the brain's primary inhibitory neurotransmitter molecule.",
    "Glutamate's involvement in synaptic plasticity mechanisms, particularly long-term potentiation and depression, makes it fundamental to learning processes. Modern neuroscience recognizes glutamatergic signaling as critical for neural development, with disruptions linked to autism and schizophrenia."
  ],
  Buttress: [
    "Buttresses represent sophisticated architectural solutions that transfer lateral thrust forces from walls and roofs to stable foundations. These external supports work by redirecting horizontal forces downward through calculated angles, allowing builders to create thin walls.",
    "The flying buttress, perfected during the Gothic period, consists of an arched structure spanning from external piers. This innovation revolutionized medieval architecture by enabling unprecedented heights while maintaining structural integrity, as demonstrated in Notre-Dame Cathedral.",
    "Engineering analysis of buttress systems reveals complex force distribution patterns requiring precise geometric relationships between arch curvature and placement. Modern computational methods have validated the intuitive understanding of medieval master builders, showing efficient load management.",
    "Contemporary architecture continues to employ buttress principles in reinforced concrete and steel construction for lateral building stability. These modern applications demonstrate the enduring relevance of buttress mechanics, adapted through advanced materials and engineering analysis techniques.",
    "The aesthetic integration of buttresses into architectural design exemplifies the successful marriage of structural necessity and visual appeal. Their rhythmic repetition along building facades creates powerful visual effects while solving fundamental engineering challenges and constraints."
  ],
  Baseline: [
    "Baselines in typography establish the invisible horizontal guidelines upon which text characters rest, creating optical alignment across font sizes. This fundamental design principle ensures that mixed typography maintains visual coherence, with ascenders and descenders positioned relative to lines.",
    "Grid systems built upon baseline measurements provide designers with mathematical frameworks for organizing complex layouts with predetermined intervals. Advanced typography software automatically snaps text to baseline grids, enabling precise control over line spacing and alignment.",
    "The baseline grid serves as an organizational tool that extends beyond typography to influence image and element placement. Professional designers use baseline measurements to establish modular scales governing margin widths and spacing, creating systematic visual organization.",
    "Digital typography has refined baseline calculation methods through subpixel rendering technologies that account for screen resolution variations. These technical advances ensure consistent baseline alignment across different devices and viewing conditions, maintaining typographic integrity.",
    "Understanding baseline mechanics enables designers to manipulate visual weight and reading flow through subtle spacing adjustments. Master typographers exploit baseline relationships to create sophisticated hierarchical systems where heading styles and body text maintain mathematical relationships."
  ],
  Keystone: [
    "The keystone represents the crucial wedge-shaped stone positioned at the apex of an arch, locking all voussoirs in place. This architectural element transforms individual stones into a unified structural system that can span openings while supporting weight.",
    "Keystone mechanics rely on geometric precision where each stone's angular cut creates compressive forces preventing individual elements from falling. The removal of a keystone causes immediate structural collapse, as the balanced system loses mechanical advantage.",
    "Beyond its structural function, the keystone became a powerful symbolic element in architecture and politics, representing critical components. This metaphorical usage extends to organizational theory, where keystone species in ecosystems are recognized as disproportionately important elements.",
    "Roman engineering perfected keystone construction techniques that enabled the construction of massive aqueducts, bridges, and domed structures surviving millennia. These ancient builders understood that proper installation required temporary wooden supports called centering, holding stones in position.",
    "Modern construction continues to employ keystone principles in reinforced concrete arch bridges and masonry restoration projects with contemporary analysis. The enduring relevance of keystone mechanics demonstrates how fundamental engineering principles transcend specific materials and construction technologies."
  ],
  Catalyst: [
    "Catalysts are substances that dramatically accelerate chemical reaction rates by providing alternative reaction pathways with lower energy barriers. These materials enable reactions to proceed under milder conditions and with greater selectivity, making them indispensable for production.",
    "Heterogeneous catalysts, typically solid materials with carefully engineered surface properties, facilitate reactions between gaseous or liquid reactants through mechanisms. Platinum group metals, zeolites, and transition metal oxides exemplify this category, spanning petroleum refining and emission control.",
    "Homogeneous catalysts operate in the same phase as their reactants, often involving soluble organometallic complexes forming temporary bonds. These systems offer precise control over reaction selectivity and stereochemistry, making them essential for pharmaceutical synthesis and production.",
    "Biocatalysis harnesses the power of enzymes and whole-cell systems to perform chemical transformations under environmentally benign conditions. This approach has revolutionized the production of pharmaceuticals, flavors, and specialty chemicals while enabling novel reaction pathways.",
    "Catalyst design increasingly relies on computational modeling and machine learning approaches that predict optimal catalyst structures based on outcomes. These advanced techniques accelerate the discovery of new catalytic materials while providing insights into structure-activity relationships."
  ],
  Technology: [
    "Taiwan Semiconductor achieved first silicon at its 1.4 nm node, packing 390 million transistors per square millimeter. This breakthrough cuts leakage current by 23 percent versus previous generations. The advancement enables unprecedented processing density in mobile and computing applications.",
    "Advanced neural processing clusters achieved 38.1 exaflops across distributed chip architectures during intensive machine learning workloads. These systems process 8.4 petabytes of training data while optimizing power efficiency. This represents a major leap in automotive and robotics AI computational capabilities.",
    "Quantum computing reached a milestone when PsiQent entangled 1,024 photonic qubits on-chip with 99.2 percent fidelity. This achievement breaches the threshold for practical fault-tolerant quantum error correction. The development signals quantum computing's transition from research to applied engineering.",
    "Europe's Gaia-X federation connected 18,600 edge nodes by mid-2025, enabling cross-border AI inference at 9 ms median latency. The network preserves GDPR-grade data sovereignty while facilitating distributed computing. This infrastructure supports autonomous European digital independence from foreign cloud providers.",
    "Global grid storage deployments reached 137 GWh capacity, with lithium-iron-phosphate batteries capturing 62 percent market share. Average battery costs fell to $73 per kWh, down 24 percent year-over-year. This price reduction accelerates renewable energy adoption and grid stabilization projects worldwide."
  ],
  Poetry: [
    "Federico García Lorca's \"Sonetos del amor oscuro\" was published posthumously in 1956, cycling through eleven sonnets that explore complex themes. The assonant rhymes veil homoerotic longing beneath Granada's moonlit patios. This collection represents some of Lorca's most intimate and powerful verse work.",
    "Seamus Heaney's poem \"Digging\" opens his collection North with a triplet of spondees that transform agricultural labor into literary metaphor. The poem bridges agrarian toil with scholarly craft across Irish generations. Heaney's language captures both the physical weight of digging and the intellectual weight of writing poetry.",
    "Gwendolyn Brooks's \"We Real Cool\" from 1960 drops the pronoun \"We\" at strategic line breaks, creating syncopated rhythm. The poem distills pool-hall bravado into eight precise lines that echo urban youth culture. Brooks captures the defiant energy and underlying vulnerability of Chicago's street life.",
    "John Keats suspends narrative time in \"Ode on a Grecian Urn\" through his contemplation of frozen pastoral scenes. The poem ends with the contested chiasmus \"Beauty is truth, truth beauty\" that continues to resist definitive interpretation. This meditation on art and permanence remains central to Romantic poetry.",
    "Terrance Hayes's \"American Sonnet\" sequence from 2018 twists the traditional Petrarchan frame to address contemporary violence. The jagged couplets ricochet between police brutality statistics and intimate relationships. This work forges a powerful post-Ferguson ars poetica that confronts systemic racism through formal innovation."
  ]
};

export function getSmartContent(term: string): string {
  const termToTopic: Record<string, SemanticTopic> = {
    Enzyme: 'computerScience',
    Glutamate: 'psychology',
    Buttress: 'instruments',
    Baseline: 'mathematics',
    Keystone: 'computerScience',
    Catalyst: 'astronomy',
    Technology: 'computerScience',
    Poetry: 'recipes'
  };
  const mappedTopic = termToTopic[term];
  return getSemanticBlurbForTopic(mappedTopic);
}

// headlineGenerator.ts
// Note: fetch is available globally in Figma plugin environment
// Note: using Math.random() instead of crypto.randomInt for browser compatibility

//
// 1. Real-world word buckets (no fantasy mash-ups)
//
const ANAGRAMS = [
'Amaranth', 'Gamboge', 'Celadon', 'Falu-Red', 'Wenge', 'Coquelicot', 'Glaucous', 'Off-White', 'Zaffre', 'Fulvous',
'Puce', 'Smalt', 'Mauveine', 'Sarcoline', 'Xanadu', 'Mortuum', 'Phlox', 'Viridian', 'Bistre', 'Byzantium',
'Carmine', 'Tyrian', 'Eburnean', 'Feldgrau', 'Indanthrone', 'Gallant', 'Periwinkle', 'Persimmon', 'Razzmatazz', 'Sinopia',
'Ultramarine', 'Verdigris', 'Watchet', 'Coated', 'Jet', 'Matte', 'Languid', 'Mountbatten', 'Nacarat', 'Olivine',
'Phthalo', 'Quinacridone', 'Steel', 'Saffron', 'Taupe', 'Urobilin', 'Veronica', 'Wisteria',
'Citrine', 'Zomp', 'Kobicha', 'Malachite', 'Purple', 'Mauve', 'Perylene', 'Queen-Pink', 'Raw-Umber', 'Seashell',
'Teal', 'Ube', 'Van-Dyke', 'Xanthic', 'Ochre', 'Zinnwaldite', 'Smaragdine', 'Fandango', 'Heliotrope',
'Orchid', 'Chartreuse', 'Peridot', 'Rose', 'Rust', 'Sepia', 'Black',
] as const;

const NUMBERS = [
  '1', '2', '3', '4', '5', '6', '7', '8', '9',
  '25', '32', '37', '69', '241', '707', '808', '909', 
  '101', '202', '303', '404', '505', '20%', '74', '85', '96',
  '128', '256', '9.999', 'H66', '440', '880', '1760', '220', '110',
  '1977', '1979', '1981', 'Zero', '2030', '1991', '1993', '1997',
  '16', '64', 'Est 2025', '384', '768', '1800', '44', '48', '88', '96'
] as const;

const BIO_TERMS = [
  'Cellular', 'Synapse', 'Telomerase', 'Astrocyte', 'Glutamate',
  'Poly', 'Ribozyme', 'Strategy', 'Meth', 'Enzyme', 'Trillion',
  'Dopamine', 'Serotonin', '240 000', 'Acetyl', 'Neural', 'Peptide', 
  'Chromatin', 'Nucleo', 'Phosphate', 'Ribosome', 'Cytoplasm', 'Membrane',
  'Organelle', 'Neural', 'Hormone', 'Clam', 'Myelin', 'Dendrite',
  'Axon', 'Soma', 'Vesicle', 'Ion', 'Channel', 'Receptor', 'Ligand', 'Substrate',
  'Catalyst', 'Cofactor', 'Allosteric', 'Kinase', 'Phosphate', 'Oxidase',
  'Reductase', 'Hydrolase', 'Lyase', 'Ligase', 'Iso'
] as const;

const ARCH_TERMS = [
    'Abacus', 'Ambulatory', 'Arcature', 'Caryatid',
    'Clerestory', 'Coffering', 'Diagrid', 'Echinus', 'Entasis',
    'Exedra', 'Fenestration', 'Muqarnas', 'Mullion', 'Narthex',
    'Oculus', 'Peristyle', 'Enfilade', 'Pinnacle', 'Pronaos',
    'Reredos', 'Spandrel', 'Squinch', 'Stylobate', 'Trabeation',
    'Transept', 'Tympanum', 'Vaulting', 'Volute', 'Voussoir'
] as const;

const DESIGN_TERMS = [
  'Gadzook', 'Tittle', 'Finial', 'Beak', 'Crotch', 'Spine', 'Terminal', 'Trap', 'Overhang', 'Overshoot',
'Fraktur', 'Lombardic', 'Rotunda', 'Uncial',  'Glyphic', 
'Pica', 'Em', 'En', 'X-Height', 'Cap', 'Baseline', 'Point', 'Gutter', 'Imposition', 'Quoin',
'Contextual', 'Set', 'Tabular', 'Proportional', 'Metrics','Hint', 'Raster', 'Meta', 'Pangram', 
'Halftone', 'Duotone', 'Chroma', 'Anilox', 'Modulor',
'Boustrophedon', 'Tetradic', 'Polar-Grid', 'Overprint','Swash', 'Spur', 'Apex', 'Vertex', 'Loop',
'Bowl', 'Stem', 'Serif', 'Slug', 'Lead', 'Kern', 'Quad', 'Nick', 'Sort', 'Chase', 'Rag', 'Widow',
'Orphan', 'River', 'Glyph', 'Ligature', 'Eye', 'Tail', 'Link', 'Hook', 'Lobe', 'Chin',
'Foot', 'Knee', 'Stub', 'Spine', 
] as const;

const SPACE_TERMS = [
  'Apogee', 'Perigee', 'Aphelion', 'Perihelion', 'Zenith',
  'Nadir', 'Transit', 'Nova', 'Pulsar', 'Quasar',
  'Nebula', 'Bolide', 'Regolith', 'Synoptic', 'Albedo',
  'Umbral', 'Penumbra', 'Redshift', 'Cosmos', 'Kuiper',
  'Oort', 'Parsec', 'Tidal', 'Wobble', 'Doppler',
  'Nucleus', 'Halo', 'Syzygy', 'Apsis', 'Saros',
  'Tholin', 'Roche', 'Rupes', 'Rille', 'Spicule',
  'Plage', 'Limb', 'Baryon', 'Lyot', 'Quazar', 
] as const;

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

//
// 2. Local fallback (guaranteed 2 lines, ≤ 4 tokens, real words only)
//
export function localBodyTextLarge(): string {
  return getCurrentTermBankPack().description;
}

export function localBodyTextMain(): string {
  return getCurrentTermBankPack().description;
}

export function localBodyTextSmall(): string {
  return getCurrentTermBankPack().description;
}

export function localBodyTextMicro(): string {
  return getCurrentTermBankPack().description;
}

// Generate FULL TEXT for body text nodes during headline updates
export function localBodySentence(): string {
  return getCurrentTermBankPack().description;
}

// Generate better subheadings (shorter, more appropriate for h4s)
export function localSubheading(): string {
  return getCurrentTermBankPack().expression;
}

// Counter for predictable number generation
let headlineCounter = 0;

function toTwoLineHeadline(expression: string): string {
  if (expression.includes('\n')) return expression;
  const words = expression.split(/\s+/).filter(Boolean);
  if (words.length <= 1) return expression;
  if (words.length === 2) return `${words[0]}\n${words[1]}`;
  let bestSplit = 1;
  let bestDiff = Infinity;
  for (let i = 1; i < words.length; i++) {
    const topLen = words.slice(0, i).join(' ').length;
    const bottomLen = words.slice(i).join(' ').length;
    const diff = Math.abs(topLen - bottomLen);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestSplit = i;
    }
  }
  return `${words.slice(0, bestSplit).join(' ')}\n${words.slice(bestSplit).join(' ')}`;
}

export function localHeadline(): string {
  console.log('[Local Headline] 🎲 Generating semantic headline...');
  headlineCounter++;
  const expression = rotateTermBankPack().expression;
  const result = toTwoLineHeadline(expression);
  console.log(`[Local Headline] 🎯 Generated: "${result}"`);
  return result;
}

// NEW: Article-specific headline generator (3-6 words, waterfall-style with line break)
export function localArticleHeadline(): string {
  console.log('[Article Headline] 🎲 Generating semantic article headline...');
  const result = toTwoLineHeadline(getCurrentTermBankPack().expression);
  console.log(`[Article Headline] 🎯 Generated: "${result.replace('\n', ' / ')}"`);
  return result;
}

// LLM functions removed - specimen now uses reliable const buckets only

//
// 5. The exported function
//
/**
 * Generates text for the update-text feature.
 * - specimen: two-line headlines (always from const buckets - reliable)
 * - waterfall: creative sentences (LLM with template fallback)
 */
export async function generateTextWithLLM(
  apiKey: string,
  layoutType: 'specimen' | 'waterfall'
): Promise<string> {
  console.log(`[LLM Text Gen] 🎬 Starting ${layoutType} generation...`);

  // Better seed generation - more random
  const seed = Math.floor(Math.random() * 100000) + Date.now() % 1000;
  console.log(`[LLM Text Gen] 🎲 Using seed: ${seed}`);

  if (layoutType === 'waterfall') {
    // Always use reliable const bucket templates (no LLM)
    const allBuckets = [ANAGRAMS, BIO_TERMS, ARCH_TERMS, DESIGN_TERMS, SPACE_TERMS];
    const templates = [
      "The %s research reveals %s patterns",
      "Modern %s incorporates %s elements", 
      "Advanced %s utilizes %s methodology",
      "Contemporary %s demonstrates %s principles",
      "Sophisticated %s explores %s frameworks",
      "Parametric %s reveals %s structures",
      "Revolutionary %s incorporates %s elements",
      "Complex %s demonstrates %s architectures"
    ];
    
    const template = pick(templates);
    const word1 = pick(allBuckets[Math.floor(Math.random() * allBuckets.length)]).toLowerCase();
    const word2 = pick(allBuckets[Math.floor(Math.random() * allBuckets.length)]).toLowerCase();
    
    let result = template.replace('%s', word1).replace('%s', word2);
    result = result.charAt(0).toUpperCase() + result.slice(1);
    
    console.log(`[Waterfall] Template generated: "${result}"`);
    return result;
  }

  // for specimen: ALWAYS use local buckets (LLM gets stuck repeating words)
  return localHeadline();
}

// Counter for cycling through different topic buckets (persistent across calls)
let topicBucketCounter = 0;

// Generate LLM articles cycling through different topic buckets
export async function generateArticleContentWithLLM(apiKey: string): Promise<{
  headline: string;
  bodyParagraphs: string[];
  subheadings: string[];
} | null> {
  console.log(`[LLM Article Gen] 🎲 Generating article with topic cycling (call #${topicBucketCounter + 1})...`);
  
  // Cycle through the different const buckets for variety
  const allBuckets = [ANAGRAMS, BIO_TERMS, ARCH_TERMS, DESIGN_TERMS, SPACE_TERMS];
  const bucketNames = ['Colors & Materials', 'Biological Sciences', 'Architecture & Design', 'Typography & Design', 'Space & Astronomy'];
  
  const currentBucket = allBuckets[topicBucketCounter % allBuckets.length];
  const currentBucketName = bucketNames[topicBucketCounter % bucketNames.length];
  
  // Pick 2-3 terms from the current bucket
  const selectedTerms: string[] = [];
  for (let i = 0; i < 3; i++) {
    const term = pick(currentBucket);
    if (!selectedTerms.includes(term)) {
      selectedTerms.push(term);
    }
  }
  
  const currentCall = topicBucketCounter;
  topicBucketCounter++; // Increment for next time
  
  console.log(`[LLM Article Gen] 📚 Call #${currentCall + 1} - Topic bucket: ${currentBucketName}, Terms: ${selectedTerms.join(', ')}, API key: ${apiKey.substring(0,7)}...`);
  
  // Create a prompt for article generation
  const prompt = `Write a engaging, informative article about ${selectedTerms[0]} in the context of ${currentBucketName.toLowerCase()}. 

Please structure your response as a JSON object with this exact format:
{
  "headline": "Compelling 2-4 word headline about ${selectedTerms[0]}",
  "bodyParagraphs": [
    "Opening paragraph introducing ${selectedTerms[0]} (150-200 words)",
    "Second paragraph exploring deeper aspects (150-200 words)",
    "Third paragraph with practical applications or examples (150-200 words)"
  ],
  "subheadings": [
    "Short subheading for section 1",
    "Short subheading for section 2"
  ]
}

Write in an informative, engaging style suitable for educated readers. Focus on concrete details and interesting insights about ${selectedTerms[0]}. Keep the total length around 600-800 words.`;

  try {
    // Use direct API call with timeout (using Promise.race instead of AbortController)
    const model = "gpt-4o-mini";
    
    const fetchPromise = fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model,
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" }
      })
    });
    
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Request timed out after 30 seconds')), 30000)
    );
    
    const response = await Promise.race([fetchPromise, timeoutPromise]) as Response;

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error(`[LLM Article Gen] OpenAI API error: ${response.status} ${response.statusText}`, errorData);
      return null;
    }

    const completion = await response.json();
    const textResponse = completion.choices?.[0]?.message?.content;

    if (textResponse) {
      console.log("[LLM Article Gen] ✅ Got LLM response, length:", textResponse.length);
      console.log("[LLM Article Gen] Raw response preview:", textResponse.substring(0, 200) + "...");
      try {
        const articleContent = JSON.parse(textResponse);
        console.log("[LLM Article Gen] 🔍 Parsed JSON structure:", Object.keys(articleContent));
        
        // Basic validation - more lenient than before
        if (articleContent && 
            articleContent.headline && 
            Array.isArray(articleContent.bodyParagraphs) && 
            Array.isArray(articleContent.subheadings)) {
          
          console.log(`[LLM Article Gen] ✅ LLM response structure valid:
            - Headline: "${articleContent.headline}"
            - Body paragraphs: ${articleContent.bodyParagraphs.length}
            - Subheadings: ${articleContent.subheadings.length}`);
          
          return articleContent;
        } else {
          console.error("[LLM Article Gen] ❌ Response structure invalid. Expected: headline, bodyParagraphs[], subheadings[]");
          console.error("[LLM Article Gen] ❌ Got:", {
            hasHeadline: !!articleContent.headline,
            bodyParagraphsType: Array.isArray(articleContent.bodyParagraphs) ? 'array' : typeof articleContent.bodyParagraphs,
            subheadingsType: Array.isArray(articleContent.subheadings) ? 'array' : typeof articleContent.subheadings,
            actualKeys: Object.keys(articleContent)
          });
          return null;
        }
      } catch (e) {
        console.error("[LLM Article Gen] ❌ JSON parse failed:", e);
        console.error("[LLM Article Gen] ❌ Raw response:", textResponse);
        return null;
      }
    } else {
      console.error("[LLM Article Gen] ❌ No text response. Full completion:", completion);
      return null;
    }
  } catch (error) {
    if (error instanceof Error && error.message === 'Request timed out after 30 seconds') {
      console.error('[LLM Article Gen] ⏱️ Request timed out after 30 seconds');
    } else {
      console.error('[LLM Article Gen] ❌ Error generating article:', error);
    }
    return null;
  }
}

// Fallback function that creates article-like content from local generators
export function generateLocalArticleContent(): {
  headline: string;
  bodyParagraphs: string[];
  subheadings: string[];
} {
  console.log('[Local Article Gen] 🎲 Generating local article content...');
  
  return {
    headline: localArticleHeadline(),
    bodyParagraphs: [
      localBodySentence(),
      localBodySentence(),
      localBodySentence()
    ],
    subheadings: [
      localArticleHeadline().replace('\n', ' '),
      localArticleHeadline().replace('\n', ' ')
    ]
  };
}