#!/bin/sh
# ใบรับรอง Let's Encrypt ของ cleanovaworld.com + stock.cleanovaworld.com — ขอครั้งแรกและต่ออายุ
#
# ใช้ (รันจาก root ของ repo ด้วย Git Bash):
#   sh deploy/le-cert.sh staging   ซ้อม (ใบปลอมของ LE ไม่กิน rate limit — รันก่อน issue เสมอ)
#   sh deploy/le-cert.sh issue     ขอใบจริง
#   sh deploy/le-cert.sh renew     ต่ออายุ (ใบอายุ 90 วัน — deploy/renew-cert.cmd เรียกผ่าน Task Scheduler)
#
# ทำตามแบบเดียวกับ C:\company_system\deploy\le-cert.sh (hk.nineeagleinnovation.co.th) ที่ใช้งานอยู่บนเครื่องนี้
#
# วิธีพิสูจน์: HTTP-01 — LE ยิง http://<โดเมน>/.well-known/acme-challenge/<token>
#   host nginx (C:\nginx-1.28.0) ต้องมี location นี้ใน server block port 80 ของ cleanovaworld.com
#   เสิร์ฟจาก C:\stock_management\deploy\certbot\www (ดู deploy/nginx-stock-cleanova.conf)
#
# ทำไมเก็บ /etc/letsencrypt ใน docker volume ไม่ใช่โฟลเดอร์ใน repo:
#   certbot สร้าง live/<domain>/*.pem เป็น symlink ชี้ไป archive/
#   bind mount ของ Docker Desktop บน Windows สร้าง symlink ไม่ได้ → certbot พัง
#   จึงเก็บใน volume แล้ว "แบน" symlink ออกมาที่ deploy/certbot/host ด้วย cp -L ให้ host nginx อ่าน
#
# deploy/certbot/ ทั้งโฟลเดอร์อยู่ใน .gitignore — privkey.pem ห้ามขึ้น git เด็ดขาด

set -e

# โดเมนแรกคือชื่อโฟลเดอร์ใน live/ ของ certbot
DOMAINS="cleanovaworld.com stock.cleanovaworld.com"
CERT_NAME=cleanovaworld.com
VOLUME=stock-management_certbot_etc
ROOT=$(pwd -W 2>/dev/null || pwd)      # Git Bash: ต้องเป็น path แบบ Windows ให้ docker เข้าใจ
export MSYS_NO_PATHCONV=1              # กัน Git Bash แปลง /etc/letsencrypt เป็น C:\Program Files\Git\etc\…

CMD="${1:-}"
[ -n "$CMD" ] || { echo "ใช้: sh deploy/le-cert.sh [staging|issue|renew]" >&2; exit 1; }

mkdir -p deploy/certbot/www deploy/certbot/host
docker volume create "$VOLUME" >/dev/null

certbot() {
    docker run --rm \
        -v "$VOLUME:/etc/letsencrypt" \
        -v "$ROOT/deploy/certbot/www:/var/www/certbot" \
        certbot/certbot "$@"
}

export_pem() {
    docker run --rm \
        -v "$VOLUME:/etc/letsencrypt" \
        -v "$ROOT/deploy/certbot/host:/out" \
        alpine sh -c "
            set -e
            cp -L /etc/letsencrypt/live/$CERT_NAME/fullchain.pem /out/fullchain.pem
            cp -L /etc/letsencrypt/live/$CERT_NAME/privkey.pem   /out/privkey.pem
        "
}

reload_nginx() {
    # ต้องใส่ -p ไม่งั้น nginx.exe ใช้ cwd เป็น prefix แล้วหา conf/nginx.conf ไม่เจอ
    # -t ก่อนเสมอ — nginx.conf ไฟล์เดียวมีทุกเว็บบนเครื่อง config พัง = ล่มทุกเว็บ
    /c/nginx-1.28.0/nginx.exe -p "C:/nginx-1.28.0/" -t
    /c/nginx-1.28.0/nginx.exe -p "C:/nginx-1.28.0/" -s reload
}

domain_args() {
    for d in $DOMAINS; do printf -- "-d %s " "$d"; done
}

case "$CMD" in
    staging|issue)
        EXTRA=""
        [ "$CMD" = staging ] && EXTRA="--staging --dry-run"
        # --register-unsafely-without-email: ไม่มีเมลเตือนวันหมดอายุ — ใช้ Task Scheduler ต่ออายุแทน
        # shellcheck disable=SC2046
        certbot certonly --webroot -w /var/www/certbot \
            --cert-name "$CERT_NAME" $(domain_args) \
            --agree-tos --no-eff-email --non-interactive \
            --register-unsafely-without-email $EXTRA
        [ "$CMD" = staging ] && { echo "ซ้อมผ่าน — รัน 'sh deploy/le-cert.sh issue' ต่อได้"; exit 0; }
        export_pem
        # ครั้งแรกยังไม่ reload: server block 443 ยังไม่ถูกใส่ใน nginx.conf (ดูขั้นตอนใน nginx-stock-cleanova.conf)
        echo "ได้ใบรับรองแล้ว ไฟล์อยู่ที่ deploy/certbot/host — ใส่ server block 443 แล้วค่อย reload nginx"
        ;;
    renew)
        certbot renew --cert-name "$CERT_NAME" --webroot -w /var/www/certbot --non-interactive
        export_pem
        reload_nginx
        ;;
    *)
        echo "ไม่รู้จักคำสั่ง '$CMD' — ใช้ staging | issue | renew" >&2; exit 1 ;;
esac

docker run --rm -v "$VOLUME:/etc/letsencrypt" alpine/openssl x509 \
    -in "/etc/letsencrypt/live/$CERT_NAME/fullchain.pem" -noout -subject -ext subjectAltName -dates
