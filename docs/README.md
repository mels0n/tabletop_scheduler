# docs

Documentation follows the Diátaxis split: each page has one job, and the folder says which.

- `guides/` - task-oriented how-to pages ("set up the Telegram bot", "deploy to Vercel"). They assume you know the basics and solve one problem each.
- `reference/` - facts to look up: environment variables, API routes, data handling. Reference states what is true and does not explain why.
- `adr/` - numbered architecture decision records. An accepted ADR is not edited; a changed decision gets a new ADR that supersedes it. Start from `adr/TEMPLATE.md`.
- `examples/` - sample configuration files referenced from the guides.

Add a `tutorials/` or `explanation/` folder together with its first page, never as an empty placeholder.
