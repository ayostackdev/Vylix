from __future__ import annotations

import shutil
import subprocess
from pathlib import Path


def is_ghostscript_available() -> bool:
    """Return True if the Ghostscript `gs` binary is installed and callable."""
    return shutil.which("gs") is not None


def compress_pdf_ghostscript(
    input_path: str | Path,
    output_path: str | Path,
    preset: str = "/ebook",
    timeout: int = 120,
) -> Path | None:
    """
    Compress a PDF using Ghostscript.

    Uses the ``/ebook`` preset (150 dpi) for a good balance of size and
    readability. Returns the compressed output path on success, or ``None``
    when the input is not a PDF, Ghostscript is unavailable, or compression
    fails (so callers can fall back to the original file).
    """
    source = Path(input_path)
    if source.suffix.lower() != ".pdf" or not is_ghostscript_available():
        return None

    target = Path(output_path)
    command = [
        "gs",
        "-sDEVICE=pdfwrite",
        "-dCompatibilityLevel=1.4",
        f"-dPDFSETTINGS={preset}",
        "-dNOPAUSE",
        "-dQUIET",
        "-dBATCH",
        "-dDetectDuplicateImages=true",
        f"-sOutputFile={target}",
        str(source),
    ]

    try:
        result = subprocess.run(
            command,
            capture_output=True,
            timeout=timeout,
            check=False,
        )
    except (subprocess.SubprocessError, OSError):
        return None

    if result.returncode != 0 or not target.exists() or target.stat().st_size == 0:
        return None

    return target
