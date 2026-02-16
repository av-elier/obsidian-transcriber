import re
from pathlib import Path

from transcriber.config import Config

class LinkMigrator:
    """Scans the vault for .m4a links and updates them to point to transcription files."""

    AUDIO_LINK_RE = re.compile(r"!\[\[(.*?)\.m4a\]\]")

    def __init__(self, vault_root: str | Path, config: Config, context: 'VaultContext' = None):
        self.vault_root = Path(vault_root)
        self.config = config
        self.context = context

    def migrate_links(self, content: str) -> str:
        def replacement(match):
            original_name = match.group(1)
            new_name = self.config.transcription_template.format(original_name=original_name)
            return f"![[{new_name}.md]]"

        return self.AUDIO_LINK_RE.sub(replacement, content)

    def migrate_all(self) -> None:
        for md_file in self.vault_root.rglob("*.md"):
            if self.context:
                if self.context.should_ignore(md_file):
                    continue
            elif any(part.startswith(".") for part in md_file.parts):
                continue

            content = md_file.read_text(encoding="utf-8")
            updated_content = self.migrate_links(content)

            if content != updated_content:
                md_file.write_text(updated_content, encoding="utf-8")
