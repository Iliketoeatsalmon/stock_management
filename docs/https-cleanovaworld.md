# เปิด HTTPS ให้ cleanovaworld.com (ระบบ stock)

**สถานะ:** เตรียมไฟล์แล้ว ยังไม่ได้แตะ nginx จริง

## ทำไม
เบราว์เซอร์ขึ้น "Your connection to this site is not secure" เพราะเว็บวิ่งบน HTTP
รหัสผ่านตอน login ถูกส่งแบบไม่เข้ารหัส และ password manager ของเบราว์เซอร์จะไม่กรอกให้อัตโนมัติบนหน้า HTTP

## ข้อจำกัดสำคัญ: BigClean
BigClean อยู่ใต้โดเมนเดียวกัน (`/bigClean2026`) และโค้ดที่ build แล้วเรียก
`http://cleanovaworld.com/bigClean2026/api` แบบตายตัว ถ้าเปิดผ่าน https เบราว์เซอร์จะบล็อก (mixed content)
แผนนี้จึงบังคับ https **เฉพาะ `/stock`** และให้ BigClean อยู่ http ตามเดิม และ **ยังไม่ใส่ HSTS**
ถ้าวันหลัง BigClean แก้ให้ใช้ URL แบบ relative แล้ว ค่อยย้าย BigClean ไป https + ใส่ HSTS ทั้งโดเมน

## ไฟล์ที่ใช้
| ไฟล์ | ใช้ทำอะไร |
|---|---|
| `deploy/nginx-stock-cleanova.conf` | ต้นฉบับ server block (PHASE 1 และ PHASE 2) — ผ่าน `nginx -t` กับสำเนา config ทั้งเครื่องแล้ว |
| `deploy/le-cert.sh` | ขอ/ต่ออายุใบรับรอง Let's Encrypt (แบบเดียวกับ hk.nineeagleinnovation.co.th) |
| `deploy/renew-cert.cmd` | ให้ Task Scheduler เรียกต่ออายุทุกวันอังคาร 03:50 |

`deploy/certbot/` อยู่ใน `.gitignore` (มี `privkey.pem`)

## ขั้นตอน
รันใน Git Bash จาก `C:\stock_management` ยกเว้นที่บอกว่า cmd

```bash
NGX='/c/nginx-1.28.0/nginx.exe -p C:/nginx-1.28.0/'
```

**0. สำรอง nginx.conf**
```bash
cp /c/nginx-1.28.0/conf/nginx.conf /c/nginx-1.28.0/conf/nginx.conf.bak-$(date +%Y%m%d)-https
```

**1. PHASE 1 — ให้ Let's Encrypt เข้ามาตรวจได้**
- แก้ `nginx.conf`: ใน `server { listen 80; server_name cleanovaworld.com ... }` วาง location
  `/.well-known/acme-challenge/` (บล็อก PHASE 1) ต่อจากบรรทัด `client_max_body_size`
- `$NGX -t && $NGX -s reload`
- ทดสอบ:
  ```bash
  mkdir -p deploy/certbot/www/.well-known/acme-challenge
  echo ok > deploy/certbot/www/.well-known/acme-challenge/ping
  curl http://cleanovaworld.com/.well-known/acme-challenge/ping   # ต้องได้ ok
  rm deploy/certbot/www/.well-known/acme-challenge/ping
  ```

**2. ขอใบรับรอง**
```bash
sh deploy/le-cert.sh staging    # ซ้อมก่อน ไม่กิน rate limit
sh deploy/le-cert.sh issue
ls deploy/certbot/host/         # ต้องมี fullchain.pem และ privkey.pem
```

**3. PHASE 2 — เปิด 443 และย้าย /stock ไป https**
- แทนทั้ง `[SECTION: STOCK CLEANOVA]` ใน `nginx.conf` ด้วยบล็อก PHASE 2
- `$NGX -t && $NGX -s reload`
- ทดสอบ:
  ```bash
  curl -sI https://cleanovaworld.com/stock            | head -1   # 200
  curl -sI http://cleanovaworld.com/stock             | grep -i location   # https://...
  curl -sI http://cleanovaworld.com/bigClean2026/     | head -1   # 200 (ต้องเหมือนเดิม)
  curl -sI https://cleanovaworld.com/bigClean2026/    | grep -i location   # http://...
  ```

**4. ตั้งต่ออายุอัตโนมัติ** (cmd แบบ Run as administrator)
```cmd
schtasks /create /tn "stock-cleanova-cert-renew" /tr "C:\stock_management\deploy\renew-cert.cmd" /sc weekly /d TUE /st 03:50 /ru SYSTEM
```

## ย้อนกลับ
```bash
cp /c/nginx-1.28.0/conf/nginx.conf.bak-<วันที่>-https /c/nginx-1.28.0/conf/nginx.conf
$NGX -t && $NGX -s reload
```
redirect ใช้ 302 (ไม่ใช่ 301) เบราว์เซอร์จึงไม่จำ ถอยกลับ http ได้ทันที
