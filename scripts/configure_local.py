"""Generate untracked local configuration without printing credentials."""
import secrets
from pathlib import Path

root = Path(__file__).resolve().parents[1]
for path, database in [(root / ".env", None), (root / "backend" / ".env", "sqlite:///./demo.db")]:
    if path.exists():
        print(f"Preserved existing configuration: {path.relative_to(root)}")
        continue
    content = "JWT_SECRET=" + secrets.token_urlsafe(48) + "\nADMIN_PASSWORD=" + secrets.token_urlsafe(18) + "\n"
    if database:
        content += "DATABASE_URL=" + database + "\n"
    path.write_text(content, encoding="utf-8")
    print(f"Created local configuration: {path.relative_to(root)}")
