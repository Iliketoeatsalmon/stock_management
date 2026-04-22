import base64
import os
from datetime import date, datetime
from typing import Any, Dict, List, Optional
from urllib.parse import unquote, urlparse

from weasyprint import CSS, HTML
from weasyprint.text.fonts import FontConfiguration

PAGE_SIZE = 20

FONT_PATH = os.path.join(os.path.dirname(__file__), "assets", "fonts", "NotoSansThai-Regular.ttf")
UPLOADS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "uploads"))


def generate_delivery_pdf(delivery: Dict[str, Any], company: Dict[str, Any]) -> bytes:
    items = sorted(delivery.get("items", []) or [], key=_product_code_sort_key)
    pages = _chunk(items, PAGE_SIZE)

    font_config = FontConfiguration()
    css = _build_css(font_config)
    html_str = _build_html(delivery, company, pages)
    return HTML(string=html_str).write_pdf(stylesheets=[css], font_config=font_config)


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
    margin: 8mm 8mm 10mm 8mm;
    @bottom-right {{
        content: "หน้า " counter(page) "/" counter(pages);
        font-size: 7.5pt;
        color: #888;
    }}
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

.sheet {{
    border: 0.5pt solid #a0a0a0;
    width: 100%;
}}

.row-table {{
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
}}

.row-table > tbody > tr > td {{
    vertical-align: top;
    border-bottom: 0.5pt solid #a0a0a0;
}}

.header-top td {{
    vertical-align: top;
}}

.header-logo {{
    width: 26%;
    border-right: 0.5pt solid #a0a0a0;
    text-align: center;
    padding: 4mm 3mm;
    vertical-align: middle !important;
}}

.header-logo img {{
    display: block;
    width: 100%;
    max-width: 56mm;
    max-height: 30mm;
    height: auto;
    margin: 0 auto;
    object-fit: contain;
}}

.header-logo .no-logo {{
    color: #aaa;
    font-size: 8pt;
}}

.header-company {{
    padding: 4mm 5mm 3mm;
    font-size: 8pt;
    line-height: 1.35;
    vertical-align: top !important;
}}

.header-company .company-name-th {{
    font-size: 10.5pt;
    font-weight: bold;
    margin-bottom: 1mm;
}}

.header-company .company-name-en {{
    font-size: 9.5pt;
    font-weight: bold;
    margin-bottom: 1.2mm;
}}

.header-company .company-detail {{
    margin-bottom: 0.8mm;
}}

.header-info td {{
    padding: 0;
    font-size: 8.25pt;
    line-height: 1.45;
    width: 50%;
    vertical-align: top;
}}

.header-info .info-left {{
    border-right: 0.5pt solid #a0a0a0;
}}

.info-panel {{
    min-height: 28mm;
    padding: 3mm 4mm;
}}

.info-row {{
    width: 100%;
    margin-bottom: 1.2mm;
}}

.info-label {{
    display: inline-block;
    width: 23mm;
    font-weight: bold;
    vertical-align: top;
}}

.info-value {{
    display: inline-block;
    width: calc(100% - 24mm);
    vertical-align: top;
    word-break: break-word;
}}

.notes-block {{
    border-bottom: 0.5pt solid #a0a0a0;
    padding: 2mm 4mm;
    font-size: 8.5pt;
    min-height: 10mm;
}}

.title-row {{
    border-bottom: 0.5pt solid #a0a0a0;
    position: relative;
    text-align: center;
    padding: 1.5mm 0;
}}

.title-row .doc-title {{
    font-size: 10pt;
    font-weight: bold;
}}

.title-row .status-badge {{
    position: absolute;
    right: 4mm;
    top: 1.5mm;
    border: 0.5pt solid #a0a0a0;
    border-radius: 2mm;
    padding: 0.5mm 2mm;
    font-size: 7pt;
    color: #555;
    background: #f5f5f5;
}}

.items-table {{
    width: 100%;
    border-collapse: collapse;
    font-size: 8pt;
    table-layout: fixed;
}}

.items-table th {{
    background: #f5f5f5;
    border: 0.35pt solid #a6acb3;
    padding: 1.5mm 1.5mm;
    text-align: center;
    font-weight: normal;
    height: 7mm;
    font-size: 8pt;
}}

.items-table td {{
    border: 0.35pt solid #a6acb3;
    padding: 1mm 1.5mm;
    height: 7mm;
    vertical-align: middle;
    font-size: 8pt;
    overflow: hidden;
}}

.items-table td.center {{
    text-align: center;
}}

.col-no {{
    width: 12mm;
}}

.col-code {{
    width: 24mm;
}}

.col-qty {{
    width: 16mm;
}}

.col-unit {{
    width: 16mm;
}}

.col-note {{
    width: 30mm;
}}

.signature-block {{
    width: 100%;
    border-collapse: collapse;
    border-top: 0.5pt solid #a0a0a0;
    table-layout: fixed;
}}

.signature-block td {{
    width: 50%;
    height: 28mm;
    vertical-align: top;
    font-size: 8.5pt;
    padding: 3mm 4mm;
}}

.signature-block .sig-left {{
    border-right: 0.5pt solid #a0a0a0;
}}

.signature-panel {{
    text-align: center;
}}

.signature-title {{
    display: block;
    font-weight: bold;
    margin-bottom: 9mm;
}}

.sig-line {{
    display: block;
    margin-top: 1.5mm;
}}

.sig-field {{
    display: inline-block;
    min-width: 42mm;
    border-bottom: 0.5pt solid #888;
    height: 4mm;
    vertical-align: bottom;
}}

.sig-date {{
    letter-spacing: 0.2pt;
}}
"""
    return CSS(string=css_string, font_config=font_config)


def _build_html(delivery: Dict[str, Any], company: Dict[str, Any], pages: List[List]) -> str:
    logo_html = _logo_html(company.get("logo"))
    company_html = _company_html(company)
    info_html = _info_html(delivery)
    notes = _esc(delivery.get("notes") or "-")
    status_label = _status_label(delivery.get("status"))

    page_blocks = ""
    for page_index, page_items in enumerate(pages):
        rows_html = _table_rows(page_items, page_index)
        page_blocks += f"""
<div class="page">
  <div class="sheet">
    <table class="row-table header-top">
      <tr>
        <td class="header-logo">{logo_html}</td>
        <td class="header-company">{company_html}</td>
      </tr>
    </table>
    <table class="row-table header-info">
      <tr>{info_html}</tr>
    </table>
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
          <th>รายการสินค้า</th>
          <th class="col-qty">จำนวน</th>
          <th class="col-unit">หน่วย</th>
          <th class="col-note">หมายเหตุ</th>
        </tr>
      </thead>
      <tbody>{rows_html}</tbody>
    </table>
    <table class="signature-block">
      <tr>
        <td class="sig-left">
          <div class="signature-panel">
            <span class="signature-title">ส่วนของลูกค้า / ผู้รับสินค้า</span>
            <span class="sig-line">ลงชื่อ <span class="sig-field"></span></span>
            <span class="sig-line sig-date">วันที่ <span class="sig-field"></span></span>
          </div>
        </td>
        <td>
          <div class="signature-panel">
            <span class="signature-title">ส่วนของบริษัท / ผู้ส่งสินค้า</span>
            <span class="sig-line">ลงชื่อ <span class="sig-field"></span></span>
            <span class="sig-line sig-date">วันที่ <span class="sig-field"></span></span>
          </div>
        </td>
      </tr>
    </table>
  </div>
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
    if name_th:
        parts.append(f'<div class="company-name-th">{name_th}</div>')
    if name_en:
        parts.append(f'<div class="company-name-en">{name_en}</div>')
    if address:
        parts.append(f'<div class="company-detail">{address}</div>')
    parts.append(f'<div class="company-detail">{_esc(tax_label)}</div>')
    parts.append(f'<div class="company-detail">Tel: {tel} &nbsp; Fax: {fax}</div>')
    parts.append(f'<div class="company-detail">Email: {email}</div>')
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

    left = f"""<td class="info-left">
  <div class="info-panel">
    <div class="info-row"><span class="info-label">ส่งของถึง</span><span class="info-value">{customer_name}</span></div>
    <div class="info-row"><span class="info-label">ที่อยู่</span><span class="info-value">{address}</span></div>
    <div class="info-row"><span class="info-label">ผู้ติดต่อ</span><span class="info-value">{contact}</span></div>
    <div class="info-row"><span class="info-label">โทรศัพท์</span><span class="info-value">{phone}</span></div>
  </div>
</td>"""

    right = f"""<td class="info-right">
  <div class="info-panel">
    <div class="info-row"><span class="info-label">วันที่</span><span class="info-value">{delivery_date}</span></div>
    <div class="info-row"><span class="info-label">เลขที่</span><span class="info-value">{delivery_number}</span></div>
    <div class="info-row"><span class="info-label">ผู้ทำรายการ</span><span class="info-value">{created_by_label}</span></div>
  </div>
</td>"""

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


def _chunk(items: List, size: int) -> List[List]:
    if not items:
        return [[]]
    return [items[i : i + size] for i in range(0, len(items), size)]


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
    return (
        str(text)
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )
