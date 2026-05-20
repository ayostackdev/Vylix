from pathlib import Path

import fitz


def compress_pdf(input_path: str | Path, output_path: str | Path | None = None) -> Path:
    source_path = Path(input_path)
    target_path = Path(output_path) if output_path else source_path.with_name(f"{source_path.stem}.compressed.pdf")

    document = fitz.open(source_path)
    try:
        document.save(
            target_path,
            garbage=4,
            deflate=True,
            clean=True,
            deflate_images=True,
        )
    finally:
        document.close()

    return target_path


def extract_pdf_text(input_path: str | Path) -> str:
    source_path = Path(input_path)
    document = fitz.open(source_path)
    try:
        pages: list[str] = []
        for page in document:
            pages.append(page.get_text("text"))
        return "\n".join(pages).strip()
    finally:
        document.close()
