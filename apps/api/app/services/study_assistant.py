from __future__ import annotations

import re
from collections import Counter
from dataclasses import dataclass


from app.services.gemini import generate_insights

STOPWORDS = {
    "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "has", "have", "he", "her",
    "his", "in", "is", "it", "its", "of", "on", "or", "our", "she", "that", "the", "their", "this",
    "to", "was", "were", "with", "you", "your", "we", "they", "them", "these", "those", "will", "can",
}


@dataclass(slots=True)
class StudyInsights:
    department_code: str
    summary: str
    questions: list[str]
    tips: list[str]


def infer_department_code(text: str, explicit_code: str | None = None) -> str:
    if explicit_code and explicit_code.strip():
        return explicit_code.strip().upper()

    lowered = text.lower()
    if any(keyword in lowered for keyword in ("physics", "quantum", "mechanics", "optics", "phy")):
        return "COLPHY"

    return "COLPHY"


def generate_study_insights(text: str, *, department_code: str | None = None) -> StudyInsights:
    cleaned_text = re.sub(r"\s+", " ", text).strip()
    inferred_department = infer_department_code(cleaned_text, department_code)

    ai_result = generate_insights(cleaned_text, inferred_department)
    if ai_result:
        return StudyInsights(
            department_code=inferred_department,
            summary=ai_result.get("summary", build_summary(cleaned_text)),
            questions=ai_result.get("questions", build_questions(cleaned_text)),
            tips=ai_result.get("tips", build_tips(cleaned_text)),
        )

    return StudyInsights(
        department_code=inferred_department,
        summary=build_summary(cleaned_text),
        questions=build_questions(cleaned_text),
        tips=build_tips(cleaned_text),
    )


# ── Heuristic fallbacks (used when no Gemini key is set) ──────────────────

def build_summary(text: str, max_sentences: int = 3) -> str:
    sentences = split_sentences(text)
    if not sentences:
        return "No readable text was extracted from the document."

    chosen = sentences[:max_sentences]
    if len(chosen) == 1 and len(chosen[0]) > 240:
        chosen = [chosen[0][:240].rstrip() + "..."]

    return " ".join(chosen)


def build_questions(text: str, count: int = 5) -> list[str]:
    sentences = split_sentences(text)
    terms = extract_focus_terms(text, limit=8)

    questions: list[str] = []
    if terms:
        for term in terms[:count]:
            questions.append(f"What is the key idea behind {term} in this material?")

    if len(questions) < count and sentences:
        for sentence in sentences:
            if len(questions) >= count:
                break
            questions.append(f"How would you explain: {trim_sentence(sentence)}?")

    while len(questions) < count:
        questions.append("What are the main takeaways from this PDF?")

    return questions[:count]


def build_tips(text: str) -> list[str]:
    tips = [
        "Read the summary first, then revisit the PDF with a goal question in mind.",
        "Turn each question into a short answer from memory before checking the document.",
        "Save the document in Private Vault so it remains available offline.",
    ]

    lowered = text.lower()
    if any(token in lowered for token in ("formula", "equation", "derive", "calculate")):
        tips.append("Rewrite formulas step by step and practice one worked example from memory.")

    if any(token in lowered for token in ("table", "chart", "graph", "diagram")):
        tips.append("Convert tables or diagrams into flashcards so the structure is easier to recall.")

    return tips


def extract_focus_terms(text: str, limit: int = 8) -> list[str]:
    words = re.findall(r"[A-Za-z][A-Za-z\-]{2,}", text.lower())
    counts = Counter(word for word in words if word not in STOPWORDS)
    return [word.replace("-", " ") for word, _ in counts.most_common(limit)]


def split_sentences(text: str) -> list[str]:
    return [sentence.strip() for sentence in re.split(r"(?<=[.!?])\s+", text) if sentence.strip()]


def trim_sentence(sentence: str, max_length: int = 140) -> str:
    normalized = sentence.strip()
    return normalized if len(normalized) <= max_length else normalized[:max_length].rstrip() + "..."
