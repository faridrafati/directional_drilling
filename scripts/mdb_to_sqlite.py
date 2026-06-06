#!/usr/bin/env python3
"""
mdb_to_sqlite.py - Convert a Microsoft Access database (.mdb/.accdb) to SQLite.

Reads every user table from an Access database and writes it to a SQLite file,
preserving column names, a best-effort column type affinity, primary keys (when
detectable) and all row data.

No third-party packages are required on a typical Windows machine:
  * Reading Access uses the ACE OLE DB provider via ADODB/COM (pywin32), which
    ships with most "Python for Windows" installs.  If `pyodbc` and the
    "Microsoft Access Driver" ODBC driver are present, that backend works too.
  * Writing SQLite uses Python's built-in `sqlite3` module.

Usage:
    python mdb_to_sqlite.py INPUT [OUTPUT] [options]

    INPUT   Path to a .mdb/.accdb file, OR a directory containing them.
    OUTPUT  Output .sqlite path (only when INPUT is a single file).
            Defaults to INPUT with its extension changed to .sqlite.

Options:
    --force                Overwrite the output file if it already exists.
    --tables A,B,C         Only convert these tables (comma-separated).
    --list                 List tables and row counts; do not convert.
    --password PW          Database password, if the file is protected.
    --backend auto|ado|pyodbc
                           Reader backend to use (default: auto -> ADO, then pyodbc).

Examples:
    python mdb_to_sqlite.py "old_air_mud_code/BLANK.mdb"
    python mdb_to_sqlite.py "old_air_mud_code/DRYGAS.mdb" out/drygas.sqlite --force
    python mdb_to_sqlite.py old_air_mud_code --force          # whole folder
    python mdb_to_sqlite.py "old_air_mud_code/BLANK.mdb" --list
"""

import argparse
import datetime
import decimal
import os
import sqlite3
import sys

# --- SQLite column affinities -------------------------------------------------
INTEGER, REAL, TEXT, BLOB = "INTEGER", "REAL", "TEXT", "BLOB"

# ADO DataTypeEnum -> SQLite affinity.  Unlisted types fall back to TEXT.
_ADO_AFFINITY = {
    2: INTEGER, 3: INTEGER, 16: INTEGER, 17: INTEGER, 18: INTEGER,
    19: INTEGER, 20: INTEGER, 21: INTEGER, 11: INTEGER,            # ints + bool
    4: REAL, 5: REAL, 6: REAL, 14: REAL, 131: REAL, 139: REAL,     # float/decimal/currency
    128: BLOB, 204: BLOB, 205: BLOB,                               # binary
}


def _ado_affinity(t):
    return _ADO_AFFINITY.get(int(t), TEXT)


def _py_affinity(pytype):
    """Map a Python type (from pyodbc's cursor.description) to a SQLite affinity."""
    if pytype is bool or pytype is int:
        return INTEGER
    if pytype is float or pytype is decimal.Decimal:
        return REAL
    if pytype in (bytes, bytearray, memoryview):
        return BLOB
    return TEXT  # str, datetime, date, etc.


def _convert(v):
    """Coerce a value coming from Access into something sqlite3 can bind."""
    if v is None:
        return None
    if isinstance(v, bool):                       # bool is a subclass of int
        return 1 if v else 0
    if isinstance(v, datetime.datetime):
        if v.tzinfo is not None:                  # keep the stored wall-clock value
            v = v.replace(tzinfo=None)
        return v.isoformat(sep=" ")
    if isinstance(v, datetime.date):
        return v.isoformat()
    if isinstance(v, datetime.time):
        return v.isoformat()
    if isinstance(v, decimal.Decimal):
        return float(v)
    if isinstance(v, (bytes, bytearray, memoryview)):
        return bytes(v)
    if isinstance(v, (int, float, str)):
        return v
    fmt = getattr(v, "Format", None)              # legacy pywintypes time objects
    if callable(fmt):
        try:
            return fmt("%Y-%m-%d %H:%M:%S")
        except Exception:
            pass
    return str(v)


def _q(name):
    """Quote a SQLite identifier (handles spaces and embedded quotes)."""
    return '"' + str(name).replace('"', '""') + '"'


# --- Reader backends ----------------------------------------------------------
class AdoReader:
    """Read an Access database through the ACE OLE DB provider (pywin32/COM)."""

    PROVIDERS = ["Microsoft.ACE.OLEDB.16.0", "Microsoft.ACE.OLEDB.12.0"]
    kind = "ado"

    def __init__(self, path, password=None):
        import win32com.client  # raises ImportError if pywin32 is missing
        self._wc = win32com.client
        self.conn = win32com.client.Dispatch("ADODB.Connection")
        last = None
        for prov in self.PROVIDERS:
            cs = f"Provider={prov};Data Source={os.path.abspath(path)};"
            if password:
                cs += f"Jet OLEDB:Database Password={password};"
            try:
                self.conn.Open(cs)
                self.provider = prov
                return
            except Exception as e:  # try the next provider version
                last = e
        raise RuntimeError(
            f"Could not open via ACE OLE DB ({', '.join(self.PROVIDERS)}). "
            f"Last error: {last}"
        )

    def list_tables(self):
        rs = self.conn.OpenSchema(20)  # adSchemaTables
        out = []
        while not rs.EOF:
            name = rs.Fields.Item("TABLE_NAME").Value
            ttype = rs.Fields.Item("TABLE_TYPE").Value
            if ttype == "TABLE" and not str(name).startswith(("MSys", "~")):
                out.append(name)
            rs.MoveNext()
        rs.Close()
        return sorted(out)

    def _execute(self, sql):
        # win32com returns Connection.Execute as a (recordset, records_affected)
        # tuple because RecordsAffected is a ByRef out parameter.
        res = self.conn.Execute(sql)
        return res[0] if isinstance(res, tuple) else res

    def columns(self, table):
        rs = self._execute(f"SELECT * FROM [{table}]")
        cols = [(f.Name, _ado_affinity(f.Type)) for f in rs.Fields]
        rs.Close()
        return cols

    def count_rows(self, table):
        rs = self._execute(f"SELECT COUNT(*) AS n FROM [{table}]")
        try:
            return int(rs.Fields.Item("n").Value)
        finally:
            rs.Close()

    def primary_keys(self, table):
        try:
            rs = self.conn.OpenSchema(28, [None, None, table])  # adSchemaPrimaryKeys
            pks = []
            while not rs.EOF:
                pks.append(rs.Fields.Item("COLUMN_NAME").Value)
                rs.MoveNext()
            rs.Close()
            return pks
        except Exception:
            return []

    def iter_rows(self, table, batch=2000):
        rs = self._execute(f"SELECT * FROM [{table}]")
        try:
            while not rs.EOF:
                data = rs.GetRows(batch)   # column-major: data[col][row]
                ncols = len(data)
                if ncols == 0:
                    break
                nrows = len(data[0])
                for r in range(nrows):
                    yield tuple(_convert(data[c][r]) for c in range(ncols))
                if nrows < batch:
                    break
        finally:
            rs.Close()

    def close(self):
        try:
            self.conn.Close()
        except Exception:
            pass


class PyodbcReader:
    """Read an Access database through the Microsoft Access ODBC driver (pyodbc)."""

    kind = "pyodbc"

    def __init__(self, path, password=None):
        import pyodbc  # raises ImportError if pyodbc is missing
        self._pyodbc = pyodbc
        drivers = [d for d in pyodbc.drivers() if "Access Driver" in d]
        if not drivers:
            raise RuntimeError("No 'Microsoft Access Driver' ODBC driver registered.")
        cs = f"DRIVER={{{drivers[0]}}};DBQ={os.path.abspath(path)};"
        if password:
            cs += f"PWD={password};"
        self.conn = pyodbc.connect(cs, autocommit=True)

    def list_tables(self):
        cur = self.conn.cursor()
        out = [
            row.table_name
            for row in cur.tables(tableType="TABLE")
            if not str(row.table_name).startswith(("MSys", "~"))
        ]
        cur.close()
        return sorted(out)

    def columns(self, table):
        cur = self.conn.cursor()
        cur.execute(f"SELECT * FROM [{table}] WHERE 1=0")
        cols = [(d[0], _py_affinity(d[1])) for d in cur.description]
        cur.close()
        return cols

    def count_rows(self, table):
        cur = self.conn.cursor()
        try:
            return int(cur.execute(f"SELECT COUNT(*) FROM [{table}]").fetchone()[0])
        finally:
            cur.close()

    def primary_keys(self, table):
        try:
            cur = self.conn.cursor()
            pks = [row.column_name for row in cur.primaryKeys(table)]
            cur.close()
            return pks
        except Exception:
            return []

    def iter_rows(self, table, batch=2000):
        cur = self.conn.cursor()
        cur.execute(f"SELECT * FROM [{table}]")
        while True:
            rows = cur.fetchmany(batch)
            if not rows:
                break
            for row in rows:
                yield tuple(_convert(v) for v in row)
        cur.close()

    def close(self):
        try:
            self.conn.close()
        except Exception:
            pass


def open_reader(path, backend, password):
    """Open the first working reader backend for `path`."""
    if backend == "ado":
        order = ["ado"]
    elif backend == "pyodbc":
        order = ["pyodbc"]
    else:
        order = ["ado", "pyodbc"]  # prefer ADO (no extra install needed)

    errors = []
    for kind in order:
        try:
            cls = AdoReader if kind == "ado" else PyodbcReader
            return cls(path, password)
        except Exception as e:
            errors.append(f"{kind}: {e}")
    raise RuntimeError("No working Access backend. Tried -> " + " | ".join(errors))


# --- Conversion ---------------------------------------------------------------
def convert_db(reader, out_path, only_tables=None, batch=2000):
    """Copy all (or selected) tables from `reader` into a fresh SQLite file."""
    out = sqlite3.connect(out_path)
    cur = out.cursor()
    cur.execute("PRAGMA journal_mode=OFF")
    cur.execute("PRAGMA synchronous=OFF")

    tables = reader.list_tables()
    if only_tables:
        wanted = {t.lower() for t in only_tables}
        tables = [t for t in tables if t.lower() in wanted]

    summary = []  # (table, n_cols, n_rows, error_or_None)
    for tbl in tables:
        try:
            cols = reader.columns(tbl)
            colnames = {c[0] for c in cols}
            pks = [p for p in reader.primary_keys(tbl) if p in colnames]

            coldefs = ", ".join(f"{_q(n)} {aff}" for n, aff in cols)
            pkclause = f", PRIMARY KEY ({', '.join(_q(p) for p in pks)})" if pks else ""

            cur.execute(f"DROP TABLE IF EXISTS {_q(tbl)}")
            cur.execute(f"CREATE TABLE {_q(tbl)} ({coldefs}{pkclause})")

            insert = f"INSERT INTO {_q(tbl)} VALUES ({', '.join('?' * len(cols))})"
            n, buf = 0, []
            for row in reader.iter_rows(tbl, batch):
                buf.append(row)
                n += 1
                if len(buf) >= batch:
                    cur.executemany(insert, buf)
                    buf.clear()
            if buf:
                cur.executemany(insert, buf)
            out.commit()

            summary.append((tbl, len(cols), n, None))
            print(f"  [ok]   {tbl}: {n} rows, {len(cols)} cols"
                  + (f", pk={pks}" if pks else ""))
        except Exception as e:
            out.rollback()
            summary.append((tbl, 0, 0, str(e)))
            print(f"  [SKIP] {tbl}: {e}", file=sys.stderr)

    out.commit()
    out.close()
    return summary


def main(argv=None):
    p = argparse.ArgumentParser(
        description="Convert a Microsoft Access database (.mdb/.accdb) to SQLite.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    p.add_argument("input", help="A .mdb/.accdb file, or a directory of them.")
    p.add_argument("output", nargs="?", help="Output .sqlite path (single-file input only).")
    p.add_argument("--force", action="store_true", help="Overwrite existing output file(s).")
    p.add_argument("--tables", help="Comma-separated list of tables to convert.")
    p.add_argument("--list", dest="list_only", action="store_true",
                   help="List tables and row counts without converting.")
    p.add_argument("--password", help="Database password, if protected.")
    p.add_argument("--backend", choices=["auto", "ado", "pyodbc"], default="auto",
                   help="Reader backend (default: auto).")
    args = p.parse_args(argv)

    # Resolve the input file list.
    if os.path.isdir(args.input):
        if args.output:
            p.error("OUTPUT must be omitted when INPUT is a directory.")
        inputs = [
            os.path.join(args.input, fn)
            for fn in sorted(os.listdir(args.input))
            if fn.lower().endswith((".mdb", ".accdb"))
        ]
        if not inputs:
            p.error(f"No .mdb/.accdb files found in: {args.input}")
    elif os.path.isfile(args.input):
        inputs = [args.input]
    else:
        p.error(f"Input not found: {args.input}")

    only = [t.strip() for t in args.tables.split(",")] if args.tables else None
    grand_total = 0

    for src in inputs:
        print(f"\n=== {src} ===")
        try:
            reader = open_reader(src, args.backend, args.password)
        except Exception as e:
            print(f"  ERROR opening: {e}", file=sys.stderr)
            continue

        try:
            print(f"  backend: {reader.kind}")
            if args.list_only:
                for t in reader.list_tables():
                    try:
                        n = reader.count_rows(t)
                    except Exception as e:
                        n = f"? ({e})"
                    print(f"  {t}: {n} rows")
                continue

            if len(inputs) == 1 and args.output:
                out_path = args.output
            else:
                out_path = os.path.splitext(src)[0] + ".sqlite"

            if os.path.exists(out_path) and not args.force:
                print(f"  ERROR: output exists (use --force): {out_path}", file=sys.stderr)
                continue
            if os.path.exists(out_path):
                os.remove(out_path)

            out_dir = os.path.dirname(os.path.abspath(out_path))
            os.makedirs(out_dir, exist_ok=True)

            print(f"  -> {out_path}")
            summary = convert_db(reader, out_path, only)
            ok = sum(1 for s in summary if s[3] is None)
            rows = sum(s[2] for s in summary)
            grand_total += rows
            print(f"  done: {ok}/{len(summary)} tables, {rows} rows")
        finally:
            reader.close()

    if not args.list_only and len(inputs) > 1:
        print(f"\nTotal rows copied across {len(inputs)} files: {grand_total}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
