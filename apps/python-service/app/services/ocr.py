from __future__ import annotations

from pathlib import Path


def extract_text_with_tesseract(image_path: str | Path) -> str:
    try:
        import pytesseract
        from PIL import Image
    except ImportError as exc:
        raise RuntimeError("pytesseract and Pillow are required for OCR extraction") from exc

    return pytesseract.image_to_string(Image.open(image_path))


def extract_text_with_easyocr(image_path: str | Path, languages: list[str] | None = None) -> str:
    try:
        import easyocr
    except ImportError as exc:
        raise RuntimeError("easyocr is required for OCR extraction") from exc

    reader = easyocr.Reader(languages or ["en"], gpu=False)
    result = reader.readtext(str(image_path), detail=0)
    return "\n".join(result)
