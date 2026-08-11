# Verification report

Produced by `scripts/wellview-afr/afr_verify.py`, which re-reads the **source
bytes** and never trusts the parser's own output.

## Result

```
reports checked      : 181
field references     : 4766
parse failures       : 1
   NOT PARSED: reports single/Drilling/Drilling Summary/Depth vs Cost Graph.afr -> unsupported format version 2.0 (this parser reads v3.0 only)
verification problems: 0
```

## What was checked

1. **Every `table.column` shown in an HTML appears literally in its source `.afr`.**
   Read as length-prefixed strings, the way the format writes them — the same test
   `strings file.afr | grep name` performs. A field the parser invented cannot pass.
   All **4766** references passed.
2. **Every parsed block reaches the HTML**, matched by its own
   `<!-- block n: WellView table `x` -->` marker. None missing.
3. **Nothing in the bytes was silently dropped** — every `table.column` literal is
   either rendered as a block field, recorded as a caption placeholder, or marked
   as an embedded control's column list.
4. **Files that could not be parsed are named**, never guessed at.

## Known limits — read before trusting an export

- **1 file could not be parsed.** `Drilling/Drilling Summary/Depth vs Cost Graph.afr`
  is format version **2.0**; every other file is 3.0. It has no HTML export and no
  entry in `reports.json` beyond the failure record. Nothing about it was guessed.
- **45 file(s) contain a field group whose size byte could not be read.** Those
  groups were treated as single-field groups. The field NAMES are still verified
  present in the bytes; only their side-by-side grouping is uncertain.
- **56 caption(s) look damaged** — truncated mid-token or carrying a junk prefix.
  Captions are recovered by resync and a resync can land inside a string. They are
  listed below rather than presented as clean. Block and field structure is
  unaffected: that is checked exactly.
- **Field labels are interpreted, not extracted** (see `scripts/wellview-afr/README.md`).
- **Data values are fictional.** No real well data appears in any export.

### Captions flagged

- **New Well Setup** — caption has a suspect prefix: '& production\\tubing and rods.sch'
- **WELL SERVICES DAILY OPERATION REPORT** — caption may be truncated: 'Job:  <wvj'
- **Daily Completion and Workover (schematic)** — caption has a suspect prefix: '& Production\\Tubing and Rods SCH'
- **Well History** — caption has a suspect prefix: '@RCasing Description: <wvcas.des>; Set Depth: <wvcas.depthbt'
- **Well History** — caption has a suspect prefix: '@RTubing Description: <wvtub.des>; Set Depth: <wvtub.depthbt'
- **Well History** — caption may be truncated: '@VTubing Description: <wvtub.des>; Pull Reason: <wvtub.pullr'
- **Well History** — caption has a suspect prefix: '@RDescription: <wvcement.des>; Eval Res: <wvcement.deseval>;'
- **Well History** — caption has a suspect prefix: '@RZone: <wvstimtreat.idreczone>; Type: <wvstimtreat.typ>; Co'
- **Well History** — caption may be truncated: '@^Zone: <wvzone.zonename>; Top: <wvzone.depthtop>; Btm: <wvz'
- **Well History** — caption may be truncated: 'Btm: <wvwellboresize.depthbtmact'
- **Well History** — caption may be truncated: '@dMake: <wvwellhead.make>; Size: <wvwellhead.sz>; WP: <wvwel'
- **Well History** — caption may be truncated: 'pth: <wvtestleakoff.depth>; Formation Tested: <wvtestleakoff'
- **Well History** — caption may be truncated: 'pe: <wvtestequip.testtyp>; Item Tested: <wvtestequip.idrecte'
- **Well History** — caption may be truncated: '@{Description: <wvotherinhole.des>; Top: <wvotherinhole.dept'
- **Well History** — caption has a suspect prefix: ' Btm: <wvotherinhole.depthbtm>; OD: <wvotherinhole.szodnom>'
- **Well History** — caption may be truncated: 'ne: <wvperforation.idreczone>; Top: <wvperforation.depthtop>'
- **Well History** — caption may be truncated: '@FString Description: <wvotherstr.des>; Set Depth: <wvothers'
- **Well History** — caption may be truncated: '@UType: <wvlog.typ>; Top: <wvlog.depthtop>; Btm: <wvlog.dept'
- **Dual Tubing** — caption has a suspect prefix: '& production\\tubing and rods sch'
- **Tubing** — caption has a suspect prefix: '& production\\tubing and rods sch'
- **Equipment Pressure Tests** — caption has a suspect prefix: '& production\\tubing and rods.sch'
- **Rod and Pump Details** — caption has a suspect prefix: '& production\\tubing and rods.sch'
- **Tubing.Dual Tubing** — caption has a suspect prefix: '& production\\tubing and rods sch'
- **Tubing** — caption has a suspect prefix: '& production\\tubing and rods sch'
- **Downhole Well Profile** — caption has a suspect prefix: '& production\\tubing and rods.sch'
- **Well History** — caption has a suspect prefix: '@RCasing Description: <wvcas.des>; Set Depth: <wvcas.depthbt'
- **Well History** — caption has a suspect prefix: '@RTubing Description: <wvtub.des>; Set Depth: <wvtub.depthbt'
- **Well History** — caption may be truncated: '@VTubing Description: <wvtub.des>; Pull Reason: <wvtub.pullr'
- **Well History** — caption has a suspect prefix: '@RDescription: <wvcement.des>; Eval Res: <wvcement.deseval>;'
- **Well History** — caption has a suspect prefix: '@RZone: <wvstimtreat.idreczone>; Type: <wvstimtreat.typ>; Co'
- **Well History** — caption may be truncated: '@^Zone: <wvzone.zonename>; Top: <wvzone.depthtop>; Btm: <wvz'
- **Well History** — caption may be truncated: 'Btm: <wvwellboresize.depthbtmact'
- **Well History** — caption may be truncated: '@dMake: <wvwellhead.make>; Size: <wvwellhead.sz>; WP: <wvwel'
- **Well History** — caption may be truncated: 'pth: <wvtestleakoff.depth>; Formation Tested: <wvtestleakoff'
- **Well History** — caption may be truncated: 'pe: <wvtestequip.testtyp>; Item Tested: <wvtestequip.idrecte'
- **Well History** — caption may be truncated: '@{Description: <wvotherinhole.des>; Top: <wvotherinhole.dept'
- **Well History** — caption has a suspect prefix: ' Btm: <wvotherinhole.depthbtm>; OD: <wvotherinhole.szodnom>'
- **Well History** — caption may be truncated: 'ne: <wvperforation.idreczone>; Top: <wvperforation.depthtop>'
- **Well History** — caption may be truncated: '@FString Description: <wvotherstr.des>; Set Depth: <wvothers'
- **Well History** — caption may be truncated: '@UType: <wvlog.typ>; Top: <wvlog.depthtop>; Btm: <wvlog.dept'
- **Job Phases** — caption may be truncated: '@B<wvjobprogramphase.code1>; <wvjobprogramphase.dttmstartpla'
- **Stick Diagram** — caption has a suspect prefix: '& Geology\\Casing & Formations Pr'
- **New Day Set-Up** — caption has a suspect prefix: '@VDaily Operations Data From:  <wvjobreport.dttmstart> - Dat'
- **Daily Drilling - Detail (legal size)** — caption may be truncated: '@A# <wvjobrigpump.des>,  <wvjobrigpump.make>,  <wvjobrigpump'
- **BHA Detail** — caption may be truncated: ': <wvjobdrillstring.stringno>,  <wv'
- **Lessons and Problems** — caption has a suspect prefix: '@\\<wvjobintervallesson.typ>,  <wvjobintervallesson.dttmstart'
- **BHA Performance** — caption may be truncated: ': <wvjobdrillstring.stringno>,  <wv'
- **Hydraulics Summary** — caption may be truncated: '@GDRILL STRING & DAILY INFORMATION FOR  BHA#: <wvjobdrillstr'
- **Hydraulics Summary** — caption may be truncated: 'illing Parameters from  <wvjobdrillstringdrillparam.dttmstar'
- **Schematic - Proposed vs Actual** — caption has a suspect prefix: '& production\\proposal with half '
- **Failure - Schematic** — caption has a suspect prefix: '& production\\production failures'
- **Geological Summary** — caption has a suspect prefix: '& Geology\\Geology_Plan vs Actual'
- **Annular Fluids** — caption has a suspect prefix: '& production\\tubing and rods.sch'
- **Downhole Well Profile** — caption has a suspect prefix: '& production\\tubing and rods.sch'
- **Equipment Pressure Tests** — caption has a suspect prefix: '& production\\tubing and rods.sch'
- **Plunger Lift Assembly** — caption has a suspect prefix: '& production\\tubing and rods.sch'

### Files with unreadable group sizes

- **Directional Plot_Plan vs Actual** — 4 field group size(s) could not be read
- **Daily Completion and Workover (schematic)** — 1 field group size(s) could not be read
- **LOT & FIT** — 1 field group size(s) could not be read
- **Tubing** — 1 field group size(s) could not be read
- **Rod and Pump Details** — 1 field group size(s) could not be read
- **Schematic - Current** — 1 field group size(s) could not be read
- **Tubing.Dual Tubing** — 1 field group size(s) could not be read
- **Tubing** — 1 field group size(s) could not be read
- **Field Est Cost Summary - Graph** — 1 field group size(s) could not be read
- **Downhole Well Profile** — 1 field group size(s) could not be read
- **Time Log Summary - Graph** — 3 field group size(s) could not be read
- **Job Phases** — 6 field group size(s) could not be read
- **Mud Program** — 3 field group size(s) could not be read
- **Stick Diagram** — 1 field group size(s) could not be read
- **BHA Detail** — 1 field group size(s) could not be read
- **Directional Plot_Plan vs Actual** — 4 field group size(s) could not be read
- **Wellbore Details** — 2 field group size(s) could not be read
- **AFE vs Field Est - Graph** — 2 field group size(s) could not be read
- **BHA Performance** — 4 field group size(s) could not be read
- **Casing, Liner and Cement report** — 1 field group size(s) could not be read
- **Days vs Depth and Cost - Graph** — 2 field group size(s) could not be read
- **Drilling Summary 1 (11x17)** — 6 field group size(s) could not be read
- **Drilling Summary 2 - Schematic** — 1 field group size(s) could not be read
- **Field Est Cost Summary - Graph** — 1 field group size(s) could not be read
- **Hydraulics Summary** — 1 field group size(s) could not be read
- **LOT & FIT with Graph** — 1 field group size(s) could not be read
- **Schematic - Proposed vs Actual** — 1 field group size(s) could not be read
- **Time Log Summary - Graph** — 3 field group size(s) could not be read
- **Failure Summary** — 2 field group size(s) could not be read
- **Production & Failure History** — 11 field group size(s) could not be read
- **Failure - Schematic** — 1 field group size(s) could not be read
- **Formation Performance** — 2 field group size(s) could not be read
- **Formation Performance** — 2 field group size(s) could not be read
- **Phases - Plan** — 6 field group size(s) could not be read
- **Phases - Plan vs Actual** — 10 field group size(s) could not be read
- **Phase Summary Graph** — 4 field group size(s) could not be read
- **Phase Activity & Time Log Breakdown** — 2 field group size(s) could not be read
- **Phase Time & Problem Time Summary - Graph** — 3 field group size(s) could not be read
- **Phase - Time, Problem, Cost Details** — 3 field group size(s) could not be read
- **Phase - Mud Additive and Job Supply Details** — 2 field group size(s) could not be read
- **Interval Problem - TimeTracks** — 1 field group size(s) could not be read
- **Annular Fluids** — 1 field group size(s) could not be read
- **Downhole Well Profile** — 1 field group size(s) could not be read
- **Equipment Pressure Tests** — 1 field group size(s) could not be read
- **Plunger Lift Assembly** — 1 field group size(s) could not be read
