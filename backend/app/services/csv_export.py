import csv
import io
import re
from collections.abc import Iterable, Sequence

from fastapi.responses import StreamingResponse

_NUMERIC_RE = re.compile(r"^-?\d+(?:\.\d+)?$")
_FORMULA_PREFIXES = ("=", "+", "-", "@", "\t", "\r")


def sanitize_csv_cell(value: object) -> str:
    """Neutralize spreadsheet formula-injection prefixes while preserving negative numbers."""
    if value is None:
        return ""
    text = str(value)
    if text and text.startswith(_FORMULA_PREFIXES) and not _NUMERIC_RE.match(text):
        return f"'{text}"
    return text


def build_csv_streaming_response(
    *,
    headers: Sequence[str],
    rows: Iterable[Sequence[object]],
    filename: str,
) -> StreamingResponse:
    """Build a UTF-8 BOM semicolon-delimited CSV response compatible with French Excel."""
    output = io.StringIO()
    output.write("\ufeff")
    writer = csv.writer(output, delimiter=";")
    writer.writerow([sanitize_csv_cell(h) for h in headers])
    for row in rows:
        writer.writerow([sanitize_csv_cell(cell) for cell in row])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
