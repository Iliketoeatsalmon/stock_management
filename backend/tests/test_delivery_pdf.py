"""ใบส่งของหลายหน้า: ทุกหน้าต้องมีหัวเอกสาร หัวคอลัมน์ และช่องลงชื่อ และสินค้าต้องไม่หาย
ช่องลงชื่ออยู่ล่างสุดของกระดาษ ตำแหน่งเดียวกันทุกหน้า (หน้าที่รายการน้อยเว้นว่างไว้)

ต้องมี weasyprint (ใน image ของ backend มี / ใน python:3.11-slim ของ run_tests.sh ไม่มี → ข้าม)
รันด้วย image ของ backend โดยไม่แตะคอนเทนเนอร์ที่รันอยู่:
  MSYS_NO_PATHCONV=1 docker run --rm -v "$(pwd -W)/backend:/src:ro" -w /src stock-management-backend \
      sh -c "pip install -q pytest && python -m pytest tests/test_delivery_pdf.py -v -p no:cacheprovider"
"""
import base64
import io
import os
import sys

import pytest

pytest.importorskip("weasyprint")

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import pdf_generator as pg  # noqa: E402
from weasyprint import HTML  # noqa: E402
from weasyprint.text.fonts import FontConfiguration  # noqa: E402

COMPANY_NAME = "บริษัท ทดสอบหัวเอกสาร จำกัด"


def _png(width, height):
    """PNG สีเทาขนาดที่ต้องการ (ไม่ต้องพึ่ง Pillow)"""
    import struct
    import zlib

    raw = b"".join(b"\x00" + b"\x80" * width for _ in range(height))

    def chunk(kind, data):
        return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data))

    data = (b"\x89PNG\r\n\x1a\n"
            + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 0, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(raw))
            + chunk(b"IEND", b""))
    return "data:image/png;base64," + base64.b64encode(data).decode()


IMG = _png(200, 200)
COMPANY = {"nameTh": COMPANY_NAME, "nameEn": "Test Co., Ltd.",
           "address": "99 ถนนทดสอบ แขวงทดสอบ เขตทดสอบ กรุงเทพฯ 10000",
           "taxId": "0105500000000", "tel": "02-000-0000", "email": "a@b.c", "fax": "-", "logo": IMG}
LONG_NAME = "น้ำยาทำความสะอาดพื้นสูตรเข้มข้น กลิ่นลาเวนเดอร์ ขนาดบรรจุ 3.8 ลิตร แพ็คคู่ ราคาพิเศษ"


def _texts(box, out):
    if getattr(box, "text", None):
        out.append(box.text)
    for child in getattr(box, "children", None) or []:
        _texts(child, out)
    return out


def _render(n, opts, long_name=False):
    return [" ".join(_texts(p._page_box, [])) for p in _render_doc(n, opts, long_name).pages]


def _render_doc(n, opts, long_name=False):
    items = [{"product_code": f"NE-{i:04d}", "product_name": LONG_NAME if long_name else f"สินค้า {i}",
              "quantity": 2, "unit": "ชิ้น", "note": "", "image_url": IMG, "wholesale_price": 10}
             for i in range(1, n + 1)]
    delivery = {"items": items, "customer_name": "ลูกค้าทดสอบ", "customer_address": "ที่อยู่ลูกค้า",
                "delivery_number": "DO-TEST", "delivery_date": "2026-11-05", "notes": "-",
                "status": "pending"}
    # ใช้ฟังก์ชันเดียวกับที่ endpoint ใช้ แล้วดักผลก่อนเขียน PDF เพื่ออ่านข้อความทีละหน้า
    captured = {}
    original = HTML.write_pdf

    def fake_write_pdf(self, *args, **kwargs):
        captured["doc"] = self.render(stylesheets=kwargs.get("stylesheets"),
                                      font_config=kwargs.get("font_config"))
        return b""

    HTML.write_pdf = fake_write_pdf
    try:
        pg.generate_delivery_pdf(delivery, COMPANY, opts)
    finally:
        HTML.write_pdf = original
    return captured["doc"]


CASES = [
    ("ไม่มีรูป 25 รายการ", 25, {"show_image": False}, False),
    ("มีรูป 25 รายการ", 25, {"show_image": True}, False),
    ("มีรูป+ราคา ชื่อยาว 45 รายการ", 45, {"show_image": True, "show_price": True}, True),
    ("ชื่อยาว ไม่มีรูป 60 รายการ", 60, {"show_image": False}, True),
]


# ---- ตำแหน่งบนหน้า (หน่วย CSS px ของ WeasyPrint, วัดจากขอบบนกระดาษ) ----
MM = 96 / 25.4


def _all_boxes(box, out):
    out.append(box)
    for child in getattr(box, "children", None) or []:
        _all_boxes(child, out)
    return out


def _find_class(page, css_class):
    """กล่องนอกสุดของ element ที่มี class นี้"""
    for b in _all_boxes(page._page_box, []):
        element = getattr(b, "element", None)
        if element is not None and css_class in (element.get("class") or "").split():
            return b
    raise AssertionError(f"ไม่พบ .{css_class} ในหน้านี้")


def _class_box(page, css_class):
    """(บน, ล่าง) ของ element ที่มี class นี้"""
    b = _find_class(page, css_class)
    return b.position_y, b.position_y + b.margin_height()


def _text_top(page, word):
    ys = [b.position_y for b in _all_boxes(page._page_box, []) if word in (getattr(b, "text", None) or "")]
    assert ys, f"ไม่พบข้อความ {word!r} ในหน้านี้"
    return min(ys)


def _rows_bottom(page):
    """ขอบล่างของข้อความสินค้าแถวต่ำสุดในหน้า"""
    return max(b.position_y + b.margin_height() for b in _all_boxes(page._page_box, [])
               if (getattr(b, "text", None) or "").startswith("NE-"))


LAYOUT_CASES = CASES + [("หน้าเดียว 5 รายการ", 5, {"show_image": True}, False)]


@pytest.mark.parametrize("label,n,opts,long_name", LAYOUT_CASES, ids=[c[0] for c in LAYOUT_CASES])
def test_signature_sits_at_bottom_of_every_page(label, n, opts, long_name):
    for i, page in enumerate(_render_doc(n, opts, long_name).pages, 1):
        _, bottom = _class_box(page, "signature-block")
        assert page.height - bottom < 15 * MM, (
            f"หน้า {i}: ช่องลงชื่อห่างขอบล่างกระดาษ {(page.height - bottom) / MM:.0f} มม. (ต้องชิดล่าง)")


@pytest.mark.parametrize("label,n,opts,long_name", CASES, ids=[c[0] for c in CASES])
def test_header_and_signature_same_place_on_every_page(label, n, opts, long_name):
    pages = _render_doc(n, opts, long_name).pages
    sig_tops = [_class_box(p, "signature-block")[0] for p in pages]
    head_tops = [_text_top(p, COMPANY_NAME) for p in pages]
    assert max(sig_tops) - min(sig_tops) < 1, f"ช่องลงชื่ออยู่คนละที่ (มม.): {[round(y / MM) for y in sig_tops]}"
    assert max(head_tops) - min(head_tops) < 1, f"หัวเอกสารอยู่คนละที่ (มม.): {[round(y / MM) for y in head_tops]}"


@pytest.mark.parametrize("label,n,opts,long_name", LAYOUT_CASES, ids=[c[0] for c in LAYOUT_CASES])
def test_signature_as_wide_as_items_table(label, n, opts, long_name):
    for i, page in enumerate(_render_doc(n, opts, long_name).pages, 1):
        sig = _find_class(page, "signature-block")
        table = _find_class(page, "items-table")
        assert abs(sig.position_x - table.position_x) < 1, f"หน้า {i}: ช่องลงชื่อไม่ตรงขอบซ้ายตาราง"
        assert abs(sig.margin_width() - table.margin_width()) < 1, (
            f"หน้า {i}: ช่องลงชื่อกว้าง {sig.margin_width() / MM:.0f} มม. แต่ตารางกว้าง {table.margin_width() / MM:.0f} มม.")


@pytest.mark.parametrize("label,n,opts,long_name", LAYOUT_CASES, ids=[c[0] for c in LAYOUT_CASES])
def test_rows_never_run_into_signature(label, n, opts, long_name):
    for i, page in enumerate(_render_doc(n, opts, long_name).pages, 1):
        top, _ = _class_box(page, "signature-block")
        assert _rows_bottom(page) <= top, f"หน้า {i}: แถวสินค้าทับช่องลงชื่อ"


def test_page_number_on_every_page():
    pages = _render(45, {"show_image": True, "show_price": True}, long_name=True)
    for i, text in enumerate(pages, 1):
        assert f"หน้า {i}/{len(pages)}" in text, f"หน้า {i} ไม่มีเลขหน้า"


@pytest.mark.parametrize("label,n,opts,long_name", CASES, ids=[c[0] for c in CASES])
def test_every_page_has_header_and_signature(label, n, opts, long_name):
    pages = _render(n, opts, long_name)
    assert len(pages) >= 2, "เคสนี้ควรยาวเกิน 1 หน้า"
    for i, text in enumerate(pages, 1):
        assert COMPANY_NAME in text, f"หน้า {i} ไม่มีหัวบริษัท"
        assert "DO-TEST" in text, f"หน้า {i} ไม่มีเลขที่ใบส่งของ"
        assert "ลำดับ" in text, f"หน้า {i} ไม่มีหัวคอลัมน์"
        assert "ลงชื่อ" in text, f"หน้า {i} ไม่มีช่องลงชื่อ"
        assert "NE-" in text, f"หน้า {i} ไม่มีสินค้าเลย (หน้าเปล่า)"


@pytest.mark.parametrize("label,n,opts,long_name", CASES, ids=[c[0] for c in CASES])
def test_all_items_printed_once_in_order(label, n, opts, long_name):
    codes = [w for text in _render(n, opts, long_name) for w in text.split() if w.startswith("NE-")]
    assert codes == [f"NE-{i:04d}" for i in range(1, n + 1)]


def test_grand_total_only_once_at_end():
    pages = _render(45, {"show_image": True, "show_price": True}, long_name=True)
    hits = [i for i, t in enumerate(pages) if "รวมเป็นเงินทั้งสิ้น" in t]
    assert hits == [len(pages) - 1]
    assert "900.00" in pages[-1]  # 45 รายการ x 2 ชิ้น x 10 บาท


def test_single_page_still_one_page():
    assert len(_render(5, {"show_image": True})) == 1
