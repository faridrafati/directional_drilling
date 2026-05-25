unit Unit06;

interface

uses
  Windows, Messages, SysUtils, Variants, Classes, Graphics, Controls, Forms,
  Dialogs, ExtCtrls, StdCtrls, ComCtrls;
type
 branch = record
  MD,INC,AZM,TVD,VSEC,NS,EW,DLS,tf,tr,br,dmd:real;
  order,typ:integer;
  CMT:string;
end;
type
  TForm06 = class(TForm)
    pagecontrol2: TPageControl;
    TabSheet4: TTabSheet;
    TabSheet5: TTabSheet;
    TabSheet6: TTabSheet;
    Button1: TButton;
    Button2: TButton;
    RadioGroup1: TRadioGroup;
    GroupBox4: TGroupBox;
    CheckBox1: TCheckBox;
    CheckBox2: TCheckBox;
    RadioGroup2: TRadioGroup;
    Memo1: TMemo;
    RadioGroup3: TRadioGroup;
    Button3: TButton;
    Button4: TButton;
    Memo2: TMemo;
    procedure Button2Click(Sender: TObject);
    procedure Button1Click(Sender: TObject);
    procedure cellshow(wlpt:branch);
    procedure Button3Click(Sender: TObject);
    procedure RadioGroup2Click(Sender: TObject);
    procedure CheckBox2Click(Sender: TObject);
    procedure CheckBox1Click(Sender: TObject);
    procedure Button4Click(Sender: TObject);
  private
    { Private declarations }
  public
    { Public declarations }
  end;

var
  Form06: TForm06;

implementation

uses Unit02, Unit08;

{$R *.dfm}

procedure TForm06.Button1Click(Sender: TObject);
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
 IF RadioGroup1.ItemIndex=0 THEN
  BEGIN
   wlpt1.MD:=0;
   wlpt1.INC:=0;
   wlpt1.AZM:=0;
   wlpt1.TVD:=0;
   wlpt1.vsec:=0;
   wlpt1.NS:=0;
   wlpt1.EW:=0;
   wlpt1.DLS:=0;
   WLPT1.CMT:='EOC';
   wlpt1.typ:=31;
  end
 else IF RadioGroup1.ItemIndex=1 THEN
  BEGIN
   wlpt1.MD:=0;
   wlpt1.INC:=0;
   wlpt1.AZM:=0;
   wlpt1.TVD:=0;
   wlpt1.vsec:=0;
   wlpt1.NS:=0;
   wlpt1.EW:=0;
   wlpt1.DLS:=0;
   WLPT1.CMT:='EOC';
   wlpt1.typ:=32;
  end
 else IF RadioGroup1.ItemIndex=2 THEN
  BEGIN
   wlpt1.MD:=0;
   wlpt1.INC:=0;
   wlpt1.AZM:=0;
   wlpt1.TVD:=0;
   wlpt1.vsec:=0;
   wlpt1.NS:=0;
   wlpt1.EW:=0;
   wlpt1.DLS:=0;
   WLPT1.CMT:='EOC';
   wlpt1.typ:=33;
  end
 else IF RadioGroup1.ItemIndex=3 THEN
  BEGIN
   wlpt1.MD:=0;
   wlpt1.INC:=0;
   wlpt1.AZM:=0;
   wlpt1.TVD:=0;
   wlpt1.vsec:=0;
   wlpt1.NS:=0;
   wlpt1.EW:=0;
   wlpt1.DLS:=0;
   WLPT1.CMT:='EOC';
   wlpt1.typ:=34;
  end
 else IF RadioGroup1.ItemIndex=4 THEN
  BEGIN
   wlpt1.MD:=0;
   wlpt1.INC:=0;
   wlpt1.AZM:=0;
   wlpt1.TVD:=0;
   wlpt1.vsec:=0;
   wlpt1.NS:=0;
   wlpt1.EW:=0;
   wlpt1.DLS:=0;
   WLPT1.CMT:='EOC';
   wlpt1.typ:=35;
  end;
 form02.rowcolor(ii,wlpt1.typ);
 wlpt1.order:=wlpt.order+1;
 cellshow(wlpt1);
 form06.Close;
end;
procedure tForm06.cellshow(wlpt:branch);
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
      FieldByName('MD').AsFloat:=dec(2,wlpt.md);
      FieldByName('INCL').AsFloat:=dec(2,wlpt.INC*180/pi);
      FieldByName('AZM').AsFloat:=dec(2,wlpt.AZM*180/pi);
      FieldByName('TVD').AsFloat:=dec(2,wlpt.TVD);
      FieldByName('VSEC').AsFloat:=dec(2,wlpt.VSEC);
      FieldByName('NS').AsFloat:=dec(2,wlpt.NS);
      FieldByName('EW').AsFloat:=dec(2,wlpt.EW);
      FieldByName('DLS').AsFloat:=dec(2,wlpt.DLS*18000/pi);
      FieldByName('ordr').AsInteger:=wlpt.order;
      FieldByName('type').AsInteger:=wlpt.typ;
      post;
     end;
   end;
 end;



procedure TForm06.CheckBox1Click(Sender: TObject);
begin
 if RadioGroup2.ItemIndex=4 then
  begin
   if (CheckBox1.Checked)and(not(checkbox2.Checked)) then
    begin
     RadioGroup2.ItemIndex:=0;
    end;
  end;
 if RadioGroup2.ItemIndex=3 then
  begin
   if (CheckBox2.Checked)and(not(checkbox1.Checked)) then
    begin
     RadioGroup2.ItemIndex:=0;
    end;
  end;
 if (not(checkbox1.Checked))and(not(checkbox2.Checked)) then
  button4.Enabled:=false
 else
  button4.Enabled:=true;
end;

procedure TForm06.CheckBox2Click(Sender: TObject);
begin
 if RadioGroup2.ItemIndex=4 then
  begin
   if (CheckBox1.Checked)and(not(checkbox2.Checked)) then
    begin
     RadioGroup2.ItemIndex:=0;
    end;
  end;
 if RadioGroup2.ItemIndex=3 then
  begin
   if (CheckBox2.Checked)and(not(checkbox1.Checked)) then
    begin
     RadioGroup2.ItemIndex:=0;
    end;
  end;
 if (not(checkbox1.Checked))and(not(checkbox2.Checked)) then
  button4.Enabled:=false
 else
  button4.Enabled:=true;

end;

procedure TForm06.RadioGroup2Click(Sender: TObject);
begin
 if RadioGroup2.ItemIndex=4 then
  begin
   if (CheckBox1.Checked)and(not(checkbox2.Checked)) then
    begin
     RadioGroup2.ItemIndex:=0;
    end;
  end;
 if RadioGroup2.ItemIndex=3 then
  begin
   if (CheckBox2.Checked)and(not(checkbox1.Checked)) then
    begin
     RadioGroup2.ItemIndex:=0;
    end;
  end;

end;

procedure TForm06.Button2Click(Sender: TObject);
begin
 form06.Close;
end;

procedure TForm06.Button3Click(Sender: TObject);
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
 if RadioGroup3.ItemIndex=0 then
  begin
   wlpt1.MD:=0;
   wlpt1.INC:=0;
   wlpt1.AZM:=0;
   wlpt1.TVD:=0;
   wlpt1.vsec:=0;
   wlpt1.NS:=0;
   wlpt1.EW:=0;
   wlpt1.DLS:=0;
   WLPT1.CMT:='EOC';
   wlpt1.typ:=51;
  end
 else if RadioGroup3.ItemIndex=1 then
  begin
   wlpt1.MD:=0;
   wlpt1.INC:=0;
   wlpt1.AZM:=0;
   wlpt1.TVD:=0;
   wlpt1.vsec:=0;
   wlpt1.NS:=0;
   wlpt1.EW:=0;
   wlpt1.DLS:=0;
   WLPT1.CMT:='EOC';
   wlpt1.typ:=52;
  end
 else if RadioGroup3.ItemIndex=2 then
  begin
   wlpt1.MD:=0;
   wlpt1.INC:=0;
   wlpt1.AZM:=0;
   wlpt1.TVD:=0;
   wlpt1.vsec:=0;
   wlpt1.NS:=0;
   wlpt1.EW:=0;
   wlpt1.DLS:=0;
   WLPT1.CMT:='EOC';
   wlpt1.typ:=53;
  end
 else if RadioGroup3.ItemIndex=3 then
  begin
   wlpt1.MD:=0;
   wlpt1.INC:=0;
   wlpt1.AZM:=0;
   wlpt1.TVD:=0;
   wlpt1.vsec:=0;
   wlpt1.NS:=0;
   wlpt1.EW:=0;
   wlpt1.DLS:=0;
   WLPT1.CMT:='EOC';
   wlpt1.typ:=54;
  end
 else if RadioGroup3.ItemIndex=4 then
  begin
   wlpt1.MD:=0;
   wlpt1.INC:=0;
   wlpt1.AZM:=0;
   wlpt1.TVD:=0;
   wlpt1.vsec:=0;
   wlpt1.NS:=0;
   wlpt1.EW:=0;
   wlpt1.DLS:=0;
   WLPT1.CMT:='EOC';
   wlpt1.typ:=55;
  end;
 FORM02.rowcolor(II,wlpt1.typ);
 wlpt1.order:=wlpt.order+1;
 cellshow(wlpt1);
 form06.Close;
end;

procedure TForm06.Button4Click(Sender: TObject);
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
 if RadioGroup2.ItemIndex=0 then
  begin
   if CheckBox1.Checked then
     wlpt1.typ:=61;
   if CheckBox2.Checked then
     wlpt1.typ:=62;
   if (CheckBox2.Checked)and(CheckBox1.Checked)then
     wlpt1.typ:=63;
   romat[ii,1]:=true;
   wlpt1.MD:=0;
   wlpt1.INC:=0;
   wlpt1.AZM:=0;
   wlpt1.TVD:=0;
   wlpt1.vsec:=0;
   wlpt1.NS:=0;
   wlpt1.EW:=0;
   wlpt1.DLS:=0;
   WLPT1.CMT:='EOC';
  end
 else if RadioGroup2.ItemIndex=1 then
  begin
   if CheckBox1.Checked then
     wlpt1.typ:=71;
   if CheckBox2.Checked then
     wlpt1.typ:=72;
   if (CheckBox2.Checked)and(CheckBox1.Checked)then
     wlpt1.typ:=73;
   romat[ii,4]:=true;
   wlpt1.MD:=0;
   wlpt1.INC:=0;
   wlpt1.AZM:=0;
   wlpt1.TVD:=0;
   wlpt1.vsec:=0;
   wlpt1.NS:=0;
   wlpt1.EW:=0;
   wlpt1.DLS:=0;
   WLPT1.CMT:='EOC';
  end
 else if RadioGroup2.ItemIndex=2 then
  begin
   if CheckBox1.Checked then
     wlpt1.typ:=81;
   if CheckBox2.Checked then
     wlpt1.typ:=82;
   if (CheckBox2.Checked)and(CheckBox1.Checked)then
     wlpt1.typ:=83;
   romat[ii,12]:=true;
   wlpt1.MD:=0;
   wlpt1.INC:=0;
   wlpt1.AZM:=0;
   wlpt1.TVD:=0;
   wlpt1.vsec:=0;
   wlpt1.NS:=0;
   wlpt1.EW:=0;
   wlpt1.DLS:=0;
   WLPT1.CMT:='EOC';
  end
 else if RadioGroup2.ItemIndex=3 then
  begin
   if CheckBox1.Checked then
     wlpt1.typ:=91;
   if CheckBox2.Checked then
     wlpt1.typ:=92;
   if (CheckBox2.Checked)and(CheckBox1.Checked)then
     wlpt1.typ:=93;
   romat[ii,2]:=true;
   wlpt1.MD:=0;
   wlpt1.INC:=0;
   wlpt1.AZM:=0;
   wlpt1.TVD:=0;
   wlpt1.vsec:=0;
   wlpt1.NS:=0;
   wlpt1.EW:=0;
   wlpt1.DLS:=0;
   WLPT1.CMT:='EOC';
  end
 else if RadioGroup2.ItemIndex=4 then
  begin
   if CheckBox1.Checked then
     wlpt1.typ:=101;
   if CheckBox2.Checked then
     wlpt1.typ:=102;
   if (CheckBox2.Checked)and(CheckBox1.Checked)then
     wlpt1.typ:=103;
   romat[ii,3]:=true;
   wlpt1.MD:=0;
   wlpt1.INC:=0;
   wlpt1.AZM:=0;
   wlpt1.TVD:=0;
   wlpt1.vsec:=0;
   wlpt1.NS:=0;
   wlpt1.EW:=0;
   wlpt1.DLS:=0;
   WLPT1.CMT:='EOC';
  end;
 FORM02.rowcolor(II,WLPT1.typ);
 wlpt1.order:=wlpt.order+1;
 cellshow(wlpt1);
 form06.Close;
end;

end.
