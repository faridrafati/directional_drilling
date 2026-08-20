/**
 * Mud Inventory Transfer (§5.1, Add-ins > Utilities).
 *
 * The guide: "Use the Mud Additive Transfer utility to transfer the closing
 * balance of all bulk materials such as diesel and potable water (job supplies)
 * and mud additives (such as barite or detergents) from the previous well to
 * the newly created well." The stock left on the pad when one well finishes is
 * the stock the next well starts with, and re-typing it is how it goes wrong.
 *
 * A CLOSING BALANCE IS received − returned − consumed, summed over every amount
 * row of that product. WellView records those three on wvJobMudAddAmt and
 * wvJobSupplyAmt against a parent product row (wvJobMudAdd / wvJobSupply),
 * which in turn hangs off a job.
 *
 * A NEGATIVE BALANCE IS NEVER TRANSFERRED. In the sample database 225 of the
 * 343 additives with any movement come out negative — consumption recorded
 * against a receipt nobody entered — and 118 come out positive. Carrying a
 * negative across would open the new well holding minus nine sacks of gel,
 * which is not a quantity anyone can act on. They are reported as skipped, with
 * the balance, so the gap is visible rather than quietly rounded to zero.
 *
 * The transfer WRITES: a product row on the destination job if that product is
 * not already there, and one amount row carrying the whole balance as RECEIVED,
 * dated as the user chooses — the guide is explicit that the date decides which
 * report it lands on.
 */
import type { DatabaseSync } from "node:sqlite";

export interface InventoryItem {
  /** The source product record. */
  idrec: string;
  des: string | null;
  typ: string | null;
  unitLabel: string | null;
  unitSz: number | null;
  vendor: string | null;
  cost: number | null;
  received: number;
  consumed: number;
  returned: number;
  /** received − returned − consumed. */
  balance: number;
  /** Which table it came from. */
  kind: "mud" | "supply";
  /** False when the balance is not a quantity worth moving. */
  transferable: boolean;
  reason?: string;
}

const SETS = [
  { kind: "mud" as const, product: "wvJobMudAdd", amount: "wvJobMudAddAmt" },
  { kind: "supply" as const, product: "wvJobSupply", amount: "wvJobSupplyAmt" },
];

function tableExists(d: DatabaseSync, name: string): boolean {
  return (d.prepare(
    "SELECT COUNT(*) n FROM sqlite_master WHERE type='table' AND lower(name)=?")
    .get(name.toLowerCase()) as { n: number }).n > 0;
}

const num = (v: unknown): number => {
  if (v == null || v === "") return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** What a well has left, per product. */
export function closingInventory(d: DatabaseSync, idwell: string): InventoryItem[] {
  const out: InventoryItem[] = [];
  for (const s of SETS) {
    if (!tableExists(d, s.product) || !tableExists(d, s.amount)) continue;
    const rows = d.prepare(`
      SELECT p.IDRec AS idrec, p.Des AS des, p.Typ AS typ, p.UnitLabel AS unitLabel,
             p.UnitSz AS unitSz, p.Vendor AS vendor, p.Cost AS cost,
             SUM(COALESCE(a.Received,0)) AS received,
             SUM(COALESCE(a.Consumed,0)) AS consumed,
             SUM(COALESCE(a.Returned,0)) AS returned
        FROM "${s.product}" p
        JOIN "${s.amount}" a ON a.IDRecParent = p.IDRec
       WHERE p.idwell = ?
       GROUP BY p.IDRec
       ORDER BY p.Des`).all(idwell) as Record<string, unknown>[];

    for (const r of rows) {
      const received = num(r.received);
      const consumed = num(r.consumed);
      const returned = num(r.returned);
      const balance = received - returned - consumed;
      out.push({
        idrec: String(r.idrec),
        des: (r.des as string) ?? null,
        typ: (r.typ as string) ?? null,
        unitLabel: (r.unitLabel as string) ?? null,
        unitSz: r.unitSz == null ? null : num(r.unitSz),
        vendor: (r.vendor as string) ?? null,
        cost: r.cost == null ? null : num(r.cost),
        received, consumed, returned, balance,
        kind: s.kind,
        transferable: balance > 0,
        reason: balance > 0 ? undefined
          : balance === 0 ? "nothing left"
          : "the recorded consumption exceeds what was received, so there is no stock to carry",
      });
    }
  }
  return out;
}

export interface TransferResult {
  transferred: { des: string | null; kind: string; quantity: number; unit: string | null }[];
  skipped: { des: string | null; reason: string }[];
  /** Products already present on the destination job, so only stock was added. */
  reusedProducts: number;
  createdProducts: number;
}

/**
 * Move the chosen products' closing balances onto a job in another well.
 *
 * Everything happens in one transaction: a partial transfer would leave the
 * destination holding stock nobody can trace to a source.
 */
export function transferInventory(
  d: DatabaseSync,
  opts: {
    fromWell: string; toWell: string; toJob: string;
    dtTm: string; items: string[];
    newIdRec: () => string;
  },
): TransferResult {
  const available = closingInventory(d, opts.fromWell);
  const wanted = new Map(available.filter((i) => opts.items.includes(i.idrec)).map((i) => [i.idrec, i]));

  const res: TransferResult = { transferred: [], skipped: [], reusedProducts: 0, createdProducts: 0 };

  d.exec("BEGIN");
  try {
    for (const item of wanted.values()) {
      if (!item.transferable) {
        res.skipped.push({ des: item.des, reason: item.reason ?? "not transferable" });
        continue;
      }
      const set = SETS.find((s) => s.kind === item.kind)!;

      // Reuse a product of the same description already on the destination
      // job rather than creating a second row for the same material.
      const existing = d.prepare(
        `SELECT IDRec FROM "${set.product}" WHERE idwell = ? AND IDRecParent = ? AND Des IS ?`)
        .get(opts.toWell, opts.toJob, item.des) as { IDRec: string } | undefined;

      let productId: string;
      if (existing) {
        productId = existing.IDRec;
        res.reusedProducts++;
      } else {
        productId = opts.newIdRec();
        d.prepare(`
          INSERT INTO "${set.product}"
            (idwell, IDRec, IDRecParent, Des, Typ, UnitLabel, UnitSz, Vendor, Cost)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
          opts.toWell, productId, opts.toJob, item.des, item.typ,
          item.unitLabel, item.unitSz, item.vendor, item.cost,
        );
        res.createdProducts++;
      }

      d.prepare(`
        INSERT INTO "${set.amount}" (idwell, IDRec, IDRecParent, DtTm, Received, Note)
        VALUES (?, ?, ?, ?, ?, ?)`).run(
        opts.toWell, opts.newIdRec(), productId, opts.dtTm, item.balance,
        "Transferred inventory",
      );
      res.transferred.push({
        des: item.des, kind: item.kind, quantity: item.balance, unit: item.unitLabel,
      });
    }
    d.exec("COMMIT");
  } catch (e) {
    d.exec("ROLLBACK");
    throw e;
  }
  return res;
}
