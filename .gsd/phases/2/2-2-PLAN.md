---
phase: 2
plan: 2
wave: 1
---

# Plan 2.2: UI Polish & Telegram Help

## Objective
Polish the `NewEventPage` UI by removing a redundant header and improve the Telegram Connection UX by adding clear instructions for finding the group invite link.

## Context
- .gsd/SPEC.md
- .gsd/ROADMAP.md
- app/new/page.tsx
- components/TelegramConnect.tsx

## Tasks

<task type="auto">
  <name>Remove Redundant Header</name>
  <files>app/new/page.tsx</files>
  <action>
    - Locate the "Propose Time Slots" header block (lines ~197-200) inside `NewEventForm`.
    - Remove the entire div containing the label and the "slots added" span.
    - Result: `TimeSlotPicker` should be the only component rendering this header (it handles it internally).
  </action>
  <verify>grep -rz "Propose Time Slots" app/new/page.tsx | wc -l</verify>
  <done>Zero occurrences of "Propose Time Slots" in `app/new/page.tsx` (it should only be in `TimeSlotPicker.tsx` or imported)</done>
</task>

<task type="auto">
  <name>Add Telegram Help Text</name>
  <files>components/TelegramConnect.tsx</files>
  <action>
    - In `TelegramConnect.tsx`, locate the `step === 'bot_not_in_group'` block.
    - Inside the `label` or just below it, add a helper text block.
    - Text: "Desktop: ⋮ > Manage Group > Invite Links > Copy Link"
    - Styling: Small, slate-400/500 text, possibly italicized or in a small info box.
  </action>
  <verify>grep "Manage Group > Invite Links" components/TelegramConnect.tsx</verify>
  <done>Help text is present in the component.</done>
</task>

## Success Criteria
- [ ] New Event Page has clean UI without duplicate headers.
- [ ] Telegram Connect wizard guides users to find the link.
