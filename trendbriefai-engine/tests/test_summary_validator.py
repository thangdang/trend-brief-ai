"""Tests for summary quality validator."""
import pytest
from services.summary_validator import SummaryValidator


class TestSummaryValidator:
    def setup_method(self):
        self.validator = SummaryValidator()

    def test_perfect_summary(self):
        summary = {
            "title_ai": "AI thay đổi cách làm việc",
            "summary_bullets": [
                "Công nghệ AI đang được áp dụng rộng rãi trong nhiều ngành nghề",
                "Các công ty lớn đầu tư hàng tỷ đô vào nghiên cứu AI mới",
                "Người lao động cần học thêm kỹ năng để thích nghi với thay đổi",
            ],
            "reason": "AI đang thay đổi thị trường lao động và bạn cần chuẩn bị từ bây giờ.",
        }
        result = self.validator.validate(summary, "original text about AI")
        assert result["valid"] is True
        assert result["overall"] >= 0.8

    def test_empty_title(self):
        summary = {"title_ai": "", "summary_bullets": ["a", "b", "c"], "reason": "test reason here"}
        result = self.validator.validate(summary)
        assert result["scores"]["title_length"] == 0.0
        assert "Title is empty" in result["issues"]

    def test_too_long_title(self):
        summary = {
            "title_ai": "Đây là một tiêu đề rất dài có hơn mười lăm từ và không nên được chấp nhận trong hệ thống",
            "summary_bullets": ["a b c d e f g h i j", "b c d e f g h i j k", "c d e f g h i j k l"],
            "reason": "Lý do quan trọng cần biết ngay bây giờ.",
        }
        result = self.validator.validate(summary)
        assert result["scores"]["title_length"] == 0.5

    def test_wrong_bullet_count(self):
        summary = {"title_ai": "Test title here", "summary_bullets": ["one", "two"], "reason": "reason text"}
        result = self.validator.validate(summary)
        assert result["scores"]["bullet_count"] == 0.5

    def test_generic_reason_detected(self):
        summary = {
            "title_ai": "Test title",
            "summary_bullets": ["a b c d e f g h i j", "b c d e f g h i j k", "c d e f g h i j k l"],
            "reason": "Đây là tin tức đáng chú ý mà bạn nên biết.",
        }
        result = self.validator.validate(summary)
        assert result["scores"]["reason_quality"] == 0.0
        assert any("generic" in i.lower() for i in result["issues"])

    def test_hallucinated_url(self):
        summary = {
            "title_ai": "Test title",
            "summary_bullets": ["Check https://fake-url.com for details", "bullet two text here", "bullet three text here"],
            "reason": "Important reason to know about this topic.",
        }
        result = self.validator.validate(summary, "Original text without any URLs")
        assert result["scores"]["no_hallucination"] == 0.0

    def test_no_hallucination_when_url_in_original(self):
        summary = {
            "title_ai": "Test title",
            "summary_bullets": ["Visit https://example.com for more", "bullet two text here", "bullet three text here"],
            "reason": "Important reason to know about this.",
        }
        result = self.validator.validate(summary, "Read more at https://example.com")
        assert result["scores"]["no_hallucination"] == 1.0

    def test_overall_score_range(self):
        summary = {"title_ai": "T", "summary_bullets": [], "reason": ""}
        result = self.validator.validate(summary)
        assert 0.0 <= result["overall"] <= 1.0


class TestFallbackReasons:
    def test_fallback_reasons_loaded(self):
        from services.llm_providers import _FALLBACK_REASONS
        assert len(_FALLBACK_REASONS) >= 20

    def test_fallback_reasons_varied(self):
        from services.llm_providers import _random_fallback_reason
        reasons = {_random_fallback_reason() for _ in range(50)}
        assert len(reasons) >= 5  # should get variety


class TestProviderChain:
    def test_provider_health_initial(self):
        from services.llm_providers import ProviderHealth
        h = ProviderHealth(name="test")
        assert h.is_healthy() is True
        assert h.success_rate == 1.0

    def test_provider_health_degraded(self):
        from services.llm_providers import ProviderHealth
        h = ProviderHealth(name="test")
        for _ in range(10):
            h.record_failure("error")
        assert h.is_healthy() is False
        assert h.success_rate == 0.0

    def test_provider_health_recovery(self):
        from services.llm_providers import ProviderHealth
        h = ProviderHealth(name="test")
        h.record_failure("err")
        h.record_failure("err")
        h.record_success()
        h.record_success()
        h.record_success()
        assert h.is_healthy() is True

    def test_provider_chain_has_3_providers(self):
        from services.llm_providers import provider_chain
        assert len(provider_chain.providers) == 3
        names = [p.name for p in provider_chain.providers]
        assert names == ["ollama", "groq", "gemini"]

    def test_provider_chain_health_status(self):
        from services.llm_providers import provider_chain
        status = provider_chain.get_health_status()
        assert len(status) == 3
        assert all("name" in s and "healthy" in s for s in status)


class TestClassifierMetrics:
    def test_metrics_tracking(self):
        from services.classifier import get_classifier_metrics
        metrics = get_classifier_metrics()
        assert "total" in metrics
        assert "keyword_hits" in metrics
        assert "keyword_hit_rate" in metrics


class TestPromptTemplates:
    def test_templates_loaded(self):
        import json, pathlib
        path = pathlib.Path("services/data/prompt_templates.json")
        assert path.exists()
        templates = json.loads(path.read_text())
        assert "ai" in templates
        assert "finance" in templates
        assert "drama" in templates
        assert "default" in templates

    def test_templates_have_placeholder(self):
        import json, pathlib
        templates = json.loads(pathlib.Path("services/data/prompt_templates.json").read_text())
        for key, template in templates.items():
            if key.startswith("_"):
                continue
            assert "{text}" in template, f"Template '{key}' missing {{text}} placeholder"
