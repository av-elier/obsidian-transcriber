import pytest
from pathlib import Path
from transcriber.linker import LinkMigrator
from transcriber.config import Config


@pytest.mark.parametrize("input_text,expected", [
    ("![[Recording.m4a]]", "![[Recording-transcribe.md]]"),
    ("![[Image.png]]", "![[Image.png]]"),
    ("two: ![[A.m4a]] and ![[B.m4a]]", "two: ![[A-transcribe.md]] and ![[B-transcribe.md]]"),
])
def test_migrate_links(config, input_text, expected):
    assert LinkMigrator(vault_root=".", config=config).migrate_links(input_text) == expected


def test_migrate_links_custom_template(tmp_path):
    cfg = Config(vault_root=tmp_path, transcription_template="{original_name}_v2")
    assert LinkMigrator(vault_root=tmp_path, config=cfg).migrate_links("![[Test.m4a]]") == "![[Test_v2.md]]"


def test_migrate_all_updates_vault_files(tmp_path, config):
    (tmp_path / "Note1.md").write_text("![[Recording 1.m4a]]")
    (tmp_path / "Note2.md").write_text("No link here.")
    (tmp_path / "Sub").mkdir()
    (tmp_path / "Sub" / "Note3.md").write_text("![[Recording 2.m4a]]")

    LinkMigrator(vault_root=tmp_path, config=config).migrate_all()

    assert (tmp_path / "Note1.md").read_text() == "![[Recording 1-transcribe.md]]"
    assert (tmp_path / "Note2.md").read_text() == "No link here."
    assert (tmp_path / "Sub" / "Note3.md").read_text() == "![[Recording 2-transcribe.md]]"
