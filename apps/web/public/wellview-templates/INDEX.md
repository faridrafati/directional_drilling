# WellView report templates — extracted inventory

Parsed **181** of **182** `.afr` templates under `reports single/`, in the order WellView lists them (`templateorder.pce`). Folders mirror WellView's own report categories — 31 report names are reused across categories, so a flat layout would overwrite them.

Block and field structure is **extracted** from the binary. Field labels are **interpreted** from WellView naming conventions — the captions themselves live in WellView's data dictionary, not in these files.

## Files that did not parse

- `reports single/Drilling/Drilling Summary/Depth vs Cost Graph.afr` — unsupported format version 2.0 (this parser reads v3.0 only)

## Asset History

### External Reporting

- **HTML:** [Asset History/External Reporting.html](Asset%20History/External%20Reporting.html)
- **Paper:** letter · **margins** [25, 25, 25, 25] (1/100 in)
- **Master template:** template portrait.afr
- **Root table:** `wvextreportdetail`
- **Blocks:** 3

  - **Extreport** — `wvextreport` (5 fields)
    - `wvextreport.typ1` (w=10) → _Typ1_
    - `wvextreport.typ2` (w=10) → _Typ2_
    - `wvextreport.des` (w=10) → _Description_
    - `wvextreport.requiredby` (w=10) → _Requiredby_
    - `wvextreport.com` (w=20) → _Comment_
  - **Extreportdetail** — `wvextreportdetail` (4 fields)
    - `wvextreportdetail.dttm` (w=10) → _Dttm_
    - `wvextreportdetail.reportbyname` (w=10) → _Reportbyname_
    - `wvextreportdetail.reportbycompany` (w=10) → _Reportbycompany_
    - `wvextreportdetail.status` (w=10) → _Status_
  - **Extreportdetailchecklist** — `wvextreportdetailchecklist` (7 fields)
    - `wvextreportdetailchecklist.typ1` (w=10) → _Typ1_
    - `wvextreportdetailchecklist.typ2` (w=10) → _Typ2_
    - `wvextreportdetailchecklist.des` (w=10) → _Description_
    - `wvextreportdetailchecklist.value` (w=10) → _Value_
    - `wvextreportdetailchecklist.valueunit` (w=10) → _Valueunit_
    - `wvextreportdetailchecklist.refno` (w=10) → _Refno_
    - `wvextreportdetailchecklist.actionrqd` (w=5) → _Actual Ionrqd_

### Identifier Alias History

- **HTML:** [Asset History/Identifier Alias History.html](Asset%20History/Identifier%20Alias%20History.html)
- **Paper:** letter · **margins** [25, 25, 25, 25] (1/100 in)
- **Master template:** template portrait.afr
- **Root table:** `wvwellheader`
- **Blocks:** 5

  - **Well Header Alias History** — `wvwellalias` (8 fields)
    - `wvwellalias.dttmstart` (w=10) → _Start Date/Time_
    - `wvwellalias.dttmend` (w=10) → _End Date/Time_
    - `wvwellalias.typ1` (w=10) → _Typ1_
    - `wvwellalias.typ2` (w=10) → _Typ2_
    - `wvwellalias.changetyp` (w=10) → _Changetyp_
    - `wvwellalias.value` (w=10) → _Value_
    - `wvwellalias.source` (w=10) → _Source_
    - `wvwellalias.com` (w=20) → _Comment_
  - **Wellbore** — `wvwellbore` (4 fields)
    - `wvwellbore.des` (w=10) → _Description_
    - `wvwellbore.idrecparent` (w=10) → _Idrecparent_
    - `wvwellbore.wellboreida` (w=10) → _Wellboreida_
    - `wvwellbore.profiletyp` (w=10) → _Profiletyp_
  - **Wellborealias** — `wvwellborealias` (8 fields)
    - `wvwellborealias.dttmstart` (w=10) → _Start Date/Time_
    - `wvwellborealias.dttmend` (w=10) → _End Date/Time_
    - `wvwellborealias.typ1` (w=10) → _Typ1_
    - `wvwellborealias.typ2` (w=10) → _Typ2_
    - `wvwellborealias.changetyp` (w=10) → _Changetyp_
    - `wvwellborealias.value` (w=10) → _Value_
    - `wvwellborealias.source` (w=10) → _Source_
    - `wvwellborealias.com` (w=20) → _Comment_
  - **Zone** — `wvzone` (6 fields)
    - `wvzone.zonename` (w=10) → _Zonename_
    - `wvzone.zonecode` (w=10) → _Zonecode_
    - `wvzone.idrecwellbore` (w=10) → _Idrecwellbore_
    - `wvzone.depthtop` (w=10) → _Top Depth_
    - `wvzone.depthbtm` (w=10) → _Bottom Depth_
    - `wvzone.zoneida` (w=10) → _Zoneida_
  - **Zonealias** — `wvzonealias` (8 fields)
    - `wvzonealias.dttmstart` (w=10) → _Start Date/Time_
    - `wvzonealias.dttmend` (w=10) → _End Date/Time_
    - `wvzonealias.typ1` (w=10) → _Typ1_
    - `wvzonealias.typ2` (w=10) → _Typ2_
    - `wvzonealias.changetyp` (w=10) → _Changetyp_
    - `wvzonealias.value` (w=10) → _Value_
    - `wvzonealias.source` (w=10) → _Source_
    - `wvzonealias.com` (w=20) → _Comment_

### Legal Status

- **HTML:** [Asset History/Legal Status.html](Asset%20History/Legal%20Status.html)
- **Paper:** letter · **margins** [25, 25, 25, 25] (1/100 in)
- **Master template:** template portrait.afr
- **Root table:** `None`
- **Blocks:** 1

  - **Legalstatus** — `wvlegalstatus` (9 fields)
    - `wvlegalstatus.typ1` (w=15) → _Typ1_
    - `wvlegalstatus.typ2` (w=15) → _Typ2_
    - `wvlegalstatus.des` (w=15) → _Description_
    - `wvlegalstatus.dttmstart` (w=10) → _Start Date/Time_
    - `wvlegalstatus.dttmend` (w=10) → _End Date/Time_
    - `wvlegalstatus.refno` (w=15) → _Refno_
    - `wvlegalstatus.contactname` (w=15) → _Contactname_
    - `wvlegalstatus.status` (w=15) → _Status_
    - `wvlegalstatus.com` (w=50) → _Comment_

### Operator History

- **HTML:** [Asset History/Operator History.html](Asset%20History/Operator%20History.html)
- **Paper:** letter · **margins** [25, 25, 25, 25] (1/100 in)
- **Master template:** template portrait.afr
- **Root table:** `None`
- **Blocks:** 1

  - **Operatorhistory** — `wvoperatorhistory` (7 fields)
    - `wvoperatorhistory.operator` (w=10) → _Operator_
    - `wvoperatorhistory.operatorcode` (w=10) → _Operatorcode_
    - `wvoperatorhistory.changetyp1` (w=10) → _Changetyp1_
    - `wvoperatorhistory.changetyp2` (w=10) → _Changetyp2_
    - `wvoperatorhistory.dttmstart` (w=10) → _Start Date/Time_
    - `wvoperatorhistory.dttmend` (w=10) → _End Date/Time_
    - `wvoperatorhistory.source` (w=10) → _Source_

### Responsible Teams

- **HTML:** [Asset History/Responsible Teams.html](Asset%20History/Responsible%20Teams.html)
- **Paper:** letter · **margins** [25, 25, 25, 25] (1/100 in)
- **Master template:** template portrait.afr
- **Root table:** `None`
- **Blocks:** 1

  - **Responsibleteam** — `wvresponsibleteam` (9 fields)
    - `wvresponsibleteam.typ` (w=10) → _Type_
    - `wvresponsibleteam.company` (w=10) → _Company_
    - `wvresponsibleteam.contactname` (w=10) → _Contactname_
    - `wvresponsibleteam.title` (w=10) → _Title_
    - `wvresponsibleteam.department` (w=10) → _Department_
    - `wvresponsibleteam.phoneoffice` (w=5) → _Phoneoffice_
    - `wvresponsibleteam.phonemobile` (w=5) → _Phonemobile_
    - `wvresponsibleteam.email` (w=10) → _Email_
    - `wvresponsibleteam.com` (w=25) → _Comment_

### Working Interest History

- **HTML:** [Asset History/Working Interest History.html](Asset%20History/Working%20Interest%20History.html)
- **Paper:** letter · **margins** [25, 25, 25, 25] (1/100 in)
- **Master template:** template landscape.afr
- **Root table:** `wvwellheader`
- **Blocks:** 1

  - **Workingint** — `wvworkingint` (7 fields)
    - `wvworkingint.typ1` (w=10) → _Typ1_
    - `wvworkingint.typ2` (w=10) → _Typ2_
    - `wvworkingint.des` (w=10) → _Description_
    - `wvworkingint.refno` (w=10) → _Refno_
    - `wvworkingint.dttmstart` (w=10) → _Start Date/Time_
    - `wvworkingint.dttmend` (w=10) → _End Date/Time_
    - `wvworkingint.com` (w=50) → _Comment_

### Working Interest, Partner and Data Obligation Details

- **HTML:** [Asset History/Working Interest, Partner and Data Obligation Details.html](Asset%20History/Working%20Interest%2C%20Partner%20and%20Data%20Obligation%20Details.html)
- **Paper:** letter · **margins** [25, 25, 25, 25] (1/100 in)
- **Master template:** template portrait.afr
- **Root table:** `wvworkingint`
- **Blocks:** 5

  - **Workingint** — `wvworkingint` (7 fields)
    - `wvworkingint.typ1` (w=10) → _Typ1_
    - `wvworkingint.typ2` (w=10) → _Typ2_
    - `wvworkingint.des` (w=10) → _Description_
    - `wvworkingint.refno` (w=10) → _Refno_
    - `wvworkingint.dttmstart` (w=10) → _Start Date/Time_
    - `wvworkingint.dttmend` (w=10) → _End Date/Time_
    - `wvworkingint.com` (w=50) → _Comment_
  - **Workingintpartner** — `wvworkingintpartner` (8 fields)
    - `wvworkingintpartner.partnername` (w=10) → _Partnername_
    - `wvworkingintpartner.partnercode` (w=10) → _Partnercode_
    - `wvworkingintpartner.interesttyp1` (w=10) → _Interesttyp1_
    - `wvworkingintpartner.interesttyp2` (w=10) → _Interesttyp2_
    - `wvworkingintpartner.des` (w=10) → _Description_
    - `wvworkingintpartner.interest` (w=10) → _Interest_
    - `wvworkingintpartner.status` (w=10) → _Status_
    - `wvworkingintpartner.com` (w=20) → _Comment_
  - **Workingintpartnercontact** — `wvworkingintpartnercontact` (5 fields)
    - `wvworkingintpartnercontact.contactname` (w=25) → _Contactname_
    - `wvworkingintpartnercontact.title` (w=10) → _Title_
    - `wvworkingintpartnercontact.phoneoffice` (w=10) → _Phoneoffice_
    - `wvworkingintpartnercontact.phonemobile` (w=10) → _Phonemobile_
    - `wvworkingintpartnercontact.email` (w=10) → _Email_
  - **Workingintpartnerdataobl** — `wvworkingintpartnerdataobl` (6 fields)
    - `wvworkingintpartnerdataobl.typ1` (w=10) → _Typ1_
    - `wvworkingintpartnerdataobl.typ2` (w=10) → _Typ2_
    - `wvworkingintpartnerdataobl.des` (w=10) → _Description_
    - `wvworkingintpartnerdataobl.dttmstatus` (w=10) → _Date/Time Status_
    - `wvworkingintpartnerdataobl.status` (w=10) → _Status_
    - `wvworkingintpartnerdataobl.com` (w=25) → _Comment_
  - **Workingintlink** — `wvworkingintlink` (2 fields)
    - `wvworkingintlink.idrecitem` (w=15) → _Idrecitem_
    - `wvworkingintlink.note` (w=35) → _Note_

### Zone History

- **HTML:** [Asset History/Zone History.html](Asset%20History/Zone%20History.html)
- **Paper:** letter · **margins** [25, 25, 25, 25] (1/100 in)
- **Master template:** template portrait header cw.afr
- **Root table:** `wvzone`
- **Blocks:** 5

  - **Zone** — `wvzone` (6 fields)
    - `wvzone.zonename` (w=15) → _Zonename_
    - `wvzone.depthtop` (w=9) → _Top Depth_
    - `wvzone.depthbtm` (w=9) → _Bottom Depth_
    - `wvzone.commingled` (w=8) → _Commingled_
    - `wvzone.currentstatuscalc` (w=10) → _Currentstatus (computed)_
    - `wvzone.dttmstatuscalc` (w=10) → _Date/Time Status (computed)_
  - **Zonestatus** — `wvzonestatus` (6 fields)
    - `wvzonestatus.dttm` (w=8) → _Dttm_
    - `wvzonestatus.status` (w=10) → _Status_
    - `wvzonestatus.typ` (w=15) → _Type_
    - `wvzonestatus.fluiddes` (w=10) → _Fluiddes_
    - `wvzonestatus.methodprod` (w=10) → _Methodprod_
    - `wvzonestatus.com` (w=30) → _Comment_
  - **Zonecommingle** — `wvzonecommingle` (4 fields)
    - `wvzonecommingle.idreczone` (w=10) → _Idreczone_
    - `wvzonecommingle.dttmstart` (w=10) → _Start Date/Time_
    - `wvzonecommingle.dttmend` (w=10) → _End Date/Time_
    - `wvzonecommingle.note` (w=10) → _Note_
  - **Zonelink** — `wvzonelink` (4 fields)
    - `wvzonelink.idrecitem` (w=10) → _Idrecitem_
    - `wvzonelink.dttmstart` (w=10) → _Start Date/Time_
    - `wvzonelink.dttmend` (w=10) → _End Date/Time_
    - `wvzonelink.note` (w=10) → _Note_
  - **Zonealias** — `wvzonealias` (7 fields)
    - `wvzonealias.dttmstart` (w=10) → _Start Date/Time_
    - `wvzonealias.dttmend` (w=10) → _End Date/Time_
    - `wvzonealias.typ1` (w=10) → _Typ1_
    - `wvzonealias.typ2` (w=10) → _Typ2_
    - `wvzonealias.changetyp` (w=10) → _Changetyp_
    - `wvzonealias.value` (w=10) → _Value_
    - `wvzonealias.source` (w=10) → _Source_

## Completion/Job Setup

### Job Setup

- **HTML:** [Completion/Job Setup/Job Setup.html](Completion/Job%20Setup/Job%20Setup.html)
- **Paper:** letter · **margins** [25, 25, 25, 25] (1/100 in)
- **Master template:** template portrait header cw.afr
- **Root table:** `wvjob` · **filter:** wvjob / wvtyp / dril
- **Blocks:** 3

  - **Job** — `wvjob` (9 fields)
    - `wvjob.wvtyp` (w=10) → _Wvtyp_
    - `wvjob.jobtyp` (w=10) → _Jobtyp_
    - `wvjob.jobsubtyp` (w=10) → _Jobsubtyp_
    - `wvjob.status1` (w=10) → _Status1_
    - `wvjob.afenumbercalc` (w=10) → _AFE Number_
    - `wvjob.dttmstart` (w=10) → _Start Date/Time_
    - `wvjob.dttmend` (w=10) → _End Date/Time_
    - `wvjob.afetotalcalc` (w=10) → _AFE Total_
    - `wvjob.objective` (w=30) → _Objective_
  - **Jobcontact** — `wvjobcontact` (6 fields)
    - `wvjobcontact.company` (w=10) → _Company_
    - `wvjobcontact.contactname` (w=10) → _Contactname_
    - `wvjobcontact.title` (w=10) → _Title_
    - `wvjobcontact.phonemobile` (w=10) → _Phonemobile_
    - `wvjobcontact.phoneoffice` (w=10) → _Phoneoffice_
    - `wvjobcontact.email` (w=10) → _Email_
  - **Rig** — `wvjobrig` (6 fields)
    - `wvjobrig.contractor` (w=10) → _Contractor_
    - `wvjobrig.rigno` (w=5) → _Rigno_
    - `wvjobrig.typ1` (w=10) → _Typ1_
    - `wvjobrig.typ2` (w=10) → _Typ2_
    - `wvjobrig.dttmstart` (w=10) → _Start Date/Time_
    - `wvjobrig.idrecjobcontactcontractor` (w=10) → _Idrecjobcontactcontractor_

### AFE

- **HTML:** [Completion/Job Setup/AFE.html](Completion/Job%20Setup/AFE.html)
- **Paper:** letter · **margins** [25, 25, 25, 25] (1/100 in)
- **Master template:** template portrait header.afr
- **Root table:** `wvjob` · **filter:** wvjob / wvtyp / drill
- **Blocks:** 3

  - **Job** — `wvjob` (6 fields)
    - `wvjob.wvtyp` (w=9) → _Wvtyp_
    - `wvjob.jobtyp` (w=9) → _Jobtyp_
    - `wvjob.jobsubtyp` (w=9) → _Jobsubtyp_
    - `wvjob.dttmstart` (w=9) → _Start Date/Time_
    - `wvjob.dttmend` (w=9) → _End Date/Time_
    - `wvjob.objective` (w=30) → _Objective_
  - **AFE** — `wvjobafe` (8 fields)
    - `wvjobafe.afenumber` (w=10) → _Afenumber_
    - `wvjobafe.dttmafe` (w=10) → _Date/Time Afe_
    - `wvjobafe.typ` (w=10) → _Type_
    - `wvjobafe.afenumbersupp` (w=10) → _Afenumbersupp_
    - `wvjobafe.afetotalcalc` (w=10) → _AFE Total_
    - `wvjobafe.afeamtcalc` (w=10) → _Afeamt (computed)_
    - `wvjobafe.afesupamtcalc` (w=10) → _Afesupamt (computed)_
    - `wvjobafe.afestatus` (w=10) → _Afestatus_
  - **Jobafecost** — `wvjobafecost` (6 fields)
    - `wvjobafecost.des` (w=25) → _Description_
    - `wvjobafecost.code1` (w=10) → _Code 1_
    - `wvjobafecost.code2` (w=10) → _Code 2_
    - `wvjobafecost.amount` (w=10) → _Amount_
    - `wvjobafecost.amountsuppdttm` (w=10) → _Amountsuppdttm_
    - `wvjobafecost.amountsupp` (w=10) → _Amountsupp_

### Tasks

- **HTML:** [Completion/Job Setup/Tasks.html](Completion/Job%20Setup/Tasks.html)
- **Paper:** letter · **margins** [12, 12, 31, 25] (1/100 in)
- **Master template:** template landscape.afr
- **Root table:** `wvtask`
- **Blocks:** 3

  - **Well Header** — `wvwellheader` (10 fields)
    - `wvwellheader.wellida` (w=7) → _Well ID_
    - `wvwellheader.legalsurveyloc` (w=7) → _Legalsurveyloc_
    - `wvwellheader.fieldname` (w=7) → _Field_
    - `wvwellheader.welllicenseno` (w=7) → _Welllicenseno_
    - `wvwellheader.stateprov` (w=7) → _Stateprov_
    - `wvwellheader.elvorigkb` (w=7) → _Elvorigkb_
    - `wvwellheader.elvground` (w=7) → _Elvground_
    - `wvwellheader.kbtogrdcalc` (w=7) → _Kbtogrd (computed)_
    - `wvwellheader.dttmspud` (w=7) → _Spud Date/Time_
    - `wvwellheader.dttmrr` (w=7) → _Date/Time Rr_
  - **Task** — `wvtask` (8 fields)
    - `wvtask.typ1` (w=10) → _Typ1_
    - `wvtask.typ2` (w=10) → _Typ2_
    - `wvtask.des` (w=10) → _Description_
    - `wvtask.com` (w=10) → _Comment_
    - `wvtask.dttmstartrecur` (w=10) → _Date/Time Startrecur_
    - `wvtask.dttmendrecur` (w=10) → _Date/Time Endrecur_
    - `wvtask.recurfrequency` (w=10) → _Recurfrequency_
    - `wvtask.recurnote` (w=10) → _Recurnote_
  - **Taskdetail** — `wvtaskdetail` (9 fields)
    - `wvtaskdetail.des` (w=15) → _Description_
    - `wvtaskdetail.typ1` (w=10) → _Typ1_
    - `wvtaskdetail.priority` (w=10) → _Priority_
    - `wvtaskdetail.status` (w=10) → _Status_
    - `wvtaskdetail.dttmrequest` (w=8) → _Date/Time Request_
    - `wvtaskdetail.dttmactionrqd` (w=8) → _Date/Time Actual Ionrqd_
    - `wvtaskdetail.dttmassigned` (w=8) → _Date/Time Assigned_
    - `wvtaskdetail.dttmcomplete` (w=8) → _Date/Time Complete_
    - `wvtaskdetail.actioncomplete` (w=5) → _Actual Ioncomplete_

### Zones

- **HTML:** [Completion/Job Setup/Zones.html](Completion/Job%20Setup/Zones.html)
- **Paper:** letter · **margins** [25, 25, 25, 25] (1/100 in)
- **Master template:** template portrait header cw.afr
- **Root table:** `wvwellheader`
- **Blocks:** 3

  - **Zone** — `wvzone` (6 fields)
    - `wvzone.zonename` (w=15) → _Zonename_
    - `wvzone.depthtop` (w=9) → _Top Depth_
    - `wvzone.depthbtm` (w=9) → _Bottom Depth_
    - `wvzone.commingled` (w=5) → _Commingled_
    - `wvzone.currentstatuscalc` (w=10) → _Currentstatus (computed)_
    - `wvzone.dttmstatuscalc` (w=10) → _Date/Time Status (computed)_
  - **Zonestatus** — `wvzonestatus` (6 fields)
    - `wvzonestatus.dttm` (w=8) → _Dttm_
    - `wvzonestatus.status` (w=10) → _Status_
    - `wvzonestatus.typ` (w=15) → _Type_
    - `wvzonestatus.fluiddes` (w=10) → _Fluiddes_
    - `wvzonestatus.methodprod` (w=10) → _Methodprod_
    - `wvzonestatus.com` (w=30) → _Comment_
  - **Zonecommingle** — `wvzonecommingle` (4 fields)
    - `wvzonecommingle.idreczone` (w=10) → _Idreczone_
    - `wvzonecommingle.dttmstart` (w=10) → _Start Date/Time_
    - `wvzonecommingle.dttmend` (w=10) → _End Date/Time_
    - `wvzonecommingle.note` (w=10) → _Note_

### New Well Setup

- **HTML:** [Completion/Job Setup/New Well Setup.html](Completion/Job%20Setup/New%20Well%20Setup.html)
- **Paper:** letter · **margins** [25, 0, 25, 25] (1/100 in)
- **Master template:** template portrait.afr
- **Root table:** `wvperforationstatus`
- **Captions:**
  - `<wvcas.des>`
  - `<wvcement.idrecstring>`
- **Blocks:** 19

  - **group list** — `wvwellheader` (9 fields)
    - `wvwellheader.wellname` (w=10) → _Well Name_
    - `wvwellheader.wellida` (w=10) → _Well ID_
    - `wvwellheader.elvorigkb` (w=10) → _Elvorigkb_
    - `wvwellheader.elvground` (w=10) → _Elvground_
    - `wvwellheader.dttmspud` (w=5) → _Spud Date/Time_
    - `wvwellheader.dttmrr` (w=5) → _Date/Time Rr_
    - `wvwellheader.legalsurveyloc` (w=10) → _Legalsurveyloc_
    - `wvwellheader.latitude` (w=5) → _Latitude_
    - `wvwellheader.longitude` (w=5) → _Longitude_
  - **Wellbore Sections Setup** — `wvwellbore` (3 fields)
    - `wvwellbore.des` (w=20) → _Description_
    - `wvwellbore.kickoffdepth` (w=10) → _Kickoffdepth_
    - `wvwellbore.vsdir` (w=10) → _Vsdir_
  - **Wellboresize** — `wvwellboresize` (4 fields)
    - `wvwellboresize.des` (w=10) → _Description_
    - `wvwellboresize.sz` (w=10) → _Sz_
    - `wvwellboresize.depthtopactual` (w=5) → _Depth Topactual_
    - `wvwellboresize.depthbtmactual` (w=5) → _Depth Btmactual_
  - **Wellborepbtd** — `wvwellborepbtd` (4 fields)
    - `wvwellborepbtd.dttm` (w=10) → _Dttm_
    - `wvwellborepbtd.depth` (w=10) → _Depth_
    - `wvwellborepbtd.measmeth` (w=20) → _Measmeth_
    - `wvwellborepbtd.com` (w=30) → _Comment_
  - **Casing Data** — `wvcas` (3 fields)
    - `wvcas.des` (w=20) → _Description_
    - `wvcas.dttmrun` (w=10) → _Date/Time Run_
    - `wvcas.depthbtm` (w=10) → _Bottom Depth_
  - **Cascomp** — `wvcascomp` (5 fields)
    - `wvcascomp.des` (w=10) → _Description_
    - `wvcascomp.szodnom` (w=10) → _Szodnom_
    - `wvcascomp.wtperlength` (w=8) → _Wtperlength_
    - `wvcascomp.grade` (w=7) → _Grade_
    - `wvcascomp.length` (w=10) → _Length_
  - **Cement Data** — `wvcement` (4 fields)
    - `wvcement.des` (w=25) → _Description_
    - `wvcement.idrecstring` (w=20) → _Idrecstring_
    - `wvcement.idrecwellbore` (w=15) → _Idrecwellbore_
    - `wvcement.cementtyp` (w=15) → _Cementtyp_
  - **Cementstage** — `wvcementstage` (5 fields)
    - `wvcementstage.stagenum` (w=10) → _Stagenum_
    - `wvcementstage.des` (w=40) → _Description_
    - `wvcementstage.depthtop` (w=10) → _Top Depth_
    - `wvcementstage.depthbtm` (w=10) → _Bottom Depth_
    - `wvcementstage.fullreturn` (w=10) → _Fullreturn_
  - **Cementstagefluid** — `wvcementstagefluid` (4 fields)
    - `wvcementstagefluid.typ` (w=10) → _Type_
    - `wvcementstagefluid.desfluid` (w=10) → _Description Fluid_
    - `wvcementstagefluid.amtcement` (w=5) → _Amtcement_
    - `wvcementstagefluid.cmtclass` (w=5) → _Cmtclass_
  - **Tubing Data** — `wvtub` (3 fields)
    - `wvtub.des` (w=25) → _Description_
    - `wvtub.dttmrun` (w=10) → _Date/Time Run_
    - `wvtub.depthbtm` (w=9) → _Bottom Depth_
  - **Tubcomp** — `wvtubcomp` (4 fields)
    - `wvtubcomp.des` (w=10) → _Description_
    - `wvtubcomp.szodnom` (w=10) → _Szodnom_
    - `wvtubcomp.szidnom` (w=10) → _Szidnom_
    - `wvtubcomp.length` (w=10) → _Length_
  - **Rod Data** — `wvrod` (3 fields)
    - `wvrod.des` (w=10) → _Description_
    - `wvrod.dttmrun` (w=10) → _Date/Time Run_
    - `wvrod.depthbtm` (w=10) → _Bottom Depth_
  - **Rodcomp** — `wvrodcomp` (3 fields)
    - `wvrodcomp.des` (w=10) → _Description_
    - `wvrodcomp.szodnom` (w=10) → _Szodnom_
    - `wvrodcomp.length` (w=10) → _Length_
  - **Perforation Data** — `wvperforation` (3 fields)
    - `wvperforation.typ` (w=10) → _Type_
    - `wvperforation.depthtop` (w=10) → _Top Depth_
    - `wvperforation.depthbtm` (w=10) → _Bottom Depth_
  - **Otherinhole** — `wvotherinhole` (7 fields)
    - `wvotherinhole.szodnom` (w=10) → _Szodnom_
    - `wvotherinhole.des` (w=37) → _Description_
    - `wvotherinhole.depthtop` (w=13) → _Top Depth_
    - `wvotherinhole.depthbtm` (w=13) → _Bottom Depth_
    - `wvotherinhole.szidnom` (w=10) → _Szidnom_
    - `wvotherinhole.make` (w=20) → _Make_
    - `wvotherinhole.model` (w=20) → _Model_
  - **Wellhead Description** — `wvwellhead` (5 fields)
    - `wvwellhead.dttmstart` (w=10) → _Start Date/Time_
    - `wvwellhead.typ` (w=15) → _Type_
    - `wvwellhead.make` (w=15) → _Make_
    - `wvwellhead.sz` (w=7) → _Sz_
    - `wvwellhead.workpres` (w=8) → _Workpres_
  - **Wellheadcomp** — `wvwellheadcomp` (6 fields)
    - `wvwellheadcomp.make` (w=10) → _Make_
    - `wvwellheadcomp.model` (w=10) → _Model_
    - `wvwellheadcomp.sect` (w=4) → _Sect_
    - `wvwellheadcomp.conntopsz` (w=7) → _Conntopsz_
    - `wvwellheadcomp.connbtmsz` (w=7) → _Connbtmsz_
    - `wvwellheadcomp.workpres` (w=8) → _Workpres_
  - **Depthannotation** — `wvdepthannotation` (2 fields)
    - `wvdepthannotation.depth` (w=10) → _Depth_
    - `wvdepthannotation.annotation` (w=9) → _Annotation_
  - **Note** — `wvnote` (2 fields)
    - `wvnote.dttm` (w=4) → _Dttm_
    - `wvnote.com` (w=30) → _Comment_

## Completion/Daily Input

### WELL SERVICES DAILY OPERATION REPORT

- **HTML:** [Completion/Daily Input/WELL SERVICES DAILY OPERATION REPORT.html](Completion/Daily%20Input/WELL%20SERVICES%20DAILY%20OPERATION%20REPORT.html)
- **Paper:** letter · **margins** [25, 25, 25, 25] (1/100 in)
- **Master template:** template portrait.afr
- **Root table:** `wvjobreport` · **filter:** wvjob / wvtyp / drill; wvjob / idrec; wvjobreport / idrecparent; wvjobrig / idrecparent; wvjobreport / idrecparent; wvjobreport / idrec; wvjobreport / idrec; wvlog / dttm; wvjobreport / dttmstart; wvlog / dttm; wvjobreport / dttmend; wvperforation / dttm; wvjobreport / dttmstart; wvperforation / dttm; wvjobreport / dttmend; wvstimtreat / dttm; wvjobreport / dttmstart; wvstimtreat / dttm; wvjobreport / dttmend; wvotherinhole / dttmrun; wvjobreport / dttmend; wvotherinhole / des; wvotherstrcomp / des; wvotherstrcomp / des; wvotherstrcomp / des; wvcement / dttmstart; wvjobreport / dttmstart; wvcement / dttmstart; wvjobreport / dttmend
- **Captions:**
  - `No.:  <wvjobreport.reportnocalc>`
  - `Name :   <wvwellheader.wellname>`
  - `Job:  <wvj`
- **Blocks:** 23

  - **Personel Onboard** — `wvjob` (4 fields)
    - `wvwellheader.platform` (w=10) → _Platform_
    - `wvjob.jobtyp` (w=10) → _Jobtyp_
    - `wvjob.wvtyp` (w=10) → _Wvtyp_
    - `wvjob.dttmstart` (w=10) → _Start Date/Time_
  - **Rig** — `wvjobrig` (4 fields)
    - `wvjobrig.contractor` (w=10) → _Contractor_
    - `wvjobrig.rigno` (w=10) → _Rigno_
    - `wvjobrig.typ1` (w=10) → _Typ1_
    - `wvjobrig.typ2` (w=10) → _Typ2_
  - **PCB SLINGS INFORMATION** — `wvjobrigotherequip` (4 fields)
    - `wvjobrigotherequip.des` (w=10) → _Description_
    - `wvjobrigotherequip.sn` (w=10) → _Serial Number_
    - `wvjobrigotherequip.typ1` (w=10) → _Typ1_
    - `wvjobrigotherequip.com` (w=10) → _Comment_
  - **Wellhead** — `wvwellhead` (4 fields)
    - `wvwellhead.make` (w=10) → _Make_
    - `wvwellhead.typ` (w=10) → _Type_
    - `wvwellhead.sz` (w=10) → _Sz_
    - `wvwellhead.workpres` (w=10) → _Workpres_
  - **Well Header** — `wvwellheader` (4 fields)
    - `wvwellheader.elvorigkb` (w=10) → _Elvorigkb_
    - `wvwellheader.elvground` (w=10) → _Elvground_
    - `wvwellheader.kbtogrdcalc` (w=10) → _Kbtogrd (computed)_
    - `wvwellheader.kbtotubcalc` (w=10) → _Kbtotub (computed)_
  - **Daily Report** — `wvjobreport` (8 fields)
    - `wvjobreport.costtotalcalc` (w=10) → _Daily Cost Total_
    - `wvjobreport.costtodatecalc` (w=10) → _Cost To Date_
    - `wvjobreport.durationpersonnelregcalc` (w=10) → _Duration Personnelreg (computed)_
    - `wvjobreport.durpersonneltotcumcalc` (w=10) → _Personnel Hours Cum_
    - `wvjobreport.prestub` (w=10) → _Prestub_
    - `wvjobreport.prescas` (w=10) → _Prescas_
    - `wvjobreport.usernum1` (w=10) → _Usernum1_
    - `wvjobreport.usernum2` (w=10) → _Usernum2_
  - **Report Contacts** — `wvjobreportcontacts` (4 fields)
    - `wvjobcontact.company` (w=10) → _Company_
    - `wvjobcontact.title` (w=10) → _Title_
    - `wvjobreportcontacts.idrecjobcontact` (w=10) → _Contact Record_
    - `wvjobcontact.phonemobile` (w=10) → _Phonemobile_
  - **Daily Report** — `wvjobreport` (2 fields)
    - `wvjobreport.durationsinceltinc` (w=10) → _Days Since LTI_
    - `wvjobreport.durationsincerptinc` (w=10) → _Days Since Recordable_
  - **Daily Report** — `wvjobreport` (4 fields)
    - `wvjobreport.remarks` (w=30) → _Remarks_
    - `wvjobreport.summaryops` (w=30) → _Summaryops_
    - `wvjobreport.plannextrptops` (w=30) → _Plannextrptops_
    - `wvjob.objective` (w=30) → _Objective_
  - **Time Log** — `wvjobreporttimelog` (7 fields)
    - `wvjobreporttimelog.dttmstartcalc` (w=5) → _Start Date/Time (computed)_
    - `wvjobreporttimelog.duration` (w=5) → _Duration Ation_
    - `wvjobreporttimelog.dttmendcalc` (w=5) → _End Date/Time (computed)_
    - `wvjobreporttimelog.code1` (w=8) → _Code 1_
    - `wvjobreporttimelog.code2` (w=15) → _Code 2_
    - `wvjobreporttimelog.unschedtyp` (w=10) → _Unschedtyp_
    - `wvjobreporttimelog.com` (w=50) → _Comment_
  - **Personnel Onboard** — `wvjobreportpersonnelcount` (6 fields)
    - `wvjobreportpersonnelcount.employeename` (w=10) → _Employeename_
    - `wvjobreportpersonnelcount.company` (w=10) → _Company_
    - `wvjobreportpersonnelcount.employeetyp` (w=10) → _Employeetyp_
    - `wvjobreportpersonnelcount.headcount` (w=10) → _Headcount_
    - `wvjobreportpersonnelcount.durationworkreg` (w=10) → _Duration Workreg_
    - `wvjobreportpersonnelcount.durationworktotcalc` (w=10) → _Duration Worktot (computed)_
  - **Log** — `wvlog` (5 fields)
    - `wvlog.dttm` (w=5) → _Dttm_
    - `wvlog.typ` (w=18) → _Type_
    - `wvlog.depthtop` (w=9) → _Top Depth_
    - `wvlog.depthbtm` (w=9) → _Bottom Depth_
    - `wvlog.casedhole` (w=3) → _Casedhole_
  - **Perforation** — `wvperforation` (5 fields)
    - `wvperforation.dttm` (w=5) → _Dttm_
    - `wvperforation.idreczone` (w=9) → _Idreczone_
    - `wvperforation.depthtop` (w=9) → _Top Depth_
    - `wvperforation.depthbtm` (w=9) → _Bottom Depth_
    - `wvperforation.currentstatuscalc` (w=9) → _Currentstatus (computed)_
  - **Stimtreat** — `wvstimtreat` (5 fields)
    - `wvstimtreat.dttm` (w=5) → _Dttm_
    - `wvstimtreat.idreczone` (w=9) → _Idreczone_
    - `wvstimtreat.typ` (w=9) → _Type_
    - `wvstimtreat.deliverymode` (w=9) → _Deliverymode_
    - `wvstimtreat.contractor` (w=9) → _Contractor_
  - **Stimtreatstg** — `wvstimtreatstg` (5 fields)
    - `wvstimtreatstg.stagenum` (w=4) → _Stagenum_
    - `wvstimtreatstg.stagetyp` (w=15) → _Stagetyp_
    - `wvstimtreatstg.depthtop` (w=15) → _Top Depth_
    - `wvstimtreatstg.depthbtm` (w=15) → _Bottom Depth_
    - `wvstimtreatstg.volpumped` (w=15) → _Volpumped_
  - **Running Weight** — `wvotherstr` (5 fields)
    - `wvotherstr.des` (w=10) → _Description_
    - `wvotherstr.dttmrun` (w=10) → _Date/Time Run_
    - `wvotherstr.tension` (w=10) → _Tension_
    - `wvotherstr.stringwtdown` (w=10) → _Stringwtdown_
    - `wvotherstr.stringwtrotating` (w=10) → _Stringwtrotating_
  - **Pulling Weight** — `wvotherstr` (5 fields)
    - `wvotherstr.des` (w=10) → _Description_
    - `wvotherstr.dttmpull` (w=10) → _Date/Time Pull_
    - `wvotherstr.tension` (w=10) → _Tension_
    - `wvotherstr.stringwtup` (w=10) → _Stringwtup_
    - `wvotherstr.stringwtrotating` (w=10) → _Stringwtrotating_
  - **Fish in Hole** — `wvotherinhole` (6 fields)
    - `wvotherinhole.dttmrun` (w=10) → _Date/Time Run_
    - `wvotherinhole.dttmpull` (w=10) → _Date/Time Pull_
    - `wvotherinhole.des` (w=10) → _Description_
    - `wvotherinhole.depthtop` (w=10) → _Top Depth_
    - `wvotherinhole.depthbtm` (w=10) → _Bottom Depth_
    - `wvotherinhole.szodnom` (w=10) → _Szodnom_
  - **Otherstrcomp** — `wvotherstrcomp` (7 fields)
    - `wvotherstrcomp.des` (w=10) → _Description_
    - `wvotherstrcomp.szodnom` (w=10) → _Szodnom_
    - `wvotherstrcomp.szidnom` (w=10) → _Szidnom_
    - `wvjobrig.contractor` (w=10) → _Contractor_
    - `wvjobrig.rigno` (w=10) → _Rigno_
    - `wvotherstrcomp.currentstatus` (w=10) → _Currentstatus_
    - `wvotherstrcomp.cost` (w=10) → _Cost_
  - **Coiled Tubing** — `wvotherstrcomp` (7 fields)
    - `wvotherstrcomp.des` (w=10) → _Description_
    - `wvotherstrcomp.szodnom` (w=10) → _Szodnom_
    - `wvotherstrcomp.szidnom` (w=10) → _Szidnom_
    - `wvjobrig.contractorparent` (w=10) → _Contractorparent_
    - `wvjobrig.rigno` (w=10) → _Rigno_
    - `wvotherstrcomp.cost` (w=10) → _Cost_
    - `wvotherstrcomp.currentstatus` (w=10) → _Currentstatus_
  - **Otherstrcomp** — `wvotherstrcomp` (7 fields)
    - `wvotherstrcomp.des` (w=10) → _Description_
    - `wvotherstrcomp.szodnom` (w=10) → _Szodnom_
    - `wvotherstrcomp.szidnom` (w=10) → _Szidnom_
    - `wvjobrig.contractor` (w=10) → _Contractor_
    - `wvjobrig.rigno` (w=10) → _Rigno_
    - `wvotherstrcomp.cost` (w=10) → _Cost_
    - `wvotherstrcomp.currentstatus` (w=10) → _Currentstatus_
  - **Cement** — `wvcement` (5 fields)
    - `wvcement.dttmstart` (w=10) → _Start Date/Time_
    - `wvcement.des` (w=10) → _Description_
    - `wvcement.cementtyp` (w=10) → _Cementtyp_
    - `wvcement.idrecstring` (w=10) → _Idrecstring_
    - `wvcement.contractor` (w=10) → _Contractor_
  - **Attachment** — `wvattachment` (3 fields)
    - `wvattachment.des` (w=10) → _Description_
    - `wvattachment.dttm` (w=10) → _Dttm_
    - `wvattachment.com` (w=10) → _Comment_

### Daily Costs

- **HTML:** [Completion/Daily Input/Daily Costs.html](Completion/Daily%20Input/Daily%20Costs.html)
- **Paper:** letter · **margins** [12, 12, 31, 25] (1/100 in)
- **Master template:** template landscape header cw.afr
- **Root table:** `wvjobreport` · **filter:** wvjob / wvtyp / drill
- **Captions:**
  - `Report # <wvjobreport.reportnocalc>,  Report Date: <wvjobreport.dttmstart>`
- **Blocks:** 2

  - **Daily Summary** — `wvjobreport` (6 fields)
    - `wvjob.afenumbercalc` (w=10) → _AFE Number_
    - `wvjob.afetotalcalc` (w=10) → _AFE Total_
    - `wvjobreport.dttmstart` (w=10) → _Start Date/Time_
    - `wvjobreport.dttmend` (w=10) → _End Date/Time_
    - `wvjobreport.costtotalcalc` (w=10) → _Daily Cost Total_
    - `wvjobreport.costtodatecalc` (w=10) → _Cost To Date_
  - **Daily Cost — General** — `wvjobreportcostgen` (10 fields)
    - `wvjobreportcostgen.des` (w=20) → _Description_
    - `wvjobreportcostgen.code1` (w=9) → _Code 1_
    - `wvjobreportcostgen.code2` (w=9) → _Code 2_
    - `wvjobreportcostgen.vendor` (w=20) → _Vendor_
    - `wvjobreportcostgen.pono` (w=10) → _PO Number_
    - `wvjobreportcostgen.ticketno` (w=10) → _Ticket Number_
    - `wvjobreportcostgen.sn` (w=10) → _Serial Number_
    - `wvjobreportcostgen.cost` (w=20) → _Cost_
    - `wvjobreportcostgen.note` (w=20) → _Note_
    - `wvjobreportcostgen.syscarryfwdp` (w=5) → _Carry Forward_

### Daily Fluids

- **HTML:** [Completion/Daily Input/Daily Fluids.html](Completion/Daily%20Input/Daily%20Fluids.html)
- **Paper:** letter · **margins** [12, 12, 31, 25] (1/100 in)
- **Master template:** template landscape header cw.afr
- **Root table:** `wvjobreport` · **filter:** wvjob / wvtyp / drill*; wvjob / idrec; wvjobreport / idrecparent
- **Captions:**
  - `Report # <wvjobreport.reportnocalc>,  Report Date: <wvjobreport.dttmstart>`
- **Blocks:** 4

  - **Daily Report** — `wvjobreport` (6 fields)
    - `wvjob.afenumbercalc` (w=10) → _AFE Number_
    - `wvjobreport.reportnocalc` (w=10) → _Report #_
    - `wvjobreport.dttmstart` (w=10) → _Start Date/Time_
    - `wvjobreport.dttmend` (w=10) → _End Date/Time_
    - `wvjobreport.costtotalcalc` (w=10) → _Daily Cost Total_
    - `wvjobreport.costtodatecalc` (w=10) → _Cost To Date_
  - **Jobreportfluidslease** — `wvjobreportfluidslease` (10 fields)
    - `wvjobreportfluidslease.fluidtyp` (w=10) → _Fluidtyp_
    - `wvjobreportfluidslease.tolease` (w=6) → _Tolease_
    - `wvjobreportfluidslease.source` (w=15) → _Source_
    - `wvjobreportfluidslease.fromlease` (w=6) → _Fromlease_
    - `wvjobreportfluidslease.dest` (w=15) → _Description T_
    - `wvjobreportfluidslease.density` (w=6) → _Density_
    - `wvjobreportfluidslease.bsw` (w=6) → _Bsw_
    - `wvjobreportfluidslease.refnocarrier` (w=15) → _Refnocarrier_
    - `wvjobreportfluidslease.carrier` (w=15) → _Carrier_
    - `wvjobreportfluidslease.note` (w=35) → _Note_
  - **Jobreportfluidswell** — `wvjobreportfluidswell` (8 fields)
    - `wvjobreportfluidswell.fluidtyp` (w=10) → _Fluidtyp_
    - `wvjobreportfluidswell.towell` (w=21) → _Towell_
    - `wvjobreportfluidswell.fromwell` (w=21) → _Fromwell_
    - `wvjobreportfluidswell.density` (w=6) → _Density_
    - `wvjobreportfluidswell.bsw` (w=6) → _Bsw_
    - `wvjobreportfluidswell.nonrecov` (w=15) → _Number Nrecov_
    - `wvjobreportfluidswell.idreczone` (w=15) → _Idreczone_
    - `wvjobreportfluidswell.note` (w=35) → _Note_
  - **Jrfluidscalc** — `wvjrfluidscalc` (8 fields)
    - `wvjrfluidscalc.fluidtyp` (w=10) → _Fluidtyp_
    - `wvjrfluidscalc.cumtolease` (w=10) → _Cumulative Tolease_
    - `wvjrfluidscalc.cumfromlease` (w=10) → _Cumulative Fromlease_
    - `wvjrfluidscalc.intanks` (w=10) → _Intanks_
    - `wvjrfluidscalc.cumtowell` (w=10) → _Cumulative Towell_
    - `wvjrfluidscalc.cumfromwell` (w=10) → _Cumulative Fromwell_
    - `wvjrfluidscalc.lefttorecover` (w=10) → _Lefttorecover_
    - `wvjrfluidscalc.cumnonrecov` (w=10) → _Cumulative Number Nrecov_

### Directional Plot_Plan vs Actual

- **HTML:** [Completion/Daily Input/Directional Plot_Plan vs Actual.html](Completion/Daily%20Input/Directional%20Plot_Plan%20vs%20Actual.html)
- **Paper:** letter · **margins** [12, 12, 31, 25] (1/100 in)
- **Master template:** template landscape header.afr
- **Root table:** `wvwellbore` · **filter:** wvwdsvscalc / idrecparent; wvwellbore / idrec; wvwdsvscalc / proposed; wvwellboredirsurveydata / idrecparent; wvwellbore / idrecdirsrvyprop; wvwdsvscalc / idrecparent; wvwellbore / idrec; wvwdsvscalc / proposed
- **Captions:**
  - `<wvwdsvsdatacalc.note>`
  - `<wvwellboredirsurveydata.surveymethod>`
  - `<wvwellboredirsurveydata.surveymethod>`
- **Blocks:** 4

  - **Vertical Section** — `wvwdsvsdatacalc` (1 fields)
    - `wvwdsvsdatacalc.tvd` (w=0) → _Tvd_
  - **Wellboredirsurveydata** — `wvwellboredirsurveydata` (1 fields)
    - `wvwellboredirsurveydata.tvdcalc` (w=0) → _Tvd (computed)_
  - **Wdsvsdatacalc** — `wvwdsvsdatacalc` (1 fields)
    - `wvwdsvsdatacalc.ns` (w=0) → _Ns_
  - **Wellboredirsurveydata** — `wvwellboredirsurveydata` (1 fields)
    - `wvwellboredirsurveydata.nscalc` (w=0) → _Ns (computed)_

### Directional Survey

- **HTML:** [Completion/Daily Input/Directional Survey.html](Completion/Daily%20Input/Directional%20Survey.html)
- **Paper:** letter · **margins** [25, 25, 25, 25] (1/100 in)
- **Master template:** template portrait.afr
- **Root table:** `wvwellboredirsurvey` · **filter:** wvwellboredirsurveydata / dontuse
- **Blocks:** 3

  - **Wellbore** — `wvwellbore` (4 fields)
    - `wvwellbore.des` (w=10) → _Description_
    - `wvwellbore.idrecparent` (w=10) → _Idrecparent_
    - `wvwellbore.kickoffdepth` (w=10) → _Kickoffdepth_
    - `wvwellbore.vsdir` (w=10) → _Vsdir_
  - **Wellboredirsurvey** — `wvwellboredirsurvey` (10 fields)
    - `wvwellboredirsurvey.dttm` (w=10) → _Dttm_
    - `wvwellboredirsurvey.definitive` (w=10) → _Definitive_
    - `wvwellboredirsurvey.des` (w=10) → _Description_
    - `wvwellboredirsurvey.proposed` (w=10) → _Proposed_
    - `wvwellboredirsurvey.mdtiein` (w=10) → _Mdtiein_
    - `wvwellboredirsurvey.tvdtiein` (w=10) → _Tvdtiein_
    - `wvwellboredirsurvey.inclinationtiein` (w=10) → _Inclinationtiein_
    - `wvwellboredirsurvey.azimuthtiein` (w=10) → _Azimuthtiein_
    - `wvwellboredirsurvey.nstiein` (w=10) → _Nstiein_
    - `wvwellboredirsurvey.ewtiein` (w=10) → _Ewtiein_
  - **Survey Data** — `wvwellboredirsurveydata` (13 fields)
    - `wvwellboredirsurveydata.dttm` (w=15) → _Dttm_
    - `wvwellboredirsurveydata.md` (w=10) → _Md_
    - `wvwellboredirsurveydata.inclination` (w=10) → _Inclination_
    - `wvwellboredirsurveydata.azimuth` (w=10) → _Azimuth_
    - `wvwellboredirsurveydata.tvdcalc` (w=10) → _Tvd (computed)_
    - `wvwellboredirsurveydata.vscalc` (w=10) → _Vs (computed)_
    - `wvwellboredirsurveydata.nscalc` (w=10) → _Ns (computed)_
    - `wvwellboredirsurveydata.ewcalc` (w=10) → _Ew (computed)_
    - `wvwellboredirsurveydata.dlscalc` (w=10) → _Dogleg Severity (computed)_
    - `wvwellboredirsurveydata.buildratecalc` (w=10) → _Buildrate (computed)_
    - `wvwellboredirsurveydata.turnratecalc` (w=10) → _Turnrate (computed)_
    - `wvwellboredirsurveydata.displaceunwrapcalc` (w=10) → _Displaceunwrap (computed)_
    - `wvwellboredirsurveydata.surveymethod` (w=10) → _Surveymethod_

### Daily Completion and Workover (schematic)

- **HTML:** [Completion/Daily Input/Daily Completion and Workover (schematic).html](Completion/Daily%20Input/Daily%20Completion%20and%20Workover%20%28schematic%29.html)
- **Paper:** letter · **margins** [25, 25, 25, 25] (1/100 in)
- **Master template:** template portrait header cw.afr
- **Root table:** `wvjobreport` · **filter:** wvjob / wvtyp / drill*; wvjobrig / idrecparent; wvjobreport / idrecparent; wvjrfluidscalc / idrecjob; wvjobreport / idrecparent; wvjobreport / idrec; wvjobreport / idrec; wvjobsafetychk / dttm; wvjobreport / dttmend; wvjobsafetychk / dttm; wvjobreport / dttmstart; wvjobsafetychk / idrecparent; wvjobreport / idrecparent; wvjob / idrec; wvjobreport / idrecparent; wvlog / dttm; wvjobreport / dttmstart; wvlog / dttm; wvjobreport / dttmend; wvperforation / dttm; wvjobreport / dttmstart; wvperforation / dttm; wvjobreport / dttmend; wvstimtreat / dttm; wvjobreport / dttmstart; wvstimtreat / dttm; wvjobreport / dttmend; wvtub / dttmrun; wvjobreport / dttmend; wvtub / dttmrun; wvjobreport / dttmstart; wvtub / dttmpull; wvjobreport / dttmend; wvtub / dttmpull; wvjobreport / dttmstart; wvotherinhole / dttmrun; wvjobreport / dttmend; wvotherinhole / dttmrun; wvjobreport / dttmstart; wvotherinhole / dttmpull; wvjobreport / dttmend; wvotherinhole / dttmpull; wvjobreport / dttmstart; wvcement / dttmstart; wvjobreport / dttmstart; wvcement / dttmstart; wvjobreport / dttmend
- **Captions:**
  - `Report #  <wvjobreport.reportnocalc>,  Report Date:   <wvjobreport.dttmstart>`
- **Blocks:** 17

  - **& Production\Tubing and Rods SCH** — `wvjobreport` (1 fields)
    - `wvjobreport.idrecwellborecalc` (w=0) → _Idrecwellbore (computed)_
  - **Job** — `wvjob` (3 fields)
    - `wvjob.jobtyp` (w=30) → _Jobtyp_
    - `wvjob.jobsubtyp` (w=30) → _Jobsubtyp_
    - `wvjob.objective` (w=30) → _Objective_
  - **Rig** — `wvjobrig` (2 fields)
    - `wvjobrig.contractor` (w=12) → _Contractor_
    - `wvjobrig.rigno` (w=6) → _Rigno_
  - **Daily Report** — `wvjobreport` (10 fields)
    - `wvjob.afenumbercalc` (w=10) → _AFE Number_
    - `wvjob.afetotalcalc` (w=10) → _AFE Total_
    - `wvjobreport.costtotalcalc` (w=10) → _Daily Cost Total_
    - `wvjobreport.costtodatecalc` (w=10) → _Cost To Date_
    - `wvjobreport.condweather` (w=15) → _Condweather_
    - `wvjobreport.condtemp` (w=5) → _Condtemp_
    - `wvjobreport.condroad` (w=15) → _Condroad_
    - `wvjobreport.prestub` (w=8) → _Prestub_
    - `wvjobreport.prescas` (w=8) → _Prescas_
    - `wvjobreport.rigtime` (w=8) → _Rigtime_
  - **Daily Readings** — `wvjobreportcontacts` (3 fields)
    - `wvjobreportcontacts.idrecjobcontact` (w=9) → _Contact Record_
    - `wvjobcontact.title` (w=9) → _Title_
    - `wvjobcontact.phonemobile` (w=9) → _Phonemobile_
  - **Time Log** — `wvjobreporttimelog` (6 fields)
    - `wvjobreporttimelog.dttmstartcalc` (w=7) → _Start Date/Time (computed)_
    - `wvjobreporttimelog.dttmendcalc` (w=7) → _End Date/Time (computed)_
    - `wvjobreporttimelog.duration` (w=6) → _Duration Ation_
    - `wvjobreporttimelog.code1` (w=6) → _Code 1_
    - `wvjobreporttimelog.code2` (w=15) → _Code 2_
    - `wvjobreporttimelog.com` (w=50) → _Comment_
  - **Jrfluidscalc** — `wvjrfluidscalc` (5 fields)
    - `wvjrfluidscalc.fluidtyp` (w=10) → _Fluidtyp_
    - `wvjrfluidscalc.towell` (w=10) → _Towell_
    - `wvjrfluidscalc.fromwell` (w=10) → _Fromwell_
    - `wvjrfluidscalc.tolease` (w=10) → _Tolease_
    - `wvjrfluidscalc.fromlease` (w=10) → _Fromlease_
  - **Jobsafetychk** — `wvjobsafetychk` (4 fields)
    - `wvjobsafetychk.dttm` (w=6) → _Dttm_
    - `wvjobsafetychk.des` (w=25) → _Description_
    - `wvjobsafetychk.typ` (w=25) → _Type_
    - `wvjobsafetychk.com` (w=30) → _Comment_
  - **Log** — `wvlog` (5 fields)
    - `wvlog.dttm` (w=5) → _Dttm_
    - `wvlog.typ` (w=18) → _Type_
    - `wvlog.depthtop` (w=9) → _Top Depth_
    - `wvlog.depthbtm` (w=9) → _Bottom Depth_
    - `wvlog.casedhole` (w=3) → _Casedhole_
  - **Perforation** — `wvperforation` (5 fields)
    - `wvperforation.dttm` (w=5) → _Dttm_
    - `wvperforation.idreczone` (w=9) → _Idreczone_
    - `wvperforation.depthtop` (w=9) → _Top Depth_
    - `wvperforation.depthbtm` (w=9) → _Bottom Depth_
    - `wvperforation.currentstatuscalc` (w=9) → _Currentstatus (computed)_
  - **Stimtreat** — `wvstimtreat` (5 fields)
    - `wvstimtreat.dttm` (w=5) → _Dttm_
    - `wvstimtreat.idreczone` (w=15) → _Idreczone_
    - `wvstimtreat.typ` (w=10) → _Type_
    - `wvstimtreat.deliverymode` (w=10) → _Deliverymode_
    - `wvstimtreat.contractor` (w=10) → _Contractor_
  - **Stimtreatstg** — `wvstimtreatstg` (5 fields)
    - `wvstimtreatstg.stagenum` (w=4) → _Stagenum_
    - `wvstimtreatstg.stagetyp` (w=15) → _Stagetyp_
    - `wvstimtreatstg.depthtop` (w=15) → _Top Depth_
    - `wvstimtreatstg.depthbtm` (w=15) → _Bottom Depth_
    - `wvstimtreatstg.volpumped` (w=15) → _Volpumped_
  - **Tubing Run** — `wvtub` (6 fields)
    - `wvtub.dttmrun` (w=5) → _Date/Time Run_
    - `wvtub.des` (w=15) → _Description_
    - `wvtub.depthbtm` (w=10) → _Bottom Depth_
    - `wvtub.szodnommaxcalc` (w=10) → _Szodnommax (computed)_
    - `wvtub.wtperlengthcalc` (w=10) → _Wtperlength (computed)_
    - `wvtub.gradecalc` (w=10) → _Grade (computed)_
  - **Tubing Pulled** — `wvtub` (6 fields)
    - `wvtub.dttmpull` (w=5) → _Date/Time Pull_
    - `wvtub.des` (w=15) → _Description_
    - `wvtub.depthbtm` (w=10) → _Bottom Depth_
    - `wvtub.szodnommaxcalc` (w=10) → _Szodnommax (computed)_
    - `wvtub.wtperlengthcalc` (w=10) → _Wtperlength (computed)_
    - `wvtub.gradecalc` (w=10) → _Grade (computed)_
  - **Otherinhole** — `wvotherinhole` (5 fields)
    - `wvotherinhole.dttmrun` (w=5) → _Date/Time Run_
    - `wvotherinhole.des` (w=18) → _Description_
    - `wvotherinhole.szodnom` (w=9) → _Szodnom_
    - `wvotherinhole.depthtop` (w=9) → _Top Depth_
    - `wvotherinhole.depthbtm` (w=9) → _Bottom Depth_
  - **in Hole Pulled (Bridge Plugs, et** — `wvotherinhole` (5 fields)
    - `wvotherinhole.dttmpull` (w=5) → _Date/Time Pull_
    - `wvotherinhole.des` (w=18) → _Description_
    - `wvotherinhole.depthtop` (w=9) → _Top Depth_
    - `wvotherinhole.depthbtm` (w=9) → _Bottom Depth_
    - `wvotherinhole.szodnom` (w=9) → _Szodnom_
  - **Cement** — `wvcement` (5 fields)
    - `wvcement.dttmstart` (w=5) → _Start Date/Time_
    - `wvcement.des` (w=9) → _Description_
    - `wvcement.cementtyp` (w=10) → _Cementtyp_
    - `wvcement.idrecstring` (w=9) → _Idrecstring_
    - `wvcement.contractor` (w=9) → _Contractor_

### Daily Completion and Workover

- **HTML:** [Completion/Daily Input/Daily Completion and Workover.html](Completion/Daily%20Input/Daily%20Completion%20and%20Workover.html)
- **Paper:** letter · **margins** [25, 25, 25, 25] (1/100 in)
- **Master template:** template portrait header cw.afr
- **Root table:** `wvjobreport` · **filter:** wvjob / wvtyp / drill; wvjobrig / idrecparent; wvjobreport / idrecparent; wvjrfluidscalc / idrecjob; wvjobreport / idrecparent; wvjobreport / idrec; wvjobreport / idrec; wvjobsafetychk / dttm; wvjobreport / dttmend; wvjobsafetychk / dttm; wvjobreport / dttmstart; wvjobsafetychk / idrecparent; wvjobreport / idrecparent; wvjob / idrec; wvjobreport / idrecparent; wvlog / dttm; wvjobreport / dttmstart; wvlog / dttm; wvjobreport / dttmend; wvperforation / dttm; wvjobreport / dttmstart; wvperforation / dttm; wvjobreport / dttmend; wvstimtreat / dttm; wvjobreport / dttmstart; wvstimtreat / dttm; wvjobreport / dttmend; wvtub / dttmrun; wvjobreport / dttmend; wvtub / dttmrun; wvjobreport / dttmstart; wvtub / dttmpull; wvjobreport / dttmend; wvtub / dttmpull; wvjobreport / dttmstart; wvotherinhole / dttmrun; wvjobreport / dttmend; wvotherinhole / dttmrun; wvjobreport / dttmstart; wvotherinhole / dttmpull; wvjobreport / dttmend; wvotherinhole / dttmpull; wvjobreport / dttmstart; wvcement / dttmstart; wvjobreport / dttmstart; wvcement / dttmstart; wvjobreport / dttmend
- **Captions:**
  - `Report #  <wvjobreport.reportnocalc>,  Report Date:   <wvjobreport.dttmstart>`
- **Blocks:** 16

  - **Job** — `wvjob` (3 fields)
    - `wvjob.jobtyp` (w=30) → _Jobtyp_
    - `wvjob.jobsubtyp` (w=30) → _Jobsubtyp_
    - `wvjob.objective` (w=30) → _Objective_
  - **Rig** — `wvjobrig` (2 fields)
    - `wvjobrig.contractor` (w=12) → _Contractor_
    - `wvjobrig.rigno` (w=6) → _Rigno_
  - **Daily Report** — `wvjobreport` (10 fields)
    - `wvjob.afenumbercalc` (w=10) → _AFE Number_
    - `wvjob.afetotalcalc` (w=10) → _AFE Total_
    - `wvjobreport.costtotalcalc` (w=10) → _Daily Cost Total_
    - `wvjobreport.costtodatecalc` (w=10) → _Cost To Date_
    - `wvjobreport.condweather` (w=15) → _Condweather_
    - `wvjobreport.condtemp` (w=5) → _Condtemp_
    - `wvjobreport.condroad` (w=15) → _Condroad_
    - `wvjobreport.prestub` (w=8) → _Prestub_
    - `wvjobreport.prescas` (w=8) → _Prescas_
    - `wvjobreport.rigtime` (w=8) → _Rigtime_
  - **Daily Readings** — `wvjobreportcontacts` (3 fields)
    - `wvjobreportcontacts.idrecjobcontact` (w=9) → _Contact Record_
    - `wvjobcontact.title` (w=9) → _Title_
    - `wvjobcontact.phonemobile` (w=9) → _Phonemobile_
  - **Time Log** — `wvjobreporttimelog` (6 fields)
    - `wvjobreporttimelog.dttmstartcalc` (w=7) → _Start Date/Time (computed)_
    - `wvjobreporttimelog.dttmendcalc` (w=7) → _End Date/Time (computed)_
    - `wvjobreporttimelog.duration` (w=6) → _Duration Ation_
    - `wvjobreporttimelog.code1` (w=6) → _Code 1_
    - `wvjobreporttimelog.code2` (w=15) → _Code 2_
    - `wvjobreporttimelog.com` (w=50) → _Comment_
  - **Jrfluidscalc** — `wvjrfluidscalc` (5 fields)
    - `wvjrfluidscalc.fluidtyp` (w=10) → _Fluidtyp_
    - `wvjrfluidscalc.towell` (w=10) → _Towell_
    - `wvjrfluidscalc.fromwell` (w=10) → _Fromwell_
    - `wvjrfluidscalc.tolease` (w=10) → _Tolease_
    - `wvjrfluidscalc.fromlease` (w=10) → _Fromlease_
  - **Jobsafetychk** — `wvjobsafetychk` (4 fields)
    - `wvjobsafetychk.dttm` (w=6) → _Dttm_
    - `wvjobsafetychk.des` (w=25) → _Description_
    - `wvjobsafetychk.typ` (w=25) → _Type_
    - `wvjobsafetychk.com` (w=30) → _Comment_
  - **Log** — `wvlog` (5 fields)
    - `wvlog.dttm` (w=5) → _Dttm_
    - `wvlog.typ` (w=18) → _Type_
    - `wvlog.depthtop` (w=9) → _Top Depth_
    - `wvlog.depthbtm` (w=9) → _Bottom Depth_
    - `wvlog.casedhole` (w=3) → _Casedhole_
  - **Perforation** — `wvperforation` (5 fields)
    - `wvperforation.dttm` (w=5) → _Dttm_
    - `wvperforation.idreczone` (w=9) → _Idreczone_
    - `wvperforation.depthtop` (w=9) → _Top Depth_
    - `wvperforation.depthbtm` (w=9) → _Bottom Depth_
    - `wvperforation.currentstatuscalc` (w=9) → _Currentstatus (computed)_
  - **Stimtreat** — `wvstimtreat` (5 fields)
    - `wvstimtreat.dttm` (w=5) → _Dttm_
    - `wvstimtreat.idreczone` (w=15) → _Idreczone_
    - `wvstimtreat.typ` (w=10) → _Type_
    - `wvstimtreat.deliverymode` (w=10) → _Deliverymode_
    - `wvstimtreat.contractor` (w=10) → _Contractor_
  - **Stimtreatstg** — `wvstimtreatstg` (5 fields)
    - `wvstimtreatstg.stagenum` (w=4) → _Stagenum_
    - `wvstimtreatstg.stagetyp` (w=15) → _Stagetyp_
    - `wvstimtreatstg.depthtop` (w=15) → _Top Depth_
    - `wvstimtreatstg.depthbtm` (w=15) → _Bottom Depth_
    - `wvstimtreatstg.volpumped` (w=15) → _Volpumped_
  - **Tubing Run** — `wvtub` (6 fields)
    - `wvtub.dttmrun` (w=5) → _Date/Time Run_
    - `wvtub.des` (w=15) → _Description_
    - `wvtub.depthbtm` (w=10) → _Bottom Depth_
    - `wvtub.szodnommaxcalc` (w=10) → _Szodnommax (computed)_
    - `wvtub.wtperlengthcalc` (w=10) → _Wtperlength (computed)_
    - `wvtub.gradecalc` (w=10) → _Grade (computed)_
  - **Tubing Pulled** — `wvtub` (6 fields)
    - `wvtub.dttmpull` (w=5) → _Date/Time Pull_
    - `wvtub.des` (w=15) → _Description_
    - `wvtub.depthbtm` (w=10) → _Bottom Depth_
    - `wvtub.szodnommaxcalc` (w=10) → _Szodnommax (computed)_
    - `wvtub.wtperlengthcalc` (w=10) → _Wtperlength (computed)_
    - `wvtub.gradecalc` (w=10) → _Grade (computed)_
  - **Otherinhole** — `wvotherinhole` (5 fields)
    - `wvotherinhole.dttmrun` (w=5) → _Date/Time Run_
    - `wvotherinhole.des` (w=18) → _Description_
    - `wvotherinhole.szodnom` (w=9) → _Szodnom_
    - `wvotherinhole.depthtop` (w=9) → _Top Depth_
    - `wvotherinhole.depthbtm` (w=9) → _Bottom Depth_
  - **in Hole Pulled (Bridge Plugs, et** — `wvotherinhole` (5 fields)
    - `wvotherinhole.dttmpull` (w=5) → _Date/Time Pull_
    - `wvotherinhole.des` (w=18) → _Description_
    - `wvotherinhole.depthtop` (w=9) → _Top Depth_
    - `wvotherinhole.depthbtm` (w=9) → _Bottom Depth_
    - `wvotherinhole.szodnom` (w=9) → _Szodnom_
  - **Cement** — `wvcement` (5 fields)
    - `wvcement.dttmstart` (w=5) → _Start Date/Time_
    - `wvcement.des` (w=9) → _Description_
    - `wvcement.cementtyp` (w=10) → _Cementtyp_
    - `wvcement.idrecstring` (w=9) → _Idrecstring_
    - `wvcement.contractor` (w=9) → _Contractor_

### Well Schematic - Current

- **HTML:** [Completion/Daily Input/Well Schematic - Current.html](Completion/Daily%20Input/Well%20Schematic%20-%20Current.html)
- **Paper:** letter · **margins** [25, 25, 25, 25] (1/100 in)
- **Master template:** template portrait.afr
- **Root table:** `wvwellbore`
- **Captions:**
  - `TD:  <wvwellheader.tdcalc>`
- **Blocks:** 1

  - **Most Recent Job** — `wvjob` (5 fields)
    - `wvjob.wvtyp` (w=10) → _Wvtyp_
    - `wvjob.jobtyp` (w=10) → _Jobtyp_
    - `wvjob.jobsubtyp` (w=10) → _Jobsubtyp_
    - `wvjob.dttmstart` (w=10) → _Start Date/Time_
    - `wvjob.dttmend` (w=10) → _End Date/Time_

### NPT

- **HTML:** [Completion/Daily Input/NPT.html](Completion/Daily%20Input/NPT.html)
- **Paper:** letter · **margins** [25, 25, 25, 25] (1/100 in)
- **Master template:** template portrait.afr
- **Root table:** `wvjob` · **filter:** wvjob / wvtyp / dril
- **Blocks:** 3

  - **Job** — `wvjob` (9 fields)
    - `wvjob.wvtyp` (w=9) → _Wvtyp_
    - `wvjob.jobtyp` (w=9) → _Jobtyp_
    - `wvjob.jobsubtyp` (w=9) → _Jobsubtyp_
    - `wvjob.dttmstart` (w=9) → _Start Date/Time_
    - `wvjob.dttmend` (w=9) → _End Date/Time_
    - `wvjob.esttimesavecalc` (w=6) → _Estimate Timesave (computed)_
    - `wvjob.estcostsavecalc` (w=9) → _Estimate Costsave (computed)_
    - `wvjob.estproblemtimecalc` (w=6) → _Estimate Problemtime (computed)_
    - `wvjob.estproblemcostcalc` (w=9) → _Estimate Problemcost (computed)_
  - **Interval Lesson** — `wvjobintervallesson` (7 fields)
    - `wvjobintervallesson.dttmstart` (w=9) → _Start Date/Time_
    - `wvjobintervallesson.typ` (w=9) → _Type_
    - `wvjobintervallesson.depthstart` (w=9) → _Depth Start_
    - `wvjobintervallesson.depthend` (w=9) → _Depth End_
    - `wvjobintervallesson.esttimesaving` (w=9) → _Estimate Timesaving_
    - `wvjobintervallesson.estcostsaving` (w=9) → _Estimate Costsaving_
    - `wvjobintervallesson.com` (w=30) → _Comment_
  - **Interval Problem (NPT)** — `wvjobintervalproblem` (8 fields)
    - `wvjobintervalproblem.dttmstart` (w=9) → _Start Date/Time_
    - `wvjobintervalproblem.typ` (w=9) → _Type_
    - `wvjobintervalproblem.depthstart` (w=9) → _Depth Start_
    - `wvjobintervalproblem.depthend` (w=9) → _Depth End_
    - `wvjobintervalproblem.des` (w=9) → _Description_
    - `wvjobintervalproblem.estlosttime` (w=9) → _Estimate Losttime_
    - `wvjobintervalproblem.estcostoverride` (w=9) → _Estimate Costoverride_
    - `wvjobintervalproblem.com` (w=30) → _Comment_

### LOT & FIT

- **HTML:** [Completion/Daily Input/LOT & FIT.html](Completion/Daily%20Input/LOT%20%26%20FIT.html)
- **Paper:** letter · **margins** [12, 12, 31, 25] (1/100 in)
- **Master template:** template landscape header.afr
- **Root table:** `wvtestleakoff`
- **Blocks:** 3

  - **Testleakoff** — `wvtestleakoff` (14 fields)
    - `wvtestleakoff.dttm` (w=9) → _Dttm_
    - `wvtestleakoff.testtyp` (w=10) → _Testtyp_
    - `wvtestleakoff.depth` (w=10) → _Depth_
    - `wvtestleakoff.tvdcalc` (w=10) → _Tvd (computed)_
    - `wvtestleakoff.fluidtyp` (w=10) → _Fluidtyp_
    - `wvtestleakoff.densityfluid` (w=10) → _Densityfluid_
    - `wvtestleakoff.leakoffpres` (w=10) → _Leakoffpres_
    - `wvtestleakoff.volpumped` (w=10) → _Volpumped_
    - `wvtestleakoff.leakoffoccurred` (w=5) → _Leakoffoccurred_
    - `wvtestleakoff.leakoffprescalc` (w=10) → _Leakoffpres (computed)_
    - `wvtestleakoff.leakoffdensityfluidcalc` (w=10) → _Leakoffdensityfluid (computed)_
    - `wvtestleakoff.idrecfrm` (w=10) → _Idrecfrm_
    - `wvtestleakoff.idreccas` (w=25) → _Idreccas_
    - `wvtestleakoff.com` (w=50) → _Comment_
  - **Testleakoffdata** — `wvtestleakoffdata` (4 fields)
    - `wvtestleakoffdata.tm` (w=6) → _Tm_
    - `wvtestleakoffdata.pres` (w=8) → _Pres_
    - `wvtestleakoffdata.vol` (w=8) → _Vol_
    - `wvtestleakoffdata.note` (w=15) → _Note_
  - **Pressure vs Time Graph** — `wvtestleakoffdata` (1 fields)
    - `wvtestleakoffdata.pres` (w=0) → _Pres_

### Well History

- **HTML:** [Completion/Daily Input/Well History.html](Completion/Daily%20Input/Well%20History.html)
- **Paper:** letter · **margins** [25, 0, 25, 25] (1/100 in)
- **Master template:** template portrait Header.afr
- **Root table:** `wvcas` · **filter:** wvtub / dttmrun; wvtub / dttmpull; wvcement / dttmstart; wvstimtreat / dttm; wvzone / dttmzonelic; wvwellboresize / dttmstart; wvwellhead / dttmstart; wvtestleakoff / dttm; wvtestequip / dttm; wvotherinhole / dttmrun; wvperforation / dttm; wvotherstr / dttmrun; wvlog / dttm; wvswab / dttm; wvtestsssv / dttm
- **Captions:**
  - `@RCasing Description: <wvcas.des>; Set Depth: <wvcas.depthbtm>; `
  - `@RTubing Description: <wvtub.des>; Set Depth: <wvtub.depthbtm>; `
  - `@VTubing Description: <wvtub.des>; Pull Reason: <wvtub.pullreaso`
  - `@RDescription: <wvcement.des>; Eval Res: <wvcement.deseval>; Com`
  - `@RZone: <wvstimtreat.idreczone>; Type: <wvstimtreat.typ>; Commen`
  - `@^Zone: <wvzone.zonename>; Top: <wvzone.depthtop>; Btm: <wvzone.`
  - `ction: <wvwellboresize.des>; Size: <wvwellboresize.sz>; Act Top: <wvwellboresize.depthtopactual>; Act`
  - `Btm: <wvwellboresize.depthbtmact`
  - `@dMake: <wvwellhead.make>; Size: <wvwellhead.sz>; WP: <wvwellhea`
  - `pth: <wvtestleakoff.depth>; Formation Tested: <wvtestleakoff.idrecfrm>; P (Surf): <wvtestleakoff.leak`
  - `pe: <wvtestequip.testtyp>; Item Tested: <wvtestequip.idrectestitem>; Well Pres: <wvtestequip.wellpresused>; Comment: <wvt`
  - `@{Description: <wvotherinhole.des>; Top: <wvotherinhole.depthtop`
  - ` Btm: <wvotherinhole.depthbtm>; OD: <wvotherinhole.szodnom>`
  - `ne: <wvperforation.idreczone>; Top: <wvperforation.depthtop>; Btm: <wvperforation.depthbtm>; Shot Dens: <wvperf`
  - `@FString Description: <wvotherstr.des>; Set Depth: <wvotherstr.d`
  - `@UType: <wvlog.typ>; Top: <wvlog.depthtop>; Btm: <wvlog.depthbtm`
  - `Zone: <wvswab.idreczone>`
  - `SSSV Tested: <wvtestsssv.idrectubcomp>`
- **Blocks:** 0


### Well Summary

- **HTML:** [Completion/Daily Input/Well Summary.html](Completion/Daily%20Input/Well%20Summary.html)
- **Paper:** letter · **margins** [25, 25, 25, 25] (1/100 in)
- **Master template:** template portrait.afr
- **Root table:** `wvotherinhole` · **filter:** wvtub / dttmpull; wvrod / dttmpull
- **Blocks:** 21

  - **Well Header** — `wvwellheader` (17 fields)
    - `wvwellheader.dttmspud` (w=9) → _Spud Date/Time_
    - `wvwellheader.dttmrr` (w=9) → _Date/Time Rr_
    - `wvwellheader.wellconfig` (w=9) → _Wellconfig_
    - `wvwellheader.tdcalc` (w=9) → _Td (computed)_
    - `wvwellheader.elvorigkb` (w=10) → _Elvorigkb_
    - `wvwellheader.elvground` (w=10) → _Elvground_
    - `wvwellheader.elvcasflange` (w=10) → _Elvcasflange_
    - `wvwellheader.elvtubhead` (w=10) → _Elvtubhead_
    - `wvelevationhistory.elvother` (w=10) → _Elvother_
    - `wvwellheader.kbtogrdcalc` (w=10) → _Kbtogrd (computed)_
    - `wvwellheader.kbtocascalc` (w=10) → _Kbtocas (computed)_
    - `wvwellheader.kbtotubcalc` (w=10) → _Kbtotub (computed)_
    - `wvresponsibleteam.contactname` (w=10) → _Contactname_
    - `wvresponsibleteam.contactname` (w=10) → _Contactname_
    - `wvresponsibleteam.contactname` (w=10) → _Contactname_
    - `wvresponsibleteam.contactname` (w=10) → _Contactname_
    - `wvwellheader.directionstowell` (w=30) → _Directionstowell_
  - **Wellhead** — `wvwellhead` (4 fields)
    - `wvwellhead.typ` (w=8) → _Type_
    - `wvwellhead.make` (w=8) → _Make_
    - `wvwellhead.workpres` (w=8) → _Workpres_
    - `wvwellhead.service` (w=8) → _Service_
  - **Wellbore** — `wvwellbore` (4 fields)
    - `wvwellbore.des` (w=10) → _Description_
    - `wvwellbore.idrecparent` (w=10) → _Idrecparent_
    - `wvwellbore.profiletyp` (w=10) → _Profiletyp_
    - `wvwellbore.kickoffdepth` (w=10) → _Kickoffdepth_
  - **Cas** — `wvcas` (7 fields)
    - `wvcas.des` (w=25) → _Description_
    - `wvcas.dttmrun` (w=10) → _Date/Time Run_
    - `wvcas.szodnommaxcalc` (w=7) → _Szodnommax (computed)_
    - `wvcas.szidnommincalc` (w=7) → _Szidnommin (computed)_
    - `wvcas.wtperlengthcalc` (w=8) → _Wtperlength (computed)_
    - `wvcas.gradecalc` (w=7) → _Grade (computed)_
    - `wvcas.depthbtm` (w=9) → _Bottom Depth_
  - **Cement** — `wvcement` (1 fields)
    - `wvcement.contractor` (w=15) → _Contractor_
  - **Cementstage** — `wvcementstage` (4 fields)
    - `wvcementstage.depthtop` (w=9) → _Top Depth_
    - `wvcementstage.depthbtm` (w=9) → _Bottom Depth_
    - `wvcementstage.fullreturn` (w=9) → _Fullreturn_
    - `wvcementstage.volreturncmnt` (w=9) → _Volreturncmnt_
  - **Cementstagefluid** — `wvcementstagefluid` (4 fields)
    - `wvcementstagefluid.desfluid` (w=9) → _Description Fluid_
    - `wvcementstagefluid.typ` (w=9) → _Type_
    - `wvcementstagefluid.amtcement` (w=9) → _Amtcement_
    - `wvcementstagefluid.cmtclass` (w=9) → _Cmtclass_
  - **Otherinhole** — `wvotherinhole` (5 fields)
    - `wvotherinhole.des` (w=25) → _Description_
    - `wvotherinhole.depthtop` (w=9) → _Top Depth_
    - `wvotherinhole.depthbtm` (w=9) → _Bottom Depth_
    - `wvotherinhole.dttmrun` (w=10) → _Date/Time Run_
    - `wvotherinhole.dttmpull` (w=10) → _Date/Time Pull_
  - **Zone** — `wvzone` (5 fields)
    - `wvzone.zonename` (w=15) → _Zonename_
    - `wvzone.depthtop` (w=9) → _Top Depth_
    - `wvzone.depthbtm` (w=9) → _Bottom Depth_
    - `wvzone.currentstatuscalc` (w=15) → _Currentstatus (computed)_
    - `wvzone.dttmstatuscalc` (w=10) → _Date/Time Status (computed)_
  - **Perforation** — `wvperforation` (8 fields)
    - `wvperforation.dttm` (w=10) → _Dttm_
    - `wvperforation.typ` (w=9) → _Type_
    - `wvperforation.depthtop` (w=9) → _Top Depth_
    - `wvperforation.depthbtm` (w=9) → _Bottom Depth_
    - `wvperforation.idreczone` (w=15) → _Idreczone_
    - `wvperforation.shotdensity` (w=4) → _Shotdensity_
    - `wvperforation.phasing` (w=6) → _Phasing_
    - `wvperforation.currentstatuscalc` (w=5) → _Currentstatus (computed)_
  - **Stimtreat** — `wvstimtreat` (3 fields)
    - `wvstimtreat.dttm` (w=10) → _Dttm_
    - `wvstimtreat.idreczone` (w=15) → _Idreczone_
    - `wvstimtreat.typ` (w=15) → _Type_
  - **Stimtreatstg** — `wvstimtreatstg` (5 fields)
    - `wvstimtreatstg.stagenum` (w=2) → _Stagenum_
    - `wvstimtreatstg.stagetyp` (w=9) → _Stagetyp_
    - `wvstimtreatstg.depthtop` (w=9) → _Top Depth_
    - `wvstimtreatstg.depthbtm` (w=9) → _Bottom Depth_
    - `wvstimtreatstg.volpumped` (w=9) → _Volpumped_
  - **Log** — `wvlog` (5 fields)
    - `wvlog.dttm` (w=10) → _Dttm_
    - `wvlog.depthtop` (w=9) → _Top Depth_
    - `wvlog.depthbtm` (w=9) → _Bottom Depth_
    - `wvlog.typ` (w=30) → _Type_
    - `wvlog.casedhole` (w=3) → _Casedhole_
  - **Tub** — `wvtub` (3 fields)
    - `wvtub.des` (w=25) → _Description_
    - `wvtub.dttmrun` (w=10) → _Date/Time Run_
    - `wvtub.depthbtm` (w=9) → _Bottom Depth_
  - **Tubcomp** — `wvtubcomp` (9 fields)
    - `wvtubcomp.des` (w=25) → _Description_
    - `wvtubcomp.szodnom` (w=7) → _Szodnom_
    - `wvtubcomp.szidnom` (w=7) → _Szidnom_
    - `wvtubcomp.wtperlength` (w=8) → _Wtperlength_
    - `wvtubcomp.grade` (w=7) → _Grade_
    - `wvtubcomp.joints` (w=3) → _Joints_
    - `wvtubcomp.length` (w=7) → _Length_
    - `wvtubcomp.depthtopcalc` (w=7) → _Top Depth (computed)_
    - `wvtubcomp.depthbtmcalc` (w=7) → _Bottom Depth (computed)_
  - **Rod String** — `wvrod` (3 fields)
    - `wvrod.des` (w=25) → _Description_
    - `wvrod.dttmrun` (w=10) → _Date/Time Run_
    - `wvrod.depthbtm` (w=9) → _Bottom Depth_
  - **Rodcomp** — `wvrodcomp` (8 fields)
    - `wvrodcomp.des` (w=25) → _Description_
    - `wvrodcomp.szodnom` (w=7) → _Szodnom_
    - `wvrodcomp.wtperlength` (w=8) → _Wtperlength_
    - `wvrodcomp.grade` (w=7) → _Grade_
    - `wvrodcomp.joints` (w=3) → _Joints_
    - `wvrodcomp.length` (w=7) → _Length_
    - `wvrodcomp.depthtopcalc` (w=7) → _Top Depth (computed)_
    - `wvrodcomp.depthbtmcalc` (w=7) → _Bottom Depth (computed)_
  - **Rodcomppump** — `wvrodcomppump` (23 fields)
    - `wvrodcomp.make` (w=15) → _Make_
    - `wvrodcomp.model` (w=15) → _Model_
    - `wvrodcomp.sn` (w=15) → _Serial Number_
    - `wvrodcomppump.szidbore` (w=7) → _Szidbore_
    - `wvrodcomppump.pumptyp` (w=7) → _Pumptyp_
    - `wvrodcomppump.barreltyp` (w=7) → _Barreltyp_
    - `wvrodcomppump.anchortyp` (w=7) → _Anchortyp_
    - `wvrodcomppump.seatassytyp` (w=7) → _Seatassytyp_
    - `wvrodcomppump.barrellength` (w=7) → _Barrellength_
    - `wvrodcomppump.plungerlengthnom` (w=7) → _Plungerlengthnom_
    - `wvrodcomppump.lengthupperext` (w=7) → _Lengthupperext_
    - `wvrodcomppump.lengthlowerext` (w=7) → _Lengthlowerext_
    - `wvrodcomppump.plungerodclear` (w=7) → _Plungerodclear_
    - `wvrodcomppump.seatassydes` (w=14) → _Seatassydes_
    - `wvrodcomppump.seatassysz` (w=7) → _Seatassysz_
    - `wvrodcomppump.barrelmaterial` (w=7) → _Barrelmaterial_
    - `wvrodcomppump.plungermaterial` (w=7) → _Plungermaterial_
    - `wvrodcomppump.gasanchorszod` (w=7) → _Gasanchorszod_
    - `wvrodcomppump.gasanchorlength` (w=7) → _Gasanchorlength_
    - `wvrodcomppump.travvalvballmtl` (w=15) → _Travvalvballmtl_
    - `wvrodcomppump.travvalvseatmtl` (w=15) → _Travvalvseatmtl_
    - `wvrodcomppump.standvalveballmtl` (w=15) → _Standvalveballmtl_
    - `wvrodcomppump.standvalveseatmtl` (w=15) → _Standvalveseatmtl_
  - **Swab** — `wvswab` (6 fields)
    - `wvswab.dttm` (w=10) → _Dttm_
    - `wvswab.contractor` (w=15) → _Contractor_
    - `wvswab.idreczone` (w=15) → _Idreczone_
    - `wvswab.voltotalcalc` (w=6) → _Voltotal (computed)_
    - `wvswab.voltotaloilcalc` (w=6) → _Voltotaloil (computed)_
    - `wvswab.voltotalbswcalc` (w=6) → _Voltotalbsw (computed)_
  - **Job** — `wvjob` (5 fields)
    - `wvjob.dttmstart` (w=6) → _Start Date/Time_
    - `wvjob.dttmend` (w=6) → _End Date/Time_
    - `wvjob.jobtyp` (w=9) → _Jobtyp_
    - `wvjob.jobsubtyp` (w=9) → _Jobsubtyp_
    - `wvjob.summary` (w=30) → _Summary_
  - **Attachment** — `wvattachment` (1 fields)
    - `wvattachment.des` (w=25) → _Description_

### Dual Tubing

- **HTML:** [Completion/Daily Input/Dual Tubing.html](Completion/Daily%20Input/Dual%20Tubing.html)
- **Paper:** letter · **margins** [25, 25, 25, 25] (1/100 in)
- **Master template:** template portrait.afr
- **Root table:** `wvtub` · **filter:** wvtub / des; wvtub / des; wvtub / des; wvjob / wvtyp / Completion
- **Blocks:** 5

  - **Tub** — `wvtub` (3 fields)
    - `wvtub.des` (w=20) → _Description_
    - `wvtub.depthbtm` (w=10) → _Bottom Depth_
    - `wvtub.dttmrun` (w=10) → _Date/Time Run_
  - **Tubcomp** — `wvtubcomp` (6 fields)
    - `wvtubcomp.des` (w=15) → _Description_
    - `wvtubcomp.szodnom` (w=8) → _Szodnom_
    - `wvtubcomp.szidnom` (w=8) → _Szidnom_
    - `wvtubcomp.wtperlength` (w=10) → _Wtperlength_
    - `wvtubcomp.length` (w=10) → _Length_
    - `wvtubcomp.depthtopcalc` (w=10) → _Top Depth (computed)_
  - **Short String** — `wvtub` (3 fields)
    - `wvtub.des` (w=20) → _Description_
    - `wvtub.depthbtm` (w=10) → _Bottom Depth_
    - `wvtub.dttmrun` (w=10) → _Date/Time Run_
  - **Tubcomp** — `wvtubcomp` (6 fields)
    - `wvtubcomp.des` (w=15) → _Description_
    - `wvtubcomp.szodnom` (w=8) → _Szodnom_
    - `wvtubcomp.szidnom` (w=8) → _Szidnom_
    - `wvtubcomp.wtperlength` (w=10) → _Wtperlength_
    - `wvtubcomp.length` (w=10) → _Length_
    - `wvtubcomp.depthtopcalc` (w=10) → _Top Depth (computed)_
  - **Long String** — `wvjob` (10 fields)
    - `wvwellheader.wellida` (w=10) → _Well ID_
    - `wvwellheader.platform` (w=10) → _Platform_
    - `wvwellheader.fieldname` (w=10) → _Field_
    - `wvwellheader.wellconfig` (w=10) → _Wellconfig_
    - `wvwellheader.elvorigkb` (w=10) → _Elvorigkb_
    - `wvjob.wvtyp` (w=10) → _Wvtyp_
    - `wvjob.jobtyp` (w=10) → _Jobtyp_
    - `wvjob.dttmstart` (w=10) → _Start Date/Time_
    - `wvjob.dttmend` (w=10) → _End Date/Time_
    - `wvwellheader.kbtotubcalc` (w=10) → _Kbtotub (computed)_

### Tubing

- **HTML:** [Completion/Daily Input/Tubing.html](Completion/Daily%20Input/Tubing.html)
- **Paper:** letter · **margins** [25, 25, 25, 25] (1/100 in)
- **Master template:** template portrait.afr
- **Root table:** `None` · **filter:** wvjob / wvtyp / Drilling
- **Blocks:** 4

  - **& production\tubing and rods sch** — `wvtub` (1 fields)
    - `wvtub.idrecwellbore` (w=0) → _Idrecwellbore_
  - **Tub** — `wvtub` (4 fields)
    - `wvtub.des` (w=20) → _Description_
    - `wvtub.depthbtm` (w=10) → _Bottom Depth_
    - `wvtub.dttmrun` (w=10) → _Date/Time Run_
    - `wvtub.dttmpull` (w=10) → _Date/Time Pull_
  - **Tubcomp** — `wvtubcomp` (10 fields)
    - `wvtubcomp.itemnocalc` (w=5) → _Itemno (computed)_
    - `wvtubcomp.des` (w=10) → _Description_
    - `wvtubcomp.currentstatus` (w=10) → _Currentstatus_
    - `wvtubcomp.szodnom` (w=6) → _Szodnom_
    - `wvtubcomp.szidnom` (w=6) → _Szidnom_
    - `wvtubcomp.wtperlength` (w=6) → _Wtperlength_
    - `wvtubcomp.length` (w=8) → _Length_
    - `wvtubcomp.inclmaxcalc` (w=7) → _Inclmax (computed)_
    - `wvtubcomp.depthtopcalc` (w=9) → _Top Depth (computed)_
    - `wvtubcomp.depthbtmcalc` (w=9) → _Bottom Depth (computed)_
  - **Job** — `wvjob` (8 fields)
    - `wvwellheader.wellida` (w=20) → _Well ID_
    - `wvwellheader.platform` (w=20) → _Platform_
    - `wvwellheader.fieldname` (w=20) → _Field_
    - `wvwellheader.wellconfig` (w=20) → _Wellconfig_
    - `wvwellheader.elvorigkb` (w=10) → _Elvorigkb_
    - `wvwellheader.kbtotubcalc` (w=10) → _Kbtotub (computed)_
    - `wvjob.dttmstart` (w=10) → _Start Date/Time_
    - `wvjob.dttmend` (w=10) → _End Date/Time_

### Wellhead 

- **HTML:** [Completion/Daily Input/Wellhead .html](Completion/Daily%20Input/Wellhead%20.html)
- **Paper:** letter · **margins** [25, 25, 25, 25] (1/100 in)
- **Master template:** template landscape legal.afr
- **Root table:** `wvwellhead`
- **Blocks:** 1

  - **Wellheadcomp** — `wvwellheadcomp` (13 fields)
    - `wvwellhead.typ` (w=10) → _Type_
    - `wvjob.jobsubtyp` (w=10) → _Jobsubtyp_
    - `wvwellhead.service` (w=9) → _Service_
    - `wvwellheadcomp.des` (w=10) → _Description_
    - `wvwellheadcomp.sect` (w=10) → _Sect_
    - `wvwellheadcomp.make` (w=8) → _Make_
    - `wvwellheadcomp.com` (w=5) → _Comment_
    - `wvwellheadcomp.workpres` (w=7) → _Workpres_
    - `wvwellhead.workpres` (w=8) → _Workpres_
    - `wvwellhead.maxpres` (w=8) → _Max Pres_
    - `wvwellhead.sz` (w=8) → _Sz_
    - `wvwellhead.dttmoverhaul` (w=10) → _Date/Time Overhaul_
    - `wvwellhead.com` (w=40) → _Comment_

## Completion/General Input

### Equipment Pressure Tests

- **HTML:** [Completion/General Input/Equipment Pressure Tests.html](Completion/General%20Input/Equipment%20Pressure%20Tests.html)
- **Paper:** letter · **margins** [25, 25, 25, 25] (1/100 in)
- **Master template:** template portrait header cw.afr
- **Root table:** `wvwellheader`
- **Blocks:** 2

  - **& production\tubing and rods.sch** — `wvtestequip` (13 fields)
    - `wvtestequip.dttm` (w=10) → _Dttm_
    - `wvtestequip.testtyp` (w=10) → _Testtyp_
    - `wvtestequip.testsubtyp` (w=10) → _Testsubtyp_
    - `wvtestequip.testfluidtyp` (w=10) → _Testfluidtyp_
    - `wvtestequip.failflag` (w=5) → _Failflag_
    - `wvtestequip.dttmnexttest` (w=10) → _Date/Time Nexttest_
    - `wvtestequip.operator` (w=10) → _Operator_
    - `wvtestequip.fluiddensity` (w=10) → _Fluiddensity_
    - `wvtestequip.volpumped` (w=10) → _Volpumped_
    - `wvtestequip.vollost` (w=10) → _Vollost_
    - `wvtestequip.wellpresused` (w=5) → _Wellpresused_
    - `wvtestequip.refnochart` (w=10) → _Refnochart_
    - `wvtestequip.com` (w=30) → _Comment_
  - **Testsssv** — `wvtestsssv` (12 fields)
    - `wvtestsssv.dttm` (w=8) → _Dttm_
    - `wvtestsssv.idrectubcomp` (w=8) → _Idrectubcomp_
    - `wvtestsssv.presmaxdiff` (w=8) → _Presmaxdiff_
    - `wvtestsssv.correctactrqd` (w=8) → _Correctactrqd_
    - `wvtestsssv.presctrlln` (w=8) → _Presctrlln_
    - `wvtestsssv.presctrllnbldup` (w=8) → _Presctrllnbldup_
    - `wvtestsssv.tmctrllnbldup` (w=8) → _Tmctrllnbldup_
    - `wvtestsssv.presctrllnbleeddwn` (w=8) → _Presctrllnbleeddwn_
    - `wvtestsssv.prestubingbldup` (w=8) → _Prestubingbldup_
    - `wvtestsssv.tmtubingbldup` (w=8) → _Tmtubingbldup_
    - `wvtestsssv.prestubingbleeddwn` (w=8) → _Prestubingbleeddwn_
    - `wvtestsssv.preswhsensortrip` (w=8) → _Preswhsensortrip_

### Flow Tests

- **HTML:** [Completion/General Input/Flow Tests.html](Completion/General%20Input/Flow%20Tests.html)
- **Paper:** letter · **margins** [12, 12, 31, 25] (1/100 in)
- **Master template:** template landscape header cw.afr
- **Root table:** `wvwellheader` · **filter:** wvwelltesttrans / typ
- **Blocks:** 3

  - **Perforation** — `wvperforation` (5 fields)
    - `wvperforation.idreczone` (w=15) → _Idreczone_
    - `wvperforation.depthtop` (w=9) → _Top Depth_
    - `wvperforation.depthbtm` (w=9) → _Bottom Depth_
    - `wvperforation.dttmstatuscalc` (w=10) → _Date/Time Status (computed)_
    - `wvperforation.currentstatuscalc` (w=10) → _Currentstatus (computed)_
  - **Welltesttrans** — `wvwelltesttrans` (6 fields)
    - `wvwelltesttrans.dttm` (w=10) → _Dttm_
    - `wvwelltesttrans.typ` (w=10) → _Type_
    - `wvwelltesttrans.subtyp` (w=10) → _Subtyp_
    - `wvwelltesttrans.des` (w=10) → _Description_
    - `wvwelltesttrans.idreczone` (w=10) → _Idreczone_
    - `wvwelltesttrans.testedby` (w=10) → _Testedby_
  - **Welltesttransflowper** — `wvwelltesttransflowper` (17 fields)
    - `wvwelltesttransflowper.dttmstart` (w=8) → _Start Date/Time_
    - `wvwelltesttransflowper.dttmend` (w=8) → _End Date/Time_
    - `wvwelltesttransflowper.typ` (w=15) → _Type_
    - `wvwelltesttransflowper.szdiachoke` (w=10) → _Szdiachoke_
    - `wvwelltesttransflowper.rateoilend` (w=10) → _Rateoilend_
    - `wvwelltesttransflowper.rategasend` (w=10) → _Rategasend_
    - `wvwelltesttransflowper.ratewaterend` (w=10) → _Ratewaterend_
    - `wvwelltesttransflowper.ratecondend` (w=10) → _Ratecondend_
    - `wvwelltesttransflowper.volumeoiltotal` (w=10) → _Volumeoiltotal_
    - `wvwelltesttransflowper.volumegastotal` (w=10) → _Volumegastotal_
    - `wvwelltesttransflowper.volumewatertotal` (w=10) → _Volumewatertotal_
    - `wvwelltesttransflowper.volumecondtotal` (w=10) → _Volumecondtotal_
    - `wvwelltesttransflowper.presbhend` (w=10) → _Presbhend_
    - `wvwelltesttransflowper.prescasend` (w=10) → _Prescasend_
    - `wvwelltesttransflowper.prestubend` (w=10) → _Prestubend_
    - `wvwelltesttransflowper.tempbhend` (w=10) → _Tempbhend_
    - `wvwelltesttransflowper.salinitywaterend` (w=10) → _Salinitywaterend_

### Frac Details

- **HTML:** [Completion/General Input/Frac Details.html](Completion/General%20Input/Frac%20Details.html)
- **Paper:** letter · **margins** [25, 25, 25, 25] (1/100 in)
- **Master template:** template portrait.afr
- **Root table:** `wvstimtreat` · **filter:** wvstimtreat / wvstimtreat / typ; wvstimtreatfluid / Fluids; wvstimtreat / idrec; wvstimtreat / idrec
- **Captions:**
  - `Contractor:  <wvstimtreat.contractor>`
- **Blocks:** 4

  - **Pumping Details** — `wvstimtreatstg` (14 fields)
    - `wvstimtreatstg.stagenum` (w=3) → _Stagenum_
    - `wvstimtreatstg.stagetyp` (w=22) → _Stagetyp_
    - `wvstimtreatstg.prescasstart` (w=8) → _Prescasstart_
    - `wvstimtreatstg.prestubstart` (w=8) → _Prestubstart_
    - `wvstimtreatstg.ratestart` (w=6) → _Ratestart_
    - `wvstimtreatstg.gastyp` (w=8) → _Gastyp_
    - `wvstimtreatstg.gasrate` (w=6) → _Gasrate_
    - `wvstimtreatstg.volpumped` (w=6) → _Volpumped_
    - `wvstimtreatstg.volpumpedcumcalc` (w=6) → _Volpumped (cumulative) (computed)_
    - `wvstimtreatstg.volslurrypumped` (w=6) → _Volslurrypumped_
    - `wvstimtreatstg.volslurrypumpedcumcalc` (w=6) → _Volslurrypumped (cumulative) (computed)_
    - `wvstimtreatstg.foamquality` (w=6) → _Foamquality_
    - `wvstimtreatstg.idrecfluid` (w=20) → _Idrecfluid_
    - `wvstimtreatstg.com` (w=30) → _Comment_
  - **Stimtreat** — `wvstimtreat` (33 fields)
    - `wvstimtreat.dttm` (w=10) → _Dttm_
    - `wvstimtreat.typ` (w=10) → _Type_
    - `wvstimtreat.deliverymode` (w=10) → _Deliverymode_
    - `wvstimtreat.depthtopmincalc` (w=10) → _Depth Topmin (computed)_
    - `wvstimtreat.depthbtmmaxcalc` (w=10) → _Depth Btmmax (computed)_
    - `wvzone.zonename` (w=10) → _Zonename_
    - `wvstimtreat.presbreakdown` (w=10) → _Presbreakdown_
    - `wvstimtreat.shutinpresinitial` (w=10) → _Shutinpresinitial_
    - `wvstimtreat.fracgradient` (w=10) → _Fracgradient_
    - `wvstimtreat.prestreatmin` (w=10) → _Prestreatmin_
    - `wvstimtreat.prestreatmax` (w=10) → _Prestreatmax_
    - `wvstimtreat.prestreatavg` (w=10) → _Prestreatavg_
    - `wvstimtreat.shutinpresinst` (w=10) → _Shutinpresinst_
    - `wvstimtreat.shutinpresfinal` (w=10) → _Shutinpresfinal_
    - `wvstimtreat.shutintmfinal` (w=10) → _Shutintmfinal_
    - `wvstimtreat.ratetreatmin` (w=10) → _Ratetreatmin_
    - `wvstimtreat.ratetreatmax` (w=10) → _Ratetreatmax_
    - `wvstimtreat.ratetreatavg` (w=10) → _Ratetreatavg_
    - `wvstimtreat.pumppoweravg` (w=10) → _Pumppoweravg_
    - `wvstimtreat.pumppowermax` (w=10) → _Pumppowermax_
    - `wvstimtreat.pumppowerrating` (w=10) → _Pumppowerrating_
    - `wvstimtreat.gastypcalc` (w=10) → _Gastyp (computed)_
    - `wvstimtreat.gasvoltotalcalc` (w=10) → _Gasvoltotal (computed)_
    - `wvstimtreat.addamounttotalcalc` (w=8) → _Addamounttotal (computed)_
    - `wvstimtreat.propantdesign` (w=10) → _Propantdesign_
    - `wvstimtreat.propantinfrm` (w=10) → _Propantinfrm_
    - `wvstimtreat.propantinwellbore` (w=10) → _Propantinwellbore_
    - `wvstimtreat.concentrationbhmaxcalc` (w=10) → _Concentrationbhmax (computed)_
    - `wvstimtreat.concentrationmaxcalc` (w=10) → _Concentrationmax (computed)_
    - `wvstimtreat.depthtopproppant` (w=10) → _Depth Topproppant_
    - `wvstimtreat.volpumpedtotalcalc` (w=10) → _Volpumpedtotal (computed)_
    - `wvstimtreat.volslurrypumpedtotalcalc` (w=10) → _Volslurrypumpedtotal (computed)_
    - `wvstimtreat.volrecoveredtotalcalc` (w=10) → _Volrecoveredtotal (computed)_
  - **Fluid Additives** — `wvstimtreatfluidadd` (4 fields)
    - `wvstimtreatfluidadd.des` (w=20) → _Description_
    - `wvstimtreatfluidadd.amount` (w=5) → _Amount_
    - `wvstimtreatfluidadd.unitlabel` (w=3) → _Unitlabel_
    - `wvstimtreatfluidadd.conc` (w=5) → _Conc_
  - **TECHNICAL RESULTS** — `wvstimtreat` (10 fields)
    - `wvstimtreat.resulttechnical` (w=10) → _Resulttechnical_
    - `wvstimtreat.resulttechnicaldetail` (w=10) → _Resulttechnicaldetail_
    - `wvstimtreat.presbhmethod` (w=10) → _Presbhmethod_
    - `wvstimtreat.fracdiagnosticmethod` (w=10) → _Fracdiagnosticmethod_
    - `wvstimtreat.presclosure` (w=10) → _Presclosure_
    - `wvstimtreat.presclosuremethod` (w=10) → _Presclosuremethod_
    - `wvstimtreat.fraclength` (w=10) → _Fraclength_
    - `wvstimtreat.fracwidth` (w=10) → _Fracwidth_
    - `wvstimtreat.fracheight` (w=10) → _Fracheight_
    - `wvstimtreat.com` (w=50) → _Comment_

### Inspections

- **HTML:** [Completion/General Input/Inspections.html](Completion/General%20Input/Inspections.html)
- **Paper:** letter · **margins** [25, 25, 25, 25] (1/100 in)
- **Master template:** template portrait header.afr
- **Root table:** `wvinspectdetail`
- **Captions:**
  - `Type:  <wvinspect.typ1>`
- **Blocks:** 3

  - **Inspect** — `wvinspect` (11 fields)
    - `wvinspect.typ1` (w=10) → _Typ1_
    - `wvinspect.typ2` (w=10) → _Typ2_
    - `wvinspect.des` (w=20) → _Description_
    - `wvinspect.requiredby` (w=10) → _Requiredby_
    - `wvinspect.idrecitem` (w=10) → _Idrecitem_
    - `wvinspect.dttmstartrecur` (w=10) → _Date/Time Startrecur_
    - `wvinspect.dttmendrecur` (w=10) → _Date/Time Endrecur_
    - `wvinspect.recurfrequency` (w=10) → _Recurfrequency_
    - `wvinspect.recurnote` (w=10) → _Recurnote_
    - `wvinspect.dttmlastinspectioncalc` (w=10) → _Date/Time Lastinspection (computed)_
    - `wvinspect.dttmnextinspectioncalc` (w=10) → _Date/Time Nextinspection (computed)_
  - **Recurring Inspection Details** — `wvinspectdetail` (6 fields)
    - `wvinspectdetail.dttm` (w=10) → _Dttm_
    - `wvinspectdetail.inspectedbyname` (w=15) → _Inspectedbyname_
    - `wvinspectdetail.inspectedbycompany` (w=10) → _Inspectedbycompany_
    - `wvinspectdetail.actionreqdcom` (w=5) → _Actual Ionreqdcom_
    - `wvinspectdetail.actiontakencom` (w=10) → _Actual Iontakencom_
    - `wvinspectdetail.status` (w=10) → _Status_
  - **Inspectdetailchecklist** — `wvinspectdetailchecklist` (6 fields)
    - `wvinspectdetailchecklist.typ1` (w=25) → _Typ1_
    - `wvinspectdetailchecklist.typ2` (w=25) → _Typ2_
    - `wvinspectdetailchecklist.value` (w=5) → _Value_
    - `wvinspectdetailchecklist.valueunit` (w=5) → _Valueunit_
    - `wvinspectdetailchecklist.refno` (w=5) → _Refno_
    - `wvinspectdetailchecklist.actionrqd` (w=5) → _Actual Ionrqd_

### Logs

- **HTML:** [Completion/General Input/Logs.html](Completion/General%20Input/Logs.html)
- **Paper:** letter · **margins** [25, 25, 25, 25] (1/100 in)
- **Master template:** template portrait header.afr
- **Root table:** `None`
- **Blocks:** 1

  - **Log** — `wvlog` (6 fields)
    - `wvlog.dttm` (w=10) → _Dttm_
    - `wvlog.typ` (w=15) → _Type_
    - `wvlog.depthtop` (w=9) → _Top Depth_
    - `wvlog.depthbtm` (w=9) → _Bottom Depth_
    - `wvlog.contractor` (w=30) → _Contractor_
    - `wvlog.com` (w=30) → _Comment_

### Material Transfer

- **HTML:** [Completion/General Input/Material Transfer.html](Completion/General%20Input/Material%20Transfer.html)
- **Paper:** letter · **margins** [12, 12, 31, 25] (1/100 in)
- **Master template:** template landscape.afr
- **Root table:** `wvjobmaterialtrans` · **filter:** wvjob / wvtyp / drill
- **Blocks:** 3

  - **Job** — `wvjob` (6 fields)
    - `wvjob.wvtyp` (w=10) → _Wvtyp_
    - `wvjob.jobtyp` (w=10) → _Jobtyp_
    - `wvjob.jobsubtyp` (w=10) → _Jobsubtyp_
    - `wvjob.dttmstart` (w=10) → _Start Date/Time_
    - `wvjob.dttmend` (w=10) → _End Date/Time_
    - `wvjob.afenumbercalc` (w=10) → _AFE Number_
  - **Jobmaterialtrans** — `wvjobmaterialtrans` (7 fields)
    - `wvjobmaterialtrans.materialtransno` (w=10) → _Materialtransno_
    - `wvjobmaterialtrans.tofrom` (w=10) → _Tofrom_
    - `wvjobmaterialtrans.dttm` (w=10) → _Dttm_
    - `wvjobmaterialtrans.locationdes` (w=10) → _Locationdes_
    - `wvjobmaterialtrans.carrier` (w=10) → _Carrier_
    - `wvjobmaterialtrans.carrierrefno` (w=10) → _Carrierrefno_
    - `wvjobmaterialtrans.idrecjobcontact` (w=10) → _Contact Record_
  - **Transfer Items** — `wvjobmaterialtransdetail` (8 fields)
    - `wvjobmaterialtransdetail.materialtyp1` (w=10) → _Materialtyp1_
    - `wvjobmaterialtransdetail.materialdes` (w=10) → _Materialdes_
    - `wvjobmaterialtransdetail.materialrefno` (w=10) → _Materialrefno_
    - `wvjobmaterialtransdetail.sn` (w=10) → _Serial Number_
    - `wvjobmaterialtransdetail.qty` (w=5) → _Qty_
    - `wvjobmaterialtransdetail.qtyunitlabel` (w=5) → _Quantity Unitlabel_
    - `wvjobmaterialtransdetail.cond` (w=10) → _Cond_
    - `wvjobmaterialtransdetail.reason` (w=10) → _Reason_

### Other in Hole & Cement Plugs

- **HTML:** [Completion/General Input/Other in Hole & Cement Plugs.html](Completion/General%20Input/Other%20in%20Hole%20%26%20Cement%20Plugs.html)
- **Paper:** letter · **margins** [25, 25, 25, 25] (1/100 in)
- **Master template:** template portrait header cw.afr
- **Root table:** `wvwellheader` · **filter:** wvcement / cementtyp
- **Blocks:** 4

  - **Otherinhole** — `wvotherinhole` (7 fields)
    - `wvotherinhole.des` (w=25) → _Description_
    - `wvotherinhole.dttmrun` (w=10) → _Date/Time Run_
    - `wvotherinhole.dttmpull` (w=10) → _Date/Time Pull_
    - `wvotherinhole.depthtop` (w=10) → _Top Depth_
    - `wvotherinhole.depthbtm` (w=10) → _Bottom Depth_
    - `wvotherinhole.szodnom` (w=10) → _Szodnom_
    - `wvotherinhole.com` (w=25) → _Comment_
  - **Cement (filtered for Type=Plug)** — `wvcement` (6 fields)
    - `wvcement.des` (w=10) → _Description_
    - `wvcement.cementtyp` (w=10) → _Cementtyp_
    - `wvcement.idrecstring` (w=10) → _Idrecstring_
    - `wvcement.dttmstart` (w=10) → _Start Date/Time_
    - `wvcement.dttmend` (w=10) → _End Date/Time_
    - `wvcement.idrecwellbore` (w=10) → _Idrecwellbore_
  - **Cementstage** — `wvcementstage` (6 fields)
    - `wvcementstage.stagenum` (w=10) → _Stagenum_
    - `wvcementstage.des` (w=10) → _Description_
    - `wvcementstage.depthtop` (w=10) → _Top Depth_
    - `wvcementstage.depthtvdtopcalc` (w=10) → _Depth TVD Top (computed)_
    - `wvcementstage.depthbtm` (w=10) → _Bottom Depth_
    - `wvcementstage.depthtvdbtmcalc` (w=10) → _Depth TVD Btm (computed)_
  - **Cementstagefluid** — `wvcementstagefluid` (7 fields)
    - `wvcementstagefluid.typ` (w=10) → _Type_
    - `wvcementstagefluid.depthtopest` (w=10) → _Depth Topest_
    - `wvcementstagefluid.depthbtmest` (w=10) → _Depth Btmest_
    - `wvcementstagefluid.cmtclass` (w=10) → _Cmtclass_
    - `wvcementstagefluid.amtcement` (w=10) → _Amtcement_
    - `wvcementstagefluid.yield` (w=10) → _Yield_
    - `wvcementstagefluid.volpumped` (w=10) → _Volpumped_

### Perforations

- **HTML:** [Completion/General Input/Perforations.html](Completion/General%20Input/Perforations.html)
- **Paper:** letter · **margins** [25, 25, 25, 25] (1/100 in)
- **Master template:** template portrait header cw.afr
- **Root table:** `None`
- **Blocks:** 2

  - **Perf Details** — `wvperforation` (20 fields)
    - `wvperforation.dttm` (w=9) → _Dttm_
    - `wvperforation.idreczone` (w=9) → _Idreczone_
    - `wvperforation.depthtop` (w=9) → _Top Depth_
    - `wvperforation.depthbtm` (w=9) → _Bottom Depth_
    - `wvperforation.contractor` (w=9) → _Contractor_
    - `wvperforation.conveymeth` (w=9) → _Conveymeth_
    - `wvperforation.szgun` (w=9) → _Szgun_
    - `wvperforation.carriermake` (w=9) → _Carriermake_
    - `wvperforation.shotdensity` (w=9) → _Shotdensity_
    - `wvperforation.chargetyp` (w=9) → _Chargetyp_
    - `wvperforation.phasing` (w=9) → _Phasing_
    - `wvperforation.orientation` (w=9) → _Orientation_
    - `wvperforation.orientmethod` (w=9) → _Orientmethod_
    - `wvperforation.balance` (w=9) → _Balance_
    - `wvperforation.balancepres` (w=9) → _Balancepres_
    - `wvperforation.depthfluidbefore` (w=9) → _Depth Fluidbefore_
    - `wvperforation.depthfluidafter` (w=9) → _Depth Fluidafter_
    - `wvperforation.presinitsurf` (w=9) → _Presinitsurf_
    - `wvperforation.presfinalsurf` (w=9) → _Presfinalsurf_
    - `wvperforation.idreclog` (w=20) → _Idreclog_
  - **Perforationstatus** — `wvperforationstatus` (3 fields)
    - `wvperforationstatus.dttm` (w=8) → _Dttm_
    - `wvperforationstatus.status` (w=20) → _Status_
    - `wvperforationstatus.com` (w=40) → _Comment_

### Rod and Pump Details

- **HTML:** [Completion/General Input/Rod and Pump Details.html](Completion/General%20Input/Rod%20and%20Pump%20Details.html)
- **Paper:** letter · **margins** [25, 25, 25, 25] (1/100 in)
- **Master template:** template portrait header cw.afr
- **Root table:** `wvrod` · **filter:** wvrod / idrec; wvrod / idrec
- **Blocks:** 4

  - **& production\tubing and rods.sch** — `wvrod` (1 fields)
    - `wvrod.idrecwellbore` (w=0) → _Idrecwellbore_
  - **Rod String** — `wvrod` (4 fields)
    - `wvrod.des` (w=25) → _Description_
    - `wvrod.depthbtm` (w=9) → _Bottom Depth_
    - `wvrod.dttmrun` (w=10) → _Date/Time Run_
    - `wvrod.dttmpull` (w=10) → _Date/Time Pull_
  - **Rodcomp** — `wvrodcomp` (9 fields)
    - `wvrodcomp.joints` (w=4) → _Joints_
    - `wvrodcomp.des` (w=20) → _Description_
    - `wvrodcomp.szodnom` (w=7) → _Szodnom_
    - `wvrodcomp.wtperlength` (w=8) → _Wtperlength_
    - `wvrodcomp.grade` (w=7) → _Grade_
    - `wvrodcomp.guidedes` (w=15) → _Guidedes_
    - `wvrodcomp.length` (w=9) → _Length_
    - `wvrodcomp.depthtopcalc` (w=9) → _Top Depth (computed)_
    - `wvrodcomp.depthbtmcalc` (w=9) → _Bottom Depth (computed)_
  - **Pump Details** — `wvrodcomppump` (23 fields)
    - `wvrodcomp.make` (w=15) → _Make_
    - `wvrodcomp.model` (w=15) → _Model_
    - `wvrodcomp.sn` (w=12) → _Serial Number_
    - `wvrodcomppump.szidbore` (w=7) → _Szidbore_
    - `wvrodcomppump.pumptyp` (w=7) → _Pumptyp_
    - `wvrodcomppump.barreltyp` (w=7) → _Barreltyp_
    - `wvrodcomppump.anchortyp` (w=7) → _Anchortyp_
    - `wvrodcomppump.seatassytyp` (w=7) → _Seatassytyp_
    - `wvrodcomppump.barrellength` (w=7) → _Barrellength_
    - `wvrodcomppump.plungerlengthnom` (w=7) → _Plungerlengthnom_
    - `wvrodcomppump.lengthupperext` (w=7) → _Lengthupperext_
    - `wvrodcomppump.lengthlowerext` (w=7) → _Lengthlowerext_
    - `wvrodcomppump.plungerodclear` (w=7) → _Plungerodclear_
    - `wvrodcomppump.seatassydes` (w=14) → _Seatassydes_
    - `wvrodcomppump.seatassysz` (w=7) → _Seatassysz_
    - `wvrodcomppump.barrelmaterial` (w=7) → _Barrelmaterial_
    - `wvrodcomppump.plungermaterial` (w=7) → _Plungermaterial_
    - `wvrodcomppump.gasanchorszod` (w=7) → _Gasanchorszod_
    - `wvrodcomppump.gasanchorlength` (w=7) → _Gasanchorlength_
    - `wvrodcomppump.travvalvballmtl` (w=15) → _Travvalvballmtl_
    - `wvrodcomppump.travvalvseatmtl` (w=15) → _Travvalvseatmtl_
    - `wvrodcomppump.standvalveballmtl` (w=15) → _Standvalveballmtl_
    - `wvrodcomppump.standvalveseatmtl` (w=15) → _Standvalveseatmtl_

### Safety Incident

- **HTML:** [Completion/General Input/Safety Incident.html](Completion/General%20Input/Safety%20Incident.html)
- **Paper:** letter · **margins** [25, 25, 25, 25] (1/100 in)
- **Master template:** template portrait header cw.afr
- **Root table:** `wvjob` · **filter:** wvjob / wvtyp / Drilling
- **Blocks:** 2

  - **Job** — `wvjob` (5 fields)
    - `wvjob.wvtyp` (w=10) → _Wvtyp_
    - `wvjob.jobtyp` (w=10) → _Jobtyp_
    - `wvjob.afenumbercalc` (w=10) → _AFE Number_
    - `wvjob.dttmstart` (w=10) → _Start Date/Time_
    - `wvjob.dttmend` (w=10) → _End Date/Time_
  - **Jobsafetyincident** — `wvjobsafetyincident` (6 fields)
    - `wvjobsafetyincident.dttm` (w=15) → _Dttm_
    - `wvjobsafetyincident.category` (w=15) → _Category_
    - `wvjobsafetyincident.typ1` (w=15) → _Typ1_
    - `wvjobsafetyincident.severity` (w=15) → _Severity_
    - `wvjobsafetyincident.cause` (w=15) → _Cause_
    - `wvjobsafetyincident.com` (w=50) → _Comment_

### Schematic - Current

- **HTML:** [Completion/General Input/Schematic - Current.html](Completion/General%20Input/Schematic%20-%20Current.html)
- **Paper:** letter · **margins** [25, 25, 25, 25] (1/100 in)
- **Master template:** template portrait header cw.afr
- **Root table:** `None`
- **Captions:**
  - `TD:  <wvwellheader.tdcalc>`
- **Blocks:** 2

  - **Wellbore** — `wvwellbore` (1 fields)
    - `wvwellbore.idrec` (w=0) → _Record ID_
  - **Most Recent Job** — `wvjob` (5 fields)
    - `wvjob.wvtyp` (w=10) → _Wvtyp_
    - `wvjob.jobtyp` (w=10) → _Jobtyp_
    - `wvjob.jobsubtyp` (w=10) → _Jobsubtyp_
    - `wvjob.dttmstart` (w=10) → _Start Date/Time_
    - `wvjob.dttmend` (w=10) → _End Date/Time_

### Swabs

- **HTML:** [Completion/General Input/Swabs.html](Completion/General%20Input/Swabs.html)
- **Paper:** letter · **margins** [12, 12, 31, 25] (1/100 in)
- **Master template:** template landscape header cw.afr
- **Root table:** `wvswab`
- **Captions:**
  - `Report generated on  <Current date short format>`
  - `Page <Page number>`
- **Blocks:** 2

  - **Swab** — `wvswab` (6 fields)
    - `wvswab.dttm` (w=8) → _Dttm_
    - `wvswab.idreczone` (w=15) → _Idreczone_
    - `wvswab.idrecwellbore` (w=15) → _Idrecwellbore_
    - `wvswab.contractor` (w=15) → _Contractor_
    - `wvswab.idrecjob` (w=26) → _Idrecjob_
    - `wvswab.voltotalcalc` (w=10) → _Voltotal (computed)_
  - **Swabdetails** — `wvswabdetails` (14 fields)
    - `wvswabdetails.swabno` (w=3) → _Swabno_
    - `wvswabdetails.dttm` (w=5) → _Dttm_
    - `wvswabdetails.tmswab` (w=5) → _Tmswab_
    - `wvswabdetails.depthfluidlevel` (w=5) → _Depth Fluidlevel_
    - `wvswabdetails.depthpull` (w=5) → _Depth Pull_
    - `wvswabdetails.prescas` (w=5) → _Prescas_
    - `wvswabdetails.prestub` (w=5) → _Prestub_
    - `wvswabdetails.volfluidrec` (w=5) → _Volfluidrec_
    - `wvswabdetails.voloilcalc` (w=5) → _Voloil (computed)_
    - `wvswabdetails.volcumoilcalc` (w=5) → _Volcumoil (computed)_
    - `wvswabdetails.bsw` (w=5) → _Bsw_
    - `wvswabdetails.volcumbswcalc` (w=5) → _Volcumbsw (computed)_
    - `wvswabdetails.volcumcalc` (w=5) → _Vol (cumulative) (computed)_
    - `wvswabdetails.com` (w=35) → _Comment_

### Tubing Tally

- **HTML:** [Completion/General Input/Tubing Tally.html](Completion/General%20Input/Tubing%20Tally.html)
- **Paper:** letter · **margins** [25, 25, 25, 25] (1/100 in)
- **Master template:** template portrait header cw.afr
- **Root table:** `wvtub` · **filter:** wvtub / idrec; wvtub / idrec; wvtubcomp / sysseq; wvtubcomptally / sysseq
- **Captions:**
  - `Des:  <wvtub.des>,  Set Depth: <wvtub.depthbtm>`
- **Blocks:** 2

  - **Tubing Summary** — `wvtub` (9 fields)
    - `wvtub.des` (w=20) → _Description_
    - `wvtub.depthbtm` (w=10) → _Bottom Depth_
    - `wvtub.dttmrun` (w=10) → _Date/Time Run_
    - `wvtub.dttmpull` (w=10) → _Date/Time Pull_
    - `wvtub.pullreason` (w=10) → _Pullreason_
    - `wvtub.szodnomcompmaxcalc` (w=10) → _Szodnomcompmax (computed)_
    - `wvtub.wtperlengthcalc` (w=10) → _Wtperlength (computed)_
    - `wvtub.gradecalc` (w=10) → _Grade (computed)_
    - `wvtub.depthtopcalc` (w=10) → _Top Depth (computed)_
  - **Tubcomptally** — `wvtubcomptally` (12 fields)
    - `wvtubcomp.des` (w=10) → _Description_
    - `wvtubcomp.szodnom` (w=10) → _Szodnom_
    - `wvtubcomp.wtperlength` (w=10) → _Wtperlength_
    - `wvtubcomp.grade` (w=10) → _Grade_
    - `wvtubcomp.szidnom` (w=7) → _Szidnom_
    - `wvtubcomptally.refno` (w=10) → _Refno_
    - `wvtubcomptally.jointrun` (w=10) → _Jointrun_
    - `wvtubcomptally.length` (w=10) → _Length_
    - `wvtubcomptally.centralized` (w=10) → _Centralized_
    - `wvtubcomptally.extjewelry` (w=10) → _Extjewelry_
    - `wvtubcomptally.depthtopcalc` (w=10) → _Top Depth (computed)_
    - `wvtubcomptally.lengthcumcalc` (w=10) → _Length (cumulative) (computed)_

### Wellhead

- **HTML:** [Completion/General Input/Wellhead.html](Completion/General%20Input/Wellhead.html)
- **Paper:** letter · **margins** [12, 12, 31, 25] (1/100 in)
- **Master template:** template landscape header.afr
- **Root table:** `wvwellhead`
- **Blocks:** 3

  - **Wellhead** — `wvwellhead` (4 fields)
    - `wvwellhead.typ` (w=10) → _Type_
    - `wvwellhead.make` (w=10) → _Make_
    - `wvwellhead.maxpres` (w=10) → _Max Pres_
    - `wvwellhead.dttmstart` (w=10) → _Start Date/Time_
  - **Wellheadcomp** — `wvwellheadcomp` (10 fields)
    - `wvwellheadcomp.des` (w=25) → _Description_
    - `wvwellheadcomp.make` (w=10) → _Make_
    - `wvwellheadcomp.model` (w=10) → _Model_
    - `wvwellheadcomp.workpres` (w=10) → _Workpres_
    - `wvwellheadcomp.service` (w=10) → _Service_
    - `wvwellheadcomp.workprestop` (w=10) → _Workprestop_
    - `wvwellheadcomp.ringgaskettop` (w=10) → _Ringgaskettop_
    - `wvwellheadcomp.minbore` (w=10) → _Min Bore_
    - `wvwellheadcomp.sn` (w=10) → _Serial Number_
    - `wvwellheadcomp.com` (w=15) → _Comment_
  - **Wellhead Attached Files** — `wvwellheadattachment` (5 fields)
    - `wvwellheadattachment.des` (w=10) → _Description_
    - `wvwellheadattachment.attachida` (w=10) → _Attachida_
    - `wvwellheadattachment.dttm` (w=10) → _Dttm_
    - `wvwellheadattachment.typ1` (w=10) → _Typ1_
    - `wvwellheadattachment.typ2` (w=10) → _Typ2_

### Lessons and Problems

- **HTML:** [Completion/General Input/Lessons and Problems.html](Completion/General%20Input/Lessons%20and%20Problems.html)
- **Paper:** letter · **margins** [25, 25, 25, 25] (1/100 in)
- **Master template:** template portrait header cw.afr
- **Root table:** `wvjob` · **filter:** wvjob / wvtyp / dril
- **Blocks:** 3

  - **Job** — `wvjob` (9 fields)
    - `wvjob.wvtyp` (w=9) → _Wvtyp_
    - `wvjob.jobtyp` (w=9) → _Jobtyp_
    - `wvjob.jobsubtyp` (w=9) → _Jobsubtyp_
    - `wvjob.dttmstart` (w=9) → _Start Date/Time_
    - `wvjob.dttmend` (w=9) → _End Date/Time_
    - `wvjob.esttimesavecalc` (w=6) → _Estimate Timesave (computed)_
    - `wvjob.estcostsavecalc` (w=9) → _Estimate Costsave (computed)_
    - `wvjob.estproblemtimecalc` (w=6) → _Estimate Problemtime (computed)_
    - `wvjob.estproblemcostcalc` (w=9) → _Estimate Problemcost (computed)_
  - **Interval Lesson** — `wvjobintervallesson` (7 fields)
    - `wvjobintervallesson.dttmstart` (w=9) → _Start Date/Time_
    - `wvjobintervallesson.typ` (w=9) → _Type_
    - `wvjobintervallesson.depthstart` (w=9) → _Depth Start_
    - `wvjobintervallesson.depthend` (w=9) → _Depth End_
    - `wvjobintervallesson.esttimesaving` (w=9) → _Estimate Timesaving_
    - `wvjobintervallesson.estcostsaving` (w=9) → _Estimate Costsaving_
    - `wvjobintervallesson.com` (w=30) → _Comment_
  - **Interval Problem (NPT)** — `wvjobintervalproblem` (8 fields)
    - `wvjobintervalproblem.dttmstart` (w=9) → _Start Date/Time_
    - `wvjobintervalproblem.typ` (w=9) → _Type_
    - `wvjobintervalproblem.depthstart` (w=9) → _Depth Start_
    - `wvjobintervalproblem.depthend` (w=9) → _Depth End_
    - `wvjobintervalproblem.des` (w=9) → _Description_
    - `wvjobintervalproblem.estlosttime` (w=9) → _Estimate Losttime_
    - `wvjobintervalproblem.estcostoverride` (w=9) → _Estimate Costoverride_
    - `wvjobintervalproblem.com` (w=30) → _Comment_

### Stimulations

- **HTML:** [Completion/General Input/Stimulations.html](Completion/General%20Input/Stimulations.html)
- **Paper:** letter · **margins** [25, 25, 25, 25] (1/100 in)
- **Master template:** template portrait header cw.afr
- **Root table:** `wvstimtreat` · **filter:** wvcas / des; wvtub / dttmpull; wvperforation / dttm; wvstimtreat / dttm
- **Captions:**
  - `<wvstimtreatfluid.fluidname>`
- **Blocks:** 8

  - **Group List** — `wvcas` (6 fields)
    - `wvcas.des` (w=15) → _Description_
    - `wvcas.dttmrun` (w=10) → _Date/Time Run_
    - `wvcas.depthbtm` (w=9) → _Bottom Depth_
    - `wvcas.szodnommaxcalc` (w=7) → _Szodnommax (computed)_
    - `wvcas.wtperlengthcalc` (w=8) → _Wtperlength (computed)_
    - `wvcas.gradecalc` (w=7) → _Grade (computed)_
  - **Tub** — `wvtub` (6 fields)
    - `wvtub.des` (w=15) → _Description_
    - `wvtub.dttmrun` (w=10) → _Date/Time Run_
    - `wvtub.depthbtm` (w=9) → _Bottom Depth_
    - `wvtub.szodnommaxcalc` (w=7) → _Szodnommax (computed)_
    - `wvtub.wtperlengthcalc` (w=8) → _Wtperlength (computed)_
    - `wvtub.gradecalc` (w=7) → _Grade (computed)_
  - **Perforation** — `wvperforation` (5 fields)
    - `wvperforation.dttm` (w=10) → _Dttm_
    - `wvperforation.idreczone` (w=15) → _Idreczone_
    - `wvperforation.depthtop` (w=9) → _Top Depth_
    - `wvperforation.depthbtm` (w=9) → _Bottom Depth_
    - `wvperforation.currentstatuscalc` (w=15) → _Currentstatus (computed)_
  - **Stimtreat** — `wvstimtreat` (13 fields)
    - `wvstimtreat.dttm` (w=9) → _Dttm_
    - `wvstimtreat.typ` (w=9) → _Type_
    - `wvstimtreat.contractor` (w=9) → _Contractor_
    - `wvstimtreat.idreczone` (w=9) → _Idreczone_
    - `wvstimtreat.idrecjob` (w=9) → _Idrecjob_
    - `wvstimtreat.propantinwellbore` (w=6) → _Propantinwellbore_
    - `wvstimtreat.diversioncontractor` (w=6) → _Diversioncontractor_
    - `wvstimtreat.shutinpresinitial` (w=6) → _Shutinpresinitial_
    - `wvstimtreat.shutinpresinst` (w=6) → _Shutinpresinst_
    - `wvstimtreat.shutinpresfinal` (w=6) → _Shutinpresfinal_
    - `wvstimtreat.propantinfrm` (w=6) → _Propantinfrm_
    - `wvstimtreat.shutintmfinal` (w=6) → _Shutintmfinal_
    - `wvstimtreat.com` (w=30) → _Comment_
  - **Stimtreatfluid** — `wvstimtreatfluid` (6 fields)
    - `wvstimtreatfluid.fluidname` (w=18) → _Fluidname_
    - `wvstimtreatfluid.fluidtyp` (w=18) → _Fluidtyp_
    - `wvstimtreatfluid.evalmethod` (w=9) → _Evalmethod_
    - `wvstimtreatfluid.evaldes` (w=9) → _Evaldes_
    - `wvstimtreatfluid.fluiddensity` (w=9) → _Fluiddensity_
    - `wvstimtreatfluid.filtersz` (w=9) → _Filtersz_
  - **Stimtreatfluidadd** — `wvstimtreatfluidadd` (3 fields)
    - `wvstimtreatfluidadd.des` (w=6) → _Description_
    - `wvstimtreatfluidadd.unitlabel` (w=6) → _Unitlabel_
    - `wvstimtreatfluidadd.conc` (w=6) → _Conc_
  - **Stimtreatstg** — `wvstimtreatstg` (17 fields)
    - `wvstimtreatstg.stagenum` (w=9) → _Stagenum_
    - `wvstimtreatstg.stagetyp` (w=9) → _Stagetyp_
    - `wvstimtreatstg.dttmstart` (w=9) → _Start Date/Time_
    - `wvstimtreatstg.dttmend` (w=9) → _End Date/Time_
    - `wvstimtreatstg.depthtop` (w=9) → _Top Depth_
    - `wvstimtreatstg.depthbtm` (w=9) → _Bottom Depth_
    - `wvstimtreatstg.prestubstart` (w=9) → _Prestubstart_
    - `wvstimtreatstg.prestubend` (w=9) → _Prestubend_
    - `wvstimtreatstg.prescasstart` (w=9) → _Prescasstart_
    - `wvstimtreatstg.prescasend` (w=9) → _Prescasend_
    - `wvstimtreatstg.volpumped` (w=9) → _Volpumped_
    - `wvstimtreatstg.volrecovered` (w=9) → _Volrecovered_
    - `wvstimtreatstg.idrecfluid` (w=9) → _Idrecfluid_
    - `wvstimtreatstg.gastyp` (w=9) → _Gastyp_
    - `wvstimtreatstg.gasrate` (w=9) → _Gasrate_
    - `wvstimtreatstg.gasvol` (w=9) → _Gasvol_
    - `wvstimtreatstg.com` (w=18) → _Comment_
  - **Stimtreatstgadd** — `wvstimtreatstgadd` (7 fields)
    - `wvstimtreatstgadd.des` (w=10) → _Description_
    - `wvstimtreatstgadd.typ` (w=10) → _Type_
    - `wvstimtreatstgadd.amount` (w=10) → _Amount_
    - `wvstimtreatstgadd.unitlabel` (w=5) → _Unitlabel_
    - `wvstimtreatstgadd.sz` (w=5) → _Sz_
    - `wvstimtreatstgadd.concentration` (w=10) → _Concentration_
    - `wvstimtreatstgadd.note` (w=10) → _Note_

### Tubing.Dual Tubing

- **HTML:** [Completion/General Input/Tubing.Dual Tubing.html](Completion/General%20Input/Tubing.Dual%20Tubing.html)
- **Paper:** letter · **margins** [25, 25, 25, 25] (1/100 in)
- **Master template:** template portrait.afr
- **Root table:** `wvtub` · **filter:** wvtub / des; wvtub / des; wvtub / des; wvjob / wvtyp / Completion
- **Blocks:** 5

  - **Tub** — `wvtub` (3 fields)
    - `wvtub.des` (w=10) → _Description_
    - `wvtub.depthbtm` (w=10) → _Bottom Depth_
    - `wvtub.dttmrun` (w=10) → _Date/Time Run_
  - **Tubcomp** — `wvtubcomp` (6 fields)
    - `wvtubcomp.des` (w=15) → _Description_
    - `wvtubcomp.szodnom` (w=10) → _Szodnom_
    - `wvtubcomp.szidnom` (w=10) → _Szidnom_
    - `wvtubcomp.wtperlength` (w=10) → _Wtperlength_
    - `wvtubcomp.length` (w=10) → _Length_
    - `wvtubcomp.depthtopcalc` (w=10) → _Top Depth (computed)_
  - **Short String** — `wvtub` (3 fields)
    - `wvtub.des` (w=10) → _Description_
    - `wvtub.depthbtm` (w=10) → _Bottom Depth_
    - `wvtub.dttmrun` (w=10) → _Date/Time Run_
  - **Tubcomp** — `wvtubcomp` (6 fields)
    - `wvtubcomp.des` (w=15) → _Description_
    - `wvtubcomp.szodnom` (w=10) → _Szodnom_
    - `wvtubcomp.szidnom` (w=10) → _Szidnom_
    - `wvtubcomp.wtperlength` (w=10) → _Wtperlength_
    - `wvtubcomp.length` (w=10) → _Length_
    - `wvtubcomp.depthtopcalc` (w=10) → _Top Depth (computed)_
  - **Long String** — `wvjob` (9 fields)
    - `wvwellheader.wellida` (w=20) → _Well ID_
    - `wvwellheader.platform` (w=20) → _Platform_
    - `wvwellheader.fieldname` (w=20) → _Field_
    - `wvwellheader.wellconfig` (w=20) → _Wellconfig_
    - `wvwellheader.elvorigkb` (w=10) → _Elvorigkb_
    - `wvwellheader.kbtotubcalc` (w=10) → _Kbtotub (computed)_
    - `wvjob.dttmstart` (w=10) → _Start Date/Time_
    - `wvjob.dttmend` (w=10) → _End Date/Time_
    - `wvtub.idrecwellbore` (w=0) → _Idrecwellbore_

### Tubing

- **HTML:** [Completion/General Input/Tubing.html](Completion/General%20Input/Tubing.html)
- **Paper:** letter · **margins** [25, 25, 25, 25] (1/100 in)
- **Master template:** template portrait.afr
- **Root table:** `None` · **filter:** wvjob / wvtyp / Completion
- **Blocks:** 4

  - **& production\tubing and rods sch** — `wvtub` (1 fields)
    - `wvtub.idrecwellbore` (w=0) → _Idrecwellbore_
  - **Tub** — `wvtub` (4 fields)
    - `wvtub.des` (w=25) → _Description_
    - `wvtub.depthbtm` (w=9) → _Bottom Depth_
    - `wvtub.dttmrun` (w=10) → _Date/Time Run_
    - `wvtub.dttmpull` (w=10) → _Date/Time Pull_
  - **Tubcomp** — `wvtubcomp` (8 fields)
    - `wvtubcomp.des` (w=10) → _Description_
    - `wvtubcomp.currentstatus` (w=10) → _Currentstatus_
    - `wvtubcomp.szodnom` (w=6) → _Szodnom_
    - `wvtubcomp.szidnom` (w=6) → _Szidnom_
    - `wvtubcomp.wtperlength` (w=6) → _Wtperlength_
    - `wvtubcomp.length` (w=7) → _Length_
    - `wvtubcomp.depthtopcalc` (w=9) → _Top Depth (computed)_
    - `wvtubcomp.depthbtmcalc` (w=9) → _Bottom Depth (computed)_
  - **Job** — `wvjob` (8 fields)
    - `wvwellheader.wellida` (w=20) → _Well ID_
    - `wvwellheader.platform` (w=20) → _Platform_
    - `wvwellheader.fieldname` (w=20) → _Field_
    - `wvwellheader.wellconfig` (w=20) → _Wellconfig_
    - `wvwellheader.elvorigkb` (w=10) → _Elvorigkb_
    - `wvwellheader.kbtotubcalc` (w=10) → _Kbtotub (computed)_
    - `wvjob.dttmstart` (w=10) → _Start Date/Time_
    - `wvjob.dttmend` (w=10) → _End Date/Time_

## Completion/CW Summary

### AFE vs Field Est (Multi AFE)

- **HTML:** [Completion/CW Summary/AFE vs Field Est (Multi AFE).html](Completion/CW%20Summary/AFE%20vs%20Field%20Est%20%28Multi%20AFE%29.html)
- **Paper:** letter · **margins** [25, 25, 25, 25] (1/100 in)
- **Master template:** template portrait header.afr
- **Root table:** `wvjobafe` · **filter:** wvjob / wvtyp / drill
- **Blocks:** 3

  - **Job** — `wvjob` (11 fields)
    - `wvjob.wvtyp` (w=10) → _Wvtyp_
    - `wvjob.jobtyp` (w=10) → _Jobtyp_
    - `wvjob.dttmstart` (w=10) → _Start Date/Time_
    - `wvjob.dttmend` (w=10) → _End Date/Time_
    - `wvjob.status1` (w=10) → _Status1_
    - `wvjob.afetotalcalc` (w=10) → _AFE Total_
    - `wvjob.afeamtcalc` (w=10) → _Afeamt (computed)_
    - `wvjob.afesupamtcalc` (w=10) → _Afesupamt (computed)_
    - `wvjob.costtotalcalc` (w=10) → _Daily Cost Total_
    - `wvjob.variancefieldcalc` (w=10) → _Variancefield (computed)_
    - `wvjob.summary` (w=50) → _Summary_
  - **Job Summary** — `wvjobafe` (10 fields)
    - `wvjobafe.afenumber` (w=10) → _Afenumber_
    - `wvjobafe.afenumbersupp` (w=10) → _Afenumbersupp_
    - `wvjobafe.typ` (w=10) → _Type_
    - `wvjobafe.dttmafe` (w=10) → _Date/Time Afe_
    - `wvjobafe.afestatus` (w=10) → _Afestatus_
    - `wvjobafe.afetotalcalc` (w=10) → _AFE Total_
    - `wvjobafe.afeamtcalc` (w=10) → _Afeamt (computed)_
    - `wvjobafe.afesupamtcalc` (w=10) → _Afesupamt (computed)_
    - `wvjobafe.costtotalcalc` (w=10) → _Daily Cost Total_
    - `wvjobafe.variancefieldcalc` (w=10) → _Variancefield (computed)_
  - **Jafecostcumcalc** — `wvjafecostcumcalc` (8 fields)
    - `wvjafecostcumcalc.des` (w=25) → _Description_
    - `wvjafecostcumcalc.code1` (w=10) → _Code 1_
    - `wvjafecostcumcalc.code2` (w=10) → _Code 2_
    - `wvjafecostcumcalc.costafe` (w=10) → _Costafe_
    - `wvjafecostcumcalc.costafesup` (w=10) → _Costafesup_
    - `wvjafecostcumcalc.costafetotal` (w=10) → _Costafetotal_
    - `wvjafecostcumcalc.costfieldest` (w=10) → _Costfieldest_
    - `wvjafecostcumcalc.costvar` (w=10) → _Costvar_

### AFE vs Field Est vs Final Invoice

- **HTML:** [Completion/CW Summary/AFE vs Field Est vs Final Invoice.html](Completion/CW%20Summary/AFE%20vs%20Field%20Est%20vs%20Final%20Invoice.html)
- **Paper:** letter · **margins** [25, 25, 25, 25] (1/100 in)
- **Master template:** template portrait header.afr
- **Root table:** `wvjob` · **filter:** wvjob / wvtyp / drill
- **Blocks:** 2

  - **Job** — `wvjob` (11 fields)
    - `wvjob.wvtyp` (w=10) → _Wvtyp_
    - `wvjob.jobtyp` (w=10) → _Jobtyp_
    - `wvjob.dttmstart` (w=10) → _Start Date/Time_
    - `wvjob.dttmend` (w=10) → _End Date/Time_
    - `wvjob.status1` (w=10) → _Status1_
    - `wvjob.afenumbercalc` (w=10) → _AFE Number_
    - `wvjob.afeamtcalc` (w=10) → _Afeamt (computed)_
    - `wvjob.afesupamtcalc` (w=10) → _Afesupamt (computed)_
    - `wvjob.costtotalcalc` (w=10) → _Daily Cost Total_
    - `wvjob.variancefieldcalc` (w=10) → _Variancefield (computed)_
    - `wvjob.summary` (w=50) → _Summary_
  - **Jcostcumcalc** — `wvjcostcumcalc` (8 fields)
    - `wvjcostcumcalc.des` (w=25) → _Description_
    - `wvjcostcumcalc.code1` (w=10) → _Code 1_
    - `wvjcostcumcalc.code2` (w=10) → _Code 2_
    - `wvjcostcumcalc.costafe` (w=10) → _Costafe_
    - `wvjcostcumcalc.costafesup` (w=10) → _Costafesup_
    - `wvjcostcumcalc.costfieldest` (w=10) → _Costfieldest_
    - `wvjcostcumcalc.costfinalinvoice` (w=10) → _Costfinalinvoice_
    - `wvjcostcumcalc.costvar` (w=10) → _Costvar_

### AFE vs Field Est

- **HTML:** [Completion/CW Summary/AFE vs Field Est.html](Completion/CW%20Summary/AFE%20vs%20Field%20Est.html)
- **Paper:** letter · **margins** [25, 25, 25, 25] (1/100 in)
- **Master template:** template portrait header cw.afr
- **Root table:** `wvjob` · **filter:** wvjob / wvtyp / drill*
- **Blocks:** 2

  - **Job** — `wvjob` (13 fields)
    - `wvjob.wvtyp` (w=10) → _Wvtyp_
    - `wvjob.jobtyp` (w=10) → _Jobtyp_
    - `wvjob.jobsubtyp` (w=10) → _Jobsubtyp_
    - `wvjob.dttmstart` (w=10) → _Start Date/Time_
    - `wvjob.dttmend` (w=10) → _End Date/Time_
    - `wvjob.status1` (w=10) → _Status1_
    - `wvjob.afenumbercalc` (w=10) → _AFE Number_
    - `wvjob.afetotalcalc` (w=10) → _AFE Total_
    - `wvjob.afeamtcalc` (w=10) → _Afeamt (computed)_
    - `wvjob.afesupamtcalc` (w=10) → _Afesupamt (computed)_
    - `wvjob.costtotalcalc` (w=10) → _Daily Cost Total_
    - `wvjob.variancefieldcalc` (w=10) → _Variancefield (computed)_
    - `wvjob.summary` (w=50) → _Summary_
  - **Jcostcumcalc** — `wvjcostcumcalc` (7 fields)
    - `wvjcostcumcalc.des` (w=25) → _Description_
    - `wvjcostcumcalc.code1` (w=10) → _Code 1_
    - `wvjcostcumcalc.code2` (w=10) → _Code 2_
    - `wvjcostcumcalc.costafe` (w=10) → _Costafe_
    - `wvjcostcumcalc.costafesup` (w=10) → _Costafesup_
    - `wvjcostcumcalc.costfieldest` (w=10) → _Costfieldest_
    - `wvjcostcumcalc.costvar` (w=10) → _Costvar_

### Attached Image Files

- **HTML:** [Completion/CW Summary/Attached Image Files.html](Completion/CW%20Summary/Attached%20Image%20Files.html)
- **Paper:** letter · **margins** [25, 25, 25, 25] (1/100 in)
- **Master template:** template portrait header.afr
- **Root table:** `wvattachment`
- **Blocks:** 0


### Attachments

- **HTML:** [Completion/CW Summary/Attachments.html](Completion/CW%20Summary/Attachments.html)
- **Paper:** letter · **margins** [25, 25, 25, 25] (1/100 in)
- **Master template:** template portrait header.afr
- **Root table:** `None`
- **Blocks:** 1

  - **Attachment** — `wvattachment` (7 fields)
    - `wvattachment.typ1` (w=10) → _Typ1_
    - `wvattachment.typ2` (w=10) → _Typ2_
    - `wvattachment.des` (w=25) → _Description_
    - `wvattachment.dttm` (w=10) → _Dttm_
    - `wvattachment.attachida` (w=5) → _Attachida_
    - `wvattachment.tblkeyparent` (w=10) → _Tblkeyparent_
    - `wvattachment.attachextension` (w=5) → _Attachextension_

### Cost by Vendor

- **HTML:** [Completion/CW Summary/Cost by Vendor.html](Completion/CW%20Summary/Cost%20by%20Vendor.html)
- **Paper:** letter · **margins** [25, 25, 25, 25] (1/100 in)
- **Master template:** template portrait header.afr
- **Root table:** `wvjvendorcalc` · **filter:** wvjob / wvtyp / drill; wvjobreportcostgen / vendor; wvjvendorcalc / vendor; wvjob / idrec; wvjob / idrec; wvjobreport / reportnocalc; wvjobreportcostrental / vendorcalc; wvjvendorcalc / vendor; wvjob / idrec; wvjob / idrec; wvjobreport / reportnocalc
- **Captions:**
  - `<wvjvendorcalc.vendor>`
  - `<wvjvendorcalc.vendor>`
  - `AFE#:  <wvjob.afenumbercalc>`
- **Blocks:** 4

  - **Job** — `wvjob` (4 fields)
    - `wvjob.wvtyp` (w=10) → _Wvtyp_
    - `wvjob.jobtyp` (w=10) → _Jobtyp_
    - `wvjob.dttmstart` (w=10) → _Start Date/Time_
    - `wvjob.dttmend` (w=10) → _End Date/Time_
  - **Jvendorcalc** — `wvjvendorcalc` (2 fields)
    - `wvjvendorcalc.vendor` (w=10) → _Vendor_
    - `wvjvendorcalc.cost` (w=10) → _Cost_
  - **Daily Cost — General** — `wvjobreportcostgen` (8 fields)
    - `wvjobreport.reportnocalc` (w=5) → _Report #_
    - `wvjobreport.dttmstart` (w=10) → _Start Date/Time_
    - `wvjobreportcostgen.code1` (w=5) → _Code 1_
    - `wvjobreportcostgen.code2` (w=5) → _Code 2_
    - `wvjobreportcostgen.des` (w=25) → _Description_
    - `wvjobreportcostgen.cost` (w=9) → _Cost_
    - `wvjobreportcostgen.note` (w=20) → _Note_
    - `wvjobreportcostgen.ticketno` (w=10) → _Ticket Number_
  - **Jobreportcostrental** — `wvjobreportcostrental` (8 fields)
    - `wvjobreport.reportnocalc` (w=5) → _Report #_
    - `wvjobreport.dttmstart` (w=10) → _Start Date/Time_
    - `wvjobreportcostrental.code1calc` (w=5) → _Code 1 (computed)_
    - `wvjobreportcostrental.code2calc` (w=5) → _Code 2 (computed)_
    - `wvjobreportcostrental.descalc` (w=25) → _Description (computed)_
    - `wvjobreportcostrental.costrentalcalc` (w=9) → _Costrental (computed)_
    - `wvjobreportcostrental.note` (w=20) → _Note_
    - `wvjobreportcostrental.ticketno` (w=10) → _Ticket Number_

### Field Est Cost Summary - Graph

- **HTML:** [Completion/CW Summary/Field Est Cost Summary - Graph.html](Completion/CW%20Summary/Field%20Est%20Cost%20Summary%20-%20Graph.html)
- **Paper:** letter · **margins** [25, 25, 25, 25] (1/100 in)
- **Master template:** template portrait header.afr
- **Root table:** `wvjob` · **filter:** wvjob / wvtyp / Drilling; wvjcostsumdailydescalc / cost
- **Captions:**
  - `<wvjcostsumdailydescalc.cost>`
- **Blocks:** 2

  - **Job** — `wvjob` (7 fields)
    - `wvjob.afenumbercalc` (w=10) → _AFE Number_
    - `wvjob.wvtyp` (w=10) → _Wvtyp_
    - `wvjob.jobtyp` (w=10) → _Jobtyp_
    - `wvjob.dttmstart` (w=10) → _Start Date/Time_
    - `wvjob.dttmend` (w=10) → _End Date/Time_
    - `wvjob.status1` (w=10) → _Status1_
    - `wvjob.objective` (w=30) → _Objective_
  - **Jcostsumdailydescalc** — `wvjcostsumdailydescalc` (1 fields)
    - `wvjcostsumdailydescalc.cost` (w=0) → _Cost_

### Daily Activity and Cost Summary

- **HTML:** [Completion/CW Summary/Daily Activity and Cost Summary.html](Completion/CW%20Summary/Daily%20Activity%20and%20Cost%20Summary.html)
- **Paper:** letter · **margins** [25, 25, 25, 25] (1/100 in)
- **Master template:** template portrait header cw.afr
- **Root table:** `wvjob` · **filter:** wvjob / wvtyp / Drilling
- **Blocks:** 3

  - **Job** — `wvjob` (10 fields)
    - `wvjob.wvtyp` (w=10) → _Wvtyp_
    - `wvjob.jobtyp` (w=10) → _Jobtyp_
    - `wvjob.jobsubtyp` (w=10) → _Jobsubtyp_
    - `wvjob.status1` (w=10) → _Status1_
    - `wvjob.afenumbercalc` (w=10) → _AFE Number_
    - `wvjob.dttmstart` (w=10) → _Start Date/Time_
    - `wvjob.dttmend` (w=10) → _End Date/Time_
    - `wvjob.afeamtcalc` (w=10) → _Afeamt (computed)_
    - `wvjob.objective` (w=30) → _Objective_
    - `wvjob.summary` (w=50) → _Summary_
  - **Rig** — `wvjobrig` (3 fields)
    - `wvjobrig.contractor` (w=10) → _Contractor_
    - `wvjobrig.rigno` (w=5) → _Rigno_
    - `wvjobrig.typ1` (w=10) → _Typ1_
  - **Daily Report** — `wvjobreport` (6 fields)
    - `wvjobreport.reportnocalc` (w=4) → _Report #_
    - `wvjobreport.dttmstart` (w=8) → _Start Date/Time_
    - `wvjobreport.dttmend` (w=8) → _End Date/Time_
    - `wvjobreport.costtotalcalc` (w=10) → _Daily Cost Total_
    - `wvjobreport.costtodatecalc` (w=10) → _Cost To Date_
    - `wvjobreport.summaryops` (w=40) → _Summaryops_

### Downhole Well Profile

- **HTML:** [Completion/CW Summary/Downhole Well Profile.html](Completion/CW%20Summary/Downhole%20Well%20Profile.html)
- **Paper:** letter · **margins** [25, 25, 25, 25] (1/100 in)
- **Master template:** template portrait header cw.afr
- **Root table:** `wvwellbore` · **filter:** wvtub / dttmpull
- **Blocks:** 9

  - **Cas** — `wvcas` (6 fields)
    - `wvcas.des` (w=18) → _Description_
    - `wvcas.szodnommaxcalc` (w=9) → _Szodnommax (computed)_
    - `wvcas.wtperlengthcalc` (w=9) → _Wtperlength (computed)_
    - `wvcas.gradecalc` (w=9) → _Grade (computed)_
    - `wvcas.connthrdtopcalc` (w=10) → _Connthrdtop (computed)_
    - `wvcas.depthbtm` (w=9) → _Bottom Depth_
  - **Perforation** — `wvperforation` (4 fields)
    - `wvperforation.dttm` (w=9) → _Dttm_
    - `wvperforation.depthtop` (w=9) → _Top Depth_
    - `wvperforation.depthbtm` (w=9) → _Bottom Depth_
    - `wvperforation.idreczone` (w=18) → _Idreczone_
  - **Tub** — `wvtub` (4 fields)
    - `wvtub.des` (w=9) → _Description_
    - `wvtub.dttmrun` (w=9) → _Date/Time Run_
    - `wvtub.lengthcalc` (w=9) → _Length (computed)_
    - `wvtub.depthbtm` (w=9) → _Bottom Depth_
  - **Tubcomp** — `wvtubcomp` (8 fields)
    - `wvtubcomp.des` (w=25) → _Description_
    - `wvtubcomp.joints` (w=4) → _Joints_
    - `wvtubcomp.make` (w=15) → _Make_
    - `wvtubcomp.model` (w=15) → _Model_
    - `wvtubcomp.szodnom` (w=7) → _Szodnom_
    - `wvtubcomp.wtperlength` (w=8) → _Wtperlength_
    - `wvtubcomp.grade` (w=7) → _Grade_
    - `wvtubcomp.length` (w=7) → _Length_
  - **Rod String** — `wvrod` (4 fields)
    - `wvrod.des` (w=9) → _Description_
    - `wvrod.dttmrun` (w=9) → _Date/Time Run_
    - `wvrod.lengthcalc` (w=9) → _Length (computed)_
    - `wvrod.depthbtm` (w=9) → _Bottom Depth_
  - **Rodcomp** — `wvrodcomp` (8 fields)
    - `wvrodcomp.des` (w=25) → _Description_
    - `wvrodcomp.joints` (w=4) → _Joints_
    - `wvrodcomp.make` (w=15) → _Make_
    - `wvrodcomp.model` (w=15) → _Model_
    - `wvrodcomp.szodnom` (w=7) → _Szodnom_
    - `wvrodcomp.wtperlength` (w=8) → _Wtperlength_
    - `wvrodcomp.grade` (w=7) → _Grade_
    - `wvrodcomp.length` (w=7) → _Length_
  - **& production\tubing and rods.sch** — `wvrod` (1 fields)
    - `wvwellbore.idrec` (w=0) → _Record ID_
  - **Wellhead** — `wvwellhead` (1 fields)
    - `wvwellhead.typ` (w=15) → _Type_
  - **Wellheadcomp** — `wvwellheadcomp` (8 fields)
    - `wvwellheadcomp.des` (w=20) → _Description_
    - `wvwellheadcomp.make` (w=9) → _Make_
    - `wvwellheadcomp.model` (w=9) → _Model_
    - `wvwellheadcomp.workpres` (w=9) → _Workpres_
    - `wvwellheadcomp.service` (w=9) → _Service_
    - `wvwellheadcomp.workprestop` (w=18) → _Workprestop_
    - `wvwellheadcomp.ringgaskettop` (w=9) → _Ringgaskettop_
    - `wvwellheadcomp.minbore` (w=9) → _Min Bore_

### Time Log Summary

- **HTML:** [Completion/CW Summary/Time Log Summary.html](Completion/CW%20Summary/Time%20Log%20Summary.html)
- **Paper:** letter · **margins** [25, 25, 25, 25] (1/100 in)
- **Master template:** template portrait header.afr
- **Root table:** `wvjob` · **filter:** wvjob / wvtyp / drill
- **Captions:**
  - `AFE#:  <wvjob.afenumbercalc>`
- **Blocks:** 6

  - **Jtlsumcode1Calc** — `wvjtlsumcode1calc` (3 fields)
    - `wvjtlsumcode1calc.code1` (w=10) → _Code 1_
    - `wvjtlsumcode1calc.duration` (w=10) → _Duration Ation_
    - `wvjtlsumcode1calc.fractiontotaltime` (w=10) → _Fractiontotaltime_
  - **Jtlsumcode2Calc** — `wvjtlsumcode2calc` (3 fields)
    - `wvjtlsumcode2calc.code2` (w=10) → _Code 2_
    - `wvjtlsumcode2calc.duration` (w=10) → _Duration Ation_
    - `wvjtlsumcode2calc.fractiontotaltime` (w=10) → _Fractiontotaltime_
  - **Jtlsumcode3Calc** — `wvjtlsumcode3calc` (3 fields)
    - `wvjtlsumcode3calc.code3` (w=10) → _Code3_
    - `wvjtlsumcode3calc.duration` (w=10) → _Duration Ation_
    - `wvjtlsumcode3calc.fractiontotaltime` (w=10) → _Fractiontotaltime_
  - **Jtlsumunschedtypcalc** — `wvjtlsumunschedtypcalc` (3 fields)
    - `wvjtlsumunschedtypcalc.unschedtyp` (w=10) → _Unschedtyp_
    - `wvjtlsumunschedtypcalc.duration` (w=10) → _Duration Ation_
    - `wvjtlsumunschedtypcalc.fractiontotaltime` (w=10) → _Fractiontotaltime_
  - **Job** — `wvjob` (5 fields)
    - `wvjob.wvtyp` (w=15) → _Wvtyp_
    - `wvjob.jobtyp` (w=15) → _Jobtyp_
    - `wvjob.dttmstart` (w=15) → _Start Date/Time_
    - `wvjob.dttmend` (w=15) → _End Date/Time_
    - `wvjob.summary` (w=50) → _Summary_
  - **Jtlsumcalc** — `wvjtlsumcalc` (6 fields)
    - `wvjtlsumcalc.code1` (w=10) → _Code 1_
    - `wvjtlsumcalc.code2` (w=10) → _Code 2_
    - `wvjtlsumcalc.code3` (w=10) → _Code3_
    - `wvjtlsumcalc.unschedtyp` (w=10) → _Unschedtyp_
    - `wvjtlsumcalc.duration` (w=10) → _Duration Ation_
    - `wvjtlsumcalc.fractiontotaltime` (w=10) → _Fractiontotaltime_

### Time Log Summary - Graph

- **HTML:** [Completion/CW Summary/Time Log Summary - Graph.html](Completion/CW%20Summary/Time%20Log%20Summary%20-%20Graph.html)
- **Paper:** letter · **margins** [25, 25, 25, 25] (1/100 in)
- **Master template:** template portrait header.afr
- **Root table:** `wvjob` · **filter:** wvjob / wvtyp / drill; wvjtlsumcode1calc / duration; wvjtlsumcode2calc / duration; wvjtlsumunschedtypcalc / duration
- **Captions:**
  - `<wvjtlsumcode1calc.fractiontotaltime>`
  - `AFE#:  <wvjob.afenumbercalc>`
- **Blocks:** 4

  - **Job** — `wvjob` (5 fields)
    - `wvjob.wvtyp` (w=15) → _Wvtyp_
    - `wvjob.jobtyp` (w=15) → _Jobtyp_
    - `wvjob.dttmstart` (w=15) → _Start Date/Time_
    - `wvjob.dttmend` (w=15) → _End Date/Time_
    - `wvjob.objective` (w=30) → _Objective_
  - **Jtlsumcode1Calc** — `wvjtlsumcode1calc` (1 fields)
    - `wvjtlsumcode1calc.duration` (w=0) → _Duration Ation_
  - **Jtlsumcode2Calc** — `wvjtlsumcode2calc` (1 fields)
    - `wvjtlsumcode2calc.duration` (w=0) → _Duration Ation_
  - **Jtlsumunschedtypcalc** — `wvjtlsumunschedtypcalc` (1 fields)
    - `wvjtlsumunschedtypcalc.duration` (w=0) → _Duration Ation_

### Well History

- **HTML:** [Completion/CW Summary/Well History.html](Completion/CW%20Summary/Well%20History.html)
- **Paper:** letter · **margins** [25, 0, 25, 25] (1/100 in)
- **Master template:** template portrait header.afr
- **Root table:** `wvcas` · **filter:** wvtub / dttmrun; wvtub / dttmpull; wvcement / dttmstart; wvstimtreat / dttm; wvzone / dttmzonelic; wvwellboresize / dttmstart; wvwellhead / dttmstart; wvtestleakoff / dttm; wvtestequip / dttm; wvotherinhole / dttmrun; wvperforation / dttm; wvotherstr / dttmrun; wvlog / dttm; wvswab / dttm; wvtestsssv / dttm
- **Captions:**
  - `@RCasing Description: <wvcas.des>; Set Depth: <wvcas.depthbtm>; `
  - `@RTubing Description: <wvtub.des>; Set Depth: <wvtub.depthbtm>; `
  - `@VTubing Description: <wvtub.des>; Pull Reason: <wvtub.pullreaso`
  - `@RDescription: <wvcement.des>; Eval Res: <wvcement.deseval>; Com`
  - `@RZone: <wvstimtreat.idreczone>; Type: <wvstimtreat.typ>; Commen`
  - `@^Zone: <wvzone.zonename>; Top: <wvzone.depthtop>; Btm: <wvzone.`
  - `ction: <wvwellboresize.des>; Size: <wvwellboresize.sz>; Act Top: <wvwellboresize.depthtopactual>; Act`
  - `Btm: <wvwellboresize.depthbtmact`
  - `@dMake: <wvwellhead.make>; Size: <wvwellhead.sz>; WP: <wvwellhea`
  - `pth: <wvtestleakoff.depth>; Formation Tested: <wvtestleakoff.idrecfrm>; P (Surf): <wvtestleakoff.leak`
  - `pe: <wvtestequip.testtyp>; Item Tested: <wvtestequip.idrectestitem>; Well Pres: <wvtestequip.wellpresused>; Comment: <wvt`
  - `@{Description: <wvotherinhole.des>; Top: <wvotherinhole.depthtop`
  - ` Btm: <wvotherinhole.depthbtm>; OD: <wvotherinhole.szodnom>`
  - `ne: <wvperforation.idreczone>; Top: <wvperforation.depthtop>; Btm: <wvperforation.depthbtm>; Shot Dens: <wvperf`
  - `@FString Description: <wvotherstr.des>; Set Depth: <wvotherstr.d`
  - `@UType: <wvlog.typ>; Top: <wvlog.depthtop>; Btm: <wvlog.depthbtm`
  - `Zone: <wvswab.idreczone>`
  - `SSSV Tested: <wvtestsssv.idrectubcomp>`
- **Blocks:** 0


## Drilling/Job Setup

### Job Setup

- **HTML:** [Drilling/Job Setup/Job Setup.html](Drilling/Job%20Setup/Job%20Setup.html)
- **Paper:** letter · **margins** [25, 25, 25, 25] (1/100 in)
- **Master template:** template portrait.afr
- **Root table:** `wvjob` · **filter:** wvjob / wvtyp / dril
- **Blocks:** 4

  - **Well Header** — `wvwellheader` (1 fields)
    - `wvwellheader.directionstowell` (w=50) → _Directionstowell_
  - **Directions to Location** — `wvjob` (7 fields)
    - `wvjob.wvtyp` (w=9) → _Wvtyp_
    - `wvjob.jobtyp` (w=9) → _Jobtyp_
    - `wvjob.dttmstart` (w=9) → _Start Date/Time_
    - `wvjob.dttmend` (w=9) → _End Date/Time_
    - `wvjob.targetdepth` (w=9) → _Target Depth_
    - `wvjob.targetform` (w=9) → _Target Formation_
    - `wvjob.objective` (w=30) → _Objective_
  - **Jobcontact** — `wvjobcontact` (4 fields)
    - `wvjobcontact.company` (w=15) → _Company_
    - `wvjobcontact.contactname` (w=15) → _Contactname_
    - `wvjobcontact.title` (w=15) → _Title_
    - `wvjobcontact.phonemobile` (w=10) → _Phonemobile_
  - **Click on the 'New' button to start a new job.** — `wvwellheader` (10 fields)
    - `wvwellheader.wellida` (w=10) → _Well ID_
    - `wvwellheader.fieldname` (w=10) → _Field_
    - `wvwellheader.welllicenseno` (w=10) → _Welllicenseno_
    - `wvwellheader.welltyp1` (w=10) → _Welltyp1_
    - `wvwellheader.wellconfig` (w=10) → _Wellconfig_
    - `wvwellheader.elvground` (w=10) → _Elvground_
    - `wvwellheader.elvorigkb` (w=10) → _Elvorigkb_
    - `wvwellheader.kbtogrdcalc` (w=10) → _Kbtogrd (computed)_
    - `wvwellheader.dttmspud` (w=10) → _Spud Date/Time_
    - `wvwellheader.dttmwelllic` (w=10) → _Date/Time Welllic_

### AFE

- **HTML:** [Drilling/Job Setup/AFE.html](Drilling/Job%20Setup/AFE.html)
- **Paper:** letter · **margins** [25, 25, 25, 25] (1/100 in)
- **Master template:** template portrait header.afr
- **Root table:** `wvjob` · **filter:** wvjob / wvtyp / drill
- **Blocks:** 3

  - **Job** — `wvjob` (8 fields)
    - `wvjob.wvtyp` (w=9) → _Wvtyp_
    - `wvjob.jobtyp` (w=9) → _Jobtyp_
    - `wvjob.jobsubtyp` (w=9) → _Jobsubtyp_
    - `wvjob.dttmstart` (w=9) → _Start Date/Time_
    - `wvjob.dttmend` (w=9) → _End Date/Time_
    - `wvjob.targetdepth` (w=9) → _Target Depth_
    - `wvjob.targetform` (w=9) → _Target Formation_
    - `wvjob.objective` (w=30) → _Objective_
  - **AFE** — `wvjobafe` (8 fields)
    - `wvjobafe.afenumber` (w=10) → _Afenumber_
    - `wvjobafe.dttmafe` (w=10) → _Date/Time Afe_
    - `wvjobafe.typ` (w=10) → _Type_
    - `wvjobafe.afenumbersupp` (w=10) → _Afenumbersupp_
    - `wvjobafe.afetotalcalc` (w=10) → _AFE Total_
    - `wvjobafe.afeamtcalc` (w=10) → _Afeamt (computed)_
    - `wvjobafe.afesupamtcalc` (w=10) → _Afesupamt (computed)_
    - `wvjobafe.afestatus` (w=10) → _Afestatus_
  - **Jobafecost** — `wvjobafecost` (6 fields)
    - `wvjobafecost.des` (w=25) → _Description_
    - `wvjobafecost.code1` (w=10) → _Code 1_
    - `wvjobafecost.code2` (w=10) → _Code 2_
    - `wvjobafecost.amount` (w=10) → _Amount_
    - `wvjobafecost.amountsuppdttm` (w=10) → _Amountsuppdttm_
    - `wvjobafecost.amountsupp` (w=10) → _Amountsupp_

### Job Phases

- **HTML:** [Drilling/Job Setup/Job Phases.html](Drilling/Job%20Setup/Job%20Phases.html)
- **Paper:** letter · **margins** [12, 12, 31, 25] (1/100 in)
- **Master template:** template landscape.afr
- **Root table:** `wvjob` · **filter:** wvjob / wvtyp / dril
- **Captions:**
  - `@B<wvjobprogramphase.code1>; <wvjobprogramphase.dttmstartplanmlc`
- **Blocks:** 8

  - **Job** — `wvjob` (10 fields)
    - `wvjob.wvtyp` (w=10) → _Wvtyp_
    - `wvjob.jobtyp` (w=10) → _Jobtyp_
    - `wvjob.afenumbercalc` (w=10) → _AFE Number_
    - `wvjob.targetdepth` (w=10) → _Target Depth_
    - `wvjob.targetform` (w=10) → _Target Formation_
    - `wvjob.dttmstartplan` (w=10) → _Date/Time Startplan_
    - `wvjob.dttmstart` (w=10) → _Start Date/Time_
    - `wvjob.dttmendplanmincalc` (w=10) → _Date/Time Endplanmin (computed)_
    - `wvjob.dttmendplanmlcalc` (w=10) → _Date/Time Endplanml (computed)_
    - `wvjob.dttmendplanmaxcalc` (w=10) → _Date/Time Endplanmax (computed)_
  - **Jobprogramphase** — `wvjobprogramphase` (12 fields)
    - `wvjobprogramphase.code1` (w=20) → _Code 1_
    - `wvjobprogramphase.code2` (w=20) → _Code 2_
    - `wvjobprogramphase.depthstartplan` (w=9) → _Depth Startplan_
    - `wvjobprogramphase.depthendplan` (w=9) → _Depth Endplan_
    - `wvjobprogramphase.idrecwellbore` (w=15) → _Idrecwellbore_
    - `wvjobprogramphase.durationmin` (w=6) → _Duration Min_
    - `wvjobprogramphase.durationml` (w=6) → _Duration Ml_
    - `wvjobprogramphase.durationmax` (w=6) → _Duration Max_
    - `wvjobprogramphase.dayjobmlplancalc` (w=6) → _Dayjobmlplan (computed)_
    - `wvjobprogramphase.costml` (w=12) → _Costml_
    - `wvjobprogramphase.costmlcumcalc` (w=12) → _Costml (cumulative) (computed)_
    - `wvjobprogramphase.planphase` (w=30) → _Planphase_
  - **Jobprogramphase** — `wvjobprogramphase` (1 fields)
    - `wvjobprogramphase.costmaxcumcalc` (w=0) → _Costmax (cumulative) (computed)_
  - **Jobprogramphase** — `wvjobprogramphase` (1 fields)
    - `wvjobprogramphase.costmincumcalc` (w=0) → _Costmin (cumulative) (computed)_
  - **Jobprogramphase** — `wvjobprogramphase` (1 fields)
    - `wvjobprogramphase.costmlcumcalc` (w=0) → _Costml (cumulative) (computed)_
  - **Jobprogramphase** — `wvjobprogramphase` (1 fields)
    - `wvjobprogramphase.depthendplan` (w=0) → _Depth Endplan_
  - **Jobprogramphase** — `wvjobprogramphase` (1 fields)
    - `wvjobprogramphase.depthendplan` (w=0) → _Depth Endplan_
  - **Jobprogramphase** — `wvjobprogramphase` (1 fields)
    - `wvjobprogramphase.depthendplan` (w=256) → _Depth Endplan_

### Bit Inventory

- **HTML:** [Drilling/Job Setup/Bit Inventory.html](Drilling/Job%20Setup/Bit%20Inventory.html)
- **Paper:** letter · **margins** [25, 25, 25, 25] (1/100 in)
- **Master template:** template portrait.afr
- **Root table:** `wvjob` · **filter:** wvjob / wvtyp / dril
- **Blocks:** 1

  - **Jobdrillbit** — `wvjobdrillbit` (7 fields)
    - `wvjobdrillbit.typ` (w=10) → _Type_
    - `wvjobdrillbit.iconname` (w=8) → _Iconname_
    - `wvjobdrillbit.make` (w=10) → _Make_
    - `wvjobdrillbit.model` (w=10) → _Model_
    - `wvjobdrillbit.sn` (w=10) → _Serial Number_
    - `wvjobdrillbit.szoddrill` (w=5) → _Szoddrill_
    - `wvjobdrillbit.length` (w=5) → _Length_

### Mud Program

- **HTML:** [Drilling/Job Setup/Mud Program.html](Drilling/Job%20Setup/Mud%20Program.html)
- **Paper:** letter · **margins** [12, 12, 31, 25] (1/100 in)
- **Master template:** template landscape.afr
- **Root table:** `wvjob` · **filter:** wvjob / wvtyp / drill
- **Blocks:** 5

  - **Job** — `wvjob` (5 fields)
    - `wvjob.wvtyp` (w=10) → _Wvtyp_
    - `wvjob.jobtyp` (w=10) → _Jobtyp_
    - `wvjob.afenumbercalc` (w=10) → _AFE Number_
    - `wvjob.targetdepth` (w=10) → _Target Depth_
    - `wvjob.targetform` (w=10) → _Target Formation_
  - **Jobprogrammud** — `wvjobprogrammud` (15 fields)
    - `wvjobprogrammud.depthstart` (w=10) → _Depth Start_
    - `wvjobprogrammud.depthend` (w=10) → _Depth End_
    - `wvjobprogrammud.des` (w=9) → _Description_
    - `wvjobprogrammud.idrecwellbore` (w=9) → _Idrecwellbore_
    - `wvjobprogrammud.mudtyp` (w=9) → _Mudtyp_
    - `wvjobprogrammud.densitymin` (w=6) → _Densitymin_
    - `wvjobprogrammud.densitymax` (w=6) → _Densitymax_
    - `wvjobprogrammud.phmin` (w=6) → _Phmin_
    - `wvjobprogrammud.phmax` (w=6) → _Phmax_
    - `wvjobprogrammud.filtratemin` (w=6) → _Filtratemin_
    - `wvjobprogrammud.filtratemax` (w=6) → _Filtratemax_
    - `wvjobprogrammud.plasticvismin` (w=6) → _Plasticvismin_
    - `wvjobprogrammud.plasticvismax` (w=6) → _Plasticvismax_
    - `wvjobprogrammud.yieldptmin` (w=6) → _Yieldptmin_
    - `wvjobprogrammud.yieldptmax` (w=6) → _Yieldptmax_
  - **Mud Check** — `wvjobreportmudchk` (1 fields)
    - `wvjobreportmudchk.depth` (w=0) → _Depth_
  - **Jobprogrammud** — `wvjobprogrammud` (1 fields)
    - `wvjobprogrammud.depthend` (w=0) → _Depth End_
  - **Jobprogrammud** — `wvjobprogrammud` (1 fields)
    - `wvjobprogrammud.depthend` (w=0) → _Depth End_

### Mud Inventory

- **HTML:** [Drilling/Job Setup/Mud Inventory.html](Drilling/Job%20Setup/Mud%20Inventory.html)
- **Paper:** letter · **margins** [25, 25, 25, 25] (1/100 in)
- **Master template:** template portrait.afr
- **Root table:** `wvjob` · **filter:** wvjob / wvtyp / drill; wvjob / idrec; wvjob / idrec
- **Blocks:** 2

  - **Job** — `wvjob` (4 fields)
    - `wvjob.wvtyp` (w=10) → _Wvtyp_
    - `wvjob.jobtyp` (w=10) → _Jobtyp_
    - `wvjob.afenumbercalc` (w=10) → _AFE Number_
    - `wvjob.status1` (w=10) → _Status1_
  - **Mud Additive Inventory** — `wvjobmudadd` (10 fields)
    - `wvjobmudadd.des` (w=20) → _Description_
    - `wvjobmudadd.typ` (w=10) → _Type_
    - `wvjobmudadd.cost` (w=6) → _Cost_
    - `wvjobmudadd.unitlabel` (w=6) → _Unitlabel_
    - `wvjobmudadd.vendor` (w=10) → _Vendor_
    - `wvjobmudadd.code1` (w=5) → _Code 1_
    - `wvjobmudadd.code2` (w=5) → _Code 2_
    - `wvjobmudadd.codedes` (w=15) → _Codedes_
    - `wvjobmudadd.receivedcalc` (w=6) → _Received (computed)_
    - `wvjobmudadd.inventorycalc` (w=6) → _Inventory (computed)_

### Rig Equipment

- **HTML:** [Drilling/Job Setup/Rig Equipment.html](Drilling/Job%20Setup/Rig%20Equipment.html)
- **Paper:** letter · **margins** [25, 25, 25, 25] (1/100 in)
- **Master template:** template portrait.afr
- **Root table:** `None` · **filter:** wvjob / wvjob / jobtyp
- **Blocks:** 8

  - **Last 5 Checks** — `wvjobrig` (8 fields)
    - `wvjobrig.contractor` (w=20) → _Contractor_
    - `wvjobrig.rigno` (w=5) → _Rigno_
    - `wvjobrig.contracttyp` (w=5) → _Contracttyp_
    - `wvjobrig.dttmstart` (w=10) → _Start Date/Time_
    - `wvjobrig.dttmend` (w=10) → _End Date/Time_
    - `wvjobrig.idrecjobcontactcontractor` (w=20) → _Idrecjobcontactcontractor_
    - `wvjobcontact.phonemobile` (w=15) → _Phonemobile_
    - `wvjobrig.com` (w=35) → _Comment_
  - **Jobrigpump** — `wvjobrigpump` (7 fields)
    - `wvjobrigpump.des` (w=5) → _Description_
    - `wvjobrigpump.make` (w=15) → _Make_
    - `wvjobrigpump.model` (w=15) → _Model_
    - `wvjobrigpump.actiontyp` (w=15) → _Actual Iontyp_
    - `wvjobrigpump.powerrating` (w=6) → _Powerrating_
    - `wvjobrigpump.szodrod` (w=7) → _Szodrod_
    - `wvjobrigpump.strokelength` (w=7) → _Strokelength_
  - **Jobrigsolidsshaker** — `wvjobrigsolidsshaker` (5 fields)
    - `wvjobrigsolidsshaker.des` (w=25) → _Description_
    - `wvjobrigsolidsshaker.make` (w=15) → _Make_
    - `wvjobrigsolidsshaker.model` (w=15) → _Model_
    - `wvjobrigsolidsshaker.sn` (w=12) → _Serial Number_
    - `wvjobrigsolidsshaker.com` (w=30) → _Comment_
  - **Jobrigsolidscentcyc** — `wvjobrigsolidscentcyc` (7 fields)
    - `wvjobrigsolidscentcyc.typ` (w=15) → _Type_
    - `wvjobrigsolidscentcyc.make` (w=15) → _Make_
    - `wvjobrigsolidscentcyc.model` (w=15) → _Model_
    - `wvjobrigsolidscentcyc.sn` (w=12) → _Serial Number_
    - `wvjobrigsolidscentcyc.com` (w=30) → _Comment_
    - `wvjobrigsolidscentcyc.dttmstart` (w=10) → _Start Date/Time_
    - `wvjobrigsolidscentcyc.dttmend` (w=10) → _End Date/Time_
  - **Jobrigbop** — `wvjobrigbop` (6 fields)
    - `wvjobrigbop.des` (w=10) → _Description_
    - `wvjobrigbop.dttmstart` (w=10) → _Start Date/Time_
    - `wvjobrigbop.dttmend` (w=10) → _End Date/Time_
    - `wvjobrigbop.presrating` (w=10) → _Presrating_
    - `wvjobrigbop.service` (w=10) → _Service_
    - `wvjobrigbop.szheight` (w=10) → _Szheight_
  - **Jobrigbopcomp** — `wvjobrigbopcomp` (10 fields)
    - `wvjobrigbopcomp.typ` (w=10) → _Type_
    - `wvjobrigbopcomp.presrating` (w=10) → _Presrating_
    - `wvjobrigbopcomp.make` (w=10) → _Make_
    - `wvjobrigbopcomp.model` (w=10) → _Model_
    - `wvjobrigbopcomp.sn` (w=10) → _Serial Number_
    - `wvjobrigbopcomp.dttmlastcert` (w=10) → _Date/Time Lastcert_
    - `wvjobrigbopcomp.szpipebodymax` (w=10) → _Szpipebodymax_
    - `wvjobrigbopcomp.szpipebodymin` (w=10) → _Szpipebodymin_
    - `wvjobrigbopcomp.volclose` (w=10) → _Volclose_
    - `wvjobrigbopcomp.weightmaxhangoff` (w=10) → _Weightmaxhangoff_
  - **Jobrigotherequip** — `wvjobrigotherequip` (10 fields)
    - `wvjobrigotherequip.typ1` (w=10) → _Typ1_
    - `wvjobrigotherequip.typ2` (w=10) → _Typ2_
    - `wvjobrigotherequip.des` (w=10) → _Description_
    - `wvjobrigotherequip.dttmstart` (w=10) → _Start Date/Time_
    - `wvjobrigotherequip.dttmend` (w=10) → _End Date/Time_
    - `wvjobrigotherequip.make` (w=10) → _Make_
    - `wvjobrigotherequip.model` (w=10) → _Model_
    - `wvjobrigotherequip.sn` (w=10) → _Serial Number_
    - `wvjobrigotherequip.presmax` (w=10) → _Presmax_
    - `wvjobrigotherequip.com` (w=10) → _Comment_
  - **Jobrigtank** — `wvjobrigtank` (7 fields)
    - `wvjobrigtank.typ1` (w=10) → _Typ1_
    - `wvjobrigtank.typ2` (w=10) → _Typ2_
    - `wvjobrigtank.supplier` (w=10) → _Supplier_
    - `wvjobrigtank.volume` (w=10) → _Volume_
    - `wvjobrigtank.dttmstart` (w=10) → _Start Date/Time_
    - `wvjobrigtank.dttmend` (w=10) → _End Date/Time_
    - `wvjobrigtank.note` (w=10) → _Note_

### Stick Diagram

- **HTML:** [Drilling/Job Setup/Stick Diagram.html](Drilling/Job%20Setup/Stick%20Diagram.html)
- **Paper:** letter · **margins** [25, 25, 25, 25] (1/100 in)
- **Master template:** template landscape.afr
- **Root table:** `wvcas` · **filter:** wvjob / wvtyp / drill
- **Captions:**
  - `Wellbore:   <wvwellbore.des>`
- **Blocks:** 9

  - **& Geology\Casing & Formations Pr** — `wvwellbore` (1 fields)
    - `wvwellbore.idrec` (w=0) → _Record ID_
  - **Well Header** — `wvwellheader` (8 fields)
    - `wvwellheader.welltyp1` (w=10) → _Welltyp1_
    - `wvwellheader.wellconfig` (w=10) → _Wellconfig_
    - `wvwellheader.wellclass` (w=10) → _Wellclass_
    - `wvwellheader.riskclass` (w=10) → _Riskclass_
    - `wvwellheader.locationsensitive` (w=5) → _Locationsensitive_
    - `wvwellheader.elvorigkb` (w=5) → _Elvorigkb_
    - `wvwellheader.elvground` (w=5) → _Elvground_
    - `wvwellheader.waterdepth` (w=5) → _Waterdepth_
  - **Wellbore** — `wvwellbore` (4 fields)
    - `wvwellbore.des` (w=10) → _Description_
    - `wvwellbore.profiletyp` (w=10) → _Profiletyp_
    - `wvwellbore.kickoffdepth` (w=10) → _Kickoffdepth_
    - `wvwellbore.kickoffmethod` (w=10) → _Kickoffmethod_
  - **Proposed Wellbore Sections** — `wvwellboresize` (4 fields)
    - `wvwellboresize.des` (w=10) → _Description_
    - `wvwellboresize.sz` (w=10) → _Sz_
    - `wvwellboresize.depthtopprop` (w=10) → _Depth Topprop_
    - `wvwellboresize.depthbtmprop` (w=10) → _Depth Btmprop_
  - **Wellboreformation** — `wvwellboreformation` (13 fields)
    - `wvwellboreformation.formname` (w=20) → _Formname_
    - `wvwellboreformation.deslithology` (w=15) → _Description Lithology_
    - `wvwellboreformation.elementtyp` (w=10) → _Elementtyp_
    - `wvwellboreformation.depthssprogtop` (w=9) → _Depth Ssprogtop_
    - `wvwellboreformation.depthtvdprogtopcalc` (w=9) → _Depth TVD Progtop (computed)_
    - `wvwellboreformation.depthssprogbtm` (w=9) → _Depth Ssprogbtm_
    - `wvwellboreformation.depthtvdprogbtmcalc` (w=9) → _Depth TVD Progbtm (computed)_
    - `wvwellboreformation.depthmdprogtop` (w=9) → _Depth MD Progtop_
    - `wvwellboreformation.depthmdprogbtm` (w=9) → _Depth MD Progbtm_
    - `wvwellboreformation.porepres` (w=5) → _Porepres_
    - `wvwellboreformation.fracpres` (w=5) → _Fracpres_
    - `wvwellboreformation.h2sconc` (w=5) → _H2Sconc_
    - `wvwellboreformation.mudconsid` (w=35) → _Mudconsid_
  - **Job** — `wvjob` (4 fields)
    - `wvjob.wvtyp` (w=10) → _Wvtyp_
    - `wvjob.jobtyp` (w=10) → _Jobtyp_
    - `wvjob.dttmstartplan` (w=10) → _Date/Time Startplan_
    - `wvjob.afenumbercalc` (w=10) → _AFE Number_
  - **Jobprogramgeosample** — `wvjobprogramgeosample` (5 fields)
    - `wvjobprogramgeosample.idrecwellbore` (w=10) → _Idrecwellbore_
    - `wvjobprogramgeosample.noteintervaltop` (w=10) → _Number Teintervaltop_
    - `wvjobprogramgeosample.depthtop` (w=10) → _Top Depth_
    - `wvjobprogramgeosample.requiredby` (w=10) → _Requiredby_
    - `wvjobprogramgeosample.sampledby` (w=10) → _Sampledby_
  - **Jobprogrammud** — `wvjobprogrammud` (6 fields)
    - `wvjobprogrammud.des` (w=10) → _Description_
    - `wvjobprogrammud.depthstart` (w=10) → _Depth Start_
    - `wvjobprogrammud.depthend` (w=10) → _Depth End_
    - `wvjobprogrammud.densitymin` (w=10) → _Densitymin_
    - `wvjobprogrammud.densitymax` (w=10) → _Densitymax_
    - `wvjobprogrammud.com` (w=20) → _Comment_
  - **Proposed Casing Strings** — `wvcas` (6 fields)
    - `wvcas.des` (w=10) → _Description_
    - `wvcas.proposedrun` (w=5) → _Proposedrun_
    - `wvcas.depthbtm` (w=10) → _Bottom Depth_
    - `wvcas.szodnommaxcalc` (w=10) → _Szodnommax (computed)_
    - `wvcas.wtperlengthcalc` (w=10) → _Wtperlength (computed)_
    - `wvcas.gradecalc` (w=10) → _Grade (computed)_

### Tasks

- **HTML:** [Drilling/Job Setup/Tasks.html](Drilling/Job%20Setup/Tasks.html)
- **Paper:** letter · **margins** [12, 12, 31, 25] (1/100 in)
- **Master template:** template landscape.afr
- **Root table:** `wvtask`
- **Blocks:** 3

  - **Well Header** — `wvwellheader` (10 fields)
    - `wvwellheader.wellida` (w=7) → _Well ID_
    - `wvwellheader.legalsurveyloc` (w=7) → _Legalsurveyloc_
    - `wvwellheader.fieldname` (w=7) → _Field_
    - `wvwellheader.welllicenseno` (w=7) → _Welllicenseno_
    - `wvwellheader.stateprov` (w=7) → _Stateprov_
    - `wvwellheader.elvorigkb` (w=7) → _Elvorigkb_
    - `wvwellheader.elvground` (w=7) → _Elvground_
    - `wvwellheader.kbtogrdcalc` (w=7) → _Kbtogrd (computed)_
    - `wvwellheader.dttmspud` (w=7) → _Spud Date/Time_
    - `wvwellheader.dttmrr` (w=7) → _Date/Time Rr_
  - **Task** — `wvtask` (8 fields)
    - `wvtask.typ1` (w=10) → _Typ1_
    - `wvtask.typ2` (w=10) → _Typ2_
    - `wvtask.des` (w=10) → _Description_
    - `wvtask.com` (w=10) → _Comment_
    - `wvtask.dttmstartrecur` (w=10) → _Date/Time Startrecur_
    - `wvtask.dttmendrecur` (w=10) → _Date/Time Endrecur_
    - `wvtask.recurfrequency` (w=10) → _Recurfrequency_
    - `wvtask.recurnote` (w=10) → _Recurnote_
  - **Taskdetail** — `wvtaskdetail` (9 fields)
    - `wvtaskdetail.des` (w=15) → _Description_
    - `wvtaskdetail.typ1` (w=10) → _Typ1_
    - `wvtaskdetail.priority` (w=10) → _Priority_
    - `wvtaskdetail.status` (w=10) → _Status_
    - `wvtaskdetail.dttmrequest` (w=8) → _Date/Time Request_
    - `wvtaskdetail.dttmactionrqd` (w=8) → _Date/Time Actual Ionrqd_
    - `wvtaskdetail.dttmassigned` (w=8) → _Date/Time Assigned_
    - `wvtaskdetail.dttmcomplete` (w=8) → _Date/Time Complete_
    - `wvtaskdetail.actioncomplete` (w=5) → _Actual Ioncomplete_

## Drilling/Daily Input

### New Day Set-Up

- **HTML:** [Drilling/Daily Input/New Day Set-Up.html](Drilling/Daily%20Input/New%20Day%20Set-Up.html)
- **Paper:** letter · **margins** [25, 25, 25, 25] (1/100 in)
- **Master template:** template portrait.afr
- **Root table:** `wvjobreport` · **filter:** wvjob / wvtyp / drill; wvwellheader / wvjob
- **Captions:**
  - `Job Type:   <wvjob.jobtyp>`
  - `Date:   <wvjobreport.dttmend>, Report #:   <wvjobreport.reportnocalc>, DFS:   <wvjobreport.daysfromspudcalc>`
  - `Job:  <wvjob.wvtyp>, Job Start Date:  <wvjob.dttmstart>`
  - `@VDaily Operations Data From:  <wvjobreport.dttmstart> - Date To`
- **Blocks:** 5

  - **Job** — `wvjob` (1 fields)
    - `wvjob.wvtyp` (w=15) → _Wvtyp_
  - **Jobcontact** — `wvjobcontact` (6 fields)
    - `wvjobcontact.company` (w=30) → _Company_
    - `wvjobcontact.contactname` (w=15) → _Contactname_
    - `wvjobcontact.phonemobile` (w=15) → _Phonemobile_
    - `wvjobcontact.phoneoffice` (w=15) → _Phoneoffice_
    - `wvjobcontact.title` (w=15) → _Title_
    - `wvjobcontact.typ` (w=15) → _Type_
  - **Daily Report** — `wvjobreport` (5 fields)
    - `wvjobreport.dttmstart` (w=10) → _Start Date/Time_
    - `wvjobreport.dttmend` (w=10) → _End Date/Time_
    - `wvjobreport.rpttmactops` (w=10) → _Rpttmactops_
    - `wvjobreport.plannextrptops` (w=10) → _Plannextrptops_
    - `wvjobreport.summaryops` (w=30) → _Summaryops_
  - **Report Contacts** — `wvjobreportcontacts` (1 fields)
    - `wvjobreportcontacts.idrecjobcontact` (w=10) → _Contact Record_
  - **Time Log** — `wvjobreporttimelog` (8 fields)
    - `wvjobreporttimelog.dttmstartcalc` (w=12) → _Start Date/Time (computed)_
    - `wvjobreporttimelog.dttmendcalc` (w=12) → _End Date/Time (computed)_
    - `wvjobreporttimelog.duration` (w=5) → _Duration Ation_
    - `wvjobreporttimelog.sumofdurationcalc` (w=6) → _Sumofduration (computed)_
    - `wvjobreporttimelog.code1` (w=10) → _Code 1_
    - `wvjobreporttimelog.code2` (w=10) → _Code 2_
    - `wvjobreporttimelog.unschedtyp` (w=10) → _Unschedtyp_
    - `wvjobreporttimelog.com` (w=35) → _Comment_

### Daily Costs

- **HTML:** [Drilling/Daily Input/Daily Costs.html](Drilling/Daily%20Input/Daily%20Costs.html)
- **Paper:** letter · **margins** [12, 12, 31, 25] (1/100 in)
- **Master template:** template landscape header.afr
- **Root table:** `wvjobreport` · **filter:** wvjob / wvtyp / dril
- **Captions:**
  - `Report Date: <wvjobreport.dttmstart>, Report # <wvjobreport.reportnocalc>, DFS: <wvjobreport.daysfromspudcalc>`
- **Blocks:** 2

  - **Daily Summary** — `wvjobreport` (7 fields)
    - `wvjob.afenumbercalc` (w=10) → _AFE Number_
    - `wvjob.afetotalcalc` (w=10) → _AFE Total_
    - `wvjobreport.dttmstart` (w=10) → _Start Date/Time_
    - `wvjobreport.dttmend` (w=10) → _End Date/Time_
    - `wvjobreport.costmudaddcalc` (w=10) → _Mud Cost (daily)_
    - `wvjobreport.costtotalcalc` (w=10) → _Daily Cost Total_
    - `wvjobreport.costtodatecalc` (w=10) → _Cost To Date_
  - **Daily Cost — General** — `wvjobreportcostgen` (10 fields)
    - `wvjobreportcostgen.des` (w=20) → _Description_
    - `wvjobreportcostgen.code1` (w=9) → _Code 1_
    - `wvjobreportcostgen.code2` (w=9) → _Code 2_
    - `wvjobreportcostgen.vendor` (w=20) → _Vendor_
    - `wvjobreportcostgen.pono` (w=10) → _PO Number_
    - `wvjobreportcostgen.ticketno` (w=10) → _Ticket Number_
    - `wvjobreportcostgen.sn` (w=10) → _Serial Number_
    - `wvjobreportcostgen.cost` (w=20) → _Cost_
    - `wvjobreportcostgen.note` (w=20) → _Note_
    - `wvjobreportcostgen.syscarryfwdp` (w=5) → _Carry Forward_

### Daily Mud

- **HTML:** [Drilling/Daily Input/Daily Mud.html](Drilling/Daily%20Input/Daily%20Mud.html)
- **Paper:** letter · **margins** [25, 25, 25, 25] (1/100 in)
- **Master template:** template portrait header.afr
- **Root table:** `wvjobreport` · **filter:** wvjob / wvtyp / dril; wvjobreportfluidswell / fluidtyp; wvjrfluidscalc / fluidtyp; wvjobmudaddamt / dttm; wvjobreport / dttmend; wvjobmudaddamt / dttm; wvjobreport / dttmstart
- **Captions:**
  - `Report Date: <wvjobreport.dttmstart>, Report # <wvjobreport.reportnocalc>, DFS: <wvjobreport.daysfromspudcalc>`
- **Blocks:** 5

  - **Daily Report** — `wvjobreport` (7 fields)
    - `wvjobreport.depthstartdpcalc` (w=9) → _Depth Start (MD)_
    - `wvjobreport.depthenddpcalc` (w=9) → _Depth End (MD)_
    - `wvjobreport.depthprogressdpcalc` (w=9) → _Depth Progressdp (computed)_
    - `wvjobreport.tmdrillcalc` (w=9) → _Tmdrill (computed)_
    - `wvjobreport.ropcalc` (w=9) → _ROP_
    - `wvjobreport.costmudaddcalc` (w=9) → _Mud Cost (daily)_
    - `wvjobreport.costmudaddtodatecalc` (w=9) → _Mud Cost To Date_
  - **Mud Check** — `wvjobreportmudchk` (12 fields)
    - `wvjobreportmudchk.dttm` (w=10) → _Dttm_
    - `wvjobreportmudchk.mudtyp` (w=15) → _Mudtyp_
    - `wvjobreportmudchk.depth` (w=9) → _Depth_
    - `wvjobreportmudchk.density` (w=6) → _Density_
    - `wvjobreportmudchk.funnelviscosity` (w=7) → _Funnelviscosity_
    - `wvjobreportmudchk.plasticvis` (w=7) → _Plasticvis_
    - `wvjobreportmudchk.yieldpt` (w=7) → _Yieldpt_
    - `wvjobreportmudchk.gel10sec` (w=7) → _Gel10Sec_
    - `wvjobreportmudchk.gel10min` (w=7) → _Gel10Min_
    - `wvjobreportmudchk.filtrate` (w=6) → _Filtrate_
    - `wvjobreportmudchk.ph` (w=5) → _pH_
    - `wvjobreportmudchk.solids` (w=6) → _Solids_
  - **Jobreportfluidswell** — `wvjobreportfluidswell` (5 fields)
    - `wvjobreportfluidswell.fluidtyp` (w=10) → _Fluidtyp_
    - `wvjobreportfluidswell.actiontyp` (w=25) → _Actual Iontyp_
    - `wvjobreportfluidswell.towell` (w=10) → _Towell_
    - `wvjobreportfluidswell.fromwell` (w=10) → _Fromwell_
    - `wvjobreportfluidswell.note` (w=25) → _Note_
  - **Mud Volume (Summary)** — `wvjrfluidscalc` (5 fields)
    - `wvjrfluidscalc.fluidtyp` (w=10) → _Fluidtyp_
    - `wvjrfluidscalc.towell` (w=10) → _Towell_
    - `wvjrfluidscalc.cumtowell` (w=10) → _Cumulative Towell_
    - `wvjrfluidscalc.fromwell` (w=10) → _Fromwell_
    - `wvjrfluidscalc.cumfromwell` (w=10) → _Cumulative Fromwell_
  - **Jobmudaddamt** — `wvjobmudaddamt` (10 fields)
    - `wvjobmudadd.des` (w=15) → _Description_
    - `wvjobmudadd.unitlabel` (w=5) → _Unitlabel_
    - `wvjobmudadd.cost` (w=6) → _Cost_
    - `wvjobmudaddamt.dttm` (w=5) → _Dttm_
    - `wvjobmudaddamt.received` (w=4) → _Received_
    - `wvjobmudaddamt.consumed` (w=4) → _Consumed_
    - `wvjobmudaddamt.returned` (w=4) → _Returned_
    - `wvjobmudaddamt.inventorycumcalc` (w=4) → _Inventory (cumulative) (computed)_
    - `wvjobmudaddamt.costcalc` (w=6) → _Cost (computed)_
    - `wvjobmudaddamt.costcumcalc` (w=6) → _Cost (cumulative) (computed)_

### Daily Safety Checks

- **HTML:** [Drilling/Daily Input/Daily Safety Checks.html](Drilling/Daily%20Input/Daily%20Safety%20Checks.html)
- **Paper:** letter · **margins** [25, 25, 25, 25] (1/100 in)
- **Master template:** template portrait header.afr
- **Root table:** `wvjobreport` · **filter:** wvjob / wvtyp / drill; wvjobsafetychk / dttm; wvjobreport / dttmend; wvjobsafetychk / dttm; wvjobreport / dttmstart
- **Captions:**
  - `Report Date: <wvjobreport.dttmstart>, Report # <wvjobreport.reportnocalc>, DFS: <wvjobreport.daysfromspudcalc>`
- **Blocks:** 3

  - **Job** — `wvjob` (5 fields)
    - `wvjob.wvtyp` (w=10) → _Wvtyp_
    - `wvjob.jobtyp` (w=10) → _Jobtyp_
    - `wvjob.afenumbercalc` (w=10) → _AFE Number_
    - `wvjob.dttmstart` (w=10) → _Start Date/Time_
    - `wvjob.dttmend` (w=10) → _End Date/Time_
  - **Jobsafetychk** — `wvjobsafetychk` (5 fields)
    - `wvjobsafetychk.dttm` (w=10) → _Dttm_
    - `wvjobsafetychk.typ` (w=10) → _Type_
    - `wvjobsafetychk.des` (w=20) → _Description_
    - `wvjobsafetychk.typfrequency` (w=10) → _Typfrequency_
    - `wvjobsafetychk.com` (w=25) → _Comment_
  - **Jrsafetychkcalc** — `wvjrsafetychkcalc` (6 fields)
    - `wvjrsafetychkcalc.typ` (w=15) → _Type_
    - `wvjrsafetychkcalc.frequency` (w=5) → _Frequency_
    - `wvjrsafetychkcalc.lastdttm` (w=10) → _Lastdttm_
    - `wvjrsafetychkcalc.durationsincelastchk` (w=5) → _Duration Sincelastchk_
    - `wvjrsafetychkcalc.nextdttm` (w=10) → _Nextdttm_
    - `wvjrsafetychkcalc.durationnextchk` (w=5) → _Duration Nextchk_

### Daily Drilling

- **HTML:** [Drilling/Daily Input/Daily Drilling.html](Drilling/Daily%20Input/Daily%20Drilling.html)
- **Paper:** letter · **margins** [25, 25, 25, 25] (1/100 in)
- **Master template:** template portrait.afr
- **Root table:** `wvjobreport` · **filter:** wvjob / wvtyp / drill; wvjobrigpumpop / dttmstart; wvjobreport / dttmend; wvjobrigpumpop / dttmend; wvjobreport / dttmstart; wvjobrigpumpchk / dttm; wvjobreport / dttmstart; wvjobrigpumpchk / dttm; wvjobreport / dttmend; wvjobmudaddamt / dttm; wvjobreport / dttmstart; wvjobmudaddamt / dttm; wvjobreport / dttmend; wvjobmudaddamt / consumed; wvjobsafetychk / idrecparent; wvjobreport / idrecparent; wvjobsafetychk / dttm; wvjobreport / dttmend; wvjobsafetychk / dttm; wvjobreport / dttmstart; wvjob / idrec; wvjobreport / idrecparent; wvjobdrillstringdrillparam / dttmstart; wvjobreport / dttmend; wvjobdrillstringdrillparam / dttmend; wvjobreport / dttmstart; wvjobdrillstring / idrecparent; wvjobreport / idrecparent; wvjobdrillstring / dttmincalc; wvjobreport / dttmend; wvjobdrillstring / dttmoutcalc; wvjobreport / dttmstart
- **Captions:**
  - `Report #: <wvjobreport.reportnocalc>, DFS: <wvjobreport.daysfromspudcalc>`
  - `Depth Progress: <wvjobreport.depthprogressdpcalc>`
  - `Report for: <wvjobreport.dttmstart>`
- **Blocks:** 16

  - **Job** — `wvjob` (2 fields)
    - `wvjob.afenumbercalc` (w=10) → _AFE Number_
    - `wvjob.afetotalcalc` (w=10) → _AFE Total_
  - **Daily Report** — `wvjobreport` (9 fields)
    - `wvjobreport.costtotalcalc` (w=9) → _Daily Cost Total_
    - `wvjobreport.costtodatecalc` (w=9) → _Cost To Date_
    - `wvjobreport.costmudaddcalc` (w=9) → _Mud Cost (daily)_
    - `wvjobreport.costmudaddtodatecalc` (w=9) → _Mud Cost To Date_
    - `wvjobreport.depthstartdpcalc` (w=9) → _Depth Start (MD)_
    - `wvjobreport.depthenddpcalc` (w=9) → _Depth End (MD)_
    - `wvjob.targetform` (w=9) → _Target Formation_
    - `wvjob.targetdepth` (w=9) → _Target Depth_
    - `wvjobreport.idreclastcascalc` (w=25) → _Idreclastcas (computed)_
  - **Report Contacts** — `wvjobreportcontacts` (2 fields)
    - `wvjobreportcontacts.idrecjobcontact` (w=30) → _Contact Record_
    - `wvjobcontact.phonemobile` (w=20) → _Phonemobile_
  - **Rig** — `wvjobrig` (4 fields)
    - `wvjobrig.contractor` (w=30) → _Contractor_
    - `wvjobrig.rigno` (w=20) → _Rigno_
    - `wvjobrig.idrecjobcontactcontractor` (w=30) → _Idrecjobcontactcontractor_
    - `wvjobcontact.phonemobile` (w=20) → _Phonemobile_
  - **Jobrigpump** — `wvjobrigpump` (3 fields)
    - `wvjobrigpump.des` (w=5) → _Description_
    - `wvjobrigpump.powerrating` (w=5) → _Powerrating_
    - `wvjobrigpump.szodrod` (w=5) → _Szodrod_
  - **Jobrigpumpop** — `wvjobrigpumpop` (3 fields)
    - `wvjobrigpumpop.szliner` (w=6) → _Szliner_
    - `wvjobrigpump.strokelength` (w=6) → _Strokelength_
    - `wvjobrigpumpop.volperstroke` (w=6) → _Volperstroke_
  - **Jobrigpumpchk** — `wvjobrigpumpchk` (4 fields)
    - `wvjobrigpumpchk.pres` (w=5) → _Pres_
    - `wvjobrigpumpchk.slowspeed` (w=5) → _Slowspeed_
    - `wvjobrigpumpchk.spm` (w=5) → _Spm_
    - `wvjobrigpumpchk.volefficiency` (w=5) → _Volefficiency_
  - **Jobmudaddamt** — `wvjobmudaddamt` (3 fields)
    - `wvjobmudadd.des` (w=15) → _Description_
    - `wvjobmudadd.cost` (w=7) → _Cost_
    - `wvjobmudaddamt.consumed` (w=6) → _Consumed_
  - **Jobsafetychk** — `wvjobsafetychk` (3 fields)
    - `wvjobsafetychk.dttm` (w=10) → _Dttm_
    - `wvjobsafetychk.typ` (w=25) → _Type_
    - `wvjobsafetychk.des` (w=25) → _Description_
  - **Wellbore** — `wvwellbore` (2 fields)
    - `wvwellbore.des` (w=9) → _Description_
    - `wvwellbore.kickoffdepth` (w=9) → _Kickoffdepth_
  - **Daily Summary** — `wvwellheader` (8 fields)
    - `wvwellheader.wellida` (w=10) → _Well ID_
    - `wvwellheader.legalsurveyloc` (w=10) → _Legalsurveyloc_
    - `wvwellheader.welllicenseno` (w=10) → _Welllicenseno_
    - `wvwellheader.stateprov` (w=10) → _Stateprov_
    - `wvwellheader.dttmspud` (w=10) → _Spud Date/Time_
    - `wvwellheader.dttmrr` (w=10) → _Date/Time Rr_
    - `wvwellheader.elvground` (w=10) → _Elvground_
    - `wvwellheader.kbtogrdcalc` (w=10) → _Kbtogrd (computed)_
  - **Daily Report** — `wvjobreport` (7 fields)
    - `wvjobreport.condweather` (w=10) → _Condweather_
    - `wvjobreport.condtemp` (w=10) → _Condtemp_
    - `wvjobreport.condroad` (w=10) → _Condroad_
    - `wvjobreport.condhole` (w=10) → _Condhole_
    - `wvjobreport.rpttmactops` (w=10) → _Rpttmactops_
    - `wvjobreport.plannextrptops` (w=10) → _Plannextrptops_
    - `wvjobreport.summaryops` (w=30) → _Summaryops_
  - **Time Log** — `wvjobreporttimelog` (7 fields)
    - `wvjobreporttimelog.dttmstartcalc` (w=6) → _Start Date/Time (computed)_
    - `wvjobreporttimelog.dttmendcalc` (w=6) → _End Date/Time (computed)_
    - `wvjobreporttimelog.duration` (w=6) → _Duration Ation_
    - `wvjobreporttimelog.sumofdurationcalc` (w=6) → _Sumofduration (computed)_
    - `wvjobreporttimelog.code1` (w=6) → _Code 1_
    - `wvjobreporttimelog.code2` (w=12) → _Code 2_
    - `wvjobreporttimelog.com` (w=50) → _Comment_
  - **Mud Check** — `wvjobreportmudchk` (26 fields)
    - `wvjobreportmudchk.mudtyp` (w=6) → _Mudtyp_
    - `wvjobreportmudchk.dttm` (w=6) → _Dttm_
    - `wvjobreportmudchk.depth` (w=6) → _Depth_
    - `wvjobreportmudchk.density` (w=6) → _Density_
    - `wvjobreportmudchk.funnelviscosity` (w=6) → _Funnelviscosity_
    - `wvjobreportmudchk.plasticvis` (w=6) → _Plasticvis_
    - `wvjobreportmudchk.yieldpt` (w=6) → _Yieldpt_
    - `wvjobreportmudchk.gel10sec` (w=7) → _Gel10Sec_
    - `wvjobreportmudchk.gel10min` (w=7) → _Gel10Min_
    - `wvjobreportmudchk.filtrate` (w=7) → _Filtrate_
    - `wvjobreportmudchk.filtercake` (w=7) → _Filtercake_
    - `wvjobreportmudchk.ph` (w=7) → _pH_
    - `wvjobreportmudchk.sands` (w=7) → _Sands_
    - `wvjobreportmudchk.solids` (w=7) → _Solids_
    - `wvjobreportmudchk.mbt` (w=6) → _Mbt_
    - `wvjobreportmudchk.alkalinity` (w=6) → _Alkalinity_
    - `wvjobreportmudchk.chlorides` (w=6) → _Chlorides_
    - `wvjobreportmudchk.calcium` (w=6) → _Calcium_
    - `wvjobreportmudchk.pf` (w=6) → _Pf_
    - `wvjobreportmudchk.pm` (w=6) → _Pm_
    - `wvjobreportmudchk.gel30min` (w=6) → _Gel30Min_
    - `wvjobreportmudchk.mudadded` (w=6) → _Mudadded_
    - `wvjobreportmudchk.mudlosthole` (w=6) → _Mudlosthole_
    - `wvjobreportmudchk.mudlostsurface` (w=6) → _Mudlostsurface_
    - `wvjobreportmudchk.mudvolreserve` (w=6) → _Mudvolreserve_
    - `wvjobreportmudchk.mudvolactive` (w=6) → _Mudvolactive_
  - **Drill String / BHA** — `wvjobdrillstring` (11 fields)
    - `wvjobdrillstring.bitno` (w=4) → _Bitno_
    - `wvjobdrillstring.idrecbit` (w=25) → _Idrecbit_
    - `wvjobdrillbit.length` (w=7) → _Length_
    - `wvjobdrillstring.bitwearcalc` (w=20) → _Bitwear (computed)_
    - `wvjobdrillstring.bittfacalc` (w=11) → _Bittfa (computed)_
    - `wvjobdrillstring.ropcalc` (w=6) → _ROP_
    - `wvjobdrillstring.bitnozzlecalc` (w=10) → _Bitnozzle (computed)_
    - `wvjobdrillstring.lengthcalc` (w=6) → _Length (computed)_
    - `wvjobdrillstring.szodmaxcalc` (w=6) → _Szodmax (computed)_
    - `wvjobdrillstring.componentscalc` (w=12) → _Components (computed)_
    - `wvjobdrillstring.com` (w=30) → _Comment_
  - **Drilling Parameters** — `wvjobdrillstringdrillparam` (13 fields)
    - `wvjobdrillstringdrillparam.idrecwellbore` (w=12) → _Idrecwellbore_
    - `wvjobdrillstringdrillparam.depthstart` (w=9) → _Depth Start_
    - `wvjobdrillstringdrillparam.depthend` (w=9) → _Depth End_
    - `wvjobdrillstringdrillparam.depthdrilledcumcalc` (w=8) → _Depth Drilled (cumulative) (computed)_
    - `wvjobdrillstringdrillparam.tmdrillcumcalc` (w=6) → _Tmdrill (cumulative) (computed)_
    - `wvjobdrillstringdrillparam.ropcalc` (w=6) → _ROP_
    - `wvjobdrillstringdrillparam.liquidinjrate` (w=6) → _Liquidinjrate_
    - `wvjobdrillstringdrillparam.wob` (w=6) → _Weight On Bit_
    - `wvjobdrillstringdrillparam.rpmstring` (w=5) → _String RPM_
    - `wvjobdrillstringdrillparam.sppdrill` (w=8) → _Sppdrill_
    - `wvjobdrillstringdrillparam.hookloadrotating` (w=8) → _Hookloadrotating_
    - `wvjobdrillstringdrillparam.hookloadpickup` (w=8) → _Hookloadpickup_
    - `wvjobdrillstringdrillparam.torquedrill` (w=6) → _Torquedrill_

### Daily Drilling - Detail (legal size)

- **HTML:** [Drilling/Daily Input/Daily Drilling - Detail (legal size).html](Drilling/Daily%20Input/Daily%20Drilling%20-%20Detail%20%28legal%20size%29.html)
- **Paper:** letter · **margins** [25, 25, 25, 25] (1/100 in)
- **Master template:** template legal.afr
- **Root table:** `wvjobreport` · **filter:** wvjob / wvtyp / drill; wvjobrigpumpop / dttmstart; wvjobreport / dttmend; wvjobrigpumpop / dttmend; wvjobreport / dttmstart; wvjobrigpumpchk / dttm; wvjobreport / dttmstart; wvjobrigpumpchk / dttm; wvjobreport / dttmend; wvjobmudaddamt / dttm; wvjobreport / dttmstart; wvjobmudaddamt / dttm; wvjobreport / dttmend; wvjobmudaddamt / consumed; wvjob / idrec; wvjobreport / idrecparent; wvwellbore / wvwellboredirsurvey; wvwellboredirsurveydata / dttm; wvjobreport / dttmend; wvwellboredirsurveydata / dttm; wvjobreport / dttmstart; wvwellbore / idrec; wvjobreport / idrecwellborecalc; wvwellboreformation / depthdrillingtop; wvjobreport / depthenddpcalc; wvwellbore / idrec; wvjobreport / idrecwellborecalc; wvcas / dttmrun; wvjobreport / dttmend; wvjrfluidsactioncalc / fluidtyp; wvjobdrillstringdrillparam / dttmstart; wvjobreport / dttmend; wvjobdrillstringdrillparam / dttmend; wvjobreport / dttmstart; wvjobdrillstring / idrecparent; wvjobreport / idrecparent; wvjobdrillstring / dttmincalc; wvjobreport / dttmend; wvjobdrillstring / dttmoutcalc; wvjobreport / dttmstart; wvjobkick / dttmstart; wvjobreport / dttmend; wvjobkick / dttmend; wvjobreport / dttmstart; wvjoblostcirc / dttmstart; wvjobreport / dttmend; wvjoblostcirc / dttmend; wvjobreport / dttmstart; wvjobintervalproblem / dttmend; wvjobreport / dttmstart; wvjobintervalproblem / dttmstart; wvjobreport / dttmend; wvjobintervalproblem / idrecparent; wvjobreport / idrecparent; wvjobintervallesson / dttmstart; wvjobreport / dttmend; wvjobintervallesson / dttmend; wvjobreport / dttmstart; wvjobsafetyincident / dttm; wvjobreport / dttmend; wvjobsafetyincident / dttm; wvjobreport / dttmstart
- **Captions:**
  - `@A# <wvjobrigpump.des>,  <wvjobrigpump.make>,  <wvjobrigpump.mod`
  - `Report #: <wvjobreport.reportnocalc>, DFS: <wvjobreport.daysfromspudcalc>`
  - `Depth Progress: <wvjobreport.depthprogressdpcalc>`
  - `Report Start Date: <wvjobreport.dttmstart>`
- **Blocks:** 27

  - **Job** — `wvjob` (2 fields)
    - `wvjob.afenumbercalc` (w=10) → _AFE Number_
    - `wvjob.afetotalcalc` (w=10) → _AFE Total_
  - **Daily Report** — `wvjobreport` (18 fields)
    - `wvjobreport.costtotalcalc` (w=9) → _Daily Cost Total_
    - `wvjobreport.costtodatecalc` (w=9) → _Cost To Date_
    - `wvjobreport.costmudaddcalc` (w=9) → _Mud Cost (daily)_
    - `wvjobreport.costmudaddtodatecalc` (w=9) → _Mud Cost To Date_
    - `wvjobreport.depthstartdpcalc` (w=9) → _Depth Start (MD)_
    - `wvjobreport.depthenddpcalc` (w=9) → _Depth End (MD)_
    - `wvjobreport.depthtvdstartdpcalc` (w=10) → _Depth Start (TVD)_
    - `wvjobreport.depthtvdenddpcalc` (w=10) → _Depth End (TVD)_
    - `wvjob.targetform` (w=9) → _Target Formation_
    - `wvjob.targetdepth` (w=9) → _Target Depth_
    - `wvjobreport.durationpersonneltotcalc` (w=10) → _Personnel Hours_
    - `wvjobreport.durpersonneltotcumcalc` (w=10) → _Personnel Hours Cum_
    - `wvjobreport.durationtimelogtotalcalc` (w=10) → _Time Log Total (hr)_
    - `wvjobreport.durationproblemtimecalc` (w=10) → _Problem Time (hr)_
    - `wvjobreport.pctproblemtimecalc` (w=10) → _Problem Time (%)_
    - `wvjobreport.pctproblemtimecumcalc` (w=10) → _Problem Time Cum (%)_
    - `wvjobreport.durationsinceltinc` (w=10) → _Days Since LTI_
    - `wvjobreport.durationsincerptinc` (w=10) → _Days Since Recordable_
  - **Report Contacts** — `wvjobreportcontacts` (2 fields)
    - `wvjobreportcontacts.idrecjobcontact` (w=30) → _Contact Record_
    - `wvjobcontact.phonemobile` (w=20) → _Phonemobile_
  - **Jobreportpersonnelcount** — `wvjobreportpersonnelcount` (3 fields)
    - `wvjobreportpersonnelcount.companytyp` (w=30) → _Companytyp_
    - `wvjobreportpersonnelcount.headcount` (w=10) → _Headcount_
    - `wvjobreportpersonnelcount.durationworktotcalc` (w=10) → _Duration Worktot (computed)_
  - **Jrsafetychkcalc** — `wvjrsafetychkcalc` (3 fields)
    - `wvjrsafetychkcalc.typ` (w=15) → _Type_
    - `wvjrsafetychkcalc.lastdttm` (w=10) → _Lastdttm_
    - `wvjrsafetychkcalc.nextdttm` (w=10) → _Nextdttm_
  - **Rig** — `wvjobrig` (4 fields)
    - `wvjobrig.contractor` (w=30) → _Contractor_
    - `wvjobrig.rigno` (w=20) → _Rigno_
    - `wvjobrig.idrecjobcontactcontractor` (w=30) → _Idrecjobcontactcontractor_
    - `wvjobcontact.phonemobile` (w=20) → _Phonemobile_
  - **Jobrigpump** — `wvjobrigpump` (3 fields)
    - `wvjobrigpump.powerrating` (w=10) → _Powerrating_
    - `wvjobrigpump.szodrod` (w=10) → _Szodrod_
    - `wvjobrigpump.strokelength` (w=10) → _Strokelength_
  - **Last Pump Op** — `wvjobrigpumpop` (2 fields)
    - `wvjobrigpumpop.szliner` (w=10) → _Szliner_
    - `wvjobrigpumpop.volperstroke` (w=10) → _Volperstroke_
  - **Last Pump Check** — `wvjobrigpumpchk` (4 fields)
    - `wvjobrigpumpchk.pres` (w=7) → _Pres_
    - `wvjobrigpumpchk.slowspeed` (w=7) → _Slowspeed_
    - `wvjobrigpumpchk.spm` (w=7) → _Spm_
    - `wvjobrigpumpchk.volefficiency` (w=7) → _Volefficiency_
  - **Jobmudaddamt** — `wvjobmudaddamt` (3 fields)
    - `wvjobmudadd.des` (w=15) → _Description_
    - `wvjobmudadd.cost` (w=7) → _Cost_
    - `wvjobmudaddamt.consumed` (w=6) → _Consumed_
  - **Wellboredirsurveydata** — `wvwellboredirsurveydata` (4 fields)
    - `wvwellboredirsurveydata.md` (w=10) → _Md_
    - `wvwellboredirsurveydata.inclination` (w=10) → _Inclination_
    - `wvwellboredirsurveydata.azimuth` (w=10) → _Azimuth_
    - `wvwellboredirsurveydata.tvdcalc` (w=10) → _Tvd (computed)_
  - **Last 5 Formations** — `wvwellboreformation` (3 fields)
    - `wvwellboreformation.formname` (w=20) → _Formname_
    - `wvwellboreformation.depthmdprogtop` (w=10) → _Depth MD Progtop_
    - `wvwellboreformation.depthdrillingtop` (w=10) → _Depth Drillingtop_
  - **Last Casing String** — `wvcas` (3 fields)
    - `wvcas.des` (w=20) → _Description_
    - `wvcas.dttmrun` (w=15) → _Date/Time Run_
    - `wvcas.depthbtm` (w=10) → _Bottom Depth_
  - **Daily Summary** — `wvwellheader` (8 fields)
    - `wvwellheader.wellida` (w=10) → _Well ID_
    - `wvwellheader.legalsurveyloc` (w=10) → _Legalsurveyloc_
    - `wvwellheader.welllicenseno` (w=10) → _Welllicenseno_
    - `wvwellheader.stateprov` (w=10) → _Stateprov_
    - `wvwellheader.dttmspud` (w=10) → _Spud Date/Time_
    - `wvwellheader.dttmrr` (w=10) → _Date/Time Rr_
    - `wvwellheader.kbtogrdcalc` (w=10) → _Kbtogrd (computed)_
    - `wvwellheader.kbtocascalc` (w=10) → _Kbtocas (computed)_
  - **Daily Report** — `wvjobreport` (8 fields)
    - `wvjobreport.condweather` (w=10) → _Condweather_
    - `wvjobreport.condtemp` (w=10) → _Condtemp_
    - `wvjobreport.condroad` (w=10) → _Condroad_
    - `wvjobreport.condhole` (w=10) → _Condhole_
    - `wvjobreport.rpttmactops` (w=10) → _Rpttmactops_
    - `wvjobreport.plannextrptops` (w=10) → _Plannextrptops_
    - `wvjobreport.summaryops` (w=30) → _Summaryops_
    - `wvjobreport.remarks` (w=15) → _Remarks_
  - **Time Log** — `wvjobreporttimelog` (10 fields)
    - `wvjobreporttimelog.dttmstartcalc` (w=6) → _Start Date/Time (computed)_
    - `wvjobreporttimelog.duration` (w=6) → _Duration Ation_
    - `wvjobreporttimelog.sumofdurationcalc` (w=6) → _Sumofduration (computed)_
    - `wvjobreporttimelog.dttmendcalc` (w=6) → _End Date/Time (computed)_
    - `wvjobreporttimelog.code1` (w=6) → _Code 1_
    - `wvjobreporttimelog.code2` (w=12) → _Code 2_
    - `wvjobreporttimelog.problemcalc` (w=6) → _Problem (computed)_
    - `wvjobreporttimelog.durationproblemtimecalc` (w=6) → _Problem Time (hr)_
    - `wvjobreporttimelog.refnoproblemcalc` (w=6) → _Refnoproblem (computed)_
    - `wvjobreporttimelog.com` (w=30) → _Comment_
  - **Mud Check** — `wvjobreportmudchk` (21 fields)
    - `wvjobreportmudchk.mudtyp` (w=6) → _Mudtyp_
    - `wvjobreportmudchk.dttm` (w=6) → _Dttm_
    - `wvjobreportmudchk.depth` (w=6) → _Depth_
    - `wvjobreportmudchk.density` (w=6) → _Density_
    - `wvjobreportmudchk.funnelviscosity` (w=6) → _Funnelviscosity_
    - `wvjobreportmudchk.plasticviscalc` (w=6) → _Plasticvis (computed)_
    - `wvjobreportmudchk.yieldptcalc` (w=6) → _Yieldpt (computed)_
    - `wvjobreportmudchk.gel10sec` (w=7) → _Gel10Sec_
    - `wvjobreportmudchk.gel10min` (w=7) → _Gel10Min_
    - `wvjobreportmudchk.gel30min` (w=7) → _Gel30Min_
    - `wvjobreportmudchk.filtrate` (w=7) → _Filtrate_
    - `wvjobreportmudchk.filtercake` (w=7) → _Filtercake_
    - `wvjobreportmudchk.ph` (w=7) → _pH_
    - `wvjobreportmudchk.solids` (w=7) → _Solids_
    - `wvjobreportmudchk.mbt` (w=6) → _Mbt_
    - `wvjobreportmudchk.oilpercent` (w=6) → _Oilpercent_
    - `wvjobreportmudchk.waterpercent` (w=6) → _Waterpercent_
    - `wvjobreportmudchk.chlorides` (w=6) → _Chlorides_
    - `wvjobreportmudchk.calcium` (w=6) → _Calcium_
    - `wvjobreportmudchk.potassium` (w=6) → _Potassium_
    - `wvjobreportmudchk.elecstability` (w=6) → _Elecstability_
  - **Drilling Mud Volumes** — `wvjrfluidsactioncalc` (5 fields)
    - `wvjrfluidsactioncalc.actiontyp` (w=20) → _Actual Iontyp_
    - `wvjrfluidsactioncalc.towell` (w=10) → _Towell_
    - `wvjrfluidsactioncalc.fromwell` (w=10) → _Fromwell_
    - `wvjrfluidsactioncalc.cumtowell` (w=10) → _Cumulative Towell_
    - `wvjrfluidsactioncalc.cumfromwell` (w=10) → _Cumulative Fromwell_
  - **Drill String / BHA** — `wvjobdrillstring` (8 fields)
    - `wvjobdrillstring.bitno` (w=4) → _Bitno_
    - `wvjobdrillstring.idrecbit` (w=25) → _Idrecbit_
    - `wvjobdrillstring.bitwearcalc` (w=20) → _Bitwear (computed)_
    - `wvjobdrillstring.bittfacalc` (w=11) → _Bittfa (computed)_
    - `wvjobdrillstring.bitnozzlecalc` (w=35) → _Bitnozzle (computed)_
    - `wvjobdrillstring.lengthcalc` (w=7) → _Length (computed)_
    - `wvjobdrillstring.weightaircalc` (w=8) → _Weightair (computed)_
    - `wvjobdrillstring.ropcalc` (w=6) → _ROP_
  - **Drill String Component** — `wvjobdrillstringcomp` (6 fields)
    - `wvjobdrillstringcomp.des` (w=25) → _Description_
    - `wvjobdrillstringcomp.joints` (w=9) → _Joints_
    - `wvjobdrillstringcomp.szodnom` (w=9) → _Szodnom_
    - `wvjobdrillstringcomp.szidnom` (w=9) → _Szidnom_
    - `wvjobdrillstringcomp.length` (w=9) → _Length_
    - `wvjobdrillstringcomp.connthrdtop` (w=9) → _Connthrdtop_
  - **Drilling Parameters** — `wvjobdrillstringdrillparam` (24 fields)
    - `wvjobdrillstringdrillparam.idrecwellbore` (w=6) → _Idrecwellbore_
    - `wvjobdrillstringdrillparam.depthstart` (w=6) → _Depth Start_
    - `wvjobdrillstringdrillparam.depthend` (w=6) → _Depth End_
    - `wvjobdrillstringdrillparam.depthdrilledcumcalc` (w=6) → _Depth Drilled (cumulative) (computed)_
    - `wvjobdrillstringdrillparam.tmdrill` (w=6) → _Tmdrill_
    - `wvjobdrillstringdrillparam.tmdrillcumcalc` (w=6) → _Tmdrill (cumulative) (computed)_
    - `wvjobdrillstringdrillparam.ropcalc` (w=6) → _ROP_
    - `wvjobdrillstringdrillparam.liquidinjrate` (w=6) → _Liquidinjrate_
    - `wvjobdrillstringdrillparam.wob` (w=8) → _Weight On Bit_
    - `wvjobdrillstringdrillparam.rpmstring` (w=8) → _String RPM_
    - `wvjobdrillstringdrillparam.sppdrill` (w=8) → _Sppdrill_
    - `wvjobdrillstringdrillparam.hookloadrotating` (w=8) → _Hookloadrotating_
    - `wvjobdrillstringdrillparam.hookloadpickup` (w=8) → _Hookloadpickup_
    - `wvjobdrillstringdrillparam.hookloadslackoff` (w=8) → _Hookloadslackoff_
    - `wvjobdrillstringdrillparam.torquedrill` (w=8) → _Torquedrill_
    - `wvjobdrillstringdrillparam.torqueoffbtm` (w=8) → _Torqueoffbtm_
    - `wvjobdrillstringdrillparam.gasinjrate` (w=6) → _Gasinjrate_
    - `wvjobdrillstringdrillparam.injtemp` (w=6) → _Injtemp_
    - `wvjobdrillstringdrillparam.bhaanpres` (w=6) → _Bhaanpres_
    - `wvjobdrillstringdrillparam.bhtemp` (w=6) → _Bhtemp_
    - `wvjobdrillstringdrillparam.surfannpres` (w=6) → _Surfannpres_
    - `wvjobdrillstringdrillparam.surfanntemp` (w=6) → _Surfanntemp_
    - `wvjobdrillstringdrillparam.liquidreturnrate` (w=6) → _Liquidreturnrate_
    - `wvjobdrillstringdrillparam.gasreturnrate` (w=6) → _Gasreturnrate_
  - **Hydraulics (computed)** — `wvjdsdphydcalc` (11 fields)
    - `wvjdsdphydcalc.hydpwrbit` (w=6) → _Hydpwrbit_
    - `wvjdsdphydcalc.hydpwrperarea` (w=6) → _Hydpwrperarea_
    - `wvjdsdphydcalc.jetvelocity` (w=6) → _Jetvelocity_
    - `wvjdsdphydcalc.pressuredropbit` (w=6) → _Pressuredropbit_
    - `wvjdsdphydcalc.pressuredropbitratio` (w=6) → _Pressuredropbitratio_
    - `wvjdsdphydcalc.avcasmax` (w=9) → _Avcasmax_
    - `wvjdsdphydcalc.avopenholemax` (w=9) → _Avopenholemax_
    - `wvjdsdphydcalc.avcasmin` (w=9) → _Avcasmin_
    - `wvjdsdphydcalc.avopenholemin` (w=9) → _Avopenholemin_
    - `wvjdsdphydcalc.ecdend` (w=9) → _Ecdend_
    - `wvjdsdphydcalc.calcerror` (w=15) → _Calcerror_
  - **Kick** — `wvjobkick` (6 fields)
    - `wvjobkick.dttmstart` (w=15) → _Start Date/Time_
    - `wvjobkick.depthstart` (w=10) → _Depth Start_
    - `wvjobkick.dttmend` (w=15) → _End Date/Time_
    - `wvjobkick.depthend` (w=10) → _Depth End_
    - `wvjobkick.kickclass` (w=10) → _Kickclass_
    - `wvjobkick.killprocedure` (w=50) → _Killprocedure_
  - **Joblostcirc** — `wvjoblostcirc` (6 fields)
    - `wvjoblostcirc.dttmstart` (w=15) → _Start Date/Time_
    - `wvjoblostcirc.depthstart` (w=10) → _Depth Start_
    - `wvjoblostcirc.depthend` (w=10) → _Depth End_
    - `wvjoblostcirc.opsinprog` (w=10) → _Opsinprog_
    - `wvjoblostcirc.vollosstotal` (w=10) → _Vollosstotal_
    - `wvjoblostcirc.dttmend` (w=15) → _End Date/Time_
  - **Interval Problem (NPT)** — `wvjobintervalproblem` (8 fields)
    - `wvjobintervalproblem.typ` (w=15) → _Type_
    - `wvjobintervalproblem.typdetail` (w=15) → _Typdetail_
    - `wvjobintervalproblem.dttmstart` (w=10) → _Start Date/Time_
    - `wvjobintervalproblem.depthstart` (w=10) → _Depth Start_
    - `wvjobintervalproblem.depthend` (w=10) → _Depth End_
    - `wvjobintervalproblem.estcostoverride` (w=10) → _Estimate Costoverride_
    - `wvjobintervalproblem.estlosttime` (w=10) → _Estimate Losttime_
    - `wvjobintervalproblem.com` (w=50) → _Comment_
  - **Interval Lesson** — `wvjobintervallesson` (8 fields)
    - `wvjobintervallesson.typ` (w=10) → _Type_
    - `wvjobintervallesson.dttmstart` (w=10) → _Start Date/Time_
    - `wvjobintervallesson.dttmend` (w=10) → _End Date/Time_
    - `wvjobintervallesson.depthstart` (w=10) → _Depth Start_
    - `wvjobintervallesson.depthend` (w=10) → _Depth End_
    - `wvjobintervallesson.estcostsaving` (w=10) → _Estimate Costsaving_
    - `wvjobintervallesson.esttimesaving` (w=10) → _Estimate Timesaving_
    - `wvjobintervallesson.com` (w=50) → _Comment_
  - **Jobsafetyincident** — `wvjobsafetyincident` (7 fields)
    - `wvjobsafetyincident.dttm` (w=10) → _Dttm_
    - `wvjobsafetyincident.category` (w=10) → _Category_
    - `wvjobsafetyincident.typ1` (w=15) → _Typ1_
    - `wvjobsafetyincident.typ2` (w=15) → _Typ2_
    - `wvjobsafetyincident.cause` (w=15) → _Cause_
    - `wvjobsafetyincident.losttime` (w=5) → _Losttime_
    - `wvjobsafetyincident.severity` (w=9) → _Severity_

## Drilling/General Input

### BHA Detail

- **HTML:** [Drilling/General Input/BHA Detail.html](Drilling/General%20Input/BHA%20Detail.html)
- **Paper:** letter · **margins** [25, 25, 25, 25] (1/100 in)
- **Master template:** template portrait.afr
- **Root table:** `wvjobdrillstring` · **filter:** wvjob / wvtyp / drill; wvjobdrillbit / idrec; wvjobdrillstring / idrecbit; wvwellheader / wvjob; wvjobreportmudchk / dttm; wvjobdrillstring / dttmoutcalc; wvjobreportmudchk / dttm; wvjobdrillstring / dttmincalc
- **Captions:**
  - `: <wvjobdrillstring.stringno>,  <wv`
- **Blocks:** 8

  - **drilling & geology\bha only.sch** — `wvjobdrillstringdrillparam` (1 fields)
    - `wvjobdrillstring.idrecwellborecalc` (w=0) → _Idrecwellbore (computed)_
  - **vs Depth - Plan - Days from Star** — `wvjobdrillbit` (7 fields)
    - `wvjobdrillbit.typ` (w=15) → _Type_
    - `wvjobdrillbit.make` (w=7) → _Make_
    - `wvjobdrillbit.model` (w=15) → _Model_
    - `wvjobdrillbit.sn` (w=15) → _Serial Number_
    - `wvjobdrillbit.iadccodescalc` (w=12) → _Iadccodes (computed)_
    - `wvjobdrillbit.cost` (w=12) → _Cost_
    - `wvjobdrillbit.length` (w=9) → _Length_
  - **Drill String / BHA** — `wvjobdrillstring` (22 fields)
    - `wvjobdrillstring.depthincalc` (w=9) → _Depth In (computed)_
    - `wvjobdrillstring.depthoutcalc` (w=9) → _Depth Out (computed)_
    - `wvjobdrillstring.depthdrilledcalc` (w=9) → _Depth Drilled (computed)_
    - `wvjobdrillstring.tmdrilledcalc` (w=9) → _Tmdrilled (computed)_
    - `wvjobdrillstring.ropcalc` (w=9) → _ROP_
    - `wvjobdrillstring.bitno` (w=4) → _Bitno_
    - `wvjobdrillbit.length` (w=7) → _Length_
    - `wvjobdrillbit.make` (w=7) → _Make_
    - `wvjobdrillbit.model` (w=7) → _Model_
    - `wvjobdrillbit.sn` (w=10) → _Serial Number_
    - `wvjobdrillbit.iadccodescalc` (w=10) → _Iadccodes (computed)_
    - `wvjobdrillstring.bitwearcalc` (w=8) → _Bitwear (computed)_
    - `wvjobdrillstring.weightaircalc` (w=8) → _Weightair (computed)_
    - `wvjobdrillstring.lengthcalc` (w=8) → _Length (computed)_
    - `wvjobdrillstring.wobmaxcalc` (w=8) → _Wobmax (computed)_
    - `wvjobdrillstring.wobmincalc` (w=8) → _Wobmin (computed)_
    - `wvjobdrillstring.rpmmaxcalc` (w=8) → _Rpmmax (computed)_
    - `wvjobdrillstring.rpmmincalc` (w=8) → _Rpmmin (computed)_
    - `wvjobdrillstring.liquidinjratemaxcalc` (w=8) → _Liquidinjratemax (computed)_
    - `wvjobdrillstring.liquidinjratemincalc` (w=8) → _Liquidinjratemin (computed)_
    - `wvjobdrillstring.bitnozzlecalc` (w=10) → _Bitnozzle (computed)_
    - `wvjobdrillstring.com` (w=30) → _Comment_
  - **Drill String Component** — `wvjobdrillstringcomp` (11 fields)
    - `wvjobdrillstringcomp.joints` (w=5) → _Joints_
    - `wvjobdrillstringcomp.des` (w=25) → _Description_
    - `wvjobdrillstringcomp.szodnom` (w=7) → _Szodnom_
    - `wvjobdrillstringcomp.szidnom` (w=7) → _Szidnom_
    - `wvjobdrillstringcomp.wtperlength` (w=7) → _Wtperlength_
    - `wvjobdrillstringcomp.grade` (w=6) → _Grade_
    - `wvjobdrillstringcomp.szdrift` (w=7) → _Szdrift_
    - `wvjobdrillstringcomp.szodmax` (w=7) → _Szodmax_
    - `wvjobdrillstringcomp.connectcalc` (w=14) → _Connect (computed)_
    - `wvjobdrillstringcomp.length` (w=8) → _Length_
    - `wvjobdrillstringcomp.lengthcumcalc` (w=8) → _Length (cumulative) (computed)_
  - **Drilling Parameters** — `wvjobdrillstringdrillparam` (12 fields)
    - `wvjobdrillstringdrillparam.idrecwellbore` (w=15) → _Idrecwellbore_
    - `wvjobdrillstringdrillparam.dttmstart` (w=16) → _Start Date/Time_
    - `wvjobdrillstringdrillparam.dttmend` (w=16) → _End Date/Time_
    - `wvjobdrillstringdrillparam.tmdrill` (w=7) → _Tmdrill_
    - `wvjobdrillstringdrillparam.depthstart` (w=11) → _Depth Start_
    - `wvjobdrillstringdrillparam.depthend` (w=11) → _Depth End_
    - `wvjobdrillstringdrillparam.depthdrilledcalc` (w=11) → _Depth Drilled (computed)_
    - `wvjobdrillstringdrillparam.ropcalc` (w=8) → _ROP_
    - `wvjobdrillstringdrillparam.wob` (w=8) → _Weight On Bit_
    - `wvjobdrillstringdrillparam.rpmstring` (w=8) → _String RPM_
    - `wvjobdrillstringdrillparam.liquidinjrate` (w=8) → _Liquidinjrate_
    - `wvjobdrillstringdrillparam.sppdrill` (w=8) → _Sppdrill_
  - **Jobdrillstringbitnozzle** — `wvjobdrillstringbitnozzle` (1 fields)
    - `wvjobdrillstringbitnozzle.dia` (w=5) → _Dia_
  - **Jobdrillstringsensor** — `wvjobdrillstringsensor` (3 fields)
    - `wvjobdrillstringsensor.sensortyp` (w=10) → _Sensortyp_
    - `wvjobdrillstringsensor.distancesensortobit` (w=10) → _Distancesensortobit_
    - `wvjobdrillstringsensor.note` (w=20) → _Note_
  - **Mud Check** — `wvjobreportmudchk` (9 fields)
    - `wvjobreportmudchk.dttm` (w=15) → _Dttm_
    - `wvjobreportmudchk.depth` (w=15) → _Depth_
    - `wvjobreportmudchk.mudtyp` (w=15) → _Mudtyp_
    - `wvjobreportmudchk.density` (w=10) → _Density_
    - `wvjobreportmudchk.plasticviscalc` (w=10) → _Plasticvis (computed)_
    - `wvjobreportmudchk.yieldptcalc` (w=10) → _Yieldpt (computed)_
    - `wvjobreportmudchk.ph` (w=10) → _pH_
    - `wvjobreportmudchk.sands` (w=10) → _Sands_
    - `wvjobreportmudchk.solids` (w=10) → _Solids_

### Casing Tally

- **HTML:** [Drilling/General Input/Casing Tally.html](Drilling/General%20Input/Casing%20Tally.html)
- **Paper:** letter · **margins** [25, 25, 25, 25] (1/100 in)
- **Master template:** template portrait header.afr
- **Root table:** `wvcas` · **filter:** wvcas / idrec; wvcas / idrec; wvcascomp / sysseq; wvcascomptally / sysseq
- **Captions:**
  - `<wvcas.des>, Set Depth:  <wvcas.depthbtm>`
- **Blocks:** 1

  - **Casing Run Tally** — `wvcascomptally` (11 fields)
    - `wvcascomp.des` (w=12) → _Description_
    - `wvcascomp.szodnom` (w=10) → _Szodnom_
    - `wvcascomp.wtperlength` (w=10) → _Wtperlength_
    - `wvcascomp.grade` (w=10) → _Grade_
    - `wvcascomptally.refno` (w=10) → _Refno_
    - `wvcascomptally.jointrun` (w=10) → _Jointrun_
    - `wvcascomptally.length` (w=10) → _Length_
    - `wvcascomptally.centralized` (w=10) → _Centralized_
    - `wvcascomptally.extjewelry` (w=10) → _Extjewelry_
    - `wvcascomptally.depthtopcalc` (w=10) → _Top Depth (computed)_
    - `wvcascomptally.lengthcumcalc` (w=10) → _Length (cumulative) (computed)_

### Casing

- **HTML:** [Drilling/General Input/Casing.html](Drilling/General%20Input/Casing.html)
- **Paper:** letter · **margins** [25, 25, 25, 25] (1/100 in)
- **Master template:** template portrait header.afr
- **Root table:** `wvcas` · **filter:** wvwellheader / wvwellbore / Wellbore; wvwellboresize / dttmstart; wvcas / dttmrun; wvwellbore / idrec; wvcas / idrecwellbore
- **Captions:**
  - `<wvcas.des>`
- **Blocks:** 6

  - **Wellbore** — `wvwellbore` (2 fields)
    - `wvwellbore.des` (w=12) → _Description_
    - `wvwellbore.kickoffdepth` (w=9) → _Kickoffdepth_
  - **Wellboresize** — `wvwellboresize` (6 fields)
    - `wvwellboresize.des` (w=10) → _Description_
    - `wvwellboresize.sz` (w=10) → _Sz_
    - `wvwellboresize.depthtopactual` (w=10) → _Depth Topactual_
    - `wvwellboresize.depthbtmactual` (w=10) → _Depth Btmactual_
    - `wvwellboresize.dttmstart` (w=10) → _Start Date/Time_
    - `wvwellboresize.dttmend` (w=10) → _End Date/Time_
  - **Wellhead** — `wvwellhead` (4 fields)
    - `wvwellhead.typ` (w=15) → _Type_
    - `wvwellhead.dttmstart` (w=15) → _Start Date/Time_
    - `wvwellhead.service` (w=15) → _Service_
    - `wvwellhead.com` (w=50) → _Comment_
  - **Wellhead Components** — `wvwellheadcomp` (5 fields)
    - `wvwellheadcomp.des` (w=20) → _Description_
    - `wvwellheadcomp.make` (w=15) → _Make_
    - `wvwellheadcomp.model` (w=15) → _Model_
    - `wvwellheadcomp.sn` (w=12) → _Serial Number_
    - `wvwellheadcomp.workprestop` (w=7) → _Workprestop_
  - **Cas** — `wvcas` (6 fields)
    - `wvcas.des` (w=9) → _Description_
    - `wvcas.depthbtm` (w=9) → _Bottom Depth_
    - `wvcas.dttmrun` (w=9) → _Date/Time Run_
    - `wvcas.tension` (w=9) → _Tension_
    - `wvcas.centralizers` (w=30) → _Centralizers_
    - `wvcas.scratchers` (w=30) → _Scratchers_
  - **Cascomp** — `wvcascomp` (13 fields)
    - `wvcascomp.des` (w=15) → _Description_
    - `wvcascomp.szodnom` (w=7) → _Szodnom_
    - `wvcascomp.wtperlength` (w=8) → _Wtperlength_
    - `wvcascomp.grade` (w=7) → _Grade_
    - `wvcascomp.connthrdtop` (w=10) → _Connthrdtop_
    - `wvcascomp.joints` (w=4) → _Joints_
    - `wvcascomp.length` (w=9) → _Length_
    - `wvcascomp.depthtopcalc` (w=9) → _Top Depth (computed)_
    - `wvcascomp.depthbtmcalc` (w=9) → _Bottom Depth (computed)_
    - `wvcascomp.torquemin` (w=8) → _Torquemin_
    - `wvcascomp.usedclass` (w=6) → _Usedclass_
    - `wvcascomp.szodmax` (w=7) → _Szodmax_
    - `wvcascomp.szidnom` (w=7) → _Szidnom_

### Cement

- **HTML:** [Drilling/General Input/Cement.html](Drilling/General%20Input/Cement.html)
- **Paper:** letter · **margins** [25, 25, 25, 25] (1/100 in)
- **Master template:** template portrait header.afr
- **Root table:** `wvcement`
- **Captions:**
  - `<wvcement.des>`
- **Blocks:** 4

  - **Cement** — `wvcement` (6 fields)
    - `wvcement.dttmstart` (w=10) → _Start Date/Time_
    - `wvcement.dttmend` (w=10) → _End Date/Time_
    - `wvcement.idrecwellbore` (w=10) → _Idrecwellbore_
    - `wvcement.evalmethod` (w=10) → _Evalmethod_
    - `wvcement.deseval` (w=30) → _Description Eval_
    - `wvcement.com` (w=30) → _Comment_
  - **Cementstage** — `wvcementstage` (21 fields)
    - `wvcementstage.depthtop` (w=10) → _Top Depth_
    - `wvcementstage.depthbtm` (w=10) → _Bottom Depth_
    - `wvcementstage.fullreturn` (w=5) → _Fullreturn_
    - `wvcementstage.volreturncmnt` (w=5) → _Volreturncmnt_
    - `wvcementstage.topplug` (w=10) → _Topplug_
    - `wvcementstage.btmplug` (w=10) → _Btmplug_
    - `wvcementstage.ratepumpstart` (w=9) → _Ratepumpstart_
    - `wvcementstage.ratepumpend` (w=9) → _Ratepumpend_
    - `wvcementstage.ratepumpavg` (w=9) → _Ratepumpavg_
    - `wvcementstage.prespumpend` (w=9) → _Prespumpend_
    - `wvcementstage.presplugbump` (w=9) → _Presplugbump_
    - `wvcementstage.reciprocated` (w=9) → _Reciprocated_
    - `wvcementstage.recipstroke` (w=9) → _Recipstroke_
    - `wvcementstage.reciprate` (w=9) → _Reciprate_
    - `wvcementstage.rotated` (w=9) → _Rotated_
    - `wvcementstage.rotaterpm` (w=9) → _Rotaterpm_
    - `wvcementstage.depthtagged` (w=9) → _Depth Tagged_
    - `wvcementstage.tagmethod` (w=9) → _Tagmethod_
    - `wvcementstage.depthdrillout` (w=9) → _Depth Drillout_
    - `wvcementstage.oddrillout` (w=9) → _Oddrillout_
    - `wvcementstage.dttmdrillout` (w=9) → _Date/Time Drillout_
  - **Cementstagefluid** — `wvcementstagefluid` (15 fields)
    - `wvcementstagefluid.typ` (w=9) → _Type_
    - `wvcementstagefluid.desfluid` (w=9) → _Description Fluid_
    - `wvcementstagefluid.amtcement` (w=9) → _Amtcement_
    - `wvcementstagefluid.cmtclass` (w=9) → _Cmtclass_
    - `wvcementstagefluid.volpumped` (w=9) → _Volpumped_
    - `wvcementstagefluid.depthtopest` (w=9) → _Depth Topest_
    - `wvcementstagefluid.depthbtmest` (w=9) → _Depth Btmest_
    - `wvcementstagefluid.excesspumped` (w=9) → _Excesspumped_
    - `wvcementstagefluid.yield` (w=9) → _Yield_
    - `wvcementstagefluid.mixwaterratio` (w=9) → _Mixwaterratio_
    - `wvcementstagefluid.freewater` (w=9) → _Freewater_
    - `wvcementstagefluid.density` (w=9) → _Density_
    - `wvcementstagefluid.plasticvis` (w=9) → _Plasticvis_
    - `wvcementstagefluid.thickentm` (w=9) → _Thickentm_
    - `wvcementstagefluid.comprstr1` (w=9) → _Comprstr1_
  - **Cementstagefluidadd** — `wvcementstagefluidadd` (3 fields)
    - `wvcementstagefluidadd.des` (w=9) → _Description_
    - `wvcementstagefluidadd.typ` (w=9) → _Type_
    - `wvcementstagefluidadd.conc` (w=9) → _Conc_

### Cores - Bottomhole and Sidewall

- **HTML:** [Drilling/General Input/Cores - Bottomhole and Sidewall.html](Drilling/General%20Input/Cores%20-%20Bottomhole%20and%20Sidewall.html)
- **Paper:** letter · **margins** [12, 12, 31, 25] (1/100 in)
- **Master template:** template landscape header.afr
- **Root table:** `wvwellheader`
- **Blocks:** 3

  - **Core** — `wvcore` (12 fields)
    - `wvcore.dttm` (w=10) → _Dttm_
    - `wvcore.coreno` (w=5) → _Coreno_
    - `wvcore.typ` (w=10) → _Type_
    - `wvcore.depthtop` (w=10) → _Top Depth_
    - `wvcore.depthbtm` (w=10) → _Bottom Depth_
    - `wvcore.lenrecovered` (w=5) → _Lenrecovered_
    - `wvcore.pctrecovcalc` (w=5) → _% Recov (computed)_
    - `wvcore.szdiacore` (w=10) → _Szdiacore_
    - `wvcore.oriented` (w=5) → _Oriented_
    - `wvcore.contractor` (w=10) → _Contractor_
    - `wvcore.formationcalc` (w=10) → _Formation (computed)_
    - `wvcore.com` (w=50) → _Comment_
  - **Coresidewall** — `wvcoresidewall` (12 fields)
    - `wvcoresidewall.dttm` (w=10) → _Dttm_
    - `wvcoresidewall.runno` (w=10) → _Runno_
    - `wvcoresidewall.typ` (w=10) → _Type_
    - `wvcoresidewall.depthtopcalc` (w=10) → _Top Depth (computed)_
    - `wvcoresidewall.depthbtmcalc` (w=10) → _Bottom Depth (computed)_
    - `wvcoresidewall.contractor` (w=10) → _Contractor_
    - `wvcoresidewall.samplesplan` (w=10) → _Samplesplan_
    - `wvcoresidewall.samplesrecover` (w=10) → _Samplesrecover_
    - `wvcoresidewall.bulletsfire` (w=10) → _Bulletsfire_
    - `wvcoresidewall.bulletsmisfire` (w=10) → _Bulletsmisfire_
    - `wvcoresidewall.samplesempty` (w=10) → _Samplesempty_
    - `wvcoresidewall.sampleslostinhole` (w=10) → _Sampleslostinhole_
  - **Coresidewallsample** — `wvcoresidewallsample` (5 fields)
    - `wvcoresidewallsample.depthsample` (w=10) → _Depth Sample_
    - `wvcoresidewallsample.depthtvdsamplecalc` (w=10) → _Depth TVD Sample (computed)_
    - `wvcoresidewallsample.lengthsample` (w=10) → _Lengthsample_
    - `wvcoresidewallsample.result` (w=10) → _Result_
    - `wvcoresidewallsample.formationcalc` (w=10) → _Formation (computed)_

### DST

- **HTML:** [Drilling/General Input/DST.html](Drilling/General%20Input/DST.html)
- **Paper:** letter · **margins** [12, 12, 31, 25] (1/100 in)
- **Master template:** template landscape legal.afr
- **Root table:** `wvwellheader` · **filter:** wvwelltesttrans / wvwelltesttrans / typ; wvwellboresize / depthtopactual; wvwelltesttrans / depthbtm; wvwellboresize / depthbtmactual; wvwelltesttrans / depthtop; wvjobdrillstring / dttmincalc; wvwelltesttrans / dttm; wvjobreportmudchk / dttm; wvwelltesttrans / dttm; wvwelltesttrans / typ
- **Captions:**
  - `<wvwelltesttrans.typ>,  <wvwelltesttrans.dttm>`
- **Blocks:** 9

  - **Hole Size** — `wvwellboresize` (4 fields)
    - `wvwellboresize.des` (w=10) → _Description_
    - `wvwellboresize.sz` (w=10) → _Sz_
    - `wvwellboresize.depthbtmactual` (w=10) → _Depth Btmactual_
    - `wvwellboresize.depthtopactual` (w=10) → _Depth Topactual_
  - **Last Drill String** — `wvjobdrillstring` (3 fields)
    - `wvjobdrillstring.stringno` (w=10) → _Stringno_
    - `wvjobdrillstring.des` (w=20) → _Description_
    - `wvjobdrillstring.lengthcalc` (w=10) → _Length (computed)_
  - **Drill String Component** — `wvjobdrillstringcomp` (4 fields)
    - `wvjobdrillstringcomp.des` (w=20) → _Description_
    - `wvjobdrillstringcomp.szodnom` (w=10) → _Szodnom_
    - `wvjobdrillstringcomp.szidnom` (w=10) → _Szidnom_
    - `wvjobdrillstringcomp.length` (w=10) → _Length_
  - **Last Mud Check** — `wvjobreportmudchk` (7 fields)
    - `wvjobreportmudchk.mudtyp` (w=20) → _Mudtyp_
    - `wvjobreportmudchk.dttm` (w=10) → _Dttm_
    - `wvjobreportmudchk.depth` (w=10) → _Depth_
    - `wvjobreportmudchk.density` (w=10) → _Density_
    - `wvjobreportmudchk.funnelviscosity` (w=10) → _Funnelviscosity_
    - `wvjobreportmudchk.filtrate` (w=10) → _Filtrate_
    - `wvjobreportmudchk.chlorides` (w=10) → _Chlorides_
  - **Well Header** — `wvwellheader` (8 fields)
    - `wvwellheader.wellida` (w=10) → _Well ID_
    - `wvwellheader.legalsurveyloc` (w=10) → _Legalsurveyloc_
    - `wvwellheader.welllicenseno` (w=10) → _Welllicenseno_
    - `wvwellheader.wellconfig` (w=10) → _Wellconfig_
    - `wvwellheader.elvground` (w=10) → _Elvground_
    - `wvwellheader.elvcasflange` (w=10) → _Elvcasflange_
    - `wvwellheader.kbtogrdcalc` (w=10) → _Kbtogrd (computed)_
    - `wvwellheader.kbtocascalc` (w=10) → _Kbtocas (computed)_
  - **DST Details** — `wvwelltesttrans` (8 fields)
    - `wvwelltesttrans.dttm` (w=5) → _Dttm_
    - `wvwelltesttrans.typ` (w=10) → _Type_
    - `wvwelltesttrans.subtyp` (w=10) → _Subtyp_
    - `wvwelltesttrans.depthtop` (w=5) → _Top Depth_
    - `wvwelltesttrans.depthbtm` (w=5) → _Bottom Depth_
    - `wvwelltesttrans.formationcalc` (w=10) → _Formation (computed)_
    - `wvwelltesttrans.testedby` (w=10) → _Testedby_
    - `wvwelltesttrans.com` (w=50) → _Comment_
  - **Welltesttransdst** — `wvwelltesttransdst` (6 fields)
    - `wvwelltesttransdst.blowdes` (w=20) → _Blowdes_
    - `wvwelltesttransdst.fluidtosurface` (w=10) → _Fluidtosurface_
    - `wvwelltesttransdst.timetosurface` (w=10) → _Timetosurface_
    - `wvwelltesttransdst.cushdes` (w=20) → _Cushdes_
    - `wvwelltesttransdst.cushdensity` (w=10) → _Cushdensity_
    - `wvwelltesttransdst.cushheight` (w=10) → _Cushheight_
  - **Cushion Details** — `wvwelltesttransgauge` (6 fields)
    - `wvwelltesttransgauge.des` (w=10) → _Description_
    - `wvwelltesttransgauge.typ` (w=10) → _Type_
    - `wvwelltesttransgauge.gaugeloc` (w=10) → _Gaugeloc_
    - `wvwelltesttransgauge.depth` (w=10) → _Depth_
    - `wvwelltesttransgauge.sn` (w=10) → _Serial Number_
    - `wvwelltesttransgauge.presrange` (w=10) → _Presrange_
  - **Welltesttransflowper** — `wvwelltesttransflowper` (13 fields)
    - `wvwelltesttransflowper.typ` (w=10) → _Type_
    - `wvwelltesttransflowper.idrecgaugeused` (w=10) → _Idrecgaugeused_
    - `wvwelltesttransflowper.dttmstart` (w=10) → _Start Date/Time_
    - `wvwelltesttransflowper.dttmend` (w=10) → _End Date/Time_
    - `wvwelltesttransflowper.presbhinit` (w=10) → _Presbhinit_
    - `wvwelltesttransflowper.presbhend` (w=10) → _Presbhend_
    - `wvwelltesttransflowper.tempbhend` (w=10) → _Tempbhend_
    - `wvwelltesttransflowper.szdiachoke` (w=10) → _Szdiachoke_
    - `wvwelltesttransflowper.rategasend` (w=10) → _Rategasend_
    - `wvwelltesttransflowper.volumeoiltotal` (w=10) → _Volumeoiltotal_
    - `wvwelltesttransflowper.volumecondtotal` (w=10) → _Volumecondtotal_
    - `wvwelltesttransflowper.volumegastotal` (w=10) → _Volumegastotal_
    - `wvwelltesttransflowper.volumewatertotal` (w=10) → _Volumewatertotal_

### Directional Plot_Plan vs Actual

- **HTML:** [Drilling/General Input/Directional Plot_Plan vs Actual.html](Drilling/General%20Input/Directional%20Plot_Plan%20vs%20Actual.html)
- **Paper:** letter · **margins** [12, 12, 31, 25] (1/100 in)
- **Master template:** template landscape header.afr
- **Root table:** `wvwellbore` · **filter:** wvwdsvscalc / idrecparent; wvwellbore / idrec; wvwdsvscalc / proposed; wvwellboredirsurveydata / idrecparent; wvwellbore / idrecdirsrvyprop; wvwdsvscalc / idrecparent; wvwellbore / idrec; wvwdsvscalc / proposed
- **Captions:**
  - `<wvwdsvsdatacalc.note>`
  - `<wvwellboredirsurveydata.surveymethod>`
  - `<wvwellboredirsurveydata.surveymethod>`
- **Blocks:** 4

  - **Vertical Section** — `wvwdsvsdatacalc` (1 fields)
    - `wvwdsvsdatacalc.tvd` (w=0) → _Tvd_
  - **Wellboredirsurveydata** — `wvwellboredirsurveydata` (1 fields)
    - `wvwellboredirsurveydata.tvdcalc` (w=0) → _Tvd (computed)_
  - **Wdsvsdatacalc** — `wvwdsvsdatacalc` (1 fields)
    - `wvwdsvsdatacalc.ns` (w=0) → _Ns_
  - **Wellboredirsurveydata** — `wvwellboredirsurveydata` (1 fields)
    - `wvwellboredirsurveydata.nscalc` (w=0) → _Ns (computed)_

### Directional Survey

- **HTML:** [Drilling/General Input/Directional Survey.html](Drilling/General%20Input/Directional%20Survey.html)
- **Paper:** letter · **margins** [25, 25, 25, 25] (1/100 in)
- **Master template:** template portrait header.afr
- **Root table:** `wvwellboredirsurvey` · **filter:** wvwellboredirsurveydata / dontuse
- **Blocks:** 3

  - **Wellbore** — `wvwellbore` (4 fields)
    - `wvwellbore.des` (w=10) → _Description_
    - `wvwellbore.idrecparent` (w=10) → _Idrecparent_
    - `wvwellbore.kickoffdepth` (w=10) → _Kickoffdepth_
    - `wvwellbore.vsdir` (w=10) → _Vsdir_
  - **Wellboredirsurvey** — `wvwellboredirsurvey` (10 fields)
    - `wvwellboredirsurvey.dttm` (w=10) → _Dttm_
    - `wvwellboredirsurvey.definitive` (w=10) → _Definitive_
    - `wvwellboredirsurvey.des` (w=10) → _Description_
    - `wvwellboredirsurvey.proposed` (w=10) → _Proposed_
    - `wvwellboredirsurvey.mdtiein` (w=10) → _Mdtiein_
    - `wvwellboredirsurvey.tvdtiein` (w=10) → _Tvdtiein_
    - `wvwellboredirsurvey.inclinationtiein` (w=10) → _Inclinationtiein_
    - `wvwellboredirsurvey.azimuthtiein` (w=10) → _Azimuthtiein_
    - `wvwellboredirsurvey.nstiein` (w=10) → _Nstiein_
    - `wvwellboredirsurvey.ewtiein` (w=10) → _Ewtiein_
  - **Survey Data** — `wvwellboredirsurveydata` (14 fields)
    - `wvwellboredirsurveydata.dttm` (w=15) → _Dttm_
    - `wvwellboredirsurveydata.md` (w=10) → _Md_
    - `wvwellboredirsurveydata.inclination` (w=10) → _Inclination_
    - `wvwellboredirsurveydata.azimuth` (w=10) → _Azimuth_
    - `wvwellboredirsurveydata.tvdcalc` (w=10) → _Tvd (computed)_
    - `wvwellboredirsurveydata.vscalc` (w=10) → _Vs (computed)_
    - `wvwellboredirsurveydata.nscalc` (w=10) → _Ns (computed)_
    - `wvwellboredirsurveydata.ewcalc` (w=10) → _Ew (computed)_
    - `wvwellboredirsurveydata.dlscalc` (w=10) → _Dogleg Severity (computed)_
    - `wvwellboredirsurveydata.buildratecalc` (w=10) → _Buildrate (computed)_
    - `wvwellboredirsurveydata.turnratecalc` (w=10) → _Turnrate (computed)_
    - `wvwellboredirsurveydata.displaceunwrapcalc` (w=10) → _Displaceunwrap (computed)_
    - `wvwellboredirsurveydata.surveymethod` (w=10) → _Surveymethod_
    - `wvwellboredirsurveydata.surveyedby` (w=15) → _Surveyedby_

### Drilling Waste Disposal

- **HTML:** [Drilling/General Input/Drilling Waste Disposal.html](Drilling/General%20Input/Drilling%20Waste%20Disposal.html)
- **Paper:** letter · **margins** [12, 12, 31, 25] (1/100 in)
- **Master template:** template landscape header cw.afr
- **Root table:** `wvjobreport` · **filter:** wvjob / wvtyp / drill; wvjob / idrec; wvjobreport / idrecparent
- **Blocks:** 2

  - **Daily Report** — `wvjobreport` (6 fields)
    - `wvjob.afenumbercalc` (w=10) → _AFE Number_
    - `wvjobreport.reportnocalc` (w=10) → _Report #_
    - `wvjobreport.dttmstart` (w=10) → _Start Date/Time_
    - `wvjobreport.dttmend` (w=10) → _End Date/Time_
    - `wvjobreport.costtotalcalc` (w=10) → _Daily Cost Total_
    - `wvjobreport.costtodatecalc` (w=10) → _Cost To Date_
  - **Jobreportfluidslease** — `wvjobreportfluidslease` (8 fields)
    - `wvjobreportfluidslease.fluidtyp` (w=10) → _Fluidtyp_
    - `wvjobreportfluidslease.tolease` (w=6) → _Tolease_
    - `wvjobreportfluidslease.source` (w=15) → _Source_
    - `wvjobreportfluidslease.fromlease` (w=6) → _Fromlease_
    - `wvjobreportfluidslease.dest` (w=15) → _Description T_
    - `wvjobreportfluidslease.carrier` (w=15) → _Carrier_
    - `wvjobreportfluidslease.environmenttyp` (w=15) → _Environmenttyp_
    - `wvjobreportfluidslease.note` (w=35) → _Note_

### Inspections

- **HTML:** [Drilling/General Input/Inspections.html](Drilling/General%20Input/Inspections.html)
- **Paper:** letter · **margins** [25, 25, 25, 25] (1/100 in)
- **Master template:** template portrait header.afr
- **Root table:** `wvinspectdetail`
- **Captions:**
  - `Type:  <wvinspect.typ1>`
- **Blocks:** 3

  - **Inspect** — `wvinspect` (11 fields)
    - `wvinspect.typ1` (w=10) → _Typ1_
    - `wvinspect.typ2` (w=10) → _Typ2_
    - `wvinspect.des` (w=20) → _Description_
    - `wvinspect.requiredby` (w=10) → _Requiredby_
    - `wvinspect.idrecitem` (w=10) → _Idrecitem_
    - `wvinspect.dttmstartrecur` (w=10) → _Date/Time Startrecur_
    - `wvinspect.dttmendrecur` (w=10) → _Date/Time Endrecur_
    - `wvinspect.recurfrequency` (w=10) → _Recurfrequency_
    - `wvinspect.recurnote` (w=10) → _Recurnote_
    - `wvinspect.dttmlastinspectioncalc` (w=10) → _Date/Time Lastinspection (computed)_
    - `wvinspect.dttmnextinspectioncalc` (w=10) → _Date/Time Nextinspection (computed)_
  - **Recurring Inspection Details** — `wvinspectdetail` (6 fields)
    - `wvinspectdetail.dttm` (w=10) → _Dttm_
    - `wvinspectdetail.inspectedbyname` (w=15) → _Inspectedbyname_
    - `wvinspectdetail.inspectedbycompany` (w=10) → _Inspectedbycompany_
    - `wvinspectdetail.actionreqdcom` (w=5) → _Actual Ionreqdcom_
    - `wvinspectdetail.actiontakencom` (w=10) → _Actual Iontakencom_
    - `wvinspectdetail.status` (w=10) → _Status_
  - **Inspectdetailchecklist** — `wvinspectdetailchecklist` (6 fields)
    - `wvinspectdetailchecklist.typ1` (w=15) → _Typ1_
    - `wvinspectdetailchecklist.typ2` (w=20) → _Typ2_
    - `wvinspectdetailchecklist.value` (w=5) → _Value_
    - `wvinspectdetailchecklist.valueunit` (w=5) → _Valueunit_
    - `wvinspectdetailchecklist.refno` (w=5) → _Refno_
    - `wvinspectdetailchecklist.actionrqd` (w=5) → _Actual Ionrqd_

### Leak Off & Formation Integrity Tests

- **HTML:** [Drilling/General Input/Leak Off & Formation Integrity Tests.html](Drilling/General%20Input/Leak%20Off%20%26%20Formation%20Integrity%20Tests.html)
- **Paper:** letter · **margins** [12, 12, 31, 25] (1/100 in)
- **Master template:** template landscape header.afr
- **Root table:** `None`
- **Blocks:** 1

  - **Testleakoff** — `wvtestleakoff` (14 fields)
    - `wvtestleakoff.dttm` (w=9) → _Dttm_
    - `wvtestleakoff.testtyp` (w=10) → _Testtyp_
    - `wvtestleakoff.depth` (w=10) → _Depth_
    - `wvtestleakoff.tvdcalc` (w=10) → _Tvd (computed)_
    - `wvtestleakoff.fluidtyp` (w=10) → _Fluidtyp_
    - `wvtestleakoff.densityfluid` (w=10) → _Densityfluid_
    - `wvtestleakoff.leakoffpres` (w=10) → _Leakoffpres_
    - `wvtestleakoff.volpumped` (w=10) → _Volpumped_
    - `wvtestleakoff.leakoffoccurred` (w=5) → _Leakoffoccurred_
    - `wvtestleakoff.leakoffprescalc` (w=10) → _Leakoffpres (computed)_
    - `wvtestleakoff.leakoffdensityfluidcalc` (w=10) → _Leakoffdensityfluid (computed)_
    - `wvtestleakoff.idrecfrm` (w=10) → _Idrecfrm_
    - `wvtestleakoff.idreccas` (w=15) → _Idreccas_
    - `wvtestleakoff.com` (w=25) → _Comment_

### Lessons and Problems

- **HTML:** [Drilling/General Input/Lessons and Problems.html](Drilling/General%20Input/Lessons%20and%20Problems.html)
- **Paper:** letter · **margins** [12, 12, 31, 25] (1/100 in)
- **Master template:** template landscape header.afr
- **Root table:** `wvjob` · **filter:** wvjob / wvtyp / dril; wvjob / wvjobintervallesson / Lessons; wvjob / wvjobintervalproblem / Problems
- **Captions:**
  - `@\<wvjobintervallesson.typ>,  <wvjobintervallesson.dttmstart> - `
  - `vjobintervalproblem.typ>,  <wvjobintervalproblem.typdetail>,  <wvjobintervalproblem.dttmstart> -  <wvjobintervalproblem`
- **Blocks:** 2

  - **Interval Lesson** — `wvjobintervallesson` (12 fields)
    - `wvjobintervallesson.typdetail` (w=20) → _Typdetail_
    - `wvjobintervallesson.depthstart` (w=10) → _Depth Start_
    - `wvjobintervallesson.depthend` (w=10) → _Depth End_
    - `wvjobintervallesson.esttimesaving` (w=10) → _Estimate Timesaving_
    - `wvjobintervallesson.estcostsaving` (w=10) → _Estimate Costsaving_
    - `wvjobintervallesson.com` (w=30) → _Comment_
    - `wvjobintervalproblem.des` (w=20) → _Description_
    - `wvjobintervalproblem.depthstart` (w=10) → _Depth Start_
    - `wvjobintervalproblem.depthend` (w=10) → _Depth End_
    - `wvjobintervalproblem.estlosttime` (w=10) → _Estimate Losttime_
    - `wvjobintervalproblem.estcostoverride` (w=10) → _Estimate Costoverride_
    - `wvjobintervalproblem.com` (w=30) → _Comment_
  - **Job** — `wvjob` (8 fields)
    - `wvjob.dttmstart` (w=10) → _Start Date/Time_
    - `wvjob.dttmend` (w=10) → _End Date/Time_
    - `wvjob.jobtyp` (w=10) → _Jobtyp_
    - `wvjob.afenumbercalc` (w=10) → _AFE Number_
    - `wvjob.estcostsavecalc` (w=10) → _Estimate Costsave (computed)_
    - `wvjob.esttimesavecalc` (w=10) → _Estimate Timesave (computed)_
    - `wvjob.estproblemcostcalc` (w=10) → _Estimate Problemcost (computed)_
    - `wvjob.estproblemtimecalc` (w=10) → _Estimate Problemtime (computed)_

### Logs

- **HTML:** [Drilling/General Input/Logs.html](Drilling/General%20Input/Logs.html)
- **Paper:** letter · **margins** [25, 25, 25, 25] (1/100 in)
- **Master template:** template portrait header.afr
- **Root table:** `None`
- **Blocks:** 1

  - **Log** — `wvlog` (6 fields)
    - `wvlog.dttm` (w=10) → _Dttm_
    - `wvlog.typ` (w=15) → _Type_
    - `wvlog.depthtop` (w=9) → _Top Depth_
    - `wvlog.depthbtm` (w=9) → _Bottom Depth_
    - `wvlog.contractor` (w=30) → _Contractor_
    - `wvlog.com` (w=30) → _Comment_

### Material Transfer

- **HTML:** [Drilling/General Input/Material Transfer.html](Drilling/General%20Input/Material%20Transfer.html)
- **Paper:** letter · **margins** [12, 12, 31, 25] (1/100 in)
- **Master template:** template landscape.afr
- **Root table:** `wvjobmaterialtrans` · **filter:** wvjob / wvtyp / drill
- **Blocks:** 3

  - **Job** — `wvjob` (6 fields)
    - `wvjob.wvtyp` (w=10) → _Wvtyp_
    - `wvjob.jobtyp` (w=10) → _Jobtyp_
    - `wvjob.jobsubtyp` (w=10) → _Jobsubtyp_
    - `wvjob.dttmstart` (w=10) → _Start Date/Time_
    - `wvjob.dttmend` (w=10) → _End Date/Time_
    - `wvjob.afenumbercalc` (w=10) → _AFE Number_
  - **Jobmaterialtrans** — `wvjobmaterialtrans` (7 fields)
    - `wvjobmaterialtrans.materialtransno` (w=10) → _Materialtransno_
    - `wvjobmaterialtrans.tofrom` (w=10) → _Tofrom_
    - `wvjobmaterialtrans.dttm` (w=10) → _Dttm_
    - `wvjobmaterialtrans.locationdes` (w=10) → _Locationdes_
    - `wvjobmaterialtrans.carrier` (w=10) → _Carrier_
    - `wvjobmaterialtrans.carrierrefno` (w=10) → _Carrierrefno_
    - `wvjobmaterialtrans.idrecjobcontact` (w=10) → _Contact Record_
  - **Transfer Items** — `wvjobmaterialtransdetail` (8 fields)
    - `wvjobmaterialtransdetail.materialtyp1` (w=10) → _Materialtyp1_
    - `wvjobmaterialtransdetail.materialdes` (w=10) → _Materialdes_
    - `wvjobmaterialtransdetail.materialrefno` (w=10) → _Materialrefno_
    - `wvjobmaterialtransdetail.sn` (w=10) → _Serial Number_
    - `wvjobmaterialtransdetail.qty` (w=5) → _Qty_
    - `wvjobmaterialtransdetail.qtyunitlabel` (w=5) → _Quantity Unitlabel_
    - `wvjobmaterialtransdetail.cond` (w=10) → _Cond_
    - `wvjobmaterialtransdetail.reason` (w=10) → _Reason_

### Offline Time Log

- **HTML:** [Drilling/General Input/Offline Time Log.html](Drilling/General%20Input/Offline%20Time%20Log.html)
- **Paper:** letter · **margins** [25, 25, 25, 25] (1/100 in)
- **Master template:** template landscape header.afr
- **Root table:** `wvjoboffline` · **filter:** wvjob / wvtyp / drill
- **Blocks:** 3

  - **Job** — `wvjob` (5 fields)
    - `wvjob.wvtyp` (w=10) → _Wvtyp_
    - `wvjob.jobtyp` (w=10) → _Jobtyp_
    - `wvjob.afenumbercalc` (w=10) → _AFE Number_
    - `wvjob.dttmstart` (w=10) → _Start Date/Time_
    - `wvjob.dttmend` (w=10) → _End Date/Time_
  - **Joboffline** — `wvjoboffline` (5 fields)
    - `wvjoboffline.des` (w=10) → _Description_
    - `wvjoboffline.typ1` (w=10) → _Typ1_
    - `wvjoboffline.typ2` (w=10) → _Typ2_
    - `wvjoboffline.dttmstart` (w=10) → _Start Date/Time_
    - `wvjoboffline.com` (w=25) → _Comment_
  - **Jobofflinetimelog** — `wvjobofflinetimelog` (11 fields)
    - `wvjobofflinetimelog.dttmstartcalc` (w=10) → _Start Date/Time (computed)_
    - `wvjobofflinetimelog.duration` (w=10) → _Duration Ation_
    - `wvjobofflinetimelog.sumofdurationcalc` (w=10) → _Sumofduration (computed)_
    - `wvjobofflinetimelog.dttmendcalc` (w=10) → _End Date/Time (computed)_
    - `wvjobofflinetimelog.code1` (w=10) → _Code 1_
    - `wvjobofflinetimelog.code2` (w=10) → _Code 2_
    - `wvjobofflinetimelog.opscategory` (w=10) → _Opscategory_
    - `wvjobofflinetimelog.inactive` (w=10) → _Inactive_
    - `wvjobofflinetimelog.unschedtyp` (w=10) → _Unschedtyp_
    - `wvjobofflinetimelog.affectonline` (w=10) → _Affectonline_
    - `wvjobofflinetimelog.com` (w=20) → _Comment_

### Other in Hole

- **HTML:** [Drilling/General Input/Other in Hole.html](Drilling/General%20Input/Other%20in%20Hole.html)
- **Paper:** letter · **margins** [25, 25, 25, 25] (1/100 in)
- **Master template:** template portrait header cw.afr
- **Root table:** `wvwellheader` · **filter:** wvcement / cementtyp
- **Blocks:** 4

  - **Otherinhole** — `wvotherinhole` (7 fields)
    - `wvotherinhole.des` (w=25) → _Description_
    - `wvotherinhole.dttmrun` (w=10) → _Date/Time Run_
    - `wvotherinhole.dttmpull` (w=10) → _Date/Time Pull_
    - `wvotherinhole.depthtop` (w=10) → _Top Depth_
    - `wvotherinhole.depthbtm` (w=10) → _Bottom Depth_
    - `wvotherinhole.szodnom` (w=10) → _Szodnom_
    - `wvotherinhole.com` (w=25) → _Comment_
  - **Cement (filtered for Type=Plug)** — `wvcement` (6 fields)
    - `wvcement.des` (w=10) → _Description_
    - `wvcement.cementtyp` (w=10) → _Cementtyp_
    - `wvcement.idrecstring` (w=10) → _Idrecstring_
    - `wvcement.dttmstart` (w=10) → _Start Date/Time_
    - `wvcement.dttmend` (w=10) → _End Date/Time_
    - `wvcement.idrecwellbore` (w=10) → _Idrecwellbore_
  - **Cementstage** — `wvcementstage` (6 fields)
    - `wvcementstage.stagenum` (w=10) → _Stagenum_
    - `wvcementstage.des` (w=10) → _Description_
    - `wvcementstage.depthtop` (w=10) → _Top Depth_
    - `wvcementstage.depthtvdtopcalc` (w=10) → _Depth TVD Top (computed)_
    - `wvcementstage.depthbtm` (w=10) → _Bottom Depth_
    - `wvcementstage.depthtvdbtmcalc` (w=10) → _Depth TVD Btm (computed)_
  - **Cementstagefluid** — `wvcementstagefluid` (7 fields)
    - `wvcementstagefluid.typ` (w=10) → _Type_
    - `wvcementstagefluid.depthtopest` (w=10) → _Depth Topest_
    - `wvcementstagefluid.depthbtmest` (w=10) → _Depth Btmest_
    - `wvcementstagefluid.cmtclass` (w=10) → _Cmtclass_
    - `wvcementstagefluid.amtcement` (w=10) → _Amtcement_
    - `wvcementstagefluid.yield` (w=10) → _Yield_
    - `wvcementstagefluid.volpumped` (w=10) → _Volpumped_

### Safety Incident

- **HTML:** [Drilling/General Input/Safety Incident.html](Drilling/General%20Input/Safety%20Incident.html)
- **Paper:** letter · **margins** [25, 25, 25, 25] (1/100 in)
- **Master template:** template portrait header.afr
- **Root table:** `wvjob` · **filter:** wvjob / wvtyp / drill*
- **Blocks:** 2

  - **Job** — `wvjob` (5 fields)
    - `wvjob.wvtyp` (w=10) → _Wvtyp_
    - `wvjob.jobtyp` (w=10) → _Jobtyp_
    - `wvjob.afenumbercalc` (w=10) → _AFE Number_
    - `wvjob.dttmstart` (w=10) → _Start Date/Time_
    - `wvjob.dttmend` (w=10) → _End Date/Time_
  - **Jobsafetyincident** — `wvjobsafetyincident` (6 fields)
    - `wvjobsafetyincident.dttm` (w=15) → _Dttm_
    - `wvjobsafetyincident.category` (w=15) → _Category_
    - `wvjobsafetyincident.typ1` (w=15) → _Typ1_
    - `wvjobsafetyincident.severity` (w=15) → _Severity_
    - `wvjobsafetyincident.cause` (w=15) → _Cause_
    - `wvjobsafetyincident.com` (w=50) → _Comment_

### Wellbore Details

- **HTML:** [Drilling/General Input/Wellbore Details.html](Drilling/General%20Input/Wellbore%20Details.html)
- **Paper:** letter · **margins** [25, 25, 25, 25] (1/100 in)
- **Master template:** template portrait header.afr
- **Root table:** `wvwdsvscalc` · **filter:** wvwellbore / idrec; wvwdsvscalc / proposed; wvwdsvscalc / idrecparent; wvwellbore / idrec; wvwdsvscalc / proposed
- **Captions:**
  - `<wvwdsvsdatacalc.note>`
- **Blocks:** 4

  - **Vertical Section** — `wvwdsvsdatacalc` (1 fields)
    - `wvwdsvsdatacalc.tvd` (w=0) → _Tvd_
  - **Wellbore** — `wvwellbore` (10 fields)
    - `wvwellbore.des` (w=9) → _Description_
    - `wvwellbore.idrecparent` (w=9) → _Idrecparent_
    - `wvwellbore.legalsurveyloc` (w=9) → _Legalsurveyloc_
    - `wvwellbore.depthstart` (w=6) → _Depth Start_
    - `wvwellbore.profiletyp` (w=9) → _Profiletyp_
    - `wvwellbore.vsdir` (w=9) → _Vsdir_
    - `wvwellbore.dttmkickoff` (w=10) → _Date/Time Kickoff_
    - `wvwellbore.kickoffdepth` (w=10) → _Kickoffdepth_
    - `wvwellbore.depthtvdkickoffcalc` (w=10) → _Depth TVD Kickoff (computed)_
    - `wvwellbore.kickoffmethod` (w=10) → _Kickoffmethod_
  - **Wellbore Kick Off Details** — `wvwellboresize` (6 fields)
    - `wvwellboresize.des` (w=10) → _Description_
    - `wvwellboresize.sz` (w=10) → _Sz_
    - `wvwellboresize.dttmstart` (w=10) → _Start Date/Time_
    - `wvwellboresize.dttmend` (w=10) → _End Date/Time_
    - `wvwellboresize.depthtopactual` (w=10) → _Depth Topactual_
    - `wvwellboresize.depthbtmactual` (w=10) → _Depth Btmactual_
  - **Wdsvsdatacalc** — `wvwdsvsdatacalc` (1 fields)
    - `wvwdsvsdatacalc.ns` (w=0) → _Ns_

### Wellhead

- **HTML:** [Drilling/General Input/Wellhead.html](Drilling/General%20Input/Wellhead.html)
- **Paper:** letter · **margins** [12, 12, 31, 25] (1/100 in)
- **Master template:** template landscape header.afr
- **Root table:** `wvwellhead`
- **Blocks:** 3

  - **Wellhead** — `wvwellhead` (4 fields)
    - `wvwellhead.typ` (w=10) → _Type_
    - `wvwellhead.make` (w=10) → _Make_
    - `wvwellhead.maxpres` (w=10) → _Max Pres_
    - `wvwellhead.dttmstart` (w=10) → _Start Date/Time_
  - **Wellheadcomp** — `wvwellheadcomp` (10 fields)
    - `wvwellheadcomp.des` (w=25) → _Description_
    - `wvwellheadcomp.make` (w=10) → _Make_
    - `wvwellheadcomp.model` (w=10) → _Model_
    - `wvwellheadcomp.workpres` (w=10) → _Workpres_
    - `wvwellheadcomp.service` (w=10) → _Service_
    - `wvwellheadcomp.workprestop` (w=10) → _Workprestop_
    - `wvwellheadcomp.ringgaskettop` (w=10) → _Ringgaskettop_
    - `wvwellheadcomp.minbore` (w=10) → _Min Bore_
    - `wvwellheadcomp.sn` (w=10) → _Serial Number_
    - `wvwellheadcomp.com` (w=15) → _Comment_
  - **Wellhead Attached Files** — `wvwellheadattachment` (5 fields)
    - `wvwellheadattachment.des` (w=10) → _Description_
    - `wvwellheadattachment.attachida` (w=10) → _Attachida_
    - `wvwellheadattachment.dttm` (w=10) → _Dttm_
    - `wvwellheadattachment.typ1` (w=10) → _Typ1_
    - `wvwellheadattachment.typ2` (w=10) → _Typ2_

## Drilling/Drilling Summary

### AFE vs Field Est (Multi AFE)

- **HTML:** [Drilling/Drilling Summary/AFE vs Field Est (Multi AFE).html](Drilling/Drilling%20Summary/AFE%20vs%20Field%20Est%20%28Multi%20AFE%29.html)
- **Paper:** letter · **margins** [25, 25, 25, 25] (1/100 in)
- **Master template:** template portrait header.afr
- **Root table:** `wvjobafe` · **filter:** wvjob / wvtyp / drill
- **Blocks:** 3

  - **Job** — `wvjob` (11 fields)
    - `wvjob.wvtyp` (w=10) → _Wvtyp_
    - `wvjob.jobtyp` (w=10) → _Jobtyp_
    - `wvjob.dttmstart` (w=10) → _Start Date/Time_
    - `wvjob.dttmend` (w=10) → _End Date/Time_
    - `wvjob.status1` (w=10) → _Status1_
    - `wvjob.afetotalcalc` (w=10) → _AFE Total_
    - `wvjob.afeamtcalc` (w=10) → _Afeamt (computed)_
    - `wvjob.afesupamtcalc` (w=10) → _Afesupamt (computed)_
    - `wvjob.costtotalcalc` (w=10) → _Daily Cost Total_
    - `wvjob.variancefieldcalc` (w=10) → _Variancefield (computed)_
    - `wvjob.summary` (w=50) → _Summary_
  - **Job Summary** — `wvjobafe` (10 fields)
    - `wvjobafe.afenumber` (w=10) → _Afenumber_
    - `wvjobafe.afenumbersupp` (w=10) → _Afenumbersupp_
    - `wvjobafe.typ` (w=10) → _Type_
    - `wvjobafe.dttmafe` (w=10) → _Date/Time Afe_
    - `wvjobafe.afestatus` (w=10) → _Afestatus_
    - `wvjobafe.afetotalcalc` (w=10) → _AFE Total_
    - `wvjobafe.afeamtcalc` (w=10) → _Afeamt (computed)_
    - `wvjobafe.afesupamtcalc` (w=10) → _Afesupamt (computed)_
    - `wvjobafe.costtotalcalc` (w=10) → _Daily Cost Total_
    - `wvjobafe.variancefieldcalc` (w=10) → _Variancefield (computed)_
  - **Jafecostcumcalc** — `wvjafecostcumcalc` (8 fields)
    - `wvjafecostcumcalc.des` (w=25) → _Description_
    - `wvjafecostcumcalc.code1` (w=10) → _Code 1_
    - `wvjafecostcumcalc.code2` (w=10) → _Code 2_
    - `wvjafecostcumcalc.costafe` (w=10) → _Costafe_
    - `wvjafecostcumcalc.costafesup` (w=10) → _Costafesup_
    - `wvjafecostcumcalc.costafetotal` (w=10) → _Costafetotal_
    - `wvjafecostcumcalc.costfieldest` (w=10) → _Costfieldest_
    - `wvjafecostcumcalc.costvar` (w=10) → _Costvar_

### AFE vs Field Est - Graph

- **HTML:** [Drilling/Drilling Summary/AFE vs Field Est - Graph.html](Drilling/Drilling%20Summary/AFE%20vs%20Field%20Est%20-%20Graph.html)
- **Paper:** letter · **margins** [12, 12, 31, 25] (1/100 in)
- **Master template:** template landscape.afr
- **Root table:** `wvjob` · **filter:** wvjob / wvtyp / drill; wvjcostcumcalc / des; wvjcostcumcalc / des
- **Captions:**
  - `<wvjcostcumcalc.costafetotal>`
  - `<wvjcostcumcalc.costfieldest>`
  - `AFE#:  <wvjob.afenumbercalc>`
- **Blocks:** 2

  - **Jcostcumcalc** — `wvjcostcumcalc` (1 fields)
    - `wvjcostcumcalc.costafetotal` (w=0) → _Costafetotal_
  - **Jcostcumcalc** — `wvjcostcumcalc` (1 fields)
    - `wvjcostcumcalc.costfieldest` (w=0) → _Costfieldest_

### AFE vs Field Est vs Final Invoice

- **HTML:** [Drilling/Drilling Summary/AFE vs Field Est vs Final Invoice.html](Drilling/Drilling%20Summary/AFE%20vs%20Field%20Est%20vs%20Final%20Invoice.html)
- **Paper:** letter · **margins** [25, 25, 25, 25] (1/100 in)
- **Master template:** template portrait header.afr
- **Root table:** `None` · **filter:** wvjob / wvjob / jobtyp
- **Blocks:** 2

  - **Job** — `wvjob` (11 fields)
    - `wvjob.wvtyp` (w=10) → _Wvtyp_
    - `wvjob.jobtyp` (w=10) → _Jobtyp_
    - `wvjob.dttmstart` (w=10) → _Start Date/Time_
    - `wvjob.dttmend` (w=10) → _End Date/Time_
    - `wvjob.status1` (w=10) → _Status1_
    - `wvjob.afenumbercalc` (w=10) → _AFE Number_
    - `wvjob.afeamtcalc` (w=10) → _Afeamt (computed)_
    - `wvjob.afesupamtcalc` (w=10) → _Afesupamt (computed)_
    - `wvjob.costtotalcalc` (w=10) → _Daily Cost Total_
    - `wvjob.variancefieldcalc` (w=10) → _Variancefield (computed)_
    - `wvjob.summary` (w=50) → _Summary_
  - **Jcostcumcalc** — `wvjcostcumcalc` (8 fields)
    - `wvjcostcumcalc.des` (w=25) → _Description_
    - `wvjcostcumcalc.code1` (w=8) → _Code 1_
    - `wvjcostcumcalc.code2` (w=8) → _Code 2_
    - `wvjcostcumcalc.costafe` (w=9) → _Costafe_
    - `wvjcostcumcalc.costafesup` (w=9) → _Costafesup_
    - `wvjcostcumcalc.costfieldest` (w=9) → _Costfieldest_
    - `wvjcostcumcalc.costfinalinvoice` (w=9) → _Costfinalinvoice_
    - `wvjcostcumcalc.costvar` (w=9) → _Costvar_

### AFE vs Field Est

- **HTML:** [Drilling/Drilling Summary/AFE vs Field Est.html](Drilling/Drilling%20Summary/AFE%20vs%20Field%20Est.html)
- **Paper:** letter · **margins** [25, 25, 25, 25] (1/100 in)
- **Master template:** template portrait header.afr
- **Root table:** `None` · **filter:** wvjob / wvjob / jobtyp
- **Blocks:** 2

  - **Job** — `wvjob` (11 fields)
    - `wvjob.wvtyp` (w=10) → _Wvtyp_
    - `wvjob.jobtyp` (w=10) → _Jobtyp_
    - `wvjob.dttmstart` (w=10) → _Start Date/Time_
    - `wvjob.dttmend` (w=10) → _End Date/Time_
    - `wvjob.status1` (w=10) → _Status1_
    - `wvjob.afenumbercalc` (w=10) → _AFE Number_
    - `wvjob.afeamtcalc` (w=10) → _Afeamt (computed)_
    - `wvjob.afesupamtcalc` (w=10) → _Afesupamt (computed)_
    - `wvjob.costtotalcalc` (w=10) → _Daily Cost Total_
    - `wvjob.variancefieldcalc` (w=10) → _Variancefield (computed)_
    - `wvjob.summary` (w=50) → _Summary_
  - **Jcostcumcalc** — `wvjcostcumcalc` (7 fields)
    - `wvjcostcumcalc.des` (w=25) → _Description_
    - `wvjcostcumcalc.code1` (w=10) → _Code 1_
    - `wvjcostcumcalc.code2` (w=10) → _Code 2_
    - `wvjcostcumcalc.costafe` (w=10) → _Costafe_
    - `wvjcostcumcalc.costafesup` (w=10) → _Costafesup_
    - `wvjcostcumcalc.costfieldest` (w=10) → _Costfieldest_
    - `wvjcostcumcalc.costvar` (w=10) → _Costvar_

### AV & Hydraulic Calc Details

- **HTML:** [Drilling/Drilling Summary/AV & Hydraulic Calc Details.html](Drilling/Drilling%20Summary/AV%20%26%20Hydraulic%20Calc%20Details.html)
- **Paper:** letter · **margins** [25, 0, 25, 25] (1/100 in)
- **Master template:** template portrait header.afr
- **Root table:** `wvjobdrillstringdrillparam` · **filter:** wvwellbore / wvwellboredirsurvey; wvjobreport / wvjobreportmudchk / 8; wvjobreportmudchk / dttm; wvjobdrillstringdrillparam / dttmend; wvjobdrillstring / idrec; wvjobdrillstringdrillparam / idrecparent; wvcascomp / des
- **Captions:**
  - `Wellbore: <wvwellbore.des>`
- **Blocks:** 9

  - **Riser** — `wvriser` (9 fields)
    - `wvriser.proposedrun` (w=5) → _Proposedrun_
    - `wvriser.dttmrun` (w=10) → _Date/Time Run_
    - `wvriser.des` (w=25) → _Description_
    - `wvriser.lengthcalc` (w=7) → _Length (computed)_
    - `wvriser.depthbtm` (w=9) → _Bottom Depth_
    - `wvriser.szidnommincalc` (w=7) → _Szidnommin (computed)_
    - `wvriser.szodnommaxcalc` (w=7) → _Szodnommax (computed)_
    - `wvriser.wtperlengthcalc` (w=8) → _Wtperlength (computed)_
    - `wvriser.gradecalc` (w=7) → _Grade (computed)_
  - **Cas** — `wvcas` (9 fields)
    - `wvcas.proposedrun` (w=5) → _Proposedrun_
    - `wvcas.dttmrun` (w=10) → _Date/Time Run_
    - `wvcas.des` (w=25) → _Description_
    - `wvcas.lengthcalc` (w=7) → _Length (computed)_
    - `wvcas.depthbtm` (w=9) → _Bottom Depth_
    - `wvcas.szidnommincalc` (w=7) → _Szidnommin (computed)_
    - `wvcas.szodnommaxcalc` (w=7) → _Szodnommax (computed)_
    - `wvcas.wtperlengthcalc` (w=8) → _Wtperlength (computed)_
    - `wvcas.gradecalc` (w=7) → _Grade (computed)_
  - **Last Deviation Survey Point** — `wvwellboredirsurveydata` (11 fields)
    - `wvwellbore.des` (w=12) → _Description_
    - `wvwellboredirsurveydata.dttm` (w=10) → _Dttm_
    - `wvwellboredirsurveydata.md` (w=9) → _Md_
    - `wvwellboredirsurveydata.inclination` (w=5) → _Inclination_
    - `wvwellboredirsurveydata.azimuth` (w=5) → _Azimuth_
    - `wvwellboredirsurveydata.tvdcalc` (w=9) → _Tvd (computed)_
    - `wvjobreportmudchk.dttm` (w=7) → _Dttm_
    - `wvjobreportmudchk.depth` (w=7) → _Depth_
    - `wvjobreportmudchk.density` (w=6) → _Density_
    - `wvjobreportmudchk.vis3rpm` (w=5) → _Vis3Rpm_
    - `wvjobreportmudchk.vis100rpm` (w=5) → _Vis100Rpm_
  - **Check: Last Check before end of ** — `wvjobdrillstring` (10 fields)
    - `wvjobdrillstring.stringno` (w=7) → _Stringno_
    - `wvjobdrillstring.dttmincalc` (w=10) → _Date/Time In (computed)_
    - `wvjobdrillstring.dttmoutcalc` (w=10) → _Date/Time Out (computed)_
    - `wvjobdrillstring.tmdrilledcalc` (w=6) → _Tmdrilled (computed)_
    - `wvjobdrillstring.depthincalc` (w=9) → _Depth In (computed)_
    - `wvjobdrillstring.depthoutcalc` (w=9) → _Depth Out (computed)_
    - `wvjobdrillstring.depthdrilledcalc` (w=7) → _Depth Drilled (computed)_
    - `wvjobdrillstring.idrecbit` (w=30) → _Idrecbit_
    - `wvjobdrillbit.szoddrill` (w=7) → _Szoddrill_
    - `wvjobdrillstring.bitnozzlecalc` (w=15) → _Bitnozzle (computed)_
  - **Drill String Component** — `wvjobdrillstringcomp` (5 fields)
    - `wvjobdrillstringcomp.des` (w=25) → _Description_
    - `wvjobdrillstringcomp.szodnom` (w=7) → _Szodnom_
    - `wvjobdrillstringcomp.szidnom` (w=7) → _Szidnom_
    - `wvjobdrillstringcomp.joints` (w=5) → _Joints_
    - `wvjobdrillstringcomp.length` (w=7) → _Length_
  - **Drilling Parameters** — `wvjobdrillstringdrillparam` (15 fields)
    - `wvjobdrillstringdrillparam.dttmstart` (w=10) → _Start Date/Time_
    - `wvjobdrillstringdrillparam.dttmend` (w=10) → _End Date/Time_
    - `wvjobdrillstringdrillparam.tmdrill` (w=6) → _Tmdrill_
    - `wvjobdrillstringdrillparam.depthstart` (w=9) → _Depth Start_
    - `wvjobdrillstringdrillparam.depthend` (w=9) → _Depth End_
    - `wvjobdrillstringdrillparam.ropcalc` (w=6) → _ROP_
    - `wvjobdrillstringdrillparam.depthdrilledcalc` (w=9) → _Depth Drilled (computed)_
    - `wvjobdrillstringdrillparam.rpmtotalcalc` (w=5) → _Rpmtotal (computed)_
    - `wvjobdrillstringdrillparam.wob` (w=8) → _Weight On Bit_
    - `wvjobdrillstringdrillparam.liquidinjrate` (w=6) → _Liquidinjrate_
    - `wvjobdrillstringdrillparam.torquedrill` (w=8) → _Torquedrill_
    - `wvjobdrillstringdrillparam.torqueoffbtm` (w=8) → _Torqueoffbtm_
    - `wvjobdrillstringdrillparam.hookloadslackoff` (w=8) → _Hookloadslackoff_
    - `wvjobdrillstringdrillparam.hookloadpickup` (w=8) → _Hookloadpickup_
    - `wvjobdrillstringdrillparam.hookloadrotating` (w=8) → _Hookloadrotating_
  - **Jdsdpavcalc** — `wvjdsdpavcalc` (12 fields)
    - `wvjdsdpavcalc.depthtop` (w=8) → _Top Depth_
    - `wvjdsdpavcalc.depthbtm` (w=8) → _Bottom Depth_
    - `wvjdsdpavcalc.boundin` (w=17) → _Boundin_
    - `wvjdsdpavcalc.szboundin` (w=7) → _Szboundin_
    - `wvjdsdpavcalc.boundout` (w=10) → _Boundout_
    - `wvjdsdpavcalc.szboundout` (w=7) → _Szboundout_
    - `wvjdsdpavcalc.annularvelocity` (w=5) → _Annularvelocity_
    - `wvjdsdpavcalc.viscosityeff` (w=6) → _Viscosityeff_
    - `wvjdsdpavcalc.frictionfactor` (w=6) → _Frictionfactor_
    - `wvjdsdpavcalc.reynoldsno` (w=5) → _Reynoldsno_
    - `wvjdsdpavcalc.flowregime` (w=9) → _Flowregime_
    - `wvjdsdpavcalc.calcerror` (w=15) → _Calcerror_
  - **Hydraulics (computed)** — `wvjdsdphydcalc` (16 fields)
    - `wvjdsdphydcalc.pressuredropann` (w=6) → _Pressuredropann_
    - `wvjdsdphydcalc.hydpwrbit` (w=6) → _Hydpwrbit_
    - `wvjdsdphydcalc.hydpwrperarea` (w=6) → _Hydpwrperarea_
    - `wvjdsdphydcalc.pressuredropbit` (w=6) → _Pressuredropbit_
    - `wvjdsdphydcalc.pressuredropbitratio` (w=6) → _Pressuredropbitratio_
    - `wvjdsdphydcalc.jetvelocity` (w=6) → _Jetvelocity_
    - `wvjdsdphydcalc.ecdend` (w=9) → _Ecdend_
    - `wvjdsdphydcalc.avcasmax` (w=9) → _Avcasmax_
    - `wvjdsdphydcalc.avcasmin` (w=9) → _Avcasmin_
    - `wvjdsdphydcalc.avopenholemax` (w=9) → _Avopenholemax_
    - `wvjdsdphydcalc.avopenholemin` (w=9) → _Avopenholemin_
    - `wvjdsdphydcalc.volumebittoshoe` (w=6) → _Volumebittoshoe_
    - `wvjdsdphydcalc.volumeshoetocastop` (w=6) → _Volumeshoetocastop_
    - `wvjdsdphydcalc.volumepumptobit` (w=6) → _Volumepumptobit_
    - `wvjdsdphydcalc.densitylastmudchk` (w=6) → _Densitylastmudchk_
    - `wvjdsdphydcalc.calcerror` (w=15) → _Calcerror_
  - **Cascomp** — `wvcascomp` (9 fields)
    - `wvcascomp.des` (w=22) → _Description_
    - `wvcascomp.iconname` (w=5) → _Iconname_
    - `wvcascomp.szodnom` (w=7) → _Szodnom_
    - `wvcascomp.szidnom` (w=7) → _Szidnom_
    - `wvcascomp.wtperlength` (w=7) → _Wtperlength_
    - `wvcascomp.grade` (w=9) → _Grade_
    - `wvcascomp.length` (w=7) → _Length_
    - `wvcascomp.joints` (w=4) → _Joints_
    - `wvcascomp.compsubtyp` (w=20) → _Compsubtyp_

### Attached Image Files

- **HTML:** [Drilling/Drilling Summary/Attached Image Files.html](Drilling/Drilling%20Summary/Attached%20Image%20Files.html)
- **Paper:** letter · **margins** [25, 25, 25, 25] (1/100 in)
- **Master template:** template portrait header.afr
- **Root table:** `wvattachment`
- **Blocks:** 0


### Attachments

- **HTML:** [Drilling/Drilling Summary/Attachments.html](Drilling/Drilling%20Summary/Attachments.html)
- **Paper:** letter · **margins** [25, 25, 25, 25] (1/100 in)
- **Master template:** template portrait header.afr
- **Root table:** `None`
- **Blocks:** 1

  - **Attachment** — `wvattachment` (7 fields)
    - `wvattachment.typ1` (w=10) → _Typ1_
    - `wvattachment.typ2` (w=10) → _Typ2_
    - `wvattachment.des` (w=25) → _Description_
    - `wvattachment.dttm` (w=10) → _Dttm_
    - `wvattachment.attachida` (w=5) → _Attachida_
    - `wvattachment.tblkeyparent` (w=10) → _Tblkeyparent_
    - `wvattachment.attachextension` (w=5) → _Attachextension_

### BHA Performance

- **HTML:** [Drilling/Drilling Summary/BHA Performance.html](Drilling/Drilling%20Summary/BHA%20Performance.html)
- **Paper:** letter · **margins** [25, 25, 25, 25] (1/100 in)
- **Master template:** template portrait.afr
- **Root table:** `wvjobdrillstring` · **filter:** wvjob / wvtyp / drill; wvwellheader / wvjob; wvjobdrillstringdrillparam / idrecparent; wvjobdrillstring / idrec; wvjobdrillstringdrillparam / idrecparent; wvjobdrillstring / idrec; wvjobdrillstringdrillparam / idrecparent; wvjobdrillstring / idrec
- **Captions:**
  - `: <wvjobdrillstring.stringno>,  <wv`
- **Blocks:** 5

  - **drilling & geology\bha only.sch** — `wvjobdrillstringdrillparam` (1 fields)
    - `wvjobdrillstring.idrecwellborecalc` (w=0) → _Idrecwellbore (computed)_
  - **vs Depth - Plan - Days from Star** — `wvjobdrillstring` (24 fields)
    - `wvjobdrillstring.depthincalc` (w=9) → _Depth In (computed)_
    - `wvjobdrillstring.depthoutcalc` (w=9) → _Depth Out (computed)_
    - `wvjobdrillstring.depthdrilledcalc` (w=9) → _Depth Drilled (computed)_
    - `wvjobdrillstring.tmdrilledcalc` (w=9) → _Tmdrilled (computed)_
    - `wvjobdrillstring.ropcalc` (w=9) → _ROP_
    - `wvjobdrillstring.bitno` (w=4) → _Bitno_
    - `wvjobdrillbit.length` (w=7) → _Length_
    - `wvjobdrillbit.make` (w=7) → _Make_
    - `wvjobdrillbit.model` (w=7) → _Model_
    - `wvjobdrillbit.sn` (w=10) → _Serial Number_
    - `wvjobdrillbit.iadccodescalc` (w=10) → _Iadccodes (computed)_
    - `wvjobdrillstring.bitwearcalc` (w=8) → _Bitwear (computed)_
    - `wvjobdrillstring.weightaircalc` (w=8) → _Weightair (computed)_
    - `wvjobdrillstring.lengthcalc` (w=8) → _Length (computed)_
    - `wvjobdrillstring.wobmaxcalc` (w=8) → _Wobmax (computed)_
    - `wvjobdrillstring.wobmincalc` (w=8) → _Wobmin (computed)_
    - `wvjobdrillstring.rpmmaxcalc` (w=8) → _Rpmmax (computed)_
    - `wvjobdrillstring.rpmmincalc` (w=8) → _Rpmmin (computed)_
    - `wvjobdrillstring.liquidinjratemaxcalc` (w=8) → _Liquidinjratemax (computed)_
    - `wvjobdrillstring.liquidinjratemincalc` (w=8) → _Liquidinjratemin (computed)_
    - `wvjobdrillstring.bitnozzlecalc` (w=10) → _Bitnozzle (computed)_
    - `wvjobdrillstring.stringobjective` (w=10) → _Stringobjective_
    - `wvjobdrillstring.stringresult` (w=10) → _Stringresult_
    - `wvjobdrillstring.com` (w=30) → _Comment_
  - **Drilling Parameters** — `wvjobdrillstringdrillparam` (1 fields)
    - `wvjobdrillstringdrillparam.depthend` (w=0) → _Depth End_
  - **Drilling Parameters** — `wvjobdrillstringdrillparam` (1 fields)
    - `wvjobdrillstringdrillparam.depthend` (w=0) → _Depth End_
  - **Drilling Parameters** — `wvjobdrillstringdrillparam` (1 fields)
    - `wvjobdrillstringdrillparam.depthend` (w=0) → _Depth End_

### BHA Summary

- **HTML:** [Drilling/Drilling Summary/BHA Summary.html](Drilling/Drilling%20Summary/BHA%20Summary.html)
- **Paper:** letter · **margins** [12, 12, 31, 25] (1/100 in)
- **Master template:** template landscape header.afr
- **Root table:** `wvjob` · **filter:** wvjob / wvtyp / dril
- **Captions:**
  - `Job Type:   <wvjob.jobtyp>`
- **Blocks:** 1

  - **Drill String / BHA** — `wvjobdrillstring` (11 fields)
    - `wvjobdrillstring.bitno` (w=4) → _Bitno_
    - `wvjobdrillstring.stringno` (w=4) → _Stringno_
    - `wvjobdrillstring.des` (w=15) → _Description_
    - `wvjobdrillstring.componentscalc` (w=50) → _Components (computed)_
    - `wvjobdrillstring.idrecbit` (w=20) → _Idrecbit_
    - `wvjobdrillstring.bitwearcalc` (w=24) → _Bitwear (computed)_
    - `wvjobdrillstring.depthincalc` (w=10) → _Depth In (computed)_
    - `wvjobdrillstring.depthoutcalc` (w=10) → _Depth Out (computed)_
    - `wvjobdrillstring.depthdrilledcalc` (w=8) → _Depth Drilled (computed)_
    - `wvjobdrillstring.tmdrilledcalc` (w=6) → _Tmdrilled (computed)_
    - `wvjobdrillstring.ropcalc` (w=6) → _ROP_

### Bit Summary

- **HTML:** [Drilling/Drilling Summary/Bit Summary.html](Drilling/Drilling%20Summary/Bit%20Summary.html)
- **Paper:** letter · **margins** [12, 12, 31, 25] (1/100 in)
- **Master template:** template landscape header.afr
- **Root table:** `wvjob` · **filter:** wvjob / wvtyp / dril
- **Captions:**
  - `Job Type:   <wvjob.jobtyp>`
- **Blocks:** 1

  - **Drill String / BHA** — `wvjobdrillstring` (19 fields)
    - `wvjobdrillstring.stringno` (w=4) → _Stringno_
    - `wvjobdrillstring.bitno` (w=5) → _Bitno_
    - `wvjobdrillbit.szoddrill` (w=7) → _Szoddrill_
    - `wvjobdrillbit.make` (w=12) → _Make_
    - `wvjobdrillbit.model` (w=12) → _Model_
    - `wvjobdrillbit.sn` (w=10) → _Serial Number_
    - `wvjobdrillbit.iadccodescalc` (w=8) → _Iadccodes (computed)_
    - `wvjobdrillstring.bittfacalc` (w=8) → _Bittfa (computed)_
    - `wvjobdrillstring.bitnozzlecalc` (w=25) → _Bitnozzle (computed)_
    - `wvjobdrillstring.depthincalc` (w=10) → _Depth In (computed)_
    - `wvjobdrillstring.depthoutcalc` (w=10) → _Depth Out (computed)_
    - `wvjobdrillstring.depthdrilledcalc` (w=8) → _Depth Drilled (computed)_
    - `wvjobdrillstring.tmdrilledcalc` (w=8) → _Tmdrilled (computed)_
    - `wvjobdrillstring.ropcalc` (w=8) → _ROP_
    - `wvjobdrillstring.wobmaxcalc` (w=8) → _Wobmax (computed)_
    - `wvjobdrillstring.wobmincalc` (w=8) → _Wobmin (computed)_
    - `wvjobdrillstring.rpmmaxcalc` (w=5) → _Rpmmax (computed)_
    - `wvjobdrillstring.rpmmincalc` (w=5) → _Rpmmin (computed)_
    - `wvjobdrillstring.bitwearcalc` (w=25) → _Bitwear (computed)_

### Casing Summary

- **HTML:** [Drilling/Drilling Summary/Casing Summary.html](Drilling/Drilling%20Summary/Casing%20Summary.html)
- **Paper:** letter · **margins** [25, 25, 25, 25] (1/100 in)
- **Master template:** template portrait header.afr
- **Root table:** `wvwellheader`
- **Blocks:** 2

  - **Cas** — `wvcas` (6 fields)
    - `wvcas.depthbtm` (w=9) → _Bottom Depth_
    - `wvcas.tension` (w=7) → _Tension_
    - `wvcas.szodnommaxcalc` (w=7) → _Szodnommax (computed)_
    - `wvcas.szdriftmincalc` (w=7) → _Szdriftmin (computed)_
    - `wvcas.centralizers` (w=7) → _Centralizers_
    - `wvcas.scratchers` (w=7) → _Scratchers_
  - **Cascomp** — `wvcascomp` (12 fields)
    - `wvcascomp.joints` (w=3) → _Joints_
    - `wvcascomp.des` (w=15) → _Description_
    - `wvcascomp.szodnom` (w=7) → _Szodnom_
    - `wvcascomp.szidnom` (w=7) → _Szidnom_
    - `wvcascomp.wtperlength` (w=8) → _Wtperlength_
    - `wvcascomp.grade` (w=7) → _Grade_
    - `wvcascomp.connthrdtop` (w=15) → _Connthrdtop_
    - `wvcascomp.depthtopcalc` (w=7) → _Top Depth (computed)_
    - `wvcascomp.depthbtmcalc` (w=7) → _Bottom Depth (computed)_
    - `wvcascomp.length` (w=7) → _Length_
    - `wvcascomp.presburst` (w=8) → _Presburst_
    - `wvcascomp.prescollapse` (w=8) → _Prescollapse_

### Casing, Liner and Cement report

- **HTML:** [Drilling/Drilling Summary/Casing, Liner and Cement report.html](Drilling/Drilling%20Summary/Casing%2C%20Liner%20and%20Cement%20report.html)
- **Paper:** letter · **margins** [25, 25, 25, 25] (1/100 in)
- **Master template:** template portrait header.afr
- **Root table:** `wvwellbore` · **filter:** wvwellheader / wvwellbore / Wellbore; wvcas / idrecwellbore; wvwellheadcomp / des; wvjob / wvjobreport; wvjobreportmudchk / dttm; wvcas / dttmrun; wvjobreportmudchk / idrecwellbore; wvcas / idrecwellbore; wvcement / idrecstring; wvcas / idrec
- **Captions:**
  - `<wvcas.des>`
  - `<wvcement.des>`
  - `<wvcement.des>`
  - `<wvcement.des>`
  - `<wvcement.des>`
- **Blocks:** 11

  - **Cas** — `wvcas` (5 fields)
    - `wvcas.idrecwellbore` (w=0) → _Idrecwellbore_
    - `wvwellbore.des` (w=10) → _Description_
    - `wvwellbore.profiletyp` (w=10) → _Profiletyp_
    - `wvwellbore.kickoffdepth` (w=10) → _Kickoffdepth_
    - `wvwellbore.vsdir` (w=10) → _Vsdir_
  - **Wellboresize** — `wvwellboresize` (4 fields)
    - `wvwellboresize.des` (w=9) → _Description_
    - `wvwellboresize.sz` (w=9) → _Sz_
    - `wvwellboresize.depthtopactual` (w=9) → _Depth Topactual_
    - `wvwellboresize.depthbtmactual` (w=9) → _Depth Btmactual_
  - **Wellhead** — `wvwellhead` (1 fields)
    - `wvwellhead.typ` (w=15) → _Type_
  - **Wellheadcomp** — `wvwellheadcomp` (5 fields)
    - `wvwellheadcomp.des` (w=15) → _Description_
    - `wvwellheadcomp.make` (w=15) → _Make_
    - `wvwellheadcomp.model` (w=12) → _Model_
    - `wvwellheadcomp.sn` (w=12) → _Serial Number_
    - `wvwellheadcomp.workprestop` (w=7) → _Workprestop_
  - **Last Mud Check** — `wvjobreportmudchk` (9 fields)
    - `wvjobreportmudchk.dttm` (w=9) → _Dttm_
    - `wvjobreportmudchk.mudtyp` (w=14) → _Mudtyp_
    - `wvjobreportmudchk.depth` (w=7) → _Depth_
    - `wvjobreportmudchk.density` (w=7) → _Density_
    - `wvjobreportmudchk.funnelviscosity` (w=7) → _Funnelviscosity_
    - `wvjobreportmudchk.gel10sec` (w=7) → _Gel10Sec_
    - `wvjobreportmudchk.gel10min` (w=7) → _Gel10Min_
    - `wvjobreportmudchk.plasticvis` (w=7) → _Plasticvis_
    - `wvjobreportmudchk.yieldpt` (w=7) → _Yieldpt_
  - **Cas** — `wvcas` (6 fields)
    - `wvcas.des` (w=18) → _Description_
    - `wvcas.dttmrun` (w=9) → _Date/Time Run_
    - `wvcas.depthbtm` (w=9) → _Bottom Depth_
    - `wvcas.idrecwellbore` (w=9) → _Idrecwellbore_
    - `wvcas.centralizers` (w=30) → _Centralizers_
    - `wvcas.scratchers` (w=30) → _Scratchers_
  - **Cascomp** — `wvcascomp` (9 fields)
    - `wvcascomp.joints` (w=3) → _Joints_
    - `wvcascomp.des` (w=20) → _Description_
    - `wvcascomp.szodnom` (w=7) → _Szodnom_
    - `wvcascomp.szidnom` (w=7) → _Szidnom_
    - `wvcascomp.wtperlength` (w=7) → _Wtperlength_
    - `wvcascomp.grade` (w=6) → _Grade_
    - `wvcascomp.length` (w=9) → _Length_
    - `wvcascomp.depthtopcalc` (w=9) → _Top Depth (computed)_
    - `wvcascomp.depthbtmcalc` (w=9) → _Bottom Depth (computed)_
  - **Cement** — `wvcement` (6 fields)
    - `wvcement.dttmstart` (w=10) → _Start Date/Time_
    - `wvcement.dttmend` (w=10) → _End Date/Time_
    - `wvcement.idrecwellbore` (w=20) → _Idrecwellbore_
    - `wvcement.evalmethod` (w=10) → _Evalmethod_
    - `wvcement.deseval` (w=30) → _Description Eval_
    - `wvcement.com` (w=30) → _Comment_
  - **Cement Stages** — `wvcementstage` (21 fields)
    - `wvcementstage.depthtop` (w=10) → _Top Depth_
    - `wvcementstage.depthbtm` (w=10) → _Bottom Depth_
    - `wvcementstage.fullreturn` (w=5) → _Fullreturn_
    - `wvcementstage.volreturncmnt` (w=5) → _Volreturncmnt_
    - `wvcementstage.topplug` (w=10) → _Topplug_
    - `wvcementstage.btmplug` (w=10) → _Btmplug_
    - `wvcementstage.ratepumpstart` (w=9) → _Ratepumpstart_
    - `wvcementstage.ratepumpend` (w=9) → _Ratepumpend_
    - `wvcementstage.ratepumpavg` (w=9) → _Ratepumpavg_
    - `wvcementstage.prespumpend` (w=9) → _Prespumpend_
    - `wvcementstage.presplugbump` (w=9) → _Presplugbump_
    - `wvcementstage.reciprocated` (w=9) → _Reciprocated_
    - `wvcementstage.recipstroke` (w=9) → _Recipstroke_
    - `wvcementstage.reciprate` (w=9) → _Reciprate_
    - `wvcementstage.rotated` (w=9) → _Rotated_
    - `wvcementstage.rotaterpm` (w=9) → _Rotaterpm_
    - `wvcementstage.depthtagged` (w=9) → _Depth Tagged_
    - `wvcementstage.tagmethod` (w=9) → _Tagmethod_
    - `wvcementstage.depthdrillout` (w=9) → _Depth Drillout_
    - `wvcementstage.oddrillout` (w=9) → _Oddrillout_
    - `wvcementstage.dttmdrillout` (w=9) → _Date/Time Drillout_
  - **Cement Fluids** — `wvcementstagefluid` (14 fields)
    - `wvcementstagefluid.typ` (w=8) → _Type_
    - `wvcementstagefluid.desfluid` (w=16) → _Description Fluid_
    - `wvcementstagefluid.amtcement` (w=4) → _Amtcement_
    - `wvcementstagefluid.cmtclass` (w=4) → _Cmtclass_
    - `wvcementstagefluid.volpumped` (w=8) → _Volpumped_
    - `wvcementstagefluid.depthtopest` (w=9) → _Depth Topest_
    - `wvcementstagefluid.depthbtmest` (w=9) → _Depth Btmest_
    - `wvcementstagefluid.yield` (w=9) → _Yield_
    - `wvcementstagefluid.mixwaterratio` (w=9) → _Mixwaterratio_
    - `wvcementstagefluid.freewater` (w=9) → _Freewater_
    - `wvcementstagefluid.density` (w=9) → _Density_
    - `wvcementstagefluid.plasticvis` (w=9) → _Plasticvis_
    - `wvcementstagefluid.thickentm` (w=9) → _Thickentm_
    - `wvcementstagefluid.comprstr1` (w=9) → _Comprstr1_
  - **Fluid Additives** — `wvcementstagefluidadd` (3 fields)
    - `wvcementstagefluidadd.des` (w=9) → _Description_
    - `wvcementstagefluidadd.typ` (w=9) → _Type_
    - `wvcementstagefluidadd.conc` (w=9) → _Conc_

### Cost by Vendor

- **HTML:** [Drilling/Drilling Summary/Cost by Vendor.html](Drilling/Drilling%20Summary/Cost%20by%20Vendor.html)
- **Paper:** letter · **margins** [25, 25, 25, 25] (1/100 in)
- **Master template:** template portrait header.afr
- **Root table:** `wvjobreport` · **filter:** wvjvendorcalc / wvjvendorcalc / vendor; wvjob / wvtyp / drill; wvjobreportcostgen / vendor; wvjvendorcalc / vendor; wvjob / idrec; wvjob / idrec; wvjobreport / reportnocalc; wvjobreportcostrental / vendorcalc; wvjvendorcalc / vendor; wvjob / idrec; wvjob / idrec; wvjobreport / reportnocalc
- **Captions:**
  - `<wvjvendorcalc.vendor>`
  - `<wvjvendorcalc.vendor>`
  - `AFE#:  <wvjob.afenumbercalc>`
- **Blocks:** 4

  - **Job** — `wvjob` (4 fields)
    - `wvjob.wvtyp` (w=10) → _Wvtyp_
    - `wvjob.jobtyp` (w=10) → _Jobtyp_
    - `wvjob.dttmstart` (w=10) → _Start Date/Time_
    - `wvjob.dttmend` (w=10) → _End Date/Time_
  - **Jvendorcalc** — `wvjvendorcalc` (2 fields)
    - `wvjvendorcalc.vendor` (w=10) → _Vendor_
    - `wvjvendorcalc.cost` (w=10) → _Cost_
  - **Daily Cost — General** — `wvjobreportcostgen` (8 fields)
    - `wvjobreport.reportnocalc` (w=5) → _Report #_
    - `wvjobreport.dttmstart` (w=10) → _Start Date/Time_
    - `wvjobreportcostgen.code1` (w=5) → _Code 1_
    - `wvjobreportcostgen.code2` (w=5) → _Code 2_
    - `wvjobreportcostgen.des` (w=25) → _Description_
    - `wvjobreportcostgen.cost` (w=9) → _Cost_
    - `wvjobreportcostgen.note` (w=20) → _Note_
    - `wvjobreportcostgen.ticketno` (w=10) → _Ticket Number_
  - **Jobreportcostrental** — `wvjobreportcostrental` (8 fields)
    - `wvjobreport.reportnocalc` (w=5) → _Report #_
    - `wvjobreport.dttmstart` (w=10) → _Start Date/Time_
    - `wvjobreportcostrental.code1calc` (w=5) → _Code 1 (computed)_
    - `wvjobreportcostrental.code2calc` (w=5) → _Code 2 (computed)_
    - `wvjobreportcostrental.descalc` (w=25) → _Description (computed)_
    - `wvjobreportcostrental.costrentalcalc` (w=9) → _Costrental (computed)_
    - `wvjobreportcostrental.note` (w=20) → _Note_
    - `wvjobreportcostrental.ticketno` (w=10) → _Ticket Number_

### Daily Activity and Cost Summary

- **HTML:** [Drilling/Drilling Summary/Daily Activity and Cost Summary.html](Drilling/Drilling%20Summary/Daily%20Activity%20and%20Cost%20Summary.html)
- **Paper:** letter · **margins** [25, 25, 25, 25] (1/100 in)
- **Master template:** template portrait header.afr
- **Root table:** `wvjob` · **filter:** wvjob / wvtyp / dril
- **Blocks:** 3

  - **Job** — `wvjob` (10 fields)
    - `wvjob.wvtyp` (w=10) → _Wvtyp_
    - `wvjob.jobtyp` (w=10) → _Jobtyp_
    - `wvjob.jobsubtyp` (w=10) → _Jobsubtyp_
    - `wvjob.status1` (w=10) → _Status1_
    - `wvjob.dttmstart` (w=10) → _Start Date/Time_
    - `wvjob.dttmend` (w=10) → _End Date/Time_
    - `wvjob.afenumbercalc` (w=10) → _AFE Number_
    - `wvjob.afetotalcalc` (w=10) → _AFE Total_
    - `wvjob.objective` (w=30) → _Objective_
    - `wvjob.summary` (w=50) → _Summary_
  - **Rig** — `wvjobrig` (3 fields)
    - `wvjobrig.contractor` (w=10) → _Contractor_
    - `wvjobrig.rigno` (w=5) → _Rigno_
    - `wvjobrig.typ1` (w=10) → _Typ1_
  - **Daily Report** — `wvjobreport` (6 fields)
    - `wvjobreport.reportnocalc` (w=4) → _Report #_
    - `wvjobreport.dttmstart` (w=8) → _Start Date/Time_
    - `wvjobreport.dttmend` (w=8) → _End Date/Time_
    - `wvjobreport.costtotalcalc` (w=10) → _Daily Cost Total_
    - `wvjobreport.costtodatecalc` (w=10) → _Cost To Date_
    - `wvjobreport.summaryops` (w=40) → _Summaryops_

### Daily Drilling Fluids Summary

- **HTML:** [Drilling/Drilling Summary/Daily Drilling Fluids Summary.html](Drilling/Drilling%20Summary/Daily%20Drilling%20Fluids%20Summary.html)
- **Paper:** letter · **margins** [25, 25, 25, 25] (1/100 in)
- **Master template:** template landscape legal.afr
- **Root table:** `wvjobreport` · **filter:** wvjob / wvtyp / drill; wvjobreport / idrecparent; wvjob / idrec; wvjobrigpumpchk / dttm; wvjobreport / dttmend; wvjobrigpumpchk / dttm; wvjobreport / dttmstart; wvjobrig / idrecparent; wvjobreport / idrecparent; wvjobrig / idrecparent; wvjobreport / idrecparent; wvjobrigsolidsshakerscrn / dttmstart; wvjobreport / dttmend; wvjobrigsolidsshakerscrn / dttmend; wvjobreport / dttmstart; wvjobrig / idrecparent; wvjobreport / idrecparent; wvjobrig / idrecparent; wvjobreport / idrecparent; wvjobrig / idrecparent; wvjob / idrec; wvjobdrillstring / dttmincalc; wvjobreport / dttmend; wvjobdrillstring / dttmoutcalc; wvjobreport / dttmstart; wvjob / wvjobreport; wvjob / idrec; wvjob / idrec; wvjobreportfluidswell / fluidtyp; wvjrfluidscalc / fluidtyp
- **Captions:**
  - `Pump # <wvjobrigpump.des>, Daily Checks`
- **Blocks:** 14

  - **Mud Properties** — `wvjobreportmudchk` (14 fields)
    - `wvjobreportmudchk.dttm` (w=5) → _Dttm_
    - `wvjobreportmudchk.mudtyp` (w=10) → _Mudtyp_
    - `wvjobreportmudchk.source` (w=10) → _Source_
    - `wvjobreportmudchk.depth` (w=10) → _Depth_
    - `wvjobreportmudchk.tvdcalc` (w=10) → _Tvd (computed)_
    - `wvjobreportmudchk.density` (w=10) → _Density_
    - `wvjobreportmudchk.oilwaterratiocalc` (w=10) → _Oilwaterratio (computed)_
    - `wvjobreportmudchk.tempflowline` (w=10) → _Tempflowline_
    - `wvjobreportmudchk.funnelviscosity` (w=10) → _Funnelviscosity_
    - `wvjobreportmudchk.plasticviscalc` (w=10) → _Plasticvis (computed)_
    - `wvjobreportmudchk.yieldptcalc` (w=10) → _Yieldpt (computed)_
    - `wvjobreportmudchk.gel10sec` (w=10) → _Gel10Sec_
    - `wvjobreportmudchk.gel10min` (w=10) → _Gel10Min_
    - `wvjobreportmudchk.gel30min` (w=10) → _Gel30Min_
  - **Mud Check** — `wvjobreportmudchk` (15 fields)
    - `wvjobreportmudchk.solids` (w=10) → _Solids_
    - `wvjobreportmudchk.solidscorrected` (w=10) → _Solidscorrected_
    - `wvjobreportmudchk.solidslowgrav` (w=10) → _Solidslowgrav_
    - `wvjobreportmudchk.solidshighgrav` (w=10) → _Solidshighgrav_
    - `wvjobreportmudchk.solidslowgravwt` (w=10) → _Solidslowgravwt_
    - `wvjobreportmudchk.solidshighgravwt` (w=10) → _Solidshighgravwt_
    - `wvjobreportmudchk.solidsavggrav` (w=10) → _Solidsavggrav_
    - `wvjobreportmudchk.vis3rpm` (w=10) → _Vis3Rpm_
    - `wvjobreportmudchk.vis6rpm` (w=10) → _Vis6Rpm_
    - `wvjobreportmudchk.vis30rpm` (w=10) → _Vis30Rpm_
    - `wvjobreportmudchk.vis60rpm` (w=10) → _Vis60Rpm_
    - `wvjobreportmudchk.vis100rpm` (w=10) → _Vis100Rpm_
    - `wvjobreportmudchk.vis200rpm` (w=10) → _Vis200Rpm_
    - `wvjobreportmudchk.vis300rpm` (w=10) → _Vis300Rpm_
    - `wvjobreportmudchk.vis600rpm` (w=10) → _Vis600Rpm_
  - **Mud Check Comments** — `wvjobreportmudchk` (1 fields)
    - `wvjobreportmudchk.com` (w=30) → _Comment_
  - **Daily Mud Inventory** — `wvjrmudaddcalc` (11 fields)
    - `wvjrmudaddcalc.des` (w=20) → _Description_
    - `wvjrmudaddcalc.typ` (w=15) → _Type_
    - `wvjrmudaddcalc.unitlabel` (w=10) → _Unitlabel_
    - `wvjrmudaddcalc.unitsz` (w=10) → _Unitsz_
    - `wvjrmudaddcalc.received` (w=10) → _Received_
    - `wvjrmudaddcalc.receivedcum` (w=10) → _Received (cumulative)_
    - `wvjrmudaddcalc.consumed` (w=10) → _Consumed_
    - `wvjrmudaddcalc.consumedcum` (w=10) → _Consumed (cumulative)_
    - `wvjrmudaddcalc.returned` (w=10) → _Returned_
    - `wvjrmudaddcalc.returnedcum` (w=10) → _Returned (cumulative)_
    - `wvjrmudaddcalc.inventorycum` (w=10) → _Inventory (cumulative)_
  - **Mud Pump Information** — `wvjobrigpump` (6 fields)
    - `wvjobrigpump.des` (w=5) → _Description_
    - `wvjobrigpump.make` (w=10) → _Make_
    - `wvjobrigpump.model` (w=10) → _Model_
    - `wvjobrigpump.powerrating` (w=10) → _Powerrating_
    - `wvjobrigpump.actiontyp` (w=10) → _Actual Iontyp_
    - `wvjobrigpump.strokelength` (w=10) → _Strokelength_
  - **Daily Pump Checks** — `wvjobrigpumpchk` (6 fields)
    - `wvjobrigpumpchk.dttm` (w=5) → _Dttm_
    - `wvjobrigpumpchk.slowspeed` (w=10) → _Slowspeed_
    - `wvjobrigpumpchk.spm` (w=10) → _Spm_
    - `wvjobrigpumpchk.pres` (w=10) → _Pres_
    - `wvjobrigpumpchk.flowratecalc` (w=10) → _Flow Rate (computed)_
    - `wvjobrigpumpchk.volefficiency` (w=10) → _Volefficiency_
  - **Jobrigsolidsshaker** — `wvjobrigsolidsshaker` (4 fields)
    - `wvjobrigsolidsshaker.des` (w=9) → _Description_
    - `wvjobrigsolidsshaker.make` (w=20) → _Make_
    - `wvjobrigsolidsshaker.model` (w=20) → _Model_
    - `wvjobrigsolidsshaker.sn` (w=20) → _Serial Number_
  - **Jobrigsolidsshakerscrn** — `wvjobrigsolidsshakerscrn` (5 fields)
    - `wvjobrigsolidsshakerscrn.screenno` (w=5) → _Screenno_
    - `wvjobrigsolidsshakerscrn.sizex` (w=10) → _Sizex_
    - `wvjobrigsolidsshakerscrn.sizey` (w=10) → _Sizey_
    - `wvjobrigsolidsshakerscrn.tmdrillcalc` (w=10) → _Tmdrill (computed)_
    - `wvjobrigsolidsshakerscrn.tmcirccalc` (w=10) → _Tmcirc (computed)_
  - **Summary of Drilling Data** — `wvjobrig` (4 fields)
    - `wvjobrig.contractor` (w=10) → _Contractor_
    - `wvjobrig.rigno` (w=5) → _Rigno_
    - `wvjobrig.idrecjobcontactcontractor` (w=10) → _Idrecjobcontactcontractor_
    - `wvjobrig.typ1` (w=10) → _Typ1_
  - **Cas** — `wvcas` (5 fields)
    - `wvcas.des` (w=15) → _Description_
    - `wvcas.szodnomcompmaxcalc` (w=10) → _Szodnomcompmax (computed)_
    - `wvcas.wtperlengthcalc` (w=10) → _Wtperlength (computed)_
    - `wvcas.gradecalc` (w=10) → _Grade (computed)_
    - `wvcas.depthbtm` (w=10) → _Bottom Depth_
  - **Bit & BHA** — `wvjobdrillstring` (17 fields)
    - `wvjobdrillstring.stringno` (w=10) → _Stringno_
    - `wvjobdrillstring.bitno` (w=10) → _Bitno_
    - `wvjobdrillstring.idrecbit` (w=30) → _Idrecbit_
    - `wvjobdrillbit.depthdrilledjobcalc` (w=10) → _Depth Drilledjob (computed)_
    - `wvjobdrillbit.tmdrilledjobcalc` (w=10) → _Tmdrilledjob (computed)_
    - `wvjobdrillbit.ropjobcalc` (w=10) → _Ropjob (computed)_
    - `wvjobdrillstring.bitnozzlecalc` (w=30) → _Bitnozzle (computed)_
    - `wvjobdrillstring.bittfacalc` (w=10) → _Bittfa (computed)_
    - `wvjobdrillstring.componentscalc` (w=30) → _Components (computed)_
    - `wvjobdrillstring.wobmincalc` (w=10) → _Wobmin (computed)_
    - `wvjobdrillstring.wobmaxcalc` (w=10) → _Wobmax (computed)_
    - `wvjobdrillstring.rpmmincalc` (w=10) → _Rpmmin (computed)_
    - `wvjobdrillstring.rpmmaxcalc` (w=10) → _Rpmmax (computed)_
    - `wvjobdrillstring.liquidinjratemincalc` (w=10) → _Liquidinjratemin (computed)_
    - `wvjobdrillstring.liquidinjratemaxcalc` (w=10) → _Liquidinjratemax (computed)_
    - `wvjobdrillstring.sppdrillmincalc` (w=10) → _Sppdrillmin (computed)_
    - `wvjobdrillstring.sppdrillmaxcalc` (w=10) → _Sppdrillmax (computed)_
  - **Daily Operational Summary** — `wvjobreport` (2 fields)
    - `wvjobreport.summaryops` (w=30) → _Summaryops_
    - `wvjobreport.plannextrptops` (w=30) → _Plannextrptops_
  - **Daily Drilling Mud Volumes** — `wvjobreportfluidswell` (4 fields)
    - `wvjobreportfluidswell.fluidtyp` (w=10) → _Fluidtyp_
    - `wvjobreportfluidswell.actiontyp` (w=10) → _Actual Iontyp_
    - `wvjobreportfluidswell.towell` (w=5) → _Towell_
    - `wvjobreportfluidswell.fromwell` (w=5) → _Fromwell_
  - **Summary Drilling Mud Volumes** — `wvjrfluidscalc` (3 fields)
    - `wvjrfluidscalc.fluidtyp` (w=20) → _Fluidtyp_
    - `wvjrfluidscalc.cumtowell` (w=10) → _Cumulative Towell_
    - `wvjrfluidscalc.cumfromwell` (w=10) → _Cumulative Fromwell_

### Days vs Depth and Cost - Graph

- **HTML:** [Drilling/Drilling Summary/Days vs Depth and Cost - Graph.html](Drilling/Drilling%20Summary/Days%20vs%20Depth%20and%20Cost%20-%20Graph.html)
- **Paper:** letter · **margins** [12, 12, 31, 25] (1/100 in)
- **Master template:** template landscape.afr
- **Root table:** `None` · **filter:** wvjob / wvjob / jobtyp
- **Captions:**
  - `<wvjobreport.depthprogressdpcalc>`
  - `<wvjobreport.dttmend>`
- **Blocks:** 3

  - **Daily Report** — `wvjobreport` (1 fields)
    - `wvjobreport.costtodatecalc` (w=0) → _Cost To Date_
  - **Daily Report** — `wvjobreport` (1 fields)
    - `wvjobreport.depthenddpcalc` (w=0) → _Depth End (MD)_
  - **Job** — `wvjob` (8 fields)
    - `wvjob.afenumbercalc` (w=10) → _AFE Number_
    - `wvjob.wvtyp` (w=10) → _Wvtyp_
    - `wvjob.jobtyp` (w=10) → _Jobtyp_
    - `wvjob.dttmstart` (w=10) → _Start Date/Time_
    - `wvjob.dttmend` (w=10) → _End Date/Time_
    - `wvjob.afetotalcalc` (w=10) → _AFE Total_
    - `wvjob.costtotalcalc` (w=10) → _Daily Cost Total_
    - `wvjob.depthdrilledcalc` (w=10) → _Depth Drilled (computed)_

### Days vs Depth with Annotations

- **HTML:** [Drilling/Drilling Summary/Days vs Depth with Annotations.html](Drilling/Drilling%20Summary/Days%20vs%20Depth%20with%20Annotations.html)
- **Paper:** letter · **margins** [12, 12, 31, 25] (1/100 in)
- **Master template:** template landscape header.afr
- **Root table:** `wvjob` · **filter:** wvjob / wvtyp / dril
- **Blocks:** 1

  - **Job** — `wvjob` (1 fields)
    - `wvjob.idrec` (w=0) → _Record ID_

### Drilling Summary 1 (11x17)

- **HTML:** [Drilling/Drilling Summary/Drilling Summary 1 (11x17).html](Drilling/Drilling%20Summary/Drilling%20Summary%201%20%2811x17%29.html)
- **Paper:** tabloid · **margins** [50, 38, 50, 38] (1/100 in)
- **Master template:** _none_
- **Root table:** `wvjob` · **filter:** wvjob / wvtyp / drill*; wvjtlsumcode1calc / fractiontotaltime; wvjcostsumdailydescalc / cost; wvjtlsumunschedtypcalc / fractiontotaltime
- **Captions:**
  - `Report generated on  <Current date short format>`
  - `Page <Page number>`
  - `<wvjtlsumcode1calc.code1>`
  - `<wvjobreport.depthprogressdpcalc>`
  - `<wvwellheader.wellname>`
- **Blocks:** 6

  - **Drilling Summary 1** — `wvwellheader` (21 fields)
    - `wvwellheader.wellida` (w=10) → _Well ID_
    - `wvwellheader.fieldname` (w=10) → _Field_
    - `wvwellheader.area` (w=10) → _Area_
    - `wvwellheader.operator` (w=10) → _Operator_
    - `wvwellheader.county` (w=10) → _County_
    - `wvwellheader.stateprov` (w=10) → _Stateprov_
    - `wvwellheader.legalsurveyloc` (w=10) → _Legalsurveyloc_
    - `wvwellheader.ewdist` (w=10) → _Ewdist_
    - `wvwellheader.ewflag` (w=5) → _Ewflag_
    - `wvwellheader.nsdist` (w=10) → _Nsdist_
    - `wvwellheader.nsflag` (w=5) → _Nsflag_
    - `wvwellheader.latitude` (w=10) → _Latitude_
    - `wvwellheader.longitude` (w=10) → _Longitude_
    - `wvwellheader.elvground` (w=5) → _Elvground_
    - `wvwellheader.elvcasflange` (w=5) → _Elvcasflange_
    - `wvwellheader.kbtogrdcalc` (w=10) → _Kbtogrd (computed)_
    - `wvwellheader.kbtocascalc` (w=10) → _Kbtocas (computed)_
    - `wvwellheader.tdcalc` (w=10) → _Td (computed)_
    - `wvwellheader.dttmspud` (w=10) → _Spud Date/Time_
    - `wvwellheader.dttmrr` (w=10) → _Date/Time Rr_
    - `wvjob.idrec` (w=0) → _Record ID_
  - **Time Breakdown by Code1** — `wvjtlsumcode1calc` (1 fields)
    - `wvjtlsumcode1calc.fractiontotaltime` (w=0) → _Fractiontotaltime_
  - **Depth and Cost vs Days** — `wvjobreport` (1 fields)
    - `wvjobreport.depthenddpcalc` (w=0) → _Depth End (MD)_
  - **Daily Report** — `wvjobreport` (1 fields)
    - `wvjobreport.costtodatecalc` (w=0) → _Cost To Date_
  - **Cost Breakdown by Des** — `wvjcostsumdailydescalc` (1 fields)
    - `wvjcostsumdailydescalc.cost` (w=0) → _Cost_
  - **NPT by Des** — `wvjtlsumunschedtypcalc` (1 fields)
    - `wvjtlsumunschedtypcalc.fractiontotaltime` (w=0) → _Fractiontotaltime_

### Drilling Summary 2 - Schematic

- **HTML:** [Drilling/Drilling Summary/Drilling Summary 2 - Schematic.html](Drilling/Drilling%20Summary/Drilling%20Summary%202%20-%20Schematic.html)
- **Paper:** letter · **margins** [25, 25, 25, 25] (1/100 in)
- **Master template:** template landscape header.afr
- **Root table:** `wvjob` · **filter:** wvjob / wvtyp / drill
- **Blocks:** 1

  - **Wellbore** — `wvwellbore` (1 fields)
    - `wvjob.idrec` (w=0) → _Record ID_

### Drilling Summary 3

- **HTML:** [Drilling/Drilling Summary/Drilling Summary 3.html](Drilling/Drilling%20Summary/Drilling%20Summary%203.html)
- **Paper:** letter · **margins** [12, 12, 31, 25] (1/100 in)
- **Master template:** template landscape legal.afr
- **Root table:** `wvjob` · **filter:** wvjob / wvtyp / drill*; wvwellheader / wvjob
- **Captions:**
  - `Job Type:   <wvjob.jobtyp>`
- **Blocks:** 17

  - **Daily Summary** — `wvjob` (5 fields)
    - `wvjob.afenumbercalc` (w=8) → _AFE Number_
    - `wvjob.afetotalcalc` (w=10) → _AFE Total_
    - `wvjob.costtotalcalc` (w=10) → _Daily Cost Total_
    - `wvjob.variancefieldcalc` (w=10) → _Variancefield (computed)_
    - `wvjob.summary` (w=30) → _Summary_
  - **Rig** — `wvjobrig` (2 fields)
    - `wvjobrig.contractor` (w=24) → _Contractor_
    - `wvjobrig.rigno` (w=8) → _Rigno_
  - **Jobcontact** — `wvjobcontact` (2 fields)
    - `wvjobcontact.title` (w=8) → _Title_
    - `wvjobcontact.phonemobile` (w=8) → _Phonemobile_
  - **Job** — `wvjob` (11 fields)
    - `wvwellheader.wellida` (w=15) → _Well ID_
    - `wvwellheader.legalsurveyloc` (w=15) → _Legalsurveyloc_
    - `wvwellheader.stateprov` (w=15) → _Stateprov_
    - `wvwellheader.dttmspud` (w=9) → _Spud Date/Time_
    - `wvwellheader.dttmrr` (w=9) → _Date/Time Rr_
    - `wvwellheader.welllicenseno` (w=9) → _Welllicenseno_
    - `wvwellheader.elvground` (w=7) → _Elvground_
    - `wvwellheader.elvcasflange` (w=7) → _Elvcasflange_
    - `wvwellheader.kbtogrdcalc` (w=7) → _Kbtogrd (computed)_
    - `wvwellheader.kbtocascalc` (w=7) → _Kbtocas (computed)_
    - `wvwellheader.tdcalc` (w=7) → _Td (computed)_
  - **Daily Summary** — `wvjobdrillstring` (6 fields)
    - `wvjobdrillstring.bitno` (w=3) → _Bitno_
    - `wvjobdrillstring.idrecbit` (w=15) → _Idrecbit_
    - `wvjobdrillstring.depthincalc` (w=6) → _Depth In (computed)_
    - `wvjobdrillstring.depthoutcalc` (w=6) → _Depth Out (computed)_
    - `wvjobdrillstring.depthdrilledcalc` (w=6) → _Depth Drilled (computed)_
    - `wvjobdrillstring.tmdrilledcalc` (w=6) → _Tmdrilled (computed)_
  - **Interval Problem (NPT)** — `wvjobintervalproblem` (5 fields)
    - `wvjobintervalproblem.dttmstart` (w=7) → _Start Date/Time_
    - `wvjobintervalproblem.depthstart` (w=7) → _Depth Start_
    - `wvjobintervalproblem.depthend` (w=7) → _Depth End_
    - `wvjobintervalproblem.des` (w=15) → _Description_
    - `wvjobintervalproblem.com` (w=35) → _Comment_
  - **Interval Lesson** — `wvjobintervallesson` (7 fields)
    - `wvjobintervallesson.dttmstart` (w=7) → _Start Date/Time_
    - `wvjobintervallesson.depthstart` (w=7) → _Depth Start_
    - `wvjobintervallesson.depthend` (w=7) → _Depth End_
    - `wvjobintervallesson.typ` (w=15) → _Type_
    - `wvjobintervallesson.estcostsaving` (w=7) → _Estimate Costsaving_
    - `wvjobintervallesson.esttimesaving` (w=7) → _Estimate Timesaving_
    - `wvjobintervallesson.com` (w=35) → _Comment_
  - **Cement** — `wvcement` (3 fields)
    - `wvcement.des` (w=18) → _Description_
    - `wvcement.dttmstart` (w=9) → _Start Date/Time_
    - `wvcement.dttmend` (w=9) → _End Date/Time_
  - **Cementstage** — `wvcementstage` (6 fields)
    - `wvcementstage.stagenum` (w=2) → _Stagenum_
    - `wvcementstage.des` (w=9) → _Description_
    - `wvcementstage.depthtop` (w=9) → _Top Depth_
    - `wvcementstage.depthbtm` (w=9) → _Bottom Depth_
    - `wvcementstage.fullreturn` (w=3) → _Fullreturn_
    - `wvcementstage.volreturncmnt` (w=9) → _Volreturncmnt_
  - **Cementstagefluid** — `wvcementstagefluid` (8 fields)
    - `wvcementstagefluid.typ` (w=9) → _Type_
    - `wvcementstagefluid.desfluid` (w=9) → _Description Fluid_
    - `wvcementstagefluid.depthtopest` (w=9) → _Depth Topest_
    - `wvcementstagefluid.depthbtmest` (w=9) → _Depth Btmest_
    - `wvcementstagefluid.amtcement` (w=9) → _Amtcement_
    - `wvcementstagefluid.cmtclass` (w=9) → _Cmtclass_
    - `wvcementstagefluid.yield` (w=9) → _Yield_
    - `wvcementstagefluid.excesspumped` (w=6) → _Excesspumped_
  - **Cementstagefluidadd** — `wvcementstagefluidadd` (3 fields)
    - `wvcementstagefluidadd.des` (w=9) → _Description_
    - `wvcementstagefluidadd.typ` (w=9) → _Type_
    - `wvcementstagefluidadd.conc` (w=9) → _Conc_
  - **Wellbore** — `wvwellbore` (2 fields)
    - `wvwellbore.des` (w=9) → _Description_
    - `wvwellbore.kickoffdepth` (w=9) → _Kickoffdepth_
  - **Wellboresize** — `wvwellboresize` (2 fields)
    - `wvwellboresize.des` (w=9) → _Description_
    - `wvwellboresize.sz` (w=7) → _Sz_
  - **Cas** — `wvcas` (5 fields)
    - `wvcas.des` (w=12) → _Description_
    - `wvcas.szodnommaxcalc` (w=7) → _Szodnommax (computed)_
    - `wvcas.wtperlengthcalc` (w=8) → _Wtperlength (computed)_
    - `wvcas.gradecalc` (w=7) → _Grade (computed)_
    - `wvcas.depthbtm` (w=9) → _Bottom Depth_
  - **Log** — `wvlog` (4 fields)
    - `wvlog.typ` (w=15) → _Type_
    - `wvlog.depthtop` (w=9) → _Top Depth_
    - `wvlog.depthbtm` (w=9) → _Bottom Depth_
    - `wvlog.contractor` (w=15) → _Contractor_
  - **Core** — `wvcore` (6 fields)
    - `wvcore.dttm` (w=9) → _Dttm_
    - `wvcore.typ` (w=9) → _Type_
    - `wvcore.contractor` (w=9) → _Contractor_
    - `wvcore.depthtop` (w=9) → _Top Depth_
    - `wvcore.depthbtm` (w=9) → _Bottom Depth_
    - `wvcore.lenrecovered` (w=9) → _Lenrecovered_
  - **Otherinhole** — `wvotherinhole` (4 fields)
    - `wvotherinhole.des` (w=18) → _Description_
    - `wvotherinhole.depthtop` (w=9) → _Top Depth_
    - `wvotherinhole.depthbtm` (w=9) → _Bottom Depth_
    - `wvotherinhole.dttmrun` (w=9) → _Date/Time Run_

### Field Est Cost Summary - Graph

- **HTML:** [Drilling/Drilling Summary/Field Est Cost Summary - Graph.html](Drilling/Drilling%20Summary/Field%20Est%20Cost%20Summary%20-%20Graph.html)
- **Paper:** letter · **margins** [25, 25, 25, 25] (1/100 in)
- **Master template:** template portrait header.afr
- **Root table:** `wvjob` · **filter:** wvjob / wvtyp / drill; wvjob / idrec; wvjob / idrec; wvjcostsumdailydescalc / cost
- **Captions:**
  - `<wvjcostsumdailydescalc.cost>`
- **Blocks:** 2

  - **Job** — `wvjob` (7 fields)
    - `wvjob.afenumbercalc` (w=10) → _AFE Number_
    - `wvjob.wvtyp` (w=10) → _Wvtyp_
    - `wvjob.jobtyp` (w=10) → _Jobtyp_
    - `wvjob.dttmstart` (w=10) → _Start Date/Time_
    - `wvjob.dttmend` (w=10) → _End Date/Time_
    - `wvjob.status1` (w=10) → _Status1_
    - `wvjob.objective` (w=30) → _Objective_
  - **Jcostsumdailydescalc** — `wvjcostsumdailydescalc` (1 fields)
    - `wvjcostsumdailydescalc.cost` (w=0) → _Cost_

### Hydraulics Summary

- **HTML:** [Drilling/Drilling Summary/Hydraulics Summary.html](Drilling/Drilling%20Summary/Hydraulics%20Summary.html)
- **Paper:** letter · **margins** [25, 0, 25, 25] (1/100 in)
- **Master template:** template portrait.afr
- **Root table:** `wvjobdrillstring` · **filter:** wvjob / wvtyp / drill; wvjobdrillstring / idrec; wvjobdrillstring / idrec; wvjdsdpavcalc / calcerror; wvjobreportmudchk / dttm; wvjobdrillstring / dttmoutcalc; wvjobreportmudchk / dttm; wvjobdrillstring / dttmincalc; wvjob / wvtyp / dril
- **Captions:**
  - `@GDRILL STRING & DAILY INFORMATION FOR  BHA#: <wvjobdrillstring.`
  - `illing Parameters from  <wvjobdrillstringdrillparam.dttmstart> to  <wvjobdrillstringdrillparam.dttmend>,  <wvjobdr`
  - `depthstart> to  <wvjobdrillstringdrillparam.de`
- **Blocks:** 11

  - **Annular Velocity vs Depth** — `wvjdsdpavcalc` (1 fields)
    - `wvjdsdpavcalc.depthbtm` (w=0) → _Bottom Depth_
  - **Wellboresize** — `wvwellboresize` (5 fields)
    - `wvwellboresize.depthbtmactual` (w=9) → _Depth Btmactual_
    - `wvwellboresize.depthtopactual` (w=9) → _Depth Topactual_
    - `wvwellboresize.sz` (w=7) → _Sz_
    - `wvwellbore.idrecparent` (w=15) → _Idrecparent_
    - `wvwellbore.des` (w=12) → _Description_
  - **Jobdrillstringbitnozzle** — `wvjobdrillstringbitnozzle` (2 fields)
    - `wvjobdrillstringbitnozzle.dia` (w=5) → _Dia_
    - `wvjobdrillstringbitnozzle.typ` (w=15) → _Type_
  - **Mud Check** — `wvjobreportmudchk` (13 fields)
    - `wvjobreportmudchk.dttm` (w=10) → _Dttm_
    - `wvjobreportmudchk.density` (w=10) → _Density_
    - `wvjobreportmudchk.depth` (w=10) → _Depth_
    - `wvjobreportmudchk.dontuse` (w=10) → _Dontuse_
    - `wvjobreportmudchk.funnelviscosity` (w=10) → _Funnelviscosity_
    - `wvjobreportmudchk.koverride` (w=10) → _Koverride_
    - `wvjobreportmudchk.noverride` (w=10) → _Number Verride_
    - `wvjobreportmudchk.vis100rpm` (w=10) → _Vis100Rpm_
    - `wvjobreportmudchk.vis300rpm` (w=10) → _Vis300Rpm_
    - `wvjobreportmudchk.vis3rpm` (w=10) → _Vis3Rpm_
    - `wvjobreportmudchk.vis600rpm` (w=10) → _Vis600Rpm_
    - `wvjobreportmudchk.plasticvis` (w=7) → _Plasticvis_
    - `wvjobreportmudchk.yieldpt` (w=7) → _Yieldpt_
  - **Job** — `wvjob` (4 fields)
    - `wvjob.wvtyp` (w=10) → _Wvtyp_
    - `wvjob.dttmstart` (w=10) → _Start Date/Time_
    - `wvjob.dttmend` (w=10) → _End Date/Time_
    - `wvjob.depthdrilledcalc` (w=10) → _Depth Drilled (computed)_
  - **@GDRILL STRING & DAILY INFORMATION FOR  BHA#: <wvjobdrillstring.** — `wvjobdrillstring` (6 fields)
    - `wvjobdrillstring.stringno` (w=10) → _Stringno_
    - `wvjobdrillstring.bitno` (w=10) → _Bitno_
    - `wvjobdrillstring.idrecbit` (w=30) → _Idrecbit_
    - `wvjobdrillstring.bittfacalc` (w=10) → _Bittfa (computed)_
    - `wvjobdrillstring.depthincalc` (w=10) → _Depth In (computed)_
    - `wvjobdrillstring.depthoutcalc` (w=10) → _Depth Out (computed)_
  - **Drill String Component** — `wvjobdrillstringcomp` (5 fields)
    - `wvjobdrillstringcomp.des` (w=20) → _Description_
    - `wvjobdrillstringcomp.szodnom` (w=10) → _Szodnom_
    - `wvjobdrillstringcomp.szidnom` (w=10) → _Szidnom_
    - `wvjobdrillstringcomp.length` (w=10) → _Length_
    - `wvjobdrillstringcomp.lengthcumcalc` (w=10) → _Length (cumulative) (computed)_
  - **Daily Operating Parameter** — `wvjobdrillstringdrillparam` (4 fields)
    - `wvjobdrillstringdrillparam.depthdrilledcalc` (w=10) → _Depth Drilled (computed)_
    - `wvjobdrillstringdrillparam.ropcalc` (w=10) → _ROP_
    - `wvjobdrillstringdrillparam.liquidinjrate` (w=10) → _Liquidinjrate_
    - `wvjobdrillstringdrillparam.sppdrill` (w=10) → _Sppdrill_
  - **Hydraulics (computed)** — `wvjdsdphydcalc` (9 fields)
    - `wvjdsdphydcalc.hydpwrbit` (w=10) → _Hydpwrbit_
    - `wvjdsdphydcalc.hydpwrperarea` (w=10) → _Hydpwrperarea_
    - `wvjdsdphydcalc.jetvelocity` (w=10) → _Jetvelocity_
    - `wvjdsdphydcalc.pressuredropbit` (w=10) → _Pressuredropbit_
    - `wvjdsdphydcalc.avopenholemin` (w=10) → _Avopenholemin_
    - `wvjdsdphydcalc.avopenholemax` (w=10) → _Avopenholemax_
    - `wvjdsdphydcalc.avcasmin` (w=10) → _Avcasmin_
    - `wvjdsdphydcalc.avcasmax` (w=10) → _Avcasmax_
    - `wvjdsdphydcalc.calcerror` (w=10) → _Calcerror_
  - **Hydraulic Calc Error Details** — `wvjdsdpavcalc` (1 fields)
    - `wvjdsdpavcalc.calcerror` (w=10) → _Calcerror_
  - **AV Calc Error Details** — `wvjobreportmudchk` (8 fields)
    - `wvjobreportmudchk.dttm` (w=20) → _Dttm_
    - `wvjobreportmudchk.density` (w=10) → _Density_
    - `wvjobreportmudchk.plasticviscalc` (w=10) → _Plasticvis (computed)_
    - `wvjobreportmudchk.yieldptcalc` (w=10) → _Yieldpt (computed)_
    - `wvjobreportmudchk.ncalc` (w=10) → _N (computed)_
    - `wvjobreportmudchk.kcalc` (w=10) → _K (computed)_
    - `wvjobreportmudchk.depth` (w=10) → _Depth_
    - `wvjobreportmudchk.tvdcalc` (w=10) → _Tvd (computed)_

### LOT & FIT with Graph

- **HTML:** [Drilling/Drilling Summary/LOT & FIT with Graph.html](Drilling/Drilling%20Summary/LOT%20%26%20FIT%20with%20Graph.html)
- **Paper:** letter · **margins** [12, 12, 31, 25] (1/100 in)
- **Master template:** template landscape header.afr
- **Root table:** `wvtestleakoff`
- **Blocks:** 3

  - **Testleakoff** — `wvtestleakoff` (14 fields)
    - `wvtestleakoff.dttm` (w=9) → _Dttm_
    - `wvtestleakoff.testtyp` (w=10) → _Testtyp_
    - `wvtestleakoff.depth` (w=10) → _Depth_
    - `wvtestleakoff.tvdcalc` (w=10) → _Tvd (computed)_
    - `wvtestleakoff.fluidtyp` (w=10) → _Fluidtyp_
    - `wvtestleakoff.densityfluid` (w=10) → _Densityfluid_
    - `wvtestleakoff.leakoffpres` (w=10) → _Leakoffpres_
    - `wvtestleakoff.volpumped` (w=10) → _Volpumped_
    - `wvtestleakoff.leakoffoccurred` (w=5) → _Leakoffoccurred_
    - `wvtestleakoff.leakoffprescalc` (w=10) → _Leakoffpres (computed)_
    - `wvtestleakoff.leakoffdensityfluidcalc` (w=10) → _Leakoffdensityfluid (computed)_
    - `wvtestleakoff.idrecfrm` (w=10) → _Idrecfrm_
    - `wvtestleakoff.idreccas` (w=25) → _Idreccas_
    - `wvtestleakoff.com` (w=50) → _Comment_
  - **Testleakoffdata** — `wvtestleakoffdata` (4 fields)
    - `wvtestleakoffdata.tm` (w=6) → _Tm_
    - `wvtestleakoffdata.pres` (w=8) → _Pres_
    - `wvtestleakoffdata.vol` (w=8) → _Vol_
    - `wvtestleakoffdata.note` (w=15) → _Note_
  - **Pressure vs Time Graph** — `wvtestleakoffdata` (1 fields)
    - `wvtestleakoffdata.pres` (w=0) → _Pres_

### Mud Additive Details

- **HTML:** [Drilling/Drilling Summary/Mud Additive Details.html](Drilling/Drilling%20Summary/Mud%20Additive%20Details.html)
- **Paper:** letter · **margins** [25, 25, 25, 25] (1/100 in)
- **Master template:** template portrait header.afr
- **Root table:** `None` · **filter:** wvjob / wvjob / jobtyp
- **Captions:**
  - `AFE#:  <wvjob.afenumbercalc>`
- **Blocks:** 3

  - **Job** — `wvjob` (6 fields)
    - `wvjob.wvtyp` (w=10) → _Wvtyp_
    - `wvjob.jobtyp` (w=10) → _Jobtyp_
    - `wvjob.afenumbercalc` (w=10) → _AFE Number_
    - `wvjob.dttmstart` (w=10) → _Start Date/Time_
    - `wvjob.dttmend` (w=10) → _End Date/Time_
    - `wvjob.mudcostcalc` (w=10) → _Mudcost (computed)_
  - **Jobmudadd** — `wvjobmudadd` (8 fields)
    - `wvjobmudadd.cost` (w=9) → _Cost_
    - `wvjobmudadd.unitlabel` (w=9) → _Unitlabel_
    - `wvjobmudadd.receivedcalc` (w=9) → _Received (computed)_
    - `wvjobmudadd.consumedcalc` (w=9) → _Consumed (computed)_
    - `wvjobmudadd.returnedcalc` (w=9) → _Returned (computed)_
    - `wvjobmudadd.inventorycalc` (w=9) → _Inventory (computed)_
    - `wvjobmudadd.costcalc` (w=9) → _Cost (computed)_
    - `wvjobmudadd.note` (w=30) → _Note_
  - **Jobmudaddamt** — `wvjobmudaddamt` (6 fields)
    - `wvjobmudaddamt.dttm` (w=9) → _Dttm_
    - `wvjobmudaddamt.received` (w=9) → _Received_
    - `wvjobmudaddamt.consumed` (w=9) → _Consumed_
    - `wvjobmudaddamt.returned` (w=9) → _Returned_
    - `wvjobmudaddamt.note` (w=9) → _Note_
    - `wvjobmudaddamt.costcalc` (w=9) → _Cost (computed)_

### Mud Additive Summary

- **HTML:** [Drilling/Drilling Summary/Mud Additive Summary.html](Drilling/Drilling%20Summary/Mud%20Additive%20Summary.html)
- **Paper:** letter · **margins** [25, 25, 25, 25] (1/100 in)
- **Master template:** template portrait header.afr
- **Root table:** `wvjob` · **filter:** wvjob / wvtyp / drill; wvjobrig / idrecparent; wvjob / idrec; wvjob / idrec; wvjob / idrec
- **Captions:**
  - `Job Type:  <wvjob.jobtyp>; AFE#:  <wvjob.afenumbercalc>`
- **Blocks:** 3

  - **Job** — `wvjob` (5 fields)
    - `wvjob.dttmstart` (w=10) → _Start Date/Time_
    - `wvjob.dttmend` (w=10) → _End Date/Time_
    - `wvwellheader.dttmspud` (w=10) → _Spud Date/Time_
    - `wvwellheader.dttmrr` (w=10) → _Date/Time Rr_
    - `wvjob.mudcostcalc` (w=10) → _Mudcost (computed)_
  - **Rig** — `wvjobrig` (5 fields)
    - `wvjobrig.contractor` (w=10) → _Contractor_
    - `wvjobrig.rigno` (w=10) → _Rigno_
    - `wvjobrig.typ1` (w=10) → _Typ1_
    - `wvjobrig.dttmstart` (w=10) → _Start Date/Time_
    - `wvjobrig.dttmend` (w=10) → _End Date/Time_
  - **Jobmudadd** — `wvjobmudadd` (8 fields)
    - `wvjobmudadd.des` (w=15) → _Description_
    - `wvjobmudadd.cost` (w=9) → _Cost_
    - `wvjobmudadd.unitlabel` (w=5) → _Unitlabel_
    - `wvjobmudadd.receivedcalc` (w=9) → _Received (computed)_
    - `wvjobmudadd.consumedcalc` (w=9) → _Consumed (computed)_
    - `wvjobmudadd.returnedcalc` (w=9) → _Returned (computed)_
    - `wvjobmudadd.inventorycalc` (w=9) → _Inventory (computed)_
    - `wvjobmudadd.costcalc` (w=9) → _Cost (computed)_

### Mud Properties Summary

- **HTML:** [Drilling/Drilling Summary/Mud Properties Summary.html](Drilling/Drilling%20Summary/Mud%20Properties%20Summary.html)
- **Paper:** letter · **margins** [12, 12, 31, 25] (1/100 in)
- **Master template:** template landscape legal.afr
- **Root table:** `wvjob` · **filter:** wvjob / wvtyp / dril; wvjob / idrec; wvjob / idrec
- **Captions:**
  - `Job Type:  <wvjob.jobtyp>; AFE#:  <wvjob.afenumbercalc>`
- **Blocks:** 3

  - **Rig** — `wvjobrig` (9 fields)
    - `wvjob.jobtyp` (w=10) → _Jobtyp_
    - `wvjob.jobsubtyp` (w=10) → _Jobsubtyp_
    - `wvjob.targetdepth` (w=10) → _Target Depth_
    - `wvjob.targetform` (w=10) → _Target Formation_
    - `wvjobrig.contractor` (w=10) → _Contractor_
    - `wvjobrig.rigno` (w=10) → _Rigno_
    - `wvjobrig.typ1` (w=10) → _Typ1_
    - `wvjobrig.dttmstart` (w=10) → _Start Date/Time_
    - `wvjobrig.dttmend` (w=10) → _End Date/Time_
  - **Mud Check** — `wvjobreportmudchk` (30 fields)
    - `wvjobreportmudchk.dttm` (w=17) → _Dttm_
    - `wvjobreportmudchk.depth` (w=15) → _Depth_
    - `wvjobreportmudchk.tvdcalc` (w=15) → _Tvd (computed)_
    - `wvjobreportmudchk.mudtyp` (w=20) → _Mudtyp_
    - `wvjobreportmudchk.density` (w=10) → _Density_
    - `wvjobreportmudchk.funnelviscosity` (w=10) → _Funnelviscosity_
    - `wvjobreportmudchk.plasticviscalc` (w=10) → _Plasticvis (computed)_
    - `wvjobreportmudchk.yieldptcalc` (w=10) → _Yieldpt (computed)_
    - `wvjobreportmudchk.gel10sec` (w=10) → _Gel10Sec_
    - `wvjobreportmudchk.gel10min` (w=10) → _Gel10Min_
    - `wvjobreportmudchk.filtrate` (w=10) → _Filtrate_
    - `wvjobreportmudchk.ph` (w=10) → _pH_
    - `wvjobreportmudchk.alkalinity` (w=15) → _Alkalinity_
    - `wvjobreportmudchk.barite` (w=10) → _Barite_
    - `wvjobreportmudchk.cacl` (w=10) → _Cacl_
    - `wvjobreportmudchk.calcium` (w=10) → _Calcium_
    - `wvjobreportmudchk.chlorides` (w=10) → _Chlorides_
    - `wvjobreportmudchk.kcalc` (w=15) → _K (computed)_
    - `wvjobreportmudchk.lcm` (w=10) → _Lcm_
    - `wvjobreportmudchk.lime` (w=10) → _Lime_
    - `wvjobreportmudchk.solidslowgrav` (w=10) → _Solidslowgrav_
    - `wvjobreportmudchk.magnesium` (w=10) → _Magnesium_
    - `wvjobreportmudchk.mbt` (w=10) → _Mbt_
    - `wvjobreportmudchk.ncalc` (w=10) → _N (computed)_
    - `wvjobreportmudchk.oilwaterratiocalc` (w=10) → _Oilwaterratio (computed)_
    - `wvjobreportmudchk.pf` (w=10) → _Pf_
    - `wvjobreportmudchk.pm` (w=10) → _Pm_
    - `wvjobreportmudchk.potassium` (w=10) → _Potassium_
    - `wvjobreportmudchk.sands` (w=10) → _Sands_
    - `wvjobreportmudchk.solids` (w=10) → _Solids_
  - **Well Header** — `wvwellheader` (8 fields)
    - `wvwellheader.wellida` (w=10) → _Well ID_
    - `wvwellheader.legalsurveyloc` (w=10) → _Legalsurveyloc_
    - `wvwellheader.welllicenseno` (w=10) → _Welllicenseno_
    - `wvwellheader.wellconfig` (w=10) → _Wellconfig_
    - `wvwellheader.elvground` (w=10) → _Elvground_
    - `wvwellheader.elvcasflange` (w=10) → _Elvcasflange_
    - `wvwellheader.kbtogrdcalc` (w=10) → _Kbtogrd (computed)_
    - `wvwellheader.kbtocascalc` (w=10) → _Kbtocas (computed)_

### Phases - Plan vs Actual Details

- **HTML:** [Drilling/Drilling Summary/Phases - Plan vs Actual Details.html](Drilling/Drilling%20Summary/Phases%20-%20Plan%20vs%20Actual%20Details.html)
- **Paper:** letter · **margins** [25, 25, 25, 25] (1/100 in)
- **Master template:** template landscape.afr
- **Root table:** `wvjobprogramphase` · **filter:** wvjob / wvtyp / drill
- **Blocks:** 4

  - **Jobprogramphase** — `wvjobprogramphase` (13 fields)
    - `wvjobprogramphase.code1` (w=10) → _Code 1_
    - `wvjobprogramphase.code2` (w=10) → _Code 2_
    - `wvjobprogramphase.code3` (w=10) → _Code3_
    - `wvjobprogramphase.code4` (w=10) → _Code4_
    - `wvjobprogramphase.idrecwellbore` (w=10) → _Idrecwellbore_
    - `wvjobprogramphase.planphase` (w=50) → _Planphase_
    - `wvjobprogramphase.hazards` (w=15) → _Hazards_
    - `wvjobprogramphase.dttmstartactual` (w=10) → _Date/Time Startactual_
    - `wvjobprogramphase.dttmendactual` (w=10) → _Date/Time Endactual_
    - `wvjobprogramphase.wellboreszcalc` (w=10) → _Wellboresz (computed)_
    - `wvjobprogramphase.incltopcalc` (w=10) → _Incltop (computed)_
    - `wvjobprogramphase.inclbtmcalc` (w=10) → _Inclbtm (computed)_
    - `wvjobprogramphase.inclmaxcalc` (w=10) → _Inclmax (computed)_
  - **Jobprogramphase** — `wvjobprogramphase` (10 fields)
    - `wvjobprogramphase.durationml` (w=10) → _Duration Ml_
    - `wvjobprogramphase.dayjobmlplancalc` (w=10) → _Dayjobmlplan (computed)_
    - `wvjobprogramphase.costml` (w=10) → _Costml_
    - `wvjobprogramphase.costmlcumcalc` (w=10) → _Costml (cumulative) (computed)_
    - `wvjobprogramphase.depthstartplan` (w=10) → _Depth Startplan_
    - `wvjobprogramphase.depthtvdstartplancalc` (w=10) → _Depth TVD Startplan (computed)_
    - `wvjobprogramphase.depthendplan` (w=10) → _Depth Endplan_
    - `wvjobprogramphase.depthtvdendplancalc` (w=10) → _Depth TVD Endplan (computed)_
    - `wvjobprogramphase.depthprogressplancalc` (w=10) → _Depth Progressplan (computed)_
    - `wvjobprogramphase.costperdepthplancalc` (w=10) → _Costperdepthplan (computed)_
  - **Jobprogramphase** — `wvjobprogramphase` (10 fields)
    - `wvjobprogramphase.durationactualcalc` (w=10) → _Duration Actual Ual (computed)_
    - `wvjobprogramphase.durcumactualcalc` (w=10) → _Duration Cumulative Actual Ual (computed)_
    - `wvjobprogramphase.costactualcalc` (w=10) → _Costactual (computed)_
    - `wvjobprogramphase.costactualcumcalc` (w=10) → _Costactual (cumulative) (computed)_
    - `wvjobprogramphase.depthstartactualcalc` (w=10) → _Depth Startactual (computed)_
    - `wvjobprogramphase.depthtvdstartactualcalc` (w=10) → _Depth TVD Startactual (computed)_
    - `wvjobprogramphase.depthendactualcalc` (w=10) → _Depth Endactual (computed)_
    - `wvjobprogramphase.depthtvdendactualcalc` (w=10) → _Depth TVD Endactual (computed)_
    - `wvjobprogramphase.depthprogressactualcalc` (w=10) → _Depth Progressactual (computed)_
    - `wvjobprogramphase.costperdepthcalc` (w=10) → _Costperdepth (computed)_
  - **Plan vs Actual** — `wvjobprogramphase` (20 fields)
    - `wvjobprogramphase.costvariancecalc` (w=10) → _Costvariance (computed)_
    - `wvjobprogramphase.durationvariancecalc` (w=10) → _Duration Variance (computed)_
    - `wvjobprogramphase.durationvariancecumcalc` (w=10) → _Duration Variance (cumulative) (computed)_
    - `wvjobprogramphase.durationtimelogtotalcalc` (w=10) → _Time Log Total (hr)_
    - `wvjobprogramphase.durationtimelogtotcumcalc` (w=10) → _Duration Timelogtot (cumulative) (computed)_
    - `wvjobprogramphase.durationproblemtimecalc` (w=10) → _Problem Time (hr)_
    - `wvjobprogramphase.durationproblemtimecumcalc` (w=10) → _Duration Problemtime (cumulative) (computed)_
    - `wvjobprogramphase.pctproblemtimecalc` (w=10) → _Problem Time (%)_
    - `wvjobprogramphase.durationnoprobtimecalc` (w=10) → _Duration Number Probtime (computed)_
    - `wvjobprogramphase.durationnoprobtimecumcalc` (w=10) → _Duration Number Probtime (cumulative) (computed)_
    - `wvjobprogramphase.tmdrillcalc` (w=10) → _Tmdrill (computed)_
    - `wvjobprogramphase.tmcirccalc` (w=10) → _Tmcirc (computed)_
    - `wvjobprogramphase.ropcalc` (w=10) → _ROP_
    - `wvjobprogramphase.tmrotatingcalc` (w=10) → _Tmrotating (computed)_
    - `wvjobprogramphase.roprotatingcalc` (w=10) → _Roprotating (computed)_
    - `wvjobprogramphase.percenttmrotatingcalc` (w=10) → _Percenttmrotating (computed)_
    - `wvjobprogramphase.tmslidingcalc` (w=10) → _Tmsliding (computed)_
    - `wvjobprogramphase.ropslidingcalc` (w=10) → _Ropsliding (computed)_
    - `wvjobprogramphase.percenttmslidingcalc` (w=10) → _Percenttmsliding (computed)_
    - `wvjobprogramphase.bitrevscalc` (w=10) → _Bitrevs (computed)_

### Schematic - Proposed vs Actual

- **HTML:** [Drilling/Drilling Summary/Schematic - Proposed vs Actual.html](Drilling/Drilling%20Summary/Schematic%20-%20Proposed%20vs%20Actual.html)
- **Paper:** letter · **margins** [25, 25, 25, 25] (1/100 in)
- **Master template:** template landscape.afr
- **Root table:** `None`
- **Captions:**
  - `Wellbore: <wvwellbore.des>`
- **Blocks:** 1

  - **& production\proposal with half ** — `wvwellbore` (1 fields)
    - `wvwellbore.idrec` (w=0) → _Record ID_

### Time Log Summary - Graph

- **HTML:** [Drilling/Drilling Summary/Time Log Summary - Graph.html](Drilling/Drilling%20Summary/Time%20Log%20Summary%20-%20Graph.html)
- **Paper:** letter · **margins** [25, 25, 25, 25] (1/100 in)
- **Master template:** template portrait header.afr
- **Root table:** `wvjob` · **filter:** wvjob / wvtyp / drill; wvjtlsumcode1calc / duration; wvjtlsumcode2calc / duration; wvjtlsumunschedtypcalc / duration
- **Captions:**
  - `<wvjtlsumcode1calc.fractiontotaltime>`
  - `AFE#:  <wvjob.afenumbercalc>`
- **Blocks:** 4

  - **Job** — `wvjob` (5 fields)
    - `wvjob.wvtyp` (w=15) → _Wvtyp_
    - `wvjob.jobtyp` (w=15) → _Jobtyp_
    - `wvjob.dttmstart` (w=15) → _Start Date/Time_
    - `wvjob.dttmend` (w=15) → _End Date/Time_
    - `wvjob.objective` (w=30) → _Objective_
  - **Jtlsumcode1Calc** — `wvjtlsumcode1calc` (1 fields)
    - `wvjtlsumcode1calc.duration` (w=0) → _Duration Ation_
  - **Jtlsumcode2Calc** — `wvjtlsumcode2calc` (1 fields)
    - `wvjtlsumcode2calc.duration` (w=0) → _Duration Ation_
  - **Jtlsumunschedtypcalc** — `wvjtlsumunschedtypcalc` (1 fields)
    - `wvjtlsumunschedtypcalc.duration` (w=0) → _Duration Ation_

### Time Log Summary

- **HTML:** [Drilling/Drilling Summary/Time Log Summary.html](Drilling/Drilling%20Summary/Time%20Log%20Summary.html)
- **Paper:** letter · **margins** [25, 25, 25, 25] (1/100 in)
- **Master template:** template portrait header.afr
- **Root table:** `wvjob` · **filter:** wvjob / wvtyp / drill
- **Captions:**
  - `AFE#:  <wvjob.afenumbercalc>`
- **Blocks:** 6

  - **Jtlsumcode1Calc** — `wvjtlsumcode1calc` (3 fields)
    - `wvjtlsumcode1calc.code1` (w=10) → _Code 1_
    - `wvjtlsumcode1calc.duration` (w=10) → _Duration Ation_
    - `wvjtlsumcode1calc.fractiontotaltime` (w=10) → _Fractiontotaltime_
  - **Jtlsumcode2Calc** — `wvjtlsumcode2calc` (3 fields)
    - `wvjtlsumcode2calc.code2` (w=10) → _Code 2_
    - `wvjtlsumcode2calc.duration` (w=10) → _Duration Ation_
    - `wvjtlsumcode2calc.fractiontotaltime` (w=10) → _Fractiontotaltime_
  - **Jtlsumcode3Calc** — `wvjtlsumcode3calc` (3 fields)
    - `wvjtlsumcode3calc.code3` (w=10) → _Code3_
    - `wvjtlsumcode3calc.duration` (w=10) → _Duration Ation_
    - `wvjtlsumcode3calc.fractiontotaltime` (w=10) → _Fractiontotaltime_
  - **Jtlsumunschedtypcalc** — `wvjtlsumunschedtypcalc` (3 fields)
    - `wvjtlsumunschedtypcalc.unschedtyp` (w=10) → _Unschedtyp_
    - `wvjtlsumunschedtypcalc.duration` (w=10) → _Duration Ation_
    - `wvjtlsumunschedtypcalc.fractiontotaltime` (w=10) → _Fractiontotaltime_
  - **Job** — `wvjob` (5 fields)
    - `wvjob.wvtyp` (w=15) → _Wvtyp_
    - `wvjob.jobtyp` (w=15) → _Jobtyp_
    - `wvjob.dttmstart` (w=15) → _Start Date/Time_
    - `wvjob.dttmend` (w=15) → _End Date/Time_
    - `wvjob.objective` (w=30) → _Objective_
  - **Jtlsumcalc** — `wvjtlsumcalc` (6 fields)
    - `wvjtlsumcalc.code1` (w=10) → _Code 1_
    - `wvjtlsumcalc.code2` (w=10) → _Code 2_
    - `wvjtlsumcalc.code3` (w=10) → _Code3_
    - `wvjtlsumcalc.unschedtyp` (w=10) → _Unschedtyp_
    - `wvjtlsumcalc.duration` (w=10) → _Duration Ation_
    - `wvjtlsumcalc.fractiontotaltime` (w=10) → _Fractiontotaltime_

## Failure Analysis

### Failure Details

- **HTML:** [Failure Analysis/Failure Details.html](Failure%20Analysis/Failure%20Details.html)
- **Paper:** letter · **margins** [12, 12, 31, 25] (1/100 in)
- **Master template:** template landscape header cw.afr
- **Root table:** `wvproblem` · **filter:** wvwellheader / wvproblem / Failure
- **Blocks:** 3

  - **Problem** — `wvproblem` (9 fields)
    - `wvproblem.dttmstart` (w=10) → _Start Date/Time_
    - `wvproblem.des` (w=10) → _Description_
    - `wvproblem.typ` (w=10) → _Type_
    - `wvproblem.cause` (w=10) → _Cause_
    - `wvproblem.idrecfaileditem` (w=18) → _Idrecfaileditem_
    - `wvproblem.priority` (w=10) → _Priority_
    - `wvproblem.status` (w=10) → _Status_
    - `wvproblem.estcost` (w=10) → _Estimate Cost_
    - `wvproblem.durequipinservice` (w=10) → _Duration Equipinservice_
  - **Component Details** — `wvproblemdetailcalc` (6 fields)
    - `wvproblemdetailcalc.szodnom` (w=10) → _Szodnom_
    - `wvproblemdetailcalc.make` (w=15) → _Make_
    - `wvproblemdetailcalc.model` (w=10) → _Model_
    - `wvproblemdetailcalc.sn` (w=10) → _Serial Number_
    - `wvproblemdetailcalc.depthtop` (w=10) → _Top Depth_
    - `wvproblemdetailcalc.depthbtm` (w=10) → _Bottom Depth_
  - **Problem Comment** — `wvproblemcomment` (5 fields)
    - `wvproblemcomment.dttmstart` (w=10) → _Start Date/Time_
    - `wvproblemcomment.typ1` (w=10) → _Typ1_
    - `wvproblemcomment.commentby` (w=10) → _Commentby_
    - `wvproblemcomment.com` (w=30) → _Comment_
    - `wvproblem.dttmstart` (w=0) → _Start Date/Time_

### Failure Summary

- **HTML:** [Failure Analysis/Failure Summary.html](Failure%20Analysis/Failure%20Summary.html)
- **Paper:** letter · **margins** [12, 12, 31, 25] (1/100 in)
- **Master template:** template landscape legal.afr
- **Root table:** `None`
- **Blocks:** 3

  - **Problem** — `wvproblem` (6 fields)
    - `wvproblem.dttmstart` (w=10) → _Start Date/Time_
    - `wvproblem.des` (w=10) → _Description_
    - `wvproblem.typ` (w=10) → _Type_
    - `wvproblem.cause` (w=10) → _Cause_
    - `wvproblem.idrecfaileditem` (w=20) → _Idrecfaileditem_
    - `wvproblem.estcost` (w=10) → _Estimate Cost_
  - **Type of Failure (Est Cost %)** — `wvproblem` (1 fields)
    - `wvproblem.estcost` (w=0) → _Estimate Cost_
  - **Cause of Failure (Est Cost %)** — `wvproblem` (1 fields)
    - `wvproblem.estcost` (w=0) → _Estimate Cost_

### Production & Failure History

- **HTML:** [Failure Analysis/Production & Failure History.html](Failure%20Analysis/Production%20%26%20Failure%20History.html)
- **Paper:** letter · **margins** [12, 12, 31, 25] (1/100 in)
- **Master template:** template landscape header cw.afr
- **Root table:** `wvzoneprodtypcalc` · **filter:** wvjob / jobtyp; wvjob / jobtyp; wvjob / jobtyp
- **Captions:**
  - `<wvjob.jobtyp>`
  - `<wvjob.jobtyp>`
  - `<wvjob.jobtyp>`
- **Blocks:** 12

  - **Activity T** — `wvjob` (1 fields)
    - `wvjob.dttmstart` (w=0) → _Start Date/Time_
  - **Zoneprodtypdatacalc** — `wvzoneprodtypdatacalc` (1 fields)
    - `wvzoneprodtypdatacalc.ratecondensate` (w=0) → _Ratecondensate_
  - **Zoneprodtypdatacalc** — `wvzoneprodtypdatacalc` (1 fields)
    - `wvzoneprodtypdatacalc.ratewater` (w=0) → _Ratewater_
  - **Zoneprodtypdatacalc** — `wvzoneprodtypdatacalc` (1 fields)
    - `wvzoneprodtypdatacalc.rateresgas` (w=0) → _Rateresgas_
  - **Rate Oil/Water/Cond** — `wvjob` (1 fields)
    - `wvjob.dttmstart` (w=0) → _Start Date/Time_
  - **Zoneprodtypdatacalc** — `wvzoneprodtypdatacalc` (1 fields)
    - `wvzoneprodtypdatacalc.volumecumcond` (w=0) → _Volumecumcond_
  - **Zoneprodtypdatacalc** — `wvzoneprodtypdatacalc` (1 fields)
    - `wvzoneprodtypdatacalc.volumecumwater` (w=0) → _Volumecumwater_
  - **Zoneprodtypdatacalc** — `wvzoneprodtypdatacalc` (1 fields)
    - `wvzoneprodtypdatacalc.volumecumresgas` (w=0) → _Volumecumresgas_
  - **Cum Vol Oil/Water/Cond** — `wvjob` (1 fields)
    - `wvjob.dttmstart` (w=0) → _Start Date/Time_
  - **Zoneprodtypdatacalc** — `wvzoneprodtypdatacalc` (1 fields)
    - `wvzoneprodtypdatacalc.ratiodurationcumdown` (w=0) → _Ratiodurationcumdown_
  - **Zoneprodtypdatacalc** — `wvzoneprodtypdatacalc` (1 fields)
    - `wvzoneprodtypdatacalc.ratiodurationdown` (w=0) → _Ratiodurationdown_
  - **End of Reporting Period** — `wvproblem` (5 fields)
    - `wvproblem.dttmstart` (w=10) → _Start Date/Time_
    - `wvproblem.dttmend` (w=10) → _End Date/Time_
    - `wvproblem.typ` (w=10) → _Type_
    - `wvproblem.cause` (w=10) → _Cause_
    - `wvproblem.idrecfaileditem` (w=25) → _Idrecfaileditem_

### Failure - Schematic

- **HTML:** [Failure Analysis/Failure - Schematic.html](Failure%20Analysis/Failure%20-%20Schematic.html)
- **Paper:** letter · **margins** [25, 25, 25, 25] (1/100 in)
- **Master template:** template landscape.afr
- **Root table:** `None`
- **Blocks:** 1

  - **& production\production failures** — `wvwellbore` (1 fields)
    - `wvwellbore.idrec` (w=0) → _Record ID_

### Failure - Time Tracks

- **HTML:** [Failure Analysis/Failure - Time Tracks.html](Failure%20Analysis/Failure%20-%20Time%20Tracks.html)
- **Paper:** letter · **margins** [25, 25, 25, 25] (1/100 in)
- **Master template:** template portrait.afr
- **Root table:** `wvwellbore`
- **Blocks:** 0


## Geology/Job Setup

### Approval Names and Status

- **HTML:** [Geology/Job Setup/Approval Names and Status.html](Geology/Job%20Setup/Approval%20Names%20and%20Status.html)
- **Paper:** letter · **margins** [25, 25, 25, 25] (1/100 in)
- **Master template:** template landscape header.afr
- **Root table:** `wvjobapproval`
- **Captions:**
  - `<wvjobapprovaldeliv.sysseq>`
- **Blocks:** 4

  - **Job** — `wvjob` (3 fields)
    - `wvjob.wvtyp` (w=10) → _Wvtyp_
    - `wvjob.jobtyp` (w=10) → _Jobtyp_
    - `wvjob.dttmstartplan` (w=10) → _Date/Time Startplan_
  - **Jobapproval** — `wvjobapproval` (4 fields)
    - `wvjobapproval.typ1` (w=10) → _Typ1_
    - `wvjobapproval.typ2` (w=10) → _Typ2_
    - `wvjobapproval.des` (w=10) → _Description_
    - `wvjobapproval.status` (w=10) → _Status_
  - **Jobapprovaldeliv** — `wvjobapprovaldeliv` (9 fields)
    - `wvjobapprovaldeliv.typ1` (w=20) → _Typ1_
    - `wvjobapprovaldeliv.typ2` (w=10) → _Typ2_
    - `wvjobapprovaldeliv.requiredby` (w=10) → _Requiredby_
    - `wvjobapprovaldeliv.assigntoname` (w=10) → _Assigntoname_
    - `wvjobapprovaldeliv.assigntodept` (w=10) → _Assigntodept_
    - `wvjobapprovaldeliv.dttmassigned` (w=10) → _Date/Time Assigned_
    - `wvjobapprovaldeliv.dttmrequired` (w=10) → _Date/Time Required_
    - `wvjobapprovaldeliv.dttmcomplete` (w=10) → _Date/Time Complete_
    - `wvjobapprovaldeliv.status` (w=10) → _Status_
  - **Jobapprovaldelivname** — `wvjobapprovaldelivname` (7 fields)
    - `wvjobapprovaldelivname.approvetyp` (w=10) → _Approvetyp_
    - `wvjobapprovaldelivname.approvebyname` (w=10) → _Approvebyname_
    - `wvjobapprovaldelivname.approvebytitle` (w=10) → _Approvebytitle_
    - `wvjobapprovaldelivname.approverole` (w=10) → _Approverole_
    - `wvjobapprovaldelivname.approverqd` (w=5) → _Approverqd_
    - `wvjobapprovaldelivname.approved` (w=5) → _Approved_
    - `wvjobapprovaldelivname.dttmapproved` (w=10) → _Date/Time Approved_

### Approval Process

- **HTML:** [Geology/Job Setup/Approval Process.html](Geology/Job%20Setup/Approval%20Process.html)
- **Paper:** letter · **margins** [25, 25, 25, 25] (1/100 in)
- **Master template:** template landscape header.afr
- **Root table:** `wvjobapproval`
- **Blocks:** 3

  - **Job** — `wvjob` (3 fields)
    - `wvjob.wvtyp` (w=10) → _Wvtyp_
    - `wvjob.jobtyp` (w=10) → _Jobtyp_
    - `wvjob.dttmstartplan` (w=10) → _Date/Time Startplan_
  - **Jobapproval** — `wvjobapproval` (4 fields)
    - `wvjobapproval.typ1` (w=10) → _Typ1_
    - `wvjobapproval.typ2` (w=10) → _Typ2_
    - `wvjobapproval.des` (w=10) → _Description_
    - `wvjobapproval.status` (w=10) → _Status_
  - **Jobapprovaldeliv** — `wvjobapprovaldeliv` (9 fields)
    - `wvjobapprovaldeliv.typ1` (w=10) → _Typ1_
    - `wvjobapprovaldeliv.typ2` (w=10) → _Typ2_
    - `wvjobapprovaldeliv.requiredby` (w=10) → _Requiredby_
    - `wvjobapprovaldeliv.assigntoname` (w=10) → _Assigntoname_
    - `wvjobapprovaldeliv.assigntodept` (w=10) → _Assigntodept_
    - `wvjobapprovaldeliv.dttmassigned` (w=10) → _Date/Time Assigned_
    - `wvjobapprovaldeliv.dttmrequired` (w=10) → _Date/Time Required_
    - `wvjobapprovaldeliv.dttmcomplete` (w=10) → _Date/Time Complete_
    - `wvjobapprovaldeliv.status` (w=10) → _Status_

### Geological Program

- **HTML:** [Geology/Job Setup/Geological Program.html](Geology/Job%20Setup/Geological%20Program.html)
- **Paper:** letter · **margins** [25, 25, 25, 25] (1/100 in)
- **Master template:** template portrait.afr
- **Root table:** `wvjob` · **filter:** wvjob / wvtyp / dril
- **Blocks:** 5

  - **Wellbore** — `wvwellbore` (4 fields)
    - `wvwellbore.des` (w=10) → _Description_
    - `wvwellbore.profiletyp` (w=10) → _Profiletyp_
    - `wvwellbore.idrecparent` (w=10) → _Idrecparent_
    - `wvwellbore.idrecdirsrvyprop` (w=10) → _Idrecdirsrvyprop_
  - **Wellboreformation** — `wvwellboreformation` (11 fields)
    - `wvwellboreformation.formname` (w=20) → _Formname_
    - `wvwellboreformation.deslithology` (w=15) → _Description Lithology_
    - `wvwellboreformation.elementtyp` (w=5) → _Elementtyp_
    - `wvwellboreformation.depthssprogtop` (w=9) → _Depth Ssprogtop_
    - `wvwellboreformation.depthtvdprogtopcalc` (w=9) → _Depth TVD Progtop (computed)_
    - `wvwellboreformation.depthssprogbtm` (w=9) → _Depth Ssprogbtm_
    - `wvwellboreformation.depthtvdprogbtmcalc` (w=9) → _Depth TVD Progbtm (computed)_
    - `wvwellboreformation.porepres` (w=5) → _Porepres_
    - `wvwellboreformation.fracpres` (w=5) → _Fracpres_
    - `wvwellboreformation.temp` (w=5) → _Temp_
    - `wvwellboreformation.h2sconc` (w=5) → _H2Sconc_
  - **Job** — `wvjob` (6 fields)
    - `wvjob.jobtyp` (w=10) → _Jobtyp_
    - `wvjob.targetform` (w=10) → _Target Formation_
    - `wvjob.targetdepth` (w=10) → _Target Depth_
    - `wvjob.afenumbercalc` (w=10) → _AFE Number_
    - `wvjob.dttmstartplan` (w=10) → _Date/Time Startplan_
    - `wvjob.objectivegeo` (w=50) → _Objectivegeo_
  - **Jobprogramgeosample** — `wvjobprogramgeosample` (8 fields)
    - `wvjobprogramgeosample.noteintervaltop` (w=5) → _Number Teintervaltop_
    - `wvjobprogramgeosample.depthtop` (w=5) → _Top Depth_
    - `wvjobprogramgeosample.noteintervalbtm` (w=5) → _Number Teintervalbtm_
    - `wvjobprogramgeosample.depthbtm` (w=5) → _Bottom Depth_
    - `wvjobprogramgeosample.idrecwellbore` (w=5) → _Idrecwellbore_
    - `wvjobprogramgeosample.requiredby` (w=5) → _Requiredby_
    - `wvjobprogramgeosample.sampledby` (w=5) → _Sampledby_
    - `wvjobprogramgeosample.com` (w=25) → _Comment_
  - **Jobcontact** — `wvjobcontact` (6 fields)
    - `wvjobcontact.company` (w=10) → _Company_
    - `wvjobcontact.contactname` (w=10) → _Contactname_
    - `wvjobcontact.title` (w=10) → _Title_
    - `wvjobcontact.phonemobile` (w=10) → _Phonemobile_
    - `wvjobcontact.email` (w=10) → _Email_
    - `wvjobcontact.note` (w=10) → _Note_

## Geology/General Input

### Cores - Bottomhole and Sidewall

- **HTML:** [Geology/General Input/Cores - Bottomhole and Sidewall.html](Geology/General%20Input/Cores%20-%20Bottomhole%20and%20Sidewall.html)
- **Paper:** letter · **margins** [12, 12, 31, 25] (1/100 in)
- **Master template:** template landscape header.afr
- **Root table:** `wvwellheader`
- **Blocks:** 3

  - **Core** — `wvcore` (12 fields)
    - `wvcore.dttm` (w=10) → _Dttm_
    - `wvcore.coreno` (w=5) → _Coreno_
    - `wvcore.typ` (w=10) → _Type_
    - `wvcore.depthtop` (w=10) → _Top Depth_
    - `wvcore.depthbtm` (w=10) → _Bottom Depth_
    - `wvcore.lenrecovered` (w=5) → _Lenrecovered_
    - `wvcore.pctrecovcalc` (w=5) → _% Recov (computed)_
    - `wvcore.szdiacore` (w=10) → _Szdiacore_
    - `wvcore.oriented` (w=5) → _Oriented_
    - `wvcore.contractor` (w=10) → _Contractor_
    - `wvcore.formationcalc` (w=10) → _Formation (computed)_
    - `wvcore.com` (w=50) → _Comment_
  - **Coresidewall** — `wvcoresidewall` (12 fields)
    - `wvcoresidewall.dttm` (w=10) → _Dttm_
    - `wvcoresidewall.runno` (w=10) → _Runno_
    - `wvcoresidewall.typ` (w=10) → _Type_
    - `wvcoresidewall.depthtopcalc` (w=10) → _Top Depth (computed)_
    - `wvcoresidewall.depthbtmcalc` (w=10) → _Bottom Depth (computed)_
    - `wvcoresidewall.contractor` (w=10) → _Contractor_
    - `wvcoresidewall.samplesplan` (w=10) → _Samplesplan_
    - `wvcoresidewall.samplesrecover` (w=10) → _Samplesrecover_
    - `wvcoresidewall.bulletsfire` (w=10) → _Bulletsfire_
    - `wvcoresidewall.bulletsmisfire` (w=10) → _Bulletsmisfire_
    - `wvcoresidewall.samplesempty` (w=10) → _Samplesempty_
    - `wvcoresidewall.sampleslostinhole` (w=10) → _Sampleslostinhole_
  - **Coresidewallsample** — `wvcoresidewallsample` (5 fields)
    - `wvcoresidewallsample.depthsample` (w=10) → _Depth Sample_
    - `wvcoresidewallsample.depthtvdsamplecalc` (w=10) → _Depth TVD Sample (computed)_
    - `wvcoresidewallsample.lengthsample` (w=10) → _Lengthsample_
    - `wvcoresidewallsample.result` (w=10) → _Result_
    - `wvcoresidewallsample.formationcalc` (w=10) → _Formation (computed)_

### Daily Geological

- **HTML:** [Geology/General Input/Daily Geological.html](Geology/General%20Input/Daily%20Geological.html)
- **Paper:** letter · **margins** [25, 25, 25, 25] (1/100 in)
- **Master template:** template portrait.afr
- **Root table:** `wvjobreport` · **filter:** wvjob / wvtyp / drill; wvjobdrillstring / idrecparent; wvjobreport / idrecparent; wvjobdrillstring / dttmincalc; wvjobreport / dttmend; wvjobdrillstring / dttmoutcalc; wvjobreport / dttmstart; wvgeoevalsampledes / depthtop; wvjobreport / depthenddpcalc; wvgeoevalsampledes / depthbtm; wvjobreport / depthstartdpcalc; wvgeoevallith / depthtop; wvjobreport / depthenddpcalc; wvgeoevallith / depthbtm; wvjobreport / depthstartdpcalc; wvgeoevalshowoil / depthtop; wvjobreport / depthenddpcalc; wvgeoevalshowoil / depthbtm; wvjobreport / depthstartdpcalc; wvgeoevalshowgas / depthtop; wvjobreport / depthenddpcalc; wvgeoevalshowgas / depthbtm; wvjobreport / depthstartdpcalc; wvlog / dttm; wvjobreport / dttmend; wvlog / dttm; wvjobreport / dttmstart
- **Captions:**
  - `Date:   <wvjobreport.dttmend>, Report #:   <wvjobreport.reportnocalc>, DFS:   <wvjobreport.daysfromspudcalc>`
  - `Depth Start: <wvjobreport.depthstartdpcalc> - Depth End:  <wvjobreport.depthenddpcalc>`
- **Blocks:** 12

  - **Daily Summary** — `wvwellheader` (4 fields)
    - `wvwellheader.wellida` (w=10) → _Well ID_
    - `wvwellheader.welllicenseno` (w=10) → _Welllicenseno_
    - `wvwellheader.welllicensee` (w=10) → _Welllicensee_
    - `wvwellheader.fieldname` (w=10) → _Field_
  - **Daily Summary** — `wvjobreport` (17 fields)
    - `wvjob.afenumbercalc` (w=20) → _AFE Number_
    - `wvjob.wvtyp` (w=20) → _Wvtyp_
    - `wvjobreport.costtotalcalc` (w=10) → _Daily Cost Total_
    - `wvjobreport.costtodatecalc` (w=10) → _Cost To Date_
    - `wvjob.afesupamtcalc` (w=10) → _Afesupamt (computed)_
    - `wvjob.variancefieldcalc` (w=10) → _Variancefield (computed)_
    - `wvjobreport.gasbackgroundavg` (w=10) → _Gasbackgroundavg_
    - `wvjobreport.gasbackgroundmax` (w=10) → _Gasbackgroundmax_
    - `wvjobreport.gasconnectionavg` (w=10) → _Gasconnectionavg_
    - `wvjobreport.gasconnectionmax` (w=10) → _Gasconnectionmax_
    - `wvjobreport.gastripavg` (w=10) → _Gastripavg_
    - `wvjobreport.gastripmax` (w=10) → _Gastripmax_
    - `wvjobreport.gasdrillavg` (w=10) → _Gasdrillavg_
    - `wvjobreport.gasdrillmax` (w=10) → _Gasdrillmax_
    - `wvjobreport.rpttmactgeo` (w=30) → _Rpttmactgeo_
    - `wvjobreport.plannextrptgeo` (w=30) → _Plannextrptgeo_
    - `wvjobreport.summarygeo` (w=30) → _Summarygeo_
  - **Time Log** — `wvjobreporttimelog` (7 fields)
    - `wvjobreporttimelog.dttmstartcalc` (w=6) → _Start Date/Time (computed)_
    - `wvjobreporttimelog.dttmendcalc` (w=6) → _End Date/Time (computed)_
    - `wvjobreporttimelog.duration` (w=6) → _Duration Ation_
    - `wvjobreporttimelog.sumofdurationcalc` (w=6) → _Sumofduration (computed)_
    - `wvjobreporttimelog.code1` (w=6) → _Code 1_
    - `wvjobreporttimelog.code2` (w=12) → _Code 2_
    - `wvjobreporttimelog.com` (w=40) → _Comment_
  - **Mud Check** — `wvjobreportmudchk` (8 fields)
    - `wvjobreportmudchk.mudtyp` (w=20) → _Mudtyp_
    - `wvjobreportmudchk.dttm` (w=10) → _Dttm_
    - `wvjobreportmudchk.depth` (w=10) → _Depth_
    - `wvjobreportmudchk.density` (w=10) → _Density_
    - `wvjobreportmudchk.plasticvis` (w=10) → _Plasticvis_
    - `wvjobreportmudchk.yieldptcalc` (w=10) → _Yieldpt (computed)_
    - `wvjobreportmudchk.filtrate` (w=10) → _Filtrate_
    - `wvjobreportmudchk.ph` (w=10) → _pH_
  - **Drill String / BHA** — `wvjobdrillstring` (5 fields)
    - `wvjobdrillstring.bitno` (w=4) → _Bitno_
    - `wvjobdrillstring.idrecbit` (w=25) → _Idrecbit_
    - `wvjobdrillstring.des` (w=15) → _Description_
    - `wvjobdrillstring.ropcalc` (w=6) → _ROP_
    - `wvjobdrillstring.stringno` (w=7) → _Stringno_
  - **Drilling Parameters** — `wvjobdrillstringdrillparam` (8 fields)
    - `wvjobdrillstringdrillparam.depthend` (w=10) → _Depth End_
    - `wvjobdrillstringdrillparam.tvdendcalc` (w=10) → _Tvdend (computed)_
    - `wvjobdrillstringdrillparam.depthdrilledcumcalc` (w=10) → _Depth Drilled (cumulative) (computed)_
    - `wvjobdrillstringdrillparam.tmdrillcumcalc` (w=10) → _Tmdrill (cumulative) (computed)_
    - `wvjobdrillstringdrillparam.ropcalc` (w=10) → _ROP_
    - `wvjobdrillstringdrillparam.rpmstring` (w=10) → _String RPM_
    - `wvjobdrillstringdrillparam.wob` (w=10) → _Weight On Bit_
    - `wvjobdrillstringdrillparam.idrecwellbore` (w=20) → _Idrecwellbore_
  - **All Formations** — `wvwellboreformation` (7 fields)
    - `wvwellboreformation.formname` (w=30) → _Formname_
    - `wvwellboreformation.elementtyp` (w=10) → _Elementtyp_
    - `wvwellboreformation.deslithology` (w=20) → _Description Lithology_
    - `wvwellboreformation.depthssprogtop` (w=10) → _Depth Ssprogtop_
    - `wvwellboreformation.depthtvdprogtopcalc` (w=10) → _Depth TVD Progtop (computed)_
    - `wvwellboreformation.depthdrillingtop` (w=10) → _Depth Drillingtop_
    - `wvwellboreformation.depthtvddrilltopcalc` (w=10) → _Depth TVD Drilltop (computed)_
  - **Geoevalsampledes** — `wvgeoevalsampledes` (5 fields)
    - `wvgeoevalsampledes.depthtop` (w=10) → _Top Depth_
    - `wvgeoevalsampledes.depthbtm` (w=10) → _Bottom Depth_
    - `wvgeoevalsampledes.volpercentca` (w=10) → _Volpercentca_
    - `wvgeoevalsampledes.volpercentmg` (w=10) → _Volpercentmg_
    - `wvgeoevalsampledes.com` (w=40) → _Comment_
  - **Geoevallith** — `wvgeoevallith` (6 fields)
    - `wvgeoevallith.depthtop` (w=10) → _Top Depth_
    - `wvgeoevallith.depthbtm` (w=10) → _Bottom Depth_
    - `wvgeoevallith.des` (w=20) → _Description_
    - `wvgeoevallith.volpercent` (w=10) → _Volpercent_
    - `wvgeoevallith.typ` (w=10) → _Type_
    - `wvgeoevallith.codetyp` (w=10) → _Codetyp_
  - **Geoevalshowoil** — `wvgeoevalshowoil` (5 fields)
    - `wvgeoevalshowoil.depthtop` (w=10) → _Top Depth_
    - `wvgeoevalshowoil.depthbtm` (w=10) → _Bottom Depth_
    - `wvgeoevalshowoil.showquality` (w=10) → _Showquality_
    - `wvgeoevalshowoil.showorigin` (w=10) → _Showorigin_
    - `wvgeoevalshowoil.showtyp` (w=10) → _Showtyp_
  - **Geoevalshowgas** — `wvgeoevalshowgas` (6 fields)
    - `wvgeoevalshowgas.depthtop` (w=10) → _Top Depth_
    - `wvgeoevalshowgas.depthbtm` (w=10) → _Bottom Depth_
    - `wvgeoevalshowgas.showtyp` (w=10) → _Showtyp_
    - `wvgeoevalshowgas.totalgasavg` (w=10) → _Total Algasavg_
    - `wvgeoevalshowgas.totalgasmin` (w=10) → _Total Algasmin_
    - `wvgeoevalshowgas.totalgasmax` (w=10) → _Total Algasmax_
  - **Log** — `wvlog` (6 fields)
    - `wvlog.dttm` (w=5) → _Dttm_
    - `wvlog.runno` (w=5) → _Runno_
    - `wvlog.typ` (w=10) → _Type_
    - `wvlog.depthtop` (w=10) → _Top Depth_
    - `wvlog.depthbtm` (w=10) → _Bottom Depth_
    - `wvlog.contractor` (w=20) → _Contractor_

### Detailed Geology

- **HTML:** [Geology/General Input/Detailed Geology.html](Geology/General%20Input/Detailed%20Geology.html)
- **Paper:** letter · **margins** [12, 12, 31, 25] (1/100 in)
- **Master template:** template landscape legal.afr
- **Root table:** `wvjob`
- **Captions:**
  - `Formation Name:   <wvwellboreformation.formname>`
- **Blocks:** 2

  - **Wellbore** — `wvwellbore` (7 fields)
    - `wvwellbore.des` (w=10) → _Description_
    - `wvwellbore.profiletyp` (w=10) → _Profiletyp_
    - `wvwellbore.idrecparent` (w=10) → _Idrecparent_
    - `wvwellbore.depthstart` (w=10) → _Depth Start_
    - `wvwellbore.kickoffdepth` (w=10) → _Kickoffdepth_
    - `wvwellbore.idrecdirsrvyactual` (w=10) → _Idrecdirsrvyactual_
    - `wvwellbore.idrecdirsrvyprop` (w=10) → _Idrecdirsrvyprop_
  - **Wellboreformation** — `wvwellboreformation` (17 fields)
    - `wvwellboreformation.formname` (w=15) → _Formname_
    - `wvwellboreformation.elementtyp` (w=10) → _Elementtyp_
    - `wvwellboreformation.depthssprogtop` (w=10) → _Depth Ssprogtop_
    - `wvwellboreformation.depthssprogbtm` (w=10) → _Depth Ssprogbtm_
    - `wvwellboreformation.depthtvdprogtopcalc` (w=10) → _Depth TVD Progtop (computed)_
    - `wvwellboreformation.depthtvdprogbtmcalc` (w=10) → _Depth TVD Progbtm (computed)_
    - `wvwellboreformation.depthdrillingtop` (w=10) → _Depth Drillingtop_
    - `wvwellboreformation.depthdrillingbtm` (w=10) → _Depth Drillingbtm_
    - `wvwellboreformation.depthtvddrilltopcalc` (w=10) → _Depth TVD Drilltop (computed)_
    - `wvwellboreformation.depthtvddrillbtmcalc` (w=10) → _Depth TVD Drillbtm (computed)_
    - `wvwellboreformation.depthdrillingsource` (w=10) → _Depth Drillingsource_
    - `wvwellboreformation.depthfinaltop` (w=10) → _Depth Finaltop_
    - `wvwellboreformation.depthfinalbtm` (w=10) → _Depth Finalbtm_
    - `wvwellboreformation.depthtvdfinaltopcalc` (w=10) → _Depth TVD Finaltop (computed)_
    - `wvwellboreformation.depthtvdfinalbtmcalc` (w=10) → _Depth TVD Finalbtm (computed)_
    - `wvwellboreformation.depthfinalsource` (w=10) → _Depth Finalsource_
    - `wvwellboreformation.ropcalc` (w=7) → _ROP_

### Evaluation

- **HTML:** [Geology/General Input/Evaluation.html](Geology/General%20Input/Evaluation.html)
- **Paper:** letter · **margins** [12, 12, 31, 25] (1/100 in)
- **Master template:** template landscape header.afr
- **Root table:** `wvwellheader`
- **Blocks:** 1

  - **Geoeval** — `wvgeoeval` (5 fields)
    - `wvgeoeval.evaltyp` (w=10) → _Evaltyp_
    - `wvgeoeval.geologistname` (w=10) → _Geologistname_
    - `wvgeoeval.geologistcompany` (w=10) → _Geologistcompany_
    - `wvgeoeval.idrecwellbore` (w=10) → _Idrecwellbore_
    - `wvgeoeval.com` (w=10) → _Comment_

### Formation Fluids

- **HTML:** [Geology/General Input/Formation Fluids.html](Geology/General%20Input/Formation%20Fluids.html)
- **Paper:** letter · **margins** [12, 12, 31, 25] (1/100 in)
- **Master template:** template landscape header.afr
- **Root table:** `wvgeoeval`
- **Blocks:** 2

  - **Geoeval** — `wvgeoeval` (5 fields)
    - `wvgeoeval.evaltyp` (w=10) → _Evaltyp_
    - `wvgeoeval.geologistname` (w=10) → _Geologistname_
    - `wvgeoeval.geologistcompany` (w=10) → _Geologistcompany_
    - `wvgeoeval.idrecwellbore` (w=10) → _Idrecwellbore_
    - `wvgeoeval.com` (w=10) → _Comment_
  - **Geoevalfluids** — `wvgeoevalfluids` (9 fields)
    - `wvgeoevalfluids.depthtop` (w=10) → _Top Depth_
    - `wvgeoevalfluids.depthtvdtopcalc` (w=10) → _Depth TVD Top (computed)_
    - `wvgeoevalfluids.depthbtm` (w=10) → _Bottom Depth_
    - `wvgeoevalfluids.depthtvdbtmcalc` (w=10) → _Depth TVD Btm (computed)_
    - `wvgeoevalfluids.dttm` (w=10) → _Dttm_
    - `wvgeoevalfluids.fluidname` (w=10) → _Fluidname_
    - `wvgeoevalfluids.fluidtyp` (w=10) → _Fluidtyp_
    - `wvgeoevalfluids.formationcalc` (w=10) → _Formation (computed)_
    - `wvgeoevalfluids.com` (w=25) → _Comment_

### Formation Performance

- **HTML:** [Geology/General Input/Formation Performance.html](Geology/General%20Input/Formation%20Performance.html)
- **Paper:** letter · **margins** [25, 25, 25, 25] (1/100 in)
- **Master template:** template portrait.afr
- **Root table:** `None`
- **Blocks:** 5

  - **Wellbore** — `wvwellbore` (6 fields)
    - `wvwellheader.wellname` (w=30) → _Well Name_
    - `wvwellheader.elvorigkb` (w=7) → _Elvorigkb_
    - `wvwellheader.elvground` (w=7) → _Elvground_
    - `wvwellbore.des` (w=12) → _Description_
    - `wvwellbore.idrecparent` (w=15) → _Idrecparent_
    - `wvwellbore.idrecdirsrvyactual` (w=30) → _Idrecdirsrvyactual_
  - **Wellboreformation** — `wvwellboreformation` (10 fields)
    - `wvwellboreformation.formname` (w=20) → _Formname_
    - `wvwellboreformation.layername` (w=5) → _Layername_
    - `wvwellboreformation.depthdrillingtop` (w=9) → _Depth Drillingtop_
    - `wvwellboreformation.depthdrillingbtm` (w=9) → _Depth Drillingbtm_
    - `wvwellboreformation.depthfinaltop` (w=9) → _Depth Finaltop_
    - `wvwellboreformation.depthfinalbtm` (w=9) → _Depth Finalbtm_
    - `wvwellboreformation.ropcalc` (w=6) → _ROP_
    - `wvwellboreformation.fracpres` (w=5) → _Fracpres_
    - `wvwellboreformation.porepres` (w=5) → _Porepres_
    - `wvwellboreformation.temp` (w=5) → _Temp_
  - **Wellboreformation** — `wvwellboreformation` (1 fields)
    - `wvwellboreformation.depthdrillingtop` (w=0) → _Depth Drillingtop_
  - **Drilling Parameters** — `wvjobdrillstringdrillparam` (1 fields)
    - `wvjobdrillstringdrillparam.depthstart` (w=0) → _Depth Start_
  - **Drilling Parameters** — `wvjobdrillstringdrillparam` (5 fields)
    - `wvjobdrillstringdrillparam.depthstart` (w=9) → _Depth Start_
    - `wvjobdrillstringdrillparam.depthend` (w=9) → _Depth End_
    - `wvjobdrillstringdrillparam.depthdrilledcalc` (w=9) → _Depth Drilled (computed)_
    - `wvjobdrillstringdrillparam.tmdrill` (w=6) → _Tmdrill_
    - `wvjobdrillstringdrillparam.ropcalc` (w=6) → _ROP_

### Gas Shows

- **HTML:** [Geology/General Input/Gas Shows.html](Geology/General%20Input/Gas%20Shows.html)
- **Paper:** letter · **margins** [12, 12, 31, 25] (1/100 in)
- **Master template:** template landscape header.afr
- **Root table:** `wvgeoeval`
- **Blocks:** 2

  - **Geoeval** — `wvgeoeval` (5 fields)
    - `wvgeoeval.evaltyp` (w=10) → _Evaltyp_
    - `wvgeoeval.geologistname` (w=10) → _Geologistname_
    - `wvgeoeval.geologistcompany` (w=10) → _Geologistcompany_
    - `wvgeoeval.idrecwellbore` (w=10) → _Idrecwellbore_
    - `wvgeoeval.com` (w=10) → _Comment_
  - **Geoevalshowgas** — `wvgeoevalshowgas` (26 fields)
    - `wvgeoevalshowgas.depthtop` (w=10) → _Top Depth_
    - `wvgeoevalshowgas.depthtvdtopcalc` (w=10) → _Depth TVD Top (computed)_
    - `wvgeoevalshowgas.depthbtm` (w=10) → _Bottom Depth_
    - `wvgeoevalshowgas.depthtvdbtmcalc` (w=10) → _Depth TVD Btm (computed)_
    - `wvgeoevalshowgas.showtyp` (w=10) → _Showtyp_
    - `wvgeoevalshowgas.dttmreport` (w=10) → _Date/Time Report_
    - `wvgeoevalshowgas.dttmsample` (w=10) → _Date/Time Sample_
    - `wvgeoevalshowgas.totalgasavg` (w=10) → _Total Algasavg_
    - `wvgeoevalshowgas.chromatographcycletime` (w=10) → _Chromatographcycletime_
    - `wvgeoevalshowgas.chromatographgasunit` (w=10) → _Chromatographgasunit_
    - `wvgeoevalshowgas.chromatographintrpttime` (w=10) → _Chromatographintrpttime_
    - `wvgeoevalshowgas.chromatographtyp` (w=10) → _Chromatographtyp_
    - `wvgeoevalshowgas.gastraptyp` (w=10) → _Gastraptyp_
    - `wvgeoevalshowgas.c1avg` (w=10) → _C1Avg_
    - `wvgeoevalshowgas.c2avg` (w=10) → _C2Avg_
    - `wvgeoevalshowgas.c3avg` (w=10) → _C3Avg_
    - `wvgeoevalshowgas.nc4avg` (w=10) → _Nc4Avg_
    - `wvgeoevalshowgas.ic4avg` (w=10) → _Ic4Avg_
    - `wvgeoevalshowgas.nc5avg` (w=10) → _Nc5Avg_
    - `wvgeoevalshowgas.ic5avg` (w=10) → _Ic5Avg_
    - `wvgeoevalshowgas.ec5avg` (w=10) → _Ec5Avg_
    - `wvgeoevalshowgas.nc6avg` (w=10) → _Nc6Avg_
    - `wvgeoevalshowgas.ic6avg` (w=10) → _Ic6Avg_
    - `wvgeoevalshowgas.h2savg` (w=10) → _H2Savg_
    - `wvgeoevalshowgas.co2avg` (w=10) → _Co2Avg_
    - `wvgeoevalshowgas.acetyleneavg` (w=10) → _Acetyleneavg_

### Grain Size

- **HTML:** [Geology/General Input/Grain Size.html](Geology/General%20Input/Grain%20Size.html)
- **Paper:** letter · **margins** [25, 25, 25, 25] (1/100 in)
- **Master template:** template portrait header.afr
- **Root table:** `wvgeoeval`
- **Blocks:** 2

  - **Geoeval** — `wvgeoeval` (5 fields)
    - `wvgeoeval.evaltyp` (w=10) → _Evaltyp_
    - `wvgeoeval.geologistname` (w=10) → _Geologistname_
    - `wvgeoeval.geologistcompany` (w=10) → _Geologistcompany_
    - `wvgeoeval.idrecwellbore` (w=10) → _Idrecwellbore_
    - `wvgeoeval.com` (w=10) → _Comment_
  - **Geoevalgrainsz** — `wvgeoevalgrainsz` (7 fields)
    - `wvgeoevalgrainsz.depthtop` (w=10) → _Top Depth_
    - `wvgeoevalgrainsz.depthtvdtopcalc` (w=10) → _Depth TVD Top (computed)_
    - `wvgeoevalgrainsz.depthbtm` (w=10) → _Bottom Depth_
    - `wvgeoevalgrainsz.depthtvdbtmcalc` (w=10) → _Depth TVD Btm (computed)_
    - `wvgeoevalgrainsz.grainsz` (w=10) → _Grainsz_
    - `wvgeoevalgrainsz.distribution` (w=10) → _Distribution_
    - `wvgeoevalgrainsz.grainszcode` (w=10) → _Grainszcode_

### Lithology

- **HTML:** [Geology/General Input/Lithology.html](Geology/General%20Input/Lithology.html)
- **Paper:** letter · **margins** [25, 25, 25, 25] (1/100 in)
- **Master template:** template portrait header.afr
- **Root table:** `wvwellheader`
- **Blocks:** 2

  - **Geoeval** — `wvgeoeval` (6 fields)
    - `wvgeoeval.dttm` (w=10) → _Dttm_
    - `wvgeoeval.evaltyp` (w=10) → _Evaltyp_
    - `wvgeoeval.geologistname` (w=10) → _Geologistname_
    - `wvgeoeval.geologistcompany` (w=10) → _Geologistcompany_
    - `wvgeoeval.idrecwellbore` (w=10) → _Idrecwellbore_
    - `wvgeoeval.com` (w=50) → _Comment_
  - **Geoevallith** — `wvgeoevallith` (32 fields)
    - `wvgeoevallith.des` (w=10) → _Description_
    - `wvgeoevallith.depthtop` (w=10) → _Top Depth_
    - `wvgeoevallith.depthtvdtopcalc` (w=10) → _Depth TVD Top (computed)_
    - `wvgeoevallith.depthbtm` (w=10) → _Bottom Depth_
    - `wvgeoevallith.depthtvdbtmcalc` (w=10) → _Depth TVD Btm (computed)_
    - `wvgeoevallith.formationcalc` (w=10) → _Formation (computed)_
    - `wvgeoevallith.formationlayercalc` (w=10) → _Formationlayer (computed)_
    - `wvgeoevallith.volpercent` (w=10) → _Volpercent_
    - `wvgeoevallith.typ` (w=10) → _Type_
    - `wvgeoevallith.codetyp` (w=10) → _Codetyp_
    - `wvgeoevallith.iconname` (w=10) → _Iconname_
    - `wvgeoevallith.refno` (w=10) → _Refno_
    - `wvgeoevallith.com` (w=20) → _Comment_
    - `wvgeoevallith.class` (w=10) → _Class_
    - `wvgeoevallith.dunhamclass` (w=10) → _Dunhamclass_
    - `wvgeoevallith.color` (w=10) → _Color_
    - `wvgeoevallith.texture` (w=10) → _Texture_
    - `wvgeoevallith.hardness` (w=10) → _Hardness_
    - `wvgeoevallith.graintyp` (w=10) → _Graintyp_
    - `wvgeoevallith.grainsizenote` (w=10) → _Grainsizenote_
    - `wvgeoevallith.roundness` (w=10) → _Roundness_
    - `wvgeoevallith.sorting` (w=10) → _Sorting_
    - `wvgeoevallith.matrixcement` (w=10) → _Matrixcement_
    - `wvgeoevallith.porositytyp` (w=10) → _Porositytyp_
    - `wvgeoevallith.porosity` (w=10) → _Porosity_
    - `wvgeoevallith.volpercentca` (w=10) → _Volpercentca_
    - `wvgeoevallith.volpercentmg` (w=10) → _Volpercentmg_
    - `wvgeoevallith.permcat` (w=10) → _Permcat_
    - `wvgeoevallith.permhzntl` (w=10) → _Permhzntl_
    - `wvgeoevallith.permvert` (w=10) → _Permvert_
    - `wvgeoevallith.permnote` (w=20) → _Permnote_
    - `wvgeoevallith.shaledes` (w=20) → _Shaledes_

### Logs

- **HTML:** [Geology/General Input/Logs.html](Geology/General%20Input/Logs.html)
- **Paper:** letter · **margins** [25, 25, 25, 25] (1/100 in)
- **Master template:** template portrait header.afr
- **Root table:** `None`
- **Blocks:** 1

  - **Log** — `wvlog` (6 fields)
    - `wvlog.dttm` (w=10) → _Dttm_
    - `wvlog.typ` (w=15) → _Type_
    - `wvlog.depthtop` (w=9) → _Top Depth_
    - `wvlog.depthbtm` (w=9) → _Bottom Depth_
    - `wvlog.contractor` (w=30) → _Contractor_
    - `wvlog.com` (w=30) → _Comment_

### Oil Shows

- **HTML:** [Geology/General Input/Oil Shows.html](Geology/General%20Input/Oil%20Shows.html)
- **Paper:** letter · **margins** [25, 25, 25, 25] (1/100 in)
- **Master template:** template portrait header.afr
- **Root table:** `wvgeoeval`
- **Blocks:** 2

  - **Geoeval** — `wvgeoeval` (6 fields)
    - `wvgeoeval.dttm` (w=10) → _Dttm_
    - `wvgeoeval.evaltyp` (w=10) → _Evaltyp_
    - `wvgeoeval.geologistname` (w=10) → _Geologistname_
    - `wvgeoeval.geologistcompany` (w=10) → _Geologistcompany_
    - `wvgeoeval.idrecwellbore` (w=10) → _Idrecwellbore_
    - `wvgeoeval.com` (w=50) → _Comment_
  - **Geoevalshowoil** — `wvgeoevalshowoil` (36 fields)
    - `wvgeoevalshowoil.depthtop` (w=10) → _Top Depth_
    - `wvgeoevalshowoil.depthtvdtopcalc` (w=10) → _Depth TVD Top (computed)_
    - `wvgeoevalshowoil.depthbtm` (w=10) → _Bottom Depth_
    - `wvgeoevalshowoil.depthtvdbtmcalc` (w=10) → _Depth TVD Btm (computed)_
    - `wvgeoevalshowoil.formationcalc` (w=10) → _Formation (computed)_
    - `wvgeoevalshowoil.formationlayercalc` (w=10) → _Formationlayer (computed)_
    - `wvgeoevalshowoil.dttm` (w=10) → _Dttm_
    - `wvgeoevalshowoil.showquality` (w=10) → _Showquality_
    - `wvgeoevalshowoil.showorigin` (w=10) → _Showorigin_
    - `wvgeoevalshowoil.showtyp` (w=10) → _Showtyp_
    - `wvgeoevalshowoil.iconname` (w=10) → _Iconname_
    - `wvgeoevalshowoil.refno` (w=10) → _Refno_
    - `wvgeoevalshowoil.visiblestaincolor` (w=10) → _Visiblestaincolor_
    - `wvgeoevalshowoil.visiblestaindist` (w=10) → _Visiblestaindist_
    - `wvgeoevalshowoil.visiblestainpercent` (w=10) → _Visiblestainpercent_
    - `wvgeoevalshowoil.visiblestaindegree` (w=10) → _Visiblestaindegree_
    - `wvgeoevalshowoil.residuecolor` (w=10) → _Residuecolor_
    - `wvgeoevalshowoil.odor` (w=5) → _Odor_
    - `wvgeoevalshowoil.densityqft` (w=5) → _Densityqft_
    - `wvgeoevalshowoil.cutcolor` (w=10) → _Cutcolor_
    - `wvgeoevalshowoil.cutspeed` (w=10) → _Cutspeed_
    - `wvgeoevalshowoil.cutstrength` (w=10) → _Cutstrength_
    - `wvgeoevalshowoil.cutformulation` (w=10) → _Cutformulation_
    - `wvgeoevalshowoil.cutlevel` (w=10) → _Cutlevel_
    - `wvgeoevalshowoil.cutfluorcolor` (w=10) → _Cutfluorcolor_
    - `wvgeoevalshowoil.cutfluorspeed` (w=10) → _Cutfluorspeed_
    - `wvgeoevalshowoil.cutfluorstrength` (w=10) → _Cutfluorstrength_
    - `wvgeoevalshowoil.cutfluorqft` (w=10) → _Cutfluorqft_
    - `wvgeoevalshowoil.cutfluorform` (w=10) → _Cutfluorform_
    - `wvgeoevalshowoil.cutfluorlevel` (w=10) → _Cutfluorlevel_
    - `wvgeoevalshowoil.naturalfluorcolor` (w=10) → _Naturalfluorcolor_
    - `wvgeoevalshowoil.naturalfluorpercent` (w=10) → _Naturalfluorpercent_
    - `wvgeoevalshowoil.naturalfluorlevel` (w=10) → _Naturalfluorlevel_
    - `wvgeoevalshowoil.naturalfluorqft` (w=10) → _Naturalfluorqft_
    - `wvgeoevalshowoil.naturalfluordes` (w=10) → _Naturalfluordes_
    - `wvgeoevalshowoil.naturalfluordist` (w=10) → _Naturalfluordist_

### Porosity

- **HTML:** [Geology/General Input/Porosity.html](Geology/General%20Input/Porosity.html)
- **Paper:** letter · **margins** [25, 25, 25, 25] (1/100 in)
- **Master template:** template landscape header.afr
- **Root table:** `wvgeoeval`
- **Blocks:** 2

  - **Geoeval** — `wvgeoeval` (6 fields)
    - `wvgeoeval.dttm` (w=10) → _Dttm_
    - `wvgeoeval.evaltyp` (w=10) → _Evaltyp_
    - `wvgeoeval.geologistname` (w=10) → _Geologistname_
    - `wvgeoeval.geologistcompany` (w=10) → _Geologistcompany_
    - `wvgeoeval.idrecwellbore` (w=10) → _Idrecwellbore_
    - `wvgeoeval.com` (w=50) → _Comment_
  - **Geoevalporosity** — `wvgeoevalporosity` (10 fields)
    - `wvgeoevalporosity.depthtop` (w=10) → _Top Depth_
    - `wvgeoevalporosity.depthtvdtopcalc` (w=10) → _Depth TVD Top (computed)_
    - `wvgeoevalporosity.depthbtm` (w=10) → _Bottom Depth_
    - `wvgeoevalporosity.depthtvdbtmcalc` (w=10) → _Depth TVD Btm (computed)_
    - `wvgeoevalporosity.porosity` (w=10) → _Porosity_
    - `wvgeoevalporosity.porositytyp` (w=10) → _Porositytyp_
    - `wvgeoevalporosity.porositycode` (w=10) → _Porositycode_
    - `wvgeoevalporosity.formationcalc` (w=10) → _Formation (computed)_
    - `wvgeoevalporosity.formationlayercalc` (w=10) → _Formationlayer (computed)_
    - `wvgeoevalporosity.note` (w=25) → _Note_

### Qualifiers

- **HTML:** [Geology/General Input/Qualifiers.html](Geology/General%20Input/Qualifiers.html)
- **Paper:** letter · **margins** [25, 25, 25, 25] (1/100 in)
- **Master template:** template landscape header.afr
- **Root table:** `wvgeoeval`
- **Blocks:** 2

  - **Geoeval** — `wvgeoeval` (6 fields)
    - `wvgeoeval.dttm` (w=10) → _Dttm_
    - `wvgeoeval.evaltyp` (w=10) → _Evaltyp_
    - `wvgeoeval.geologistname` (w=10) → _Geologistname_
    - `wvgeoeval.geologistcompany` (w=10) → _Geologistcompany_
    - `wvgeoeval.idrecwellbore` (w=10) → _Idrecwellbore_
    - `wvgeoeval.com` (w=50) → _Comment_
  - **Geoevalqualifier** — `wvgeoevalqualifier` (11 fields)
    - `wvgeoevalqualifier.depthtop` (w=10) → _Top Depth_
    - `wvgeoevalqualifier.depthtvdtopcalc` (w=10) → _Depth TVD Top (computed)_
    - `wvgeoevalqualifier.depthbtm` (w=10) → _Bottom Depth_
    - `wvgeoevalqualifier.depthtvdbtmcalc` (w=10) → _Depth TVD Btm (computed)_
    - `wvgeoevalqualifier.typ` (w=10) → _Type_
    - `wvgeoevalqualifier.abundancepercent` (w=10) → _Abundancepercent_
    - `wvgeoevalqualifier.abundancecode` (w=10) → _Abundancecode_
    - `wvgeoevalqualifier.formationcalc` (w=10) → _Formation (computed)_
    - `wvgeoevalqualifier.formationlayercalc` (w=10) → _Formationlayer (computed)_
    - `wvgeoevalqualifier.idrecitem` (w=20) → _Idrecitem_
    - `wvgeoevalqualifier.note` (w=50) → _Note_

### RFT

- **HTML:** [Geology/General Input/RFT.html](Geology/General%20Input/RFT.html)
- **Paper:** letter · **margins** [12, 12, 31, 25] (1/100 in)
- **Master template:** template landscape header.afr
- **Root table:** `wvwellheader`
- **Blocks:** 3

  - **Welltestrft** — `wvwelltestrft` (18 fields)
    - `wvwelltestrft.dttm` (w=10) → _Dttm_
    - `wvwelltestrft.runno` (w=10) → _Runno_
    - `wvwelltestrft.tooltyp` (w=10) → _Tooltyp_
    - `wvwelltestrft.toolconfig` (w=10) → _Toolconfig_
    - `wvwelltestrft.runmethod` (w=10) → _Runmethod_
    - `wvwelltestrft.durrun` (w=10) → _Duration Run_
    - `wvwelltestrft.wellsituation` (w=10) → _Wellsituation_
    - `wvwelltestrft.testedby` (w=10) → _Testedby_
    - `wvwelltestrft.surfacetestunitname` (w=10) → _Surfacetestunitname_
    - `wvwelltestrft.qtytestplan` (w=10) → _Quantity Testplan_
    - `wvwelltestrft.qtytestexecute` (w=10) → _Quantity Testexecute_
    - `wvwelltestrft.qtytestreliable` (w=10) → _Quantity Testreliable_
    - `wvwelltestrft.durpretestmax` (w=10) → _Duration Pretestmax_
    - `wvwelltestrft.ratepretestsample` (w=10) → _Ratepretestsample_
    - `wvwelltestrft.volpretestsample` (w=10) → _Volpretestsample_
    - `wvwelltestrft.probetyp` (w=10) → _Probetyp_
    - `wvwelltestrft.lengthprobe` (w=10) → _Lengthprobe_
    - `wvwelltestrft.idrecgaugeused` (w=10) → _Idrecgaugeused_
  - **Welltestrftgauge** — `wvwelltestrftgauge` (4 fields)
    - `wvwelltestrftgauge.typ` (w=10) → _Type_
    - `wvwelltestrftgauge.sn` (w=10) → _Serial Number_
    - `wvwelltestrftgauge.dttmcalibrate` (w=10) → _Date/Time Calibrate_
    - `wvwelltestrftgauge.presref` (w=10) → _Presref_
  - **Welltestrftdata** — `wvwelltestrftdata` (17 fields)
    - `wvwelltestrftdata.depth` (w=10) → _Depth_
    - `wvwelltestrftdata.depthtvdcalc` (w=10) → _Depth (TVD) (computed)_
    - `wvwelltestrftdata.refno` (w=5) → _Refno_
    - `wvwelltestrftdata.sample` (w=5) → _Sample_
    - `wvwelltestrftdata.use` (w=5) → _Use_
    - `wvwelltestrftdata.volfluid` (w=10) → _Volfluid_
    - `wvwelltestrftdata.durbuildup` (w=10) → _Duration Buildup_
    - `wvwelltestrftdata.stabilizedpres` (w=5) → _Stabilizedpres_
    - `wvwelltestrftdata.mobilitydrawdown` (w=10) → _Mobilitydrawdown_
    - `wvwelltestrftdata.preshydstart` (w=10) → _Preshydstart_
    - `wvwelltestrftdata.preshydend` (w=10) → _Preshydend_
    - `wvwelltestrftdata.presform` (w=10) → _Presform_
    - `wvwelltestrftdata.fluidtyp` (w=10) → _Fluidtyp_
    - `wvwelltestrftdata.presend` (w=10) → _Presend_
    - `wvwelltestrftdata.densityfluid` (w=10) → _Densityfluid_
    - `wvwelltestrftdata.quality` (w=10) → _Quality_
    - `wvwelltestrftdata.formationcalc` (w=15) → _Formation (computed)_

### Samples

- **HTML:** [Geology/General Input/Samples.html](Geology/General%20Input/Samples.html)
- **Paper:** letter · **margins** [25, 25, 25, 25] (1/100 in)
- **Master template:** template landscape header.afr
- **Root table:** `wvgeoeval`
- **Blocks:** 2

  - **Geoeval** — `wvgeoeval` (6 fields)
    - `wvgeoeval.dttm` (w=10) → _Dttm_
    - `wvgeoeval.evaltyp` (w=10) → _Evaltyp_
    - `wvgeoeval.geologistname` (w=10) → _Geologistname_
    - `wvgeoeval.geologistcompany` (w=10) → _Geologistcompany_
    - `wvgeoeval.idrecwellbore` (w=10) → _Idrecwellbore_
    - `wvgeoeval.com` (w=50) → _Comment_
  - **Geoevalsampledes** — `wvgeoevalsampledes` (10 fields)
    - `wvgeoevalsampledes.depthtop` (w=10) → _Top Depth_
    - `wvgeoevalsampledes.depthtvdtopcalc` (w=10) → _Depth TVD Top (computed)_
    - `wvgeoevalsampledes.depthbtm` (w=10) → _Bottom Depth_
    - `wvgeoevalsampledes.depthtvdbtmcalc` (w=10) → _Depth TVD Btm (computed)_
    - `wvgeoevalsampledes.volpercentca` (w=10) → _Volpercentca_
    - `wvgeoevalsampledes.volpercentmg` (w=10) → _Volpercentmg_
    - `wvgeoevalsampledes.refno` (w=10) → _Refno_
    - `wvgeoevalsampledes.formationcalc` (w=10) → _Formation (computed)_
    - `wvgeoevalsampledes.formationlayercalc` (w=10) → _Formationlayer (computed)_
    - `wvgeoevalsampledes.com` (w=50) → _Comment_

### Schematic

- **HTML:** [Geology/General Input/Schematic.html](Geology/General%20Input/Schematic.html)
- **Paper:** letter · **margins** [12, 12, 31, 25] (1/100 in)
- **Master template:** template landscape header.afr
- **Root table:** `None`
- **Blocks:** 0


## Geology/Geo Summary

### Formation Performance

- **HTML:** [Geology/Geo Summary/Formation Performance.html](Geology/Geo%20Summary/Formation%20Performance.html)
- **Paper:** letter · **margins** [25, 25, 25, 25] (1/100 in)
- **Master template:** template portrait.afr
- **Root table:** `None`
- **Blocks:** 5

  - **Wellbore** — `wvwellbore` (6 fields)
    - `wvwellheader.wellname` (w=30) → _Well Name_
    - `wvwellheader.elvorigkb` (w=7) → _Elvorigkb_
    - `wvwellheader.elvground` (w=7) → _Elvground_
    - `wvwellbore.des` (w=12) → _Description_
    - `wvwellbore.idrecparent` (w=15) → _Idrecparent_
    - `wvwellbore.idrecdirsrvyactual` (w=30) → _Idrecdirsrvyactual_
  - **Wellboreformation** — `wvwellboreformation` (10 fields)
    - `wvwellboreformation.formname` (w=20) → _Formname_
    - `wvwellboreformation.layername` (w=5) → _Layername_
    - `wvwellboreformation.depthdrillingtop` (w=9) → _Depth Drillingtop_
    - `wvwellboreformation.depthdrillingbtm` (w=9) → _Depth Drillingbtm_
    - `wvwellboreformation.depthfinaltop` (w=9) → _Depth Finaltop_
    - `wvwellboreformation.depthfinalbtm` (w=9) → _Depth Finalbtm_
    - `wvwellboreformation.ropcalc` (w=6) → _ROP_
    - `wvwellboreformation.fracpres` (w=5) → _Fracpres_
    - `wvwellboreformation.porepres` (w=5) → _Porepres_
    - `wvwellboreformation.temp` (w=5) → _Temp_
  - **Wellboreformation** — `wvwellboreformation` (1 fields)
    - `wvwellboreformation.depthdrillingtop` (w=0) → _Depth Drillingtop_
  - **Drilling Parameters** — `wvjobdrillstringdrillparam` (1 fields)
    - `wvjobdrillstringdrillparam.depthstart` (w=0) → _Depth Start_
  - **Drilling Parameters** — `wvjobdrillstringdrillparam` (5 fields)
    - `wvjobdrillstringdrillparam.depthstart` (w=9) → _Depth Start_
    - `wvjobdrillstringdrillparam.depthend` (w=9) → _Depth End_
    - `wvjobdrillstringdrillparam.depthdrilledcalc` (w=9) → _Depth Drilled (computed)_
    - `wvjobdrillstringdrillparam.tmdrill` (w=6) → _Tmdrill_
    - `wvjobdrillstringdrillparam.ropcalc` (w=6) → _ROP_

### Schematic

- **HTML:** [Geology/Geo Summary/Schematic.html](Geology/Geo%20Summary/Schematic.html)
- **Paper:** letter · **margins** [12, 12, 31, 25] (1/100 in)
- **Master template:** template landscape header.afr
- **Root table:** `None`
- **Blocks:** 0


### Geological Summary

- **HTML:** [Geology/Geo Summary/Geological Summary.html](Geology/Geo%20Summary/Geological%20Summary.html)
- **Paper:** letter · **margins** [25, 25, 25, 25] (1/100 in)
- **Master template:** template landscape legal.afr
- **Root table:** `wvjob`
- **Blocks:** 4

  - **& Geology\Geology_Plan vs Actual** — `wvjob` (16 fields)
    - `wvjob.wvtyp` (w=10) → _Wvtyp_
    - `wvjob.jobtyp` (w=10) → _Jobtyp_
    - `wvjob.afenumbercalc` (w=10) → _AFE Number_
    - `wvjob.objectivegeo` (w=30) → _Objectivegeo_
    - `wvjob.summarygeo` (w=30) → _Summarygeo_
    - `wvjob.resulttechnical` (w=20) → _Resulttechnical_
    - `wvjob.afetotalcalc` (w=10) → _AFE Total_
    - `wvjob.costtotalcalc` (w=10) → _Daily Cost Total_
    - `wvjob.variancefieldcalc` (w=10) → _Variancefield (computed)_
    - `wvjob.totaldepthcalc` (w=10) → _Total Aldepth (computed)_
    - `wvjob.ropspudtimelogcalc` (w=10) → _Ropspudtimelog (computed)_
    - `wvjob.costperdepthcalc` (w=10) → _Costperdepth (computed)_
    - `wvjob.durationtimelogtotalcalc` (w=10) → _Time Log Total (hr)_
    - `wvjob.durationproblemtimecalc` (w=10) → _Problem Time (hr)_
    - `wvjob.pctproblemtimecalc` (w=10) → _Problem Time (%)_
    - `wvjob.idreclastrigcalc` (w=18) → _Idreclastrig (computed)_
  - **Wellbore** — `wvwellbore` (3 fields)
    - `wvwellbore.des` (w=10) → _Description_
    - `wvwellbore.idrecparent` (w=10) → _Idrecparent_
    - `wvwellbore.profiletyp` (w=10) → _Profiletyp_
  - **Wellboresummarycalc** — `wvwellboresummarycalc` (4 fields)
    - `wvwellboresummarycalc.des` (w=20) → _Description_
    - `wvwellboresummarycalc.sz` (w=10) → _Sz_
    - `wvwellboresummarycalc.depthtopactual` (w=10) → _Depth Topactual_
    - `wvwellboresummarycalc.depthbtmactual` (w=10) → _Depth Btmactual_
  - **Wellboreformation** — `wvwellboreformation` (6 fields)
    - `wvwellboreformation.formname` (w=20) → _Formname_
    - `wvwellboreformation.depthmdprogtop` (w=10) → _Depth MD Progtop_
    - `wvwellboreformation.depthmdprogbtm` (w=10) → _Depth MD Progbtm_
    - `wvwellboreformation.depthdrillingtop` (w=10) → _Depth Drillingtop_
    - `wvwellboreformation.depthdrillingbtm` (w=10) → _Depth Drillingbtm_
    - `wvwellboreformation.ropcalc` (w=5) → _ROP_

## Master Templates

### template landscape header cw

- **HTML:** [Master Templates/template landscape header cw.html](Master%20Templates/template%20landscape%20header%20cw.html)
- **Paper:** letter · **margins** [25, 25, 25, 25] (1/100 in)
- **Master template:** _none_
- **Root table:** `None`
- **Captions:**
  - `<File name>`
  - `Page  <Page number>/<Number of pages>`
  - `Well Name:   <wvwellheader.wellname>`
  - `Report Printed:   <Current date short format>`
- **Blocks:** 1

  - **Well Header** — `wvwellheader` (8 fields)
    - `wvwellheader.operator` (w=10) → _Operator_
    - `wvwellheader.usertxt1` (w=10) → _Usertxt1_
    - `wvwellheader.fieldname` (w=10) → _Field_
    - `wvwellheader.wellconfig` (w=10) → _Wellconfig_
    - `wvwellheader.elvground` (w=10) → _Elvground_
    - `wvwellheader.elvcasflange` (w=10) → _Elvcasflange_
    - `wvwellheader.kbtogrdcalc` (w=10) → _Kbtogrd (computed)_
    - `wvwellheader.kbtocascalc` (w=10) → _Kbtocas (computed)_

### template landscape header

- **HTML:** [Master Templates/template landscape header.html](Master%20Templates/template%20landscape%20header.html)
- **Paper:** letter · **margins** [25, 25, 25, 25] (1/100 in)
- **Master template:** _none_
- **Root table:** `None`
- **Captions:**
  - `<File name>`
  - `Page  <Page number>/<Number of pages>`
  - `Report Printed:   <Current date short format>`
- **Blocks:** 1

  - **Well Header** — `wvwellheader` (8 fields)
    - `wvwellheader.operator` (w=10) → _Operator_
    - `wvwellheader.usertxt1` (w=10) → _Usertxt1_
    - `wvwellheader.fieldname` (w=10) → _Field_
    - `wvwellheader.wellconfig` (w=10) → _Wellconfig_
    - `wvwellheader.elvground` (w=10) → _Elvground_
    - `wvwellheader.elvcasflange` (w=10) → _Elvcasflange_
    - `wvwellheader.kbtogrdcalc` (w=10) → _Kbtogrd (computed)_
    - `wvwellheader.kbtocascalc` (w=10) → _Kbtocas (computed)_

### template landscape legal

- **HTML:** [Master Templates/template landscape legal.html](Master%20Templates/template%20landscape%20legal.html)
- **Paper:** legal · **margins** [25, 25, 25, 25] (1/100 in)
- **Master template:** _none_
- **Root table:** `None`
- **Captions:**
  - `<File name>`
  - `Page  <Page number>/<Number of pages>`
  - `Well Name:   <wvwellheader.wellname>`
  - `Report Printed:   <Current date short format>`
- **Blocks:** 0


### template landscape

- **HTML:** [Master Templates/template landscape.html](Master%20Templates/template%20landscape.html)
- **Paper:** letter · **margins** [25, 25, 25, 25] (1/100 in)
- **Master template:** _none_
- **Root table:** `None`
- **Captions:**
  - `<File name>`
  - `Page  <Page number>/<Number of pages>`
  - `Well Name:   <wvwellheader.wellname>`
  - `Report Printed:   <Current date short format>`
- **Blocks:** 0


### template legal

- **HTML:** [Master Templates/template legal.html](Master%20Templates/template%20legal.html)
- **Paper:** legal · **margins** [25, 25, 25, 25] (1/100 in)
- **Master template:** _none_
- **Root table:** `None`
- **Captions:**
  - `Page  <Page number>/<Number of pages>`
  - `Well Name:   <wvwellheader.wellname>`
  - `Report Printed:   <Current date short format>`
  - `<File name>`
- **Blocks:** 0


### template portrait Header

- **HTML:** [Master Templates/template portrait Header.html](Master%20Templates/template%20portrait%20Header.html)
- **Paper:** letter · **margins** [25, 25, 25, 25] (1/100 in)
- **Master template:** _none_
- **Root table:** `None` · **filter:** wvjob / wvtyp / Drilling; wvjob / wvtyp / Drilling
- **Captions:**
  - `Page  <Page number>/<Number of pages>`
  - `Report Printed:   <Current date short format>`
  - `<File name>`
- **Blocks:** 2

  - **Job** — `wvjob` (4 fields)
    - `wvwellheader.platform` (w=10) → _Platform_
    - `wvjob.wvtyp` (w=10) → _Wvtyp_
    - `wvjob.jobtyp` (w=10) → _Jobtyp_
    - `wvjob.dttmstart` (w=10) → _Start Date/Time_
  - **Rig** — `wvjobrig` (4 fields)
    - `wvjobrig.contractor` (w=10) → _Contractor_
    - `wvjobrig.rigno` (w=10) → _Rigno_
    - `wvjobrig.typ1` (w=10) → _Typ1_
    - `wvjobrig.typ2` (w=10) → _Typ2_

### template portrait

- **HTML:** [Master Templates/template portrait.html](Master%20Templates/template%20portrait.html)
- **Paper:** letter · **margins** [25, 25, 25, 25] (1/100 in)
- **Master template:** _none_
- **Root table:** `None`
- **Captions:**
  - `Page  <Page number>/<Number of pages>`
  - `Report Printed:   <Current date short format>`
  - `<File name>`
- **Blocks:** 0


### template portrait header cw

- **HTML:** [Master Templates/template portrait header cw.html](Master%20Templates/template%20portrait%20header%20cw.html)
- **Paper:** letter · **margins** [25, 25, 25, 25] (1/100 in)
- **Master template:** _none_
- **Root table:** `None`
- **Captions:**
  - `Page  <Page number>/<Number of pages>`
  - `Well Name:   <wvwellheader.wellname>`
  - `Report Printed:   <Current date short format>`
  - `<File name>`
- **Blocks:** 1

  - **Well Header** — `wvwellheader` (12 fields)
    - `wvwellheader.wellida` (w=7) → _Well ID_
    - `wvwellheader.legalsurveyloc` (w=7) → _Legalsurveyloc_
    - `wvwellheader.fieldname` (w=7) → _Field_
    - `wvwellheader.welllicenseno` (w=7) → _Welllicenseno_
    - `wvwellheader.stateprov` (w=7) → _Stateprov_
    - `wvwellheader.wellconfig` (w=7) → _Wellconfig_
    - `wvwellheader.elvorigkb` (w=10) → _Elvorigkb_
    - `wvwellheader.kbtotubcalc` (w=10) → _Kbtotub (computed)_
    - `wvwellheader.dttmspud` (w=10) → _Spud Date/Time_
    - `wvwellheader.dttmrr` (w=10) → _Date/Time Rr_
    - `wvwellheader.pbtdallcalc` (w=10) → _Pbtdall (computed)_
    - `wvwellheader.tdtvdallcalc` (w=10) → _Tdtvdall (computed)_

## Phase Analysis, Lessons & Problems

### Phases - Plan

- **HTML:** [Phase Analysis, Lessons & Problems/Phases - Plan.html](Phase%20Analysis%2C%20Lessons%20%26%20Problems/Phases%20-%20Plan.html)
- **Paper:** letter · **margins** [12, 12, 31, 25] (1/100 in)
- **Master template:** template landscape.afr
- **Root table:** `wvjob` · **filter:** wvjob / wvtyp / dril
- **Captions:**
  - `<wvjobprogramphase.code2>`
- **Blocks:** 8

  - **Job** — `wvjob` (12 fields)
    - `wvjob.wvtyp` (w=10) → _Wvtyp_
    - `wvjob.jobtyp` (w=10) → _Jobtyp_
    - `wvjob.jobsubtyp` (w=10) → _Jobsubtyp_
    - `wvjob.status1` (w=10) → _Status1_
    - `wvjob.targetdepth` (w=10) → _Target Depth_
    - `wvjob.targetform` (w=10) → _Target Formation_
    - `wvjob.afenumbercalc` (w=10) → _AFE Number_
    - `wvjob.dttmstartplan` (w=10) → _Date/Time Startplan_
    - `wvjob.dttmstart` (w=10) → _Start Date/Time_
    - `wvjob.dttmendplanmincalc` (w=10) → _Date/Time Endplanmin (computed)_
    - `wvjob.dttmendplanmlcalc` (w=10) → _Date/Time Endplanml (computed)_
    - `wvjob.dttmendplanmaxcalc` (w=10) → _Date/Time Endplanmax (computed)_
  - **Jobprogramphase** — `wvjobprogramphase` (11 fields)
    - `wvjobprogramphase.code1` (w=6) → _Code 1_
    - `wvjobprogramphase.code2` (w=10) → _Code 2_
    - `wvjobprogramphase.depthstartplan` (w=4) → _Depth Startplan_
    - `wvjobprogramphase.depthendplan` (w=4) → _Depth Endplan_
    - `wvjobprogramphase.durationmin` (w=2) → _Duration Min_
    - `wvjobprogramphase.durationml` (w=2) → _Duration Ml_
    - `wvjobprogramphase.durationmax` (w=2) → _Duration Max_
    - `wvjobprogramphase.dayjobmlplancalc` (w=2) → _Dayjobmlplan (computed)_
    - `wvjobprogramphase.costml` (w=4) → _Costml_
    - `wvjobprogramphase.costmlcumcalc` (w=5) → _Costml (cumulative) (computed)_
    - `wvjobprogramphase.planphase` (w=12) → _Planphase_
  - **Jobprogramphase** — `wvjobprogramphase` (1 fields)
    - `wvjobprogramphase.depthendplan` (w=256) → _Depth Endplan_
  - **Jobprogramphase** — `wvjobprogramphase` (1 fields)
    - `wvjobprogramphase.depthendplan` (w=0) → _Depth Endplan_
  - **Jobprogramphase** — `wvjobprogramphase` (1 fields)
    - `wvjobprogramphase.depthendplan` (w=0) → _Depth Endplan_
  - **Jobprogramphase** — `wvjobprogramphase` (1 fields)
    - `wvjobprogramphase.costmlcumcalc` (w=0) → _Costml (cumulative) (computed)_
  - **Jobprogramphase** — `wvjobprogramphase` (1 fields)
    - `wvjobprogramphase.costmincumcalc` (w=0) → _Costmin (cumulative) (computed)_
  - **Jobprogramphase** — `wvjobprogramphase` (1 fields)
    - `wvjobprogramphase.costmaxcumcalc` (w=0) → _Costmax (cumulative) (computed)_

### Phases - Plan vs Actual

- **HTML:** [Phase Analysis, Lessons & Problems/Phases - Plan vs Actual.html](Phase%20Analysis%2C%20Lessons%20%26%20Problems/Phases%20-%20Plan%20vs%20Actual.html)
- **Paper:** letter · **margins** [12, 12, 31, 25] (1/100 in)
- **Master template:** template landscape legal.afr
- **Root table:** `wvjob` · **filter:** wvjob / wvtyp / dril
- **Captions:**
  - `<wvjobprogramphase.code2>`
  - `<wvjobprogramphase.code2>`
- **Blocks:** 12

  - **Job** — `wvjob` (7 fields)
    - `wvjob.wvtyp` (w=10) → _Wvtyp_
    - `wvjob.jobtyp` (w=10) → _Jobtyp_
    - `wvjob.jobsubtyp` (w=10) → _Jobsubtyp_
    - `wvjob.afenumbercalc` (w=10) → _AFE Number_
    - `wvjob.afetotalcalc` (w=10) → _AFE Total_
    - `wvjob.costtotalcalc` (w=10) → _Daily Cost Total_
    - `wvjob.variancefieldcalc` (w=10) → _Variancefield (computed)_
  - **Jobprogramphase** — `wvjobprogramphase` (18 fields)
    - `wvjobprogramphase.code1` (w=8) → _Code 1_
    - `wvjobprogramphase.code2` (w=8) → _Code 2_
    - `wvjobprogramphase.depthstartplan` (w=4) → _Depth Startplan_
    - `wvjobprogramphase.depthendplan` (w=4) → _Depth Endplan_
    - `wvjobprogramphase.durationml` (w=2) → _Duration Ml_
    - `wvjobprogramphase.dayjobmlplancalc` (w=2) → _Dayjobmlplan (computed)_
    - `wvjobprogramphase.costml` (w=4) → _Costml_
    - `wvjobprogramphase.costmlcumcalc` (w=5) → _Costml (cumulative) (computed)_
    - `wvjobprogramphase.costperdepthplancalc` (w=3) → _Costperdepthplan (computed)_
    - `wvjobprogramphase.dttmstartactual` (w=7) → _Date/Time Startactual_
    - `wvjobprogramphase.dttmendactual` (w=7) → _Date/Time Endactual_
    - `wvjobprogramphase.durationactualcalc` (w=2) → _Duration Actual Ual (computed)_
    - `wvjobprogramphase.durcumactualcalc` (w=2) → _Duration Cumulative Actual Ual (computed)_
    - `wvjobprogramphase.depthstartactualcalc` (w=4) → _Depth Startactual (computed)_
    - `wvjobprogramphase.depthendactualcalc` (w=4) → _Depth Endactual (computed)_
    - `wvjobprogramphase.costactualcalc` (w=4) → _Costactual (computed)_
    - `wvjobprogramphase.costactualcumcalc` (w=5) → _Costactual (cumulative) (computed)_
    - `wvjobprogramphase.costperdepthcalc` (w=3) → _Costperdepth (computed)_
  - **Daily Report** — `wvjobreport` (1 fields)
    - `wvjobreport.depthenddpcalc` (w=0) → _Depth End (MD)_
  - **Jobprogramphase** — `wvjobprogramphase` (1 fields)
    - `wvjobprogramphase.depthendactualcalc` (w=0) → _Depth Endactual (computed)_
  - **Jobprogramphase** — `wvjobprogramphase` (1 fields)
    - `wvjobprogramphase.durcumactualstartphasecalc` (w=0) → _Duration Cumulative Actual Ualstartphase (computed)_
  - **Jobprogramphase** — `wvjobprogramphase` (1 fields)
    - `wvjobprogramphase.costactualcumcalc` (w=0) → _Costactual (cumulative) (computed)_
  - **Jobprogramphase** — `wvjobprogramphase` (1 fields)
    - `wvjobprogramphase.costmaxcumcalc` (w=0) → _Costmax (cumulative) (computed)_
  - **Jobprogramphase** — `wvjobprogramphase` (1 fields)
    - `wvjobprogramphase.costmincumcalc` (w=0) → _Costmin (cumulative) (computed)_
  - **Jobprogramphase** — `wvjobprogramphase` (1 fields)
    - `wvjobprogramphase.costmlcumcalc` (w=0) → _Costml (cumulative) (computed)_
  - **Jobprogramphase** — `wvjobprogramphase` (1 fields)
    - `wvjobprogramphase.depthendplan` (w=0) → _Depth Endplan_
  - **Jobprogramphase** — `wvjobprogramphase` (1 fields)
    - `wvjobprogramphase.depthendplan` (w=0) → _Depth Endplan_
  - **Jobprogramphase** — `wvjobprogramphase` (1 fields)
    - `wvjobprogramphase.depthendplan` (w=0) → _Depth Endplan_

### Phase Summary Graph

- **HTML:** [Phase Analysis, Lessons & Problems/Phase Summary Graph.html](Phase%20Analysis%2C%20Lessons%20%26%20Problems/Phase%20Summary%20Graph.html)
- **Paper:** letter · **margins** [12, 12, 31, 25] (1/100 in)
- **Master template:** template landscape.afr
- **Root table:** `wvjob`
- **Captions:**
  - `<wvjobprogramphase.code2>`
- **Blocks:** 6

  - **Jobprogramphase** — `wvjobprogramphase` (1 fields)
    - `wvjobprogramphase.durationml` (w=0) → _Duration Ml_
  - **Jobprogramphase** — `wvjobprogramphase` (1 fields)
    - `wvjobprogramphase.durationactualcalc` (w=0) → _Duration Actual Ual (computed)_
  - **Jobprogramphase** — `wvjobprogramphase` (1 fields)
    - `wvjobprogramphase.costactualcalc` (w=0) → _Costactual (computed)_
  - **Jobprogramphase** — `wvjobprogramphase` (1 fields)
    - `wvjobprogramphase.costml` (w=0) → _Costml_
  - **Cost (1,000,000's)** — `wvwellheader` (9 fields)
    - `wvwellheader.wellida` (w=10) → _Well ID_
    - `wvwellheader.welllicenseno` (w=10) → _Welllicenseno_
    - `wvwellheader.fieldname` (w=10) → _Field_
    - `wvwellheader.stateprov` (w=10) → _Stateprov_
    - `wvwellheader.wellconfig` (w=10) → _Wellconfig_
    - `wvwellheader.dttmspud` (w=10) → _Spud Date/Time_
    - `wvwellheader.dttmrr` (w=10) → _Date/Time Rr_
    - `wvwellheader.kbtogrdcalc` (w=10) → _Kbtogrd (computed)_
    - `wvwellheader.tdcalc` (w=10) → _Td (computed)_
  - **Job** — `wvjob` (12 fields)
    - `wvjob.afenumbercalc` (w=10) → _AFE Number_
    - `wvjob.wvtyp` (w=10) → _Wvtyp_
    - `wvjob.jobtyp` (w=10) → _Jobtyp_
    - `wvjob.status1` (w=10) → _Status1_
    - `wvjob.targetdepth` (w=10) → _Target Depth_
    - `wvjob.targetform` (w=10) → _Target Formation_
    - `wvjob.dttmstartplan` (w=10) → _Date/Time Startplan_
    - `wvjob.dttmstart` (w=10) → _Start Date/Time_
    - `wvjob.dttmendplanmincalc` (w=10) → _Date/Time Endplanmin (computed)_
    - `wvjob.dttmendplanmlcalc` (w=10) → _Date/Time Endplanml (computed)_
    - `wvjob.dttmendplanmaxcalc` (w=10) → _Date/Time Endplanmax (computed)_
    - `wvjob.dttmend` (w=10) → _End Date/Time_

### Phases - Plan vs Actual Details

- **HTML:** [Phase Analysis, Lessons & Problems/Phases - Plan vs Actual Details.html](Phase%20Analysis%2C%20Lessons%20%26%20Problems/Phases%20-%20Plan%20vs%20Actual%20Details.html)
- **Paper:** letter · **margins** [25, 25, 25, 25] (1/100 in)
- **Master template:** template landscape.afr
- **Root table:** `wvjobprogramphase` · **filter:** wvjob / wvtyp / drill
- **Blocks:** 4

  - **Jobprogramphase** — `wvjobprogramphase` (13 fields)
    - `wvjobprogramphase.code1` (w=10) → _Code 1_
    - `wvjobprogramphase.code2` (w=10) → _Code 2_
    - `wvjobprogramphase.code3` (w=10) → _Code3_
    - `wvjobprogramphase.code4` (w=10) → _Code4_
    - `wvjobprogramphase.idrecwellbore` (w=10) → _Idrecwellbore_
    - `wvjobprogramphase.planphase` (w=50) → _Planphase_
    - `wvjobprogramphase.hazards` (w=15) → _Hazards_
    - `wvjobprogramphase.dttmstartactual` (w=10) → _Date/Time Startactual_
    - `wvjobprogramphase.dttmendactual` (w=10) → _Date/Time Endactual_
    - `wvjobprogramphase.wellboreszcalc` (w=10) → _Wellboresz (computed)_
    - `wvjobprogramphase.incltopcalc` (w=10) → _Incltop (computed)_
    - `wvjobprogramphase.inclbtmcalc` (w=10) → _Inclbtm (computed)_
    - `wvjobprogramphase.inclmaxcalc` (w=10) → _Inclmax (computed)_
  - **Jobprogramphase** — `wvjobprogramphase` (10 fields)
    - `wvjobprogramphase.durationml` (w=10) → _Duration Ml_
    - `wvjobprogramphase.dayjobmlplancalc` (w=10) → _Dayjobmlplan (computed)_
    - `wvjobprogramphase.costml` (w=10) → _Costml_
    - `wvjobprogramphase.costmlcumcalc` (w=10) → _Costml (cumulative) (computed)_
    - `wvjobprogramphase.depthstartplan` (w=10) → _Depth Startplan_
    - `wvjobprogramphase.depthtvdstartplancalc` (w=10) → _Depth TVD Startplan (computed)_
    - `wvjobprogramphase.depthendplan` (w=10) → _Depth Endplan_
    - `wvjobprogramphase.depthtvdendplancalc` (w=10) → _Depth TVD Endplan (computed)_
    - `wvjobprogramphase.depthprogressplancalc` (w=10) → _Depth Progressplan (computed)_
    - `wvjobprogramphase.costperdepthplancalc` (w=10) → _Costperdepthplan (computed)_
  - **Jobprogramphase** — `wvjobprogramphase` (10 fields)
    - `wvjobprogramphase.durationactualcalc` (w=10) → _Duration Actual Ual (computed)_
    - `wvjobprogramphase.durcumactualcalc` (w=10) → _Duration Cumulative Actual Ual (computed)_
    - `wvjobprogramphase.costactualcalc` (w=10) → _Costactual (computed)_
    - `wvjobprogramphase.costactualcumcalc` (w=10) → _Costactual (cumulative) (computed)_
    - `wvjobprogramphase.depthstartactualcalc` (w=10) → _Depth Startactual (computed)_
    - `wvjobprogramphase.depthtvdstartactualcalc` (w=10) → _Depth TVD Startactual (computed)_
    - `wvjobprogramphase.depthendactualcalc` (w=10) → _Depth Endactual (computed)_
    - `wvjobprogramphase.depthtvdendactualcalc` (w=10) → _Depth TVD Endactual (computed)_
    - `wvjobprogramphase.depthprogressactualcalc` (w=10) → _Depth Progressactual (computed)_
    - `wvjobprogramphase.costperdepthcalc` (w=10) → _Costperdepth (computed)_
  - **Plan vs Actual** — `wvjobprogramphase` (20 fields)
    - `wvjobprogramphase.costvariancecalc` (w=10) → _Costvariance (computed)_
    - `wvjobprogramphase.durationvariancecalc` (w=10) → _Duration Variance (computed)_
    - `wvjobprogramphase.durationvariancecumcalc` (w=10) → _Duration Variance (cumulative) (computed)_
    - `wvjobprogramphase.durationtimelogtotalcalc` (w=10) → _Time Log Total (hr)_
    - `wvjobprogramphase.durationtimelogtotcumcalc` (w=10) → _Duration Timelogtot (cumulative) (computed)_
    - `wvjobprogramphase.durationproblemtimecalc` (w=10) → _Problem Time (hr)_
    - `wvjobprogramphase.durationproblemtimecumcalc` (w=10) → _Duration Problemtime (cumulative) (computed)_
    - `wvjobprogramphase.pctproblemtimecalc` (w=10) → _Problem Time (%)_
    - `wvjobprogramphase.durationnoprobtimecalc` (w=10) → _Duration Number Probtime (computed)_
    - `wvjobprogramphase.durationnoprobtimecumcalc` (w=10) → _Duration Number Probtime (cumulative) (computed)_
    - `wvjobprogramphase.tmdrillcalc` (w=10) → _Tmdrill (computed)_
    - `wvjobprogramphase.tmcirccalc` (w=10) → _Tmcirc (computed)_
    - `wvjobprogramphase.ropcalc` (w=10) → _ROP_
    - `wvjobprogramphase.tmrotatingcalc` (w=10) → _Tmrotating (computed)_
    - `wvjobprogramphase.roprotatingcalc` (w=10) → _Roprotating (computed)_
    - `wvjobprogramphase.percenttmrotatingcalc` (w=10) → _Percenttmrotating (computed)_
    - `wvjobprogramphase.tmslidingcalc` (w=10) → _Tmsliding (computed)_
    - `wvjobprogramphase.ropslidingcalc` (w=10) → _Ropsliding (computed)_
    - `wvjobprogramphase.percenttmslidingcalc` (w=10) → _Percenttmsliding (computed)_
    - `wvjobprogramphase.bitrevscalc` (w=10) → _Bitrevs (computed)_

### Phase Activity & Time Log Breakdown

- **HTML:** [Phase Analysis, Lessons & Problems/Phase Activity & Time Log Breakdown.html](Phase%20Analysis%2C%20Lessons%20%26%20Problems/Phase%20Activity%20%26%20Time%20Log%20Breakdown.html)
- **Paper:** letter · **margins** [12, 12, 31, 25] (1/100 in)
- **Master template:** template landscape.afr
- **Root table:** `wvjobprogramphase` · **filter:** wvjob / wvtyp / drill
- **Captions:**
  - `Var: <wvjppactivitysumcalc.durationmlvar>`
- **Blocks:** 4

  - **Phase Time Log Summary** — `wvjppactivitysumcalc` (1 fields)
    - `wvjppactivitysumcalc.durationml` (w=0) → _Duration Ml_
  - **Jppactivitysumcalc** — `wvjppactivitysumcalc` (1 fields)
    - `wvjppactivitysumcalc.durationtimelog` (w=0) → _Duration Timelog_
  - **Job** — `wvjob` (6 fields)
    - `wvjob.afenumbercalc` (w=10) → _AFE Number_
    - `wvjob.wvtyp` (w=10) → _Wvtyp_
    - `wvjob.jobtyp` (w=10) → _Jobtyp_
    - `wvjob.jobsubtyp` (w=10) → _Jobsubtyp_
    - `wvjob.dttmstartplan` (w=10) → _Date/Time Startplan_
    - `wvjob.dttmstart` (w=10) → _Start Date/Time_
  - **Jobprogramphase** — `wvjobprogramphase` (15 fields)
    - `wvjobprogramphase.sysseq` (w=5) → _Sysseq_
    - `wvjobprogramphase.code1` (w=20) → _Code 1_
    - `wvjobprogramphase.depthstartplan` (w=9) → _Depth Startplan_
    - `wvjobprogramphase.depthendplan` (w=9) → _Depth Endplan_
    - `wvjobprogramphase.durationml` (w=6) → _Duration Ml_
    - `wvjobprogramphase.costml` (w=15) → _Costml_
    - `wvjobprogramphase.durationmax` (w=6) → _Duration Max_
    - `wvjobprogramphase.dayjobmaxplancalc` (w=6) → _Dayjobmaxplan (computed)_
    - `wvjobprogramphase.durationmin` (w=6) → _Duration Min_
    - `wvjobprogramphase.dayjobminplancalc` (w=6) → _Dayjobminplan (computed)_
    - `wvjobprogramphase.dttmstartactual` (w=10) → _Date/Time Startactual_
    - `wvjobprogramphase.depthstartactualcalc` (w=9) → _Depth Startactual (computed)_
    - `wvjobprogramphase.dttmendactual` (w=10) → _Date/Time Endactual_
    - `wvjobprogramphase.depthendactualcalc` (w=9) → _Depth Endactual (computed)_
    - `wvjobprogramphase.costactualcalc` (w=15) → _Costactual (computed)_

### Phase Time & Problem Time Summary - Graph

- **HTML:** [Phase Analysis, Lessons & Problems/Phase Time & Problem Time Summary - Graph.html](Phase%20Analysis%2C%20Lessons%20%26%20Problems/Phase%20Time%20%26%20Problem%20Time%20Summary%20-%20Graph.html)
- **Paper:** letter · **margins** [25, 25, 25, 25] (1/100 in)
- **Master template:** template portrait header.afr
- **Root table:** `wvjob` · **filter:** wvjobprogramphase / sysseq; wvjobprogramphase / sysseq
- **Captions:**
  - `<wvjobprogramphase.code2>`
- **Blocks:** 4

  - **Total Time, Interval Problem Time, Variance per Phase** — `wvjobprogramphase` (1 fields)
    - `wvjobprogramphase.durationtimelogtotalcalc` (w=0) → _Time Log Total (hr)_
  - **Jobprogramphase** — `wvjobprogramphase` (1 fields)
    - `wvjobprogramphase.durationproblemtimecalc` (w=0) → _Problem Time (hr)_
  - **Jobprogramphase** — `wvjobprogramphase` (1 fields)
    - `wvjobprogramphase.durationnoprobtimecalc` (w=0) → _Duration Number Probtime (computed)_
  - **Jobprogramphase** — `wvjobprogramphase` (7 fields)
    - `wvjobprogramphase.code1` (w=15) → _Code 1_
    - `wvjobprogramphase.code2` (w=15) → _Code 2_
    - `wvjobprogramphase.dttmstartactual` (w=10) → _Date/Time Startactual_
    - `wvjobprogramphase.dttmendactual` (w=10) → _Date/Time Endactual_
    - `wvjobprogramphase.durationtimelogtotalcalc` (w=10) → _Time Log Total (hr)_
    - `wvjobprogramphase.durationproblemtimecalc` (w=10) → _Problem Time (hr)_
    - `wvjobprogramphase.durationnoprobtimecalc` (w=10) → _Duration Number Probtime (computed)_

### Phase - Time, Problem, Cost Details

- **HTML:** [Phase Analysis, Lessons & Problems/Phase - Time, Problem, Cost Details.html](Phase%20Analysis%2C%20Lessons%20%26%20Problems/Phase%20-%20Time%2C%20Problem%2C%20Cost%20Details.html)
- **Paper:** letter · **margins** [25, 25, 25, 25] (1/100 in)
- **Master template:** template landscape legal.afr
- **Root table:** `wvjobprogramphase` · **filter:** wvjob / wvtyp / drill; wvjpptlcalc / code2; wvjppcostcalc / des
- **Blocks:** 4

  - **Time Log** — `wvjpptlcalc` (1 fields)
    - `wvjpptlcalc.duration` (w=0) → _Duration Ation_
  - **Field Estimates** — `wvjppcostcalc` (1 fields)
    - `wvjppcostcalc.costfieldestphase` (w=0) → _Costfieldestphase_
  - **Interval Problems** — `wvjppintervalproblemcalc` (1 fields)
    - `wvjppintervalproblemcalc.problemduration` (w=0) → _Problemduration_
  - **Jobprogramphase** — `wvjobprogramphase` (9 fields)
    - `wvjobprogramphase.code1` (w=20) → _Code 1_
    - `wvjobprogramphase.code2` (w=20) → _Code 2_
    - `wvjobprogramphase.dttmstartactual` (w=10) → _Date/Time Startactual_
    - `wvjobprogramphase.dttmendactual` (w=10) → _Date/Time Endactual_
    - `wvjobprogramphase.durationtimelogtotalcalc` (w=10) → _Time Log Total (hr)_
    - `wvjobprogramphase.durationproblemtimecalc` (w=10) → _Problem Time (hr)_
    - `wvjobprogramphase.durationnoprobtimecalc` (w=10) → _Duration Number Probtime (computed)_
    - `wvjobprogramphase.costactualcalc` (w=10) → _Costactual (computed)_
    - `wvjobprogramphase.costvariancecalc` (w=10) → _Costvariance (computed)_

### Phase - Mud Additive and Job Supply Details

- **HTML:** [Phase Analysis, Lessons & Problems/Phase - Mud Additive and Job Supply Details.html](Phase%20Analysis%2C%20Lessons%20%26%20Problems/Phase%20-%20Mud%20Additive%20and%20Job%20Supply%20Details.html)
- **Paper:** letter · **margins** [25, 25, 25, 25] (1/100 in)
- **Master template:** template landscape header.afr
- **Root table:** `wvjobprogramphase` · **filter:** wvjob / wvtyp / drill
- **Blocks:** 3

  - **Mud Additives Consumed** — `wvjppmudadcalc` (1 fields)
    - `wvjppmudadcalc.consumed` (w=0) → _Consumed_
  - **Job Supplies Consumed** — `wvjppjobsupcalc` (1 fields)
    - `wvjppjobsupcalc.consumed` (w=0) → _Consumed_
  - **Jobprogramphase** — `wvjobprogramphase` (4 fields)
    - `wvjobprogramphase.code1` (w=10) → _Code 1_
    - `wvjobprogramphase.code2` (w=10) → _Code 2_
    - `wvjobprogramphase.dttmstartactual` (w=10) → _Date/Time Startactual_
    - `wvjobprogramphase.dttmendactual` (w=10) → _Date/Time Endactual_

### Phases - Vendor Cost Summary

- **HTML:** [Phase Analysis, Lessons & Problems/Phases - Vendor Cost Summary.html](Phase%20Analysis%2C%20Lessons%20%26%20Problems/Phases%20-%20Vendor%20Cost%20Summary.html)
- **Paper:** letter · **margins** [25, 25, 25, 25] (1/100 in)
- **Master template:** template portrait header.afr
- **Root table:** `wvjobprogramphase` · **filter:** wvjob / wvjobprogramphase / Phase
- **Blocks:** 2

  - **Jobprogramphase** — `wvjobprogramphase` (4 fields)
    - `wvjobprogramphase.code1` (w=15) → _Code 1_
    - `wvjobprogramphase.code2` (w=15) → _Code 2_
    - `wvjobprogramphase.dttmstartactual` (w=10) → _Date/Time Startactual_
    - `wvjobprogramphase.dttmendactual` (w=10) → _Date/Time Endactual_
  - **Jppvendorcalc** — `wvjppvendorcalc` (2 fields)
    - `wvjppvendorcalc.vendor` (w=20) → _Vendor_
    - `wvjppvendorcalc.cost` (w=10) → _Cost_

### Interval Lessons

- **HTML:** [Phase Analysis, Lessons & Problems/Interval Lessons.html](Phase%20Analysis%2C%20Lessons%20%26%20Problems/Interval%20Lessons.html)
- **Paper:** letter · **margins** [12, 12, 31, 25] (1/100 in)
- **Master template:** template landscape.afr
- **Root table:** `wvjob`
- **Blocks:** 2

  - **Job** — `wvjob` (5 fields)
    - `wvjob.wvtyp` (w=10) → _Wvtyp_
    - `wvjob.jobtyp` (w=10) → _Jobtyp_
    - `wvjob.afenumbercalc` (w=10) → _AFE Number_
    - `wvjob.esttimesavecalc` (w=10) → _Estimate Timesave (computed)_
    - `wvjob.estcostsavecalc` (w=10) → _Estimate Costsave (computed)_
  - **Interval Lesson** — `wvjobintervallesson` (15 fields)
    - `wvjobintervallesson.typ` (w=10) → _Type_
    - `wvjobintervallesson.typdetail` (w=10) → _Typdetail_
    - `wvjobintervallesson.des` (w=10) → _Description_
    - `wvjobintervallesson.refno` (w=10) → _Refno_
    - `wvjobintervallesson.dttmstart` (w=10) → _Start Date/Time_
    - `wvjobintervallesson.dttmend` (w=10) → _End Date/Time_
    - `wvjobintervallesson.excludefromlessontime` (w=10) → _Excludefromlessontime_
    - `wvjobintervallesson.depthstart` (w=10) → _Depth Start_
    - `wvjobintervallesson.depthtvdstartcalc` (w=10) → _Depth TVD Start (computed)_
    - `wvjobintervallesson.depthend` (w=10) → _Depth End_
    - `wvjobintervallesson.depthtvdendcalc` (w=10) → _Depth TVD End (computed)_
    - `wvjobintervallesson.estcostsaving` (w=10) → _Estimate Costsaving_
    - `wvjobintervallesson.esttimesaving` (w=10) → _Estimate Timesaving_
    - `wvjobintervallesson.status` (w=10) → _Status_
    - `wvjobintervallesson.com` (w=50) → _Comment_

### Interval Problem & Time Log Details

- **HTML:** [Phase Analysis, Lessons & Problems/Interval Problem & Time Log Details.html](Phase%20Analysis%2C%20Lessons%20%26%20Problems/Interval%20Problem%20%26%20Time%20Log%20Details.html)
- **Paper:** letter · **margins** [12, 12, 31, 25] (1/100 in)
- **Master template:** template landscape.afr
- **Root table:** `wvjobintervalproblem` · **filter:** wvjobreporttimelog / dttmstartcalc; wvjobintervalproblem / dttmend; wvjobreporttimelog / dttmendcalc; wvjobintervalproblem / dttmstart; wvjobreporttimelog / dttmstartcalc; wvjobreport / dttmend; wvjobintervalproblem / dttmstart; wvjobreport / dttmstart; wvjobintervalproblem / dttmend
- **Blocks:** 4

  - **Job** — `wvjob` (5 fields)
    - `wvjob.wvtyp` (w=10) → _Wvtyp_
    - `wvjob.jobtyp` (w=10) → _Jobtyp_
    - `wvjob.afenumbercalc` (w=10) → _AFE Number_
    - `wvjob.estproblemtimecalc` (w=10) → _Estimate Problemtime (computed)_
    - `wvjob.estproblemcostcalc` (w=10) → _Estimate Problemcost (computed)_
  - **Interval Problem (NPT)** — `wvjobintervalproblem` (16 fields)
    - `wvjobintervalproblem.dttmstart` (w=10) → _Start Date/Time_
    - `wvjobintervalproblem.dttmend` (w=10) → _End Date/Time_
    - `wvjobintervalproblem.des` (w=10) → _Description_
    - `wvjobintervalproblem.typ` (w=10) → _Type_
    - `wvjobintervalproblem.estlosttime` (w=10) → _Estimate Losttime_
    - `wvjobintervalproblem.estcostoverride` (w=10) → _Estimate Costoverride_
    - `wvjobintervalproblem.excludefromproblemtime` (w=10) → _Excludefromproblemtime_
    - `wvjobintervalproblem.depthstart` (w=10) → _Depth Start_
    - `wvjobintervalproblem.depthtvdstartcalc` (w=10) → _Depth TVD Start (computed)_
    - `wvjobintervalproblem.depthend` (w=10) → _Depth End_
    - `wvjobintervalproblem.depthtvdendcalc` (w=10) → _Depth TVD End (computed)_
    - `wvjobintervalproblem.opscondition` (w=10) → _Opscondition_
    - `wvjobintervalproblem.severity` (w=10) → _Severity_
    - `wvjobintervalproblem.status` (w=10) → _Status_
    - `wvjobintervalproblem.actiontaken` (w=15) → _Actual Iontaken_
    - `wvjobintervalproblem.com` (w=50) → _Comment_
  - **Daily Report** — `wvjobreport` (8 fields)
    - `wvjobreport.reportnocalc` (w=4) → _Report #_
    - `wvjobreport.dttmstart` (w=10) → _Start Date/Time_
    - `wvjobreport.dttmend` (w=10) → _End Date/Time_
    - `wvjobreport.durationproblemtimecalc` (w=6) → _Problem Time (hr)_
    - `wvjobreport.pctproblemtimecalc` (w=6) → _Problem Time (%)_
    - `wvjobreport.durationproblemtimecumcalc` (w=6) → _Duration Problemtime (cumulative) (computed)_
    - `wvjobreport.pctproblemtimecumcalc` (w=6) → _Problem Time Cum (%)_
    - `wvjobreport.summaryops` (w=30) → _Summaryops_
  - **Time Log** — `wvjobreporttimelog` (7 fields)
    - `wvjobreporttimelog.dttmstartcalc` (w=15) → _Start Date/Time (computed)_
    - `wvjobreporttimelog.dttmendcalc` (w=15) → _End Date/Time (computed)_
    - `wvjobreporttimelog.duration` (w=6) → _Duration Ation_
    - `wvjobreporttimelog.code2` (w=25) → _Code 2_
    - `wvjobreporttimelog.com` (w=50) → _Comment_
    - `wvjobreporttimelog.idrecjobprogramphasecalc` (w=25) → _Idrecjobprogramphase (computed)_
    - `wvjobreporttimelog.refnoproblemcalc` (w=15) → _Refnoproblem (computed)_

### Interval Problem - TimeTracks

- **HTML:** [Phase Analysis, Lessons & Problems/Interval Problem - TimeTracks.html](Phase%20Analysis%2C%20Lessons%20%26%20Problems/Interval%20Problem%20-%20TimeTracks.html)
- **Paper:** letter · **margins** [12, 12, 31, 25] (1/100 in)
- **Master template:** template portrait.afr
- **Root table:** `wvjobintervalproblem`
- **Blocks:** 2

  - **Job** — `wvjob` (5 fields)
    - `wvjob.wvtyp` (w=10) → _Wvtyp_
    - `wvjob.jobtyp` (w=10) → _Jobtyp_
    - `wvjob.afenumbercalc` (w=10) → _AFE Number_
    - `wvjob.estproblemtimecalc` (w=10) → _Estimate Problemtime (computed)_
    - `wvjob.estproblemcostcalc` (w=10) → _Estimate Problemcost (computed)_
  - **Interval Problem (NPT)** — `wvjobintervalproblem` (17 fields)
    - `wvjobintervalproblem.dttmstart` (w=10) → _Start Date/Time_
    - `wvjobintervalproblem.dttmend` (w=10) → _End Date/Time_
    - `wvjobintervalproblem.des` (w=10) → _Description_
    - `wvjobintervalproblem.typ` (w=10) → _Type_
    - `wvjobintervalproblem.estlosttime` (w=10) → _Estimate Losttime_
    - `wvjobintervalproblem.estcostoverride` (w=10) → _Estimate Costoverride_
    - `wvjobintervalproblem.excludefromproblemtime` (w=10) → _Excludefromproblemtime_
    - `wvjobintervalproblem.depthstart` (w=10) → _Depth Start_
    - `wvjobintervalproblem.depthtvdstartcalc` (w=10) → _Depth TVD Start (computed)_
    - `wvjobintervalproblem.depthend` (w=10) → _Depth End_
    - `wvjobintervalproblem.depthtvdendcalc` (w=10) → _Depth TVD End (computed)_
    - `wvjobintervalproblem.opscondition` (w=10) → _Opscondition_
    - `wvjobintervalproblem.severity` (w=10) → _Severity_
    - `wvjobintervalproblem.status` (w=10) → _Status_
    - `wvjobintervalproblem.actiontaken` (w=15) → _Actual Iontaken_
    - `wvjobintervalproblem.com` (w=50) → _Comment_
    - `wvjobintervalproblem.dttmend` (w=0) → _End Date/Time_

### Days vs Depth with Annotations

- **HTML:** [Phase Analysis, Lessons & Problems/Days vs Depth with Annotations.html](Phase%20Analysis%2C%20Lessons%20%26%20Problems/Days%20vs%20Depth%20with%20Annotations.html)
- **Paper:** letter · **margins** [12, 12, 31, 25] (1/100 in)
- **Master template:** template landscape header.afr
- **Root table:** `wvjob` · **filter:** wvjob / wvtyp / dril
- **Blocks:** 1

  - **Job** — `wvjob` (1 fields)
    - `wvjob.idrec` (w=0) → _Record ID_

## Production/General Input

### Annular Fluids

- **HTML:** [Production/General Input/Annular Fluids.html](Production/General%20Input/Annular%20Fluids.html)
- **Paper:** letter · **margins** [25, 25, 25, 25] (1/100 in)
- **Master template:** template portrait header cw.afr
- **Root table:** `wvwellbore`
- **Blocks:** 1

  - **Annularfluid** — `wvannularfluid` (9 fields)
    - `wvannularfluid.dttmstart` (w=9) → _Start Date/Time_
    - `wvannularfluid.dttmend` (w=9) → _End Date/Time_
    - `wvannularfluid.depthtop` (w=9) → _Top Depth_
    - `wvannularfluid.depthbtm` (w=9) → _Bottom Depth_
    - `wvannularfluid.idrecstring` (w=9) → _Idrecstring_
    - `wvannularfluid.typ` (w=9) → _Type_
    - `wvannularfluid.density` (w=9) → _Density_
    - `wvannularfluid.additives` (w=9) → _Additives_
    - `wvwellbore.idrec` (w=0) → _Record ID_

### Continuous Chemical Injection

- **HTML:** [Production/General Input/Continuous Chemical Injection.html](Production/General%20Input/Continuous%20Chemical%20Injection.html)
- **Paper:** letter · **margins** [25, 25, 25, 25] (1/100 in)
- **Master template:** template portrait header cw.afr
- **Root table:** `None`
- **Blocks:** 1

  - **Chemicalinjection** — `wvchemicalinjection` (8 fields)
    - `wvchemicalinjection.typ` (w=10) → _Type_
    - `wvchemicalinjection.purpose` (w=10) → _Purpose_
    - `wvchemicalinjection.dttmstart` (w=10) → _Start Date/Time_
    - `wvchemicalinjection.dttmend` (w=10) → _End Date/Time_
    - `wvchemicalinjection.productname` (w=10) → _Productname_
    - `wvchemicalinjection.amount` (w=10) → _Amount_
    - `wvchemicalinjection.unitlabel` (w=10) → _Unitlabel_
    - `wvchemicalinjection.vendor` (w=10) → _Vendor_

### Downhole Well Profile

- **HTML:** [Production/General Input/Downhole Well Profile.html](Production/General%20Input/Downhole%20Well%20Profile.html)
- **Paper:** letter · **margins** [25, 25, 25, 25] (1/100 in)
- **Master template:** template portrait header cw.afr
- **Root table:** `wvwellbore` · **filter:** wvtub / dttmpull
- **Blocks:** 9

  - **Cas** — `wvcas` (6 fields)
    - `wvcas.des` (w=18) → _Description_
    - `wvcas.szodnommaxcalc` (w=9) → _Szodnommax (computed)_
    - `wvcas.wtperlengthcalc` (w=9) → _Wtperlength (computed)_
    - `wvcas.gradecalc` (w=9) → _Grade (computed)_
    - `wvcas.connthrdtopcalc` (w=10) → _Connthrdtop (computed)_
    - `wvcas.depthbtm` (w=9) → _Bottom Depth_
  - **Perforation** — `wvperforation` (4 fields)
    - `wvperforation.dttm` (w=9) → _Dttm_
    - `wvperforation.depthtop` (w=9) → _Top Depth_
    - `wvperforation.depthbtm` (w=9) → _Bottom Depth_
    - `wvperforation.idreczone` (w=18) → _Idreczone_
  - **Tub** — `wvtub` (4 fields)
    - `wvtub.des` (w=9) → _Description_
    - `wvtub.dttmrun` (w=9) → _Date/Time Run_
    - `wvtub.lengthcalc` (w=9) → _Length (computed)_
    - `wvtub.depthbtm` (w=9) → _Bottom Depth_
  - **Tubcomp** — `wvtubcomp` (8 fields)
    - `wvtubcomp.des` (w=25) → _Description_
    - `wvtubcomp.joints` (w=4) → _Joints_
    - `wvtubcomp.make` (w=15) → _Make_
    - `wvtubcomp.model` (w=15) → _Model_
    - `wvtubcomp.szodnom` (w=7) → _Szodnom_
    - `wvtubcomp.wtperlength` (w=8) → _Wtperlength_
    - `wvtubcomp.grade` (w=7) → _Grade_
    - `wvtubcomp.length` (w=7) → _Length_
  - **Rod String** — `wvrod` (4 fields)
    - `wvrod.des` (w=9) → _Description_
    - `wvrod.dttmrun` (w=9) → _Date/Time Run_
    - `wvrod.lengthcalc` (w=9) → _Length (computed)_
    - `wvrod.depthbtm` (w=9) → _Bottom Depth_
  - **Rodcomp** — `wvrodcomp` (8 fields)
    - `wvrodcomp.des` (w=25) → _Description_
    - `wvrodcomp.joints` (w=4) → _Joints_
    - `wvrodcomp.make` (w=15) → _Make_
    - `wvrodcomp.model` (w=15) → _Model_
    - `wvrodcomp.szodnom` (w=7) → _Szodnom_
    - `wvrodcomp.wtperlength` (w=8) → _Wtperlength_
    - `wvrodcomp.grade` (w=7) → _Grade_
    - `wvrodcomp.length` (w=7) → _Length_
  - **& production\tubing and rods.sch** — `wvrod` (1 fields)
    - `wvwellbore.idrec` (w=0) → _Record ID_
  - **Wellhead** — `wvwellhead` (1 fields)
    - `wvwellhead.typ` (w=15) → _Type_
  - **Wellheadcomp** — `wvwellheadcomp` (8 fields)
    - `wvwellheadcomp.des` (w=20) → _Description_
    - `wvwellheadcomp.make` (w=9) → _Make_
    - `wvwellheadcomp.model` (w=9) → _Model_
    - `wvwellheadcomp.workpres` (w=9) → _Workpres_
    - `wvwellheadcomp.service` (w=9) → _Service_
    - `wvwellheadcomp.workprestop` (w=18) → _Workprestop_
    - `wvwellheadcomp.ringgaskettop` (w=9) → _Ringgaskettop_
    - `wvwellheadcomp.minbore` (w=9) → _Min Bore_

### Equipment Failures

- **HTML:** [Production/General Input/Equipment Failures.html](Production/General%20Input/Equipment%20Failures.html)
- **Paper:** letter · **margins** [12, 12, 31, 25] (1/100 in)
- **Master template:** template landscape header cw.afr
- **Root table:** `None`
- **Blocks:** 2

  - **Problem** — `wvproblem` (15 fields)
    - `wvproblem.dttmstart` (w=10) → _Start Date/Time_
    - `wvproblem.des` (w=10) → _Description_
    - `wvproblem.typ` (w=10) → _Type_
    - `wvproblem.cause` (w=10) → _Cause_
    - `wvproblem.priority` (w=10) → _Priority_
    - `wvproblem.status` (w=10) → _Status_
    - `wvproblem.dttmaction` (w=10) → _Date/Time Actual Ion_
    - `wvproblem.actiontaken` (w=10) → _Actual Iontaken_
    - `wvproblem.dttmend` (w=10) → _End Date/Time_
    - `wvproblem.estcost` (w=10) → _Estimate Cost_
    - `wvproblem.subitem` (w=10) → _Subitem_
    - `wvproblem.metallurgy` (w=10) → _Metallurgy_
    - `wvproblem.idrecfaileditem` (w=10) → _Idrecfaileditem_
    - `wvproblem.idreczone` (w=10) → _Idreczone_
    - `wvproblem.com` (w=50) → _Comment_
  - **Equipment Details** — `wvproblemdetailcalc` (8 fields)
    - `wvproblemdetailcalc.des` (w=25) → _Description_
    - `wvproblemdetailcalc.dttmrun` (w=10) → _Date/Time Run_
    - `wvproblemdetailcalc.dttmpull` (w=10) → _Date/Time Pull_
    - `wvproblemdetailcalc.szodnom` (w=7) → _Szodnom_
    - `wvproblemdetailcalc.wtperlength` (w=8) → _Wtperlength_
    - `wvproblemdetailcalc.grade` (w=8) → _Grade_
    - `wvproblemdetailcalc.conditionrun` (w=15) → _Conditionrun_
    - `wvproblemdetailcalc.conditionpull` (w=15) → _Conditionpull_

### Equipment Pressure Tests

- **HTML:** [Production/General Input/Equipment Pressure Tests.html](Production/General%20Input/Equipment%20Pressure%20Tests.html)
- **Paper:** letter · **margins** [25, 25, 25, 25] (1/100 in)
- **Master template:** template portrait header cw.afr
- **Root table:** `wvwellheader`
- **Blocks:** 3

  - **& production\tubing and rods.sch** — `wvwellbore` (1 fields)
    - `wvwellbore.idrec` (w=0) → _Record ID_
  - **Testequip** — `wvtestequip` (13 fields)
    - `wvtestequip.dttm` (w=10) → _Dttm_
    - `wvtestequip.testtyp` (w=10) → _Testtyp_
    - `wvtestequip.testsubtyp` (w=10) → _Testsubtyp_
    - `wvtestequip.testfluidtyp` (w=10) → _Testfluidtyp_
    - `wvtestequip.failflag` (w=5) → _Failflag_
    - `wvtestequip.dttmnexttest` (w=10) → _Date/Time Nexttest_
    - `wvtestequip.operator` (w=10) → _Operator_
    - `wvtestequip.fluiddensity` (w=10) → _Fluiddensity_
    - `wvtestequip.volpumped` (w=10) → _Volpumped_
    - `wvtestequip.vollost` (w=10) → _Vollost_
    - `wvtestequip.wellpresused` (w=5) → _Wellpresused_
    - `wvtestequip.refnochart` (w=10) → _Refnochart_
    - `wvtestequip.com` (w=30) → _Comment_
  - **Testsssv** — `wvtestsssv` (12 fields)
    - `wvtestsssv.dttm` (w=8) → _Dttm_
    - `wvtestsssv.idrectubcomp` (w=8) → _Idrectubcomp_
    - `wvtestsssv.presmaxdiff` (w=8) → _Presmaxdiff_
    - `wvtestsssv.correctactrqd` (w=8) → _Correctactrqd_
    - `wvtestsssv.presctrlln` (w=8) → _Presctrlln_
    - `wvtestsssv.presctrllnbldup` (w=8) → _Presctrllnbldup_
    - `wvtestsssv.tmctrllnbldup` (w=8) → _Tmctrllnbldup_
    - `wvtestsssv.presctrllnbleeddwn` (w=8) → _Presctrllnbleeddwn_
    - `wvtestsssv.prestubingbldup` (w=8) → _Prestubingbldup_
    - `wvtestsssv.tmtubingbldup` (w=8) → _Tmtubingbldup_
    - `wvtestsssv.prestubingbleeddwn` (w=8) → _Prestubingbleeddwn_
    - `wvtestsssv.preswhsensortrip` (w=8) → _Preswhsensortrip_

### Fluid Analysis - Gas

- **HTML:** [Production/General Input/Fluid Analysis - Gas.html](Production/General%20Input/Fluid%20Analysis%20-%20Gas.html)
- **Paper:** letter · **margins** [25, 25, 25, 25] (1/100 in)
- **Master template:** template portrait.afr
- **Root table:** `wvwellheader` · **filter:** wvfluidanalysis / wvfluidanalysis / analysistyp
- **Blocks:** 3

  - **Fluidanalysis** — `wvfluidanalysis` (25 fields)
    - `wvfluidanalysis.analysistyp` (w=10) → _Analysistyp_
    - `wvfluidanalysis.dttmreport` (w=10) → _Date/Time Report_
    - `wvfluidanalysis.idreczone` (w=10) → _Idreczone_
    - `wvfluidanalysis.depthtop` (w=10) → _Top Depth_
    - `wvfluidanalysis.depthbtm` (w=10) → _Bottom Depth_
    - `wvfluidanalysis.des` (w=10) → _Description_
    - `wvfluidanalysis.testedby` (w=10) → _Testedby_
    - `wvfluidanalysis.dttmsample` (w=10) → _Date/Time Sample_
    - `wvfluidanalysis.dttmreceived` (w=10) → _Date/Time Received_
    - `wvfluidanalysis.locsample` (w=10) → _Locsample_
    - `wvfluidanalysis.refnolaboratory` (w=10) → _Refnolaboratory_
    - `wvfluidanalysis.analyst` (w=20) → _Analyst_
    - `wvfluidanalysis.refnotest` (w=10) → _Refnotest_
    - `wvfluidanalysis.refnosample` (w=10) → _Refnosample_
    - `wvfluidanalysis.presseparator` (w=10) → _Presseparator_
    - `wvfluidanalysis.presreservoir` (w=10) → _Presreservoir_
    - `wvfluidanalysis.presgaugesource` (w=10) → _Presgaugesource_
    - `wvfluidanalysis.pressample` (w=10) → _Pressample_
    - `wvfluidanalysis.pressamplerec` (w=10) → _Pressamplerec_
    - `wvfluidanalysis.tempseparator` (w=10) → _Tempseparator_
    - `wvfluidanalysis.tempreservoir` (w=10) → _Tempreservoir_
    - `wvfluidanalysis.tempgaugesource` (w=10) → _Tempgaugesource_
    - `wvfluidanalysis.tempsample` (w=10) → _Tempsample_
    - `wvfluidanalysis.tempsamplerec` (w=10) → _Tempsamplerec_
    - `wvfluidanalysis.com` (w=50) → _Comment_
  - **Fluidanalysisgas** — `wvfluidanalysisgas` (22 fields)
    - `wvfluidanalysisgas.valmoistfreegrossheat` (w=5) → _Valmoistfreegrossheat_
    - `wvfluidanalysisgas.valmoistacidfreegrossheat` (w=5) → _Valmoistacidfreegrossheat_
    - `wvfluidanalysisgas.presgrossheatref` (w=5) → _Presgrossheatref_
    - `wvfluidanalysisgas.temprefgrossheat` (w=5) → _Temprefgrossheat_
    - `wvfluidanalysisgas.densitysample` (w=10) → _Densitysample_
    - `wvfluidanalysisgas.densitysamplerel` (w=10) → _Densitysamplerel_
    - `wvfluidanalysisgas.molecularmasstotalsample` (w=10) → _Molecularmasstotalsample_
    - `wvfluidanalysisgas.presreftotalsample` (w=10) → _Presreftotalsample_
    - `wvfluidanalysisgas.tempreftotalsample` (w=10) → _Tempreftotalsample_
    - `wvfluidanalysisgas.densityc7` (w=10) → _Densityc7_
    - `wvfluidanalysisgas.densityc7rel` (w=10) → _Densityc7Rel_
    - `wvfluidanalysisgas.molecularmassc7` (w=10) → _Molecularmassc7_
    - `wvfluidanalysisgas.presrefc7` (w=10) → _Presrefc7_
    - `wvfluidanalysisgas.temprefc7` (w=10) → _Temprefc7_
    - `wvfluidanalysisgas.prespcsample` (w=10) → _Prespcsample_
    - `wvfluidanalysisgas.temppcsample` (w=10) → _Temppcsample_
    - `wvfluidanalysisgas.prespcacidgasfree` (w=10) → _Prespcacidgasfree_
    - `wvfluidanalysisgas.temppcacidgasfree` (w=10) → _Temppcacidgasfree_
    - `wvfluidanalysisgas.h2s` (w=10) → _H2S_
    - `wvfluidanalysisgas.h2smethod` (w=10) → _H2Smethod_
    - `wvfluidanalysisgas.presvapourpentane` (w=10) → _Presvapourpentane_
    - `wvfluidanalysisgas.com` (w=50) → _Comment_
  - **Pseudo Critical Properties** — `wvfluidanalysisgascomp` (5 fields)
    - `wvfluidanalysisgascomp.component` (w=10) → _Component_
    - `wvfluidanalysisgascomp.molefracairfree` (w=10) → _Molefracairfree_
    - `wvfluidanalysisgascomp.molefracacidgasfree` (w=10) → _Molefracacidgasfree_
    - `wvfluidanalysisgascomp.petroleumliquid` (w=10) → _Petroleumliquid_
    - `wvfluidanalysisgascomp.note` (w=10) → _Note_

### Fluid Analysis - Hydrocarbon Liquid

- **HTML:** [Production/General Input/Fluid Analysis - Hydrocarbon Liquid.html](Production/General%20Input/Fluid%20Analysis%20-%20Hydrocarbon%20Liquid.html)
- **Paper:** letter · **margins** [25, 25, 25, 25] (1/100 in)
- **Master template:** template portrait.afr
- **Root table:** `wvwellheader` · **filter:** wvfluidanalysis / wvfluidanalysis / analysistyp
- **Blocks:** 3

  - **Fluidanalysis** — `wvfluidanalysis` (25 fields)
    - `wvfluidanalysis.analysistyp` (w=10) → _Analysistyp_
    - `wvfluidanalysis.dttmreport` (w=10) → _Date/Time Report_
    - `wvfluidanalysis.idreczone` (w=10) → _Idreczone_
    - `wvfluidanalysis.depthtop` (w=10) → _Top Depth_
    - `wvfluidanalysis.depthbtm` (w=10) → _Bottom Depth_
    - `wvfluidanalysis.des` (w=10) → _Description_
    - `wvfluidanalysis.testedby` (w=10) → _Testedby_
    - `wvfluidanalysis.dttmsample` (w=10) → _Date/Time Sample_
    - `wvfluidanalysis.dttmreceived` (w=10) → _Date/Time Received_
    - `wvfluidanalysis.locsample` (w=10) → _Locsample_
    - `wvfluidanalysis.refnolaboratory` (w=10) → _Refnolaboratory_
    - `wvfluidanalysis.analyst` (w=20) → _Analyst_
    - `wvfluidanalysis.refnotest` (w=10) → _Refnotest_
    - `wvfluidanalysis.refnosample` (w=10) → _Refnosample_
    - `wvfluidanalysis.presseparator` (w=10) → _Presseparator_
    - `wvfluidanalysis.presreservoir` (w=10) → _Presreservoir_
    - `wvfluidanalysis.presgaugesource` (w=10) → _Presgaugesource_
    - `wvfluidanalysis.pressample` (w=10) → _Pressample_
    - `wvfluidanalysis.pressamplerec` (w=10) → _Pressamplerec_
    - `wvfluidanalysis.tempseparator` (w=10) → _Tempseparator_
    - `wvfluidanalysis.tempreservoir` (w=10) → _Tempreservoir_
    - `wvfluidanalysis.tempgaugesource` (w=10) → _Tempgaugesource_
    - `wvfluidanalysis.tempsample` (w=10) → _Tempsample_
    - `wvfluidanalysis.tempsamplerec` (w=10) → _Tempsamplerec_
    - `wvfluidanalysis.com` (w=50) → _Comment_
  - **Fluidanalysisliquid** — `wvfluidanalysisliquid` (14 fields)
    - `wvfluidanalysisliquid.densityc7` (w=10) → _Densityc7_
    - `wvfluidanalysisliquid.densityrelc7` (w=10) → _Densityrelc7_
    - `wvfluidanalysisliquid.molecularmassrel` (w=10) → _Molecularmassrel_
    - `wvfluidanalysisliquid.temprefc7` (w=5) → _Temprefc7_
    - `wvfluidanalysisliquid.apic7` (w=10) → _Apic7_
    - `wvfluidanalysisliquid.temprefapic7` (w=5) → _Temprefapic7_
    - `wvfluidanalysisliquid.densitysample` (w=10) → _Densitysample_
    - `wvfluidanalysisliquid.densityrelsample` (w=10) → _Densityrelsample_
    - `wvfluidanalysisliquid.molecularmasssample` (w=10) → _Molecularmasssample_
    - `wvfluidanalysisliquid.temprefsample` (w=5) → _Temprefsample_
    - `wvfluidanalysisliquid.apisample` (w=10) → _Apisample_
    - `wvfluidanalysisliquid.temprefapisample` (w=5) → _Temprefapisample_
    - `wvfluidanalysisliquid.factorgasequiv` (w=5) → _Factorgasequiv_
    - `wvfluidanalysisliquid.com` (w=45) → _Comment_
  - **Total Sample Properties** — `wvfluidanalysisliquidcomp` (5 fields)
    - `wvfluidanalysisliquidcomp.component` (w=10) → _Component_
    - `wvfluidanalysisliquidcomp.molefrac` (w=10) → _Molefrac_
    - `wvfluidanalysisliquidcomp.massfrac` (w=10) → _Massfrac_
    - `wvfluidanalysisliquidcomp.volumefrac` (w=10) → _Volumefrac_
    - `wvfluidanalysisliquidcomp.note` (w=20) → _Note_

### Fluid Analysis - Oil

- **HTML:** [Production/General Input/Fluid Analysis - Oil.html](Production/General%20Input/Fluid%20Analysis%20-%20Oil.html)
- **Paper:** letter · **margins** [25, 25, 25, 25] (1/100 in)
- **Master template:** template portrait.afr
- **Root table:** `wvwellheader` · **filter:** wvfluidanalysis / wvfluidanalysis / analysistyp
- **Blocks:** 4

  - **Fluidanalysis** — `wvfluidanalysis` (25 fields)
    - `wvfluidanalysis.analysistyp` (w=10) → _Analysistyp_
    - `wvfluidanalysis.dttmreport` (w=10) → _Date/Time Report_
    - `wvfluidanalysis.idreczone` (w=10) → _Idreczone_
    - `wvfluidanalysis.depthtop` (w=10) → _Top Depth_
    - `wvfluidanalysis.depthbtm` (w=10) → _Bottom Depth_
    - `wvfluidanalysis.des` (w=10) → _Description_
    - `wvfluidanalysis.testedby` (w=10) → _Testedby_
    - `wvfluidanalysis.dttmsample` (w=10) → _Date/Time Sample_
    - `wvfluidanalysis.dttmreceived` (w=10) → _Date/Time Received_
    - `wvfluidanalysis.locsample` (w=10) → _Locsample_
    - `wvfluidanalysis.refnolaboratory` (w=10) → _Refnolaboratory_
    - `wvfluidanalysis.analyst` (w=20) → _Analyst_
    - `wvfluidanalysis.refnotest` (w=10) → _Refnotest_
    - `wvfluidanalysis.refnosample` (w=10) → _Refnosample_
    - `wvfluidanalysis.presseparator` (w=10) → _Presseparator_
    - `wvfluidanalysis.presreservoir` (w=10) → _Presreservoir_
    - `wvfluidanalysis.presgaugesource` (w=10) → _Presgaugesource_
    - `wvfluidanalysis.pressample` (w=10) → _Pressample_
    - `wvfluidanalysis.pressamplerec` (w=10) → _Pressamplerec_
    - `wvfluidanalysis.tempseparator` (w=10) → _Tempseparator_
    - `wvfluidanalysis.tempreservoir` (w=10) → _Tempreservoir_
    - `wvfluidanalysis.tempgaugesource` (w=10) → _Tempgaugesource_
    - `wvfluidanalysis.tempsample` (w=10) → _Tempsample_
    - `wvfluidanalysis.tempsamplerec` (w=10) → _Tempsamplerec_
    - `wvfluidanalysis.com` (w=50) → _Comment_
  - **Fluidanalysisoil** — `wvfluidanalysisoil` (32 fields)
    - `wvfluidanalysisoil.color` (w=10) → _Color_
    - `wvfluidanalysisoil.bsw` (w=10) → _Bsw_
    - `wvfluidanalysisoil.densityrelasreceived` (w=10) → _Densityrelasreceived_
    - `wvfluidanalysisoil.densityrelafterclean` (w=10) → _Densityrelafterclean_
    - `wvfluidanalysisoil.densityasreceived` (w=10) → _Densityasreceived_
    - `wvfluidanalysisoil.densityafterclean` (w=10) → _Densityafterclean_
    - `wvfluidanalysisoil.densityreftemp` (w=5) → _Densityreftemp_
    - `wvfluidanalysisoil.apigravityasreceived` (w=10) → _Apigravityasreceived_
    - `wvfluidanalysisoil.apigravityafterclean` (w=10) → _Apigravityafterclean_
    - `wvfluidanalysisoil.temprefapigravity` (w=5) → _Temprefapigravity_
    - `wvfluidanalysisoil.sulphur` (w=10) → _Sulphur_
    - `wvfluidanalysisoil.salt` (w=10) → _Salt_
    - `wvfluidanalysisoil.presvapour` (w=10) → _Presvapour_
    - `wvfluidanalysisoil.temppourpoint` (w=10) → _Temppourpoint_
    - `wvfluidanalysisoil.waxpercent` (w=10) → _Waxpercent_
    - `wvfluidanalysisoil.asphaltene` (w=10) → _Asphaltene_
    - `wvfluidanalysisoil.tempflashpointcc` (w=10) → _Tempflashpointcc_
    - `wvfluidanalysisoil.tempflashpointoc` (w=10) → _Tempflashpointoc_
    - `wvfluidanalysisoil.com` (w=50) → _Comment_
    - `wvfluidanalysisoil.distillmethod` (w=10) → _Distillmethod_
    - `wvfluidanalysisoil.presbarometric` (w=10) → _Presbarometric_
    - `wvfluidanalysisoil.temproom` (w=10) → _Temproom_
    - `wvfluidanalysisoil.tempboilinit` (w=10) → _Tempboilinit_
    - `wvfluidanalysisoil.volfracnaptha` (w=10) → _Volfracnaptha_
    - `wvfluidanalysisoil.temprefnaptha` (w=10) → _Temprefnaptha_
    - `wvfluidanalysisoil.volfrackerosene` (w=10) → _Volfrackerosene_
    - `wvfluidanalysisoil.temprefkerosene` (w=10) → _Temprefkerosene_
    - `wvfluidanalysisoil.volfracltgasoil` (w=10) → _Volfracltgasoil_
    - `wvfluidanalysisoil.temprefltgasoil` (w=10) → _Temprefltgasoil_
    - `wvfluidanalysisoil.volfracrecovered` (w=10) → _Volfracrecovered_
    - `wvfluidanalysisoil.volfracresidue` (w=10) → _Volfracresidue_
    - `wvfluidanalysisoil.volfracdistillloss` (w=10) → _Volfracdistillloss_
  - **Distillation Summary** — `wvfluidanalysisoildistill` (3 fields)
    - `wvfluidanalysisoildistill.volumefrac` (w=10) → _Volumefrac_
    - `wvfluidanalysisoildistill.temperature` (w=10) → _Temperature_
    - `wvfluidanalysisoildistill.note` (w=20) → _Note_
  - **Fluidanalysisoilvis** — `wvfluidanalysisoilvis` (4 fields)
    - `wvfluidanalysisoilvis.temperature` (w=10) → _Temperature_
    - `wvfluidanalysisoilvis.viscdynamic` (w=10) → _Viscdynamic_
    - `wvfluidanalysisoilvis.visckinematic` (w=10) → _Visckinematic_
    - `wvfluidanalysisoilvis.note` (w=10) → _Note_

### Fluid Analysis - Water

- **HTML:** [Production/General Input/Fluid Analysis - Water.html](Production/General%20Input/Fluid%20Analysis%20-%20Water.html)
- **Paper:** letter · **margins** [25, 25, 25, 25] (1/100 in)
- **Master template:** template portrait.afr
- **Root table:** `wvwellheader` · **filter:** wvfluidanalysis / wvfluidanalysis / analysistyp
- **Blocks:** 3

  - **Fluidanalysis** — `wvfluidanalysis` (25 fields)
    - `wvfluidanalysis.analysistyp` (w=10) → _Analysistyp_
    - `wvfluidanalysis.dttmreport` (w=10) → _Date/Time Report_
    - `wvfluidanalysis.idreczone` (w=10) → _Idreczone_
    - `wvfluidanalysis.depthtop` (w=10) → _Top Depth_
    - `wvfluidanalysis.depthbtm` (w=10) → _Bottom Depth_
    - `wvfluidanalysis.des` (w=10) → _Description_
    - `wvfluidanalysis.testedby` (w=10) → _Testedby_
    - `wvfluidanalysis.dttmsample` (w=10) → _Date/Time Sample_
    - `wvfluidanalysis.dttmreceived` (w=10) → _Date/Time Received_
    - `wvfluidanalysis.locsample` (w=10) → _Locsample_
    - `wvfluidanalysis.refnolaboratory` (w=10) → _Refnolaboratory_
    - `wvfluidanalysis.analyst` (w=20) → _Analyst_
    - `wvfluidanalysis.refnotest` (w=10) → _Refnotest_
    - `wvfluidanalysis.refnosample` (w=10) → _Refnosample_
    - `wvfluidanalysis.presseparator` (w=10) → _Presseparator_
    - `wvfluidanalysis.presreservoir` (w=10) → _Presreservoir_
    - `wvfluidanalysis.presgaugesource` (w=10) → _Presgaugesource_
    - `wvfluidanalysis.pressample` (w=10) → _Pressample_
    - `wvfluidanalysis.pressamplerec` (w=10) → _Pressamplerec_
    - `wvfluidanalysis.tempseparator` (w=10) → _Tempseparator_
    - `wvfluidanalysis.tempreservoir` (w=10) → _Tempreservoir_
    - `wvfluidanalysis.tempgaugesource` (w=10) → _Tempgaugesource_
    - `wvfluidanalysis.tempsample` (w=10) → _Tempsample_
    - `wvfluidanalysis.tempsamplerec` (w=10) → _Tempsamplerec_
    - `wvfluidanalysis.com` (w=50) → _Comment_
  - **Fluidanalysiswater** — `wvfluidanalysiswater` (15 fields)
    - `wvfluidanalysiswater.solidstotalevap` (w=10) → _Solidstotalevap_
    - `wvfluidanalysiswater.temprefsolidstotalevap` (w=10) → _Temprefsolidstotalevap_
    - `wvfluidanalysiswater.solidstotallignition` (w=10) → _Solidstotallignition_
    - `wvfluidanalysiswater.ph` (w=10) → _pH_
    - `wvfluidanalysiswater.temprefph` (w=5) → _Temprefph_
    - `wvfluidanalysiswater.h2s` (w=10) → _H2S_
    - `wvfluidanalysiswater.temprefh2s` (w=5) → _Temprefh2S_
    - `wvfluidanalysiswater.salinity` (w=10) → _Salinity_
    - `wvfluidanalysiswater.densityrel` (w=10) → _Densityrel_
    - `wvfluidanalysiswater.temprefdensityrel` (w=5) → _Temprefdensityrel_
    - `wvfluidanalysiswater.resistivity` (w=10) → _Resistivity_
    - `wvfluidanalysiswater.temprefresistivity` (w=5) → _Temprefresistivity_
    - `wvfluidanalysiswater.refractiveindex` (w=10) → _Refractiveindex_
    - `wvfluidanalysiswater.temprefrefractiveindex` (w=5) → _Temprefrefractiveindex_
    - `wvfluidanalysiswater.com` (w=50) → _Comment_
  - **Other Measurements** — `wvfluidanalysiswatercomp` (6 fields)
    - `wvfluidanalysiswatercomp.cationanion` (w=10) → _Cationanion_
    - `wvfluidanalysiswatercomp.ion` (w=10) → _Ion_
    - `wvfluidanalysiswatercomp.density` (w=10) → _Density_
    - `wvfluidanalysiswatercomp.massfrac` (w=10) → _Massfrac_
    - `wvfluidanalysiswatercomp.densityequiv` (w=10) → _Densityequiv_
    - `wvfluidanalysiswatercomp.note` (w=20) → _Note_

### Plunger Lift Assembly

- **HTML:** [Production/General Input/Plunger Lift Assembly.html](Production/General%20Input/Plunger%20Lift%20Assembly.html)
- **Paper:** letter · **margins** [25, 25, 25, 25] (1/100 in)
- **Master template:** template landscape.afr
- **Root table:** `wvwellbore` · **filter:** wvwellheader / wvotherinhole / 5; wvotherinhole / compsubtyp
- **Blocks:** 3

  - **In Hole (filtered for Equip typ ** — `wvotherinhole` (10 fields)
    - `wvotherinhole.des` (w=25) → _Description_
    - `wvotherinhole.iconname` (w=15) → _Iconname_
    - `wvotherinhole.depthtop` (w=10) → _Top Depth_
    - `wvotherinhole.depthtvdtopcalc` (w=10) → _Depth TVD Top (computed)_
    - `wvotherinhole.depthbtm` (w=10) → _Bottom Depth_
    - `wvotherinhole.depthtvdbtmcalc` (w=10) → _Depth TVD Btm (computed)_
    - `wvotherinhole.szodnom` (w=10) → _Szodnom_
    - `wvotherinhole.dttmrun` (w=10) → _Date/Time Run_
    - `wvotherinhole.dttmpull` (w=10) → _Date/Time Pull_
    - `wvotherinhole.compsubtyp` (w=10) → _Compsubtyp_
  - **Plunger Details** — `wvotherinholeplunger` (10 fields)
    - `wvotherinholeplunger.refno` (w=5) → _Refno_
    - `wvotherinholeplunger.typ` (w=10) → _Type_
    - `wvotherinholeplunger.make` (w=10) → _Make_
    - `wvotherinholeplunger.model` (w=10) → _Model_
    - `wvotherinholeplunger.sn` (w=10) → _Serial Number_
    - `wvotherinholeplunger.szod` (w=5) → _Szod_
    - `wvotherinholeplunger.length` (w=10) → _Length_
    - `wvotherinholeplunger.dttmrun` (w=10) → _Date/Time Run_
    - `wvotherinholeplunger.dttmpull` (w=10) → _Date/Time Pull_
    - `wvotherinholeplunger.pullreason` (w=10) → _Pullreason_
  - **Surfcontrolequip** — `wvsurfcontrolequip` (8 fields)
    - `wvsurfcontrolequip.dttmstart` (w=10) → _Start Date/Time_
    - `wvsurfcontrolequip.dttmend` (w=10) → _End Date/Time_
    - `wvsurfcontrolequip.typ` (w=10) → _Type_
    - `wvsurfcontrolequip.typdetail` (w=10) → _Typdetail_
    - `wvsurfcontrolequip.make` (w=10) → _Make_
    - `wvsurfcontrolequip.model` (w=10) → _Model_
    - `wvsurfcontrolequip.sn` (w=10) → _Serial Number_
    - `wvwellbore.idrec` (w=0) → _Record ID_

### Production Settings

- **HTML:** [Production/General Input/Production Settings.html](Production/General%20Input/Production%20Settings.html)
- **Paper:** letter · **margins** [25, 25, 25, 25] (1/100 in)
- **Master template:** template portrait header cw.afr
- **Root table:** `wvwellheader`
- **Blocks:** 6

  - **Prodsetting** — `wvprodsetting` (9 fields)
    - `wvprodsetting.dttmstart` (w=10) → _Start Date/Time_
    - `wvprodsetting.dttmend` (w=10) → _End Date/Time_
    - `wvprodsetting.prodmethtyp` (w=15) → _Prodmethtyp_
    - `wvprodsetting.idreczone` (w=15) → _Idreczone_
    - `wvprodsetting.prestub` (w=6) → _Prestub_
    - `wvprodsetting.prescas` (w=6) → _Prescas_
    - `wvprodsetting.settingobjective` (w=15) → _Settingobjective_
    - `wvprodsetting.settingresult` (w=15) → _Settingresult_
    - `wvprodsetting.com` (w=50) → _Comment_
  - **Prodsettingflow** — `wvprodsettingflow` (1 fields)
    - `wvprodsettingflow.chokesz` (w=5) → _Chokesz_
  - **Prodsettinggaslift** — `wvprodsettinggaslift` (2 fields)
    - `wvprodsettinggaslift.chokesz` (w=5) → _Chokesz_
    - `wvprodsettinggaslift.gasinjrate` (w=6) → _Gasinjrate_
  - **Prodsettingpcp** — `wvprodsettingpcp` (3 fields)
    - `wvprodsettingpcp.electriccurrent` (w=8) → _Electriccurrent_
    - `wvprodsettingpcp.rodtorque` (w=8) → _Rodtorque_
    - `wvprodsettingpcp.rpm` (w=5) → _Rpm_
  - **Prodsettingplunger** — `wvprodsettingplunger` (5 fields)
    - `wvprodsettingplunger.presopen` (w=6) → _Presopen_
    - `wvprodsettingplunger.tmarrival` (w=6) → _Tmarrival_
    - `wvprodsettingplunger.tmdelay` (w=6) → _Tmdelay_
    - `wvprodsettingplunger.tmopen` (w=6) → _Tmopen_
    - `wvprodsettingplunger.tmshutin` (w=6) → _Tmshutin_
  - **Prodsettingrodpump** — `wvprodsettingrodpump` (5 fields)
    - `wvprodsettingrodpump.pitmanpos` (w=5) → _Pitmanpos_
    - `wvprodsettingrodpump.strokelength` (w=7) → _Strokelength_
    - `wvprodsettingrodpump.spm` (w=5) → _Spm_
    - `wvprodsettingrodpump.loadpolishrodmax` (w=8) → _Loadpolishrodmax_
    - `wvprodsettingrodpump.rotationdir` (w=7) → _Rotationdir_
