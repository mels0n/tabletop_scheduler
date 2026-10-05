---
title: "October Update: Tighter Security, Faster Pages and a Pile of Fixes"
description: "One weekend, ten merged changes. Signed sessions, hashed admin links, reminders that never miss, faster vote and manage pages, and a cleaner self-host upgrade path."
date: "2026-10-05"
tags: ["Product Update", "Security", "Performance", "Self-Hosting", "Telegram", "Discord"]
listTitle: "What Changed in the October 2026 Update"
itemList: ["Signed sessions and hashed admin links", "Opt out of bot direct messages", "Reminders and webhooks that retry instead of failing silently", "Faster finalize, vote and manage pages", "Clearer If Needed seating rules", "Automatic self-host upgrades from any earlier release", "Native arm64 Docker images", "Public community stats"]
faq:
  - question: "Do my old admin links still work after the October 2026 update?"
    answer: "Yes. Every admin link created before the update keeps working. The stored token is upgraded to a hashed form the first time the link is used, so nothing needs to be regenerated or reshared."
  - question: "Why was I signed out of Telegram or Discord on Tabletop Time?"
    answer: "The October 2026 update moved linked identities to signed cookies. That required one fresh sign-in for linked Telegram and Discord users. Your events, votes and links are unchanged, and it is not expected to happen again."
  - question: "Can I stop the Tabletop Time bot from sending me direct messages?"
    answer: "Yes. Turn off direct messages from the My Events page. Group posts in your Telegram or Discord channel are not affected, and login links you ask for are still delivered."
  - question: "When does an If Needed vote get a seat automatically?"
    answer: "An If Needed player is seated automatically only while the table is below its minimum player count. Yes voters are seated whenever a seat is open. A waitlisted If Needed player can switch to Yes to claim an open seat."
  - question: "Do self-hosted instances need a manual database step to upgrade?"
    answer: "No. A self-hosted instance updates its database schema when it starts and runs any recorded data migrations once. Every earlier release snapshot is tested in CI to confirm it upgrades cleanly."
---

# October Update: Tighter Security, Faster Pages and a Pile of Fixes

The first weekend of October turned into a long one. Ten changes landed, built from more than 140 individual commits, and most of them are things you will never see. That is the point. This post walks through what changed, what (if anything) you need to do about it, and why it matters for your game night.

The short version: your links still work, your votes are safer, your pages are faster, and reminders now show up when they are supposed to.

## Security: Your Links and Votes Are Harder to Mess With

Tabletop Time has never asked you to make an account, and that is not changing. But "no account" still has to mean "only you can change your vote," and this update tightens that up.

- **Signed sessions.** The cookies that remember who you are on an event, and which Telegram or Discord identity you linked, are now signed by the server. A browser can only edit its own vote, not someone else's.
- **Hashed admin links.** The secret in your organizer link is now stored as a hash, the same way passwords are stored. Old links keep working: the first time you use one, it quietly upgrades itself. Nothing to reshare.
- **Validated everything.** Every form submission, button press and API call is checked against a strict schema before the server touches it. Malformed input gets a clean error instead of a surprise.
- **Safer integrations.** Webhooks are now signed so a receiving server can confirm they really came from Tabletop Time, and they can only be sent to public `https` addresses.
- **No more embedding.** Pages can no longer be loaded inside another site's frame, which closes off a class of click-hijacking tricks.

**One thing you might notice:** if you linked Telegram or Discord, you were signed out once when this went live. That was the switch to signed cookies. Sign back in and everything is exactly where you left it. It is not expected to happen again.

## Your Inbox, Your Call: Bot DM Opt-Out

The bot sends direct messages for things that matter to you personally: when an event you joined is finalized, when you move off the waitlist, when quorum is reached on an event you run. Some people want that. Some people do not.

You can now turn direct messages off from [My Events](/profile). Group posts in your Telegram or Discord channel keep working as normal, and login links you ask for are still delivered (otherwise you could lock yourself out). Our [privacy policy](/legal) lists exactly what the bot sends and why.

## Reminders That Actually Arrive

Session reminders and webhook deliveries used to depend on a scheduled job that could drift by hours. Now they run from the database itself, every few minutes, with a second scheduler as a backup.

- Reminders **claim their slot first**, so a job that runs twice never sends twice.
- If a run is missed, the next one **catches up** instead of skipping.
- Reminder times are now correct across **daylight saving** changes.
- Webhooks are queued in the same step as the change that caused them, tried immediately, then **retried with backoff** if the other end is down.

Events that had already reached quorum before the update were backfilled, so nobody got nudged twice about a game that was already set.

## Speed: Fewer Round Trips on the Busiest Pages

Three pages do most of the work on Tabletop Time: voting, finalizing and the organizer's manage page. All three got faster.

- **Finalize** now saves the event and sends you on your way right away. The group announcement and player DMs go out a moment later in the background, built from the event's latest state, so a quick edit right after finalizing can no longer leave a stale pinned message.
- **Voting** reads only what it needs, and only loads every slot and vote when quorum still has to be checked.
- **The manage page** runs its permission check and data load at the same time instead of one after the other, and no longer loads fields it never shows.
- **Smaller downloads.** Manage-page dialogs load their code only when you are about to open one. The FAQ page is now fully static. Background polling pauses when the tab is hidden.

If you leave a manage page open across a deploy and a dialog cannot load, you now get a clear "this page was updated" message with a Reload button, instead of a dialog that silently does nothing. Anything you typed elsewhere on the page is kept.

## Fixes and Rule Clarifications

A handful of behaviors were tightened so they match what the buttons say.

- **If Needed seating.** "If Needed" players are seated automatically only while the table is below its minimum. Once you have enough "Yes" votes, an If Needed player stays on the waitlist until they switch to Yes. Campaigns keep the any-open-seat rule.
- **Skipped slots count as No.** If a vote leaves out the slot that was finalized, it is treated as a No rather than an unknown.
- **Less group-chat spam.** Vote announcements to a group are limited to one per hour per player.
- **Sensible limits.** Events cap at 500 time options, which is far beyond any real scheduling poll but stops runaway imports.
- **Cleanup that waits.** Expired events are no longer removed while a webhook about them is still in the queue.

## For Self-Hosters

If you run Tabletop Time on your own server, upgrades should now be boring, which is the goal.

- **Automatic upgrades from any version.** The database schema updates itself on start, and one-time data fixes run exactly once. CI now proves that every earlier release upgrades cleanly before anything ships.
- **Native arm64 images.** The Docker image for Raspberry Pi and other ARM machines is now built on real ARM hardware instead of an emulator. A publish that ran past 45 minutes now finishes in under ten, and the ARM image gets the same vulnerability scan as the x86 one.
- **Framework refresh.** Next.js 16.3, React 19.3 and Node 22, plus the usual round of dependency updates.

Integrators calling the API should skim the "Changes for integrators" section of the API reference in the [project repository](https://github.com/mels0n/tabletop_scheduler). The biggest one: editing a participant by id now needs the event's admin token in an `Authorization` header.

## A Few Small Things

- **Scheduled blog posts** are now decided once at build time, so a post that is not live yet simply does not exist on the site.
- **Community stats** (events active, voting open, players active, games locked in) are now available at a public `/api/stats` endpoint and shown as badges on the project's GitHub page.
- **The GitHub icon** in the footer is now drawn in-house after our icon library dropped brand logos.

## What You Need to Do

Almost nothing. If you were signed out of Telegram or Discord, sign back in. If you would rather not get bot DMs, flip the switch on My Events. Everything else, from your admin links to your stored votes, carries over on its own.

Thanks for rolling dice with us. If something looks off after the update, open an issue on the [GitHub repository](https://github.com/mels0n/tabletop_scheduler) and we will take a look.
