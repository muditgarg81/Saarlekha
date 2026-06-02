---
name: Industrial Precision
colors:
  surface: '#f8f9ff'
  surface-dim: '#ccdbf3'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e6eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d5e3fc'
  on-surface: '#0d1c2e'
  on-surface-variant: '#41474e'
  inverse-surface: '#233144'
  inverse-on-surface: '#eaf1ff'
  outline: '#71787f'
  outline-variant: '#c1c7cf'
  surface-tint: '#2d6388'
  primary: '#004366'
  on-primary: '#ffffff'
  primary-container: '#235b80'
  on-primary-container: '#9fd2fd'
  inverse-primary: '#99ccf7'
  secondary: '#006a67'
  on-secondary: '#ffffff'
  secondary-container: '#90f3ee'
  on-secondary-container: '#00706d'
  tertiary: '#3c4042'
  on-tertiary: '#ffffff'
  tertiary-container: '#545759'
  on-tertiary-container: '#cacdcf'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#cbe6ff'
  primary-fixed-dim: '#99ccf7'
  on-primary-fixed: '#001e30'
  on-primary-fixed-variant: '#094b6f'
  secondary-fixed: '#90f3ee'
  secondary-fixed-dim: '#73d7d2'
  on-secondary-fixed: '#00201f'
  on-secondary-fixed-variant: '#00504d'
  tertiary-fixed: '#e0e3e5'
  tertiary-fixed-dim: '#c4c7c9'
  on-tertiary-fixed: '#191c1e'
  on-tertiary-fixed-variant: '#444749'
  background: '#f8f9ff'
  on-background: '#0d1c2e'
  surface-variant: '#d5e3fc'
typography:
  headline-lg:
    fontFamily: Hanken Grotesk
    fontSize: 30px
    fontWeight: '700'
    lineHeight: 38px
  headline-md:
    fontFamily: Hanken Grotesk
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  headline-sm:
    fontFamily: Hanken Grotesk
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.02em
  headline-lg-mobile:
    fontFamily: Hanken Grotesk
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  base: 4px
  gutter: 16px
  margin-mobile: 16px
  margin-desktop: 32px
  container-max-width: 1440px
---

## Brand & Style

The visual identity is anchored in reliability, structural integrity, and data clarity. It is designed for industrial environments where quick information retrieval and error-free data entry are critical. The aesthetic follows a **Corporate/Modern** movement with a heavy emphasis on **Minimalism** to reduce cognitive load in complex operational reporting.

The tone is authoritative yet accessible. Visual hierarchy is established through clear typographic scale and a disciplined use of the brand's core colors to highlight actions and status. The design system prioritizes functionality over decoration, ensuring the interface remains unobtrusive during heavy-duty use.

## Colors

The palette is derived directly from the industrial logo context. **Navy (#235B80)** serves as the primary anchor, used for headers, primary actions, and structural navigation. **Teal (#309B97)** is the secondary accent, utilized for success states, secondary buttons, and data visualizations. 

**Tonal Logic:**
- **Primary:** High-contrast Navy for high-priority UI elements.
- **Secondary:** Teal for affirmative actions and growth-related metrics.
- **Surface/Tertiary:** A very light slate gray is used for container backgrounds to separate content modules from the white workspace.
- **Status Colors:** Use standard semantic reds and oranges for alerts, but keep them within the same saturation profile as the brand teal to maintain visual cohesion.

## Typography

The typography system is engineered for legibility across various screen qualities common in industrial settings. 

- **Headlines:** Hanken Grotesk provides a sharp, contemporary professional look that feels engineered and precise.
- **Body Text:** Inter is used for its exceptional readability in dense data environments and forms.
- **Data/Labels:** JetBrains Mono is employed for numerical data, IDs, and status labels to ensure character distinction (e.g., distinguishing '0' from 'O' and '1' from 'l'), which is vital for industrial reporting.

## Layout & Spacing

This design system uses a **Fluid Grid** model with a strict 4px base unit. 

- **Desktop:** 12-column grid with 24px gutters. Side navigation is fixed at 260px, with the content area expanding fluidly.
- **Mobile:** 4-column grid with 16px margins. Content reflows vertically, with data tables converting to cards or employing horizontal scroll with frozen ID columns.
- **Density:** High density is preferred for data tables (12px vertical cell padding) while forms use a more comfortable rhythm (16px vertical spacing) to prevent tap errors on mobile devices.

## Elevation & Depth

Hierarchy is achieved through **Tonal Layers** rather than heavy shadows. This keeps the interface clean and "industrial."

- **Level 0 (Background):** Pure White (#FFFFFF).
- **Level 1 (Sections/Cards):** Slate Tint (#F8FAFC) with a 1px border (#E2E8F0).
- **Level 2 (Active Elements):** Soft, extra-diffused ambient shadows (4px blur, 2% opacity Navy) are only used for floating action buttons or active dropdown menus to suggest interactability without clutter.
- **Outlines:** Use low-contrast 1px strokes for all input fields and table boundaries to define structure without visual noise.

## Shapes

The shape language is **Soft (0.25rem)**. This slight rounding takes the "edge" off the industrial data-heavy interface without making it feel overly consumer-focused or "playful." 

- **Small elements (Inputs, Buttons):** 4px radius.
- **Large elements (Cards, Containers):** 8px radius.
- **Status Pills:** Fully rounded (pill-shaped) to distinguish them immediately from buttons and interactive fields.

## Components

**Buttons:**
- **Primary:** Solid Navy with white text. No gradients.
- **Secondary:** Outlined Navy or Solid Teal for affirmative actions.
- **Ghost:** Text-only for utility actions like "Cancel" or "Back."

**Data Tables:**
- Header background: Light Navy tint or Slate.
- Text: JetBrains Mono for numerical columns, aligned right.
- Borders: Horizontal only to emphasize row-by-row scanning.

**Input Fields:**
- Label: Inter Semi-Bold (12px) placed above the field.
- Placeholder: Light Slate.
- Active State: 2px Navy border.

**Cards:**
- Used primarily for summary metrics and mobile-view data records. 
- Must include a 1px border. Do not use shadows for card containment.

**Status Chips:**
- Background: Very light tint of the status color (e.g., Light Teal for "Completed").
- Text: Bold Navy or Dark Teal to ensure high contrast ratio for accessibility.