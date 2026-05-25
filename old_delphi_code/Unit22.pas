unit Unit22;

interface

uses
  Windows, Messages, SysUtils, Variants, Classes, Graphics, Controls, Forms,
  Dialogs, StdCtrls, ExtCtrls, Grids, CategoryButtons, CheckLst;

type
  TForm22 = class(TForm)
    Button1: TButton;
    GroupBox3: TGroupBox;
    Image1: TImage;
    RadioGroup1: TRadioGroup;
    StringGrid1: TStringGrid;
    ColorDialog1: TColorDialog;
    GroupBox2: TGroupBox;
    GroupBox4: TGroupBox;
    ComboBox1: TComboBox;
    ListBox1: TListBox;
    CheckListBox1: TCheckListBox;
    Edit1: TEdit;
    Label1: TLabel;
    Edit2: TEdit;
    Label2: TLabel;
    Procedure Degrade(ACanvas:TCanvas; AColo1,AColo2: TColor; Arect: Trect);
    procedure imageone;
    procedure Button1Click(Sender: TObject);
    procedure FormCreate(Sender: TObject);
    procedure RadioGroup1Click(Sender: TObject);
    procedure CheckListBox1Click(Sender: TObject);
  private
    { Private declarations }
  public
    { Public declarations }
  end;

var
  Form22: TForm22;

implementation

uses Unit21, Unit23;

{$R *.dfm}
procedure TForm22.imageone;
var
 ii,jj,point,sect:integer;
 c:array[1..7]of int64;
 bitmap: Tbitmap;
begin
 Image1.Canvas.Rectangle(0,0,image1.Width,Image1.Height);
 c[1]:=clred;
 c[2]:=rgb(255,128,0);
 c[3]:=clyellow;
 c[4]:=clLime;
 c[5]:=claqua;
 c[6]:=clblue;
 c[7]:=clpurple;
 jj:=6;
 for ii:=1 to jj do
  Degrade(image1.canvas, c[ii], c[ii+1], rect(round((ii-1)*image1.Width/jj),0,round((ii)*image1.Width/jj),26));
 c[1]:=clwhite;
 c[2]:=clyellow;
 c[3]:=clred;
 c[4]:=clblack;
 jj:=3;
 for ii:=1 to jj do
  Degrade(image1.canvas, c[ii], c[ii+1], rect(round((ii-1)*image1.Width/jj),27,round((ii)*image1.Width/jj),53));
end;
procedure TForm22.Button1Click(Sender: TObject);
var
 ii,jj,h,hh,mapno2:integer;
 max,min:real;
begin
 if form22.combobox1.ItemIndex=0 then
  begin
   mapno2:=mapno;
  end
 else if form22.combobox1.ItemIndex=1 then
  begin
   mapno2:=3;
  end;
 if form22.combobox1.ItemIndex=1 then
  form23.predraw(3);
 h:=strtoint(StringGrid1.Cells[1,1]);
 hh:=strtoint(StringGrid1.Cells[1,2]);
{ for ii:=0 to RadioGroup1.Items.count-1 do
  if RadioGroup1.Buttons[ii].Checked then
   begin
    form21.Label1.Caption:='Min '+RadioGroup1.Items.ValueFromIndex[ii]+'-';
    form21.Label2.Caption:='Max '+RadioGroup1.Items.ValueFromIndex[ii]+'-';
    form21.Label3.Caption:='Mid '+RadioGroup1.Items.ValueFromIndex[ii]+'-';
   end;          }
 if combobox1.ItemIndex=1 then
  begin
   for ii:=1 to intro[1,mapno2] do
    for jj:=1 to intro[2,mapno2] do
     if (z.z[ii,jj,h]<>error)and(z.z[ii,jj,hh]<>error)then
      z.z[ii,jj,3]:=abs(z.z[ii,jj,h]-z.z[ii,jj,hh])
     else
      z.z[ii,jj,3]:=error;
   form21.maxmin(error,3,max,min);
   intro[3,3]:=trunc(min);
   intro[4,3]:=trunc(max);
   form21.UpDown1.Enabled:=false;
  end;
 if RadioGroup1.Buttons[0].Checked then
  begin
   form21.maxmin(error,mapno2,max,min);
   form21.UpDown1.Enabled:=true;
  end;
 for ii:=1 to total[1] do
  begin
   form21.maxmin(error,ii,max,min);
   intro[3,ii]:=trunc(min);
   intro[4,ii]:=trunc(max);
{**************************************}
  end;
 form21.Button1.Click;
 form22.Close;
end;

procedure TForm22.FormCreate(Sender: TObject);
begin
 imageone;
 form21.imageone(0,100,30);
end;

procedure TForm22.RadioGroup1Click(Sender: TObject);
var
 ii,jj,kk:integer;
 c:array[1..10]of int64;
begin
 jj:=strtoint(StringGrid1.Cells[1,3])-1;
 if RadioGroup1.ItemIndex=2 then
  begin
   ii:=1;
   while ii<=jj+1 do
    begin
     if ColorDialog1.Execute then
      begin
       c[ii]:=ColorDialog1.Color;
       ii:=ii+1;
      end
     else
      ii:=jj+3;
    end;
   if ii<>jj+3 then
    for ii:=1 to jj do
     Degrade(image1.canvas, c[ii], c[ii+1], rect(round((ii-1)*image1.Width/jj),54,round((ii)*image1.Width/jj),image1.height));
  end;
end;
procedure TForm22.CheckListBox1Click(Sender: TObject);
begin
 CheckListBox1.Hint:=CheckListBox1.Items[CheckListBox1.ItemIndex];
end;

Procedure TForm22.Degrade(ACanvas:TCanvas; AColo1,AColo2: TColor; Arect: Trect);
Var
  Rect : TRect;
  i    : integer;
  R1, G1, B1  : integer;
  R, G, B     : integer;
  R2, G2, B2  : integer;
  aw, ah : integer;
begin
  aw := arect.right - arect.left;
  ah := arect.bottom - arect.top;
  R1 := GetRValue(ColorToRGB(AColo1));
  G1 := GetGValue(ColorToRGB(AColo1));
  B1 := GetBValue(ColorToRGB(AColo1));
  R2 := GetRValue( ColorToRGB(AColo2)) - R1;
  G2 := GetgValue( ColorToRGB(AColo2)) - G1;
  B2 := GetbValue( ColorToRGB(AColo2)) - B1;
  Rect.top := Arect.top;
  Rect.bottom:= Arect.bottom;
  For i:= 0 To 255 Do Begin
    Rect.left  := arect.left+(i * aw) div 256;
    Rect.right := arect.right+((i+1) * aw) div 256;
    R := (R1+ (i * R2) div 255) mod 256;
    G := (G1+ (i * G2) div 255) mod 256;
    B := (B1+ (i * B2) div 255) mod 256;
    // rectangle
    With ACanvas Do
    begin
      Brush.color:=RGB(R, G, B);
      FillRect(Rect);
    end;
  end;
end;

end.
