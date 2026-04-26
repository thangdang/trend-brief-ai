"""Multi-model LLM provider chain with health tracking and auto-fallback.

Fallback order: Ollama (local) → Groq (free tier) → Gemini (free tier)
Each provider implements the same interface for summarization.
"""

import asyncio
import json
import logging
import os
import random
import time
from dataclasses import dataclass, field
from typing import Optional

import ollama
import requests

from config import settings

logger = logging.getLogger(__name__)

# Load fallback reasons
_FALLBACK_REASONS = []
try:
    import pathlib
    _reasons_path = pathlib.Path(__file__).parent / "data" / "fallback_reasons.json"
    if _reasons_path.exists():
        _FALLBACK_REASONS = json.loads(_reasons_path.read_text(encoding="utf-8"))
except Exception:
    pass


def _random_fallback_reason() -> str:
    if _FALLBACK_REASONS:
        return random.choice(_FALLBACK_REASONS)
    return "Đây là tin tức đáng chú ý mà bạn nên biết."


# ═══════════════════════════════════════
#  Provider Health Tracking
# ═══════════════════════════════════════

@dataclass
class ProviderHealth:
    """Track success/failure rate for a provider over a rolling window."""
    name: str
    successes: int = 0
    failures: int = 0
    last_success: float = 0.0
    last_failure: float = 0.0
    last_error: str = ""
    _window_start: float = field(default_factory=time.time)
    _window_seconds: float = 600  # 10 min window

    def record_success(self):
        self._maybe_reset()
        self.successes += 1
        self.last_success = time.time()

    def record_failure(self, error: str = ""):
        self._maybe_reset()
        self.failures += 1
        self.last_failure = time.time()
        self.last_error = error

    def is_healthy(self) -> bool:
        self._maybe_reset()
        total = self.successes + self.failures
        if total < 3:
            return True  # not enough data
        return (self.successes / total) >= 0.5

    @property
    def success_rate(self) -> float:
        total = self.successes + self.failures
        return self.successes / total if total > 0 else 1.0

    def _maybe_reset(self):
        if time.time() - self._window_start > self._window_seconds:
            self.successes = 0
            self.failures = 0
            self._window_start = time.time()

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "success_rate": round(self.success_rate, 3),
            "successes": self.successes,
            "failures": self.failures,
            "healthy": self.is_healthy(),
            "last_error": self.last_error,
        }


# ═══════════════════════════════════════
#  Base Provider
# ═══════════════════════════════════════

class LLMProvider:
    name: str = "base"

    async def summarize(self, text: str, prompt: str) -> Optional[str]:
        """Send prompt to LLM, return raw text response or None on failure."""
        raise NotImplementedError

    def is_configured(self) -> bool:
        return True


# ═══════════════════════════════════════
#  Ollama Provider (local, free)
# ═══════════════════════════════════════

class OllamaProvider(LLMProvider):
    name = "ollama"

    def __init__(self):
        self.model = settings.summarizer_model
        self.url = settings.ollama_url

    async def summarize(self, text: str, prompt: str) -> Optional[str]:
        try:
            response = await asyncio.to_thread(
                ollama.chat,
                model=self.model,
                messages=[
                    {"role": "system", "content": "Bạn là trợ lý tóm tắt tin tức cho giới trẻ Việt Nam. Trả lời bằng tiếng Việt, tone trẻ, dễ hiểu."},
                    {"role": "user", "content": prompt},
                ],
                options={"num_predict": 512},
            )
            return response["message"]["content"]
        except Exception as e:
            logger.warning(f"Ollama failed: {e}")
            return None

    def is_configured(self) -> bool:
        return bool(self.url)


# ═══════════════════════════════════════
#  Rate Limit Tracker
# ═══════════════════════════════════════

class RateLimitTracker:
    """Track API call count per rolling window. Warn at 80% capacity."""

    def __init__(self, name: str, max_rpm: int, window_seconds: int = 60):
        self.name = name
        self.max_rpm = max_rpm
        self.window_seconds = window_seconds
        self._calls: list[float] = []

    def record_call(self):
        now = time.time()
        self._calls = [t for t in self._calls if now - t < self.window_seconds]
        self._calls.append(now)
        usage_pct = len(self._calls) / self.max_rpm
        if usage_pct >= 0.8:
            logger.warning(
                f"[RateLimit] {self.name}: {len(self._calls)}/{self.max_rpm} RPM "
                f"({usage_pct:.0%}) — approaching limit!"
            )

    @property
    def current_usage(self) -> int:
        now = time.time()
        self._calls = [t for t in self._calls if now - t < self.window_seconds]
        return len(self._calls)

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "current_rpm": self.current_usage,
            "max_rpm": self.max_rpm,
            "usage_pct": round(self.current_usage / self.max_rpm, 3) if self.max_rpm else 0,
        }


# ═══════════════════════════════════════
#  Groq Provider (free tier, 30 RPM)
# ═══════════════════════════════════════

class GroqProvider(LLMProvider):
    name = "groq"

    def __init__(self):
        self.api_key = os.environ.get("GROQ_API_KEY", "")
        self.model = "llama-3.1-70b-versatile"
        self.rate_tracker = RateLimitTracker("groq", max_rpm=30)

    async def summarize(self, text: str, prompt: str) -> Optional[str]:
        if not self.api_key:
            return None
        self.rate_tracker.record_call()
        try:
            response = await asyncio.to_thread(
                requests.post,
                "https://api.groq.com/openai/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": self.model,
                    "messages": [
                        {"role": "system", "content": "Bạn là trợ lý tóm tắt tin tức cho giới trẻ Việt Nam. Trả lời bằng tiếng Việt."},
                        {"role": "user", "content": prompt},
                    ],
                    "max_tokens": 512,
                },
                timeout=30,
            )
            if response.status_code == 200:
                return response.json()["choices"][0]["message"]["content"]
            logger.warning(f"Groq returned {response.status_code}: {response.text[:200]}")
            return None
        except Exception as e:
            logger.warning(f"Groq failed: {e}")
            return None

    def is_configured(self) -> bool:
        return bool(self.api_key)


# ═══════════════════════════════════════
#  Gemini Provider (free tier, 15 RPM)
# ═══════════════════════════════════════

class GeminiProvider(LLMProvider):
    name = "gemini"

    def __init__(self):
        self.api_key = os.environ.get("GEMINI_API_KEY", "")
        self.rate_tracker = RateLimitTracker("gemini", max_rpm=15)

    async def summarize(self, text: str, prompt: str) -> Optional[str]:
        if not self.api_key:
            return None
        self.rate_tracker.record_call()
        try:
            response = await asyncio.to_thread(
                requests.post,
                f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent",
                params={"key": self.api_key},
                json={
                    "contents": [{"parts": [{"text": prompt}]}],
                    "generationConfig": {"maxOutputTokens": 512},
                },
                timeout=30,
            )
            if response.status_code == 200:
                return response.json()["candidates"][0]["content"]["parts"][0]["text"]
            logger.warning(f"Gemini returned {response.status_code}")
            return None
        except Exception as e:
            logger.warning(f"Gemini failed: {e}")
            return None

    def is_configured(self) -> bool:
        return bool(self.api_key)


# ═══════════════════════════════════════
#  Provider Chain
# ═══════════════════════════════════════

class ProviderChain:
    """Ordered fallback chain of LLM providers with health tracking."""

    def __init__(self):
        self.providers = [OllamaProvider(), GroqProvider(), GeminiProvider()]
        self.health: dict[str, ProviderHealth] = {
            p.name: ProviderHealth(name=p.name) for p in self.providers
        }

    async def summarize(self, text: str, prompt: str) -> tuple[Optional[str], str]:
        """
        Try each provider in order. Returns (raw_response, provider_name).
        Returns (None, "fallback") if all providers fail.
        """
        for provider in self.providers:
            if not provider.is_configured():
                continue
            if not self.health[provider.name].is_healthy():
                logger.info(f"Skipping unhealthy provider: {provider.name}")
                continue

            result = await provider.summarize(text, prompt)
            if result is not None:
                self.health[provider.name].record_success()
                return result, provider.name
            else:
                self.health[provider.name].record_failure()

        return None, "fallback"

    def get_health_status(self) -> list[dict]:
        status = []
        for h in self.health.values():
            info = h.to_dict()
            # Add rate limit info for cloud providers
            provider = next((p for p in self.providers if p.name == h.name), None)
            if provider and hasattr(provider, 'rate_tracker'):
                info["rate_limit"] = provider.rate_tracker.to_dict()
            status.append(info)
        return status


# Singleton
provider_chain = ProviderChain()
