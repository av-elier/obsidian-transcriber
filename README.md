# Obsidian AV Transcriber

Automates transcription of audio recordings and link migration in an Obsidian vault.

## Features

- **Transcription** — sends `.m4a` files to Mistral AI (pluggable provider architecture) and saves the result as Markdown.
- **Link migration** — rewrites `![[recording.m4a]]` embeds across the vault to point at the new transcription files.
- **File organisation** — copies (or moves) loose `.m4a` files from the vault root into a configurable recordings directory.
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

## Configuration

Settings can come from three sources. Environment variables override TOML, and CLI flags override both.

### `transcriber.toml`

Place this file in the working directory or pass `--config path/to/file.toml`.

```toml
vault_root = "/path/to/vault"
audio_dir = "Recordings"
transcription_dir = "Recordings"
move_audio = false
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
| `TRANSCRIBER_MOVE_AUDIO` | `true` to move (not copy) originals |
| `TRANSCRIBER_AI_PROVIDER` | Provider name (default: `mistral`) |
| `TRANSCRIBER_AI_MODEL` | Model identifier |
| `MISTRAL_API_KEY` / `TRANSCRIBER_API_KEY` | API key for the provider |

### CLI flags

```
--config              Path to transcriber.toml
--vault-root          Path to Obsidian vault root
--audio-dir           Directory containing audio files
--transcription-dir   Directory for transcriptions
--move-audio          Move audio files instead of copying
--ai-provider         AI provider name
--ai-model            AI model to use
```

## Development

```bash
# Run the test suite
uv run python -m pytest tests/ -v
```
