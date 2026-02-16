import pytest
from pathlib import Path
from transcriber.config import Config


@pytest.fixture
def config(tmp_path):
    return Config(vault_root=tmp_path)
