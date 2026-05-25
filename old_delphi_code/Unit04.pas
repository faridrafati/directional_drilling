unit Unit04;

interface

uses
 Windows, Messages, SysUtils, Variants, Classes, Graphics, Controls, Forms,
 Dialogs, DBGrids, Grids, DB, ADODB, StdCtrls, Menus, ExtCtrls;
type
 branch = record
  MD,INC,AZM,TVD,VSEC,NS,EW,DLS,tf,tr,br,dmd:real;
  order,typ:integer;
  CMT:string;
end;
type
 TForm04 = class(TForm)
    Button1: TButton;
    Button2: TButton;
    GroupBox1: TGroupBox;
    CheckBox1: TCheckBox;
    RadioGroup2: TRadioGroup;
    RadioGroup1: TRadioGroup;
    GroupBox2: TGroupBox;
    CheckBox2: TCheckBox;
    CheckBox3: TCheckBox;
    CheckBox4: TCheckBox;
    CheckBox5: TCheckBox;
    CheckBox6: TCheckBox;
    CheckBox7: TCheckBox;
    CheckBox8: TCheckBox;
    CheckBox9: TCheckBox;
    procedure Button1Click(Sender: TObject);
    procedure Button2Click(Sender: TObject);
    procedure cellshow(wlpt:branch);
    procedure RadioGroup1Click(Sender: TObject);
    procedure CheckBox1Click(Sender: TObject);
    procedure CheckBox4Click(Sender: TObject);

private
{ Private declarations }
public
{ Public declarations }
end;

var
Form04: TForm04;

implementation

uses Unit02;

{$R *.dfm}

procedure tForm04.cellshow(wlpt:branch);
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

procedure TForm04.CheckBox1Click(Sender: TObject);
begin
 if (RadioGroup1.ItemIndex=4)and(CheckBox1.Checked)then
  RadioGroup2.Enabled:=true
 else
  RadioGroup2.Enabled:=false;
end;

procedure TForm04.CheckBox4Click(Sender: TObject);
begin
 if CheckBox2.Checked then
  CheckBox2.Caption:='Azimuth'
 else
  CheckBox2.Caption:='Inclination';

 if CheckBox3.Checked then
  CheckBox3.Caption:='Azimuth'
 else
  CheckBox3.Caption:='Inclination';

 if CheckBox4.Checked then
  CheckBox4.Caption:='Azimuth'
 else
  CheckBox4.Caption:='Inclination';

 if CheckBox5.Checked then
  CheckBox5.Caption:='Azimuth'
 else
  CheckBox5.Caption:='Inclination';

 if CheckBox6.Checked then
  CheckBox6.Caption:='Azimuth'
 else
  CheckBox6.Caption:='Inclination';

 if CheckBox7.Checked then
  CheckBox7.Caption:='Azimuth'
 else
  CheckBox7.Caption:='Inclination';

 if CheckBox8.Checked then
  CheckBox8.Caption:='Azimuth'
 else
  CheckBox8.Caption:='Inclination';

 if CheckBox9.Checked then
  CheckBox9.Caption:='Azimuth'
 else
  CheckBox9.Caption:='Inclination';

end;


procedure TForm04.RadioGroup1Click(Sender: TObject);
begin
 if (RadioGroup1.ItemIndex=4){or(RadioGroup1.ItemIndex=5)} then
   CheckBox1.Enabled:=true
 else
  CheckBox1.Enabled:=false;
 if (RadioGroup1.ItemIndex=4)and(CheckBox1.Checked)then
  RadioGroup2.Enabled:=true
 else
  RadioGroup2.Enabled:=false;
 if RadioGroup1.ItemIndex=5 then
  RadioGroup1.ItemIndex:=0;
end;

procedure TForm04.Button1Click(Sender: TObject);
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
   if checkbox2.Checked then
     wlpt1.typ:=11
   else
     wlpt1.typ:=1;
   wlpt1.MD:=0;
   wlpt1.INC:=0;
   wlpt1.AZM:=0;
   wlpt1.TVD:=0;
   wlpt1.vsec:=0;
   wlpt1.NS:=0;
   wlpt1.EW:=0;
   wlpt1.DLS:=0;
   WLPT1.CMT:='KOP (Hold-Curve 3D*)';
   wlpt1.order:=wlpt.order+1;
   cellshow(wlpt1);
   WLPT1.CMT:='EOC (Target)';
   wlpt1.order:=wlpt.order+1;
   cellshow(wlpt1);
  end
 else IF RadioGroup1.ItemIndex=1 THEN
  BEGIN
   if checkbox3.Checked then
     wlpt1.typ:=12
   else
     wlpt1.typ:=2;
   wlpt1.MD:=0;
   wlpt1.INC:=0;
   wlpt1.AZM:=0;
   wlpt1.TVD:=0;
   wlpt1.vsec:=0;
   wlpt1.NS:=0;
   wlpt1.EW:=0;
   wlpt1.DLS:=0;
   WLPT1.CMT:='EOC (Curve-Hold 3D*)';
   wlpt1.order:=wlpt.order+1;
   cellshow(wlpt1);
   WLPT1.CMT:='Target';
   wlpt1.order:=wlpt.order+1;
   cellshow(wlpt1);
  end
 else IF RadioGroup1.ItemIndex=2 THEN
  BEGIN
   if checkbox4.Checked then
     wlpt1.typ:=13
   else
     wlpt1.typ:=3;
   wlpt1.MD:=0;
   wlpt1.INC:=0;
   wlpt1.AZM:=0;
   wlpt1.TVD:=0;
   wlpt1.vsec:=0;
   wlpt1.NS:=0;
   wlpt1.EW:=0;
   wlpt1.DLS:=0;
   WLPT1.CMT:='KOP (Computed)';
   wlpt1.order:=wlpt.order+1;
   cellshow(wlpt1);
   WLPT1.CMT:='EOC';
   wlpt1.order:=wlpt.order+1;
   cellshow(wlpt1);
   WLPT1.CMT:='Target';
   wlpt1.order:=wlpt.order+1;
   cellshow(wlpt1);
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
   wlpt1.typ:=4;
   wlpt1.order:=wlpt.order+1;
   cellshow(wlpt1);
   WLPT1.CMT:='Target';
   wlpt1.order:=wlpt.order+1;
   cellshow(wlpt1);
  end
 else IF RadioGroup1.ItemIndex=4 THEN
  BEGIN
   if CheckBox1.Checked=false then
    begin
     if checkbox6.Checked then
       wlpt1.typ:=15
     else
       wlpt1.typ:=5;
     wlpt1.MD:=0;
     wlpt1.INC:=0;
     wlpt1.AZM:=0;
     wlpt1.TVD:=0;
     wlpt1.vsec:=0;
     wlpt1.NS:=0;
     wlpt1.EW:=0;
     wlpt1.DLS:=0;
     WLPT1.CMT:='EOC #1(3D*-S)';
     wlpt1.order:=wlpt.order+1;
     cellshow(wlpt1);
     WLPT1.CMT:='KOP #2';
     wlpt1.order:=wlpt.order+1;
     cellshow(wlpt1);
     WLPT1.CMT:='EOC-Target';
     wlpt1.order:=wlpt.order+1;
     cellshow(wlpt1);
    end
   else if CheckBox1.Checked=true then
    begin
     if form04.RadioGroup2.ItemIndex=0 then
      begin
       if checkbox6.Checked then
        begin
         romat[ii,3]:=true;
         wlpt1.typ:=16;
        end
       else
        begin
         romat[ii,2]:=true;
         wlpt1.typ:=6;
        end;
      end
     else
      begin
       romat[ii+3,12]:=true;
       if checkbox6.Checked then
        begin
         wlpt1.typ:=116;
        end
       else
        begin
         wlpt1.typ:=106;
        end;
      end;
     romat[ii,8]:=true;
     romat[ii+2,8]:=true;
     if checkbox6.Checked then
      romat[ii+3,3]:=true
     else
      romat[ii+3,2]:=true;
     romat[ii+3,4]:=true;
     romat[ii+3,6]:=true;
     romat[ii+3,7]:=true;
     wlpt1.MD:=0;
     wlpt1.INC:=0;
     wlpt1.AZM:=0;
     wlpt1.TVD:=0;
     wlpt1.vsec:=0;
     wlpt1.NS:=0;
     wlpt1.EW:=0;
     wlpt1.DLS:=0;
     WLPT1.CMT:='EOC #1(2D-S)';
     wlpt1.order:=wlpt.order+1;
     cellshow(wlpt1);
     wlpt1.MD:=0;
     wlpt1.INC:=0;
     wlpt1.AZM:=0;
     wlpt1.TVD:=0;
     wlpt1.vsec:=0;
     wlpt1.NS:=0;
     wlpt1.EW:=0;
     wlpt1.DLS:=0;
     WLPT1.CMT:='KOP #2';
     wlpt1.order:=wlpt.order+1;
     cellshow(wlpt1);
     wlpt1.MD:=0;
     wlpt1.INC:=0;
     wlpt1.AZM:=0;
     wlpt1.TVD:=0;
     wlpt1.vsec:=0;
     wlpt1.NS:=0;
     wlpt1.EW:=0;
     wlpt1.DLS:=0;
     WLPT1.CMT:='EOC #2';
     wlpt1.order:=wlpt.order+1;
     cellshow(wlpt1);
     wlpt1.MD:=0;
     wlpt1.INC:=0;
     wlpt1.AZM:=0;
     wlpt1.TVD:=0;
     wlpt1.vsec:=0;
     wlpt1.NS:=0;
     wlpt1.EW:=0;
     wlpt1.DLS:=0;
     WLPT1.CMT:='Target';
     wlpt1.order:=wlpt.order+1;
     cellshow(wlpt1);
    end;
  END
 else IF RadioGroup1.ItemIndex=5 THEN
  BEGIN
   if checkbox7.Checked then
     wlpt1.typ:=17
   else
     wlpt1.typ:=7;
   wlpt1.MD:=0;
   wlpt1.INC:=0;
   wlpt1.AZM:=0;
   wlpt1.TVD:=0;
   wlpt1.vsec:=0;
   wlpt1.NS:=0;
   wlpt1.EW:=0;
   wlpt1.DLS:=0;
   WLPT1.CMT:='EOC #1(3D-S)';
   wlpt1.order:=wlpt.order+1;
   cellshow(wlpt1);
   WLPT1.CMT:='KOP #2';
   wlpt1.order:=wlpt.order+1;
   cellshow(wlpt1);
   WLPT1.CMT:='EOC Target';
   wlpt1.order:=wlpt.order+1;
   cellshow(wlpt1);
  end
 else IF RadioGroup1.ItemIndex=6 THEN
  BEGIN
   wlpt1.MD:=0;
   wlpt1.INC:=0;
   wlpt1.AZM:=0;
   wlpt1.TVD:=0;
   wlpt1.vsec:=0;
   wlpt1.NS:=0;
   wlpt1.EW:=0;
   wlpt1.DLS:=0;
   WLPT1.CMT:='Target';
   wlpt1.typ:=8;
   wlpt1.order:=wlpt.order+1;
   cellshow(wlpt1);
  end
 else IF RadioGroup1.ItemIndex=7 THEN
  BEGIN
   if checkbox9.Checked then
     wlpt1.typ:=19
   else
     wlpt1.typ:=9;
   wlpt1.MD:=0;
   wlpt1.INC:=0;
   wlpt1.AZM:=0;
   wlpt1.TVD:=0;
   wlpt1.vsec:=0;
   wlpt1.NS:=0;
   wlpt1.EW:=0;
   wlpt1.DLS:=0;
   WLPT1.CMT:='EOC #1 (Curve Curve 3D*)';
   wlpt1.order:=wlpt.order+1;
   cellshow(wlpt1);
   wlpt1.MD:=0;
   wlpt1.INC:=0;
   wlpt1.AZM:=0;
   wlpt1.TVD:=0;
   wlpt1.vsec:=0;
   wlpt1.NS:=0;
   wlpt1.EW:=0;
   wlpt1.DLS:=0;
   WLPT1.CMT:='EOC #2';
   wlpt1.typ:=9;
   wlpt1.order:=wlpt.order+1;
   cellshow(wlpt1);
  end;
 FORM02.rowcolor(II,WLPT1.typ);
 Button2.Click;
end;


procedure TForm04.Button2Click(Sender: TObject);
begin
 form04.Close;
end;

end.
