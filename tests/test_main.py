import pytest
from unittest.mock import MagicMock, patch
from pathlib import Path
from transcriber.main import run_pipeline, log_error
from transcriber.config import Config


@patch("transcriber.main.LinkMigrator")
@patch("transcriber.main.factory")
@patch("transcriber.main.FileOrganizer")
def test_run_pipeline_orchestration(mock_organizer, mock_factory, mock_linker, tmp_path):
    config = Config(vault_root=tmp_path, api_key="test_key")
    mock_trans = MagicMock()
    mock_factory.get_provider.return_value = mock_trans
    mock_trans.transcribe.return_value = "Transcribed text"

    rec_dir = tmp_path / "Recordings"
    rec_dir.mkdir()
    (rec_dir / "test.m4a").write_text("audio")

    run_pipeline(config)

    mock_organizer.return_value.organize.assert_called_once()
    mock_factory.get_provider.assert_called_once_with("mistral", "test_key", timeout=300.0)
    mock_trans.transcribe.assert_called_once()
    mock_linker.return_value.migrate_all.assert_called_once()


@patch("transcriber.main.LinkMigrator")
@patch("transcriber.main.factory")
@patch("transcriber.main.FileOrganizer")
def test_run_pipeline_skips_existing(mock_organizer, mock_factory, mock_linker, tmp_path):
    config = Config(vault_root=tmp_path, api_key="test_key")
    mock_trans = MagicMock()
    mock_factory.get_provider.return_value = mock_trans

    rec_dir = tmp_path / "Recordings"
    rec_dir.mkdir()
    (rec_dir / "already_done.m4a").write_text("audio")
    (rec_dir / "already_done-transcribe.md").write_text("transcription")

    run_pipeline(config)

    mock_trans.transcribe.assert_not_called()


@patch("transcriber.main.datetime")
def test_log_error(mock_datetime, tmp_path):
    mock_datetime.now.return_value.strftime.return_value = "2026-02-15 20:00:00"
    config = Config(vault_root=tmp_path)

    log_error(config, "Test error message")

    error_file = tmp_path / "Transcription Errors.md"
    assert error_file.exists()
    assert "## 2026-02-15 20:00:00\nTest error message\n\n" in error_file.read_text()
