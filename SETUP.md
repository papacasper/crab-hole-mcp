# Setup guide

Five steps: build it, install the remote helper, grant it sudo, point it at your
server, and wire it into your MCP client. Takes about 10 minutes if Crab-hole is
already running.

## 0. Prerequisites

- A Crab-hole instance already running on a Linux host.
- SSH key access from the machine that will run this MCP server to that host
  (test with a plain `ssh your_user@your-host` first — it must work non-interactively).
- [Bun](https://bun.sh) installed locally.

## 1. Clone and build

```bash
git clone https://github.com/papacasper/crab-hole-mcp.git
cd crab-hole-mcp
bun install
bun run build
```

## 2. Install the remote helper on the Crab-hole host

Copy the helper script over and lock it down to root:

```bash
scp remote/crab-hole-admin your_user@your-host:/tmp/crab-hole-admin
ssh your_user@your-host \
  'sudo install -o root -g root -m 0750 /tmp/crab-hole-admin /usr/local/sbin/crab-hole-admin && rm /tmp/crab-hole-admin'
```

It only accepts a fixed set of subcommands (`status`, `get-config`, `add-rule`, ...) —
this is not a general shell.

## 3. Grant your SSH user passwordless sudo — scoped to only this binary

On the Crab-hole host:

```bash
echo 'your_ssh_user ALL=(root) NOPASSWD: /usr/local/sbin/crab-hole-admin' | \
  sudo tee /etc/sudoers.d/crab-hole-mcp
sudo chmod 0440 /etc/sudoers.d/crab-hole-mcp
```

If your install paths differ from the defaults (config at
`/etc/crab-hole/config.toml`, service `crab-hole.service`, binary
`/usr/local/bin/crab-hole`, listener on `127.0.0.1:5354`), edit the constants at the
top of `remote/crab-hole-admin` before copying it over in step 2.

## 4. Point the MCP at your server

Back on your local machine:

```bash
cp .env.example .env
```

Edit `.env` and set at minimum:

```
CRAB_HOLE_SSH_HOST=your-server-ip-or-hostname
```

Leave `CRAB_HOLE_MUTATIONS_ENABLED` unset (or `false`) until you've confirmed the
read-only tools work — see the verify step below.

## 5. Connect it to your MCP client

Add an entry to your client's MCP config (Claude Desktop, Claude Code, etc.), pointing
`command` at the built binary in this checkout:

```json
{
  "mcpServers": {
    "crab-hole": {
      "command": "/full/path/to/crab-hole-mcp/bin/crab-hole-mcp"
    }
  }
}
```

Restart the MCP client to pick it up.

## Verify it worked

```bash
bun run smoke:mcp
```

This connects as an MCP client, lists tools, and calls a few read-only ones
(`get_crab_hole_config`, `crab_hole_status`, `check_domain`) against your real server.
If it prints JSON status/config output instead of an error, you're done.

Once you're confident, set `CRAB_HOLE_MUTATIONS_ENABLED=true` in `.env` to unlock the
config-write and rule-management tools — see the main [README](README.md) for the
safe config-replace workflow (hash-gated, backed up, atomic).

## Troubleshooting

- **`Invalid configuration: CRAB_HOLE_SSH_HOST: Required`** — you skipped step 4.
- **SSH hangs or asks for a password** — the MCP runs SSH non-interactively
  (`BatchMode=yes`); fix key-based auth first with a plain `ssh` test.
- **`sudo: a password is required`** — the sudoers entry in step 3 isn't installed
  correctly, or the SSH user doesn't match `your_ssh_user` in it.
- **`Crab-hole did not become ready`** on a config change — the MCP already rolled
  the config back automatically; check `recent_logs` for what Crab-hole rejected.
