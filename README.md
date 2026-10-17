# blueprint

Sets up an agent-first SDLC and CI/CD environment for new TypeScript projects: standards, quality configs, git
hooks, CI with AI review, protected branches and releases, ready for coding agents working locally, in the cloud
and from your phone.

> **Status:** in development. The `new` and `doctor` commands arrive in later releases; see the
> [capability map](docs/specs/CAPABILITY-MAP.md).

## Use

```bash
pnpm dlx @stavkamil/blueprint@1 --help
```

## How it's built

- [Specs](docs/specs/), one per module, plus the [capability map](docs/specs/CAPABILITY-MAP.md)
- [Maintainer setup](docs/maintainer-setup.md)
- [AGENTS.md](AGENTS.md): instructions for coding agents working in this repo

## License

[MIT](LICENSE)
