from __future__ import annotations

from contextlib import suppress
from pathlib import Path


def _preprocess_if_needed(image_path: str | Path) -> Path:
    """Run the shadow-destroyer on image inputs, returning the best path to OCR."""
    path = Path(image_path)
    from app.services.imaging import is_image, preprocess_handout

    if not is_image(path.suffix):
        return path
    processed = preprocess_handout(path)
    return processed


def extract_text_with_tesseract(image_path: str | Path, preprocess: bool = True) -> str:
    try:
        import pytesseract
        from PIL import Image
    except ImportError as exc:
        raise RuntimeError("pytesseract and Pillow are required for OCR extraction") from exc

    source = _preprocess_if_needed(image_path) if preprocess else Path(image_path)
    try:
        return pytesseract.image_to_string(Image.open(source))
    finally:
        if preprocess and source != Path(image_path):
            with suppress(FileNotFoundError):
                source.unlink()


def extract_text_with_easyocr(image_path: str | Path, languages: list[str] | None = None) -> str:
    try:
        import easyocr
    except ImportError as exc:
        raise RuntimeError("easyocr is required for OCR extraction") from exc

    reader = easyocr.Reader(languages or ["en"], gpu=False)
    result = reader.readtext(str(image_path), detail=0)
    return "\n".join(result)
