unit Unit8;

interface

uses
  Windows, Messages, SysUtils, Variants, Classes, Graphics, Controls, Forms,
  Dialogs, Grids, ValEdit, ExtCtrls, StdCtrls, ComCtrls;

type
  TForm8 = class(TForm)
    Image: TImage;
    ValueListEditor1: TValueListEditor;
    Button1: TButton;
    GroupBox1: TGroupBox;
    CheckBox1: TCheckBox;
    CheckBox2: TCheckBox;
    CheckBox3: TCheckBox;
    CheckBox4: TCheckBox;
    CheckBox5: TCheckBox;
    CheckBox6: TCheckBox;
    CheckBox7: TCheckBox;
    CheckBox8: TCheckBox;
    CheckBox9: TCheckBox;
    TrackBar1: TTrackBar;
    Label1: TLabel;
    procedure Button1Click(Sender: TObject);
  private
    { Private declarations }
  public
    { Public declarations }
  end;

var
  Form8: TForm8;


implementation
uses  main;
{$R *.dfm}



procedure TForm8.Button1Click(Sender: TObject);
var
     Pad, Loop, Coeficient : Integer;
begin

     Form8.Image.Canvas.Pen.color:=RGB(0,0,0);
     Form8.Image.Canvas.Pen.Width:=1;
     Form8.Image.Canvas.Refresh;
     Form8.image.Canvas.rectangle(20,350,620,0);
     For Loop:= 0 to 30 do
         Begin
              Form8.Image.Canvas.Pen.color:=RGB(0,0,100);
              Form8.Image.Canvas.Pen.Width:=1;
              Form8.image.Canvas.rectangle(20+Loop*20,360,21+loop*20,365);
              Form8.image.Canvas.rectangle(20+Loop*10*20,355,21+loop*10*20,365);
         end;
     Form8.Image.Canvas.TextOut(20,365,FloatToStr(Min));
     Form8.Image.Canvas.TextOut(600,365,FloatToStr(Max));
     Form8.Image.Canvas.TextOut(20+Trunc(600*(0-Min)/(Max-Min))-3,365,FloatToStr(0));

     Coeficient:=Trunc(((Number_of_Data/8)/TrackBar1.Position)/350);

     If CheckBox1.Checked=True then
     Begin
          For Loop:= 1 to 300 do
               Begin
                    Form8.Image.Canvas.Pen.Width:=1;
                    Form8.Image.Canvas.Pen.color:=RGB(255,0,0);
                    Form8.Image.Canvas.MoveTo(20+Loop*2,349-Trunc(Distribution_Matrix[Loop-1,1]/Coeficient));
                    Form8.Image.Canvas.LineTo(22+Loop*2,349-Trunc(Distribution_Matrix[Loop,1]/Coeficient));
                    Form8.Image.Canvas.Pen.Width:=2;
                    Form8.Image.Canvas.MoveTo(20+Loop*2,349-Trunc(300*Cumulative_Matrix[Loop-1,1]/(Number_of_Data/8)));
                    Form8.Image.Canvas.LineTo(22+Loop*2,349-Trunc(300*Cumulative_Matrix[Loop,1]/(Number_of_Data/8)));
               end;
     end;

     If CheckBox2.Checked=True then
     Begin
          For Loop:= 1 to 300 do
               Begin
                    Form8.Image.Canvas.Pen.color:=RGB(0,255,0);
                    Form8.Image.Canvas.Pen.Width:=1;
                    Form8.Image.Canvas.MoveTo(20+Loop*2,349-Trunc(Distribution_Matrix[Loop-1,2]/Coeficient));
                    Form8.Image.Canvas.LineTo(22+Loop*2,349-Trunc(Distribution_Matrix[Loop,2]/Coeficient));
                    Form8.Image.Canvas.Pen.Width:=2;
                    Form8.Image.Canvas.MoveTo(20+Loop*2,349-Trunc(300*Cumulative_Matrix[Loop-1,2]/(Number_of_Data/8)));
                    Form8.Image.Canvas.LineTo(22+Loop*2,349-Trunc(300*Cumulative_Matrix[Loop,2]/(Number_of_Data/8)));
               end;
     end;

     If CheckBox3.Checked=True then
     Begin
          For Loop:= 1 to 300 do
               Begin
                    Form8.Image.Canvas.Pen.color:=RGB(0,0,255);
                    Form8.Image.Canvas.Pen.Width:=1;
                    Form8.Image.Canvas.MoveTo(20+Loop*2,349-Trunc(Distribution_Matrix[Loop-1,3]/Coeficient));
                    Form8.Image.Canvas.LineTo(22+Loop*2,349-Trunc(Distribution_Matrix[Loop,3]/Coeficient));
                    Form8.Image.Canvas.Pen.Width:=2;
                    Form8.Image.Canvas.MoveTo(20+Loop*2,349-Trunc(300*Cumulative_Matrix[Loop-1,3]/(Number_of_Data/8)));
                    Form8.Image.Canvas.LineTo(22+Loop*2,349-Trunc(300*Cumulative_Matrix[Loop,3]/(Number_of_Data/8)));
               end;
     end;

     If CheckBox4.Checked=True then
     Begin
          For Loop:= 1 to 300 do
               Begin
                    Form8.Image.Canvas.Pen.color:=RGB(255,0,255);
                    Form8.Image.Canvas.Pen.Width:=1;
                    Form8.Image.Canvas.MoveTo(20+Loop*2,349-Trunc(Distribution_Matrix[Loop-1,4]/Coeficient));
                    Form8.Image.Canvas.LineTo(22+Loop*2,349-Trunc(Distribution_Matrix[Loop,4]/Coeficient));
                    Form8.Image.Canvas.Pen.Width:=2;
                    Form8.Image.Canvas.MoveTo(20+Loop*2,349-Trunc(300*Cumulative_Matrix[Loop-1,4]/(Number_of_Data/8)));
                    Form8.Image.Canvas.LineTo(22+Loop*2,349-Trunc(300*Cumulative_Matrix[Loop,4]/(Number_of_Data/8)));
               end;
     end;

     If CheckBox5.Checked=True then
     Begin
          For Loop:= 1 to 300 do
               Begin
                    Form8.Image.Canvas.Pen.color:=RGB(0,255,255);
                    Form8.Image.Canvas.Pen.Width:=1;
                    Form8.Image.Canvas.MoveTo(20+Loop*2,349-Trunc(Distribution_Matrix[Loop-1,5]/Coeficient));
                    Form8.Image.Canvas.LineTo(22+Loop*2,349-Trunc(Distribution_Matrix[Loop,5]/Coeficient));
                    Form8.Image.Canvas.Pen.Width:=2;
                    Form8.Image.Canvas.MoveTo(20+Loop*2,349-Trunc(300*Cumulative_Matrix[Loop-1,5]/(Number_of_Data/8)));
                    Form8.Image.Canvas.LineTo(22+Loop*2,349-Trunc(300*Cumulative_Matrix[Loop,5]/(Number_of_Data/8)));
               end;
     end;

     If CheckBox6.Checked=True then
     Begin
          For Loop:= 1 to 300 do
               Begin
                    Form8.Image.Canvas.Pen.color:=RGB(255,100,0);
                    Form8.Image.Canvas.Pen.Width:=1;
                    Form8.Image.Canvas.MoveTo(20+Loop*2,349-Trunc(Distribution_Matrix[Loop-1,6]/Coeficient));
                    Form8.Image.Canvas.LineTo(22+Loop*2,349-Trunc(Distribution_Matrix[Loop,6]/Coeficient));
                    Form8.Image.Canvas.Pen.Width:=2;
                    Form8.Image.Canvas.MoveTo(20+Loop*2,349-Trunc(300*Cumulative_Matrix[Loop-1,6]/(Number_of_Data/8)));
                    Form8.Image.Canvas.LineTo(22+Loop*2,349-Trunc(300*Cumulative_Matrix[Loop,6]/(Number_of_Data/8)));
               end;
     end;

     If CheckBox7.Checked=True then
     Begin
          For Loop:= 1 to 300 do
               Begin
                    Form8.Image.Canvas.Pen.color:=RGB(100,255,0);
                    Form8.Image.Canvas.Pen.Width:=1;
                    Form8.Image.Canvas.MoveTo(20+Loop*2,349-Trunc(Distribution_Matrix[Loop-1,7]/Coeficient));
                    Form8.Image.Canvas.LineTo(22+Loop*2,349-Trunc(Distribution_Matrix[Loop,7]/Coeficient));
                    Form8.Image.Canvas.Pen.Width:=2;
                    Form8.Image.Canvas.MoveTo(20+Loop*2,349-Trunc(300*Cumulative_Matrix[Loop-1,7]/(Number_of_Data/8)));
                    Form8.Image.Canvas.LineTo(22+Loop*2,349-Trunc(300*Cumulative_Matrix[Loop,7]/(Number_of_Data/8)));
               end;
     end;

     If CheckBox8.Checked=True then
     Begin
          For Loop:= 1 to 300 do
               Begin
                    Form8.Image.Canvas.Pen.color:=RGB(0,100,255);
                    Form8.Image.Canvas.Pen.Width:=1;
                    Form8.Image.Canvas.MoveTo(20+Loop*2,349-Trunc(Distribution_Matrix[Loop-1,8]/Coeficient));
                    Form8.Image.Canvas.LineTo(22+Loop*2,349-Trunc(Distribution_Matrix[Loop,8]/Coeficient));
                    Form8.Image.Canvas.Pen.Width:=2;
                    Form8.Image.Canvas.MoveTo(20+Loop*2,349-Trunc(300*Cumulative_Matrix[Loop-1,8]/(Number_of_Data/8)));
                    Form8.Image.Canvas.LineTo(22+Loop*2,349-Trunc(300*Cumulative_Matrix[Loop,8]/(Number_of_Data/8)));
               end;

     end;


end;

end.
