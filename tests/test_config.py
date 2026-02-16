import os
import pytest
from pathlib import Path
from transcriber.config import Config


@pytest.fixture(autouse=True)
def clean_env():
    """Ensure environment is clean before each test."""
    to_remove = [k for k in os.environ if k.startswith("TRANSCRIBER_")]
    for k in to_remove:
        del os.environ[k]
    yield


def test_config_defaults():
    config = Config(vault_root=Path("/vault"))
    assert config.vault_root == Path("/vault")
    assert config.audio_dir == Path("Recordings")
    assert config.transcription_dir == Path("Recordings")
    assert config.move_audio is False
    assert config.transcription_template == "{original_name}-transcribe"
    assert config.migrate_links is True
    assert config.ai_provider == "mistral"
    assert config.ai_model == "voxtral-mini-latest"


def test_config_from_env(monkeypatch):
    monkeypatch.setenv("TRANSCRIBER_VAULT_ROOT", "/env/vault")
    monkeypatch.setenv("TRANSCRIBER_AUDIO_DIR", "MyAudio")
    monkeypatch.setenv("TRANSCRIBER_MOVE_AUDIO", "true")
    monkeypatch.setenv("TRANSCRIBER_AI_PROVIDER", "openai")

    config = Config.from_env()

    assert config.vault_root == Path("/env/vault").resolve()
    assert config.audio_dir == Path("MyAudio")
    assert config.move_audio is True
    assert config.ai_provider == "openai"


def test_config_from_toml(tmp_path):
    toml_content = """\
vault_root = "/toml/vault"
audio_dir = "TomlAudio"
move_audio = true
ai_provider = "anthropic"
"""
    config_file = tmp_path / "transcriber.toml"
    config_file.write_text(toml_content)

    config = Config.load(config_path=config_file)

    assert config.vault_root == Path("/toml/vault").resolve()
    assert config.audio_dir == Path("TomlAudio")
    assert config.move_audio is True
    assert config.ai_provider == "anthropic"


def test_config_load_priority(monkeypatch, tmp_path):
    monkeypatch.setenv("TRANSCRIBER_AI_PROVIDER", "env_provider")
    config_file = tmp_path / "transcriber.toml"
    config_file.write_text('ai_provider = "toml_provider"\n')

    config = Config.load(config_path=config_file)
    assert config.ai_provider == "env_provider"

@pytest.mark.parametrize("template,audio,expected", [
    ("{original_name}-transcribe", "Recording.m4a", "Recording-transcribe.md"),
    ("{original_name}_v1", "Meeting.mp3", "Meeting_v1.md"),
    ("Transcribe of {original_name} (Auto)", "Voice Note.m4a", "Transcribe of Voice Note (Auto).md"),
])
def test_transcription_filename(template, audio, expected):
    config = Config(vault_root=Path("/vault"), transcription_template=template)
    assert config.get_transcription_filename(audio) == expected


def test_absolute_paths_stay_outside_vault(tmp_path):
    vault = tmp_path / "vault"
    vault.mkdir()
    audio = tmp_path / "external_audio"
    audio.mkdir()
    trans = tmp_path / "external_trans"
    trans.mkdir()

    config = Config(vault_root=vault, audio_dir=audio, transcription_dir=trans)

    assert config.get_audio_path() == audio
    assert config.get_transcription_path() == trans
    assert not audio.is_relative_to(vault)
    assert not trans.is_relative_to(vault)


def test_relative_paths_resolve_under_vault(tmp_path):
    vault = tmp_path / "vault"
    vault.mkdir()
    config = Config(vault_root=vault, audio_dir=Path("Inside/Audio"), transcription_dir=Path("Inside/Trans"))

    assert config.get_audio_path() == vault / "Inside" / "Audio"
    assert config.get_transcription_path() == vault / "Inside" / "Trans"
