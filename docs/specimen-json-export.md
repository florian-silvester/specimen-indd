# Specimen JSON Export — Integration Reference

This document describes the JSON output format of the Specimen Generator Figma plugin (export schema `semantic-v2.1`), how every field is computed, and how it maps to the Traits Studio `tokens.json` format for seamless import.

---

## 1. Export Trigger

The JSON is built by `buildExportPayloads()` in `FooterSection.tsx`. Key behaviors:

- **Rounding**: When `roundingGridSize > 0` (baseline grid enabled), all values pass through `applyRoundingToSystem()` before export. When off, raw calculated values are used. The exported numbers always match what the user sees in the Styles grid.
- **Visibility filter**: Only styles where `styleVisibility[key] !== false` are included. Hidden styles are omitted entirely.
- **Naming convention**: Token keys and labels are derived from the user's selected naming convention (Default, Tailwind, Bootstrap, Relume, Lumos).

---

## 2. Top-Level Structure

```jsonc
{
  "meta": { ... },
  "aliases": { ... },
  "semanticAliases": { ... },
  "intentAliases": { ... },
  "styles": { ... }
}
```

---

## 3. `meta` — Export Metadata

```jsonc
{
  "generator": "Specimen Generator",
  "exportSchema": "semantic-v2.1",
  "namingConvention": "Tailwind",           // "Default Naming" | "Tailwind" | "Bootstrap" | "Relume" | "Lumos"
  "lineHeightUnit": "percent",              // "percent" | "px" — how LH was configured in the plugin
  "roundingGridSize": 4,                    // 0 = off, else pixel step size used for baseline grid snapping
  "allowedStyles": {
    "headings": ["text-7xl", "text-6xl", "text-5xl", "text-4xl", "text-3xl", "text-2xl", "text-xl"],
    "body": ["text-lg", "text-base", "text-sm", "text-xs"]
  }
}
```

| Field | Description |
|---|---|
| `namingConvention` | Which convention was active at export time. Controls all token keys and labels. |
| `lineHeightUnit` | Informational. The actual `lineHeight` values in styles are always unitless multipliers (e.g. `1.35`). |
| `roundingGridSize` | If `> 0`, font sizes and line heights were snapped to this grid before export. |
| `allowedStyles.headings` | Token keys for heading-tier styles (display through h6), in the selected convention. Only visible styles appear. |
| `allowedStyles.body` | Token keys for body-tier styles (large through micro), in the selected convention. Only visible styles appear. |

---

## 4. `aliases` — Shared Primitive Tokens

Deduplicated CSS-ready primitive values shared across styles. Keys are auto-generated kebab-case aliases; values are the raw CSS values.

```jsonc
{
  "family": {
    "Inter": "font-family-inter",
    "Playfair Display": "font-family-playfair-display"
  },
  "weight": {
    "400": "font-weight-400",
    "700": "font-weight-700"
  },
  "style": {
    "normal": "font-style-normal",
    "italic": "font-style-italic"
  },
  "styleName": {
    "Regular": "font-style-name-regular",
    "Bold": "font-style-name-bold"
  },
  "textTransform": {
    "none": "text-transform-none",
    "uppercase": "text-transform-uppercase"
  },
  "textCase": {
    "Original": "text-case-original",
    "Uppercase": "text-case-uppercase"
  }
}
```

The map format is `{ [rawValue]: aliasKey }`. In CSS output these become `--font-family-inter: "Inter";` etc.

---

## 5. `semanticAliases` — Source-Level Aliases

These group the dominant (most common) value per font source (`primary` / `secondary`) for each render field. They allow downstream consumers to reference "the heading font family" without hardcoding a specific family name.

```jsonc
{
  "font-family-primary": { "field": "fontFamily", "value": "Inter" },
  "font-weight-primary": { "field": "fontWeight", "value": "400" },
  "font-style-primary": { "field": "fontStyle", "value": "normal" },
  "text-transform-primary": { "field": "textTransform", "value": "none" },
  "font-family-secondary": { "field": "fontFamily", "value": "Playfair Display" },
  "font-weight-secondary": { "field": "fontWeight", "value": "700" }
}
```

Each entry points to an alias in the `aliases` map and records which raw value it represents. Only sources with at least one style are included.

---

## 6. `intentAliases` — Role-Based Aliases

Higher-level aliases for "heading typeface" and "text typeface" that point to semantic aliases:

```jsonc
{
  "typeface-heading-font-family": "font-family-secondary",
  "typeface-heading-font-weight": "font-weight-secondary",
  "typeface-heading-font-style": "font-style-secondary",
  "typeface-heading-text-transform": "text-transform-secondary",
  "typeface-text-font-family": "font-family-primary",
  "typeface-text-font-weight": "font-weight-primary",
  "typeface-text-font-style": "font-style-primary",
  "typeface-text-text-transform": "text-transform-primary"
}
```

**This is how Traits Studio resolves font families during import** — it reads `intentAliases["typeface-heading-font-family"]` → resolves via `semanticAliases` → gets the actual family name string.

---

## 7. `styles` — The Type Scale

The main payload. Keyed by the convention-derived token key (e.g. `"text-6xl"` for Tailwind, `"h1"` for Default).

```jsonc
{
  "text-6xl": {
    "label": "text-6xl",
    "originalKey": "h1",
    "tokenKey": "text-6xl",

    "fontSizePx": 49,
    "lineHeight": 1.02,
    "lineHeightPercent": 102,
    "letterSpacingPercent": -0.75,
    "letterSpacingPercentDisplay": "-0.75",
    "letterSpacingEm": -0.0075,

    "fontFamily": "AL Werner Trial",
    "fontStyleName": "Regular",
    "fontWeight": "400",
    "fontStyle": "normal",
    "textCase": "Original",
    "textTransform": "none",

    "fontSource": "primary",

    "familyAlias": "font-family-primary",
    "fontStyleNameAlias": "font-style-name-regular",
    "fontWeightAlias": "font-weight-primary",
    "fontStyleAlias": "font-style-primary",
    "textCaseAlias": "text-case-original",
    "textTransformAlias": "text-transform-primary",
    "fontShorthand": "var(--text-6xl-font)",

    "customName": null,
    "visible": true
  }
}
```

### Field Reference

#### Numeric Values (render-ready)

| Field | Type | Unit | Description |
|---|---|---|---|
| `fontSizePx` | `number` | px | Rounded to nearest integer. Grid-snapped if baseline grid is on. |
| `lineHeight` | `number` | unitless | Multiplier (e.g. `1.35` = 135%). Always 2 decimal places. |
| `lineHeightPercent` | `number` | % | Same as `lineHeight × 100`. Integer when grid-snapped. |
| `letterSpacingPercent` | `number` | % | Percentage of font size. Snapped to 0.25% steps. |
| `letterSpacingPercentDisplay` | `string` | % | Formatted string for display (e.g. `"-0.75"`). |
| `letterSpacingEm` | `number` | em | `letterSpacingPercent / 100`. 4 decimal places. |

#### How values are computed

```
fontSizePx       = Math.round(style.size)
lineHeightPercent = round(style.lineHeight × 100)     // style.lineHeight is a multiplier
lineHeight        = lineHeightPercent / 100            // back to unitless, 2 decimals
letterSpacingPct  = roundToStep(style.letterSpacing, 0.25)  // plugin stores as %
letterSpacingEm   = letterSpacingPct / 100             // convert % → em, 4 decimals
```

When `roundingGridSize > 0`, `fontSizePx` and `lineHeightPercent` are additionally snapped to the grid before all other derivations.

#### Typography Metadata

| Field | Type | Description |
|---|---|---|
| `fontFamily` | `string` | Raw family name (e.g. `"Inter"`, `"Playfair Display"`). |
| `fontStyleName` | `string` | Figma weight/style name (e.g. `"Regular"`, `"Bold Italic"`). |
| `fontWeight` | `string` | Numeric CSS weight inferred from `fontStyleName` (e.g. `"400"`, `"700"`). |
| `fontStyle` | `string` | `"normal"` or `"italic"`, inferred from `fontStyleName`. |
| `textCase` | `string` | Plugin case setting: `"Original"`, `"Uppercase"`, `"Lowercase"`, `"Title Case"`. |
| `textTransform` | `string` | CSS equivalent: `"none"`, `"uppercase"`, `"lowercase"`, `"capitalize"`. |

#### Source & Alias Linkage

| Field | Type | Description |
|---|---|---|
| `fontSource` | `string` | `"primary"`, `"secondary"`, or `"custom"`. Determines which font slot this style belongs to. |
| `familyAlias` | `string` | Points to an alias in `aliases.family` or `semanticAliases`. |
| `fontWeightAlias` | `string` | Points to an alias in `aliases.weight` or `semanticAliases`. |
| `fontStyleAlias` | `string` | Points to an alias in `aliases.style` or `semanticAliases`. |
| `textTransformAlias` | `string` | Points to an alias in `aliases.textTransform` or `semanticAliases`. |
| `fontStyleNameAlias` | `string` | Points to an alias in `aliases.styleName` (metadata only). |
| `textCaseAlias` | `string` | Points to an alias in `aliases.textCase` (metadata only). |
| `fontShorthand` | `string` | CSS `font` shorthand as a `var()` reference. |

#### Identity

| Field | Type | Description |
|---|---|---|
| `label` | `string` | Display name from the naming convention (e.g. `"text-6xl"`, `"H1"`). |
| `originalKey` | `string` | Internal plugin key. Always one of: `display`, `h1`–`h6`, `textLarge`, `textMain`, `textSmall`, `micro`. |
| `tokenKey` | `string` | Kebab-case version of `label`, used as the style's key in the `styles` object. |
| `customName` | `string \| null` | User-defined override name, or `null` if using convention default. |
| `visible` | `boolean` | Always `true` in the export (hidden styles are filtered out). |

---

## 8. `fontSource` Defaults

The plugin assigns each style a font source slot. Defaults (can be overridden per-style by the user):

| Style | Default Source |
|---|---|
| `display` | `secondary` |
| `h1` | `secondary` |
| `h2` | `secondary` |
| `h3`–`h6` | `primary` |
| `textLarge`–`micro` | `primary` |

In Traits Studio, `secondary` maps to the `heading` font and `primary` maps to the `body` font.

---

## 9. Naming Convention Maps

The `tokenKey` and `label` for each style depend on the selected convention:

| originalKey | Default | Tailwind | Bootstrap | Relume | Lumos |
|---|---|---|---|---|---|
| `display` | H0 | text-7xl | display-1 | Display | Display |
| `h1` | H1 | text-6xl | h1 | H1 | H1 |
| `h2` | H2 | text-5xl | h2 | H2 | H2 |
| `h3` | H3 | text-4xl | h3 | H3 | H3 |
| `h4` | H4 | text-3xl | h4 | H4 | H4 |
| `h5` | H5 | text-2xl | h5 | H5 | H5 |
| `h6` | H6 | text-xl | h6 | H6 | H6 |
| `textLarge` | Text Large | text-lg | lead | Large | Text Large |
| `textMain` | Text Main | text-base | p | Regular | Text Main |
| `textSmall` | Text Small | text-sm | small | Small | Text Small |
| `micro` | Text Tiny | text-xs | text-muted | Tiny | Micro |

---

## 10. Traits Studio Integration

### Import Mapping

The `importSpecimen()` function in `lib/specimen-import.ts` maps Specimen output to Traits Studio's `TypeToken` format using the `originalKey` field:

| Specimen `originalKey` | Traits Studio `role` |
|---|---|
| `display` | `display` |
| `h1`–`h6` | `h1`–`h6` |
| `textLarge` | `body-bold` |
| `textMain` | `body` |
| `textSmall` | `small` |
| `micro` | `ui` |

### Field Mapping

| Specimen Field | Traits Studio `TypeToken` Field | Transform |
|---|---|---|
| — | `role` | Mapped from `originalKey` via table above |
| `fontSource` | `font` | `"secondary"` → `"heading"`, `"primary"` → `"body"` |
| `fontSizePx` | `size` | Direct (both are px integers) |
| `fontWeight` | `weight` | `parseInt(fontWeight)` (string → number) |
| `fontStyle` | `style` | Direct (`"normal"` or `"italic"`) |
| `lineHeight` | `lh` | Direct (both are unitless multipliers) |
| `letterSpacingEm` | `ls` | Direct (both are em values) |

### Font Family Resolution

Traits Studio resolves font families through the alias chain:

```
intentAliases["typeface-heading-font-family"]
  → semanticAliases[aliasKey].value
  → raw family string (e.g. "Playfair Display")
  → written to tokens.fonts.heading.family

intentAliases["typeface-text-font-family"]
  → semanticAliases[aliasKey].value
  → raw family string (e.g. "Inter")
  → written to tokens.fonts.body.family
```

### Font Weight Collection

The importer collects unique `{weight, style}` pairs per font source and writes them to `tokens.fonts.heading.weights` and `tokens.fonts.body.weights`. The `fontStyleName` field provides human-readable names (e.g. `"Bold Italic"`).

### What Gets Updated

On import, Traits Studio updates the `web` touchpoint:

1. **`tokens.fonts.heading.family`** — from heading intent alias chain
2. **`tokens.fonts.body.family`** — from text intent alias chain
3. **`tokens.fonts.heading.weights`** — collected from secondary-source styles
4. **`tokens.fonts.body.weights`** — collected from primary-source styles
5. **`tokens.touchpoints.web.type`** — rebuilt from visible Specimen styles + any existing roles not in Specimen (e.g. `caption`)
6. **`tokens.touchpoints.web.$meta`** — generator set to `"specimen"`, timestamp updated

### Validation

`isValidSpecimen()` checks that the JSON has both `styles` (object) and `meta` (object) at the top level.

---

## 11. Example: Full Round-Trip

**Specimen plugin** (Tailwind convention, 4px grid, Focus preset with H1 + Text Main visible):

```json
{
  "meta": {
    "generator": "Specimen Generator",
    "exportSchema": "semantic-v2.1",
    "namingConvention": "Tailwind",
    "lineHeightUnit": "percent",
    "roundingGridSize": 4,
    "allowedStyles": {
      "headings": ["text-6xl"],
      "body": ["text-base"]
    }
  },
  "aliases": {
    "family": { "Inter": "font-family-inter" },
    "weight": { "400": "font-weight-400" },
    "style": { "normal": "font-style-normal" },
    "textTransform": { "none": "text-transform-none" }
  },
  "semanticAliases": {
    "font-family-primary": { "field": "fontFamily", "value": "Inter" },
    "font-weight-primary": { "field": "fontWeight", "value": "400" },
    "font-style-primary": { "field": "fontStyle", "value": "normal" },
    "text-transform-primary": { "field": "textTransform", "value": "none" }
  },
  "intentAliases": {
    "typeface-text-font-family": "font-family-primary",
    "typeface-text-font-weight": "font-weight-primary",
    "typeface-text-font-style": "font-style-primary",
    "typeface-text-text-transform": "text-transform-primary"
  },
  "styles": {
    "text-6xl": {
      "label": "text-6xl",
      "originalKey": "h1",
      "tokenKey": "text-6xl",
      "fontSizePx": 48,
      "lineHeight": 1.04,
      "lineHeightPercent": 104,
      "letterSpacingPercent": -0.75,
      "letterSpacingPercentDisplay": "-0.75",
      "letterSpacingEm": -0.0075,
      "fontFamily": "Inter",
      "fontStyleName": "Regular",
      "fontWeight": "400",
      "fontStyle": "normal",
      "textCase": "Original",
      "textTransform": "none",
      "fontSource": "primary",
      "familyAlias": "font-family-primary",
      "fontWeightAlias": "font-weight-primary",
      "fontStyleAlias": "font-style-primary",
      "textTransformAlias": "text-transform-primary",
      "fontStyleNameAlias": "font-style-name-regular",
      "textCaseAlias": "text-case-original",
      "fontShorthand": "var(--text-6xl-font)",
      "customName": null,
      "visible": true
    },
    "text-base": {
      "label": "text-base",
      "originalKey": "textMain",
      "tokenKey": "text-base",
      "fontSizePx": 16,
      "lineHeight": 1.5,
      "lineHeightPercent": 150,
      "letterSpacingPercent": 1.0,
      "letterSpacingPercentDisplay": "1",
      "letterSpacingEm": 0.01,
      "fontFamily": "Inter",
      "fontStyleName": "Regular",
      "fontWeight": "400",
      "fontStyle": "normal",
      "textCase": "Original",
      "textTransform": "none",
      "fontSource": "primary",
      "familyAlias": "font-family-primary",
      "fontWeightAlias": "font-weight-primary",
      "fontStyleAlias": "font-style-primary",
      "textTransformAlias": "text-transform-primary",
      "fontStyleNameAlias": "font-style-name-regular",
      "textCaseAlias": "text-case-original",
      "fontShorthand": "var(--text-base-font)",
      "customName": null,
      "visible": true
    }
  }
}
```

**After Traits Studio import**, `tokens.touchpoints.web.type` becomes:

```json
[
  { "role": "h1", "font": "body", "size": 48, "weight": 400, "style": "normal", "lh": 1.04, "ls": -0.0075 },
  { "role": "body", "font": "body", "size": 16, "weight": 400, "style": "normal", "lh": 1.5, "ls": 0.01 }
]
```

And `tokens.fonts.body.family` becomes `"'Inter', sans-serif"`.

---

## 12. Consuming the JSON Directly

For consumers that don't use Traits Studio, the minimal fields needed to render typography are:

```typescript
// For each style in styles:
const { fontSizePx, lineHeight, letterSpacingEm, fontFamily, fontWeight, fontStyle, textTransform } = style;

// CSS:
// font-size: ${fontSizePx}px;
// line-height: ${lineHeight};
// letter-spacing: ${letterSpacingEm}em;
// font-family: "${fontFamily}", sans-serif;
// font-weight: ${fontWeight};
// font-style: ${fontStyle};
// text-transform: ${textTransform};
```

The alias system is optional — it enables CSS custom property indirection for theming but isn't required for direct consumption.
