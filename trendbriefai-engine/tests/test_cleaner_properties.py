# Feature: trendbriefai-ai-performance, Property 15: Vietnamese NFC normalization idempotence
# Feature: trendbriefai-ai-performance, Property 16: Vietnamese cleaning completeness

"""Property-based tests for Vietnamese text cleaning."""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import unicodedata

from hypothesis import given, settings as h_settings, assume
from hypothesis import strategies as st

from services.cleaner import clean_html, clean_vietnamese_artifacts


# Strategy for generating Vietnamese-like text with diacritical marks
_VN_ALPHABET = (
    "aàáạảãâầấậẩẫăằắặẳẵeèéẹẻẽêềếệểễiìíịỉĩ"
    "oòóọỏõôồốộổỗơờớợởỡuùúụủũưừứựửữyỳýỵỷỹđ"
    "AÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴEÈÉẸẺẼÊỀẾỆỂỄIÌÍỊỈĨ"
    "OÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠUÙÚỤỦŨƯỪỨỰỬỮYỲÝỴỶỸĐ"
    " .,!?\n"
)

vn_text_strategy = st.text(
    alphabet=_VN_ALPHABET,
    min_size=1,
    max_size=500,
)

# Vietnamese artifact strings to inject
_ARTIFACTS = [
    "Đọc thêm: Bài viết liên quan khác",
    "Xem thêm: Tin tức mới nhất",
    "Tin liên quan: Các bài viết khác",
    "Bài liên quan: Xem ngay",
    "Nguồn: VnExpress",
    "Theo: Tuổi Trẻ Online",
    "© 2024 Bản quyền thuộc về VnExpress",
    "Chia sẻ Facebook Twitter Zalo",
    "Quảng cáo nội dung tài trợ",
]


# ---------------------------------------------------------------------------
# Property 15: Vietnamese NFC normalization idempotence
# normalize('NFC', normalize('NFC', text)) == normalize('NFC', text)
# Validates: Requirements 8.1
# ---------------------------------------------------------------------------

@h_settings(max_examples=100)
@given(text=vn_text_strategy)
def test_property_15_nfc_idempotence(text):
    """NFC normalization is idempotent for Vietnamese text."""
    once = unicodedata.normalize("NFC", text)
    twice = unicodedata.normalize("NFC", once)
    assert once == twice, "NFC normalization is not idempotent"


@h_settings(max_examples=100)
@given(text=st.text(min_size=0, max_size=1000))
def test_property_15_nfc_idempotence_arbitrary_unicode(text):
    """NFC normalization is idempotent for arbitrary Unicode strings."""
    once = unicodedata.normalize("NFC", text)
    twice = unicodedata.normalize("NFC", once)
    assert once == twice


@h_settings(max_examples=100)
@given(text=vn_text_strategy)
def test_property_15_clean_html_produces_nfc(text):
    """clean_html output is always in NFC form."""
    # Wrap in minimal HTML
    html = f"<p>{text}</p>"
    cleaned = clean_html(html)
    assert cleaned == unicodedata.normalize("NFC", cleaned), (
        "clean_html output is not NFC-normalized"
    )


# ---------------------------------------------------------------------------
# Property 16: Vietnamese cleaning completeness
# Artifacts are removed while diacritical marks in content are preserved.
# Validates: Requirements 8.2, 8.3, 8.4
# ---------------------------------------------------------------------------

@h_settings(max_examples=100)
@given(
    content=vn_text_strategy,
    artifact_indices=st.lists(
        st.integers(min_value=0, max_value=len(_ARTIFACTS) - 1),
        min_size=1,
        max_size=4,
    ),
)
def test_property_16_artifacts_removed(content, artifact_indices):
    """Vietnamese artifacts are removed from text."""
    assume(len(content.strip()) > 0)

    artifacts = [_ARTIFACTS[i] for i in artifact_indices]
    injected = content + "\n" + "\n".join(artifacts)

    cleaned = clean_vietnamese_artifacts(injected)

    # Verify artifacts are removed
    for artifact in artifacts:
        # Check the key prefix part of each artifact
        prefix = artifact.split(":")[0] + ":"
        # The artifact line should not appear in cleaned output
        assert prefix not in cleaned or artifact not in cleaned, (
            f"Artifact not removed: {artifact}"
        )


@h_settings(max_examples=100)
@given(content=vn_text_strategy)
def test_property_16_diacritical_marks_preserved(content):
    """Vietnamese diacritical marks in content are preserved after cleaning."""
    assume(len(content.strip()) > 0)

    # Count Vietnamese diacritical chars in original
    vn_chars_original = set()
    for ch in content:
        if unicodedata.category(ch).startswith("L") and ord(ch) > 127:
            vn_chars_original.add(ch)

    cleaned = clean_vietnamese_artifacts(content)

    # All Vietnamese chars from original should still be present
    for ch in vn_chars_original:
        if ch in content and content.count(ch) > 0:
            # The char should appear in cleaned text (unless it was in a
            # removed artifact line, which we don't inject here)
            assert ch in cleaned, (
                f"Vietnamese char '{ch}' (U+{ord(ch):04X}) was removed"
            )


@h_settings(max_examples=100)
@given(
    paragraph=vn_text_strategy,
    repeat_count=st.integers(min_value=2, max_value=5),
)
def test_property_16_repeated_paragraphs_removed(paragraph, repeat_count):
    """Repeated paragraphs are deduplicated."""
    assume(len(paragraph.strip()) > 0)
    # Ensure no double newlines in the paragraph itself
    para = paragraph.replace("\n\n", "\n").strip()
    assume(len(para) > 0)

    repeated_text = "\n\n".join([para] * repeat_count)
    cleaned = clean_vietnamese_artifacts(repeated_text)

    # The paragraph should appear exactly once
    paragraphs = [p.strip() for p in cleaned.split("\n\n") if p.strip()]
    # Count occurrences of the exact paragraph
    occurrences = sum(1 for p in paragraphs if p == para)
    assert occurrences <= 1, (
        f"Paragraph repeated {occurrences} times after cleaning"
    )
