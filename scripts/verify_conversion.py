#!/usr/bin/env python3
"""
verify_conversion.py - Check that a SQLite file faithfully mirrors a source
Microsoft Access database.

For every user table it compares, between the source .mdb/.accdb and the
SQLite output:
  * table presence (nothing missing / unexpectedly extra)
  * column names and their order
  * exact row count (via SELECT COUNT(*) on both sides)

Exit code is 0 when everything matches, 1 when any discrepancy is found.

Usage:
    python verify_conversion.py SOURCE.mdb OUTPUT.sqlite [--backend auto|ado|pyodbc] [--password PW]
"""

import argparse
import os
import sqlite3
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mdb_to_sqlite import open_reader  # noqa: E402


def verify(mdb_path, sqlite_path, backend="auto", password=None):
    src = open_reader(mdb_path, backend, password)
    db = sqlite3.connect(sqlite_path)
    try:
        src_tables = src.list_tables()
        dst_tables = [
            r[0] for r in db.execute(
                "SELECT name FROM sqlite_master WHERE type='table'"
            )
        ]
        src_set, dst_set = set(src_tables), set(dst_tables)

        problems = []
        for t in sorted(src_set - dst_set):
            problems.append(f"table present in source but missing in sqlite: {t}")
        extra = sorted(dst_set - src_set)

        clean = 0
        total_src = total_dst = 0
        print(f"  backend: {src.kind}")
        for t in src_tables:
            if t not in dst_set:
                continue
            sc = src.count_rows(t)
            dc = db.execute(f'SELECT COUNT(*) FROM "{t}"').fetchone()[0]
            src_cols = [c[0] for c in src.columns(t)]
            dst_cols = [d[1] for d in db.execute(f'PRAGMA table_info("{t}")')]
            total_src += sc
            total_dst += dc

            issues = []
            if sc != dc:
                issues.append(f"rows {sc}(src)!={dc}(db)")
            if src_cols != dst_cols:
                issues.append("column names/order differ")
                problems.append(
                    f"{t}: columns differ\n      src={src_cols}\n      db ={dst_cols}"
                )
            if issues:
                problems.append(f"{t}: " + ", ".join(issues))
                print(f"  [FAIL] {t}: {dc}/{sc} rows  ({'; '.join(issues)})")
            else:
                clean += 1
                print(f"  [ok]   {t}: {dc} rows, {len(dst_cols)} cols")

        print(f"\nTables : {len(src_tables)} source / {len(dst_tables)} sqlite"
              f" - {clean} verified identical")
        print(f"Rows   : {total_src} source / {total_dst} sqlite")
        if extra:
            print(f"Note   : {len(extra)} extra table(s) only in sqlite: {extra}")

        if problems:
            print(f"\n*** {len(problems)} PROBLEM(S) FOUND ***")
            for p in problems:
                print("  -", p)
            return 1
        print("\nVERIFIED OK: tables, column names, and row counts all match.")
        return 0
    finally:
        db.close()
        src.close()


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("source", help="Source .mdb/.accdb file")
    p.add_argument("sqlite", help="SQLite file produced by mdb_to_sqlite.py")
    p.add_argument("--backend", choices=["auto", "ado", "pyodbc"], default="auto")
    p.add_argument("--password")
    a = p.parse_args(argv)
    if not os.path.isfile(a.source):
        p.error(f"source not found: {a.source}")
    if not os.path.isfile(a.sqlite):
        p.error(f"sqlite not found: {a.sqlite}")
    return verify(a.source, a.sqlite, a.backend, a.password)


if __name__ == "__main__":
    sys.exit(main())
