import os

os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://user:pass@localhost/test")
os.environ.setdefault("JWT_SECRET_KEY", "test-secret-key-that-is-long-enough-32chars")
os.environ.setdefault("ADMIN_EMAIL", "admin@test.com")
os.environ.setdefault("ADMIN_PASSWORD", "test-admin-password")
os.environ.setdefault("ADMIN_NAME", "Test Admin")
