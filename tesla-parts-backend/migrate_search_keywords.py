import os
import sys
from sqlmodel import Session, create_engine, text

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://tesla:teslapass@localhost:5432/tesladb")
engine = create_engine(DATABASE_URL)

def run_migration():
    print("Running migration: adding search_keywords column to product table...")
    with Session(engine) as session:
        try:
            session.exec(text("ALTER TABLE product ADD COLUMN IF NOT EXISTS search_keywords VARCHAR;"))
            session.commit()
            print("Successfully added search_keywords column!")
        except Exception as e:
            print(f"Migration error: {e}")
            sys.exit(1)

if __name__ == "__main__":
    run_migration()
