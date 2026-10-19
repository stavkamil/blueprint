# blueprint

Sets up an agent-first SDLC and CI/CD environment for new TypeScript projects: standards, quality configs, git
hooks, CI with AI review, protected branches and releases, ready for coding agents working locally, in the cloud
and from your phone.

> **Status:** in development. `blueprint new` and `blueprint doctor` ship in the next release; see the
> [capability map](docs/specs/CAPABILITY-MAP.md).

## Use

Do the [one-time setup](docs/setup.md), then type `/new-project` in Claude Code, or run:

```bash
pnpm dlx @stavkamil/blueprint@1 new my-app --description "What it does" --type ts
```

[Working from your phone](docs/phone.md) covers the Claude app and GitHub Mobile.

## How it's built

- [Specs](docs/specs/), one per module, plus the [capability map](docs/specs/CAPABILITY-MAP.md)
- [Maintainer setup](docs/maintainer-setup.md)
- [AGENTS.md](AGENTS.md): instructions for coding agents working in this repo

## License

[MIT](LICENSE)
