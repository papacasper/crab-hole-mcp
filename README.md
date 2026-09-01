# Crab-hole MCP

An [MCP](https://modelcontextprotocol.io) server for inspecting and administering a
[Crab-hole](https://github.com/LuckyTurtleDev/crab-hole) DNS filter over SSH — so an AI
assistant (Claude, or any MCP-compatible client) can check status, query blocklists,
manage allow/block rules, and safely roll out config changes on your self-hosted
instance.

It talks to a single root-owned helper script on the Crab-hole host over non-interactive
SSH. It never reads or forwards SSH keys, and it never gives the model an arbitrary
shell — only the fixed set of operations described below.

## Tools

Read-only tools are enabled by default:

- `get_crab_hole_config` — read the complete active TOML plus its SHA-256 revision
- `validate_crab_hole` — run Crab-hole's native config and blocklist validators
- `validate_proposed_config` — validate proposed TOML without installing it
- `list_config_backups` — list configuration and custom-rule safety backups
- `crab_hole_status` — service state, version, block count, rule counts, refresh time, and memory
- `check_domain` — resolve a domain through the live filter and report whether it is blocked
- `list_custom_rules` — list custom allow or block entries
- `list_blocklists` — list configured remote and local sources
- `recent_logs` — read recent service logs, optionally errors only

Set `CRAB_HOLE_MUTATIONS_ENABLED=true` to additionally expose:

- `replace_crab_hole_config` — atomically replace the entire validated TOML configuration
- `restore_crab_hole_config` — restore a validated configuration backup
- `control_crab_hole_service` — start, stop, or restart Crab-hole
- `add_custom_rule` — requires `ADD ALLOW domain` or `ADD BLOCK domain`
- `remove_custom_rule` — requires `REMOVE ALLOW domain` or `REMOVE BLOCK domain`
- `restart_crab_hole` — backward-compatible restart shortcut

Because `replace_crab_hole_config` replaces the complete TOML, it can add, remove, or
modify blocklist and allow-list sources, blocking mode, subdomain behavior, downstream
listeners, upstream resolvers, TLS settings, timeouts, and any other option supported by
the installed binary. The safe workflow is:

1. Read `get_crab_hole_config` and retain its `sha256`.
2. Edit the returned TOML.
3. Call `validate_proposed_config`.
4. Call `replace_crab_hole_config` with the original hash and exact confirmation
   `REPLACE CRAB-HOLE CONFIG <sha256>`.

The expected hash rejects stale edits. Configuration and rule writes are serialized,
backed up under `/var/backups/crab-hole-mcp/` on the remote host, and installed
atomically. With `applyNow=false`, changes wait for a later restart. With
`applyNow=true`, the MCP restarts Crab-hole, verifies its localhost DNS listener, and
automatically restores the backup if readiness fails. Restores make an additional
safety backup first.

Service confirmations are exact: `START CRAB-HOLE`, `STOP CRAB-HOLE`, or
`RESTART CRAB-HOLE`. Stopping or restarting can interrupt filtered DNS briefly.

## Requirements

- A Crab-hole instance running on a Linux host you can SSH into.
- `jq` and `python3` (with `tomllib`, stdlib on 3.11+) installed on that host.
- A non-interactive SSH key set up from wherever this MCP server runs to that host,
  authorized for a user with passwordless `sudo` access to the helper script (see
  below) — not to anything else.
- [Bun](https://bun.sh) to build/run this project locally.

## Install

See [SETUP.md](SETUP.md) for a full walkthrough. Quick version:

```bash
git clone https://github.com/papacasper/crab-hole-mcp.git
cd crab-hole-mcp
bun install
bun run typecheck
bun test
bun run build
```

### Remote helper

Copy `remote/crab-hole-admin` to the Crab-hole host, root-owned and not writable by
anyone else:

```bash
sudo install -o root -g root -m 0750 remote/crab-hole-admin /usr/local/sbin/crab-hole-admin
```

It only accepts a fixed set of subcommands (`status`, `get-config`,
`validate-proposed`, `replace-config`, `add-rule`, ...) — it is not an arbitrary shell
interface. Grant your SSH user passwordless sudo scoped to exactly this binary, e.g. in
`/etc/sudoers.d/crab-hole-mcp`:

```
your_ssh_user ALL=(root) NOPASSWD: /usr/local/sbin/crab-hole-admin
```

The helper assumes Crab-hole's config lives at `/etc/crab-hole/config.toml`, custom
rules at `/etc/crab-hole/allowed-custom.txt` / `blocked-custom.txt`, the systemd unit is
`crab-hole.service`, and the binary is `/usr/local/bin/crab-hole` listening on localhost
UDP `5354` — adjust the constants at the top of `remote/crab-hole-admin` if your install
differs.

### Configuration

Copy `.env.example` to `.env` and set at minimum `CRAB_HOLE_SSH_HOST`:

```bash
cp .env.example .env
```

No SSH keys, DNS credentials, or server secrets are stored in this project — SSH
authentication is handled by your normal `ssh`/agent setup on the machine running the
MCP server.

## Connect

Use `mcp-config.example.json` as a starting point for any client that accepts the
common `mcpServers` format:

```json
{
  "mcpServers": {
    "crab-hole": {
      "command": "crab-hole-mcp",
      "env": {
        "CRAB_HOLE_SSH_HOST": "your-server-ip-or-hostname"
      }
    }
  }
}
```

If you installed via `bun run build` in a cloned checkout instead of a package
manager, point `command` at the generated `bin/crab-hole-mcp` script instead. Rebuild
after source changes and restart the MCP client after configuration changes.

## Safety boundaries

This MCP fully administers Crab-hole itself, but deliberately does not provide
arbitrary server-file or shell access. Anything outside Crab-hole itself — DNS
forwarders/edges like `dnsdist`, firewalls, OS packages, certificates, and unrelated
services — is out of scope for its mutation tools. Certificate and private-key paths
may be configured in Crab-hole's TOML, but private-key contents are never returned.

## License

MIT. Crab-hole itself is AGPL-3.0-licensed; this project only talks to it over SSH/CLI
and does not link against or embed its code.
