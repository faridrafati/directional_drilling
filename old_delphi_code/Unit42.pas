unit Unit42;

interface

uses
  Windows, Messages, SysUtils, Variants, Classes, Graphics, Controls, Forms,
  Dialogs, StdCtrls, ExtCtrls;

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

  private
    { Private declarations }
  public
    { Public declarations }
  end;

var
  Form42: TForm42;

implementation

{$R *.dfm}

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
 checkform;
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
