---
title: "Thursday: A Board Game Group Manager With Real Elo Rankings"
description: "A primer on every feature of Thursday (gamethursday.win), the first app built on the Tabletop Time API, and the story of how its weight-adjusted Elo player rankings were designed."
date: "2026-11-19"
tags: ["Board Games", "Elo", "Player Rankings", "Integrations", "Game Night", "BoardGameGeek"]
itemList: ["Groups with roles, guests and share links", "A planner with RSVPs and Tabletop Time scheduling", "A BoardGameGeek-synced collection with group scores", "Game roulette for when nobody can decide", "Play logging with scores, factions and co-op results", "Elo player rankings weighted by game complexity", "A results API for uploading plays"]
listTitle: "What Thursday Does"
faq:
  - question: "What is Thursday (gamethursday.win)?"
    answer: "Thursday is a board game group manager. It lets a group plan game nights, pick what to play from a shared BoardGameGeek collection, record each play with scores and winners, and track players on an Elo ranking that weighs heavier games more. It was the first app to integrate with the Tabletop Time scheduling API."
  - question: "How does Thursday calculate player rankings?"
    answer: "Thursday uses a standard Elo system. Every player starts at 1000, and after each play the rating moves by K times the difference between the actual and expected result. The K-factor is 32 multiplied by the game's BoardGameGeek weight, so a win in a heavy game moves your rating more than a win in a light one."
  - question: "How does Thursday rank co-op games?"
    answer: "In Thursday, a co-op game gets a rating of its own and is treated as an opponent. When the table loses, the game's rating goes up; when the table wins, it goes down. Over time this ranks co-op games by real difficulty and stops players from farming points by beating the same easy co-op over and over."
  - question: "Do Thursday rankings reset each year?"
    answer: "No. Thursday has no seasons and ratings never reset. Elo already lets a newer or lower-rated player climb quickly, because beating someone rated far above you earns a large swing in points, and the favorite loses the same amount."
  - question: "How does Thursday connect to Tabletop Time?"
    answer: "From Thursday's planner, the Ask Tabletop Time option opens a Tabletop Time scheduling poll with the game already filled in. When the poll is finalized, the session is scheduled in Thursday and its attendees are synced back. Thursday was the first app to integrate with the Tabletop Time API."
---

# Thursday: A Board Game Group Manager With Real Elo Rankings

[Thursday](https://gamethursday.win/) is a board game group manager. It covers the whole night: plan the session, pick the game, record the play, and see who is really winning. It is also the first app built on the Tabletop Time API, and its player rankings are something we got to help think through with its developer. This post walks through the features, then explains how the rankings were designed.

## How Thursday and Tabletop Time Met

Earlier this year, the developer behind Thursday got in touch and asked about using Tabletop Time from another app through our [developer API](/developers). Thursday became the first app to integrate with it.

The integration lives in Thursday's planner. When a group needs a date, **Ask Tabletop Time** opens a [Tabletop Time](/new) poll with the game already filled in. Players mark the dates they can make it, and once the poll is finalized the session is scheduled back in Thursday with the attendee list synced. Thursday handles what you play and who won. Tabletop Time handles when.

## Every Feature in Thursday

### Groups

Everything in Thursday starts with a group. Players can join with or without an account, and each member has a role (Owner, Admin, Member or Guest) with a clear "who can do what" permission table. You share a group with a link. Guests can try Thursday and create a group right in the browser, then claim it later when they sign in. Groups are private by default, and each one can show a read-only Google Calendar.

### The Planner

The planner is a calendar of upcoming sessions. Each session has an attendee list with Going, Maybe and No, the game (or games) you plan to play, the expansions you will include, and links to resources for the night. This is where the Tabletop Time integration sits.

### Your Collection, Synced From BoardGameGeek

Add your BoardGameGeek username and Thursday syncs your collection. You can also add games by hand. Browse it as a shelf, a gallery or a list, and mark each game as owned, preordered, borrowed or for sale. Every game shows three scores side by side: the BoardGameGeek rating, your own score and your group's score. Group votes surface the games your table actually wants to play, and an Insights view charts what the collection looks like. Expansions nest under their base game.

Open any game and you get its overview, play activity, resources, tags, a **pack away** tab, the sleeve sizes it needs and its expansions.

### Game Roulette

Every group has the twenty-minute "what should we play?" problem. Game roulette answers a few questions (who is here, competitive or co-op, how much time, how heavy, any tags) and picks one game from the pool. If nothing fits, it relaxes the weight first, then the time, then the tags, so it can still find a pick.

### Lists and Community Tags

Lists can be private, shared with the group or public, and smart lists fill themselves from rules you set. Admins curate a set of community tags that players use to label games, and expansions inherit the tags of their base game.

### Recording a Play

After the game, log the players, scores or finishing ranks, factions, the start player and who was playing for the first time. Mark the winners (ties can have more than one), or for a co-op game, whether the team won. Play history keeps the full record, and the dashboard rolls it up into your next session, the most wanted games, a league table and recent plays.

### A Results API

Thursday has an API of its own. You can create a token in settings and upload results from other tools, which is handy for groups that already log plays somewhere else.

### The Small Things

Sign in with Telegram, Discord or an email link, with no password to remember. There are five color themes named for the hours of a Thursday (Morning, Afternoon, Dusk, Evening and Late), or the theme can follow the time of day. A help section walks through each part of the app.

## Player Rankings

Logging plays is useful. Rankings answer the question every group argues about: who is actually the best player at this table? Thursday answers it with Elo, the rating system chess has used for decades, adapted for board games.

### How It Started

A few weeks ago, Thursday's developer reached out to talk rankings. The first question on the table was a good one: should a heavier game be worth more points than a lighter one?

Over a few evenings of back-and-forth, we kept landing on the same answer. Points per win would never be fair, because beating a newcomer and beating your group's best player are not the same achievement. It had to be Elo. Thursday's developer agreed right away, read up on it, and had a first version live the same night. Then the real design work started, because Elo is simple math with a lot of decisions hiding behind it. One rating per group, or one per player? Per game? What about co-op games? What about ties? Here is where those conversations landed.

### One Rating, Everywhere

Every player has a single rating across every group they play in. Elo is meant to measure you against everyone else, so splitting it by group would break it. Everyone starts at 1000.

### Heavier Games Count More

Standard Elo moves a rating by a fixed amount called the K-factor, usually 32. The answer to the "heavier games" question was to multiply that K by the game's BoardGameGeek weight, which runs from 1 (light) to 5 (heavy):

- **Expected score:** E = 1 / (1 + 10^((opponent's rating − your rating) / 400))
- **New rating:** your rating + K × (S − E), where S is 1 for a win, 0.5 for a draw and 0 for a loss
- **K-factor:** 32 × the game's weight (2.5 if the game has no weight on file)

So weight decides how much is at stake, and the ratings of the people you face decide how much of it you collect. A win in a 3.5-weight game against a stronger player is worth a lot. A win in a party game against someone you always beat is worth very little.

Here is a 3.5-weight game (K = 112) between a player rated 1000 and a player rated 1200:

| Result | Lower-rated player | Higher-rated player |
| --- | --- | --- |
| Favorite wins | −27 | +27 |
| Upset | +85 | −85 |

That gap is why Thursday does not need yearly resets. The idea of a fresh season came up, as a way to give everyone another shot at the top. But Elo already gives you that shot every game. Beat the top player once and you gain a large share of their rating, and the bigger the gap, the bigger the swing. A reset would just throw away a year of information.

### Multiplayer Games Are a Set of Duels

Chess is one-on-one: you only ever win points from one person. Most board games are not. In Thursday, every pair at the table is treated as its own head-to-head result, and your change is averaged across your opponents. In a four-player game:

| Finish | Head-to-head results | Change (all at 1000, weight 2.0) |
| --- | --- | --- |
| 1st | 3 wins | +32 |
| 2nd | 2 wins, 1 loss | +11 |
| 3rd | 1 win, 2 losses | −11 |
| 4th | 3 losses | −32 |

Finishing second in a strong field still counts for something, and finishing last against weaker players costs you.

### Co-op Games Get a Rating Too

This was the hardest question. In a co-op game there is no opponent to take points from, so most ranking systems simply skip co-op.

The idea we arrived at together was to make the game itself the opponent. Every co-op game in Thursday has its own rating. When it beats the table, its rating goes up. When a table beats it, its rating goes down. As plays add up, co-op games sort themselves by real difficulty against the players who actually face them, and Thursday shows that as a **co-op difficulty** list.

It also closes a loophole. You cannot climb by beating the same easy co-op over and over with a strong partner, because that game's rating falls each time you beat it, so each win is worth less. But if most tables lose to a game and yours keeps beating it, you earn the climb.

### A Tie Is a Tie

Some games break ties with a secondary score or two, and some with a whole list. Thursday's developer asked whether a tie-breaker win should count as a full win in the rating. The view we settled on: no. A tie is a tie. In soccer (football or fútbol to most of the world), a match settled on a penalty shootout still goes into the record books as a draw, even though one team advances. The tie breaker is for the people at the table, not for the ranking. Recording the tie breakers themselves, as many rounds as a game needs or none at all, is the next piece Thursday is building, and it also leaves room for real shared wins.

### The Fine Print

A player with fewer than five rated plays is marked provisional. Ratings are recalculated from the full play history whenever a play is edited, so fixing a typo in last month's scores fixes the rankings too. A play can also be left out of the ratings, which is useful for a teaching game.

## Try It

If your group already argues about who is best at the table, Thursday gives you a record to argue from. Sign up at [gamethursday.win](https://gamethursday.win/), sync your BoardGameGeek collection and start logging plays. When you need a date for the next game night, the scheduling side runs on [Tabletop Time](/new), with no accounts needed for your players.

Building something of your own for game groups? Thursday shows what is possible on our [developer API](/developers), and we would love to see what you make.
