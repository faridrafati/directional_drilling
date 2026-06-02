unit Unit41;

interface

uses
  Windows, Messages, SysUtils, Variants, Classes, Graphics, Controls, Forms,
  Dialogs, Menus, DB, Grids, DBGrids, ADODB, ExtCtrls, ComCtrls, StdCtrls, Mask,
  DBCtrls,math;
TYPE
  GRAPHING =RECORD
   PARTDESC:STRING;
   DEPTH:REAL;
   PRESS:REAL;
   GFRATE:REAL;
   MFRATE:REAL;
   VELO:REAL;
   KEGY:REAL;
  END;
type
  convertor = record
   name : string;
   conv : real;
  end;

TYPE
 AUPART = RECORD
   NOIT:INTEGER;
   QAT:REAL;
   TAT:REAL;
   GSG:REAL;
   SSG:REAL;
   GMOLWT:REAL;
   ELEV:REAL;
   DH:REAL;
   ODP:REAL;
   EH:REAL;
   EP:REAL;
   ROP:REAL;
   TGRD:REAL;
   DEPT1:REAL;
   DEPT2:REAL;
   FRATE:REAL;
   KEGY:REAL;
   MFRATE:REAL;
   MW:REAL;
   MVIS:REAL;
END;
TYPE
 DPPART = RECORD
   iden:integer;
   NOIT:INTEGER;
   QAT:REAL;
   TAT:REAL;
   GSG:REAL;
   GMOLWT:REAL;
   ELEV:REAL;
   DP:REAL;
   EP:REAL;
   TGRD:REAL;
   DEPT1:REAL;
   DEPT2:REAL;
   FRATE:REAL;
   KEGY:REAL;
   MFRATE:REAL;
   MW:REAL;
   MVIS:REAL;
END;
TYPE
 BLPART = RECORD
   QAT:REAL;
   TAT:REAL;
   GSG:REAL;
   GMOLWT:REAL;
   ELEV:REAL;
   LB:REAL;
   DB:REAL;
   KT:REAL;
   KV:REAL;
   VALVNO:REAL;
   EB:REAL;
   GFRATE:REAL;
   KEGY:REAL;

   MFRATE:REAL;
   MW:REAL;
   MVIS:REAL;
   ROP:REAL;
   SSG:REAL;
   DH:REAL;
END;
TYPE
 BTPART = RECORD
   QAT:REAL;
   TAT:REAL;
   GSG:REAL;
   GMOLWT:REAL;
   K:REAL;
   PBH:REAL;
   TGRD:REAL;
   DEPTH:REAL;
   JETS:ARRAY [1..15]OF REAL;
   FRATE:REAL;
   KEGY:REAL;
   MFRATE:REAL;
   MW:REAL;
END;


type
  TForm41 = class(TForm)
    MainMenu1: TMainMenu;
    File1: TMenuItem;
    New1: TMenuItem;
    Save1: TMenuItem;
    Saveas1: TMenuItem;
    LOAD1: TMenuItem;
    Exit1: TMenuItem;
    Options1: TMenuItem;
    Units1: TMenuItem;
    ADOConnection1: TADOConnection;
    TWELLHEADER: TADOTable;
    PageControl1: TPageControl;
    TabSheet1: TTabSheet;
    TabSheet2: TTabSheet;
    TabSheet3: TTabSheet;
    TabSheet4: TTabSheet;
    Panel1: TPanel;
    OpenDialog1: TOpenDialog;
    SaveDialog1: TSaveDialog;
    DBEdit1: TDBEdit;
    DBEdit2: TDBEdit;
    DBEdit3: TDBEdit;
    DBEdit4: TDBEdit;
    DBEdit5: TDBEdit;
    DBEdit6: TDBEdit;
    DBEdit7: TDBEdit;
    DBEdit8: TDBEdit;
    Label2: TLabel;
    Label3: TLabel;
    Label4: TLabel;
    Label5: TLabel;
    Label6: TLabel;
    Label7: TLabel;
    Label8: TLabel;
    Label9: TLabel;
    Label10: TLabel;
    Panel2: TPanel;
    Panel3: TPanel;
    Panel4: TPanel;
    DBNavigator2: TDBNavigator;
    DataSource1: TDataSource;
    TDRILLSTRING: TADOTable;
    TCASING: TADOTable;
    TBITRUN: TADOTable;
    DataSource2: TDataSource;
    DataSource3: TDataSource;
    DataSource4: TDataSource;
    Edit1: TEdit;
    Edit2: TEdit;
    DataSource5: TDataSource;
    teqlength: TADOTable;
    Label1: TLabel;
    DataSource6: TDataSource;
    tbitsize: TADOTable;
    ComboBox1: TComboBox;
    ComboBox2: TComboBox;
    Button1: TButton;
    Button2: TButton;
    DBEdit9: TDBEdit;
    Label11: TLabel;
    DBEdit10: TDBEdit;
    Label12: TLabel;
    Button3: TButton;
    DBEdit11: TDBEdit;
    Edit3: TEdit;
    Label13: TLabel;
    DBCheckBox1: TDBCheckBox;
    DBCheckBox2: TDBCheckBox;
    Edit4: TEdit;
    Edit5: TEdit;
    Label14: TLabel;
    DBEdit12: TDBEdit;
    RadioGroup1: TRadioGroup;
    ComboBox3: TComboBox;
    Label15: TLabel;
    StringGrid1: TStringGrid;
    StringGrid2: TStringGrid;
    Button4: TButton;
    Button5: TButton;
    COMBOBOX4: TComboBox;
    Tcasinge: TADOTable;
    ComboBox5: TComboBox;
    StringGrid4: TStringGrid;
    StringGrid5: TStringGrid;
    PopupMenu1: TPopupMenu;
    DeleteRow1: TMenuItem;
    ComboBox6: TComboBox;
    Button6: TButton;
    Button7: TButton;
    Panel5: TPanel;
    Panel6: TPanel;
    StringGrid6: TStringGrid;
    StringGrid7: TStringGrid;
    ComboBox7: TComboBox;
    ComboBox8: TComboBox;
    TBHA: TADOTable;
    ADOCommand1: TADOCommand;
    ComboBox9: TComboBox;
    Button8: TButton;
    Button9: TButton;
    BHALIST: TADOTable;
    Edit6: TEdit;
    Label16: TLabel;
    Label18: TLabel;
    Edit8: TEdit;
    Label17: TLabel;
    Edit7: TEdit;
    Label19: TLabel;
    Edit9: TEdit;
    StringGrid12: TStringGrid;
    StringGrid3: TStringGrid;
    Panel8: TPanel;
    Panel9: TPanel;
    StringGrid8: TStringGrid;
    RadioGroup2: TRadioGroup;
    Button10: TButton;
    procedure Exit1Click(Sender: TObject);
    procedure Units1Click(Sender: TObject);
    procedure FormCreate(Sender: TObject);
    procedure FormClose(Sender: TObject; var Action: TCloseAction);
    procedure Save1Click(Sender: TObject);
    procedure Saveas1Click(Sender: TObject);
    procedure LOAD1Click(Sender: TObject);
    procedure New1Click(Sender: TObject);
    procedure refresht;
    procedure deltemp;
    procedure SetupGridPickList(const FieldName, sql: string);
    procedure Button1Click(Sender: TObject);
    procedure Button2Click(Sender: TObject);
    procedure ComboBox2CloseUp(Sender: TObject);
    procedure ComboBox1CloseUp(Sender: TObject);
    procedure DBEdit11Change(Sender: TObject);
    procedure Button3Click(Sender: TObject);

    procedure sendtodbwellheader;
    procedure sendtodbbitrun;
    procedure sendtodbcasing;
    PROCEDURE SENDTODBBHA;


    procedure SENDTOWELLFORM;
    procedure SENDTOBITFORM;
    procedure SENDTOCASINGFORM;
    PROCEDURE SENDTOBHAFORM;

    procedure Edit3Exit(Sender: TObject);
    procedure Edit1Exit(Sender: TObject);
    procedure Edit4Exit(Sender: TObject);
    procedure Edit5Exit(Sender: TObject);
    procedure RadioGroup1Exit(Sender: TObject);
    procedure FormResize(Sender: TObject);
    procedure StringGrid3SelectCell(Sender: TObject; ACol, ARow: Integer;
      var CanSelect: Boolean);
    procedure newfilecreation;
    procedure Button4Click(Sender: TObject);
    PROCEDURE REFCOMBO4;
    procedure COMBOBOX4CloseUp(Sender: TObject);
    procedure Button5Click(Sender: TObject);
    procedure COMBOBOX4DropDown(Sender: TObject);
    procedure DBEdit2Exit(Sender: TObject);
    procedure DBEdit3Exit(Sender: TObject);
    procedure DBEdit4Exit(Sender: TObject);
    procedure DBEdit5Exit(Sender: TObject);
    procedure DBEdit6Exit(Sender: TObject);
    procedure DBEdit7Exit(Sender: TObject);
    procedure DBEdit8Exit(Sender: TObject);
    procedure dbnavtowell;
    procedure Edit1Change(Sender: TObject);
    procedure Edit2Change(Sender: TObject);
    PROCEDURE REFCOMBO2;
    PROCEDURE REFCOMBO6;
    PROCEDURE REFCOMBO9;
    procedure ComboBox2DropDown(Sender: TObject);
    procedure StringGrid4SelectCell(Sender: TObject; ACol, ARow: Integer;
      var CanSelect: Boolean);
    procedure StringGrid4DblClick(Sender: TObject);
    procedure StringGrid5SelectCell(Sender: TObject; ACol, ARow: Integer;
      var CanSelect: Boolean);
    procedure StringGrid5DrawCell(Sender: TObject; ACol, ARow: Integer;
      Rect: TRect; State: TGridDrawState);
    procedure PageControl1Resize(Sender: TObject);
    procedure ComboBox5CloseUp(Sender: TObject);
    procedure DeleteRow1Click(Sender: TObject);
    procedure StringGrid5DblClick(Sender: TObject);
    procedure Button7Click(Sender: TObject);
    procedure Button6Click(Sender: TObject);
    procedure ComboBox6DropDown(Sender: TObject);
    procedure ComboBox6CloseUp(Sender: TObject);
    procedure StringGrid5SetEditText(Sender: TObject; ACol, ARow: Integer;
      const Value: string);
    procedure StringGrid5Exit(Sender: TObject);
    procedure StringGrid5Enter(Sender: TObject);
    procedure StringGrid7DrawCell(Sender: TObject; ACol, ARow: Integer;
      Rect: TRect; State: TGridDrawState);
    procedure StringGrid7SelectCell(Sender: TObject; ACol, ARow: Integer;
      var CanSelect: Boolean);
    PROCEDURE BHAFILLER(QQ:string);
    procedure StringGrid7DblClick(Sender: TObject);
    procedure StringGrid6DblClick(Sender: TObject);
    procedure StringGrid6SelectCell(Sender: TObject; ACol, ARow: Integer;
      var CanSelect: Boolean);
    procedure ComboBox7CloseUp(Sender: TObject);
    procedure ComboBox8CloseUp(Sender: TObject);
    procedure Button9Click(Sender: TObject);
    procedure Button8Click(Sender: TObject);
    procedure StringGrid7SetEditText(Sender: TObject; ACol, ARow: Integer;
      const Value: string);
    FUNCTION WT(BHA:STRING;OD,ID:REAL):REAL;
    procedure StringGrid6Exit(Sender: TObject);
    PROCEDURE BYTWT(KKK:INTEGER);
    procedure Edit6Change(Sender: TObject);
    procedure Edit7Change(Sender: TObject);
    procedure Edit8Change(Sender: TObject);
    procedure ComboBox9DropDown(Sender: TObject);
    procedure ComboBox9CloseUp(Sender: TObject);
    procedure ComboBox7DropDown(Sender: TObject);
    procedure TabSheet5Resize(Sender: TObject);
    procedure Button10Click(Sender: TObject);
    procedure StringGrid8Exit(Sender: TObject);
    procedure ANP0(QAT,PG,TAT,GSG,SSG,MOLWT,ELEV,DH,ODP,EH,EP,ROP,tempgrad,DEPT1,DEPT2:REAL;VAR ANP,ANQ,ANV,ANK:REAL);
    procedure ANP3(QAT,PG,TAT,GSG,SSG,MOLWT,ELEV,DH,ODP,EH,EP,QM,MW,MVIS,ROP,tempgrad,DEPT1,DEPT2:REAL;VAR ANP,ANQ,ANV,ANK:REAL);
    procedure DPP0(QAT,PG,TAT,GSG,MOLWT,ELEV,DP,EP,tempgrad,DEPT1,DEPT2:REAL;VAR DPP,DPQ,DPV,DPK:REAL);
    PROCEDURE DPP3(QAT,PG,TAT,GSG,MOLWT,ELEV,DP,EP,QM,MW,MVIS,tempgrad,DEPT1,DEPT2:REAL;VAR DPP,DPQ,DPV,DPK:REAL);
    procedure BLP0(QAT,TAT,GSG,MOLWT,ELEV,LB,DB,KT,KV,VALVNO,EP:REAL;VAR BLP,BLQ,BLV,BLK:REAL);
    PROCEDURE BLP3(QAT,TAT,GSG,MOLWT,ELEV,LB,DB,KT,KV,VALVNO,EP ,QM,MW,MVIS,SSG,ROP,DH:REAL;VAR BLP,BLQ,BLV,BLK:REAL);
    procedure JTP0(QAT,TAT,GSG,MOLWT,ELEV,K,PBH,tempgrad,DEPTH:REAL;JETS:ARRAY OF REAL;VAR BTP,BTQ,BTV,BTK:REAL);
    procedure JTP3(QAT,TAT,GSG,MOLWT,ELEV,K,PBH,tempgrad,DEPTH,QM,MW:REAL;JETS:ARRAY OF REAL;VAR BTP,BTQ,BTV,BTK:REAL);
    PROCEDURE CALCULATE(CALCTYPE:INTEGER;depthing:real;descpart:string);
    PROCEDURE ANUPARTFINDER(WLNM,CSGNAME,BHANAME,bitrun:STRING);
    PROCEDURE STRPARTFINDER(WLNM,CSGNAME,BHANAME,bitrun:STRING);
    PROCEDURE BITPARTFINDER(WLNM,bitrun:STRING);
    PROCEDURE BLNPARTFINDER(WLNM,bitrun:STRING);
    PROCEDURE REPORTFILLER(PG:ARRAY OF GRAPHING;JJ:INTEGER);
    PROCEDURE DETAILFILLER(PGD:ARRAY OF GRAPHING;JJ:INTEGER);
    PROCEDURE ARBITYFILLER(APG:GRAPHING);
    function StringIsDigit (s: AnsiString):Boolean;
    procedure StringGrid1KeyPress(Sender: TObject; var Key: Char);
    procedure StringGrid8KeyUp(Sender: TObject; var Key: Word;
      Shift: TShiftState);
    procedure StringGrid1KeyUp(Sender: TObject; var Key: Word;
      Shift: TShiftState);
    procedure StringGrid2KeyUp(Sender: TObject; var Key: Word;
      Shift: TShiftState);
    procedure StringGrid12KeyUp(Sender: TObject; var Key: Word;
      Shift: TShiftState);
    procedure RadioGroup2Click(Sender: TObject);
  private
    { Private declarations }
  public
    { Public declarations }
  end;

var
  Form41: TForm41;
  OLDFILES:STRING;
  cnv: array[0..8] of convertor;
  ANNULUS:ARRAY[1..1500] OF AUPART;
  STRINGS:ARRAY[1..1500] OF DPPART;
  BITSPEC: BTPART;
  BLNSPEC: BLPART;
  teqqq:integer;
  RST5,CST5,RST4,MRST5,MRDP7,RDP7,CDP7,RDP6,BHATYP:INTEGER;
implementation

uses Unit42, Unit43, Unit44;

{$R *.dfm}
function tform41.StringIsDigit (s: AnsiString):Boolean;
var
I,j : Integer;
  begin
   j:=0;
   Try
      Result := s <>'';
      for I:= 1 to Length(s) do
        begin
          if not (((s[i] >= '0') and (s[i] <= '9')))and(s[i]<>'.') then
            begin
              Result := False;
              Exit;
            end;
          if s[i]='.' then
            j:=j+1;
          if j>1 then
            begin
              Result := False;
              Exit;
            end;

        end;

    except
    result:=false;
    end;


end;
FUNCTION BTMTEMP(TG,ELEV,tempgrad:REAL):REAL;
BEGIN
 BTMTEMP:=(TG+tempgrad*ELEV);
END;
FUNCTION SURPRESS(ELEV:REAL):REAL;
BEGIN
 SURPRESS:=14.696*POWER(1-elev*2.25577/3.281/100000,5.25588);
END;
FUNCTION FF(D1,D2,EAVE:REAL):REAL;
BEGIN
 FF:=sqr(1/(2*Log10((D1-D2)/EAVE)+1.14));
END;
FUNCTION FFBL(RE,ID,EAVE:REAL):REAL;
BEGIN
 FFBL:=sqr(1/(-1.8*Log10(POWER((EAVE/3.7/ID),1.11)+6.9/RE)));
END;
FUNCTION EAVE(E1,D1,E2,D2:REAL):REAL;
BEGIN
 EAVE:=(E1*(PI/4)*D1*D1+E2*(PI/4)*D2*D2)/((PI/4)*D1*D1+(PI/4)*D2*D2);
END;
PROCEDURE TFORM41.ANP0(QAT,PG,TAT,GSG,SSG,MOLWT,ELEV,DH,ODP,EH,EP,ROP,tempgrad,DEPT1,DEPT2:REAL;VAR ANP,ANQ,ANV,ANK:REAL);
VAR
 WDOTS,TAV,R,GAMAGELEV,PAT,GAMAGAT,WDOTG,AAC,BAC:REAL;
begin
 R:=1545.349/MOLWT/GSG;
 PAT:=144*SURPRESS(ELEV);
 PG:=PG*144;
 TAV:=(BTMTEMP(TAT,DEPT1,tempgrad)+BTMTEMP(TAT,DEPT2,tempgrad))/2;
 GAMAGAT:=(PAT)*GSG/TAT/R;
 QAT:=QAT/448.815;
 WDOTG:=GAMAGAT*QAT;
 DH:=DH/12;
 WDOTS:=PI/4*DH*DH*62.4*SSG*(ROP/3600);
 ODP:=ODP/12;
 AAC:=(GSG/R)*(1+(WDOTS/WDOTG));
 BAC:=FF(DH,ODP,EAVE(EH,DH,EP,ODP))/(2*32.174*(DH-ODP))*(R/GSG)*(R/GSG)*(WDOTG/(PI/4)/(DH*DH-ODP*ODP))*(WDOTG/(PI/4)/(DH*DH-ODP*ODP));
 ANP:=SQRT((PG*PG+BAC*TAV*TAV)*EXP(2*AAC*(DEPT2-DEPT1)/TAV)-BAC*TAV*TAV);
 ANQ:=PAT/ANP*QAT*BTMTEMP(TAT,DEPT2,tempgrad)/TAT;
 ANV:=ANQ/((PI/4)*(DH*DH-ODP*ODP));
 ANK:=SQR(ANV)*ANP*GSG/BTMTEMP(TAT,DEPT2,tempgrad)/R/32.17/2;
 ANP:=ANP/144;
 ANQ:=ANQ*448.815;
 GAMAGELEV:=SURPRESS(ELEV)*GSG/R/(TAV);
 form41.Caption:=floattostr(SURPRESS(ELEV));
end;
PROCEDURE TFORM41.ANP3(QAT,PG,TAT,GSG,SSG,MOLWT,ELEV,DH,ODP,EH,EP,QM,MW,MVIS,ROP,tempgrad,DEPT1,DEPT2:REAL;VAR ANP,ANQ,ANV,ANK:REAL);
VAR
 WDOTS,TAV,R,GAMAGELEV,PAT,GAMAGAT,WDOTG,AAC,BAC,AANN,ES,WDOTM,WDOTT,ROM,NUUM,
 NUUG,NUUT,GVIS,ROG,VELT,SIMSUM,SIMCOF,ANLENT,RE,ANPL,FUNC,GAMAMIX:REAL;
 ANPVALUES:ARRAY[1..3]OF REAL;
 HH,II:INTEGER;
begin
 ANLENT:=DEPT2-DEPT1;
 GVIS:=0.012;
 ES:=0.0005;
 R:=1545.349/MOLWT/GSG;
 PAT:=144*SURPRESS(ELEV);
 PG:=PG*144;
 TAV:=(BTMTEMP(TAT,DEPT1,tempgrad)+BTMTEMP(TAT,DEPT2,tempgrad))/2;
 GAMAGAT:=(PAT)*GSG/TAT/R;
 QAT:=QAT/448.815;
 WDOTG:=GAMAGAT*QAT;
 QM:=QM*231/12/12/12/60;
 WDOTM:=QM*MW*7.48;
 DH:=DH/12;
 WDOTS:=PI/4*DH*DH*62.4*SSG*(ROP/3600);
 WDOTT:=WDOTG+WDOTM+WDOTS;
 ROG:=PG*GSG/TAV/32.17/R;
 ODP:=ODP/12;
 AANN:=PI/4*(DH*DH-ODP*ODP);
 ROM:=MW*7.48/32.17;
 NUUM:=MVIS*0.0006267/30/ROM;
 NUUG:=GVIS*0.0006267/30/(ROG);
 NUUT:=(NUUG*WDOTG+NUUM*WDOTM)/(WDOTG+WDOTM);
 VELT:=(QAT*PAT/PG*TAV/TAT+QM)/AANN;
 ANPVALUES[1]:=PG;
 ANPVALUES[3]:=1000*PG;
 ANPVALUES[2]:=ANPVALUES[3];



 SIMSUM:=2*ANLENT;
 while (ABS(SIMSUM-ANLENT)*100000)>(ANLENT) do
  BEGIN
   if SIMSUM>ANLENT then
     ANPVALUES[3]:=ANPVALUES[2]
   ELSE
     ANPVALUES[1]:=ANPVALUES[2];
   ANPVALUES[2]:=0.5*(ANPVALUES[1]+ANPVALUES[3]);
   ANPL:=PG;
   HH:=100;
   SIMSUM:=0;
   SIMCOF:=0;
   for II := 0 to HH do
    BEGIN
     if (II=0)OR(II=HH) then
       SIMCOF:=1
     ELSE
      BEGIN
       if (II MOD 2)=1 then
         SIMCOF:=4
       ELSE
         SIMCOF:=2;
      END;
     ANP:=ANPL+II/HH*(ANPVALUES[2]-ANPL);
     ANQ:=PAT/ANP*QAT*TAV/TAT+QM;
     ANV:=ANQ/(AANN);
     GAMAMIX:=WDOTT/(ANQ);
     RE:=VELT*(DH-ODP)/NUUT;
     FUNC:=2*32.17*(DH-ODP)/(GAMAMIX*(2*32.17*(DH-ODP)+ANV*ANV*FFBL(RE,(DH-ODP),EAVE(EH,DH,EP,ODP))));
     SIMSUM:=SIMSUM+SIMCOF*FUNC*(ANPVALUES[2]-ANPL)/(3*HH);
    END;
  END;
 if ANLENT=0 then
  BEGIN
   ANP:=PG;
   ANQ:=PAT/ANP*QAT*TAV/TAT+QM;
   ANV:=ANQ/(AANN);
   ANK:=SQR(ANV)*ANP*GSG/BTMTEMP(TAT,DEPT2,tempgrad)/R/32.17/2;
   ANP:=ANP/144;
   ANQ:=ANQ*448.815;
   GAMAGELEV:=SURPRESS(ELEV)*GSG/R/(TAV);
  END
 ELSE
  BEGIN
   ANK:=SQR(ANV)*ANP*GSG/BTMTEMP(TAT,DEPT2,tempgrad)/R/32.17/2;
   ANP:=ANP/144;
   ANQ:=ANQ*448.815;
   GAMAGELEV:=SURPRESS(ELEV)*GSG/R/(TAV);
   form41.Caption:=floattostr(SURPRESS(ELEV));
  END;
end;




PROCEDURE TFORM41.DPP0(QAT,PG,TAT,GSG,MOLWT,ELEV,DP,EP,tempgrad,DEPT1,DEPT2:REAL;VAR DPP,DPQ,DPV,DPK:REAL);
VAR
 WDOTS,TAV,R,GAMAGELEV,PAT,GAMAGAT,WDOTG,AAC,BAC:REAL;
begin
 R:=1545.349/MOLWT/GSG;
 PAT:=144*SURPRESS(ELEV);
 PG:=PG*144;
 TAV:=(BTMTEMP(TAT,dept1,tempgrad)+BTMTEMP(TAT,DEPT2,tempgrad))/2;
 GAMAGAT:=(PAT)*GSG/TAT/R;
 QAT:=QAT/448.815;
 WDOTG:=GAMAGAT*QAT;
 DP:=DP/12;
 AAC:=(GSG/R);
 BAC:=FF(DP,0,EP)/(2*32.174)*(R/GSG)*(R/GSG)*(WDOTG/(PI/4)/(DP*DP*DP))*(WDOTG/(PI/4)/(DP*DP));
 DPP:=SQRT((PG*PG+(BAC*TAV*TAV*(EXP(2*AAC*(DEPT2-DEPT1)/TAV)-1)))/EXP(2*AAC*(DEPT2-DEPT1)/TAV));
 DPQ:=PAT/DPP*QAT*BTMTEMP(TAT,DEPT2,tempgrad)/TAT;
 DPV:=DPQ/((PI/4)*(DP*DP));
 DPK:=SQR(DPV)*DPP*GSG/BTMTEMP(TAT,DEPT2,tempgrad)/R/32.17/2;
 DPP:=DPP/144;
 DPQ:=DPQ*448.815;

 GAMAGELEV:=SURPRESS(ELEV)*GSG/R/(TAV);
end;
PROCEDURE TFORM41.DPP3(QAT,PG,TAT,GSG,MOLWT,ELEV,DP,EP,QM,MW,MVIS,tempgrad,DEPT1,DEPT2:REAL;VAR DPP,DPQ,DPV,DPK:REAL);
VAR
 WDOTS,TAV,R,GAMAGELEV,PAT,GAMAGAT,WDOTG,AAC,BAC,GVIS,DPLENT,WDOTM,WDOTT,ADP
 ,ROG,ROM,NUUM,NUUG,NUUT,VELT,ES,SIMSUM,SIMCOF,FUNC,RE,GAMAMIX,DPPL,EXTRA:REAL;
 DPVALUES:ARRAY[1..3]OF REAL;
 HH,II:INTEGER;
begin
 ES:=0.00015;
 DPLENT:=ABS(DEPT2-DEPT1);
 GVIS:=0.012;
 R:=1545.349/MOLWT/GSG;
 PAT:=144*SURPRESS(ELEV);
 PG:=PG*144;
 TAV:=(BTMTEMP(TAT,dept1,tempgrad)+BTMTEMP(TAT,DEPT2,tempgrad))/2;
 GAMAGAT:=(PAT)*GSG/TAT/R;
 QAT:=QAT/448.815;
 WDOTG:=GAMAGAT*QAT;
 QM:=QM*231/12/12/12/60;
 WDOTM:=QM*MW*7.48;
 WDOTT:=WDOTG+WDOTM;
 DP:=DP/12;

 ROG:=PG*GSG/TAV/32.17/R;
 ADP:=PI/4*(DP*DP);
 ROM:=MW*7.48/32.17;
 NUUM:=MVIS*0.0006267/30/ROM;
 NUUG:=GVIS*0.0006267/30/(ROG);
 NUUT:=(NUUG*WDOTG+NUUM*WDOTM)/(WDOTG+WDOTM);
 VELT:=(QAT*PAT/PG*TAV/TAT+QM)/ADP;
 DPVALUES[1]:=PG;
 DPVALUES[3]:=1000*PG;
 DPVALUES[2]:=DPVALUES[3];



 SIMSUM:=2*DPLENT;
 while (ABS(SIMSUM-DPLENT)*100000)>(DPLENT) do
  BEGIN
   if SIMSUM>DPLENT then
     DPVALUES[3]:=DPVALUES[2]
   ELSE
     DPVALUES[1]:=DPVALUES[2];
   DPVALUES[2]:=0.5*(DPVALUES[1]+DPVALUES[3]);
   DPPL:=PG;
   HH:=100;
   SIMSUM:=0;
   SIMCOF:=0;
   for II := 0 to HH do
    BEGIN
     if (II=0)OR(II=HH) then
       SIMCOF:=1
     ELSE
      BEGIN
       if (II MOD 2)=1 then
         SIMCOF:=4
       ELSE
         SIMCOF:=2;
      END;
     DPP:=DPPL+II/HH*(DPVALUES[2]-DPPL);
     DPQ:=PAT/DPP*QAT*TAV/TAT+QM;
     DPV:=DPQ/(ADP);
     GAMAMIX:=WDOTT/(DPQ);
     RE:=DPV*(DP)/NUUT;
     FUNC:=2*32.17*(DP)/(GAMAMIX*(2*32.17*(DP)-DPV*DPV*FFBL(RE,(DP),ES)));
     SIMSUM:=SIMSUM+SIMCOF*FUNC*(DPVALUES[2]-DPPL)/(3*HH);
    END;
  END;
 DPP:=2*PG-DPP;
 DPQ:=PAT/DPP*QAT*TAV/TAT+QM;
 DPV:=DPQ/(ADP);
 DPK:=SQR(DPV)*DPP*GSG/BTMTEMP(TAT,DEPT2,tempgrad)/R/32.17/2;
 DPP:=DPP/144;
 DPQ:=DPQ*448.815;
 GAMAGELEV:=SURPRESS(ELEV)*GSG/R/(TAV);



end;
PROCEDURE TFORM41.BLP0(QAT,TAT,GSG,MOLWT,ELEV,LB,DB,KT,KV,VALVNO,EP:REAL;VAR BLP,BLQ,BLV,BLK:REAL);
VAR
 WDOTS,R,GAMAGELEV,PAT,GAMAGAT,WDOTG,ABL:REAL;
begin
 R:=1545.349/MOLWT/GSG;
 PAT:=144*SURPRESS(ELEV);
 GAMAGAT:=(PAT)*GSG/TAT/R;
 QAT:=QAT/448.815;
 WDOTG:=GAMAGAT*QAT;
 DB:=DB/12;
 ABL:=PI*DB*DB/4;
 BLP:=SQRT((FF(DB,0,EP)*LB/DB+KT+VALVNO*KV)*(SQR(WDOTG)*R*TAT/32.174/GSG/ABL*ABL)+SQR(PAT));
 BLQ:=PAT/BLP*QAT;
 BLV:=BLQ/((PI/4)*(DB*DB));
 BLK:=SQR(BLV)*BLP*GSG/TAT/R/32.17;
 BLP:=BLP/144;
 BLQ:=BLQ*448.815;
end;
PROCEDURE TFORM41.BLP3(QAT,TAT,GSG,MOLWT,ELEV,LB,DB,KT,KV,VALVNO,EP,QM,MW,MVIS,SSG,ROP,DH:REAL;
VAR BLP,BLQ,BLV,BLK:REAL);
VAR
 VELT,NUUT,WDOTS,WDOTM,WDOTT,R,GAMAGELEV,PAT,GAMAGAT
 ,KK,ALPHA,BETA,WDOTG,ABL,ROM,NUUM,NUUG,GVIS,RE,ES,GAMAMIX,FUNC,BLL,
 SIMCOF,SIMSUM:REAL;
  II,HH: Integer;
 BLVALUES:ARRAY[1..3]OF REAL;
begin

 GVIS:=0.012;
 ES:=0.0005;
 R:=1545.349/MOLWT/GSG;
 PAT:=144*SURPRESS(ELEV);
 GAMAGAT:=(PAT)*GSG/TAT/R;
 QAT:=QAT/448.815;
 WDOTG:=GAMAGAT*QAT;
 DB:=DB/12;
 ABL:=PI*DB*DB/4;
 QM:=QM*231/12/12/12/60;
 WDOTM:=QM*MW*7.48;
 DH:=DH/12;
 WDOTS:=62.4*SSG*PI/4*DH*DH*ROP/3600;
 WDOTT:=WDOTG+WDOTM+WDOTS;
 ROM:=MW*7.48/32.17;
 NUUM:=MVIS*0.0006267/30/ROM;
 NUUG:=GVIS*0.0006267/30/(GAMAGAT/32.17);
 NUUT:=(NUUG*WDOTG+NUUM*WDOTM)/(WDOTG+WDOTM);
 VELT:=(QAT+QM)/ABL;
 BLVALUES[1]:=PAT;
 BLVALUES[3]:=100*PAT;
 BLVALUES[2]:=BLVALUES[3];
 SIMSUM:=2*LB;
 while (ABS(SIMSUM-LB)*100000)>(LB) do
  BEGIN
   if SIMSUM>LB then
     BLVALUES[3]:=BLVALUES[2]
   ELSE
     BLVALUES[1]:=BLVALUES[2];
   BLVALUES[2]:=0.5*(BLVALUES[1]+BLVALUES[3]);
   BLL:=PAT;
   HH:=100;
   SIMSUM:=0;
   SIMCOF:=0;
   for II := 0 to HH do
    BEGIN
     if (II=0)OR(II=HH) then
       SIMCOF:=1
     ELSE
      BEGIN
       if (II MOD 2)=1 then
         SIMCOF:=4
       ELSE
         SIMCOF:=2;
      END;
     BLP:=BLL+II/HH*(BLVALUES[2]-BLL);
     BLQ:=PAT/BLP*QAT;
     BLV:=BLQ/((PI/4)*(DB*DB));
     GAMAMIX:=WDOTT/(BLQ+QM);
     RE:=VELT*DB/NUUT;
     FFBL(RE,DB,ES);
     FUNC:=2*32.17*DB/(GAMAMIX*BLV*BLV*FFBL(RE,DB,ES));
     SIMSUM:=SIMSUM+SIMCOF*FUNC*(BLVALUES[2]-BLL)/(3*HH);
    END;
  END;
 BLP:=BLP+GAMAMIX*(2*KV+KT)*BLV*BLV/2/32.17;
 BLK:=SQR(BLV)*BLP*GSG/TAT/R/32.17;
 BLP:=BLP/144;
 BLQ:=BLQ*448.815;
end;
function tfa(jets:array of real):real;
var
 ii:integer;
 SUM:REAL;
begin
 SUM:=0;
 for ii := 0 to 14 do
  begin
   SUM:=SUM+pi*sqr(jets[ii]/64);
  end;
 TFA:=SUM/144;
end;
PROCEDURE TFORM41.JTP0(QAT,TAT,GSG,MOLWT,elev,K,PBH,tempgrad,DEPTH:REAL;JETS:ARRAY OF REAL;VAR BTP,BTQ,BTV,BTK:REAL);
VAR
 GAMAG,R,PC,WDOTG,PAT,GAMAGAT,JTPRE,TJT:REAL;
begin
 R:=1545.349/MOLWT/GSG;
 PAT:=144*SURPRESS(ELEV);
 TJT:=BTMTEMP(TAT,deptH,tempgrad);
 GAMAGAT:=(PAT)*GSG/TAT/R;
 QAT:=QAT/448.815;
 WDOTG:=GAMAGAT*QAT;
 PBH:=144*PBH;
 GAMAG:=(PBH)*GSG/TJT/R;
 PC:=PBH/POWER(2/(K+1),K/(K-1));
 WDOTG:=GAMAGAT*QAT;
 JTPRE:=WDOTG*SQRT(BTMTEMP(TAT,DEPTH,tempgrad))/TFA(JETS)
 /SQRT(32.17*K*GSG/R*POWER(2/(K+1),((K+1)/(K-1))));
 if JTPRE<PC then
  BEGIN
   JTPRE:=PBH*POWER(1+(SQR(WDOTG/TFA(JETS))/(2*32.17*PBH*GAMAG*(K/(K-1)))),(K/(K-1)));
  END;
 BTP:=JTPRE;
 BTQ:=PAT/BTP*QAT*BTMTEMP(TAT,DEPTH,tempgrad)/TAT;
 BTV:=BTQ/TFA(JETS);
 BTK:=SQR(BTV)*BTP*GSG/BTMTEMP(TAT,DEPTH,tempgrad)/R/32.17/2;
 BTP:=BTP/144;
 BTQ:=BTQ*448.815;

end;
PROCEDURE TFORM41.JTP3(QAT,TAT,GSG,MOLWT,elev,K,PBH,tempgrad,DEPTH,QM,MW:REAL;JETS:ARRAY OF REAL;VAR BTP,BTQ,BTV,BTK:REAL);
VAR
 GAMAG,R,PC,WDOTG,PAT,GAMAGAT,JTPRE,TJT,WDOTM,WDOTT,NOQ,GAMAMIX,NOC:REAL;
begin
 NOC:=0.81;
 R:=1545.349/MOLWT/GSG;
 PAT:=144*SURPRESS(ELEV);
 TJT:=BTMTEMP(TAT,deptH,tempgrad);
 GAMAGAT:=(PAT)*GSG/TAT/R;
 QAT:=QAT/448.815;
 WDOTG:=GAMAGAT*QAT;
 QM:=QM*231/12/12/12/60;
 WDOTM:=QM*MW*7.48;
 WDOTT:=WDOTG+WDOTM;
 PBH:=144*PBH;
 NOQ:=PAT/PBH*QAT*TJT/TAT+QM;
 GAMAMIX:=WDOTT/(NOQ);
 JTPRE:=SQR(WDOTT/NOC/TFA(JETS))/2/32.17/GAMAMIX;
 BTP:=JTPRE;
 BTQ:=PAT/BTP*QAT*BTMTEMP(TAT,DEPTH,tempgrad)/TAT;
 BTV:=BTQ/TFA(JETS);
 BTK:=SQR(BTV)*BTP*GSG/BTMTEMP(TAT,DEPTH,tempgrad)/R/32.17/2;
 BTP:=BTP/144+PBH/144;
 BTQ:=BTQ*448.815;
end;

procedure tform41.sendtodbwellheader;
var
 ii,jj:integer;
begin
 if dbedit1.Text<>'' then
  begin
   teqlength.close;
   teqlength.TableName:='SurfaceEquipment';
   teqlength.Open;
   teqlength.First;
   II:=1;
   while II<(teqqq) do
    BEGIN
     teqlength.Next;
     II:=II+1;
    END;
   EDIT1.Text:=FLOATTOSTR(ROUND(TEQLENGTH.FieldByName('LENGTH').ASFLOAT/CNV[0].conv));
   if edit2.Text='' then
     edit2.Text:='0';
   if edit3.Text='' then
     edit3.Text:='0';
   if edit4.Text='' then
     edit4.Text:='0';
   if edit5.Text='' then
     edit5.Text:='0';
   TWELLHEADER.Open;
   TWELLHEADER.Edit;
   TWELLHEADER.FieldByName('EquivLength').asfloat:=(round(strtofloat(edit1.Text)*cnv[0].conv));
   TWELLHEADER.FieldByName('RiserFlowRate').asfloat:=((strtofloat(edit2.Text)*cnv[4].conv));
   TWELLHEADER.Post;
  end;
end;
procedure tform41.sendtodbcasing;
var
 ii,jj:integer;
begin
 TCASING.open;
 TCASING.First;
 if (TCASING.FieldByName('CASINGNAME').asstring=ComboBox6.Text)AND(TCASING.FieldByName('WELLNAME').asstring=DBEDIT1.Text) then
  begin
   TCASING.Delete;
  end;
 while (not TCASING.eof) do
  BEGIN
   TCASING.Next;
   if (TCASING.FieldByName('CASINGNAME').asstring=ComboBox6.Text)AND(TCASING.FieldByName('WELLNAME').asstring=DBEDIT1.Text) then
    begin
     TCASING.Delete;
    end;
  END;
 tcasing.Active:=true;
 II:=1;
 while STRINGGRID5.Cells[0,II]<>'' do
  II:=II+1;
 ii:=ii-1;
 for jj := 1 to ii do
  begin
   tcasing.open;
   tcasing.INSERT;
   tcasing.FieldByName('wellname').AsString:=dbedit1.Text;
   tcasing.FieldByName('CASINGNAME').AsString:=combobox6.Text;
   if stringgrid5.Cells[0,JJ]='' then
     stringgrid5.Cells[0,JJ]:='0';
   if stringgrid5.Cells[1,JJ]='' then
     stringgrid5.Cells[1,JJ]:='0';
   if stringgrid5.Cells[2,JJ]='' then
     stringgrid5.Cells[2,JJ]:='0';
   if stringgrid5.Cells[3,JJ]='' then
     stringgrid5.Cells[3,JJ]:='0';
   if stringgrid5.Cells[5,JJ]='' then
     stringgrid5.Cells[5,JJ]:='0';
   if stringgrid5.Cells[6,JJ]='' then
     stringgrid5.Cells[6,JJ]:='0';
   tcasing.FieldByName('OD').Asfloat:=(STRTOFLOAT(stringgrid5.Cells[0,JJ])*cnv[1].conv);
   tcasing.FieldByName('ID').Asfloat:=(STRTOFLOAT(stringgrid5.Cells[1,JJ])*cnv[1].conv);
   tcasing.FieldByName('WT').Asfloat:=(STRTOFLOAT(stringgrid5.Cells[2,JJ])*cnv[6].conv/cnv[0].conv);
   tcasing.FieldByName('DRIFT').Asfloat:=(STRTOFLOAT(stringgrid5.Cells[3,JJ])*cnv[1].conv);
   tcasing.FieldByName('TYPE').ASSTRING:=stringgrid5.Cells[4,JJ];
   tcasing.FieldByName('DTOP').Asfloat:=(STRTOFLOAT(stringgrid5.Cells[5,JJ])*cnv[0].conv);
   tcasing.FieldByName('DBTM').Asfloat:=(STRTOFLOAT(stringgrid5.Cells[6,JJ])*cnv[0].conv);
   tcasing.post;
  end;
end;
procedure tform41.sendtodbBHA;
var
 ii,jj,III:integer;
begin
 TBHA.open;
 TBHA.First;
// FORM41.Caption:=TBHA.TableName;
 if (TBHA.FieldByName('BHANAME').asstring=ComboBox9.Text)AND(TBHA.FieldByName('WELLNAME').asstring=DBEDIT1.Text) then
  begin
   TBHA.Delete;
  end;
 while (not TBHA.eof) do
  BEGIN
   TBHA.Next;
   if (TBHA.FieldByName('BHANAME').asstring=ComboBox9.Text)AND(TBHA.FieldByName('WELLNAME').asstring=DBEDIT1.Text) then
    begin
     TBHA.Delete;
    end;
  END;
 TBHA.Active:=true;
 II:=1;
 while STRINGGRID7.Cells[0,II]<>'' do
  II:=II+1;
 ii:=ii-1;
 for jj := 1 to ii do
  begin
   TBHA.open;
   TBHA.INSERT;
   TBHA.FieldByName('wellname').AsString:=dbedit1.Text;
   TBHA.FieldByName('BHANAME').AsString:=combobox9.Text;
   if stringgrid7.Cells[1,JJ]='' then
     stringgrid7.Cells[1,JJ]:='0';
   if stringgrid7.Cells[2,JJ]='' then
     stringgrid7.Cells[2,JJ]:='0';
   if stringgrid7.Cells[3,JJ]='' then
     stringgrid7.Cells[3,JJ]:='0';
   if stringgrid7.Cells[5,JJ]='' then
     stringgrid7.Cells[5,JJ]:='0';
   BYTWT(JJ);
   TBHA.FieldByName('BHATYPE').ASSTRING:=(stringgrid7.Cells[0,JJ]);
   TBHA.FieldByName('SIZE').Asfloat:=(STRTOFLOAT(stringgrid7.Cells[1,JJ])*cnv[1].conv);
   TBHA.FieldByName('ID').Asfloat:=(STRTOFLOAT(stringgrid7.Cells[2,JJ])*cnv[1].conv);
   TBHA.FieldByName('SAFTYFAC').Asfloat:=STRTOFLOAT(EDIT7.Text);
   TBHA.FieldByName('LENGTH').Asfloat:=(STRTOFLOAT(stringgrid7.Cells[3,JJ])*cnv[0].conv);
   if stringgrid7.Cells[4,JJ]='YES' then
     TBHA.FieldByName('BHA?').AsBoolean:=TRUE
   ELSE
     TBHA.FieldByName('BHA?').AsBoolean:=FALSE;
   TBHA.FieldByName('COLLARWT').Asfloat:=(STRTOFLOAT(stringgrid7.Cells[5,JJ])*cnv[6].conv);
   TBHA.post;
  end;
end;
procedure TForm41.SENDTOBITFORM;
var
 ii,jj:integer;
begin
 if (combobox2.Items.Count<>0)AND(combobox2.Text<>'') then
  begin
   tbitrun.Active:=true;
   tbitrun.Open;
   tbitrun.First;
   while ((tbitrun.FieldByName('WELLNAME').AsString<>dbedit1.Text)or
   (tbitrun.FieldByName('bitnumber').AsString<>combobox2.Items.Strings[ComboBox2.ItemIndex]))AND(NOT(TBITRUN.EOF)) do
      tbitrun.Next;
   if NOT(TBITRUN.EOF) then
    BEGIN
     combobox1.Text:=floattostr(TBITRUN.FieldByName('bitsize').AsFloat/cnv[1].conv);
     edit3.Text:=floattostr(TBITRUN.FieldByName('MaxpumpPressure').AsFloat/cnv[3].conv);
     edit4.Text:=floattostr(TBITRUN.FieldByName('MWDPress').AsFloat/cnv[3].conv);
     edit5.Text:=floattostr(TBITRUN.FieldByName('DHMPress').AsFloat/cnv[3].conv);
     IF Tbitrun.FieldByName('TurbFlowAroundCollars').AsBOOLEAN=TRUE THEN
       RadioGroup1.ItemIndex:=0;
     IF Tbitrun.FieldByName('LamFlow').AsBOOLEAN=TRUE THEN
       RadioGroup1.ItemIndex:=1;
     IF Tbitrun.FieldByName('TurbFlowAroundPipe').AsBOOLEAN=TRUE THEN
       RadioGroup1.ItemIndex:=2;
     StringGrid1.cells[1,1]:=floattostr(tbitrun.FieldByName('depth').asfloat/cnv[0].conv);
     StringGrid1.cells[2,1]:=floattostr(tbitrun.FieldByName('depthout').asfloat/cnv[0].conv);
     StringGrid1.cells[1,2]:=floattostr(tbitrun.FieldByName('tvd').asfloat/cnv[0].conv);
     StringGrid1.cells[2,2]:=floattostr(tbitrun.FieldByName('tvdout').asfloat/cnv[0].conv);
     StringGrid1.cells[1,3]:=floattostr(tbitrun.FieldByName('mudwt').asfloat/cnv[4].conv);
     StringGrid1.cells[2,3]:=floattostr(tbitrun.FieldByName('mudwtout').asfloat/cnv[4].conv);
     StringGrid1.cells[1,4]:=floattostr(tbitrun.FieldByName('pv').asfloat/cnv[5].conv);
     StringGrid1.cells[2,4]:=floattostr(tbitrun.FieldByName('pvout').asfloat/cnv[5].conv);
     StringGrid1.cells[1,5]:=floattostr(tbitrun.FieldByName('yp').asfloat/cnv[5].conv);
     StringGrid1.cells[2,5]:=floattostr(tbitrun.FieldByName('ypout').asfloat/cnv[5].conv);

     StringGrid2.cells[1,1]:=floattostr(tbitrun.FieldByName('UserSpecifiedMin').asfloat/cnv[7].conv);
     StringGrid2.cells[2,1]:=floattostr(tbitrun.FieldByName('UserSpecifiedMax').asfloat/cnv[7].conv);
     StringGrid2.cells[1,2]:=floattostr(tbitrun.FieldByName('recommendedMin').asfloat/cnv[7].conv);
     StringGrid2.cells[2,2]:=floattostr(tbitrun.FieldByName('recommendedMax').asfloat/cnv[7].conv);

     StringGrid12.cells[1,0]:=floattostr(tbitrun.FieldByName('OHROUGH').asfloat/cnv[0].conv);
     StringGrid12.cells[1,1]:=floattostr(tbitrun.FieldByName('DPROUGH').asfloat/cnv[0].conv);
     StringGrid12.cells[1,2]:=floattostr(tbitrun.FieldByName('PREDROP').asfloat/cnv[0].conv);
     StringGrid12.cells[1,3]:=floattostr(tbitrun.FieldByName('ELEVATION').asfloat/cnv[0].conv);
     StringGrid12.cells[1,4]:=floattostr(tbitrun.FieldByName('SURFTEMP').asfloat/cnv[8].conv);

     StringGrid8.cells[1,0]:=floattostr(tbitrun.FieldByName('HEATC').asfloat);
     StringGrid8.cells[1,1]:=floattostr(tbitrun.FieldByName('geotherm').asfloat/cnv[8].conv);
     StringGrid8.cells[1,2]:=floattostr(tbitrun.FieldByName('GSPECGRV').asfloat);
     StringGrid8.cells[1,3]:=floattostr(tbitrun.FieldByName('MOLEWT').asfloat);
     StringGrid8.cells[1,4]:=floattostr(tbitrun.FieldByName('SSPECGRV').asfloat);
     StringGrid8.cells[1,5]:=floattostr(tbitrun.FieldByName('SURFFLOW').asfloat/cnv[7].conv);
     StringGrid8.cells[1,6]:=floattostr(tbitrun.FieldByName('MUDFLOW').asfloat/cnv[7].conv);

    end
  end
end;
procedure tform41.sendtodbbitrun;
var
 ii,jj:integer;
begin
 tbitrun.Active:=true;
 Tbitrun.Open;
 Tbitrun.first;
 while(not Tbitrun.eof)and(not((Tbitrun.FieldByName('wellname').AsString=dbedit1.text)
 and(Tbitrun.FieldByName('bitnumber').AsString=combobox2.text)))do
   Tbitrun.Next;
 Tbitrun.Edit;
 if ComboBox1.Items.Strings[combobox1.ItemIndex]<>'' then
   tbitrun.FieldByName('bitsize').asfloat:=strtofloat(ComboBox1.Items.Strings[combobox1.ItemIndex])*cnv[1].conv;
 Tbitrun.FieldByName('MAXPumppressure').Asfloat:=round(strtofloat(edit3.Text)*cnv[3].conv);
 Tbitrun.FieldByName('MWDPRESS').Asfloat:=round(strtofloat(edit4.Text)*cnv[3].conv);
 Tbitrun.FieldByName('DHMPRESS').Asfloat:=round(strtofloat(edit5.Text)*cnv[3].conv);
 if RadioGroup1.ItemIndex=0 then
  BEGIN
   Tbitrun.FieldByName('TurbFlowAroundCollars').AsBOOLEAN:=TRUE;
   Tbitrun.FieldByName('LamFlow').AsBOOLEAN:=FALSE;
   Tbitrun.FieldByName('TurbFlowAroundPipe').AsBOOLEAN:=FALSE;
  END;
 if RadioGroup1.ItemIndex=1 then
  BEGIN
   Tbitrun.FieldByName('TurbFlowAroundCollars').AsBOOLEAN:=FALSE;
   Tbitrun.FieldByName('LamFlow').AsBOOLEAN:=TRUE;
   Tbitrun.FieldByName('TurbFlowAroundPipe').AsBOOLEAN:=FALSE;
  END;
 if RadioGroup1.ItemIndex=2 then
  BEGIN
   Tbitrun.FieldByName('TurbFlowAroundCollars').AsBOOLEAN:=FALSE;
   Tbitrun.FieldByName('LamFlow').AsBOOLEAN:=FALSE;
   Tbitrun.FieldByName('TurbFlowAroundPipe').AsBOOLEAN:=TRUE;
  END;
 for ii := 1 to 5 do
   for jj := 1 to 2 do
     if StringGrid1.cells[jj,ii]='' then
       stringgrid1.Cells[jj,ii]:='0';
 tbitrun.FieldByName('depth').Asfloat:=strtofloat(StringGrid1.cells[1,1])*cnv[0].conv;
 tbitrun.FieldByName('depthout').Asfloat:=strtofloat(StringGrid1.cells[2,1])*cnv[0].conv;
 tbitrun.FieldByName('tvd').Asfloat:=strtofloat(StringGrid1.cells[1,2])*cnv[0].conv;
 tbitrun.FieldByName('tvdout').Asfloat:=strtofloat(StringGrid1.cells[2,2])*cnv[0].conv;
 tbitrun.FieldByName('mudwt').Asfloat:=strtofloat(StringGrid1.cells[1,3])*cnv[4].conv;
 tbitrun.FieldByName('mudwtout').Asfloat:=strtofloat(StringGrid1.cells[2,3])*cnv[4].conv;
 edit6.Text:=StringGrid1.cells[2,3];
 tbitrun.FieldByName('pv').Asfloat:=strtofloat(StringGrid1.cells[1,4])*cnv[5].conv;
 tbitrun.FieldByName('pvout').Asfloat:=strtofloat(StringGrid1.cells[2,4])*cnv[5].conv;
 tbitrun.FieldByName('yp').Asfloat:=strtofloat(StringGrid1.cells[1,5])*cnv[5].conv;
 tbitrun.FieldByName('ypout').Asfloat:=strtofloat(StringGrid1.cells[2,5])*cnv[5].conv;
 for ii := 1 to 2 do
   for jj := 1 to 2 do
     if StringGrid2.cells[jj,ii]='' then
       stringgrid2.Cells[jj,ii]:='0';
 tbitrun.FieldByName('UserSpecifiedMin').Asfloat:=strtofloat(StringGrid2.cells[1,1])*cnv[7].conv;
 tbitrun.FieldByName('UserSpecifiedMax').Asfloat:=strtofloat(StringGrid2.cells[2,1])*cnv[7].conv;
 tbitrun.FieldByName('RecommendedMin').Asfloat:=strtofloat(StringGrid2.cells[1,2])*cnv[7].conv;
 tbitrun.FieldByName('RecommendedMax').Asfloat:=strtofloat(StringGrid2.cells[2,2])*cnv[7].conv;
 for ii :=0 to STRINGGRID12.RowCount do
   if StringGrid12.cells[1,ii]='' then
     stringgrid12.Cells[1,ii]:='0';
 tbitrun.FieldByName('OHROUGH').Asfloat:=strtofloat(StringGrid12.cells[1,0])*cnv[0].conv;
 tbitrun.FieldByName('DPROUGH').Asfloat:=strtofloat(StringGrid12.cells[1,1])*cnv[0].conv;
 tbitrun.FieldByName('PREDROP').Asfloat:=strtofloat(StringGrid12.cells[1,2])*cnv[0].conv;
 tbitrun.FieldByName('ELEVATION').Asfloat:=strtofloat(StringGrid12.cells[1,3])*cnv[0].conv;
 tbitrun.FieldByName('SURFTEMP').Asfloat:=strtofloat(StringGrid12.cells[1,4])*cnv[8].conv;
 for ii :=0 to STRINGGRID8.RowCount do
   if StringGrid8.cells[1,ii]='' then
     stringgrid8.Cells[1,ii]:='0';
 tbitrun.FieldByName('HEATC').Asfloat:=strtofloat(StringGrid8.cells[1,0]);
 tbitrun.FieldByName('GEOTHERM').Asfloat:=strtofloat(StringGrid8.cells[1,1])*cnv[8].conv;
 tbitrun.FieldByName('GSPECGRV').Asfloat:=strtofloat(StringGrid8.cells[1,2]);
 tbitrun.FieldByName('MOLEWT').Asfloat:=strtofloat(StringGrid8.cells[1,3]);
 tbitrun.FieldByName('SSPECGRV').Asfloat:=strtofloat(StringGrid8.cells[1,4]);
 tbitrun.FieldByName('SURFFLOW').Asfloat:=strtofloat(StringGrid8.cells[1,5])*cnv[7].conv;
 tbitrun.FieldByName('MUDFLOW').Asfloat:=strtofloat(StringGrid8.cells[1,6])*cnv[7].conv;

 Tbitrun.Post;
end;
function RectHeight(R : TRect) : integer;
begin
Result := R.Bottom - R.Top;
end;

function RectWidth(R : TRect) : integer;
begin
Result := R.Right - R.Left;
end;

procedure TForm41.StringGrid8KeyUp(Sender: TObject; var Key: Word;
  Shift: TShiftState);
begin
   sendtodbbitrun;
end;

procedure TForm41.Button10Click(Sender: TObject);
VAR
 JETS:ARRAY [1..15] OF REAL;
 II:INTEGER;
begin
 CALCULATE(radiogroup2.ItemIndex,0,'');
 FORM44.ShowModal;
// SHOWMESSAGE(FLOATTOSTR(ANP0(15150,64.7,504,1,2.7,28.97,4000,8.017,6.62,0.00015,0.00015,60,0.01,6650,7000)));

//DPP0(QAT,PG,TAT,GSG,MOLWT,ELEV,DP,EP,ROP,DEPT1,DEPT2:REAL)
//BLP0(QAT,TAT,GSG,MOLWT,ELEV,LB,DB,KT,KV,VALVNO,EP:REAL):REAL;
// SHOWMESSAGE(FLOATTOSTR(BLP0(2000,44,1,29,4000,200,8.097,25,0.2,2,0.00015)));
end;

procedure TForm41.Button1Click(Sender: TObject);
var
  ii,jj:integer;
begin
 if ComboBox2.Text<>'' then
  begin
   while not tbitrun.eof do
     tbitrun.Next;
   tbitrun.active:=true;
   tbitrun.Open;
   tbitrun.insert;
   TBITRUN.FieldByName('Wellname').AsString:=dbedit1.Text;
   TBITRUN.FieldByName('BitNumber').asstring:=ComboBox2.Text;
   Tbitrun.FieldByName('TurbFlowAroundCollars').AsBOOLEAN:=TRUE;
   tbitrun.post;
   FORM43.FXDNZL.Open;
   while not FORM43.FXDNZL.eof do
     FORM43.FXDNZL.Next;
   FORM43.FXDNZL.Active:=true;
   FORM43.FXDNZL.Open;
   FORM43.FXDNZL.insert;
   FORM43.FXDNZL.FieldByName('Wellname').AsString:=dbedit1.Text;
   FORM43.FXDNZL.FieldByName('BitNumber').asstring:=ComboBox2.Text;
   FORM43.FXDNZL.FieldByName('NumberOfVariableNozzles').asFLOAT:=0;
   FORM43.FXDNZL.FieldByName('NumberOfFixedNozzles').asFLOAT:=0;
   FORM43.FXDNZL.FieldByName('UseFixedTFA').asboolean:=false;
   FORM43.FXDNZL.FieldByName('FixedTFA').asFLOAT:=0;
   for ii := 0 to 2 do
    begin
     for jj := 0 to 4 do
      begin
       FORM43.FXDNZL.Fields.FieldByNumber(7+ii+3*jj).AsFloat:=0;//strtofloat(form43.StringGrid1.Cells[ii,jj])*cnv[2].conv;
      end;
    end;
   FORM43.FXDNZL.post;
   sendtodbbitrun;
  end
 else
   showmessage('Bit Name is Empty!!');
end;

procedure TForm41.Button2Click(Sender: TObject);
begin
 if MessageDlg('Are you sure to Delete '+ComboBox2.Text+'?',mtCustom,[mbYes,mbno],0)=mryes then
  begin
   tbitrun.Active;
   tbitrun.open;
   tbitrun.First;
   if (tbitrun.FieldByName('BitNumber').asstring=ComboBox2.Text)AND(tbitrun.FieldByName('WELLNAME').asstring=DBEDIT1.Text) then
    begin
     tbitrun.Delete;
    end;
   while (not tbitrun.eof) do
    BEGIN
     TBITRUN.Next;
     if (tbitrun.FieldByName('BitNumber').asstring=ComboBox2.Text)AND(tbitrun.FieldByName('WELLNAME').asstring=DBEDIT1.Text) then
      begin
       tbitrun.Delete;
      end;
    END;
  end;
end;

procedure TForm41.Button3Click(Sender: TObject);
var
 ii,jj:integer;
begin
 FORM43.Label2.Caption:=cnv[1].name+' 2';
 FORM43.FXDNZL.Active:=true;
 FORM43.FXDNZL.open;
 FORM43.FXDNZL.First;
 while not((FORM43.FXDNZL.FieldByName('wellname').asstring=dbedit1.Text)and
 (FORM43.FXDNZL.FieldByName('bitnumber').asstring=combobox2.Text))do
   FORM43.FXDNZL.Next;
 for ii := 0 to 2 do
  begin
   for jj := 0 to 4 do
    begin
     FORM43.FXDNZL.Open;
     FORM43.FXDNZL.Edit;
     if form43.StringGrid1.Cells[ii,jj]='' then
       form43.StringGrid1.Cells[ii,jj]:='0';
     form43.StringGrid1.Cells[ii,jj]:=floattostr(FORM43.FXDNZL.Fields.FieldByNumber(7+ii+3*jj).AsFloat/cnv[2].conv);
    end;
  end;
 FORM43.FXDNZL.Post;
 form43.Edit1.Text:=floattostr(tbitrun.FieldByName('tfa').asfloat/cnv[1].conv/cnv[1].conv);
 form43.ShowModal;
end;
PROCEDURE TFORM41.REFCOMBO4;
BEGIN
 COMBOBOX4.Items.Clear;
 TWELLHEADER.Active;
 twellheader.open;
 TWELLHEADER.First;
 while NOT TWELLHEADER.EOF do
  BEGIN
   COMBOBOX4.Items.Append(TWELLHEADER.FieldByName('WELLNAME').AsString);
   TWELLHEADER.Next;
  END;
END;
procedure TForm41.Button4Click(Sender: TObject);
var
  ii,jj:integer;
begin
 if ComboBox4.Text<>'' then
  begin
   while not TWELLHEADER.eof do
     TWELLHEADER.Next;
   TWELLHEADER.Open;
   TWELLHEADER.INSERT;
   TWELLHEADER.FieldByName('Wellname').AsString:=ComboBox4.Text;
   TWELLHEADER.POST;
  END
 else
   showmessage('Bit Name is Empty!!');
 REFCOMBO4;
end;
procedure TForm41.Button5Click(Sender: TObject);
begin
 if MessageDlg('Are you sure to Delete '+ComboBox2.Text+'?',mtCustom,[mbYes,mbno],0)=mryes then
  begin
   TWELLHEADER.Active;
   TWELLHEADER.Open;
   TWELLHEADER.First;
   while (TWELLHEADER.FieldByName('WELLNAME').asstring<>ComboBox4.Text)and(not TWELLHEADER.eof) do
     TWELLHEADER.Next;
   if TWELLHEADER.FieldByName('WELLNAME').asstring=ComboBox4.Text then
    begin
     TWELLHEADER.Delete;
    end
   else
    begin
     showmessage('WELL Name Not Found!!!');
    end;
  end;
 REFCOMBO4;
 COMBOBOX4.ItemIndex:=0;
end;

procedure TForm41.Button6Click(Sender: TObject);
var
  ii,jj:integer;
begin
 if ComboBox6.Text<>'' then
  begin
   ComboBox6.Items.Append(ComboBox6.Text);
   combobox6.ItemIndex:=combobox6.Items.Count-1;
   tcasing.active:=true;
   tcasing.Open;
   tcasing.insert;
   while not tcasing.eof do
     tcasing.Next;
   for ii:= 0 to 6 do
     for jj := 1 to StringGrid5.RowCount do
       stringgrid5.Cells[ii,jj]:='';
   for ii:= 0 to 6 do
     stringgrid5.Cells[ii,1]:='0';
   stringgrid5.Cells[4,1]:='J-55';
   sendtodbcasing;
  end
 else
   showmessage('casing Name is Empty!!');

end;

procedure TForm41.Button7Click(Sender: TObject);
begin
 if MessageDlg('Are you sure to Delete '+ComboBox6.Text+'?',mtCustom,[mbYes,mbno],0)=mryes then
  begin
   TCASING.open;
   TCASING.First;
   while (not TCASING.eof) do
    BEGIN
     if (TCASING.FieldByName('CASINGNAME').asstring=ComboBox6.Text)AND(TCASING.FieldByName('WELLNAME').asstring=DBEDIT1.Text) then
       TCASING.Delete
     ELSE
       TCASING.Next;
    END;
   REFCOMBO6;
   COMBOBOX6.ItemIndex:=0;
   SENDTOCASINGFORM;
  end;
end;

procedure TForm41.Button8Click(Sender: TObject);
var
  ii,jj:integer;
begin
 if ComboBox9.Text<>'' then
  begin
   ComboBox9.Items.Append(ComboBox9.Text);
   combobox9.ItemIndex:=combobox9.Items.Count-1;
   TBHA.active:=true;
   TBHA.Open;
   TBHA.insert;
   while not TBHA.eof do
     TBHA.Next;
   for ii:= 0 to 5 do
     for jj := 1 to StringGrid7.RowCount do
       stringgrid7.Cells[ii,jj]:='';
   stringgrid7.cells[0,1]:='DRILL PIPE';
   stringgrid7.cells[3,1]:='0';
   stringgrid7.Cells[4,1]:='NO';
   stringgrid7.Cells[5,1]:='0';
   EDIT7.Text:='15';
   sendtodbBHA;
  end
 else
   showmessage('casing Name is Empty!!');

end;


procedure TForm41.Button9Click(Sender: TObject);
VAR
II:INTEGER;
begin
 if MessageDlg('Are you sure to Delete '+ComboBox9.Text+'?',mtCustom,[mbYes,mbno],0)=mryes then
  begin
   TBHA.open;
   TBHA.First;
   while (not TBHA.eof) do
    BEGIN
     if (TBHA.FieldByName('BHANAME').asstring=ComboBox9.Text)AND(TBHA.FieldByName('WELLNAME').asstring=DBEDIT1.Text) then
       TBHA.Delete
     ELSE
       TBHA.Next;
    END;
   REFCOMBO9;
   COMBOBOX9.ItemIndex:=0;
   SENDTOBHAFORM;
   if EDIT6.Text='' then
     EDIT6.Text:='0';
   if EDIT7.Text='' then
     EDIT7.Text:='0';
   SENDTODBBHA;
  end;
end;
PROCEDURE TFORM41.REFCOMBO9;
var
 ii,jj:integer;
BEGIN
 COMBOBOX9.Items.Clear;
 TBHA.Active;
 TBHA.open;
 TBHA.First;
 while NOT TBHA.EOF do
  BEGIN
   if TBHA.FieldByName('WELLNAME').AsString=dbedit1.Text then
    begin
     jj:=0;
     for ii := 0 to ComboBox9.Items.Count do
      begin
       if TBHA.FieldByName('BHANAME').AsString=combobox9.Items[ii] then
        begin
         jj:=1;
        end;
      end;
     if jj=0 then
       COMBOBOX9.Items.Append(TBHA.FieldByName('BHANAME').AsString);
    end;
   TBHA.Next;
  END;
END;

procedure TForm41.ComboBox1CloseUp(Sender: TObject);
begin
 sendtodbbitrun;
end;

PROCEDURE TFORM41.REFCOMBO6;
var
 ii,jj:integer;
BEGIN
 COMBOBOX6.Items.Clear;
 tcasing.Active;
 tcasing.open;
 tcasing.First;
 while NOT tcasing.EOF do
  BEGIN
   if tcasing.FieldByName('WELLNAME').AsString=dbedit1.Text then
    begin
     jj:=0;
     for ii := 0 to ComboBox6.Items.Count do
      begin
       if tcasing.FieldByName('CASINGNAME').AsString=combobox6.Items[ii] then
        begin
         jj:=1;
        end;
      end;
     if jj=0 then
       COMBOBOX6.Items.Append(tcasing.FieldByName('CASINGNAME').AsString);
    end;
   tcasing.Next;
  END;
END;
PROCEDURE TFORM41.REFCOMBO2;
BEGIN
 COMBOBOX2.Items.Clear;
 tbitrun.Active;
 tbitrun.open;
 tbitrun.First;
 while NOT tbitrun.EOF do
  BEGIN
   if tbitrun.FieldByName('WELLNAME').AsString=dbedit1.Text then
     COMBOBOX2.Items.Append(tbitrun.FieldByName('bitnumber').AsString);
   tbitrun.Next;
  END;
END;


procedure TForm41.ComboBox2CloseUp(Sender: TObject);
begin
 SENDTOBITFORM;
end;
procedure TForm41.ComboBox2DropDown(Sender: TObject);
begin
 REFCOMBO2;
end;

procedure TForm41.SENDTOWELLFORM;
begin
 if COMBOBOX4.Items.Count<>0 then
  BEGIN
   TWELLHEADER.Active;
   TWELLHEADER.First;
   while (NOT TWELLHEADER.EOF)AND(TWELLHEADER.FieldByName('WELLNAME').AsString<>ComboBox4.Items.Strings[combobox4.ItemIndex]) do
    BEGIN
     TWELLHEADER.Next;
    END;
   edit1.Text:=floattostr(round(TWELLHEADER.FieldByName('EquivLength').asfloat/cnv[0].conv));
   edit2.Text:=floattostr(TWELLHEADER.FieldByName('RiserFlowRate').asfloat/cnv[4].conv);
   if TWELLHEADER.FieldByName('SurfaceEquipmentCaseNumber').asfloat<>0 then
     StringGrid3.Row:=TWELLHEADER.FieldByName('SurfaceEquipmentCaseNumber').asinteger
   else
    BEGIN
     StringGrid3.Row:=1;
    END;
   REFCOMBO2;
   ComboBox2.ItemIndex:=0;
  END;
end;
procedure TForm41.COMBOBOX4CloseUp(Sender: TObject);
begin
 SENDTOWELLFORM;
end;

procedure TForm41.COMBOBOX4DropDown(Sender: TObject);
begin
 REFCOMBO4;
end;

procedure TForm41.ComboBox5CloseUp(Sender: TObject);
begin
 StringGrid5.CELLS[4,RST5]:=combobox5.Items.Strings[ComboBox5.ItemIndex];
end;
procedure TForm41.SENDTOCASINGFORM;
var
 ii,JJ:integer;
begin
 for ii:= 0 to 6 do
   for jj := 1 to StringGrid5.RowCount do
     stringgrid5.Cells[ii,jj]:='';
 if (combobox6.Items.Count<>0)AND(combobox6.Text<>'') then
  begin
   TCASING.Active:=true;
   TCASING.Open;
   TCASING.First;
   II:=1;
   while (NOT(TCASING.EOF)) do
    BEGIN
     if((TCASING.FieldByName('WELLNAME').AsString=dbedit1.Text)AND
       (TCASING.FieldByName('CASINGNAME').AsString=combobox6.Items.Strings[ComboBox6.ItemIndex]))then
      BEGIN
       StringGrid5.cells[0,II]:=floattostr(TCASING.FieldByName('OD').asfloat/cnv[1].conv);
       StringGrid5.cells[1,II]:=floattostr(TCASING.FieldByName('ID').asfloat/cnv[1].conv);
       StringGrid5.cells[2,II]:=floattostr(TCASING.FieldByName('WT').asfloat*cnv[0].conv/cnv[6].conv);
       StringGrid5.cells[3,II]:=floattostr(TCASING.FieldByName('DRIFT').asfloat/cnv[1].conv);
       StringGrid5.cells[4,II]:=TCASING.FieldByName('TYPE').AsString;
       StringGrid5.cells[5,II]:=floattostr(TCASING.FieldByName('DTOP').asfloat/cnv[0].conv);
       StringGrid5.cells[6,II]:=floattostr(TCASING.FieldByName('DBTM').asfloat/cnv[0].conv);
       II:=II+1;
      END;
     TCASING.Next;
    END;
  end
end;
procedure TForm41.SENDTOBHAFORM;
var
 ii,JJ:integer;
begin
 for ii:= 0 to 5 do
   for jj := 1 to StringGrid7.RowCount do
     stringgrid7.Cells[ii,jj]:='';
 if (combobox9.Items.Count<>0)AND(combobox9.Text<>'') then
  begin
   TBHA.Active:=true;
   TBHA.Open;
   TBHA.First;
   II:=1;
   while (NOT(TBHA.EOF)) do
    BEGIN
     if((TBHA.FieldByName('WELLNAME').AsString=dbedit1.Text)AND
       (TBHA.FieldByName('BHANAME').AsString=combobox9.Items.Strings[ComboBox9.ItemIndex]))then
      BEGIN
       StringGrid7.cells[0,II]:=TBHA.FieldByName('BHATYPE').AsString;
       StringGrid7.cells[1,II]:=floattostr(TBHA.FieldByName('SIZE').asfloat/cnv[1].conv);
       StringGrid7.cells[2,II]:=floattostr(TBHA.FieldByName('ID').asfloat/cnv[1].conv);
       StringGrid7.cells[3,II]:=floattostr(TBHA.FieldByName('LENGTH').asfloat/cnv[0].conv);
       EDIT7.Text:=FLOATTOSTR(TBHA.FieldByName('SAFTYFAC').asfloat);
       if TBHA.FieldByName('BHA?').asBOOLEAN then
         StringGrid7.cells[4,II]:='YES'
       ELSE
         StringGrid7.cells[4,II]:='NO';
       StringGrid7.cells[5,II]:=floattostr(TBHA.FieldByName('COLLARWT').asfloat/cnv[6].conv);
       BYTWT(II);
       II:=II+1;
      END;
     TBHA.Next;
    END;
  end
end;

procedure TForm41.ComboBox6CloseUp(Sender: TObject);
begin
 SENDTOCASINGFORM;
end;

procedure TForm41.ComboBox6DropDown(Sender: TObject);
begin
 REFCOMBO6;
end;

procedure TForm41.ComboBox7CloseUp(Sender: TObject);
begin
 StringGrid7.CELLS[0,RDP7]:=combobox7.Items.Strings[ComboBox7.ItemIndex];
 if BHATYP<>COMBOBOX7.ItemIndex then
  BEGIN
   StringGrid7.CELLS[1,RDP7]:='0';
   StringGrid7.CELLS[2,RDP7]:='0';
  END;
 if StringGrid7.CELLS[0,RDP7]='DRILL PIPE' THEN
  BEGIN
   StringGrid7.CELLS[4,RDP7]:='NO';
  END
 ELSE
  BEGIN
   StringGrid7.CELLS[4,RDP7]:='YES';
  END;
end;

procedure TForm41.ComboBox7DropDown(Sender: TObject);
begin
 BHATYP:=COMBOBOX7.ItemIndex;
end;

procedure TForm41.ComboBox8CloseUp(Sender: TObject);
begin
 StringGrid7.CELLS[4,RDP7]:=combobox8.Items.Strings[ComboBox8.ItemIndex];
 BYTWT(RDP7);

end;

procedure TForm41.ComboBox9CloseUp(Sender: TObject);
VAR
II:INTEGER;
begin
 SENDTOBHAFORM;
 if EDIT6.Text='' then
   EDIT6.Text:='0';
 if EDIT7.Text='' then
   EDIT7.Text:='0';
 SENDTODBBHA;
end;

procedure TForm41.ComboBox9DropDown(Sender: TObject);
begin
 REFCOMBO9;
end;

procedure TForm41.DBEdit11Change(Sender: TObject);
begin
 if DBEDIT11.Text='0' then
  BEGIN
   BUTTON3.Enabled:=FALSE
  END
 else
  begin
   button3.Enabled:=true;
  end;
end;

procedure tform41.dbnavtowell;
begin
 TWELLHEADER.Active:=true;
 TWELLHEADER.open;
 TWELLHEADER.edit;
 DBNavigator2.BtnClick(nbPost);
end;

procedure TForm41.DeleteRow1Click(Sender: TObject);
var
 buttonSelected,ii,jj:integer;
begin
 buttonSelected := MessageDlg('Are you sure to delete this Record?',mtCustom,[mbYes,mbno,mbCancel], 0);
 if buttonSelected=mrYes then
  begin
   if PAGECONTROL1.TabIndex=2 then
    BEGIN
     for ii := rst5 to mrst5-1 do
      begin
       for jj:=0 to 6 do
        begin
         StringGrid5.Cells[jj,ii]:=StringGrid5.Cells[jj,ii+1];
        end;
      end;
     for jj:=0 to 6 do
      begin
       StringGrid5.Cells[jj,mrst5]:='';
      end;
    END;
   if PAGECONTROL1.TabIndex=1 then
    BEGIN
     for ii := rDP7 to mrDP7-1 do
      begin
       for jj:=0 to 5 do
        begin
         StringGrid7.Cells[jj,ii]:=StringGrid7.Cells[jj,ii+1];
        end;
      end;
     for jj:=0 to 5 do
      begin
       StringGrid7.Cells[jj,mrDP7]:='';
      end;
    END;

  end;
end;

procedure TForm41.DBEdit2Exit(Sender: TObject);
begin
 dbnavtowell;
end;

procedure TForm41.DBEdit3Exit(Sender: TObject);
begin
 dbnavtowell;
end;

procedure TForm41.DBEdit4Exit(Sender: TObject);
begin
 dbnavtowell;
end;

procedure TForm41.DBEdit5Exit(Sender: TObject);
begin
 dbnavtowell;
end;

procedure TForm41.DBEdit6Exit(Sender: TObject);
begin
 dbnavtowell;
end;

procedure TForm41.DBEdit7Exit(Sender: TObject);
begin
 dbnavtowell;
end;

procedure TForm41.DBEdit8Exit(Sender: TObject);
begin
 dbnavtowell;
end;

{procedure TForm41.DBGrid1DrawColumnCell(Sender: TObject; const Rect: TRect;
  DataCol: Integer; Column: TColumn; State: TGridDrawState);
var
  DrawState: Integer;
  DrawRect: TRect;
begin
 if (gdFocused in State) then
  begin
   if (datacol=5) then
    begin
     combobox5.Left := Rect.Left + DBGrid1.Left + 2;
     combobox5.Top := Rect.Top + DBGrid1.top + 2;
     combobox5.Width := Rect.Right - Rect.Left;
     combobox5.Height := Rect.Bottom - Rect.Top;
     combobox5.Visible := True;
    end
   else
    begin
     combobox5.Visible := false;
    end;
  end;
 if (gdFocused in State) then
  begin
   if (datacol=1) then
    begin
     stringgrid4.Top := Rect.Top + DBGrid1.top + 2+Rect.Bottom - Rect.Top;
     stringgrid4.Visible:=true;
    end
   else
    begin
     stringgrid4.Visible:=false;
    end;
  end;
end;  }

procedure tform41.deltemp;
 begin
  ADOConnection1.Connected:=false;
  DeleteFile('TEMP.ldb');
  DeleteFile('TEMP.mdb');
 end;
procedure tform41.refresht;
 begin
  TWELLHEADER.Active:=false;
  TWELLHEADER.TableName:='WellHeader';
  TWELLHEADER.Active:=true;
  tcasing.Active:=false;
  tcasing.TableName:='Casing';
  tcasing.Active:=true;
  tbitrun.Active:=false;
  tbitrun.TableName:='Bitrun';
  tbitrun.Active:=true;
  tbitsize.Active:=false;
  tbitsize.TableName:='Bit_Size';
  tbitsize.Active:=true;
  tcasing.Active:=false;
  TBHA.TableName:='DRILLSTRING';
  tcasing.Active:=true;
  dbedit1.DataField:='Wellname';
  dbedit2.DataField:='Drillingcontractor';
  dbedit3.DataField:='operator';
  dbedit4.DataField:='PreparedBy';
  dbedit5.DataField:='Welllocation';
  dbedit6.DataField:='Rigname';
  dbedit7.DataField:='Operatorcontact';
  dbedit8.DataField:='preparerscompany';
 end;

procedure TForm41.Edit1Change(Sender: TObject);
begin
 if edit1.Text='0' then
   edit1.Color:=clyellow
 else
   edit1.Color:=claqua;
end;

procedure TForm41.Edit1Exit(Sender: TObject);
begin
 sendtodbbitrun;
end;

procedure TForm41.Edit2Change(Sender: TObject);
begin
 sendtodbwellheader;
end;

procedure TForm41.Edit3Exit(Sender: TObject);
begin
 sendtodbbitrun;
end;

procedure TForm41.Edit4Exit(Sender: TObject);
begin
 sendtodbbitrun;
end;

procedure TForm41.Edit5Exit(Sender: TObject);
begin
 sendtodbbitrun;
end;

procedure TForm41.Edit7Change(Sender: TObject);
VAR
II:INTEGER;
begin
 if EDIT6.Text='' then
   EDIT6.Text:='0';
 if EDIT7.Text='' then
   EDIT7.Text:='0';
 SENDTODBBHA;
end;
procedure TForm41.Edit6Change(Sender: TObject);
VAR
II:INTEGER;
begin
 if EDIT6.Text='' then
   EDIT6.Text:='0';
 if EDIT7.Text='' then
   EDIT7.Text:='0';
 SENDTODBBHA;
end;
procedure TForm41.Edit8Change(Sender: TObject);
begin
 EDIT9.Text:=FLOATTOSTR(0.01*ROUND(100*(1-STRTOFLOAT(EDIT7.Text)/100)*STRTOFLOAT(EDIT8.Text)));
end;

procedure TForm41.Exit1Click(Sender: TObject);
var
  buttonSelected : Integer;
begin
 buttonSelected := MessageDlg('Are you sure to Save and Exit?',mtCustom,[mbYes,mbno,mbCancel], 0);
 if buttonSelected=mrYes then
   Saveas1.Click;
 if buttonSelected<>mrcancel then
   form41.Close;
end;

procedure TForm41.FormClose(Sender: TObject; var Action: TCloseAction);
begin
 deltemp;
end;
procedure tform41.newfilecreation;
var
 ii,jj:integer;
begin
 //creating temp file
 AdoConnection1.LoginPrompt := False;
 ADOConnection1.Connected:=false;
 COPYFILE('BLANK.MDB','TEMP.MDB',TRUE);
 ADOConnection1.ConnectionString:='Provider=Microsoft.Jet.OLEDB.4.0;Data Source='+'TEMP.mdb'+';Persist Security Info=False';
 ADOConnection1.Connected:=true;
 //mud properties intial values
 for ii := 1 to 2 do
   for jj := 1 to 6 do
     StringGrid1.Cells[ii,jj]:='0';
 //flow limitation initial values
 for ii := 1 to 2 do
   for jj := 1 to 2 do
     StringGrid2.Cells[ii,jj]:='0';
 for ii :=0 to STRINGGRID12.RowCount do
   if StringGrid12.cells[1,ii]='' then
     stringgrid12.Cells[1,ii]:='0';
 for ii :=0 to STRINGGRID8.RowCount do
   if StringGrid8.cells[1,ii]='' then
     stringgrid8.Cells[1,ii]:='0';

 refresht;
end;

procedure TForm41.PageControl1Resize(Sender: TObject);
begin
 stringgrid5.DefaultColWidth:=trunc((StringGrid5.Width-28)/7);
 stringgrid4.DefaultColWidth:=StringGrid5.DefaultColWidth;
 stringgrid4.Width:=stringgrid4.DefaultColWidth*4+26;

 stringgrid7.DefaultColWidth:=trunc((StringGrid7.Width-26)/6);
 stringgrid6.DefaultColWidth:=StringGrid7.DefaultColWidth;
 stringgrid6.Width:=stringgrid6.DefaultColWidth*5+32;

end;

procedure TForm41.FormCreate(Sender: TObject);
begin
 deltemp;
//surface Equiment table size
 stringgrid3.DefaultColWidth:=(stringgrid3.Width-10) div 5;
 stringgrid3.Cells[0,0]:='CASE NUMBER';
 stringgrid3.Cells[1,0]:='STANDPIPE';
 stringgrid3.Cells[2,0]:='HOSE';
 stringgrid3.Cells[3,0]:='SWIVEL';
 stringgrid3.Cells[4,0]:='KELLY';
 //adding label to array inorder  to change their units in program
 formlbl[1]:=label9.caption;
 formlbl[2]:=label10.caption;
 formlbl[3]:=label13.caption;
 formlbl[4]:=DBCheckBox1.caption;
 formlbl[5]:=DBCheckBox2.caption;
 newfilecreation;
end;

procedure TForm41.FormResize(Sender: TObject);
begin
 stringgrid3.DefaultColWidth:=(stringgrid3.Width-10) div 5;
end;

procedure TForm41.Save1Click(Sender: TObject);
begin
 ADOConnection1.Connected:=false;
 if OldFiles='' then
  SaveAs1.Click
 else
  begin
   oldfiles:=copy(oldfiles,1,length(oldfiles)-4);
   if FileExists(OldFiles+'.mdb') then
    begin
     DeleteFile(OldFiles+'.mdb');
     DeleteFile(OldFiles+'.ldb');
    end;
   CopyFile('Temp.MDB',StringtoOleStr(oldfiles+'.mdb'),true);
   OpenDialog1.FileName:=ExtractFilePath (Application.ExeName)+'Temp.MDB';
   ADOConnection1.ConnectionString:='Provider=Microsoft.Jet.OLEDB.4.0;Data Source='+OpenDialog1.FileName+';Persist Security Info=False';
   TWELLHEADER.Connection:=ADOConnection1;
   OpenDialog1.FileName:=SaveDialog1.FileName;
   oldfiles:=OldFiles+'.mdb';
  end;
 refresht;
end;
procedure TForm41.SaveAs1Click(Sender: TObject);
var
  NewFileName: string;
  add: string;
  ii:integer;
  begin
   SaveDialog1.FileName:='NEW HYDRO';
   TWELLHEADER.Close;
   ADOConnection1.Connected:=false;
   if SaveDialog1.Execute then
    begin
     add:='';
     for ii:=1 to length(savedialog1.FileName) do
      begin
       if savedialog1.FileName[ii]='.' then
        break;
       add:=add+savedialog1.FileName[ii];
      end;
     if FileExists(add+'.mdb') then
      begin
       DeleteFile(add+'.mdb');
       DeleteFile(add+'.ldb');
      end;
     CopyFile('Temp.MDB',StringtoOleStr(add+'.mdb'),true);
     OpenDialog1.FileName:=ExtractFilePath (Application.ExeName)+'Temp.MDB';
     ADOConnection1.ConnectionString:='Provider=Microsoft.Jet.OLEDB.4.0;Data Source='+OpenDialog1.FileName+';Persist Security Info=False';
     TWELLHEADER.Connection:=ADOConnection1;
     OpenDialog1.FileName:=SaveDialog1.FileName;
     oldfiles:=StringtoOleStr(add+'.mdb');
    end;
   refresht;
end;
procedure TForm41.Load1Click(Sender: TObject);
var
  ret,II:integer;
  Newfilename:string;
  NewFile: TFileStream;
  OldFile: TFileStream;
  buttonSelected:INTEGER;
begin
 if OldFiles<>'' then
  begin
   buttonSelected := MessageDlg('Do You Want to Save?',mtCustom,[mbYes,mbno,mbCancel], 0);
   if buttonSelected=mrYes then
     Saveas1.Click;
  end;
 Ret:=0;
 if (OpenDialog1.Execute)and(ret<>2) then
  begin
   oldfiles:=OpenDialog1.FileName;
   ADOConnection1.Connected:=false;
   deltemp;
   NewFileName := ExtractFilePath(Application.ExeName) + ExtractFileName('Temp.MDB');
   OldFile := TFileStream.Create(OpenDialog1.FileName, fmOpenRead or fmShareDenyWrite);
   try
    NewFile := TFileStream.Create(NewFileName, fmCreate or fmShareDenyRead);
    try
      NewFile.CopyFrom(OldFile, OldFile.Size);
    finally
      FreeAndNil(NewFile);
     end;
   finally
     FreeAndNil(OldFile);
    end;
   ADOConnection1.ConnectionString:='Provider=Microsoft.Jet.OLEDB.4.0;Data Source='+ExtractFilePath (Application.ExeName)+'Temp.mdb'+';Persist Security Info=False';
   TWELLHEADER.Connection:=ADOConnection1;
   DATASOURCE1.DataSet:=TWELLHEADER;
   refresht;
   combobox4.ItemIndex:=0;
   REFCOMBO4;
   COMBOBOX4.Text:=DBEDIT1.Text;
   SENDTOWELLFORM;
   TWELLHEADER.OPEN;
   TWELLHEADER.FIRST;
   REFCOMBO2;
   COMBOBOX2.Text:=COMBOBOX2.Items.Strings[0];
   combobox2.ItemIndex:=0;
   SENDTOBITFORM;
   combobox4.ItemIndex:=0;

   REFCOMBO6;
   ComboBox6.Text:=COMBOBOX6.Items.Strings[0];
   combobox6.ItemIndex:=0;
   SENDTOCASINGFORM;
   combobox6.ItemIndex:=0;

   REFCOMBO9;
   ComboBox9.Text:=COMBOBOX9.Items.Strings[0];
   combobox9.ItemIndex:=0;
   SENDTOBHAFORM;
   combobox9.ItemIndex:=0;
   if EDIT6.Text='' then
     EDIT6.Text:='0';
   if EDIT7.Text='' then
     EDIT7.Text:='0';
   SENDTODBBHA;
  end;
end;

procedure TForm41.New1Click(Sender: TObject);
var
  ret:integer;
  Newfilename:string;
  NewFile: TFileStream;
  OldFile: TFileStream;
  buttonSelected:INTEGER;
begin
 if OldFiles<>'' then
  begin
   buttonSelected := MessageDlg('Do You Want to Save?',mtCustom,[mbYes,mbno,mbCancel], 0);
   if buttonSelected=mrYes then
     Saveas1.Click;
  end;
 Ret:=0;
   oldfiles:='BLANK.MDB';
   ADOConnection1.Connected:=false;
   deltemp;
   NewFileName := ExtractFilePath(Application.ExeName) + ExtractFileName('Temp.MDB');
   OldFile := TFileStream.Create('BLANK.MDB', fmOpenRead or fmShareDenyWrite);
   try
    NewFile := TFileStream.Create(NewFileName, fmCreate or fmShareDenyRead);
    try
      NewFile.CopyFrom(OldFile, OldFile.Size);
    finally
      FreeAndNil(NewFile);
     end;
   finally
     FreeAndNil(OldFile);
    end;
   ADOConnection1.ConnectionString:='Provider=Microsoft.Jet.OLEDB.4.0;Data Source='+ExtractFilePath (Application.ExeName)+'Temp.mdb'+';Persist Security Info=False';
   TWELLHEADER.Connection:=ADOConnection1;
   DATASOURCE1.DataSet:=TWELLHEADER;
   refresht;
   combobox4.ItemIndex:=0;
   REFCOMBO4;
   COMBOBOX4.Text:=DBEDIT1.Text;
   SENDTOWELLFORM;
   TWELLHEADER.OPEN;
   TWELLHEADER.FIRST;
   REFCOMBO2;
   COMBOBOX2.Text:=COMBOBOX2.Items.Strings[0];
   combobox2.ItemIndex:=0;
   SENDTOBITFORM;
   combobox4.ItemIndex:=0;

   REFCOMBO6;
   ComboBox6.Text:=COMBOBOX6.Items.Strings[0];
   combobox6.ItemIndex:=0;
   SENDTOCASINGFORM;
   combobox6.ItemIndex:=0;
end;

procedure TForm41.RadioGroup1Exit(Sender: TObject);
begin
 sendtodbbitrun;
end;

procedure TForm41.RadioGroup2Click(Sender: TObject);
begin
 if (RadioGroup2.ItemIndex=0) OR (RadioGroup2.ItemIndex=3) then
   BUTTON10.Enabled:=TRUE
 ELSE
  BEGIN
   SHOWMESSAGE('UNDER CONSTRUNCTION');
   BUTTON10.Enabled:=FALSE;
  END;

 end;

procedure TForm41.SetupGridPickList(const FieldName, sql: string);
var
  slPickList:TStringList;
  Query : TADOQuery;
  i : integer;
begin
  slPickList:=TStringList.Create;
  Query := TADOQuery.Create(self);
  try
    Query.Connection := ADOConnection1;
    Query.SQL.Text := sql;
    Query.Open;
    //Fill the string list
    while not Query.EOF do
    begin
      slPickList.Add(Query.Fields[0].AsString);
      Query.Next;
    end; //while

    //place the list it the correct column
  finally
    slPickList.Free;
    Query.Free;
  end;
end; procedure TForm41.StringGrid12KeyUp(Sender: TObject; var Key: Word;
  Shift: TShiftState);
begin
   sendtodbbitrun;
end;

procedure TForm41.StringGrid1KeyPress(Sender: TObject; var Key: Char);
begin
 if StringIsDigit(key) then
  begin
   sendtodbbitrun;
  end
 else
  begin
   if key<>#8 then
     key:=#0;
  end;

end;

procedure TForm41.StringGrid1KeyUp(Sender: TObject; var Key: Word;
  Shift: TShiftState);
begin
   sendtodbbitrun;
end;

procedure TForm41.StringGrid2KeyUp(Sender: TObject; var Key: Word;
  Shift: TShiftState);
begin
   sendtodbbitrun;
end;

procedure TForm41.StringGrid3SelectCell(Sender: TObject; ACol, ARow: Integer;
  var CanSelect: Boolean);
VAR
 II:INTEGER;
begin
 teqqq:=arow;
 if dbedit1.Text<>'' then
  begin
   TWELLHEADER.Open;
   TWELLHEADER.Edit;
   TWELLHEADER.FieldByName('SurfaceEquipmentCaseNumber').asinteger:=AROW;
   TWELLHEADER.Post;
   sendtodbwellheader;
  end;

end;

procedure TForm41.StringGrid4DblClick(Sender: TObject);
begin
 stringgrid4.Visible:=false;
 STRINGGRID5.CELLS[0,RST5]:=STRINGGRID4.CELLS[0,RST4];
 STRINGGRID5.CELLS[1,RST5]:=STRINGGRID4.CELLS[1,RST4];
 STRINGGRID5.CELLS[2,RST5]:=STRINGGRID4.CELLS[2,RST4];
 STRINGGRID5.CELLS[3,RST5]:=STRINGGRID4.CELLS[3,RST4];
end;

procedure TForm41.StringGrid4SelectCell(Sender: TObject; ACol, ARow: Integer;
  var CanSelect: Boolean);
begin
 RST4:=AROW;
end;

procedure TForm41.StringGrid5DblClick(Sender: TObject);
begin
 stringgrid4.Visible:=false;
end;
procedure TForm41.StringGrid5DrawCell(Sender: TObject; ACol, ARow: Integer;
  Rect: TRect; State: TGridDrawState);
var
  DrawState,II: Integer;
  DrawRect: TRect;
begin
 if (gdFocused in State) then
  begin
   if MRST5>=AROW then
    BEGIN
     RST5:=AROW;
     CST5:=ACOL;
     if (ACol>4) then
       StringGrid5.Options:=StringGrid5.Options+[GOEDITING]
     ELSE
       StringGrid5.Options:=StringGrid5.Options-[GOEDITING];
     if (ACol=4) then
      begin
       combobox5.Left := Rect.Left + stringgrid5.Left + 2;
       combobox5.Top := Rect.Top + stringgrid5.top + 2;
       combobox5.Width := Rect.Right - Rect.Left;
       combobox5.Height := Rect.Bottom - Rect.Top;
       combobox5.Visible := True;
       ii:=0;
       if stringgrid5.Cells[acol,arow]<>'' then
        begin
         while COPY(stringgrid5.Cells[acol,arow],1,LENGTH(ComboBox5.Items[ii]))<>ComboBox5.Items[ii] do
          ii:=ii+1;
         ComboBox5.ItemIndex:=ii;
        end;
       stringgrid5.Cells[acol,arow]:=COMBOBOX5.TEXT;
      end
     else
      begin
       combobox5.Visible := false;
      end;
     if (ACol=0) then
      begin
       stringgrid4.Top := Rect.Top + stringgrid5.top + 2+Rect.Bottom - Rect.Top;
       stringgrid4.Visible:=true;
       ii:=0;
       if stringgrid5.Cells[acol,arow]<>'' then
        begin
         while ((stringgrid5.Cells[0,arow]<>stringgrid4.Cells[0,ii])
         or(stringgrid5.Cells[1,arow]<>stringgrid4.Cells[1,ii]))AND(II<=stringgrid4.ROWCOUNT) do
          ii:=ii+1;
         if II<stringgrid4.ROWCOUNT then
           stringgrid4.row:=ii
         ELSE
           stringgrid4.row:=1;
        end;
      end
     else
      begin
       stringgrid4.Visible:=false;
      end;
    end;
  end
end;

procedure TForm41.StringGrid5Enter(Sender: TObject);
begin
 sendtodbcasing;
end;

procedure TForm41.StringGrid5Exit(Sender: TObject);
begin
 sendtodbcasing;
end;

procedure TForm41.StringGrid5SelectCell(Sender: TObject; ACol, ARow: Integer;
  var CanSelect: Boolean);
VAR
 II:INTEGER;
begin
 II:=0;
 while STRINGGRID5.Cells[0,II]<>'' do
  II:=II+1;
 MRST5:=II;

end;

procedure TForm41.StringGrid5SetEditText(Sender: TObject; ACol, ARow: Integer;
  const Value: string);
begin
 sendtodbcasing;
end;

procedure TForm41.StringGrid6DblClick(Sender: TObject);
begin
 stringgrid6.Visible:=false;
 STRINGGRID7.CELLS[1,RDP7]:=STRINGGRID6.CELLS[0,RDP6];
 STRINGGRID7.CELLS[2,RDP7]:=STRINGGRID6.CELLS[1,RDP6];
 BYTWT(RDP7);
end;
PROCEDURE TFORM41.BYTWT(KKK:INTEGER);
var
 ii:integer;
 Tlen,tbw,bf:real;
BEGIN
 bf:=1-((strtofloat(edit6.Text)*cnv[4].conv)/65.5);
 tlen:=strtofloat(STRINGGRID1.Cells[2,2]);
 for ii := 2 to stringgrid7.RowCount do
  begin
   if stringgrid7.Cells[3,ii]<>'' then
     tlen:=tlen-strtofloat(stringgrid7.Cells[3,ii]);
  end;
 stringgrid7.Cells[3,1]:=floattostr(tlen);
 if (stringgrid7.Cells[4,KKK]='YES') then
  BEGIN
   stringgrid7.Cells[5,KKK]:=FLOATTOSTR(0.01*ROUND(bf*STRTOFLOAT(stringgrid7.Cells[3,KKK])*cnv[0].conv*100*WT(STRINGGRID7.CELLS[0,KKK],STRTOFLOAT(STRINGGRID7.CELLS[1,KKK])*cnv[1].conv,STRTOFLOAT(STRINGGRID7.CELLS[2,KKK])*cnv[1].conv)*cnv[6].conv));
  END
 ELSE
  BEGIN
   stringgrid7.Cells[5,KKK]:='0';
  END;
 tbw:=0;
 for ii := 1 to stringgrid7.RowCount do
  begin
   if (stringgrid7.Cells[4,II]='YES') then
    BEGIN
     TBW:=STRTOFLOAT(stringgrid7.Cells[5,II])+TBW;
    END;
  end;
 EDIT8.Text:=FLOATTOSTR(0.01*ROUND(100*TBW));
END;
procedure TForm41.StringGrid6Exit(Sender: TObject);
begin
 SENDTODBBHA;
end;

procedure TForm41.StringGrid6SelectCell(Sender: TObject; ACol, ARow: Integer;
  var CanSelect: Boolean);
begin
 RDP6:=AROW;
end;

procedure TForm41.StringGrid7DblClick(Sender: TObject);
begin
 stringgrid6.Visible:=false;
end;
FUNCTION TFORM41.WT(BHA:STRING;OD,ID:REAL):REAL;
BEGIN
 if BHA<>'' then
  BEGIN
   BHALIST.Active:=FALSE;
   if BHA='DRILL PIPE' then
     BHALIST.TableName:='strDrillPipe'
   ELSE if BHA='HW PIPE' then
     BHALIST.TableName:='strHWDP'
   ELSE if BHA='DRILL COLLAR' then
     BHALIST.TableName:='strDrillCollar';
   BHALIST.Active:=TRUE;
   BHALIST.First;
   WT:=0;
   while NOT BHALIST.Eof  do
    BEGIN
     if (ABS(BHALIST.FieldByName('OD').AsFloat-OD)<0.02)AND(ABS(BHALIST.FieldByName('ID').AsFloat-ID)<0.02) then
      BEGIN
       WT:=BHALIST.FieldByName('WT').AsFloat;
       BREAK;
      END;
     BHALIST.Next;
    END;
  END;
END;
procedure TForm41.StringGrid7DrawCell(Sender: TObject; ACol, ARow: Integer;
  Rect: TRect; State: TGridDrawState);
var
  DrawState,II: Integer;
  DrawRect: TRect;
begin
 if (gdFocused in State) then
  begin
   if MRDP7>=AROW then
    BEGIN
     RDP7:=AROW;
     CDP7:=ACOL;
     if (ACol=3) then
       StringGrid7.Options:=StringGrid7.Options+[GOEDITING]
     ELSE
       StringGrid7.Options:=StringGrid7.Options-[GOEDITING];
     if (ACol=0)AND(AROW<>1) then
      begin
       combobox7.Left := Rect.Left + stringgrid7.Left + 2;
       combobox7.Top := Rect.Top + stringgrid7.top + 2;
       combobox7.Width := Rect.Right - Rect.Left;
       combobox7.Height := Rect.Bottom - Rect.Top;
       combobox7.Visible := True;
       ii:=0;
       if stringgrid7.Cells[acol,arow]<>'' then
        begin
         while COPY(stringgrid7.Cells[acol,arow],1,LENGTH(ComboBox7.Items[ii]))<>ComboBox7.Items[ii] do
          ii:=ii+1;
         ComboBox7.ItemIndex:=ii;
        end;
       stringgrid7.Cells[acol,arow]:=COMBOBOX7.TEXT;
      end
     else
      begin
       combobox7.Visible := false;
      end;
     if (ACol=4) then
      begin
       combobox8.Left := Rect.Left + stringgrid7.Left + 2;
       combobox8.Top := Rect.Top + stringgrid7.top + 2;
       combobox8.Width := Rect.Right - Rect.Left;
       combobox8.Height := Rect.Bottom - Rect.Top;
       combobox8.Visible := True;
       ii:=0;
       if stringgrid7.Cells[acol,arow]<>'' then
        begin
         while COPY(stringgrid7.Cells[acol,arow],1,LENGTH(ComboBox8.Items[ii]))<>ComboBox8.Items[ii] do
          ii:=ii+1;
         ComboBox8.ItemIndex:=ii;
        end;
       stringgrid7.Cells[acol,arow]:=COMBOBOX8.TEXT;
      end
     else
      begin
       combobox8.Visible := false;
      end;
     if (ACol=1) then
      begin
       BHAFILLER(stringgrid7.Cells[0,arow]);
       stringgrid6.Top := Rect.Top + stringgrid7.top + 2+Rect.Bottom - Rect.Top;
       stringgrid6.Left := Rect.Left + stringgrid7.Left + 2;
       stringgrid6.Visible:=true;
       ii:=0;
       if stringgrid7.Cells[acol,arow]<>'' then
        begin
         while ((stringgrid7.Cells[1,arow]<>stringgrid6.Cells[0,ii])
         or(stringgrid7.Cells[2,arow]<>stringgrid6.Cells[1,ii]))AND(II<=stringgrid6.ROWCOUNT) do
          ii:=ii+1;
         if II<stringgrid6.ROWCOUNT then
           stringgrid6.row:=ii
         ELSE
           stringgrid6.row:=1;
        end;
      end
     else
      begin
       stringgrid6.Visible:=false;
      end;
    end;
  end
end;
PROCEDURE TFORM41.BHAFILLER(QQ:string);
VAR
 KK:INTEGER;
BEGIN
 for KK := 1 to StringGrid1.ROWCOUNT - 1 do
  StringGrid6.ROWS[KK].Clear;
 BHALIST.Active:=FALSE;
 if QQ='DRILL PIPE' then
   BHALIST.TableName:='strDrillPipe'
 ELSE if QQ='HW PIPE' then
   BHALIST.TableName:='strHWDP'
 ELSE if QQ='DRILL COLLAR' then
   BHALIST.TableName:='strDrillCollar';
 BHALIST.Active:=TRUE;
 BHALIST.First;
 if QQ='DRILL PIPE' then
  BEGIN
   kk:=1;
   STRINGGRID6.ColCount:=5;
   form41.stringgrid6.Cells[0,0]:='SIZE ('+CNV[1].name+')';
   form41.stringgrid6.Cells[1,0]:='EQ ID ('+CNV[1].name+')';
   form41.stringgrid6.Cells[2,0]:='WT/LEN ('+CNV[6].name+'/'+CNV[0].name+')';
   form41.stringgrid6.Cells[3,0]:='TJ ID ('+CNV[1].name+')';
   form41.stringgrid6.Cells[4,0]:='TJ TYPE';

   STRINGGRID6.ColCount:=5;
   while NOT BHALIST.Eof do
    BEGIN
     stringgrid6.Cells[0,kk]:=FLOATTOSTR(trunc(100*BHALIST.FieldByName('OD').AsFloat/cnv[1].conv)/100);
     stringgrid6.Cells[1,kk]:=FLOATTOSTR(trunc(100*BHALIST.FieldByName('ID').AsFloat)/cnv[1].conv/100);
     stringgrid6.Cells[2,kk]:=FLOATTOSTR(trunc(100*BHALIST.FieldByName('WT').AsFloat)*cnv[0].conv/cnv[6].conv/100);
     stringgrid6.Cells[3,kk]:=BHALIST.FieldByName('TJID').AsSTRING;
     stringgrid6.Cells[4,kk]:=BHALIST.FieldByName('TJ').AsSTRING;
     BHALIST.Next;
     kk:=kk+1;
    END;
   STRINGGRID6.ROWCOUNT:=KK;
  END;
 if QQ='HW PIPE' then
  BEGIN
   kk:=1;
   STRINGGRID6.ColCount:=5;
   form41.stringgrid6.Cells[0,0]:='SIZE ('+CNV[1].name+')';
   form41.stringgrid6.Cells[1,0]:='EQ ID ('+CNV[1].name+')';
   form41.stringgrid6.Cells[2,0]:='WT/LEN ('+CNV[6].name+'/'+CNV[0].name+')';
   form41.stringgrid6.Cells[3,0]:='TJ';
   form41.stringgrid6.Cells[4,0]:='TYPE';

   while NOT BHALIST.Eof do
    BEGIN
     stringgrid6.Cells[0,kk]:=FLOATTOSTR(trunc(100*BHALIST.FieldByName('OD').AsFloat/cnv[1].conv)/100);
     stringgrid6.Cells[1,kk]:=FLOATTOSTR(trunc(100*BHALIST.FieldByName('ID').AsFloat)/cnv[1].conv/100);
     stringgrid6.Cells[2,kk]:=FLOATTOSTR(trunc(100*BHALIST.FieldByName('WT').AsFloat)*cnv[0].conv/cnv[6].conv/100);
     stringgrid6.Cells[3,kk]:=BHALIST.FieldByName('TJ').AsSTRING;
     stringgrid6.Cells[4,kk]:=BHALIST.FieldByName('TYPE').AsSTRING;;
     BHALIST.Next;
     kk:=kk+1;
    END;
   STRINGGRID6.ROWCOUNT:=KK;
  END;
 if QQ='DRILL COLLAR' then
  BEGIN
   kk:=1;
   STRINGGRID6.ColCount:=5;
   form41.stringgrid6.Cells[0,0]:='SIZE ('+CNV[1].name+')';
   form41.stringgrid6.Cells[1,0]:='ID ('+CNV[1].name+')';
   form41.stringgrid6.Cells[2,0]:='TYPE OIL.F';
   form41.stringgrid6.Cells[3,0]:='TYPE STD';
   form41.stringgrid6.Cells[4,0]:='OD (IN)';
   while NOT BHALIST.Eof do
    BEGIN
     stringgrid6.Cells[0,kk]:=FLOATTOSTR(trunc(100*BHALIST.FieldByName('OD').AsFloat/cnv[1].conv)/100);
     stringgrid6.Cells[1,kk]:=FLOATTOSTR(trunc(100*BHALIST.FieldByName('ID').AsFloat)/cnv[1].conv/100);
     stringgrid6.Cells[2,kk]:=BHALIST.FieldByName('TYPE1').AsSTRING;
     stringgrid6.Cells[3,kk]:=BHALIST.FieldByName('TYPE2').AsSTRING;
     stringgrid6.Cells[4,kk]:=BHALIST.FieldByName('OD2').AsSTRING;
     BHALIST.Next;
     kk:=kk+1;
    END;
   STRINGGRID6.ROWCOUNT:=KK;
  END;

END;

procedure TForm41.StringGrid7SelectCell(Sender: TObject; ACol, ARow: Integer;
  var CanSelect: Boolean);
VAR
 II:INTEGER;
begin
 II:=0;
 while STRINGGRID7.Cells[0,II]<>'' do
  II:=II+1;
 MRDP7:=II;
end;

procedure TForm41.StringGrid7SetEditText(Sender: TObject; ACol, ARow: Integer;
  const Value: string);
begin
 SENDTODBBHA;
 if ACOL=3 then
   BYTWT(RDP7);
end;

procedure TForm41.StringGrid8Exit(Sender: TObject);
begin
 sendtodbbitrun;
end;

procedure TForm41.TabSheet5Resize(Sender: TObject);
begin
end;

(*SetupGridPickList*)


procedure TForm41.Units1Click(Sender: TObject);
begin
 form42.ShowModal;
 SENDTOCASINGFORM;
 SENDTOBITFORM;
 SENDTOBHAFORM;
 SENDTOWELLFORM;
end;
PROCEDURE TFORM41.ANUPARTFINDER(WLNM,CSGNAME,BHANAME,bitrun:STRING);
var
 extra1:AUPART;
 extra2:array [1..1500]of AUPART;
 ii,iii,jj,kk,ll:integer;
 drillingdepth,extra3:real;
 depths,depth2:array [1..1500] of real;
BEGIN
 for ii:=1 to 1500 do
  begin
   annulus[ii].QAT:=0;
   annulus[ii].TAT:=0;
   annulus[ii].GSG:=0;
   annulus[ii].SSG:=0;
   annulus[ii].GMOLWT:=0;
   annulus[ii].ELEV:=0;
   annulus[ii].EH:=0;
   annulus[ii].EP:=0;
   annulus[ii].ROP:=0;
   annulus[ii].DH:=0;
   annulus[ii].ODP:=0;
   ANNULUS[II].TGRD:=0;
   annulus[ii].DEPT1:=0;
   annulus[ii].DEPT2:=0;
   depths[ii]:=0;
   EXTRA2[II]:=ANNULUS[II];
  end;
 tbitrun.Active:=false;
 tbitrun.Tablename:='bitrun';
 tbitrun.Active:=true;
 tbitrun.First;
 tbitrun.Open;
 while not((tbitrun.Eof)or((tbitrun.FieldByName('wellname').AsString=wlnm)and(tbitrun.FieldByName('bitnumber').AsString=bitrun))) do
  begin
   tbitrun.Next;
  end;
 drillingdepth:=tbitrun.fieldbyname('tvdout').asfloat;
 TCASING.Active:=false;
 TCASING.Tablename:='casing';
 TCASING.Active:=true;
 TCASING.First;
 ii:=1;
 while not(TCASING.Eof)do
  begin
   if ((TCASING.FieldByName('wellname').AsString=wlnm)and(TCASING.FieldByName('CASINGNAME').AsString=CSGNAME)) then
    begin
     annulus[ii].QAT:=TBITRUN.FieldByName('SURFFLOW').ASFLOAT;
     annulus[ii].TAT:=TBITRUN.FieldByName('SURFTEMP').ASFLOAT;
     annulus[ii].GSG:=TBITRUN.FieldByName('GSPECGRV').ASFLOAT;
     annulus[ii].SSG:=TBITRUN.FieldByName('SSPECGRV').ASFLOAT;
     annulus[ii].GMOLWT:=TBITRUN.FieldByName('MOLEWT').ASFLOAT;
     annulus[ii].ELEV:=TBITRUN.FieldByName('ELEVATION').ASFLOAT;
     annulus[ii].EH:=TBITRUN.FieldByName('DPROUGH').ASFLOAT;
     annulus[ii].EP:=TBITRUN.FieldByName('DPROUGH').ASFLOAT;
     annulus[ii].ROP:=TBITRUN.FieldByName('PREDROP').ASFLOAT;
     annulus[ii].DH:=TCASING.FieldByName('ID').ASFLOAT;
     annulus[ii].ODP:=0;
     ANNULUS[II].TGRD:=TBITRUN.FieldByName('GEOTHERM').ASFLOAT;
     annulus[ii].DEPT1:=TCASING.FieldByName('DTOP').ASFLOAT;
     annulus[ii].DEPT2:=TCASING.FieldByName('DBTM').ASFLOAT;
     annulus[ii].MFRATE:=TBITRUN.FieldByName('MUDFLOW').ASFLOAT;;
     annulus[ii].MW:=TBITRUN.FieldByName('MudWt').ASFLOAT;
     annulus[ii].MVIS:=TBITRUN.FieldByName('PV').ASFLOAT;;


     ii:=ii+1;
    end;
   TCASING.Next;
  end;
 jj:=ii-1;
 for kk := 1 to jj do
  begin
   for ll := kk to jj do
    begin
     if annulus[kk].DEPT1>annulus[ll].DEPT1 then
      begin
       extra1:=annulus[ll];
       annulus[ll]:=annulus[kk];
       annulus[kk]:=extra1;
      end;
    end;
  end;
 TBHA.Active:=false;
 TBHA.Tablename:='DRILLSTRING';
 TBHA.Active:=true;
 TBHA.First;
 while not(TBHA.Eof)do
  begin
   if ((TBHA.FieldByName('wellname').AsString=wlnm)and(TBHA.FieldByName('BHANAME').AsString=BHANAME)) then
    begin
     annulus[ii].QAT:=TBITRUN.FieldByName('SURFFLOW').ASFLOAT;
     annulus[ii].TAT:=TBITRUN.FieldByName('SURFTEMP').ASFLOAT;
     annulus[ii].GSG:=TBITRUN.FieldByName('GSPECGRV').ASFLOAT;
     annulus[ii].SSG:=TBITRUN.FieldByName('SSPECGRV').ASFLOAT;
     annulus[ii].GMOLWT:=TBITRUN.FieldByName('MOLEWT').ASFLOAT;
     annulus[ii].ELEV:=TBITRUN.FieldByName('ELEVATION').ASFLOAT;
     annulus[ii].EH:=TBITRUN.FieldByName('DPROUGH').ASFLOAT;
     annulus[ii].EP:=TBITRUN.FieldByName('DPROUGH').ASFLOAT;
     annulus[ii].ROP:=TBITRUN.FieldByName('PREDROP').ASFLOAT;
     annulus[ii].DH:=0;
     ANNULUS[II].TGRD:=TBITRUN.FieldByName('GEOTHERM').ASFLOAT;
     annulus[ii].ODP:=TBHA.FieldByName('SIZE').ASFLOAT;
     annulus[ii].MFRATE:=TBITRUN.FieldByName('MUDFLOW').ASFLOAT;;
     annulus[ii].MW:=TBITRUN.FieldByName('MudWt').ASFLOAT;
     annulus[ii].MVIS:=TBITRUN.FieldByName('PV').ASFLOAT;;

     depths[ii]:=TBHA.FieldByName('Length').ASFLOAT;
     ii:=ii+1;
    end;
   tbha.Next;
  end;
 ii:=ii-1;
 for kk := 1 to ii do
   annulus[kk].NOIT:=ii;
 annulus[ii].DEPT2:=round(10000*drillingdepth)/10000;
 annulus[ii].DEPT1:=round(10000*(annulus[ii].DEPT2-depths[ii]))/10000;
 for kk := ii-1 downto (jj+1) do
  begin
   annulus[kk].DEPT2:=round(10000*(annulus[kk+1].DEPT1))/10000;
   annulus[kk].DEPT1:=round(10000*(annulus[kk].DEPT2-depths[kk]))/10000;
  end;
 for kk := jj+1 to ii do
  begin
   for ll := kk to ii do
    begin
     if annulus[kk].DEPT1>annulus[ll].DEPT1 then
      begin
       extra1:=annulus[ll];
       annulus[ll]:=annulus[kk];
       annulus[kk]:=extra1;
      end;
    end;
  end;
 for iii := 1 to 2*(ii+1) do
  begin
   depths[iii]:=-1;
   depth2[iii]:=-1;
  end;
 for iii := 0 to ii-1 do
  begin
   depths[2*iii+1]:=annulus[iii+1].dept1;
   depths[2*iii+2]:=annulus[iii+1].dept2;
  end;
 for kk := jj to 2*ii do
  begin
   for ll := kk to 2*ii do
    begin
     if depths[kk]>depths[ll] then
      begin
       extra3:=depths[ll];
       depths[ll]:=depths[kk];
       depths[kk]:=extra3;
      end;
    end;
  end;
 kk:=1;
 depth2[1]:=depths[1];
 for iii := 1 to 2*ii do
  begin
   if abs(depth2[kk]-depths[iii])>0.00001 then
    begin
     kk:=kk+1;
     depth2[kk]:=depths[iii];
    end;
  end;
 for iii := 1 to kk-1 do
  begin
   extra2[iii].NOIT:=annulus[1].NOIT;
   extra2[iii].QAT:=annulus[1].QAT;
   extra2[iii].TAT:=annulus[1].TAT;
   extra2[iii].GSG:=annulus[1].GSG;
   extra2[iii].SSG:=annulus[1].SSG;
   extra2[iii].GMOLWT:=annulus[1].GMOLWT;
   extra2[iii].ELEV:=annulus[1].ELEV;
   extra2[iii].EH:=annulus[1].EH;
   extra2[iii].EP:=annulus[1].EP;
   extra2[iii].ROP:=annulus[1].ROP;
   EXTRA2[III].TGRD:=ANNULUS[1].TGRD;
   extra2[iii].DEPT1:=depth2[III];
   extra2[iii].DEPT2:=depth2[III+1];
   EXTRA2[III].MFRATE:=ANNULUS[1].MFRATE;
   EXTRA2[III].MW:=ANNULUS[1].MW;
   EXTRA2[III].MVIS:=ANNULUS[1].MVIS;

   for ll := 1 to jj do
    begin
     if (((depth2[iii]+depth2[iii+1])/2>annulus[ll].DEPT1)and((depth2[iii]+depth2[iii+1])/2<annulus[ll].DEPT2)) then
      begin
       extra2[iii].DH:=ANNULUS[LL].DH;
      end;
    end;
   for ll := jj+1 to ii do
    begin
     if (((depth2[iii]+depth2[iii+1])/2>annulus[ll].DEPT1)and((depth2[iii]+depth2[iii+1])/2<annulus[ll].DEPT2)) then
      begin
       extra2[iii].ODP:=annulus[ll].ODP;
      end;
    end;
  end;
 for III := 1 to KK-1 do
  BEGIN
   if extra2[iii].DH=0 then
    BEGIN
     EXTRA2[III].DH:=TBITRUN.FIELDBYNAME('BITSIZE').ASFLOAT;
     EXTRA2[III].EH:=TBITRUN.FIELDBYNAME('OHROUGH').ASFLOAT;
    END;
  END;
 for III := 1 to KK-1 do
   EXTRA2[III].NOIT:=KK-1;
 for III := 1 to 1500 do
   ANNULUS[III]:=EXTRA2[III];
END;





PROCEDURE TFORM41.STRPARTFINDER(WLNM,CSGNAME,BHANAME,bitrun:STRING);
var
 extra1:DPPART;
 ii,kk,ll:integer;
 drillingdepth:real;
 depths:array [1..1500] of real;
BEGIN
 for ii:=1 to 1500 do
  begin
   STRINGS[ii].QAT:=0;
   STRINGS[ii].TAT:=0;
   STRINGS[ii].GSG:=0;
   STRINGS[ii].GMOLWT:=0;
   STRINGS[ii].ELEV:=0;
   STRINGS[ii].EP:=0;
   STRINGS[II].TGRD:=0;
   STRINGS[ii].DEPT1:=0;
   STRINGS[ii].DEPT2:=0;
   depths[ii]:=0;
  end;
 tbitrun.Active:=false;
 tbitrun.Tablename:='bitrun';
 tbitrun.Active:=true;
 tbitrun.First;
 tbitrun.Open;
 while not((tbitrun.Eof)or((tbitrun.FieldByName('wellname').AsString=wlnm)and(tbitrun.FieldByName('bitnumber').AsString=bitrun))) do
  begin
   tbitrun.Next;
  end;
 drillingdepth:=tbitrun.fieldbyname('tvdout').asfloat;

 TBHA.Active:=false;
 TBHA.Tablename:='DRILLSTRING';
 TBHA.Active:=true;
 TBHA.First;
 ii:=1;
 while not(TBHA.Eof)do
  begin
   if ((TBHA.FieldByName('wellname').AsString=wlnm)and(TBHA.FieldByName('BHANAME').AsString=BHANAME)) then
    begin
     STRINGS[ii].QAT:=TBITRUN.FieldByName('SURFFLOW').ASFLOAT;
     STRINGS[ii].TAT:=TBITRUN.FieldByName('SURFTEMP').ASFLOAT;
     STRINGS[ii].GSG:=TBITRUN.FieldByName('GSPECGRV').ASFLOAT;
     STRINGS[ii].GMOLWT:=TBITRUN.FieldByName('MOLEWT').ASFLOAT;
     STRINGS[ii].ELEV:=TBITRUN.FieldByName('ELEVATION').ASFLOAT;
     STRINGS[ii].EP:=TBITRUN.FieldByName('DPROUGH').ASFLOAT;
     STRINGS[ii].TGRD:=TBITRUN.FieldByName('GEOTHERM').ASFLOAT;
     STRINGS[ii].DP:=TBHA.FieldByName('ID').ASFLOAT;
     STRINGS[ii].MFRATE:=TBITRUN.FieldByName('MUDFLOW').ASFLOAT;;
     STRINGS[ii].MW:=TBITRUN.FieldByName('MudWt').ASFLOAT;
     STRINGS[ii].MVIS:=TBITRUN.FieldByName('PV').ASFLOAT;
     depths[ii]:=TBHA.FieldByName('Length').ASFLOAT;
     ii:=ii+1;
    end;
   tbha.Next;
  end;
 ii:=ii-1;
 for kk := 1 to ii do
   STRINGS[kk].NOIT:=ii;
 STRINGS[ii].DEPT2:=round(10000*drillingdepth)/10000;
 STRINGS[ii].DEPT1:=round(10000*(STRINGS[ii].DEPT2-depths[ii]))/10000;
 for kk := ii-1 downto 1 do
  begin
   STRINGS[kk].DEPT2:=round(10000*(STRINGS[kk+1].DEPT1))/10000;
   STRINGS[kk].DEPT1:=round(10000*(STRINGS[kk].DEPT2-depths[kk]))/10000;
  end;
 for kk := 1 to ii do
  begin
   for ll := kk to ii do
    begin
     if STRINGS[kk].DEPT2<STRINGS[ll].DEPT2 then
      begin
       extra1:=STRINGS[ll];
       STRINGS[ll]:=STRINGS[kk];
       STRINGS[kk]:=extra1;
      end;
    end;
  end;
END;


PROCEDURE TFORM41.BITPARTFINDER(WLNM,bitrun:STRING);
var
 ii,JJ:integer;
BEGIN
 BITSPEC.QAT:=0;
 BITSPEC.TAT:=0;
 BITSPEC.GSG:=0;
 BITSPEC.GMOLWT:=0;
 BITSPEC.K:=0;
 BITSPEC.PBH:=0;
 BITSPEC.TGRD:=0;
 BITSPEC.DEPTH:=0;

 tbitrun.Active:=false;
 tbitrun.Tablename:='bitrun';
 tbitrun.Active:=true;
 tbitrun.First;
 tbitrun.Open;
 while not((tbitrun.Eof)or((tbitrun.FieldByName('wellname').AsString=wlnm)and(tbitrun.FieldByName('bitnumber').AsString=bitrun))) do
  begin
   tbitrun.Next;
  end;
 BITSPEC.QAT:=TBITRUN.FieldByName('SURFFLOW').ASFLOAT;
 BITSPEC.TAT:=TBITRUN.FieldByName('SURFTEMP').ASFLOAT;
 BITSPEC.GSG:=TBITRUN.FieldByName('GSPECGRV').ASFLOAT;
 BITSPEC.GMOLWT:=TBITRUN.FieldByName('MOLEWT').ASFLOAT;
 BITSPEC.K:=TBITRUN.FIELDBYNAME('HEATC').ASFLOAT;
 BITSPEC.TGRD:=TBITRUN.FIELDBYNAME('GEOTHERM').ASFLOAT;;
 BITSPEC.DEPTH:=tbitrun.fieldbyname('tvdout').asfloat;
 BITSPEC.MFRATE:=TBITRUN.FieldByName('MUDFLOW').ASFLOAT;;
 BITSPEC.MW:=TBITRUN.FieldByName('MudWt').ASFLOAT;
 form43.FXDNZL.Active:=false;
 form43.FXDNZL.TableName:='FixedNozzles';
 form43.FXDNZL.Active:=true;
 form43.FXDNZL.First;
 while not((form43.FXDNZL.FieldByName('wellname').asstring=WLNM)and
 (form43.FXDNZL.FieldByName('bitnumber').asstring=bitrun))do
   form43.FXDNZL.Next;
 for ii := 0 to 2 do
  begin
   for jj := 0 to 4 do
    begin
     BITSPEC.JETS[5*II+JJ+1]:=form43.FXDNZL.Fields.FieldByNumber(7+ii+3*jj).AsFloat;
    end;
  end;
END;
PROCEDURE TFORM41.BLNPARTFINDER(WLNM,bitrun:STRING);
BEGIN
 BLNSPEC.QAT:=0;
 BLNSPEC.TAT:=0;
 BLNSPEC.GSG:=0;
 BLNSPEC.GMOLWT:=0;
 BLNSPEC.ELEV:=0;
 BLNSPEC.LB:=0;
 BLNSPEC.DB:=0;
 BLNSPEC.EB:=0;
 BLNSPEC.KT:=0;
 BLNSPEC.KV:=0;
 BLNSPEC.VALVNO:=0;

 BLNSPEC.MFRATE:=0;
 BLNSPEC.MW:=0;
 BLNSPEC.MVIS:=0;
 BLNSPEC.ROP:=0;
 BLNSPEC.SSG:=0;
 BLNSPEC.DH:=0;



 tbitrun.Active:=false;
 tbitrun.Tablename:='bitrun';
 tbitrun.Active:=true;
 tbitrun.First;
 tbitrun.Open;
 while not((tbitrun.Eof)or((tbitrun.FieldByName('wellname').AsString=wlnm)and(tbitrun.FieldByName('bitnumber').AsString=bitrun))) do
  begin
   tbitrun.Next;
  end;
 BLNSPEC.QAT:=TBITRUN.FieldByName('SURFFLOW').ASFLOAT;
 BLNSPEC.TAT:=TBITRUN.FieldByName('SURFTEMP').ASFLOAT;
 BLNSPEC.GSG:=TBITRUN.FieldByName('GSPECGRV').ASFLOAT;
 BLNSPEC.GMOLWT:=TBITRUN.FieldByName('MOLEWT').ASFLOAT;
 BLNSPEC.ELEV:=TBITRUN.FieldByName('ELEVATION').ASFLOAT;
 BLNSPEC.LB:=100;
 BLNSPEC.DB:=5.625;
 BLNSPEC.EB:=TBITRUN.FieldByName('DPROUGH').ASFLOAT;
 BLNSPEC.KT:=30;
 BLNSPEC.KV:=0.2;
 BLNSPEC.VALVNO:=2;

 BLNSPEC.MFRATE:=TBITRUN.FieldByName('MUDFLOW').ASFLOAT;;
 BLNSPEC.MW:=TBITRUN.FieldByName('MudWt').ASFLOAT;
 BLNSPEC.MVIS:=TBITRUN.FieldByName('PV').ASFLOAT;
 BLNSPEC.ROP:=TBITRUN.FieldByName('PREDROP').ASFLOAT;
 BLNSPEC.SSG:=TBITRUN.FieldByName('SSPECGRV').ASFLOAT;;
 BLNSPEC.DH:=TBITRUN.FieldByName('bitsize').AsFloat;

END;
procedure TForm41.CALCULATE(CALCTYPE:INTEGER;depthing:real;descpart:string);
VAR
 II,iii,JJ,KK,jjj,ll,lidx:INTEGER;
 P0,DL,BOTTOM:REAL;
 AD,PD:ARRAY [1..1500] OF REAL;
 PG:ARRAY [1..1500]OF GRAPHING;
 PGD:ARRAY OF GRAPHING;
 APG:GRAPHING;
 memor:array[1..2]of integer;
 SHAFTWORK:REAL;
BEGIN
 BOTTOM:=tbitrun.fieldbyname('tvdout').asfloat;
 DL:=TRUNC(tbitrun.fieldbyname('tvdout').asfloat/100);
 SETLENGTH(PGD,STRINGGRID5.RowCount);
 for ii := 1 to form44.StringGrid5.RowCount - 1 do
   form44.StringGrid5.Rows[ii].Clear;
 if CALCTYPE=0 then
  BEGIN
   BLNPARTFINDER(COMBOBOX4.Text,COMBOBOX2.Text);
   JJ:=1;
   PG[JJ].PARTDESC:='SURFACE';
   PG[JJ].DEPTH:=0;
   PG[JJ].PRESS:=SURPRESS(BLNSPEC.ELEV);
   PG[JJ].VELO:=0;
   PG[JJ].KEGY:=0;
   PGD[1]:=PG[1];
   JJ:=2;
   PG[JJ].DEPTH:=0;
   PG[JJ].PARTDESC:='BLOOEY';
   BLP0(BLNSPEC.QAT,BLNSPEC.TAT,BLNSPEC.GSG,BLNSPEC.GMOLWT,BLNSPEC.ELEV,
   BLNSPEC.LB,BLNSPEC.DB,BLNSPEC.KT,BLNSPEC.KV,BLNSPEC.VALVNO,BLNSPEC.EB,PG[JJ].PRESS,PG[JJ].GFRATE,PG[JJ].VELO,PG[JJ].KEGY);
   PG[1].GFRATE:=PG[2].PRESS/PG[1].PRESS*PG[2].GFRATE;
   PGD[1]:=PG[1];
   PGD[2]:=PG[2];
   ANUPARTFINDER(COMBOBOX4.Text,COMBOBOX6.Text,COMBOBOX9.Text,combobox2.Text);
   JJJ:=JJ;
   for II := 1 to ANNULUS[1].NOIT do
    BEGIN
     JJ:=JJ+1;
     PG[JJ].DEPTH:=ANNULUS[II].DEPT2;
     PG[JJ].PARTDESC:='ANLS('+INTTOSTR(II)+')';
     ANP0(ANNULUS[II].QAT,PG[JJ-1].PRESS,ANNULUS[II].TAT,ANNULUS[II].GSG
     ,ANNULUS[II].SSG,ANNULUS[II].GMOLWT,ANNULUS[II].ELEV,ANNULUS[II].DH
     ,ANNULUS[II].ODP,ANNULUS[II].EH,ANNULUS[II].EP,ANNULUS[II].ROP,ANNULUS[II].TGRD
     ,ANNULUS[II].DEPT1,ANNULUS[II].DEPT2,PG[JJ].PRESS,PG[JJ].GFRATE,PG[JJ].VELO,PG[JJ].KEGY);
    END;
   for II := 1 to ANNULUS[1].NOIT do
    BEGIN
     if (descpart='ANLS')AND(depthING>=annulus[ii].DEPT1) and (depthing<=annulus[ii].DEPT2) then
      BEGIN
       ANP0(ANNULUS[II].QAT,PG[jjj+ii-1].PRESS,ANNULUS[II].TAT,ANNULUS[II].GSG
       ,ANNULUS[II].SSG,ANNULUS[II].GMOLWT,ANNULUS[II].ELEV,ANNULUS[II].DH
       ,ANNULUS[II].ODP,ANNULUS[II].EH,ANNULUS[II].EP,ANNULUS[II].ROP,ANNULUS[II].TGRD
       ,ANNULUS[II].DEPT1,depthing,APG.PRESS,APG.GFRATE,APG.VELO,APG.KEGY);
       break;
      END;
    END;
   LL:=0;
   lidx:=3;
   memor[1]:=1+jjj;
   while LL*DL<=BOTTOM do
    BEGIN
     PGD[lidx].DEPTH:=LL*DL;
     for II := 1 to ANNULUS[1].NOIT do
      BEGIN
       if (LL*DL>=annulus[ii].DEPT1) and ((LL)*DL<=annulus[ii].DEPT2) then
        BEGIN
         memor[2]:=ii+jjj;
         ANP0(ANNULUS[II].QAT,PG[jjj+ii-1].PRESS,ANNULUS[II].TAT,ANNULUS[II].GSG
         ,ANNULUS[II].SSG,ANNULUS[II].GMOLWT,ANNULUS[II].ELEV,ANNULUS[II].DH
         ,ANNULUS[II].ODP,ANNULUS[II].EH,ANNULUS[II].EP,ANNULUS[II].ROP,ANNULUS[II].TGRD
         ,ANNULUS[II].DEPT1,LL*DL,PGD[Lidx].PRESS,PGD[Lidx].GFRATE,PGD[Lidx].VELO,PGD[Lidx].KEGY);
         PGD[Lidx].PARTDESC:=PG[jjj+ii].PARTDESC;
         if memor[1]<>memor[2] then
          begin
           PGD[LIDX]:=PG[MEMOR[1]];
           memor[1]:=memor[2];
           LL:=LL-1;
          end;
         break;
        END;
      END;
     LL:=LL+1;
     lidx:=lidx+1;
    END;
   for II := 1 to ANNULUS[1].NOIT do
    BEGIN
     if (bottom>=annulus[ii].DEPT1) and (bottom<=annulus[ii].DEPT2) then
      BEGIN
       ANP0(ANNULUS[II].QAT,PG[jjj+ii-1].PRESS,ANNULUS[II].TAT,ANNULUS[II].GSG
       ,ANNULUS[II].SSG,ANNULUS[II].GMOLWT,ANNULUS[II].ELEV,ANNULUS[II].DH
       ,ANNULUS[II].ODP,ANNULUS[II].EH,ANNULUS[II].EP,ANNULUS[II].ROP,ANNULUS[II].TGRD
       ,ANNULUS[II].DEPT1,bottom,PGD[Lidx].PRESS,PGD[Lidx].GFRATE,PGD[Lidx].VELO,PGD[Lidx].KEGY);
       pgd[lidx].DEPTH:=bottom;
       PGD[LIDX].PARTDESC:=PG[jjj+ii].PARTDESC;
       break;
      END;
    END;
   JJ:=JJ+1;
   BITPARTFINDER(COMBOBOX4.Text,COMBOBOX2.Text);
   PG[JJ].DEPTH:=PG[JJ-1].DEPTH;
   JTP0(BITSPEC.QAT,BITSPEC.TAT,BITSPEC.GSG,BITSPEC.GMOLWT,ANNULUS[II].ELEV,BITSPEC.K,
   PG[JJ-1].PRESS,BITSPEC.TGRD,PG[JJ-1].DEPTH,BITSPEC.JETS,PG[JJ].PRESS,PG[JJ].GFRATE,PG[JJ].VELO,PG[JJ].KEGY);
   PG[JJ].PARTDESC:='BIT NZL';
   LIDX:=LIDX+1;
   PGD[LIDX]:=PG[JJ];
   LIDX:=LIDX+1;
   STRPARTFINDER(COMBOBOX4.Text,COMBOBOX6.Text,COMBOBOX9.Text,combobox2.Text);
   JJJ:=JJ;
   for II := 1 to STRINGS[1].NOIT do
    BEGIN
     JJ:=JJ+1;
     PG[JJ].DEPTH:=STRINGS[II].DEPT1;
     DPP0(STRINGS[II].QAT,PG[JJ-1].PRESS,STRINGS[II].TAT,STRINGS[II].GSG
     ,STRINGS[II].GMOLWT,STRINGS[II].ELEV,STRINGS[II].DP,STRINGS[II].EP
     ,STRINGS[II].TGRD,STRINGS[II].DEPT1,STRINGS[II].DEPT2,PG[JJ].PRESS,PG[JJ].GFRATE,PG[JJ].VELO,PG[JJ].KEGY);
     PG[JJ].PARTDESC:='STRG('+INTTOSTR(II)+')';
    END;
   for II := 1 to STRINGS[1].NOIT do
    BEGIN
     if (descpart='STRG')AND(depthING>=STRINGS[ii].DEPT1) and (depthing<=STRINGS[ii].DEPT2) then
      BEGIN
       DPP0(STRINGS[II].QAT,PG[JJJ+II-1].PRESS,STRINGS[II].TAT,STRINGS[II].GSG
       ,STRINGS[II].GMOLWT,STRINGS[II].ELEV,STRINGS[II].DP,STRINGS[II].EP
       ,STRINGS[II].TGRD,DEPTHING,STRINGS[II].DEPT2,APG.PRESS,APG.GFRATE,APG.VELO,APG.KEGY);
       break;
      END;
    END;
   memor[1]:=1+jjj;
   LL:=0;
   while LL*DL<=BOTTOM do
    BEGIN
     PGD[lidx].DEPTH:=(BOTTOM-LL*DL);
     for II := 1 to STRINGS[1].NOIT do
      BEGIN
       if ((BOTTOM-LL*DL)>=STRINGS[ii].DEPT1) and ((BOTTOM-LL*DL)<=STRINGS[ii].DEPT2) then
        BEGIN
         memor[2]:=ii+jjj;
         DPP0(STRINGS[II].QAT,PG[JJJ+II-1].PRESS,STRINGS[II].TAT,STRINGS[II].GSG
         ,STRINGS[II].GMOLWT,STRINGS[II].ELEV,STRINGS[II].DP,STRINGS[II].EP
         ,STRINGS[II].TGRD,(BOTTOM-LL*DL),STRINGS[II].DEPT2,PGD[Lidx].PRESS,PGD[Lidx].GFRATE,PGD[Lidx].VELO,PGD[Lidx].KEGY);
         PGD[Lidx].PARTDESC:=PG[jjj+ii].PARTDESC;
        { if memor[1]<>memor[2] then
          begin
           PGD[LIDX]:=PG[MEMOR[1]];
           memor[1]:=memor[2];
           LL:=LL-1;
          end;     }
         break;
        END;
      END;
     LL:=LL+1;
     lidx:=lidx+1;
    END;
   for II := 1 to STRINGS[1].NOIT do
    BEGIN
     if (0>=STRINGS[ii].DEPT1) and (0<=STRINGS[ii].DEPT2) then
      BEGIN
       DPP0(STRINGS[II].QAT,PG[JJJ+II-1].PRESS,STRINGS[II].TAT,STRINGS[II].GSG
       ,STRINGS[II].GMOLWT,STRINGS[II].ELEV,STRINGS[II].DP,STRINGS[II].EP
       ,STRINGS[II].TGRD,0,STRINGS[II].DEPT2,PGD[Lidx].PRESS,PGD[Lidx].GFRATE,PGD[Lidx].VELO,PGD[Lidx].KEGY);
       PGD[Lidx].PARTDESC:=PG[jjj+ii].PARTDESC;
       pgd[lidx].DEPTH:=0;
       PGD[LIDX].PARTDESC:=PGD[LIDX-1].PARTDESC;
       break;
      END;
    END;
   //FORM44.memo1.Lines.Add('line1' + #13#10 + 'line2' + #13#10 + 'with xx do' + #13#10 + 'begin' + #13#10 + '  ' + #13#10 + 'end;' + #13#10);
   FORM44.memo1.Lines.Add(
     'K = '+ FLOATTOSTR(0.01*ROUND(100*BITSPEC.K)) + #13#10
   + 'Q1 = '+FLOATTOSTR(0.01*ROUND(100*PG[1].GFRATE))+' ('+CNV[7].name+')'+ #13#10
   + 'P1 = '+FLOATTOSTR(0.01*ROUND(100*PG[1].PRESS))+' ('+CNV[3].name+')'+ #13#10
   + 'P2 = '+FLOATTOSTR(0.01*ROUND(100*PGD[LIDX].PRESS))+' ('+CNV[3].name+')'+ #13#10);
   SHAFTWORK:=(BITSPEC.K/(BITSPEC.K-1)/229.17)*PG[1].PRESS*PG[1].GFRATE/7.48*(POWER(PGD[LIDX].PRESS/PG[1].PRESS,(BITSPEC.K-1)/BITSPEC.K)-1);
   SHAFTWORK:=0.01*ROUND(100*SHAFTWORK);
   FORM44.memo1.Lines.Add('SHAFT POWER IS = '+FLOATTOSTR(SHAFTWORK)+' (HP)');


  END;
 if CALCTYPE=3 then
  BEGIN
   BLNPARTFINDER(COMBOBOX4.Text,COMBOBOX2.Text);
   JJ:=1;
   PG[JJ].PARTDESC:='SURFACE';
   PG[JJ].DEPTH:=0;
   PG[JJ].PRESS:=SURPRESS(BLNSPEC.ELEV);
   PG[JJ].VELO:=0;
   PG[JJ].KEGY:=0;
   PGD[1]:=PG[1];
   JJ:=2;
   PG[JJ].DEPTH:=0;
   PG[JJ].PARTDESC:='BLOOEY';
   BLP3(BLNSPEC.QAT,BLNSPEC.TAT,BLNSPEC.GSG,BLNSPEC.GMOLWT,BLNSPEC.ELEV,
   BLNSPEC.LB,BLNSPEC.DB,BLNSPEC.KT,BLNSPEC.KV,BLNSPEC.VALVNO,BLNSPEC.EB,
   BLNSPEC.MFRATE,BLNSPEC.MW,BLNSPEC.MVIS,BLNSPEC.SSG,BLNSPEC.ROP,BLNSPEC.DH,PG[JJ].PRESS,PG[JJ].GFRATE,PG[JJ].VELO,PG[JJ].KEGY);
   PG[1].GFRATE:=PG[2].PRESS/PG[1].PRESS*PG[2].GFRATE;
   PGD[1]:=PG[1];
   PGD[2]:=PG[2];
   ANUPARTFINDER(COMBOBOX4.Text,COMBOBOX6.Text,COMBOBOX9.Text,combobox2.Text);
   JJJ:=JJ;
   for II := 1 to ANNULUS[1].NOIT do
    BEGIN
     JJ:=JJ+1;
     PG[JJ].DEPTH:=ANNULUS[II].DEPT2;
     PG[JJ].PARTDESC:='ANLS('+INTTOSTR(II)+')';
     ANP3(ANNULUS[II].QAT,PG[JJ-1].PRESS,ANNULUS[II].TAT,ANNULUS[II].GSG
     ,ANNULUS[II].SSG,ANNULUS[II].GMOLWT,ANNULUS[II].ELEV,ANNULUS[II].DH
     ,ANNULUS[II].ODP,ANNULUS[II].EH,ANNULUS[II].EP,ANNULUS[II].MFRATE,ANNULUS[II].MW
     ,ANNULUS[II].MVIS,ANNULUS[II].ROP,ANNULUS[II].TGRD,ANNULUS[II].DEPT1,
     ANNULUS[II].DEPT2,PG[JJ].PRESS,PG[JJ].GFRATE,PG[JJ].VELO,PG[JJ].KEGY);
    END;
   for II := 1 to ANNULUS[1].NOIT do
    BEGIN
     if (descpart='ANLS')AND(depthING>=annulus[ii].DEPT1) and (depthing<=annulus[ii].DEPT2) then
      BEGIN
       ANP3(ANNULUS[II].QAT,PG[jjj+ii-1].PRESS,ANNULUS[II].TAT,ANNULUS[II].GSG
       ,ANNULUS[II].SSG,ANNULUS[II].GMOLWT,ANNULUS[II].ELEV,ANNULUS[II].DH
       ,ANNULUS[II].ODP,ANNULUS[II].EH,ANNULUS[II].EP,ANNULUS[II].MFRATE,ANNULUS[II].MW
       ,ANNULUS[II].MVIS,ANNULUS[II].ROP,ANNULUS[II].TGRD,ANNULUS[II].DEPT1
       ,depthing,APG.PRESS,APG.GFRATE,APG.VELO,APG.KEGY);
       break;
      END;
    END;
   LL:=0;
   lidx:=3;
   memor[1]:=1+jjj;
   while LL*DL<=BOTTOM do
    BEGIN
     PGD[lidx].DEPTH:=LL*DL;
     for II := 1 to ANNULUS[1].NOIT do
      BEGIN
       if (LL*DL>=annulus[ii].DEPT1) and ((LL)*DL<=annulus[ii].DEPT2) then
        BEGIN
         memor[2]:=ii+jjj;
         ANP3(ANNULUS[II].QAT,PG[jjj+ii-1].PRESS,ANNULUS[II].TAT,ANNULUS[II].GSG
         ,ANNULUS[II].SSG,ANNULUS[II].GMOLWT,ANNULUS[II].ELEV,ANNULUS[II].DH
         ,ANNULUS[II].ODP,ANNULUS[II].EH,ANNULUS[II].EP,ANNULUS[II].MFRATE,ANNULUS[II].MW
         ,ANNULUS[II].MVIS,ANNULUS[II].ROP,ANNULUS[II].TGRD
         ,ANNULUS[II].DEPT1,LL*DL,PGD[Lidx].PRESS,PGD[Lidx].GFRATE,PGD[Lidx].VELO,PGD[Lidx].KEGY);
         PGD[Lidx].PARTDESC:=PG[jjj+ii].PARTDESC;
         if memor[1]<>memor[2] then
          begin
           PGD[LIDX]:=PG[MEMOR[1]];
           memor[1]:=memor[2];
           LL:=LL-1;
          end;
         break;
        END;
      END;
     LL:=LL+1;
     lidx:=lidx+1;
    END;
   for II := 1 to ANNULUS[1].NOIT do
    BEGIN
     if (bottom>=annulus[ii].DEPT1) and (bottom<=annulus[ii].DEPT2) then
      BEGIN
       ANP3(ANNULUS[II].QAT,PG[jjj+ii-1].PRESS,ANNULUS[II].TAT,ANNULUS[II].GSG
       ,ANNULUS[II].SSG,ANNULUS[II].GMOLWT,ANNULUS[II].ELEV,ANNULUS[II].DH
       ,ANNULUS[II].ODP,ANNULUS[II].EH,ANNULUS[II].EP,ANNULUS[II].MFRATE,ANNULUS[II].MW
         ,ANNULUS[II].MVIS,ANNULUS[II].ROP,ANNULUS[II].TGRD
       ,ANNULUS[II].DEPT1,bottom,PGD[Lidx].PRESS,PGD[Lidx].GFRATE,PGD[Lidx].VELO,PGD[Lidx].KEGY);
       pgd[lidx].DEPTH:=bottom;
       PGD[LIDX].PARTDESC:=PG[jjj+ii].PARTDESC;
       break;
      END;
    END;
   JJ:=JJ+1;
   BITPARTFINDER(COMBOBOX4.Text,COMBOBOX2.Text);
   PG[JJ].DEPTH:=PG[JJ-1].DEPTH;
   JTP3(BITSPEC.QAT,BITSPEC.TAT,BITSPEC.GSG,BITSPEC.GMOLWT,ANNULUS[II].ELEV,BITSPEC.K,
   PG[JJ-1].PRESS,BITSPEC.TGRD,PG[JJ-1].DEPTH,BITSPEC.MFRATE,BITSPEC.MW,BITSPEC.JETS,PG[JJ].PRESS,PG[JJ].GFRATE,PG[JJ].VELO,PG[JJ].KEGY);
   PG[JJ].PARTDESC:='BIT NZL';
   LIDX:=LIDX+1;
   PGD[LIDX]:=PG[JJ];
   LIDX:=LIDX+1;
   STRPARTFINDER(COMBOBOX4.Text,COMBOBOX6.Text,COMBOBOX9.Text,combobox2.Text);
   JJJ:=JJ;
   for II := 1 to STRINGS[1].NOIT do
    BEGIN
     JJ:=JJ+1;
     PG[JJ].DEPTH:=STRINGS[II].DEPT1;
     DPP3(STRINGS[II].QAT,PG[JJ-1].PRESS,STRINGS[II].TAT,STRINGS[II].GSG
     ,STRINGS[II].GMOLWT,STRINGS[II].ELEV,STRINGS[II].DP,STRINGS[II].EP,STRINGS[II].MFRATE,strings[ii].MW,strings[ii].MVIS
     ,STRINGS[II].TGRD,STRINGS[II].DEPT1,STRINGS[II].DEPT2,PG[JJ].PRESS,PG[JJ].GFRATE,PG[JJ].VELO,PG[JJ].KEGY);
     PG[JJ].PARTDESC:='STRG('+INTTOSTR(II)+')';
    END;
   for II := 1 to STRINGS[1].NOIT do
    BEGIN
     if (descpart='STRG')AND(depthING>=STRINGS[ii].DEPT1) and (depthing<=STRINGS[ii].DEPT2) then
      BEGIN
       DPP3(STRINGS[II].QAT,PG[JJJ+II-1].PRESS,STRINGS[II].TAT,STRINGS[II].GSG
       ,STRINGS[II].GMOLWT,STRINGS[II].ELEV,STRINGS[II].DP,STRINGS[II].EP,STRINGS[II].MFRATE,strings[ii].MW,strings[ii].MVIS
       ,STRINGS[II].TGRD,DEPTHING,STRINGS[II].DEPT2,APG.PRESS,APG.GFRATE,APG.VELO,APG.KEGY);
       break;
      END;
    END;
   memor[1]:=1+jjj;
   LL:=0;
   while LL*DL<=BOTTOM do
    BEGIN
     PGD[lidx].DEPTH:=(BOTTOM-LL*DL);
     for II := 1 to STRINGS[1].NOIT do
      BEGIN
       if ((BOTTOM-LL*DL)>=STRINGS[ii].DEPT1) and ((BOTTOM-LL*DL)<=STRINGS[ii].DEPT2) then
        BEGIN
         memor[2]:=ii+jjj;
         DPP3(STRINGS[II].QAT,PG[JJJ+II-1].PRESS,STRINGS[II].TAT,STRINGS[II].GSG
         ,STRINGS[II].GMOLWT,STRINGS[II].ELEV,STRINGS[II].DP,STRINGS[II].EP,STRINGS[II].MFRATE,strings[ii].MW,strings[ii].MVIS
         ,STRINGS[II].TGRD,(BOTTOM-LL*DL),STRINGS[II].DEPT2,PGD[Lidx].PRESS,PGD[Lidx].GFRATE,PGD[Lidx].VELO,PGD[Lidx].KEGY);
         PGD[Lidx].PARTDESC:=PG[jjj+ii].PARTDESC;
        { if memor[1]<>memor[2] then
          begin
           PGD[LIDX]:=PG[MEMOR[1]];
           memor[1]:=memor[2];
           LL:=LL-1;
          end;     }
         break;
        END;
      END;
     LL:=LL+1;
     lidx:=lidx+1;
    END;
   for II := 1 to STRINGS[1].NOIT do
    BEGIN
     if (0>=STRINGS[ii].DEPT1) and (0<=STRINGS[ii].DEPT2) then
      BEGIN
       DPP3(STRINGS[II].QAT,PG[JJJ+II-1].PRESS,STRINGS[II].TAT,STRINGS[II].GSG
       ,STRINGS[II].GMOLWT,STRINGS[II].ELEV,STRINGS[II].DP,STRINGS[II].EP,STRINGS[II].MFRATE,strings[ii].MW,strings[ii].MVIS
       ,STRINGS[II].TGRD,0,STRINGS[II].DEPT2,PGD[Lidx].PRESS,PGD[Lidx].GFRATE,PGD[Lidx].VELO,PGD[Lidx].KEGY);
       PGD[Lidx].PARTDESC:=PG[jjj+ii].PARTDESC;
       pgd[lidx].DEPTH:=0;
       PGD[LIDX].PARTDESC:=PGD[LIDX-1].PARTDESC;
       break;
      END;
    END;
   //FORM44.memo1.Lines.Add('line1' + #13#10 + 'line2' + #13#10 + 'with xx do' + #13#10 + 'begin' + #13#10 + '  ' + #13#10 + 'end;' + #13#10);
{   FORM44.memo1.Lines.Add(
     'K = '+ FLOATTOSTR(0.01*ROUND(100*BITSPEC.K)) + #13#10
   + 'Q1 = '+FLOATTOSTR(0.01*ROUND(100*PG[1].GFRATE))+' ('+CNV[7].name+')'+ #13#10
   + 'P1 = '+FLOATTOSTR(0.01*ROUND(100*PG[1].PRESS))+' ('+CNV[3].name+')'+ #13#10
   + 'P2 = '+FLOATTOSTR(0.01*ROUND(100*PGD[LIDX].PRESS))+' ('+CNV[3].name+')'+ #13#10);
   SHAFTWORK:=(BITSPEC.K/(BITSPEC.K-1)/229.17)*PG[1].PRESS*PG[1].GFRATE/7.48*(POWER(PGD[LIDX].PRESS/PG[1].PRESS,(BITSPEC.K-1)/BITSPEC.K)-1);
   SHAFTWORK:=0.01*ROUND(100*SHAFTWORK);
   FORM44.memo1.Lines.Add('SHAFT POWER IS = '+FLOATTOSTR(SHAFTWORK)+' (HP)'); }


  END;


{*******************************}

 REPORTFILLER(PG,JJ);
 DETAILFILLER(PGD,lidx+1);
 ARBITYFILLER(APG);
 form44.charting1(0);
 FORM44.charting2(0);
END;
PROCEDURE TFORM41.REPORTFILLER(PG:ARRAY OF GRAPHING;JJ:INTEGER);
var
ii,ll:integer;
BEGIN
 for ii := 1 to stringgrid3.RowCount do
   stringgrid3.Rows[ii].Clear;
 for ii := 0 to jj-1 do
  begin
   form44.StringGrid3.Cells[0,ii+1]:=PG[II].PARTDESC;
   form44.StringGrid3.Cells[1,ii+1]:=floattostr(0.001*round(1000*pg[ii].DEPTH/cnv[0].conv));
   form44.StringGrid3.Cells[2,ii+1]:=floattostr(0.001*round(1000*pg[ii].PRESS/cnv[3].conv));
   IF II<>1 THEN
     form44.StringGrid3.Cells[3,ii+1]:=floattostr(0.001*round(1000*(pg[ii].PRESS-pg[ii-1].PRESS)/cnv[3].conv))
   ELSE
     form44.StringGrid3.Cells[3,ii+1]:='0';
   form44.StringGrid3.Cells[4,ii+1]:=floattostr(0.001*round(1000*pg[ii].GFRATE/cnv[7].conv));
   form44.StringGrid3.Cells[5,ii+1]:=floattostr(0.001*round(1000*pg[ii].VELO/cnv[0].conv));
   if pg[ii].VELO<>0 then
     form44.StringGrid3.Cells[6,ii+1]:=floattostr(0.001*round(1000*64.4*pg[ii].KEGY/SQR(pg[ii].VELO)*0.133680555556/cnv[4].conv));
   form44.StringGrid3.Cells[7,ii+1]:=floattostr(0.001*round(1000*pg[ii].KEGY));
  end;
 FORM44.StringGrid3.Cells[6,1]:=FLOATTOSTR(0.001*round(1000*PG[1].PRESS/PG[0].PRESS*STRTOFLOAT(FORM44.StringGrid3.Cells[6,2])));
END;
PROCEDURE TFORM41.DETAILFILLER(PGD:ARRAY OF GRAPHING;JJ:INTEGER);
var
ii,ll:integer;
BEGIN
 FORM44.STRINGGRID5.RowCount:=JJ;
 FORM44.STRINGGRID6.RowCount:=JJ;
 FORM44.STRINGGRID7.RowCount:=JJ;

 for ii := 1 to FORM44.stringgrid5.RowCount do
   FORM44.stringgrid5.Rows[ii].Clear;
 for ii := 1 to FORM44.stringgrid6.RowCount do
   FORM44.stringgrid6.Rows[ii].Clear;
 for ii := 1 to FORM44.stringgrid7.RowCount do
   FORM44.stringgrid7.Rows[ii].Clear;
 for ii := 1 to jj-1 do
  begin
   form44.StringGrid5.Cells[0,ii]:=PGD[II].PARTDESC;
   form44.StringGrid5.Cells[1,ii]:=floattostr(0.001*round(1000*pgD[ii].DEPTH/cnv[0].conv));
   form44.StringGrid5.Cells[2,ii]:=floattostr(0.001*round(1000*pgD[ii].PRESS/cnv[3].conv));
   IF II<>1 THEN
     form44.StringGrid5.Cells[3,ii]:=floattostr(0.001*round(1000*(pgD[ii].PRESS-pgD[ii-1].PRESS)/cnv[3].conv))
   ELSE
     form44.StringGrid5.Cells[3,ii]:='0';
   form44.StringGrid5.Cells[4,ii]:=floattostr(0.001*round(1000*pgD[ii].GFRATE/cnv[7].conv));
   form44.StringGrid5.Cells[5,ii]:=floattostr(0.001*round(1000*pgD[ii].VELO/cnv[0].conv));
   if pgD[ii].VELO<>0 then
     form44.StringGrid5.Cells[6,ii]:=floattostr(0.001*round(1000*64.4*pgD[ii].KEGY/SQR(pgD[ii].VELO)*0.133680555556/cnv[4].conv));
   form44.StringGrid5.Cells[7,ii]:=floattostr(0.001*round(1000*pgD[ii].KEGY));
  end;
 FORM44.StringGrid5.Cells[6,1]:=FLOATTOSTR(0.001*round(1000*PGD[2].PRESS/PGD[1].PRESS*STRTOFLOAT(FORM44.StringGrid3.Cells[6,2])));
 for ii := 1 to FORM44.stringgrid5.RowCount do
  BEGIN
   FORM44.StringGrid6.Cells[0,II]:=FORM44.StringGrid5.Cells[0,ii];
   FORM44.StringGrid6.Cells[1,II]:=FORM44.StringGrid5.Cells[1,ii];
   FORM44.StringGrid6.Cells[2,II]:=FORM44.StringGrid5.Cells[2,ii];
   FORM44.StringGrid6.Cells[3,II]:=FORM44.StringGrid5.Cells[3,ii];
   FORM44.StringGrid7.Cells[0,II]:=FORM44.StringGrid5.Cells[0,ii];
   FORM44.StringGrid7.Cells[1,II]:=FORM44.StringGrid5.Cells[1,ii];
   FORM44.StringGrid7.Cells[2,II]:=FORM44.StringGrid5.Cells[4,ii];
   FORM44.StringGrid7.Cells[3,II]:=FORM44.StringGrid5.Cells[7,ii];
  END;
END;
PROCEDURE TFORM41.ARBITYFILLER(APG:GRAPHING);
 BEGIN
  stringgrid5.Rows[1].Clear;
  form44.StringGrid4.Cells[0,1]:=form44.combobox1.Items.Strings[form44.ComboBox1.ItemIndex];
  form44.StringGrid4.Cells[2,1]:=floattostr(0.001*round(1000*APG.PRESS/cnv[3].conv));
  form44.StringGrid4.Cells[3,1]:='---';
  form44.StringGrid4.Cells[4,1]:=floattostr(0.001*round(1000*APG.GFRATE/cnv[7].conv));
  form44.StringGrid4.Cells[5,1]:=floattostr(0.001*round(1000*APG.VELO/cnv[0].conv));
  if APG.VELO<>0 then
    form44.StringGrid4.Cells[6,1]:=floattostr(0.001*round(1000*64.4*APG.KEGY/SQR(APG.VELO)*0.133680555556/cnv[4].conv));
  form44.StringGrid4.Cells[7,1]:=floattostr(0.001*round(1000*APG.KEGY));
 END;
end.
