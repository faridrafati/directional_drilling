-- Cement yield moves from m³/sack to L/sack.
--
-- The reports print two decimals, and a class G slurry yields ~0.033 m³/sack —
-- which printed as "0.03", a 10% error on the figure the slurry volume is
-- calculated from. Litres carry the same number at a readable magnitude.
--
-- Renamed rather than added-and-deprecated because the column was introduced by
-- the migration immediately before this one, in the same feature: no deployed
-- database has ever held a value under the old name outside the demo seed, which
-- the UPDATE below converts in place.
ALTER TABLE "CementFluid" RENAME COLUMN "yieldM3PerSack" TO "yieldLPerSack";
UPDATE "CementFluid" SET "yieldLPerSack" = "yieldLPerSack" * 1000 WHERE "yieldLPerSack" IS NOT NULL;
