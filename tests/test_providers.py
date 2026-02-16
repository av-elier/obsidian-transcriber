import pytest
from pathlib import Path
from transcriber.providers import TranscriptionProvider, ProviderFactory


class MockProvider(TranscriptionProvider):
    def __init__(self, api_key: str, **kwargs):
        super().__init__(api_key, **kwargs)

    def transcribe(self, audio_path: Path, model: str) -> str:
        return f"Transcribed {audio_path.name} with {model}"


def test_provider_factory_registration():
    factory = ProviderFactory()
    factory.register("mock", MockProvider)

    provider = factory.get_provider("mock", "fake-api-key")
    assert isinstance(provider, MockProvider)


def test_provider_factory_unknown():
    factory = ProviderFactory()
    with pytest.raises(ValueError, match="Unknown provider: unknown"):
        factory.get_provider("unknown", "key")
