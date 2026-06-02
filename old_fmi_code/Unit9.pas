unit Unit9;

interface

uses
  Windows, Messages, SysUtils, Variants, Classes, Graphics, Controls, Forms,
  Dialogs, StdCtrls, ExtCtrls, ComCtrls;

type
  TForm9 = class(TForm)
    Image1: TImage;
    Button1: TButton;
    Button2: TButton;
    ProgressBar1: TProgressBar;
    Memo1: TMemo;
    Edit1: TEdit;
    Edit2: TEdit;
    Label1: TLabel;
    Label2: TLabel;
    ComboBox1: TComboBox;
    Label3: TLabel;
    Label4: TLabel;
    Edit3: TEdit;
    procedure Button2Click(Sender: TObject);
    procedure Button1Click(Sender: TObject);
  private
    { Private declarations }
  public
    { Public declarations }
  end;

var
  Form9: TForm9;

implementation

uses main;

{$R *.dfm}
var
      Read_Text, S, Data_str:string;
      Data, Start_Depth_Test, Stop_Depth_Test, Max_R, Min_R, Cumulative, Resistivity_Sum_Previous, AZ_Previous, AY_Previous, AX_Previous, GR_Previous, Resistivity_Sum_Current, AZ_Current, AY_Current, AX_Current, GR_Current, Cut_off :real;
      n, loop, x, y, Red, Green, Blue, Pad, Color_Plot, Color_Scale, Acc_Scale, Scale, y_end :Integer;
      Info_File :TextFile;

procedure TForm9.Button1Click(Sender: TObject);
begin

     AssignFile (Info_File,form1.OpenDialog1.FileName);
     Reset(Info_File);
     repeat Readln(Info_File,Read_Text); S:=Copy(Read_Text,0,2); until(S='~A');

     y:=0;

     For Loop:= 1 to 300 do
          Begin
               Cumulative:=Cumulative_Matrix[Loop,1] + Cumulative_Matrix[Loop-1,2] + Cumulative_Matrix[Loop-1,3] + Cumulative_Matrix[Loop-1,4] + Cumulative_Matrix[Loop-1,5] + Cumulative_Matrix[Loop-1,6] + Cumulative_Matrix[Loop-1,7] + Cumulative_Matrix[Loop-1,8];
               if Cumulative < Trunc(0.95*Number_of_Data) then Max_R:=min+((max-min)/300)*loop;
               if Cumulative < Trunc(0.05*Number_of_Data) then Min_R:=min+((max-min)/300)*loop;
          end;
     Max:=Max_R;
     Min:=Min_R;
     Start_Depth_Test:=StrToFloat(Edit1.Text);
     Stop_Depth_Test:= StrToFloat(Edit2.Text);


     repeat
          Readln(Info_File,Read_Text);
          loop:=0;
          n:=0;
          repeat
               Data_str:='';
               repeat
                    loop:=loop+1;
                    S:=Copy(Read_Text,loop,1);
               until(S<>' ');
               n:=n+1;
               repeat
                    Data_str:=Data_str+S;
                    loop:=loop+1;
                    S:=Copy(Read_Text,loop,1);
               until(S=' ');
               Data:=StrToFloat(Data_str);
               Data_Matrix[Position_Matrix[n]]:=Data;
          until (n=Number_of_Curves);

          If Data_Matrix[1]<=Start_Depth_Test then
          Begin
               y:=340-Trunc(300*(Start_Depth_Test-Data_Matrix[1])/(Start_Depth_Test-Stop_Depth_Test));
               ProgressBar1.Position:= Trunc(100*((Start_Depth_Test-Data_Matrix[1])/(Start_Depth_Test-Stop_Depth_Test)));
               for Pad:= 20 to 211 do
                    Begin
                         Color_Plot:=Trunc((Data_Matrix[Pad]-Min)*765/(Max-Min));

                         if (Color_Plot<0) then
                              Begin
                                   Red:=255; Green:=255; Blue:=255;
                              end;

                         if (Color_Plot>=0) and (Color_Plot<=255) then
                              Begin
                                   Red:=255; Green:=255; Blue:=255-Color_Plot;
                              end;

                         if (Color_Plot>255) and (Color_Plot<=510) then
                              Begin
                                   Red:=255; Green:=510-Color_Plot; Blue:=0;
                              end;

                         if (Color_Plot>510) and (Color_Plot<=765) then
                              Begin
                                   Red:=765-Color_Plot; Green:=0; Blue:=0;
                              end;

                         if (Color_Plot>765) then
                              Begin
                                   Red:=0; Green:=0; Blue:=0;
                              end;

                         form9.image1.Canvas.pixels[20+(pad-20)+((pad-20) div 24)*5 ,y]:=RGB(Red,Green,Blue);
               end;
          end;
     until (Data_Matrix[1]<=Stop_Depth_Test);
     {form9.Image1.Canvas.Rectangle(10, ,200,);}
end;






procedure TForm9.Button2Click(Sender: TObject);
begin
     For loop:= 1 to 211 do Data_Matrix[loop]:=0; {Zero Matrix, for sure ..}
     Scale:=50;
     If Form9.ComboBox1.ItemIndex=0 then Scale:=5;
     If Form9.ComboBox1.ItemIndex=1 then Scale:=10;
     If Form9.ComboBox1.ItemIndex=2 then Scale:=50;
     If Form9.ComboBox1.ItemIndex=3 then Scale:=100;
     If Form9.ComboBox1.ItemIndex=4 then Scale:=200;
     If Form9.ComboBox1.ItemIndex=5 then Scale:=500;
     If Form9.ComboBox1.ItemIndex=6 then Scale:=1000;

     y_end:= Trunc((Start_Depth-Stop_Depth)/(Scale*10)*96);
     If StrToFloat(Edit3.Text)>100 then Edit3.Text:='4';
     Cut_off:=StrToFloat(Edit3.Text)/100/2;
     For Loop:= 1 to 300 do
          Begin
               Cumulative:=Cumulative_Matrix[Loop,1] + Cumulative_Matrix[Loop-1,2] + Cumulative_Matrix[Loop-1,3] + Cumulative_Matrix[Loop-1,4] + Cumulative_Matrix[Loop-1,5] + Cumulative_Matrix[Loop-1,6] + Cumulative_Matrix[Loop-1,7] + Cumulative_Matrix[Loop-1,8];
               if Cumulative < Trunc(0.95*Number_of_Data) then Max_R:=min+((max-min)/300)*loop;
               if Cumulative < Trunc(0.05*Number_of_Data) then Min_R:=min+((max-min)/300)*loop;
          end;


     Form1.VertScrollBar.Range:=y_end+100;
     Form1.Image2.Height:=y_end;
     Form1.Image2.Canvas.Refresh;
     Form1.Image2.Visible:=False;

{START OF FRAMEWORK FOR DETAIL VIEW WINDOW -----------------------------------------------------------------------------------------}
     Form1.Image2.Canvas.Pen.color:=RGB(150,150,150);
     Form1.Image2.Canvas.Pen.width:=1;

     Form1.Image2.Canvas.rectangle(0,99,400,y_end);
     Form1.Image2.Canvas.rectangle(450,99,700,y_end);
     Form1.Image2.Canvas.rectangle(699,99,800,y_end);

     Form1.Image2.Canvas.rectangle(0,0,400,100);
     Form1.Image2.Canvas.rectangle(450,0,800,100);

     Form1.Image2.Canvas.rectangle(0,70,400,100);

     Form1.Image2.Canvas.Font.color:=RGB(120,120,120);
     Form1.Image2.Canvas.Font.Size:=15;
     Form1.Image2.Canvas.TextOut(10,5,'GEOMANCY 2007');
     Form1.Image2.Canvas.Font.color:=RGB(150,150,150);
     Form1.Image2.Canvas.Font.Size:=7;
     Form1.Image2.Canvas.TextOut(10,25,'Copyrights 2007, All Rights Reserved.');

     Form1.Image2.Canvas.Font.Size:=12;
     Form1.Image2.Canvas.Font.color:=RGB(50,50,50);

     Form1.Image2.Canvas.TextOut(28,75,'N');
     Form1.Image2.Canvas.rectangle(32,94,33,98);

     Form1.Image2.Canvas.TextOut(72,75,'NE');
     Form1.Image2.Canvas.rectangle(80,94,81,98);

     Form1.Image2.Canvas.TextOut(124,75,'E');
     Form1.Image2.Canvas.rectangle(128,94,129,98);

     Form1.Image2.Canvas.TextOut(168,75,'SE');
     Form1.Image2.Canvas.rectangle(176,94,177,98);

     Form1.Image2.Canvas.TextOut(220,75,'S');
     Form1.Image2.Canvas.rectangle(224,94,225,98);

     Form1.Image2.Canvas.TextOut(264,75,'SW');
     Form1.Image2.Canvas.rectangle(272,94,273,98);

     Form1.Image2.Canvas.TextOut(316,75,'W');
     Form1.Image2.Canvas.rectangle(320,94,321,98);

     Form1.Image2.Canvas.TextOut(360,75,'NW');
     Form1.Image2.Canvas.rectangle(368,94,369,98);
{END OF FRAMEWORK FOR DETAIL VIEW WINDOW -------------------------------------------------------------------------------------------}



{START OF COLOR GUIDE --------------------------------------------------------------------------------------------------------------}
     for n:=0 to 255 do
          Begin
               if n<85 then
                    Begin
                         Form1.Image2.Canvas.Pen.color:=RGB(255,255,255-(n*3));
                         Form1.Image2.Canvas.moveto(n+65, 60);
                         Form1.Image2.Canvas.lineto(n+65, 65);
                    end;
               if (n>=85) and (n<170) then
                    Begin
                         Form1.Image2.Canvas.Pen.color:=RGB(255,510-(n*3),0);
                         Form1.Image2.Canvas.moveto(n+65,60);
                         Form1.Image2.Canvas.lineto(n+65,65);
                    end;
               if n >= 170 then
                    Begin
                         Form1.Image2.Canvas.Pen.color:=RGB(765-(n*3),0,0);
                         Form1.Image2.Canvas.moveto(n+65,60);
                         Form1.Image2.Canvas.lineto(n+65,65);
                    end;
            end;
            Form1.Image2.Canvas.Font.Size:=8;
            Form1.Image2.Canvas.Font.color:=RGB(100,100,100);
            Form1.Image2.Canvas.TextOut(65,45,FloatToStr(Min));
            Form1.Image2.Canvas.TextOut(300,45,FloatToStr(Max));

            {Scale of Resistivity}
            For Color_Scale:= 1 to 12 do
                Begin
                     Form1.Image2.Canvas.Pen.color:=RGB(200,200,200);
                     Form1.Image2.Canvas.MoveTo(450+Trunc((Color_Scale*100)/5),100+1);
                     Form1.Image2.Canvas.LineTo(450+Trunc((Color_Scale*100)/5),y_end-1);
                     Form1.Image2.Canvas.Font.Size:=5;
                     Form1.Image2.Canvas.Font.color:=RGB(100,100,100);
                     Form1.Image2.Canvas.TextOut(450+Trunc((Color_Scale*100)/5)-5,90,FloatToStr(Color_Scale*100));
                end;

            {Scale of Acceleration}
            For Acc_Scale:= -9 to 9 do
                Begin
                     Form1.Image2.Canvas.Pen.color:=RGB(200,200,200);
                     Form1.Image2.Canvas.MoveTo(720+Trunc(((Acc_Scale/10)+9.8-9.2)*50),100+1);
                     Form1.Image2.Canvas.LineTo(720+Trunc(((Acc_Scale/10)+9.8-9.2)*50),y_end-1);
                     Form1.Image2.Canvas.Font.Size:=4;
                     Form1.Image2.Canvas.Font.color:=RGB(100,100,100);
                     Form1.Image2.Canvas.TextOut(720+Trunc(((Acc_Scale/10)+9.8-9.2)*50)-5,90,FloatToStr(((Acc_Scale/10)+9.8-9.2)));
                end;

            Form1.Image2.Canvas.Pen.color:=RGB(100,100,100);
            Form1.Image2.Canvas.Pen.Width:=1;
            Form1.Image2.Canvas.MoveTo(720+Trunc((9.8-9.2)*50),100+1);
            Form1.Image2.Canvas.LineTo(720+Trunc((9.8-9.2)*50),y_end-1);


            Form1.Image2.Canvas.Font.Size:=8;
            Form1.Image2.Canvas.Font.color:=RGB(100,100,100);
            Form1.Image2.Canvas.TextOut(460,10,'Average Conductivity');
            Form1.Image2.Canvas.Pen.color:=RGB(100,100,100);
            Form1.Image2.Canvas.Pen.width:=2;
            Form1.Image2.Canvas.Rectangle(600,18,700-1,19);

            Form1.Image2.Canvas.Font.color:=RGB(200,0,0);
            Form1.Image2.Canvas.TextOut(460,25,'Accelaration Z');
            Form1.Image2.Canvas.Pen.color:=RGB(200,0,0);
            Form1.Image2.Canvas.Pen.width:=2;
            Form1.Image2.Canvas.Rectangle(600,32,700-1,33);

            Form1.Image2.Canvas.Font.color:=RGB(0,200,0);
            Form1.Image2.Canvas.TextOut(460,40,'Accelaration Y');
            Form1.Image2.Canvas.Pen.color:=RGB(0,200,0);
            Form1.Image2.Canvas.Pen.width:=2;
            Form1.Image2.Canvas.Rectangle(600,47,700-1,48);

            Form1.Image2.Canvas.Font.color:=RGB(0,0,200);
            Form1.Image2.Canvas.TextOut(460,55,'Accelaration X');
            Form1.Image2.Canvas.Pen.color:=RGB(0,0,200);
            Form1.Image2.Canvas.Pen.width:=2;
            Form1.Image2.Canvas.Rectangle(600,62,700-1,63);
{END OF COLOR GUIDE ----------------------------------------------------------------------------------------------------------------}

     AssignFile (Info_File,form1.OpenDialog1.FileName);
     Reset(Info_File);
     repeat
         Readln(Info_File,Read_Text);
         S:=Copy(Read_Text,0,2);
     until(S='~A');
     Resistivity_Sum_Previous:=0;
     AZ_Previous:=0;
     AY_Previous:=0;
     AX_Previous:=0;
     y:=0;
     repeat
          Readln(Info_File,Read_Text);
          loop:=0;
          n:=0;
          repeat
               Data_str:='';
               repeat
                    loop:=loop+1;
                    S:=Copy(Read_Text,loop,1);
               until(S<>' ');
               n:=n+1;
               repeat
                    Data_str:=Data_str+S;
                    loop:=loop+1;
                    S:=Copy(Read_Text,loop,1);
               until(S=' ');
               Data:=StrToFloat(Data_str);
               Data_Matrix[Position_Matrix[n]]:=Data;
          until (n=Number_of_Curves);

          y:=101+Trunc((Start_Depth-Stop_Depth)/(Scale*10)*96)-Trunc((Start_Depth-Data_Matrix[1])/(Scale*10)*96);

          Resistivity_Sum_Previous:=Resistivity_Sum_Current;
          Resistivity_Sum_Current:=0;
          AZ_Previous:=AZ_Current;
          AZ_Current:=Data_Matrix[6];
          AY_Previous:=AY_Current;
          AY_Current:=Data_Matrix[5];
          AX_Previous:=AX_Current;
          AX_Current:=Data_Matrix[4];
          GR_Previous:=GR_Current;
          GR_Current:=Data_Matrix[16];

          for Pad:= 20 to 211 do
               Begin
                    Color_Plot:=Trunc((Data_Matrix[Pad]-Min_R)*765/(Max_R-Min_R));
                    Resistivity_Sum_Current:=Resistivity_Sum_Current+Trunc(Data_matrix[Pad]);
                    if (Color_Plot<0) then
                         Begin
                              Red:=255; Green:=255; Blue:=255;
                         end;
                    if (Color_Plot>=0) and (Color_Plot<=255) then
                         Begin
                              Red:=255; Green:=255; Blue:=255-Color_Plot;
                         end;
                    if (Color_Plot>255) and (Color_Plot<=510) then
                         Begin
                              Red:=255; Green:=510-Color_Plot; Blue:=0;
                         end;
                    if (Color_Plot>510) and (Color_Plot<=765) then
                         Begin
                              Red:=765-Color_Plot; Green:=0; Blue:=0;
                         end;
                    if (Color_Plot>765) then
                         Begin
                              Red:=0; Green:=0; Blue:=0;
                         end;

                    if Data_Matrix[14]>=360 then Data_Matrix[14]:=Data_Matrix[14]-360;
                    x:=20+(pad-20)+((pad-20)div 24)*24+Trunc(Data_Matrix[14]*1.06667);
                    if x>=400 then x:=x-400;

                    form1.Image2.Canvas.pixels[x,y]:=RGB(Red,Green,Blue);
                    if scale=5 then form1.Image2.Canvas.pixels[x,y+1]:=RGB(Red,Green,Blue);
               end;

               If Trunc(Data_Matrix[1]) mod Trunc(scale*10)=0 then
                    Begin
                         Form1.Image2.Canvas.Pen.color:=RGB(150,150,150);
                         Form1.Image2.Canvas.Pen.Width:=1;
                         Form1.Image2.Canvas.MoveTo(431,y);
                         Form1.Image2.Canvas.LineTo(435,y);
                         Form1.Image2.Canvas.Font.Size:=5;
                         Form1.Image2.Canvas.TextOut(402,y-5,FloatToStr(Data_Matrix[1]));
                    end;

               If Trunc(Data_Matrix[1]) mod 100=0 then
                    Begin
                         Form1.Image2.Canvas.Pen.color:=RGB(100,100,100);
                         Form1.Image2.Canvas.Pen.Width:=1;
                         Form1.Image2.Canvas.MoveTo(431,y);
                         Form1.Image2.Canvas.LineTo(439,y);
                    end;

               If Trunc(Data_Matrix[1]) mod 1000=0 then
                    Begin
                         Form1.Image2.Canvas.Pen.color:=RGB(0,0,0);
                         Form1.Image2.Canvas.Pen.Width:=1;
                         Form1.Image2.Canvas.MoveTo(431,y);
                         Form1.Image2.Canvas.LineTo(447,y);
                    end;

               Form1.Image2.Canvas.Pen.color:=RGB(100,100,100);
               Form1.Image2.Canvas.Pen.Width:=2;
               Form1.Image2.Canvas.MoveTo(450+Trunc(Resistivity_Sum_Previous/192/5),y-1);
               Form1.Image2.Canvas.LineTo(450+Trunc(Resistivity_Sum_Current/192/5),y);

               Form1.Image2.Canvas.Pen.color:=RGB(200,0,0);
               Form1.Image2.Canvas.Pen.Width:=1;
               Form1.Image2.Canvas.MoveTo(720+Trunc((AZ_Previous-9.2)*50),y-1);
               Form1.Image2.Canvas.LineTo(720+Trunc((AZ_Current-9.2)*50),y);

               Form1.Image2.Canvas.Pen.color:=RGB(0,200,0);
               Form1.Image2.Canvas.Pen.Width:=1;
               Form1.Image2.Canvas.MoveTo(720+Trunc((AY_Previous+9.8-9.2)*50),y-1);
               Form1.Image2.Canvas.LineTo(720+Trunc((AY_Current+9.8-9.2)*50),y);

               Form1.Image2.Canvas.Pen.color:=RGB(0,0,200);
               Form1.Image2.Canvas.Pen.Width:=1;
               Form1.Image2.Canvas.MoveTo(720+Trunc((AX_Previous+9.8-9.2)*50),y-1);
               Form1.Image2.Canvas.LineTo(720+Trunc((AX_Current+9.8-9.2)*50),y);

               Form1.Image2.Canvas.Pen.color:=RGB(150,50,200);
               Form1.Image2.Canvas.Pen.Width:=2;
               Form1.Image2.Canvas.MoveTo(450+Trunc(GR_Previous),y-1);
               Form1.Image2.Canvas.LineTo(450+Trunc(GR_Current),y);

               Progressbar1.Position:=Trunc(100*(Start_Depth-Data_Matrix[1])/(Start_Depth-Stop_Depth));
     until (Data_Matrix[1]<=Stop_Depth+6);
     Form1.Image1.Visible:=False;
     Form1.Image2.Visible:=True;

end;

end.
