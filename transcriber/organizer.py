from pathlib import Path
from transcriber.config import Config

class FileOrganizer:
    """Handles the organization of recording files within the Obsidian vault."""

    def __init__(self, vault_root: str | Path, config: Config, context: 'VaultContext' = None):
        self.vault_root = Path(vault_root)
        self.config = config
        self.recordings_dir = config.get_audio_path()
        self.context = context

    def ensure_recordings_dir(self) -> None:
        self.recordings_dir.mkdir(parents=True, exist_ok=True)

    def discover_recordings(self) -> list[Path]:
        recordings = list(self.vault_root.glob("*.m4a"))
        if self.context:
            recordings = [r for r in recordings if not self.context.should_ignore(r)]
        return recordings

    def organize(self) -> None:
        self.ensure_recordings_dir()
        for recording in self.discover_recordings():
            dest = self.recordings_dir / recording.name
            recording.rename(dest)
