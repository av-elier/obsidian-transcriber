import pytest
import json
from pathlib import Path
from transcriber.main import VaultContext

def test_vault_context_loads_ignore_filters(tmp_path):
    # Setup mock vault
    vault_root = tmp_path / "vault"
    vault_root.mkdir()
    obsidian_dir = vault_root / ".obsidian"
    obsidian_dir.mkdir()
    app_json = obsidian_dir / "app.json"

    config = {
        "userIgnoreFilters": ["conductor/"]
    }
    app_json.write_text(json.dumps(config), encoding="utf-8")

    context = VaultContext(vault_root)
    assert context.ignore_filters == ["conductor/"]

def test_vault_context_should_ignore(tmp_path):
    vault_root = tmp_path / "vault"
    vault_root.mkdir()
    obsidian_dir = vault_root / ".obsidian"
    obsidian_dir.mkdir()
    app_json = obsidian_dir / "app.json"

    config = {
        "userIgnoreFilters": ["conductor/"]
    }
    app_json.write_text(json.dumps(config), encoding="utf-8")

    context = VaultContext(vault_root)

    # Should ignore dot directories
    assert context.should_ignore(vault_root / ".obsidian" / "app.json") is True

    # Should ignore conductor/
    assert context.should_ignore(vault_root / "conductor" / "product.md") is True

    # Should NOT ignore valid files
    assert context.should_ignore(vault_root / "Daily Notes" / "2026-02-15.md") is False
    assert context.should_ignore(vault_root / "Recording.m4a") is False
