import httpx
from abc import ABC, abstractmethod
from pathlib import Path

class TranscriptionProvider(ABC):
    """Abstract base class for transcription providers."""

    def __init__(self, api_key: str, **kwargs):
        self.api_key = api_key

    @abstractmethod
    def transcribe(self, audio_path: Path, model: str) -> str:
        """Transcribes the given audio file and returns the text."""
        pass

class MistralProvider(TranscriptionProvider):
    """Mistral AI transcription provider."""

    API_URL = "https://api.mistral.ai/v1/audio/transcriptions"

    def transcribe(self, audio_path: Path, model: str) -> str:
        with open(audio_path, "rb") as audio_file:
            files = {"file": (audio_path.name, audio_file, "audio/mpeg")}
            headers = {"x-api-key": self.api_key}

            with httpx.Client() as client:
                response = client.post(
                    self.API_URL,
                    headers=headers,
                    files=files,
                    data={"model": model}
                )
                try:
                    response.raise_for_status()
                except httpx.HTTPStatusError as e:
                    raise Exception(f"{e}. Response: {response.text}") from e

                return response.json()["text"]

class ProviderFactory:
    """Factory for creating transcription providers."""

    def __init__(self):
        self._providers: dict[str, type[TranscriptionProvider]] = {}

    def register(self, name: str, provider_cls: type[TranscriptionProvider]):
        self._providers[name] = provider_cls

    def get_provider(self, name: str, api_key: str, **kwargs) -> TranscriptionProvider:
        """Returns an instance of the named provider, or raises ValueError."""
        provider_cls = self._providers.get(name.lower())
        if not provider_cls:
            raise ValueError(f"Unknown provider: {name}")
        return provider_cls(api_key=api_key, **kwargs)

factory = ProviderFactory()
factory.register("mistral", MistralProvider)
