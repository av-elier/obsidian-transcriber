import os
import sys
import pytest
from pathlib import Path
from unittest.mock import patch, MagicMock
from transcriber.main import main
from transcriber.config import Config


def test_cli_help(capsys):
    with patch.object(sys, "argv", ["transcriber", "--help"]):
        with pytest.raises(SystemExit) as e:
            main()
        assert e.value.code == 0

    captured = capsys.readouterr()
    assert "usage:" in captured.out.lower()
    assert "--config" in captured.out


@patch("transcriber.main.run_pipeline")
def test_cli_config_pass_through(mock_run_pipeline):
    with patch("transcriber.config.Config.load") as mock_load:
        mock_config = MagicMock(spec=Config)
        mock_config.vault_root = Path("/test/vault").resolve()
        mock_config.ai_provider = "test_ai"
        mock_load.return_value = mock_config

        with patch.object(sys, "argv", ["transcriber", "--vault-root", "/test/vault", "--ai-provider", "test_ai"]):
            with patch("os.environ", os.environ.copy()):
                main()

    mock_run_pipeline.assert_called_once_with(mock_config)
