---
version: alpha
name: MakanMakan
description: Apple-Native Soft Minimalism visual identity for a serverless restaurant platform spanning customer ordering, admin operations, onboarding, and kitchen display, built on the project's ios-* Tailwind tokens.
colors:
  ios-blue: "#007AFF"
  ios-green: "#34C759"
  ios-orange: "#FF9500"
  ios-red: "#FF3B30"
  ios-teal: "#30B0C7"
  customer-accent: "#2563EB"
  admin-accent: "#B7440A"
  admin-accent-hover: "#92370E"
  portal-accent: "#15803D"
  background: "#F2F2F7"
  surface: "#FFFFFF"
  text: "#1C1C1E"
  secondary-text: "#8E8E93"
  tertiary-text: "#AEAEB2"
  separator: "#E5E5EA"
  badge-blue-soft: "#E3F2FD"
  badge-orange-soft: "#FFF3E0"
  on-primary: "#FFFFFF"
typography:
  h1:
    fontFamily: Inter
    fontSize: 2rem
    fontWeight: 700
    lineHeight: 2.5rem
  h2:
    fontFamily: Inter
    fontSize: 1.5rem
    fontWeight: 700
    lineHeight: 2rem
  body-md:
    fontFamily: Inter
    fontSize: 1rem
    fontWeight: 400
    lineHeight: 1.5rem
  body-sm:
    fontFamily: Inter
    fontSize: 0.875rem
    fontWeight: 400
    lineHeight: 1.25rem
  label:
    fontFamily: Inter
    fontSize: 0.875rem
    fontWeight: 500
    lineHeight: 1.25rem
  timer:
    fontFamily: JetBrains Mono
    fontSize: 1.125rem
    fontWeight: 700
    lineHeight: 1.75rem
rounded:
  sm: 4px
  md: 8px
  lg: 12px
  xl: 16px
  2xl: 24px
  full: 9999px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  touch: 44px
shadow:
  card-sm: "0 2px 8px rgba(0,0,0,0.04)"
  card: "0 4px 16px rgba(0,0,0,0.06)"
  card-lg: "0 8px 30px rgba(0,0,0,0.08)"
components:
  app-shell:
    backgroundColor: "{colors.background}"
    textColor: "{colors.text}"
    typography: "{typography.body-md}"
  button-primary:
    backgroundColor: "{colors.ios-blue}"
    textColor: "{colors.on-primary}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: 12px
    height: "{spacing.touch}"
  button-customer:
    backgroundColor: "{colors.customer-accent}"
    textColor: "{colors.on-primary}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: 12px
    height: "{spacing.touch}"
  button-admin:
    backgroundColor: "{colors.admin-accent}"
    textColor: "{colors.on-primary}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: 12px
    height: "{spacing.touch}"
  button-admin-hover:
    backgroundColor: "{colors.admin-accent-hover}"
    textColor: "{colors.on-primary}"
  button-kitchen-start:
    backgroundColor: "{colors.ios-blue}"
    textColor: "{colors.on-primary}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: 16px
    height: "{spacing.touch}"
  button-kitchen-ready:
    backgroundColor: "{colors.ios-green}"
    textColor: "{colors.on-primary}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: 16px
    height: "{spacing.touch}"
  button-urgent:
    backgroundColor: "{colors.ios-red}"
    textColor: "{colors.on-primary}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: 16px
    height: "{spacing.touch}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.secondary-text}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: 12px
    height: "{spacing.touch}"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    typography: "{typography.body-md}"
    rounded: "{rounded.xl}"
    shadow: "{shadow.card}"
    padding: 16px
  customer-card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    typography: "{typography.body-md}"
    rounded: "{rounded.2xl}"
    shadow: "{shadow.card-sm}"
    padding: 16px
  kitchen-order-card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    typography: "{typography.body-md}"
    rounded: "{rounded.2xl}"
    shadow: "{shadow.card}"
    padding: 24px
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    typography: "{typography.body-md}"
    rounded: "{rounded.md}"
    padding: 12px
    height: "{spacing.touch}"
  badge-info:
    backgroundColor: "{colors.badge-blue-soft}"
    textColor: "{colors.ios-blue}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.full}"
    padding: 8px
  badge-warning:
    backgroundColor: "{colors.badge-orange-soft}"
    textColor: "{colors.ios-orange}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.full}"
    padding: 8px
  badge-urgent:
    backgroundColor: "{colors.ios-red}"
    textColor: "{colors.on-primary}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.full}"
    padding: 8px
  metadata:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.secondary-text}"
    typography: "{typography.body-sm}"
  divider:
    backgroundColor: "{colors.separator}"
    height: 1px
---

## Overview

MakanMakan follows an **Apple-Native Soft Minimalism** design language (the system mandated in `docs/UIUX-design-system.md`). It should feel calm, fast, operational, and trustworthy across several related environments: guests ordering from phones, restaurant staff managing tables and menus, onboarding flows for new restaurants, and kitchen displays that need high visibility under time pressure.

The foundation is shared and neutral — iOS system gray surfaces, soft shadows instead of borders, rounded cards, and pill controls. On top of that foundation each workflow carries a context accent: the customer flow leans blue, admin/management leans warm orange, the platform/onboarding portals lean green, and kitchen execution uses the pure iOS semantic palette (blue to start, green when ready, red when urgent).

## Colors

The base interface is built from white cards floating on a soft iOS-gray background, separated by light shadows and hairline separators rather than hard borders. Text is near-black (`#1C1C1E`), never pure black.

- **iOS Blue (#007AFF):** Primary action, links, and the kitchen "start" state.
- **iOS Green (#34C759):** Success, completion, and the kitchen "ready" state.
- **iOS Orange (#FF9500):** Warning, pending, and delayed states.
- **iOS Red (#FF3B30):** Errors, urgent timing, destructive actions, and disconnected states.
- **iOS Teal (#30B0C7):** Data visualization accents (rings, charts).
- **Customer accent (#2563EB):** Indigo override used by the customer app's primary CTA.
- **Admin accent (#B7440A):** Warm management accent for owner/admin dashboards.
- **Portal accent (#15803D):** Green theme for the management portal and onboarding apps.
- **Secondary text (#8E8E93) / Tertiary text (#AEAEB2):** Captions, metadata, and disabled states.

Do not let a single accent dominate every app. Use the accent that matches the workflow, keep the iOS neutrals (`#F2F2F7` background, `#FFFFFF` cards, `#E5E5EA` separators) as the shared language, and reserve red for states that genuinely require attention.

## Typography

Use **Inter** as the primary UI typeface with system fallbacks (`-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto`). Keep text clear and compact because the product is task-heavy. Headings are direct and readable, not decorative. Labels use medium weight (500) to make forms and controls scannable.

Use **JetBrains Mono** (mono fallback `Fira Code, Menlo, Monaco`) only for timers, keyboard hints, identifiers, and diagnostic values where alignment matters.

## Layout

Default spacing follows the Tailwind scale present in the apps: 8px for tight relationships, 16px for normal component padding, 24px for grouped operational content, and 32px for page-level separation.

Customer flows are mobile-first and should respect safe-area padding. Admin screens prioritize dense but organized tables, filters, and forms. Kitchen screens use larger touch targets, strong column structure, and stable card dimensions so order boards do not shift unexpectedly.

## Elevation & Depth

Separate surfaces with **soft shadows, not borders** — this is the core of the soft-minimalism language. Cards use white backgrounds on the gray app background with shadows capped at ~8% opacity:

- `card-sm` `0 2px 8px rgba(0,0,0,0.04)` for resting cards
- `card` `0 4px 16px rgba(0,0,0,0.06)` for primary cards
- `card-lg` `0 8px 30px rgba(0,0,0,0.08)` for floating/elevated surfaces

Avoid hard 1px borders for separation, deep stacked surfaces, and shadows heavier than 8%. Glass effects and gradients should be reserved for transient overlays or PWA prompts, never core operational layouts.

## Shapes

Cards use generous radii: `rounded-2xl` (24px) for customer and kitchen cards, `xl` (16px) for standard cards. Inputs and dense admin controls use 8px. **Buttons, badges, tags, and pills are fully rounded (`rounded-full`)** — pill shape is the default control shape across all apps.

Touch targets must be at least 44px high. Kitchen buttons keep stronger padding for clear hit areas under time pressure.

## Components

Buttons are pill-shaped and pair semantic color with workflow context: iOS blue for primary/customer/kitchen-start actions, orange for admin emphasis, green for completion/kitchen-ready, red for urgent or destructive actions, and white for secondary actions.

Cards stay functional and soft. Customer cards are larger and softer for mobile readability; admin cards are tighter and table-friendly; kitchen order cards emphasize status with color, timing, and predictable placement, switching to a red-tinted urgent treatment under time pressure.

Inputs use white surfaces and an `#007AFF` focus ring. Badges communicate state through soft pastel backgrounds with saturated text (e.g. `#E3F2FD` background + `#007AFF` text for info, `#FFF3E0` + `#FF9500` for warning). Timers use monospace text and move from neutral to orange to red as time pressure increases.

## Do's and Don'ts

- Do keep app-specific accents tied to workflow context, on a shared iOS-neutral foundation.
- Do use soft shadows and `#E5E5EA` separators instead of hard borders.
- Do keep buttons and badges pill-shaped (`rounded-full`).
- Do maintain 44px minimum touch targets for mobile and kitchen interactions.
- Do use `#1C1C1E` for text — never pure black.
- Don't mix the blue, orange, and green accents in one control group unless the meanings are distinct.
- Don't use red for normal emphasis.
- Don't exceed 8% shadow opacity or use hard borders for layout separation.
- Don't add new typefaces unless the full product adopts them.
- Don't make operational dashboards look like marketing pages.
