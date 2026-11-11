import argparse
import sys

from sqlmodel import Session, select

from app.core.db import engine
from app.core.security import get_password_hash
from app.models import User


def main() -> None:
    parser = argparse.ArgumentParser(description="Reset admin password for EL-AMEL LAB")
    parser.add_argument("--email", required=True, help="Admin email address")
    parser.add_argument("--password", required=True, help="New password")
    args = parser.parse_args()

    with Session(engine) as session:
        user = session.exec(select(User).where(User.email == args.email)).first()
        if not user:
            print(f"[ERROR] User with email '{args.email}' not found.", file=sys.stderr)
            sys.exit(1)
        user.hashed_password = get_password_hash(args.password)
        session.add(user)
        session.commit()
        print(f"[SUCCESS] Password for '{args.email}' was successfully updated.")


if __name__ == "__main__":
    main()
