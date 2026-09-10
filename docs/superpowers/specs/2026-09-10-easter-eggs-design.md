# Easter Eggs Design

## Overview

Small delightful details that occur under certain states or events in the application. These are documented for eventual cleanup.

## Easter Egg 1: John Travolta GIF

### Trigger Condition
- Home screen (AgendaScreen) with no scheduled visits (`items.length === 0`)

### Location
- `src/ui/screens/AgendaScreen.tsx`
- Public asset: `public/so-really.gif`

### Behavior
When the user visits the home screen with no scheduled visits and no fields registered, a John Travolta dancing GIF is displayed in the empty state as a playful delight.

### Technical Details
- GIF is served from the public directory at `/so-really.gif`
- Image has inline styles: `width: 150`, `margin: 'auto', display: 'block'`
- Only shows when `!hasAnyField` (no fields registered yet)
- When fields are added, the gif disappears

### Documentation
- Spec: `docs/superpowers/specs/2026-09-10-easter-eggs-design.md`
- Plan: `docs/superpowers/plans/2026-09-10-easter-eggs-plan.md`

### Future Cleanup
- When the easter egg module is properly implemented, this can be cleaned up by:
  - Creating a dedicated easter egg service/registry
  - Making the easter eggs configurable via flags
  - Adding unit tests for the easter egg behavior
  - Removing the direct GIF reference from the component