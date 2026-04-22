import base64
import io
import os
import unicodedata
from datetime import date, datetime
from typing import Any, Dict, List, Optional
from urllib.parse import urlparse, unquote

from weasyprint import HTML, CSS
from weasyprint.text.fonts import FontConfiguration

PAGE_SIZE = 20

FONT_PATH = os.path.join(os.path.dirname(__file__), "assets", "fonts", "NotoSansThai-Regular.ttf")
UPLOADS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "uploads"))


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def generate_delivery_pdf(delivery: Dict[str, Any], company: Dict[str, Any]) -> bytes:
    items = sorted(delivery.get("items", []) or [], key=_product_code_sort_key)
    pages = _chunk(items, PAGE_SIZE)

    font_config = FontConfiguration()
    css = _build_css(font_config)
    html_str = _build_html(delivery, company, pages)
    return HTML(string=html_str).write_pdf(stylesheets=[css], font_config=font_config)


# ---------------------------------------------------------------------------
# CSS
# ---------------------------------------------------------------------------

def _build_css(font_config: FontConfiguration) -> CSS:
    if os.path.isfile(FONT_PATH):
        font_uri = FONT_PATH.replace("\\", "/")
        if not font_uri.startswith("/"):
            font_uri = "/" + font_uri
        font_face = f"@font-face {{ font-family: 'NotoSansThai'; src: url('file://{font_uri}'); }}"
        body_font = "NotoSansThai, sans-serif"
    else:
        font_face = ""
        body_font = "sans-serif"

    css_string = f"""
{font_face}

@page {{
    size: A4 portrait;
    margin: 8mm;
}}

* {{
    box-sizing: border-box;
    margin: 0;
    padding: 0;
    font-family: {body_font};
}}

body {{
    font-size: 9pt;
    color: #000;
    line-height: 1.3;
}}

.page {{
    page-break-after: always;
    width: 100%;
}}

.page:last-child {{
    page-break-after: avoid;
}}

/* ─── Outer border ───────────────────────────── */
.sheet {{
    border: 0.5pt solid #a0a0a0;
    width: 100%;
    height: 277mm;
    display: flex;
    flex-direction: column;
}}

/* ─── Header: logo + company ────────────────── */
.header-top {{
    display: flex;
    border-bottom: 0.5pt solid #a0a0a0;
    height: 40mm;
    flex-shrink: 0;
}}
.header-logo {{
    width: 33%;
    border-right: 0.5pt solid #a0a0a0;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 3mm;
}}
.header-logo img {{
    max-width: 100%;
    max-height: 34mm;
    object-fit: contain;
}}
.header-logo .no-logo {{
    color: #aaa;
    font-size: 8pt;
}}
.header-company {{
    flex: 1;
    padding: 4mm 4mm 4mm 4mm;
    font-size: 8.5pt;
}}
.header-company .company-name {{
    font-size: 10pt;
    font-weight: bold;
    margin-bottom: 1mm;
}}

/* ─── Info block ─────────────────────────────── */
.header-info {{
    display: flex;
    border-bottom: 0.5pt solid #a0a0a0;
    height: 40mm;
    flex-shrink: 0;
}}
.info-left, .info-right {{
    flex: 1;
    padding: 4mm;
    font-size: 8.5pt;
    line-height: 1.55;
}}
.info-left {{
    border-right: 0.5pt solid #a0a0a0;
}}

/* ─── Notes ──────────────────────────────────── */
.notes-block {{
    border-bottom: 0.5pt solid #a0a0a0;
    padding: 3mm 4mm;
    font-size: 8.5pt;
    min-height: 12mm;
    flex-shrink: 0;
}}

/* ─── Title ──────────────────────────────────── */
.title-row {{
    border-bottom: 0.5pt solid #a0a0a0;
    height: 8mm;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    flex-shrink: 0;
}}
.title-row .doc-title {{
    font-size: 10pt;
    font-weight: bold;
}}
.title-row .status-badge {{
    position: absolute;
    right: 4mm;
    border: 0.5pt solid #a0a0a0;
    border-radius: 2mm;
    padding: 0.5mm 2mm;
    font-size: 7pt;
    color: #555;
    background: #f5f5f5;
}}

/* ─── Table ──────────────────────────────────── */
.items-table {{
    width: 100%;
    border-collapse: collapse;
    flex: 1;
    font-size: 8pt;
}}
.items-table th {{
    background: #f5f5f5;
    border: 0.35pt solid #a6acb3;
    padding: 2mm 1.5mm;
    text-align: center;
    font-weight: normal;
    height: 8mm;
    font-size: 8pt;
}}
.items-table td {{
    border: 0.35pt solid #a6acb3;
    padding: 1.5mm 1.5mm;
    height: 7.5mm;
    vertical-align: middle;
    font-size: 8pt;
}}
.items-table td.center {{ text-align: center; }}
.items-table td.name {{ max-width: 0; overflow: hidden; white-space: nowrap; }}
.col-no    {{ width: 12mm; }}
.col-code  {{ width: 24mm; }}
.col-name  {{ width: auto; }}
.col-qty   {{ width: 16mm; }}
.col-unit  {{ width: 16mm; }}
.col-note  {{ width: 30mm; }}

/* ─── Signature ──────────────────────────────── */
.signature-block {{
    border-top: 0.5pt solid #a0a0a0;
    display: flex;
    height: 24mm;
    flex-shrink: 0;
}}
.sig-half {{
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    font-size: 8.5pt;
    gap: 2mm;
}}
.sig-half:first-child {{
    border-right: 0.5pt solid #a0a0a0;
}}
.sig-line {{
    color: #888;
    letter-spacing: 1pt;
}}

/* ─── Page number ────────────────────────────── */
.page-num {{
    position: running(page-num);
    font-size: 7.5pt;
    color: #888;
    text-align: right;
}}
@page {{ @bottom-right {{ content: element(page-num); }} }}
"""
    return CSS(string=css_string, font_config=font_config)


# ---------------------------------------------------------------------------
# HTML builder
# ---------------------------------------------------------------------------

def _build_html(delivery: Dict[str, Any], company: Dict[str, Any], pages: List[List]) -> str:
    logo_html = _logo_html(company.get("logo"))
    company_html = _company_html(company)
    info_html = _info_html(delivery)
    notes = _esc(delivery.get("notes") or "-")
    status_label = _status_label(delivery.get("status"))
    total_pages = len(pages)

    page_blocks = ""
    for page_index, page_items in enumerate(pages):
        rows_html = _table_rows(page_items, page_index)
        page_blocks += f"""
<div class="page">
  <div class="sheet">
    <div class="header-top">
      <div class="header-logo">{logo_html}</div>
      <div class="header-company">{company_html}</div>
    </div>
    <div class="header-info">{info_html}</div>
    <div class="notes-block">หมายเหตุ: {notes}</div>
    <div class="title-row">
      <span class="doc-title">ใบส่งสินค้า</span>
      <span class="status-badge">{_esc(status_label)}</span>
    </div>
    <table class="items-table">
      <thead>
        <tr>
          <th class="col-no">ลำดับ</th>
          <th class="col-code">รหัสสินค้า</th>
          <th class="col-name">รายการสินค้า</th>
          <th class="col-qty">จำนวน</th>
          <th class="col-unit">หน่วย</th>
          <th class="col-note">หมายเหตุ</th>
        </tr>
      </thead>
      <tbody>{rows_html}</tbody>
    </table>
    <div class="signature-block">
      <div class="sig-half">
        <span>ส่วนของลูกค้า / ผู้รับสินค้า</span>
        <span class="sig-line">. . . . . . . . . . . . . . . . . .</span>
        <span class="sig-line">. . . . / . . . . / . . . .</span>
      </div>
      <div class="sig-half">
        <span>ส่วนของบริษัท / ผู้ส่งสินค้า</span>
        <span class="sig-line">. . . . . . . . . . . . . . . . . .</span>
        <span class="sig-line">. . . . / . . . . / . . . .</span>
      </div>
    </div>
  </div>
  <div class="page-num">หน้า {page_index + 1}/{total_pages}</div>
</div>
"""

    return f"""<!DOCTYPE html>
<html lang="th">
<head><meta charset="utf-8" /><title>ใบส่งสินค้า</title></head>
<body>{page_blocks}</body>
</html>"""


def _table_rows(items: List[Dict], page_index: int) -> str:
    rows = ""
    for row_index in range(PAGE_SIZE):
        item = items[row_index] if row_index < len(items) else None
        if item:
            no = page_index * PAGE_SIZE + row_index + 1
            code = _esc(str(item.get("product_code") or "-"))
            name = _esc(str(item.get("product_name") or ""))
            qty = _esc(str(item.get("quantity") or ""))
            unit = _esc(str(item.get("unit") or ""))
            note = _esc(str(item.get("note") or ""))
            rows += f"""<tr>
  <td class="center">{no}</td>
  <td class="center">{code}</td>
  <td>{name}</td>
  <td class="center">{qty}</td>
  <td class="center">{unit}</td>
  <td>{note}</td>
</tr>"""
        else:
            rows += "<tr><td></td><td></td><td></td><td></td><td></td><td></td></tr>"
    return rows


def _company_html(company: Dict[str, Any]) -> str:
    name_en = _esc(str(company.get("nameEn") or ""))
    name_th = _esc(str(company.get("nameTh") or ""))
    address = _esc(str(company.get("address") or ""))
    tax_id = str(company.get("taxId") or "").strip()
    tel = _esc(str(company.get("tel") or "-"))
    email = _esc(str(company.get("email") or "-"))
    fax = _esc(str(company.get("fax") or "-"))
    tax_label = tax_id if tax_id.lower().startswith("tax id") else f"Tax ID: {tax_id or '-'}"

    parts = []
    if name_en:
        parts.append(f'<div class="company-name">{name_en}</div>')
    if name_th:
        parts.append(f'<div class="company-name">{name_th}</div>')
    if address:
        parts.append(f"<div>{address}</div>")
    parts.append(f"<div>{_esc(tax_label)}</div>")
    parts.append(f"<div>Tel: {tel} &nbsp; Fax: {fax}</div>")
    parts.append(f"<div>Email: {email}</div>")
    return "".join(parts)


def _info_html(delivery: Dict[str, Any]) -> str:
    customer_name = _esc(str(delivery.get("customer_name") or "-"))
    address = _esc(str(delivery.get("customer_address") or "-"))
    contact = _esc(str(delivery.get("customer_contact_person") or "-"))
    phone = _esc(str(delivery.get("customer_phone") or "-"))
    delivery_date = _esc(_format_date(delivery.get("delivery_date")))
    delivery_number = _esc(str(delivery.get("delivery_number") or "-"))
    created_by = str(delivery.get("created_by_name") or "-")
    created_by_phone = delivery.get("created_by_phone")
    created_by_label = _esc(f"{created_by} ({created_by_phone})" if created_by_phone else created_by)

    left = f"""<div class="info-left">
  <div>ส่งของถึง: {customer_name}</div>
  <div>ที่อยู่: {address}</div>
  <div>ผู้ติดต่อ: {contact}</div>
  <div>โทรศัพท์: {phone}</div>
</div>"""

    right = f"""<div class="info-right">
  <div>วันที่: {delivery_date}</div>
  <div>เลขที่: {delivery_number}</div>
  <div>ผู้ทำรายการ: {created_by_label}</div>
</div>"""

    return left + right


def _logo_html(logo_url: Optional[str]) -> str:
    if not logo_url:
        return '<span class="no-logo">No Logo</span>'
    try:
        data_uri = _logo_as_data_uri(logo_url)
        if data_uri:
            return f'<img src="{data_uri}" alt="logo" />'
    except Exception:
        pass
    return '<span class="no-logo">No Logo</span>'


def _logo_as_data_uri(logo_url: str) -> Optional[str]:
    if logo_url.startswith("data:image"):
        return logo_url

    local_path = _resolve_local_path(logo_url)
    if local_path and os.path.isfile(local_path):
        with open(local_path, "rb") as f:
            data = f.read()
        ext = os.path.splitext(local_path)[1].lower().lstrip(".")
        mime = {"jpg": "jpeg", "jpeg": "jpeg", "png": "png", "gif": "gif", "webp": "webp"}.get(ext, "png")
        encoded = base64.b64encode(data).decode()
        return f"data:image/{mime};base64,{encoded}"

    if logo_url.startswith("http://") or logo_url.startswith("https://"):
        from urllib.request import urlopen
        with urlopen(logo_url, timeout=5) as resp:
            data = resp.read()
            content_type = resp.headers.get("Content-Type", "image/png").split(";")[0]
        encoded = base64.b64encode(data).decode()
        return f"data:{content_type};base64,{encoded}"

    return None


def _resolve_local_path(url: str) -> Optional[str]:
    for prefix in ("/api/uploads/", "/uploads/", "uploads/"):
        if url.startswith(prefix):
            rel = url[len(prefix):]
            return os.path.join(UPLOADS_DIR, rel)
    parsed = urlparse(url)
    path = unquote(parsed.path or "")
    for prefix in ("/api/uploads/", "/uploads/"):
        if path.startswith(prefix):
            rel = path[len(prefix):]
            return os.path.join(UPLOADS_DIR, rel)
    return None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _chunk(items: List, size: int) -> List[List]:
    if not items:
        return [[]]
    return [items[i: i + size] for i in range(0, len(items), size)]


def _format_date(value: Any) -> str:
    if not value:
        return "-"
    if isinstance(value, (datetime, date)):
        return value.strftime("%d/%m/%Y")
    try:
        return datetime.fromisoformat(str(value)).strftime("%d/%m/%Y")
    except Exception:
        return str(value)


def _status_label(status: Optional[str]) -> str:
    return {"confirmed": "ยืนยันแล้ว", "cancelled": "ยกเลิก"}.get(status or "", "รอดำเนินการ")


def _product_code_sort_key(item: Dict[str, Any]) -> tuple:
    code = str(item.get("product_code") or "")
    digits = [ch for ch in code if ch.isdigit()]
    number = int("".join(digits)) if digits else None
    return (number is None, number or 0, code.lower())


def _esc(text: str) -> str:
    return (str(text)
            .replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;")
            .replace('"', "&quot;"))
