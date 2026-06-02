---
name: Industrial Efficiency System
colors:
  surface: '#f9f9ff'
  surface-dim: '#d7dae4'
  surface-bright: '#f9f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f1f3fd'
  surface-container: '#ebeef8'
  surface-container-high: '#e5e8f2'
  surface-container-highest: '#dfe2ec'
  on-surface: '#181c23'
  on-surface-variant: '#424752'
  inverse-surface: '#2d3138'
  inverse-on-surface: '#eef0fb'
  outline: '#727784'
  outline-variant: '#c2c6d5'
  surface-tint: '#075bbd'
  primary: '#00428e'
  on-primary: '#ffffff'
  primary-container: '#0059bb'
  on-primary-container: '#c3d5ff'
  inverse-primary: '#acc7ff'
  secondary: '#006a6a'
  on-secondary: '#ffffff'
  secondary-container: '#9deeed'
  on-secondary-container: '#0b6e6e'
  tertiary: '#00428f'
  on-tertiary: '#ffffff'
  tertiary-container: '#0059bc'
  on-tertiary-container: '#c4d5ff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d7e2ff'
  primary-fixed-dim: '#acc7ff'
  on-primary-fixed: '#001a40'
  on-primary-fixed-variant: '#004492'
  secondary-fixed: '#a0f0f0'
  secondary-fixed-dim: '#84d4d3'
  on-secondary-fixed: '#002020'
  on-secondary-fixed-variant: '#004f4f'
  tertiary-fixed: '#d8e2ff'
  tertiary-fixed-dim: '#adc6ff'
  on-tertiary-fixed: '#001a41'
  on-tertiary-fixed-variant: '#004493'
  background: '#f9f9ff'
  on-background: '#181c23'
  surface-variant: '#dfe2ec'
  surface-main: '#f9f9ff'
  border-hairline: '#c1c6d7'
  status-success: '#107c10'
  status-warning: '#d83b01'
  status-error: '#a80000'
typography:
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Inter
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
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  data-tabular:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
  label-caps:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '700'
    lineHeight: 16px
    letterSpacing: 0.05em
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
  margin-desktop: 24px
  tight: 8px
  compact: 12px
---

## Brand & Style

This design system is engineered for the high-stakes, data-rich environment of industrial operations. The brand personality is **Professional, Technical, and Reliable**, prioritizing functional utility over decorative flair. It is designed to serve operators, engineers, and plant managers who require immediate access to complex metrics without cognitive overload.

The design style is **Corporate Modern with an Industrial Edge**. It utilizes a "Data-Dense Minimalist" approach, characterized by:
- **High-Information Density:** Maximizing screen real estate for KPIs, matrices, and logs.
- **Precision Detailing:** Using hairline borders and tabular typography to create a sense of engineering accuracy.
- **Utility-First Hierarchy:** High contrast and clear color-coding ensure critical status updates are processed instantly in high-pressure environments.

## Colors

The palette is anchored by "Industrial Blue" and "Precision Teal," colors that evoke stability and technical expertise. 

- **Primary & Tertiary Blue:** Used for interactive elements, primary navigation, and core brand touchpoints. The tertiary blue acts as a vibrant hover or active state for primary actions.
- **Secondary Teal:** Reserved for secondary actions and department-specific categorization, providing a distinct visual break from the primary brand color.
- **Neutral & Surface:** A near-white surface (`#f9f9ff`) provides a clean canvas that reduces eye strain, while the deep neutral (`#181c23`) ensures maximum legibility for typography.
- **Status Colors:** Standardized semantic colors are used for maintenance logs and quality alerts, optimized for quick identification against the light background.

## Typography

The typography system relies exclusively on **Inter** to ensure maximum legibility at small sizes. 

A critical requirement of this design system is the use of **Tabular Figures (`tnum`)** for all numeric data. This ensures that columns of numbers in production tables and quality matrices align perfectly, allowing users to scan for discrepancies or patterns vertically.

For mobile-specific views, headlines larger than 24px should scale down to `headline-md` to maintain content density. Use `label-caps` for table headers and metadata to differentiate from actionable body text.

## Layout & Spacing

This design system uses a **Fluid Grid** model with an emphasis on data density. The spacing rhythm is based on a **4px base unit**, allowing for the "tight" and "compact" spacing required for complex job orders and loggers.

- **Desktop:** A 12-column grid with 24px margins. Elements should favor horizontal expansion to reveal more data columns in matrices.
- **Mobile:** Transition to a single-column card-based layout. Use 16px side margins. Horizontal scrolling is permitted only for specific data tables that cannot be reduced to cards.
- **Rhythm:** Use `tight` (8px) spacing between related input fields and `compact` (12px) for spacing within card containers.

## Elevation & Depth

The design system avoids heavy shadows in favor of a **Flat / Low-elevation** aesthetic. Depth is communicated through:

- **Hairline Borders:** Use 1px (or 0.5px where supported) solid borders in `#c1c6d7` to define boundaries for cards, table cells, and input fields.
- **Tonal Layering:** Surfaces use the main background color (`#f9f9ff`), while active containers or modals utilize pure `#ffffff` to subtly lift them from the background.
- **Ghost Borders:** For secondary interactive elements, use low-contrast outlines rather than shadows to maintain a clean, technical appearance.
- **Overlays:** Full-screen sheets and quick-creation modals use a subtle 10% black backdrop tint to focus attention without losing industrial context.

## Shapes

The shape language is **Soft (0.25rem)**. This subtle rounding provides a modern touch to the UI without compromising the "technical" feel of a professional industrial tool. 

- **Standard Elements:** Buttons, input fields, and chips use the base `0.25rem` radius.
- **Cards & Modals:** Use `rounded-lg` (0.5rem) to provide a clear container hierarchy.
- **Data Indicators:** Small status badges and indicators remain sharp or use the minimum radius to conserve space in tight table rows.

## Components

### Buttons
- **Primary:** Solid `#0059bb`, white text, minimal 4px radius.
- **Secondary:** Outline 1px `#006a6a`, teal text.
- **Action Sticky:** On mobile, primary actions are pinned to the bottom of the screen with a subtle background blur behind the container.

### Data Tables & Matrices
- **Hairline Dividers:** Every row and column is separated by a 1px `#c1c6d7` border.
- **Cell Padding:** Use `tight` (8px) padding to maximize row count on screen.
- **Alignment:** Numbers are right-aligned (using tabular figures); text is left-aligned.

### Input Fields
- **Technical Style:** 1px border, 4px radius, clear labels in `label-caps`. 
- **Validation:** Inline validation appears immediately below the field in `status-error` red, utilizing the `body-sm` type scale.

### Cards
- **Industrial KPI Cards:** White background, hairline border, no shadow. Headers should use the secondary teal or primary blue for category identification.

### Navigation
- **Mobile:** A persistent bottom navigation bar for core modules (Dashboard, Log, Production, Maintenance).
- **Desktop:** A collapsible side-rail to maximize horizontal space for data matrices.