import base64
import os
from datetime import date, datetime
from typing import Any, Dict, List, Optional
from urllib.parse import unquote, urlparse

from weasyprint import CSS, HTML
from weasyprint.text.fonts import FontConfiguration

# ใบส่งของที่รายการน้อย เติมแถวว่างให้ถึงจำนวนนี้ (ไว้เขียนเพิ่มด้วยมือ)
# ไม่เติมเต็มหน้าแบบเดิม 20 แถว เพราะแถวที่มีรูป/ชื่อยาวสูงกว่า ทำให้ล้นไปหน้าใหม่ที่ไม่มีหัวเอกสาร
MIN_ROWS = 10

FONT_PATH = os.path.join(os.path.dirname(__file__), "assets", "fonts", "NotoSansThai-Regular.ttf")
UPLOADS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "uploads"))


DEFAULT_DELIVERY_OPTIONS = {
    "show_image": True,
    "show_price": False,
    "price_field": "wholesale_price",
    "price_label": "ราคาส่ง",
}


def generate_delivery_pdf(
    delivery: Dict[str, Any],
    company: Dict[str, Any],
    options: Optional[Dict[str, Any]] = None,
) -> bytes:
    opts = {**DEFAULT_DELIVERY_OPTIONS, **(options or {})}
    items = sorted(delivery.get("items", []) or [], key=_product_code_sort_key)

    font_config = FontConfiguration()
    css = _build_css(font_config)
    html_str = _build_html(delivery, company, items, opts)
    return HTML(string=html_str).write_pdf(stylesheets=[css], font_config=font_config)


def generate_delivery_report_pdf(
    report: Dict[str, Any], company: Dict[str, Any], meta: Dict[str, Any]
) -> bytes:
    font_config = FontConfiguration()
    css = _build_css(font_config)
    html_str = _build_report_html(report, company, meta)
    return HTML(string=html_str).write_pdf(stylesheets=[css], font_config=font_config)


def _build_report_html(
    report: Dict[str, Any], company: Dict[str, Any], meta: Dict[str, Any]
) -> str:
    logo_html = _logo_html(company.get("logo"))
    company_html = _company_html(company)
    info_html = _report_info_html(meta)

    rows = report.get("rows", []) or []
    total_quantity = report.get("total_quantity", 0)
    total_value = report.get("total_value", 0)
    delivery_count = report.get("delivery_count", 0)

    if rows:
        body_rows = ""
        for idx, item in enumerate(rows, start=1):
            code = _esc(str(item.get("product_code") or "-"))
            name = _esc(str(item.get("product_name") or ""))
            qty = _qty(item.get("total_quantity"))
            unit = _esc(str(item.get("unit") or ""))
            price = _money(item.get("unit_price"))
            value = _money(item.get("total_value"))
            cnt = _esc(str(item.get("delivery_count") or 0))
            body_rows += f"""<tr>
  <td class="center">{idx}</td>
  <td class="center">{code}</td>
  <td>{name}</td>
  <td class="center">{qty}</td>
  <td class="center">{unit}</td>
  <td style="text-align:right;">{price}</td>
  <td style="text-align:right;">{value}</td>
  <td class="center">{cnt}</td>
</tr>"""
    else:
        body_rows = (
            '<tr><td class="center" colspan="8" '
            'style="height:12mm;color:#999;">ไม่มีข้อมูล</td></tr>'
        )

    total_row = f"""<tr>
  <td class="center" colspan="3" style="text-align:right;font-weight:bold;background:#f5f5f5;">รวมทั้งสิ้น</td>
  <td class="center" style="font-weight:bold;background:#f5f5f5;">{_qty(total_quantity)}</td>
  <td class="center" style="background:#f5f5f5;"></td>
  <td style="background:#f5f5f5;"></td>
  <td style="text-align:right;font-weight:bold;background:#f5f5f5;">{_money(total_value)}</td>
  <td class="center" style="font-weight:bold;background:#f5f5f5;">{_esc(str(delivery_count))}</td>
</tr>"""

    return f"""<!DOCTYPE html>
<html lang="th">
<head><meta charset="utf-8" /><title>รายงานการส่งของ</title></head>
<body>
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
    <div class="title-row">
      <span class="doc-title">รายงานการส่งของ (ตามหน่วยงาน)</span>
    </div>
    <table class="items-table">
      <thead>
        <tr>
          <th class="col-no">ลำดับ</th>
          <th class="col-code">รหัสสินค้า</th>
          <th>รายการสิ่งของ</th>
          <th class="col-qty">จำนวนรวม</th>
          <th class="col-unit">หน่วย</th>
          <th class="col-price">{_esc(meta.get("price_label") or "ราคาทุน")}/หน่วย</th>
          <th class="col-price">มูลค่ารวม</th>
          <th class="col-cnt">จำนวนครั้ง</th>
        </tr>
      </thead>
      <tbody>{body_rows}{total_row}</tbody>
    </table>
  </div>
</div>
</body>
</html>"""


def _report_info_html(meta: Dict[str, Any]) -> str:
    customer_name = _esc(str(meta.get("customer_name") or "-"))
    address = _esc(str(meta.get("customer_address") or "-"))
    contact = _esc(str(meta.get("customer_contact") or "-"))
    phone = _esc(str(meta.get("customer_phone") or "-"))
    start_date = _esc(str(meta.get("start_date") or "-"))
    end_date = _esc(str(meta.get("end_date") or "-"))
    status_label = _esc(str(meta.get("status_label") or "-"))
    printed_at = _esc(str(meta.get("printed_at") or "-"))
    price_label = _esc(str(meta.get("price_label") or "ราคาทุน"))

    left = f"""<td class="info-left">
  <div class="info-panel">
    <div class="info-row"><span class="info-label">หน่วยงาน</span><span class="info-value">{customer_name}</span></div>
    <div class="info-row"><span class="info-label">ที่อยู่</span><span class="info-value">{address}</span></div>
    <div class="info-row"><span class="info-label">ผู้ติดต่อ</span><span class="info-value">{contact}</span></div>
    <div class="info-row"><span class="info-label">โทรศัพท์</span><span class="info-value">{phone}</span></div>
  </div>
</td>"""

    right = f"""<td class="info-right">
  <div class="info-panel">
    <div class="info-row"><span class="info-label">ช่วงวันที่</span><span class="info-value">{start_date} ถึง {end_date}</span></div>
    <div class="info-row"><span class="info-label">สถานะ</span><span class="info-value">{status_label}</span></div>
    <div class="info-row"><span class="info-label">ใช้ราคา</span><span class="info-value">{price_label}</span></div>
    <div class="info-row"><span class="info-label">พิมพ์เมื่อ</span><span class="info-value">{printed_at}</span></div>
  </div>
</td>"""

    return left + right


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

.items-table tbody tr {{
    break-inside: avoid;
}}

/* ใบส่งของ: หัวเอกสาร (thead) และช่องลงชื่อ (tfoot) อยู่ในตารางเดียวกับรายการสินค้า
   WeasyPrint พิมพ์ thead/tfoot ซ้ำทุกหน้าให้เอง */
.items-table td.doc-wrap {{
    padding: 0;
    height: auto;
    border: 0.5pt solid #a0a0a0;
    vertical-align: top;
    overflow: visible;
}}

.items-table td.doc-wrap .signature-block {{
    border-top: none;
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

.col-price {{
    width: 22mm;
}}

.col-cnt {{
    width: 18mm;
}}

.col-img {{
    width: 16mm;
    padding: 0.5mm !important;
}}

.item-img {{
    max-width: 14mm;
    max-height: 10mm;
    object-fit: contain;
    display: block;
    margin: 0 auto;
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


def _build_html(
    delivery: Dict[str, Any],
    company: Dict[str, Any],
    items: List[Dict],
    opts: Dict[str, Any],
) -> str:
    logo_html = _logo_html(company.get("logo"))
    company_html = _company_html(company)
    info_html = _info_html(delivery)
    notes = _esc(delivery.get("notes") or "-")
    status_label = _status_label(delivery.get("status"))

    show_image = bool(opts.get("show_image"))
    show_price = bool(opts.get("show_price"))
    price_field = opts.get("price_field") or "wholesale_price"
    price_label = opts.get("price_label") or "ราคา"
    col_count = 6 + (1 if show_image else 0) + (2 if show_price else 0)

    # ตารางเดียวทั้งใบ → ต้องกำหนดความกว้างคอลัมน์ผ่าน colgroup
    # (table-layout: fixed ใช้แถวแรกเป็นตัวกำหนด ซึ่งแถวแรกคือหัวเอกสารที่ colspan ทั้งแถว)
    cols = (
        '<col class="col-no" /><col class="col-code" />'
        + ('<col class="col-img" />' if show_image else "")
        + '<col /><col class="col-qty" /><col class="col-unit" />'
        + ('<col class="col-price" /><col class="col-price" />' if show_price else "")
        + '<col class="col-note" />'
    )
    image_head = '<th class="col-img">รูป</th>' if show_image else ""
    price_head = (
        f'<th class="col-price">{_esc(price_label)}/หน่วย</th>'
        f'<th class="col-price">จำนวนเงิน</th>'
        if show_price
        else ""
    )

    rows_html = _table_rows(items, show_image, show_price, price_field)
    total_html = ""
    if show_price:
        grand_total = sum(_line_total(it, price_field) for it in items)
        # ครอบคลุม ลำดับ..หน่วย + คอลัมน์ราคา/หน่วย (+รูป ถ้าเปิด)
        span = 6 + (1 if show_image else 0)
        total_html = (
            f'<tr><td colspan="{span}" style="text-align:right;font-weight:bold;'
            f'background:#f5f5f5;">รวมเป็นเงินทั้งสิ้น</td>'
            f'<td style="text-align:right;font-weight:bold;background:#f5f5f5;">'
            f'{_money(grand_total)}</td>'
            f'<td style="background:#f5f5f5;"></td></tr>'
        )

    return f"""<!DOCTYPE html>
<html lang="th">
<head><meta charset="utf-8" /><title>ใบส่งสินค้า</title></head>
<body>
<table class="items-table">
  <colgroup>{cols}</colgroup>
  <thead>
    <tr>
      <td class="doc-wrap" colspan="{col_count}">
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
      </td>
    </tr>
    <tr>
      <th class="col-no">ลำดับ</th>
      <th class="col-code">รหัสสินค้า</th>
      {image_head}
      <th>รายการสินค้า</th>
      <th class="col-qty">จำนวน</th>
      <th class="col-unit">หน่วย</th>
      {price_head}
      <th class="col-note">หมายเหตุ</th>
    </tr>
  </thead>
  <tfoot>
    <tr>
      <td class="doc-wrap" colspan="{col_count}">
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
      </td>
    </tr>
  </tfoot>
  <tbody>{rows_html}{total_html}</tbody>
</table>
</body>
</html>"""


def _table_rows(
    items: List[Dict],
    show_image: bool = True,
    show_price: bool = False,
    price_field: str = "wholesale_price",
) -> str:
    rows = ""
    for row_index in range(max(len(items), MIN_ROWS)):
        item = items[row_index] if row_index < len(items) else None
        if item:
            no = row_index + 1
            code = _esc(str(item.get("product_code") or "-"))
            name = _esc(str(item.get("product_name") or ""))
            qty = _item_qty_label(item)
            unit = _esc(str(item.get("unit") or ""))
            note = _esc(str(item.get("note") or ""))
            img_cell = (
                f'<td class="center col-img">{_item_image_html(item.get("image_url"))}</td>'
                if show_image
                else ""
            )
            price_cells = ""
            if show_price:
                price_cells = (
                    f'<td style="text-align:right;">{_money(item.get(price_field))}</td>'
                    f'<td style="text-align:right;">{_money(_line_total(item, price_field))}</td>'
                )
            rows += f"""<tr>
  <td class="center">{no}</td>
  <td class="center">{code}</td>
  {img_cell}
  <td>{name}</td>
  <td class="center">{qty}</td>
  <td class="center">{unit}</td>
  {price_cells}
  <td>{note}</td>
</tr>"""
        else:
            blanks = 6 + (1 if show_image else 0) + (2 if show_price else 0)
            rows += "<tr>" + ("<td></td>" * blanks) + "</tr>"
    return rows


def _line_total(item: Dict[str, Any], price_field: str) -> float:
    try:
        return float(item.get("quantity") or 0) * float(item.get(price_field) or 0)
    except (TypeError, ValueError):
        return 0.0


def _item_image_html(image_url: Optional[str]) -> str:
    if not image_url:
        return ""
    try:
        data_uri = _logo_as_data_uri(image_url)
        if data_uri:
            return f'<img class="item-img" src="{data_uri}" alt="" />'
    except Exception:
        pass
    return ""


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


def _qty(value: Any) -> str:
    """จำนวนแบบตัดศูนย์ท้ายทิ้ง: 12 -> '12', 7.6000 -> '7.6', 1.3158 -> '1.3158'"""
    try:
        num = float(value or 0)
    except (TypeError, ValueError):
        return "0"
    text = f"{num:,.4f}".rstrip("0").rstrip(".")
    return text or "0"


def _item_qty_label(item: Dict[str, Any]) -> str:
    """แสดงจำนวนตามที่ผู้ใช้กรอก ถ้ากรอกคนละหน่วยกับหน่วยสินค้าให้วงเล็บหน่วยฐานต่อท้าย"""
    base_qty = item.get("quantity")
    base_unit = str(item.get("unit") or "").strip()
    input_qty = item.get("input_quantity")
    input_unit = str(item.get("input_unit") or "").strip()

    if input_qty is not None and input_unit and input_unit != base_unit:
        return f"{_qty(input_qty)} {_esc(input_unit)} ({_qty(base_qty)} {_esc(base_unit)})"
    return _qty(base_qty)


def _money(value: Any) -> str:
    try:
        return f"{float(value or 0):,.2f}"
    except (TypeError, ValueError):
        return "0.00"


def _esc(text: str) -> str:
    return (
        str(text)
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )
