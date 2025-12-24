from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

password = "admin123"  # ตั้งรหัสแอดมินที่อยากใช้
hash_value = pwd_context.hash(password)

print("Plain password:", password)
print("Hashed password:", hash_value)