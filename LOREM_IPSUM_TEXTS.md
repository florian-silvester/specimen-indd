# Placeholder Text And Generated Word Combos Audit

This is a complete audit of placeholder strings and generated text pools currently present in the codebase.

## 1) Structured Placeholder Article

Source: `src/services/placeholder-data.ts`

- `suggestedFrameTitle`: `Placeholder Article`
- Elements:
  - `Article`
  - `Article Headline`
  - `This is a larger body text, often used for an introductory paragraph or a subheading to provide a visual step down from the main headline.`
  - `Section Subheading`
  - `Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.`
  - `Another Subheading`
  - `Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.`

## 2) Event-Handler Placeholder/Generated Pools

Source: `src/services/event-handlers.ts`

### 2.1 Headlines Pool

- `Heading\nhere`
- `Paradox Fuels\nProgress`
- `Silence Mirrors\nThought`
- `Digital\nCrafts`
- `Urban\nRhythms`
- `Code\nPoetry`
- `Pixel\nDreams`
- `Data\nFlows`
- `Neon\nPulse`
- `Sound\nWaves`
- `Light\nBeams`
- `Storm\nClouds`
- `Ocean\nDepths`
- `Future\nEcho`
- `Mind\nScape`
- `Time\nShift`
- `Space\nWarp`
- `Energy\nBurst`
- `Crystal\nClear`
- `Shadow\nPlay`

### 2.2 Decorative Texts

- `Aa`
- `123`
- `XYZ`

### 2.3 Waterfall Texts

- `abcdefghijklmnopqrstuvwxyz1234567`
- `ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567`
- `the quick brown fox jumps over lazy dogs`
- `TYPOGRAPHY IS THE ART OF ARRANGING TYPE`
- `spacing rhythm contrast hierarchy balance`
- `0123456789 FONTS STYLES WEIGHTS METRICS`
- `Lorem ipsum dolor sit amet consectetur`
- `Hamburgefonstiv ABCDEFGH abcdefgh 123`
- `How razzing black wizards jump quickly`
- `Pack my box with five dozen liquor jugs`

### 2.4 Play Text Word Pool (`PLAY_TEXT_WORDS`)

- `Tittle`, `Finial`, `Spine`, `Terminal`, `Overshoot`, `X-Height`, `Baseline`, `Gutter`
- `Contextual`, `Metrics`, `Pangram`, `Halftone`, `Duotone`, `Chroma`, `Modulor`
- `Swash`, `Apex`, `Vertex`, `Loop`, `Bowl`, `Stem`, `Serif`, `Kern`, `Glyph`, `Ligature`
- `Fraktur`, `Lombardic`, `Rotunda`, `Uncial`, `Pica`, `Em`, `En`, `Cap`, `Point`
- `Overprint`, `Spur`, `Slug`, `Lead`, `Quad`, `Nick`, `Sort`, `Chase`, `Rag`
- `Abacus`, `Ambulatory`, `Arcature`, `Clerestory`, `Coffering`, `Diagrid`, `Entasis`
- `Fenestration`, `Mullion`, `Oculus`, `Peristyle`, `Pinnacle`, `Spandrel`, `Squinch`
- `Caryatid`, `Echinus`, `Exedra`, `Muqarnas`, `Narthex`, `Pronaos`, `Reredos`
- `Stylobate`, `Trabeation`, `Transept`, `Tympanum`, `Vaulting`, `Volute`, `Voussoir`
- `Cellular`, `Synapse`, `Enzyme`, `Dopamine`, `Serotonin`, `Neural`, `Peptide`
- `Chromatin`, `Ribosome`, `Cytoplasm`, `Membrane`, `Organelle`, `Hormone`, `Receptor`
- `Telomerase`, `Astrocyte`, `Glutamate`, `Ribozyme`, `Acetyl`, `Kinase`, `Ligase`
- `Apogee`, `Perigee`, `Zenith`, `Nadir`, `Transit`, `Nova`, `Pulsar`, `Quasar`
- `Nebula`, `Bolide`, `Regolith`, `Albedo`, `Umbral`, `Penumbra`, `Redshift`, `Cosmos`
- `Aphelion`, `Perihelion`, `Syzygy`, `Parsec`, `Kuiper`, `Oort`, `Baryon`, `Tholin`
- `Amaranth`, `Gamboge`, `Celadon`, `Wenge`, `Coquelicot`, `Glaucous`, `Zaffre`, `Fulvous`
- `Puce`, `Smalt`, `Mauveine`, `Sarcoline`, `Xanadu`, `Viridian`, `Bistre`, `Byzantium`
- `Carmine`, `Tyrian`, `Periwinkle`, `Persimmon`, `Sinopia`, `Ultramarine`, `Verdigris`
- `Citrine`, `Malachite`, `Chartreuse`, `Peridot`, `Sepia`, `Taupe`, `Teal`, `Orchid`
- `the`, `a`, `and`, `of`, `in`, `with`, `through`, `across`, `within`, `beyond`
- `creates`, `defines`, `shapes`, `transforms`, `guides`, `reveals`, `bridges`

### 2.5 Play Text Number Pool (`PLAY_TEXT_NUMBERS`)

- `1`, `2`, `3`, `4`, `5`, `6`, `7`, `8`, `9`
- `25`, `32`, `37`, `69`, `101`, `202`, `303`, `404`, `505`
- `707`, `808`, `909`, `20%`, `74`, `85`, `96`, `128`, `256`
- `16`, `64`, `384`, `768`, `44`, `48`, `88`, `96`, `440`, `880`

### 2.6 Smart Terms Used For Long Placeholder Generation

Used by `generatePlaceholderText(wordCount > 15)`:
- `Enzyme`
- `Glutamate`
- `Buttress`
- `Baseline`
- `Keystone`
- `Catalyst`
- `Technology`
- `Poetry`

## 3) Smart Content Buckets (Full Paragraph Sources)

Source: `src/api/openai-utils.ts` (`TERM_CONTENT`)

### Enzyme

1. `Enzymes are sophisticated biological catalysts that accelerate biochemical reactions by lowering activation energy barriers while remaining unchanged. These protein molecules exhibit remarkable specificity for their substrates and can increase reaction rates by factors of millions.`
2. `The catalytic efficiency of enzymes stems from their unique three-dimensional structures that create highly specific active sites. Modern biochemistry recognizes enzymes as master regulators of cellular function, with over 7,000 distinct types identified.`
3. `Enzyme kinetics follows precise mathematical models that describe how these molecular machines respond to varying concentrations of substrates. Their activity can be modulated through allosteric regulation and competitive inhibition, allowing cells to control metabolic flux.`
4. `Industrial applications of enzymes have revolutionized biotechnology, from laundry detergents containing proteases to pharmaceutical synthesis. These biocatalysts offer sustainable alternatives to traditional chemical processes, operating under mild conditions while producing fewer byproducts.`
5. `Enzyme dysfunction underlies numerous human diseases, including genetic disorders where single amino acid substitutions eliminate catalytic activity. Understanding enzyme structure-function relationships has enabled the development of targeted therapeutics, including replacement therapies and inhibitors.`

### Glutamate

1. `Glutamate serves as the brain's primary excitatory neurotransmitter, mediating over 90% of synaptic connections in the nervous system. This amino acid derivative binds to ionotropic and metabotropic receptors that control neuronal excitability, particularly NMDA receptors.`
2. `The glutamate-glutamine cycle represents a sophisticated metabolic partnership between neurons and glial cells during synaptic transmission. This cycle recycles neurotransmitter molecules and prevents excitotoxicity, where excessive glutamate accumulation leads to neuronal damage and death.`
3. `Excitotoxicity mediated by glutamate receptors contributes to neurodegeneration in multiple diseases, including stroke, Alzheimer's, and Huntington's. The delicate balance between glutamate's essential signaling functions and potential toxicity makes these receptors prime therapeutic targets.`
4. `Beyond its neurotransmitter role, glutamate functions as a key metabolic intermediate in cellular energy production and synthesis. Its metabolic versatility extends to serving as a precursor for GABA synthesis, the brain's primary inhibitory neurotransmitter molecule.`
5. `Glutamate's involvement in synaptic plasticity mechanisms, particularly long-term potentiation and depression, makes it fundamental to learning processes. Modern neuroscience recognizes glutamatergic signaling as critical for neural development, with disruptions linked to autism and schizophrenia.`

### Buttress

1. `Buttresses represent sophisticated architectural solutions that transfer lateral thrust forces from walls and roofs to stable foundations. These external supports work by redirecting horizontal forces downward through calculated angles, allowing builders to create thin walls.`
2. `The flying buttress, perfected during the Gothic period, consists of an arched structure spanning from external piers. This innovation revolutionized medieval architecture by enabling unprecedented heights while maintaining structural integrity, as demonstrated in Notre-Dame Cathedral.`
3. `Engineering analysis of buttress systems reveals complex force distribution patterns requiring precise geometric relationships between arch curvature and placement. Modern computational methods have validated the intuitive understanding of medieval master builders, showing efficient load management.`
4. `Contemporary architecture continues to employ buttress principles in reinforced concrete and steel construction for lateral building stability. These modern applications demonstrate the enduring relevance of buttress mechanics, adapted through advanced materials and engineering analysis techniques.`
5. `The aesthetic integration of buttresses into architectural design exemplifies the successful marriage of structural necessity and visual appeal. Their rhythmic repetition along building facades creates powerful visual effects while solving fundamental engineering challenges and constraints.`

### Baseline

1. `Baselines in typography establish the invisible horizontal guidelines upon which text characters rest, creating optical alignment across font sizes. This fundamental design principle ensures that mixed typography maintains visual coherence, with ascenders and descenders positioned relative to lines.`
2. `Grid systems built upon baseline measurements provide designers with mathematical frameworks for organizing complex layouts with predetermined intervals. Advanced typography software automatically snaps text to baseline grids, enabling precise control over line spacing and alignment.`
3. `The baseline grid serves as an organizational tool that extends beyond typography to influence image and element placement. Professional designers use baseline measurements to establish modular scales governing margin widths and spacing, creating systematic visual organization.`
4. `Digital typography has refined baseline calculation methods through subpixel rendering technologies that account for screen resolution variations. These technical advances ensure consistent baseline alignment across different devices and viewing conditions, maintaining typographic integrity.`
5. `Understanding baseline mechanics enables designers to manipulate visual weight and reading flow through subtle spacing adjustments. Master typographers exploit baseline relationships to create sophisticated hierarchical systems where heading styles and body text maintain mathematical relationships.`

### Keystone

1. `The keystone represents the crucial wedge-shaped stone positioned at the apex of an arch, locking all voussoirs in place. This architectural element transforms individual stones into a unified structural system that can span openings while supporting weight.`
2. `Keystone mechanics rely on geometric precision where each stone's angular cut creates compressive forces preventing individual elements from falling. The removal of a keystone causes immediate structural collapse, as the balanced system loses mechanical advantage.`
3. `Beyond its structural function, the keystone became a powerful symbolic element in architecture and politics, representing critical components. This metaphorical usage extends to organizational theory, where keystone species in ecosystems are recognized as disproportionately important elements.`
4. `Roman engineering perfected keystone construction techniques that enabled the construction of massive aqueducts, bridges, and domed structures surviving millennia. These ancient builders understood that proper installation required temporary wooden supports called centering, holding stones in position.`
5. `Modern construction continues to employ keystone principles in reinforced concrete arch bridges and masonry restoration projects with contemporary analysis. The enduring relevance of keystone mechanics demonstrates how fundamental engineering principles transcend specific materials and construction technologies.`

### Catalyst

1. `Catalysts are substances that dramatically accelerate chemical reaction rates by providing alternative reaction pathways with lower energy barriers. These materials enable reactions to proceed under milder conditions and with greater selectivity, making them indispensable for production.`
2. `Heterogeneous catalysts, typically solid materials with carefully engineered surface properties, facilitate reactions between gaseous or liquid reactants through mechanisms. Platinum group metals, zeolites, and transition metal oxides exemplify this category, spanning petroleum refining and emission control.`
3. `Homogeneous catalysts operate in the same phase as their reactants, often involving soluble organometallic complexes forming temporary bonds. These systems offer precise control over reaction selectivity and stereochemistry, making them essential for pharmaceutical synthesis and production.`
4. `Biocatalysis harnesses the power of enzymes and whole-cell systems to perform chemical transformations under environmentally benign conditions. This approach has revolutionized the production of pharmaceuticals, flavors, and specialty chemicals while enabling novel reaction pathways.`
5. `Catalyst design increasingly relies on computational modeling and machine learning approaches that predict optimal catalyst structures based on outcomes. These advanced techniques accelerate the discovery of new catalytic materials while providing insights into structure-activity relationships.`

### Technology

1. `Taiwan Semiconductor achieved first silicon at its 1.4 nm node, packing 390 million transistors per square millimeter. This breakthrough cuts leakage current by 23 percent versus previous generations. The advancement enables unprecedented processing density in mobile and computing applications.`
2. `Advanced neural processing clusters achieved 38.1 exaflops across distributed chip architectures during intensive machine learning workloads. These systems process 8.4 petabytes of training data while optimizing power efficiency. This represents a major leap in automotive and robotics AI computational capabilities.`
3. `Quantum computing reached a milestone when PsiQent entangled 1,024 photonic qubits on-chip with 99.2 percent fidelity. This achievement breaches the threshold for practical fault-tolerant quantum error correction. The development signals quantum computing's transition from research to applied engineering.`
4. `Europe's Gaia-X federation connected 18,600 edge nodes by mid-2025, enabling cross-border AI inference at 9 ms median latency. The network preserves GDPR-grade data sovereignty while facilitating distributed computing. This infrastructure supports autonomous European digital independence from foreign cloud providers.`
5. `Global grid storage deployments reached 137 GWh capacity, with lithium-iron-phosphate batteries capturing 62 percent market share. Average battery costs fell to $73 per kWh, down 24 percent year-over-year. This price reduction accelerates renewable energy adoption and grid stabilization projects worldwide.`

### Poetry

1. `Federico García Lorca's "Sonetos del amor oscuro" was published posthumously in 1956, cycling through eleven sonnets that explore complex themes. The assonant rhymes veil homoerotic longing beneath Granada's moonlit patios. This collection represents some of Lorca's most intimate and powerful verse work.`
2. `Seamus Heaney's poem "Digging" opens his collection North with a triplet of spondees that transform agricultural labor into literary metaphor. The poem bridges agrarian toil with scholarly craft across Irish generations. Heaney's language captures both the physical weight of digging and the intellectual weight of writing poetry.`
3. `Gwendolyn Brooks's "We Real Cool" from 1960 drops the pronoun "We" at strategic line breaks, creating syncopated rhythm. The poem distills pool-hall bravado into eight precise lines that echo urban youth culture. Brooks captures the defiant energy and underlying vulnerability of Chicago's street life.`
4. `John Keats suspends narrative time in "Ode on a Grecian Urn" through his contemplation of frozen pastoral scenes. The poem ends with the contested chiasmus "Beauty is truth, truth beauty" that continues to resist definitive interpretation. This meditation on art and permanence remains central to Romantic poetry.`
5. `Terrance Hayes's "American Sonnet" sequence from 2018 twists the traditional Petrarchan frame to address contemporary violence. The jagged couplets ricochet between police brutality statistics and intimate relationships. This work forges a powerful post-Ferguson ars poetica that confronts systemic racism through formal innovation.`

### `getSmartContent()` fallback template

- ``${term} represents a sophisticated concept with complex applications across multiple domains. This fundamental element plays crucial roles in various systems and processes, demonstrating remarkable versatility in both theoretical frameworks and practical implementations.``

## 4) Headline/Word Buckets Used By `openai-utils`

Source: `src/api/openai-utils.ts`

### `ANAGRAMS`

`Amaranth`, `Gamboge`, `Celadon`, `Falu-Red`, `Wenge`, `Coquelicot`, `Glaucous`, `Off-White`, `Zaffre`, `Fulvous`, `Puce`, `Smalt`, `Mauveine`, `Sarcoline`, `Xanadu`, `Mortuum`, `Phlox`, `Viridian`, `Bistre`, `Byzantium`, `Carmine`, `Tyrian`, `Eburnean`, `Feldgrau`, `Indanthrone`, `Gallant`, `Periwinkle`, `Persimmon`, `Razzmatazz`, `Sinopia`, `Ultramarine`, `Verdigris`, `Watchet`, `Coated`, `Jet`, `Matte`, `Languid`, `Mountbatten`, `Nacarat`, `Olivine`, `Phthalo`, `Quinacridone`, `Steel`, `Saffron`, `Taupe`, `Urobilin`, `Veronica`, `Wisteria`, `Citrine`, `Zomp`, `Kobicha`, `Malachite`, `Purple`, `Mauve`, `Perylene`, `Queen-Pink`, `Raw-Umber`, `Seashell`, `Teal`, `Ube`, `Van-Dyke`, `Xanthic`, `Ochre`, `Zinnwaldite`, `Smaragdine`, `Fandango`, `Heliotrope`, `Orchid`, `Chartreuse`, `Peridot`, `Rose`, `Rust`, `Sepia`, `Black`

### `NUMBERS`

`1`, `2`, `3`, `4`, `5`, `6`, `7`, `8`, `9`, `25`, `32`, `37`, `69`, `241`, `707`, `808`, `909`, `101`, `202`, `303`, `404`, `505`, `20%`, `74`, `85`, `96`, `128`, `256`, `9.999`, `H66`, `440`, `880`, `1760`, `220`, `110`, `1977`, `1979`, `1981`, `Zero`, `2030`, `1991`, `1993`, `1997`, `16`, `64`, `Est 2025`, `384`, `768`, `1800`, `44`, `48`, `88`, `96`

### `BIO_TERMS`

`Cellular`, `Synapse`, `Telomerase`, `Astrocyte`, `Glutamate`, `Poly`, `Ribozyme`, `Strategy`, `Meth`, `Enzyme`, `Trillion`, `Dopamine`, `Serotonin`, `240 000`, `Acetyl`, `Neural`, `Peptide`, `Chromatin`, `Nucleo`, `Phosphate`, `Ribosome`, `Cytoplasm`, `Membrane`, `Organelle`, `Neural`, `Hormone`, `Clam`, `Myelin`, `Dendrite`, `Axon`, `Soma`, `Vesicle`, `Ion`, `Channel`, `Receptor`, `Ligand`, `Substrate`, `Catalyst`, `Cofactor`, `Allosteric`, `Kinase`, `Phosphate`, `Oxidase`, `Reductase`, `Hydrolase`, `Lyase`, `Ligase`, `Iso`

### `ARCH_TERMS`

`Abacus`, `Ambulatory`, `Arcature`, `Caryatid`, `Clerestory`, `Coffering`, `Diagrid`, `Echinus`, `Entasis`, `Exedra`, `Fenestration`, `Muqarnas`, `Mullion`, `Narthex`, `Oculus`, `Peristyle`, `Enfilade`, `Pinnacle`, `Pronaos`, `Reredos`, `Spandrel`, `Squinch`, `Stylobate`, `Trabeation`, `Transept`, `Tympanum`, `Vaulting`, `Volute`, `Voussoir`

### `DESIGN_TERMS`

`Gadzook`, `Tittle`, `Finial`, `Beak`, `Crotch`, `Spine`, `Terminal`, `Trap`, `Overhang`, `Overshoot`, `Fraktur`, `Lombardic`, `Rotunda`, `Uncial`, `Glyphic`, `Pica`, `Em`, `En`, `X-Height`, `Cap`, `Baseline`, `Point`, `Gutter`, `Imposition`, `Quoin`, `Contextual`, `Set`, `Tabular`, `Proportional`, `Metrics`, `Hint`, `Raster`, `Meta`, `Pangram`, `Halftone`, `Duotone`, `Chroma`, `Anilox`, `Modulor`, `Boustrophedon`, `Tetradic`, `Polar-Grid`, `Overprint`, `Swash`, `Spur`, `Apex`, `Vertex`, `Loop`, `Bowl`, `Stem`, `Serif`, `Slug`, `Lead`, `Kern`, `Quad`, `Nick`, `Sort`, `Chase`, `Rag`, `Widow`, `Orphan`, `River`, `Glyph`, `Ligature`, `Eye`, `Tail`, `Link`, `Hook`, `Lobe`, `Chin`, `Foot`, `Knee`, `Stub`, `Spine`

### `SPACE_TERMS`

`Apogee`, `Perigee`, `Aphelion`, `Perihelion`, `Zenith`, `Nadir`, `Transit`, `Nova`, `Pulsar`, `Quasar`, `Nebula`, `Bolide`, `Regolith`, `Synoptic`, `Albedo`, `Umbral`, `Penumbra`, `Redshift`, `Cosmos`, `Kuiper`, `Oort`, `Parsec`, `Tidal`, `Wobble`, `Doppler`, `Nucleus`, `Halo`, `Syzygy`, `Apsis`, `Saros`, `Tholin`, `Roche`, `Rupes`, `Rille`, `Spicule`, `Plage`, `Limb`, `Baryon`, `Lyot`, `Quazar`

## 5) Template Strings Used For Generated Headlines/Sentences

Source: `src/api/openai-utils.ts`

### `localSubheading()` templates

- `%s Applications`
- `%s Principles`
- `%s Methods`
- `%s Analysis`
- `%s Systems`
- `%s Structures`
- `%s Mechanisms`
- `%s Properties`

### `localArticleHeadline()` templates

- `%s\n%s`
- `%s %s\n%s`
- `%s\n%s %s`
- `%s %s\n%s %s`

### `generateTextWithLLM(layoutType='waterfall')` templates

- `The %s research reveals %s patterns`
- `Modern %s incorporates %s elements`
- `Advanced %s utilizes %s methodology`
- `Contemporary %s demonstrates %s principles`
- `Sophisticated %s explores %s frameworks`
- `Parametric %s reveals %s structures`
- `Revolutionary %s incorporates %s elements`
- `Complex %s demonstrates %s architectures`

### `generateArticleContentWithLLM()` prompt placeholders

- `Compelling 2-4 word headline about ${selectedTerms[0]}`
- `Opening paragraph introducing ${selectedTerms[0]} (150-200 words)`
- `Second paragraph exploring deeper aspects (150-200 words)`
- `Third paragraph with practical applications or examples (150-200 words)`
- `Short subheading for section 1`
- `Short subheading for section 2`

## 6) UI Input Placeholder Strings

### `src/ui/components/FontControlSection.tsx`
- `Search fonts...`

### `src/ui/components/SecondaryFontControlSection.tsx`
- `Search fonts...`

### `src/ui/components/StylesGridRow.tsx`
- `Search fonts...`

### `src/ui/screens/TextInputScreen.tsx`
- `Paste text here...`
- `sk-f1ct10nAlOp3nAIk3yxxxxxxxxxxxxxxxxxx`

### `src/ui/components/SegmentedInput.tsx`
- `Type here...`


