import os
from pathlib import Path
from dataclasses import dataclass, field
from typing import Optional

@dataclass
class Config:
    vault_root: Path
    audio_dir: Path = field(default_factory=lambda: Path("Recordings"))
    transcription_dir: Path = field(default_factory=lambda: Path("Recordings"))
    move_audio: bool = False
    ai_provider: str = "mistral"
    ai_model: str = "voxtral-mini-latest"
    api_key: Optional[str] = None
    transcription_template: str = "{original_name}-transcribe"
    error_log_file: str = "Transcription Errors.md"
    migrate_links: bool = True
    commit_message_template: str = "chore(transcription): Add transcription for {audio_file}"
    pr_title_template: str = "Transcription: {audio_file}"

    def __post_init__(self):
        self.vault_root = Path(self.vault_root)
        self.audio_dir = Path(self.audio_dir)
        self.transcription_dir = Path(self.transcription_dir)

    @classmethod
    def load(cls, config_path: Optional[Path] = None) -> "Config":
        """Loads configuration from TOML file and environment variables (env takes precedence)."""
        toml_data = {}

        if config_path is None:
            default_config = Path("transcriber.toml")
            if default_config.exists():
                config_path = default_config

        if config_path and config_path.exists():
            try:
                import sys
                if sys.version_info >= (3, 11):
                    import tomllib
                else:
                    import tomli as tomllib

                with open(config_path, "rb") as f:
                    toml_data = tomllib.load(f)
            except Exception as e:
                print(f"Warning: Could not load config from {config_path}: {e}")

        def get_val(key: str, env_name: str, default):
            val = os.getenv(env_name)
            if val is not None:
                if isinstance(default, bool):
                    return val.lower() in ("true", "1", "yes")
                return val
            return toml_data.get(key, default)

        vault_root = Path(get_val("vault_root", "TRANSCRIBER_VAULT_ROOT", "..")).resolve()

        return cls(
            vault_root=vault_root,
            audio_dir=Path(get_val("audio_dir", "TRANSCRIBER_AUDIO_DIR", "Recordings")),
            transcription_dir=Path(get_val("transcription_dir", "TRANSCRIBER_TRANSCRIPTION_DIR", "Recordings")),
            move_audio=get_val("move_audio", "TRANSCRIBER_MOVE_AUDIO", False),
            ai_provider=get_val("ai_provider", "TRANSCRIBER_AI_PROVIDER", "mistral"),
            ai_model=get_val("ai_model", "TRANSCRIBER_AI_MODEL", "voxtral-mini-latest"),
            api_key=os.getenv("MISTRAL_API_KEY") or os.getenv("TRANSCRIBER_API_KEY") or toml_data.get("api_key"),
            transcription_template=get_val("transcription_template", "TRANSCRIBER_TRANSCRIPTION_TEMPLATE", "{original_name}-transcribe"),
            error_log_file=get_val("error_log_file", "TRANSCRIBER_ERROR_LOG", "Transcription Errors.md"),
            migrate_links=get_val("migrate_links", "TRANSCRIBER_MIGRATE_LINKS", True),
            commit_message_template=get_val("commit_message_template", "TRANSCRIBER_COMMIT_MSG", "chore(transcription): Add transcription for {audio_file}"),
            pr_title_template=get_val("pr_title_template", "TRANSCRIBER_PR_TITLE", "Transcription: {audio_file}")
        )

    @classmethod
    def from_env(cls) -> "Config":
        """Loads configuration from environment variables only (deprecated)."""
        return cls.load()

    def get_audio_path(self) -> Path:
        if self.audio_dir.is_absolute():
            return self.audio_dir
        return (self.vault_root / self.audio_dir).resolve()

    def get_transcription_path(self) -> Path:
        if self.transcription_dir.is_absolute():
            return self.transcription_dir
        return (self.vault_root / self.transcription_dir).resolve()

    def get_transcription_filename(self, audio_filename: str) -> str:
        original_name = Path(audio_filename).stem
        return f"{self.transcription_template.format(original_name=original_name)}.md"
