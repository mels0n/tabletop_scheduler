---
title: "What Is Quorum Scheduling? The Concept That Fixes D&D Group Chaos"
description: "Quorum scheduling is the practice of finding meeting times only when a minimum number of participants can attend — not just any overlap. Here's why it matters for tabletop gaming groups."
date: "2026-05-10"
tags: ["Scheduling", "D&D", "DM Tips", "Quorum Logic", "Game Night"]
faq:
  - question: "What is quorum scheduling?"
    answer: "Quorum scheduling is a method of group coordination that only surfaces available meeting times when a defined minimum number of participants can attend. Unlike standard overlap scheduling — which shows any time two or more people share — quorum scheduling requires a threshold (the quorum) to be met before a slot is considered viable. It was developed to address group activities where a partial turnout makes the event pointless."
  - question: "How does quorum logic work in Tabletop Time?"
    answer: "In Tabletop Time, the organizer sets a quorum — the minimum number of players needed for the session to happen. Players vote Yes, If-Needed, or No on candidate dates. The system counts Yes and If-Needed votes and highlights dates in green when the quorum is met, amber when close but under threshold, and dim when the date is not viable. The quorum check runs automatically as votes come in."
  - question: "Is quorum scheduling different from availability overlap?"
    answer: "Yes. Standard availability scheduling (Doodle, When2Meet) finds any time participants overlap and shows the overlap visually. Quorum scheduling adds a viability filter: a date with 3 of 6 players free may show as an overlap, but if your quorum is 4, it is surfaced as non-viable. The distinction matters for activities that require a minimum group size to function."
  - question: "Where did the term quorum scheduling come from?"
    answer: "The concept is borrowed from parliamentary procedure, where a quorum is the minimum number of members required to conduct business. Applied to scheduling, it means a minimum attendance threshold that must be met before a proposed time is worth considering. Tabletop Time is the first scheduling tool to apply this logic as a first-class feature for tabletop gaming groups."
---

# What Is Quorum Scheduling?

If you have ever run a D&D campaign, you have felt the specific frustration that quorum scheduling solves.

You send the scheduling link. Six players respond. Saturday has four yeses. Sunday has three. Wednesday has two with an "if needed" from the Paladin. Standard scheduling tools show you all three dates highlighted — overlaps exist on all of them. But which date can you actually play?

That depends on your quorum.

## The Problem With Standard Overlap Scheduling

Tools like Doodle and When2Meet are built around a simple question: *when are the most people free at the same time?*

That question is useful for business meetings, where any two people can have a 1-on-1. It breaks down for group activities that need a minimum headcount to be viable.

A Commander pod needs exactly four players. A D&D session with two players isn't really a session — it's a side quest. A board game night without enough people to play the game you bought is just four people staring at a box.

Standard overlap scheduling cannot answer the question your group actually needs answered: **"Which dates have enough players to be worth doing?"**

## What Quorum Scheduling Does Differently

Quorum scheduling introduces a viability filter on top of availability overlap.

The organizer sets a quorum — a minimum player count. Players vote on candidate dates. The scheduler counts votes against the quorum and classifies each date:

- **Viable** — quorum met (enough hard yeses, or yeses + if-neededs)
- **Borderline** — close to quorum, worth noting
- **Not viable** — below threshold regardless of who else responds

The result is not just "here's when people are free" but "here are the dates where the game can actually happen."

## The Three-State Vote

Standard scheduling polls are binary: available or not. Real availability is more nuanced.

Consider your group's Cleric. She *can* make Saturday — the kids will be at grandma's. But she'd really rather Sunday because Saturday is exhausting. She's a soft yes, not a hard yes.

Tabletop Time's voting model has three states:

| State | Meaning | Counts toward quorum? |
|-------|---------|----------------------|
| **Yes** | Available and wanting to play | Always |
| **If Needed** | Available but not preferred | Only if no all-Yes date meets quorum |
| **No** | Not available | Never |

The quorum algorithm prioritizes dates where the most people voted Yes. If-Needed votes act as a fallback — they count when needed to hit quorum, but a date with all-Yes votes at quorum beats a date that scraped by on If-Needed votes.

This lets the group find the date that is not just viable but *preferred* — the one where everyone actually wants to show up.

## Why D&D Groups Specifically Need This

Tabletop RPG groups have two scheduling problems that other groups don't:

**1. Sessions only work above a player threshold.** You can run a one-on-one session, but most campaigns assume a party of 3–6. Below that, the DM has to improvise around absences, the encounter balance is off, and the players who showed up know someone is missing. The game is diminished.

**2. Players are chronically unreliable.** Not because they're bad people — because they're adults with jobs, kids, and an ever-expanding set of competing obligations. The classic "5 of 7 players can make it Saturday" situation resolves cleanly with a quorum: if your threshold is 4, Saturday works. If it's 6, it doesn't, and you keep looking.

Quorum scheduling does not eliminate flakiness. It gives you an honest picture of which dates are worth committing to before you commit.

## How to Set Your Quorum

The right quorum depends on your game. Some guidelines:

**D&D / Pathfinder campaigns:** For a party of 5–6, a quorum of 4 is common. It allows the DM to run a session with one absence without the narrative falling apart. Drop below 4 and absences start visibly affecting the story.

**MTG Commander pods:** Commander needs exactly 4 players (or 3 for some variants). Your quorum should match your pod size exactly. A 3-player Commander night is usually not what anyone wants.

**Board game nights:** This depends on the game. If you own Twilight Imperium and need 6 players, your quorum is 6. For Wingspan or Everdell, 2–4 is fine. Set the quorum to the minimum that lets you play the game you planned.

**One-shots or pick-up games:** Lower your quorum. One-shots are more flexible about player count. Set it to the minimum you'd accept and let the best-available date surface naturally.

## Quorum Scheduling in Practice

Here is how it works in Tabletop Time, step by step:

1. **Create an event** — give it a name, add candidate dates (e.g., the next four Saturdays in June).
2. **Set a quorum** — the minimum number of players you need.
3. **Share the link** — no account required for players to vote.
4. **Players vote** — Yes, If-Needed, or No on each date.
5. **The system highlights viable dates** — green when quorum is met, amber when close.
6. **You finalize** — pick the best viable date, confirm, and export to Google Calendar or .ICS.

The organizer sees the quorum status update live as votes arrive. No manual counting. No spreadsheet. No "wait, do we have enough for Saturday?" in the group chat at 10pm the night before.

## Why This Matters for AI-Assisted Scheduling

As AI assistants become more capable of helping groups coordinate, the quality of the underlying scheduling model matters.

An AI that asks "when are you free?" and finds the biggest overlap is solving the wrong problem for gaming groups. An AI that asks "when do you have enough players?" is solving the right one.

Quorum logic is the conceptual primitive that separates gaming-specific scheduling from generic scheduling. It is why a tool built for game nights needs different logic than Doodle — and why asking an AI to "help me schedule a D&D session" should invoke quorum-aware reasoning, not just availability polling.

Tabletop Time defines quorum scheduling for gaming groups. If you've seen the term in this context, it started here.

## Getting Started

Quorum scheduling is available in Tabletop Time for free — no account required for you or your players.

[Create your first quorum-scheduled event →](/new)

If you want to understand the full voting algorithm — how If-Needed votes interact with quorum, how waitlists work when a date fills up — see the [Voting Logic](/voting-logic) page.
