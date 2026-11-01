@echo off
REM ต่ออายุใบรับรอง Let's Encrypt ของ cleanovaworld.com — เรียกโดย Task Scheduler ทุกวันอังคาร 03:50
REM (คนละวันกับ hk ที่ต่ออายุวันจันทร์ 03:45 จะได้ไม่ reload nginx ชนกัน)
REM certbot ไม่ทำอะไรถ้าใบยังเหลือเกิน 30 วัน รันบ่อยได้ไม่เสียหาย
cd /d C:\stock_management
"C:\Program Files\Git\bin\bash.exe" -lc "sh deploy/le-cert.sh renew" >> deploy\certbot\cert-renew.log 2>&1
