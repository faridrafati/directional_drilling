unit Unit42;

interface

uses
  Windows, Messages, SysUtils, Variants, Classes, Graphics, Controls, Forms,
  Dialogs, StdCtrls, ExtCtrls, DB, ADODB;

type
  TForm42 = class(TForm)
    RadioGroup1: TRadioGroup;
    RadioGroup2: TRadioGroup;
    RadioGroup3: TRadioGroup;
    RadioGroup4: TRadioGroup;
    RadioGroup5: TRadioGroup;
    RadioGroup6: TRadioGroup;
    RadioGroup7: TRadioGroup;
    RadioGroup8: TRadioGroup;
    RadioGroup9: TRadioGroup;
    Button1: TButton;
    ADOTable1: TADOTable;
    procedure checkform;
    procedure RadioGroup1Click(Sender: TObject);
    procedure RadioGroup2Click(Sender: TObject);
    procedure RadioGroup3Click(Sender: TObject);
    procedure RadioGroup4Click(Sender: TObject);
    procedure RadioGroup5Click(Sender: TObject);
    procedure RadioGroup6Click(Sender: TObject);
    procedure RadioGroup7Click(Sender: TObject);
    procedure RadioGroup8Click(Sender: TObject);
    procedure RadioGroup9Click(Sender: TObject);
    procedure FormCreate(Sender: TObject);
    procedure FormShow(Sender: TObject);
    procedure Button1Click(Sender: TObject);
    procedure convert;

  private
    { Private declarations }
  public
    { Public declarations }
  end;

var
  Form42: TForm42;
  formlbl:array[1..100]of string;
implementation

uses Unit41, Unit43;

{$R *.dfm}
procedure tform42.convert;
var
 ii,jj,kk:integer;
 begin
  form41.teqlength.Active:=false;
  if RadioGroup1.ItemIndex<2 then
    form41.teqlength.TableName:='SurfaceEquipment'
  else if RadioGroup1.ItemIndex<4 then
    form41.teqlength.TableName:='SurfaceEquipmentMetric'
  else if RadioGroup2.ItemIndex=0 then
    form41.teqlength.TableName:='SurfaceEquipment'
  else
    form41.teqlength.TableName:='SurfaceEquipmentMetric';
  form41.teqlength.Active:=true;
  form41.teqlength.FIRST;
  for JJ := 1 to 4 do
   BEGIN
    for II := 0 to 4 do
      FORM41.StringGrid3.CELLS[II,JJ]:=FORM41.teqlength.FieldS.FieldByNumber(II+1).AsString;
    FORM41.teqlength.Next;
   END;
  ADOTable1.Open;
  ADOTable1.First;
  for ii := 0 to 7 do
   begin
    if RadioGroup2.ItemIndex=ii then
     begin
      cnv[0].conv:=adotable1.FieldByName('depth').AsFloat;
      cnv[0].name:=RadioGroup2.Items[ii];
     end;
    if RadioGroup3.ItemIndex=ii then
     begin
      cnv[1].conv:=adotable1.FieldByName('holesize').AsFloat;
      cnv[1].name:=RadioGroup3.Items[ii];
     end;
    if RadioGroup4.ItemIndex=ii then
     begin
      cnv[2].conv:=adotable1.FieldByName('nzlsize').AsFloat;
      cnv[2].name:=RadioGroup4.Items[ii];
     end;
    if RadioGroup5.ItemIndex=ii then
     begin
      cnv[3].conv:=adotable1.FieldByName('pressure').AsFloat;
      cnv[3].name:=RadioGroup5.Items[ii];
     end;
    if RadioGroup6.ItemIndex=ii then
     begin
      cnv[4].conv:=adotable1.FieldByName('mw').AsFloat;
      cnv[4].name:=RadioGroup6.Items[ii];
     end;
    if RadioGroup7.ItemIndex=ii then
     begin
      cnv[5].conv:=adotable1.FieldByName('yp').AsFloat;
      cnv[5].name:=RadioGroup7.Items[ii];
     end;
    if RadioGroup9.ItemIndex=ii then
     begin
      cnv[6].conv:=adotable1.FieldByName('wob').AsFloat;
      cnv[6].name:=RadioGroup9.Items[ii];
     end;
    if RadioGroup8.ItemIndex=ii then
     begin
      cnv[7].conv:=adotable1.FieldByName('frate').AsFloat;
      cnv[7].name:=RadioGroup8.Items[ii];
     end;
    ADOTable1.Next;
   end;
  FORM41.StringGrid1.Cells[1,0]:='IN';
  FORM41.StringGrid1.Cells[2,0]:='OUT';
  FORM41.StringGrid1.Cells[0,1]:='MEASURED DEPTH('+CNV[0].name+')';
  FORM41.StringGrid1.Cells[0,2]:='TVD('+CNV[0].name+')';
  FORM41.StringGrid1.Cells[0,3]:='MUD WEIGHT('+CNV[4].name+')';
  FORM41.StringGrid1.Cells[0,4]:='PLASTIC VIS.('+CNV[5].name+')';
  FORM41.StringGrid1.Cells[0,5]:='YEILD POINT('+CNV[5].name+')';

  FORM41.stringGRID2.Cells[0,0]:='FLOW RATE('+CNV [6].name+')';
  FORM41.stringGRID2.Cells[1,0]:='MIN';
  FORM41.stringGRID2.Cells[2,0]:='MAX';
  FORM41.stringGRID2.Cells[0,1]:='USER SPECIFIED';
  FORM41.stringGRID2.Cells[0,2]:='RECOMENDED';

 form41.label13.caption:=formlbl[3]+' ('+cnv[3].name+')';
 form41.DBCheckBox1.caption:=formlbl[4]+' ('+cnv[3].name+')';
 form41.DBCheckBox2.caption:=formlbl[5]+' ('+cnv[3].name+')';
 form41.ComboBox1.Clear;
 form41.TBITSIZE.ACTIVE:=TRUE;
 form41.TBITSIZE.OPEN;
 form41.TBITSIZE.First;
 while NOT form41.TBITSIZE.Eof do
  BEGIN
   if CNV[1].name='mm' then
     form41.ComboBox1.Items.Append(floattostr(trunc(100*form41.tbitsize.FieldByName('SIZEMM').AsFloat)/100))
   ELSE
     form41.ComboBox1.Items.Append(form41.tbitsize.FieldByName('SIZEDEC').AsString);
   form41.TBITSIZE.Next;
  END;


 kk:=1;
 form41.TCASINGE.ACTIVE:=TRUE;
 form41.TCASINGE.OPEN;
 form41.TCASINGE.First;
 form41.stringgrid4.Cells[0,0]:='SIZE ('+CNV[1].name+')';
 form41.stringgrid4.Cells[1,0]:='ID ('+CNV[1].name+')';
 form41.stringgrid4.Cells[2,0]:='WT/LEN ('+CNV[7].name+'/'+CNV[0].name+')';
 form41.stringgrid4.Cells[3,0]:='DRIFT ('+CNV[1].name+')';
 form41.stringgrid5.Cells[0,0]:='SIZE ('+CNV[1].name+')';
 form41.stringgrid5.Cells[1,0]:='ID ('+CNV[1].name+')';
 form41.stringgrid5.Cells[2,0]:='WT/LEN ('+CNV[7].name+'/'+CNV[0].name+')';
 form41.stringgrid5.Cells[3,0]:='DRIFT ('+CNV[1].name+')';
 form41.stringgrid5.Cells[4,0]:='TYPE';
 form41.stringgrid5.Cells[5,0]:='MD TOP ('+CNV[0].name+')';
 form41.stringgrid5.Cells[6,0]:='MD BTM ('+CNV[0].name+')';


 form41.stringgrid6.Cells[0,0]:='SIZE ('+CNV[1].name+')';
 form41.stringgrid6.Cells[1,0]:='WT/LEN ('+CNV[7].name+'/'+CNV[0].name+')';
 form41.stringgrid6.Cells[2,0]:='TJ TYPE';
 form41.stringgrid6.Cells[3,0]:='TJ ID ('+CNV[1].name+')';
 form41.stringgrid6.Cells[4,0]:='EQ ID ('+CNV[1].name+')';

 form41.stringgrid7.Cells[0,0]:='BHA TYPE';
 form41.stringgrid7.Cells[1,0]:='SIZE ('+CNV[1].name+')';
 form41.stringgrid7.Cells[2,0]:='ID ('+CNV[1].name+')';
 form41.stringgrid7.Cells[3,0]:='LENGTH ('+CNV[0].name+')';
 form41.stringgrid7.Cells[4,0]:='BHA ?';
 form41.stringgrid7.Cells[5,0]:='BYT WT ('+CNV[7].name+')';



 form41.edit1.Text:=floattostr(round(form41.teqlength.FieldByName('Length').Asfloat/cnv[0].conv));
 form41.label9.caption:=formlbl[1]+' '+cnv[0].name;
 form41.label10.caption:=formlbl[2]+' ('+cnv[6].name+')';
end;
procedure TForm42.Button1Click(Sender: TObject);
begin
 convert;
 form42.Close;
end;

procedure tform42.checkform;
begin
 if RadioGroup1.ItemIndex=0 then
  begin
   RadioGroup2.ItemIndex:=1;
   RadioGroup3.ItemIndex:=0;
   RadioGroup4.ItemIndex:=0;
   RadioGroup5.ItemIndex:=0;
   RadioGroup6.ItemIndex:=5;
   RadioGroup7.ItemIndex:=0;
   RadioGroup8.ItemIndex:=0;
   RadioGroup9.ItemIndex:=0;
  end
 else if RadioGroup1.ItemIndex=1 then
  begin
   RadioGroup2.ItemIndex:=0;
   RadioGroup3.ItemIndex:=0;
   RadioGroup4.ItemIndex:=0;
   RadioGroup5.ItemIndex:=0;
   RadioGroup6.ItemIndex:=0;
   RadioGroup7.ItemIndex:=0;
   RadioGroup8.ItemIndex:=0;
   RadioGroup9.ItemIndex:=0;
  end
 else if RadioGroup1.ItemIndex=2 then
  begin
   RadioGroup2.ItemIndex:=1;
   RadioGroup3.ItemIndex:=1;
   RadioGroup4.ItemIndex:=1;
   RadioGroup5.ItemIndex:=1;
   RadioGroup6.ItemIndex:=1;
   RadioGroup7.ItemIndex:=1;
   RadioGroup8.ItemIndex:=1;
   RadioGroup9.ItemIndex:=1;
  end
 else if RadioGroup1.ItemIndex=3 then
  begin
   RadioGroup2.ItemIndex:=1;
   RadioGroup3.ItemIndex:=1;
   RadioGroup4.ItemIndex:=1;
   RadioGroup5.ItemIndex:=2;
   RadioGroup6.ItemIndex:=6;
   RadioGroup7.ItemIndex:=2;
   RadioGroup8.ItemIndex:=3;
   RadioGroup9.ItemIndex:=2;
  end;
//---------------------------------------------------------
 if(RadioGroup2.ItemIndex=1) and
   (RadioGroup3.ItemIndex=0) and
   (RadioGroup4.ItemIndex=0) and
   (RadioGroup5.ItemIndex=0) and
   (RadioGroup6.ItemIndex=5) and
   (RadioGroup7.ItemIndex=0) and
   (RadioGroup8.ItemIndex=0) and
   (RadioGroup9.ItemIndex=0) then
  begin
   RadioGroup1.ItemIndex:=0;
  end
 else if(RadioGroup2.ItemIndex=0) and
   (RadioGroup3.ItemIndex=0) and
   (RadioGroup4.ItemIndex=0) and
   (RadioGroup5.ItemIndex=0) and
   (RadioGroup6.ItemIndex=0) and
   (RadioGroup7.ItemIndex=0) and
   (RadioGroup8.ItemIndex=0) and
   (RadioGroup9.ItemIndex=0) then
  begin
   RadioGroup1.ItemIndex:=1;
  end
 else if(RadioGroup2.ItemIndex=1) and
   (RadioGroup3.ItemIndex=1) and
   (RadioGroup4.ItemIndex=1) and
   (RadioGroup5.ItemIndex=1) and
   (RadioGroup6.ItemIndex=1) and
   (RadioGroup7.ItemIndex=1) and
   (RadioGroup8.ItemIndex=1) and
   (RadioGroup9.ItemIndex=1) then
  begin
   RadioGroup1.ItemIndex:=2;
  end
 else if(RadioGroup2.ItemIndex=1) and
   (RadioGroup3.ItemIndex=1) and
   (RadioGroup4.ItemIndex=1) and
   (RadioGroup5.ItemIndex=2) and
   (RadioGroup6.ItemIndex=6) and
   (RadioGroup7.ItemIndex=2) and
   (RadioGroup8.ItemIndex=3) and
   (RadioGroup9.ItemIndex=2) then
  begin
   RadioGroup1.ItemIndex:=3;
  end;
//---------------------------------------------------------------------


end;

procedure TForm42.FormCreate(Sender: TObject);
begin
 adotable1.active:=false;
 ADOTable1.TableName:='UNTCON';
 adotable1.active:=true;
 checkform;
 convert;
end;

procedure TForm42.FormShow(Sender: TObject);
begin
 checkform;
end;

procedure TForm42.RadioGroup1Click(Sender: TObject);
begin
 checkform;
end;
procedure TForm42.RadioGroup2Click(Sender: TObject);
begin
 RadioGroup1.ItemIndex:=4;
end;
procedure TForm42.RadioGroup3Click(Sender: TObject);
begin
 RadioGroup1.ItemIndex:=4;
end;
procedure TForm42.RadioGroup4Click(Sender: TObject);
begin
 RadioGroup1.ItemIndex:=4;
end;
procedure TForm42.RadioGroup5Click(Sender: TObject);
begin
 RadioGroup1.ItemIndex:=4;
end;
procedure TForm42.RadioGroup6Click(Sender: TObject);
begin
 RadioGroup1.ItemIndex:=4;
end;
 procedure TForm42.RadioGroup7Click(Sender: TObject);
begin
 RadioGroup1.ItemIndex:=4;
end;
 procedure TForm42.RadioGroup8Click(Sender: TObject);
begin
 RadioGroup1.ItemIndex:=4;
end;
 procedure TForm42.RadioGroup9Click(Sender: TObject);
begin
 RadioGroup1.ItemIndex:=4;
end;
end.
