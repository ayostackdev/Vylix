from __future__ import annotations

import json
from typing import Any
from urllib.error import URLError
from urllib.request import Request, urlopen

from app.core.config import get_settings

API_BASE = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash"


def _call(prompt: str, system_instruction: str | None = None) -> str | None:
    settings = get_settings()
    if not settings.gemini_api_key:
        return None

    url = f"{API_BASE}:generateContent?key={settings.gemini_api_key}"

    body: dict[str, Any] = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.3,
            "maxOutputTokens": 2048,
        },
    }
    if system_instruction:
        body["systemInstruction"] = {"parts": [{"text": system_instruction}]}

    data = json.dumps(body).encode()
    req = Request(url, data=data, headers={"Content-Type": "application/json"})

    try:
        with urlopen(req, timeout=30) as resp:
            result = json.loads(resp.read())
            return result.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text")
    except (URLError, json.JSONDecodeError, KeyError, IndexError):
        return None


def generate_insights(text: str, department_code: str) -> dict[str, Any] | None:
    system = (
        "You are a study assistant for university students. "
        "Analyze the given academic material and return JSON with exactly three keys:\n"
        '- "summary": a 2-3 sentence summary of the key content\n'
        '- "questions": an array of 3-5 meaningful study questions based on the material\n'
        '- "tips": an array of 2-3 practical study tips specific to this material\n'
        "Respond with ONLY the JSON object, no markdown, no code fences."
    )
    prompt = (
        f"Department: {department_code}\n\n"
        f"Material content:\n{text[:6000]}\n\n"
        "Generate summary, questions, and tips as JSON."
    )

    result = _call(prompt, system_instruction=system)
    if not result:
        return None

    cleaned = result.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("\n", 1)[-1].rsplit("\n", 1)[0]
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3]
    cleaned = cleaned.strip()

    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        return None


def chat(query: str, context: str) -> str | None:
    system = (
        "You are a study assistant helping a university student understand their course material. "
        "Answer the student's question based ONLY on the provided document context. "
        "If the context doesn't contain enough information, say so clearly. "
        "Be concise and educational."
    )
    prompt = (
        f"Document context:\n{context[:5000]}\n\n"
        f"Student question: {query}\n\n"
        "Answer:"
    )
    return _call(prompt, system_instruction=system)
