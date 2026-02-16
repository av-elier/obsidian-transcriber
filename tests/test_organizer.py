import pytest
from pathlib import Path
from transcriber.organizer import FileOrganizer


def test_discover_m4a_files(tmp_path, config):
    (tmp_path / "recording1.m4a").write_text("audio")
    (tmp_path / "note.md").write_text("text")
    (tmp_path / "Subfolder").mkdir()
    (tmp_path / "Subfolder" / "recording2.m4a").write_text("audio")

    found = FileOrganizer(vault_root=tmp_path, config=config).discover_recordings()

    assert len(found) == 1
    assert found[0].name == "recording1.m4a"


@pytest.mark.parametrize("move_audio,original_exists", [(True, False), (False, True)])
def test_organize_move_vs_copy(tmp_path, config, move_audio, original_exists):
    (tmp_path / "recording.m4a").write_text("audio")
    config.move_audio = move_audio
    FileOrganizer(vault_root=tmp_path, config=config).organize()

    assert (tmp_path / "Recordings" / "recording.m4a").exists()
    assert (tmp_path / "recording.m4a").exists() == original_exists


def test_ensure_recordings_dir(tmp_path, config):
    FileOrganizer(vault_root=tmp_path, config=config).ensure_recordings_dir()
    assert (tmp_path / "Recordings").is_dir()
