#!/usr/bin/env bash
# รันเทสต์ catalog โดยไม่แตะฐานข้อมูลจริงและไม่แตะคอนเทนเนอร์ production
#
#   - ยก Postgres ชั่วคราวชื่อ stock_catalog_testdb_tmp ขึ้นมา (ไม่เปิดพอร์ตออกนอก)
#   - รัน pytest ใน container python:3.11-slim แบบ --rm
#   - ลบ Postgres ชั่วคราวทิ้งเสมอ แม้เทสต์จะ fail
#
# ใช้งาน:  bash backend/tests/run_tests.sh
set -uo pipefail

TMP_DB=stock_catalog_testdb_tmp
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

cleanup() {
    docker rm -f "$TMP_DB" >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "==> ยก Postgres ชั่วคราว"
docker rm -f "$TMP_DB" >/dev/null 2>&1 || true
MSYS_NO_PATHCONV=1 docker run -d --name "$TMP_DB" \
    -e POSTGRES_PASSWORD=testonly \
    -e POSTGRES_USER=testuser \
    -e POSTGRES_DB=testdb \
    public.ecr.aws/docker/library/postgres:15-alpine >/dev/null

for _ in $(seq 1 30); do
    if docker exec "$TMP_DB" pg_isready -U testuser -d testdb >/dev/null 2>&1; then
        break
    fi
    sleep 1
done

echo "==> รันเทสต์"
# ต้องใช้ postgresql+psycopg2:// ให้ชัด เพราะ SQLAlchemy 2.x เลือก psycopg (v3) เป็นค่าเริ่มต้น
MSYS_NO_PATHCONV=1 docker run --rm \
    --link "$TMP_DB":testdb \
    -v "$REPO_ROOT/backend:/src:ro" \
    -w //tmp/work \
    -e TEST_DATABASE_URL="postgresql+psycopg2://testuser:testonly@testdb:5432/testdb" \
    python:3.11-slim bash -c "
        cp -r /src/tests /tmp/work/tests
        pip install -q pytest sqlalchemy psycopg2-binary fastapi 2>/dev/null
        python -m pytest tests/test_catalog.py -v --no-header
    "
RESULT=$?

echo "==> เสร็จ (exit=$RESULT)"
exit $RESULT
