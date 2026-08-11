"""
Human labels for WellView table and column names.

THESE ARE INTERPRETED, NOT EXTRACTED.

An .afr file stores `wvwellheader.wellida` and nothing else — the caption a user
sees ("Well ID") lives in WellView's data dictionary, which is not in these
files. So every label below is a translation into standard WellView / drilling
terminology, and every one is marked `interpreted` in reports.json and carries a
dotted underline in the HTML. The FIELD NAMES are exact; the labels are a
reading of them.

The rules used, in order:
  1. an explicit entry in COLUMN_LABELS or TABLE_LABELS
  2. a recognised suffix (…calc = computed, …cum = cumulative, …tot = total)
  3. a recognised token expansion (dttm -> Date/Time, mkb -> mKB, dp -> drill pipe)
  4. otherwise the raw column name, split on word boundaries and title-cased
"""
from __future__ import annotations

import re

TABLE_LABELS: dict[str, str] = {
    "wvwellheader": "Well Header",
    "wvwell": "Well",
    "wvjob": "Job",
    "wvjobreport": "Daily Report",
    "wvjobreportcostgen": "Daily Cost — General",
    "wvjobreportcost": "Daily Cost",
    "wvjobreporttimelog": "Time Log",
    "wvjobreportmudchk": "Mud Check",
    "wvjobreportmud": "Mud",
    "wvjobreportpersonnel": "Personnel On Board",
    "wvjobreportcontacts": "Report Contacts",
    "wvjobreportsurvey": "Survey Station",
    "wvjobreportbulk": "Bulk Materials",
    "wvjobreportweather": "Weather",
    "wvjobreportsafety": "Safety",
    "wvjobdrillstring": "Drill String / BHA",
    "wvjobdrillstringcomp": "Drill String Component",
    "wvjobdrillstringdrillparam": "Drilling Parameters",
    "wvjobdrillstringbit": "Bit",
    "wvjdsdphydcalc": "Hydraulics (computed)",
    "wvjobkick": "Kick",
    "wvjobintervalproblem": "Interval Problem (NPT)",
    "wvjobintervallesson": "Interval Lesson",
    "wvjobphase": "Job Phase",
    "wvjobafe": "AFE",
    "wvjobcasing": "Casing String",
    "wvjobcasingcomp": "Casing Component",
    "wvjobcement": "Cement Job",
    "wvjobcementstage": "Cement Stage",
    "wvjobcementfluid": "Cement Fluid",
    "wvjobrig": "Rig",
    "wvrig": "Rig",
    "wvrigpump": "Rig Pump",
    "wvjobformation": "Formation",
    "wvjoblog": "Log Run",
    "wvjobtest": "Test",
    "wvjobperf": "Perforation",
    "wvjobtubing": "Tubing String",
    "wvrod": "Rod String",
    "wvproblem": "Problem",
    "wvproblemcomment": "Problem Comment",
    "wvtyp": "Type",
}

COLUMN_LABELS: dict[str, str] = {
    "wellida": "Well ID",
    "wellidb": "Well ID (alt)",
    "wellname": "Well Name",
    "wellcommon": "Well (common name)",
    "padname": "Pad",
    "fieldname": "Field",
    "county": "County",
    "state": "State / Province",
    "country": "Country",
    "operator": "Operator",
    "contractor": "Contractor",
    "rigname": "Rig",
    "rignumber": "Rig Number",
    "latitude": "Latitude",
    "longitude": "Longitude",
    "elevgl": "Ground Elevation",
    "elevkb": "KB Elevation",
    "elevdf": "Drill Floor Elevation",
    "dttmspud": "Spud Date/Time",
    "dttmstart": "Start Date/Time",
    "dttmend": "End Date/Time",
    "dttmrelease": "Rig Release Date/Time",
    "reportno": "Report #",
    "reportnocalc": "Report #",
    "daysfromspudcalc": "Days From Spud",
    "afenumbercalc": "AFE Number",
    "afetotalcalc": "AFE Total",
    "costtotalcalc": "Daily Cost Total",
    "costtodatecalc": "Cost To Date",
    "costmudaddcalc": "Mud Cost (daily)",
    "costmudaddtodatecalc": "Mud Cost To Date",
    "depthstartdpcalc": "Depth Start (MD)",
    "depthenddpcalc": "Depth End (MD)",
    "depthtvdstartdpcalc": "Depth Start (TVD)",
    "depthtvdenddpcalc": "Depth End (TVD)",
    "targetform": "Target Formation",
    "targetdepth": "Target Depth",
    "durationtimelogtotalcalc": "Time Log Total (hr)",
    "durationproblemtimecalc": "Problem Time (hr)",
    "pctproblemtimecalc": "Problem Time (%)",
    "pctproblemtimecumcalc": "Problem Time Cum (%)",
    "durationpersonneltotcalc": "Personnel Hours",
    "durpersonneltotcumcalc": "Personnel Hours Cum",
    "durationsinceltinc": "Days Since LTI",
    "durationsincerptinc": "Days Since Recordable",
    "des": "Description",
    "note": "Note",
    "com": "Comment",
    "code1": "Code 1",
    "code2": "Code 2",
    "vendor": "Vendor",
    "pono": "PO Number",
    "ticketno": "Ticket Number",
    "sn": "Serial Number",
    "cost": "Cost",
    "syscarryfwdp": "Carry Forward",
    "ropcalc": "ROP",
    "rpmstring": "String RPM",
    "wob": "Weight On Bit",
    "spp": "Standpipe Pressure",
    "flowrate": "Flow Rate",
    "torque": "Torque",
    "size": "Size",
    "od": "OD",
    "id": "ID",
    "grade": "Grade",
    "weight": "Weight",
    "length": "Length",
    "depthtop": "Top Depth",
    "depthbtm": "Bottom Depth",
    "depthmd": "Depth (MD)",
    "depthtvd": "Depth (TVD)",
    "inc": "Inclination",
    "azm": "Azimuth",
    "dls": "Dogleg Severity",
    "mudtype": "Mud Type",
    "mudwt": "Mud Weight",
    "vis": "Funnel Viscosity",
    "pv": "Plastic Viscosity",
    "yp": "Yield Point",
    "ph": "pH",
    "chlorides": "Chlorides",
    "solids": "Solids",
    "watercut": "Water Cut",
    "activity": "Activity",
    "phase": "Phase",
    "company": "Company",
    "name": "Name",
    "title": "Title",
    "typ": "Type",
    "status": "Status",
    "idrecjobcontact": "Contact Record",
    "idrec": "Record ID",
    "idwell": "Well Record",
}

TOKENS = [
    ("dttm", "Date/Time"), ("depthtvd", "Depth TVD"), ("depthmd", "Depth MD"),
    ("depth", "Depth"), ("duration", "Duration"), ("dur", "Duration"),
    ("pct", "%"), ("num", "Number"), ("no", "Number"), ("qty", "Quantity"),
    ("desc", "Description"), ("des", "Description"), ("tot", "Total"),
    ("cum", "Cumulative"), ("avg", "Average"), ("max", "Max"), ("min", "Min"),
    ("est", "Estimate"), ("act", "Actual"), ("dp", "Drill Pipe"),
]


def table_label(table: str) -> str:
    if table in TABLE_LABELS:
        return TABLE_LABELS[table]
    return re.sub(r"^wv", "", table).replace("_", " ").title()


def column_label(column: str) -> str:
    c = column.lower()
    if c in COLUMN_LABELS:
        return COLUMN_LABELS[c]

    suffix = ""
    if c.endswith("calc"):
        c, suffix = c[:-4], " (computed)"
    if c.endswith("cum"):
        c, suffix = c[:-3], " (cumulative)" + suffix
    if c in COLUMN_LABELS:
        return COLUMN_LABELS[c] + suffix

    words: list[str] = []
    rest = c
    while rest:
        for tok, label in TOKENS:
            if rest.startswith(tok) and len(rest) > len(tok):
                words.append(label)
                rest = rest[len(tok):]
                break
        else:
            words.append(rest)
            rest = ""
    text = " ".join(w if w[:1].isupper() else w.title() for w in words if w)
    return (text or column.title()) + suffix


def field_label(qualified: str) -> str:
    """`wvwellheader.wellida` -> `Well ID`. Interpreted, never extracted."""
    table, _, column = qualified.partition(".")
    return column_label(column)
