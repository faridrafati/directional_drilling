# WellView Report Suite — Field-Level Specification

> Generated 2026-08-07 by exhaustive extraction from the 30 sample report PDFs in `Wellview/`
> plus the three code-system documents. This file is the authoritative field inventory for
> reproducing these reports. The sample PDFs remain the authority on visual layout — always
> check the PDF itself when building a renderer.

## Entity → report index

Which reports need each underlying data entity (numbers are the `NN_` prefixes of the PDFs).
Entity names are normalized snake_case suggestions, not final Prisma model names.

| Entity | Needed by reports |
|---|---|
| `accountable_party` | 15 |
| `afe` | 01, 06, 07, 10, 11, 12, 13, 18, 20 |
| `afe_supplement` | 01, 13 |
| `attachment` | 30 |
| `bha_component` | 02, 06, 07, 22 |
| `bha_run` | 02, 03, 06, 07, 18, 22 |
| `bha_sensor` | 02 |
| `bit_nozzle` | 02, 03 |
| `bit_record` | 02, 03, 06, 07, 18, 22 |
| `casing_component` | 04, 05, 22 |
| `casing_string` | 04, 05, 06, 07, 21, 22, 24, 26, 28, 29, 30 |
| `cement_fluid` | 04, 22, 30 |
| `cement_fluid_additive` | 04 |
| `cement_job` | 04, 21, 22, 23, 28, 29, 30 |
| `cement_plug` | 04 |
| `cement_stage` | 04, 22 |
| `core` | 21, 22 |
| `cost_code` | 01 |
| `cost_item` | 01, 06, 07, 09, 10, 11, 12, 13, 14, 15, 18, 22, 23 |
| `daily_contact` | 06, 07, 12 |
| `daily_reading` | 23 |
| `daily_report` | 06, 07, 09, 10, 12, 13, 14, 18, 23 |
| `depth_progress` | 13 |
| `district` | 16 |
| `division` | 16 |
| `downhole_equipment` | 21, 22, 23, 24 |
| `drilling_param_interval` | 02, 06, 07, 18, 19, 21 |
| `evaluation_sample` | 21 |
| `field` | 16 |
| `field_estimate` | 01 |
| `formation_top` | 07, 18, 19, 20, 21, 22 |
| `gas_reading` | 18 |
| `gas_show` | 18 |
| `general_note` | 22 |
| `hole_section` | 04, 21, 22 |
| `hydraulics_calc` | 07 |
| `interval_lesson` | 07 |
| `interval_problem` | 07, 13, 15 |
| `invoice` | 01 |
| `job` | 01, 03, 10, 11, 12, 13, 15, 16, 17, 20, 22, 23, 27, 28, 29, 30 |
| `job_contact` | 20, 22, 23 |
| `job_phase` | 10, 11, 16, 22 |
| `job_phase_plan` | 10, 11 |
| `kick` | 07 |
| `lithology_interval` | 18, 21 |
| `log_run` | 18, 22, 23, 30 |
| `lost_circulation` | 07 |
| `lot_fit_test` | 22 |
| `mud_additive_usage` | 06, 07 |
| `mud_check` | 02, 04, 06, 07, 14, 18, 21 |
| `mud_pump` | 06, 07 |
| `mud_system_interval` | 21 |
| `mud_volume` | 06, 07 |
| `oil_show` | 18 |
| `operations_summary` | 12 |
| `other_in_hole` | 22, 23, 26, 28, 30 |
| `perforation` | 09, 23, 24, 26, 28, 29, 30 |
| `perforation_status` | 26 |
| `personnel` | 13 |
| `personnel_log` | 07 |
| `plan_station` | 08 |
| `plug_back` | 22 |
| `production_failure` | 22, 25 |
| `production_period` | 27 |
| `report_fluid` | 23 |
| `reservoir` | 22 |
| `rig` | 06, 07, 12 |
| `rod_component` | 24, 30 |
| `rod_pump` | 30 |
| `rod_string` | 24, 30 |
| `safety_check` | 06, 07, 23 |
| `safety_incident` | 07, 17 |
| `sample_description` | 18 |
| `sampling_requirement` | 20 |
| `schematic_annotation` | 22 |
| `stimulation_job` | 30 |
| `stimulation_stage` | 23, 30 |
| `stimulation_treatment` | 23 |
| `survey_station` | 04, 07, 08, 09, 19, 21, 22 |
| `swab_run` | 30 |
| `time_log` | 06, 07, 09, 10, 12, 13, 18, 23 |
| `tubing_component` | 24, 26, 28, 29, 30 |
| `tubing_string` | 23, 24, 28, 29, 30 |
| `unscheduled_event_type` | 09 |
| `vertical_section_reference` | 08 |
| `well` | 01, 02, 03, 04, 05, 06, 07, 08, 09, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30 |
| `well_classification` | 13 |
| `well_contact` | 30 |
| `well_plan` | 08 |
| `wellbore` | 02, 04, 06, 07, 08, 09, 18, 19, 20, 21, 22, 23, 24, 26, 28, 29, 30 |
| `wellhead_component` | 04, 22, 24, 26, 28, 29, 30 |
| `zone` | 26, 27, 30 |

---

# Per-report specifications

## 01_AFEvsFieldEstvsFinalInvoice.pdf — AFE vs Field Est vs Final Invoice

**Purpose:** Compares the authorized budget (AFE + supplements) against the field cost estimate and the final invoiced amount for one drilling job, line by cost-code line, so drilling/finance staff can see variance per cost category and overall.

**Granularity:** single-well, single-job (whole drilling job life) cost roll-up; one page

**Page layout:** Portrait letter (612x792), 1 page. Top-down: centered title; well header key-value block; job key-value block; AFE totals key-value block; free-text Summary; one long Job Cost Summary table filling the rest of the page; footer line.

**Data entities:** `well`, `job`, `afe`, `afe_supplement`, `cost_code`, `cost_item`, `field_estimate`, `invoice`

### Sections (in reading order)

#### Title
*Layout:* centered title line

Fields, in printed order:
- AFE vs Field Est vs Final Invoice

#### Well header block
*Layout:* key-value block; labels in one row, values in the row beneath (two label/value row pairs), plus a Well Name line above

Fields, in printed order:
- Well Name:
- API/UWI
- Surface Legal Location
- Field Name
- License #
- State/Province
- Well Configuration Type
- Ground Elevation (ft)
- Casing Flange Elevation (ft)
- KB-Ground Distance (ft)
- KB-Casing Flange Distance (ft)
- Spud Date
- Rig Release Date

*Notes:* Sample values: Well Name 'Sample 11 - Full Data', API/UWI 0987656789, Field Name Akuinu, License # 8818838, State/Province Texas, Well Configuration Type Deviated, Casing Flange Elevation 0.00, KB-Casing Flange Distance 210.00, Spud Date 2000-02-21 00:00, Rig Release Date 2000-03-18 00:00. Same header block appears on reports 01, 04, 05.

#### Job block
*Layout:* key-value block; label row over value row

Fields, in printed order:
- Job Category
- Primary Job Type
- Start Date
- End Date
- Status 1

*Notes:* Sample: Drilling | Drilling - original | 2000-02-21 | 2001-03-18 | Job Complete

#### AFE totals block
*Layout:* key-value block; label row over value row

Fields, in printed order:
- AFE Number
- Total AFE Amount (Cost)
- Total AFE Supplemental Amount (Cost)
- Total Field Estimate (Cost)
- AFE-Field Estimate (Cost)

*Notes:* Sample: 9876543 | 10,218,000.00 | 125,000.00 | 10,127,291.47 | 215,708.53. Computed: AFE-Field Estimate = Total AFE Amount + Total AFE Supplemental Amount - Total Field Estimate (verified numerically). Total Field Estimate is the sum of the Fld Est column below.

#### Summary
*Layout:* labeled free-text paragraph

Fields, in printed order:
- Summary

*Notes:* Free narrative text, e.g. 'No major problems were encountered while drilling this well...'

#### Job Cost Summary
*Layout:* table, column-oriented; one header row, numeric columns right-aligned

Fields, in printed order:
- Cost Des
- Code 1
- Code 2
- AFE Amt (Cost)
- Supp Amt (Cost)
- Fld Est (Cost)
- Final Invoice (Cost)
- Var (AFE-Fld) (Cost)

*Notes:* One row = one cost line item keyed by a two-level cost code (Code 1 = major account e.g. 1200, Code 2 = sub-account e.g. 1210). Any of the five money columns may be blank on a row. Computed: Var (AFE-Fld) = AFE Amt + Supp Amt - Fld Est (verified: Subsea wellhead 350,000+50,000-315,832=84,168; Electric logging 50,000+75,000-0=125,000). The same Code1/Code2 pair can repeat as multiple rows (Electric logging 7000/7602 appears twice: once as an AFE+supplement row, once as a field-estimate-only row with negative variance). No printed grand-total row; totals live in the AFE totals block above.

#### Page footer
*Layout:* single footer row

Fields, in printed order:
- www.peloton.com
- Page 1/1
- Report Printed:

*Notes:* Left: vendor URL; center: Page n/m; right: 'Report Printed: 2009-09-14'. Identical footer on all five reports.


---

## 02_BHADetail.pdf — BHA Detail

**Purpose:** Full drill-down on one BHA run: run header and bit info, operating parameter ranges, every drill-string component with dimensions, drilling parameter intervals, nozzles, downhole sensors and the mud checks taken during the run. For drilling engineers reviewing/reproducing an assembly.

**Granularity:** single-well, single-BHA-run (one page per BHA run)

**Page layout:** Portrait letter (612x792), 1 page. Header line with Well Name (left) and BHA# + assembly name (right). Left rail: 'Vertical schematic (actual)' drawing of the assembly. Right ~70%: stacked blocks in order — run stats, bit run, string parameters, nozzles string, comment, Drill String Components table (with embedded bit sub-table), Drilling Parameters table, Bit Nozzles list, Sensors table, Mud Checks table. Footer line.

**Data entities:** `well`, `wellbore`, `bha_run`, `bha_component`, `bit_record`, `bit_nozzle`, `drilling_param_interval`, `bha_sensor`, `mud_check`

### Sections (in reading order)

#### Report header
*Layout:* key-value header line

Fields, in printed order:
- Well Name:
- BHA#:

*Notes:* Sample: Well Name 'Sample 11 - Full Data'; 'BHA#: 10, 12-1/4" Directional Assy' (BHA number plus assembly description).

#### Run stats block
*Layout:* key-value block; wellbore/date context line, then label row over value row

Fields, in printed order:
- Depth In (ftKB)
- Depth Out (ftKB)
- Depth Drilled (ft)
- Drilling Time (hr)
- BHA ROP (ft/hr)

*Notes:* Context line above labels: 'Deviated - Original Hole, 2000-03-15 4:45:00 PM' (well config - wellbore name, run end date/time). Sample values 12,385.2 | 12,503.3 | 118.11 | 12.25 | 9.6. Computed: Depth Drilled = Depth Out - Depth In; BHA ROP = Depth Drilled / Drilling Time.

#### Bit Run block
*Layout:* key-value block; label row over value row

Fields, in printed order:
- Bit Run
- Length (ft)
- Make
- Model
- Serial Number
- IADC Codes
- IADC Bit Dull

*Notes:* Sample: 8 | 1.25 | Security | SS33SGJ4 | 7890 | 115 | 2-6-PB-H-2-8-WT-PR (8-character IADC dull grade).

#### String parameters block
*Layout:* key-value block; label row over value row

Fields, in printed order:
- String Wt (1000lbf)
- String Length (ft)
- WOB Max (1000lbf)
- WOB Min (1000lbf)
- Max RPM (rpm)
- Min RPM (rpm)
- Q Flow Max (gpm)
- Q Flow Min (gpm)

*Notes:* WOB Max label is clipped in the PDF as 'WOB Max (1000l…'. Sample: 184 | 12,503.00 | 35 | 35 | 180 | 180 | 786 | 786.

#### Nozzles block
*Layout:* key-value; label over value

Fields, in printed order:
- Nozzles (1/32")

*Notes:* Slash-delimited string of all nozzle sizes, e.g. 12/12/12/12/12/12.

#### Comment
*Layout:* labeled free-text

Fields, in printed order:
- Comment

*Notes:* Empty in sample.

#### Drill String Components
*Layout:* table; two-line header ('Mass/Len' and 'Gauge' stacked over '(lb/ft)' and '(in)')

Fields, in printed order:
- Jts
- Item Des
- OD (in)
- ID (in)
- Mass/Len (lb/ft)
- Grade
- Drift (in)
- Gauge (in)
- Connections
- Len (ft)
- Cum Len (ft)

*Notes:* One row = one BHA component (or group of identical joints, Jts = count), listed top of string first, bit last. Sample rows: '32 Heavy Weight Drill Pipe | 5 | 3.000 | 4.5IF | 968.50 | 1,187.83', 'Drill Pipe | 5 | 4.408 | 16.25 S135 | 11,315.17 | 12,503.00', '1 MWD Tool | 8 5/8 | 6.62FH | 24.51 | 53.48'. Computed: Cum Len = cumulative length from the bit upward through this row (top row's Cum Len = String Length). The Bit component row carries an embedded sub-table (see next section).

#### Bit sub-table (embedded in components table at the Bit row)
*Layout:* sub-table; one header row + one row

Fields, in printed order:
- Bit Type
- Make
- Model
- Serial Number
- IADC Codes
- Item Cost (Cost)
- Length (ft)

*Notes:* Sample: Insert | Security | SS33SGJ4 | 7890 | 115 | 0.00 | 1.25.

#### Drilling Parameters
*Layout:* table; two-line header (top line: 'Drill Time', 'End Depth', 'Int ROP', 'WOB', 'RPM', 'Q Flow', 'SPP'; bottom line carries units)

Fields, in printed order:
- Wellbore
- Start Date
- End Date
- Drill Time (hr)
- Start (ftKB)
- End Depth (ftKB)
- Int Depth (ft)
- Int ROP (ft/hr)
- WOB (1000lbf)
- RPM (rpm)
- Q Flow (gpm)
- SPP (psi)

*Notes:* One row = one drilling parameter interval within the run. Sample: Original Hole | 2000-03-15 04:15 | 2000-03-15 16:45 | 12.25 | 12,385.2 | 12,503.3 | 118.11 | 9.6 | 35 | 180 | 786 | 4,300.0. Computed: Int Depth = End Depth - Start; Int ROP = Int Depth / Drill Time.

#### Bit Nozzles
*Layout:* table; single column, right-aligned values

Fields, in printed order:
- Size (1/32")

*Notes:* One row = one nozzle. Sample: six rows of 12.

#### Sensors
*Layout:* table

Fields, in printed order:
- Sensor Type
- Sensor-Bit (ft)
- Note

*Notes:* One row = one downhole sensor with its distance from the bit. Empty in sample but header always printed.

#### Mud Checks
*Layout:* table; two-line header ('YP Calc' stacked over '(lbf/100ft²)')

Fields, in printed order:
- Date
- Depth (ftKB)
- Type
- Dens (lb/gal)
- PV Calc (cp)
- YP Calc (lbf/100ft²)
- pH
- Sand (%)
- Solids (%)

*Notes:* One row = one mud check taken during the BHA run. Sample: 2000-03-15 | 12,503.3 | PETROFREE | 11.10 | 40.0 | 56.391 | (blank) | (blank) | (blank).

#### Page footer
*Layout:* single footer row

Fields, in printed order:
- www.peloton.com
- Page 1/1
- Report Printed:

### Graphics

- Vertical schematic (actual): left-rail scaled drawing of the BHA assembly from top of string down to the bit; component shapes (pipe, collars, stabilizers, jar, MWD, bit) drawn to relative length/OD. Labeled 'Vertical schematic (actual)'. No axes; drawn from the component table (Item Des, OD, Len, order).


---

## 03_BitSummary.pdf — Bit Summary

**Purpose:** One-line-per-bit-run summary of every bit run on the well: size, make/model, nozzles/TFA, depth interval, hours, ROP, operating parameter ranges and IADC dull grade. Lets engineers compare bit performance across the whole well.

**Granularity:** single-well whole-life (all bit runs of one job); one landscape page

**Page layout:** Landscape letter (792x612), 1 page. Title top-left with 'Job Type:' beneath; well header block; then one full-width 'Bits' table with a two-line column header; footer line.

**Data entities:** `well`, `job`, `bha_run`, `bit_record`, `bit_nozzle`

### Sections (in reading order)

#### Title / job line
*Layout:* title with key-value line

Fields, in printed order:
- Bit Summary
- Job Type:

*Notes:* Sample: Job Type: Drilling - original.

#### Well header block
*Layout:* key-value block; Well Name line, then label row over value row

Fields, in printed order:
- Well Name:
- API/UWI
- Surface Legal Location
- License #
- Well Configuration Type
- Ground Elevation (ft)
- Casing Flange Elevation (ft)
- KB-Ground Distance (ft)
- KB-Casing Flange Distance (ft)

*Notes:* Shorter variant of the standard header: no Field Name, State/Province, Spud Date or Rig Release Date on this report. Sample values: 0987656789 | (blank) | 8818838 | Deviated | (blank) | 0.00 | (blank) | 210.00.

#### Bits
*Layout:* table; section label 'Bits'; two-line header ('TFA (incl' over 'Noz) (in²)', 'Drill Time'/'BHA ROP'/'WOB Max'/'WOB Min'/'Max RPM'/'Min RPM' names over unit line)

Fields, in printed order:
- BHA #
- Bit Run
- Size (in)
- Make
- Model
- SN
- IADC Codes
- TFA (incl Noz) (in²)
- Nozzles (1/32")
- Depth In (ftKB)
- Depth Out (ftKB)
- Drilled (ft)
- Drill Time (hr)
- BHA ROP (ft/hr)
- WOB Max (1000lbf)
- WOB Min (1000lbf)
- Max RPM (rpm)
- Min RPM (rpm)
- Bit Dull

*Notes:* One row = one bit run (a BHA run's bit). Bit Run shows rerun notation: 'RR4', 'RR6' mean rerun of bit 4/6 (same SN reused). Nozzles is the slash-delimited string (e.g. 18/18/18/18/18/18). Sample row: 10 | 8 | 12 1/4 | Security | SS33SGJ4 | 7890 | 115 | 2.05 | 12/12/12/12/12/12 | 12,385.2 | 12,503.3 | 118.11 | 12.25 | 9.6 | 35 | 35 | 180 | 180 | 2-6-PB-H-2-8-WT-PR. Computed: Drilled = Depth Out - Depth In; BHA ROP = Drilled / Drill Time (verified 229.66/11.52=19.9). IADC Codes may be blank ('___') for PDC bits. 10 rows in sample covering hole sizes 26 to 12 1/4.

#### Page footer
*Layout:* single footer row

Fields, in printed order:
- www.peloton.com
- Page 1/1
- Report Printed:


---

## 04_CasingLinerCement.pdf — Casing, Liner and Cement report

**Purpose:** Complete record of one casing/liner string and its cement job on one well: wellbore context, hole sections, wellhead, the casing tally, cement job execution (stage pumping, displacement, plug/tag data), cement fluid recipe and additives — alongside a depth-registered wellbore schematic annotated with casing and cement intervals. For drilling engineers and regulators.

**Granularity:** single-well, single-casing-string (one report instance per casing string; sample instance is 'Surface Casing'); one page

**Page layout:** Portrait letter (612x792), 1 page. Title with string-name subtitle ('Surface Casing'); standard well header block. Below, two columns: left rail = survey station listing (MD/Incl/TVD) driving a 'Vertical schematic (actual)' with text callouts for casing strings and cement intervals; right ~2/3 = stacked blocks in order: Wellbore, hole Sections table, Wellhead, Last Mud Check, Casing (header + centralizers/scratchers + tally table), Cement, Cement Stage, Cement Fluid, Cement Fluid Additives. Footer line.

**Data entities:** `well`, `wellbore`, `survey_station`, `hole_section`, `wellhead_component`, `mud_check`, `casing_string`, `casing_component`, `cement_job`, `cement_stage`, `cement_fluid`, `cement_fluid_additive`, `cement_plug`

### Sections (in reading order)

#### Title
*Layout:* centered title + string-name subtitle

Fields, in printed order:
- Casing, Liner and Cement report
- Surface Casing

*Notes:* Subtitle is the casing string this instance covers.

#### Well header block
*Layout:* key-value block; Well Name line, then two label-row/value-row pairs

Fields, in printed order:
- Well Name:
- API/UWI
- Surface Legal Location
- Field Name
- License #
- State/Province
- Well Configuration Type
- Ground Elevation (ft)
- Casing Flange Elevation (ft)
- KB-Ground Distance (ft)
- KB-Casing Flange Distance (ft)
- Spud Date
- Rig Release Date

*Notes:* Identical header block to reports 01 and 05.

#### Wellbore block
*Layout:* key-value block; context line ('Deviated - Original Hole, <print date>'), label row over value row

Fields, in printed order:
- Wellbore Name
- Profile Type
- Kick Off Depth (ftKB)
- Vertical Section Direction (°)

*Notes:* Sample: Original Hole | Directional | 1,381.2 | (blank).

#### Sections (hole sections)
*Layout:* table

Fields, in printed order:
- Section Des
- Size (in)
- Act Top (ftKB)
- Act Btm (ftKB)

*Notes:* One row = one hole section. Sample rows: (blank) 36 | 1,381.2 | 1,610.9; 26 | 1,610.9 | 2,257.2; 17 1/2 | 2,257.2 | 4,281.5; 12 1/4 | 4,281.5 | 12,503.3.

#### Wellhead
*Layout:* key-value ('Type' with value) + component table

Fields, in printed order:
- Type
- Des
- Make
- Model
- SN
- WP Top (psi)

*Notes:* Type sample: SSMC. One table row = one wellhead component: 20-3/4" Casing Head | Cameron | SSMC | 92355-233 | 10,000.0; 13-5/8" Casing Head | Cameron | SSMC | 33455-352 | 10,000.0; 12-1/4" Casing Head | Cameron | SSMC | 33455-352 | 10,000.0.

#### Last Mud Check
*Layout:* table; two-line header (units '(lbf/100ft²)' under Gel/YP names); single data row

Fields, in printed order:
- Date
- Depth (ftKB)
- Type
- Dens (lb/gal)
- Vis (s/qt)
- PV OR (cp)
- Gel (10s) (lbf/100ft²)
- Gel (10m) (lbf/100ft²)
- YP OR (lbf/100ft²)

*Notes:* Most recent mud check before running casing. Row blank in sample.

#### Casing
*Layout:* section 'Casing': key-value rows then tally table

Fields, in printed order:
- Casing Description
- Run Date
- Set Depth (ftKB)
- Wellbore
- Centralizers
- Scratchers
- Jts
- Item Des
- OD (in)
- ID (in)
- Wt (lb/ft)
- Grade
- Len (ft)
- Top (ftKB)
- Btm (ftKB)

*Notes:* Header sample: Surface Casing | 2000-03-01 07:15 | 4,253.0 | Original Hole; Centralizers '2/joint on shoe track.', Scratchers 'None'. Tally table: one row = one component group (Jts = joint count): 72 Casing Joint(s) | 13 3/8 | 12.415 | 68.00 | K-55 | 2,791.40 | 1,381.2 | 4,172.6; then 1 Float Collar; 2 Casing Joint(s); 1 Float Shoe. Note this tally omits Top Thread / P Burst / P Collapse shown in report 05.

#### Cement: <string> Cement
*Layout:* key-value block (label row over value row, three rows)

Fields, in printed order:
- Cementing Start Date
- Cementing End Date
- Wellbore
- Evaluation Method
- Cement Evaluation Results
- Comment

*Notes:* Section heading includes job name: 'Cement: Surface Casing Cement'. Sample: 2000-03-01 | 2000-03-01 | Original Hole; Temperature Log | 'Ran temp log to confirm TOC'; Comment 'Job was successful'.

#### Cement Stage: <string> Cement
*Layout:* key-value block; four label-row/value-row pairs

Fields, in printed order:
- Top Depth (ftKB)
- Bottom Depth (ftKB)
- Full Return?
- Vol Ceme… (clipped; Vol Cement Returns)
- Top Plug?
- Bottom Plug?
- Q Pump Init (bbl/min)
- Q Pump Final (bbl/min)
- Avg Pump Rate (bbl/min)
- Final Pump Pressure (psi)
- Plug Bump Pressure (psi)
- Pipe Reciprocated?
- Stroke (ft)
- Reciprocation Rate (spm)
- Pipe Rotated?
- Pipe RPM (rpm)
- Tagged Depth (ftKB)
- Tag Method
- Depth Plug Drilled Out… (clipped; ftKB)
- Drill Out Diameter (in)
- Drill Out Date

*Notes:* One block = one cement stage. Sample: 2,775.6 | 4,252.0 | Yes | 0.0 | Yes | Yes; 103 | 3 | 10 | 350.0 | 1,500.0; Yes | 35.00 | 3 | Yes | 18; 4,170.0 | Drill Bit | 4,282.0 | 12 1/4 | 2000-03-03. Two labels are clipped with an ellipsis in the PDF itself.

#### Cement Fluid: <string> Cement
*Layout:* key-value block; three label-row/value-row pairs

Fields, in printed order:
- Fluid Type
- Fluid Description
- Amount (s… (clipped; sacks)
- Class
- Volume Pumped (bbl)
- Estimated Top (ftKB)
- Est Btm (ftKB)
- Yield (ft³/sack)
- Mix H20 Ratio (gal/sack)
- Free Water (%)
- Density (lb/gal)
- Plastic Viscosity (cp)
- Thickening Time (hr)
- 1st Compressive Strength (psi)

*Notes:* One block = one cement fluid (slurry). Sample: Tail | Neat | 21 | G | 196.0; 2,775.6 | 4,252.0 | 52.62 | 283.50 | 4.00; 15.80 | 36.0 | 2.60 | 1,880.0.

#### Cement Fluid Additives
*Layout:* table

Fields, in printed order:
- Add
- Type
- Conc

*Notes:* One row = one additive in the fluid. Sample: Kwik Seal | Lost Circulation Additive | (blank).

#### Survey listing (left rail)
*Layout:* table; narrow three-column listing running the full page height beside the schematic; vertical/stacked header

Fields, in printed order:
- MD (ftKB)
- Incl (°)
- TVD (ftKB)

*Notes:* One row = one survey station; provides the depth scale for the schematic. Sample rows: 1,381.2 0.8 1,381.1; 3,817.6 37.9 3,737.2; 12,503.0 49.5 9,546.1. TVD computed from MD/Incl survey calculation.

#### Page footer
*Layout:* single footer row

Fields, in printed order:
- www.peloton.com
- Page 1/1
- Report Printed:

### Graphics

- Vertical schematic (actual): depth-scaled wellbore diagram in the left/center rail, depth axis = MD (ftKB) from the survey listing. Drawn elements with text callouts: casing strings (callout format 'Item number:N; Description:Structural Casing/Conductor Pipe/Surface Casing/Production Casing; ID:x.xxx in; Depth (MD):top-btm ftKB; Length:x.xx ft'), cement intervals ('Description:Casing Cement; Depth (MD):top-btm ftKB; Date:YYYY-MM-DD'), and auto cement plugs ('Description:Auto cement plug; Depth (MD):top-btm ftKB; Date:YYYY-MM-DD'). Built from casing_string, cement_stage and survey data.


---

## 05_CasingSummary.pdf — Casing Summary

**Purpose:** Tabular summary of every casing/liner string in the well — set depth, tension, nominal OD/drift, centralizer/scratcher programs and the full component tally with pressure ratings per string. A quick mechanical-status reference for the whole well.

**Granularity:** single-well whole-life; one repeating block per casing string (4 strings in sample) on one page

**Page layout:** Portrait letter (612x792), 1 page. Title; standard well header block; then for EACH casing string (Structural Casing, Conductor Pipe, Surface Casing, Production Casing) a repeating group: string title line 'Name, set-depth ftKB', a string-properties key-value row, and a component tally table. Footer line.

**Data entities:** `well`, `casing_string`, `casing_component`

### Sections (in reading order)

#### Title
*Layout:* centered title

Fields, in printed order:
- Casing Summary

#### Well header block
*Layout:* key-value block; Well Name line, then two label-row/value-row pairs

Fields, in printed order:
- Well Name:
- API/UWI
- Surface Legal Location
- Field Name
- License #
- State/Province
- Well Configuration Type
- Ground Elevation (ft)
- Casing Flange Elevation (ft)
- KB-Ground Distance (ft)
- KB-Casing Flange Distance (ft)
- Spud Date
- Rig Release Date

*Notes:* Identical header block to reports 01 and 04.

#### Per-string title line (repeats per casing string)
*Layout:* section heading

Fields, in printed order:
- <Casing Description>, <Set Depth>ftKB

*Notes:* Samples: 'Structural Casing, 1,598.8ftKB'; 'Conductor Pipe, 2,239.0ftKB'; 'Surface Casing, 4,253.0ftKB'; 'Production Casing, 12,478.9ftKB'.

#### String properties block (repeats per casing string)
*Layout:* key-value block; label row over value row

Fields, in printed order:
- Set Depth (ftKB)
- Set Tension (kips)
- String Nominal OD (in)
- String Min Drift (in)
- Centralizers
- Scratchers

*Notes:* Sample (Structural): 1,598.8 | 65.0 | 30 | 28.000 | 2/joint every 4th joint | None. Set Tension may be blank (Conductor, Surface, Production in sample).

#### Component tally table (repeats per casing string)
*Layout:* table; two-line header ('P Collapse' stacked over '(psi)')

Fields, in printed order:
- Jts
- Item Des
- OD (in)
- ID (in)
- Wt (lb/ft)
- Grade
- Top Thread
- Top (ftKB)
- Btm (ftKB)
- Len (ft)
- P Burst (psi)
- P Collapse (psi)

*Notes:* One row = one component group (Jts = number of identical joints), listed top-down: Casing Joint(s), Cross-Over Joint / Cross Over, Float Collar, Float Shoe / Float Shoe Joint. Sample: 222 Casing Joint(s) | 9 5/8 | 8.524 | 53.50 | L-80 | LTC | 3,819.0 | 12,398.6 | 8,579.53 | 7,930.0 | 6,620.0. Computed: Len = Btm - Top for the group; each row's Top = previous row's Btm. P Burst / P Collapse may be blank (Structural string). Same underlying casing_component data as report 04's tally but with Top Thread, P Burst, P Collapse added.

#### Page footer
*Layout:* single footer row

Fields, in printed order:
- www.peloton.com
- Page 1/1
- Report Printed:


---

## 06_DailyDrilling.pdf — Daily Drilling

**Purpose:** One-page daily drilling report (morning report) for a single well and a single report day: 24-hour time log, mud checks, BHA/bit in use, drilling parameters, rig/pump/contact reference data and daily+cumulative cost roll-ups. Audience: operations/office daily distribution.

**Granularity:** single-well daily (one report instance = one well, one report date; Report # / DFS increments per day)

**Page layout:** Portrait letter (612x792 pt), 1 page. Full-width title band and well-header key-value grid at top; body is two columns: wide left column (Time Log, Mud Checks, Drill Strings, Drilling Parameters) and narrow right sidebar (Daily Contacts, Rigs, Pumps x3, Mud Additive Amounts, Safety Checks, Wellbores). Footer strip across the bottom.

**Data entities:** `well`, `wellbore`, `daily_report`, `time_log`, `mud_check`, `mud_volume`, `bha_run`, `bha_component`, `bit_record`, `drilling_param_interval`, `daily_contact`, `rig`, `mud_pump`, `mud_additive_usage`, `safety_check`, `casing_string`, `cost_item`, `afe`

### Sections (in reading order)

#### Title band
*Layout:* key-value header block

Fields, in printed order:
- Daily Drilling (report title)
- Report for: (date)
- Report #:
- DFS:
- Well Name:
- Depth Progress:

*Notes:* Samples: 'Report for: 2000-02-22', 'Report #: 2.0, DFS: 2.00' (DFS = days from spud), 'Well Name: Sample 11 - Full Data', 'Depth Progress: 403.54' (ft drilled this day = End Depth - Start Depth, computed).

#### Well header grid
*Layout:* key-value block, 3 label rows x 6 columns (label above value)

Fields, in printed order:
- API/UWI
- Surface Legal Location
- License #
- State/Province
- AFE Number
- AFE+Supp Amt (Cost)
- Spud Date
- Rig Release Date
- Ground Elevation (ft)
- KB-Ground Distance (ft)
- Day Total (Cost)
- Cum To Date (Cost)
- Weather
- Temperature (°F)
- Road Condition
- Hole Condition
- Mud Field Est (Cost)
- Cum Mud Field Est (Cost)

*Notes:* Samples: API/UWI 0987656789, License # 8818838, State Texas, AFE 9876543, AFE+Supp 10,343,000.00, Spud 2000-02-21 00:00, Rig Release 2000-03-18 00:00, Day Total 142,830.79, Cum To Date 684,304.01. 'Cum Mud Field Est (Cost)' prints elided as 'Cum Mud Field Est (Co…'. Day Total and Cum To Date are computed from the day's cost items; Cum columns accumulate across report days.

#### Operations block
*Layout:* key-value block

Fields, in printed order:
- Operations at Report Time
- Operations Next Report Period
- Start Depth (ftKB)
- End Depth (ftKB)
- Operations Summary
- Target Formation
- Target Depth (ftKB)
- Last Casing String

*Notes:* Samples: 'DRILLING SURFACE HOLE', 'RUN AND CMT CSG', 1,610.9 / 2,014.4, Target Formation 'Blue Heron Shale', Target Depth 11,500.0. Last Casing String prints as a composite string: 'Structural Casing, 1,598.8ftKB' (description + set depth).

#### Time Log
*Layout:* table, left column; one row = one operational time interval within the 24-hr report day

Fields, in printed order:
- Start Time
- End Time
- Dur (hr)
- Cum Dur (hr)
- Code 1
- Code 2
- Com

*Notes:* Header wraps over two printed lines ('Start Time / End Time / Dur (hr) / Cum Dur (hr) / Code 1 / Code 2 / Com'). Sample row: 00:00 | 01:45 | 1.75 | 1.75 | 6 | CSG | POOH AND RACK BACK 36" BHA. Code 1 is a numeric time code (6, 21, 20, 3...), Code 2 an alpha code (CSG, RR, DRLCMT, DRLG). Cum Dur (hr) is a computed running total reaching 24.00. Com is a free-text comment that may wrap to a second line.

#### Mud Checks
*Layout:* repeating key-value block (label rows over value rows), one block per mud check; block subheader '<depth>ftKB, <datetime>' e.g. '1,610.9ftKB, 2000-02-22 12:00'

Fields, in printed order:
- Type
- Time
- Depth (ftKB)
- Density (lb/gal)
- Funnel Viscosity (s/qt)
- PV Override (cp)
- YP OR (lbf/100ft²)
- Gel 10 sec (lbf/100ft²)
- Gel 10 min (lbf/100ft²)
- Filtrate (mL/30min)
- Filter Cake (1/32")
- pH
- Sand (%)
- Solids (%)
- MBT (lb/bbl)
- Alkalinity (mL/mL)
- Chlorides (mg/L)
- Calcium (mg/L)
- Pf (mL/mL)
- Pm (mL/mL)
- Gel 30 min (lbf/100ft²)
- Whole Mud Added (bbl)
- Mud Lost to Hole (bbl)
- Mud Lost to Surface (bbl)
- Reserve Mud Volume (bbl)
- Active Mud Volume (bbl)

*Notes:* Sample: Type 'hi-vis sweeps', Time 12:00, Depth 1,610.9, Density 8.50. A volume value 1132.2 prints in the volumes row aligned near Reserve Mud Volume (bbl).

#### Drill Strings
*Layout:* block per BHA used that day; subheader 'BHA #2, 26" Drilling Assy' (BHA number + description); key-value rows plus free-text

Fields, in printed order:
- Bit Run
- Drill Bit
- Length (ft)
- IADC Bit Dull
- TFA (incl Noz) (in²)
- BHA ROP (ft/hr)
- Nozzles (1/32")
- String Length (ft)
- Max Nominal OD (in)
- String Components
- Comment

*Notes:* 'BHA ROP (ft/hr)' prints elided as 'BHA ROP…' (full label visible in the Detail report). Samples: Bit Run 2; Drill Bit '26in, S3SJ, 456789' (size, model, serial composite); Length 1.87; IADC Bit Dull '1-1-NO-A-2-0-NO-TD'; TFA 2.11; BHA ROP 161.5; Nozzles '20/20/20'; String Length 2,258.87; Max Nominal OD 26.000. String Components is a comma-separated ordered list of component descriptions (Security S3SJ, Float Sub, Drill Collar, Intergral Blade Stabilizer, ... Heavy Weight Drill Pipe, Drill Pipe).

#### Drilling Parameters
*Layout:* table; one row = one wellbore's drilled interval for the day

Fields, in printed order:
- Wellbore
- Start (ftKB)
- End Depth (ftKB)
- Cum Depth (ft)
- Cum Drill Time (hr)
- Int ROP (ft/hr)
- Q Flow (gpm)
- WOB (1000lbf)
- RPM (rpm)
- SPP (psi)
- Drill Str Wt (1000lbf)
- PU Str Wt (1000lbf)
- Drill Tq

*Notes:* Two-line printed header ('Cum Drill Time' stacks over '(hr)', etc.). Drill Tq unit is clipped at the page edge (likely 1000ft·lbf). Sample row: 1,610.9 | 2,014.4 | 403.54 | 2.00 | 201.8. Int ROP is computed = Cum Depth / Cum Drill Time (403.54/2.00 = 201.8).

#### Daily Contacts (sidebar)
*Layout:* table; one row = one contact person for the day

Fields, in printed order:
- Job Contact
- Mobile

*Notes:* Samples: Tom Black 555-133-9427; Jim Green 555-029-9115; David Brown (no number).

#### Rigs (sidebar)
*Layout:* key-value block; subheader composite 'NABORS, 432' (contractor, rig number)

Fields, in printed order:
- Contractor
- Rig Number
- Rig Supervisor
- Phone Mobile

*Notes:* Samples: NABORS | 432 | Sam White | 555-300-3991. Repeats per rig on the job.

#### Pumps (sidebar)
*Layout:* repeating key-value block, one per mud pump; subheader '<pump #>, OILWELL, A 1700-PT' (pump number, manufacturer, model); three pump blocks shown (1, 2, 3)

Fields, in printed order:
- Pump #
- Pwr (hp)
- Rod Dia (in)
- Liner Size (in)
- Stroke (in)
- Vol/Stk OR (bbl/stk)
- P (psi)
- Slow Spd
- Strokes (spm)
- Eff (%)

*Notes:* 'Vol/Stk OR (bbl/stk)' prints elided as 'Vol/Stk OR (b…' and 'Strokes (spm)' as 'Strokes (s…' (full forms confirmed in the Detail report). Samples: Rod Dia 2.2441, Liner Size 6 1/2, Stroke 18.00, Vol/Stk 0.159, P 1,400.0, Slow Spd 'No', Strokes 100, Eff 95.

#### Mud Additive Amounts (sidebar)
*Layout:* table; one row = one additive consumed that day

Fields, in printed order:
- Des
- Field Est (Cost/unit)
- Consumed

*Notes:* Header stacks 'Field Est' over '(Cost/unit)'; 'Consumed' wraps. No sample rows on this page.

#### Safety Checks (sidebar)
*Layout:* table; one row = one safety check/drill/meeting that day

Fields, in printed order:
- Time
- Type
- Des

*Notes:* Sample: 02:15 | Safety Meeting | 'Safety meeting to run 30" casing'.

#### Wellbores (sidebar)
*Layout:* table; one row = one wellbore of the well

Fields, in printed order:
- Wellbore Name
- KO MD (ftKB)

*Notes:* Sample: Original Hole | 1,381.2 (kick-off measured depth).

#### Page footer
*Layout:* key-value footer strip

Fields, in printed order:
- www.peloton.com
- Page n/n
- Report Printed: (date)

*Notes:* Sample: 'Page 1/1', 'Report Printed: 2009-09-14'.


---

## 07_DailyDrillingDetail.pdf — Daily Drilling - Detail (legal size)

**Purpose:** Extended two-page legal-size version of the daily drilling report: everything in the basic Daily Drilling plus TVD depths, remarks, personnel and problem-time KPIs, mud volume accounting, per-component drill string breakdown, extended drilling parameters (including underbalanced/annulus channels), hydraulics calculations, kicks, lost circulation, latest survey, formation tops, and (page 2) interval problems, lessons learned, and safety incidents. Audience: drilling engineers wanting the full daily picture.

**Granularity:** single-well daily (one instance = one well, one report date; 2 pages)

**Page layout:** Portrait legal (612x1008 pt), 2 pages. Page 1: title band + well-header grid full width; wide left column (Time Log, Mud Checks, Drilling Mud Volumes, Drill Strings, Drill String Components, Drilling Parameters, Hydraulic Calculations, Kicks, Lost Circulation) and right sidebar (daily KPI block, Daily Contacts, Personnel Log, Safety Check Summary, Rigs, Mud Pumps x3, Mud Additive Amounts, Survey Data, Last 5 Formations, Last Casing String). Page 2: repeated title band, then full-width Interval Problems, Interval Lessons, Safety Incidents. Footer on both pages.

**Data entities:** `well`, `wellbore`, `daily_report`, `time_log`, `interval_problem`, `interval_lesson`, `safety_incident`, `mud_check`, `mud_volume`, `bha_run`, `bha_component`, `bit_record`, `drilling_param_interval`, `hydraulics_calc`, `kick`, `lost_circulation`, `daily_contact`, `personnel_log`, `safety_check`, `rig`, `mud_pump`, `mud_additive_usage`, `survey_station`, `formation_top`, `casing_string`, `cost_item`, `afe`

### Sections (in reading order)

#### Title band (both pages)
*Layout:* key-value header block

Fields, in printed order:
- Daily Drilling - Detail (legal size) (report title)
- Report Start Date:
- Report #:
- DFS:
- Well Name:
- Depth Progress:

*Notes:* Samples: 'Report Start Date: 2000-02-22', 'Report #: 2.0, DFS: 2.00', 'Well Name: Sample 11 - Full Data', 'Depth Progress: 403.54'.

#### Well header grid
*Layout:* key-value block, 3 label rows x 6 columns

Fields, in printed order:
- API/UWI
- Surface Legal Location
- License #
- State/Province
- AFE Number
- AFE+Supp Amt (Cost)
- Spud Date
- Rig Release Date
- KB-Ground Distance (ft)
- KB-Casing Flange Distance (ft)
- Daily Field Est Total (Cost)
- Cum To Date (Cost)
- Weather
- Temperature (°F)
- Road Condition
- Hole Condition
- Daily Mud Field Est (Cost)
- Cum Mud Field Est (Cost)

*Notes:* Differs from the 1-page report: KB-Ground / KB-Casing Flange distances replace Ground Elevation, and cost labels are 'Daily Field Est Total (Cost)' / 'Daily Mud Field Est (Cost)'. Sample KB-Casing Flange Distance 210.00.

#### Operations block
*Layout:* key-value block

Fields, in printed order:
- Operations at Report Time
- Operations Next Report Period
- Start Depth (ftKB)
- End Depth (ftKB)
- Operations Summary
- Start Depth (TVD) (ftKB)
- End Depth (TVD) (ftKB)
- Remarks
- Target Formation
- Target Depth (ftKB)

*Notes:* Adds TVD start/end (samples 1,610.7 / 2,014.0) and a Remarks field versus the 1-page report.

#### Daily statistics block (sidebar)
*Layout:* key-value block, 2-column label/value pairs

Fields, in printed order:
- Personnel Total Hours (hr)
- Cum Pers Tot Hr (hr)
- Time Log Total Hours (hr)
- Problem Time Hours (hr)
- Percent Problem Time (%)
- Cum Prob Time (%)
- Days LTI (days)
- Days RI (days)

*Notes:* Samples: Time Log Total 24.00, Problem Time 0.50, Percent Problem 2.08 (= 0.50/24, computed), Cum Prob Time 1.15 (computed across days). LTI = lost-time incident days, RI = recordable incident days.

#### Time Log
*Layout:* table; one row = one operational time interval

Fields, in printed order:
- Start Time
- Dur (hr)
- Cum Dur (hr)
- End Time
- Code 1
- Code 2
- Problem?
- Prob Hrs (hr)
- Prob Ref #
- Com

*Notes:* Column order differs from the 1-page report (Dur before End Time) and adds three problem columns: sample problem row 18:15 | 0.50 | 18.75 | 18:45 | 21 | RR | Yes | 0.50 | (ref #) | ROV TROUBLE — Prob Ref # links to the Interval Problems section on page 2. Cum Dur is a computed running total to 24.00.

#### Mud Checks
*Layout:* repeating key-value block per mud check (label rows over value rows)

Fields, in printed order:
- Type
- Time
- Depth (ftKB)
- Density (lb/gal)
- Vis (s/qt)
- PV Calc (cp)
- YP Calc (lbf/100ft²)
- Gel (10s) (lbf/100ft²)
- Gel (10m) (lbf/100ft²)
- Gel (30m) (lbf/100ft²)
- Filtrate (mL/30min)
- Filter Cake (1/32")
- pH
- Solids (%)
- MBT (lb/bbl)
- Percent Oil (%)
- Percent Water (%)
- Chlorides (mg/L)
- Calcium (mg/L)
- Potassium (mg/L)
- Electric Stab (V)

*Notes:* Field set differs from the 1-page report: PV/YP are the 'Calc' variants, gels grouped 10s/10m/30m, adds Percent Oil, Percent Water, Potassium, Electric Stab; drops Sand %, alkalinity/Pf/Pm and the mud volume row (volumes get their own section).

#### Drilling Mud Volumes
*Layout:* table; one row = one mud movement/action

Fields, in printed order:
- Action
- To well (bbl)
- From well (bbl)
- Cum to Well (bbl)
- Cum from Well (bbl)

*Notes:* Cum columns are computed running totals. No sample rows printed.

#### Drill Strings
*Layout:* block per BHA; subheader 'BHA #2, 26" Drilling Assy'; key-value rows

Fields, in printed order:
- Bit Run
- Drill Bit
- IADC Bit Dull
- TFA (incl Noz) (in²)
- Nozzles (1/32")
- String Length (ft)
- String Wt (1000lbf)
- BHA ROP (ft/hr)

*Notes:* Samples: 2 | 26in, S3SJ, 456789 | 1-1-NO-A-2-0-NO-TD | 2.11; 20/20/20 | 2,258.87 | 42 | 161.5. Adds String Wt (1000lbf) vs the 1-page report; drops Length and Max Nominal OD.

#### Drill String Components
*Layout:* table; one row = one component type in the string (listed top of string down)

Fields, in printed order:
- Item Des
- Jts
- OD (in)
- ID (in)
- Len (ft)
- Top Thread

*Notes:* Sample rows: Drill Pipe | (jts blank) | 4 1/2 | 3.640 | 1,478.84 | (blank); Heavy Weight Drill Pipe | 6 | 6 9/16 | 3.000 | 454.57 | IF; Cross Over | 1 | 8 | 2.813 | 3.64 | IF; Drill Collar | 2 | 8 1/4 | 2.875 | 61.91 | API REG; Drilling Jar; Non-Mag Drill Collar; Intergral Blade Stabilizer; Float Sub. OD printed as fractions.

#### Drilling Parameters
*Layout:* key-value grid, 3 label rows with value rows beneath; one group = one wellbore drilled interval

Fields, in printed order:
- Wellbore
- Start Depth (ftKB)
- End Depth (ftKB)
- Cum Depth (ft)
- Drilling Time (hr)
- Cum Drill Time (hr)
- Int ROP (ft/hr)
- Flow Rate (gpm)
- WOB (1000lbf)
- RPM (rpm)
- SPP (psi)
- Drill Str Wt (1000lbf)
- PU Str Wt (1000lbf)
- SO Str Wt (1000lbf)
- Drilling Torque
- Off Bottom Torque
- Q Gas Inj (ft³/min)
- T Inj (°F)
- P BH Ann (psi)
- T BH (°F)
- P Surf Annulus (psi)
- T Surf Annulus (°F)
- Q Liq Return (gpm)
- Q Gas Return (ft³/min)

*Notes:* Several labels print elided: 'Cum Drill Time (…', 'Drill Str Wt (100…', 'PU Str Wt (1000…', 'SO Str Wt (1000…', 'P Surf Annulus (…', 'T Surf Annulus (…', 'Q Liq Return (gp…', 'Q Gas Return (ft³…'. Sample values: 1,610.9 | 2,014.4 | 403.54 | 2.00 | 2.00 | 201.8. Third row is UBD/annulus monitoring channels.

#### Hydraulic Calculations
*Layout:* key-value grid, 2 label rows

Fields, in printed order:
- Bit Hydraulic Power (hp)
- HP/Area (hp/in²)
- Bit Jet Velocity (ft/s)
- Bit Pressure Drop (psi)
- % P @ bit (%)
- Max Casing AV (ft/min)
- Max Open Hole AV (ft/min)
- Min Casing AV (ft/min)
- Min Open Hole AV (ft/min)
- ECD End (lb/gal)

*Notes:* All computed from pump output, nozzle TFA, string/hole geometry and mud density. Sample page shows the literal text 'Error' where the calculation failed.

#### Kicks
*Layout:* table; one row = one well-control kick event

Fields, in printed order:
- Kick Date
- Kick Depth (ftKB)
- Control Date
- Control Depth (ftKB)
- Kick Class
- Kill Notes

*Notes:* Kill Notes is a full-width sub-row. Empty on sample.

#### Lost Circulation
*Layout:* table; one row = one lost-circulation event

Fields, in printed order:
- Start Date
- Top Depth (ftKB)
- Bottom Depth (ftKB)
- Ops In Prog
- Vol Lost Tot (bbl)
- End Date

*Notes:* Empty on sample.

#### Daily Contacts (sidebar)
*Layout:* table

Fields, in printed order:
- Job Contact
- Mobile

*Notes:* Same as 1-page report.

#### Personnel Log (sidebar)
*Layout:* table; one row = one personnel category on location

Fields, in printed order:
- Type
- Count
- Tot Work Time (hr)

*Notes:* 'Tot Work Time (hr)' header stacks over two lines. Sample rows: Contractor | 22 | 0.00; Service | 18 | 0.00; Operator | 6 | 0.00.

#### Safety Check Summary (sidebar)
*Layout:* table; one row = one recurring safety check type

Fields, in printed order:
- Type
- Last Date
- Next Date

*Notes:* Fixed row set on sample: BOP Drill, Choke Drill, H2S Drill, Safety Meeting (2000-02-22 / 2000-02-23).

#### Rigs (sidebar)
*Layout:* key-value block

Fields, in printed order:
- Contractor
- Rig Number
- Rig Supervisor
- Phone Mobile

*Notes:* Samples: NABORS | 432 | Sam White | 555-300-3991.

#### Mud Pumps (sidebar)
*Layout:* repeating key-value block per pump; subheader '# 1 , OILWELL , A 1700-PT' (pump #, manufacturer, model); pumps 1-3 shown

Fields, in printed order:
- Pump Rating (hp)
- Rod Diameter (in)
- Stroke (in)
- Liner Size (in)
- Vol/Stk OR (bbl/stk)
- P (psi)
- Slow Spd
- Strokes (spm)
- Eff (%)

*Notes:* 'Strokes (spm)' prints elided as 'Strokes (sp…'. Samples: Rod Diameter 2.2441, Stroke 18.00, Liner 6 1/2, Vol/Stk 0.159, P 1,400.0, Slow Spd 'No', Strokes 100, Eff 95. Labels differ slightly from the 1-page report (Pump Rating vs Pwr, Rod Diameter vs Rod Dia).

#### Mud Additive Amounts (sidebar)
*Layout:* table; one row = one additive

Fields, in printed order:
- Des
- Field Est (Cost/unit)
- Consumed

*Notes:* No sample rows.

#### Survey Data (sidebar)
*Layout:* key-value block (latest survey station)

Fields, in printed order:
- MD (ftKB)
- Incl (°)
- Azm (°)
- TVD (ftKB)

*Notes:* Sample all 0.00 — appears to show the day's last/current directional survey station.

#### Last 5 Formations (sidebar)
*Layout:* table; one row = one formation top

Fields, in printed order:
- Formation Name
- Prog Top MD (ftKB)
- Drill Top MD (ftKB)

*Notes:* Header stacks 'Prog Top MD (ftKB)' and 'Drill Top MD (ftKB)'. Samples: Blue Ridge | 2,198.16 | 2,198.2; Ten Oaks | 4,248.69 | 4,255.2 (prognosed vs actual drilled top).

#### Last Casing String (sidebar)
*Layout:* table (single row)

Fields, in printed order:
- Casing Description
- Run Date
- Set Depth (ftKB)

*Notes:* 'Set Depth' prints elided as 'Set Depth…'. Sample: Structural Casing | 2000-02-22 | 1,598.8.

#### Interval Problems (page 2)
*Layout:* table; one row = one problem event over an interval, with full-width Comment sub-row

Fields, in printed order:
- Problem Type
- Problem Sub Type
- Start Date
- Start Depth (ftKB)
- End Depth (ftKB)
- Est Cost (Cost)
- Est Lost Time (hr)
- Comment

*Notes:* Sample: Equipment Trouble | ROV | 2000-02-22 | 2,014.0 | 2,014.0 | 2,500.00 | 0.50; Comment: 'Primary control signal to ROV was lost. Switched to backup system.' Referenced by Time Log Prob Ref #.

#### Interval Lessons (page 2)
*Layout:* table; one row = one lesson learned, with full-width Comment sub-row

Fields, in printed order:
- Lesson Type
- Start Date
- End Date
- Start Depth (ftKB)
- End Depth (ftKB)
- Est Cost Saving (Cost)
- Est Time Saving (hr)
- Comment

*Notes:* 'Est Cost Saving (Cost)' prints elided as 'Est Cost Saving (C…'. Sample: Drilling | 2000-02-21 | 2000-02-28 | 1,000.0 | 2,650.0 | 625.00 | 8.00; Comment about shock sub/bit ROP.

#### Safety Incidents (page 2)
*Layout:* table; one row = one safety incident that day

Fields, in printed order:
- Time
- Category
- Type
- SubTyp
- Cause
- Lost time?
- Severity

*Notes:* 'Lost time?' header stacks 'Lost' over 'time?'. Sample: 00:00 | Near Miss | (blank type) | ... | No | (blank).

#### Page footer (both pages)
*Layout:* key-value footer strip

Fields, in printed order:
- www.peloton.com
- Page n/2
- Report Printed: (date)

*Notes:* Sample 'Page 1/2' / 'Page 2/2', 'Report Printed: 2009-09-14'.


---

## 08_DirectionalPlot.pdf — Directional Plot - Plan vs Actual

**Purpose:** Graphical comparison of the planned directional trajectory against actual surveyed wellbore path(s) for one well, as a plan (map) view and a vertical section view, with a small well-identity panel. Audience: directional drillers/engineers.

**Granularity:** single-well whole-life snapshot (all wellbores/laterals of one well; sample is a 'Multiple Laterals' configuration)

**Page layout:** Landscape letter (792x612 pt), 1 page, content rotated 90° on the sheet. Left edge: well information panel and series legend. Main area split into two plots: a smaller plan view (NS vs EW) and a large vertical section view (TVD vs VS). Footer text (www.peloton.com, Page 1/1, Report Printed) along the page edges.

**Data entities:** `well`, `wellbore`, `directional_plan`, `plan_survey_station`, `survey_station`, `vertical_section_reference`

### Sections (in reading order)

#### Well information panel
*Layout:* key-value block (label left, value right)

Fields, in printed order:
- Well Name:
- API/UWI
- Surface Legal Location
- License #
- Well Configuration Type
- Ground Elevation (ft)
- Casing Flange Elevation (ft)
- KB-Ground Distance (ft)
- KB-Casing Flange Distance (ft)

*Notes:* Samples: Well Name 'Sample 07 - Dual completion', API/UWI 12456748837836, Surface Legal Location OCS-A-1234, License # 41321s8543x, Well Configuration Type 'Multiple Laterals', Casing Flange Elevation 44.00, KB-Casing Flange Distance 55.00.

#### Legend
*Layout:* chart legend block

Fields, in printed order:
- Plan
- Vertical Section

*Notes:* 'Plan' is the planned-trajectory series entry; actual wellbore traces are drawn as additional colored series (their names are graphic, per wellbore/lateral). 'Vertical Section' labels the section-view legend/reference.

#### Plan view plot
*Layout:* chart

Fields, in printed order:
- NS (ft)
- EW (ft)

*Notes:* Map view of the trajectory. Printed tick samples: NS axis 2000, 1500, 1000, 500, 0; EW axis 2000, 0, -2000, -4000. One line series per trajectory (plan + each actual wellbore).

#### Vertical section plot
*Layout:* chart

Fields, in printed order:
- TVD (ftKB)
- VS (ft)

*Notes:* Section view. Printed tick samples: TVD axis 0 through 11000 ftKB; VS axis -8000 through 9000 ft. On this landscape sheet TVD runs along the long axis. One line series per trajectory (plan + each actual wellbore).

#### Page footer
*Layout:* key-value footer strip (rotated along page edges)

Fields, in printed order:
- www.peloton.com
- Page 1/1
- Report Printed: (date)

*Notes:* Sample 'Report Printed: 2009-09-14'.

### Graphics

- Plan view (map) line chart: horizontal axis NS (ft) [samples 2000-0], vertical axis EW (ft) [samples 2000 to -4000]; series = planned trajectory ('Plan') plus one actual trace per wellbore/lateral, computed from survey stations (NS/EW offsets from surface location).
- Vertical section line chart: TVD (ftKB) axis [0-11000] vs VS (ft) axis [-8000-9000]; series = planned trajectory plus one actual trace per wellbore/lateral; VS = vertical section projection of NS/EW along the vertical-section azimuth (computed from survey stations).


---

## 09_DrillingSummary1.pdf — Drilling Summary 1

**Purpose:** One-page whole-well drilling dashboard: well identity/location panel, actual directional schematic with perforations, cost breakdown by cost description, time breakdown by time code, NPT breakdown by unscheduled type, and depth+cost progress vs job day curves. Audience: management/engineering end-of-well or in-progress summary.

**Granularity:** single-well whole-life (spud to rig release; one instance = one well)

**Page layout:** Landscape tabloid (1224x792 pt), 1 page, content rotated 90° on the sheet. Left: well header panel and 'Schematic' (directional schematic, actual). Center/right: four chart panels — 'Cost Breakdown by Des', 'Time Breakdown by Code1', 'NPT by Des', and 'Depth and Cost vs Days'. Footer: 'Report generated on <date>', 'Page 1', 'www.peloton.com'.

**Data entities:** `well`, `wellbore`, `survey_station`, `perforation`, `cost_item`, `time_log`, `daily_report`, `unscheduled_event_type`

### Sections (in reading order)

#### Report title
*Layout:* title text

Fields, in printed order:
- Drilling Summary 1

#### Well header panel
*Layout:* key-value block (multi-column label/value)

Fields, in printed order:
- Well Name (unlabeled, top)
- API/UWI
- Surface Legal Location
- Field Name
- Area
- Operator
- County
- State/Province
- East/West Distance (ft)
- E/W Ref
- North/South Distance (ft)
- N/S Ref
- Latitude (°)
- Longitude (°)
- Gr Elev (ft)
- CF Elev (ft)
- KB-Ground Distance (ft)
- KB-Casing Flange Distance (ft)
- Spud Date
- Rig Release Date
- Total Depth (ftKB)

*Notes:* Samples: 'Sample 11 - Full Data', API/UWI 0987656789, Field Name Akuinu, Area South, Operator 'Peloton Oil & Gas', State Texas, E/W 800.0 E, N/S 1,350.0 N, Latitude 51° 0' 0" N, Longitude 114° 0' 0" W, KB-Ground 0.00, KB-Casing Flange 210.00, Spud 2000-02-21 00:00, Rig Release 2000-03-18 00:00, Total Depth 12,503.3.

#### Schematic
*Layout:* schematic (directional wellbore schematic, actual)

Fields, in printed order:
- Schematic (panel title)
- Directional schematic (actual) (caption)
- wellbore trace annotation: '<profile> - <wellbore name>, <generated datetime>'
- perforation annotations: '<perf type>; <top depth>-<bottom depth>; <date>'

*Notes:* Sample annotations: 'Deviated - Original Hole, 2009-09-14 1:43:42 PM'; 'TCP; 12,093.0-12,122.0; 2000-05-30'; 'TCP; 12,139.0-12,169.0; 2000-05-30'. Drawn from actual survey geometry with perforation intervals marked.

#### Cost Breakdown by Des
*Layout:* chart (vertical bar)

Fields, in printed order:
- Cost Description (category axis)
- Field Est (Cost) (1,000's) (value axis)

*Notes:* One bar per cost description, whole-well total field-estimate cost in thousands; value axis samples 0-4,500. Category samples: Overhead, Helicopter, Fuel, Mud Engineer, Mud logging, ROV services, Electric logging, Other Drill Tools, Trucking Charges, Casing - Conductor, Casing - Surface, Casing - Production, Extra Personnel, Direct Supervision, Work/Supply Boats, Rig Operating Rate, Cementing services, Cementing equipment, Fees, licenses & taxes, Solids Control Equipment, Supply & Transportation, Cement & cement additives, Miscellaneous well services, Directional Drilling Services, Drilling & completion fluids, Bits, scrapers & hole openers, Subsea wellhead equipment, Casing/Tubing Crew and Tools. Computed: sum of cost items grouped by description.

#### Time Breakdown by Code1
*Layout:* chart (vertical bar, sorted descending)

Fields, in printed order:
- Code 1 vs % Total Time (sorted) (chart subtitle)
- Code 1 (category axis)
- % Total Time (%) (value axis)

*Notes:* One bar per time-log Code 1 value; axis samples 0-25%. Category tick samples: 2, 1, 8, 4, 7, 9, 5, 6, 3, 30, 29, 35, 22, 20, 19, 25, 16, 14, 21, 11, 13. Computed: sum of time-log hours per Code 1 / total job hours.

#### NPT by Des
*Layout:* chart (vertical bar, sorted descending)

Fields, in printed order:
- Unscheduled Type vs % Total Time (sorted) (chart subtitle)
- Unscheduled Type (category axis)
- % Total Time (%) (value axis)

*Notes:* Non-productive time by unscheduled-event type; axis samples 0-90%. Category samples: TROU, WHEAD, RIG REP, EQ PROB. Computed from time-log entries flagged as unscheduled/NPT.

#### Depth and Cost vs Days
*Layout:* chart (dual-axis line)

Fields, in printed order:
- Job Day (days) (X axis)
- End Depth (ftKB) (Y axis 1)
- Cum Field Est To Date (Cost) (Y axis 2)
- series: Job Day vs Cum Field Est To Date
- series: Job Day vs End Depth

*Notes:* X-axis tick samples 2-28 days; End Depth axis 2000-12000 ftKB; cost axis 2000000-10000000. Computed from daily reports (end depth per day) and cumulative daily field-estimate cost.

#### Page footer
*Layout:* key-value footer strip

Fields, in printed order:
- Report generated on (date)
- Page 1
- www.peloton.com

*Notes:* Sample 'Report generated on 2009-09-14'.

### Graphics

- Directional schematic (actual): scaled drawing of the wellbore path from surveys, annotated with wellbore profile/name/generation timestamp and perforation intervals (type; top-bottom depth; date).
- Bar chart 'Cost Breakdown by Des': X = Cost Description (category), Y = Field Est (Cost) (1,000's), 0-4,500.
- Bar chart 'Time Breakdown by Code1' / 'Code 1 vs % Total Time (sorted)': X = Code 1 (time codes, sorted by share), Y = % Total Time (%), 0-25.
- Bar chart 'NPT by Des' / 'Unscheduled Type vs % Total Time (sorted)': X = Unscheduled Type (TROU, WHEAD, RIG REP, EQ PROB), Y = % Total Time (%), 0-90.
- Dual-axis line chart 'Depth and Cost vs Days': X = Job Day (days) 2-28; series 'Job Day vs End Depth' on End Depth (ftKB) axis 2000-12000, series 'Job Day vs Cum Field Est To Date' on cost axis 2,000,000-10,000,000.


---

## 10_Phases_PlanvsActual.pdf — Phases - Plan vs Actual

**Purpose:** Whole-well phase-by-phase comparison of the drilling plan against actuals: planned vs actual depths, durations, dates and costs per job phase, with a combined days-vs-depth and days-vs-cost curve (plan and actual). Audience: drilling engineering/management performance review.

**Granularity:** single-well whole-life, per-phase (one instance = one well/job; table has one row per job phase — 8 phases in the sample)

**Page layout:** Landscape legal (1008x612 pt), 1 page, content rotated 90° on the sheet. Top: title and job header key-value block. Middle: 'Phases' table, one row per phase, ~18 attribute columns spanning full width. Bottom: full-width combined plan-vs-actual days/depth/cost chart with 4-series legend. Footer along edges.

**Data entities:** `well`, `job`, `job_phase`, `job_phase_plan`, `afe`, `cost_item`, `daily_report`, `time_log`

### Sections (in reading order)

#### Title and job header
*Layout:* key-value header block

Fields, in printed order:
- Phases - Plan vs Actual (report title)
- Well Name:
- Job Category
- Primary Job Type
- Secondary Job Type
- AFE Number
- Total AFE + Supp Amount (Cost)
- Total Field Estimate (Cost)
- AFE-Field Estimate (Cost)

*Notes:* Samples: Well Name 'Sample 13 - Phase and Prod', Job Category Drilling, Primary Job Type Drilling, AFE Number 879546, Total AFE + Supp 1,245,400.00, Total Field Estimate 1,176,573.00, AFE-Field Estimate 68,827.00. AFE-Field Estimate is computed = Total AFE + Supp Amount − Total Field Estimate.

#### Phases
*Layout:* table; one row = one job phase, in chronological order; columns grouped plan-side then actual-side

Fields, in printed order:
- Phase Type 1
- Phase Type 2
- Planned Start Depth (ftKB)
- Planned End Depth (ftKB)
- Dur ML (days)
- Pl Cum Days ML (days)
- Planned Likely Phase Cost (Cost)
- Pl Cum Cost ML (Cost)
- Plan Cost/Depth (Cost/ft)
- Actual Start Date
- Actual End Date
- Actual Dur (days)
- Act Cum Dur (days)
- Actual Start Depth (ftKB)
- Actual End Depth (ftKB)
- Actual Phase Field Est (Cost)
- Actual Phase Cum Field Est (Cost)
- Cost/Depth (Cost/ft)

*Notes:* Headers wrap over 2-3 printed lines (e.g. 'Planned Likely / Phase Cost / (Cost)', 'Pl Cum / Days ML / (days)', 'Actual Phase Cum / Field Est (Cost)'); ML = Most Likely plan estimate. Sample rows (8 phases): Phase Type 1 = Mob and Rig up, Surface, Surface, Production, Production, Production, Production, Mob; Phase Type 2 = Mob and Rig up, Drill-Vertical, Run and Cement Casing, Drill-Vertical, Drill-Deviation Control, Log, Run and Cement Casing, Demob. Planned depths 0.0-9,022.3; Dur ML samples 1.34, 1.21, 0.50, 6.40, 7.15, 0.06, 2.00, 0.54; Pl Cum Days ML running total 1.34-19.20; Planned Likely Phase Cost 88,000.00-218,000.00 with 9,500.00 last; Pl Cum Cost ML running total 88,000.00-1,003,500.00; Plan Cost/Depth samples 61.16, 39.19, 131.81; Actual Start/End Date samples 2002-10-06 09:00 - 2002-10-31 20:00; Actual Dur samples 1.53, 1.38, 1.23, 7.71, 10.23, 0.42, 2.33, 0.64; Act Cum Dur running total 1.53-25.46; Actual depths 0.0-9,028.9; Actual Phase Field Est 185,252.91-257,867.61; Actual Phase Cum Field Est running total 185,252.91-1,174,308.83 (plus 8,632.14 final); Cost/Depth samples 576.17, 69.49, 41.45, 140.03. Computed columns: both Cum days columns and both Cum cost columns are running sums; both Cost/Depth columns = phase cost / phase footage.

#### Plan vs actual days/depth/cost chart
*Layout:* chart (dual-axis line, full width below table)

Fields, in printed order:
- Days (X axis)
- Depth (ftKB) (Y axis 1)
- Cost (1,000's) (Y axis 2)
- series: Planned Likely Cum Days vs Planned End Depth
- series: Planned Likely Cum Days vs Planned Likely Cum Phase Cost
- series: Cum Time Log Days vs End Depth
- series: Actual Cum Duration vs Actual Phase Cum Field Est

*Notes:* X-axis tick samples 1-26 days; Depth axis -1,000 to 10,000 ftKB; Cost axis $200-$1,000 (thousands). Four legend entries exactly as listed: two planned curves (depth and cost vs planned cumulative days) and two actual curves (end depth vs cumulative time-log days, cumulative field-estimate cost vs actual cumulative duration).

#### Page footer
*Layout:* key-value footer strip (rotated along page edges)

Fields, in printed order:
- www.peloton.com
- Page 1/1
- Report Printed: (date)

*Notes:* Sample 'Report Printed: 2009-09-14'.

### Graphics

- Dual-axis line chart: X = Days (1-26); left/primary Y = Depth (ftKB) (-1,000 to 10,000); secondary Y = Cost (1,000's) ($200-$1,000). Series: 'Planned Likely Cum Days vs Planned End Depth', 'Planned Likely Cum Days vs Planned Likely Cum Phase Cost', 'Cum Time Log Days vs End Depth' (actual), 'Actual Cum Duration vs Actual Phase Cum Field Est' (actual). Planned points come from the phase plan; actual depth curve from daily reports/time log days, actual cost curve from cumulative phase field estimates.


---

## 11_PhaseSummaryGraph.pdf — Phase Summary Graph

**Purpose:** Single-well planned-vs-actual comparison of each job phase: duration (bars) and cost (lines) per phase, so engineers can see which phases ran over plan in time and money.

**Granularity:** single-well whole-job; one bar group / line point per job phase (7 phases in sample)

**Page layout:** Landscape letter (792x612), 1 page. Top: WellView logo left, centered title. Below: 'Well Name:' line, then a 3-row key-value header grid spanning page width. Body: one large combo bar+line chart with dual Y axes filling the rest of the page. Legend strip under the chart. Footer line at bottom.

**Data entities:** `well`, `job`, `job_phase`, `phase_plan`, `cost_item`, `afe`

### Sections (in reading order)

#### Page header
*Layout:* key-value block

Fields, in printed order:
- WellView (logo)
- Phase Summary Graph (title)
- Well Name:

*Notes:* Well Name sample value: 'Sample 11 - Full Data'

#### Well/job header grid — row 1
*Layout:* key-value block (label above value), 9 cells left to right

Fields, in printed order:
- API/UWI
- License #
- Field Name
- State/Province
- Well Configuration Type
- Spud Date
- Rig Release Date
- KB-Ground Distance (ft)
- Total Depth (ftKB)

*Notes:* Samples: API/UWI=0987656789, License #=8818838, Field Name=Akuinu, State/Province=Texas, Well Configuration Type=Deviated, Spud Date=2000-02-21, Rig Release Date=2000-03-18, KB-Ground Distance blank, Total Depth=12,503.3 (right-aligned)

#### Well/job header grid — row 2
*Layout:* key-value block, 6 cells left to right

Fields, in printed order:
- AFE Number
- Job Category
- Primary Job Type
- Status 1
- Target Depth (ftKB)
- Target Formation

*Notes:* Samples: AFE Number=9876543, Job Category=Drilling, Primary Job Type='Drilling - original', Status 1='Job Complete', Target Depth=11,500.0, Target Formation='Blue Heron Shale'

#### Well/job header grid — row 3
*Layout:* key-value block, 6 cells left to right

Fields, in printed order:
- Planned Start Date
- Start Date
- Min Planned End Date
- Planned Most Likely End Date
- Max Planned End Date
- End Date

*Notes:* Samples: 2000-02-20 00:00, 2000-02-21 00:00, 2000-03-13 00:00, 2000-03-20 12:00, 2000-03-25 12:00, 2001-03-18 02:15 (datetime to minutes)

#### Phase Summary combo chart
*Layout:* chart (clustered bars + 2 line series, dual Y axes)

Fields, in printed order:
- Duration (days) (left Y axis, 0-14)
- Cost (1,000,000's) (right Y axis, ($1) to $9)
- X category = phase sequence, group label = Phase Type 1 (Surface / Intermediate / Production)
- vertical on-bar label = phase type 2 (Drill-Vertical, Run and Cement Casing, Drill-Deviation Control, Log & Core)

*Notes:* 7 phase categories in sample: Surface:Drill-Vertical, Surface:Run and Cement Casing, Intermediate:Drill-Deviation Control, Intermediate:Run and Cement Casing, Production:Drill-Deviation Control, Production:Log & Core, Production:Run and Cement Casing. Right axis cost printed in millions with ($1) negative notation.

#### Legend
*Layout:* single row under chart

Fields, in printed order:
- Phase Type 1 vs Planned Likely Duration (red bar)
- Phase Type 1 vs Actual Duration (yellow bar)
- Phase Type 1 vs Actual Phase Field Est (green solid line, triangle-up markers)
- Phase Type 1 vs Planned Likely Phase Cost (green dashed line, triangle-down markers)

*Notes:* Duration series plot on left axis; cost series on right axis

#### Page footer
*Layout:* single row

Fields, in printed order:
- www.peloton.com (left)
- Page 1/1 (center)
- Report Printed: (right)

*Notes:* Report Printed sample: 2009-09-14

### Graphics

- Combo chart: X = phase sequence grouped by Phase Type 1 (Surface/Intermediate/Production) with rotated phase-type-2 label drawn vertically on each bar group; left Y = Duration (days) 0-14; right Y = Cost (1,000,000's) ($1)-$9; series: Planned Likely Duration (red bars), Actual Duration (yellow bars), Actual Phase Field Est (green solid line w/ triangle-up markers), Planned Likely Phase Cost (green dashed line w/ triangle-down markers)


---

## 12_MultiWell_DailyDrillingSummary2.pdf — Daily Drilling Summary 2

**Purpose:** Multi-well morning-report digest: for each active well, the latest daily report headline numbers, contacts, operations summaries and the day's full time log, grouped under the rig running the well. Audience: drilling superintendent scanning all wells at once.

**Granularity:** multi-well; one repeating block per well, each block = that well's single (latest/selected) daily report plus its 24-hr time log

**Page layout:** Portrait letter (612x792), 1+ pages. Centered title at top. Then repeating well blocks stacked vertically: grey rig-name band, 4 rows of 3-column key-values, 3 full-width text rows, 'Time Log' sub-table. Footer on every page: www.peloton.com left, Page n/n center, Report Printed right.

**Data entities:** `well`, `job`, `rig`, `afe`, `daily_report`, `daily_contact`, `operations_summary`, `time_log`, `cost_item`

### Sections (in reading order)

#### Page header
*Layout:* single row

Fields, in printed order:
- WellView (logo)
- Daily Drilling Summary 2 (title)

#### Rig group band (per well block)
*Layout:* full-width band above each well block

Fields, in printed order:
- Rig name(s)

*Notes:* Contractor + rig number; comma-joined when multiple rigs, e.g. 'Precision Drilling Ltd 22', 'Tri-City Drilling Ltd. 1, Tri-City Drilling Ltd. 2'

#### Well daily header (per well block)
*Layout:* key-value block, 4 rows x 3 columns then 3 full-width rows

Fields, in printed order:
- Well Name:
- API/UWI:
- License #:
- AFE Number:
- Daily Field Est Total (Cost):
- Cum Field Est To Date (Cost):
- Report Number:
- Days From Spud (days):
- End Depth (ftKB):
- Last Phase:
- Phase Days Ahead (days):
- Job Days Ahead (days):
- Daily Contacts:
- Operations Summary:
- Operations Next Report Period:

*Notes:* Samples: Well Name='Sample 14 - Phase and Prod', API/UWI=100/02-02-050-20W5/00, License #=1234570, AFE Number=223311, Cum Field Est To Date=1,020,532.00, Report Number=26.0, Days From Spud=26.00, End Depth=7,874.0, Last Phase='Mob, Demob', Phase Days Ahead=-0.64, Job Days Ahead=-8.41 (negative = behind plan). Daily Contacts is a joined list 'Role, Name, ;' e.g. 'Rig Manager, Bob Green, ; Drilling Foreman, Frank Grey, ...'. Operations Summary / Operations Next Report Period are free-text, blank in sample. Cum Field Est To Date is a computed running total of daily field-estimate costs; Days From Spud computed from report date minus spud; Phase/Job Days Ahead computed plan-vs-actual variances.

#### Time Log (per well block)
*Layout:* table; one row = one time-log interval within the report day

Fields, in printed order:
- Start Date
- Dur (hr)
- Cum Dur (hr)
- End Date
- Code 1
- Code 2
- Com

*Notes:* Samples: Start Date=2002-04-14 00:00, Dur=0.75, Cum Dur=0.75 (running sum of Dur within the day, ends at 24.00), End Date=2002-04-14 00:45, Code 1=numeric op code (21, 1, 22) or the literal 'INACTIVE' spanning code columns, Code 2=code description (SAFETY MEETING, RIGUP & TEARDOWN, W.O.DAY LIGHT), Com=free-text comment wrapping to multiple lines ('Com' header is likely truncated 'Comment').

#### Page footer
*Layout:* single row

Fields, in printed order:
- www.peloton.com (left)
- Page 1/1 (center)
- Report Printed: 2009-09-14 (right)


---

## 13_MultiWell_Drilling KPIs.pdf — Drilling KPIs (Excel pivot export — no printed title, WellView logo only)

**Purpose:** Multi-well end-of-well KPI scorecard comparing cost and time performance across wells: AFE vs field-estimate cost, cost per depth, depths, hours breakdown, problem time and ROP, with a Grand Total column.

**Granularity:** multi-well comparison, whole-well-life aggregates; one pivot row per well plus a Grand Total row

**Page layout:** Landscape letter (792x612, page /Rotate 90 — content authored portrait), 1 page. WellView logo top-left. Below: pivot page-filter table (10 rows x 2 cols) with a 'Data' selector row, then the main KPI pivot table (header row + 4 well rows + Grand Total row x 13 columns).

**Data entities:** `well`, `well_classification`, `job`, `afe`, `afe_supplement`, `cost_item`, `daily_report`, `time_log`, `problem_time`, `personnel`, `depth_progress`

### Sections (in reading order)

#### Pivot page filters
*Layout:* key-value table, 10 rows: filter field | current selection

Fields, in printed order:
- Country
- District
- Division
- State/Province
- Field Name
- Well Type
- Well Configuration
- Job Category
- Primary Job Type
- Secondary Job Type
- Data

*Notes:* Every filter shows '(All)' in the sample. 'Data' selector shows 'AFE+Supp' (cost basis used by the money columns).

#### Drilling KPI pivot table
*Layout:* table; one row = one well; last row = Grand Total; columns = KPI measures

Fields, in printed order:
- Well Name
- AFE+Supp Amt
- Field Est
- AFE ‐ Field Est
- Cost/Depth
- Total Drilled
- Total Depth
- Total Log Time Hrs
- Problem Hrs
- Problem Time %
- Drilling Hrs
- Avg. ROP
- Personnel Hrs

*Notes:* Sample rows (wells 'Sample 12/13/14/15 ‐ Phase and Prod'): Sample 12: $2,165,600 / $2,172,468 / ‐$6,868 / 201.02 / — / 10236 / 1160 / — / — / 780 / 13.86 / —. Sample 13: $1,245,400 / $1,176,573 / $68,827 / 130.31 / 9029 / 644 / 70 / 10.87 / 296 / 30.53. Sample 14: $960,400 / $1,020,532 / ‐$60,132 / 130.70 / 7874 / 609 / 117 / 19.13 / 263 / 29.63. Sample 15: $710,700 / $729,275 / ‐$18,575 / 100.76 / 7238 / 444 / — / — / 306 / 23.63. Grand Total: $5,082,100 / $5,098,848 / ‐$16,748 / 562.79 / 34377 / 2857 / 187 / 30.00 / 1645 / 97.66. Computed: 'AFE ‐ Field Est' = AFE+Supp Amt minus Field Est (variance, $); 'Cost/Depth' = Field Est ÷ Total Depth ($/ft, verified 1,176,573/9029=130.31); 'Problem Time %' = Problem Hrs ÷ Total Log Time Hrs x100 (70/644=10.87); 'Avg. ROP' = Total Depth ÷ Drilling Hrs (9029/296=30.5). Grand Total is a naive pivot SUM of every column — including Cost/Depth, Problem Time % and Avg. ROP (562.79, 30.00, 97.66). 'Total Drilled' and 'Personnel Hrs' columns are blank in the sample; value-to-header mapping of 'Cost/Depth' vs 'Total Drilled' is the one ambiguity (the 201.02-style values arithmetically prove to be Field Est ÷ Total Depth).


---

## 14_MultiWell_DrillingOffsets.pdf — Drilling Offsets (page captions: Actual Days Vs Depth / Days from Spud Vs Depth / Actual Days Vs Cost / Actual Depth Vs Cost / Mud WT. Vs Check Depth)

**Purpose:** Offset-well benchmarking pack: overlays the drilling curves (time/depth/cost) and mud-weight profiles of several wells on shared axes so a new well can be compared against offsets.

**Granularity:** multi-well comparison (3 wells in sample), whole-life per well; 5 pages, one chart per page; chart points come from per-day report values (or per-mud-check on page 5)

**Page layout:** Landscape letter (792x612, page /Rotate 90), 5 pages. Each page: WellView logo top-left, page caption at top-left ('Actual Days Vs Depth' etc.), a well-identification table (grey header row + one row per well) across the top, and one full-width XY line chart below with legend of well names under the plot. No page footer.

**Data entities:** `well`, `daily_report`, `cost_item`, `mud_check`

### Sections (in reading order)

#### Offset well header table (pages 1,3,4,5)
*Layout:* table; one row = one well

Fields, in printed order:
- Well Name
- API Number
- Field Name
- County
- State
- License No.
- Ground Elevation
- KB Elevation

*Notes:* Sample rows: 'Sample 14 - Phase and Prod' / 100/02-02-050-20W5/00 / Gilby / (blank) / Alberta / 1234570 / 3619.42 / 3640.42; 'Sample 13...' / 100/04-36-050-21W5/00 / Gilby / Alberta / 1234568 / 3366.47 / 3380.25; 'Sample 12...' / 100/01-26-050-21W5/00 / Gilby / Alberta / 1234567 / 3517.39 / 3529.53. Elevation units not printed (ft implied). On page 2 the same table is rendered wider: only Well Name, API Number, Field Name, County, State fit; the License No. column is clipped at the right page edge (shows '12' of '1234...'), Ground/KB Elevation fall off the page.

#### Page 1 chart — Actual Days Vs Depth
*Layout:* chart

Fields, in printed order:
- Days (X axis, 0-60, ticks every 10)
- Depth (ftKB) (Y axis, 0-12,000, ticks every 2,000, 0 at TOP — depth increases downward)
- series: one line per well with markers (blue diamond / red square / green triangle)
- chart title 'Actual Days Vs Depth'
- legend below plot: well names (truncated 'Sample 14 -…' in sample)

*Notes:* One point per daily report: cumulative job days vs end depth

#### Page 2 chart — Days from Spud Vs Depth
*Layout:* chart

Fields, in printed order:
- Days from spud (X axis, starts at 0; tick labels beyond 0 not visible in sample)
- Depth (ftKB) (Y axis, ticks 2,000 / 4,000 / 6,000 visible, 0 at top, increasing downward)
- series: one line per well with markers
- chart title 'Actual Days Vs Depth' (inner title reuses page-1 wording)
- page caption 'Days from Spud Vs Depth'

*Notes:* One point per daily report: days from spud vs end depth

#### Page 3 chart — Actual Days Vs Cost
*Layout:* chart

Fields, in printed order:
- Days (X axis, 0.0-60.0, ticks every 10)
- Cost (Y axis, 0.00-2,500,000.00, ticks every 500,000.00, 0 at bottom)
- series: one line per well with markers
- chart title 'Actual Days Vs Cost'

*Notes:* One point per daily report: cumulative days vs cumulative field-estimate cost

#### Page 4 chart — Actual Depth Vs Cost
*Layout:* chart

Fields, in printed order:
- Cost (X axis, 0.0-2,500,000.0, ticks every 500,000.0)
- Depth (ftKB) (Y axis, 0-12000, ticks every 2000, 0 at top, increasing downward)
- series: one line per well with markers
- chart title 'Actual Depth Vs Cost'

*Notes:* Cumulative cost vs depth; note depth ticks printed without thousands separators on this page (2000 vs 2,000 on p1)

#### Page 5 chart — Mud WT. Vs Check Depth
*Layout:* chart

Fields, in printed order:
- Mud Wt. (lb/gal) (X axis, 0.0-14.0, ticks every 2.0)
- Mud Check Depth (ftKB) (Y axis, 1000-9000, ticks every 1000, increasing downward)
- series: one line per well with markers
- chart title 'Mud WT. Vs Mud Check Depth'
- page caption 'Mud WT. Vs Check Depth'

*Notes:* One point per mud check: mud density vs the depth at which the check was taken

### Graphics

- 5 XY line charts (one per page), each overlaying one series per well with point markers; depth axes are inverted (0 at top); legend of well names below each plot
- p1: X Days 0-60 / Y Depth (ftKB) 0-12,000 inverted; p2: X Days from spud / Y Depth (ftKB) inverted; p3: X Days 0-60 / Y Cost 0-2.5M; p4: X Cost 0-2.5M / Y Depth (ftKB) 0-12,000 inverted; p5: X Mud Wt. (lb/gal) 0-14 / Y Mud Check Depth (ftKB) 1000-9000 inverted


---

## 15_MultiWell_IntervalProblemPivot.pdf — Problem Cost by Accountable Party

**Purpose:** Aggregates the cost of drilling interval problems across wells and pins each dollar on who is accountable (operator, contractor, service company), broken down by problem type.

**Granularity:** multi-well aggregate pivot chart; one stacked column per accountable party, summed over all interval-problem records in the selected wells

**Page layout:** Landscape letter (792x612, page /Rotate 90), 1 page. Single Excel-style stacked column chart centered on the page with grey plot area, chart title at top, legend box at right. No WellView header table and no footer.

**Data entities:** `well`, `job`, `interval_problem`, `problem_type`, `accountable_party`, `cost_item`

### Sections (in reading order)

#### Problem Cost by Accountable Party chart
*Layout:* chart (stacked column)

Fields, in printed order:
- chart title 'Problem Cost by Accountable Party'
- X axis categories = Accountable Party (sample: Contractor, Operator, Tidewater)
- Y axis = problem cost, 0-40000, gridlines/ticks every 5000 (currency units, no label printed)
- legend (right side, top to bottom): 'Rig Failure - (blank)' (purple), 'Logistical - (blank)' (green), 'Hole Trouble - Tight Hole' (red), 'Equipment Trouble - ROV' (blue-violet, black border)

*Notes:* Series names are 'Problem Type - Specific Problem' pairs; '(blank)' means no specific problem recorded. Sample stack values (read from bars): Contractor ~9,800 all Equipment Trouble - ROV; Operator ~24,500 all Hole Trouble - Tight Hole; Tidewater ~38,500 total = ~19,400 Logistical + ~19,100 Rig Failure. Each bar total = sum of interval-problem cost for that accountable party; segments = sum per (problem type, specific problem).

### Graphics

- Stacked column chart: X = Accountable Party (Contractor, Operator, Tidewater), Y = summed problem cost 0-40000 step 5000; 4 stacked series keyed 'Problem Type - Specific Problem' (Rig Failure - (blank) purple, Logistical - (blank) green, Hole Trouble - Tight Hole red, Equipment Trouble - ROV blue); grey plot background, legend box right


---

## 16_MultiWell_PhaseSummaryPivot.pdf — (no printed title — WellView logo only; file name: MultiWell Phase Summary Pivot)

**Purpose:** Excel-style pivot that aggregates job-phase durations across many wells, giving Count/Avg/Min/Max/StdDev/Sum of phase duration for each Job Category / Phase Type 1 / Phase Type 2 combination. Used by drilling engineers to benchmark how long each phase typically takes across a well population.

**Granularity:** multi-well aggregate: one pivot covering all wells that pass the filter block; one data row per (Job Category, Phase Type 1, Phase Type 2) combination, stats computed across all matching phase records from all wells

**Page layout:** Landscape letter (792x612pt), 1 page. WellView logo top-left. Upper-left: 9-row two-column filter block. Below it: single pivot table occupying the left ~75% of the page. No footer.

**Data entities:** `well`, `job`, `job_phase`, `field`, `district`, `division`

### Sections (in reading order)

#### Pivot filter block
*Layout:* key-value block, two columns (label | selected value), 9 rows

Fields, in printed order:
- District
- Division
- Country
- State/Province
- Field Name
- Well Type
- Well Configuration Type
- Primary Job Type
- Well Name

*Notes:* Each filter shows its current selection; in the sample every value is "(All)". These are the pivot page-filters that define the well population.

#### Phase summary pivot table
*Layout:* pivot table; 3 row-header columns on the left, a "Data" super-header spanning 6 statistic columns on the right

Fields, in printed order:
- Job Category
- Phase Type 1
- Phase Type 2
- Data (super-header)
- Count
- Avg
- Min
- Max
- StdDev
- Sum

*Notes:* One row = one (Job Category, Phase Type 1, Phase Type 2) combination; group labels print once and blank-repeat (outline style). Sample: Drilling > Mob and Rig up > Mob and Rig up: 3 / 0.94 / 0.41 / 1.53 / 0.56 / 2.82; Drilling > Surface > {Drill-Vertical, Run and Cement Casing, NU, Test and Drill Out}; Drilling > Production > {Drill-Vertical, Run and Cement Casing, Drill-Deviation Control, Log}; Drilling > Mob > Demob. Values are phase durations in days aggregated across wells: Count = number of contributing phase records/wells, Sum ≈ Count × Avg, StdDev is the spread across wells. All six statistic columns are computed from the underlying per-well phase duration.


---

## 17_MultiWell_SafetyIncidents.pdf — Safety Incidents

**Purpose:** Multi-well HSE log listing every recorded safety incident with its classification, date, cause, lost-time flag and narrative, for safety review across jobs and wells.

**Granularity:** multi-well: one report lists all safety incidents across the selected wells/jobs; one row per incident. Per row the WellName, Job Typ and all incident attributes vary.

**Page layout:** Landscape letter (792x612pt), 1 page. WellView logo top-left, centered title, single full-width table, footer strip at bottom.

**Data entities:** `safety_incident`, `job`, `well`

### Sections (in reading order)

#### Incidents table
*Layout:* table, one row per safety incident

Fields, in printed order:
- Type
- SubTyp
- Date
- Severity
- Cause
- Lost time?
- Com
- Job Typ
- WellName

*Notes:* Labels are printed truncated exactly as listed (SubTyp, Com, Job Typ, WellName). Sample rows: Type = Near Miss / Unsafe Activity / First Aid / Illness; SubTyp = Poisoning; Date = 2000-02-23 (wraps as 2000-02- / 23); Severity blank in samples; Cause = Food; Lost time? = No; Com = multi-line narrative (e.g. "While clearing rig floor, rig hand inadvertently released line holding back tongs..."); Job Typ = Drilling - original / Completion; WellName = Sample 11 - Full Data. No totals or computed columns.

#### Page footer
*Layout:* key-value block (left / center / right)

Fields, in printed order:
- www.peloton.com
- Page 1/1
- Report Printed: (date)

*Notes:* Sample: Report Printed: 2009-09-14


---

## 18_DailyGeological.pdf — Daily Geological

**Purpose:** Daily geological report for one well on one report day: costs, gas readings, geological activity narratives, time log, mud checks, active BHA drilling parameters, formation tops, and daily sample/lithology/show/log records for the wellsite geologist.

**Granularity:** single-well daily: one well, one report date (Report # / DFS), with a whole-well All Formations table included

**Page layout:** Portrait letter (612x792pt), 1 page. Title and report-date header at top, well identification row, then 10 stacked full-width sections each introduced by a gray band, footer at bottom.

**Data entities:** `well`, `daily_report`, `cost_item`, `afe`, `gas_reading`, `time_log`, `mud_check`, `bha`, `bit_record`, `drilling_parameter_interval`, `formation_top`, `sample_description`, `lithology_interval`, `oil_show`, `gas_show`, `log_run`, `wellbore`

### Sections (in reading order)

#### Report header
*Layout:* key-value header block

Fields, in printed order:
- Daily Geological (title)
- Date:
- Report #:
- DFS:
- Well Name:
- Depth Start:
- Depth End:

*Notes:* Sample: Date: 2000-02-28, Report #: 7.0, DFS: 7.00 (days from spud); Well Name: Sample 11 - Full Data; Depth Start: 687.93 - Depth End: 690.00 (daily interval, mKB).

#### Well identification
*Layout:* table, single row of 4 labeled cells

Fields, in printed order:
- API/UWI
- License #
- Licensee
- Field Name

*Notes:* Sample: 0987656789 / 8818838 / Peloton / Akuinu

#### Daily Summary
*Layout:* key-value block: one cost row, one gas row (8 cells), three narrative fields

Fields, in printed order:
- AFE Number
- Job Category
- Day Total (Cost)
- Cum To Date (Cost)
- Supp Amt (Cost)
- AFE-Field Estimate (Cost)
- Avg Background Gas (%)
- Max Background Gas (%)
- Avg Connection Gas (%)
- Max Connection Gas (%)
- Avg Trip Gas (%)
- Max Trip Gas (%)
- Avg Drill Gas (%)
- Max Drill Gas (%)
- Geological Activity at Report Time
- Geological Ops Next Report Period
- Geological Ops This Report Period

*Notes:* Sample: 9876543 / Drilling / 299,740.45 / 2,392,163.22 / 125,000.00 / 215,708.53. Cum To Date (Cost) is cumulative of daily cost totals through this report date. Gas cells and narratives blank in sample.

#### Time Log
*Layout:* table, one row per time interval of the report day

Fields, in printed order:
- Start Time
- End Time
- Dur (hr)
- Cum Dur (hr)
- Code 1
- Code 2
- Com

*Notes:* Sample rows: 00:00 / 00:15 / 0.25 / 0.25 / 6 / CSG / CONT CIRC BOTTOMS UP; 00:45 / 00:00 / 23.25 / 24.00 / 3 / DRLG / DRILL 17-1/2" HOLE. Code 1 is numeric activity code, Code 2 is mnemonic. Cum Dur (hr) = running total of Dur within the day (ends at 24.00).

#### Mud Checks
*Layout:* table, one row per mud check that day

Fields, in printed order:
- Type
- Time
- Depth (mKB)
- Dens (kg/m³)
- PV OR (cp)
- YP Calc (Pa)
- Filtrate (mL/30min)
- pH

*Notes:* Sample: Gel / Water | 12:00 | 1,200.00 | 1102.4 | 8.0 | | 8.000 |

#### BHA #3, 17-1/2" Directional Assy (dynamic title: BHA #{no}, {drill string name})
*Layout:* two stacked tables: a one-row BHA/bit identification table, then a drilling-parameters table with one row per parameter interval

Fields, in printed order:
- Bit Run
- Drill Bit
- Drill String Name
- BHA ROP (m/hr)
- BHA #
- End Depth (mKB)
- TVD End (mKB)
- Cum Depth (m)
- Cum Drill Time (hr)
- Int ROP (m/hr)
- RPM (rpm)
- WOB (daN)
- Wellbore

*Notes:* Sample id row: 3 | 444.5mm, SS33SGJ4, 0987654 | 17-1/2" Directional Assy | 21.3 | 3 (Drill Bit concatenates size, model, serial). Parameter rows: 690.00 / 689.80 / 2.07 / 0.25 / 8.3 / 250 / 4,448; one row per recorded drilling-parameter interval; Cum Depth (m) and Cum Drill Time (hr) are cumulative distance/hours drilled by this BHA; BHA ROP is computed overall ROP for the BHA run.

#### All Formations
*Layout:* table, one row per formation top (whole well, programmed vs actually drilled)

Fields, in printed order:
- Formation Name
- Element Type
- Lith Des
- Prog Depth Top SS (m)
- Prog Top TVD (mKB)
- Drill Top MD (mKB)
- Drill Top (TVD) (mKB)

*Notes:* Sample: Blue Ridge | | Dolomite | 665.00 | 729.01 | 670.00 | 669.81; last row is TD with only drilled depths. Prog = programmed/prognosed depths (subsea and TVD), Drill = actual picked tops.

#### Sample Descriptions
*Layout:* table, one row per described sample interval

Fields, in printed order:
- Top (mKB)
- Btm (mKB)
- Vol Ca (%)
- Vol Mg (%)
- Com

*Notes:* Empty in sample.

#### Lithology
*Layout:* table, one row per lithology interval

Fields, in printed order:
- Top (mKB)
- Btm (mKB)
- Des
- Vol (%)
- Type
- Type Code

*Notes:* Empty in sample.

#### Oil Shows
*Layout:* table, one row per oil show interval

Fields, in printed order:
- Top (mKB)
- Btm (mKB)
- Show Quality
- Show Origin
- Show Type

*Notes:* Empty in sample.

#### Gas Shows
*Layout:* table, one row per gas show interval

Fields, in printed order:
- Top (mKB)
- Btm (mKB)
- Show Type
- Total Gas Avg (%)
- Total Gas Min (%)
- Total Gas Max (%)

*Notes:* Empty in sample.

#### Logs
*Layout:* table, one row per logging run

Fields, in printed order:
- Time
- Run #
- Type
- Top (mKB)
- Btm (mKB)
- Logging Company

*Notes:* Empty in sample.

#### Page footer
*Layout:* key-value block (left / center / right)

Fields, in printed order:
- www.peloton.com
- Page 1/1
- Report Printed: (date)

*Notes:* Sample: Report Printed: 2009-09-18


---

## 19_FormationPerformance.pdf — Formation Performance

**Purpose:** Whole-life single-well analysis of drilling performance by formation: per-formation drilled depths and ROP alongside the raw drilling-parameter intervals, with an ROP-vs-depth step chart comparing formation ROP to interval ROP.

**Granularity:** single-well whole-life (one wellbore): formation rows cover every penetrated formation, drilling-parameter rows cover every recorded interval from spud to TD

**Page layout:** Portrait letter (612x792pt), 1 page. Left ~70%: wellbore header block, Formations table, then a large ROP-vs-depth chart filling the lower half. Right ~30%: tall Drilling Parameters table running alongside. Footer at bottom.

**Data entities:** `well`, `wellbore`, `deviation_survey`, `formation_top`, `drilling_parameter_interval`

### Sections (in reading order)

#### Report header
*Layout:* key-value header block

Fields, in printed order:
- Formation Performance (title)
- Well Name:

*Notes:* Sample: Well Name: Sample 11 - Full Data

#### Original Hole (dynamic section title = wellbore name)
*Layout:* table, single row identifying the wellbore

Fields, in printed order:
- Well Name
- Orig KB…
- Gr Elev…
- Wellbore Name
- Parent Wellbore
- Actual Deviation Survey

*Notes:* Labels print truncated with ellipses exactly as shown (Orig KB… = original KB elevation (ft), Gr Elev… = ground elevation (ft)). Sample: Sample 11 - Full Data | 210.00 | | Original Hole | | Main Hole Survey, Proposed? No

#### Formations
*Layout:* table, one row per formation penetrated (plus TD row)

Fields, in printed order:
- Formation Name
- Layer Name
- Drill Top MD (ftKB)
- Drill Btm MD (ftKB)
- Final Top MD (ftKB)
- Final Btm MD (ftKB)
- Drilled ROP (ft/hr)
- P Frac (lb/gal)
- P Pore (lb/gal)
- T (°F)

*Notes:* Sample: Blue Ridge | | 2,198.2 | 2,253.9 | 2,200.0 | 2,254.0 | 121.3 | | | ; TD row has only Drill Top/Btm MD. Drilled ROP is computed: formation interval footage divided by drilling hours in that formation. Drill = while-drilling picks, Final = final interpreted tops.

#### Drilling Parameters
*Layout:* table (right-hand column of page), one row per drilling-parameter interval

Fields, in printed order:
- Start (ftKB)
- End Depth (ftKB)
- Int Depth (ft)
- Drill Time (hr)
- Int ROP (ft/hr)

*Notes:* 17 rows in sample, e.g. 1,381.2 | 1,610.9 | 229.66 | 11.52 | 19.9. Computed: Int Depth = End Depth - Start; Int ROP = Int Depth / Drill Time.

#### ROP vs depth chart
*Layout:* chart

Fields, in printed order:
- Drilling Top MD (ftKB) (Y axis)
- Drilled ROP (ft/hr) (X axis)
- Drilled ROP vs Drilling Top MD (series)
- Interval ROP vs Start Depth (series)

*Notes:* See graphics.

#### Page footer
*Layout:* key-value block (left / center / right)

Fields, in printed order:
- www.peloton.com
- Page 1/1
- Report Printed: (date)

*Notes:* Sample: Report Printed: 2009-09-14

### Graphics

- Step-line depth chart: Y axis "Drilling Top MD (ftKB)" 0 to 13,000, increasing downward (depth axis, gridlines every 1,000); X axis "Drilled ROP (ft/hr)" 0 to 220, ticks every 20. Two step series: red thick dashed line = "Drilled ROP vs Drilling Top MD" (per-formation ROP stepped at formation tops), green thin solid line = "Interval ROP vs Start Depth" (per-drilling-parameter-interval ROP stepped at interval starts). Legend below the plot with line-style swatches; dotted gridlines both axes.


---

## 20_GeologicalProgram.pdf — Geological Program

**Purpose:** Pre-drill geological program for one well: planned wellbores, prognosed formation tops with pressures/temperature/H2S, the job's target and AFE, geological sampling requirements, and the job contact directory.

**Granularity:** single-well whole-life (planning): one report per well covering the planned program for its job(s)

**Page layout:** Portrait letter (612x792pt), 1 page. Title header, then 6 stacked full-width sections each introduced by a gray band, footer at bottom.

**Data entities:** `well`, `wellbore`, `formation_top`, `job`, `afe`, `sampling_requirement`, `job_contact`

### Sections (in reading order)

#### Report header
*Layout:* key-value header block

Fields, in printed order:
- Geological Program (title)
- Well Name:

*Notes:* Sample: Well Name: Sample 11 - Full Data

#### Wellbores
*Layout:* table, one row per wellbore

Fields, in printed order:
- Wellbore Name
- Profile Type
- Parent Wellbore
- Proposed Deviation Survey

*Notes:* Sample: Original Hole | Directional | Original Hole | (blank)

#### Formations
*Layout:* table, one row per prognosed formation (plus TD row)

Fields, in printed order:
- Formation Name
- Lith Des
- Element Type
- Prog Depth Top SS (ft)
- Prog Top TVD (ftKB)
- Prog Depth Btm SS (ft)
- Prog Btm TVD (ftKB)
- P Pore (lb/gal)
- P Frac (lb/gal)
- T (°F)
- H2S Conc (%)

*Notes:* Sample: Blue Ridge | Dolomite | | 2,181.8 | 2,391.8 | 2,280.2 | 2,490.2 | | | | ; TD row name only. SS = subsea, TVD referenced to KB.

#### Jobs
*Layout:* table (one row per job) followed by a "Geological Objective" free-text field

Fields, in printed order:
- Primary Job Type
- Target Formation
- Target Depth (ftKB)
- AFE Number
- Planned Start Date
- Geological Objective

*Notes:* Sample: Drilling - original | Blue Heron Shale | 11,500.0 | 9876543 | 2000-02-20; Geological Objective narrative blank in sample.

#### Geological Sampling Requirements
*Layout:* table, one row per sampling requirement

Fields, in printed order:
- Top Des
- Top (ftKB)
- Btm Des
- Btm (ftKB)
- Wellbore
- Rqd By
- Sampled By
- Com

*Notes:* Sample rows: Open Hole Logs | 3,937.0 | | 12,795.3 | Original Hole; Cores | 12,139.1 | | 12,336.0 | Original Hole. Top Des doubles as the requirement type/description.

#### Job Contacts
*Layout:* table, one row per contact

Fields, in printed order:
- Company
- Contact Name
- Title
- Mobile
- E-mail
- Note

*Notes:* 13 rows in sample, e.g. Geoservices | Bill Frost | Manager | 555-133-0478 | | ; E-mail and Note blank throughout sample.

#### Page footer
*Layout:* key-value block (left / center / right)

Fields, in printed order:
- www.peloton.com
- Page 1/1
- Report Printed: (date)

*Notes:* Sample: Report Printed: 2009-09-14


---

## 21_GeologicalSchematic.pdf — Schematic

**Purpose:** A depth-indexed geological/drilling strip log for one wellbore: a drawn vertical wellbore schematic flanked by survey (MD/TVD/Incl/DLS), formation tops, core and sample intervals, lithology, mud density/system, and drilling-parameter curves, so engineers and geologists can see the whole hole vs depth at a glance.

**Granularity:** single-well single-wellbore whole-life snapshot (state as of the schematic date/time in the banner)

**Page layout:** Landscape letter (792x612), 1 page. WellView logo top-left, centered title, Well Name line, one-row well header strip, then a full-width wellbore banner, then the page body is a multi-track depth log (13 side-by-side vertical tracks sharing one depth axis). Footer strip at bottom.

**Data entities:** `well_header`, `wellbore`, `survey_station`, `hole_section`, `casing_string`, `cement_job`, `downhole_equipment`, `formation_top`, `lithology_interval`, `core_bh`, `core_sw`, `evaluation_sample`, `mud_check`, `mud_system_interval`, `drill_param_interval`

### Sections (in reading order)

#### Report header
*Layout:* key-value block

Fields, in printed order:
- WellView (logo)
- Schematic (report title)
- Well Name:

*Notes:* Well Name sample value: 'Sample 11 - Full Data'.

#### Well header strip
*Layout:* key-value block (one horizontal row of labeled cells)

Fields, in printed order:
- API/UWI
- Surface Legal Location
- License #
- Well Configuration Type
- Ground Elevation (ft)
- Casing Flange Elevation (ft)
- KB-Ground Distance (ft)
- KB-Casing Flange Distance (ft)

*Notes:* Sample values: API/UWI 0987656789; License # 8818838; Well Configuration Type 'Deviated'; Casing Flange Elevation 0.00; KB-Casing Flange Distance 210.00. Surface Legal Location, Ground Elevation and KB-Ground Distance are blank in the sample.

#### Wellbore banner
*Layout:* single full-width banner row above the tracks

Fields, in printed order:
- <Well Configuration Type> - <Wellbore name>, <schematic date time>

*Notes:* Sample: 'Deviated - Original Hole, 2009-09-14 3:30:41 PM'.

#### Depth log track headers (left to right)
*Layout:* column headers of the multi-track strip log

Fields, in printed order:
- MD (ftKB)
- TVD (ftKB)
- Incl (°)
- DLS Curve
- Vertical schematic (actual)
- Formations - Drilling
- BH Core
- SW Core
- Eval - Samples
- Eval - Litho
- Mud
- Drill Params 1
- Drill Params2

*Notes:* All 13 tracks share one vertical depth axis. Depth registration is by survey station (non-linear spacing), not a uniform depth grid.

#### MD / TVD / Incl tracks
*Layout:* table (3 numeric columns, one printed row per survey station)

Fields, in printed order:
- MD (ftKB)
- TVD (ftKB)
- Incl (°)

*Notes:* One row per survey station; ~30 stations in sample. Sample first/last rows: MD 210.0 / TVD 210.0 / Incl 0.1 ... MD 12,503.3 / TVD 9,546.3-ish (last printed 9,546.3) / Incl 49.5. TVD is computed from the deviation survey.

#### DLS Curve track
*Layout:* chart (curve track)

Fields, in printed order:
- DLS Curve (track title)
- DLS (°/1… (curve legend, truncated; dogleg severity per 100 ft)
- 0.0 (left scale limit)
- 5.0 (right scale limit)

*Notes:* Line curve of dogleg severity vs depth; computed from consecutive survey stations.

#### Vertical schematic (actual) track
*Layout:* schematic

Fields, in printed order:
- Vertical schematic (actual)

*Notes:* Drawn wellbore: wellhead, hole sections, casing/cement (hatched annulus), tubing, downhole equipment, TD. Red horizontal tie-lines mark component/formation depths. Needs casing strings, cement tops, hole sizes and in-hole equipment with depths.

#### Formations - Drilling track
*Layout:* schematic (interval boxes with lithology pattern fill + name label at top depth)

Fields, in printed order:
- Formations - Drilling (track title)
- Formation Name (label per interval)

*Notes:* Sample formations top-to-bottom: Blue Ridge, Ten Oaks, Haverty Limestone, Green River, Upper Deer Park, Lower Deer Park; each drawn as a patterned box from its top depth.

#### BH Core track
*Layout:* schematic (interval bars)

Fields, in printed order:
- BH Core

*Notes:* Colored bar spanning each bottom-hole core interval (sample shows one magenta bar near Lower Deer Park, ~12,247-12,323 ftKB).

#### SW Core track
*Layout:* schematic (point/interval marks)

Fields, in printed order:
- SW Core

*Notes:* Sidewall core depths; empty in the sample.

#### Eval - Samples track
*Layout:* schematic (interval bars)

Fields, in printed order:
- Eval - Samples

*Notes:* Black bars marking evaluated sample intervals.

#### Eval - Litho track
*Layout:* schematic (interval boxes with lithology label)

Fields, in printed order:
- Eval - Litho
- Lithology name (label per interval)

*Notes:* Sample shows a green 'Sandstone' interval.

#### Mud track
*Layout:* chart (curve track with text annotations)

Fields, in printed order:
- Mud (track title)
- Dens (lb/gal) (curve legend)
- 8.00 (left scale limit)
- 12.00 (right scale limit)
- Mud system annotations at depth

*Notes:* Brown stepped curve of mud density vs depth. Text annotations at depth: 'hi-vis sweeps', 'Gel / Water', 'Gel / water', 'PETROFREE', 'Seawater', 'BRINE' (mud system/type in effect over each depth range).

#### Drill Params 1 track
*Layout:* chart (curve track)

Fields, in printed order:
- Drill Params 1 (track title)
- Int ROP (f… (curve legend, truncated; interval ROP, ft/hr)
- 0.0 (left scale limit)
- 3… (right scale limit, truncated)

*Notes:* Black stepped curve of interval rate of penetration vs depth.

#### Drill Params2 track
*Layout:* chart (3 overlaid curve series with individual scale rows)

Fields, in printed order:
- Drill Params2 (track title)
- Bit RPM (rpm)
- 100 (Bit RPM left limit)
- 300 (Bit RPM right limit)
- Q Flow (gpm)
- 700 (Q Flow left limit)
- 1,100 (Q Flow right limit)
- WOB (1000lbf)
- 10 (WOB left limit)
- 50 (WOB right limit)

*Notes:* Three stepped curves vs depth: Bit RPM (solid dark red), Q Flow (green dashed), WOB (blue dotted); each has its own horizontal scale row in the track header.

#### Page footer
*Layout:* key-value block

Fields, in printed order:
- www.peloton.com
- Page 1/1
- Report Printed:

*Notes:* Report Printed sample value: 2009-09-14.

### Graphics

- Multi-track depth strip log: 13 vertical tracks sharing one (survey-station-registered) depth axis
- Wellbore schematic drawing (hole sections, casings/cement hatching, tubing, equipment, TD) with red depth tie-lines
- DLS curve: X = DLS (°/100ft) 0.0-5.0, Y = depth; computed from survey stations
- Mud density curve: X = Dens (lb/gal) 8.00-12.00, Y = depth, with mud-system text annotations
- Interval ROP curve: X = Int ROP (ft/hr) 0.0-3xx, Y = depth
- Drill Params2 overlay: Bit RPM (rpm) 100-300 solid, Q Flow (gpm) 700-1,100 dashed, WOB (1000lbf) 10-50 dotted, all vs depth
- Formation interval boxes with lithology pattern fills and formation-name labels
- Core (BH/SW), evaluation-sample and lithology interval bars vs depth


---

## 22_CompleteWellSummary.pdf — Complete Well Summary

**Purpose:** The full life-of-well dossier for one well: header/location data, wellbore profile and hole sizes, plug-backs, formations, surveys, reservoirs, every casing string with components, every cement job with fluid stages, other-in-hole items, wellhead, jobs (drilling and completion) with AFE/cost, phases, contacts, all BHA/bit runs, logs, cores, LOT/FITs, schematic annotations and production failures, alongside a drawn wellbore schematic.

**Granularity:** single-well whole-life (all wellbores, jobs and runs to date; snapshot at print time)

**Page layout:** Portrait letter (612x792), 4 pages. Every page: WellView logo + report title 'Complete Well Summary' + well name top-left; left column (~45% width) holds a continuous vertical wellbore schematic captioned by a banner ('Deviated - Original Hole, <print datetime>' over 'Vertical schematic (actual)') with numbered component callouts; right column stacks the data sections in reading order across pages 1-4. Footer 'www.peloton.com' bottom-left of each page.

**Data entities:** `well_header`, `wellbore`, `hole_section`, `plug_back`, `formation_top`, `deviation_survey`, `reservoir`, `casing_string`, `casing_component`, `cement_job`, `cement_stage`, `cement_fluid`, `other_in_hole`, `wellhead`, `wellhead_component`, `general_note`, `job`, `afe_cost`, `job_phase`, `job_contact`, `bha_run`, `bha_component`, `bit_record`, `log_run`, `core_bh`, `lot_fit_test`, `schematic_annotation`, `production_failure`, `downhole_equipment`

### Sections (in reading order)

#### Report header (every page)
*Layout:* key-value block

Fields, in printed order:
- WellView (logo)
- Complete Well Summary (title)
- <Well Name> (sample: Sample 11 - Full Data)

#### Well header block (page 1, right column top)
*Layout:* key-value block

Fields, in printed order:
- API/UWI
- Operator
- Original KB Elevation (ft)
- KB-Ground Distance (ft)
- Spud Date
- Rig Release Date
- Surface Legal Location
- Latitude (°)
- Longitude (°)

*Notes:* Samples: API/UWI 0987656789, Operator 'Peloton Oil & Gas', Original KB Elevation 210.00, Spud Date 2000-02-21, Rig Release Date 2000-03-18, Latitude 51° 0' 0" N, Longitude 114° 0' 0" W.

#### Wellbore schematic panel (left column, all pages)
*Layout:* schematic

Fields, in printed order:
- <Well Configuration Type> - <Wellbore>, <print datetime> (banner)
- Vertical schematic (actual) (caption)
- Component callouts: '<string#>-<item#>; <Item Des>'

*Notes:* Callouts in sample: 2-1; Tubing / 2-2; Communications nipple / 2-3; Tubing / 2-4; TRSSV / 2-5; Tubing / 2-6; Gauge Mandrel / 2-7; Tubing / 2-8; Tubing pup / 2-9; Packer, production / 2-10; Millout extension / 2-11; RN nipple (3.437") / 2-12; Re-entry guide. The schematic continues (depth-continues) across the 4 pages.

#### Wellbore section (banner 'Original Hole')
*Layout:* key-value block

Fields, in printed order:
- Wellbore API/UWI
- Btm. Loc.
- Profile Type
- KO MD (ftKB)
- VS Dir (°)
- Proposed Deviation Survey
- Actual Deviation Survey

*Notes:* Samples: Wellbore API/UWI 52994921, Profile Type 'Directional', KO MD 1,381.2, Actual Deviation Survey 'Main Hole Survey, Proposed? No'. Repeats per wellbore.

#### Hole sizes table (within wellbore section)
*Layout:* table (row = one hole section)

Fields, in printed order:
- Size (in)
- Act Top (ftKB)
- Act Btm (ftKB)

*Notes:* Sample rows: 36 | 1,381.2 | 1,610.9; 26 | 1,610.9 | 2,257.2; 17 1/2 | 2,257.2 | 4,281.5; 12 1/4 | 4,281.5 | 12,503.3.

#### Plug Back Total Depths
*Layout:* table (row = one plug-back event)

Fields, in printed order:
- Date
- Depth (ftKB)
- Method
- Com

*Notes:* Sample rows: 2000-05-15 | 12,330.1; 2000-05-20 | 12,089.9.

#### Formations
*Layout:* table (row = one formation top)

Fields, in printed order:
- Formation Name
- Geologic Age
- Element Type
- H2S Conc (%)
- Final Top MD (ftKB)
- Final Top TVD (ftKB)

*Notes:* Sample rows: Blue Ridge 2,200.0/2,199.4; Ten Oaks 4,260.0/4,061.2; Haverty Limestone 6,942.3/5,828.9; Green River 8,907.5/7,157.5; Upper Deer Park 12,089.9/9,278.7; Lower Deer Park 12,253.9/9,384.5; final row 'TD'.

#### Deviation Surveys
*Layout:* table (row = one survey program)

Fields, in printed order:
- Date
- Des
- Prop?
- Definitive?

*Notes:* Sample: 2000-03-16 | Main Hole Survey | No | No.

#### Reservoirs
*Layout:* table (row = one reservoir)

Fields, in printed order:
- Res Name
- Top (ftKB)
- Btm (ftKB)
- Res Datum Depth (ft)

*Notes:* Empty in sample.

#### Casing string section (repeats per string; banner '<Csg Des>, <set depth>ftKB')
*Layout:* key-value header row + table (row = one casing component line)

Fields, in printed order:
- Run Date
- Centralizers
- Scratchers
- Drift Mi… (truncated; Drift Min (in))
- OD (in)
- Item Des
- Btm (ftKB)
- Jts
- ID (in)
- Wt (kips)
- Grade
- Top Thread

*Notes:* Four instances in sample: 'Structural Casing, 1,598.8ftKB', 'Conductor Pipe, 2,239.0ftKB', 'Surface Casing, 4,253.0ftKB', 'Production Casing, 12,478.9ftKB'. Component Item Des values: Casing Joint(s), Cross-Over Joint, Float Shoe Joint, Float Shoe, Float Collar, Cross Over. Banner set depth = deepest component Btm.

#### Cement job section (repeats per job; banner '<Job Des>, Casing, <datetime>')
*Layout:* key-value block + stage row + fluids table (row = one cement fluid)

Fields, in printed order:
- Cementing Company
- Evaluation Method
- Cement Evaluation Results
- Stg #
- Description
- Top (ftKB)
- Btm (ftKB)
- Full Return?
- Fluid
- Class
- Amount (sacks)
- Yield (ft³/sack)
- Mix H20 Ratio (gal/sack)
- Vol Pumped (bbl)
- Fluid Des

*Notes:* Four instances: 'Structural Cement, Casing, 2000-02-22 11:15', 'Conductor Cement, Casing, 2000-02-23 21:30', 'Surface Casing Cement, Casing, 2000-03-01 18:45', 'Production Casing Cement, Casing, 2000-03-18 01:30'. Fluid sample values: Lead Cement / Tail Cement / Tail; Class G; Fluid Des e.g. 'Neat', 'LIQUID ADDITIVE EXT.', 'Including gel and retarder', 'Neat with Retarder'.

#### Other In Hole
*Layout:* table (row = one non-string in-hole item)

Fields, in printed order:
- OD (in)
- Des
- Top (ftKB)
- Btm (ftKB)
- ID (in)
- Make
- Model

*Notes:* Sample: 7 | Bridge Plug - Permanent | 12,330.0 | 12,334.0 | Halliburton | EZ Drill.

#### Wellhead section (banner '<Type>, <Make> on <datetime>' e.g. 'SSMC, Cameron on 2000-02-22 00:00')
*Layout:* key-value block

Fields, in printed order:
- Install Date
- Type
- Make
- WP (psi)
- Size (in)
- Last Overhaul… (truncated; Last Overhaul date)

*Notes:* Sample: 2000-02-22 | SSMC | Cameron | 10,000.0 | 18.750.

#### Wellhead Components
*Layout:* table (row = one wellhead component)

Fields, in printed order:
- Make
- Model
- Section (printed stacked as 'Se cti on')
- Top Conn Typ
- Top Sz (in)
- Btm Conn Typ
- Btm Sz (in)
- Des
- WP (psi)

*Notes:* Sample rows: Cameron SSMC, Section A-D, Conn types 'Snapring Lockdown'/'Welded', Des e.g. 30" Conductor Landing Ring, 20-3/4" Casing Head, 13-5/8" Casing Head, 12-1/4" Casing Head, Flange Lock Connector; WP 10,000.0.

#### General Notes
*Layout:* table (row = one dated note)

Fields, in printed order:
- Date
- Com

*Notes:* Empty in sample.

#### Job section (repeats per job; banner '<Primary Job Type>, <start datetime>' e.g. 'Drilling - original, 2000-02-21 00:00' and 'Completion, 2000-05-16 00:00')
*Layout:* key-value block(s)

Fields, in printed order:
- Job Category
- Primary Job Type
- Start Date
- End Date
- AFE Number
- AFE+Supp Amt (Cost)
- Total Fld Est (Cost)
- Total Final Invoice (Cost)
- Summary
- Poss Cost Save (Cost)
- Poss Time Save (hr)
- Est Prob Cost (Cost)
- Est Lost Time (hr)

*Notes:* Drilling sample: Category 'Drilling', AFE 9876543, AFE+Supp 10,343,000.00, Total Fld Est 10,127,291.47, Total Final Invoice 10,217,000.00, Poss Cost Save 625.00, Poss Time Save 8.00, Est Prob Cost 38,500.00, Est Lost Time 11.50; Summary is multi-line free text. Completion sample: Category 'Completion/Workover', AFE 1234567C.

#### Phases (within each job section)
*Layout:* table (row = one planned phase)

Fields, in printed order:
- Phase Type 1
- Planned Likely Phase Cost (Cost)
- Pl Cum Days ML (days)
- Planned End Depth (ftKB)

*Notes:* Sample rows: Surface 800,000.00/2.00/2,260.0; Surface 1,125,000.00/4.00/2,260.0; Intermediate 2,250,000.00/9.00/4,300.0; Intermediate 6,500,000.00/11.00/4,300.0; Production 7,000,000.00/25.00/12,750.0; Production 500,000.00/26.50/12,750.0; Production 8,500,000.00/29.50/12,750.0. 'Pl Cum Days ML' is cumulative planned days from mid-line.

#### Job Contacts (within each job section)
*Layout:* table (row = one contact)

Fields, in printed order:
- Contact Name
- Company
- Title
- Office
- Mobile

*Notes:* Sample: Bill Parcells | Geoservices | Manager | 555-441-3001 | 555-133-0478; ~13 rows per job.

#### BHA section (repeats per BHA run; banner 'BHA #<n>, <des>' e.g. 'BHA #1, 36" Drilling Assy'; template banner 'BHA #<stringno>, <des>')
*Layout:* key-value block + free-text component list

Fields, in printed order:
- BHA #
- Size (in)
- Model
- IADC Codes
- IADC Bit Dull
- Depth In (ftKB)
- Depth Out (ftKB)
- Drilled (ft)
- Drill Time (hr)
- Bit Hrs Out… (truncated; Bit Hrs Out (hr))
- IADC Bit Dull (repeated in second row)
- String Components

*Notes:* 10 instances in sample (BHA #1-#10). Sample BHA #1: Size 26, Model S3SJ, IADC Codes 111C, IADC Bit Dull 1-1-NO-A-1-0-NO-TD, Depth In 1,381.2, Depth Out 1,610.9, Drilled 229.66, Drill Time 11.52, Bit Hrs Out 11.52. Drilled = Depth Out - Depth In; Bit Hrs Out is cumulative bit hours (BHA #6: Drill Time 20.25 but Bit Hrs Out 73.50 for a rerun bit). String Components is a comma-separated ordered component list (e.g. 'Hughes S3SJ, 36" Hole Opener, ..., Heavy Weight Drill Pipe, Drill Pipe').

#### Logs
*Layout:* table (row = one log run)

Fields, in printed order:
- Date
- Type
- Top (ftKB)
- Btm (ftKB)
- Logging Company

*Notes:* Sample rows: 2000-03-12 | GR - LDT - CNR - DIT | 6,233.6 | 7,466.1 | Schlumberger Wireline & Testing; 2000-03-12 | GR-DSI; 2000-05-19 | GR - CCL - Resistivity.

#### Bottom Hole Cores
*Layout:* table (row = one core)

Fields, in printed order:
- Core #
- Type
- Top (ftKB)
- Btm (ftKB)
- Recov (ft)
- Wellbore

*Notes:* Sample: Conventional | 12,247.4 | 12,322.8 | 60.0 | Original Hole.

#### Leak Off and Formation Integrity Tests
*Layout:* table (row = one LOT/FIT)

Fields, in printed order:
- Test Date
- Last Casing String Run
- P Surf Applied (psi)
- Depth (ftKB)
- Dens Fluid (lb/gal)
- Leak off?

*Notes:* Sample rows: 2000-02-28 | Conductor Pipe, 2,239.0ftKB | (blank) | 2,237.0 | 9.20 | No; 2000-03-03 | Surface Casing, 4,253.0ftKB | 700.0 | 4,285.0 | 10.50 | Yes. 'Last Casing String Run' references the casing string + its set depth.

#### Schematic Annotations
*Layout:* table (row = one annotation)

Fields, in printed order:
- Depth (ftKB)
- Annotation

*Notes:* Sample: 1,500.0 | Casing set 12' off bottom.

#### Production Failures
*Layout:* table (row = one failure event)

Fields, in printed order:
- Failure Date
- Failure Des
- Fail Typ
- Cause
- Failed Item
- Resolved Date
- Est Fail (Cost)

*Notes:* Empty in sample; same entity feeds report 25's pivot chart.

#### Page footer (every page)
*Layout:* key-value block

Fields, in printed order:
- www.peloton.com

*Notes:* No page numbers or printed date in the footer of this report; print datetime appears in the schematic banner instead.

### Graphics

- Continuous vertical wellbore schematic (actual) spanning the left column of all 4 pages: wellhead, casings with cement hatching, tubing string, packers/nipples/TRSSV, plug-back fill, TD; numbered leader-line callouts '<string>-<n>; <Item Des>'


---

## 23_DailyCompletionandWorkoverSchematic.pdf — Daily Completion and Workover (schematic)

**Purpose:** The daily report for a completion/workover job on one well for one report day: job/AFE/cost snapshot, daily readings and contacts, the day's time log, fluids, safety checks, logs, perforations, stimulations, tubing and other equipment run/pulled and cement — beside the current wellbore schematic. For completion/workover supervisors and office engineers.

**Granularity:** single-well daily (one numbered daily report of one completion/workover job)

**Page layout:** Portrait letter (612x792), 1 page. Title centered top; 'Report # / Report Date' top-right; Well Name line; two-row well header strip full width; below it, left column (~40%) is the wellbore schematic panel, right column (~60%) stacks all data sections. Footer: www.peloton.com | Page 1/1 | Report Printed.

**Data entities:** `well_header`, `wellbore`, `job`, `daily_report`, `daily_reading`, `job_contact`, `time_log`, `report_fluid`, `safety_check`, `log_run`, `perforation`, `stimulation_treatment`, `stimulation_stage`, `tubing_string`, `other_in_hole`, `cement_job`, `afe_cost`, `downhole_equipment`

### Sections (in reading order)

#### Report header
*Layout:* key-value block

Fields, in printed order:
- WellView (logo)
- Daily Completion and Workover (schematic) (title)
- Report #
- Report Date:
- Well Name:

*Notes:* Sample: Report # 18.0, Report Date: 2000-06-02, Well Name 'Sample 11 - Full Data'.

#### Well header strip
*Layout:* key-value block (two rows of labeled cells)

Fields, in printed order:
- API/UWI
- Surface Legal Location
- Field Name
- License #
- State/Province
- Well Configuration Type
- Original KB Elevation (ft)
- KB-Tubing Head Distance (ft)
- Spud Date
- Rig Release Date
- PBTD (All) (ftKB)
- Total Depth All (TVD) (ftKB)

*Notes:* Samples: Field Name 'Akuinu', State/Province 'Texas', PBTD (All) 'Original Hole - 12,089.9', Total Depth All (TVD) 'Original Hole - 9,546.3' (both are '<wellbore> - <depth>' pairs).

#### Wellbore schematic panel (left column)
*Layout:* schematic

Fields, in printed order:
- <Well Configuration Type> - <Wellbore>, <date> (banner; sample 'Deviated - Original Hole, 2000-06-03')
- Vertical schematic (actual) (caption)
- Component callouts: '<string#>-<item#>; <Item Des>'

*Notes:* Callouts: 2-1; Tubing / 2-2; Communications nipple / 2-3; Tubing / 2-4; TRSSV / 2-5; Tubing / 2-6; Gauge Mandrel / 2-7; Tubing / 2-8; Tubing pup / 2-9; Packer, production / 2-10; Millout extension / 2-11; RN nipple (3.437") / 2-12; Re-entry guide.

#### Job block
*Layout:* key-value block

Fields, in printed order:
- Primary Job Type
- Secondary Job Type
- Objective
- Contractor
- Rig Number
- AFE Number
- AFE+Supp Amt (Cost)
- Daily Field Est Total (Cost)
- Cum Field Est To Date (Cost)

*Notes:* Samples: Primary 'Completion', Secondary 'Initial Completion', Contractor 'NABORS', Rig Number 432, AFE 1234567C, AFE+Supp 7,753,000.00, Daily Field Est Total 96,271.00, Cum Field Est To Date 7,672,928.47 (cumulative sum of daily cost estimates).

#### Daily Readings
*Layout:* key-value block (one row of labeled cells)

Fields, in printed order:
- Weather
- T (°F)
- Road Condition
- P Tub (psi)
- P Cas (psi)
- Rig Time (hr)

*Notes:* Blank in sample.

#### Daily Contacts
*Layout:* table (row = one contact on site that day)

Fields, in printed order:
- Job Contact
- Title
- Mobile

*Notes:* Sample: Eddie Van Halen | Consultant | 555-029-9115.

#### Time Log
*Layout:* table (row = one time interval of the day)

Fields, in printed order:
- Start Time
- End Time
- Dur (hr)
- Code 1
- Code 2
- Com

*Notes:* Sample rows: 00:00 | 02:15 | 2.25 | 38 | COMPLETION | PULL TREE CAP RETRIEVING TOOL; 02:15 | 06:15 | 4.00 | 38 | COMPLETION | WORK ON ROV; 06:15 | 07:30 | 1.25 | 39 | EQ FAIL | ESTABLISH GUIDLINE. Dur = End - Start.

#### Report Fluids Summary
*Layout:* table (row = one fluid)

Fields, in printed order:
- Fluid
- To well (bbl)
- From well (bbl)
- To lease (bbl)
- From lease (bbl)

*Notes:* Blank in sample.

#### Safety Checks
*Layout:* table (row = one safety check)

Fields, in printed order:
- Time
- Des
- Type
- Com

*Notes:* Blank in sample.

#### Logs
*Layout:* table (row = one log run that day)

Fields, in printed order:
- Time
- Type
- Top (ftKB)
- Btm (ftKB)
- Cased?

*Notes:* Blank in sample.

#### Perforations
*Layout:* table (row = one perforation interval shot that day)

Fields, in printed order:
- Time
- Zone
- Top (ftKB)
- Btm (ftKB)
- Current Status

*Notes:* Blank in sample.

#### Stimulations & Treatments
*Layout:* table (treatment header row + stage sub-table; row = one treatment / one stage)

Fields, in printed order:
- Time
- Zone
- Type
- Delivery Mode
- Stim/Treat Company
- Stg #
- Stage Type
- Top (ftKB)
- Btm (ftKB)
- Vol Clean Pump (bbl)

*Notes:* Blank in sample.

#### Tubing Run
*Layout:* table (row = one tubing string run that day)

Fields, in printed order:
- Run Time
- Tubing Description
- Set Depth (ftKB)
- String Max Nomina… (truncated; String Max Nominal OD (in))
- Weight/Length (lb/ft)
- String Grade

*Notes:* Sample: 00:00 | Production Tubing | 11,828.4 | 4 1/2 | 13.00 | 13CRS-80.

#### Tubing Pulled
*Layout:* table (row = one tubing string pulled that day)

Fields, in printed order:
- Pull Time
- Tubing Description
- Set Depth (ftKB)
- String Max Nomina… (truncated; String Max Nominal OD (in))
- Weight/Length (lb/ft)
- String Grade

*Notes:* Blank in sample.

#### Other in Hole Run (Bridge Plugs, etc)
*Layout:* table (row = one item run)

Fields, in printed order:
- Run Time
- Des
- OD (in)
- Top (ftKB)
- Btm (ftKB)

*Notes:* Blank in sample.

#### Other in Hole Pulled (Bridge Plugs, etc)
*Layout:* table (row = one item pulled)

Fields, in printed order:
- Pull Time
- Des
- Top (ftKB)
- Btm (ftKB)
- OD (in)

*Notes:* Blank in sample. Note column order differs from the Run table (OD first vs last).

#### Cement
*Layout:* table (row = one cement operation that day)

Fields, in printed order:
- Start Time
- Des
- Type
- String
- Cement Comp

*Notes:* Blank in sample.

#### Page footer
*Layout:* key-value block

Fields, in printed order:
- www.peloton.com
- Page 1/1
- Report Printed:

*Notes:* Sample printed date 2009-09-15.

### Graphics

- Vertical wellbore schematic (actual) with casing/cement/tubing drawing and numbered component callouts, as of the report date


---

## 24_DownholeWellProfile.pdf — Downhole Well Profile

**Purpose:** A current-state mechanical profile of one well (an artificial-lift/pumping well in the sample): wellhead, casing strings, perforations, and the installed tubing and rod strings with their component breakdowns, beside the wellbore schematic. For production/workover engineers who need what is in the hole right now.

**Granularity:** single-well current-state snapshot (whole life to print date; latest installed strings)

**Page layout:** Portrait letter (612x792), 1 page. Title centered top; Well Name line; two-row well header strip; full-width Wellhead block; below it, left column (~42%) wellbore schematic panel, right column stacked tables. Footer: www.peloton.com | Page 1/1 | Report Printed.

**Data entities:** `well_header`, `wellbore`, `wellhead`, `wellhead_component`, `casing_string`, `perforation`, `tubing_string`, `tubing_component`, `rod_string`, `rod_component`, `downhole_equipment`

### Sections (in reading order)

#### Report header
*Layout:* key-value block

Fields, in printed order:
- WellView (logo)
- Downhole Well Profile (title)
- Well Name:

*Notes:* Sample well: 'Sample 10 - Pumping Well'.

#### Well header strip
*Layout:* key-value block (two rows of labeled cells)

Fields, in printed order:
- API/UWI
- Surface Legal Location
- Field Name
- License #
- State/Province
- Well Configuration Type
- Original KB Elevation (ft)
- KB-Tubing Head Distance (ft)
- Spud Date
- Rig Release Date
- PBTD (All) (ftKB)
- Total Depth All (TVD) (ftKB)

*Notes:* Samples: API/UWI 100/14-02-036-04 W5/02, Surface Legal Location 13-02-036-04 W5, Field 'Garrington', State/Province 'Alberta', PBTD (All) 'Original Hole - 8,120.1', Total Depth All (TVD) 'Original Hole - 7,905.0'.

#### Wellhead
*Layout:* key-value block ('Type' label with value 'Wellhead') + table (row = one wellhead item)

Fields, in printed order:
- Type
- Des
- Make
- Model
- WP (psi)
- Service
- WP Top (psi)
- Top Ring Gasket
- Bore Min (in)

*Notes:* Table empty in sample (header row only).

#### Wellbore schematic panel (left column)
*Layout:* schematic

Fields, in printed order:
- <Well Configuration Type> - <Wellbore>, <print datetime> (banner; sample 'Deviated - Original Hole, 2009-09-15 10:49:45 AM')
- Vertical schematic (actual) (caption)
- Component callouts: '<string#>-<item#>; <Item Des>'

*Notes:* Two callout groups in sample — rod string: 1-1; Stainless Steel Polish rod / 1-2; Sucker rod / 1-3; Rod pump; tubing string: 1-1; Tubing Jts / 1-2; Offset catcher / 1-3; Tubing Jts / 1-4; Nipple / 1-5; Tubing Jts / 1-6; Annulus blow sub / 1-7; Tubing Jt / 1-8; Packer / 1-9; Tubing Pup Jt.

#### Casing Strings
*Layout:* table (row = one casing string)

Fields, in printed order:
- Csg Des
- OD (in)
- Wt/Len (lb/ft)
- Grade
- Top Thread
- Set Depth (ftKB)

*Notes:* Sample rows: Surface Casing | 8 5/8 | 24.00 | J-55 | (blank) | 754.6; Production Casing | 4 1/2 | 9.50 | J-55 | (blank) | 8,202.1.

#### Perforations
*Layout:* table (row = one perforation interval)

Fields, in printed order:
- Date
- Top (ftKB)
- Btm (ftKB)
- Zone

*Notes:* Sample rows: 1998-04-27 | 6,033.5 | 6,040.0 | Upper Shunda, Original Hole; 1998-04-27 | 7,358.9 | 7,365.5 | Upper Shunda, Original Hole; 1998-04-27 | 7,367.1 | 7,381.9 | Upper Shunda, Original Hole; 1985-03-03 | 7,432.7 | 7,436.0 | Lower Shunda, Original Hole; 1985-03-03 | 7,437.7 | 7,440.9 | Lower Shunda, Original Hole. Zone value is '<zone name>, <wellbore>'.

#### Tubing Strings
*Layout:* string header row + component table (row = one tubing component group, in run order top-down)

Fields, in printed order:
- Tubing Description
- Run Date
- String Length (ft)
- Set Depth (ftKB)
- Item Des
- Jts
- Make
- Model
- OD (in)
- Wt (lb/ft)
- Grade
- Len (ft)

*Notes:* Sample string: Production String | 1998-04-30 | 7,341.50 | 7,341.0. Component rows: Tubing Jts 63 jts 2 7/8 6.50 J-55 2,000.00; Offset catcher 2 7/8 5.00; Tubing Jts 106 ... 3,330.00; Nipple 2 7/8 3.00; Tubing Jts 62 ... 1,962.00; Annulus blow sub 2 7/8 1.00; Tubing Jt 1 ... 30.00; Packer Baker D 2 7/8 10.00; Tubing Pup Jt 1 ... 0.50. String Length ≈ sum of component Len. Section repeats per tubing string.

#### Rod Strings
*Layout:* string header row + component table (row = one rod component group)

Fields, in printed order:
- Rod Description
- Run Date
- String Length (ft)
- Set Depth (ftKB)
- Item Des
- Jts
- Make
- Model
- OD (in)
- Wt (lb/ft)
- Grade
- Len (ft)

*Notes:* Sample string: Rod String | 2000-06-27 | 5,350.00 | 5,335.0. Component rows: Stainless Steel Polish rod 1 jt 1 1/4 30.00; Sucker rod 212 jts 3/4 grade D 5,300.00; Rod pump Circa AZ75 2 1/2 20.00. Section repeats per rod string.

#### Page footer
*Layout:* key-value block

Fields, in printed order:
- www.peloton.com
- Page 1/1
- Report Printed:

*Notes:* Sample printed date 2009-09-15.

### Graphics

- Vertical wellbore schematic (actual): casing/cement, tubing string with packer and pump, rod string inside tubing, perforation tick marks (red) at perforated intervals, with numbered leader-line callouts per component


---

## 25_FailureAnalysisPivotandGraphs.pdf — Cost of Failure by Type

**Purpose:** A multi-well failure-analysis pivot chart: total estimated cost of production failures per well, stacked by failure type, so reliability/production engineers can compare failure spend and failure-mode mix across wells.

**Granularity:** multi-well comparison (one column per well, aggregating each well's whole-life production failures)

**Page layout:** Landscape letter (792x612), 1 page. A single full-page stacked-column chart with centered title above the plot area, currency Y-axis labels on the left, well names as X-axis category labels, and a legend box on the right. No report/well header and no footer.

**Data entities:** `well_header`, `production_failure`

### Sections (in reading order)

#### Chart title
*Layout:* chart title text

Fields, in printed order:
- Cost of Failure by Type

#### Stacked column chart
*Layout:* chart

Fields, in printed order:
- X axis category: well name (sample values: 'Sample 02 - Drilling operations', 'Sample 37 - ESP')
- Y axis: failure cost in dollars, labels $0.00 / $50,000.00 / $100,000.00 / $150,000.00 / $200,000.00 / $250,000.00
- Series (stack segments) = failure type

*Notes:* Each column = one well; each stacked segment = sum of estimated failure cost (Est Fail (Cost) from Production Failures records) for that failure type on that well. Sample: Sample 02 total ~$162k (Hole ~$35k + Collapse ~$127k); Sample 37 total ~$219k (Parted ~$125k + Other ~$52k + Worn ~$22k + Wear ~$20k).

#### Legend
*Layout:* chart legend (right side, one swatch per failure type)

Fields, in printed order:
- Wear
- Worn
- Other
- Parted
- (blank)
- Collapse
- Hole

*Notes:* '(blank)' is the pivot bucket for failures with no failure type recorded — Excel-pivot style. Legend order is top-of-stack first.

### Graphics

- Stacked column (vertical bar) chart: X = well (category), Y = summed failure cost ($, $0-$250,000 with $50,000 gridlines, currency-formatted labels), series = failure type (Wear, Worn, Other, Parted, (blank), Collapse, Hole), gray plot background with horizontal gridlines, legend at right


---

## 26_Perforations.pdf — Perforations

**Purpose:** Complete inventory of every perforation interval shot on the well, with gun/charge details, balance pressures and status history, alongside a vertical wellbore schematic with callouts flagging the perforated intervals. Audience: completion/production engineers.

**Granularity:** single-well whole-life (all perforation records for one well; sample is 1 page, grows with record count)

**Page layout:** Portrait letter (612x792), 1 page in sample. Full-width header bands (logo+title, well name, well header grid), then body split into two vertical panels: left ~45% is the wellbore schematic, right ~55% is a stack of repeating perforation record blocks. Footer strip at bottom.

**Data entities:** `well`, `wellbore`, `zone`, `perforation`, `perforation_status`, `casing_string`, `tubing_component`, `other_in_hole`, `wellhead`

### Sections (in reading order)

#### Report header
*Layout:* key-value header block

Fields, in printed order:
- WellView (logo, top-left)
- Perforations (report title, centered)
- Well Name:

*Notes:* Well Name sample: 'Sample 11 - Full Data'.

#### Well header block
*Layout:* key-value header block, 2 rows x 6 columns, label above value in each cell

Fields, in printed order:
- API/UWI
- Surface Legal Location
- Field Name
- License #
- State/Province
- Well Configuration Type
- Original KB Elevation (ft)
- KB-Tubing Head Distance (ft)
- Spud Date
- Rig Release Date
- PBTD (All) (ftKB)
- Total Depth All (TVD) (ftKB)

*Notes:* PBTD (All) and Total Depth All (TVD) values are prefixed per wellbore, e.g. 'Original Hole - 12,089.9'. Dates shown as 'YYYY-MM-DD HH:MM'.

#### Wellbore schematic panel (left)
*Layout:* schematic with two caption bars and text callouts

Fields, in printed order:
- <Well Configuration Type> - <Wellbore Name>, <schematic generation timestamp> (caption bar, e.g. 'Deviated - Original Hole, 2009-09-15 10:56:06 AM')
- Vertical schematic (actual) (sub-caption bar)
- Callout per perforated interval: <Top>-<Btm> (ftKB); Zone:
- Current Status:
- Shot Dens:
- Calculated Shot Total:
- Phasing:

*Notes:* Not-to-scale vertical drawing of wellhead, casings, tubing, packer, bridge plug, perf symbols. Callouts point at drawn perf intervals; sample callout: '12,093.0-12,122.0; Zone: Upper Zone, Original Hole / Current Status: / Shot Dens: 4.0 / Calculated Shot Total: 117 / Phasing:'. Calculated Shot Total is computed from (Bottom-Top) x Shot Density (29 ft x 4.0 shown as 117; 30 ft x 4.0 shown as 121, i.e. length x density + 1).

#### Perforations (right panel, repeating block — one block per perforation record)
*Layout:* key-value block, labels above values, 4-6 cells per row

Fields, in printed order:
- Date
- Zone
- Top Depth (ftKB)
- Bottom Depth (ftKB)
- Perforation Company
- Conveyance Method
- Gun Size (in)
- Carrier Make
- Shot Density (shots/ft)
- Charge Type
- Phasing (°)
- Orientation
- Orientation Method
- Over/Under Balanced
- P Over/Under (psi)
- FL MD Before (ftKB)
- FL MD After (ftKB)
- P Surf Init (psi)
- P Final Surf (psi)
- Reference Log

*Notes:* One block = one perforation run (sample: 4 blocks). Zone value is '<Zone Name>, <Wellbore Name>'. Sample values: Conveyance Method 'Tubing', Gun Size 7, Shot Density 4.0.

#### Perforation Statuses (sub-table inside each perforation block)
*Layout:* table, 3 columns

Fields, in printed order:
- Date
- Status
- Com

*Notes:* One row per status change of that perforation (open/squeezed etc.); 'Com' is a comment column. Empty in sample but header row always printed.

#### Page footer
*Layout:* key-value footer strip

Fields, in printed order:
- www.peloton.com (left)
- Page <n>/<total> (center)
- Report Printed: <date> (right)

*Notes:* Identical footer on all five reports.

### Graphics

- Vertical wellbore schematic (actual configuration, not to scale): wellhead stack at top, ground/water wavy line, concentric casing strings, tubing string with SSSV/packer symbols, bridge plug, red perforation tick symbols at perforated depths, dotted horizontal reference lines; leader lines connect perf callout text to the drawn intervals


---

## 27_ProductionMaintenanceHistory.pdf — Production & Maintenance History

**Purpose:** Whole-life monthly production performance (rates, volumes, downtime) of one well/zone/activity-type combination plotted as trend charts, side-by-side with the monthly production table and the completion/workover job history, so engineers can correlate production changes with maintenance events.

**Granularity:** single-well whole-life, one zone + one activity type per report instance, monthly production periods (sample footer shows Page 1/19 — the monthly table continues on later pages)

**Page layout:** Landscape letter (792x612), multi-page (sample is page 1 of 19). Header band across top. Body split: left ~45% is a stack of three charts; right ~55% has the Summarized Production Data table on top and the Completion/Workover Job History table below. Footer strip.

**Data entities:** `well`, `zone`, `production_period`, `job`

### Sections (in reading order)

#### Report header
*Layout:* key-value header block

Fields, in printed order:
- WellView (logo, top-left)
- Production & Maintenance History (report title, centered)
- Zone: (top-right, e.g. 'Zone: ABC Commingled')
- Activity Type: (top-right, e.g. 'Activity Type: Produce')
- Well Name:

*Notes:* Zone and Activity Type in the top-right corner are the report's grouping filters. Well Name sample: 'Sample 37 - ESP'.

#### Well header block
*Layout:* key-value header block, 1 row x 8 columns, label above value

Fields, in printed order:
- API/UWI
- Surface Legal Location
- License #
- Well Configuration Type
- Ground Elevation (ft)
- Casing Flange Elevation (ft)
- KB-Ground Distance (ft)
- KB-Casing Flange Distance (ft)

*Notes:* Sample values: 1234567890, (blank), 1234, Vertical, 2,522.97, 2,532.81, 19.03, 9.19.

#### Chart 1 - production rates
*Layout:* chart

Fields, in printed order:
- Legend: End Date vs Rate Water (blue line)
- Legend: End Date vs Rate Reservoir Gas (green line)
- Left Y axis: Rate Reservoir Gas (MCF/day)
- Right Y axis: Rate Oil/Water/Cond (bbl/day)
- X axis: End of Reporting Period

*Notes:* Dual-axis time-series line chart; X ticks are dates (1985-01-01 ... 2005-01-01), left Y ticks 500/1000/1500, right Y ticks 200/400/600/800. Rates come from the Q columns of the production table (Vol / Prod Time).

#### Chart 2 - cumulative volumes
*Layout:* chart

Fields, in printed order:
- Left Y axis: Cum Vol Gas (MCF) (1,000s)
- Right Y axis: Cum Vol Oil/Water/Cond (bbl) (1,000s)
- X axis: End of Reporting Period

*Notes:* Dual-axis line chart; green = cumulative gas, blue = cumulative oil/water/cond. Computed as running sums of the monthly Vol columns over the well life; axes scaled in thousands.

#### Chart 3 - downtime
*Layout:* chart

Fields, in printed order:
- Y axis: Cumulative % Downtime
- X axis: End of Reporting Period

*Notes:* Y scale 0-100. Red vertical spikes = per-period % downtime, blue line = cumulative % downtime; both computed from DownTm vs Prod Time (days) of each reporting period.

#### Summarized Production Data (Most Recent at Top)
*Layout:* table, 11 columns; one row per monthly production reporting period, sorted newest first

Fields, in printed order:
- Start Date
- End Date
- Prod Time (days)
- DownTm (days)
- Vol ResGas (MCF)
- Vol Oil (bbl)
- Vol Water (bbl)
- Q Reservoir Gas (MCF/day)
- Q Oil (bbl/day)
- Q Water (bbl/day)
- Water Gas Ratio (%)

*Notes:* Q columns are computed: Vol / Prod Time (e.g. 2,367.000 MCF / 31.00 d = 76.35 MCF/day). Water Gas Ratio (%) is a computed water-to-gas ratio column (sample 6.5). Alternating-row shading. Table continues across the report's remaining pages.

#### Completion/Workover Job History
*Layout:* table, 4 columns; one row per completion/workover job, oldest first

Fields, in printed order:
- Job Typ
- Start Date
- End Date
- Summary

*Notes:* Job Typ samples: Initial Completion, Casing Repair, Pump Repair, Reconfigure Tubing/Components. Summary is free text and wraps to multiple lines (e.g. 'Replaced parted rod, replaced pump & 31 worn rod boxes').

#### Page footer
*Layout:* key-value footer strip

Fields, in printed order:
- www.peloton.com (left)
- Page <n>/<total> (center)
- Report Printed: <date> (right)

### Graphics

- Line chart: rate history — X: End of Reporting Period (date); left Y: Rate Reservoir Gas (MCF/day); right Y: Rate Oil/Water/Cond (bbl/day); series: Rate Water (blue), Rate Reservoir Gas (green); legend above chart
- Line chart: cumulative volumes — X: End of Reporting Period (date); left Y: Cum Vol Gas (MCF) (1,000s); right Y: Cum Vol Oil/Water/Cond (bbl) (1,000s); series: cum gas (green), cum oil/water/cond (blue)
- Combo chart: downtime — X: End of Reporting Period (date); Y: Cumulative % Downtime (0-100); red per-period downtime spikes plus blue cumulative-downtime line


---

## 28_SchematicCurrent.pdf — Schematic - Current

**Purpose:** One-page visual snapshot of the well's current downhole configuration — wellhead, casing strings, tubing string with components, packers, plugs and perforations drawn as a vertical schematic — with the most recent job identified. Audience: anyone needing the current mechanical state of the well at a glance.

**Granularity:** single-well current-state snapshot (1 page)

**Page layout:** Portrait letter (612x792), 1 page. Header bands (logo+title, well name, well header grid), 'Most Recent Job' one-row block, then a full-page schematic panel with a caption band (TD at left, wellbore/timestamp centered, 'Vertical schematic (actual)' sub-band), footer strip.

**Data entities:** `well`, `wellbore`, `job`, `wellhead`, `casing_string`, `cement_job`, `tubing_string`, `tubing_component`, `other_in_hole`, `perforation`

### Sections (in reading order)

#### Report header
*Layout:* key-value header block

Fields, in printed order:
- WellView (logo, top-left)
- Schematic - Current (report title, centered)
- Well Name:

*Notes:* Well Name sample: 'Sample 11 - Full Data'.

#### Well header block
*Layout:* key-value header block, 2 rows x 6 columns, label above value

Fields, in printed order:
- API/UWI
- Surface Legal Location
- Field Name
- License #
- State/Province
- Well Configuration Type
- Original KB Elevation (ft)
- KB-Tubing Head Distance (ft)
- Spud Date
- Rig Release Date
- PBTD (All) (ftKB)
- Total Depth All (TVD) (ftKB)

*Notes:* Identical block to 26_Perforations. PBTD/TVD values prefixed per wellbore ('Original Hole - 12,089.9').

#### Most Recent Job
*Layout:* key-value block, section title bar + 1 row x 5 columns, label above value

Fields, in printed order:
- Job Category
- Primary Job Type
- Secondary Job Type
- Start Date
- End Date

*Notes:* Sample: Completion/Workover | Completion | Initial Completion | 2000-05-16 | 2000-06-03. Derived as the latest job record for the well.

#### Schematic caption band
*Layout:* key-value band above schematic

Fields, in printed order:
- TD: (left cell, e.g. 'TD: 12,503.3')
- <Well Configuration Type> - <Wellbore Name>, <schematic generation timestamp> (centered, e.g. 'Deviated - Original Hole, 2009-09-15 10:59:52 AM')
- Vertical schematic (actual) (sub-band)

#### Vertical schematic (actual)
*Layout:* schematic, full remaining page height

Fields, in printed order:
- (no printed field labels in this sample — drawing only, with horizontal dotted depth gridlines)

*Notes:* Drawn from equipment tables: wellhead stack, ground/water wavy line, cyan/red dotted elevation reference lines, casing strings (red), cement (hatched), tubing string (blue) with SSSV, gauge mandrel, packer (black), seating nipples, re-entry guide, bridge plug, PBTD fill. Component callout labels are off in this sample but the same renderer supports them (see 29).

#### Page footer
*Layout:* key-value footer strip

Fields, in printed order:
- www.peloton.com (left)
- Page <n>/<total> (center)
- Report Printed: <date> (right)

### Graphics

- Full-page vertical wellbore schematic (actual, not to scale): concentric casing/cement/tubing rendering by depth with equipment symbols (wellhead, SSSV, gauge mandrel, packer, nipples, bridge plug), horizontal dotted gridlines, surface/ground wavy line


---

## 29_SchematicProposedvsActual.pdf — Schematic - Current

**Purpose:** Side-by-side comparison of the proposed tubing-string design versus the as-run actual string, each drawn as a vertical schematic with a numbered callout label for every component, so engineers can verify the installed completion against the program. Printed title is 'Schematic - Current' — same template family as 28, run with two schematic panels.

**Granularity:** single-well snapshot comparing two string versions (proposed vs actual), 1 page

**Page layout:** Portrait letter (612x792), 1 page. Same header stack as 28 (logo+title, well name, well header grid, Most Recent Job row, TD caption band), then the schematic area split into two equal side-by-side panels titled 'Vertical schematic (proposed)' (left) and 'Vertical schematic (actual)' (right), each with yellow callout labels. Footer strip.

**Data entities:** `well`, `wellbore`, `job`, `tubing_string`, `tubing_component`, `casing_string`, `cement_job`, `perforation`, `wellhead`

### Sections (in reading order)

#### Report header
*Layout:* key-value header block

Fields, in printed order:
- WellView (logo, top-left)
- Schematic - Current (report title, centered)
- Well Name:

*Notes:* Well Name sample: 'Sample 39 - Proposal vs Actual'.

#### Well header block
*Layout:* key-value header block, 2 rows x 6 columns, label above value

Fields, in printed order:
- API/UWI
- Surface Legal Location
- Field Name
- License #
- State/Province
- Well Configuration Type
- Original KB Elevation (ft)
- KB-Tubing Head Distance (ft)
- Spud Date
- Rig Release Date
- PBTD (All) (ftKB)
- Total Depth All (TVD) (ftKB)

*Notes:* Sample: Field Name Gilby, License # 555555abc, State/Province Alberta, KB Elev 3,638.45, Spud 2008-06-03 04:15, TVD 'Original Hole - 7,686.0'; several cells legitimately blank.

#### Most Recent Job
*Layout:* key-value block, section title bar + 1 row x 5 columns

Fields, in printed order:
- Job Category
- Primary Job Type
- Secondary Job Type
- Start Date
- End Date

*Notes:* Sample: Completion/Workover | Completion | (blank) | 2008-07-12 | 2008-07-18.

#### Schematic caption band
*Layout:* key-value band above schematics

Fields, in printed order:
- TD: (left cell, e.g. 'TD: 7,841.2')
- <Well Configuration Type> - <Wellbore Name>, <schematic generation timestamp> (centered, e.g. 'Deviated - Original Hole, 2009-09-15 3:24:43 PM')

#### Vertical schematic (proposed) — left panel
*Layout:* schematic with callout labels

Fields, in printed order:
- Panel title: Vertical schematic (proposed)
- Callout label per component: <string#>-<component seq>; <Item Des>; <OD (in)>; <Top Depth>-<Bottom Depth> (ftKB); <Length (ft)>

*Notes:* Proposed string components numbered 1-1 ... 1-9. Samples: '1-1; Tubing Hanger; 2 3/8; 1.3-2.2; 0.82', '1-4; Tubing Jt; 2 3/8; 41.7-7,672.1; 7,630.41', '1-5; X Profile Seating Nipple; 2 3/8; 7,672.1-7,673.3; 1.18', '1-8; XN Seating Nipple; ...', '1-9; Wireline Entry Guide; ...'. Yellow-filled boxes with leader lines to the drawn component.

#### Vertical schematic (actual) — right panel
*Layout:* schematic with callout labels

Fields, in printed order:
- Panel title: Vertical schematic (actual)
- Callout label per component: <string#>-<component seq>; <Item Des>; <OD (in)>; <Top Depth>-<Bottom Depth> (ftKB); <Length (ft)>

*Notes:* Actual string components numbered 2-1 ... 2-8. Samples: '2-3; Pup Jt; 2 3/8; 42.4-50.4; 8.04', '2-5; X Profile Seating Nipple; 2 3/8; 7,561.1-7,562.3; 1.18', '2-8; Wireline Entry Guide; 2 3/8; 7,598.6-7,598.9; 0.39'. Actual panel labels are unfilled (white) in sample; both panels also draw casing, cement hatching, red perforation lines.

#### Page footer
*Layout:* key-value footer strip

Fields, in printed order:
- www.peloton.com (left)
- Page <n>/<total> (center)
- Report Printed: <date> (right)

### Graphics

- Two side-by-side vertical wellbore schematics (proposed vs actual, not to scale), each drawing wellhead, casing, cement hatching, tubing components and red perforation interval lines, with per-component callout labels ('n-m; description; OD; top-bottom; length') connected by leader lines


---

## 30_WellSummary.pdf — Well Summary

**Purpose:** Whole-life master summary of a single well: identity/elevations, wellheads, wellbores, casing and cement, downhole equipment, zones, perforations, stimulations, logs, tubing/rod strings, pumps, swabs, jobs and attachments — the one-stop mechanical/history dossier for the well file.

**Granularity:** single-well whole-life (sample is 2 portrait pages; length grows with record counts)

**Page layout:** Portrait letter (612x792), 2 pages in sample. Continuous stack of titled sections, each a grey title bar followed by either a key-value grid or a column-headed table; sections flow across pages. Every page repeats the logo/title/Well Name header and the footer strip.

**Data entities:** `well`, `well_contact`, `wellhead`, `wellbore`, `casing_string`, `cement_job`, `cement_fluid`, `other_in_hole`, `zone`, `perforation`, `stimulation_job`, `stimulation_stage`, `well_log`, `tubing_string`, `tubing_component`, `rod_string`, `rod_component`, `rod_pump`, `swab_run`, `job`, `attachment`

### Sections (in reading order)

#### Report header (every page)
*Layout:* key-value header block

Fields, in printed order:
- WellView (logo, top-left)
- Well Summary (report title, centered)
- Well Name:

*Notes:* Well Name sample: 'Sample 11 - Full Data'.

#### Well header block
*Layout:* key-value grid, 5 rows, label above value

Fields, in printed order:
- API/UWI
- Surface Legal Location
- Field Name
- License #
- Spud Date
- Rig Release Date
- Well Configuration Type
- Total Depth (ftKB)
- Original KB Elevation (ft)
- Ground Elevation (ft)
- CF Elev (ft)
- TH Elev (ft)
- Other Elevation (ft)
- KB-Ground Distance (ft)
- KB-CF (ft)
- KB-TH (ft)
- Contact Name
- Contact Name
- Contact Name
- Contact Name
- Directions To Well

*Notes:* Row 3 packs 8 elevation/distance cells (CF = casing flange, TH = tubing head). Row 4 is four side-by-side Contact Name cells (well contacts). Directions To Well is a full-width free-text row (sample: 'Take chopper to above reference lat/long.').

#### Wellheads
*Layout:* table, 4 columns; one row per wellhead record

Fields, in printed order:
- Type
- Make
- WP (psi)
- Service

*Notes:* Sample row: SSMC | Cameron | 10,000.0 | Normal. WP = working pressure.

#### Wellbores
*Layout:* table, 4 columns; one row per wellbore

Fields, in printed order:
- Wellbore Name
- Parent Wellbore
- Profile
- KO MD (ftKB)

*Notes:* Sample: Original Hole | Original Hole | Directional | 1,381.2. KO MD = kickoff measured depth.

#### Casing Strings
*Layout:* table, 7 columns; one row per casing string

Fields, in printed order:
- Csg Des
- Run Date
- OD (in)
- ID (in)
- Wt/Len (lb/ft)
- Grade
- Set Depth (ftKB)

*Notes:* Sample rows: Structural Casing, Conductor Pipe, Surface Casing, Production Casing; OD shown as fraction text (13 3/8, 9 5/8).

#### Cement (repeating job block — one per cement job)
*Layout:* key-value block; sub-title bar '<Job Des>, <String Type>, <date time>' then labeled cells; fluid rows repeat

Fields, in printed order:
- Cementing Company
- Top Depth (ftKB)
- Bottom Depth (ftKB)
- Full Return?
- Cement Volume Return (bbl)
- Fluid Description
- Fluid Type
- Amount (sacks)
- Class

*Notes:* Block titles sample: 'Structural Cement, Casing, 2000-02-22 11:15' ... 'Production Casing Cement, Casing, 2000-03-18 01:30'. The Fluid Description / Fluid Type / Amount (sacks) / Class row repeats once per cement fluid stage in the job (Lead Cement, Lead, Tail, Tail Cement; Class sample 'G'). Full Return? is Yes/No.

#### Other In Hole
*Layout:* table, 5 columns; one row per downhole item not part of a string

Fields, in printed order:
- Des
- Top (ftKB)
- Btm (ftKB)
- Run Date
- Pull Date

*Notes:* Sample: Bridge Plug - Permanent | 12,330.0 | 12,334.0 | 2000-05-15 | (blank).

#### Zones
*Layout:* table, 5 columns; one row per zone

Fields, in printed order:
- Zone Name
- Top (ftKB)
- Btm (ftKB)
- Current Status
- Cur Stat Date

*Notes:* Sample: Upper Zone | 12,090.0 | 12,128.0 | Flowing | 1999-05-01.

#### Perforations
*Layout:* table, 8 columns; one row per perforation record

Fields, in printed order:
- Date
- Type
- Top (ftKB)
- Btm (ftKB)
- Zone
- Shot Dens (shots/ft)
- Phasing (°)
- Current Status

*Notes:* 'Shot Dens (shots/ft)' header wraps over two lines. Type sample: TCP. Zone value is '<Zone Name>, <Wellbore Name>'.

#### Stimulation (repeating job block — one per stimulation job; page 2)
*Layout:* key-value block; sub-title bar '<Type> on <date time>' (e.g. 'Sand Frac on 2000-05-31 00:00'), header cells, then a stage table

Fields, in printed order:
- Date
- Zone
- Type
- Stg #
- Stage Type
- Top Depth (ftKB)
- Bottom Depth (ftKB)
- Clean Volume Pumped (bbl)

*Notes:* Stage table has one row per stage (Stg # 1, Stage Type 'Pre-Wash', Clean Volume Pumped 60.00). Two blocks in sample.

#### Logs
*Layout:* table, 5 columns; one row per log run

Fields, in printed order:
- Date
- Top (ftKB)
- Btm (ftKB)
- Type
- Cased?

*Notes:* Type sample: 'GR - LDT - CNR - DIT', 'GR-DSI'. Cased? is Yes/No.

#### Tubing Strings (repeating block — one per tubing string)
*Layout:* string header key-value row, then component table; one component-table row per item/component

Fields, in printed order:
- Tubing Description
- Run Date
- Set Depth (ftKB)
- Item Des
- OD (in)
- ID (in)
- Wt (lb/ft)
- Grade
- Jts
- Len (ft)
- Top (ftKB)
- Btm (ftKB)

*Notes:* String header sample: Production Tubing | 2000-06-02 | 11,828.4. Component rows sample: Tubing, Communications nipple, TRSSV, Gauge Mandrel, Tubing pup, Packer production, Millout extension, RN nipple (3.437"), Re-entry guide. Btm of each row = Top + Len (running depth); Jts = joint count.

#### Rod Strings (repeating block — one per rod string)
*Layout:* string header key-value row, then component table

Fields, in printed order:
- Rod Description
- Run Date
- Set Depth (ftKB)
- Item Description
- OD Nominal (in)
- Weight/Length (lb/ft)
- Grade
- Joints
- Length (ft)
- Top Depth (ftKB)
- Bottom Depth (ftKB)

*Notes:* Empty in sample (well has no rods) but headers always print.

#### Rod Pumps
*Layout:* key-value block, 5 label rows

Fields, in printed order:
- Make
- Model
- Serial Number
- Pump Bore (in)
- API Pump Type
- API Barrel Type
- API Anchor Type
- Seat Assy Typ
- Barrel Length (ft)
- Nom Plunger Len (ft)
- Upper Ext Len (ft)
- Lwr Ext Len (ft)
- Plung OD Clr (in)
- Seating Assembly Description
- Seat Assy Sz (in)
- API Barrel Material
- API Plunger Material
- Gas Anc OD (in)
- Gas Anchor Length (ft)
- Traveling Valve Ball Material
- Traveling Valve Seat Material
- Standing Valve Ball Material
- Standing Valve Seat Material

*Notes:* One block per rod pump; empty in sample but all labels print.

#### Swabs
*Layout:* table, 6 columns; one row per swab run

Fields, in printed order:
- Date
- Swab Comp
- Zone
- Total Vol (bbl)
- Total Oil (bbl)
- Total BSW (bbl)

*Notes:* Sample: 2000-05-31 | Swab Services | Upper Zone, Original Hole | 95.0 | 87.8 | 7.2. Total Vol appears to equal Total Oil + Total BSW.

#### Jobs
*Layout:* table, 5 columns; one row per job

Fields, in printed order:
- Start Date
- End Date
- Job Typ
- Job SubTyp
- Summary

*Notes:* Sample rows: 'Drilling - original' with a two-line wrapped Summary; 'Completion / Initial Completion'.

#### Attachments
*Layout:* table, 1 column; one row per attached document

Fields, in printed order:
- Des

*Notes:* Sample: 'Cameron S Wellhead'.

#### Page footer (every page)
*Layout:* key-value footer strip

Fields, in printed order:
- www.peloton.com (left)
- Page <n>/<total> (center)
- Report Printed: <date> (right)


---


# Appendix — Operation / time-code system (from the three code documents)

# WellView / OIEC Drilling Reporting Code System — Inventory

**Sources read (complete):**

| File | Content | Pages |
|---|---|---|
| `Wellview Code.pdf` | One-page code sheet: "Wellview Code 1" (letter codes), "Wellview Code 2" (number codes), "Report Code" (P-N-T-U) | 1 |
| `Driliing Operation reporting code.pdf` (identical content in the companion `.docx`; the Time Breakdown Matrix is an embedded image, recovered from the docx EMF) | OIEC **"Time Distribution Procedure for Drilling & Completion Operations"**, Rev. 0, issued 02/06/2017. Defines working phases, main operations, operation details, time-classification indicators, and the Time Breakdown Matrix (Tab. 7-1) used to code daily reports (ARPO 02) | 15 |
| `wellview.pdf` | Pason–WellView Field Solution marketing brochure (Pason EDR + Peloton WellView). **Contains no code tables** | 2 |

---

## 1. Code Tables / Lookup Lists

### 1.1 Wellview Code 1 — Main Operation (letter codes, 21 entries)

Classifies the **Main Operation** (activity category) in progress. Defined on the one-page code sheet; the same letters index the rows of the Time Breakdown Matrix.

| Code | Meaning |
|---|---|
| A | Moving (Rig up / Rig down) |
| B | Skidding |
| C | Wellhead |
| D | Conductor Pipe |
| E | Drilling |
| F | Sidetrack or Re-Drilling |
| G | Casing/Liner Job |
| H | Cement Job |
| I | Coring |
| J | Logging |
| K | Well Completion |
| L | Well Decompletion |
| M | Well Preparation |
| N | Sand Control |
| O | Well Treatment/Stimulation |
| P | Well Test & DST |
| Q | Well Abandoning |
| R | Slike Line *(sic — slick line)* |
| S | Coiled Tubing |
| T | Artificial Lift |
| U | BOP |

*Discrepancy:* the Time Breakdown Matrix merges wellhead and BOP into a single row **C = "WELL_HEAD & B.O.P."** and has no row U; the one-page sheet splits them (C = Wellhead, U = BOP).

### 1.2 Wellview Code 2 — Operation Detail (number codes, 33 entries)

Classifies **what is physically being done** within a Main Operation (the "Details of Main Operation", Section 6 of the procedure). Full list with the procedure's definitions:

| Code | Meaning | Definition / notes from procedure |
|---|---|---|
| 01 | Preparation | Time in preparation operations for the main operation (e.g. A1-P prep of rig move, B1-P prep of skidding) |
| 02 | Rig or Equipment Moves | Moving the rig (Moving & Skidding) (A2-P moving, B2-P skidding) |
| 03 | Rotation Hours on Bottom (Drilling) | Rotating hours of bit & coring; incl. surface hole for conductor pipe, pilot hole, deepening for gravel pack, sidetracking, coring (E3-P drilling, I3-P coring, F3-T sidetrack after stuck pipe) |
| 04 | Trips | RIH/POOH of any object: BHA, casing, conductor pipe, completion string, logs, wireline, coiled tubing (G4-P casing running, K4-P completion running) |
| 05 | Installation/Disassembly | Rig-up/rig-down or equipment make-up/lay-down (B5-P rig-up, J5-P rig up logging unit) |
| 06 | Wiper Trip & Reaming | Wiper/short trips incl. reaming to bottom |
| 07 | Circulation | Intermediate, on-bottom, kick control, bottoms-up (E7-T kick control while drilling) |
| 08 | Fluids Preparation | Mud, pills, slurry mixing (H8-P cement/spacer prep) |
| 09 | Fluids Pumping in Well | Pumping fluids into the well (H9-P slurry & spacers) |
| 10 | Fluids/Core Recovery (cores, DST, soil test) | Recovery of core, DST fluids (I10-P core recovery, P10-P DST fluid recovery) |
| 11 | Measurement (Detection) in Well | Electric logs, surveys, flow check, L.O.T., F.I.T., build-up recording (E11-P survey, P11-P build-up) |
| 12 | Equipment Test | BOP, wellhead, downhole motors, tools (C12-P BOP test, K12-P packer test) |
| 13 | Working-on/Fishing | Jar & bumper work, equipment malfunction (DV collar, liner hanger, packer), tool positioning/removal; trip time included |
| 14 | Milling | Mill/drill out float collar, shoe, dressing top liner, casing mill-out (G14-P drill out float collar & shoe) |
| 15 | Through Tubing Operations | Operations on completed well with CT, slick line, e-line (K15-P string calibration) |
| 16 | Shoot/Perforating | Perforating/shooting incl. trip time; also drill-string back-off, clearing bit nozzles (P16-P casing & tubing perforation) |
| 17 | Plugs & Squeezes | Setting plugs and squeezing fluids, trip time included (Q17-P abandonment plugs, H17-T squeeze re-cementing) |
| 18 | Casing & Tubing (Cut and Recovery) | Cut & recover casing string in hole (Q18-P for abandonment) |
| 19 | Various Operations in Well | In-well operations not otherwise specified |
| 20 | Various Operations at Surface | Surface operations not otherwise specified |
| 21 | Waiting in General | W.O.C., pill effect, treatments; incl. time to secure the well and resume |
| 22 | Waiting Environmental Conditions | W.O.W., daylight; incl. securing/resuming time |
| 23 | Waiting Materials, Services, Personnel (Company's) | Incl. securing/resuming time |
| 24 | Waiting Materials, Services, Personnel (Contractor's) | Incl. securing/resuming time |
| 25 | Maintenance & Repair | Incl. securing/resuming time |
| 26 | Strike | Incl. securing/resuming time |
| 27 | Not Accurate or Not Available | Used **only** for non-operated wells |
| 28 | Hole Opening | Hole enlargement (rotation hours off bottom) |
| 29 | Change Production Level | Change of production level or partialization |
| 30 | Redress T.S.V. | POOH, redress, RIH tubing safety valves |
| 31 | Redress S.C.S.S.V. | POOH, redress, RIH surface-controlled subsurface safety valves |
| 32 | Test S.C.S.S.V. | Recording S.C.S.S.V. test |
| 33 | Well Control | (One-page sheet only; not a matrix column. Procedure §6's description of [33] is a copy-paste of the Test S.C.S.S.V. text — source-document defect) |

*Errata:* Procedure §6 numbers its last five details [29]–[33] but its own examples use the matrix numbering (e.g. "[29] Change Production Level … e.g. R30-P"). **The matrix and the one-page code sheet are the authority: 29 = Change Production Level, 30 = Redress TSV, 31 = Redress SCSSV, 32 = Test SCSSV.**

### 1.3 Report Code (one-page sheet) — 4 entries

| Code | Meaning |
|---|---|
| P | Productive |
| N | None-Productive *(sic)* |
| T | Trouble |
| U | Un-Planned |

### 1.4 Time-Classification Indicators (procedure §3) — 5 entries

Appended to every activity code; determines planned/unplanned/trouble classification for statistics:

| Indicator | Meaning | Definition |
|---|---|---|
| P | Planned | Operations in the original well plan/objective and in the authorized budget (**AFE**) — even anticipated problems (e.g. expected loss circulation) |
| U | Unplanned | Operations not in the original plan/AFE; typically Exploration Dept requests (extra logging runs, extra casing string, deepening beyond approved TD) |
| T | Trouble | Any trouble delaying a **planned** operation; includes time to resolve and to regain the point/depth where the event occurred |
| X | Unplanned Trouble | Trouble occurring during an **unplanned** operation (e.g. stuck pipe while unplanned deepening); same to-restore-point rule |
| N | Non-Productive Time | (listed in §3 without further definition) |

### 1.5 Working Phases (Tab. 4-1) — 10 phases, each with start/end triggers

| Phase | Purpose | Starts | Ends |
|---|---|---|---|
| RIG or Rigless Equipment MOVING | Move rig/equipment to location (moving, positioning, rig-up) | Contract commencement | End of rig/rigless equipment testing |
| PRELIMINARY | Start drilling/completion/W.O. activities (conductor pipe, skidding, killing) | End of rig testing | Start of Re-Entry / Drilling / Workover phase |
| RE-ENTRY | Restart activity on an existing well (wellhead & BOP ops, milling, plugging) | First tool ready to run in hole | RIH of first bit to start drilling |
| DRILLING | Reach planned depth | RIH of first bit to drill the phase (each drilling phase starts at RIH of its first bit) | Exploration: end of last log / final depth. Development: end of ops on production casing with bit-scraper on bottom |
| WORKOVER | Heavy: pull completion & mechanically restore. Light: inspect/restore/modify without pulling | — | Heavy: end of restoration on production casing with bit-scraper on bottom. Light: start of well testing |
| COMPLETION | Configure well completion | First tool through the master valve | First completion: as Drilling-end rules. Other completions: end of restoration with bit-scraper on bottom. Also: end make-up of production cross |
| WELL TESTING | Perform well testing | Start RIH of well-testing string | D.S.T.: to start of abandonment / completion phase / drilling restart. Production test: from well start-up or start of abandonment |
| WELL ABANDONING | Permanent or temporary abandonment | Start RIH of DP / wireline / CT to set first plug (cement, bridge, etc.) | End of operation on the well |
| SECURE THE WELL | Secure the well (RIH plugs or B.P.V., redress TSV/SCSSV, test SCSSV) | Start RIH of first tool | Well start-up or start of other working phase |
| PRODUCTION MAINTENANCE | Production maintenance (gradient survey, acid job, washing job) | Start RIH of first tool | Well start-up or start of other working phase |

### 1.6 Codes for Statistic Activities (Tab. 4-2) — 2 entries, **not** for operational reporting

| Code | Meaning | From | To |
|---|---|---|---|
| DOWN TIME | Stops not due to incidents, incl. well-safety operations (maps to details 21–26) | Interruption of the operation underway | Restart of planned operation |
| INCIDENT | Resolving a well incident stopping a planned/unplanned operation, incl. restoring pre-incident conditions (any operation flagged **T** or **X**) | Time the event occurs | Pre-event well conditions restored |

### 1.7 Main Operations — rig on location (Tab. 5-1) — 18 entries (usable for rigless too)

MOVING (Rig up/Rig down) · SKIDDING · WELL HEAD · B.O.P. · CONDUCTOR PIPE · DRILLING · SIDE TRACK or RE-DRILLING · CASING JOB · CEMENTING JOB · CORING · LOGGING · WELL COMPLETION · WELL DECOMPLETION · WELL PREPARATION · SAND CONTROL · WELLBORE TREATMENT · WELL TEST &/or D.S.T. · WELL ABANDONING

Notable boundary rules embedded in the descriptions:
- **SKIDDING:** between two wells of the same cluster, preparation time is charged to the well underway; skidding time is charged to the **arrival** well.
- **CASING JOB** ends when pumping of cement **spacer** begins; **CEMENTING JOB** runs from pumping spacers to end of W.O.C.
- **SIDE TRACK** starts when the bit is RIH to dress the cement plug; includes the integrity test; lasts until regaining the pre-accident TVD.
- **LOGGING** includes R/U & R/D of logging unit, recording, trips before/after, conditioning trips, and fishing of logging tools.
- **WELL COMPLETION** spans from end of production-casing ops "with bit/scraper on bottom" to start of well testing or rig-down; **WELL DECOMPLETION** from end of BOP installation to last completion device out; **WELL PREPARATION** from end of completion removal to end of restoration with bit/scraper on bottom.
- **WELL ABANDONING** starts at RIH to set the first plug and ends after securing the well before leaving location.

### 1.8 Main Operations — rigless only (Tab. 5-2) — 3 entries

| Operation | Scope |
|---|---|
| SLIKE LINE (R) | All operations with slick-line equipment |
| COILED TUBING (S) | All operations with coiled-tubing equipment |
| ARTIFICIAL LIFT (T) | Install/maintain artificial-lift equipment |

### 1.9 Time Breakdown Matrix (Tab. 7-1) — valid Letter×Detail combinations

Rows = activities A–T (matrix row C = "WELL_HEAD & B.O.P." combined; no U row). Columns = details 1–32. **437 marked cells.** Valid detail numbers per activity as printed:

| Row | Activity | Valid detail codes |
|---|---|---|
| A | Moving (rig up/rig down) | 1, 2, 9*, 11, 12, 15, 16, 20, 21–28, 32 |
| B | Skidding | 1, 2, 5, 10, 12, 20, 21–28 |
| C | Well head & B.O.P. | 1, 2, 4, 5, 7, 8, 9, 12, 13, 17, 20, 21–28, 32 |
| D | Conductor pipe | 1, 4, 5, 7, 11, 12, 13, 14, 19, 20, 21–28 |
| E | Drilling | 1, 3, 4, 5, 6, 7, 8, 9, 11, 12, 13, 14, 16, 17, 19, 20, 21–28 |
| F | Side track or re-drilling | 1, 3, 4, 5, 6, 7, 8, 9, 11, 12, 13, 14, 16, 17, 18, 19, 20, 21–28 |
| G | Casing job | 1, 4, 5, 6, 7, 8, 9, 12, 13, 14, 17, 19, 20, 21–28 |
| H | Cementing job | 1, 2, 4, 5, 6, 7, 8, 9, 12, 13, 16, 17, 19, 20, 21–28, 29 |
| I | Coring | 1, 3, 4, 5, 6, 7, 8, 9, 10, 12, 13, 14, 16, 17, 19, 20, 21–28 |
| J | Logging | 1, 2, 4, 5, 6, 7, 8, 9, 11, 12, 13, 15, 16, 19, 20, 21–28 |
| K | Well completion | 1, 2, 4, 5, 7, 8, 9, 11, 12, 13, 15, 16, 17, 18, 19, 20, 21–28 |
| L | Well decompletion | 1, 2, 4, 5, 7, 8, 9, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21–28 |
| M | Well preparation | 1, 4, 5, 6, 7, 8, 9, 11, 12, 13, 14, 16, 17, 18, 19, 20, 21–28 |
| N | Sand control | 1, 2, 4, 5, 6, 7, 8, 9, 11, 12, 13, 15, 16, 17, 19, 20, 21–28 |
| O | Wellbore treatment | 1, 2, 4, 5, 7, 8, 9, 11, 12, 13, 15, 17, 19, 20, 21–28 |
| P | Well test & D.S.T. | 1, 2, 4, 5, 7, 8, 9, 10, 11, 12, 13, 15, 16, 17, 19, 20, 21–28, 29 |
| Q | Well abandoning | 1, 2, 4, 5, 6, 7, 8, 9, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21–28 |
| R | Slike line | 2, 7, 8, 9, 11, 12, 15, 16, 17, 20, 21, 22, 23, 24, 26, 29, 30, 31 |
| S | Coiled tubing | 2, 7, 8, 9, 11, 12, 14, 15, 16, 17, 18, 20, 21, 22, 23, 24, 26, 29, 30, 31 |
| T | Artificial lift | 2, 7, 8, 9, 11, 12, 14, 15, 16, 17, 18, 20, 21, 22, 23, 24, 26, 29, 30, 31 |

\* Row A: the cell in column 9 (Fluids pumping in well) is printed "A4" — almost certainly a misprint for A9; column 4 for row A is blank.

Matrix footnotes (verbatim intent):
- "Codes given in the matrix … are not firmly fixed, therefore any other combination is possible."
- "The last three activity [R, S, T] shall be used only for rig less operations."

---

## 2. Data-Model / Field & Naming Conventions

- **Activity code syntax:** `{MainOperationLetter}{DetailNumber}-{Indicator}` — e.g. `E3-P` (planned drilling rotation), `F3-T` (sidetrack after stuck pipe), `E3-U` (unplanned deepening), `F3-X` (trouble during unplanned deepening), `G21-P` (W.O.C.), `L4-U` (unplanned completion pull-out). One appearance uses the reversed form `T-E6` / `P-E6` (§6, detail 6) — an inconsistency in the source.
- **Codes classify category, not reason:** Main Operations are defined by category (e.g. "Tripping"), never by purpose ("trip for bit change") — explicitly to limit code count (§2).
- **Phase boundaries are date+time fields:** Tab. 4-1 headers require "STARTING PHASE (date and time)" and "END PHASE (date and time)".
- **Time unit:** hours ("Hours actually spent…") for all detail codes; trip time is explicitly included in details 13, 16, 17.
- **Statistic-only vs operational codes:** DOWN TIME / INCIDENT (Tab. 4-2) must **not** be used during well operation — statistics only.
- **Detail 27** is reserved for non-operated wells.
- **Document numbering convention** (visible on p.15 footer): `SP2021-DR-112-860-GF-0001 Rev.01` (project – discipline – well/phase – series – doc-type – sequence).
- No other field dictionaries, units systems, or mandatory-field lists are defined in these three documents.

## 3. Report-Generation Rules

- **Daily report coding:** the Time Breakdown Matrix (Tab. 7-1) supplies the activity codes to be reported in the daily operational reports, identified as **ARPO 02** (§2).
- **Roll-up chain:** each 24-h day is split into time intervals → each interval gets a Matrix code `Letter+Number` plus an Indicator (P/U/T/X) → intervals roll up to **Main Operations** → Main Operations roll up to **Working Phases** (Tab. 4-1 start/end triggers determine phase attribution) → indicators drive Planned vs Unplanned vs Trouble statistics; codes are "a standard comparison tool for statistical analyses", not a narrative of operations (§1).
- **AFE linkage:** Indicator **P** is defined as time included in the authorized budget (AFE); U/T/X time falls outside the AFE plan. Trouble time (T/X) spans from the event until the pre-event point/depth is regained — i.e., recovery time is charged to trouble, not to progress.
- **Cross-well time charging:** cluster skidding — preparation to the current well, skid time to the arrival well (Tab. 5-1).
- **WellView/Pason integration (brochure):** tour-sheet data is imported directly into WellView from the Pason EDR (one-time data collection, no re-keying); data is distributed via the web-based DataHub; field licensing is charged as "a nominal day rate applied to AFEs".

## 4. Daily Drilling Report Structure

**Not defined in these three documents.** The daily report is referenced only by name ("daily operational reports (ARPO 02)"); no section layout, ordering, or form fields are given. (The sibling files in the same folder — `06_DailyDrilling.pdf`, `07_DailyDrillingDetail.pdf`, etc. — are WellView report samples but were outside the requested set.)

---

## Errata / Consistency Notes (source-document defects worth knowing)

1. §6 numbering is off by one for the last five details ([29]–[33] headings vs. code examples 30–32); matrix + code sheet numbering (29–32, plus 33 on the sheet only) is authoritative.
2. §6 [33] "Well Control" reuses the Test-S.C.S.S.V. description verbatim; 33 has no matrix column.
3. Matrix row A column 9 printed as "A4" (likely A9).
4. Letter U (BOP) exists only on the one-page sheet; the matrix folds BOP into row C.
5. Indicator vocabularies differ: procedure = P/U/T/X (+N); one-page "Report Code" = P (Productive) / N (None-Productive) / T (Trouble) / U (Un-Planned).
6. Recurrent OCR-era typos in the source: "Slike Line" (slick line), "Equioment", "STATISTC", "FORESESS", "Mentenance", "olso", "weel".
