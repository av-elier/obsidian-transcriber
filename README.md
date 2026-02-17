# Obsidian AV Transcriber

Automates transcription of audio recordings and link migration in an Obsidian vault.

## Features

- **Transcription** — sends `.m4a` files to Mistral AI (pluggable provider architecture) and saves the result as Markdown.
- **Link migration** — rewrites `![[recording.m4a]]` embeds across the vault to point at the new transcription files.
- **File organisation** — moves loose `.m4a` files from the vault root into a configurable recordings directory.
- **Flexible configuration** — settings cascade from defaults → `transcriber.toml` → environment variables → CLI flags, so the tool works locally and in CI without changes.
- **Obsidian-aware** — respects `.obsidian/app.json` ignore filters and skips hidden directories.

## Quick start

```bash
# Run directly with uvx (no install required)
uvx --from git+https://github.com/youruser/obsidian-av.git python -m transcriber.main \
  --vault-root /path/to/vault

# Or install locally and run
uv run python -m transcriber.main --vault-root /path/to/vault
```


## GitHub Actions

You can use this tool to automatically transcribe recordings in your Obsidian vault using GitHub Actions.

1. Create a file `.github/workflows/transcribe.yml` in your vault repository.
2. Copy the content from [this example](.github/example-workflows/transcribe.yml).
3. Add your `MISTRAL_API_KEY` as a repository secret.

### Usage

```yaml
jobs:
  transcribe:
    runs-on: ubuntu-latest
    permissions:
      contents: write
      pull-requests: write
    steps:
      - uses: actions/checkout@v4
      - uses: av-elier/obsidian-transcriber@main
        with:
          api-key: ${{ secrets.MISTRAL_API_KEY }}
```

### Action Configuration

| Input | Description | Default |
|---|---|---|
| `api-key` | **Required**. Mistral API Key | |
| `vault-root` | Path to vault root relative to repo | `.` |
| `audio-dir` | Directory containing recordings | `Recordings` |
| `transcription-dir` | Output directory | `Recordings` |
| `ai-provider` | AI Provider | `mistral` |
| `ai-model` | AI Model | `voxtral-mini-latest` |
| `auto-merge` | Automatically merge the PR | `true` |

## Configuration


Settings can come from three sources. Environment variables override TOML, and CLI flags override both.

### `transcriber.toml`

Place this file in the working directory or pass `--config path/to/file.toml`.

```toml
vault_root = "/path/to/vault"
audio_dir = "Recordings"
transcription_dir = "Recordings"
ai_provider = "mistral"
ai_model = "voxtral-mini-latest"
transcription_template = "{original_name}-transcribe"
migrate_links = true
```

### Environment variables

| Variable | Purpose |
|---|---|
| `TRANSCRIBER_VAULT_ROOT` | Path to the Obsidian vault |
| `TRANSCRIBER_AUDIO_DIR` | Source directory for audio files |
| `TRANSCRIBER_TRANSCRIPTION_DIR` | Output directory for transcriptions |
| `TRANSCRIBER_AI_PROVIDER` | Provider name (default: `mistral`) |
| `TRANSCRIBER_AI_MODEL` | Model identifier |
| `MISTRAL_API_KEY` / `TRANSCRIBER_API_KEY` | API key for the provider |

### CLI flags

```
--config              Path to transcriber.toml
--vault-root          Path to Obsidian vault root
--audio-dir           Directory containing audio files
--transcription-dir   Directory for transcriptions
--ai-provider         AI provider name
--ai-model            AI model to use
```

## Development

```bash
# Run the test suite
uv run python -m pytest tests/ -v
```
