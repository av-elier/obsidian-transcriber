import os
import sys
import json
import argparse
from pathlib import Path
from datetime import datetime
from typing import Optional
from dotenv import load_dotenv

from transcriber.organizer import FileOrganizer
from transcriber.providers import factory
from transcriber.linker import LinkMigrator
from transcriber.config import Config

class VaultContext:
    """Handles vault-level configuration and ignore rules."""

    def __init__(self, vault_root: Path):
        self.vault_root = vault_root
        self.ignore_filters = self._load_ignore_filters()

    def _load_ignore_filters(self) -> list[str]:
        app_json_path = self.vault_root / ".obsidian" / "app.json"
        if not app_json_path.exists():
            return []
        try:
            with open(app_json_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                return data.get("userIgnoreFilters", [])
        except Exception as e:
            print(f"Warning: Could not load ignore filters: {e}")
            return []

    def should_ignore(self, path: Path) -> bool:
        if any(part.startswith(".") for part in path.parts):
            return True

        try:
            relative_path = str(path.relative_to(self.vault_root)).replace("\\", "/")
        except ValueError:
            return False

        return any(relative_path.startswith(f.rstrip("/")) for f in self.ignore_filters)


def log_error(config: Config, message: str):
    error_file = config.vault_root / config.error_log_file
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    with open(error_file, "a", encoding="utf-8") as f:
        f.write(f"## {timestamp}\n{message}\n\n")


def run_pipeline(config: Config):
    """Runs the full transcription and migration pipeline."""
    vault_root = config.vault_root
    context = VaultContext(vault_root)

    if not config.api_key:
        error_msg = f"API Key not found for provider {config.ai_provider}."
        print(f"Error: {error_msg}")
        log_error(config, error_msg)
        sys.exit(1)

    print("Organizing files...")
    organizer = FileOrganizer(vault_root, config=config, context=context)
    organizer.organize()

    print("Transcribing recordings...")
    try:
        transcriber = factory.get_provider(config.ai_provider, config.api_key, timeout=config.timeout)
    except ValueError as e:
        error_msg = str(e)
        print(f"Error: {error_msg}")
        log_error(config, error_msg)
        sys.exit(1)

    audio_dir = config.get_audio_path()
    transcription_dir = config.get_transcription_path()

    if not audio_dir.exists():
        print(f"Audio directory {audio_dir} not found. Skipping transcription.")
    else:
        for audio_file in audio_dir.glob("*.m4a"):
            if context.should_ignore(audio_file):
                continue

            transcription_filename = config.get_transcription_filename(audio_file.name)
            transcription_file = transcription_dir / transcription_filename

            if not transcription_file.exists():
                print(f"Transcribing {audio_file.name}...")
                try:
                    text = transcriber.transcribe(audio_file, model=config.ai_model)
                    transcription_file.write_text(text, encoding="utf-8")
                    print(f"Saved to {transcription_file}")
                except Exception as e:
                    error_msg = f"Failed to transcribe {audio_file.name}: {e}"
                    print(error_msg)
                    log_error(config, error_msg)

    if config.migrate_links:
        print("Migrating links...")
        linker = LinkMigrator(vault_root, config=config, context=context)
        linker.migrate_all()

    print("Pipeline completed successfully.")


def main():
    parser = argparse.ArgumentParser(description="Obsidian AV Transcriber CLI")
    parser.add_argument("--config", type=Path, help="Path to transcriber.toml config file")
    parser.add_argument("--vault-root", type=Path, help="Path to Obsidian vault root")
    parser.add_argument("--audio-dir", type=Path, help="Directory containing audio files")
    parser.add_argument("--transcription-dir", type=Path, help="Directory for transcriptions")
    parser.add_argument("--ai-provider", help="AI provider (default: mistral)")
    parser.add_argument("--ai-model", help="AI Model to use")

    args = parser.parse_args()
    load_dotenv()

    cli_to_env = {
        "vault_root": "TRANSCRIBER_VAULT_ROOT",
        "audio_dir": "TRANSCRIBER_AUDIO_DIR",
        "transcription_dir": "TRANSCRIBER_TRANSCRIPTION_DIR",
        "ai_provider": "TRANSCRIBER_AI_PROVIDER",
        "ai_model": "TRANSCRIBER_AI_MODEL",
    }
    for attr, env_var in cli_to_env.items():
        val = getattr(args, attr)
        if val is not None:
            os.environ[env_var] = str(val)

    config = Config.load(config_path=args.config)
    run_pipeline(config)

if __name__ == "__main__":
    main()
