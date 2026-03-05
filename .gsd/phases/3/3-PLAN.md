---
phase: 3
plan: 1
wave: 1
---

# Plan 3.1: Fix Hardcoded Recover Access Description Text

## Objective
Fix the hardcoded description paragraph in `ManagerRecovery.tsx` that always reads "Enter the Telegram Handle..." regardless of the selected platform. All other text in the modal (label, placeholder, footnote, button color) is already dynamic — this is the one remaining stale string.

## Context
- features/auth/ui/ManagerRecovery.tsx

## Tasks

<task type="auto">
  <name>Make Description Paragraph Dynamic</name>
  <files>
    - features/auth/ui/ManagerRecovery.tsx
  </files>
  <action>
    - On line 106-108, replace the static `<p>` description with a conditional expression:
      ```tsx
      <p className="text-slate-400 text-sm mb-4">
          {platform === "telegram"
              ? <>Enter the Telegram Handle you provided when creating this event. We will verify it and send a <b>Magic Link</b> to your Telegram DMs.</>
              : <>Enter the Discord Username linked to this event. We will verify it and send a <b>Magic Link</b> to your Discord DMs.</>
          }
      </p>
      ```
    - Do not modify any other part of the component.
  </action>
  <verify>npm run build</verify>
  <done>The description paragraph dynamically reflects the selected platform (Telegram vs Discord). Build succeeds.</done>
</task>

## Success Criteria
- [ ] Selecting "Discord" in the Recover Access modal shows a description mentioning Discord, not Telegram.
- [ ] Selecting "Telegram" still shows the original Telegram description.
- [ ] Build passes with no TypeScript errors.
