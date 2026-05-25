# Trajectory fixtures

This directory holds known-good input/output pairs captured from the original
**MIXED.exe** Delphi binary. The fixture test
([`../fixtures.test.ts`](../fixtures.test.ts)) loads every `*.input.json` here,
runs the modern `dispatch()` over it, and checks the result matches the
corresponding `*.expected.json` within `±1e-6`.

## File naming

Match `<name>.input.json` ↔ `<name>.expected.json`. Anything else is ignored.

## Capturing a new fixture from MIXED.exe

> You need a Windows machine with the original `MIXED.exe` and `BLANK.mdb`.

1. Launch `MIXED.exe`. Either open the bundled `BLANK.mdb` or paste in a fresh
   `Country / Field / Well / Calculation` hierarchy.
2. In the survey-editor grid, enter the segments you want as a test case
   (e.g. vertical → 1000 ft KOP → HC3D to a deviated target).
3. Click **Calculate** in the original app to populate the station table.
4. Right-click the calculation and **Export to Excel** (this hits
   `Unit10.pas:SaveAsExcelFile`).
5. Convert the resulting `.xls` to `*.expected.json` using the converter
   script (`packages/shared/test/scripts/xls-to-fixture.mjs`, TODO).

`*.input.json` should match the `FixtureInput` shape used in `fixtures.test.ts`:

```jsonc
{
  "name": "hc3d_basic_ft",
  "azimuthChoice": 1,
  "segments": [
    {
      "comment": "START STATION",
      "order": 0, "typ": 0,
      "md": 0, "inc": 0, "azm": 0,
      "tvd": 0, "vsec": 0, "ns": 0, "ew": 0,
      "dls": 0, "tf": 0, "br": 0, "tr": 0, "dmd": 0
    },
    {
      "comment": "Target",
      "order": 1, "typ": 1,
      "md": 7000,
      "inc": 0.7853981633974483,     // 45° in radians
      "azm": 1.5707963267948966,     // 90° in radians
      "tvd": 6000, "vsec": 0, "ns": 0, "ew": 2000,
      "dls": 0, "tf": 0, "br": 0, "tr": 0, "dmd": 0
    }
  ]
}
```

`*.expected.json` is the full list of densified stations from MIXED.exe:

```jsonc
{
  "stations": [
    { "md": 0,    "inc": 0,        "azm": 0,        "tvd": 0,    "ns": 0,    "ew": 0 },
    { "md": 100,  "inc": 0,        "azm": 0,        "tvd": 100,  "ns": 0,    "ew": 0 },
    /* ... 65 more rows ... */
    { "md": 6534.6, "inc": 0.7854, "azm": 1.5708, "tvd": 6000, "ns": 0, "ew": 2000 }
  ]
}
```

Only the fields you populate are compared (`comment` is skipped); missing
optional fields default to 0 with no penalty.

## Why the test starts empty

We didn't bundle any fixtures because the dispatcher's current numerical
accuracy hasn't been pinned to MIXED.exe's outputs yet — and capturing those
requires Windows access we didn't have. The test scaffold is here so anyone
with the right environment can drop pairs in and immediately get a regression
suite. See [PHASE5_NOTES.md](../../../../PHASE5_NOTES.md) for context.
