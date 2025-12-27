import base64
import io
import os
from datetime import date, datetime
from typing import Any, Dict, List, Optional
from urllib.request import urlopen

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

PAGE_SIZE = 10
THAI_FONT_NAME = "ThaiFont"


def generate_delivery_pdf(delivery: Dict[str, Any], company: Dict[str, Any]) -> bytes:
    buffer = io.BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=A4)
    font_name = _register_thai_font()

    items = delivery.get("items", []) or []
    pages = _chunk_items(items, PAGE_SIZE)

    for page_index, page_items in enumerate(pages):
        _draw_page(pdf, delivery, company, page_items, page_index, len(pages), font_name)
        if page_index < len(pages) - 1:
            pdf.showPage()

    pdf.save()
    return buffer.getvalue()


def _chunk_items(items: List[Dict[str, Any]], size: int) -> List[List[Dict[str, Any]]]:
    if not items:
        return [[]]
    return [items[i : i + size] for i in range(0, len(items), size)]


def _register_thai_font() -> str:
    if THAI_FONT_NAME in pdfmetrics.getRegisteredFontNames():
        return THAI_FONT_NAME

    candidates = [
        os.environ.get("THAI_FONT_PATH"),
        os.path.join(os.path.dirname(__file__), "assets", "fonts", "THSarabunNew.ttf"),
        os.path.join(os.environ.get("WINDIR", "C:\\Windows"), "Fonts", "tahoma.ttf"),
    ]
    for path in candidates:
        if path and os.path.isfile(path):
            try:
                pdfmetrics.registerFont(TTFont(THAI_FONT_NAME, path))
                return THAI_FONT_NAME
            except Exception:
                continue
    return "Helvetica"


def _load_logo(logo_url: Optional[str]) -> Optional[ImageReader]:
    if not logo_url:
        return None

    try:
        if logo_url.startswith("data:image"):
            header, encoded = logo_url.split(",", 1)
            data = base64.b64decode(encoded)
            return ImageReader(io.BytesIO(data))

        if logo_url.startswith("/uploads/"):
            base_dir = os.path.dirname(__file__)
            local_path = os.path.join(base_dir, logo_url.lstrip("/"))
            if os.path.isfile(local_path):
                return ImageReader(local_path)

        if logo_url.startswith("http://") or logo_url.startswith("https://"):
            with urlopen(logo_url, timeout=5) as response:
                data = response.read()
            return ImageReader(io.BytesIO(data))
    except Exception:
        return None

    return None


def _format_date(value: Any) -> str:
    if not value:
        return "-"
    if isinstance(value, datetime):
        return value.strftime("%d/%m/%Y")
    if isinstance(value, date):
        return value.strftime("%d/%m/%Y")
    try:
        return datetime.fromisoformat(str(value)).strftime("%d/%m/%Y")
    except Exception:
        return str(value)


def _status_label(status: Optional[str]) -> str:
    if status == "confirmed":
        return "ยืนยันแล้ว"
    if status == "cancelled":
        return "ยกเลิก"
    return "รอดำเนินการ"


def _truncate(text: str, max_width: float, font_name: str, font_size: int) -> str:
    if not text:
        return ""
    if pdfmetrics.stringWidth(text, font_name, font_size) <= max_width:
        return text
    ellipsis = "..."
    max_width -= pdfmetrics.stringWidth(ellipsis, font_name, font_size)
    trimmed = text
    while trimmed and pdfmetrics.stringWidth(trimmed, font_name, font_size) > max_width:
        trimmed = trimmed[:-1]
    return trimmed + ellipsis if trimmed else ellipsis


def _draw_page(
    pdf: canvas.Canvas,
    delivery: Dict[str, Any],
    company: Dict[str, Any],
    items: List[Dict[str, Any]],
    page_index: int,
    total_pages: int,
    font_name: str,
) -> None:
    page_width, page_height = A4
    margin = 8 * mm
    content_width = page_width - (2 * margin)

    pdf.setStrokeColor(colors.black)
    pdf.setLineWidth(0.6)
    pdf.setFillColor(colors.black)

    # Outer border
    pdf.rect(margin, margin, content_width, page_height - (2 * margin))

    y = page_height - margin

    # Header top (logo + company info)
    header_top_h = 38 * mm
    logo_w = content_width * 0.33
    pdf.rect(margin, y - header_top_h, content_width, header_top_h)
    pdf.line(margin + logo_w, y, margin + logo_w, y - header_top_h)

    logo = _load_logo(company.get("logo"))
    if logo:
        img_w = logo_w - 6 * mm
        img_h = header_top_h - 6 * mm
        try:
            raw_w, raw_h = logo.getSize()
            scale = min(img_w / raw_w, img_h / raw_h)
            draw_w = raw_w * scale
            draw_h = raw_h * scale
            img_x = margin + (logo_w - draw_w) / 2
            img_y = y - header_top_h + (header_top_h - draw_h) / 2
            pdf.drawImage(logo, img_x, img_y, width=draw_w, height=draw_h, preserveAspectRatio=True, mask="auto")
        except Exception:
            pass
    else:
        pdf.setFont(font_name, 8)
        pdf.drawCentredString(margin + logo_w / 2, y - header_top_h / 2, "No Logo")

    text_x = margin + logo_w + 4 * mm
    text_y = y - 6 * mm
    pdf.setFont(font_name, 11)
    if company.get("nameEn"):
        pdf.drawString(text_x, text_y, str(company.get("nameEn", "")))
        text_y -= 5 * mm
    if company.get("nameTh"):
        pdf.drawString(text_x, text_y, str(company.get("nameTh", "")))
        text_y -= 5 * mm
    pdf.setFont(font_name, 9)
    if company.get("address"):
        pdf.drawString(text_x, text_y, str(company.get("address", "")))
        text_y -= 4.5 * mm
    pdf.drawString(text_x, text_y, f"Tax ID: {company.get('taxId') or '-'}")
    text_y -= 4.5 * mm
    pdf.drawString(text_x, text_y, f"Tel: {company.get('tel') or '-'}")
    text_y -= 4.5 * mm
    pdf.drawString(text_x, text_y, f"Fax: {company.get('fax') or '-'}")

    y -= header_top_h

    # Header info block (recipient + document info)
    header_info_h = 32 * mm
    pdf.rect(margin, y - header_info_h, content_width, header_info_h)
    pdf.line(margin + content_width / 2, y, margin + content_width / 2, y - header_info_h)

    left_x = margin + 3 * mm
    right_x = margin + content_width / 2 + 3 * mm
    line_gap = 5 * mm

    pdf.setFont(font_name, 9)
    left_y = y - 6 * mm
    customer_name = delivery.get("customer_name") or "-"
    pdf.drawString(left_x, left_y, f"บริษัท: {customer_name}")
    left_y -= line_gap
    pdf.drawString(left_x, left_y, f"ส่งของถึง: {customer_name}")
    left_y -= line_gap
    pdf.drawString(left_x, left_y, f"ผู้ติดต่อ: {delivery.get('customer_contact_person') or '-'}")
    left_y -= line_gap
    pdf.drawString(left_x, left_y, f"ที่อยู่: {delivery.get('customer_address') or '-'}")
    left_y -= line_gap
    pdf.drawString(left_x, left_y, f"โทรศัพท์: {delivery.get('customer_phone') or '-'}")
    left_y -= line_gap
    pdf.drawString(left_x, left_y, "แฟกซ์: -")

    right_y = y - 6 * mm
    pdf.drawString(right_x, right_y, f"วันที่: {_format_date(delivery.get('delivery_date'))}")
    right_y -= line_gap
    pdf.drawString(right_x, right_y, f"เลขที่: {delivery.get('delivery_number') or '-'}")
    right_y -= line_gap
    pdf.drawString(right_x, right_y, f"ผู้ทำรายการ: {delivery.get('created_by_name') or '-'}")

    y -= header_info_h

    # Title row
    title_h = 10 * mm
    pdf.rect(margin, y - title_h, content_width, title_h)
    pdf.setFont(font_name, 11)
    pdf.drawCentredString(margin + content_width / 2, y - (title_h / 2) + 1.5 * mm, "ใบส่งสินค้า")

    badge_text = _status_label(delivery.get("status"))
    badge_font_size = 8
    pdf.setFont(font_name, badge_font_size)
    badge_w = pdfmetrics.stringWidth(badge_text, font_name, badge_font_size) + 6 * mm
    badge_h = 5 * mm
    badge_x = margin + content_width - badge_w - 4 * mm
    badge_y = y - title_h + (title_h - badge_h) / 2
    pdf.setStrokeColor(colors.lightgrey)
    pdf.setFillColor(colors.whitesmoke)
    pdf.roundRect(badge_x, badge_y, badge_w, badge_h, 2 * mm, stroke=1, fill=1)
    pdf.setFillColor(colors.grey)
    pdf.drawCentredString(badge_x + badge_w / 2, badge_y + 1.3 * mm, badge_text)
    pdf.setStrokeColor(colors.black)
    pdf.setFillColor(colors.black)

    y -= title_h

    # Table
    table_header_h = 8 * mm
    row_h = 8 * mm
    table_h = table_header_h + (PAGE_SIZE * row_h)

    col_widths_mm = [12, 24, 96, 16, 16, 30]
    col_widths = [w * mm for w in col_widths_mm]
    col_positions = [margin]
    for w in col_widths:
        col_positions.append(col_positions[-1] + w)

    pdf.rect(margin, y - table_h, content_width, table_h)

    # Header background
    pdf.setFillColor(colors.whitesmoke)
    pdf.rect(margin, y - table_header_h, content_width, table_header_h, fill=1, stroke=0)
    pdf.setFillColor(colors.black)

    # Vertical lines
    for x in col_positions[1:-1]:
        pdf.line(x, y, x, y - table_h)

    # Horizontal lines (header + rows)
    pdf.line(margin, y - table_header_h, margin + content_width, y - table_header_h)
    for i in range(PAGE_SIZE):
        y_line = y - table_header_h - (i + 1) * row_h
        pdf.line(margin, y_line, margin + content_width, y_line)

    # Table headers
    pdf.setFont(font_name, 9)
    header_labels = ["ลำดับ", "รหัสสินค้า", "รายการสินค้า", "จำนวน", "หน่วย", "หมายเหตุ"]
    for i, label in enumerate(header_labels):
        cell_x = col_positions[i]
        cell_w = col_widths[i]
        pdf.drawCentredString(cell_x + cell_w / 2, y - table_header_h + 2.5 * mm, label)

    # Table rows
    pdf.setFont(font_name, 9)
    for row_index in range(PAGE_SIZE):
        item = items[row_index] if row_index < len(items) else None
        row_top = y - table_header_h - (row_index * row_h)
        text_y = row_top - row_h + 2.5 * mm

        values = [
            str(page_index * PAGE_SIZE + row_index + 1) if item else "",
            str(item.get("product_code") or "-") if item else "",
            str(item.get("product_name") or "") if item else "",
            str(item.get("quantity") or "") if item else "",
            str(item.get("unit") or "") if item else "",
            str(item.get("note") or "") if item else "",
        ]

        for col_index, value in enumerate(values):
            cell_x = col_positions[col_index]
            cell_w = col_widths[col_index]
            if col_index in (0, 1, 3, 4):
                pdf.drawCentredString(cell_x + cell_w / 2, text_y, value)
            else:
                truncated = _truncate(value, cell_w - 4 * mm, font_name, 9)
                pdf.drawString(cell_x + 2 * mm, text_y, truncated)

    y -= table_h

    # Signature block
    signature_h = 28 * mm
    pdf.rect(margin, y - signature_h, content_width, signature_h)
    pdf.line(margin + content_width / 2, y, margin + content_width / 2, y - signature_h)

    pdf.setFont(font_name, 9)
    left_center = margin + content_width / 4
    right_center = margin + (content_width * 3 / 4)
    label_y = y - 7 * mm
    pdf.drawCentredString(left_center, label_y, "ส่วนของลูกค้า/ผู้รับสินค้า")
    pdf.drawCentredString(right_center, label_y, "ส่วนของบริษัท/ผู้ส่งสินค้า")
    pdf.drawCentredString(left_center, label_y - 7 * mm, "..............................")
    pdf.drawCentredString(right_center, label_y - 7 * mm, "..............................")
    pdf.drawCentredString(left_center, label_y - 12 * mm, "........./....../........")
    pdf.drawCentredString(right_center, label_y - 12 * mm, "........./....../........")
