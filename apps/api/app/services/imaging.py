"""Handout "Shadow Destroyer": illumination normalization for snapped photos.

Phone photos of printed campus handouts are lit unevenly and carry shadows that
break OCR. This module flattens the lighting, removes shadows, and produces a
crisp binary (black text on white) image before any OCR engine runs.

Pipeline:

1. Read the image (EXIF-rotated), convert to grayscale.
2. Estimate the uneven background: morphological dilation followed by a large
   median blur.
3. Normalize illumination by dividing the raw image by its background estimate
   (a ratio form of "subtract the background mask, then normalize").
4. Apply Otsu's adaptive threshold to yield a clean binary bitmap.

The whole module degrades gracefully: if ``opencv-python-headless`` is not
installed or the image cannot be read, ``preprocess_handout`` returns the
original path unchanged and the OCR stack proceeds as before.
"""

from __future__ import annotations

import logging
import uuid
from pathlib import Path

from app.core.config import get_settings

logger = logging.getLogger(__name__)

# Register the HEIF decoder with Pillow once so iPhone snaps (HEIC) open via
# Image.open in _read_image / convert_heic_to_png. Degrades gracefully when the
# optional pillow-heif package is absent.
try:
    from pillow_heif import register_heif_opener

    register_heif_opener()
except ImportError:
    pass

_IMAGE_SUFFIXES = {".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tif", ".tiff", ".heic"}
_HEIC_SUFFIXES = {".heic"}

settings = get_settings()


def is_image(suffix: str) -> bool:
    return suffix.lower() in _IMAGE_SUFFIXES


def _read_image(path: Path):
    """Return a BGR ``numpy`` image, applying EXIF orientation. ``None`` when unreadable."""
    import numpy as np
    from PIL import Image, ImageOps

    image = None
    try:
        with Image.open(path) as pil_image:
            oriented = ImageOps.exif_transpose(pil_image)
            image = np.asarray(oriented.convert("RGB"))[:, :, ::-1]
    except Exception as exc:
        logger.warning("Pillow could not read %s (%s); trying OpenCV directly.", path, exc)

    if image is None:
        import cv2

        image = cv2.imread(str(path), cv2.IMREAD_COLOR)

    if image is None:
        logger.warning("Unreadable image for preprocessing: %s", path)
    return image


def _destroy_shadows(image):
    """Binaries ``image`` after flattening its illumination. Returns uint8 0/255."""
    import cv2
    import numpy as np

    kernel_size = max(15, int(min(image.shape[:2]) * 0.03))
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (kernel_size, kernel_size))

    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY) if image.ndim == 3 else image
    blurred = cv2.medianBlur(gray, 3)
    background = cv2.morphologyEx(blurred, cv2.MORPH_DILATE, kernel)
    background = cv2.medianBlur(background, 51)

    normalized = cv2.divide(blurred, background, scale=255)

    _, binary = cv2.threshold(normalized, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

    binary = cv2.morphologyEx(binary, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3)))
    binary = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3)))

    if np.count_nonzero(binary) < 0.30 * binary.size:
        logger.warning(
            "Shadow-destroyer output is >70%% background; keeping Otsu result anyway."
        )
    return binary


def _resize_if_needed(image, max_dimension: int = 2800, min_dimension: int = 1100):
    """Downscale giant phone photos and upscale tiny images so OCR sees a sane DPI."""
    import cv2

    height, width = image.shape[:2]
    if max(height, width) > max_dimension:
        scale = max_dimension / max(height, width)
        return cv2.resize(image, (int(width * scale), int(height * scale)), interpolation=cv2.INTER_AREA)
    if min(height, width) < min_dimension and max(height, width) < max_dimension:
        scale = min_dimension / min(height, width)
        scale = min(scale, 2.0)
        return cv2.resize(image, (int(width * scale), int(height * scale)), interpolation=cv2.INTER_CUBIC)
    return image


def preprocess_handout(source_path: str | Path, output_path: str | Path | None = None) -> Path:
    """Return the path to a binarized, shadow-free version of ``source_path``.

    Falls back to the original path when OpenCV is unavailable or the image
    cannot be read, so callers can always chain OCR without breaking.
    """
    path = Path(source_path)
    if not is_image(path.suffix):
        return path

    try:
        import cv2  # noqa: F401
    except ImportError:
        logger.warning("OpenCV is not installed; skipping handout preprocessing for %s.", path)
        return path

    try:
        return _preprocess_inner(path, output_path)
    except Exception:
        logger.exception("Handout preprocessing failed for %s; returning original.", path)
        return path


def _preprocess_inner(source_path: Path, output_path: str | Path | None) -> Path:
    """Shared body of ``preprocess_handout``; callers wrap this to degrade gracefully."""
    import cv2

    path = source_path
    image = _read_image(path)
    if image is None:
        return path

    image = _resize_if_needed(image)
    binary = _destroy_shadows(image)

    if output_path is None:
        output_dir = settings.temp_dir / "preprocess"
        output_dir.mkdir(parents=True, exist_ok=True)
        output_path = output_dir / f"{path.stem}_binarized_{uuid.uuid4().hex[:8]}.png"
    else:
        output_path = Path(output_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)

    cv2.imwrite(str(output_path), binary)
    logger.info("Preprocessed %s -> %s", path, output_path)
    return output_path


def convert_heic_to_png(source_path: str | Path) -> Path | None:
    """Convert an iPhone HEIC to PNG (returns ``None`` when unsupported or unreadable)."""
    path = Path(source_path)
    if path.suffix.lower() not in _HEIC_SUFFIXES:
        return None
    try:
        import numpy as np
        from PIL import Image, ImageOps
    except ImportError:
        return None

    try:
        with Image.open(path) as pil_image:
            oriented = ImageOps.exif_transpose(pil_image)
            image = np.asarray(oriented.convert("RGB"))
    except Exception as exc:
        logger.warning("HEIC conversion failed for %s (%s)", path, exc)
        return None

    output_dir = settings.temp_dir / "preprocess"
    output_dir.mkdir(parents=True, exist_ok=True)
    output_path = output_dir / f"{path.stem}_converted_{uuid.uuid4().hex[:8]}.png"
    Image.fromarray(image).save(output_path)
    logger.info("HEIC converted: %s -> %s", path, output_path)
    return output_path