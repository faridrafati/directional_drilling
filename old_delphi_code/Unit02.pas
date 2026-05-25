
unit Unit02;

interface

uses
  Windows, Messages, SysUtils, Variants, Classes, Graphics, Controls, Forms,
  Dialogs, Menus, ComCtrls, ExtCtrls, TeEngine, Series, TeeProcs, Chart,
  StdCtrls, Grids,math,ComObj, DB, DBGrids, DBCtrls, ADODB, Buttons;
type
 branch = record
  MD,INC,AZM,TVD,VSEC,NS,EW,DLS,tf,tr,br,dmd:real;
  order,typ:integer;
  CMT:string;
end;
type
 point = record
  ns,ew,tvd:real;
end;


type
    abranch = array of branch;
    TForm02 = class(TForm)
    OpenDialog1: TOpenDialog;
    DataSource1: TDataSource;
    DataSource2: TDataSource;
    MainMenu1: TMainMenu;
    ACTIONS1: TMenuItem;
    NEW1: TMenuItem;
    ADD1: TMenuItem;
    STANDARDPROFILES1: TMenuItem;
    Hold1: TMenuItem;
    SurveyStation1: TMenuItem;
    Curve1: TMenuItem;
    PlanningTargets1: TMenuItem;
    Calculate1: TMenuItem;
    N3DView1: TMenuItem;
    delete1: TMenuItem;
    Save1: TMenuItem;
    Exit1: TMenuItem;
    ADOTable1: TADOTable;
    Panel1: TPanel;
    Button1: TButton;
    Button3: TButton;
    Button5: TButton;
    ListBox1: TListBox;
    Panel2: TPanel;
    ADOTable2: TADOTable;
    Splitter1: TSplitter;
    DBGrid1: TDBGrid;
    DBGrid2: TDBGrid;
    Splitter2: TSplitter;
    procedure cellshow(wlpt:branch);
    procedure vcttosur(ns,ew,tvd:real;var inc,azm:real);
    procedure surtovct(inc,azm:real;var ns,ew,tvd:real);
    procedure rotation(u,v,w,a,b,c,theta:real;var x,y,z:real);
    procedure plane(a1,a2,a3:point; var a4:point;var theta:real);
    procedure revplane(a1,a2,a3:point;theta:real; var a4:point);
    PROCEDURE HC3DTFT(THETA1,TGTX,TGTY,THETA:REAL;var wlpt1,wlpt2:abranch;VAR OKK:BOOLEAN);
    PROCEDURE CH3DFFK(THETA1,TGTX,TGTY,THETA:REAL;var wlpt1,wlpt2:abranch;VAR OKK:BOOLEAN);
    PROCEDURE HCH(THETA1,TGTX,TGTY,THETA,DLS:REAL;VAR wlpt1,wlpt2:abranch;VAR OKK:BOOLEAN);
    PROCEDURE CH(THETA1,TGTX,TGTY,DLS:REAL;var wlpt1,wlpt2:abranch;var okk:boolean);
    PROCEDURE CH2DC1(THETA1,TGTX,TGTY,THETA,DLS1,DLS2:REAL;var wlpt1,wlpt2:abranch;var okk:boolean);
    PROCEDURE CH2DC2(THETA1,TGTX,TGTY,THETA,DLS1,DLS2,thetaex,dmd:REAL;var wlpt1,wlpt2:abranch;var okk,ddmmdd:boolean);
    PROCEDURE CH3DC(INC,TVD,AZM,NS,EW,DLS,DLSPP:REAL);
    PROCEDURE HOCTT(THETA1,TGTX,TGTY:REAL;var wlpt1,wlpt2:abranch);
    PROCEDURE c3(THETA1,theta2,dls:REAL;var wlpt1,wlpt2:abranch);
    PROCEDURE CC2D(theta1,theta2,theta3,DLS1,DLS2:REAL;var wlpt1,wlpt2:abranch;var okk:boolean);
    procedure Hold(theta1,azm,MD:real;var wlpt1:abranch);
    procedure sursta(theta1,theta,md:real;var wlpt1,wlpt2:abranch);
    procedure pagerefresh;
    procedure tableshow1(wlpta1:abranch;wlptpp,wlptp,wlpt2:branch;a1,a2,a3,a4,v0:point;order,typ:integer;theta,md:real;ll,nn:integer;var wlpt1:abranch);
    procedure azmfind(a1,a2,a3:point;inc:real;qq:integer;var azm:real);
    procedure incfind(a2,a3:point;azm:real;var inc:real);
    function RefToCell(ARow, ACol: Integer): string;
    function dec(dc:integer;input:real):real;
    procedure Button2Click(Sender: TObject);
    procedure Button5Click(Sender: TObject);
    procedure NEW1Click(Sender: TObject);
    procedure DBGrid2CtypeellClick(Column: TColumn);
    procedure STANDARDPROFILES1Click(Sender: TObject);
    procedure Button3Click(Sender: TObject);
    procedure cellfill(wlpt:abranch;i,j:integer);
    procedure Button7Click(Sender: TObject);
    procedure Hold1Click(Sender: TObject);
    procedure SurveyStation1Click(Sender: TObject);
    procedure PlanningTargets1Click(Sender: TObject);
    procedure Curve1Click(Sender: TObject);
    procedure Button1Click(Sender: TObject);
    procedure Calculate1Click(Sender: TObject);
    procedure N3DView1Click(Sender: TObject);
    procedure delete1Click(Sender: TObject);
    procedure Save1Click(Sender: TObject);
    procedure Exit1Click(Sender: TObject);
    procedure SURVEYCOPY;
    procedure SAVEWD;
    procedure rowcolor(ii,jj:integer);//ii:row no jj:typ kk:no of row
    procedure FormShow(Sender: TObject);
    procedure AutoStretchDBGridColumns(Grid: TDBGrid; Columns, MinWidths: Array of integer);
    procedure ListBox1DblClick(Sender: TObject);
    procedure ADD1Click(Sender: TObject);
    procedure DBGrid2DrawColumnCell(Sender: TObject; const Rect: TRect;
      DataCol: Integer; Column: TColumn; State: TGridDrawState);


  private
    { Private declarations }
  public
    { Public declarations }
  end;
var
  Form02: TForm02;
  romat:array[0..50,0..16] of boolean;
  rocal:array[0..50,0..16] of boolean;
  rosel:array[0..1]of integer;
  CLRSHW:BOOLEAN;
  aazzmm:array[1..2,1..2]of real;
  azmazm:array[1..2,1..2] of boolean;
implementation

uses Unit03, Unit01, Unit04, Unit05, Unit06, Unit07, Unit08, Unit10;

{$R *.dfm}
function RectHeight(R : TRect) : integer;
begin
Result := R.Bottom - R.Top;
end;

function RectWidth(R : TRect) : integer;
begin
Result := R.Right - R.Left;
end;
procedure rowcol(ii,jj:integer);
var
 ll,mm:integer;
begin
 for ll := 0 to 16 do
   for mm := 0 to 50 do
     rocal[mm,ll]:=false;
 for ll := 0 to 16 do
   for mm := ii to ii+jj-1 do
     rocal[mm,ll]:=true;
end;
procedure tForm02.rowcolor(ii,jj:integer);
var
 ll:integer;
begin
 if jj=0 then
  begin
   romat[0,1]:=true;
   romat[0,2]:=true;
   romat[0,3]:=true;
   romat[0,4]:=true;
   romat[0,6]:=true;
   romat[0,7]:=true;
  end
 ELSE if jj=1 then
  begin
   romat[ii+1,2]:=true;
   romat[ii+1,4]:=true;
   romat[ii+1,6]:=true;
   romat[ii+1,7]:=true;
  end
 ELSE if jj=11 then
  begin
   romat[ii+1,3]:=true;
   romat[ii+1,4]:=true;
   romat[ii+1,6]:=true;
   romat[ii+1,7]:=true;
  end
 ELSE if jj=2 then
  begin
   romat[ii+1,2]:=true;
   romat[ii+1,4]:=true;
   romat[ii+1,6]:=true;
   romat[ii+1,7]:=true;
  end
 ELSE if jj=12 then
  begin
   romat[ii+1,3]:=true;
   romat[ii+1,4]:=true;
   romat[ii+1,6]:=true;
   romat[ii+1,7]:=true;
  end
 ELSE if jj=3 then
  begin
   romat[ii+1,8]:=true;
   romat[ii+2,4]:=true;
   romat[ii+2,6]:=true;
   romat[ii+2,7]:=true;
   romat[ii+2,2]:=true;
  end
 ELSE if jj=13 then
  begin
   romat[ii+1,8]:=true;
   romat[ii+2,4]:=true;
   romat[ii+2,6]:=true;
   romat[ii+2,7]:=true;
   romat[ii+2,3]:=true;
  end
 ELSE if jj=4 then
  begin
   romat[ii,8]:=true;
   romat[ii+1,7]:=true;
   romat[ii+1,6]:=true;
   romat[ii+1,4]:=true;
  end
 ELSE if jj=5 then
  begin
   romat[ii,8]:=true;
   romat[ii+2,4]:=true;
   romat[ii+2,6]:=true;
   romat[ii+2,7]:=true;
   romat[ii+2,8]:=true;
   romat[ii+2,2]:=true;
  end
 ELSE if jj=15 then
  begin
   romat[ii,8]:=true;
   romat[ii+2,4]:=true;
   romat[ii+2,6]:=true;
   romat[ii+2,7]:=true;
   romat[ii+2,8]:=true;
   romat[ii+2,3]:=true;
  end
 ELSE if jj=6 then
  begin

  end
 ELSE if jj=16 then
  begin

  end
 ELSE if jj=7 then
  begin
   romat[ii,8]:=true;
   romat[ii+2,4]:=true;
   romat[ii+2,6]:=true;
   romat[ii+2,7]:=true;
   romat[ii+2,8]:=true;
   romat[ii+2,2]:=true;
  end
 ELSE if jj=17 then
  begin
   romat[ii,8]:=true;
   romat[ii+2,4]:=true;
   romat[ii+2,6]:=true;
   romat[ii+2,7]:=true;
   romat[ii+2,8]:=true;
   romat[ii+2,3]:=true;
  end
 ELSE if jj=8 then
  begin
   romat[ii,4]:=true;
   romat[ii,6]:=true;
   romat[ii,7]:=true;
  end
 ELSE if jj=9 then
  begin
   romat[ii+1,2]:=true;
   romat[ii+1,3]:=true;
   romat[ii,8]:=true;
   romat[ii+1,8]:=true;
   romat[ii,2]:=true;
  end
 ELSE if jj=19 then
  begin
   romat[ii+1,2]:=true;
   romat[ii+1,3]:=true;
   romat[ii,8]:=true;
   romat[ii+1,8]:=true;
   romat[ii,3]:=true;
  end
 else if jj=21 then
  begin
   romat[ii,1]:=true;
  end
 else if jj=22 then
  begin
   romat[ii,4]:=true;
  end
 else if jj=23 then
  begin
   romat[ii,12]:=true;
  end
 else IF jj=31 THEN
  BEGIN
   romat[ii,1]:=true;
   romat[ii,2]:=true;
   romat[ii,8]:=true;
  END
 else if jj=32 then
  begin
   romat[ii,1]:=true;
   romat[ii,3]:=true;
   romat[ii,8]:=true;
  end
 else if jj=33 then
  begin
   romat[ii,2]:=true;
   romat[ii,3]:=true;
   romat[ii,8]:=true;
  end
 else if jj=34 then
  begin
   romat[ii,2]:=true;
   romat[ii,4]:=true;
   romat[ii,8]:=true;
  end
 else if jj=35 then
  begin
   romat[ii,2]:=true;
   romat[ii,3]:=true;
   romat[ii,4]:=true;
  end
 else if jj=36 then
  begin
   romat[ii,1]:=true;
   romat[ii,2]:=true;
   romat[ii,3]:=true;
  end
 else if jj=51 then
  begin
   romat[ii-1,9]:=true;
   romat[ii,1]:=true;
   romat[ii,8]:=true;
  end
 else if jj=52 then
  begin
   romat[ii-1,9]:=true;
   romat[ii,4]:=true;
   romat[ii,8]:=true;
  end
 else if jj=53 then
  begin
   romat[ii-1,9]:=true;
   romat[ii,12]:=true;
   romat[ii,8]:=true;
  end
 else if jj=54 then
  begin
   romat[ii-1,9]:=true;
   romat[ii,2]:=true;
   romat[ii,8]:=true;
  end
 else if jj=55 then
  begin
   romat[ii-1,9]:=true;
   romat[ii,3]:=true;
   romat[ii,8]:=true;
  end
 else if jj=61 then
  begin
   romat[ii,10]:=true;
  end
 else if jj=62 then
  begin
   romat[ii,11]:=true;
  end
 else if jj=63 then
  begin
   romat[ii,10]:=true;
   romat[ii,11]:=true;
  end
 else if jj=71 then
  begin
   romat[ii,10]:=true;
  end
 else if jj=72 then
  begin
   romat[ii,11]:=true;
  end
 else if jj=73 then
  begin
   romat[ii,10]:=true;
   romat[ii,11]:=true;
  end
 else if jj=81 then
  begin
   romat[ii,10]:=true;
  end
 else if jj=82 then
  begin
   romat[ii,11]:=true;
  end
 else if jj=83 then
  begin
   romat[ii,10]:=true;
   romat[ii,11]:=true;
  end
 else if jj=91 then
  begin
   romat[ii,10]:=true;
  end
 else if jj=92 then
  begin
   romat[ii,11]:=true;
  end
 else if jj=93 then
  begin
   romat[ii,10]:=true;
   romat[ii,11]:=true;
  end
 else if jj=101 then
  begin
   romat[ii,10]:=true;
  end
 else if jj=102 then
  begin
   romat[ii,11]:=true;
  end
 else if jj=103 then
  begin
   romat[ii,10]:=true;
   romat[ii,11]:=true;
  end

end;
procedure TForm02.ADD1Click(Sender: TObject);
var
 ii:integer;
begin
 for ii := 0 to DBGrid2.Columns.Count-1 do
  DBGrid2.Columns[ii].ReadOnly:=false;
end;

procedure tForm02.AutoStretchDBGridColumns(Grid: TDBGrid; Columns, MinWidths: Array of integer);
var
  x, i, ww: integer;
begin
  // Stretches TDBGrid columns
  // Columns contains columns to stretch
  // MinWidths contains columns minimum widhts
  // To stretch grids columns 1,2 and 5 automatically and set minimum widths to 80, 150 and 150 call
  // AutoStretchDBGridColumns(DBGrid1, [1,2,5], [80, 150, 150]);
  Assert(Length(Columns) = Length(MinWidths), 'Length(Columns) <> Length(MinWidths)');
  ww := 0;
  for i := 0 to Grid.Columns.Count - 1 do
  begin
    if Grid.Columns[i].Visible then
      ww := ww + Grid.Columns[i].Width + 1; //** +1 for grid line width
  end;
  if dgIndicator in Grid.Options then
    ww := ww + IndicatorWidth;
  x := (Grid.ClientWidth - ww) div Length(Columns);
  for i := 0 to  High(Columns) do
    Grid.Columns[Columns[i]].Width := Max(Grid.Columns[Columns[i]].Width + x, MinWidths[i]);
end;
PROCEDURE TForm02.SAVEWD;
VAR
 CC,FF,WW,PE,tn,CALC:STRING;
 II:BOOLEAN;
 saveit:string;
begin
 saveit:=copy(ListBox1.Items[0],length(ListBox1.Items[0])-7,8);
 if (saveit<>' (Saved)') THEN
  BEGIN
   form01.FNDTABLE(tn);
   FORM01.ADOTABLE1.Active:=FALSE;
   form01.ADOTable1.TABLEName:=tn;
   form01.ADOTABLE1.Active:=TRUE;
   form01.ADOCommand1.CommandText :='delete * from '+tn;
   form01.ADOCommand1.Execute;
   form01.ADOCommand1.CommandText:='insert into '+tn+' select * from TW001';
   form01.ADOCommand1.Execute;
   form01.ADOCommand1.CommandText:='UPDATE '+tn+' SET '+'CALC = '''+ListBox1.Items[ListBox1.ItemIndex]+''', WELL = '''+form01.Treeview1.Selected.PARENT.Text+''', FIELD = '''
   +form01.Treeview1.Selected.PARENT.PARENT.Text+''' , COUNTRY = '''+form01.Treeview1.Selected.PARENT.PARENT.PARENT.Text+'''';
   form01.ADOCommand1.Execute;
   ListBox1.Items[0]:=ListBox1.Items[0]+' (Saved)';
  END;
end;
procedure TForm02.SURVEYCOPY;
var
   ii: Integer;
   tables:TStringList;
   stext:string;
begin
 tables := TStringList.Create;
 try
   form01.ADOConnection1.GetTableNames(TABLES);
   stext:='SE';
   ListBox1.Items.Clear;
   ListBox1.Items.APPEND(form01.Treeview1.Selected.Text);
   for ii := 0 to TABLES.Count-1 do
    BEGIN
     form01.ADOTable1.Active:=false;
     form01.ADOTable1.TableName:=tables[ii];
     form01.ADOTable1.Active:=true;
     form01.ADOTable1.First;
     if (copy(tables[ii],1,2)=stext)
     and(form01.ADOTABLE1.FieldByName('Country').AsString=form01.Treeview1.Selected.Parent.PARENT.Parent.Text)
     and(form01.ADOTABLE1.FieldByName('Field').AsString=form01.Treeview1.Selected.PARENT.PARENT.Text)
     and(form01.ADOTABLE1.FieldByName('WELL').AsString=form01.Treeview1.Selected.Parent.Text)THEN
      begin
       ListBox1.Items.APPEND(form01.ADOTABLE1.FieldByName('CALC').AsString);
      end;
    END;
 finally
   tables.free;
  end;
end;
procedure tForm02.tableshow1(wlpta1:abranch;wlptpp,wlptp,wlpt2:branch;a1,a2,a3,a4,v0:point;order,typ:integer;theta,md:real;ll,nn:integer;var wlpt1:abranch);
var
 jj:integer;
 a5,a6:point;
 I: Integer;
begin
 setlength(wlpt1,500);
 for I := 0 to 500 - 1 do
  WLPT1[I].TYP:=-1;
 JJ:=1;
 MD:=MD-0.0000001;
 WHILE (wlpta1[jj-1].MD<MD)DO
  BEGIN
   a5.ns:=wlpta1[JJ-1].ns+a4.ns; a5.ew:=wlpta1[JJ-1].ew+a4.ew; a5.tvd:=wlpta1[JJ-1].tvd+a4.tvd;
   a6.ns:=wlpta1[JJ].ns+a4.ns;   a6.ew:=wlpta1[JJ].ew+a4.ew;   a6.tvd:=wlpta1[JJ].tvd+a4.tvd;
   revplane(A1,A2,A3,theta,A5);
   revplane(A1,A2,A3,theta,A6);
   vcttosur(a6.ns-A5.ns,a6.ew-A5.ew,a6.tvd-A5.tvd,wlpt1[trunc((jj-1)/2)].inc,wlpt1[trunc((jj-1)/2)].azm);
   wlpt1[trunc((jj-1)/2)].ns:=a5.ns;   wlpt1[trunc((jj-1)/2)].ew:=a5.ew;  wlpt1[trunc((jj-1)/2)].tvd:=a5.tvd;
   wlpt1[trunc((jj-1)/2)].MD:=wlpta1[JJ-1].MD+wlptp.MD;
   wlpt1[trunc((jj-1)/2)].dls:=abs(wlpta1[jj-1].dls);
   Wlpt1[trunc((jj-1)/2)].cmt:=wlpta1[jj-1].cmt;
   WLPT1[trunc((jj-1)/2)].order:=order;
   WLPT1[trunc((jj-1)/2)].typ:=typ;
   if jj>1 then
    begin
     WLPT1[trunc((jj-1)/2)].dmd:=WLPT1[trunc((jj-1)/2)].md-WLPT1[trunc((jj-3)/2)].md;
     wlpt1[trunc((jj-1)/2)].tr:=(wlpt1[trunc((jj-1)/2)].AZM-wlpt1[trunc((jj-3)/2)].AZM)/WLPT1[trunc((jj-1)/2)].dmd;
     wlpt1[trunc((jj-1)/2)].br:=(wlpt1[trunc((jj-1)/2)].inc-wlpt1[trunc((jj-3)/2)].inc)/WLPT1[trunc((jj-1)/2)].dmd;
    end;
   JJ:=JJ+2;
   if wlpta1[jj-1].MD=0 then
    begin
     jj:=jj-1;
     wlpta1[jj-1].MD:=MD+0.0000001;
    end;
  END;
 IF (order=ll)THEN
  BEGIN
   wlpt1[trunc((jj-1)/2)].inc:=wlpt2.inc;
   wlpt1[trunc((jj-1)/2)].azm:=wlpt2.azm;
   wlpt1[trunc((jj-1)/2)].ns:=wlpt2.ns;   wlpt1[trunc((jj-1)/2)].ew:=wlpt2.ew;  wlpt1[trunc((jj-1)/2)].tvd:=wlpt2.tvd;
   wlpt1[trunc((jj-1)/2)].MD:=wlpt2.md;
   wlpt1[trunc((jj-1)/2)].tvd:=wlpt2.tvd;
   wlpt1[trunc((jj-1)/2)].ew:=wlpt2.ew;
   wlpt1[trunc((jj-1)/2)].ns:=wlpt2.ns;
   wlpt1[trunc((jj-1)/2)].dls:=abs(wlpt2.dls);
   Wlpt1[trunc((jj-1)/2)].cmt:=wlpt2.cmt;
   WLPT1[trunc((jj-1)/2)].order:=order;
   WLPT1[trunc((jj-1)/2)].typ:=typ;
   if jj>1 then
    begin
     WLPT1[trunc((jj-1)/2)].dmd:=WLPT1[trunc((jj-1)/2)].md-WLPT1[trunc((jj-3)/2)].md;
     wlpt1[trunc((jj-1)/2)].tr:=(wlpt1[trunc((jj-1)/2)].AZM-wlpt1[trunc((jj-3)/2)].AZM)/WLPT1[trunc((jj-1)/2)].dmd;
     wlpt1[trunc((jj-1)/2)].br:=(wlpt1[trunc((jj-1)/2)].inc-wlpt1[trunc((jj-3)/2)].inc)/WLPT1[trunc((jj-1)/2)].dmd;
    end;
  END;
end;

procedure tForm02.cellshow(wlpt:branch);
 begin
  with form02 do
   begin
    ADOTABLE2.First;
    while ADOTABLE2.FieldByName('ordr').Asinteger<>-1 do
     begin
      ADOTABLE2.Next;
     end;
    with ADOTABLE2 do
     begin
      if wlpt.AZM<0 then
       wlpt.AZM:=wlpt.AZM+2*pi;
      open;
      EDIT;
      FieldByName('COMMENT').AsString:=wlpt.CMT;
      FieldByName('MD').AsFloat:=dec(3,wlpt.md);
      FieldByName('INCL').AsFloat:=dec(3,wlpt.INC*180/pi);
      FieldByName('AZM').AsFloat:=dec(3,wlpt.AZM*180/pi);
      FieldByName('TVD').AsFloat:=dec(3,wlpt.TVD);
      FieldByName('VSEC').AsFloat:=dec(3,wlpt.VSEC);
      FieldByName('NS').AsFloat:=dec(3,wlpt.NS);
      FieldByName('EW').AsFloat:=dec(3,wlpt.EW);
      FieldByName('DLS').AsFloat:=dec(3,wlpt.DLS*18000/pi);
      FieldByName('ordr').AsInteger:=wlpt.order;
      FieldByName('type').AsInteger:=wlpt.typ;
      post;
     end;
   end;
 end;

procedure TForm02.surtovct(inc,azm:real;var ns,ew,tvd:real);
begin
 tvd:=cos(inc);
 ns:=sign(sin(inc))*cos(azm)*sqrt(1-tvd*tvd);
 ew:=sign(sin(inc))*sin(azm)*sqrt(1-tvd*tvd);
end;
procedure TForm02.SurveyStation1Click(Sender: TObject);
var
 ii:integer;
 wlpt,WLPT1:branch;
begin
 form02.ADOTABLE2.First;
 ii:=0;
 while form02.ADOTABLE2.FieldByName('TYPE').AsINTEGER<>-1 do
  BEGIN
   with form02.ADOTABLE2 do
    begin
     ii:=ii+1;
     wlpt.order:=FieldByName('ordr').AsInteger;
    end;
   form02.ADOTABLE2.Next;
  END;
 wlpt1.MD:=0;
 wlpt1.INC:=0;
 wlpt1.AZM:=0;
 wlpt1.TVD:=0;
 wlpt1.vsec:=0;
 wlpt1.NS:=0;
 wlpt1.EW:=0;
 wlpt1.DLS:=0;
 WLPT1.CMT:='Survey Station';
 wlpt1.typ:=36;
 rowcolor(ii,wlpt1.typ);
 wlpt1.order:=wlpt.order+1;
 cellshow(wlpt1);
end;

procedure tForm02.vcttosur(ns,ew,tvd:real;var inc,azm:real);
var
 l:real;
begin
 l:=sqrt(ns*ns+ew*ew+tvd*tvd);
 ns:=ns/l;
 ew:=ew/l;
 tvd:=tvd/l;
 if abs(ns)<0.00000001 then
  ns:=0;
 if (ns>0)and(ew>0) then
  begin
   azm:=arctan(ew/ns);
  end
 else if (ns<0)and(ew>0) then
  begin
   azm:=pi-arctan(abs(ew/ns));
  end
 else if (ns<0)and(ew<0) then
  begin
   azm:=pi+arctan(abs(ew/ns));
  end
 else if (ns>0)and(ew<0) then
  begin
   azm:=2*pi-arctan(abs(ew/ns));
  end
 else
  if (ew=0)and(ns=0) then
   azm:=0
 else
  if ns=0 then
   if ew>0 then
    azm:=pi/2
   else
    azm:=3*pi/2
 else
  if ew=0 then
   if ns>0 then
    azm:=0
   else
    azm:=pi;
 inc:=arccos(tvd/sqrt(ns*ns+ew*ew+tvd*tvd));
 if abs(inc)<0.0001 then
  azm:=0;
 if azm<0 then
  begin
   azm:=2*pi*(trunc(abs(azm)/(2*pi))+1)+azm
  end;
 if azm>=2*pi then
  begin
   azm:=-2*pi*(trunc(abs(azm)/(2*pi)))+azm
  end;

end;
procedure TForm02.azmfind(a1,a2,a3:point;inc:real;qq:integer;var azm:real);
var
 a,ap:point;
 aa,bb,cc:real;
begin
 a.ns:=a2.ew*a3.tvd-a2.tvd*a3.ew;
 a.ew:=-(a2.ns*a3.tvd-a2.tvd*a3.ns);
 a.tvd:=a2.ns*a3.ew-a2.ew*a3.ns;

 if a.ew<>0 then
  begin
   if abs(a.tvd)>0.000001 then
    begin
     aa:=sqr(a.ns/a.ew)+1;
     bb:=2*cos(inc)*a.tvd*a.ns/(a.ew*a.ew);
     cc:=-1+sqr(cos(inc))*(1+sqr(a.tvd/a.ew));

     ap.tvd:=cos(inc);
     ap.ns:=(-bb+sqrt(abs(sqr(bb)-4*aa*cc)))/(2*aa);
     ap.ew:=(-a.tvd*cos(inc)-a.ns*ap.ns)/a.ew;
     vcttosur(ap.ns,ap.ew,ap.tvd,inc,azm);
     form07.RadioButton1.caption:=floattostr(dec(3,azm*180/pi));

     ap.ns:=(-bb-sqrt(abs(sqr(bb)-4*aa*cc)))/(2*aa);
     ap.ew:=(-a.tvd*cos(inc)-a.ns*ap.ns)/a.ew;
     vcttosur(ap.ns,ap.ew,ap.tvd,inc,azm);
     form07.RadioButton2.Caption:=floattostr(dec(3,azm*180/pi));
    end
   else
    begin
     vcttosur(a3.ns,a3.ew,a3.tvd,inc,azm);
     form07.RadioButton1.Caption:=floattostr(dec(3,azm*180/pi));
     vcttosur(-a3.ns,-a3.ew,-a3.tvd,inc,azm);
     form07.RadioButton2.Caption:=floattostr(dec(3,azm*180/pi));
    end;
   if qq=1 then
    azm:=strtofloat(form07.RadioButton1.Caption)*pi/180
   else
    azm:=strtofloat(form07.RadioButton2.Caption)*pi/180;
  end
 else
  begin
   showMESSAGE('OPERATION CANNOT BE DONE!');
   EXIT;
  end;
end;
procedure TForm02.incfind(a2,a3:point;azm:real;var inc:real);
var
 a,ap:point;
begin
 a.ns:=a2.ew*a3.tvd-a2.tvd*a3.ew;
 a.ew:=-(a2.ns*a3.tvd-a2.tvd*a3.ns);
 a.tvd:=a2.ns*a3.ew-a2.ew*a3.ns;

 surtovct(pi/2,azm,ap.ns,ap.ew,ap.tvd);
 if a.tvd<>0 then
  begin
   ap.tvd:=-(a.ns*ap.ns+a.ew*ap.ew)/a.tvd;
   inc:=arccos(ap.tvd/sqrt(ap.ns*ap.ns+ap.ew*ap.ew+ap.tvd*ap.tvd))
  end
 else
  begin
   form07.RadioButton1.Visible:=false;
   form07.RadioButton2.Visible:=false;
   form07.edit1.Visible:=true;
   form07.Label1.Visible:=true;
   form07.Label2.Visible:=true;
   form07.ShowModal;
   inc:=strtofloat(form07.Edit1.Text)*pi/180;
   form07.RadioButton1.Visible:=true;
   form07.RadioButton2.Visible:=true;
   form07.edit1.Visible:=false;
   form07.Label1.Visible:=false;
   form07.Label2.Visible:=false;
  end;

end;
procedure TForm02.ListBox1DblClick(Sender: TObject);
var
   ii: Integer;
   tables:TStringList;
   stext,saveit:string;
begin
 saveit:=copy(ListBox1.Items[ListBox1.ItemIndex],length(ListBox1.Items[ListBox1.ItemIndex])-7,8);
 if (saveit<>' (Saved)')AND(ListBox1.ItemIndex<>0) then
  begin
   tables := TStringList.Create;
   try
     form01.ADOConnection1.GetTableNames(TABLES);
     for ii := 0 to TABLES.Count-1 do
      BEGIN
       form01.ADOTable1.Active:=false;
       form01.ADOTable1.TableName:=tables[ii];
       form01.ADOTable1.Active:=true;
       form01.ADOTable1.First;
       if (copy(tables[ii],1,2)='SE')
       and(form01.ADOTABLE1.FieldByName('Country').AsString=form01.Treeview1.Selected.Parent.PARENT.Parent.Text)
       and(form01.ADOTABLE1.FieldByName('Field').AsString=form01.Treeview1.Selected.PARENT.PARENT.Text)
       and(form01.ADOTABLE1.FieldByName('WELL').AsString=form01.Treeview1.Selected.Parent.Text)
       and(form01.ADOTABLE1.FieldByName('CALC').AsString=ListBox1.Items[ListBox1.ItemIndex])THEN
        begin
         form01.ADOCommand1.CommandText:='delete * from '+TABLES[II];
         form01.ADOCommand1.Execute;
         form01.ADOCommand1.CommandText:='insert into '+TABLES[II]+' select * from TS001';
         form01.ADOCommand1.Execute;
         form01.ADOCommand1.CommandText:='UPDATE '+TABLES[II]+' SET '+'CALC = '''+ListBox1.Items[ListBox1.ItemIndex]+''', WELL = '''+form01.Treeview1.Selected.PARENT.Text+''', FIELD = '''
         +form01.Treeview1.Selected.PARENT.PARENT.Text+''' , COUNTRY = '''+form01.Treeview1.Selected.PARENT.PARENT.PARENT.Text+'''';
         form01.ADOCommand1.Execute;
        end;
      END;
     ListBox1.Items[ListBox1.ItemIndex]:=ListBox1.Items[ListBox1.ItemIndex]+' (Saved)';
   finally
     tables.free;
    end;
  end
 ELSE IF (ListBox1.ItemIndex=0) then
  SAVEWD
end;

procedure TForm02.DBGrid2CtypeellClick(Column: TColumn);
var
 ii,jj,kk,ll,mm,oo:integer;
begin
 mm:=0;
 column.Index;
 Column.ReadOnly := (not(romat[ADOTABLE2.RecNo-1,column.index]));
 kk:=ADOTABLE2.RecNo-1;
 ll:=DBGrid2.Columns[15].Field.asinteger;
 oo:=DBGrid2.Columns[14].Field.asinteger;
 rosel[0]:=DBGrid2.Columns[14].Field.asinteger;
 rosel[1]:=DBGrid2.Columns[15].Field.asinteger;
 jj:=0;
 DBGrid2.DataSource.DataSet.First;
 for ii := 0 to 50 do
  begin
   if (ll=DBGrid2.Columns[15].Field.asinteger)and(jj=0)and(oo=DBGrid2.Columns[14].Field.asinteger) then
    begin
     jj:=jj+1;
     mm:=ii;
    end;
   if (ll=DBGrid2.Columns[15].Field.asinteger)and(jj<>0)and(oo=DBGrid2.Columns[14].Field.asinteger) then
    begin
     jj:=jj+1;
     mm:=round(0.5*(abs(mm+ii)-abs(mm-ii)));
    end;
   if (ll<>DBGrid2.Columns[15].Field.asinteger)and(jj<>0) then
    begin
     break;
    end;
   DBGrid2.DataSource.DataSet.Next;
  end;
 rowcol(mm,jj-1);
 ADOTABLE2.First;
 for ii := 0 to kk-1 do
   ADOTABLE2.Next;
end;

procedure TForm02.DBGrid2DrawColumnCell(Sender: TObject; const Rect: TRect;
  DataCol: Integer; Column: TColumn; State: TGridDrawState);
var
 S : string;
   TextTop, TextLeft : integer;

begin
 if {CLRSHW}true then
  BEGIN
   S := Column.Field.AsString;
   TextTop := RectHeight(Rect) - DBGrid2.Canvas.TextHeight(S);
   TextTop := Rect.Top + TextTop div 2;
   TextLeft := RectWidth(Rect) - DBGrid2.Canvas.TextWidth(S);
   TextLeft := Rect.Left + TextLeft div 2;
   if romat[round(rect.Top/18)-1,datacol] = true then
    begin
     DBGrid2.Canvas.Font.Color := clBlack;
     DBGrid2.Canvas.Brush.Color := clyellow;
     DBGrid2.Canvas.TextRect(Rect, TextLeft, TextTop, S);
    end
   else
    begin
     DBGrid2.Canvas.Font.Color := clBlack;
     DBGrid2.Canvas.Brush.Color := clwhite;
     DBGrid2.Canvas.TextRect(Rect, TextLeft, TextTop, S);
    end;
   if (rosel[0]<>-1)and(rocal[round(rect.Top/18)-1,datacol] = true)and(romat[round(rect.Top/18)-1,datacol] = false) then
    begin
     DBGrid2.Canvas.Font.Color := clBlack;
     DBGrid2.Canvas.Brush.Color := claqua;
     DBGrid2.Canvas.TextRect(Rect, TextLeft, TextTop, S);
    end
  END;
end;

procedure TForm02.Button5Click(Sender: TObject);
var
 wlptn:abranch;
 ii,i,J,k,l,m:integer;
  romatn:array[0..50,0..16] of boolean;
  rocaln:array[0..50,0..16] of boolean;
  saveit:string;
begin
 for ii := 0 to listbox1.Count-1 do
  begin
   saveit:=copy(ListBox1.Items[ii],length(ListBox1.Items[ii])-7,8);
   if saveit=' (Saved)' then
    begin
     ListBox1.Items[ii]:=copy(ListBox1.Items[ii],1,length(ListBox1.Items[ii])-8);
    end;
  end;

 m:=0;
 if rosel[0]<>0 then
  begin
   for i:= 0 to 16 - 1 do
     for j := 0 to 50 - 1 do
       romatn[j,i]:=false;
   for i := 0 to 16 - 1 do
     for j := 0 to 50 - 1 do
       rocaln[j,i]:=false;
   ADOTABLE2.First;
   i:=0;
   while ADOTABLE2.FieldByName('ordr').AsInteger<>-1 do
    begin
     ADOTABLE2.Next;
     i:=i+1;
    end;
   setlength(wlptn,i);
   ADOTABLE2.First;
   k:=0;
   for J := 0 to i-1 do
    begin
     if not((rosel[0]=ADOTABLE2.FieldByName('ordr').AsInteger)and(rosel[1]=ADOTABLE2.FieldByName('type').AsInteger)) then
      begin
       wlptn[k].cmt:=ADOTABLE2.FieldByName('Comment').AsString;
       wlptn[k].md:=ADOTABLE2.FieldByName('md').AsFloat;
       wlptn[k].inc:=ADOTABLE2.FieldByName('incl').AsFloat*pi/180;
       wlptn[k].azm:=ADOTABLE2.FieldByName('azm').AsFloat*pi/180;
       wlptn[k].TVD:=ADOTABLE2.FieldByName('tvd').AsFloat;
       wlptn[k].vsec:=ADOTABLE2.FieldByName('vsec').AsFloat;
       wlptn[k].NS:=ADOTABLE2.FieldByName('ns').AsFloat;
       wlptn[k].EW:=ADOTABLE2.FieldByName('ew').AsFloat;
       wlptn[k].DLS:=ADOTABLE2.FieldByName('dls').AsFloat*pi/180;
       wlptn[k].tf:=ADOTABLE2.FieldByName('tf').AsFloat;
       wlptn[k].tr:=ADOTABLE2.FieldByName('tr').AsFloat*pi/180;
       wlptn[k].br:=ADOTABLE2.FieldByName('br').AsFloat*pi/180;
       wlptn[k].dmd:=ADOTABLE2.FieldByName('DMD').AsFloat;
       wlptn[k].order:=ADOTABLE2.FieldByName('ordr').AsInteger-m;
       wlptn[k].typ:=ADOTABLE2.FieldByName('type').AsInteger;
       for l := 0 to 16 do
        begin
         romatn[k,l]:=romat[j,l];
         rocaln[k,l]:=rocal[j,l];
        end;
       k:=k+1;
      end
     else if m=0 then
      m:=1;
     ADOTABLE2.next;
     if (rosel[0]<>0)and((rosel[0]+1)=ADOTABLE2.FieldByName('ordr').AsInteger)and(ADOTABLE2.FieldByName('type').AsInteger>50) then
      begin
       wlptn[k].tf:=ADOTABLE2.FieldByName('tf').AsFloat;
       romatn[k,9]:=true;
       rocaln[k,9]:=true;
      end;

    end;
   pagerefresh;
   ADOTABLE2.First;
   for j := 0 to k-1 do
    begin
     ADOTABLE2.Open;
     ADOTABLE2.edit;
     ADOTABLE2.FieldByName('Comment').AsString:=wlptn[j].CMT;
     ADOTABLE2.FieldByName('md').AsFloat:=wlptn[j].md;
     ADOTABLE2.FieldByName('incl').AsFloat:=wlptn[j].INC*180/pi;
     ADOTABLE2.FieldByName('azm').AsFloat:=wlptn[j].azm*180/pi;
     ADOTABLE2.FieldByName('tvd').AsFloat:=wlptn[j].tvd;
     ADOTABLE2.FieldByName('vsec').AsFloat:=wlptn[j].VSEC;
     ADOTABLE2.FieldByName('ns').AsFloat:=wlptn[j].NS;
     ADOTABLE2.FieldByName('ew').AsFloat:=wlptn[j].EW;
     ADOTABLE2.FieldByName('dls').AsFloat:=wlptn[j].DLS*180/pi;
     ADOTABLE2.FieldByName('tf').AsFloat:=wlptn[j].tf;
     ADOTABLE2.FieldByName('tr').AsFloat:=wlptn[j].tr*180/pi;
     ADOTABLE2.FieldByName('br').AsFloat:=wlptn[j].br*180/pi;
     ADOTABLE2.FieldByName('DMD').AsFloat:=wlptn[j].dmd;
     ADOTABLE2.FieldByName('ordr').AsInteger:=wlptn[j].order;
     ADOTABLE2.FieldByName('type').AsInteger:=wlptn[j].typ;
     ADOTABLE2.Post;
     ADOTABLE2.Next;
     for l := 0 to 16 do
      begin
       romat[j,l]:=romatn[j,l];
       rocal[j,l]:=rocaln[j,l];
      end;
    end;
   ADOTABLE2.First;
  end;
end;

procedure tForm02.plane(a1,a2,a3:point; var a4:point;var theta:real);
var
 a,b,c,d,t,tp:real;
 a5:point;
begin
 {a1:point, a2:VECTOR, a3:vector}
 if a4.ns<>0 then
  begin
   a5.ns:=a4.ns;
   a5.ew:=a4.ew;
   a5.tvd:=a4.tvd;

   a:=a2.ew*a3.tvd-a3.ew*a2.tvd;
   b:=-(a2.ns*a3.tvd-a3.ns*a2.tvd);
   c:=a2.ns*a3.ew-a3.ns*a2.ew;
   d:=sqrt(a*a+b*b+c*c);
   a:=a/d;
   b:=b/d;
   c:=c/d;
   d:=a*a1.ns+b*a1.ew+c*a1.tvd;
   tp:=(d-b)/(b*b+c*c);
   t:=a*a4.ns/(b*b+c*c);
   if theta=-999 then
    theta:=sign(a4.ns)*arccos(sign(tp*t)*abs(a));
   if (abs(b)>0.0000001)or(abs(c)>0.0000001) then
    begin
     if b<0 then
      begin
       b:=-b;
       c:=-c;
       d:=-d;
      end;
     if c<>0 then
      rotation(0,-c,b,0,0,d/c,theta,a4.ns,a4.ew,a4.tvd)
     else
      rotation(0,-c,b,0,d/b,0,theta,a4.ns,a4.ew,a4.tvd);
    end;
  end;
end;

procedure tForm02.revplane(a1,a2,a3:point;theta:real; var a4:point);
var
 a,b,c:real;
begin
 a:=a3.ew*a2.tvd-a2.ew*a3.tvd;
 b:=-(a3.ns*a2.tvd-a2.ns*a3.tvd);
 c:=a3.ns*a2.ew-a2.ns*a3.ew;
 if (b<>0)or(c<>0) then
  begin
   if b<0 then
    begin
     a:=-a;
     b:=-b;
     c:=-c;
    end;
   if (abs(b)>0.0000001)or(abs(c)>0.0000001) then
    if c<>0 then
     rotation(0,-c,b,0,0,(a*a1.ns+b*a1.ew+c*a1.tvd)/c,-theta,a4.ns,a4.ew,a4.tvd)
    else
     rotation(0,0,b,0,(a*a1.ns+b*a1.ew)/b,0,-theta,a4.ns,a4.ew,a4.tvd);
  end;
end;
procedure tForm02.rotation(u: Real; v: Real; w: Real; a: Real; b: Real; c: Real; theta: real; var x: Real; var y: Real; var z: Real);
var
 xx,yy,zz:real;
begin
//special thanks from: http://inside.mines.edu/~gmurray/arbitraryaxisrotation/
 xx:=(a*(sqr(v)+sqr(w))+u*(-b*v-c*w+u*x+v*y+w*z)+((x-a)*(sqr(v)+sqr(w))+u*(b*v+c*w-v*y-w*z))*cos(theta)
 +sqrt(sqr(u)+sqr(v)+sqr(w))*(b*w-c*v-w*y+v*z)*sin(theta))/(sqr(u)+sqr(v)+sqr(w));

 yy:=(b*(sqr(u)+sqr(w))+v*(-a*u-c*w+u*x+v*y+w*z)+((y-b)*(sqr(u)+sqr(w))+v*(a*u+c*w-u*x-w*z))*cos(theta)
 +sqrt(sqr(u)+sqr(v)+sqr(w))*(c*u-a*w-u*z+w*x)*sin(theta))/(sqr(u)+sqr(v)+sqr(w));

 zz:=(c*(sqr(u)+sqr(v))+w*(-a*u-b*v+u*x+v*y+w*z)+((z-c)*(sqr(u)+sqr(v))+w*(b*v+a*u-v*y-u*x))*cos(theta)
 +sqrt(sqr(u)+sqr(v)+sqr(w))*(a*v-b*u-v*x+u*y)*sin(theta))/(sqr(u)+sqr(v)+sqr(w));

 x:=xx;
 y:=yy;
 z:=zz;
end;
procedure TForm02.PlanningTargets1Click(Sender: TObject);
VAR
 II:INTEGER;
 wlpt,WLPT1:branch;
begin
 form02.ADOTABLE2.First;
 ii:=0;
 while form02.ADOTABLE2.FieldByName('TYPE').AsINTEGER<>-1 do
  BEGIN
   with form02.ADOTABLE2 do
    begin
     ii:=ii+1;
     wlpt.order:=FieldByName('ordr').AsInteger;
    end;
   form02.ADOTABLE2.Next;
  END;
 wlpt1.MD:=0;
 wlpt1.INC:=0;
 wlpt1.AZM:=0;
 wlpt1.TVD:=0;
 wlpt1.vsec:=0;
 wlpt1.NS:=0;
 wlpt1.EW:=0;
 wlpt1.DLS:=0;
 WLPT1.CMT:='Planning Target';
 wlpt1.typ:=8;
 rowcolor(ii,wlpt1.typ);
 wlpt1.order:=wlpt.order+1;
 cellshow(wlpt1);

end;
PROCEDURE TForm02.HC3DTFT(THETA1,TGTX,TGTY,THETA:REAL;var wlpt1,wlpt2:abranch;VAR OKK:BOOLEAN);
var
 wlpt:branch;
 TVD,r1,crvln,hd,ppf:real;
 i,k:integer;

begin
 OKK:=FALSE;
 setlength(wlpt2,2);
 ppf:=100;
 hd:=TGTX;
 TVD:=TGTY;
 r1:=((TGTY)*sin(theta1)-hd*cos(theta1))/(cos(theta-theta1)-1);
 WLPT2[0].DLS:=0;
 WLPT2[1].DLS:=1/R1;
 crvln:=(THETA-THETA1)/WLPT2[1].DLS;
 WLPT2[0].TVD:=TVD-R1*(SIN(THETA)-SIN(THETA1));
 WLPT2[1].TVD:=TVD;
 WLPT2[0].EW:=HD-R1*(COS(THETA1)-COS(THETA));
 WLPT2[1].EW:=HD;
 if COS(THETA1)<>0 then
  WLPT2[0].MD:=WLPT2[0].TVD/COS(THETA1)
 else
  WLPT2[0].MD:=WLPT2[0].EW/sin(THETA1);
 if (WLPT2[0].MD>0)and(crvln>0) then
  BEGIN
   OKK:=TRUE;
   WLPT2[1].MD:=WLPT2[0].MD+crvln;
   wlpt2[0].CMT:='KOP (HOLD-CURVE 3D*)';
   wlpt2[1].CMT:='EOC (Target)';
   wlpt2[0].NS:=0;
   wlpt2[0].EW:=wlpt2[0].EW;
   wlpt2[0].NS:=0;
   wlpt2[1].EW:=wlpt2[1].EW;
   wlpt2[0].inc:=theta1;
   wlpt2[1].inc:=theta;
   wlpt2[0].dmd:=wlpt2[0].MD;
   wlpt2[1].dmd:=wlpt2[1].MD-wlpt2[0].MD;
   setlength(wlpt1,2*trunc(wlpt2[1].md/ppf+1)+2+1);
   wlpt.md:=0;
   i:=0;
   k:=0;
   while k=0 do
    begin
     if wlpt.MD<=(wlpt2[0].md) then
      begin
       wlpt.INC:=theta1;
       wlpt.TVD:=wlpt.MD*COS(theta1);
       wlpt.EW:=WLPT.MD*SIN(theta1);
       if theta1=0 then
        wlpt.CMT:='Vertical'
       ELSE
        WLPT.CMT:='KEEP SEC.';
       wlpt.DLS:=0;
      end
     else if (wlpt.MD<wlpt2[1].md)and(wlpt.MD>wlpt2[0].md) then
      begin
       wlpt.INC:=(wlpt.MD-wlpt2[0].md)*wlpt2[1].dls+theta1;
       wlpt.TVD:=wlpt2[0].md*cos(theta1)+r1*(sin(wlpt.inc)-sin(theta1));
       wlpt.EW:=wlpt2[0].md*sin(theta1)+r1*(cos(theta1)-cos(wlpt.inc));
       wlpt.CMT:='CURVE';
       wlpt.DLS:=WLPT2[1].DLS;
      end
     else if (wlpt.MD>=wlpt2[1].md) then
      begin
       wlpt.MD:=WLPT2[1].MD;
       wlpt.INC:=theta;
       wlpt.TVD:=wlpt2[1].tvd;
       wlpt.EW:=WLPT2[1].EW;
       WLPT.CMT:='EOC - Target';
       wlpt.DLS:=0;
       k:=1;
      end;
     WLPT1[I].MD:=WLPT.MD;
     WLPT1[I].INC:=WLPT.INC;
     WLPT1[I].TVD:=WLPT.TVD;
     WLPT1[I].EW:=WLPT.EW;
     WLPT1[I].NS:=0;
     WLPT1[I].CMT:=WLPT.CMT;
     WLPT1[I].DLS:=WLPT.DLS;
     I:=I+1;
     if (i mod 2)=0 then
      begin
       wlpt.md:=(i/2)*ppf;
      end
     else
      wlpt.md:=trunc(i/2)*ppf+1
    end;
  END
 else
  begin
   wlpt2[0].CMT:='(CANNOT BE DESIGNED)';
   wlpt2[1].CMT:='(CANNOT BE DESIGNED)';
  end;
END;
PROCEDURE TForm02.CH3DFFK(THETA1,TGTX,TGTY,THETA:REAL;var wlpt1,wlpt2:abranch;VAR OKK:BOOLEAN);
VAR
 wlpt:branch;
 md,r1,crvln,hd,ppf,DLS:real;
 i,k:integer;
begin
// NOTE: FIRST POINT ASSUMPTION IS: zero,zero.\
 okk:=false;
 setlength(wlpt2,2);
 HD:=TGTX;
 ppf:=100;
 r1:=((TGTY)*sin(theta)-hd*cos(theta))/((sin(theta)-sin(theta1))*sin(theta)-(cos(theta1)-cos(theta))*cos(theta));
 DLS:=(1/r1);
 crvln:=(theta-THETA1)/DLS;
 if theta<>0 then
  md:=crvln+(hd-r1*(COS(THETA1)-cos(theta)))/sin(theta)
 else
  md:=crvln+(TGTY-r1*(sin(THETA)-sin(theta1)))/cos(theta);
 if (crvln>=0)and(md>=crvln) then
  begin
   okk:=true;
   wlpt2[0].MD:=crvln;
   wlpt2[0].INC:=(wlpt2[0].MD)*DLS+THETA1;
   wlpt2[0].TVD:=r1*(sin(wlpt2[0].inc)-SIN(THETA1));
   wlpt2[0].EW:=r1*(COS(THETA1)-cos(wlpt2[0].inc));
   wlpt2[0].CMT:='EOC (CURVE-HOLD 3D*)';
   wlpt2[0].NS:=0;
   wlpt2[0].EW:=wlpt2[0].EW;
   wlpt2[0].DLS:=DLS;
   wlpt2[1].MD:=md;
   wlpt2[1].INC:=theta;
   wlpt2[1].TVD:=r1*(sin(theta)-SIN(THETA1))+(MD-crvln)*cos(theta);
   wlpt2[1].EW:=r1*(cos(theta1)-cos(theta))+(MD-crvln)*sin(theta);
   wlpt2[1].CMT:='Target';
   wlpt2[1].NS:=0;
   wlpt2[1].EW:=wlpt2[1].EW;
   wlpt2[1].DLS:=0;
   wlpt2[0].dmd:=wlpt2[0].MD;
   wlpt2[1].dmd:=wlpt2[1].MD-wlpt2[0].MD;

   setlength(wlpt1,2*trunc(wlpt2[1].md/ppf+1)+2+1);
   wlpt.md:=0;
   i:=0;
   k:=0;
   while k=0 do
    begin
     if wlpt.MD<=(wlpt2[0].md) then
      begin
       wlpt.inc:=theta1+(wlpt.md)*dls;
       wlpt.TVD:=r1*(sin(wlpt.inc)-sin(theta1));
       wlpt.EW :=r1*(cos(theta1)-cos(wlpt.inc));
       wlpt.CMT:='CURVE';
       wlpt.DLS:=WLPT2[0].DLS;
      end
     else if (wlpt.MD<(wlpt2[1].md))and(wlpt.MD>wlpt2[0].md) then
      begin
       wlpt.inc:=theta;
       wlpt.TVD:=wlpt2[0].tvd+(wlpt.MD-crvln)*cos(theta);
       wlpt.EW :=wlpt2[0].EW+(wlpt.MD-crvln)*sin(theta);
       wlpt.CMT:='Keep';
       wlpt.DLS:=WLPT2[1].DLS;
      end
     else if (wlpt.MD>=wlpt2[1].md) then
      begin
       wlpt.MD:=WLPT2[1].MD;
       wlpt.INC:=theta;
       wlpt.TVD:=wlpt2[1].tvd;
       wlpt.EW:=WLPT2[1].EW;
       WLPT.CMT:='Targer';
       wlpt.DLS:=0;
       k:=1;
      end;
     WLPT1[I].MD:=WLPT.MD;
     WLPT1[I].INC:=WLPT.INC;
     WLPT1[I].TVD:=WLPT.TVD;
     WLPT1[I].EW:=WLPT.EW;
     WLPT1[I].NS:=0;
     WLPT1[I].CMT:=WLPT.CMT;
     WLPT1[I].DLS:=WLPT.DLS;
     I:=I+1;
     if (i mod 2)=0 then
      begin
       wlpt.md:=(i/2)*ppf;
      end
     else
      wlpt.md:=trunc(i/2)*ppf+1
    end
  end
 else
  begin
   wlpt2[0].CMT:='(CANNOT BE DESIGNED)';
   wlpt2[1].CMT:='(CANNOT BE DESIGNED)';
  end;
end;
procedure TForm02.Curve1Click(Sender: TObject);
begin
 form06.showmodal;
end;

PROCEDURE TForm02.HCH(THETA1,TGTX,TGTY,THETA,DLS:REAL;VAR wlpt1,wlpt2: abranch;var okk:boolean);
var
 wlpt:branch;
 r1,crvln,hd,a,b,ppf:real;
 i,k:integer;
begin
 okk:=false;
 setlength(wlpt2,3);
 ppf:=100;
 hd:=TGTX;
 if (dls<>0)and(theta<>theta1)then
  begin
   r1:=(1/DLS);
   a:=(TGTY*SIN(THETA)-HD*COS(THETA)-r1*(1-cos(theta-theta1)))/SIN(THETA-THETA1);
   b:=(TGTY*SIN(THETA1)-HD*COS(THETA1)-r1*(cos(theta-theta1)-1))/SIN(THETA1-THETA);
   wlpt2[0].MD:=a;
   wlpt2[0].INC:=THETA1;
   wlpt2[0].TVD:=wlpt2[0].MD*COS(THETA1);
   wlpt2[0].NS:=0;
   wlpt2[0].EW:=wlpt2[0].MD*SIN(THETA1);
   wlpt2[0].DLS:=0;
   wlpt2[0].CMT:='KOP (Computed)';

   crvln:=(theta-theta1)/DLS;
   wlpt2[1].MD:=wlpt2[0].MD+crvln;
   wlpt2[1].INC:=THETA;
   wlpt2[1].TVD:=wlpt2[0].tvd+r1*(sin(theta)-sin(theta1));
   wlpt2[1].NS:=0;
   wlpt2[1].EW:=wlpt2[0].ew+r1*(cos(theta1)-cos(theta));
   wlpt2[1].DLS:=dls;
   wlpt2[1].CMT:='EOC';

   wlpt2[2].TVD:=wlpt2[1].tvd+b*cos(theta);
   wlpt2[2].EW:=wlpt2[1].ew+b*sin(theta);
   wlpt2[2].MD:=a+crvln+b;
   wlpt2[2].INC:=THETA;
   wlpt2[2].NS:=0;
   wlpt2[2].DLS:=0;
   wlpt2[2].CMT:='Target';
   wlpt2[0].dmd:=wlpt2[0].MD;
   wlpt2[1].dmd:=wlpt2[1].MD-wlpt2[0].MD;
   wlpt2[2].dmd:=wlpt2[2].MD-wlpt2[1].MD;
  end;
 if (wlpt2[2].dmd>=0)and(wlpt2[1].dmd>=0)and(wlpt2[0].dmd>=0)and(dls<>0) then
  begin
   okk:=true;
   setlength(wlpt1,2*trunc(wlpt2[2].md/ppf+1)+4+1);
   wlpt.md:=0;
   i:=0;
   k:=0;
   while k=0 do
    begin
     if wlpt.MD<=(wlpt2[0].md) then
      begin
       wlpt.inc:=theta1;
       wlpt.TVD:=(wlpt.MD)*cos(theta1);
       wlpt.ew :=(wlpt.MD)*sin(theta1);
       wlpt.CMT:='Keep';
       wlpt.DLS:=WLPT2[0].DLS;
      end
     else if (wlpt.MD<(wlpt2[1].md))and(wlpt.MD>wlpt2[0].md) then
      begin
       wlpt.inc:=theta1+(wlpt.md-wlpt2[0].md)*dls;
       wlpt.TVD:=wlpt2[0].tvd+r1*(sin(wlpt.inc)-sin(theta1));
       wlpt.ew :=wlpt2[0].ew+r1*(cos(theta1)-cos(wlpt.inc));
       wlpt.CMT:='Curve';
       wlpt.DLS:=WLPT2[1].DLS;
      end
     else if (wlpt.MD<(wlpt2[2].md))and(wlpt.MD>wlpt2[1].md) then
      begin
       wlpt.inc:=theta;
       wlpt.TVD:=wlpt2[1].tvd+(wlpt.MD-wlpt2[1].md)*cos(theta);
       wlpt.ew :=wlpt2[1].ew+(wlpt.MD-wlpt2[1].md)*sin(theta);
       wlpt.CMT:='Keep';
       wlpt.DLS:=WLPT2[2].DLS;
      end
     else if (wlpt.MD>=wlpt2[2].md) then
      begin
       wlpt.MD:=WLPT2[2].MD;
       wlpt.INC:=theta;
       wlpt.TVD:=wlpt2[2].tvd;
       wlpt.EW:=WLPT2[2].EW;
       WLPT.CMT:='Targer';
       wlpt.DLS:=0;
       k:=1;
      end;
     WLPT1[I].MD:=WLPT.MD;
     WLPT1[I].INC:=WLPT.INC;
     WLPT1[I].TVD:=WLPT.TVD;
     WLPT1[I].EW:=WLPT.ew;
     WLPT1[I].NS:=0;
     WLPT1[I].CMT:=WLPT.CMT;
     WLPT1[I].DLS:=WLPT.DLS;
     I:=I+1;
     if (i mod 2)=0 then
      begin
       wlpt.md:=(i/2)*ppf;
      end
     else
      wlpt.md:=trunc(i/2)*ppf+1
    end;
  end;
end;
{****************************************************************************}
PROCEDURE TForm02.CH(THETA1,TGTX,TGTY,DLS:REAL;var wlpt1,wlpt2:abranch;var okk:boolean);
var
 wlpt:branch;
 theta,md,r1,crvln,a,b,ppf:real;
 i:integer;
 k: Integer;
begin
 okk:=false;
 setlength(wlpt2,2);
 ppf:=100;
 r1:=(1/DLS);
 a:=-sin(theta1)-tgty/r1;
 b:=-cos(theta1)+tgtx/r1;
 if (a*a+b*b-1)>0 then
  if (tgtx<r1)and(b<>1)then
   theta:=2*arctan((a+sqrt(a*a+b*b-1))/(b-1))
  else if (b<>1) then
   theta:=2*arctan((a-sqrt(a*a+b*b-1))/(b-1));
 crvln:=(theta-theta1)/DLS;
 md:=crvln+(tgty-r1*(sin(theta)-sin(theta1)))/cos(theta);
 if (crvln>0)and(md>crvln)and(b<>1)and((a*a+b*b-1)>0) then
  begin
   okk:=true;
   wlpt2[0].MD:=crvln;
   wlpt2[0].INC:=(wlpt2[0].MD)*DLS+THETA1;
   wlpt2[0].TVD:=r1*(sin(wlpt2[0].inc)-SIN(THETA1));
   wlpt2[0].EW:=r1*(COS(THETA1)-cos(wlpt2[0].inc));
   wlpt2[0].CMT:='EOC (CURVE-HOLD)';
   wlpt2[0].NS:=0;
   wlpt2[0].EW:=wlpt2[0].EW;
   wlpt2[0].DLS:=ABS(DLS);
   wlpt2[1].MD:=md;
   wlpt2[1].INC:=theta;
   wlpt2[1].TVD:=r1*(sin(theta)-SIN(THETA1))+(MD-crvln)*cos(theta);
   wlpt2[1].EW:=r1*(cos(theta1)-cos(theta))+(MD-crvln)*sin(theta);
   wlpt2[1].CMT:='Target';
   wlpt2[1].NS:=0;
   wlpt2[1].EW:=wlpt2[1].EW;
   wlpt2[1].DLS:=0;
   wlpt2[0].dmd:=wlpt2[0].MD;
   wlpt2[1].dmd:=wlpt2[1].MD-wlpt2[0].MD;

   setlength(wlpt1,2*trunc(wlpt2[1].md/ppf+1)+2+1);
   wlpt.md:=0;
   i:=0;
   k:=0;
   while k=0 do
    begin
     if wlpt.MD<=(wlpt2[0].md) then
      begin
       wlpt.inc:=theta1+(wlpt.md)*dls;
       wlpt.TVD:=r1*(sin(wlpt.inc)-sin(theta1));
       wlpt.EW :=r1*(cos(theta1)-cos(wlpt.inc));
       wlpt.CMT:='CURVE';
       wlpt.DLS:=WLPT2[0].DLS;
      end
     else if (wlpt.MD<(wlpt2[1].md))and(wlpt.MD>wlpt2[0].md) then
      begin
       wlpt.inc:=theta;
       wlpt.TVD:=wlpt2[0].tvd+(wlpt.MD-crvln)*cos(theta);
       wlpt.EW :=wlpt2[0].EW+(wlpt.MD-crvln)*sin(theta);
       wlpt.CMT:='Keep';
       wlpt.DLS:=WLPT2[1].DLS;
      end
     else if (wlpt.MD>=wlpt2[1].md) then
      begin
       wlpt.MD:=WLPT2[1].MD;
       wlpt.INC:=theta;
       wlpt.TVD:=wlpt2[1].tvd;
       wlpt.EW:=WLPT2[1].EW;
       WLPT.CMT:='Targer';
       wlpt.DLS:=0;
       k:=1;
      end;
     WLPT1[I].MD:=WLPT.MD;
     WLPT1[I].INC:=WLPT.INC;
     WLPT1[I].TVD:=WLPT.TVD;
     WLPT1[I].EW:=WLPT.EW;
     WLPT1[I].NS:=0;
     WLPT1[I].CMT:=WLPT.CMT;
     WLPT1[I].DLS:=WLPT.DLS;
     I:=I+1;
     if (i mod 2)=0 then
      begin
       wlpt.md:=(i/2)*ppf;
      end
     else
      wlpt.md:=trunc(i/2)*ppf+1
    end;
  end;
end;
PROCEDURE TForm02.CH2DC1(THETA1,TGTX,TGTY,theta,DLS1,dls2:REAL;var wlpt1,wlpt2:abranch;var okk:boolean);
VAR
 wlpt:branch;
 a,b,c,l1,r1,r2:real;
 ppf,i,k,ii,jj,kk:integer;
begin
 okk:=false;
 ppf:=100;
 setlength(wlpt2,3);
 ii:=1;
 jj:=1;
 kk:=0;
 r1:=1/dls1;
 r2:=1/dls2;
 a:=r1-r2-r2*COS(theta)+r1*COS(theta1)-tgtx;
 b:=2*(r2*SIN(theta)-r1*SIN(theta1)-tgty);
 c:=r1-r2+r2*COS(theta)-r1*COS(theta1)+tgtx;
 if (b*b-4*a*c)>0 then
  begin
   if abs(tgtx)>abs(r1) then
     wlpt2[0].INC:=2*arctan((-b-sqrt(abs(b*b-4*a*c)))/(2*a))
   else
     wlpt2[0].INC:=2*arctan((-b+sqrt(abs(b*b-4*a*c)))/(2*a));
   l1:=(tgtx-r1*(cos(theta1)-cos(wlpt2[0].inc))-r2*(cos(wlpt2[0].inc)-cos(theta)))/sin(wlpt2[0].inc);
   wlpt2[0].MD:=(wlpt2[0].INC-theta1)*r1;
   wlpt2[0].TVD:=r1*(sin(wlpt2[0].INC)-sin(theta1));
   wlpt2[0].NS:=0;
   wlpt2[0].EW:=r1*(cos(theta1)-cos(wlpt2[0].inc));
   wlpt2[0].DLS:=DLS1;
   wlpt2[0].CMT:='EOC #1 3D*-S';

   wlpt2[1].INC:=wlpt2[0].INC;
   wlpt2[1].MD:=wlpt2[0].MD+l1;
   wlpt2[1].TVD:=wlpt2[0].TVD+l1*cos(wlpt2[1].inc);
   wlpt2[1].NS:=0;
   wlpt2[1].EW:=wlpt2[0].ew+l1*sin(wlpt2[1].inc);
   wlpt2[1].DLS:=0;
   wlpt2[1].CMT:='KOP #2';

   wlpt2[2].INC:=theta;
   wlpt2[2].MD:=wlpt2[1].MD+(theta-wlpt2[0].INC)*r2;
   wlpt2[2].TVD:=wlpt2[1].TVD+r2*(sin(theta)-sin(wlpt2[0].inc));
   wlpt2[2].NS:=0;
   wlpt2[2].EW:=wlpt2[1].ew+r2*(cos(wlpt2[0].inc)-cos(theta));
   wlpt2[2].DLS:=dls2;
   wlpt2[2].CMT:='EOC Target';
   wlpt2[0].dmd:=wlpt2[0].MD;
   wlpt2[1].dmd:=wlpt2[1].MD-wlpt2[0].MD;
   wlpt2[2].dmd:=wlpt2[2].MD-wlpt2[1].MD;

   if (wlpt2[2].MD>=wlpt2[1].MD)and(wlpt2[1].MD>=wlpt2[0].MD)and(wlpt2[0].MD>=0) then
    okk:=true
   else
    exit;
  end
 else
   exit;
 setlength(wlpt1,2*trunc(wlpt2[2].md/ppf+1)+4+1);
 wlpt.md:=0;
 i:=0;
 k:=0;
 setlength(wlpt1,2*trunc(wlpt2[2].md/ppf+1)+2+1);
 while k=0 do
  begin
   if wlpt.MD<=(wlpt2[0].md) then
    begin
     wlpt.inc:=theta1+wlpt.md/r1;
     wlpt.TVD:=r1*(sin(wlpt.inc)-sin(theta1));
     wlpt.ew :=r1*(cos(theta1)-cos(wlpt.inc));
     wlpt.CMT:='Curve';
     wlpt.DLS:=WLPT2[0].DLS;
    end
   else if (wlpt.MD<(wlpt2[1].md))and(wlpt.MD>wlpt2[0].md) then
    begin
     wlpt.inc:=wlpt2[0].INC;
     wlpt.TVD:=wlpt2[0].tvd+(wlpt.MD-wlpt2[0].md)*cos(wlpt2[1].inc);
     wlpt.ew :=wlpt2[0].ew+(wlpt.MD-wlpt2[0].md)*sin(wlpt2[1].inc);
     wlpt.CMT:='Keep';
     wlpt.DLS:=WLPT2[1].DLS;
    end
   else if (wlpt.MD<(wlpt2[2].md))and(wlpt.MD>wlpt2[1].md) then
    begin
     wlpt.inc:=wlpt2[1].INC+(wlpt.MD-wlpt2[1].md)/r2;
     wlpt.TVD:=wlpt2[1].tvd+r2*(sin(wlpt.inc)-sin(wlpt2[1].inc));
     wlpt.ew :=wlpt2[1].ew+r2*(cos(wlpt2[1].inc)-cos(wlpt.inc));
     wlpt.CMT:='Curve';
     wlpt.DLS:=WLPT2[2].DLS;
    end
   else if (wlpt.MD>=wlpt2[2].md) then
    begin
     wlpt.MD:=WLPT2[2].MD;
     wlpt.INC:=theta;
     wlpt.TVD:=wlpt2[2].tvd;
     wlpt.ew:=WLPT2[2].ew;
     WLPT.CMT:='Targer';
     wlpt.DLS:=0;
     k:=1;
    end;
   WLPT1[I].MD:=WLPT.MD;
   WLPT1[I].INC:=WLPT.INC;
   WLPT1[I].TVD:=WLPT.TVD;
   WLPT1[I].EW:=WLPT.ew;
   WLPT1[I].NS:=0;
   WLPT1[I].CMT:=WLPT.CMT;
   WLPT1[I].DLS:=WLPT.DLS;
   I:=I+1;
   if (i mod 2)=0 then
    begin
     wlpt.md:=(i/2)*ppf;
    end
   else
    wlpt.md:=trunc(i/2)*ppf+1
  end;
end;
PROCEDURE TForm02.CH2DC2(THETA1,TGTX,TGTY,THETA,DLS1,DLS2,thetaex,dmd:REAL;var wlpt1,wlpt2:abranch;var okk,ddmmdd:boolean);
VAR
 wlpt:branch;
 a,b,c,l1,r1,r2:real;
 ppf,i,k:integer;
begin
 okk:=false;
 ppf:=100;
 setlength(wlpt2,4);
 r1:=1/dls1;
 r2:=1/dls2;
 if ddmmdd then
  begin
   a:=r1-r2-r2*COS(theta)+r1*COS(theta1)-(tgtx-dmd*sin(theta));
   b:=2*(r2*SIN(theta)-r1*SIN(theta1)-(tgty-dmd*cos(theta)));
   c:=r1-r2+r2*COS(theta)-r1*COS(theta1)+(tgtx-dmd*sin(theta));
   if (b*b-4*a*c)>0 then
    begin
     if tgtx>r1 then
       wlpt2[0].INC:=2*arctan((-b-sqrt(abs(b*b-4*a*c)))/(2*a))
     else
       wlpt2[0].INC:=2*arctan((-b+sqrt(abs(b*b-4*a*c)))/(2*a));
     if wlpt2[0].INC<0 then
      begin
       wlpt2[0].INC:=pi*(trunc(abs(wlpt2[0].INC)/(pi))+1)+wlpt2[0].INC
      end;
    end
   else
     exit;
  end
 else
  begin
   wlpt2[0].INC:=thetaex;
   dmd:=(r1*(1-cos(thetaex-theta1))-r2*(1-cos(theta-thetaex))-tgty*sin(thetaex)+tgtx*cos(thetaex))/(cos(thetaex)*sin(theta)-cos(theta)*sin(thetaex));
   if dmd<0 then
     exit;
  end;
 l1:=((tgtx-dmd*sin(theta))-r1*(cos(theta1)-cos(wlpt2[0].inc))-r2*(cos(wlpt2[0].inc)-cos(theta)))/sin(wlpt2[0].inc);
 wlpt2[0].MD:=(wlpt2[0].INC-theta1)/dls1;
 wlpt2[0].TVD:=r1*(sin(wlpt2[0].INC)-sin(theta1));
 wlpt2[0].NS:=0;
 wlpt2[0].EW:=r1*(cos(theta1)-cos(wlpt2[0].inc));
 wlpt2[0].DLS:=DLS1;
 wlpt2[0].CMT:='EOC #1 3D*-S';

 wlpt2[1].INC:=wlpt2[0].INC;
 wlpt2[1].MD:=wlpt2[0].MD+l1;
 wlpt2[1].TVD:=wlpt2[0].TVD+l1*cos(wlpt2[1].inc);
 wlpt2[1].NS:=0;
 wlpt2[1].EW:=wlpt2[0].ew+l1*sin(wlpt2[1].inc);
 wlpt2[1].DLS:=0;
 wlpt2[1].CMT:='KOP #2';

 wlpt2[2].INC:=theta;
 wlpt2[2].MD:=wlpt2[1].MD+(theta-wlpt2[0].INC)/dls2;
 wlpt2[2].TVD:=wlpt2[1].TVD+r2*(sin(theta)-sin(wlpt2[0].inc));
 wlpt2[2].NS:=0;
 wlpt2[2].EW:=wlpt2[1].ew+r2*(cos(wlpt2[0].inc)-cos(theta));
 wlpt2[2].DLS:=dls2;
 wlpt2[2].CMT:='EOC #2';

 wlpt2[3].INC:=theta;
 wlpt2[3].MD:=wlpt2[2].MD+dmd;
 wlpt2[3].TVD:=wlpt2[2].TVD+dmd*cos(theta);
 wlpt2[3].NS:=0;
 wlpt2[3].EW:=wlpt2[2].ew+dmd*sin(theta);
 wlpt2[3].DLS:=0;
 wlpt2[3].CMT:='Target';
 wlpt2[0].dmd:=wlpt2[0].MD;
 wlpt2[1].dmd:=wlpt2[1].MD-wlpt2[0].MD;
 wlpt2[2].dmd:=wlpt2[2].MD-wlpt2[1].MD;
 wlpt2[3].dmd:=wlpt2[3].MD-wlpt2[2].MD;
 if (wlpt2[0].dmd>0)and(wlpt2[1].dmd>0)and(wlpt2[2].dmd>0)and(wlpt2[3].dmd>0) then
   okk:=true
 else
   exit;
 wlpt.md:=0;
 i:=0;
 k:=0;
 setlength(wlpt1,2*trunc(wlpt2[3].md/ppf+1)+2+1);
 while k=0 do
  begin
   if wlpt.MD<=(wlpt2[0].md) then
    begin
     wlpt.inc:=theta1+wlpt.md*dls1;
     wlpt.TVD:=r1*(sin(wlpt.inc)-sin(theta1));
     wlpt.ew :=r1*(cos(theta1)-cos(wlpt.inc));
     wlpt.CMT:='Curve';
     wlpt.DLS:=WLPT2[0].DLS;
    end
   else if (wlpt.MD<(wlpt2[1].md))and(wlpt.MD>wlpt2[0].md) then
    begin
     wlpt.inc:=wlpt2[0].INC;
     wlpt.TVD:=wlpt2[0].tvd+(wlpt.MD-wlpt2[0].md)*cos(wlpt2[1].inc);
     wlpt.ew :=wlpt2[0].ew+(wlpt.MD-wlpt2[0].md)*sin(wlpt2[1].inc);
     wlpt.CMT:='Keep';
     wlpt.DLS:=WLPT2[1].DLS;
    end
   else if (wlpt.MD<(wlpt2[2].md))and(wlpt.MD>wlpt2[1].md) then
    begin
     wlpt.inc:=wlpt2[1].INC+(wlpt.MD-wlpt2[1].md)*dls2;
     wlpt.TVD:=wlpt2[1].tvd+r2*(sin(wlpt.inc)-sin(wlpt2[1].inc));
     wlpt.ew :=wlpt2[1].ew+r2*(cos(wlpt2[1].inc)-cos(wlpt.inc));
     wlpt.CMT:='Curve';
     wlpt.DLS:=WLPT2[2].DLS;
    end
   else if (wlpt.MD<(wlpt2[3].md))and(wlpt.MD>wlpt2[2].md) then
    begin
     wlpt.inc:=wlpt2[3].INC;
     wlpt.TVD:=wlpt2[2].tvd+(wlpt.MD-wlpt2[2].md)*cos(wlpt2[3].inc);
     wlpt.ew :=wlpt2[2].ew+(wlpt.MD-wlpt2[2].md)*sin(wlpt2[3].inc);
     wlpt.CMT:='Keep';
     wlpt.DLS:=WLPT2[3].DLS;
    end
   else if (wlpt.MD>=wlpt2[3].md) then
    begin
     wlpt.md:=wlpt2[3].md;
     wlpt.inc:=wlpt2[3].INC;
     wlpt.TVD:=wlpt2[3].tvd;
     wlpt.ew :=wlpt2[3].ew;
     wlpt.CMT:='Target';
     wlpt.DLS:=0;
     k:=1;
    end;

   WLPT1[I].MD:=WLPT.MD;
   WLPT1[I].INC:=WLPT.INC;
   WLPT1[I].TVD:=WLPT.TVD;
   WLPT1[I].EW:=WLPT.ew;
   WLPT1[I].NS:=0;
   WLPT1[I].CMT:=WLPT.CMT;
   WLPT1[I].DLS:=WLPT.DLS;
   I:=I+1;
   if (i mod 2)=0 then
    begin
     wlpt.md:=(i/2)*ppf;
    end
   else
    wlpt.md:=trunc(i/2)*ppf+1
  end;
end;
PROCEDURE TForm02.CH3DC(INC,TVD,AZM,NS,EW,DLS,DLSPP:REAL);
begin
 //HELLO
end;

PROCEDURE TForm02.HOCTT(THETA1,TGTX,TGTY:REAL;var wlpt1,wlpt2:abranch);
VAR
 wlpt:branch;
 a,r1,dls,ex4:real;
 ppf,i,k:integer;
 cmt:string;
begin
 ppf:=100;
 setlength(wlpt2,1);
 vcttosur(0,tgtx,tgty,a,ex4);
 WLPT2[0].INC:=2*a-theta1;
 if theta1>a then
  dls:=-sqrt((2*(1-cos(theta1-WLPT2[0].INC)))/(tgty*tgty+tgtx*tgtx))
 else
  dls:=sqrt((2*(1-cos(theta1-WLPT2[0].INC)))/(tgty*tgty+tgtx*tgtx));
 if abs(dls)<0.00000001 then
  begin
   cmt:='Keep';
   wlpt2[0].DLS:=0;
  end
 else
  begin
   r1:=1/dls;
   cmt:='Curve';
   wlpt2[0].MD:=(wlpt2[0].inc-theta1)/dls;
   wlpt2[0].TVD:=r1*(sin(wlpt2[0].inc)-sin(theta1));
   wlpt2[0].NS:=0;
   wlpt2[0].ew:=r1*(cos(theta1)-cos(wlpt2[0].inc));
   wlpt2[0].DLS:=dls;
   wlpt2[0].CMT:='Target';
   wlpt2[0].dmd:=wlpt2[0].MD;
   wlpt.md:=0;
   i:=0;
   k:=0;
   setlength(wlpt1,2*trunc(wlpt2[0].md/ppf+1)+2+1);
   while k=0 do
    begin
     if wlpt.MD<=(wlpt2[0].md) then
      begin
       wlpt.inc:=theta1+wlpt.MD*dls;
       wlpt.TVD:=r1*(sin(wlpt.inc)-sin(theta1));
       wlpt.ew :=r1*(cos(theta1)-cos(wlpt.inc));
       wlpt.CMT:=cmt;
       wlpt.DLS:=WLPT2[0].DLS;
      end
     else if (wlpt.MD>=wlpt2[0].md) then
      begin
       wlpt.md:=wlpt2[0].md-0.01;
       wlpt.inc:=theta1+wlpt.MD*dls;
       wlpt.TVD:=r1*(sin(wlpt.inc)-sin(theta1));
       wlpt.ew :=r1*(cos(theta1)-cos(wlpt.inc));
       wlpt.CMT:=cmt;
       wlpt.DLS:=WLPT2[0].DLS;
       k:=1;
      end;
     WLPT2[1].MD:=WLPT.MD;
     WLPT2[1].INC:=WLPT.INC;
     WLPT2[1].TVD:=WLPT.TVD;
     WLPT2[1].EW:=WLPT.ew;
     WLPT2[1].NS:=0;
     WLPT2[1].CMT:=WLPT.CMT;
     WLPT2[1].DLS:=WLPT.DLS;
     if (k=1) then
      begin
       wlpt.md:=wlpt2[0].md;
       wlpt.inc:=wlpt2[0].INC;
       wlpt.TVD:=wlpt2[0].tvd;
       wlpt.ew :=wlpt2[0].ew;
       wlpt.CMT:='Target';
       wlpt.DLS:=0;
       k:=1;
      end;
     WLPT1[I].MD:=WLPT.MD;
     WLPT1[I].INC:=WLPT.INC;
     WLPT1[I].TVD:=WLPT.TVD;
     WLPT1[I].EW:=WLPT.ew;
     WLPT1[I].NS:=0;
     WLPT1[I].CMT:=WLPT.CMT;
     WLPT1[I].DLS:=WLPT.DLS;
     i:=i+1;
     if (i mod 2)=0 then
      begin
       wlpt.md:=(i/2)*ppf;
      end
     else
      wlpt.md:=trunc(i/2)*ppf+1
    end;
  end;
end;
PROCEDURE TForm02.c3(THETA1,theta2,dls:REAL;var wlpt1,wlpt2:abranch);
VAR
 wlpt:branch;
 r1:real;
 ppf,i,k:integer;
begin
 ppf:=100;
 setlength(wlpt2,2);
 r1:=1/dls;
 wlpt2[0].inc:=theta2;
 wlpt2[0].MD:=(wlpt2[0].inc-theta1)/dls;
 wlpt2[0].TVD:=r1*(sin(wlpt2[0].inc)-sin(theta1));
 wlpt2[0].NS:=0;
 wlpt2[0].ew:=r1*(cos(theta1)-cos(wlpt2[0].inc));
 wlpt2[0].DLS:=dls;
 wlpt2[0].CMT:='EOC';
 wlpt2[0].dmd:=wlpt2[0].MD;

 wlpt.md:=0;
 i:=0;
 k:=0;
 setlength(wlpt1,2*trunc(wlpt2[0].md/ppf+1)+2+1);
 while k=0 do
  begin
   if wlpt.MD<=(wlpt2[0].md) then
    begin
     wlpt.inc:=theta1+wlpt.MD*dls;
     wlpt.TVD:=r1*(sin(wlpt.inc)-sin(theta1));
     wlpt.ew :=r1*(cos(theta1)-cos(wlpt.inc));
     wlpt.CMT:='Curve';
     wlpt.DLS:=WLPT2[0].DLS;
    end
   else if (wlpt.MD>=wlpt2[0].md) then
    begin
     wlpt.md:=wlpt2[0].md-0.1;
     wlpt.inc:=theta1+wlpt.MD*dls;
     wlpt.TVD:=r1*(sin(wlpt.inc)-sin(theta1));
     wlpt.ew :=r1*(cos(theta1)-cos(wlpt.inc));
     wlpt.CMT:='EOC';
     wlpt.DLS:=WLPT2[0].DLS;
     k:=1;
    end;
   WLPT2[1].MD:=WLPT.MD;
   WLPT2[1].INC:=WLPT.INC;
   WLPT2[1].TVD:=WLPT.TVD;
   WLPT2[1].EW:=WLPT.ew;
   WLPT2[1].NS:=0;
   WLPT2[1].CMT:=WLPT.CMT;
   WLPT2[1].DLS:=WLPT.DLS;
   if (k=1) then
    begin
     wlpt.md:=wlpt2[0].md;
     wlpt.inc:=wlpt2[0].INC;
     wlpt.TVD:=wlpt2[0].tvd;
     wlpt.ew :=wlpt2[0].ew;
     wlpt.CMT:='Target';
     wlpt.DLS:=0;
     k:=1;
    end;
   WLPT1[I].MD:=WLPT.MD;
   WLPT1[I].INC:=WLPT.INC;
   WLPT1[I].TVD:=WLPT.TVD;
   WLPT1[I].EW:=WLPT.ew;
   WLPT1[I].NS:=0;
   WLPT1[I].CMT:=WLPT.CMT;
   WLPT1[I].DLS:=WLPT.DLS;
   i:=i+1;
   if (i mod 2)=0 then
    begin
     wlpt.md:=(i/2)*ppf;
    end
   else
    wlpt.md:=trunc(i/2)*ppf+1
  end;
end;
procedure tForm02.Hold(theta1,azm,MD:real;var wlpt1:abranch);
VAR
 wlpt:branch;
 ppf,i,k:integer;
begin
 ppf:=100;
 wlpt.md:=0;
 i:=0;
 k:=0;
 setlength(wlpt1,2*trunc(MD/ppf+1)+2+1);
 while k=0 do
  begin
   if wlpt.MD<=md then
    begin
     wlpt.inc:=theta1;
     wlpt.ns :=wlpt.MD*sin(theta1)*cos(azm);
     wlpt.ew :=wlpt.MD*sin(theta1)*sin(azm);
     wlpt.TVD:=wlpt.MD*cos(theta1);
     wlpt.CMT:='Keep';
     wlpt.DLS:=0;
    end
   else if (wlpt.MD>=md) then
    begin
     wlpt.MD:=md;
     wlpt.inc:=theta1;
     wlpt.ns :=wlpt.MD*sin(theta1)*cos(azm);
     wlpt.ew :=wlpt.MD*sin(theta1)*sin(azm);
     wlpt.TVD:=wlpt.MD*cos(theta1);
     wlpt.CMT:='Target';
     wlpt.DLS:=0;
     k:=1;
    end;
   WLPT1[I].MD:=WLPT.MD;
   WLPT1[I].INC:=WLPT.INC;
   WLPT1[I].azm:=azm;
   WLPT1[I].TVD:=WLPT.TVD;
   WLPT1[I].EW:=WLPT.ew;
   WLPT1[I].NS:=WLPT.ns;
   WLPT1[I].CMT:=WLPT.CMT;
   WLPT1[I].DLS:=WLPT.DLS;
   i:=i+1;
   if (i mod 2)=0 then
    begin
     wlpt.md:=(i/2)*ppf;
    end
   else
    wlpt.md:=trunc(i/2)*ppf+1
  end;
end;
procedure TForm02.Hold1Click(Sender: TObject);
begin
 form05.showmodal;
end;

procedure TForm02.Calculate1Click(Sender: TObject);
begin
 Button3.click;
end;

PROCEDURE TForm02.CC2D(theta1,theta2,theta3,DLS1,DLS2:REAL;var wlpt1,wlpt2:abranch;var okk:boolean);
var
 r1,r2:real;
 tgtx,tgty:real;
 wlpt:branch;
 i,k,ppf:integer;
begin
 okk:=false;
 setlength(wlpt2,2);
 ppf:=100;
 r1:=1/dls1;
 r2:=1/dls2;
 tgtx:=r1*(cos(theta1)-cos(theta2))+r2*(cos(theta2)-cos(theta3));
 tgty:=r1*(sin(theta2)-sin(theta1))+r2*(sin(theta3)-sin(theta2));
 wlpt2[0].MD:=(theta2-theta1)/dls1;
 wlpt2[0].INC:=theta2;
 wlpt2[0].azm:=pi/2;
 wlpt2[0].TVD:=r1*(sin(wlpt2[0].inc)-SIN(THETA1));
 wlpt2[0].EW:=r1*(COS(THETA1)-cos(wlpt2[0].inc));
 wlpt2[0].CMT:='EOC #1 (Curve Curve 2D)';
 wlpt2[0].NS:=0;
 wlpt2[0].DLS:=DLS1;

 wlpt2[1].MD:=wlpt2[0].MD+(theta3-theta2)/dls2;
 wlpt2[1].INC:=theta3;
 wlpt2[1].TVD:=tgty;
 wlpt2[1].EW:=tgtx;
 wlpt2[1].CMT:='EOC #2';
 wlpt2[1].NS:=0;
 wlpt2[1].DLS:=DLS2;
 wlpt2[0].dmd:=wlpt2[0].MD;
 wlpt2[1].dmd:=wlpt2[1].MD-wlpt2[0].MD;
 if (wlpt2[0].MD>=0)and(wlpt2[1].MD>=wlpt2[0].MD) then
  begin
   okk:=true;
   setlength(wlpt1,2*trunc(wlpt2[1].md/ppf+1)+2+1);
   wlpt.md:=0;
   i:=0;
   k:=0;
   while k=0 do
    begin
     if wlpt.MD<(wlpt2[0].md) then
      begin
       wlpt.inc:=theta1+(wlpt.md)*dls1;
       wlpt.TVD:=r1*(sin(wlpt.inc)-sin(theta1));
       wlpt.EW :=r1*(cos(theta1)-cos(wlpt.inc));
       wlpt.CMT:='CURVE #1';
       wlpt.DLS:=WLPT2[0].DLS;
      end
     else if (wlpt.MD>=wlpt2[0].md)and(wlpt.MD<wlpt2[1].md) then
      begin
       wlpt.inc:=theta2+(wlpt.md-wlpt2[0].md)*dls2;
       wlpt.TVD:=wlpt2[0].tvd+r2*(sin(wlpt.inc)-sin(theta2));
       wlpt.EW :=wlpt2[0].ew+r2*(cos(theta2)-cos(wlpt.inc));
       wlpt.CMT:='CURVE #2';
       wlpt.DLS:=WLPT2[1].DLS;
      end
     else if (wlpt.MD>=wlpt2[1].md)then
      begin
       wlpt.MD:=WLPT2[1].MD;
       wlpt.INC:=theta3;
       wlpt.TVD:=wlpt2[1].tvd;
       wlpt.EW:=WLPT2[1].EW;
       WLPT.CMT:='Targer';
       wlpt.DLS:=WLPT2[1].DLS;
       k:=1;
      end;
     WLPT1[I].MD:=WLPT.MD;
     WLPT1[I].INC:=WLPT.INC;
     WLPT1[I].TVD:=WLPT.TVD;
     WLPT1[I].EW:=WLPT.EW;
     WLPT1[I].NS:=0;
     WLPT1[I].CMT:=WLPT.CMT;
     WLPT1[I].DLS:=WLPT.DLS;
     I:=I+1;
     if (i mod 2)=0 then
      begin
       wlpt.md:=(i/2)*ppf;
      end
     else
      wlpt.md:=trunc(i/2)*ppf+1
    end;
  end;

end;
procedure tForm02.sursta(theta1,theta,md:real;var wlpt1,wlpt2:abranch);
var
 wlpt:branch;
 r1,ppf,dls:real;
 i:integer;
 k: Integer;
begin
 setlength(wlpt2,2);
 ppf:=100;
 r1:=md/(theta-theta1);
 dls:=(1/r1);
 wlpt2[0].MD:=md;
 wlpt2[0].INC:=(wlpt2[0].MD)*DLS+THETA1;
 wlpt2[0].TVD:=r1*(sin(wlpt2[0].inc)-SIN(THETA1));
 wlpt2[0].EW:=r1*(COS(THETA1)-cos(wlpt2[0].inc));
 wlpt2[0].CMT:='Survey Station';
 wlpt2[0].NS:=0;
 wlpt2[0].DLS:=DLS;
 setlength(wlpt1,2*trunc(wlpt2[0].md/ppf+1)+2+1);
 wlpt2[0].dmd:=wlpt2[0].MD;
 wlpt.md:=0;
 i:=0;
 k:=0;
 while k=0 do
  begin
   if wlpt.MD<=(wlpt2[0].md) then
    begin
     wlpt.inc:=theta1+(wlpt.md)*dls;
     wlpt.TVD:=r1*(sin(wlpt.inc)-sin(theta1));
     wlpt.EW :=r1*(cos(theta1)-cos(wlpt.inc));
     wlpt.CMT:='CURVE';
     wlpt.DLS:=WLPT2[0].DLS;
    end
   else if (wlpt.MD>=wlpt2[0].md) then
    begin
     wlpt.MD:=WLPT2[0].MD;
     wlpt.INC:=theta;
     wlpt.TVD:=wlpt2[0].tvd;
     wlpt.EW:=WLPT2[0].EW;
     WLPT.CMT:='Targer';
     wlpt.DLS:=WLPT2[0].DLS;
     k:=1;
    end;
   WLPT1[I].MD:=WLPT.MD;
   WLPT1[I].INC:=WLPT.INC;
   WLPT1[I].TVD:=WLPT.TVD;
   WLPT1[I].EW:=WLPT.EW;
   WLPT1[I].NS:=0;
   WLPT1[I].CMT:=WLPT.CMT;
   WLPT1[I].DLS:=WLPT.DLS;
   I:=I+1;
   if (i mod 2)=0 then
    begin
     wlpt.md:=(i/2)*ppf;
    end
   else
    wlpt.md:=trunc(i/2)*ppf+1
  end;
end;

procedure TForm02.N3DView1Click(Sender: TObject);
begin
Button1.click;
end;

procedure TForm02.NEW1Click(Sender: TObject);
var
 locala:integer;
begin
 locala:=MessageDlg('Are you sure?',mtConfirmation,mbYesNo,1);
 if locala=6 then
  begin
   locala:=MessageDlg('Do You Want To Save?',mtConfirmation,mbYesNo,1);
   if locala=6 then
    begin
     SAVEWD;
    end;
   pagerefresh;
  end;
end;
procedure tForm02.pagerefresh;
var
 ii,jj:integer;
begin
// dbgrid1.Visible:=false;
 for ii := 0 to 50-1 do
   for jj := 0 to 16-1 do
     romat[ii,jj]:=false;
 for ii := 0 to 50-1 do
   for jj := 0 to 16-1 do
     rocal[ii,jj]:=false;
 rosel[0]:=0;
 rosel[1]:=0;
 ADOTABLE2.Active:=false;
 ADOTABLE2.TABLEName:='TW001';
 form01.ADOCommand1.CommandText:='DELETE * FROM TW001';
 form01.ADOCommand1.Execute;
 ADOTABLE2.Active:=true;
 rowcolor(0,0);
 with ADOTABLE2 do
  begin
   open;
   insert;
   FieldByName('COMMENT').AsString:='START STATION';
   FieldByName('MD').AsFloat:=0;
   FieldByName('INCL').AsFloat:=0;
   FieldByName('AZM').AsFloat:=0;
   FieldByName('TVD').AsFloat:=0;
   FieldByName('VSEC').AsFloat:=0;
   FieldByName('NS').AsFloat:=0;
   FieldByName('EW').AsFloat:=0;
   FieldByName('DLS').AsFloat:=0;
   FieldByName('ordr').AsFloat:=0;
   FieldByName('type').AsFloat:=0;
   post;
  end;
 for ii := 0 to 50 do
  begin
   with ADOTABLE2 do
    begin
     open;
     insert;
     FieldByName('COMMENT').AsString:='';
     FieldByName('type').Asinteger:=-1;
     FieldByName('ordr').Asinteger:=-1;
     post;
    end;
  end;
 ADOTABLE2.First;

end;
function tForm02.RefToCell(ARow, ACol: Integer): string;
begin
  Result := Chr(Ord('A') + ACol - 1) + IntToStr(ARow);
end;

procedure TForm02.Save1Click(Sender: TObject);
begin
 SAVEWD;
end;


procedure TForm02.STANDARDPROFILES1Click(Sender: TObject);
begin
 FORM04.SHOWMODAL;
end;

function tForm02.dec(dc:integer;input:real):real;
var
ii,jj:integer;
 begin
  jj:=1;
  for ii := 0 to dc-1 do
   jj:=jj*10;
  dec:=round(jj*input)/jj;
 end;

procedure tForm02.cellfill(wlpt:abranch;i,j:integer);
var
 k:integer;
begin
 if (i=1)then
  begin
   k:=0;
   while (wlpt[k].typ<>-1)do
    begin
     with ADOTABLE1 do
      begin
       if wlpt[k].AZM<0 then
        wlpt[k].AZM:=wlpt[k].AZM+2*pi;
       open;
       insert;
       FieldByName('COMMENT').AsString:=wlpt[k].CMT;
       FieldByName('MD').AsFloat:=dec(3,wlpt[k].md);
       FieldByName('INCL').AsFloat:=dec(3,wlpt[k].INC*180/pi);
       FieldByName('AZM').AsFloat:=dec(3,wlpt[k].AZM*180/pi);
       FieldByName('TVD').AsFloat:=dec(3,wlpt[k].TVD);
       FieldByName('VSEC').AsFloat:=dec(3,wlpt[k].VSEC);
       FieldByName('NS').AsFloat:=dec(3,wlpt[k].NS);
       FieldByName('EW').AsFloat:=dec(3,wlpt[k].EW);
       FieldByName('DLS').AsFloat:=dec(3,wlpt[k].DLS*18000/pi);
       FieldByName('TF').AsFloat:=dec(3,wlpt[k].tf*180/pi);
       FieldByName('BR').AsFloat:=dec(3,wlpt[k].br*18000/pi);
       FieldByName('TR').AsFloat:=dec(3,wlpt[k].tr*18000/pi);
       FieldByName('DMD').AsFloat:=dec(3,wlpt[k].Dmd);
       post;
       Next;
      end;
     k:=k+1;
    end;
  end
 else
  begin
   k:=0;
   ADOTABLE2.First;
   while (-1<>ADOTABLE2.FieldByName('ordr').AsInteger)do
    begin
     if(j=ADOTABLE2.FieldByName('ordr').AsInteger)then
      begin
       with ADOTABLE2 do
        begin
         if wlpt[k].AZM<0 then
          wlpt[k].AZM:=wlpt[k].AZM+2*pi;
         open;
         EDIT;
         FieldByName('COMMENT').AsString:=wlpt[k].CMT;
         FieldByName('MD').AsFloat:=dec(3,wlpt[k].md);
         FieldByName('INCL').AsFloat:=dec(3,wlpt[k].INC*180/pi);
         FieldByName('AZM').AsFloat:=dec(3,wlpt[k].AZM*180/pi);
         FieldByName('TVD').AsFloat:=dec(3,wlpt[k].TVD);
         FieldByName('VSEC').AsFloat:=dec(3,wlpt[k].VSEC);
         FieldByName('NS').AsFloat:=dec(3,wlpt[k].NS);
         FieldByName('EW').AsFloat:=dec(3,wlpt[k].EW);
         FieldByName('DLS').AsFloat:=dec(3,wlpt[k].DLS*18000/pi);
         FieldByName('TF').AsFloat:=dec(3,wlpt[k].tf*180/pi);
         FieldByName('BR').AsFloat:=dec(3,wlpt[k].br*18000/pi);
         FieldByName('TR').AsFloat:=dec(3,wlpt[k].tr*18000/pi);
         FieldByName('DMD').AsFloat:=dec(3,wlpt[k].Dmd);
         post;
        end;
       k:=k+1;
      end;
     ADOTABLE2.Next;
    end;
  end;
end;


procedure TForm02.Button1Click(Sender: TObject);
VAR
 TN:STRING;
begin
 FORM10.ADOTable1.Active:=FALSE;
 FORM10.ADOTable1.TableName:='TS001';
 FORM10.ADOTable1.Active:=TRUE;
 FORM10.ShowMODAL;
end;

procedure TForm02.Button2Click(Sender: TObject);
VAR
 CC,FF,WW,PE,tn,CALC:STRING;
 II:BOOLEAN;
begin
 form01.FNDTABLE(tn);
 form01.ADOTABLE1.Active:=FALSE;
 form01.ADOTable1.TABLEName:=tn;
 form01.ADOTABLE1.Active:=TRUE;
 form01.ADOCommand1.CommandText :='delete * from '+tn;
 form01.ADOCommand1.Execute;
 form01.ADOTable1.Open;
 form01.ADOTable1.first;
 ADOTABLE2.first;
 cc:=form01.ADOTABLE1.FieldByName('COUNTRY').AsString;
 ff:=form01.ADOTABLE1.FieldByName('FIELD').AsString;
 ww:=form01.ADOTABLE1.FieldByName('WELL').AsString;
 CALC:=form01.ADOTABLE1.FieldByName('CALC').AsString;
 form01.ADOTABLE1.Active:=false;
 form01.DBGrid3.Visible:=FALSE;
 DBGrid1.Visible:=FALSE;
 form01.ADOTABLE1.Open;
 form01.ADOTABLE1.first;
 II:=TRUE;
 ADOTABLE2.FIRST;
 while NOT(ADOTABLE2.Eof) do
  BEGIN
   form01.ADOTABLE1.INSERT;
   form01.ADOTABLE1.FieldByName('COUNTRY').ASSTRING:=CC;
   form01.ADOTABLE1.FieldByName('FIELD').AsString:=FF;
   form01.ADOTABLE1.FieldByName('WELL').AsString:=WW;
   form01.ADOTABLE1.FieldByName('CALC').AsString:=CALC;
   form01.ADOTABLE1.FieldByName('COMMENT').AsString:=ADOTABLE2.FieldByName('COMMENT').AsString;
   form01.ADOTABLE1.FieldByName('MD').AsFloat:=ADOTABLE2.FieldByName('MD').AsFloat;
   form01.ADOTABLE1.FieldByName('INCL').AsFloat:=ADOTABLE2.FieldByName('INCL').AsFloat;
   form01.ADOTABLE1.FieldByName('AZM').AsFloat:=ADOTABLE2.FieldByName('AZM').AsFloat;
   form01.ADOTABLE1.FieldByName('TVD').AsFloat:=ADOTABLE2.FieldByName('TVD').AsFloat;
   form01.ADOTABLE1.FieldByName('VSEC').AsFloat:=ADOTABLE2.FieldByName('VSEC').AsFloat;
   form01.ADOTABLE1.FieldByName('NS').AsFloat:=ADOTABLE2.FieldByName('NS').AsFloat;
   form01.ADOTABLE1.FieldByName('EW').AsFloat:=ADOTABLE2.FieldByName('EW').AsFloat;
   form01.ADOTABLE1.FieldByName('DLS').AsFloat:=ADOTABLE2.FieldByName('DLS').AsFloat;
   form01.ADOTABLE1.FieldByName('TF').AsFloat:=ADOTABLE2.FieldByName('TF').AsFloat;
   form01.ADOTABLE1.FieldByName('TR').AsFloat:=ADOTABLE2.FieldByName('TR').AsFloat;
   form01.ADOTABLE1.FieldByName('BR').AsFloat:=ADOTABLE2.FieldByName('BR').AsFloat;
   form01.ADOTABLE1.FieldByName('DMD').AsFloat:=ADOTABLE2.FieldByName('DMD').AsFloat;
   form01.ADOTABLE1.FieldByName('ORDR').AsFloat:=ADOTABLE2.FieldByName('ORDR').AsFloat;
   form01.ADOTABLE1.FieldByName('TYPE').AsFloat:=ADOTABLE2.FieldByName('TYPE').AsFloat;
   form01.ADOTABLE1.Post;
   form01.ADOTABLE1.Next;
   ADOTABLE2.Next;
  END;
 form01.DBGrid3.Visible:=TRUE;
 DBGrid1.Visible:=TRUE;

end;


procedure TForm02.Button3Click(Sender: TObject);
var
 a1,a2,a3,a4,a5,a6,a7,a8,a10,a11:point;
 i,ii,jj,kk,ll,m,nn,qq,qqq,iii,jjj,kkk,pp: Integer;
 wlptp,wlptp2,wlptpp,wlptpt,wlptf:branch;  {input from chart to program}
 wlpt:array [0..3]of branch;   {input from chart to program}
 wlpt2:abranch;  {output from program to chart}
 wlpt3:abranch;
 wlpt1:array [1..25,0..300] of branch;  {output from program to chart}
 wlpta1:abranch;
 wlpta2:abranch;
 rocal:array [0..1]of integer;
 theta,md,a,aa,b,bb,c,cc,r,rinc,ppf,ex1,ex2,ex3,ex4:real;
 v:array[0..1] of point;
 saveit:string;
 OKK,ddmmdd:BOOLEAN;

label
   GotoLabel1;
begin
 CLRSHW:=true;
 form07.RadioButton1.Enabled:=TRUE;
 form07.RadioButton2.Enabled:=TRUE;
 for ii := 0 to listbox1.Count-1 do
  begin
   saveit:=copy(ListBox1.Items[ii],length(ListBox1.Items[ii])-7,8);
   if saveit=' (Saved)' then
    begin
     ListBox1.Items[ii]:=copy(ListBox1.Items[ii],1,length(ListBox1.Items[ii])-8);
    end;
  end;
 for ii := 0 to DBGrid2.Columns.Count-1 do
  DBGrid2.Columns[ii].ReadOnly:=false;
 ppf:=100;
 a10.ns:=0;            a10.ew:=0;           a10.tvd:=0;
 DBGrid1.Visible:=false;
 DBGrid2.Visible:=false;
 ADOTable1.Active:=FALSE;
 ADOTable1.TableName:='TS001';
 form01.ADOCommand1.CommandText:='delete * from TS001';
 form01.ADOCommand1.Execute;

 setlength(wlpt2,4);
 ADOTABLE2.First;
 wlptpp.NS:=ADOTABLE2.FieldByName('NS').asfloat;
 wlptpp.ew:=ADOTABLE2.FieldByName('EW').asfloat;
 for kk := 1 to 25 do
  for ii:=0 to 300 do
   wlpt1[kk,ii].typ:=-1;
 ll:=0;
 while ADOTABLE2.FieldByName('ordr').asinteger<>-1 do
  begin
   ll:=ADOTABLE2.FieldByName('ordr').asinteger;
   wlptpt.ns:=ADOTABLE2.FieldByName('NS').asfloat;
   wlptpt.ew:=ADOTABLE2.FieldByName('EW').asfloat;
   ADOTABLE2.Next;
  end;
 v[0].ns:=wlptpt.NS-wlptpp.NS;
 v[0].ew:=wlptpt.ew-wlptpp.ew;
 for kk := 1 to ll do
  begin
   theta:=-999;
   i:=0;
   jj:=0;
   ADOTABLE2.First;
   for ii := 0 to 50 do
    begin
     if (kk-1=ADOTABLE2.FieldByName('ordr').asinteger)then
      begin
       wlptp.md:=ADOTABLE2.FieldByName('md').AsFloat;
       wlptp.inc:=ADOTABLE2.FieldByName('incl').AsFloat*pi/180;
       wlptp.azm:=ADOTABLE2.FieldByName('azm').AsFloat*pi/180;
       wlptp.TVD:=ADOTABLE2.FieldByName('tvd').AsFloat;
       wlptp.vsec:=ADOTABLE2.FieldByName('vsec').AsFloat;
       wlptp.NS:=ADOTABLE2.FieldByName('ns').AsFloat;
       wlptp.EW:=ADOTABLE2.FieldByName('ew').AsFloat;
       wlptp.DLS:=ADOTABLE2.FieldByName('dls').AsFloat*pi/18000;
       wlptp.tf:=ADOTABLE2.FieldByName('TF').AsFloat*pi/180;
       wlptp.tr:=ADOTABLE2.FieldByName('TR').AsFloat*pi/18000;
       wlptp.br:=ADOTABLE2.FieldByName('BR').AsFloat*pi/18000;
       wlptp.dmd:=ADOTABLE2.FieldByName('DMD').AsFloat;
       wlptp.order:=ADOTABLE2.FieldByName('Ordr').Asinteger;
       wlptp.typ:=ADOTABLE2.FieldByName('Type').Asinteger;
      end
     else if(kk=ADOTABLE2.FieldByName('ordr').asinteger)then
      begin
       wlpt[jj].md:=ADOTABLE2.FieldByName('md').AsFloat;
       wlpt[jj].inc:=ADOTABLE2.FieldByName('incl').AsFloat*pi/180;
       wlpt[jj].azm:=ADOTABLE2.FieldByName('azm').AsFloat*pi/180;
       wlpt[jj].TVD:=ADOTABLE2.FieldByName('tvd').AsFloat;
       wlpt[jj].vsec:=ADOTABLE2.FieldByName('vsec').AsFloat;
       wlpt[jj].NS:=ADOTABLE2.FieldByName('ns').AsFloat;
       wlpt[jj].EW:=ADOTABLE2.FieldByName('ew').AsFloat;
       wlpt[jj].DLS:=ADOTABLE2.FieldByName('dls').AsFloat*pi/18000;
       wlpt[jj].tf:=ADOTABLE2.FieldByName('TF').AsFloat*pi/180;
       wlpt[jj].tr:=ADOTABLE2.FieldByName('TR').AsFloat*pi/18000;
       wlpt[jj].br:=ADOTABLE2.FieldByName('BR').AsFloat*pi/18000;
       wlpt[jj].dmd:=ADOTABLE2.FieldByName('DMD').AsFloat;
       wlpt[jj].order:=ADOTABLE2.FieldByName('Ordr').Asinteger;
       wlpt[jj].typ:=ADOTABLE2.FieldByName('Type').Asinteger;
       i:=jj;
       jj:=jj+1;
       rocal[1]:=ADOTABLE2.FieldByName('type').asinteger;
      end
     else if(kk+1=ADOTABLE2.FieldByName('ordr').asinteger)then
      begin
       wlptf.md:=ADOTABLE2.FieldByName('md').AsFloat;
       wlptf.inc:=ADOTABLE2.FieldByName('incl').AsFloat*pi/180;
       wlptf.azm:=ADOTABLE2.FieldByName('azm').AsFloat*pi/180;
       wlptf.TVD:=ADOTABLE2.FieldByName('tvd').AsFloat;
       wlptf.vsec:=ADOTABLE2.FieldByName('vsec').AsFloat;
       wlptf.NS:=ADOTABLE2.FieldByName('ns').AsFloat;
       wlptf.EW:=ADOTABLE2.FieldByName('ew').AsFloat;
       wlptf.DLS:=ADOTABLE2.FieldByName('dls').AsFloat*pi/18000;
       wlptf.tf:=ADOTABLE2.FieldByName('TF').AsFloat*pi/180;
       wlptf.tr:=ADOTABLE2.FieldByName('TR').AsFloat*pi/18000;
       wlptf.br:=ADOTABLE2.FieldByName('BR').AsFloat*pi/18000;
       wlptf.dmd:=ADOTABLE2.FieldByName('DMD').AsFloat;
       wlptf.order:=ADOTABLE2.FieldByName('Ordr').Asinteger;
       wlptf.typ:=ADOTABLE2.FieldByName('Type').Asinteger;
       jj:=jj+1;
      end;
     if ((wlpt[i].md-wlptp.MD)-10*trunc((wlpt[i].md-wlptp.MD)/10)=1) then
      wlpt[i].MD:=wlpt[i].md+0.001;
     ADOTABLE2.Next;
    end;
   DBGrid2.Visible:=true;
   if kk=ll then
    wlptf.typ:=-1
   else
    wlptf.typ:=1;
   if (rocal[1]=1)or(rocal[1]=11) then
    begin
     A1.ns:=wlptp.NS;      A1.EW:=wlptp.EW;     A1.TVD:=wlptp.TVD;
     surtovct(wlptp.INC,wlptp.AZM,a2.ns,a2.ew,a2.tvd);
     A3.ns:=wlpt[1].NS-a1.ns;    A3.EW:=wlpt[1].EW-a1.ew;   A3.TVD:=wlpt[1].TVD-a1.tvd;
     a4.ns:=a1.ns;         a4.ew:=a1.ew;        a4.tvd:=a1.tvd;
     a5.ns:=a2.ns;         a5.ew:=a2.ew;        a5.tvd:=a2.tvd;
     a6.ns:=a3.ns+a1.ns;         a6.ew:=a3.ew+a1.ew;        a6.tvd:=a3.tvd+a1.tvd;
     if (rocal[1]=11) then
      incfind(a2,a3,wlpt[1].AZM,wlpt[1].inc)
     else
      begin
       qqq:=0;
       for qq := 1 to 2 do
        begin
         a4.ns:=a1.ns;         a4.ew:=a1.ew;        a4.tvd:=a1.tvd;
         a5.ns:=a2.ns;         a5.ew:=a2.ew;        a5.tvd:=a2.tvd;
         a6.ns:=a3.ns+a1.ns;         a6.ew:=a3.ew+a1.ew;        a6.tvd:=a3.tvd+a1.tvd;
         azmfind(a1,a2,a3,wlpt[1].inc,qq,wlpt[1].azm);
         surtovct(wlpt[1].INC,wlpt[1].AZM,a7.ns,a7.ew,a7.tvd);
         theta:=-999;
         plane(A10,A2,A3,A7,theta);
         vcttosur(a7.ns,a7.ew,a7.tvd,wlpt2[1].inc,wlpt2[1].azm);
         wlpt2[1].inc:=power(-1,round((wlpt2[1].azm/pi-1/2)))*wlpt2[1].inc;
         wlpt2[1].azm:=pi/2;
         plane(A1,A2,A3,A4,theta);
         plane(A10,A2,A3,A5,theta);
         plane(A1,A2,A3,A6,theta);
         vcttosur(a5.ns,a5.ew,a5.tvd,wlptp2.inc,wlptp2.azm);
         wlptp2.inc:=power(-1,round((wlptp2.azm/pi-1/2)))*wlptp2.inc;
         wlptp2.azm:=pi/2;
         HC3DTFT(wlptp2.INC,(a6.ew-a4.ew),(a6.tvd-a4.tvd),wlpt2[1].INC,wlpta1,wlpta2,OKK);
         if abs(wlptp2.INC-wlpt2[1].INC)>=(pi) then
          okk:=false;
         if okk then
          qqq:=qqq+1;
         if (okk)and(qq=1) then
          form07.RadioButton1.Enabled:=true
         else if (qq=1)and(not okk) then
          form07.RadioButton1.Enabled:=false;
         if (okk)and(qq=2) then
          form07.RadioButton2.Enabled:=true
         else if (qq=2)and(not okk) then
          form07.RadioButton2.Enabled:=false;
        end;
       if qqq=0 then
        begin
         SHOWMESSAGE('THIS OPERATION CANNOT BE DONE');
         EXIT;
        end;
       if qqq=1 then
        begin
         if form07.RadioButton1.Enabled then
          wlpt[1].AZM:=strtofloat(form07.RadioButton1.Caption)*pi/180
         else
          wlpt[1].AZM:=strtofloat(form07.RadioButton2.Caption)*pi/180;
        end;
       if qqq=2 then
        begin
         form07.ShowModal;
         if form07.RadioButton1.checked then
          wlpt[1].AZM:=strtofloat(form07.RadioButton1.Caption)*pi/180
         else
          wlpt[1].AZM:=strtofloat(form07.RadioButton2.Caption)*pi/180;
        end;
      end;
     theta:=-999;
     a4.ns:=a1.ns;         a4.ew:=a1.ew;        a4.tvd:=a1.tvd;
     a5.ns:=a2.ns;         a5.ew:=a2.ew;        a5.tvd:=a2.tvd;
     a6.ns:=a3.ns+a1.ns;         a6.ew:=a3.ew+a1.ew;        a6.tvd:=a3.tvd+a1.tvd;
     surtovct(wlpt[1].INC,wlpt[1].AZM,a7.ns,a7.ew,a7.tvd);
     theta:=-999;
     plane(A10,A2,A3,A7,theta);
     vcttosur(a7.ns,a7.ew,a7.tvd,wlpt2[1].inc,wlpt2[1].azm);
     wlpt2[1].inc:=power(-1,round((wlpt2[1].azm/pi-1/2)))*wlpt2[1].inc;
     wlpt2[1].azm:=pi/2;
     plane(A1,A2,A3,A4,theta);
     plane(A10,A2,A3,A5,theta);
     plane(A1,A2,A3,A6,theta);
     vcttosur(a5.ns,a5.ew,a5.tvd,wlptp2.inc,wlptp2.azm);
     wlptp2.inc:=power(-1,round((wlptp2.azm/pi-1/2)))*wlptp2.inc;
     wlptp2.azm:=pi/2;
     HC3DTFT(wlptp2.INC,(a6.ew-a4.ew),(a6.tvd-a4.tvd),wlpt2[1].INC,wlpta1,wlpta2,OKK);
     if OKK=FALSE then
      BEGIN
       SHOWMESSAGE('THIS OPERATION CANNOT BE DONE');
       EXIT;
      END;
     {a4 start point}
     a5.ns:=wlpta2[0].ns+a4.ns;    a5.ew:=wlpta2[0].ew+a4.ew;   a5.tvd:=wlpta2[0].tvd+a4.tvd;
     a6.ns:=wlpta2[1].ns+a4.ns;    a6.ew:=wlpta2[1].ew+a4.ew;   a6.tvd:=wlpta2[1].tvd+a4.tvd;
     revplane(A1,A2,A3,theta,A5);
     revplane(A1,A2,A3,theta,A6);
     vcttosur(A5.NS-a1.ns,A5.EW-a1.ew,A5.TVD-a1.tvd,wlpt2[0].inc,wlpt2[0].azm);
     wlpt2[1].inc:=wlpt[1].inc;     wlpt2[1].azm:=wlpt[1].azm;

     wlpt2[0].ns:=a5.ns;   wlpt2[0].ew:=a5.ew;  wlpt2[0].tvd:=a5.tvd;
     wlpt2[1].ns:=a6.ns;   wlpt2[1].ew:=a6.ew;  wlpt2[1].tvd:=a6.tvd;
     wlpt2[0].MD:=wlpta2[0].MD+wlptp.MD;
     wlpt2[0].dls:=abs(wlpta2[0].dls);
     wlpt2[0].cmt:=wlpta2[0].cmt;
     wlpt2[0].dmd:=wlpta2[0].dmd;
     wlpt2[0].tr:=(wlpt2[0].azm-wlptp.azm)/wlpt2[0].dmd;
     wlpt2[0].br:=(wlpt2[0].inc-wlptp.inc)/wlpt2[0].dmd;

     wlpt2[1].MD:=wlpta2[1].MD+wlptp.MD;
     wlpt2[1].dls:=abs(wlpta2[1].dls);
     wlpt2[1].cmt:=wlpta2[1].cmt;
     wlpt2[1].dmd:=wlpta2[1].dmd;
     wlpt2[1].tr:=(wlpt2[1].azm-wlpt[0].azm)/wlpt2[1].dmd;
     wlpt2[1].br:=(wlpt2[1].inc-wlpt[0].inc)/wlpt2[1].dmd;

     if nn=1 then
      begin
       v[1].ns:=WLPT2[0].ns-wlptpp.ns;
       v[1].ew:=WLPT2[0].ew-wlptpp.ew;
       wlpt2[0].VSEC:=(v[0].ns*v[1].ns+v[0].ew*v[1].ew)/sqrt(v[0].ns*v[0].ns+v[0].ew*v[0].ew);
       v[1].ns:=WLPT2[1].ns-wlptpp.ns;
       v[1].ew:=WLPT2[1].ew-wlptpp.ew;
       wlpt2[1].VSEC:=(v[0].ns*v[1].ns+v[0].ew*v[1].ew)/sqrt(v[0].ns*v[0].ns+v[0].ew*v[0].ew);
       if sin(wlpt2[1].dls*wlpt2[1].dmd)<>0 then
        begin
         if sin(wlpt2[1].inc)*sin(wlpt2[1].azm-wlpt2[0].azm)<>0 then
          begin
           wlpt2[0].tf:=sign(sin(wlpt2[1].inc)*sin(wlpt2[1].azm-wlpt2[0].azm)/sin(wlpt2[1].dls*wlpt2[1].dmd))
           *arccos((cos(wlpt2[0].inc)*cos(wlpt2[1].dls*wlpt2[1].dmd)-cos(wlpt2[1].inc))/(sin(wlpt2[0].inc)*sin(wlpt2[1].dls*wlpt2[1].dmd)));
          end
         else
          begin
           wlpt2[0].tf:=arccos((cos(wlpt2[0].inc)*cos(wlpt2[1].dls*wlpt2[1].dmd)-cos(wlpt2[1].inc))/(sin(wlpt2[0].inc)*sin(wlpt2[1].dls*wlpt2[1].dmd)));
          end;
        end;
       if (sin(wlptf.dls*wlptf.dmd)<>0)and(kk<>ll) then
        begin
         if sin(wlptf.inc)*sin(wlptf.azm-wlpt2[1].azm)<>0 then
          begin
           wlpt2[1].tf:=sign(sin(wlptf.inc)*sin(wlptf.azm-wlpt2[1].azm)/sin(wlptf.dls*wlptf.dmd))
           *arccos((cos(wlpt2[1].inc)*cos(wlptf.dls*wlptf.dmd)-cos(wlptf.inc))/(sin(wlpt2[1].inc)*sin(wlptf.dls*wlptf.dmd)));
          end
         else
          begin
           wlpt2[1].tf:=arccos((cos(wlpt2[1].inc)*cos(wlptf.dls*wlptf.dmd)-cos(wlptf.inc))/(sin(wlpt2[1].inc)*sin(wlptf.dls*wlptf.dmd)));
          end;
        end
       else if kk=ll then
        begin
         wlpt2[1].tf:=0
        end;
      end;
     cellfill(wlpt2,2,kk);
     md:=wlpt2[1].MD-wlptp.MD;
     if (md/ppf)=trunc(md/ppf) then
      m:=2*trunc(wlpt2[1].md/ppf+1)+2
     else
      m:=2*trunc(wlpt2[1].md/ppf+1)+2+1;
     for i := 0 to (m-1) do
      begin
       wlpta1[i].order:=wlpt[2].order;
       wlpta1[i].typ:=kk;
      end;
     wlpt1[kk,0].order:=kk;
     wlpt1[kk,0].typ:=rocal[1];
     tableshow1(wlpta1,wlptpp,wlptp,wlpt2[1],a1,a2,a3,a4,v[0],kk,rocal[1],theta,MD,ll,nn,wlpta1);
     for i:= 0 to m - 1 do
      begin
       wlpt1[kk,i].MD:=wlpta1[i].MD;
       wlpt1[kk,i].INC:=wlpta1[i].INC;
       wlpt1[kk,i].azm:=wlpta1[i].AZM;
       wlpt1[kk,i].TVD:=wlpta1[i].TVD;
       wlpt1[kk,i].VSEC:=wlpta1[i].VSEC;
       wlpt1[kk,i].NS:=wlpta1[i].NS;
       wlpt1[kk,i].EW:=wlpta1[i].EW;
       wlpt1[kk,i].DLS:=wlpta1[i].DLS;
       wlpt1[kk,i].tf:=wlpta1[i].TF;
       wlpt1[kk,i].tr:=wlpta1[i].TR;
       wlpt1[kk,i].br:=wlpta1[i].BR;
       wlpt1[kk,i].dmd:=wlpta1[i].DMD;
       wlpt1[kk,i].order:=wlpta1[i].ORDER;
       wlpt1[kk,i].typ:=wlpta1[i].TYP;
       wlpt1[kk,i].CMT:=wlpta1[i].CMT;
      end;
    end
   else if (rocal[1]=2)or(rocal[1]=12) then
    begin
     A1.ns:=wlptp.NS;      A1.EW:=wlptp.EW;     A1.TVD:=wlptp.TVD;
     surtovct(wlptp.INC,wlptp.AZM,a2.ns,a2.ew,a2.tvd);
     A3.ns:=wlpt[1].NS-a1.ns;    A3.EW:=wlpt[1].EW-a1.ew;   A3.TVD:=wlpt[1].TVD-a1.tvd;
     a4.ns:=a1.ns;         a4.ew:=a1.ew;        a4.tvd:=a1.tvd;
     a5.ns:=a2.ns;         a5.ew:=a2.ew;        a5.tvd:=a2.tvd;
     a6.ns:=a3.ns+a1.ns;         a6.ew:=a3.ew+a1.ew;        a6.tvd:=a3.tvd+a1.tvd;
     if (rocal[1]=12) then
      incfind(a2,a3,wlpt[1].AZM,wlpt[1].inc)
     else
      begin
       qqq:=0;
       for qq := 1 to 2 do
        begin
         a4.ns:=a1.ns;         a4.ew:=a1.ew;        a4.tvd:=a1.tvd;
         a5.ns:=a2.ns;         a5.ew:=a2.ew;        a5.tvd:=a2.tvd;
         a6.ns:=a3.ns+a1.ns;         a6.ew:=a3.ew+a1.ew;        a6.tvd:=a3.tvd+a1.tvd;
         azmfind(a1,a2,a3,wlpt[1].inc,qq,wlpt[1].azm);
         surtovct(wlpt[1].INC,wlpt[1].AZM,a7.ns,a7.ew,a7.tvd);
         theta:=-999;
         plane(A10,A2,A3,A7,theta);
         vcttosur(a7.ns,a7.ew,a7.tvd,wlpt2[1].inc,wlpt2[1].azm);
         wlpt2[1].inc:=power(-1,round((wlpt2[1].azm/pi-1/2)))*wlpt2[1].inc;
         wlpt2[1].azm:=pi/2;
         plane(A1,A2,A3,A4,theta);
         plane(A10,A2,A3,A5,theta);
         plane(A1,A2,A3,A6,theta);
         vcttosur(a5.ns,a5.ew,a5.tvd,wlptp2.inc,wlptp2.azm);
         wlptp2.inc:=power(-1,round((wlptp2.azm/pi-1/2)))*wlptp2.inc;
         wlptp2.azm:=pi/2;
         CH3DFFK(wlptp2.INC,(a6.ew-a4.ew),a6.tvd-a4.tvd,wlpt2[1].INC,wlpta1,wlpta2,okk);
         if abs(wlptp2.INC-wlpt2[1].INC)>=(pi) then
          okk:=false;
         if okk then
          qqq:=qqq+1;
         if (okk)and(qq=1) then
          form07.RadioButton1.Enabled:=true
         else if (qq=1)and(not okk) then
          form07.RadioButton1.Enabled:=false;
         if (okk)and(qq=2) then
          form07.RadioButton2.Enabled:=true
         else if (qq=2)and(not okk) then
          form07.RadioButton2.Enabled:=false;
        end;
       if qqq=0 then
        begin
         SHOWMESSAGE('THIS OPERATION CANNOT BE DONE');
         EXIT;
        end;
       if qqq=1 then
        begin
         if form07.RadioButton1.Enabled then
          wlpt[1].AZM:=strtofloat(form07.RadioButton1.Caption)*pi/180
         else
          wlpt[1].AZM:=strtofloat(form07.RadioButton2.Caption)*pi/180;
        end;
       if qqq=2 then
        begin
         form07.ShowModal;
         if form07.RadioButton1.checked then
          wlpt[1].AZM:=strtofloat(form07.RadioButton1.Caption)*pi/180
         else
          wlpt[1].AZM:=strtofloat(form07.RadioButton2.Caption)*pi/180;
        end;
      end;
     theta:=-999;
     a4.ns:=a1.ns;         a4.ew:=a1.ew;        a4.tvd:=a1.tvd;
     a5.ns:=a2.ns;         a5.ew:=a2.ew;        a5.tvd:=a2.tvd;
     a6.ns:=a3.ns+a1.ns;         a6.ew:=a3.ew+a1.ew;        a6.tvd:=a3.tvd+a1.tvd;
     surtovct(wlpt[1].INC,wlpt[1].AZM,a7.ns,a7.ew,a7.tvd);
     theta:=-999;
     plane(A10,A2,A3,A7,theta);
     vcttosur(a7.ns,a7.ew,a7.tvd,wlpt2[1].inc,wlpt2[1].azm);
     wlpt2[1].inc:=power(-1,round((wlpt2[1].azm/pi-1/2)))*wlpt2[1].inc;
     wlpt2[1].azm:=pi/2;
     plane(A1,A2,A3,A4,theta);
     plane(A10,A2,A3,A5,theta);
     plane(A1,A2,A3,A6,theta);
     vcttosur(a5.ns,a5.ew,a5.tvd,wlptp2.inc,wlptp2.azm);
     wlptp2.inc:=power(-1,round((wlptp2.azm/pi-1/2)))*wlptp2.inc;
     wlptp2.azm:=pi/2;
     CH3DFFK(wlptp2.INC,(a6.ew-a4.ew),a6.tvd-a4.tvd,wlpt2[1].INC,wlpta1,wlpta2,okk);
     if OKK=FALSE then
      BEGIN
       SHOWMESSAGE('THIS OPERATION CANNOT BE DONE');
       EXIT;
      END;
     a5.ns:=wlpta2[0].ns+a4.ns;    a5.ew:=wlpta2[0].ew+a4.ew;   a5.tvd:=wlpta2[0].tvd+a4.tvd;
     a6.ns:=wlpta2[1].ns+a4.ns;    a6.ew:=wlpta2[1].ew+a4.ew;   a6.tvd:=wlpta2[1].tvd+a4.tvd;
     revplane(A1,A2,A3,theta,A5);
     revplane(A1,A2,A3,theta,A6);
     vcttosur(A6.NS-a5.ns,A6.EW-a5.ew,A6.TVD-a5.tvd,wlpt2[0].inc,wlpt2[0].azm);
     wlpt2[1].inc:=wlpt[1].inc;     wlpt2[1].azm:=wlpt[1].azm;

     wlpt2[0].ns:=a5.ns;   wlpt2[0].ew:=a5.ew;  wlpt2[0].tvd:=a5.tvd;
     wlpt2[1].ns:=a6.ns;   wlpt2[1].ew:=a6.ew;  wlpt2[1].tvd:=a6.tvd;
     wlpt2[0].MD:=wlpta2[0].MD+wlptp.MD;
     wlpt2[0].dls:=abs(wlpta2[0].dls);
     wlpt2[0].cmt:=wlpta2[0].cmt;
     wlpt2[0].dmd:=wlpta2[0].dmd;
     wlpt2[0].tr:=(wlpt2[0].azm-wlptp.azm)/wlpt2[0].dmd;
     wlpt2[0].br:=(wlpt2[0].inc-wlptp.inc)/wlpt2[0].dmd;

     wlpt2[1].MD:=wlpta2[1].MD+wlptp.MD;
     wlpt2[1].dls:=abs(wlpta2[1].dls);
     wlpt2[1].cmt:=wlpta2[1].cmt;
     wlpt2[1].dmd:=wlpta2[1].dmd;
     wlpt2[1].tr:=(wlpt2[1].azm-wlpt[0].azm)/wlpt2[1].dmd;
     wlpt2[1].br:=(wlpt2[1].inc-wlpt[0].inc)/wlpt2[1].dmd;

     if nn=1 then
      begin
       v[1].ns:=WLPT2[0].ns-wlptpp.ns;
       v[1].ew:=WLPT2[0].ew-wlptpp.ew;
       wlpt2[0].VSEC:=(v[0].ns*v[1].ns+v[0].ew*v[1].ew)/sqrt(v[0].ns*v[0].ns+v[0].ew*v[0].ew);
       v[1].ns:=WLPT2[1].ns-wlptpp.ns;
       v[1].ew:=WLPT2[1].ew-wlptpp.ew;
       wlpt2[1].VSEC:=(v[0].ns*v[1].ns+v[0].ew*v[1].ew)/sqrt(v[0].ns*v[0].ns+v[0].ew*v[0].ew);
       if sin(wlpt2[1].dls*wlpt2[1].dmd)<>0 then
        begin
         if sin(wlpt2[1].inc)*sin(wlpt2[1].azm-wlpt2[0].azm)<>0 then
          begin
           wlpt2[0].tf:=sign(sin(wlpt2[1].inc)*sin(wlpt2[1].azm-wlpt2[0].azm)/sin(wlpt2[1].dls*wlpt2[1].dmd))
           *arccos((cos(wlpt2[0].inc)*cos(wlpt2[1].dls*wlpt2[1].dmd)-cos(wlpt2[1].inc))/(sin(wlpt2[0].inc)*sin(wlpt2[1].dls*wlpt2[1].dmd)));
          end
         else
          begin
           wlpt2[0].tf:=arccos((cos(wlpt2[0].inc)*cos(wlpt2[1].dls*wlpt2[1].dmd)-cos(wlpt2[1].inc))/(sin(wlpt2[0].inc)*sin(wlpt2[1].dls*wlpt2[1].dmd)));
          end;
        end;
       if (sin(wlptf.dls*wlptf.dmd)<>0)and(kk<>ll) then
        begin
         if sin(wlptf.inc)*sin(wlptf.azm-wlpt2[1].azm)<>0 then
          begin
           wlpt2[1].tf:=sign(sin(wlptf.inc)*sin(wlptf.azm-wlpt2[1].azm)/sin(wlptf.dls*wlptf.dmd))
           *arccos((cos(wlpt2[1].inc)*cos(wlptf.dls*wlptf.dmd)-cos(wlptf.inc))/(sin(wlpt2[1].inc)*sin(wlptf.dls*wlptf.dmd)));
          end
         else
          begin
           wlpt2[1].tf:=arccos((cos(wlpt2[1].inc)*cos(wlptf.dls*wlptf.dmd)-cos(wlptf.inc))/(sin(wlpt2[1].inc)*sin(wlptf.dls*wlptf.dmd)));
          end;
        end
       else if kk=ll then
        begin
         wlpt2[1].tf:=0
        end;

      end;

     cellfill(wlpt2,2,kk);
     md:=wlpt2[1].MD-wlptp.MD;
     if (md/ppf)=trunc(md/ppf) then
      m:=2*(trunc(md/ppf))+1
     else
      m:=2*(trunc(md/ppf)+1)+1;
     for i := 0 to (m-1) do
      begin
       wlpta1[i].order:=wlpt[2].order;
       wlpta1[i].typ:=kk;
      end;
     wlpt1[kk,0].order:=kk;
     wlpt1[kk,0].typ:=rocal[1];
     tableshow1(wlpta1,wlptpp,wlptp,wlpt2[1],a1,a2,a3,a4,v[0],kk,rocal[1],theta,MD,ll,nn,wlpta1);
     for i:= 0 to m - 1 do
      begin
       wlpt1[kk,i].MD:=wlpta1[i].MD;
       wlpt1[kk,i].INC:=wlpta1[i].INC;
       wlpt1[kk,i].azm:=wlpta1[i].AZM;
       wlpt1[kk,i].TVD:=wlpta1[i].TVD;
       wlpt1[kk,i].VSEC:=wlpta1[i].VSEC;
       wlpt1[kk,i].NS:=wlpta1[i].NS;
       wlpt1[kk,i].EW:=wlpta1[i].EW;
       wlpt1[kk,i].DLS:=wlpta1[i].DLS;
       wlpt1[kk,i].tf:=wlpta1[i].TF;
       wlpt1[kk,i].tr:=wlpta1[i].TR;
       wlpt1[kk,i].br:=wlpta1[i].BR;
       wlpt1[kk,i].dmd:=wlpta1[i].DMD;
       wlpt1[kk,i].order:=wlpta1[i].ORDER;
       wlpt1[kk,i].typ:=wlpta1[i].TYP;
       wlpt1[kk,i].CMT:=wlpta1[i].CMT;
      end;
    end
   else if (rocal[1]=3)or(rocal[1]=13) then
    begin
     A1.ns:=wlptp.NS;      A1.EW:=wlptp.EW;     A1.TVD:=wlptp.TVD;
     surtovct(wlptp.INC,wlptp.AZM,a2.ns,a2.ew,a2.tvd);
     A3.ns:=wlpt[2].NS-a1.ns;    A3.EW:=wlpt[2].EW-a1.ew;   A3.TVD:=wlpt[2].TVD-a1.tvd;
     a4.ns:=a1.ns;         a4.ew:=a1.ew;        a4.tvd:=a1.tvd;
     a5.ns:=a2.ns;         a5.ew:=a2.ew;        a5.tvd:=a2.tvd;
     a6.ns:=a3.ns+a1.ns;         a6.ew:=a3.ew+a1.ew;        a6.tvd:=a3.tvd+a1.tvd;
     if (rocal[1]=13) then
      incfind(a2,a3,wlpt[2].AZM,wlpt[2].inc)
     else
      begin
       qqq:=0;
       for qq := 1 to 2 do
        begin
         a4.ns:=a1.ns;         a4.ew:=a1.ew;        a4.tvd:=a1.tvd;
         a5.ns:=a2.ns;         a5.ew:=a2.ew;        a5.tvd:=a2.tvd;
         a6.ns:=a3.ns+a1.ns;         a6.ew:=a3.ew+a1.ew;        a6.tvd:=a3.tvd+a1.tvd;
         azmfind(a1,a2,a3,wlpt[2].inc,qq,wlpt[2].azm);
         surtovct(wlpt[2].INC,wlpt[2].AZM,a7.ns,a7.ew,a7.tvd);
         theta:=-999;
         plane(A10,A2,A3,A7,theta);
         vcttosur(a7.ns,a7.ew,a7.tvd,wlpt2[2].inc,wlpt2[2].azm);
         wlpt2[2].inc:=power(-1,round((wlpt2[2].azm/pi-1/2)))*wlpt2[2].inc;
         wlpt2[2].azm:=pi/2;
         plane(A1,A2,A3,A4,theta);
         plane(A10,A2,A3,A5,theta);
         plane(A1,A2,A3,A6,theta);
         vcttosur(a5.ns,a5.ew,a5.tvd,wlptp2.inc,wlptp2.azm);
         wlptp2.inc:=power(-1,round((wlptp2.azm/pi-1/2)))*wlptp2.inc;
         wlptp2.azm:=pi/2;
         if wlptp2.INC>wlpt2[2].INC then
          wlpt[1].DLS:=-abs(wlpt[1].DLS)
         else
          wlpt[1].DLS:=abs(wlpt[1].DLS);
         HCH(wlptp2.INC,a6.ew-a4.ew,a6.tvd-a4.tvd,wlpt2[2].INC,wlpt[1].DLS,wlpta1,wlpta2,okk);
         if abs(wlptp2.INC-wlpt2[2].INC)>=(pi) then
          okk:=false;
         if okk then
          qqq:=qqq+1;
         if (okk)and(qq=1) then
          form07.RadioButton1.Enabled:=true
         else if (qq=1)and(not okk) then
          form07.RadioButton1.Enabled:=false;
         if (okk)and(qq=2) then
          form07.RadioButton2.Enabled:=true
         else if (qq=2)and(not okk) then
          form07.RadioButton2.Enabled:=false;
        end;
       if qqq=0 then
        begin
         for qq := 1 to 2 do
          begin
           a4.ns:=a1.ns;         a4.ew:=a1.ew;        a4.tvd:=a1.tvd;
           a5.ns:=a2.ns;         a5.ew:=a2.ew;        a5.tvd:=a2.tvd;
           a6.ns:=a3.ns+a1.ns;         a6.ew:=a3.ew+a1.ew;        a6.tvd:=a3.tvd+a1.tvd;
           azmfind(a1,a2,a3,wlpt[2].inc,qq,wlpt[2].azm);
           surtovct(wlpt[2].INC,wlpt[2].AZM,a7.ns,a7.ew,a7.tvd);
           theta:=-999;
           plane(A10,A2,A3,A7,theta);
           vcttosur(a7.ns,a7.ew,a7.tvd,wlpt2[2].inc,wlpt2[2].azm);
           wlpt2[2].inc:=power(-1,round((wlpt2[2].azm/pi-1/2)))*wlpt2[2].inc;
           wlpt2[2].azm:=pi/2;
           plane(A1,A2,A3,A4,theta);
           plane(A10,A2,A3,A5,theta);
           plane(A1,A2,A3,A6,theta);
           vcttosur(a5.ns,a5.ew,a5.tvd,wlptp2.inc,wlptp2.azm);
           wlptp2.inc:=power(-1,round((wlptp2.azm/pi-1/2)))*wlptp2.inc;
           wlptp2.azm:=pi/2;
           if wlptp2.INC>wlpt2[2].INC then
            begin
             if (a6.tvd-a4.tvd)*(sin(wlpt2[2].INC))<(a6.ew-a4.ew)*(cos(wlpt2[2].INC)) then
              begin
               if ((a6.ew-a4.ew)*(cos(wlptp2.INC)+cos(wlpt2[2].INC))>((a6.tvd-a4.tvd)*(sin(wlptp2.INC)+cos(wlpt2[2].INC))))then
                 ex1:=abs((18000/pi)*((1-cos(wlpt2[2].INC-wlptp2.INC))/
                 ((a6.tvd-a4.tvd)*(sin(wlpt2[2].INC))-(a6.ew-a4.ew)*(cos(wlpt2[2].INC)))))
               else
                 ex1:=abs((18000/pi)*((1-cos(wlpt2[2].INC-wlptp2.INC))/
                 (-(a6.tvd-a4.tvd)*(sin(wlptp2.INC))+(a6.ew-a4.ew)*(cos(wlptp2.INC)))));
               if qq=1 then
                 ex2:=ex1;
              end
             else
              ex2:=-999;
            end
           else
            begin
             if ((a6.ew-a4.ew)*(cos(wlptp2.INC)+cos(wlpt2[2].INC))>((a6.tvd-a4.tvd)*(sin(wlptp2.INC)+cos(wlpt2[2].INC))))then
               ex1:=abs((18000/pi)*((1-cos(wlpt2[2].INC-wlptp2.INC))/
               ((a6.tvd-a4.tvd)*(sin(wlpt2[2].INC))-(a6.ew-a4.ew)*(cos(wlpt2[2].INC)))))
             else
               ex1:=abs((18000/pi)*((1-cos(wlpt2[2].INC-wlptp2.INC))/
                (-(a6.tvd-a4.tvd)*(sin(wlptp2.INC))+(a6.ew-a4.ew)*(cos(wlptp2.INC)))));
             if qq=1 then
               ex2:=ex1;
            end;
          end;
         if wlptp2.INC<wlpt2[2].INC then
          begin
           ex2:=0.5*abs(ex2+ex1)+0.5*abs(ex2-ex1);
           if (ex2>0) then
             showmessage('Minimum Needed DLS to Reach target is '+floattostr(0.001*round(1000*ex2)))
           else
             SHOWMESSAGE('THIS OPERATION CANNOT BE DONE')
          end
         else
          begin
           ex2:=0.5*abs(ex2+ex1)-0.5*abs(ex2-ex1);
           if (ex2>0) then
             showmessage('Maximum Needed DLS to Reach target is '+floattostr(0.001*round(1000*ex2)))
           else
             SHOWMESSAGE('THIS OPERATION CANNOT BE DONE');
          end;
         EXIT;
        end;
       if qqq=1 then
        begin
         if form07.RadioButton1.Enabled then
          wlpt[2].AZM:=strtofloat(form07.RadioButton1.Caption)*pi/180
         else
          wlpt[2].AZM:=strtofloat(form07.RadioButton2.Caption)*pi/180;
        end;
       if qqq=2 then
        begin
         form07.ShowModal;
         if form07.RadioButton1.checked then
          wlpt[2].AZM:=strtofloat(form07.RadioButton1.Caption)*pi/180
         else
          wlpt[2].AZM:=strtofloat(form07.RadioButton2.Caption)*pi/180;
        end;
      end;
     a4.ns:=a1.ns;         a4.ew:=a1.ew;        a4.tvd:=a1.tvd;
     a5.ns:=a2.ns;         a5.ew:=a2.ew;        a5.tvd:=a2.tvd;
     a6.ns:=a3.ns+a1.ns;         a6.ew:=a3.ew+a1.ew;        a6.tvd:=a3.tvd+a1.tvd;
     surtovct(wlpt[2].INC,wlpt[2].AZM,a7.ns,a7.ew,a7.tvd);
     plane(A10,A2,A3,A7,theta);
     vcttosur(a7.ns,a7.ew,a7.tvd,wlpt2[2].inc,wlpt2[2].azm);
     plane(A1,A2,A3,A4,theta);
     plane(A10,A2,A3,A5,theta);
     plane(A1,A2,A3,A6,theta);
     vcttosur(a5.ns,a5.ew,a5.tvd,wlptp2.inc,wlptp2.azm);
     wlpt2[2].inc:=power(-1,round((wlpt2[2].azm/pi-1/2)))*wlpt2[2].inc;
     wlpt2[2].azm:=pi/2;
     wlptp2.inc:=power(-1,round((wlptp2.azm/pi-1/2)))*wlptp2.inc;
     wlptp2.azm:=pi/2;
     if wlptp2.INC>wlpt2[2].INC then
      wlpt[1].DLS:=-abs(wlpt[1].DLS)
     else
      wlpt[1].DLS:=abs(wlpt[1].DLS);
     HCH(wlptp2.INC,a6.ew-a4.ew,a6.tvd-a4.tvd,wlpt2[2].INC,wlpt[1].DLS,wlpta1,wlpta2,okk);
     if OKK=FALSE then
      BEGIN
       SHOWMESSAGE('THIS OPERATION CANNOT BE DONE');
       EXIT;
      END;
     a5.ns:=wlpta2[0].ns+a4.ns;    a5.ew:=wlpta2[0].ew+a4.ew;   a5.tvd:=wlpta2[0].tvd+a4.tvd;
     a6.ns:=wlpta2[1].ns+a4.ns;    a6.ew:=wlpta2[1].ew+a4.ew;   a6.tvd:=wlpta2[1].tvd+a4.tvd;
     a7.ns:=wlpta2[2].ns+a4.ns;    a7.ew:=wlpta2[2].ew+a4.ew;   a7.tvd:=wlpta2[2].tvd+a4.tvd;
     revplane(A1,A2,A3,theta,A5);
     revplane(A1,A2,A3,theta,A6);
     revplane(A1,A2,A3,theta,A7);
     vcttosur(A5.NS-wlptp.ns,A5.EW-wlptp.ew,A5.TVD-wlptp.tvd,wlpt2[0].inc,wlpt2[0].azm);
     vcttosur(A7.NS-a6.ns,A7.EW-a6.ew,A7.TVD-a6.tvd,wlpt2[1].inc,wlpt2[1].azm);
     wlpt2[2].inc:=wlpt[2].inc;     wlpt2[2].azm:=wlpt[2].azm;

     wlpt2[0].ns:=a5.ns;   wlpt2[0].ew:=a5.ew;  wlpt2[0].tvd:=a5.tvd;
     wlpt2[1].ns:=a6.ns;   wlpt2[1].ew:=a6.ew;  wlpt2[1].tvd:=a6.tvd;
     wlpt2[2].ns:=a7.ns;   wlpt2[2].ew:=a7.ew;  wlpt2[2].tvd:=a7.tvd;

     wlpt2[0].MD:=wlpta2[0].MD+wlptp.MD;
     wlpt2[0].dls:=abs(wlpta2[0].dls);
     wlpt2[0].cmt:=wlpta2[0].cmt;
     wlpt2[0].dmd:=wlpta2[0].dmd;
     wlpt2[0].tr:=(wlpt2[0].azm-wlptp.azm)/wlpt2[0].dmd;
     wlpt2[0].br:=(wlpt2[0].inc-wlptp.inc)/wlpt2[0].dmd;

     wlpt2[1].MD:=wlpta2[1].MD+wlptp.MD;
     wlpt2[1].dls:=abs(wlpta2[1].dls);
     wlpt2[1].cmt:=wlpta2[1].cmt;
     wlpt2[1].dmd:=wlpta2[1].dmd;
     wlpt2[1].tr:=(wlpt2[1].azm-wlpt[0].azm)/wlpt2[1].dmd;
     wlpt2[1].br:=(wlpt2[1].inc-wlpt[0].inc)/wlpt2[1].dmd;

     wlpt2[2].MD:=wlpta2[2].MD+wlptp.MD;
     wlpt2[2].dls:=abs(wlpta2[2].dls);
     wlpt2[2].cmt:=wlpta2[2].cmt;
     wlpt2[2].dmd:=wlpta2[2].dmd;
     wlpt2[2].tr:=(wlpt2[2].azm-wlpt[1].azm)/wlpt2[2].dmd;
     wlpt2[2].br:=(wlpt2[2].inc-wlpt[1].inc)/wlpt2[2].dmd;

     if nn=1 then
      begin
       v[1].ns:=WLPT2[0].ns-wlptpp.ns;
       v[1].ew:=WLPT2[0].ew-wlptpp.ew;
       wlpt2[0].VSEC:=(v[0].ns*v[1].ns+v[0].ew*v[1].ew)/sqrt(v[0].ns*v[0].ns+v[0].ew*v[0].ew);
       v[1].ns:=WLPT2[1].ns-wlptpp.ns;
       v[1].ew:=WLPT2[1].ew-wlptpp.ew;
       wlpt2[1].VSEC:=(v[0].ns*v[1].ns+v[0].ew*v[1].ew)/sqrt(v[0].ns*v[0].ns+v[0].ew*v[0].ew);
       v[1].ns:=WLPT2[2].ns-wlptpp.ns;
       v[1].ew:=WLPT2[2].ew-wlptpp.ew;
       wlpt2[2].VSEC:=(v[0].ns*v[1].ns+v[0].ew*v[1].ew)/sqrt(v[0].ns*v[0].ns+v[0].ew*v[0].ew);
       if sin(wlpt2[1].dls*wlpt2[1].dmd)<>0 then
        begin
         if sin(wlpt2[1].inc)*sin(wlpt2[1].azm-wlpt2[0].azm)<>0 then
          begin
           wlpt2[0].tf:=sign(sin(wlpt2[1].inc)*sin(wlpt2[1].azm-wlpt2[0].azm)/sin(wlpt2[1].dls*wlpt2[1].dmd))
           *arccos((cos(wlpt2[0].inc)*cos(wlpt2[1].dls*wlpt2[1].dmd)-cos(wlpt2[1].inc))/(sin(wlpt2[0].inc)*sin(wlpt2[1].dls*wlpt2[1].dmd)));
          end
         else
          begin
           wlpt2[0].tf:=arccos((cos(wlpt2[0].inc)*cos(wlpt2[1].dls*wlpt2[1].dmd)-cos(wlpt2[1].inc))/(sin(wlpt2[0].inc)*sin(wlpt2[1].dls*wlpt2[1].dmd)));
          end;
        end;
       if sin(wlpt2[2].dls*wlpt2[2].dmd)<>0 then
        begin
         if sin(wlpt2[2].inc)*sin(wlpt2[2].azm-wlpt2[1].azm)<>0 then
          begin
           wlpt2[1].tf:=sign(sin(wlpt2[2].inc)*sin(wlpt2[2].azm-wlpt2[1].azm)/sin(wlpt2[2].dls*wlpt2[2].dmd))
           *arccos((cos(wlpt2[1].inc)*cos(wlpt2[2].dls*wlpt2[2].dmd)-cos(wlpt2[2].inc))/(sin(wlpt2[1].inc)*sin(wlpt2[2].dls*wlpt2[2].dmd)));
          end
         else
          begin
           wlpt2[1].tf:=arccos((cos(wlpt2[1].inc)*cos(wlpt2[2].dls*wlpt2[2].dmd)-cos(wlpt2[2].inc))/(sin(wlpt2[1].inc)*sin(wlpt2[2].dls*wlpt2[2].dmd)));
          end;
        end;
       if (sin(wlptf.dls*wlptf.dmd)<>0)and(kk<>ll) then
        begin
         if sin(wlptf.inc)*sin(wlptf.azm-wlpt2[1].azm)<>0 then
          begin
           wlpt2[2].tf:=sign(sin(wlptf.inc)*sin(wlptf.azm-wlpt2[2].azm)/sin(wlptf.dls*wlptf.dmd))
           *arccos((cos(wlpt2[2].inc)*cos(wlptf.dls*wlptf.dmd)-cos(wlptf.inc))/(sin(wlpt2[2].inc)*sin(wlptf.dls*wlptf.dmd)));
          end
         else
          begin
           wlpt2[2].tf:=arccos((cos(wlpt2[2].inc)*cos(wlptf.dls*wlptf.dmd)-cos(wlptf.inc))/(sin(wlpt2[2].inc)*sin(wlptf.dls*wlptf.dmd)));
          end;
        end
       else if kk=ll then
        begin
         wlpt2[2].tf:=0
        end;

      end;
     cellfill(wlpt2,2,kk);
     md:=wlpt2[2].MD-wlptp.MD;
     if (md/ppf)=trunc(md/ppf) then
      m:=2*(trunc(md/ppf))+1
     else
      m:=2*(trunc(md/ppf)+2)+1;
     for i := 0 to (m-1) do
      begin
       wlpta1[i].order:=wlpt[2].order;
       wlpta1[i].typ:=kk;
      end;
     wlpt1[kk,0].order:=kk;
     wlpt1[kk,0].typ:=rocal[1];
     tableshow1(wlpta1,wlptpp,wlptp,wlpt2[2],a1,a2,a3,a4,v[0],kk,rocal[1],theta,MD,ll,nn,wlpta1);
     for i:= 0 to m - 1 do
      begin
       wlpt1[kk,i].MD:=wlpta1[i].MD;
       wlpt1[kk,i].INC:=wlpta1[i].INC;
       wlpt1[kk,i].azm:=wlpta1[i].AZM;
       wlpt1[kk,i].TVD:=wlpta1[i].TVD;
       wlpt1[kk,i].VSEC:=wlpta1[i].VSEC;
       wlpt1[kk,i].NS:=wlpta1[i].NS;
       wlpt1[kk,i].EW:=wlpta1[i].EW;
       wlpt1[kk,i].DLS:=wlpta1[i].DLS;
       wlpt1[kk,i].tf:=wlpta1[i].TF;
       wlpt1[kk,i].tr:=wlpta1[i].TR;
       wlpt1[kk,i].br:=wlpta1[i].BR;
       wlpt1[kk,i].dmd:=wlpta1[i].DMD;
       wlpt1[kk,i].order:=wlpta1[i].ORDER;
       wlpt1[kk,i].typ:=wlpta1[i].TYP;
       wlpt1[kk,i].CMT:=wlpta1[i].CMT;
      end;
    end
   else if (rocal[1]=4)or(rocal[1]=14) then
    begin
     A1.ns:=wlptp.NS;      A1.EW:=wlptp.EW;     A1.TVD:=wlptp.TVD;
     surtovct(wlptp.INC,wlptp.AZM,a2.ns,a2.ew,a2.tvd);
     A3.ns:=wlpt[1].NS-a1.ns;    A3.EW:=wlpt[1].EW-a1.ew;   A3.TVD:=wlpt[1].TVD-a1.tvd;
     a4.ns:=a1.ns;         a4.ew:=a1.ew;        a4.tvd:=a1.tvd;
     a5.ns:=a2.ns;         a5.ew:=a2.ew;        a5.tvd:=a2.tvd;
     a6.ns:=a3.ns+a1.ns;         a6.ew:=a3.ew+a1.ew;        a6.tvd:=a3.tvd+a1.tvd;
     plane(A1,A2,A3,A4,theta);
     plane(A10,A2,A3,A5,theta);
     plane(A1,A2,A3,A6,theta);
     vcttosur(a5.ns,a5.ew,a5.tvd,wlptp2.inc,wlptp2.azm);
     wlptp2.inc:=power(-1,round((wlptp2.azm/pi-1/2)))*wlptp2.inc;
     wlptp2.azm:=pi/2;
     if ((a6.tvd-a4.tvd)*cos(wlptp2.inc))<(a6.ew-a4.ew) then
       wlpt[0].DLS:=-wlpt[0].DLS;
     CH(wlptp2.INC,a6.ew-a4.ew,a6.tvd-a4.tvd,wlpt[0].DLS,wlpta1,wlpta2,okk);
     if okk=false then
      begin
       ex1:=2*((a6.ew-a4.ew)*cos(wlptp2.INC)-(a6.tvd-a4.tvd)*sin(wlptp2.INC))/((a6.tvd-a4.tvd)*(a6.tvd-a4.tvd)+(a6.ew-a4.ew)*(a6.ew-a4.ew));
       ex1:=abs(18000*ex1/pi);
       showmessage('Minimum Needed DLS to Reach target is '+floattostr(0.001*round(1000*ex1)));
       exit;
      end;
     wlpt[0].DLS:=ABS(wlpt[0].DLS);

     a5.ns:=wlpta2[0].ns+a4.ns;    a5.ew:=wlpta2[0].ew+a4.ew;   a5.tvd:=wlpta2[0].tvd+a4.tvd;
     a6.ns:=wlpta2[1].ns+a4.ns;    a6.ew:=wlpta2[1].ew+a4.ew;   a6.tvd:=wlpta2[1].tvd+a4.tvd;
     revplane(A1,A2,A3,theta,A5);
     revplane(A1,A2,A3,theta,A6);
     vcttosur(A6.NS-a5.ns,A6.EW-a5.ew,A6.TVD-a5.tvd,wlpt2[0].inc,wlpt2[0].azm);
     wlpt2[1].inc:=wlpt[1].inc;     wlpt2[1].azm:=wlpt[1].azm;
     wlpt2[1].inc:=wlpt2[0].inc;     wlpt2[1].azm:=wlpt2[0].azm;
     wlpt2[0].ns:=a5.ns;   wlpt2[0].ew:=a5.ew;  wlpt2[0].tvd:=a5.tvd;
     wlpt2[1].ns:=a6.ns;   wlpt2[1].ew:=a6.ew;  wlpt2[1].tvd:=a6.tvd;
     wlpt2[0].MD:=wlpta2[0].MD+wlptp.MD;
     wlpt2[0].dls:=abs(wlpta2[0].dls);
     wlpt2[0].cmt:=wlpta2[0].cmt;
     wlpt2[0].dmd:=wlpta2[0].dmd;
     wlpt2[0].tr:=(wlpt2[0].azm-wlptp.azm)/wlpt2[0].dmd;
     wlpt2[0].br:=(wlpt2[0].inc-wlptp.inc)/wlpt2[0].dmd;

     wlpt2[1].MD:=wlpta2[1].MD+wlptp.MD;
     wlpt2[1].dls:=abs(wlpta2[1].dls);
     wlpt2[1].cmt:=wlpta2[1].cmt;
     wlpt2[1].dmd:=wlpta2[1].dmd;
     wlpt2[1].tr:=(wlpt2[1].azm-wlpt[0].azm)/wlpt2[1].dmd;
     wlpt2[1].br:=(wlpt2[1].inc-wlpt[0].inc)/wlpt2[1].dmd;

     if nn=1 then
      begin
       v[1].ns:=WLPT2[0].ns-wlptpp.ns;
       v[1].ew:=WLPT2[0].ew-wlptpp.ew;
       wlpt2[0].VSEC:=(v[0].ns*v[1].ns+v[0].ew*v[1].ew)/sqrt(v[0].ns*v[0].ns+v[0].ew*v[0].ew);
       v[1].ns:=WLPT2[1].ns-wlptpp.ns;
       v[1].ew:=WLPT2[1].ew-wlptpp.ew;
       wlpt2[1].VSEC:=(v[0].ns*v[1].ns+v[0].ew*v[1].ew)/sqrt(v[0].ns*v[0].ns+v[0].ew*v[0].ew);
       if sin(wlpt2[1].dls*wlpt2[1].dmd)<>0 then
        begin
         if sin(wlpt2[1].inc)*sin(wlpt2[1].azm-wlpt2[0].azm)<>0 then
          begin
           wlpt2[0].tf:=sign(sin(wlpt2[1].inc)*sin(wlpt2[1].azm-wlpt2[0].azm)/sin(wlpt2[1].dls*wlpt2[1].dmd))
           *arccos((cos(wlpt2[0].inc)*cos(wlpt2[1].dls*wlpt2[1].dmd)-cos(wlpt2[1].inc))/(sin(wlpt2[0].inc)*sin(wlpt2[1].dls*wlpt2[1].dmd)));
          end
         else
          begin
           wlpt2[0].tf:=arccos((cos(wlpt2[0].inc)*cos(wlpt2[1].dls*wlpt2[1].dmd)-cos(wlpt2[1].inc))/(sin(wlpt2[0].inc)*sin(wlpt2[1].dls*wlpt2[1].dmd)));
          end;
        end;
       if (sin(wlptf.dls*wlptf.dmd)<>0)and(kk<>ll) then
        begin
         if sin(wlptf.inc)*sin(wlptf.azm-wlpt2[1].azm)<>0 then
          begin
           wlpt2[1].tf:=sign(sin(wlptf.inc)*sin(wlptf.azm-wlpt2[1].azm)/sin(wlptf.dls*wlptf.dmd))
           *arccos((cos(wlpt2[1].inc)*cos(wlptf.dls*wlptf.dmd)-cos(wlptf.inc))/(sin(wlpt2[1].inc)*sin(wlptf.dls*wlptf.dmd)));
          end
         else
          begin
           wlpt2[1].tf:=arccos((cos(wlpt2[1].inc)*cos(wlptf.dls*wlptf.dmd)-cos(wlptf.inc))/(sin(wlpt2[1].inc)*sin(wlptf.dls*wlptf.dmd)));
          end;
        end
       else if kk=ll then
        begin
         wlpt2[1].tf:=0
        end;

      end;

     cellfill(wlpt2,2,kk);
     md:=wlpt2[1].MD-wlptp.MD;
     if (md/ppf)=trunc(md/ppf) then
      m:=2*(trunc(md/ppf))+1
     else
      m:=2*(trunc(md/ppf)+1)+1;
     for i := 0 to (m-1) do
      begin
       wlpta1[i].order:=wlpt[2].order;
       wlpta1[i].typ:=kk;
      end;
     wlpt1[kk,0].order:=kk;
     wlpt1[kk,0].typ:=rocal[1];
     tableshow1(wlpta1,wlptpp,wlptp,wlpt2[1],a1,a2,a3,a4,v[0],kk,rocal[1],theta,MD,ll,nn,wlpta1);
     for i:= 0 to m - 1 do
      begin
       wlpt1[kk,i].MD:=wlpta1[i].MD;
       wlpt1[kk,i].INC:=wlpta1[i].INC;
       wlpt1[kk,i].azm:=wlpta1[i].AZM;
       wlpt1[kk,i].TVD:=wlpta1[i].TVD;
       wlpt1[kk,i].VSEC:=wlpta1[i].VSEC;
       wlpt1[kk,i].NS:=wlpta1[i].NS;
       wlpt1[kk,i].EW:=wlpta1[i].EW;
       wlpt1[kk,i].DLS:=wlpta1[i].DLS;
       wlpt1[kk,i].tf:=wlpta1[i].TF;
       wlpt1[kk,i].tr:=wlpta1[i].TR;
       wlpt1[kk,i].br:=wlpta1[i].BR;
       wlpt1[kk,i].dmd:=wlpta1[i].DMD;
       wlpt1[kk,i].order:=wlpta1[i].ORDER;
       wlpt1[kk,i].typ:=wlpta1[i].TYP;
       wlpt1[kk,i].CMT:=wlpta1[i].CMT;
      end;
    end
  else if (rocal[1]=5)or(rocal[1]=15) then
    begin
     A1.ns:=wlptp.NS;      A1.EW:=wlptp.EW;     A1.TVD:=wlptp.TVD;
     surtovct(wlptp.INC,wlptp.AZM,a2.ns,a2.ew,a2.tvd);
     A3.ns:=wlpt[2].NS-a1.ns;    A3.EW:=wlpt[2].EW-a1.ew;   A3.TVD:=wlpt[2].TVD-a1.tvd;
     a4.ns:=a1.ns;         a4.ew:=a1.ew;        a4.tvd:=a1.tvd;
     a5.ns:=a2.ns;         a5.ew:=a2.ew;        a5.tvd:=a2.tvd;
     a6.ns:=a3.ns+a1.ns;         a6.ew:=a3.ew+a1.ew;        a6.tvd:=a3.tvd+a1.tvd;
     if (rocal[1]=15) then
       incfind(a2,a3,wlpt[2].AZM,wlpt[2].inc)
     else
      begin
       qqq:=0;
       form07.RadioButton1.Enabled:=false;
       form07.RadioButton2.Enabled:=false;
       for qq := 1 to 2 do
        begin
         A1.ns:=wlptp.NS;      A1.EW:=wlptp.EW;     A1.TVD:=wlptp.TVD;
         surtovct(wlptp.INC,wlptp.AZM,a2.ns,a2.ew,a2.tvd);
         A3.ns:=wlpt[2].NS-a1.ns;    A3.EW:=wlpt[2].EW-a1.ew;   A3.TVD:=wlpt[2].TVD-a1.tvd;
         a4.ns:=a1.ns;         a4.ew:=a1.ew;        a4.tvd:=a1.tvd;
         a5.ns:=a2.ns;         a5.ew:=a2.ew;        a5.tvd:=a2.tvd;
         a6.ns:=a3.ns+a1.ns;         a6.ew:=a3.ew+a1.ew;        a6.tvd:=a3.tvd+a1.tvd;
         azmfind(a1,a2,a3,wlpt[2].inc,qq,wlpt[2].azm);
         surtovct(wlpt[2].INC,wlpt[2].AZM,a7.ns,a7.ew,a7.tvd);
         plane(A10,A2,A3,A7,theta);
         vcttosur(a7.ns,a7.ew,a7.tvd,wlpt2[2].inc,wlpt2[2].azm);
         plane(A1,A2,A3,A4,theta);
         plane(A10,A2,A3,A5,theta);
         plane(A1,A2,A3,A6,theta);
         vcttosur(a5.ns,a5.ew,a5.tvd,wlptp2.inc,wlptp2.azm);
         wlptp2.inc:=round(sin(wlptp2.azm))*wlptp2.inc;
         wlptp2.azm:=pi/2;
         wlpt2[2].inc:=round(sin(wlpt2[2].azm))*wlpt2[2].inc;
         wlpt2[2].azm:=pi/2;
         jjj:=0;
         for iii := 2 to 5 do
          begin
           CH2DC1(wlptp2.INC,a6.ew-a4.ew,a6.tvd-a4.tvd,wlpt2[2].INC,wlpt[0].DLS*power(-1,trunc(iii/2)),wlpt[2].DLS*power(-1,iii),wlpta1,wlpta2,okk);
           if okk then
            begin
             jjj:=jjj+1;
             kkk:=iii;
             break;
            end;
          end;
         if jjj<>0 then
          begin
           qqq:=qqq+1;
           if (okk)and(qq=1) then
            form07.RadioButton1.Enabled:=true
           else if (qq=1)and(not okk) then
            form07.RadioButton1.Enabled:=false;
           if (okk)and(qq=2) then
            form07.RadioButton2.Enabled:=true
           else if (qq=2)and(not okk) then
            form07.RadioButton2.Enabled:=false;
          end;
        end;
       if qqq=0 then
        begin
         showmessage('This Operation Cannot be Done!');
         exit;
        end
       else if qqq=1 then
        begin
         if form07.RadioButton1.Enabled then
           wlpt[2].AZM:=strtofloat(form07.RadioButton1.Caption)*pi/180
         else
          wlpt[2].AZM:=strtofloat(form07.RadioButton2.Caption)*pi/180;
        end
       else if qqq>1 then
        begin
         form07.ShowModal;
         if form07.RadioButton1.checked then
          wlpt[2].AZM:=strtofloat(form07.RadioButton1.Caption)*pi/180
         else
          wlpt[2].AZM:=strtofloat(form07.RadioButton2.Caption)*pi/180;
        end;
      end;
     A1.ns:=wlptp.NS;      A1.EW:=wlptp.EW;     A1.TVD:=wlptp.TVD;
     surtovct(wlptp.INC,wlptp.AZM,a2.ns,a2.ew,a2.tvd);
     A3.ns:=wlpt[2].NS-a1.ns;    A3.EW:=wlpt[2].EW-a1.ew;   A3.TVD:=wlpt[2].TVD-a1.tvd;
     a4.ns:=a1.ns;         a4.ew:=a1.ew;        a4.tvd:=a1.tvd;
     a5.ns:=a2.ns;         a5.ew:=a2.ew;        a5.tvd:=a2.tvd;
     a6.ns:=a3.ns+a1.ns;         a6.ew:=a3.ew+a1.ew;        a6.tvd:=a3.tvd+a1.tvd;
     surtovct(wlpt[2].INC,wlpt[2].AZM,a7.ns,a7.ew,a7.tvd);
     plane(A10,A2,A3,A7,theta);
     vcttosur(a7.ns,a7.ew,a7.tvd,wlpt2[2].inc,wlpt2[2].azm);
     plane(A1,A2,A3,A4,theta);
     plane(A10,A2,A3,A5,theta);
     plane(A1,A2,A3,A6,theta);
     vcttosur(a5.ns,a5.ew,a5.tvd,wlptp2.inc,wlptp2.azm);
     wlptp2.inc:=round(sin(wlptp2.azm))*wlptp2.inc;
     wlptp2.azm:=pi/2;
     wlpt2[2].inc:=round(sin(wlpt2[2].azm))*wlpt2[2].inc;
     wlpt2[2].azm:=pi/2;
     jjj:=0;
     for iii := 2 to 5 do
      begin
       CH2DC1(wlptp2.INC,a6.ew-a4.ew,a6.tvd-a4.tvd,wlpt2[2].INC,wlpt[0].DLS*power(-1,trunc(iii/2)),wlpt[2].DLS*power(-1,iii),wlpta1,wlpta2,okk);
       if okk then
        begin
         jjj:=jjj+1;
         kkk:=iii;
         break;
        end;
      end;
     iii:=kkk;
     CH2DC1(wlptp2.INC,a6.ew-a4.ew,a6.tvd-a4.tvd,wlpt2[2].INC,wlpt[0].DLS*power(-1,trunc(iii/2)),wlpt[2].DLS*power(-1,iii),wlpta1,wlpta2,okk);
     if OKK=FALSE then
      BEGIN
       SHOWMESSAGE('THIS OPERATION CANNOT BE DONE');
       EXIT;
      END;
     wlpt[0].DLS:=ABS(wlpt[0].DLS);
     wlpt[2].DLS:=ABS(wlpt[1].DLS);

     a5.ns:=wlpta2[0].ns+a4.ns;    a5.ew:=wlpta2[0].ew+a4.ew;   a5.tvd:=wlpta2[0].tvd+a4.tvd;
     a6.ns:=wlpta2[1].ns+a4.ns;    a6.ew:=wlpta2[1].ew+a4.ew;   a6.tvd:=wlpta2[1].tvd+a4.tvd;
     a7.ns:=wlpta2[2].ns+a4.ns;    a7.ew:=wlpta2[2].ew+a4.ew;   a7.tvd:=wlpta2[2].tvd+a4.tvd;
     revplane(A1,A2,A3,theta,A5);
     revplane(A1,A2,A3,theta,A6);
     revplane(A1,A2,A3,theta,A7);
     vcttosur(A6.NS-a5.ns,A6.EW-a5.ew,A6.TVD-a5.tvd,wlpt2[0].inc,wlpt2[0].azm);
     wlpt2[1].inc:=wlpt2[0].inc;    wlpt2[1].azm:=wlpt2[0].azm;
     wlpt2[2].inc:=wlpt[2].inc;     wlpt2[2].azm:=wlpt[2].azm;

     wlpt2[0].ns:=a5.ns;   wlpt2[0].ew:=a5.ew;  wlpt2[0].tvd:=a5.tvd;
     wlpt2[1].ns:=a6.ns;   wlpt2[1].ew:=a6.ew;  wlpt2[1].tvd:=a6.tvd;
     wlpt2[2].ns:=a7.ns;   wlpt2[2].ew:=a7.ew;  wlpt2[2].tvd:=a7.tvd;

     wlpt2[0].MD:=wlpta2[0].MD+wlptp.MD;
     wlpt2[0].dls:=abs(wlpta2[0].dls);
     wlpt2[0].cmt:=wlpta2[0].cmt;
     wlpt2[0].dmd:=wlpta2[0].dmd;
     wlpt2[0].tr:=(wlpt2[0].azm-wlptp.azm)/wlpt2[0].dmd;
     wlpt2[0].br:=(wlpt2[0].inc-wlptp.inc)/wlpt2[0].dmd;

     wlpt2[1].MD:=wlpta2[1].MD+wlptp.MD;
     wlpt2[1].dls:=abs(wlpta2[1].dls);
     wlpt2[1].cmt:=wlpta2[1].cmt;
     wlpt2[1].dmd:=wlpta2[1].dmd;
     wlpt2[1].tr:=(wlpt2[1].azm-wlpt[0].azm)/wlpt2[1].dmd;
     wlpt2[1].br:=(wlpt2[1].inc-wlpt[0].inc)/wlpt2[1].dmd;

     wlpt2[2].MD:=wlpta2[2].MD+wlptp.MD;
     wlpt2[2].dls:=abs(wlpta2[2].dls);
     wlpt2[2].cmt:=wlpta2[2].cmt;
     wlpt2[2].dmd:=wlpta2[2].dmd;
     wlpt2[2].tr:=(wlpt2[2].azm-wlpt[1].azm)/wlpt2[2].dmd;
     wlpt2[2].br:=(wlpt2[2].inc-wlpt[1].inc)/wlpt2[2].dmd;

     if nn=1 then
      begin
       v[1].ns:=WLPT2[0].ns-wlptpp.ns;
       v[1].ew:=WLPT2[0].ew-wlptpp.ew;
       wlpt2[0].VSEC:=(v[0].ns*v[1].ns+v[0].ew*v[1].ew)/sqrt(v[0].ns*v[0].ns+v[0].ew*v[0].ew);
       v[1].ns:=WLPT2[1].ns-wlptpp.ns;
       v[1].ew:=WLPT2[1].ew-wlptpp.ew;
       wlpt2[1].VSEC:=(v[0].ns*v[1].ns+v[0].ew*v[1].ew)/sqrt(v[0].ns*v[0].ns+v[0].ew*v[0].ew);
       v[1].ns:=WLPT2[2].ns-wlptpp.ns;
       v[1].ew:=WLPT2[2].ew-wlptpp.ew;
       wlpt2[2].VSEC:=(v[0].ns*v[1].ns+v[0].ew*v[1].ew)/sqrt(v[0].ns*v[0].ns+v[0].ew*v[0].ew);
       if sin(wlpt2[1].dls*wlpt2[1].dmd)<>0 then
        begin
         if sin(wlpt2[1].inc)*sin(wlpt2[1].azm-wlpt2[0].azm)<>0 then
          begin
           wlpt2[0].tf:=sign(sin(wlpt2[1].inc)*sin(wlpt2[1].azm-wlpt2[0].azm)/sin(wlpt2[1].dls*wlpt2[1].dmd))
           *arccos((cos(wlpt2[0].inc)*cos(wlpt2[1].dls*wlpt2[1].dmd)-cos(wlpt2[1].inc))/(sin(wlpt2[0].inc)*sin(wlpt2[1].dls*wlpt2[1].dmd)));
          end
         else
          begin
           wlpt2[0].tf:=arccos((cos(wlpt2[0].inc)*cos(wlpt2[1].dls*wlpt2[1].dmd)-cos(wlpt2[1].inc))/(sin(wlpt2[0].inc)*sin(wlpt2[1].dls*wlpt2[1].dmd)));
          end;
        end;
       if sin(wlpt2[2].dls*wlpt2[2].dmd)<>0 then
        begin
         if sin(wlpt2[2].inc)*sin(wlpt2[2].azm-wlpt2[1].azm)<>0 then
          begin
           wlpt2[1].tf:=sign(sin(wlpt2[2].inc)*sin(wlpt2[2].azm-wlpt2[1].azm)/sin(wlpt2[2].dls*wlpt2[2].dmd))
           *arccos((cos(wlpt2[1].inc)*cos(wlpt2[2].dls*wlpt2[2].dmd)-cos(wlpt2[2].inc))/(sin(wlpt2[1].inc)*sin(wlpt2[2].dls*wlpt2[2].dmd)));
          end
         else
          begin
           wlpt2[1].tf:=arccos((cos(wlpt2[1].inc)*cos(wlpt2[2].dls*wlpt2[2].dmd)-cos(wlpt2[2].inc))/(sin(wlpt2[1].inc)*sin(wlpt2[2].dls*wlpt2[2].dmd)));
          end;
        end;
       if (sin(wlptf.dls*wlptf.dmd)<>0)and(kk<>ll) then
        begin
         if sin(wlptf.inc)*sin(wlptf.azm-wlpt2[1].azm)<>0 then
          begin
           wlpt2[2].tf:=sign(sin(wlptf.inc)*sin(wlptf.azm-wlpt2[2].azm)/sin(wlptf.dls*wlptf.dmd))
           *arccos((cos(wlpt2[2].inc)*cos(wlptf.dls*wlptf.dmd)-cos(wlptf.inc))/(sin(wlpt2[2].inc)*sin(wlptf.dls*wlptf.dmd)));
          end
         else
          begin
           wlpt2[2].tf:=arccos((cos(wlpt2[2].inc)*cos(wlptf.dls*wlptf.dmd)-cos(wlptf.inc))/(sin(wlpt2[2].inc)*sin(wlptf.dls*wlptf.dmd)));
          end;
        end
       else if kk=ll then
        begin
         wlpt2[2].tf:=0
        end;

      end;
     cellfill(wlpt2,2,kk);
     md:=wlpt2[2].MD-wlptp.MD;
     if (md/ppf)=trunc(md/ppf) then
      m:=2*(trunc(md/ppf))+1
     else
      m:=2*(trunc(md/ppf)+2)+1;
     for i := 0 to (m-1) do
      begin
       wlpta1[i].order:=wlpt[2].order;
       wlpta1[i].typ:=kk;
      end;
     wlpt1[kk,0].order:=kk;
     wlpt1[kk,0].typ:=rocal[1];
     tableshow1(wlpta1,wlptpp,wlptp,wlpt2[2],a1,a2,a3,a4,v[0],kk,rocal[1],theta,MD,ll,nn,wlpta1);
     for i:= 0 to m - 1 do
      begin
       wlpt1[kk,i].MD:=wlpta1[i].MD;
       wlpt1[kk,i].INC:=wlpta1[i].INC;
       wlpt1[kk,i].azm:=wlpta1[i].AZM;
       wlpt1[kk,i].TVD:=wlpta1[i].TVD;
       wlpt1[kk,i].VSEC:=wlpta1[i].VSEC;
       wlpt1[kk,i].NS:=wlpta1[i].NS;
       wlpt1[kk,i].EW:=wlpta1[i].EW;
       wlpt1[kk,i].DLS:=wlpta1[i].DLS;
       wlpt1[kk,i].tf:=wlpta1[i].TF;
       wlpt1[kk,i].tr:=wlpta1[i].TR;
       wlpt1[kk,i].br:=wlpta1[i].BR;
       wlpt1[kk,i].dmd:=wlpta1[i].DMD;
       wlpt1[kk,i].order:=wlpta1[i].ORDER;
       wlpt1[kk,i].typ:=wlpta1[i].TYP;
       wlpt1[kk,i].CMT:=wlpta1[i].CMT;
      end;
    end
   else if (rocal[1] mod 100=6)or(rocal[1] mod 100=16) then
    begin
     if trunc(rocal[1]/100)=1 then
       ddmmdd:=true
     else
       ddmmdd:=false;
     A1.ns:=wlptp.NS;      A1.EW:=wlptp.EW;     A1.TVD:=wlptp.TVD;
     surtovct(wlptp.INC,wlptp.AZM,a2.ns,a2.ew,a2.tvd);
     A3.ns:=wlpt[3].NS-a1.ns;    A3.EW:=wlpt[3].EW-a1.ew;   A3.TVD:=wlpt[3].TVD-a1.tvd;
     if trunc(rocal[1]/100)=1 then
      begin
       if (rocal[1]  mod 100 = 16) then
        begin
         incfind(a2,a3,wlpt[3].AZM,wlpt[3].inc);
        end
       else
        begin
         qqq:=0;
         for qq := 1 to 2 do
          begin
           a4.ns:=a1.ns;         a4.ew:=a1.ew;        a4.tvd:=a1.tvd;
           a5.ns:=a2.ns;         a5.ew:=a2.ew;        a5.tvd:=a2.tvd;
           a6.ns:=a3.ns+a1.ns;         a6.ew:=a3.ew+a1.ew;        a6.tvd:=a3.tvd+a1.tvd;
           azmfind(a1,a2,a3,wlpt[3].inc,qq,wlpt[3].azm);
           surtovct(wlpt[3].INC,wlpt[3].AZM,a7.ns,a7.ew,a7.tvd);
           plane(A10,A2,A3,A7,theta);
           vcttosur(a7.ns,a7.ew,a7.tvd,wlpt2[3].inc,wlpt2[3].azm);
           a4.ns:=a1.ns;         a4.ew:=a1.ew;        a4.tvd:=a1.tvd;
           a5.ns:=a2.ns;         a5.ew:=a2.ew;        a5.tvd:=a2.tvd;
           a6.ns:=a3.ns;         a6.ew:=a3.ew;        a6.tvd:=a3.tvd;
           plane(A1,A2,A3,A4,theta);
           plane(A10,A2,A3,A5,theta);
           plane(A1,A2,A3,A6,theta);
           vcttosur(a5.ns,a5.ew,a5.tvd,wlptp2.inc,wlptp2.azm);
           wlptp2.inc:=round(sin(wlptp2.azm))*wlptp2.inc;
           wlptp2.azm:=pi/2;
           wlpt2[3].inc:=round(sin(wlpt2[3].azm))*wlpt2[3].inc;
           wlpt2[3].azm:=pi/2;
           jjj:=0;
           for iii := 2 to 5 do
            begin
             CH2DC2(wlptp2.INC,a6.ew-a4.ew,a6.tvd-a4.tvd,wlpt2[3].INC,wlpt[0].DLS*power(-1,trunc(iii/2)),wlpt[2].DLS*power(-1,iii),wlpt2[0].INC,wlpt[3].dmd,wlpta1,wlpta2,okk,ddmmdd);
             if okk then
              begin
               jjj:=jjj+1;
               kkk:=iii;
               break;
              end;
            end;
           if jjj<>0 then
            begin
             qqq:=qqq+1;
             if (okk)and(qq=1) then
              form07.RadioButton1.Enabled:=true
             else if (qq=1)and(not okk) then
              form07.RadioButton1.Enabled:=false;
             if (okk)and(qq=2) then
              form07.RadioButton2.Enabled:=true
             else if (qq=2)and(not okk) then
              form07.RadioButton2.Enabled:=false;
            end;
          end;
         if qqq=0 then
          begin
           showmessage('This Operation Cannot be Done!');
           exit;
          end
         else if qqq=1 then
          begin
           if form07.RadioButton1.Enabled then
             wlpt[3].AZM:=strtofloat(form07.RadioButton1.Caption)*pi/180
           else
             wlpt[3].AZM:=strtofloat(form07.RadioButton2.Caption)*pi/180;
          end
         else if qqq>1 then
          begin
           form07.ShowModal;
           if form07.RadioButton1.checked then
             wlpt[3].AZM:=strtofloat(form07.RadioButton1.Caption)*pi/180
           else
             wlpt[3].AZM:=strtofloat(form07.RadioButton2.Caption)*pi/180;
          end;
        end;
       a4.ns:=a1.ns;         a4.ew:=a1.ew;        a4.tvd:=a1.tvd;
       a5.ns:=a2.ns;         a5.ew:=a2.ew;        a5.tvd:=a2.tvd;
       a6.ns:=a3.ns+a1.ns;         a6.ew:=a3.ew+a1.ew;        a6.tvd:=a3.tvd+a1.tvd;
       surtovct(wlpt[3].INC,wlpt[3].AZM,a7.ns,a7.ew,a7.tvd);
       plane(A10,A2,A3,A7,theta);
       vcttosur(a7.ns,a7.ew,a7.tvd,wlpt2[3].inc,wlpt2[3].azm);
       a4.ns:=a1.ns;         a4.ew:=a1.ew;        a4.tvd:=a1.tvd;
       a5.ns:=a2.ns;         a5.ew:=a2.ew;        a5.tvd:=a2.tvd;
       a6.ns:=a3.ns;         a6.ew:=a3.ew;        a6.tvd:=a3.tvd;
       plane(A1,A2,A3,A4,theta);
       plane(A10,A2,A3,A5,theta);
       plane(A1,A2,A3,A6,theta);
       vcttosur(a5.ns,a5.ew,a5.tvd,wlptp2.inc,wlptp2.azm);
       wlptp2.inc:=round(sin(wlptp2.azm))*wlptp2.inc;
       wlptp2.azm:=pi/2;
       wlpt2[3].inc:=round(sin(wlpt2[3].azm))*wlpt2[3].inc;
       wlpt2[3].azm:=pi/2;
       jjj:=0;
       for iii := 2 to 5 do
        begin
         CH2DC2(wlptp2.INC,a6.ew-a4.ew,a6.tvd-a4.tvd,wlpt2[3].INC,wlpt[0].DLS*power(-1,trunc(iii/2)),wlpt[2].DLS*power(-1,iii),wlpt2[0].INC,wlpt[3].dmd,wlpta1,wlpta2,okk,ddmmdd);
         if okk then
          begin
           jjj:=jjj+1;
           kkk:=iii;
           break;
          end;
        end;
       iii:=kkk;
       CH2DC2(wlptp2.INC,a6.ew-a4.ew,a6.tvd-a4.tvd,wlpt2[3].INC,wlpt[0].DLS*power(-1,trunc(iii/2)),wlpt[2].DLS*power(-1,iii),wlpt2[0].INC,wlpt[3].dmd,wlpta1,wlpta2,okk,ddmmdd);
       if OKK=FALSE then
        BEGIN
         SHOWMESSAGE('THIS OPERATION CANNOT BE DONE');
         EXIT;
        END;
      end
     else
      begin
       if (rocal[1] =16) then
        begin
         incfind(a2,a3,wlpt[0].AZM,wlpt[0].inc);
         incfind(a2,a3,wlpt[3].AZM,wlpt[3].inc);
         a4.ns:=a1.ns;         a4.ew:=a1.ew;        a4.tvd:=a1.tvd;
         a5.ns:=a2.ns;         a5.ew:=a2.ew;        a5.tvd:=a2.tvd;
         a6.ns:=a3.ns+a1.ns;         a6.ew:=a3.ew+a1.ew;        a6.tvd:=a3.tvd+a1.tvd;
         surtovct(wlpt[3].INC,wlpt[3].AZM,a7.ns,a7.ew,a7.tvd);
         plane(A10,A2,A3,A7,theta);
         vcttosur(a7.ns,a7.ew,a7.tvd,wlpt2[3].inc,wlpt2[3].azm);

         surtovct(wlpt[0].INC,wlpt[0].AZM,a7.ns,a7.ew,a7.tvd);
         plane(A10,A2,A3,A7,theta);
         vcttosur(a7.ns,a7.ew,a7.tvd,wlpt2[0].inc,wlpt2[0].azm);

         a4.ns:=a1.ns;         a4.ew:=a1.ew;        a4.tvd:=a1.tvd;
         a5.ns:=a2.ns;         a5.ew:=a2.ew;        a5.tvd:=a2.tvd;
         a6.ns:=a3.ns;         a6.ew:=a3.ew;        a6.tvd:=a3.tvd;
         plane(A1,A2,A3,A4,theta);
         plane(A10,A2,A3,A5,theta);
         plane(A1,A2,A3,A6,theta);
         vcttosur(a5.ns,a5.ew,a5.tvd,wlptp2.inc,wlptp2.azm);
         wlptp2.inc:=round(sin(wlptp2.azm))*wlptp2.inc;
         wlptp2.azm:=pi/2;
         wlpt2[0].inc:=round(sin(wlpt2[0].azm))*wlpt2[0].inc;
         wlpt2[0].azm:=pi/2;
         wlpt2[3].inc:=round(sin(wlpt2[3].azm))*wlpt2[3].inc;
         wlpt2[3].azm:=pi/2;
         jjj:=0;
         for iii := 2 to 5 do
          begin
           CH2DC2(wlptp2.INC,a6.ew-a4.ew,a6.tvd-a4.tvd,wlpt2[3].INC,wlpt[0].DLS*power(-1,trunc(iii/2)),wlpt[2].DLS*power(-1,iii),wlpt2[0].INC,wlpt[3].dmd,wlpta1,wlpta2,okk,ddmmdd);
           if okk then
            begin
             jjj:=jjj+1;
             kkk:=iii;
             break;
            end;
          end;
         iii:=kkk;
         CH2DC2(wlptp2.INC,a6.ew-a4.ew,a6.tvd-a4.tvd,wlpt2[3].INC,wlpt[0].DLS*power(-1,trunc(iii/2)),wlpt[2].DLS*power(-1,iii),wlpt2[0].INC,wlpt[3].dmd,wlpta1,wlpta2,okk,ddmmdd);
         if OKK=FALSE then
          BEGIN
           SHOWMESSAGE('THIS OPERATION CANNOT BE DONE');
           EXIT;
          END;
        end
       else
        begin
         for pp := 1 to 2 do
           for qq := 1 to 2 do
             azmazm[pp,qq]:=false;
         for pp := 1 to 2 do
          begin
           a4.ns:=a1.ns;         a4.ew:=a1.ew;        a4.tvd:=a1.tvd;
           a5.ns:=a2.ns;         a5.ew:=a2.ew;        a5.tvd:=a2.tvd;
           a6.ns:=a3.ns+a1.ns;         a6.ew:=a3.ew+a1.ew;        a6.tvd:=a3.tvd+a1.tvd;
           azmfind(a1,a2,a3,wlpt[0].inc,pp,wlpt[0].azm);
           aazzmm[1,pp]:=wlpt[0].azm;
           form07.ListBox1.Items.Append(floattostr(round(100*180*wlpt[0].azm/pi)/100));
          end;
         qqq:=0;
         for qq := 1 to 2 do
          begin
           a4.ns:=a1.ns;         a4.ew:=a1.ew;        a4.tvd:=a1.tvd;
           a5.ns:=a2.ns;         a5.ew:=a2.ew;        a5.tvd:=a2.tvd;
           a6.ns:=a3.ns+a1.ns;         a6.ew:=a3.ew+a1.ew;        a6.tvd:=a3.tvd+a1.tvd;
           azmfind(a1,a2,a3,wlpt[3].inc,qq,wlpt[3].azm);
           aazzmm[2,qq]:=wlpt[3].azm;
          end;
         for pp := 1 to 2 do
          begin
           for qq := 1 to 2 do
            begin
             wlpt[0].azm:=aazzmm[1,pp];
             wlpt[3].azm:=aazzmm[2,qq];
             a4.ns:=a1.ns;         a4.ew:=a1.ew;        a4.tvd:=a1.tvd;
             a5.ns:=a2.ns;         a5.ew:=a2.ew;        a5.tvd:=a2.tvd;
             a6.ns:=a3.ns+a1.ns;         a6.ew:=a3.ew+a1.ew;        a6.tvd:=a3.tvd+a1.tvd;
             surtovct(wlpt[3].INC,wlpt[3].AZM,a7.ns,a7.ew,a7.tvd);
             plane(A10,A2,A3,A7,theta);
             vcttosur(a7.ns,a7.ew,a7.tvd,wlpt2[3].inc,wlpt2[3].azm);

             surtovct(wlpt[0].INC,wlpt[0].AZM,a7.ns,a7.ew,a7.tvd);
             plane(A10,A2,A3,A7,theta);
             vcttosur(a7.ns,a7.ew,a7.tvd,wlpt2[0].inc,wlpt2[0].azm);

             a4.ns:=a1.ns;         a4.ew:=a1.ew;        a4.tvd:=a1.tvd;
             a5.ns:=a2.ns;         a5.ew:=a2.ew;        a5.tvd:=a2.tvd;
             a6.ns:=a3.ns;         a6.ew:=a3.ew;        a6.tvd:=a3.tvd;
             plane(A1,A2,A3,A4,theta);
             plane(A10,A2,A3,A5,theta);
             plane(A1,A2,A3,A6,theta);
             vcttosur(a5.ns,a5.ew,a5.tvd,wlptp2.inc,wlptp2.azm);
             wlptp2.inc:=round(sin(wlptp2.azm))*wlptp2.inc;
             wlptp2.azm:=pi/2;
             wlpt2[0].inc:=round(sin(wlpt2[0].azm))*wlpt2[0].inc;
             wlpt2[0].azm:=pi/2;
             wlpt2[3].inc:=round(sin(wlpt2[3].azm))*wlpt2[3].inc;
             wlpt2[3].azm:=pi/2;
             jjj:=0;
             for iii := 2 to 5 do
              begin
               CH2DC2(wlptp2.INC,a6.ew-a4.ew,a6.tvd-a4.tvd,wlpt2[3].INC,wlpt[0].DLS*power(-1,trunc(iii/2)),wlpt[2].DLS*power(-1,iii),wlpt2[0].INC,wlpt[3].dmd,wlpta1,wlpta2,okk,ddmmdd);
               if okk then
                begin
                 jjj:=jjj+1;
                 kkk:=iii;
                 break;
                end;
              end;
             if okk then
              begin
               azmazm[pp,qq]:=true;
              end;
            end;
          end;
         iii:=0;
         jjj:=0;
         for pp := 1 to 2 do
          begin
           if azmazm[1,pp] then
             iii:=iii+1;
           if azmazm[2,pp] then
             jjj:=jjj+1;
          end;
         if iii+jjj=0 then
          BEGIN
           SHOWMESSAGE('THIS OPERATION CANNOT BE DONE');
           EXIT;
          END;
         if iii+jjj=1 then
          begin
           for pp := 1 to 2 do
            begin
             for qq := 1 to 2 do
              begin
               if azmazm[pp,qq] then
                begin
                 wlpt[0].azm:=aazzmm[1,pp];
                 wlpt[3].azm:=aazzmm[2,qq];
                end;
              end;
            end;
          end
         else
          begin
           form07.radio;
           form07.listbox1.Items.Clear;
           form07.listbox1.Visible:=true;
           for pp := 1 to 2 do
            begin
             form07.ListBox1.Items.Append(floattostr(round(100*180*aazzmm[1,pp]/pi)/100));
            end;
           FORM07.ListBox1.ItemIndex:=0;
           form07.ShowModal;
           if form07.RadioButton1.Checked then
             wlpt[3].azm:=strtofloat(form07.RadioButton1.Caption)*pi/180
           else
             wlpt[3].azm:=strtofloat(form07.RadioButton2.Caption)*pi/180;
           wlpt[0].azm:=strtofloat(form07.ListBox1.Items.Strings[form07.ListBox1.ItemIndex])*pi/180;
          end;
         a4.ns:=a1.ns;         a4.ew:=a1.ew;        a4.tvd:=a1.tvd;
         a5.ns:=a2.ns;         a5.ew:=a2.ew;        a5.tvd:=a2.tvd;
         a6.ns:=a3.ns+a1.ns;         a6.ew:=a3.ew+a1.ew;        a6.tvd:=a3.tvd+a1.tvd;
         surtovct(wlpt[3].INC,wlpt[3].AZM,a7.ns,a7.ew,a7.tvd);
         plane(A10,A2,A3,A7,theta);
         vcttosur(a7.ns,a7.ew,a7.tvd,wlpt2[3].inc,wlpt2[3].azm);

         surtovct(wlpt[0].INC,wlpt[0].AZM,a7.ns,a7.ew,a7.tvd);
         plane(A10,A2,A3,A7,theta);
         vcttosur(a7.ns,a7.ew,a7.tvd,wlpt2[0].inc,wlpt2[0].azm);

         a4.ns:=a1.ns;         a4.ew:=a1.ew;        a4.tvd:=a1.tvd;
         a5.ns:=a2.ns;         a5.ew:=a2.ew;        a5.tvd:=a2.tvd;
         a6.ns:=a3.ns;         a6.ew:=a3.ew;        a6.tvd:=a3.tvd;
         plane(A1,A2,A3,A4,theta);
         plane(A10,A2,A3,A5,theta);
         plane(A1,A2,A3,A6,theta);
         vcttosur(a5.ns,a5.ew,a5.tvd,wlptp2.inc,wlptp2.azm);
         wlptp2.inc:=round(sin(wlptp2.azm))*wlptp2.inc;
         wlptp2.azm:=pi/2;
         wlpt2[0].inc:=round(sin(wlpt2[0].azm))*wlpt2[0].inc;
         wlpt2[0].azm:=pi/2;
         wlpt2[3].inc:=round(sin(wlpt2[3].azm))*wlpt2[3].inc;
         wlpt2[3].azm:=pi/2;
         jjj:=0;
         for iii := 2 to 5 do
          begin
           CH2DC2(wlptp2.INC,a6.ew-a4.ew,a6.tvd-a4.tvd,wlpt2[3].INC,wlpt[0].DLS*power(-1,trunc(iii/2)),wlpt[2].DLS*power(-1,iii),wlpt2[0].INC,wlpt[3].dmd,wlpta1,wlpta2,okk,ddmmdd);
           if okk then
            begin
             jjj:=jjj+1;
             kkk:=iii;
             break;
            end;
          end;
         if OKK=FALSE then
          BEGIN
           SHOWMESSAGE('THIS OPERATION CANNOT BE DONE');
           EXIT;
          END;
         iii:=kkk;
         CH2DC2(wlptp2.INC,a6.ew-a4.ew,a6.tvd-a4.tvd,wlpt2[3].INC,wlpt[0].DLS*power(-1,trunc(iii/2)),wlpt[2].DLS*power(-1,iii),wlpt2[0].INC,wlpt[3].dmd,wlpta1,wlpta2,okk,ddmmdd);
        end;
      end;
     WLPT[0].DLS:=ABS(WLPT[0].DLS);
     WLPT[2].DLS:=ABS(WLPT[2].DLS);

     a5.ns:=wlpta2[0].ns+a4.ns;    a5.ew:=wlpta2[0].ew+a4.ew;   a5.tvd:=wlpta2[0].tvd+a4.tvd;
     a6.ns:=wlpta2[1].ns+a4.ns;    a6.ew:=wlpta2[1].ew+a4.ew;   a6.tvd:=wlpta2[1].tvd+a4.tvd;
     a7.ns:=wlpta2[2].ns+a4.ns;    a7.ew:=wlpta2[2].ew+a4.ew;   a7.tvd:=wlpta2[2].tvd+a4.tvd;
     a8.ns:=wlpta2[3].ns+a4.ns;    a8.ew:=wlpta2[3].ew+a4.ew;   a8.tvd:=wlpta2[3].tvd+a4.tvd;
     revplane(A1,A2,A3,theta,A5);
     revplane(A1,A2,A3,theta,A6);
     revplane(A1,A2,A3,theta,A7);
     revplane(A1,A2,A3,theta,A8);
     vcttosur(A6.NS-a5.ns,A6.EW-a5.ew,A6.TVD-a5.tvd,wlpt2[0].inc,wlpt2[0].azm);
     wlpt2[1].inc:=wlpt2[0].inc;    wlpt2[1].azm:=wlpt2[0].azm;
     vcttosur(A8.NS-a7.ns,A8.EW-a7.ew,A8.TVD-a7.tvd,wlpt2[2].inc,wlpt2[2].azm);
     wlpt2[3].inc:=wlpt2[2].inc;    wlpt2[3].azm:=wlpt2[2].azm;

     wlpt2[0].ns:=a5.ns;   wlpt2[0].ew:=a5.ew;  wlpt2[0].tvd:=a5.tvd;
     wlpt2[1].ns:=a6.ns;   wlpt2[1].ew:=a6.ew;  wlpt2[1].tvd:=a6.tvd;
     wlpt2[2].ns:=a7.ns;   wlpt2[2].ew:=a7.ew;  wlpt2[2].tvd:=a7.tvd;
     wlpt2[3].ns:=a8.ns;   wlpt2[3].ew:=a8.ew;  wlpt2[3].tvd:=a8.tvd;

     wlpt2[0].MD:=wlpta2[0].MD+wlptp.MD;
     wlpt2[0].dls:=abs(wlpta2[0].dls);
     wlpt2[0].cmt:=wlpta2[0].cmt;
     wlpt2[0].dmd:=wlpta2[0].dmd;
     wlpt2[0].tr:=(wlpt2[0].azm-wlptp.azm)/wlpt2[0].dmd;
     wlpt2[0].br:=(wlpt2[0].inc-wlptp.inc)/wlpt2[0].dmd;

     wlpt2[1].MD:=wlpta2[1].MD+wlptp.MD;
     wlpt2[1].dls:=abs(wlpta2[1].dls);
     wlpt2[1].cmt:=wlpta2[1].cmt;
     wlpt2[1].dmd:=wlpta2[1].dmd;
     wlpt2[1].tr:=(wlpt2[1].azm-wlpt[0].azm)/wlpt2[1].dmd;
     wlpt2[1].br:=(wlpt2[1].inc-wlpt[0].inc)/wlpt2[1].dmd;

     wlpt2[2].MD:=wlpta2[2].MD+wlptp.MD;
     wlpt2[2].dls:=abs(wlpta2[2].dls);
     wlpt2[2].cmt:=wlpta2[2].cmt;
     wlpt2[2].dmd:=wlpta2[2].dmd;
     wlpt2[2].tr:=(wlpt2[2].azm-wlpt[1].azm)/wlpt2[2].dmd;
     wlpt2[2].br:=(wlpt2[2].inc-wlpt[1].inc)/wlpt2[2].dmd;

     wlpt2[3].MD:=wlpta2[3].MD+wlptp.MD;
     wlpt2[3].dls:=abs(wlpta2[3].dls);
     wlpt2[3].cmt:=wlpta2[3].cmt;
     wlpt2[3].dmd:=wlpta2[3].dmd;
     wlpt2[3].tr:=(wlpt2[3].azm-wlpt[2].azm)/wlpt2[3].dmd;
     wlpt2[3].br:=(wlpt2[3].inc-wlpt[2].inc)/wlpt2[3].dmd;

     if nn=1 then
      begin
       v[1].ns:=WLPT2[0].ns-wlptpp.ns;
       v[1].ew:=WLPT2[0].ew-wlptpp.ew;
       wlpt2[0].VSEC:=(v[0].ns*v[1].ns+v[0].ew*v[1].ew)/sqrt(v[0].ns*v[0].ns+v[0].ew*v[0].ew);
       v[1].ns:=WLPT2[1].ns-wlptpp.ns;
       v[1].ew:=WLPT2[1].ew-wlptpp.ew;
       wlpt2[1].VSEC:=(v[0].ns*v[1].ns+v[0].ew*v[1].ew)/sqrt(v[0].ns*v[0].ns+v[0].ew*v[0].ew);
       v[1].ns:=WLPT2[2].ns-wlptpp.ns;
       v[1].ew:=WLPT2[2].ew-wlptpp.ew;
       wlpt2[2].VSEC:=(v[0].ns*v[1].ns+v[0].ew*v[1].ew)/sqrt(v[0].ns*v[0].ns+v[0].ew*v[0].ew);
       v[1].ns:=WLPT2[3].ns-wlptpp.ns;
       v[1].ew:=WLPT2[3].ew-wlptpp.ew;
       wlpt2[3].VSEC:=(v[0].ns*v[1].ns+v[0].ew*v[1].ew)/sqrt(v[0].ns*v[0].ns+v[0].ew*v[0].ew);
       if sin(wlpt2[1].dls*wlpt2[1].dmd)<>0 then
        begin
         if sin(wlpt2[1].inc)*sin(wlpt2[1].azm-wlpt2[0].azm)<>0 then
          begin
           wlpt2[0].tf:=sign(sin(wlpt2[1].inc)*sin(wlpt2[1].azm-wlpt2[0].azm)/sin(wlpt2[1].dls*wlpt2[1].dmd))
           *arccos((cos(wlpt2[0].inc)*cos(wlpt2[1].dls*wlpt2[1].dmd)-cos(wlpt2[1].inc))/(sin(wlpt2[0].inc)*sin(wlpt2[1].dls*wlpt2[1].dmd)));
          end
         else
          begin
           wlpt2[0].tf:=arccos((cos(wlpt2[0].inc)*cos(wlpt2[1].dls*wlpt2[1].dmd)-cos(wlpt2[1].inc))/(sin(wlpt2[0].inc)*sin(wlpt2[1].dls*wlpt2[1].dmd)));
          end;
        end;
       if sin(wlpt2[2].dls*wlpt2[2].dmd)<>0 then
        begin
         if sin(wlpt2[2].inc)*sin(wlpt2[2].azm-wlpt2[1].azm)<>0 then
          begin
           wlpt2[1].tf:=sign(sin(wlpt2[2].inc)*sin(wlpt2[2].azm-wlpt2[1].azm)/sin(wlpt2[2].dls*wlpt2[2].dmd))
           *arccos((cos(wlpt2[1].inc)*cos(wlpt2[2].dls*wlpt2[2].dmd)-cos(wlpt2[2].inc))/(sin(wlpt2[1].inc)*sin(wlpt2[2].dls*wlpt2[2].dmd)));
          end
         else
          begin
           wlpt2[1].tf:=arccos((cos(wlpt2[1].inc)*cos(wlpt2[2].dls*wlpt2[2].dmd)-cos(wlpt2[2].inc))/(sin(wlpt2[1].inc)*sin(wlpt2[2].dls*wlpt2[2].dmd)));
          end;
        end;
       if sin(wlpt2[3].dls*wlpt2[3].dmd)<>0 then
        begin
         if sin(wlpt2[3].inc)*sin(wlpt2[3].azm-wlpt2[2].azm)<>0 then
          begin
           wlpt2[2].tf:=sign(sin(wlpt2[3].inc)*sin(wlpt2[3].azm-wlpt2[2].azm)/sin(wlpt2[3].dls*wlpt2[3].dmd))
           *arccos((cos(wlpt2[2].inc)*cos(wlpt2[3].dls*wlpt2[3].dmd)-cos(wlpt2[3].inc))/(sin(wlpt2[2].inc)*sin(wlpt2[3].dls*wlpt2[3].dmd)));
          end
         else
          begin
           wlpt2[2].tf:=arccos((cos(wlpt2[2].inc)*cos(wlpt2[3].dls*wlpt2[3].dmd)-cos(wlpt2[3].inc))/(sin(wlpt2[2].inc)*sin(wlpt2[3].dls*wlpt2[3].dmd)));
          end;
        end;
       if (sin(wlptf.dls*wlptf.dmd)<>0)and(kk<>ll) then
        begin
         if sin(wlptf.inc)*sin(wlptf.azm-wlpt2[3].azm)<>0 then
          begin
           wlpt2[3].tf:=sign(sin(wlptf.inc)*sin(wlptf.azm-wlpt2[3].azm)/sin(wlptf.dls*wlptf.dmd))
           *arccos((cos(wlpt2[3].inc)*cos(wlptf.dls*wlptf.dmd)-cos(wlptf.inc))/(sin(wlpt2[3].inc)*sin(wlptf.dls*wlptf.dmd)));
          end
         else
          begin
           wlpt2[3].tf:=arccos((cos(wlpt2[3].inc)*cos(wlptf.dls*wlptf.dmd)-cos(wlptf.inc))/(sin(wlpt2[3].inc)*sin(wlptf.dls*wlptf.dmd)));
          end;
        end
       else if kk=ll then
        begin
         wlpt2[3].tf:=0
        end;
       end;
     cellfill(wlpt2,2,kk);
     md:=wlpt2[3].MD-wlptp.MD;
     if (md/ppf)=trunc(md/ppf) then
      m:=2*(trunc(md/ppf))+1
     else
      m:=2*(trunc(md/ppf)+2)+1;
     for i := 0 to (m-1) do
      begin
       wlpta1[i].order:=wlpt[2].order;
       wlpta1[i].typ:=kk;
      end;
     wlpt1[kk,0].order:=kk;
     wlpt1[kk,0].typ:=rocal[1];
     tableshow1(wlpta1,wlptpp,wlptp,wlpt2[3],a1,a2,a3,a4,v[0],kk,rocal[1],theta,MD,ll,nn,wlpta1);
     for i:= 0 to m - 1 do
      begin
       wlpt1[kk,i].MD:=wlpta1[i].MD;
       wlpt1[kk,i].INC:=wlpta1[i].INC;
       wlpt1[kk,i].azm:=wlpta1[i].AZM;
       wlpt1[kk,i].TVD:=wlpta1[i].TVD;
       wlpt1[kk,i].VSEC:=wlpta1[i].VSEC;
       wlpt1[kk,i].NS:=wlpta1[i].NS;
       wlpt1[kk,i].EW:=wlpta1[i].EW;
       wlpt1[kk,i].DLS:=wlpta1[i].DLS;
       wlpt1[kk,i].tf:=wlpta1[i].TF;
       wlpt1[kk,i].tr:=wlpta1[i].TR;
       wlpt1[kk,i].br:=wlpta1[i].BR;
       wlpt1[kk,i].dmd:=wlpta1[i].DMD;
       wlpt1[kk,i].order:=wlpta1[i].ORDER;
       wlpt1[kk,i].typ:=wlpta1[i].TYP;
       wlpt1[kk,i].CMT:=wlpta1[i].CMT;
      end;
    end
   else if (rocal[1]=7)or(rocal[1]=17) then
    begin


    end
   else if (rocal[1]=8)or(rocal[1]=18) then
    begin
     A1.ns:=wlptp.NS;      A1.EW:=wlptp.EW;     A1.TVD:=wlptp.TVD;
     surtovct(wlptp.INC,wlptp.AZM,a2.ns,a2.ew,a2.tvd);
     A3.ns:=wlpt[0].NS-a1.ns;    A3.EW:=wlpt[0].EW-a1.ew;   A3.TVD:=wlpt[0].TVD-a1.tvd;
     a4.ns:=a1.ns;         a4.ew:=a1.ew;        a4.tvd:=a1.tvd;
     a5.ns:=a2.ns;         a5.ew:=a2.ew;        a5.tvd:=a2.tvd;
     a6.ns:=a3.ns+a1.ns;         a6.ew:=a3.ew+a1.ew;        a6.tvd:=a3.tvd+a1.tvd;
     plane(A1,A2,A3,A4,theta);
     plane(A10,A2,A3,A5,theta);
     plane(A1,A2,A3,A6,theta);
     vcttosur(a5.ns,a5.ew,a5.tvd,wlptp2.inc,wlptp2.azm);
     HOCTT(wlptp2.INC,a6.ew-a4.ew,a6.tvd-a4.tvd,wlpta1,wlpta2);
     if wlpta2[0].DLS=0 then
      begin
       goto gotolabel1;
      end;
     a5.ns:=wlpta2[1].ns+a4.ns;    a5.ew:=wlpta2[1].ew+a4.ew;   a5.tvd:=wlpta2[1].tvd+a4.tvd;
     a6.ns:=wlpta2[0].ns+a4.ns;    a6.ew:=wlpta2[0].ew+a4.ew;   a6.tvd:=wlpta2[0].tvd+a4.tvd;
     revplane(A1,A2,A3,theta,A5);
     revplane(A1,A2,A3,theta,A6);
     vcttosur(A6.NS-a5.ns,A6.EW-a5.ew,A6.TVD-a5.tvd,wlpt2[0].inc,wlpt2[0].azm);
     wlpt2[0].ns:=a6.ns;   wlpt2[0].ew:=a6.ew;  wlpt2[0].tvd:=a6.tvd;
     wlpt2[0].MD:=wlpta2[0].MD+wlptp.MD;
     wlpt2[0].dls:=abs(wlpta2[0].dls);
     wlpt2[0].cmt:=wlpta2[0].cmt;
     wlpt2[0].dmd:=wlpta2[0].dmd;
     wlpt2[0].tr:=(wlpt2[0].azm-wlptp.azm)/wlpt2[0].dmd;
     wlpt2[0].br:=(wlpt2[0].inc-wlptp.inc)/wlpt2[0].dmd;

     cellfill(wlpt2,2,kk);
     md:=wlpt2[0].MD-wlptp.MD;
     if (md/ppf)=trunc(md/ppf) then
      m:=2*(trunc(md/ppf))+1
     else
      m:=2*(trunc(md/ppf)+1)+1;
     for i := 0 to (m-1) do
      begin
       wlpta1[i].order:=wlpt[0].order;
       wlpta1[i].typ:=kk;
      end;
     wlpt1[kk,0].order:=kk;
     wlpt1[kk,0].typ:=rocal[1];
     tableshow1(wlpta1,wlptpp,wlptp,wlpt2[0],a1,a2,a3,a4,v[0],kk,rocal[1],theta,MD,ll,nn,wlpta1);
     for i:= 0 to m - 1 do
      begin
       wlpt1[kk,i].MD:=wlpta1[i].MD;
       wlpt1[kk,i].INC:=wlpta1[i].INC;
       wlpt1[kk,i].azm:=wlpta1[i].AZM;
       wlpt1[kk,i].TVD:=wlpta1[i].TVD;
       wlpt1[kk,i].VSEC:=wlpta1[i].VSEC;
       wlpt1[kk,i].NS:=wlpta1[i].NS;
       wlpt1[kk,i].EW:=wlpta1[i].EW;
       wlpt1[kk,i].DLS:=wlpta1[i].DLS;
       wlpt1[kk,i].tf:=wlpta1[i].TF;
       wlpt1[kk,i].tr:=wlpta1[i].TR;
       wlpt1[kk,i].br:=wlpta1[i].BR;
       wlpt1[kk,i].dmd:=wlpta1[i].DMD;
       wlpt1[kk,i].order:=wlpta1[i].ORDER;
       wlpt1[kk,i].typ:=wlpta1[i].TYP;
       wlpt1[kk,i].CMT:=wlpta1[i].CMT;
      end;
    end
   else if (rocal[1]=9)or(rocal[1]=19) then
    begin
     A1.ns:=wlptp.NS;      A1.EW:=wlptp.EW;     A1.TVD:=wlptp.TVD;
     surtovct(wlptp.INC,wlptp.AZM,a2.ns,a2.ew,a2.tvd);
     surtovct(wlpt[1].INC,wlpt[1].AZM,a3.ns,a3.ew,a3.tvd);
     a4.ns:=a1.ns;         a4.ew:=a1.ew;        a4.tvd:=a1.tvd;
     a5.ns:=a2.ns;         a5.ew:=a2.ew;        a5.tvd:=a2.tvd;
     a6.ns:=a3.ns;         a6.ew:=a3.ew;        a6.tvd:=a3.tvd;
     plane(A1,A2,A3,A4,theta);
     plane(A10,A2,A3,A5,theta);
     plane(A10,A2,A3,A6,theta);
     vcttosur(a5.ns,a5.ew,a5.tvd,wlptp2.inc,wlptp2.azm);
     if (rocal[1]=19) then
      incfind(a2,a3,wlpt[0].AZM,wlpt[0].inc)
     else
      begin
       qqq:=0;
       for qq := 1 to 2 do
        begin
         A1.ns:=wlptp.NS;      A1.EW:=wlptp.EW;     A1.TVD:=wlptp.TVD;
         surtovct(wlptp.INC,wlptp.AZM,a2.ns,a2.ew,a2.tvd);
         surtovct(wlpt[1].INC,wlpt[1].AZM,a3.ns,a3.ew,a3.tvd);
         a4.ns:=a1.ns;         a4.ew:=a1.ew;        a4.tvd:=a1.tvd;
         a5.ns:=a2.ns;         a5.ew:=a2.ew;        a5.tvd:=a2.tvd;
         a6.ns:=a3.ns;         a6.ew:=a3.ew;        a6.tvd:=a3.tvd;
         theta:=-999;
         plane(A1,A2,A3,A4,theta);
         plane(A10,A2,A3,A5,theta);
         plane(A10,A2,A3,A6,theta);
         vcttosur(a5.ns,a5.ew,a5.tvd,wlptp2.inc,wlptp2.azm);
         azmfind(a1,a2,a3,wlpt[0].inc,qq,wlpt[0].azm);
         surtovct(wlpt[0].INC,wlpt[0].AZM,a5.ns,a5.ew,a5.tvd);
         plane(A10,A2,A3,A5,theta);
         vcttosur(a5.ns,a5.ew,a5.tvd,wlpt2[0].inc,wlpt2[0].azm);
         vcttosur(a6.ns,a6.ew,a6.tvd,wlpt2[1].inc,wlpt2[1].azm);


         wlpt[0].DLS:=SIGN(-wlptp2.INC+wlpt2[0].inc)*ABS(wlpt[0].DLS);
         wlpt[1].DLS:=SIGN(-wlpt2[0].INC+wlpt2[1].inc)*ABS(wlpt[1].DLS);

         wlpt2[1].inc:=power(-1,round((wlpt2[1].azm/pi-1/2)))*wlpt2[1].inc;
         wlpt2[1].azm:=pi/2;
         wlpt2[0].inc:=power(-1,round((wlpt2[1].azm/pi-1/2)))*wlpt2[0].inc;
         wlpt2[0].azm:=pi/2;
         wlptp2.inc:=power(-1,round((wlptp2.azm/pi-1/2)))*wlptp2.inc;
         wlptp2.azm:=pi/2;
         CC2D(wlptp2.INC,wlpt2[0].inc,wlpt2[1].INC,wlpt[0].DLS,wlpt[1].DLS,wlpta1,wlpta2,okk);
         if abs(wlptp2.INC-wlpt2[1].INC)>=(pi) then
          okk:=false;
         if okk then
          qqq:=qqq+1;
         if (okk)and(qq=1) then
          form07.RadioButton1.Enabled:=true
         else if (qq=1)and(not okk) then
          form07.RadioButton1.Enabled:=false;
         if (okk)and(qq=2) then
          form07.RadioButton2.Enabled:=true
         else if (qq=2)and(not okk) then
          form07.RadioButton2.Enabled:=false;
        end;
      end;
     if qqq=0 then
      begin
       SHOWMESSAGE('THIS OPERATION CANNOT BE DONE');
       EXIT;
      end;
     if qqq=1 then
      begin
       if form07.RadioButton1.Enabled then
        wlpt[0].AZM:=strtofloat(form07.RadioButton1.Caption)*pi/180
       else
        wlpt[0].AZM:=strtofloat(form07.RadioButton2.Caption)*pi/180;
      end;
     if qqq=2 then
      begin
       form07.ShowModal;
       if form07.RadioButton1.checked then
        wlpt[0].AZM:=strtofloat(form07.RadioButton1.Caption)*pi/180
       else
        wlpt[0].AZM:=strtofloat(form07.RadioButton2.Caption)*pi/180;
      end;
     A1.ns:=wlptp.NS;      A1.EW:=wlptp.EW;     A1.TVD:=wlptp.TVD;
     surtovct(wlptp.INC,wlptp.AZM,a2.ns,a2.ew,a2.tvd);
     surtovct(wlpt[1].INC,wlpt[1].AZM,a3.ns,a3.ew,a3.tvd);
     a4.ns:=a1.ns;         a4.ew:=a1.ew;        a4.tvd:=a1.tvd;
     a5.ns:=a2.ns;         a5.ew:=a2.ew;        a5.tvd:=a2.tvd;
     a6.ns:=a3.ns;         a6.ew:=a3.ew;        a6.tvd:=a3.tvd;
     theta:=-999;
     plane(A1,A2,A3,A4,theta);
     plane(A10,A2,A3,A5,theta);
     plane(A10,A2,A3,A6,theta);
     vcttosur(a5.ns,a5.ew,a5.tvd,wlptp2.inc,wlptp2.azm);
     surtovct(wlpt[0].INC,wlpt[0].AZM,a5.ns,a5.ew,a5.tvd);
     plane(A10,A2,A3,A5,theta);
     vcttosur(a5.ns,a5.ew,a5.tvd,wlpt2[0].inc,wlpt2[0].azm);
     vcttosur(a6.ns,a6.ew,a6.tvd,wlpt2[1].inc,wlpt2[1].azm);
     wlpt[0].DLS:=SIGN(-wlptp2.INC+wlpt2[0].inc)*ABS(wlpt[0].DLS);
     wlpt[1].DLS:=SIGN(-wlpt2[0].INC+wlpt2[1].inc)*ABS(wlpt[1].DLS);
     wlpt2[1].inc:=power(-1,round((wlpt2[1].azm/pi-1/2)))*wlpt2[1].inc;
     wlpt2[1].azm:=pi/2;
     wlpt2[0].inc:=power(-1,round((wlpt2[1].azm/pi-1/2)))*wlpt2[0].inc;
     wlpt2[0].azm:=pi/2;
     wlptp2.inc:=power(-1,round((wlptp2.azm/pi-1/2)))*wlptp2.inc;
     wlptp2.azm:=pi/2;
     CC2D(wlptp2.INC,wlpt2[0].inc,wlpt2[1].INC,wlpt[0].DLS,wlpt[1].DLS,wlpta1,wlpta2,okk);


     wlpt[0].DLS:=ABS(wlpt[0].DLS);
     wlpt[1].DLS:=ABS(wlpt[1].DLS);
     a5.ns:=wlpta2[0].ns+a4.ns;    a5.ew:=wlpta2[0].ew+a4.ew;   a5.tvd:=wlpta2[0].tvd+a4.tvd;
     a6.ns:=wlpta2[1].ns+a4.ns;    a6.ew:=wlpta2[1].ew+a4.ew;   a6.tvd:=wlpta2[1].tvd+a4.tvd;
     revplane(A1,A2,A3,theta,A5);
     revplane(A1,A2,A3,theta,A6);
     surtovct(wlpta2[0].INC,wlpta2[0].AZM,a7.ns,a7.ew,a7.tvd);
     revplane(A10,A2,A3,theta,a7);
     vcttosur(a7.ns,a7.ew,a7.tvd,wlpt2[0].inc,wlpt2[0].azm);
     wlpt2[1].inc:=wlpt[1].inc;     wlpt2[1].azm:=wlpt[1].azm;
     wlpt2[0].ns:=a5.ns;   wlpt2[0].ew:=a5.ew;  wlpt2[0].tvd:=a5.tvd;
     wlpt2[1].ns:=a6.ns;   wlpt2[1].ew:=a6.ew;  wlpt2[1].tvd:=a6.tvd;
     wlpt2[0].MD:=wlpta2[0].MD+wlptp.MD;
     wlpt2[0].dls:=abs(wlpta2[0].dls);
     wlpt2[0].cmt:=wlpta2[0].cmt;
     wlpt2[0].dmd:=wlpta2[0].dmd;
     wlpt2[0].tr:=(wlpt2[0].azm-wlptp.azm)/wlpt2[0].dmd;
     wlpt2[0].br:=(wlpt2[0].inc-wlptp.inc)/wlpt2[0].dmd;

     wlpt2[1].MD:=wlpta2[1].MD+wlptp.MD;
     wlpt2[1].dls:=abs(wlpta2[1].dls);
     wlpt2[1].cmt:=wlpta2[1].cmt;
     wlpt2[1].dmd:=wlpta2[1].dmd;
     wlpt2[1].tr:=(wlpt2[1].azm-wlpt[0].azm)/wlpt2[1].dmd;
     wlpt2[1].br:=(wlpt2[1].inc-wlpt[0].inc)/wlpt2[1].dmd;

     cellfill(wlpt2,2,kk);
     md:=wlpt2[1].MD-wlptp.MD;
     if (md/ppf)=trunc(md/ppf) then
      m:=2*(trunc(md/ppf))+1
     else
      m:=2*(trunc(md/ppf)+1)+1;
     for i := 0 to (m-1) do
      begin
       wlpta1[i].order:=wlpt[2].order;
       wlpta1[i].typ:=kk;
      end;
     wlpt1[kk,0].order:=kk;
     wlpt1[kk,0].typ:=rocal[1];
     tableshow1(wlpta1,wlptpp,wlptp,wlpt2[1],a1,a2,a3,a4,v[0],kk,rocal[1],theta,MD,ll,nn,wlpta1);
     for i:= 0 to m - 1 do
      begin
       wlpt1[kk,i].MD:=wlpta1[i].MD;
       wlpt1[kk,i].INC:=wlpta1[i].INC;
       wlpt1[kk,i].azm:=wlpta1[i].AZM;
       wlpt1[kk,i].TVD:=wlpta1[i].TVD;
       wlpt1[kk,i].VSEC:=wlpta1[i].VSEC;
       wlpt1[kk,i].NS:=wlpta1[i].NS;
       wlpt1[kk,i].EW:=wlpta1[i].EW;
       wlpt1[kk,i].DLS:=wlpta1[i].DLS;
       wlpt1[kk,i].tf:=wlpta1[i].TF;
       wlpt1[kk,i].tr:=wlpta1[i].TR;
       wlpt1[kk,i].br:=wlpta1[i].BR;
       wlpt1[kk,i].dmd:=wlpta1[i].DMD;
       wlpt1[kk,i].order:=wlpta1[i].ORDER;
       wlpt1[kk,i].typ:=wlpta1[i].TYP;
       wlpt1[kk,i].CMT:=wlpta1[i].CMT;
      end;
    end
   else if (rocal[1]=21)or(rocal[1]=22)OR(rocal[1]=23) then
    begin
     GotoLabel1:
     A1.ns:=wlptp.NS;      A1.EW:=wlptp.EW;     A1.TVD:=wlptp.TVD;
     a4.ns:=a1.ns;         a4.ew:=a1.ew;        a4.tvd:=a1.tvd;
     surtovct(wlptp.INC,wlptp.AZM,a2.ns,a2.ew,a2.tvd);
     if (rocal[1]=21)OR(rocal[1]=36) then
      begin
       wlpt[0].dmd:=(wlpt[0].md-wlptp.md);
       wlpt[0].ns:=wlpt[0].dmd*a2.ns;
       wlpt[0].ew:=wlpt[0].dmd*a2.ew;
       wlpt[0].tvd:=wlpt[0].dmd*a2.tvd;
      end
     else if (rocal[1]=22)OR(rocal[1]=8) then
      begin
       wlpt[0].dmd:=(wlpt[0].tvd-wlptp.tvd)/a2.tvd;
       wlpt[0].ns:=wlpt[0].dmd*a2.ns;
       wlpt[0].ew:=wlpt[0].dmd*a2.ew;
       wlpt[0].tvd:=(wlpt[0].tvd-wlptp.tvd);
       wlpt[0].md:=(wlpt[0].dmd+wlptp.md);
      end
     else if (rocal[1]=23) then
      begin
       wlpt[0].md:=(wlpt[0].dmd+wlptp.md);
       wlpt[0].ns:=wlpt[0].dmd*a2.ns;
       wlpt[0].ew:=wlpt[0].dmd*a2.ew;
       wlpt[0].tvd:=wlpt[0].dmd*a2.tvd;
      end;
     if wlptp.md>=wlpt[0].MD then
      begin
       showmessage('Computed Measured Depth is Less than Measure Depth of Previous Station');
       exit;
      end;
     wlpt[0].CMT:='KOP';
     Hold(wlptp.INC,wlptp.AZM,wlpt[0].MD-wlptp.MD,wlpta1);
     wlpt2[0].azm:=wlptp.AZM;                           wlpt2[0].inc:=wlptp.inc;
     wlpt2[0].ns:=wlpt[0].ns+wlptp.ns;   wlpt2[0].ew:=wlpt[0].ew+wlptp.ew;  wlpt2[0].tvd:=wlpt[0].tvd+wlptp.tvd;
     wlpt2[0].MD:=wlpt[0].MD;
     wlpt2[0].dls:=0;
     wlpt2[0].cmt:='KOP';
     wlpt2[0].dmd:=wlpt[0].dmd;
     wlpt2[0].tf:=0;
     wlpt2[0].tr:=0;
     wlpt2[0].br:=0;

     v[1].ns:=WLPT2[0].ns-wlptpp.ns;
     v[1].ew:=WLPT2[0].ew-wlptpp.ew;
     if abs(v[0].ns*v[0].ns+v[0].ew*v[0].ew)<>0{0.0000001} then
      wlpt2[0].VSEC:=(v[0].ns*v[1].ns+v[0].ew*v[1].ew)/sqrt(v[0].ns*v[0].ns+v[0].ew*v[0].ew)
     else
      wlpt2[0].VSEC:=0;
     cellfill(wlpt2,2,kk);
     md:=wlpt2[0].MD-wlptp.MD;
     if (md/ppf)=trunc(md/ppf) then
      m:=2*(trunc(md/ppf))+1
     else
      m:=2*(trunc(md/ppf)+1)+1;
     for i := 0 to (m-1) do
      begin
       wlpta1[i].order:=wlpt[0].order;
       wlpta1[i].typ:=kk;
      end;
     JJ:=1;
     wlpt1[kk,0].order:=kk;
     wlpt1[kk,0].typ:=rocal[1];
     WHILE ((wlpta1[jj-1].MD+wlptp.MD)<WLPT2[0].MD)DO
      BEGIN
       a5.ns:=wlpta1[JJ-1].ns+a4.ns; a5.ew:=wlpta1[JJ-1].ew+a4.ew; a5.tvd:=wlpta1[JJ-1].tvd+a4.tvd;
       wlpt1[kk,trunc((jj-1)/2)].inc:=wlpt2[0].INC;
       wlpt1[kk,trunc((jj-1)/2)].azm:=wlpt2[0].azm;
       wlpt1[kk,trunc((jj-1)/2)].ns:=a5.ns;   wlpt1[kk,trunc((jj-1)/2)].ew:=a5.ew;  wlpt1[kk,trunc((jj-1)/2)].tvd:=a5.tvd;
       wlpt1[kk,trunc((jj-1)/2)].MD:=wlpta1[JJ-1].MD+wlptp.MD;
       wlpt1[kk,trunc((jj-1)/2)].dls:=abs(wlpta1[jj-1].dls);
       Wlpt1[kk,trunc((jj-1)/2)].cmt:=wlpta1[jj-1].cmt;
       WLPT1[kk,trunc((jj-1)/2)].order:=kk;
       WLPT1[kk,trunc((jj-1)/2)].typ:=rocal[1];
       v[1].ns:=WLPT1[kk,trunc((jj-1)/2)].ns-wlptpp.ns;
       v[1].ew:=WLPT1[kk,trunc((jj-1)/2)].ew-wlptpp.ew;
       wlpt1[kk,trunc((jj-1)/2)].VSEC:=wlpt2[0].VSEC;
       JJ:=JJ+2;
      END;
     IF ((wlpta1[jj-1].MD+wlptp.MD)=WLPT2[0].MD)THEN
      BEGIN
       wlpt1[kk,trunc((jj-1)/2)].inc:=wlpt2[0].inc;
       wlpt1[kk,trunc((jj-1)/2)].azm:=wlpt2[0].azm;
       wlpt1[kk,trunc((jj-1)/2)].ns:=wlpt2[0].ns;   wlpt1[kk,trunc((jj-1)/2)].ew:=wlpt2[0].ew;  wlpt1[kk,trunc((jj-1)/2)].tvd:=wlpt2[0].tvd;
       wlpt1[kk,trunc((jj-1)/2)].MD:=wlpt2[0].md;
       wlpt1[kk,trunc((jj-1)/2)].tvd:=wlpt2[0].tvd;
       wlpt1[kk,trunc((jj-1)/2)].ew:=wlpt2[0].ew;
       wlpt1[kk,trunc((jj-1)/2)].ns:=wlpt2[0].ns;
       wlpt1[kk,trunc((jj-1)/2)].dls:=abs(wlpt2[0].dls);
       Wlpt1[kk,trunc((jj-1)/2)].cmt:=wlpt2[0].cmt;
       WLPT1[kk,trunc((jj-1)/2)].order:=kk;
       WLPT1[kk,trunc((jj-1)/2)].typ:=rocal[1];
       wlpt1[kk,trunc((jj-1)/2)].tf:=0;
       wlpt1[kk,trunc((jj-1)/2)].tr:=0;
       wlpt1[kk,trunc((jj-1)/2)].br:=0;
       v[1].ns:=WLPT1[kk,trunc((jj-1)/2)].ns-wlptpp.ns;
       v[1].ew:=WLPT1[kk,trunc((jj-1)/2)].ew-wlptpp.ew;
       wlpt1[kk,trunc((jj-1)/2)].VSEC:=wlpt2[0].VSEC;
      END;
    end
   else if (rocal[1]=21)or(rocal[1]=22) then
    begin
     A1.ns:=wlptp.NS;      A1.EW:=wlptp.EW;     A1.TVD:=wlptp.TVD;
     surtovct(wlptp.INC,wlptp.AZM,a2.ns,a2.ew,a2.tvd);
     surtovct(wlpt[0].INC,wlpt[0].AZM,a3.ns,a3.ew,a3.tvd);
     a4.ns:=a1.ns;         a4.ew:=a1.ew;        a4.tvd:=a1.tvd;
     a5.ns:=a2.ns;         a5.ew:=a2.ew;        a5.tvd:=a2.tvd;
     surtovct(wlpt[0].INC,wlpt[0].AZM,a7.ns,a7.ew,a7.tvd);
     plane(A10,A2,A3,A7,theta);
     vcttosur(a7.ns,a7.ew,a7.tvd,wlpt2[0].inc,wlpt2[0].azm);
     plane(A1,A2,A3,A4,theta);
     plane(A10,A2,A3,A5,theta);
     vcttosur(a5.ns,a5.ew,a5.tvd,wlptp2.inc,wlptp2.azm);
     sursta(wlptp2.INC,wlpt2[0].inc,wlpt[0].MD,wlpta1,wlpta2);

     a5.ns:=wlpta2[0].ns+a4.ns;    a5.ew:=wlpta2[0].ew+a4.ew;   a5.tvd:=wlpta2[0].tvd+a4.tvd;
     wlpt2[0].inc:=wlpt[0].INC;
     wlpt2[0].azm:=wlpt[0].AZM;

     revplane(a1,a2,a3,theta,a5);
     wlpt2[0].ns:=a5.ns;   wlpt2[0].ew:=a5.ew;  wlpt2[0].tvd:=a5.tvd;

     wlpt2[0].MD:=wlpta2[0].MD+wlptp.MD;
     wlpt2[0].dls:=abs(wlpta2[0].dls);
     wlpt2[0].cmt:=wlpta2[0].cmt;
     wlpt2[0].dmd:=wlpta2[0].dmd;
     wlpt2[0].tr:=(wlpt2[0].azm-wlptp.azm)/wlpt2[0].dmd;
     wlpt2[0].br:=(wlpt2[0].inc-wlptp.inc)/wlpt2[0].dmd;

     cellfill(wlpt2,2,kk);
     md:=wlpt2[0].MD-wlptp.MD;
     if (md/ppf)=trunc(md/ppf) then
      m:=2*(trunc(md/ppf))+1
     else
      m:=2*(trunc(md/ppf)+1)+1;
     for i := 0 to (m-1) do
      begin
       wlpta1[i].order:=wlpt[0].order;
       wlpta1[i].typ:=kk;
      end;
     wlpt1[kk,0].order:=kk;
     wlpt1[kk,0].typ:=rocal[1];
     tableshow1(wlpta1,wlptpp,wlptp,wlpt2[0],a1,a2,a3,a4,v[0],kk,rocal[1],theta,MD,ll,nn,wlpta1);
     for i:= 0 to m - 1 do
      begin
       wlpt1[kk,i].MD:=wlpta1[i].MD;
       wlpt1[kk,i].INC:=wlpta1[i].INC;
       wlpt1[kk,i].azm:=wlpta1[i].AZM;
       wlpt1[kk,i].TVD:=wlpta1[i].TVD;
       wlpt1[kk,i].VSEC:=wlpta1[i].VSEC;
       wlpt1[kk,i].NS:=wlpta1[i].NS;
       wlpt1[kk,i].EW:=wlpta1[i].EW;
       wlpt1[kk,i].DLS:=wlpta1[i].DLS;
       wlpt1[kk,i].tf:=wlpta1[i].TF;
       wlpt1[kk,i].tr:=wlpta1[i].TR;
       wlpt1[kk,i].br:=wlpta1[i].BR;
       wlpt1[kk,i].dmd:=wlpta1[i].DMD;
       wlpt1[kk,i].order:=wlpta1[i].ORDER;
       wlpt1[kk,i].typ:=wlpta1[i].TYP;
       wlpt1[kk,i].CMT:=wlpta1[i].CMT;
      end;
    end
   else if rocal[1]=52 then
    begin
     wlpt[0].dmd:=0;
     wlpt2[0].TVD:=0;
     while (wlpt[0].tvd>wlpt2[0].TVD)do
      begin
       aa:=wlpt2[0].TVD;
       wlpt[0].dmd:=wlpt[0].dmd+ppf;
       if (wlptp.INC=0) then
        begin
         wlpt[0].azm:=wlptp.azm;
         wlpt[0].inc:=arccos(cos(wlptp.inc)*cos(wlpt[0].dmd*wlpt[0].dls)-sin(wlptp.inc)*sin(wlpt[0].dmd*wlpt[0].dls)*cos(wlptp.tf));
        end
       else if (wlptp.INC<>0) then
        begin
         if arctan(tan(wlpt[0].dmd*wlpt[0].dls)/(sin(wlptp.inc)+tan(wlpt[0].dmd*wlpt[0].dls)*cos(wlptp.inc)*cos(wlptp.tf)))>0 then
          wlpt[0].azm:=wlptp.azm+arctan(tan(wlpt[0].dmd*wlpt[0].dls)*sin(wlptp.tf)/(sin(wlptp.inc)+tan(wlpt[0].dmd*wlpt[0].dls)*cos(wlptp.inc)*cos(wlptp.tf)))
         else if arctan(tan(wlpt[0].dmd*wlpt[0].dls)/(sin(wlptp.inc)+tan(wlpt[0].dmd*wlpt[0].dls)*cos(wlptp.inc)*cos(wlptp.tf)))<0 then
          wlpt[0].azm:=pi+wlptp.azm+arctan(tan(wlpt[0].dmd*wlpt[0].dls)*sin(wlptp.tf)/(sin(wlptp.inc)+tan(wlpt[0].dmd*wlpt[0].dls)*cos(wlptp.inc)*cos(wlptp.tf)))
         else
          wlpt[0].azm:=wlptp.azm;

         wlpt[0].inc:=sign(arcsin(sin(wlptp.tf)*sin(wlpt[0].dmd*wlpt[0].dls)/sin(wlpt[0].azm-wlptp.azm)))
         *arccos(cos(wlptp.inc)*cos(wlpt[0].dmd*wlpt[0].dls)-sin(wlptp.inc)*sin(wlpt[0].dmd*wlpt[0].dls)*cos(wlptp.tf));
        end;
       A1.ns:=wlptp.NS;      A1.EW:=wlptp.EW;     A1.TVD:=wlptp.TVD;
       surtovct(wlptp.INC,wlptp.AZM,a2.ns,a2.ew,a2.tvd);
       surtovct(wlpt[0].INC,wlpt[0].AZM,a3.ns,a3.ew,a3.tvd);
       a4.ns:=a1.ns;         a4.ew:=a1.ew;        a4.tvd:=a1.tvd;
       a5.ns:=a2.ns;         a5.ew:=a2.ew;        a5.tvd:=a2.tvd;
       a6.ns:=a3.ns;         a6.ew:=a3.ew;        a6.tvd:=a3.tvd;
       theta:=-999;
       plane(A10,A2,A3,A5,theta);
       vcttosur(a5.ns,a5.ew,a5.tvd,wlptp2.inc,wlptp2.azm);
       plane(A10,A2,A3,A6,theta);
       vcttosur(a6.ns,a6.ew,a6.tvd,wlpt2[0].inc,wlpt2[0].azm);
       if abs(wlpt2[0].azm-wlptp2.azm)>0.00000001 then
        r:=-1
       else
        r:=1;
       if wlptp2.INC>r*wlpt2[0].INC then
        wlpt[0].DLS:=-abs(wlpt[0].DLS)
       else
        wlpt[0].DLS:=abs(wlpt[0].DLS);
       c3(wlptp2.INC,r*wlpt2[0].inc,wlpt[0].dls,wlpta1,wlpta2);
       plane(A1,A2,A3,A4,theta);
       a5.ns:=wlpta2[1].ns+a4.ns;    a5.ew:=wlpta2[1].ew+a4.ew;   a5.tvd:=wlpta2[1].tvd+a4.tvd;
       a6.ns:=wlpta2[0].ns+a4.ns;    a6.ew:=wlpta2[0].ew+a4.ew;   a6.tvd:=wlpta2[0].tvd+a4.tvd;
       revplane(A1,A2,A3,theta,A5);
       revplane(A1,A2,A3,theta,A6);
       vcttosur(A6.NS-a5.ns,A6.EW-a5.ew,A6.TVD-a5.tvd,wlpt2[0].inc,wlpt2[0].azm);
       wlpt2[0].ns:=a6.ns;   wlpt2[0].ew:=a6.ew;  wlpt2[0].tvd:=a6.tvd;
       wlpt[0].DLS:=abs(wlpt[0].DLS);
       cc:=wlpt2[0].tvd;
      end;
     a:=wlpt[0].dmd-ppf;
     c:=wlpt[0].dmd;
     b:=(a+c)/2;
     while abs(wlpt2[0].TVD-wlpt[0].TVD)>0.00001 do
      begin
       wlpt[0].dmd:=b;
       if (wlptp.INC=0) then
        begin
         wlpt[0].azm:=wlptp.azm;
         wlpt[0].inc:=arccos(cos(wlptp.inc)*cos(wlpt[0].dmd*wlpt[0].dls)-sin(wlptp.inc)*sin(wlpt[0].dmd*wlpt[0].dls)*cos(wlptp.tf));
        end
       else if (wlptp.INC<>0) then
        begin
         if arctan(tan(wlpt[0].dmd*wlpt[0].dls)/(sin(wlptp.inc)+tan(wlpt[0].dmd*wlpt[0].dls)*cos(wlptp.inc)*cos(wlptp.tf)))>0 then
          wlpt[0].azm:=wlptp.azm+arctan(tan(wlpt[0].dmd*wlpt[0].dls)*sin(wlptp.tf)/(sin(wlptp.inc)+tan(wlpt[0].dmd*wlpt[0].dls)*cos(wlptp.inc)*cos(wlptp.tf)))
         else if arctan(tan(wlpt[0].dmd*wlpt[0].dls)/(sin(wlptp.inc)+tan(wlpt[0].dmd*wlpt[0].dls)*cos(wlptp.inc)*cos(wlptp.tf)))<0 then
          wlpt[0].azm:=pi+wlptp.azm+arctan(tan(wlpt[0].dmd*wlpt[0].dls)*sin(wlptp.tf)/(sin(wlptp.inc)+tan(wlpt[0].dmd*wlpt[0].dls)*cos(wlptp.inc)*cos(wlptp.tf)))
         else
          wlpt[0].azm:=wlptp.azm;

         wlpt[0].inc:=sign(arcsin(sin(wlptp.tf)*sin(wlpt[0].dmd*wlpt[0].dls)/sin(wlpt[0].azm-wlptp.azm)))
         *arccos(cos(wlptp.inc)*cos(wlpt[0].dmd*wlpt[0].dls)-sin(wlptp.inc)*sin(wlpt[0].dmd*wlpt[0].dls)*cos(wlptp.tf));
        end;
       A1.ns:=wlptp.NS;      A1.EW:=wlptp.EW;     A1.TVD:=wlptp.TVD;
       surtovct(wlptp.INC,wlptp.AZM,a2.ns,a2.ew,a2.tvd);
       surtovct(wlpt[0].INC,wlpt[0].AZM,a3.ns,a3.ew,a3.tvd);
       a4.ns:=a1.ns;         a4.ew:=a1.ew;        a4.tvd:=a1.tvd;
       a5.ns:=a2.ns;         a5.ew:=a2.ew;        a5.tvd:=a2.tvd;
       a6.ns:=a3.ns;         a6.ew:=a3.ew;        a6.tvd:=a3.tvd;
       theta:=-999;
       plane(A10,A2,A3,A5,theta);
       vcttosur(a5.ns,a5.ew,a5.tvd,wlptp2.inc,wlptp2.azm);
       plane(A10,A2,A3,A6,theta);
       vcttosur(a6.ns,a6.ew,a6.tvd,wlpt2[0].inc,wlpt2[0].azm);
       if abs(wlpt2[0].azm-wlptp2.azm)>0.00000001 then
        r:=-1
       else
        r:=1;
       if wlptp2.INC>r*wlpt2[0].INC then
        wlpt[0].DLS:=-abs(wlpt[0].DLS)
       else
        wlpt[0].DLS:=abs(wlpt[0].DLS);
       c3(wlptp2.INC,r*wlpt2[0].inc,wlpt[0].dls,wlpta1,wlpta2);
       plane(A1,A2,A3,A4,theta);

       a5.ns:=wlpta2[1].ns+a4.ns;    a5.ew:=wlpta2[1].ew+a4.ew;   a5.tvd:=wlpta2[1].tvd+a4.tvd;
       a6.ns:=wlpta2[0].ns+a4.ns;    a6.ew:=wlpta2[0].ew+a4.ew;   a6.tvd:=wlpta2[0].tvd+a4.tvd;
       revplane(A1,A2,A3,theta,A5);
       revplane(A1,A2,A3,theta,A6);
       vcttosur(A6.NS-a5.ns,A6.EW-a5.ew,A6.TVD-a5.tvd,wlpt2[0].inc,wlpt2[0].azm);
       wlpt2[0].ns:=a6.ns;   wlpt2[0].ew:=a6.ew;  wlpt2[0].tvd:=a6.tvd;
       wlpt[0].DLS:=abs(wlpt[0].DLS);
       bb:=wlpt2[0].TVD;
       if (aa-wlpt[0].TVD)*(bb-wlpt[0].tvd)<0 then
        c:=b
       else if (cc-wlpt[0].TVD)*(bb-wlpt[0].tvd)<0 then
        a:=b
       else
        break;
       b:=(a+c)/2;
      end;
     wlpt2[0].MD:=wlpta2[0].MD+wlptp.MD;
     wlpt2[0].dls:=abs(wlpta2[0].dls);
     wlpt2[0].cmt:=wlpta2[0].cmt;
     wlpt2[0].dmd:=wlpta2[0].dmd;
     wlpt2[0].tr:=(wlpt2[0].azm-wlptp.azm)/wlpt2[0].dmd;
     wlpt2[0].br:=(wlpt2[0].inc-wlptp.inc)/wlpt2[0].dmd;

     cellfill(wlpt2,2,kk);
     md:=wlpt2[0].MD-wlptp.MD;
     if (md/ppf)=trunc(md/ppf) then
      m:=2*(trunc(md/ppf))+1
     else
      m:=2*(trunc(md/ppf)+1)+1;
     for i := 0 to (m-1) do
      begin
       wlpta1[i].order:=wlpt[0].order;
       wlpta1[i].typ:=kk;
      end;
     wlpt1[kk,0].order:=kk;
     wlpt1[kk,0].typ:=rocal[1];
     tableshow1(wlpta1,wlptpp,wlptp,wlpt2[0],a1,a2,a3,a4,v[0],kk,rocal[1],theta,MD,ll,nn,wlpta1);
     for i:= 0 to m - 1 do
      begin
       wlpt1[kk,i].MD:=wlpta1[i].MD;
       wlpt1[kk,i].INC:=wlpta1[i].INC;
       wlpt1[kk,i].azm:=wlpta1[i].AZM;
       wlpt1[kk,i].TVD:=wlpta1[i].TVD;
       wlpt1[kk,i].VSEC:=wlpta1[i].VSEC;
       wlpt1[kk,i].NS:=wlpta1[i].NS;
       wlpt1[kk,i].EW:=wlpta1[i].EW;
       wlpt1[kk,i].DLS:=wlpta1[i].DLS;
       wlpt1[kk,i].tf:=wlpta1[i].TF;
       wlpt1[kk,i].tr:=wlpta1[i].TR;
       wlpt1[kk,i].br:=wlpta1[i].BR;
       wlpt1[kk,i].dmd:=wlpta1[i].DMD;
       wlpt1[kk,i].order:=wlpta1[i].ORDER;
       wlpt1[kk,i].typ:=wlpta1[i].TYP;
       wlpt1[kk,i].CMT:=wlpta1[i].CMT;
      end;
    end
   else if rocal[1] div 10 =7 then
    begin
     wlpt[0].dmd:=0;
     wlpt2[0].TVD:=0;
     while (wlpt[0].tvd>wlpt2[0].TVD)do
      begin
       aa:=wlpt2[0].TVD;
       wlpt[0].dmd:=wlpt[0].dmd+ppf;
       if (rocal[1] mod 10=1) then
        begin
         wlpt[0].azm:=wlptp.azm;
         wlpt[0].INC:=wlptp.inc+wlpt[0].dmd*wlpt[0].br;
        end
       else if (rocal[1] mod 10=2) then
        begin
         wlpt[0].azm:=wlptp.AZM+wlpt[0].dmd*wlpt[0].tr;
         wlpt[0].INC:=wlptp.inc;
        end
       else if (rocal[1] mod 10=3) then
        begin
         wlpt[0].azm:=wlptp.AZM+wlpt[0].dmd*wlpt[0].tr;
         wlpt[0].INC:=wlptp.inc+wlpt[0].dmd*wlpt[0].br;
        end;

       A1.ns:=wlptp.NS;      A1.EW:=wlptp.EW;     A1.TVD:=wlptp.TVD;
       surtovct(wlptp.INC,wlptp.AZM,a2.ns,a2.ew,a2.tvd);
       surtovct(wlpt[0].INC,wlpt[0].AZM,a3.ns,a3.ew,a3.tvd);
       wlpt[0].DLS:=arccos(a2.ns*a3.ns+a2.ew*a3.ew+a2.tvd*a3.tvd)/wlpt[0].dmd;
       a4.ns:=a1.ns;         a4.ew:=a1.ew;        a4.tvd:=a1.tvd;
       a5.ns:=a2.ns;         a5.ew:=a2.ew;        a5.tvd:=a2.tvd;
       a6.ns:=a3.ns;         a6.ew:=a3.ew;        a6.tvd:=a3.tvd;
       theta:=-999;
       plane(A10,A2,A3,A5,theta);
       vcttosur(a5.ns,a5.ew,a5.tvd,wlptp2.inc,wlptp2.azm);
       plane(A10,A2,A3,A6,theta);
       vcttosur(a6.ns,a6.ew,a6.tvd,wlpt2[0].inc,wlpt2[0].azm);
       if abs(wlpt2[0].azm-wlptp2.azm)>0.00000001 then
        r:=-1
       else
        r:=1;
       if wlptp2.INC>r*wlpt2[0].INC then
        wlpt[0].DLS:=-abs(wlpt[0].DLS)
       else
        wlpt[0].DLS:=abs(wlpt[0].DLS);
       c3(wlptp2.INC,r*wlpt2[0].inc,wlpt[0].dls,wlpta1,wlpta2);
       plane(A1,A2,A3,A4,theta);

       a5.ns:=wlpta2[1].ns+a4.ns;    a5.ew:=wlpta2[1].ew+a4.ew;   a5.tvd:=wlpta2[1].tvd+a4.tvd;
       a6.ns:=wlpta2[0].ns+a4.ns;    a6.ew:=wlpta2[0].ew+a4.ew;   a6.tvd:=wlpta2[0].tvd+a4.tvd;
       revplane(A1,A2,A3,theta,A5);
       revplane(A1,A2,A3,theta,A6);
       vcttosur(A6.NS-a5.ns,A6.EW-a5.ew,A6.TVD-a5.tvd,wlpt2[0].inc,wlpt2[0].azm);
       wlpt2[0].ns:=a6.ns;   wlpt2[0].ew:=a6.ew;  wlpt2[0].tvd:=a6.tvd;
       wlpt[0].DLS:=abs(wlpt[0].DLS);
       cc:=wlpt2[0].tvd;
      end;
     a:=wlpt[0].dmd-ppf;
     c:=wlpt[0].dmd;
     b:=(a+c)/2;
     while abs(wlpt2[0].TVD-wlpt[0].TVD)>0.00001 do
      begin
       wlpt[0].dmd:=b;
       if (rocal[1] mod 10=1) then
        begin
         wlpt[0].azm:=wlptp.azm;
         wlpt[0].INC:=wlptp.inc+wlpt[0].dmd*wlpt[0].br;
        end
       else if (rocal[1] mod 10=2) then
        begin
         wlpt[0].azm:=wlptp.AZM+wlpt[0].dmd*wlpt[0].tr;
         wlpt[0].INC:=wlptp.inc;
        end
       else if (rocal[1] mod 10=3) then
        begin
         wlpt[0].azm:=wlptp.AZM+wlpt[0].dmd*wlpt[0].tr;
         wlpt[0].INC:=wlptp.inc+wlpt[0].dmd*wlpt[0].br;
        end;
       A1.ns:=wlptp.NS;      A1.EW:=wlptp.EW;     A1.TVD:=wlptp.TVD;
       surtovct(wlptp.INC,wlptp.AZM,a2.ns,a2.ew,a2.tvd);
       surtovct(wlpt[0].INC,wlpt[0].AZM,a3.ns,a3.ew,a3.tvd);
       wlpt[0].DLS:=arccos(a2.ns*a3.ns+a2.ew*a3.ew+a2.tvd*a3.tvd)/wlpt[0].dmd;
       a4.ns:=a1.ns;         a4.ew:=a1.ew;        a4.tvd:=a1.tvd;
       a5.ns:=a2.ns;         a5.ew:=a2.ew;        a5.tvd:=a2.tvd;
       a6.ns:=a3.ns;         a6.ew:=a3.ew;        a6.tvd:=a3.tvd;
       theta:=-999;
       plane(A10,A2,A3,A5,theta);
       vcttosur(a5.ns,a5.ew,a5.tvd,wlptp2.inc,wlptp2.azm);
       plane(A10,A2,A3,A6,theta);
       vcttosur(a6.ns,a6.ew,a6.tvd,wlpt2[0].inc,wlpt2[0].azm);
       if abs(wlpt2[0].azm-wlptp2.azm)>0.00000001 then
        r:=-1
       else
        r:=1;
       if wlptp2.INC>r*wlpt2[0].INC then
        wlpt[0].DLS:=-abs(wlpt[0].DLS)
       else
        wlpt[0].DLS:=abs(wlpt[0].DLS);
       c3(wlptp2.INC,r*wlpt2[0].inc,wlpt[0].dls,wlpta1,wlpta2);
       plane(A1,A2,A3,A4,theta);

       a5.ns:=wlpta2[1].ns+a4.ns;    a5.ew:=wlpta2[1].ew+a4.ew;   a5.tvd:=wlpta2[1].tvd+a4.tvd;
       a6.ns:=wlpta2[0].ns+a4.ns;    a6.ew:=wlpta2[0].ew+a4.ew;   a6.tvd:=wlpta2[0].tvd+a4.tvd;
       revplane(A1,A2,A3,theta,A5);
       revplane(A1,A2,A3,theta,A6);
       vcttosur(A6.NS-a5.ns,A6.EW-a5.ew,A6.TVD-a5.tvd,wlpt2[0].inc,wlpt2[0].azm);
       wlpt2[0].ns:=a6.ns;   wlpt2[0].ew:=a6.ew;  wlpt2[0].tvd:=a6.tvd;
       wlpt[0].DLS:=abs(wlpt[0].DLS);
       bb:=wlpt2[0].TVD;
       if (aa-wlpt[0].TVD)*(bb-wlpt[0].tvd)<0 then
        c:=b
       else if (cc-wlpt[0].TVD)*(bb-wlpt[0].tvd)<0 then
        a:=b
       else
        break;
       b:=(a+c)/2;
      end;
     wlpt2[0].MD:=wlpta2[0].MD+wlptp.MD;
     wlpt2[0].dls:=abs(wlpta2[0].dls);
     wlpt2[0].cmt:=wlpta2[0].cmt;
     wlpt2[0].dmd:=wlpta2[0].dmd;
     wlpt2[0].tr:=(wlpt2[0].azm-wlptp.azm)/wlpt2[0].dmd;
     wlpt2[0].br:=(wlpt2[0].inc-wlptp.inc)/wlpt2[0].dmd;

     cellfill(wlpt2,2,kk);
     md:=wlpt2[0].MD-wlptp.MD;
     if (md/ppf)=trunc(md/ppf) then
      m:=2*(trunc(md/ppf))+1
     else
      m:=2*(trunc(md/ppf)+1)+1;
     for i := 0 to (m-1) do
      begin
       wlpta1[i].order:=wlpt[0].order;
       wlpta1[i].typ:=kk;
      end;
     wlpt1[kk,0].order:=kk;
     wlpt1[kk,0].typ:=rocal[1];
     tableshow1(wlpta1,wlptpp,wlptp,wlpt2[0],a1,a2,a3,a4,v[0],kk,rocal[1],theta,MD,ll,nn,wlpta1);
     for i:= 0 to m - 1 do
      begin
       wlpt1[kk,i].MD:=wlpta1[i].MD;
       wlpt1[kk,i].INC:=wlpta1[i].INC;
       wlpt1[kk,i].azm:=wlpta1[i].AZM;
       wlpt1[kk,i].TVD:=wlpta1[i].TVD;
       wlpt1[kk,i].VSEC:=wlpta1[i].VSEC;
       wlpt1[kk,i].NS:=wlpta1[i].NS;
       wlpt1[kk,i].EW:=wlpta1[i].EW;
       wlpt1[kk,i].DLS:=wlpta1[i].DLS;
       wlpt1[kk,i].tf:=wlpta1[i].TF;
       wlpt1[kk,i].tr:=wlpta1[i].TR;
       wlpt1[kk,i].br:=wlpta1[i].BR;
       wlpt1[kk,i].dmd:=wlpta1[i].DMD;
       wlpt1[kk,i].order:=wlpta1[i].ORDER;
       wlpt1[kk,i].typ:=wlpta1[i].TYP;
       wlpt1[kk,i].CMT:=wlpta1[i].CMT;
      end;
    end
   else if rocal[1] div 10 >= 3  then
    begin
     if (rocal[1]=31) then
      begin
       A1.ns:=wlptp.NS;      A1.EW:=wlptp.EW;     A1.TVD:=wlptp.TVD;
       surtovct(wlptp.INC,wlptp.AZM,a2.ns,a2.ew,a2.tvd);
       if ((wlptp.INC=0)or(wlpt[0].inc=0))and(not((wlptp.INC=0)and(wlpt[0].inc=0))) then
        begin
         wlpt[0].AZM:=wlptp.AZM;
         surtovct(wlpt[0].INC,wlpt[0].AZM,a3.ns,a3.ew,a3.tvd);
         a4.ns:=a1.ns;         a4.ew:=a1.ew;        a4.tvd:=a1.tvd;
         a5.ns:=a2.ns;         a5.ew:=a2.ew;        a5.tvd:=a2.tvd;
         a6.ns:=a3.ns;         a6.ew:=a3.ew;        a6.tvd:=a3.tvd;
         wlpt[0].dls:=(wlpt[0].inc-wlptp.inc)/wlpt[0].MD;
        end
       else
        begin
         wlpt[0].dmd:=wlpt[0].MD-wlptp.MD;
         surtovct(wlpt[0].INC,0,r,a3.ew,a3.tvd);
         theta:=wlpt[0].dmd*wlpt[0].dls;
         a:=a2.ew*a2.ew+a2.ns*a2.ns;
         b:=-2*a2.ns*(cos(theta)-a2.tvd*a3.tvd);
         c:=sqr(cos(theta)-a2.tvd*a3.tvd)-r*r*a2.ew*a2.ew;
         if ((b*b-4*a*c)<0) then
          begin
           ShowMessage('ERROR IN ORDER: '+inttostr(kk)+#13#10
           +'     MIN DLS= '+FLOATTOSTR(abs(dec(3,ArcCos(A2.tvd*A3.tvd+R*SQRT(a))*180*100/(3.14*wlpt[0].dmd))))+#13#10
           +'     MAX DLS= '+FLOATTOSTR(abs(dec(3,ArcCos(A2.tvd*A3.tvd-R*SQRT(a))*180*100/(3.14*wlpt[0].dmd)))));
           exit;
          end;
         a3.ns:=(-b+sqrt((b*b-4*a*c)))/(2*a);
         if a2.ew<>0 then
          a3.ew:=(cos(theta)-a3.ns*a2.ns-a3.tvd*a2.tvd)/a2.ew
         else
          a3.ew:=sqrt(1-sqr(a3.ns)-sqr(a3.tvd));
         vcttosur(a3.ns,a3.ew,a3.tvd,wlpt[0].inc,wlpt[0].azm);
         form07.RadioButton1.caption:=floattostr(dec(3,wlpt[0].azm*180/pi));
         a3.ns:=(-b-sqrt(abs(b*b-4*a*c)))/(2*a);
         if a2.ew<>0 then
          a3.ew:=(cos(theta)-a3.ns*a2.ns-a3.tvd*a2.tvd)/a2.ew
         else
          a3.ew:=sqrt(1-sqr(a3.ns)-sqr(a3.tvd));
         vcttosur(a3.ns,a3.ew,a3.tvd,wlpt[0].inc,wlpt[0].azm);
         form07.RadioButton2.caption:=floattostr(dec(3,wlpt[0].azm*180/pi));
         form07.ShowModal;
         if form07.RadioButton1.Checked then
          wlpt[0].AZM:=pi/180*strtofloat(form07.RadioButton1.caption)
         else
          wlpt[0].AZM:=pi/180*strtofloat(form07.RadioButton2.caption);
         surtovct(wlpt[0].INC,wlpt[0].AZM,a3.ns,a3.ew,a3.tvd);
         a4.ns:=a1.ns;         a4.ew:=a1.ew;        a4.tvd:=a1.tvd;
         a5.ns:=a2.ns;         a5.ew:=a2.ew;        a5.tvd:=a2.tvd;
         a6.ns:=a3.ns;         a6.ew:=a3.ew;        a6.tvd:=a3.tvd;
        end;
      end
     else if (rocal[1]=32) then
      begin
       A1.ns:=wlptp.NS;      A1.EW:=wlptp.EW;     A1.TVD:=wlptp.TVD;
       surtovct(wlptp.INC,wlptp.AZM,a2.ns,a2.ew,a2.tvd);
       if (wlptp.INC=0) then
        begin
         wlptp.AZM:=wlpt[0].AZM;
         surtovct(wlptp.INC,wlptp.AZM,a2.ns,a2.ew,a2.tvd);
         wlpt[0].dmd:=wlpt[0].MD-wlptp.MD;
         wlpt[0].inc:=wlpt[0].dmd*wlpt[0].dls;
         surtovct(wlpt[0].INC,wlpt[0].AZM,a3.ns,a3.ew,a3.tvd);
         a4.ns:=a1.ns;         a4.ew:=a1.ew;        a4.tvd:=a1.tvd;
         a5.ns:=a2.ns;         a5.ew:=a2.ew;        a5.tvd:=a2.tvd;
         a6.ns:=a3.ns;         a6.ew:=a3.ew;        a6.tvd:=a3.tvd;
        end
       else if (wlptp.INC<>0) then
        begin
         wlpt[0].dmd:=wlpt[0].MD-wlptp.MD;
         surtovct(pi/2,wlpt[0].azm,a3.ns,a3.ew,a3.tvd);
         if a3.ew<>0 then
          begin
           r:=a3.ns/a3.ew;
           theta:=wlpt[0].dmd*wlpt[0].dls;
           a:=sqr(a2.ns*r+a2.ew)+sqr(a2.tvd)*(r*r+1);
           b:=-2*(r*r+1)*(a2.tvd*cos(theta));
           c:=(r*r+1)*sqr(cos(theta))-sqr(a2.ns*r+a2.ew);
           if ((b*b-4*a*c)<0) then
            begin
             ShowMessage('ERROR IN ORDER: '+inttostr(kk)+#13#10
             +'     MIN DLS= '+FLOATTOSTR(abs(dec(3,ArcCos(sqr(a2.tvd)+(sqr(a2.ns*r+a2.ew)/(r*r+1)))*180*100/(3.14*wlpt[0].dmd))))+#13#10
             +'     MAX DLS= '+FLOATTOSTR(abs(dec(3,(pi-ArcCos(sqr(a2.tvd)+(sqr(a2.ns*r+a2.ew)/(r*r+1))))*180*100/(3.14*wlpt[0].dmd)))));
             exit;
            end;
           a3.tvd:=(-b+sqrt(abs(b*b-4*a*c)))/(2*a);
           a3.ew:=(cos(theta)-a2.tvd*a3.tvd)/(a2.ns*r+a2.ew);
           a3.ns:=r*a3.ew;
           vcttosur(a3.ns,a3.ew,a3.tvd,wlpt[0].inc,ex1);
           form07.RadioButton1.caption:=floattostr(dec(3,wlpt[0].inc*180/pi));
           a3.tvd:=(-b-sqrt(abs(b*b-4*a*c)))/(2*a);
           a3.ew:=(cos(theta)-a2.tvd*a3.tvd)/(a2.ns*r+a2.ew);
           a3.ns:=r*a3.ew;
           vcttosur(a3.ns,a3.ew,a3.tvd,wlpt[0].inc,ex2);
           form07.RadioButton2.caption:=floattostr(dec(3,wlpt[0].inc*180/pi));
           form07.ShowModal;
           if form07.RadioButton1.Checked then
            begin
             wlpt[0].inc:=pi/180*strtofloat(form07.RadioButton1.caption);
             wlpt[0].azm:=ex1;
            end
           else
            begin
             wlpt[0].inc:=pi/180*strtofloat(form07.RadioButton2.caption);
             wlpt[0].azm:=ex2;
            end;
           surtovct(wlpt[0].INC,wlpt[0].AZM,a3.ns,a3.ew,a3.tvd);
          end
         else if (a3.ew=0) then
          begin
           theta:=wlpt[0].dmd*wlpt[0].dls;
           a:=sqr(a2.ns)+sqr(a2.tvd);
           b:=-2*a2.tvd*cos(theta);
           c:=sqr(cos(theta))-sqr(a2.ns);
           if ((b*b-4*a*c)<0) then
            begin
             ShowMessage('ERROR IN ORDER: '+inttostr(kk)+#13#10
             +'     MIN DLS= '+FLOATTOSTR(abs(dec(3,ArcCos(sqr(a2.tvd)+(sqr(a2.ns*r+a2.ew)/(r*r+1)))*180*100/(3.14*wlpt[0].dmd))))+#13#10
             +'     MAX DLS= '+FLOATTOSTR(abs(dec(3,(pi-ArcCos(sqr(a2.tvd)+(sqr(a2.ns*r+a2.ew)/(r*r+1))))*180*100/(3.14*wlpt[0].dmd)))));
             exit;
            end;
           a3.ew:=0;
           a3.ns:=(cos(theta)-a2.tvd*a3.tvd)/(a2.ns);
           vcttosur(a3.ns,a3.ew,a3.tvd,wlpt[0].inc,ex1);
           form07.RadioButton1.caption:=floattostr(dec(3,wlpt[0].inc*180/pi));
           a3.tvd:=(-b-sqrt(abs(b*b-4*a*c)))/(2*a);
           a3.ew:=0;
           a3.ns:=(cos(theta)-a2.tvd*a3.tvd)/(a2.ns);
           vcttosur(a3.ns,a3.ew,a3.tvd,wlpt[0].inc,ex2);
           form07.RadioButton2.caption:=floattostr(dec(3,wlpt[0].inc*180/pi));
           form07.ShowModal;
           if form07.RadioButton1.Checked then
            begin
             wlpt[0].inc:=pi/180*strtofloat(form07.RadioButton1.caption);
             wlpt[0].azm:=ex1;
            end
           else
            begin
             wlpt[0].inc:=pi/180*strtofloat(form07.RadioButton2.caption);
             wlpt[0].azm:=ex2;
            end;
           surtovct(wlpt[0].INC,wlpt[0].AZM,a3.ns,a3.ew,a3.tvd);
          end;
         a4.ns:=a1.ns;         a4.ew:=a1.ew;        a4.tvd:=a1.tvd;
         a5.ns:=a2.ns;         a5.ew:=a2.ew;        a5.tvd:=a2.tvd;
         a6.ns:=a3.ns;         a6.ew:=a3.ew;        a6.tvd:=a3.tvd;
        end;
      end
     else if rocal[1]=33 then
      begin
       if (wlptp.INC=0) then
        wlptp.azm:=wlpt[0].azm
       else if (wlpt[0].INC=0) then
        wlpt[0].azm:=wlptp.azm;
       A1.ns:=wlptp.NS;      A1.EW:=wlptp.EW;     A1.TVD:=wlptp.TVD;
       surtovct(wlptp.INC,wlptp.AZM,a2.ns,a2.ew,a2.tvd);
       surtovct(wlpt[0].INC,wlpt[0].AZM,a3.ns,a3.ew,a3.tvd);
       a4.ns:=a1.ns;         a4.ew:=a1.ew;        a4.tvd:=a1.tvd;
       a5.ns:=a2.ns;         a5.ew:=a2.ew;        a5.tvd:=a2.tvd;
       a6.ns:=a3.ns;         a6.ew:=a3.ew;        a6.tvd:=a3.tvd;
      end
{     else if rocal[1]=38 then
      begin
       if (wlptp.INC=0) then
        wlptp.azm:=wlpt[0].azm
       else if (wlpt[0].INC=0) then
        wlpt[0].azm:=wlptp.azm;
       A1.ns:=wlptp.NS;      A1.EW:=wlptp.EW;     A1.TVD:=wlptp.TVD;
       surtovct(wlptp.INC,wlptp.AZM,a2.ns,a2.ew,a2.tvd);
       ex4:=sqrt(sqr(wlptp.NS-wlpt[0].ns)+sqr(wlptp.ew-wlpt[0].ew)+sqr(wlptp.tvd-wlpt[0].tvd));
       a3.ns:=(wlpt[0].NS-wlptp.ns)/ex4;
       a3.ew:=(wlpt[0].ew-wlptp.ew)/ex4;
       a3.tvd:=(wlpt[0].tvd-wlptp.tvd)/ex4;
       ex3:=2*(wlpt[0].tvd-wlptp.tvd)/(a2.tvd+a3.tvd);
       a3.ns:=2*a3.ns/ex3-a2.ns;        a3.ew:=2*a3.ew/ex3-a2.ew;
       a4.ns:=a1.ns;         a4.ew:=a1.ew;        a4.tvd:=a1.tvd;
       a5.ns:=a2.ns;         a5.ew:=a2.ew;        a5.tvd:=a2.tvd;
       a6.ns:=a3.ns;         a6.ew:=a3.ew;        a6.tvd:=a3.tvd;
      end
                   }

     else if rocal[1]=34 then
      begin
       A1.ns:=wlptp.NS;      A1.EW:=wlptp.EW;     A1.TVD:=wlptp.TVD;
       surtovct(wlptp.INC,wlptp.AZM,a2.ns,a2.ew,a2.tvd);
       if ((wlptp.INC=0)or(wlpt[0].inc=0))and(not((wlptp.INC=0)and(wlpt[0].inc=0))) then
        begin
         form08.RadioButton1.Caption:='INC';
         form08.RadioButton2.Caption:='TVD';
         form08.RadioButton3.Caption:='DLS';
         form08.Caption:='SELECT THE ORDER NO.: '+inttostr(wlpt[0].order);
         form08.ShowModal;
         wlpt[0].AZM:=wlptp.AZM;
         if form08.RadioButton1.Checked then
          begin
           wlpt[0].inc:=ArcSin((wlpt[0].tvd-wlptp.tvd)*wlpt[0].dls);
          end;
         surtovct(wlpt[0].INC,wlpt[0].AZM,a3.ns,a3.ew,a3.tvd);
         a4.ns:=a1.ns;         a4.ew:=a1.ew;        a4.tvd:=a1.tvd;
         a5.ns:=a2.ns;         a5.ew:=a2.ew;        a5.tvd:=a2.tvd;
         a6.ns:=a3.ns;         a6.ew:=a3.ew;        a6.tvd:=a3.tvd;
         if form08.RadioButton2.Checked then
          begin
           wlpt[0].TVD:=wlptp.TVD+sin(wlpt[0].inc)/wlpt[0].DLS;
          end
         else if form08.RadioButton3.Checked then
          begin
           wlpt[0].dls:=Sin(wlpt[0].inc)/(wlpt[0].tvd-wlptp.TVD);
          end;
         wlpt[0].md:=wlpt[0].INC/wlpt[0].DLS;
        end
       else
        begin
         r:=2*(wlpt[0].tvd-wlptp.tvd)/(cos(wlptp.inc)+cos(wlpt[0].inc));
         r:=4/sqr(wlpt[0].dls*r);
         r:=(r-1)/(r+1);
         wlpt[0].dmd:=ArcCos(r)/wlpt[0].dls;
         surtovct(wlpt[0].INC,0,r,a3.ew,a3.tvd);
         theta:=wlpt[0].dmd*wlpt[0].dls;
         a:=a2.ew*a2.ew+a2.ns*a2.ns;
         b:=-2*a2.ns*(cos(theta)-a2.tvd*a3.tvd);
         c:=sqr(cos(theta)-a2.tvd*a3.tvd)-r*r*a2.ew*a2.ew;
         if ((b*b-4*a*c)<0) then
          begin
           ShowMessage('ERROR IN ORDER: '+inttostr(kk)+#13#10
           +'     MIN DLS= '+FLOATTOSTR(abs(dec(3,ArcCos(A2.tvd*A3.tvd+R*SQRT(a))*180*100/(3.14*wlpt[0].dmd))))+#13#10
           +'     MAX DLS= '+FLOATTOSTR(abs(dec(3,ArcCos(A2.tvd*A3.tvd-R*SQRT(a))*180*100/(3.14*wlpt[0].dmd)))));
           exit;
          end;
         a3.ns:=(-b+sqrt(abs(b*b-4*a*c)))/(2*a);
         if a2.ew<>0 then
          a3.ew:=(cos(theta)-a3.ns*a2.ns-a3.tvd*a2.tvd)/a2.ew
         else
          a3.ew:=sqrt(1-sqr(a3.ns)-sqr(a3.tvd));
         vcttosur(a3.ns,a3.ew,a3.tvd,wlpt[0].inc,wlpt[0].azm);
         form07.RadioButton1.caption:=floattostr(dec(3,wlpt[0].azm*180/pi));
         a3.ns:=(-b-sqrt(abs(b*b-4*a*c)))/(2*a);
         if a2.ew<>0 then
          a3.ew:=(cos(theta)-a3.ns*a2.ns-a3.tvd*a2.tvd)/a2.ew
         else
          a3.ew:=sqrt(1-sqr(a3.ns)-sqr(a3.tvd));
         vcttosur(a3.ns,a3.ew,a3.tvd,wlpt[0].inc,wlpt[0].azm);
         form07.RadioButton2.caption:=floattostr(dec(3,wlpt[0].azm*180/pi));
         form07.ShowModal;
         if form07.RadioButton1.Checked then
          wlpt[0].AZM:=pi/180*strtofloat(form07.RadioButton1.caption)
         else
          wlpt[0].AZM:=pi/180*strtofloat(form07.RadioButton2.caption);
         surtovct(wlpt[0].INC,wlpt[0].AZM,a3.ns,a3.ew,a3.tvd);
         a4.ns:=a1.ns;         a4.ew:=a1.ew;        a4.tvd:=a1.tvd;
         a5.ns:=a2.ns;         a5.ew:=a2.ew;        a5.tvd:=a2.tvd;
         a6.ns:=a3.ns;         a6.ew:=a3.ew;        a6.tvd:=a3.tvd;
        end;
       A1.ns:=wlptp.NS;      A1.EW:=wlptp.EW;     A1.TVD:=wlptp.TVD;
       surtovct(wlptp.INC,wlptp.AZM,a2.ns,a2.ew,a2.tvd);
       surtovct(wlpt[0].INC,wlpt[0].AZM,a3.ns,a3.ew,a3.tvd);
       a4.ns:=a1.ns;         a4.ew:=a1.ew;        a4.tvd:=a1.tvd;
       a5.ns:=a2.ns;         a5.ew:=a2.ew;        a5.tvd:=a2.tvd;
       a6.ns:=a3.ns;         a6.ew:=a3.ew;        a6.tvd:=a3.tvd;
      end
     else if rocal[1]=35 then
      begin
       if (wlptp.INC=0) then
        wlptp.azm:=wlpt[0].azm
       else if (wlpt[0].INC=0) then
        wlpt[0].azm:=wlptp.azm;
       A1.ns:=wlptp.NS;      A1.EW:=wlptp.EW;     A1.TVD:=wlptp.TVD;
       surtovct(wlptp.INC,wlptp.AZM,a2.ns,a2.ew,a2.tvd);
       surtovct(wlpt[0].INC,wlpt[0].AZM,a3.ns,a3.ew,a3.tvd);
       A7.ns:=(a2.ns+a3.ns)*(wlpt[0].tvd-wlptp.tvd)/(a2.tvd+a3.tvd);
       A7.EW:=(a2.ew+a3.ew)*(wlpt[0].tvd-wlptp.tvd)/(a2.tvd+a3.tvd);
       A7.TVD:=(a2.tvd+a3.tvd)*(wlpt[0].tvd-wlptp.tvd)/(a2.tvd+a3.tvd);
       if abs(1-(a2.ns*a3.ns+a2.ew*a3.ew+a2.tvd*a3.tvd))>0.00000000001 then
        begin
         r:=sqrt((sqr(a7.ns)+sqr(a7.ew)+sqr(a7.tvd))/(2*(1-(a2.ns*a3.ns+a2.ew*a3.ew+a2.tvd*a3.tvd))));
         wlpt[0].DLS:=1/r;
        end
       else
         wlpt[0].DLS:=0;
       a4.ns:=a1.ns;         a4.ew:=a1.ew;        a4.tvd:=a1.tvd;
       a5.ns:=a2.ns;         a5.ew:=a2.ew;        a5.tvd:=a2.tvd;
       a6.ns:=a3.ns;         a6.ew:=a3.ew;        a6.tvd:=a3.tvd;
      end
     else if rocal[1]=36 then
      begin
       if wlptp.md>=wlpt[0].MD then
        begin
         showmessage('Computed Measured Depth is Less than Measure Depth of Previous Station');
         exit;
        end;
       if (wlptp.INC=0) then
        wlptp.azm:=wlpt[0].azm
       else if (wlpt[0].INC=0) then
        wlpt[0].azm:=wlptp.azm;
       A1.ns:=wlptp.NS;      A1.EW:=wlptp.EW;     A1.TVD:=wlptp.TVD;
       surtovct(wlptp.INC,wlptp.AZM,a2.ns,a2.ew,a2.tvd);
       surtovct(wlpt[0].INC,wlpt[0].AZM,a3.ns,a3.ew,a3.tvd);
       if abs(ARCCOS(a2.ns*a3.ns+a2.ew*a3.ew+a2.tvd*a3.tvd))>0.00000000001 then
        begin
         r:=(WLPT[0].MD-WLPTP.MD)/ARCCOS(a2.ns*a3.ns+a2.ew*a3.ew+a2.tvd*a3.tvd);
         wlpt[0].DLS:=1/r;
        end
       else
        begin
         wlpt[0].DLS:=0;
         Goto GotoLabel1;
        end;
       a4.ns:=a1.ns;         a4.ew:=a1.ew;        a4.tvd:=a1.tvd;
       a5.ns:=a2.ns;         a5.ew:=a2.ew;        a5.tvd:=a2.tvd;
       a6.ns:=a3.ns;         a6.ew:=a3.ew;        a6.tvd:=a3.tvd;
      end
     else if rocal[1]=51 then
      begin
       wlpt[0].dmd:=wlpt[0].md-wlptp.md;
       if (wlptp.INC=0) then
        begin
         wlpt[0].azm:=wlptp.azm;
         wlpt[0].inc:=arccos(cos(wlptp.inc)*cos(wlpt[0].dmd*wlpt[0].dls)-sin(wlptp.inc)*sin(wlpt[0].dmd*wlpt[0].dls)*cos(wlptp.tf));
        end
       else if (wlptp.INC<>0) then
        begin
         if arctan(tan(wlpt[0].dmd*wlpt[0].dls)/(sin(wlptp.inc)+tan(wlpt[0].dmd*wlpt[0].dls)*cos(wlptp.inc)*cos(wlptp.tf)))>0 then
          wlpt[0].azm:=wlptp.azm+arctan(tan(wlpt[0].dmd*wlpt[0].dls)*sin(wlptp.tf)/(sin(wlptp.inc)+tan(wlpt[0].dmd*wlpt[0].dls)*cos(wlptp.inc)*cos(wlptp.tf)))
         else if arctan(tan(wlpt[0].dmd*wlpt[0].dls)/(sin(wlptp.inc)+tan(wlpt[0].dmd*wlpt[0].dls)*cos(wlptp.inc)*cos(wlptp.tf)))<0 then
          wlpt[0].azm:=pi+wlptp.azm+arctan(tan(wlpt[0].dmd*wlpt[0].dls)*sin(wlptp.tf)/(sin(wlptp.inc)+tan(wlpt[0].dmd*wlpt[0].dls)*cos(wlptp.inc)*cos(wlptp.tf)))
         else
          wlpt[0].azm:=wlptp.azm;

         wlpt[0].inc:=sign(arcsin(sin(wlptp.tf)*sin(wlpt[0].dmd*wlpt[0].dls)/sin(wlpt[0].azm-wlptp.azm)))
         *arccos(cos(wlptp.inc)*cos(wlpt[0].dmd*wlpt[0].dls)-sin(wlptp.inc)*sin(wlpt[0].dmd*wlpt[0].dls)*cos(wlptp.tf));

        end;
       A1.ns:=wlptp.NS;      A1.EW:=wlptp.EW;     A1.TVD:=wlptp.TVD;
       surtovct(wlptp.INC,wlptp.AZM,a2.ns,a2.ew,a2.tvd);
       surtovct(wlpt[0].INC,wlpt[0].AZM,a3.ns,a3.ew,a3.tvd);
       a4.ns:=a1.ns;         a4.ew:=a1.ew;        a4.tvd:=a1.tvd;
       a5.ns:=a2.ns;         a5.ew:=a2.ew;        a5.tvd:=a2.tvd;
       a6.ns:=a3.ns;         a6.ew:=a3.ew;        a6.tvd:=a3.tvd;
      end
     else if rocal[1]=53 then
      begin
       if (wlptp.INC=0) then
        begin
         wlpt[0].azm:=wlptp.azm;
         wlpt[0].inc:=arccos(cos(wlptp.inc)*cos(wlpt[0].dmd*wlpt[0].dls)-sin(wlptp.inc)*sin(wlpt[0].dmd*wlpt[0].dls)*cos(wlptp.tf));
        end
       else if (wlptp.INC<>0) then
        begin
         if arctan(tan(wlpt[0].dmd*wlpt[0].dls)/(sin(wlptp.inc)+tan(wlpt[0].dmd*wlpt[0].dls)*cos(wlptp.inc)*cos(wlptp.tf)))>0 then
          wlpt[0].azm:=wlptp.azm+arctan(tan(wlpt[0].dmd*wlpt[0].dls)*sin(wlptp.tf)/(sin(wlptp.inc)+tan(wlpt[0].dmd*wlpt[0].dls)*cos(wlptp.inc)*cos(wlptp.tf)))
         else if arctan(tan(wlpt[0].dmd*wlpt[0].dls)/(sin(wlptp.inc)+tan(wlpt[0].dmd*wlpt[0].dls)*cos(wlptp.inc)*cos(wlptp.tf)))<0 then
          wlpt[0].azm:=pi+wlptp.azm+arctan(tan(wlpt[0].dmd*wlpt[0].dls)*sin(wlptp.tf)/(sin(wlptp.inc)+tan(wlpt[0].dmd*wlpt[0].dls)*cos(wlptp.inc)*cos(wlptp.tf)))
         else
          wlpt[0].azm:=wlptp.azm;

         wlpt[0].inc:=sign(arcsin(sin(wlptp.tf)*sin(wlpt[0].dmd*wlpt[0].dls)/sin(wlpt[0].azm-wlptp.azm)))
         *arccos(cos(wlptp.inc)*cos(wlpt[0].dmd*wlpt[0].dls)-sin(wlptp.inc)*sin(wlpt[0].dmd*wlpt[0].dls)*cos(wlptp.tf));
        end;
       A1.ns:=wlptp.NS;      A1.EW:=wlptp.EW;     A1.TVD:=wlptp.TVD;
       surtovct(wlptp.INC,wlptp.AZM,a2.ns,a2.ew,a2.tvd);
       surtovct(wlpt[0].INC,wlpt[0].AZM,a3.ns,a3.ew,a3.tvd);
       a4.ns:=a1.ns;         a4.ew:=a1.ew;        a4.tvd:=a1.tvd;
       a5.ns:=a2.ns;         a5.ew:=a2.ew;        a5.tvd:=a2.tvd;
       a6.ns:=a3.ns;         a6.ew:=a3.ew;        a6.tvd:=a3.tvd;
      end
     else if rocal[1]=54 then
      begin
       if (wlptp.INC=0) then
        begin
         wlpt[0].azm:=wlptp.azm;
         wlpt[0].inc:=arccos(cos(wlptp.inc)*cos(wlpt[0].dmd*wlpt[0].dls)-sin(wlptp.inc)*sin(wlpt[0].dmd*wlpt[0].dls)*cos(wlptp.tf));
        end
       else if (wlptp.INC<>0) then
        begin
         a:=cos(wlptp.inc)+cos(wlpt[0].inc);
         b:=2*sin(wlptp.inc)*cos(wlptp.tf);
         c:=cos(wlpt[0].inc)-cos(wlptp.inc);
         if (((-b+sqrt(abs(b*b-4*a*c)))/(2*a)>0)and((-b-sqrt(abs(b*b-4*a*c)))/(2*a)>0)) then
          begin
           form07.RadioButton1.Caption:=floattostr(dec(3,2*arctan((-b+sqrt(abs(b*b-4*a*c)))/(2*a))/wlpt[0].dls));
           form07.RadioButton2.Caption:=floattostr(dec(3,2*arctan((-b-sqrt(abs(b*b-4*a*c)))/(2*a))/wlpt[0].dls));
           form07.ShowModal;
           if form07.RadioButton1.Checked then
            wlpt[0].dmd:=2*arctan((-b+sqrt(abs(b*b-4*a*c)))/(2*a))/wlpt[0].dls
           else
            wlpt[0].dmd:=2*arctan((-b-sqrt(abs(b*b-4*a*c)))/(2*a))/wlpt[0].dls;
          end
         else if ((-b+sqrt(abs(b*b-4*a*c)))/(2*a)>0)then
          wlpt[0].dmd:=2*arctan((-b+sqrt(abs(b*b-4*a*c)))/(2*a))/wlpt[0].dls
         else
          wlpt[0].dmd:=2*arctan((-b-sqrt(abs(b*b-4*a*c)))/(2*a))/wlpt[0].dls;

         if arctan(tan(wlpt[0].dmd*wlpt[0].dls)/(sin(wlptp.inc)+tan(wlpt[0].dmd*wlpt[0].dls)*cos(wlptp.inc)*cos(wlptp.tf)))>0 then
          wlpt[0].azm:=wlptp.azm+arctan(tan(wlpt[0].dmd*wlpt[0].dls)*sin(wlptp.tf)/(sin(wlptp.inc)+tan(wlpt[0].dmd*wlpt[0].dls)*cos(wlptp.inc)*cos(wlptp.tf)))
         else if arctan(tan(wlpt[0].dmd*wlpt[0].dls)/(sin(wlptp.inc)+tan(wlpt[0].dmd*wlpt[0].dls)*cos(wlptp.inc)*cos(wlptp.tf)))<0 then
          wlpt[0].azm:=pi+wlptp.azm+arctan(tan(wlpt[0].dmd*wlpt[0].dls)*sin(wlptp.tf)/(sin(wlptp.inc)+tan(wlpt[0].dmd*wlpt[0].dls)*cos(wlptp.inc)*cos(wlptp.tf)))
         else
          wlpt[0].azm:=wlptp.azm;
        end;
       A1.ns:=wlptp.NS;      A1.EW:=wlptp.EW;     A1.TVD:=wlptp.TVD;
       surtovct(wlptp.INC,wlptp.AZM,a2.ns,a2.ew,a2.tvd);
       surtovct(wlpt[0].INC,wlpt[0].AZM,a3.ns,a3.ew,a3.tvd);
       a4.ns:=a1.ns;         a4.ew:=a1.ew;        a4.tvd:=a1.tvd;
       a5.ns:=a2.ns;         a5.ew:=a2.ew;        a5.tvd:=a2.tvd;
       a6.ns:=a3.ns;         a6.ew:=a3.ew;        a6.tvd:=a3.tvd;
      end
     else if rocal[1]=55 then
      begin
       if (wlptp.INC<>0) then
        begin
         a:=wlpt[0].AZM-wlptp.AZM;
         wlpt[0].dmd:=(arctan((tan(a)*sin(wlptp.inc))/(sin(wlptp.tf)-tan(a)*cos(wlptp.inc)*cos(wlptp.tf)))/wlpt[0].DLS);
         wlpt[0].inc:=arccos(cos(wlptp.INC)*cos(wlpt[0].dmd*wlpt[0].dls)-sin(wlptp.INC)*sin(wlpt[0].dmd*wlpt[0].dls)*cos(wlptp.tf));
         A1.ns:=wlptp.NS;      A1.EW:=wlptp.EW;     A1.TVD:=wlptp.TVD;
         surtovct(wlptp.INC,wlptp.AZM,a2.ns,a2.ew,a2.tvd);
         surtovct(wlpt[0].INC,wlpt[0].AZM,a3.ns,a3.ew,a3.tvd);
         a4.ns:=a1.ns;         a4.ew:=a1.ew;        a4.tvd:=a1.tvd;
         a5.ns:=a2.ns;         a5.ew:=a2.ew;        a5.tvd:=a2.tvd;
         a6.ns:=a3.ns;         a6.ew:=a3.ew;        a6.tvd:=a3.tvd;
        end;
      end
     else if trunc(rocal[1]/10)=6 then
      begin
       wlpt[0].dmd:=wlpt[0].md-wlptp.md;
       if (rocal[1] mod 10=1) then
        begin
         wlpt[0].azm:=wlptp.azm;
         wlpt[0].INC:=wlptp.inc+wlpt[0].dmd*wlpt[0].br;
        end
       else if (rocal[1] mod 10=2) then
        begin
         wlpt[0].azm:=wlptp.AZM+wlpt[0].dmd*wlpt[0].tr;
         wlpt[0].INC:=wlptp.inc;
        end
       else if (rocal[1] mod 10=3) then
        begin
         wlpt[0].azm:=wlptp.AZM+wlpt[0].dmd*wlpt[0].tr;
         wlpt[0].INC:=wlptp.inc+wlpt[0].dmd*wlpt[0].br;
        end;
       A1.ns:=wlptp.NS;      A1.EW:=wlptp.EW;     A1.TVD:=wlptp.TVD;
       surtovct(wlptp.INC,wlptp.AZM,a2.ns,a2.ew,a2.tvd);
       surtovct(wlpt[0].INC,wlpt[0].AZM,a3.ns,a3.ew,a3.tvd);
       wlpt[0].DLS:=arccos(a2.ns*a3.ns+a2.ew*a3.ew+a2.tvd*a3.tvd)/wlpt[0].dmd;
       a4.ns:=a1.ns;         a4.ew:=a1.ew;        a4.tvd:=a1.tvd;
       a5.ns:=a2.ns;         a5.ew:=a2.ew;        a5.tvd:=a2.tvd;
       a6.ns:=a3.ns;         a6.ew:=a3.ew;        a6.tvd:=a3.tvd;
      end
     else if trunc(rocal[1]/10)=8 then
      begin
       if (rocal[1] mod 10=1) then
        begin
         wlpt[0].azm:=wlptp.azm;
         wlpt[0].INC:=wlptp.inc+wlpt[0].dmd*wlpt[0].br;
        end
       else if (rocal[1] mod 10=2) then
        begin
         wlpt[0].azm:=wlptp.AZM+wlpt[0].dmd*wlpt[0].tr;
         wlpt[0].INC:=wlptp.inc;
        end
       else if (rocal[1] mod 10=3) then
        begin
         wlpt[0].azm:=wlptp.AZM+wlpt[0].dmd*wlpt[0].tr;
         wlpt[0].INC:=wlptp.inc+wlpt[0].dmd*wlpt[0].br;
        end;
       A1.ns:=wlptp.NS;      A1.EW:=wlptp.EW;     A1.TVD:=wlptp.TVD;
       surtovct(wlptp.INC,wlptp.AZM,a2.ns,a2.ew,a2.tvd);
       surtovct(wlpt[0].INC,wlpt[0].AZM,a3.ns,a3.ew,a3.tvd);
       wlpt[0].DLS:=arccos(a2.ns*a3.ns+a2.ew*a3.ew+a2.tvd*a3.tvd)/wlpt[0].dmd;
       a4.ns:=a1.ns;         a4.ew:=a1.ew;        a4.tvd:=a1.tvd;
       a5.ns:=a2.ns;         a5.ew:=a2.ew;        a5.tvd:=a2.tvd;
       a6.ns:=a3.ns;         a6.ew:=a3.ew;        a6.tvd:=a3.tvd;
      end
     else if trunc(rocal[1]/10)=9 then
      begin
       wlpt[0].dmd:=(wlpt[0].inc-wlptp.INC)/wlpt[0].br;
       if (rocal[1] mod 10=1) then
        begin
         wlpt[0].azm:=wlptp.azm;
         wlpt[0].INC:=wlptp.inc+wlpt[0].dmd*wlpt[0].br;
        end
       else if (rocal[1] mod 10=3) then
        begin
         wlpt[0].azm:=wlptp.AZM+wlpt[0].dmd*wlpt[0].tr;
         wlpt[0].INC:=wlptp.inc+wlpt[0].dmd*wlpt[0].br;
        end;
       A1.ns:=wlptp.NS;      A1.EW:=wlptp.EW;     A1.TVD:=wlptp.TVD;
       surtovct(wlptp.INC,wlptp.AZM,a2.ns,a2.ew,a2.tvd);
       surtovct(wlpt[0].INC,wlpt[0].AZM,a3.ns,a3.ew,a3.tvd);
       wlpt[0].DLS:=arccos(a2.ns*a3.ns+a2.ew*a3.ew+a2.tvd*a3.tvd)/wlpt[0].dmd;
       a4.ns:=a1.ns;         a4.ew:=a1.ew;        a4.tvd:=a1.tvd;
       a5.ns:=a2.ns;         a5.ew:=a2.ew;        a5.tvd:=a2.tvd;
       a6.ns:=a3.ns;         a6.ew:=a3.ew;        a6.tvd:=a3.tvd;
      end
     else if trunc(rocal[1]/10)=10 then
      begin
       if (wlptp.INC<>0) then
        begin
         wlpt[0].dmd:=(wlpt[0].AZM-wlptp.AZM)/wlpt[0].tr;
        end;
       if (rocal[1] mod 10=2) then
        begin
         wlpt[0].azm:=wlptp.AZM+wlpt[0].dmd*wlpt[0].tr;
         wlpt[0].INC:=wlptp.inc;
        end
       else if (rocal[1] mod 10=3) then
        begin
         wlpt[0].azm:=wlptp.AZM+wlpt[0].dmd*wlpt[0].tr;
         wlpt[0].INC:=wlptp.inc+wlpt[0].dmd*wlpt[0].br;
        end;
       if (wlptp.INC<>0) then
        begin
         a:=wlpt[0].AZM-wlptp.AZM;
         A1.ns:=wlptp.NS;      A1.EW:=wlptp.EW;     A1.TVD:=wlptp.TVD;
         surtovct(wlptp.INC,wlptp.AZM,a2.ns,a2.ew,a2.tvd);
         surtovct(wlpt[0].INC,wlpt[0].AZM,a3.ns,a3.ew,a3.tvd);
         wlpt[0].DLS:=arccos(a2.ns*a3.ns+a2.ew*a3.ew+a2.tvd*a3.tvd)/wlpt[0].dmd;
         a4.ns:=a1.ns;         a4.ew:=a1.ew;        a4.tvd:=a1.tvd;
         a5.ns:=a2.ns;         a5.ew:=a2.ew;        a5.tvd:=a2.tvd;
         a6.ns:=a3.ns;         a6.ew:=a3.ew;        a6.tvd:=a3.tvd;
        end;
      end;
      {****************************************************************************}
     theta:=-999;
     plane(A10,A2,A3,A5,theta);
     vcttosur(a5.ns,a5.ew,a5.tvd,wlptp2.inc,wlptp2.azm);
     plane(A10,A2,A3,A6,theta);
     vcttosur(a6.ns,a6.ew,a6.tvd,wlpt2[0].inc,wlpt2[0].azm);
     wlpt2[0].inc:=power(-1,round((wlpt2[0].azm/pi-1/2)))*wlpt2[0].inc;
     wlpt2[0].azm:=pi/2;
     wlptp2.inc:=power(-1,round((wlptp2.azm/pi-1/2)))*wlptp2.inc;
     wlptp2.azm:=pi/2;
     if wlptp2.INC>wlpt2[0].INC then
      wlpt[0].DLS:=-abs(wlpt[0].DLS)
     else
      wlpt[0].DLS:=abs(wlpt[0].DLS);
     {*******************}
     c3(wlptp2.INC,wlpt2[0].inc,wlpt[0].dls,wlpta1,wlpta2);
     plane(A1,A2,A3,A4,theta);
     a5.ns:=wlpta2[1].ns+a4.ns;    a5.ew:=wlpta2[1].ew+a4.ew;   a5.tvd:=wlpta2[1].tvd+a4.tvd;
     a6.ns:=wlpta2[0].ns+a4.ns;    a6.ew:=wlpta2[0].ew+a4.ew;   a6.tvd:=wlpta2[0].tvd+a4.tvd;
     a11.ns:=a6.ns-a5.ns;   a11.ew:=a6.ew-a5.ew;    a11.tvd:=a6.tvd-a5.tvd;
     revplane(A1,A2,A3,theta,A5);
     revplane(A1,A2,A3,theta,A6);
     a11.ns:=a6.ns-a5.ns;   a11.ew:=a6.ew-a5.ew;    a11.tvd:=a6.tvd-a5.tvd;
     vcttosur(a11.ns,a11.ew,a11.tvd,wlpt2[0].inc,wlpt2[0].azm);
     wlpt2[0].ns:=a6.ns;   wlpt2[0].ew:=a6.ew;  wlpt2[0].tvd:=a6.tvd;
     wlpt2[0].MD:=wlpta2[0].MD+wlptp.MD;
     wlpt2[0].dls:=abs(wlpta2[0].dls);
     wlpt2[0].cmt:=wlpta2[0].cmt;
     wlpt2[0].dmd:=wlpta2[0].dmd;
     wlpt2[0].tr:=(wlpt2[0].azm-wlptp.azm)/wlpt2[0].dmd;
     wlpt2[0].br:=(wlpt2[0].inc-wlptp.inc)/wlpt2[0].dmd;

     cellfill(wlpt2,2,kk);
     md:=wlpt2[0].MD-wlptp.MD;
     if (md/ppf)=trunc(md/ppf) then
      m:=2*(trunc(md/ppf))+1
     else
      m:=2*(trunc(md/ppf)+1)+1;
     for i := 0 to (m-1) do
      begin
       wlpta1[i].order:=wlpt[0].order;
       wlpta1[i].typ:=kk;
      end;
     wlpt1[kk,0].order:=kk;
     wlpt1[kk,0].typ:=rocal[1];
     tableshow1(wlpta1,wlptpp,wlptp,wlpt2[0],a1,a2,a3,a4,v[0],kk,rocal[1],theta,MD,ll,nn,wlpta1);
     for i:= 0 to m - 1 do
      begin
       wlpt1[kk,i].MD:=wlpta1[i].MD;
       wlpt1[kk,i].INC:=wlpta1[i].INC;
       wlpt1[kk,i].azm:=wlpta1[i].AZM;
       wlpt1[kk,i].TVD:=wlpta1[i].TVD;
       wlpt1[kk,i].VSEC:=wlpta1[i].VSEC;
       wlpt1[kk,i].NS:=wlpta1[i].NS;
       wlpt1[kk,i].EW:=wlpta1[i].EW;
       wlpt1[kk,i].DLS:=wlpta1[i].DLS;
       wlpt1[kk,i].tf:=wlpta1[i].TF;
       wlpt1[kk,i].tr:=wlpta1[i].TR;
       wlpt1[kk,i].br:=wlpta1[i].BR;
       wlpt1[kk,i].dmd:=wlpta1[i].DMD;
       wlpt1[kk,i].order:=wlpta1[i].ORDER;
       wlpt1[kk,i].typ:=wlpta1[i].TYP;
       wlpt1[kk,i].CMT:=wlpta1[i].CMT;
      end;
    end;
  end;
 ll:=0;
 ADOTABLE2.First;
 while ADOTABLE2.FieldByName('ordr').asinteger<>-1 do
  begin
   ll:=ADOTABLE2.FieldByName('ordr').asinteger;
   wlptpt.ns:=ADOTABLE2.FieldByName('NS').asfloat;
   wlptpt.ew:=ADOTABLE2.FieldByName('EW').asfloat;
   ADOTABLE2.Next;
  end;
 v[0].ns:=wlptpt.NS-wlptpp.NS;
 v[0].ew:=wlptpt.ew-wlptpp.ew;
 for kk := 1 to ll do
  begin
   theta:=-999;
   i:=0;
   jj:=0;
   ADOTABLE2.First;
   for ii := 0 to 50 do
    begin
     if (kk-1=ADOTABLE2.FieldByName('ordr').asinteger)then
      begin
       wlptp.md:=ADOTABLE2.FieldByName('md').AsFloat;
       wlptp.inc:=ADOTABLE2.FieldByName('incl').AsFloat*pi/180;
       wlptp.azm:=ADOTABLE2.FieldByName('azm').AsFloat*pi/180;
       wlptp.TVD:=ADOTABLE2.FieldByName('tvd').AsFloat;
       wlptp.vsec:=ADOTABLE2.FieldByName('vsec').AsFloat;
       wlptp.NS:=ADOTABLE2.FieldByName('ns').AsFloat;
       wlptp.EW:=ADOTABLE2.FieldByName('ew').AsFloat;
       wlptp.DLS:=ADOTABLE2.FieldByName('dls').AsFloat*pi/18000;
       wlptp.tf:=ADOTABLE2.FieldByName('TF').AsFloat*pi/180;
       wlptp.tr:=ADOTABLE2.FieldByName('TR').AsFloat*pi/18000;
       wlptp.br:=ADOTABLE2.FieldByName('BR').AsFloat*pi/18000;
       wlptp.dmd:=ADOTABLE2.FieldByName('DMD').AsFloat;
       wlptp.order:=ADOTABLE2.FieldByName('Ordr').Asinteger;
       wlptp.typ:=ADOTABLE2.FieldByName('Type').Asinteger;
      end
     else if(kk=ADOTABLE2.FieldByName('ordr').asinteger)then
      begin
       wlpt[jj].md:=ADOTABLE2.FieldByName('md').AsFloat;
       wlpt[jj].inc:=ADOTABLE2.FieldByName('incl').AsFloat*pi/180;
       wlpt[jj].azm:=ADOTABLE2.FieldByName('azm').AsFloat*pi/180;
       wlpt[jj].TVD:=ADOTABLE2.FieldByName('tvd').AsFloat;
       wlpt[jj].vsec:=ADOTABLE2.FieldByName('vsec').AsFloat;
       wlpt[jj].NS:=ADOTABLE2.FieldByName('ns').AsFloat;
       wlpt[jj].EW:=ADOTABLE2.FieldByName('ew').AsFloat;
       wlpt[jj].DLS:=ADOTABLE2.FieldByName('dls').AsFloat*pi/18000;
       wlpt[jj].tf:=ADOTABLE2.FieldByName('TF').AsFloat*pi/180;
       wlpt[jj].tr:=ADOTABLE2.FieldByName('TR').AsFloat*pi/18000;
       wlpt[jj].br:=ADOTABLE2.FieldByName('BR').AsFloat*pi/18000;
       wlpt[jj].dmd:=ADOTABLE2.FieldByName('DMD').AsFloat;
       wlpt[jj].order:=ADOTABLE2.FieldByName('Ordr').Asinteger;
       wlpt[jj].typ:=ADOTABLE2.FieldByName('Type').Asinteger;
       i:=jj;
       jj:=jj+1;
       rocal[1]:=ADOTABLE2.FieldByName('type').asinteger;
      end
     else if(kk+1=ADOTABLE2.FieldByName('ordr').asinteger)then
      begin
       wlptf.md:=ADOTABLE2.FieldByName('md').AsFloat;
       wlptf.inc:=ADOTABLE2.FieldByName('incl').AsFloat*pi/180;
       wlptf.azm:=ADOTABLE2.FieldByName('azm').AsFloat*pi/180;
       wlptf.TVD:=ADOTABLE2.FieldByName('tvd').AsFloat;
       wlptf.vsec:=ADOTABLE2.FieldByName('vsec').AsFloat;
       wlptf.NS:=ADOTABLE2.FieldByName('ns').AsFloat;
       wlptf.EW:=ADOTABLE2.FieldByName('ew').AsFloat;
       wlptf.DLS:=ADOTABLE2.FieldByName('dls').AsFloat*pi/18000;
       wlptf.tf:=ADOTABLE2.FieldByName('TF').AsFloat*pi/180;
       wlptf.tr:=ADOTABLE2.FieldByName('TR').AsFloat*pi/18000;
       wlptf.br:=ADOTABLE2.FieldByName('BR').AsFloat*pi/18000;
       wlptf.dmd:=ADOTABLE2.FieldByName('DMD').AsFloat;
       wlptf.order:=ADOTABLE2.FieldByName('Ordr').Asinteger;
       wlptf.typ:=ADOTABLE2.FieldByName('Type').Asinteger;
       jj:=jj+1;
      end;
     if ((wlpt[i].md-wlptp.MD)-10*trunc((wlpt[i].md-wlptp.MD)/10)=1) then
      wlpt[i].MD:=wlpt[i].md+0.001;
     ADOTABLE2.Next;
    end;
   if kk=ll then
    wlptf.typ:=-1
   else
    wlptf.typ:=1;
  if (wlptp.typ=0) then
    begin
     if (sin(wlpt[0].dls*wlpt[0].dmd)<>0) then
      begin
       if sin(wlpt[0].inc)*sin(wlpt[0].azm-wlptp.azm)<>0 then
        begin
         wlptp.tf:=sign(sin(wlpt[0].inc)*sin(wlpt[0].azm-wlptp.azm)/sin(wlpt[0].dls*wlpt[0].dmd))
         *arccos((cos(wlptp.inc)*cos(wlpt[0].dls*wlpt[0].dmd)-cos(wlpt[0].inc))/(sin(wlptp.inc)*sin(wlpt[0].dls*wlpt[0].dmd)));
        end
       else
        begin
         wlptp.tf:=arccos((cos(wlptp.inc)*cos(wlpt[0].dls*wlpt[0].dmd)-cos(wlpt[0].inc))/(sin(wlptp.inc)*sin(wlpt[0].dls*wlpt[0].dmd)));
        end;
      end;
     ADOTABLE2.First;
     with ADOTABLE2 do
      begin
       open;
       EDIT;
       FieldByName('TF').AsFloat:=dec(3,wlptp.tf*180/pi);
       post;
      end;
    end;
   v[1].ns:=WLPT[0].ns-wlptpp.ns;
   v[1].ew:=WLPT[0].ew-wlptpp.ew;
   if sqrt(v[0].ns*v[0].ns+v[0].ew*v[0].ew)<>0 then
     wlpt2[0].VSEC:=(v[0].ns*v[1].ns+v[0].ew*v[1].ew)/sqrt(v[0].ns*v[0].ns+v[0].ew*v[0].ew)
   else
     wlpt2[0].VSEC:=0;
   if (sin(wlptf.dls*wlptf.dmd)<>0)and(kk<>ll) then
    begin
     if sin(wlptf.inc)*sin(wlptf.azm-wlpt2[0].azm)<>0 then
      begin
       wlpt2[0].tf:=sign(sin(wlptf.inc)*sin(wlptf.azm-wlpt[0].azm)/sin(wlptf.dls*wlptf.dmd))
       *arccos((cos(wlpt[0].inc)*cos(wlptf.dls*wlptf.dmd)-cos(wlptf.inc))/(sin(wlpt[0].inc)*sin(wlptf.dls*wlptf.dmd)));
      end
     else
      begin
       wlpt2[0].tf:=arccos((cos(wlpt[0].inc)*cos(wlptf.dls*wlptf.dmd)-cos(wlptf.inc))/(sin(wlpt[0].inc)*sin(wlptf.dls*wlptf.dmd)));
      end;
    end
   else if kk=ll then
    begin
     wlpt2[0].tf:=0
    end;
   ADOTABLE2.First;
   while (-1<>ADOTABLE2.FieldByName('ordr').AsInteger)do
    begin
     if(kk=ADOTABLE2.FieldByName('ordr').AsInteger)then
      begin
       with ADOTABLE2 do
        begin
         open;
         EDIT;
         FieldByName('VSEC').AsFloat:=dec(3,wlpt2[0].VSEC);
         FieldByName('TF').AsFloat:=dec(3,wlpt2[0].tf*180/pi);
         post;
        end;
      end;
     ADOTABLE2.Next;
    end;
  end;
{***************************************************}
 jj:=0;
 for kk := 1 to ll do
  begin
   ii:=0;
   while wlpt1[kk,ii].order<>0 do
    begin
     ii:=ii+1;
     jj:=jj+1;
    end;
  end;
 SetLength(wlpt3,jj+1);
 jj:=0;
 for kk := 1 to ll do
  begin
   ii:=0;
   while wlpt1[kk,ii].typ<>-1 do
    begin
     wlpt3[jj].MD:=wlpt1[kk,ii].MD;
     wlpt3[jj].INC:=wlpt1[kk,ii].INC;
     wlpt3[jj].AZM:=wlpt1[kk,ii].AZM;
     wlpt3[jj].TVD:=wlpt1[kk,ii].TVD;
     wlpt3[jj].VSEC:=wlpt1[kk,ii].VSEC;
     wlpt3[jj].NS:=wlpt1[kk,ii].NS;
     wlpt3[jj].EW:=wlpt1[kk,ii].EW;
     wlpt3[jj].DLS:=wlpt1[kk,ii].DLS;
     wlpt3[jj].tf:=wlpt1[kk,ii].tf;
     wlpt3[jj].tr:=wlpt1[kk,ii].tr;
     wlpt3[jj].br:=wlpt1[kk,ii].br;
     if jj>0 then
      wlpt3[jj].dmd:=wlpt3[jj].md-wlpt3[jj-1].md
     else
      wlpt3[jj].dmd:=0;
     wlpt3[jj].order:=wlpt1[kk,ii].order;
     wlpt3[jj].typ:=wlpt1[kk,ii].typ;
     wlpt3[jj].CMT:=wlpt1[kk,ii].CMT;
     v[1].ns:=WLPT3[jj].ns-wlptpp.ns;
     v[1].ew:=WLPT3[jj].ew-wlptpp.ew;
     if sqrt(v[0].ns*v[0].ns+v[0].ew*v[0].ew)<>0 then
       wlpt3[jj].VSEC:=(v[0].ns*v[1].ns+v[0].ew*v[1].ew)/sqrt(v[0].ns*v[0].ns+v[0].ew*v[0].ew)
     else
       wlpt3[jj].VSEC:=0;
     if jj>0 then
      begin
       if sin(wlpt3[jj].inc)*sin(wlpt3[jj].azm-wlpt3[jj-1].azm)<>0 then
        begin
         wlpt3[jj-1].tf:=sign(sin(wlpt3[jj].inc)*sin(wlpt3[jj].azm-wlpt3[jj-1].azm)/sin(wlpt3[jj].dls*wlpt3[jj].dmd))
         *arccos((cos(wlpt3[jj-1].inc)*cos(wlpt3[jj].dls*wlpt3[jj].dmd)-cos(wlpt3[jj].inc))/(sin(wlpt3[jj-1].inc)*sin(wlpt3[jj].dls*wlpt3[jj].dmd)));
        end
       else
        begin
         wlpt3[jj-1].tf:=arccos((cos(wlpt3[jj-1].inc)*cos(wlpt3[jj].dls*wlpt3[jj].dmd)-cos(wlpt3[jj].inc))/(sin(wlpt3[jj-1].inc)*sin(wlpt3[jj].dls*wlpt3[jj].dmd)));
        end;
      end;
     ii:=ii+1;
     jj:=jj+1;
    end;
  end;
 wlpt3[jj].typ:=-1;
 cellfill(wlpt3,1,1);
 DBGrid1.Visible:=true;
 DBGrid2.Visible:=true;
 CLRSHW:=TRUE;
end;


procedure TForm02.Button7Click(Sender: TObject);
var
 u,v,w,ox,oy,oz,x,y,z:real;
 theta:integer;
begin
 u:=0;
 v:=0.4846;
 w:=0.7044;
 ox:=0;
 oy:=0;
 oz:=0;
 form03.GLPipe1.Nodes.Clear;
 form03.GLPipe2.Nodes.Clear;
 for theta:= 0 to 60 do
  begin
   x:=-0.171;
   y:=0.46984;
   z:=0.86602;
   rotation(u,v,w,ox,oy,oz,theta*3.14/180,x,y,z);
   form03.GLPipe1.AddNode(2*x,2*y,2*z);
   form03.GLPipe1.Radius:=0.1;
  end;
 form03.GLPipe2.Radius:=0.1;
 form03.GLPipe2.AddNode(u+ox,v+oy,w+oz);
 form03.GLPipe2.AddNode(-u+ox,-v+oy,-w+oz);
 form03.ShowModal;
end;

procedure TForm02.FormShow(Sender: TObject);
var
 ii,jj,kk:integer;
 tableNAM:string;
begin
 SURVEYCOPY;
 form01.FNDTABLE(tableNAM);
 form01.ADOCommand1.CommandText:='delete * from TW001';
 form01.ADOCommand1.Execute;
 form01.ADOCommand1.CommandText:='insert into TW001 select'+
     '  COMMENT,'+
     '  MD,'+
     '  INCL,'+
     '  AZM,'+
     '  TVD,'+
     '  VSEC,'+
     '  NS,'+
     '  EW,'+
     '  DLS,'+
     '  TF,'+
     '  BR,'+
     '  TR,'+
     '  DMD,'+
     '  SURVEYTOOLS,'+
     '  ORDR,'+
     '  TYPE'
 +' from '+tableNAM;
 form01.ADOCommand1.Execute;
 form01.ADOCommand1.CommandText:='delete * from TS001';
 form01.ADOCommand1.Execute;

 ADOTable1.Active:=FALSE;
 ADOTable1.TableName:='TS001';
 ADOTable1.Active:=TRUE;
 ADOTable2.Active:=FALSE;
 ADOTable2.TableName:='TW001';
 ADOTable2.Active:=TRUE;
 adotable2.First;
 jj:=-999;
 ii:=0;
 if ADOTABLE2.RecordCount>1 then
  begin
   while ADOTABLE2.FieldByName('ordr').Asinteger<>-1 do
    begin
     if jj<>ADOTABLE2.FieldByName('ordr').Asinteger then
      begin
       rowcolor(ii,ADOTABLE2.FieldByName('type').Asinteger);
       jj:=ADOTABLE2.FieldByName('ordr').Asinteger;
      end;
     ii:=ii+1;
     ADOTable2.Next;
    end;
   button3.Click
  end
 else
  pagerefresh;
end;

procedure TForm02.delete1Click(Sender: TObject);
begin
 Button5.click;
end;

procedure TForm02.Exit1Click(Sender: TObject);
var
 locala:integer;
begin
 locala:=MessageDlg('Are you sure?',mtConfirmation,mbYesNo,1);
 if locala=6 then
  begin
   locala:=MessageDlg('Do You Want To Save?',mtConfirmation,mbYesNo,1);
   if locala=6 then
    begin
     SAVEWD;
    end;
   form02.Destroy;
  end;
end;

end.
