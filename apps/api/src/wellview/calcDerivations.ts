/**
 * The wv*Calc aggregations this app computes, with their provenance.
 *
 * WellView builds these tables when a report prints and never stores them, so a
 * converted database contains none of the 110 the model declares. Each entry
 * below reproduces one of them from rows that ARE stored.
 *
 * HOW THESE WERE ESTABLISHED, and why the list is shorter than the model's:
 * each derivation was written against the real schema, run on the sample
 * database, and then handed to an INDEPENDENT check whose brief was to refute
 * it - re-deriving the totals by a different route (hand accumulation in JS
 * with no SQL join and no GROUP BY), testing the well and job scoping by
 * comparing against the unscoped result, and checking every column against
 * PRAGMA table_info. Only what survived that is registered here. What did not
 * is listed in UNDERIVED below, with the reason, so a missing block is a
 * recorded decision rather than an oversight.
 *
 * The model's HELP TEXT is the specification and decided several questions
 * outright - it states the exclusions ("Excludes all
 * <wvJobReportTimeLog.Inactive> records") and sometimes the equation itself
 * ("EQN: <wvJTLSumUnschedTypCalc.Duration>/<wvJob.DurationTimeLogTotalCalc>",
 * whose denominator excludes by a WORD in Code1, not by the Inactive flag -
 * the two differ on real data and only this table and wvJTLSumOpsCatCalc
 * declare that equation).
 *
 * Every number these produce is labelled `derived` all the way to the screen.
 * A computed figure must never be mistakable for one the database stored.
 */
import { registerCalc, type CalcDerivation } from "./calc.js";
import { surveyVsRows } from "./calcSurvey.js";
import { wellboreSummaryRows } from "./calcWellbore.js";

export const CALC_DERIVATIONS: CalcDerivation[] = [
  {
    // Also a projection, for the same reason: its TVD columns need the survey.
    // The SQL attempt was rejected for cross-well leakage — its fallback guard
    // asked whether the QUERIED WELL had size rows for a wellbore, never
    // whether the wellbore belonged to that well, so ten drill-param rows
    // naming another well's wellbore were the only rows it ever emitted.
    // Output here is 96 rows against 96 wvWellboreSize source rows, and the
    // model's drill-param fallback correctly yields nothing: no own-well
    // wellbore in this database lacks a size record.
    table: "wvWellboreSummaryCalc",
    sources: ["wvWellbore", "wvWellboreSize"],
    params: ["idwell"],
    compute: wellboreSummaryRows,
    unsupported: [
      { field: "IDRecJobDrillString", reason: "Only the wvJobDrillStringDrillParam fallback fills this, and no wellbore in this database triggers that branch — every one has wvWellboreSize records. The branch is implemented per the model's stated rule but is unexercised here." },
      { field: "DepthTVDTopActual", reason: "Null where the section top lies outside the wellbore's surveyed interval. It cannot be interpolated there, and extrapolating — TVD := MD above the first station, or a held-attitude tangent below the last — would print an assumption as a measurement. 35 of 96 sections have a TVD top." },
    ],
    verifiedBy: "96 output rows against 96 wvWellboreSize source rows; MudDensityMax non-null on 11, matching an independent count over wvJobReportMudChk; drill-param fallback emits 0 rows once wellbore ownership is enforced.",
  },
  {
    // NOT a query: a projection of the minimum-curvature engine in
    // packages/shared/src/math/survey.ts, which is tested there and already
    // handles the override carry-forward and inclination-only stations. The
    // SQL attempt at this table was rejected for filtering `Azimuth IS NOT
    // NULL`, which deleted 370 legal stations and blanked five surveys.
    table: "wvWDSVSDataCalc",
    sources: ["wvWellbore", "wvWellboreDirSurvey", "wvWellboreDirSurveyData"],
    params: ["idwell"],
    compute: surveyVsRows,
    verifiedBy: "Projects computeSurvey(), whose figures are pinned in packages/shared/src/math/survey.test.ts against a hand-worked minimum-curvature example.",
  },
  {
    // Confirmed: the checker re-derived the totals independently and they matched.
    // Their SQL vs my from-scratch JavaScript reimplementation over all 894 reports: 548
    // rows vs 548 rows; sum(Frequency) 13923 vs 13923; 0 mismatches, 0 rows unique to either
    // side. Sum of Frequency at last report of each job via correlated scalar subquery (not
    // their window function): 834, matching their
    table: "wvJRSafetyChkCalc",
    sources: ["wvJobSafetyChk","wvJobReport","wvJob"],
    params: ["idwell","idreport"],
    unsupported: [
      { field: "DurationNextChk", reason: "Implemented exactly as the model's EQN (wvJobSafetyChk.TypFrequency - DurationSinceLastChk), but wvJobSafetyChk.TypFrequency is NULL in 100% of the sample data: SELECT count(*), count(TypFrequency) FROM wvJobSafetyChk ->" },
      { field: "NextDtTm", reason: "Same root cause: depends on DurationNextChk, hence on the all-NULL TypFrequency column; NULL for every row of the sample DB. Additionally the model's own help is internally inconsistent — NextDtTm is documented as wvJobR" },
    ],
    verifiedBy: "Their SQL vs my from-scratch JavaScript reimplementation over all 894 reports: 548 rows vs 548 rows; sum(Frequency) 13923 vs 13923; 0 mismatches, 0 rows unique to either side. Sum of Frequency at last",
    sql: `
WITH rpt AS (
  SELECT r.idwell,
         r.IDRec        AS idreport,
         r.IDRecParent  AS idjob,
         r.DtTmStart    AS RptDtTmStart,
         r.DtTmEnd      AS RptDtTmEnd
  FROM   wvJobReport r
  WHERE  r.idwell = :idwell
    AND  r.IDRec  = :idreport
),
win AS (
  SELECT rpt.*, j.DtTmStart AS JobDtTmStart
  FROM   rpt
  JOIN   wvJob j ON j.idwell = rpt.idwell AND j.IDRec = rpt.idjob
),
chk AS (
  SELECT w.idwell, w.idreport, w.idjob, w.RptDtTmStart, w.RptDtTmEnd,
         s.Typ, s.DtTm, s.TypFrequency,
         COUNT(*)     OVER (PARTITION BY s.Typ)                                    AS Frequency,
         ROW_NUMBER() OVER (PARTITION BY s.Typ ORDER BY s.DtTm DESC, s.IDRec DESC) AS rn
  FROM   win w
  JOIN   wvJobSafetyChk s
         ON  s.idwell      = w.idwell
         AND s.IDRecParent = w.idjob
         AND s.DtTm       >= w.JobDtTmStart
         AND s.DtTm       <= w.RptDtTmEnd
)
SELECT
  idwell,
  idreport,
  Typ                                                           AS Typ,
  Frequency                                                     AS Frequency,
  DtTm                                                          AS LastDtTm,
  julianday(RptDtTmEnd) - julianday(DtTm)                       AS DurationSinceLastChk,
  TypFrequency - (julianday(RptDtTmEnd) - julianday(DtTm))      AS DurationNextChk,
  CASE WHEN TypFrequency IS NULL THEN NULL
       ELSE strftime('%Y-%m-%dT%H:%M:%SZ',
                     julianday(RptDtTmStart)
                     + (TypFrequency - (julianday(RptDtTmEnd) - julianday(DtTm))))
  END                                                           AS NextDtTm
FROM chk
WHERE rn = 1
ORDER BY Typ;
`,
  },
  {
    // Verification reported the query correct and reconciled its totals; the reservations it raised were about the write-up, not the SQL.
    // Their SQL: wellA 22 groups summing 48.33333457633853; wellB 18 groups summing
    // 44.18750005308539. My independent JS route (no SQL join, no GROUP BY, manual
    // accumulation over the raw rows reached via the wvJobReport IDRec set): 687 rows ->
    // 48.33333457633853 and 523 rows -> 44.18750005308539, 22 and 18
    table: "wvJTLSumCalc",
    sources: ["wvJobReportTimeLog","wvJobReport"],
    params: ["idwell","idjob"],
    verifiedBy: "Their SQL: wellA 22 groups summing 48.33333457633853; wellB 18 groups summing 44.18750005308539. My independent JS route (no SQL join, no GROUP BY, manual accumulation over the raw rows reached via th",
    sql: `
WITH tl AS (
  SELECT t.Code1, t.Code2, t.Code3, t.Code4, t.OpsCategory, t.UnschedTyp,
         COALESCE(t.Duration, 0) AS Duration
  FROM wvJobReportTimeLog t
  JOIN wvJobReport r ON r.IDRec = t.IDRecParent AND r.idwell = t.idwell
  WHERE t.idwell = :idwell
    AND r.IDRecParent = :idjob
    AND COALESCE(t.Inactive, 0) = 0
), tot AS (
  SELECT SUM(Duration) AS TotalDuration FROM tl
)
SELECT Code1,
       Code2,
       Code3,
       Code4,
       OpsCategory,
       UnschedTyp,
       SUM(Duration) AS Duration,
       CASE WHEN (SELECT TotalDuration FROM tot) > 0
            THEN SUM(Duration) / (SELECT TotalDuration FROM tot) END AS FractionTotalTime
FROM tl
GROUP BY Code1, Code2, Code3, Code4, OpsCategory, UnschedTyp
ORDER BY Duration DESC
`,
  },
  {
    // Confirmed: the checker re-derived the totals independently and they matched.
    // Their SQL wellA: 19 groups summing 48.33333457633853, SUM(Fraction)=1. My JS Map
    // recomputation over the 687 raw rows: 19 groups, same 19 values, summing
    // 48.33333457633853. wellB: their 9 groups / 44.18750005308539 vs my JS 9 groups /
    // 44.18750005308539. Grain cross-check: the 19 Code1 groups and the
    table: "wvJTLSumCode1Calc",
    sources: ["wvJobReportTimeLog","wvJobReport"],
    params: ["idwell","idjob"],
    verifiedBy: "Their SQL wellA: 19 groups summing 48.33333457633853, SUM(Fraction)=1. My JS Map recomputation over the 687 raw rows: 19 groups, same 19 values, summing 48.33333457633853. wellB: their 9 groups / 44.1",
    sql: `
WITH tl AS (
  SELECT t.Code1 AS grp, COALESCE(t.Duration, 0) AS Duration
  FROM wvJobReportTimeLog t
  JOIN wvJobReport r ON r.IDRec = t.IDRecParent AND r.idwell = t.idwell
  WHERE t.idwell = :idwell
    AND r.IDRecParent = :idjob
    AND COALESCE(t.Inactive, 0) = 0
), tot AS (
  SELECT SUM(Duration) AS TotalDuration FROM tl
)
SELECT grp AS Code1,
       SUM(Duration) AS Duration,
       CASE WHEN (SELECT TotalDuration FROM tot) > 0
            THEN SUM(Duration) / (SELECT TotalDuration FROM tot) END AS FractionTotalTime
FROM tl
GROUP BY grp
ORDER BY Duration DESC
`,
  },
  {
    // Confirmed: the checker re-derived the totals independently and they matched.
    // Their SQL wellA: 16 groups summing 48.33333457633853. Completely different route (JS
    // accumulation over raw rows keyed on Code2, no SQL GROUP BY): same 16 groups, same
    // total 48.33333457633853. wellB: 1 group / 44.18750005308539 both ways.
    // SUM(FractionTotalTime)=1.0 in both wells.
    table: "wvJTLSumCode2Calc",
    sources: ["wvJobReportTimeLog","wvJobReport"],
    params: ["idwell","idjob"],
    verifiedBy: "Their SQL wellA: 16 groups summing 48.33333457633853. Completely different route (JS accumulation over raw rows keyed on Code2, no SQL GROUP BY): same 16 groups, same total 48.33333457633853. wellB: 1",
    sql: `
WITH tl AS (
  SELECT t.Code2 AS grp, COALESCE(t.Duration, 0) AS Duration
  FROM wvJobReportTimeLog t
  JOIN wvJobReport r ON r.IDRec = t.IDRecParent AND r.idwell = t.idwell
  WHERE t.idwell = :idwell
    AND r.IDRecParent = :idjob
    AND COALESCE(t.Inactive, 0) = 0
), tot AS (
  SELECT SUM(Duration) AS TotalDuration FROM tl
)
SELECT grp AS Code2,
       SUM(Duration) AS Duration,
       CASE WHEN (SELECT TotalDuration FROM tot) > 0
            THEN SUM(Duration) / (SELECT TotalDuration FROM tot) END AS FractionTotalTime
FROM tl
GROUP BY grp
ORDER BY Duration DESC
`,
  },
  {
    // Confirmed: the checker re-derived the totals independently and they matched.
    // Their wellB rows: 37.093750 + 4.093750 + 3.000000 + 0 = 44.18750005308539. My
    // independent JS group-by over the raw 523 rows: Production 1=37.09375, Surface=4.09375,
    // Prespud=3, null=0, total 44.18750005308539. SQL ungrouped control over the same rows:
    // 44.18750005308539. wellA control: single null gro
    table: "wvJTLSumCode3Calc",
    sources: ["wvJobReportTimeLog","wvJobReport"],
    params: ["idwell","idjob"],
    verifiedBy: "Their wellB rows: 37.093750 + 4.093750 + 3.000000 + 0 = 44.18750005308539. My independent JS group-by over the raw 523 rows: Production 1=37.09375, Surface=4.09375, Prespud=3, null=0, total 44.1875000",
    sql: `
WITH tl AS (
  SELECT t.Code3 AS grp, COALESCE(t.Duration, 0) AS Duration
  FROM wvJobReportTimeLog t
  JOIN wvJobReport r ON r.IDRec = t.IDRecParent AND r.idwell = t.idwell
  WHERE t.idwell = :idwell
    AND r.IDRecParent = :idjob
    AND COALESCE(t.Inactive, 0) = 0
), tot AS (
  SELECT SUM(Duration) AS TotalDuration FROM tl
)
SELECT grp AS Code3,
       SUM(Duration) AS Duration,
       CASE WHEN (SELECT TotalDuration FROM tot) > 0
            THEN SUM(Duration) / (SELECT TotalDuration FROM tot) END AS FractionTotalTime
FROM tl
GROUP BY grp
ORDER BY Duration DESC
`,
  },
  {
    // Registered with the CORRECTED query: verification found a real defect in the original.
    // Their denominator on job 81F89674C78F41838A627D4513C6BD2C: 25.37500035762787
    // (Inactive-flag rule, 400 rows). The denominator the model EQN specifies
    // (wvJob.DurationTimeLogTotalCalc, Code1-word rule): 25.70833370089531 (401 rows). Ratio
    // 1.013136289 — their fractions run 1.3136% high on that job; SUM(
    table: "wvJTLSumUnschedTypCalc",
    sources: ["wvJobReportTimeLog","wvJobReport"],
    params: ["idwell","idjob"],
    verifiedBy: "Their denominator on job 81F89674C78F41838A627D4513C6BD2C: 25.37500035762787 (Inactive-flag rule, 400 rows). The denominator the model EQN specifies (wvJob.DurationTimeLogTotalCalc, Code1-word rule): ",
    sql: `
-- Numerator/grouping keep the table's own help rule (exclude Inactive records);
-- the DENOMINATOR follows the model EQN literally: wvJob.DurationTimeLogTotalCalc,
-- whose help excludes only rows with the word 'inactive' in Code1.
-- Identical to the original on 40 of 41 jobs; differs only on 81F89674C78F41838A627D4513C6BD2C.
WITH tl AS (
  SELECT t.UnschedTyp AS grp, COALESCE(t.Duration, 0) AS Duration
  FROM wvJobReportTimeLog t
  JOIN wvJobReport r ON r.IDRec = t.IDRecParent AND r.idwell = t.idwell
  WHERE t.idwell = :idwell AND r.IDRecParent = :idjob
    AND COALESCE(t.Inactive, 0) = 0
), tot AS (
  SELECT SUM(COALESCE(t.Duration, 0)) AS TotalDuration
  FROM wvJobReportTimeLog t
  JOIN wvJobReport r ON r.IDRec = t.IDRecParent AND r.idwell = t.idwell
  WHERE t.idwell = :idwell AND r.IDRecParent = :idjob
    AND LOWER(COALESCE(t.Code1, '')) NOT LIKE '%inactive%'
)
SELECT grp AS UnschedTyp,
       SUM(Duration) AS Duration,
       CASE WHEN (SELECT TotalDuration FROM tot) > 0
            THEN SUM(Duration) / (SELECT TotalDuration FROM tot) END AS FractionTotalTime
FROM tl
GROUP BY grp
ORDER BY Duration DESC
`,
  },
  {
    // Verification reported the query correct and reconciled its totals; the reservations it raised were about the write-up, not the SQL.
    // Grouped vs ungrouped for the two cited reports: 1.0000000353902578 both ways, and
    // 1.0000000009313226 both ways (confirmed). Rollup, computed independently: sum of this
    // query across all 49 reports of job 378AFF62 = 48.33333457633853 vs wvJTLSumCalc =
    // 48.33333457633853, 22 groups each, max per-group d
    table: "wvJRTLSumCalc",
    sources: ["wvJobReportTimeLog"],
    params: ["idwell","idreport"],
    verifiedBy: "Grouped vs ungrouped for the two cited reports: 1.0000000353902578 both ways, and 1.0000000009313226 both ways (confirmed). Rollup, computed independently: sum of this query across all 49 reports of j",
    sql: `
SELECT t.Code1,
       t.Code2,
       t.Code3,
       t.Code4,
       t.OpsCategory,
       t.UnschedTyp,
       SUM(COALESCE(t.Duration, 0)) AS Duration
FROM wvJobReportTimeLog t
WHERE t.idwell = :idwell
  AND t.IDRecParent = :idreport
  AND COALESCE(t.Inactive, 0) = 0
GROUP BY t.Code1, t.Code2, t.Code3, t.Code4, t.OpsCategory, t.UnschedTyp
ORDER BY Duration DESC
`,
  },
  {
    // Verification reported the query correct and reconciled its totals; the reservations it raised were about the write-up, not the SQL.
    // Their SQL vs independent JS path, all 51 jobs carrying cost: 44,092,616.71123139 vs
    // 44,092,616.71123139 (delta 0, 0 mismatching jobs, 0 differing row counts). RUN1 job
    // 70C1AE5A…: their 10 vendor rows sum 102,425; raw GROUP BY on wvJobReportCostGen for
    // that job = 94 rows / 102,425. RUN2 job 865C8C29…
    table: "wvJVendorCalc",
    sources: ["wvJobReportCostGen","wvJobReportCostRental","wvJobRentalItem","wvJobReport"],
    params: ["idwell","idjob"],
    verifiedBy: "Their SQL vs independent JS path, all 51 jobs carrying cost: 44,092,616.71123139 vs 44,092,616.71123139 (delta 0, 0 mismatching jobs, 0 differing row counts). RUN1 job 70C1AE5A…: their 10 vendor rows ",
    sql: `
WITH cost_rows AS (
    /* --- wvJobReportCostGen : one-time / general costs (Cost is stored) --- */
    SELECT r.IDRecParent AS idjob,
           g.IDRecParent AS idreport,
           g.Vendor      AS Vendor,
           g.TicketNo    AS TicketNo,
           g.Cost        AS Cost
    FROM   wvJobReportCostGen g
    JOIN   wvJobReport r ON r.IDRec = g.IDRecParent AND r.idwell = g.idwell
    WHERE  g.idwell = :idwell

    UNION ALL

    /* --- wvJobReportCostRental x wvJobRentalItem : recurring costs ---
       Cost is NOT stored; it is wvJobReportCostRental.CostRentalCalc, whose EQN is
       given verbatim in Peloton.WellView.mdl.xml:
         { [ <rateday> + <ratestandby> + <ratedepth>*<usedepth> + <ratehour>*<usehour>
             + <rateother>*<useother> + <costonetime> ] * <qty> }
       UseDay / UseStandby are physicaltype="boolean" ("Check ON if daily/standby charge
       is to apply"), so they gate the day and standby rates.  Vendor for a rental cost is
       wvJobReportCostRental.VendorCalc = <wvjobrentalitem.vendor>. */
    SELECT r.IDRecParent AS idjob,
           cr.IDRecParent AS idreport,
           ri.Vendor      AS Vendor,
           COALESCE(NULLIF(TRIM(cr.TicketNo), ''), ri.TicketNo) AS TicketNo,
           ( COALESCE(CASE WHEN cr.UseDay     = 1 THEN ri.RateDay     END, 0)
           + COALESCE(CASE WHEN cr.UseStandby = 1 THEN ri.RateStandby END, 0)
           + COALESCE(ri.RateDepth * cr.UseDepth, 0)
           + COALESCE(ri.RateHour  * cr.UseHour , 0)
           + COALESCE(ri.RateOther * cr.UseOther, 0)
           + COALESCE(cr.CostOneTime, 0)
           ) * COALESCE(cr.Qty, 1) AS Cost
    FROM   wvJobReportCostRental cr
    JOIN   wvJobReport r        ON r.IDRec  = cr.IDRecParent         AND r.idwell  = cr.idwell
    LEFT JOIN wvJobRentalItem ri ON ri.IDRec = cr.IDRecJobRentalItem AND ri.idwell = cr.idwell
    WHERE  cr.idwell = :idwell
)
SELECT MIN(Vendor) AS Vendor,
       SUM(Cost)   AS Cost
FROM   cost_rows
WHERE  idjob = :idjob
GROUP  BY UPPER(TRIM(COALESCE(Vendor,'')))
ORDER  BY Vendor;
`,
  },
  {
    // Registered with the CORRECTED query: verification found a real defect in the original.
    // Their ticket SQL vs independent JS path, all 51 jobs: 44,092,616.71123139 vs
    // 44,092,616.71123139, delta 0, 0 mismatching jobs. Pump Repair job 2AACFAF6…: their 7
    // rows vs a raw GROUP BY on wvJobReportCostGen with no CTE and no rental branch —
    // identical to the cent (Centrilift 4310/12754/17763, Pool W
    table: "wvJVendorTicketNoCalc",
    sources: ["wvJobReportCostGen","wvJobReportCostRental","wvJobRentalItem","wvJobReport"],
    params: ["idwell","idjob"],
    verifiedBy: "Their ticket SQL vs independent JS path, all 51 jobs: 44,092,616.71123139 vs 44,092,616.71123139, delta 0, 0 mismatching jobs. Pump Repair job 2AACFAF6…: their 7 rows vs a raw GROUP BY on wvJobReportC",
    sql: `
WITH cost_rows AS (
    SELECT r.IDRecParent AS idjob,
           g.IDRecParent AS idreport,
           g.Vendor      AS Vendor,
           g.TicketNo    AS TicketNo,
           g.Cost        AS Cost
    FROM   wvJobReportCostGen g
    JOIN   wvJobReport r ON r.IDRec = g.IDRecParent AND r.idwell = g.idwell
    WHERE  g.idwell = :idwell

    UNION ALL

    SELECT r.IDRecParent AS idjob,
           cr.IDRecParent AS idreport,
           ri.Vendor      AS Vendor,
           COALESCE(NULLIF(TRIM(cr.TicketNo), ''), ri.TicketNo) AS TicketNo,
           ( COALESCE(CASE WHEN cr.UseDay     = 1 THEN ri.RateDay     END, 0)
           + COALESCE(CASE WHEN cr.UseStandby = 1 THEN ri.RateStandby END, 0)
           + COALESCE(ri.RateDepth * cr.UseDepth, 0)
           + COALESCE(ri.RateHour  * cr.UseHour , 0)
           + COALESCE(ri.RateOther * cr.UseOther, 0)
           + COALESCE(cr.CostOneTime, 0)
           ) * COALESCE(cr.Qty, 1) AS Cost
    FROM   wvJobReportCostRental cr
    JOIN   wvJobReport r        ON r.IDRec  = cr.IDRecParent         AND r.idwell  = cr.idwell
    LEFT JOIN wvJobRentalItem ri ON ri.IDRec = cr.IDRecJobRentalItem AND ri.idwell = cr.idwell
    WHERE  cr.idwell = :idwell
)
, agg AS (
    SELECT UPPER(TRIM(COALESCE(Vendor,'')))   AS vkey,
           MIN(Vendor)   AS VendorGrp,
           MIN(TicketNo) AS TicketNo,
           SUM(Cost)     AS Cost
    FROM   cost_rows
    WHERE  idjob = :idjob
    GROUP  BY UPPER(TRIM(COALESCE(Vendor,''))), UPPER(TRIM(COALESCE(TicketNo,'')))
)
/* Vendor is the PARENT key: take MIN over the whole vendor partition, not per
   (vendor,ticket) group, so every child emits the identical string wvJVendorCalc
   emits even when one job carries two case-spellings of the same vendor. */
SELECT MIN(VendorGrp) OVER (PARTITION BY vkey) AS Vendor,
       TicketNo,
       Cost
FROM   agg
ORDER  BY Vendor, TicketNo;
`,
  },
  {
    // Confirmed: the checker re-derived the totals independently and they matched.
    // CostAFE: query 43,951,269 vs raw SUM(wvJobAFECost.Amount) 43,951,269. CostAFESup:
    // 125,000 vs 125,000. CostFinalInvoice: 13,227,500 vs raw
    // SUM(wvJobAFEFinalInvoiceCost.Amount) 13,227,500. CostFieldEst: query 43,179,604.7112
    // vs (gen 37,251,398.7109 + gated rental 5,928,206.0003) 43,179,604.7112. Indep
    table: "wvJAFECostCumCalc",
    sources: ["wvJobAFE","wvJobAFECost","wvJobAFEFinalInvoiceCost","wvJobReportCostGen","wvJobReportCostRental","wvJobRentalItem","wvJobReport","wvJob"],
    params: ["idwell","idjob"],
    verifiedBy: "CostAFE: query 43,951,269 vs raw SUM(wvJobAFECost.Amount) 43,951,269. CostAFESup: 125,000 vs 125,000. CostFinalInvoice: 13,227,500 vs raw SUM(wvJobAFEFinalInvoiceCost.Amount) 13,227,500. CostFieldEst:",
    sql: `
WITH job AS (
  SELECT IDRec AS idjob, COALESCE(CurrencyExchangeRate, 1.0) AS fx
  FROM wvJob
  WHERE idwell = :idwell AND IDRec = :idjob
),
afe AS (
  SELECT IDRec AS idafe, AFENumber, AFENumberSupp, sysSeq
  FROM wvJobAFE
  WHERE idwell = :idwell AND IDRecParent = :idjob AND COALESCE(Exclude, 0) = 0
),
afecnt AS (SELECT COUNT(*) AS n FROM afe),
fld AS (
  SELECT g.IDRecAFECustom AS idafecustom,
         g.Des, g.Code1, g.Code2, g.Code3, g.Code4, g.Code5, g.Code6,
         COALESCE(g.Cost, 0) AS Cost
  FROM wvJobReportCostGen g
  JOIN wvJobReport r ON r.IDRec = g.IDRecParent AND r.idwell = g.idwell
  WHERE g.idwell = :idwell AND r.IDRecParent = :idjob
  UNION ALL
  SELECT c.IDRecAFECustom,
         i.Des, i.Code1, i.Code2, i.Code3, i.Code4, i.Code5, i.Code6,
         ( CASE WHEN c.UseDay = 1     THEN COALESCE(i.RateDay, 0)     ELSE 0 END
         + CASE WHEN c.UseStandby = 1 THEN COALESCE(i.RateStandby, 0) ELSE 0 END
         + COALESCE(i.RateDepth, 0) * COALESCE(c.UseDepth, 0)
         + COALESCE(i.RateHour,  0) * COALESCE(c.UseHour,  0)
         + COALESCE(i.RateOther, 0) * COALESCE(c.UseOther, 0)
         + COALESCE(c.CostOneTime, 0)
         ) * COALESCE(c.Qty, 1)
  FROM wvJobReportCostRental c
  JOIN wvJobReport r ON r.IDRec = c.IDRecParent AND r.idwell = c.idwell
  LEFT JOIN wvJobRentalItem i ON i.IDRec = c.IDRecJobRentalItem AND i.idwell = c.idwell
  WHERE c.idwell = :idwell AND r.IDRecParent = :idjob
),
measures AS (
  SELECT ac.IDRecParent AS idafe, ac.Des,
         ac.Code1, ac.Code2, ac.Code3, ac.Code4, ac.Code5, ac.Code6,
         COALESCE(ac.Amount, 0) AS mAFE, COALESCE(ac.AmountSupp, 0) AS mSupp,
         0.0 AS mFinal, 0.0 AS mField
  FROM wvJobAFECost ac
  JOIN afe a ON a.idafe = ac.IDRecParent
  WHERE ac.idwell = :idwell
  UNION ALL
  SELECT fi.IDRecParent, fi.Des,
         fi.Code1, fi.Code2, fi.Code3, fi.Code4, fi.Code5, fi.Code6,
         0.0, 0.0, COALESCE(fi.Amount, 0), 0.0
  FROM wvJobAFEFinalInvoiceCost fi
  JOIN afe a ON a.idafe = fi.IDRecParent
  WHERE fi.idwell = :idwell
  UNION ALL
  SELECT a.idafe, f.Des,
         f.Code1, f.Code2, f.Code3, f.Code4, f.Code5, f.Code6,
         0.0, 0.0, 0.0,
         CASE WHEN f.idafecustom IS NULL
              THEN f.Cost * 1.0 / (SELECT n FROM afecnt)
              ELSE f.Cost END
  FROM fld f
  JOIN afe a ON f.idafecustom IS NULL OR f.idafecustom = a.idafe
)
SELECT
  :idwell                                       AS idwell,
  m.idafe                                       AS IDRecParent,
  a.AFENumber                                   AS AFENumber,
  a.AFENumberSupp                               AS AFENumberSupp,
  m.Des                                         AS Des,
  m.Code1 AS Code1, m.Code2 AS Code2, m.Code3 AS Code3,
  m.Code4 AS Code4, m.Code5 AS Code5, m.Code6 AS Code6,
  SUM(m.mAFE)                                   AS CostAFE,
  SUM(m.mSupp)                                  AS CostAFESup,
  SUM(m.mAFE) + SUM(m.mSupp)                    AS CostAFETotal,
  SUM(m.mField)                                 AS CostFieldEst,
  SUM(m.mFinal)                                 AS CostFinalInvoice,
  SUM(m.mAFE) + SUM(m.mSupp) - SUM(m.mField)    AS CostVar,
  SUM(m.mAFE) + SUM(m.mSupp) - SUM(m.mFinal)    AS CostAFEFinalVar,
  SUM(m.mField) - SUM(m.mFinal)                 AS CostFieldFinalVar,
  SUM(m.mAFE)  * j.fx                           AS CostNormAFE,
  SUM(m.mSupp) * j.fx                           AS CostNormAFESup,
  (SUM(m.mAFE) + SUM(m.mSupp)) * j.fx           AS CostNormAFETotal,
  SUM(m.mField) * j.fx                          AS CostNormFieldEst,
  SUM(m.mFinal) * j.fx                          AS CostNormFinalInvoice,
  (SUM(m.mAFE) + SUM(m.mSupp) - SUM(m.mField)) * j.fx AS CostNormVar,
  (SUM(m.mAFE) + SUM(m.mSupp) - SUM(m.mFinal)) * j.fx AS CostNormAFEFinalVar,
  (SUM(m.mField) - SUM(m.mFinal)) * j.fx        AS CostNormFieldFinalVar
FROM measures m
JOIN afe a ON a.idafe = m.idafe
CROSS JOIN job j
GROUP BY m.idafe, m.Des, m.Code1, m.Code2, m.Code3, m.Code4, m.Code5, m.Code6
ORDER BY a.sysSeq, m.Code1, m.Code2, m.Code3, m.Code4, m.Code5, m.Code6, m.Des
`,
  },
  {
    // Confirmed: the checker re-derived the totals independently and they matched.
    // Method 1 (their SQL) vs Method 2 (completely independent: raw rows pulled into JS,
    // aggregated with Maps, no SQL aggregation/CTE/join at all) over all 13 fluid-bearing
    // reports plus 2 empty-period reports and all 7 jobs: 40 comparisons, 40 agree, 0
    // mismatch, compared at 15 significant digits. Method 3
    table: "wvJRFluidsCalc",
    sources: ["wvJobReportFluidsWell","wvJobReportFluidsLease","wvJobReport"],
    params: ["idwell","idreport"],
    verifiedBy: "Method 1 (their SQL) vs Method 2 (completely independent: raw rows pulled into JS, aggregated with Maps, no SQL aggregation/CTE/join at all) over all 13 fluid-bearing reports plus 2 empty-period repor",
    sql: `
WITH rpt AS (
  SELECT r.IDRec AS idreport, r.IDRecParent AS idjob, r.DtTmStart, r.DtTmEnd
  FROM wvJobReport r WHERE r.idwell = :idwell AND r.IDRec = :idreport
),
scope AS (
  SELECT r.IDRec AS idrpt FROM wvJobReport r JOIN rpt ON r.IDRecParent = rpt.idjob
  WHERE r.idwell = :idwell AND r.DtTmStart <= rpt.DtTmStart
),
src AS (
  SELECT IDRecParent AS idrpt, FluidTyp, 0.0 AS ToLease, 0.0 AS FromLease,
         COALESCE(ToWell,0) AS ToWell, COALESCE(FromWell,0) AS FromWell, COALESCE(NonRecov,0) AS NonRecov
  FROM wvJobReportFluidsWell WHERE idwell = :idwell
  UNION ALL
  SELECT IDRecParent, FluidTyp, COALESCE(ToLease,0), COALESCE(FromLease,0), 0.0, 0.0, 0.0
  FROM wvJobReportFluidsLease WHERE idwell = :idwell
),
g AS (
  SELECT s.FluidTyp AS FluidTyp,
    SUM(CASE WHEN s.idrpt = rpt.idreport THEN s.ToWell    ELSE 0 END) AS ToWell,
    SUM(s.ToWell)                                                     AS CumToWell,
    SUM(CASE WHEN s.idrpt = rpt.idreport THEN s.FromWell  ELSE 0 END) AS FromWell,
    SUM(s.FromWell)                                                   AS CumFromWell,
    SUM(CASE WHEN s.idrpt = rpt.idreport THEN s.ToLease   ELSE 0 END) AS ToLease,
    SUM(s.ToLease)                                                    AS CumToLease,
    SUM(CASE WHEN s.idrpt = rpt.idreport THEN s.FromLease ELSE 0 END) AS FromLease,
    SUM(s.FromLease)                                                  AS CumFromLease,
    SUM(CASE WHEN s.idrpt = rpt.idreport THEN s.NonRecov  ELSE 0 END) AS NonRecov,
    SUM(s.NonRecov)                                                   AS CumNonRecov,
    rpt.idjob AS IDRecJob, rpt.DtTmStart AS DtTmStart, rpt.DtTmEnd AS DtTmEnd
  FROM src s JOIN scope sc ON sc.idrpt = s.idrpt CROSS JOIN rpt
  GROUP BY s.FluidTyp, rpt.idjob, rpt.DtTmStart, rpt.DtTmEnd
)
SELECT FluidTyp, ToWell, CumToWell, FromWell, CumFromWell, ToLease, CumToLease,
       FromLease, CumFromLease, NonRecov, CumNonRecov,
       CumToWell - CumFromWell - CumNonRecov               AS LeftToRecover,
       CumToLease - CumFromLease - CumToWell + CumFromWell AS InTanks,
       IDRecJob, DtTmStart, DtTmEnd
FROM g ORDER BY FluidTyp
`,
  },
  {
    // Confirmed: the checker re-derived the totals independently and they matched.
    // Method 1 (their SQL) vs Method 2 (independent JS aggregation over raw rows, no SQL
    // aggregation): all 7 jobs, 0 mismatch at 15 significant digits. Method 3 (different
    // grouping — roll their own wvJFluidsActionCalc up over ActionTyp): reproduces
    // wvJFluidsCalc row-for-row on all 7 jobs, 0 mismatch. Dril
    table: "wvJFluidsCalc",
    sources: ["wvJobReportFluidsWell","wvJobReportFluidsLease","wvJobReport"],
    params: ["idwell","idjob"],
    verifiedBy: "Method 1 (their SQL) vs Method 2 (independent JS aggregation over raw rows, no SQL aggregation): all 7 jobs, 0 mismatch at 15 significant digits. Method 3 (different grouping — roll their own wvJFluid",
    sql: `
WITH src AS (
  SELECT IDRecParent AS idrpt, FluidTyp, 0.0 AS ToLease, 0.0 AS FromLease,
         COALESCE(ToWell,0) AS ToWell, COALESCE(FromWell,0) AS FromWell, COALESCE(NonRecov,0) AS NonRecov
  FROM wvJobReportFluidsWell WHERE idwell = :idwell
  UNION ALL
  SELECT IDRecParent, FluidTyp, COALESCE(ToLease,0), COALESCE(FromLease,0), 0.0, 0.0, 0.0
  FROM wvJobReportFluidsLease WHERE idwell = :idwell
),
g AS (
  SELECT s.FluidTyp AS FluidTyp,
    SUM(s.ToWell) AS ToWell, SUM(s.FromWell) AS FromWell, SUM(s.NonRecov) AS NonRecov,
    SUM(s.ToLease) AS ToLease, SUM(s.FromLease) AS FromLease
  FROM src s JOIN wvJobReport r ON r.IDRec = s.idrpt AND r.idwell = :idwell
  WHERE r.IDRecParent = :idjob GROUP BY s.FluidTyp
)
SELECT FluidTyp, ToWell, FromWell, ToLease, FromLease, NonRecov,
       ToWell - FromWell - NonRecov            AS LeftToRecover,
       ToLease - FromLease - ToWell + FromWell AS InTanks
FROM g ORDER BY FluidTyp
`,
  },
  {
    // Confirmed: the checker re-derived the totals independently and they matched.
    // Method 1 (their SQL) vs Method 2 (independent JS aggregation from raw rows, Maps
    // only): all 13 fluid-bearing reports plus 2 empty-period reports, 0 mismatch at 15
    // significant digits. Method 3 (different grouping — collapse ActionTyp and compare
    // against their wvJRFluidsCalc): 18 of 18 report/job comp
    table: "wvJRFluidsActionCalc",
    sources: ["wvJobReportFluidsWell","wvJobReportFluidsLease","wvJobReport"],
    params: ["idwell","idreport"],
    verifiedBy: "Method 1 (their SQL) vs Method 2 (independent JS aggregation from raw rows, Maps only): all 13 fluid-bearing reports plus 2 empty-period reports, 0 mismatch at 15 significant digits. Method 3 (differe",
    sql: `
WITH rpt AS (
  SELECT r.IDRec AS idreport, r.IDRecParent AS idjob, r.DtTmStart
  FROM wvJobReport r WHERE r.idwell = :idwell AND r.IDRec = :idreport
),
scope AS (
  SELECT r.IDRec AS idrpt FROM wvJobReport r JOIN rpt ON r.IDRecParent = rpt.idjob
  WHERE r.idwell = :idwell AND r.DtTmStart <= rpt.DtTmStart
),
src AS (
  SELECT IDRecParent AS idrpt, FluidTyp, ActionTyp, 0.0 AS ToLease, 0.0 AS FromLease,
         COALESCE(ToWell,0) AS ToWell, COALESCE(FromWell,0) AS FromWell, COALESCE(NonRecov,0) AS NonRecov
  FROM wvJobReportFluidsWell WHERE idwell = :idwell
  UNION ALL
  SELECT IDRecParent, FluidTyp, ActionTyp, COALESCE(ToLease,0), COALESCE(FromLease,0), 0.0, 0.0, 0.0
  FROM wvJobReportFluidsLease WHERE idwell = :idwell
),
g AS (
  SELECT s.FluidTyp AS FluidTyp, s.ActionTyp AS ActionTyp,
    SUM(CASE WHEN s.idrpt = rpt.idreport THEN s.ToWell    ELSE 0 END) AS ToWell,
    SUM(s.ToWell)                                                     AS CumToWell,
    SUM(CASE WHEN s.idrpt = rpt.idreport THEN s.FromWell  ELSE 0 END) AS FromWell,
    SUM(s.FromWell)                                                   AS CumFromWell,
    SUM(CASE WHEN s.idrpt = rpt.idreport THEN s.ToLease   ELSE 0 END) AS ToLease,
    SUM(s.ToLease)                                                    AS CumToLease,
    SUM(CASE WHEN s.idrpt = rpt.idreport THEN s.FromLease ELSE 0 END) AS FromLease,
    SUM(s.FromLease)                                                  AS CumFromLease,
    SUM(CASE WHEN s.idrpt = rpt.idreport THEN s.NonRecov  ELSE 0 END) AS NonRecov,
    SUM(s.NonRecov)                                                   AS CumNonRecov
  FROM src s JOIN scope sc ON sc.idrpt = s.idrpt CROSS JOIN rpt
  GROUP BY s.FluidTyp, s.ActionTyp
)
SELECT FluidTyp, ActionTyp, ToWell, CumToWell, FromWell, CumFromWell, ToLease, CumToLease,
       FromLease, CumFromLease, NonRecov, CumNonRecov,
       CumToWell - CumFromWell - CumNonRecov               AS LeftToRecover,
       CumToLease - CumFromLease - CumToWell + CumFromWell AS InTanks
FROM g ORDER BY FluidTyp, ActionTyp
`,
  },
  {
    // Confirmed: the checker re-derived the totals independently and they matched.
    // Method 1 (their SQL) vs Method 2 (independent JS aggregation over raw rows, no SQL
    // aggregation): all 7 jobs, 0 mismatch at 15 significant digits. Method 3 (different
    // grouping — roll this table up over ActionTyp and compare to their wvJFluidsCalc):
    // agrees on all 7 jobs. Drilling Mud rolls up to ToWel
    table: "wvJFluidsActionCalc",
    sources: ["wvJobReportFluidsWell","wvJobReportFluidsLease","wvJobReport"],
    params: ["idwell","idjob"],
    verifiedBy: "Method 1 (their SQL) vs Method 2 (independent JS aggregation over raw rows, no SQL aggregation): all 7 jobs, 0 mismatch at 15 significant digits. Method 3 (different grouping — roll this table up over",
    sql: `
WITH src AS (
  SELECT IDRecParent AS idrpt, FluidTyp, ActionTyp, 0.0 AS ToLease, 0.0 AS FromLease,
         COALESCE(ToWell,0) AS ToWell, COALESCE(FromWell,0) AS FromWell, COALESCE(NonRecov,0) AS NonRecov
  FROM wvJobReportFluidsWell WHERE idwell = :idwell
  UNION ALL
  SELECT IDRecParent, FluidTyp, ActionTyp, COALESCE(ToLease,0), COALESCE(FromLease,0), 0.0, 0.0, 0.0
  FROM wvJobReportFluidsLease WHERE idwell = :idwell
),
g AS (
  SELECT s.FluidTyp AS FluidTyp, s.ActionTyp AS ActionTyp,
    SUM(s.ToWell) AS ToWell, SUM(s.FromWell) AS FromWell, SUM(s.NonRecov) AS NonRecov,
    SUM(s.ToLease) AS ToLease, SUM(s.FromLease) AS FromLease
  FROM src s JOIN wvJobReport r ON r.IDRec = s.idrpt AND r.idwell = :idwell
  WHERE r.IDRecParent = :idjob GROUP BY s.FluidTyp, s.ActionTyp
)
SELECT FluidTyp, ActionTyp, ToWell, FromWell, ToLease, FromLease, NonRecov,
       ToWell - FromWell - NonRecov            AS LeftToRecover,
       ToLease - FromLease - ToWell + FromWell AS InTanks
FROM g ORDER BY FluidTyp, ActionTyp
`,
  },
  {
    // Confirmed: the checker re-derived the totals independently and they matched.
    // CALC (last row of every zone/ActivityTyp window block) vs SOURCE (independent JS
    // accumulation over raw child rows, no SQL joins), all 16 wells, 0 mismatches: oil
    // 252130.48695135117 vs 252130.48695135117 (8FBEC7DA) ; 94100.00 vs 94100.00 (BC3D92BA)
    // water 292869.87043082714 vs 292869.87043082714 (8FBE
    table: "wvZoneProdTypDataCalc",
    sources: ["wvProduction","wvProductionLiquid","wvProductionGas","wvProductionDownTime"],
    params: ["idwell"],
    verifiedBy: "CALC (last row of every zone/ActivityTyp window block) vs SOURCE (independent JS accumulation over raw child rows, no SQL joins), all 16 wells, 0 mismatches: oil 252130.48695135117 vs 252130.486951351",
    sql: `
WITH per AS (
  SELECT
    p.idwell                                        AS idwell,
    p.IDRec                                         AS IDRecProduction,
    p.IDRecZone                                     AS IDRecZone,
    p.ActivityTyp                                   AS ActivityTyp,
    p.DtTmStart                                     AS DtTmStart,
    p.DtTmEnd                                       AS DtTmEnd,
    julianday(p.DtTmEnd) - julianday(p.DtTmStart)   AS DurationTot,
    COALESCE(dn.DurDown, 0.0)                       AS DurationDown,
    COALESCE(lq.VolOil,   0.0)                      AS VolumeOil,
    COALESCE(lq.VolWater, 0.0)                      AS VolumeWater,
    COALESCE(lq.VolCond,  0.0)                      AS VolumeCond,
    COALESCE(lq.VolOther, 0.0)                      AS VolumeLiquidOther,
    COALESCE(gs.VolResGas, 0.0)                     AS VolumeResGas,
    COALESCE(gs.VolOther,  0.0)                     AS VolumeGasOther
  FROM wvProduction p
  LEFT JOIN (
      SELECT idwell, IDRecParent, SUM(Duration) AS DurDown
      FROM wvProductionDownTime WHERE idwell = :idwell GROUP BY idwell, IDRecParent
  ) dn ON dn.idwell = p.idwell AND dn.IDRecParent = p.IDRec
  LEFT JOIN (
      SELECT idwell, IDRecParent,
             SUM(CASE WHEN ProductTyp = 'Oil'        THEN Volume ELSE 0 END) AS VolOil,
             SUM(CASE WHEN ProductTyp = 'Water'      THEN Volume ELSE 0 END) AS VolWater,
             SUM(CASE WHEN ProductTyp = 'Condensate' THEN Volume ELSE 0 END) AS VolCond,
             SUM(CASE WHEN ProductTyp IS NULL
                       OR ProductTyp NOT IN ('Oil','Water','Condensate') THEN Volume ELSE 0 END) AS VolOther
      FROM wvProductionLiquid WHERE idwell = :idwell GROUP BY idwell, IDRecParent
  ) lq ON lq.idwell = p.idwell AND lq.IDRecParent = p.IDRec
  LEFT JOIN (
      SELECT idwell, IDRecParent,
             SUM(CASE WHEN ProductTyp = 'Reservoir Gas' THEN Volume ELSE 0 END) AS VolResGas,
             SUM(CASE WHEN ProductTyp IS NULL
                       OR ProductTyp <> 'Reservoir Gas' THEN Volume ELSE 0 END) AS VolOther
      FROM wvProductionGas WHERE idwell = :idwell GROUP BY idwell, IDRecParent
  ) gs ON gs.idwell = p.idwell AND gs.IDRecParent = p.IDRec
  WHERE p.idwell = :idwell
),
run AS (
  SELECT per.*,
    (DurationTot - DurationDown) AS DurationProd,
    SUM(DurationTot - DurationDown) OVER w AS DurationProdCum,
    SUM(DurationDown)              OVER w AS DurationDownCum,
    SUM(VolumeOil)                 OVER w AS VolumeCumOil,
    SUM(VolumeWater)               OVER w AS VolumeCumWater,
    SUM(VolumeCond)                OVER w AS VolumeCumCond,
    SUM(VolumeLiquidOther)         OVER w AS VolumeCumLiquidOther,
    SUM(VolumeResGas)              OVER w AS VolumeCumResGas,
    SUM(VolumeGasOther)            OVER w AS VolumeCumGasOther
  FROM per
  WINDOW w AS (PARTITION BY IDRecZone, ActivityTyp
               ORDER BY DtTmStart, IDRecProduction
               ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)
)
SELECT
  IDRecZone, ActivityTyp, IDRecProduction,
  DtTmStart, DtTmEnd,
  DurationProd, DurationDown, DurationProdCum, DurationDownCum,
  VolumeOil, VolumeWater, VolumeCond, VolumeLiquidOther, VolumeResGas, VolumeGasOther,
  VolumeCumOil, VolumeCumWater, VolumeCumCond, VolumeCumLiquidOther, VolumeCumResGas, VolumeCumGasOther,
  VolumeOil          / NULLIF(DurationProd, 0) AS RateOil,
  VolumeWater        / NULLIF(DurationProd, 0) AS RateWater,
  VolumeCond         / NULLIF(DurationProd, 0) AS RateCondensate,
  VolumeLiquidOther  / NULLIF(DurationProd, 0) AS RateLiquidOther,
  VolumeResGas       / NULLIF(DurationProd, 0) AS RateResGas,
  VolumeGasOther     / NULLIF(DurationProd, 0) AS RateGasOther,
  DurationDown       / NULLIF(DurationTot, 0)                       AS RatioDurationDown,
  DurationProd       / NULLIF(DurationTot, 0)                       AS RatioDurationProd,
  DurationDownCum    / NULLIF(DurationDownCum + DurationProdCum, 0)  AS RatioDurationCumDown,
  DurationProdCum    / NULLIF(DurationDownCum + DurationProdCum, 0)  AS RatioDurationCumProd,
  VolumeResGas       / NULLIF(VolumeOil, 0)                          AS RatioResGasOil,
  VolumeWater        / NULLIF(VolumeOil, 0)                          AS RatioWaterOil,
  VolumeWater        / NULLIF(VolumeResGas, 0)                       AS RatioWaterResGas
FROM run
ORDER BY IDRecZone, ActivityTyp, DtTmStart, IDRecProduction
`,
  },
  {
    // Registered with the CORRECTED query: verification found a real defect in the original.
    // Row counts: THEIRS 20+4+10 = 34 rows vs 34 wvProblem rows with resolvable TK (of 42
    // total; TK mix wvrodcomp 21 / wvtubcomp 10 / wvcascomp 3 / NULL 8). 0 dangling refs, 0
    // duplicate (idwell, IDRec) in wvTubComp/wvRodComp/wvCasComp. Field-by-field vs
    // independent JS single-row lookups: 32 fields x 34 ro
    table: "wvProblemDetailCalc",
    sources: ["wvProblem","wvTubComp","wvTub","wvRodComp","wvRod","wvCasComp","wvCas","wvOtherStrComp","wvOtherStr","wvOtherInHole","wvWellheadComp","wvWellhead","wvPumpingUnit","wvPrimeMover"],
    params: ["idwell"],
    unsupported: [
      { field: "Connect", reason: "No column named 'Connect' exists in any of the 264 tables. A regex scan for /connect/i over the whole inventory returns only wvJobReport.GasConnectionAvg/Max and wvTubCompSensor.ConnectTyp, neither of which is a failed-i" },
      { field: "EquipTyp", reason: "No column named 'EquipTyp' exists in any table (/equip/i matches only wvCas.TravelEquipWt, wvJobDrillString.TravelEquipWt, wvProblem.DurEquipInService, wvWellTestTrans.SurfaceTestEquip). wvPumpingUnit.Typ and wvWellhead." },
      { field: "PitmanPos", reason: "The only PitmanPos column in the database is wvProdSettingRodPump.PitmanPos — a rod-pump OPERATING SETTING record, with no link path from wvProblem.IDRecFailedItem. wvPumpingUnit stores only PitmanPosMax (which is mapped" },
      { field: "WeightCum", reason: "No stored column anywhere (/weightcum|cumweight|wtcum/i returns nothing). It would be a cumulative string weight (running sum of Length x WtPerLength down the string), i.e. itself a print-time string calc, and the string" },
      { field: "DepthBtm", reason: "Stored only on wvOtherInHole (mapped). wvTubComp / wvRodComp / wvCasComp / wvOtherStrComp have NO bottom-depth column, and reconstructing it from the string does not check out: wvTub 1699FEAE DepthBtm 2786.786 vs SUM(com" },
      { field: "DepthTop", reason: "Same as DepthBtm: stored only on wvOtherInHole. For string components the query returns DepthTopCorrected, which is an OVERRIDE column, not the computed running top depth — and it is populated in only 7 of 90 wvRodComp r" },
      { field: "Coating", reason: "Fillable only from wvRodComp.Coating and wvOtherInHole.Coating. wvTubComp and wvOtherStrComp store CoatingInner AND CoatingOuter (two columns, no single Coating) — left NULL rather than silently picking one; wvCasComp ha" },
      { field: "UserTxt2", reason: "Only wvPumpingUnit has UserTxt2. wvWellheadComp has a single 'Usertxt' (mapped to UserTxt1) and the string component tables have no user-text columns (their parent strings do, but those belong to the string, not the fail" },
      { field: "ConditionRun / ConditionPull (surface equipment only)", reason: "Filled for wvTubComp/wvRodComp/wvOtherStrComp/wvOtherInHole. wvPumpingUnit and wvPrimeMover instead store ConditionStart/ConditionEnd, which is a service-period condition rather than a run/pull condition; equating them i" },
      { field: "IDRecJob (string components)", reason: "Only wvPumpingUnit/wvPrimeMover (own IDRecJob) and wvWellheadComp (parent wvWellhead.IDRecJob) can fill it. A tubing/rod/casing component has no single job link — it has run and pull jobs, which are mapped to IDRecJobRun" },
      { field: "Cost / Grade / Length / WtPerLength / TensileMax / UsedClass / TorqueMin / TorqueMax / PresBurst / PresCollapse / SzDrift / SzIDNom / TempRating / Material / CompSubTyp / GuideDes / GuideMaterial / GuidesPerRod / GuideSz / MinBore / PackoffType / Sect / Service / RingGasketBtm / RingGasketTop / WorkPres / WorkPresBtm / WorkPresTop / DtTmStart / DtTmEnd / DtTmOrig / DtTmLastOverhaul / CrankTyp / GearBox* / LoadPolishRodMax / PitmanPosMax / StrokeLengthMax / SzSheave / PMTyp / PowerRating / RPMRating / ServiceFact / Belt*", reason: "NOT a gap — listed for completeness. These are inherently per-branch: the calc is a union over eight unrelated equipment tables, so each field is non-null only for the component types whose table actually carries it (e.g" },
    ],
    verifiedBy: "Row counts: THEIRS 20+4+10 = 34 rows vs 34 wvProblem rows with resolvable TK (of 42 total; TK mix wvrodcomp 21 / wvtubcomp 10 / wvcascomp 3 / NULL 8). 0 dangling refs, 0 duplicate (idwell, IDRec) in w",
    sql: `
SELECT
  p.IDRec                       AS IDRecProblem,
  p.IDRecFailedItem             AS IDRecFailedItem,
  lower(p.IDRecFailedItemTK)    AS IDRecFailedItemTK,
  pm.BeltLength AS BeltLength,
  pm.BeltNo AS BeltNo,
  pm.BeltXSect AS BeltXSect,
  -- FIX: wvTubComp and wvOtherStrComp spell this CoatingInner/CoatingOuter, not Coating.
  -- Without the extra arms, 30 wvTubComp rows carrying CoatingInner='MONEL' returned NULL.
  COALESCE(rc.Coating, oh.Coating, tc.CoatingInner, tc.CoatingOuter, oc.CoatingInner, oc.CoatingOuter) AS Coating,
  COALESCE(tc.Com, rc.Com, cc.Com, oc.Com, oh.Com, wc.Com, pu.Com, pm.Com) AS Com,
  COALESCE(tc.CompSubTyp, rc.CompSubTyp, cc.CompSubTyp, oh.CompSubTyp) AS CompSubTyp,
  COALESCE(tc.ConditionPull, rc.ConditionPull, oc.ConditionPull, oh.ConditionPull) AS ConditionPull,
  COALESCE(tc.ConditionRun, rc.ConditionRun, oc.ConditionRun, oh.ConditionRun) AS ConditionRun,
  NULL AS Connect,
  COALESCE(tc.ConnSzBtm, rc.ConnSzBtm, cc.ConnSzBtm, oc.ConnSzBtm, wc.ConnBtmSz) AS ConnSzBtm,
  COALESCE(tc.ConnSzTop, rc.ConnSzTop, cc.ConnSzTop, oc.ConnSzTop, wc.ConnTopSz) AS ConnSzTop,
  COALESCE(tc.ConnThrdBtm, rc.ConnThrdBtm, cc.ConnThrdBtm, oc.ConnThrdBtm, wc.ConnBtmTyp) AS ConnThrdBtm,
  COALESCE(tc.ConnThrdTop, rc.ConnThrdTop, cc.ConnThrdTop, oc.ConnThrdTop, wc.ConnTopTyp) AS ConnThrdTop,
  COALESCE(tc.Cost, rc.Cost, cc.Cost, oc.Cost, oh.Cost) AS Cost,
  pu.CrankTyp AS CrankTyp,
  oh.DepthBtm AS DepthBtm,          -- string components: no component-level bottom depth exists; NULL is correct
  COALESCE(tc.DepthTopCorrected, rc.DepthTopCorrected, cc.DepthTopCorrected, oc.DepthTopCorrected, oh.DepthTop) AS DepthTop,  -- override column only: populated on 7 of 874 string components
  COALESCE(tc.Des, rc.Des, cc.Des, oc.Des, oh.Des, wc.Des, pu.Des) AS Des,
  COALESCE(wc.DtTmEnd, pu.DtTmEnd, pm.DtTmEnd) AS DtTmEnd,
  COALESCE(pu.DtTmLastOverhaul, pm.DtTmLastOverhaul) AS DtTmLastOverhaul,
  wc.DtTmOrig AS DtTmOrig,
  COALESCE(ts.DtTmPull, rs.DtTmPull, cs.DtTmPull, os.DtTmPull, oh.DtTmPull) AS DtTmPull,
  COALESCE(ts.DtTmRun, rs.DtTmRun, cs.DtTmRun, os.DtTmRun, oh.DtTmRun) AS DtTmRun,
  COALESCE(wc.DtTmStart, pu.DtTmStart, pm.DtTmStart) AS DtTmStart,
  NULL AS EquipTyp,
  pu.GearBoxDes AS GearBoxDes,
  pu.GearBoxRatio AS GearBoxRatio,
  pu.GearBoxSN AS GearBoxSN,
  pu.GearBoxTorqueMaxIn AS GearBoxTorqueMaxIn,
  COALESCE(tc.Grade, rc.Grade, cc.Grade, oc.Grade) AS Grade,
  rc.GuideDes AS GuideDes,
  rc.GuideMaterial AS GuideMaterial,
  rc.GuidesPerRod AS GuidesPerRod,
  rc.GuideSz AS GuideSz,
  COALESCE(ws.IDRecJob, pu.IDRecJob, pm.IDRecJob) AS IDRecJob,
  COALESCE(ts.IDRecJobPull, rs.IDRecJobPull, cs.IDRecJobPull, os.IDRecJobPull, oh.IDRecJobPull) AS IDRecJobPull,
  COALESCE(ts.IDRecJobRun, rs.IDRecJobRun, cs.IDRecJobRun, os.IDRecJobRun, oh.IDRecJobRun) AS IDRecJobRun,
  COALESCE(rc.IDRecParent, pu.IDRecRod, pm.IDRecRod) AS IDRecRod,
  COALESCE(tc.IDRecParent, cc.IDRecParent, oc.IDRecParent, rs.IDRecTub, oh.IDRecString) AS IDRecString,
  COALESCE(ts.IDRecWellBore, rs.IDRecWellBore, cs.IDRecWellBore, os.IDRecWellBore, oh.IDRecWellBore) AS IDRecWellBore,
  COALESCE(ts.LatPosition, cs.LatPosition, os.LatPosition, oh.LatPosition) AS LatPosition,
  COALESCE(tc.Length, rc.Length, cc.Length, oc.Length) AS Length,
  pu.LoadPolishRodMax AS LoadPolishRodMax,
  COALESCE(tc.Make, rc.Make, cc.Make, oc.Make, oh.Make, wc.Make, pu.Make, pm.Make) AS Make,
  COALESCE(tc.Material, rc.Material, cc.Material, oc.Material, oh.Material) AS Material,
  wc.MinBore AS MinBore,
  COALESCE(tc.Model, rc.Model, cc.Model, oc.Model, oh.Model, wc.Model, pu.Model, pm.Model) AS Model,
  wc.PackoffType AS PackoffType,
  NULL AS PitmanPos,
  pu.PitmanPosMax AS PitmanPosMax,
  pm.PMTyp AS PMTyp,
  pm.PowerRating AS PowerRating,
  COALESCE(tc.PresBurst, cc.PresBurst, oc.PresBurst) AS PresBurst,
  COALESCE(tc.PresCollapse, cc.PresCollapse, oc.PresCollapse) AS PresCollapse,
  COALESCE(ts.ProposedPull, rs.ProposedPull, cs.ProposedPull, os.ProposedPull, oh.ProposedPull) AS ProposedPull,
  COALESCE(ts.ProposedRun, rs.ProposedRun, cs.ProposedRun, os.ProposedRun, oh.ProposedRun) AS ProposedRun,
  COALESCE(ts.PullReason, rs.PullReason, cs.PullReason, os.PullReason, oh.PullReason) AS PullReason,
  wc.RingGasketBtm AS RingGasketBtm,
  wc.RingGasketTop AS RingGasketTop,
  pm.RPMRating AS RPMRating,
  wc.Sect AS Sect,
  wc.Service AS Service,
  pm.ServiceFact AS ServiceFact,
  COALESCE(tc.SN, rc.SN, cc.SN, oc.SN, oh.SN, wc.SN, pu.SN, pm.SN) AS SN,
  pu.StrokeLengthMax AS StrokeLengthMax,
  COALESCE(tc.SzDrift, cc.SzDrift, oc.SzDrift, oh.SzDrift) AS SzDrift,
  COALESCE(tc.SzIDNom, cc.SzIDNom, oc.SzIDNom, oh.SzIDNom) AS SzIDNom,
  COALESCE(tc.SzODMax, rc.SzODMax, cc.SzODMax, oc.SzODMax, oh.SzODMax) AS SzODMax,
  COALESCE(tc.SzODNom, rc.SzODNom, cc.SzODNom, oc.SzODNom, oh.SzODNom) AS SzODNom,
  COALESCE(pu.SzSheave, pm.SzSheave) AS SzSheave,
  COALESCE(tc.TempRating, oc.TempRating, oh.TempRating) AS TempRating,
  COALESCE(tc.TensileMax, rc.TensileMax, cc.TensileMax, oc.TensileMax) AS TensileMax,
  COALESCE(tc.TorqueMin, cc.TorqueMin, oc.TorqueMin) AS TorqueMin,
  COALESCE(tc.TorqueMax, cc.TorqueMax, oc.TorqueMax) AS TorqueMax,
  COALESCE(tc.UsedClass, rc.UsedClass, cc.UsedClass) AS UsedClass,
  COALESCE(wc.Usertxt, pu.UserTxt1) AS UserTxt1,
  pu.UserTxt2 AS UserTxt2,
  NULL AS WeightCum,
  wc.WorkPres AS WorkPres,
  wc.WorkPresBtm AS WorkPresBtm,
  wc.WorkPresTop AS WorkPresTop,
  COALESCE(tc.WtPerLength, rc.WtPerLength, cc.WtPerLength, oc.WtPerLength) AS WtPerLength
FROM wvProblem p
LEFT JOIN wvTubComp      tc ON lower(p.IDRecFailedItemTK) = 'wvtubcomp'      AND tc.idwell = p.idwell AND tc.IDRec = p.IDRecFailedItem
LEFT JOIN wvTub          ts ON ts.idwell = tc.idwell AND ts.IDRec = tc.IDRecParent
LEFT JOIN wvRodComp      rc ON lower(p.IDRecFailedItemTK) = 'wvrodcomp'      AND rc.idwell = p.idwell AND rc.IDRec = p.IDRecFailedItem
LEFT JOIN wvRod          rs ON rs.idwell = rc.idwell AND rs.IDRec = rc.IDRecParent
LEFT JOIN wvCasComp      cc ON lower(p.IDRecFailedItemTK) = 'wvcascomp'      AND cc.idwell = p.idwell AND cc.IDRec = p.IDRecFailedItem
LEFT JOIN wvCas          cs ON cs.idwell = cc.idwell AND cs.IDRec = cc.IDRecParent
LEFT JOIN wvOtherStrComp oc ON lower(p.IDRecFailedItemTK) = 'wvotherstrcomp' AND oc.idwell = p.idwell AND oc.IDRec = p.IDRecFailedItem
LEFT JOIN wvOtherStr     os ON os.idwell = oc.idwell AND os.IDRec = oc.IDRecParent
LEFT JOIN wvOtherInHole  oh ON lower(p.IDRecFailedItemTK) = 'wvotherinhole'  AND oh.idwell = p.idwell AND oh.IDRec = p.IDRecFailedItem
LEFT JOIN wvWellheadComp wc ON lower(p.IDRecFailedItemTK) = 'wvwellheadcomp' AND wc.idwell = p.idwell AND wc.IDRec = p.IDRecFailedItem
LEFT JOIN wvWellhead     ws ON ws.idwell = wc.idwell AND ws.IDRec = wc.IDRecParent
LEFT JOIN wvPumpingUnit  pu ON lower(p.IDRecFailedItemTK) = 'wvpumpingunit'  AND pu.idwell = p.idwell AND pu.IDRec = p.IDRecFailedItem
LEFT JOIN wvPrimeMover   pm ON lower(p.IDRecFailedItemTK) = 'wvprimemover'   AND pm.idwell = p.idwell AND pm.IDRec = p.IDRecFailedItem
WHERE p.idwell = :idwell
  AND COALESCE(tc.IDRec, rc.IDRec, cc.IDRec, oc.IDRec, oh.IDRec, wc.IDRec, pu.IDRec, pm.IDRec) IS NOT NULL
-- FIX: datamodel.json declares wvProblemDetailCalc.sqlOrderBy = 'DtTmStart, DtTmEnd, Des'
ORDER BY COALESCE(wc.DtTmStart, pu.DtTmStart, pm.DtTmStart),
         COALESCE(wc.DtTmEnd, pu.DtTmEnd, pm.DtTmEnd),
         COALESCE(tc.Des, rc.Des, cc.Des, oc.Des, oh.Des, wc.Des, pu.Des),
         p.IDRec
`,
  },
  {
    // Verification reported the query correct and reconciled its totals; the reservations it raised were about the write-up, not the SQL.
    // Their query total for report 4991A7F7C2F64BB1B22B8C0C0E50D327 = 473972.3701171875 (38
    // rows). Recomputed a completely different way - two independent ungrouped SUMs, no CTE,
    // no UNION: gen SUM(Cost) = 248834.3701171875 over 27 rows; rental formula SUM = 225138
    // over 11 rows; 248834.3701171875 + 225138
    table: "wvJRCostCalc",
    sources: ["wvJobReportCostGen","wvJobReportCostRental","wvJobRentalItem","wvJobReport"],
    params: ["idwell","idreport"],
    verifiedBy: "Their query total for report 4991A7F7C2F64BB1B22B8C0C0E50D327 = 473972.3701171875 (38 rows). Recomputed a completely different way - two independent ungrouped SUMs, no CTE, no UNION: gen SUM(Cost) = 2",
    sql: `
WITH jrcost AS (
  SELECT g.idwell                AS idwell,
         g.IDRecParent           AS IDRecJobReport,
         'gen'                   AS SrcTyp,
         g.sysSeq                AS SrcSeq,
         g.Code1, g.Code2, g.Code3, g.Code4, g.Code5, g.Code6,
         g.Cost                  AS Cost,
         g.Des                   AS Des,
         g.IDRecAFECustom        AS IDRecAFECustom,
         g.IDRecPhaseCustom      AS IDRecPhaseCustom,
         g.Note, g.OpsCategory, g.PONo, g.SN, g.TicketNo,
         g.UnschedTyp, g.UserTxt1, g.Vendor
  FROM wvJobReportCostGen g
  WHERE g.idwell = :idwell
  UNION ALL
  SELECT r.idwell,
         r.IDRecParent,
         'rental',
         r.sysSeq,
         i.Code1, i.Code2, i.Code3, i.Code4, i.Code5, i.Code6,
         ( COALESCE(i.RateDay,0)     * COALESCE(r.UseDay,0)
         + COALESCE(i.RateStandby,0) * COALESCE(r.UseStandby,0)
         + COALESCE(i.RateDepth,0)   * COALESCE(r.UseDepth,0)
         + COALESCE(i.RateHour,0)    * COALESCE(r.UseHour,0)
         + COALESCE(i.RateOther,0)   * COALESCE(r.UseOther,0)
         + COALESCE(r.CostOneTime,0) ) * COALESCE(r.Qty,1),
         i.Des,
         r.IDRecAFECustom,
         r.IDRecPhaseCustom,
         r.Note, r.OpsCategory, i.PONo, r.SN, r.TicketNo,
         r.UnschedTyp, r.UserTxt1, i.Vendor
  FROM wvJobReportCostRental r
  JOIN wvJobRentalItem i
    ON i.IDRec = r.IDRecJobRentalItem AND i.idwell = r.idwell
  WHERE r.idwell = :idwell
)
SELECT Code1, Code2, Code3, Code4, Code5, Code6,
       Cost, Des, IDRecAFECustom, IDRecPhaseCustom, Note, OpsCategory,
       PONo, SN, TicketNo, UnschedTyp, UserTxt1, Vendor
FROM jrcost
WHERE IDRecJobReport = :idreport
ORDER BY SrcTyp, SrcSeq;
`,
  },
  {
    // Confirmed: the checker re-derived the totals independently and they matched.
    // THREE independent computations of the same job: (1) Their query, summed over its 28
    // output rows = 10127291.467214966. (2) Two plain ungrouped SUMs over the raw sources:
    // gen 4464525.467214966 (649 rows) + rental 5662766 (291 rows) = 10127291.467214966.
    // MATCH. (3) A COMPLETELY different implementation
    table: "wvJCostSumDailyDesCalc",
    sources: ["wvJobReportCostGen","wvJobReportCostRental","wvJobRentalItem","wvJobReport","wvJob"],
    params: ["idwell","idjob"],
    verifiedBy: "THREE independent computations of the same job: (1) Their query, summed over its 28 output rows = 10127291.467214966. (2) Two plain ungrouped SUMs over the raw sources: gen 4464525.467214966 (649 rows",
    sql: `
WITH jrcost AS (
  SELECT r.IDRecParent AS IDRecJob, g.Des AS Des, g.Cost AS Cost
  FROM wvJobReportCostGen g
  JOIN wvJobReport r ON r.IDRec = g.IDRecParent AND r.idwell = g.idwell
  WHERE g.idwell = :idwell
  UNION ALL
  SELECT rp.IDRecParent, i.Des,
         ( COALESCE(i.RateDay,0)     * COALESCE(x.UseDay,0)
         + COALESCE(i.RateStandby,0) * COALESCE(x.UseStandby,0)
         + COALESCE(i.RateDepth,0)   * COALESCE(x.UseDepth,0)
         + COALESCE(i.RateHour,0)    * COALESCE(x.UseHour,0)
         + COALESCE(i.RateOther,0)   * COALESCE(x.UseOther,0)
         + COALESCE(x.CostOneTime,0) ) * COALESCE(x.Qty,1)
  FROM wvJobReportCostRental x
  JOIN wvJobReport rp ON rp.IDRec = x.IDRecParent AND rp.idwell = x.idwell
  JOIN wvJobRentalItem i ON i.IDRec = x.IDRecJobRentalItem AND i.idwell = x.idwell
  WHERE x.idwell = :idwell
)
SELECT c.Des                                                AS Des,
       SUM(c.Cost)                                          AS Cost,
       SUM(c.Cost) * COALESCE(j.CurrencyExchangeRate, 1.0)  AS CostNorm
FROM jrcost c
JOIN wvJob j ON j.IDRec = c.IDRecJob AND j.idwell = :idwell
WHERE c.IDRecJob = :idjob
GROUP BY c.Des
ORDER BY c.Des;
`,
  },
  {
    // Confirmed: the checker re-derived the totals independently and they matched.
    // Their evidence figures, all reproduced by running their SQL: SUM(CostAFE)=10218000,
    // SUM(CostAFESup)=125000, SUM(CostAFETotal)=10343000,
    // SUM(CostFieldEst)=10127291.467214966, SUM(CostFinalInvoice)=10217000,
    // SUM(CostVar)=215708.53278503427, SUM(CostAFEFinalVar)=126000,
    // SUM(CostFieldFinalVar)=-89708.53
    table: "wvJCostCumCalc",
    sources: ["wvJobAFE","wvJobAFECost","wvJobAFEFinalInvoiceCost","wvJobReportCostGen","wvJobReportCostRental","wvJobRentalItem","wvJobReport","wvJob"],
    params: ["idwell","idjob"],
    verifiedBy: "Their evidence figures, all reproduced by running their SQL: SUM(CostAFE)=10218000, SUM(CostAFESup)=125000, SUM(CostAFETotal)=10343000, SUM(CostFieldEst)=10127291.467214966, SUM(CostFinalInvoice)=1021",
    sql: `
WITH fieldcost AS (                       -- wvJRCostCalc rows for this job
  SELECT r.IDRecParent AS IDRecJob,
         g.Code1, g.Code2, g.Code3, g.Code4, g.Code5, g.Code6, g.Des,
         g.Cost AS Cost, g.IDRecAFECustom AS IDRecAFECustom
  FROM wvJobReportCostGen g
  JOIN wvJobReport r ON r.IDRec = g.IDRecParent AND r.idwell = g.idwell
  WHERE g.idwell = :idwell
  UNION ALL
  SELECT rp.IDRecParent,
         i.Code1, i.Code2, i.Code3, i.Code4, i.Code5, i.Code6, i.Des,
         ( COALESCE(i.RateDay,0)     * COALESCE(x.UseDay,0)
         + COALESCE(i.RateStandby,0) * COALESCE(x.UseStandby,0)
         + COALESCE(i.RateDepth,0)   * COALESCE(x.UseDepth,0)
         + COALESCE(i.RateHour,0)    * COALESCE(x.UseHour,0)
         + COALESCE(i.RateOther,0)   * COALESCE(x.UseOther,0)
         + COALESCE(x.CostOneTime,0) ) * COALESCE(x.Qty,1),
         x.IDRecAFECustom
  FROM wvJobReportCostRental x
  JOIN wvJobReport rp ON rp.IDRec = x.IDRecParent AND rp.idwell = x.idwell
  JOIN wvJobRentalItem i ON i.IDRec = x.IDRecJobRentalItem AND i.idwell = x.idwell
  WHERE x.idwell = :idwell
),
parts AS (
  -- AFE budget amounts (wvJobAFE.Exclude = 1 dropped)
  SELECT c.Code1,c.Code2,c.Code3,c.Code4,c.Code5,c.Code6,c.Des,
         COALESCE(c.Amount,0) AS CostAFE, COALESCE(c.AmountSupp,0) AS CostAFESup,
         0 AS CostFinalInvoice, 0 AS CostFieldEst
  FROM wvJobAFECost c
  JOIN wvJobAFE a ON a.IDRec = c.IDRecParent AND a.idwell = c.idwell
  WHERE c.idwell = :idwell AND a.IDRecParent = :idjob AND COALESCE(a.Exclude,0) = 0
  UNION ALL
  -- final invoiced amounts
  SELECT f.Code1,f.Code2,f.Code3,f.Code4,f.Code5,f.Code6,f.Des,
         0, 0, COALESCE(f.Amount,0), 0
  FROM wvJobAFEFinalInvoiceCost f
  JOIN wvJobAFE a ON a.IDRec = f.IDRecParent AND a.idwell = f.idwell
  WHERE f.idwell = :idwell AND a.IDRecParent = :idjob AND COALESCE(a.Exclude,0) = 0
  UNION ALL
  -- field estimates; a cost hard-allocated to an excluded AFE is dropped
  SELECT fc.Code1,fc.Code2,fc.Code3,fc.Code4,fc.Code5,fc.Code6,fc.Des,
         0, 0, 0, COALESCE(fc.Cost,0)
  FROM fieldcost fc
  WHERE fc.IDRecJob = :idjob
    AND NOT EXISTS (SELECT 1 FROM wvJobAFE a
                    WHERE a.IDRec = fc.IDRecAFECustom AND a.idwell = :idwell
                      AND COALESCE(a.Exclude,0) = 1)
)
SELECT p.Code1, p.Code2, p.Code3, p.Code4, p.Code5, p.Code6, p.Des,
       SUM(p.CostAFE)                                   AS CostAFE,
       SUM(p.CostAFESup)                                AS CostAFESup,
       SUM(p.CostAFE) + SUM(p.CostAFESup)               AS CostAFETotal,
       SUM(p.CostFieldEst)                              AS CostFieldEst,
       SUM(p.CostFinalInvoice)                          AS CostFinalInvoice,
       SUM(p.CostAFE) + SUM(p.CostAFESup) - SUM(p.CostFieldEst)      AS CostVar,
       SUM(p.CostAFE) + SUM(p.CostAFESup) - SUM(p.CostFinalInvoice)  AS CostAFEFinalVar,
       SUM(p.CostFieldEst) - SUM(p.CostFinalInvoice)                 AS CostFieldFinalVar,
       SUM(p.CostAFE)                     * COALESCE(j.CurrencyExchangeRate,1.0) AS CostNormAFE,
       SUM(p.CostAFESup)                  * COALESCE(j.CurrencyExchangeRate,1.0) AS CostNormAFESup,
      (SUM(p.CostAFE)+SUM(p.CostAFESup))  * COALESCE(j.CurrencyExchangeRate,1.0) AS CostNormAFETotal,
       SUM(p.CostFieldEst)                * COALESCE(j.CurrencyExchangeRate,1.0) AS CostNormFieldEst,
       SUM(p.CostFinalInvoice)            * COALESCE(j.CurrencyExchangeRate,1.0) AS CostNormFinalInvoice,
      (SUM(p.CostAFE)+SUM(p.CostAFESup)-SUM(p.CostFieldEst))     * COALESCE(j.CurrencyExchangeRate,1.0) AS CostNormVar,
      (SUM(p.CostAFE)+SUM(p.CostAFESup)-SUM(p.CostFinalInvoice)) * COALESCE(j.CurrencyExchangeRate,1.0) AS CostNormAFEFinalVar,
      (SUM(p.CostFieldEst)-SUM(p.CostFinalInvoice))              * COALESCE(j.CurrencyExchangeRate,1.0) AS CostNormFieldFinalVar
FROM parts p
CROSS JOIN wvJob j
WHERE j.IDRec = :idjob AND j.idwell = :idwell
GROUP BY p.Code1, p.Code2, p.Code3, p.Code4, p.Code5, p.Code6, p.Des
ORDER BY p.Code1, p.Code2, p.Code3, p.Code4, p.Code5, p.Code6, p.Des;
`,
  },
  {
    // Confirmed: the checker re-derived the totals independently and they matched.
    table: "wvJPPTLCalc",
    sources: ["wvJobProgramPhase","wvJobReportTimeLog","wvJobReport"],
    params: ["idwell"],
    verifiedBy: "independent recomputation",
    sql: `
WITH ph AS (
  SELECT p.IDRec AS IDRecPhase, p.IDRecParent AS idjob, p.sysSeq AS PhaseSeq,
         p.Code1 AS PhaseCode1, p.Code2 AS PhaseCode2,
         julianday(replace(replace(p.DtTmStartActual,'T',' '),'Z','')) AS jdPS,
         julianday(replace(replace(p.DtTmEndActual  ,'T',' '),'Z','')) AS jdPE
  FROM wvJobProgramPhase p
  WHERE p.idwell = :idwell
    AND p.DtTmStartActual IS NOT NULL AND p.DtTmEndActual IS NOT NULL
),
tl AS (
  SELECT r.IDRecParent AS idjob,
         t.Code1, t.Code2, t.Code3, t.Code4, t.OpsCategory, t.UnschedTyp,
         t.Duration, COALESCE(t.Inactive,0) AS Inactive,
         julianday(replace(replace(r.DtTmStart,'T',' '),'Z','')) +
           COALESCE(SUM(t.Duration) OVER (PARTITION BY t.IDRecParent
             ORDER BY t.sysSeq ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING), 0) AS jdS
  FROM wvJobReportTimeLog t
  JOIN wvJobReport r ON r.IDRec = t.IDRecParent AND r.idwell = t.idwell
  WHERE t.idwell = :idwell AND r.DtTmStart IS NOT NULL
)
SELECT ph.IDRecPhase AS IDRecParent, ph.PhaseSeq, ph.PhaseCode1, ph.PhaseCode2,
       tl.Code1, tl.Code2, tl.Code3, tl.Code4, tl.OpsCategory, tl.UnschedTyp,
       ROUND(SUM(MIN(tl.jdS + tl.Duration, ph.jdPE) - MAX(tl.jdS, ph.jdPS)), 8) AS Duration
FROM ph
JOIN tl ON tl.idjob = ph.idjob
       AND tl.jdS               <  ph.jdPE - 1.0/86400
       AND tl.jdS + tl.Duration >  ph.jdPS + 1.0/86400
WHERE tl.Inactive = 0
GROUP BY ph.IDRecPhase, tl.Code1, tl.Code2, tl.Code3, tl.Code4, tl.OpsCategory, tl.UnschedTyp
HAVING Duration > 1.0/86400
ORDER BY ph.PhaseSeq, Duration DESC
`,
  },
  {
    // Confirmed: the checker re-derived the totals independently and they matched.
    table: "wvJPPActivitySumCalc",
    sources: ["wvJobProgramPhaseActivity","wvJobProgramPhase","wvJobReportTimeLog","wvJobReport"],
    params: ["idwell"],
    verifiedBy: "independent recomputation",
    sql: `
WITH ph AS (
  SELECT p.IDRec AS IDRecPhase, p.IDRecParent AS idjob, p.sysSeq AS PhaseSeq,
         p.Code1 AS PhaseCode1, p.Code2 AS PhaseCode2,
         julianday(replace(replace(p.DtTmStartActual,'T',' '),'Z','')) AS jdPS,
         julianday(replace(replace(p.DtTmEndActual  ,'T',' '),'Z','')) AS jdPE
  FROM wvJobProgramPhase p WHERE p.idwell = :idwell
),
tl AS (
  SELECT r.IDRecParent AS idjob, t.Code1, t.Code2, t.Code3, t.Code4, t.OpsCategory,
         t.Duration, COALESCE(t.Inactive,0) AS Inactive,
         julianday(replace(replace(r.DtTmStart,'T',' '),'Z','')) +
           COALESCE(SUM(t.Duration) OVER (PARTITION BY t.IDRecParent
             ORDER BY t.sysSeq ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING),0) AS jdS
  FROM wvJobReportTimeLog t JOIN wvJobReport r ON r.IDRec=t.IDRecParent AND r.idwell=t.idwell
  WHERE t.idwell = :idwell AND r.DtTmStart IS NOT NULL
),
tlsum AS (
  SELECT ph.IDRecPhase,
         COALESCE(tl.Code1,'') AS Code1, COALESCE(tl.Code2,'') AS Code2,
         COALESCE(tl.Code3,'') AS Code3, COALESCE(tl.Code4,'') AS Code4,
         COALESCE(tl.OpsCategory,'') AS OpsCategory,
         SUM(MIN(tl.jdS+tl.Duration, ph.jdPE) - MAX(tl.jdS, ph.jdPS)) AS DurationTimeLog
  FROM ph JOIN tl ON tl.idjob = ph.idjob
        AND ph.jdPS IS NOT NULL AND ph.jdPE IS NOT NULL
        AND tl.jdS               <  ph.jdPE - 1.0/86400
        AND tl.jdS + tl.Duration >  ph.jdPS + 1.0/86400
  WHERE tl.Inactive = 0
  GROUP BY ph.IDRecPhase, 2,3,4,5,6
),
actsum AS (
  SELECT a.IDRecParent AS IDRecPhase,
         COALESCE(a.Code1,'') AS Code1, COALESCE(a.Code2,'') AS Code2,
         COALESCE(a.Code3,'') AS Code3, COALESCE(a.Code4,'') AS Code4,
         COALESCE(a.OpsCategory,'') AS OpsCategory,
         SUM(a.DurationMin) AS DurationMin, SUM(a.DurationML) AS DurationML, SUM(a.DurationMax) AS DurationMax
  FROM wvJobProgramPhaseActivity a
  JOIN ph ON ph.IDRecPhase = a.IDRecParent
  GROUP BY a.IDRecParent, 2,3,4,5,6
),
keys AS (
  SELECT IDRecPhase, Code1, Code2, Code3, Code4, OpsCategory FROM actsum
  UNION
  SELECT IDRecPhase, Code1, Code2, Code3, Code4, OpsCategory FROM tlsum
)
SELECT ph.PhaseSeq, ph.PhaseCode1, ph.PhaseCode2,
       k.IDRecPhase AS IDRecParent,
       k.Code1, k.Code2, k.Code3, k.Code4, k.OpsCategory,
       a.DurationMin, a.DurationML, a.DurationMax,
       ROUND(COALESCE(t.DurationTimeLog,0), 10) AS DurationTimeLog,
       ROUND(COALESCE(a.DurationMin,0) - COALESCE(t.DurationTimeLog,0), 10) AS DurationMinVar,
       ROUND(COALESCE(a.DurationML ,0) - COALESCE(t.DurationTimeLog,0), 10) AS DurationMLVar,
       ROUND(COALESCE(a.DurationMax,0) - COALESCE(t.DurationTimeLog,0), 10) AS DurationMaxVar
FROM keys k
JOIN ph ON ph.IDRecPhase = k.IDRecPhase
LEFT JOIN actsum a ON a.IDRecPhase=k.IDRecPhase AND a.Code1=k.Code1 AND a.Code2=k.Code2 AND a.Code3=k.Code3 AND a.Code4=k.Code4 AND a.OpsCategory=k.OpsCategory
LEFT JOIN tlsum  t ON t.IDRecPhase=k.IDRecPhase AND t.Code1=k.Code1 AND t.Code2=k.Code2 AND t.Code3=k.Code3 AND t.Code4=k.Code4 AND t.OpsCategory=k.OpsCategory
ORDER BY ph.PhaseSeq, k.Code1, k.Code2
`,
  },
  {
    // Confirmed: the checker re-derived the totals independently and they matched.
    // 946E6358693E482097B8099D7F84F532: source gen+rental 17,800,219.94; their SQL allocated
    // 9,879,116.29; my independent JS allocation 9,879,116.24; 169/169 group keys identical.
    // Conservation: 648 rows touch a phase, 620 at fraction exactly 1.0, 0 above 1.0, SUM
    // over those 620 = 3,915,390.25 both ways. G
    table: "wvJPPCostCalc",
    sources: ["wvJobReportCostGen","wvJobReportCostRental","wvJobRentalItem","wvJobProgramPhase","wvJobReport","wvJob"],
    params: ["idwell"],
    unsupported: [
      { field: "CostNormFieldEstPhase", reason: "Formula is exact and emitted (CostFieldEstPhase * wvJob.CurrencyExchangeRate, per the model's CostNorm* EQN help), but wvJob.CurrencyExchangeRate is NULL in all 112 wvJob rows in the sample (SELECT COUNT(DISTINCT Currenc" },
      { field: "CostNormFieldEstCum", reason: "Same as CostNormFieldEstPhase - wvJob.CurrencyExchangeRate is NULL for every job in the sample." },
    ],
    verifiedBy: "946E6358693E482097B8099D7F84F532: source gen+rental 17,800,219.94; their SQL allocated 9,879,116.29; my independent JS allocation 9,879,116.24; 169/169 group keys identical. Conservation: 648 rows tou",
    sql: `
WITH ph AS (
  SELECT p.IDRec AS IDRecPhase, p.IDRecParent AS idjob, p.sysSeq AS PhaseSeq,
         p.Code1 AS PhaseCode1, p.Code2 AS PhaseCode2,
         julianday(replace(replace(p.DtTmStartActual,'T',' '),'Z','')) AS jdPS,
         julianday(replace(replace(p.DtTmEndActual  ,'T',' '),'Z','')) AS jdPE
  FROM wvJobProgramPhase p
  WHERE p.idwell=:idwell AND p.DtTmStartActual IS NOT NULL AND p.DtTmEndActual IS NOT NULL
),
rpt AS (
  SELECT r.IDRec AS idreport, r.IDRecParent AS idjob,
         julianday(replace(replace(r.DtTmStart,'T',' '),'Z','')) AS jdRS,
         julianday(replace(replace(r.DtTmEnd  ,'T',' '),'Z','')) AS jdRE
  FROM wvJobReport r WHERE r.idwell=:idwell
),
cost AS (
  SELECT g.IDRec AS idcost, g.IDRecParent AS idreport, g.IDRecPhaseCustom AS idphasecustom,
         g.Code1, g.Code2, g.Code3, g.Code4, g.Code5, g.Code6,
         g.Des, g.OpsCategory, g.Vendor, COALESCE(g.Cost,0) AS Cost
  FROM wvJobReportCostGen g WHERE g.idwell=:idwell
  UNION ALL
  SELECT c.IDRec, c.IDRecParent, c.IDRecPhaseCustom,
         i.Code1, i.Code2, i.Code3, i.Code4, i.Code5, i.Code6,
         i.Des, c.OpsCategory, i.Vendor,
         ( CASE WHEN c.UseDay     = 1 THEN COALESCE(i.RateDay,0)     ELSE 0 END
         + CASE WHEN c.UseStandby = 1 THEN COALESCE(i.RateStandby,0) ELSE 0 END
         + COALESCE(i.RateDepth,0) * COALESCE(c.UseDepth,0)
         + COALESCE(i.RateHour ,0) * COALESCE(c.UseHour ,0)
         + COALESCE(i.RateOther,0) * COALESCE(c.UseOther,0)
         + COALESCE(c.CostOneTime,0) ) * COALESCE(c.Qty,1)
  FROM wvJobReportCostRental c
  JOIN wvJobRentalItem i ON i.IDRec = c.IDRecJobRentalItem AND i.idwell = c.idwell
  WHERE c.idwell=:idwell
),
alloc AS (
  SELECT ph.IDRecPhase, c.Code1,c.Code2,c.Code3,c.Code4,c.Code5,c.Code6,c.Des,c.OpsCategory,c.Vendor,
         c.Cost AS CostAlloc
  FROM cost c JOIN ph ON ph.IDRecPhase = c.idphasecustom
  UNION ALL
  SELECT ph.IDRecPhase, c.Code1,c.Code2,c.Code3,c.Code4,c.Code5,c.Code6,c.Des,c.OpsCategory,c.Vendor,
         c.Cost * (MIN(r.jdRE, ph.jdPE) - MAX(r.jdRS, ph.jdPS)) / (r.jdRE - r.jdRS)
  FROM cost c
  JOIN rpt r ON r.idreport = c.idreport AND r.jdRE > r.jdRS
  JOIN ph  ON ph.idjob = r.idjob AND r.jdRS < ph.jdPE AND r.jdRE > ph.jdPS
  WHERE c.idphasecustom IS NULL OR c.idphasecustom = ''
),
agg AS (
  SELECT a.IDRecPhase, ph.PhaseSeq, ph.PhaseCode1, ph.PhaseCode2,
         a.Code1,a.Code2,a.Code3,a.Code4,a.Code5,a.Code6, a.Des, a.OpsCategory,
         SUM(a.CostAlloc) AS CostFieldEstPhase
  FROM alloc a JOIN ph ON ph.IDRecPhase=a.IDRecPhase
  GROUP BY a.IDRecPhase, a.Code1,a.Code2,a.Code3,a.Code4,a.Code5,a.Code6,a.Des,a.OpsCategory
)
SELECT agg.IDRecPhase AS IDRecParent, agg.PhaseSeq, agg.PhaseCode1, agg.PhaseCode2,
       agg.Code1, agg.Code2, agg.Code3, agg.Code4, agg.Code5, agg.Code6,
       agg.Des, agg.OpsCategory,
       ROUND(agg.CostFieldEstPhase,2) AS CostFieldEstPhase,
       ROUND(SUM(agg.CostFieldEstPhase) OVER (
             PARTITION BY agg.Code1,agg.Code2,agg.Code3,agg.Code4,agg.Code5,agg.Code6,agg.Des,agg.OpsCategory
             ORDER BY agg.PhaseSeq ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW),2) AS CostFieldEstCum,
       ROUND(agg.CostFieldEstPhase * j.CurrencyExchangeRate,2) AS CostNormFieldEstPhase,
       ROUND(SUM(agg.CostFieldEstPhase) OVER (
             PARTITION BY agg.Code1,agg.Code2,agg.Code3,agg.Code4,agg.Code5,agg.Code6,agg.Des,agg.OpsCategory
             ORDER BY agg.PhaseSeq ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)
             * j.CurrencyExchangeRate,2) AS CostNormFieldEstCum
FROM agg
JOIN ph ON ph.IDRecPhase = agg.IDRecPhase
JOIN wvJob j ON j.IDRec = ph.idjob AND j.idwell = :idwell
ORDER BY agg.PhaseSeq, CostFieldEstPhase DESC
`,
  },
];

/**
 * Deliberately NOT derived, and why. Blocks bound to these keep saying that
 * WellView computes them at print time - true, and checkable - rather than
 * showing a number nobody validated.
 */
export const UNDERIVED: { table: string; reason: string }[] = [
  { table: "wvJRMudAddCalc", reason: "PARTIAL and not individually cleared" },
  { table: "wvJPPVendorCalc", reason: "no adversarial verification was returned for this table" },
  { table: "wvJPPMudAdCalc", reason: "no adversarial verification was returned for this table" },
  { table: "wvJPPJobSupCalc", reason: "no adversarial verification was returned for this table" },
  { table: "wvJPPIntervalProblemCalc", reason: "no adversarial verification was returned for this table" },
];

registerCalc(...CALC_DERIVATIONS);
