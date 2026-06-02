unit Unit7;

interface

uses
  Windows, Messages, SysUtils, Variants, Classes, Graphics, Controls, Forms,
  Dialogs, AppEvnts, Grids, ValEdit, ComCtrls, StdCtrls, ExtCtrls;

type
  TForm7 = class(TForm)
    Button1: TButton;
    ProgressBar1: TProgressBar;
    GroupBox1: TGroupBox;
    CheckBox1: TCheckBox;
    CheckBox2: TCheckBox;
    RadioGroup1: TRadioGroup;
    RadioButton1: TRadioButton;
    RadioButton2: TRadioButton;
    Memo1: TMemo;
    ProgressBar2: TProgressBar;
    Label1: TLabel;
    Label2: TLabel;
    RadioGroup2: TRadioGroup;
    ComboBox1: TComboBox;
    Label3: TLabel;
    procedure FormClose(Sender: TObject; var Action: TCloseAction);
    procedure Button1Click(Sender: TObject);
  private
    { Private declarations }
  public
    { Public declarations }
  end;

var
  Form7: TForm7;

implementation
uses main, Unit8;
{$R *.dfm}

procedure TForm7.Button1Click(Sender: TObject);
var
     Read_Text, S, Curve_Name, Data_str :string;
     in_file,info_file : TextFile;
     n, n2, loop,Pad, Button, Class_Distribution, Color_Plot, Red, Green, Blue, x, y, Resistivity_Sum_Current, Resistivity_Sum_Previous, Scale, Color_Scale, Acc_Scale, y_end : Integer;
     Data, AZ_Current, AZ_Previous, AY_Current, AY_Previous, AX_Current, AX_Previous, GR_Previous, GR_Current, Max_R, Min_R, Cumulative : Real;


begin
     For loop:= 1 to 211 do Data_Matrix[loop]:=0; {Zero Matrix, for sure ..}
     For loop:= 1 to 1000 do Position_Matrix[loop]:=0; {Zero Matrix, for sure ..}
     For Pad:= 1 to 8 do
          For Button:= 1 to 152 do
               Distribution_Matrix[Button,Pad]:=0; {Zero Matrix, for sure ..}
     Number_of_Data:=0;
     Scale:=50;
     If Form7.ComboBox1.ItemIndex=0 then Scale:=5;
     If Form7.ComboBox1.ItemIndex=1 then Scale:=10;
     If Form7.ComboBox1.ItemIndex=2 then Scale:=50;
     If Form7.ComboBox1.ItemIndex=3 then Scale:=100;
     If Form7.ComboBox1.ItemIndex=4 then Scale:=200;
     If Form7.ComboBox1.ItemIndex=5 then Scale:=500;
     If Form7.ComboBox1.ItemIndex=6 then Scale:=1000;
     Memo1.Lines.add(FloatToStr(Form7.ComboBox1.ItemIndex));

     AssignFile (Info_File,form1.OpenDialog1.FileName);
     Reset(Info_File);
     repeat Readln(Info_File,Read_Text); S:=Copy(Read_Text,0,2); until(S='~C');
     repeat Readln(Info_File,Read_Text); S:=Copy(Read_Text,0,1); until(S<>'#');

     n:=0;
     repeat
         n:=n+1;
         Curve_Name:=Copy(Read_Text,0,8);
         Position_Matrix[n]:=999;
         If Curve_Name= 'TDEP    ' then Position_Matrix[n]:=1;
         If Curve_Name= 'TIME    ' then Position_Matrix[n]:=2;
         If Curve_Name= 'EV      ' then Position_Matrix[n]:=3;
         If Curve_Name= 'FCAX    ' then Position_Matrix[n]:=4;
         If Curve_Name= 'FCAY    ' then Position_Matrix[n]:=5;
         If Curve_Name= 'FCAZ    ' then Position_Matrix[n]:=6;
         If Curve_Name= 'FTIM    ' then Position_Matrix[n]:=7;
         If Curve_Name= 'CS      ' then Position_Matrix[n]:=8;
         If Curve_Name= 'CVEL    ' then Position_Matrix[n]:=9;
         If Curve_Name= 'TENS    ' then Position_Matrix[n]:=10;
         If Curve_Name= 'ETIM    ' then Position_Matrix[n]:=11;
         If Curve_Name= 'DEVI    ' then Position_Matrix[n]:=12;
         If Curve_Name= 'ANOR    ' then Position_Matrix[n]:=13;
         If Curve_Name= 'P1AZ    ' then Position_Matrix[n]:=14;
         If Curve_Name= 'EI      ' then Position_Matrix[n]:=15;
         If Curve_Name= 'GR      ' then Position_Matrix[n]:=16;

         If Curve_Name= 'FCD4[0] ' then Position_Matrix[n]:=20;
         If Curve_Name= 'FCD4[1] ' then Position_Matrix[n]:=22;
         If Curve_Name= 'FCD4[2] ' then Position_Matrix[n]:=24;
         If Curve_Name= 'FCD4[3] ' then Position_Matrix[n]:=26;
         If Curve_Name= 'FCD4[4] ' then Position_Matrix[n]:=28;
         If Curve_Name= 'FCD4[5] ' then Position_Matrix[n]:=30;
         If Curve_Name= 'FCD4[6] ' then Position_Matrix[n]:=32;
         If Curve_Name= 'FCD4[7] ' then Position_Matrix[n]:=34;
         If Curve_Name= 'FCD4[8] ' then Position_Matrix[n]:=36;
         If Curve_Name= 'FCD4[9] ' then Position_Matrix[n]:=38;
         If Curve_Name= 'FCD4[10]' then Position_Matrix[n]:=40;
         If Curve_Name= 'FCD4[11]' then Position_Matrix[n]:=42;
         If Curve_Name= 'FCD3[0] ' then Position_Matrix[n]:=21;
         If Curve_Name= 'FCD3[1] ' then Position_Matrix[n]:=23;
         If Curve_Name= 'FCD3[2] ' then Position_Matrix[n]:=25;
         If Curve_Name= 'FCD3[3] ' then Position_Matrix[n]:=27;
         If Curve_Name= 'FCD3[4] ' then Position_Matrix[n]:=29;
         If Curve_Name= 'FCD3[5] ' then Position_Matrix[n]:=31;
         If Curve_Name= 'FCD3[6] ' then Position_Matrix[n]:=33;
         If Curve_Name= 'FCD3[7] ' then Position_Matrix[n]:=35;
         If Curve_Name= 'FCD3[8] ' then Position_Matrix[n]:=37;
         If Curve_Name= 'FCD3[9] ' then Position_Matrix[n]:=39;
         If Curve_Name= 'FCD3[10]' then Position_Matrix[n]:=41;
         If Curve_Name= 'FCD3[11]' then Position_Matrix[n]:=43;
         If Curve_Name= 'FCD2[0] ' then Position_Matrix[n]:=44;
         If Curve_Name= 'FCD2[1] ' then Position_Matrix[n]:=46;
         If Curve_Name= 'FCD2[2] ' then Position_Matrix[n]:=48;
         If Curve_Name= 'FCD2[3] ' then Position_Matrix[n]:=50;
         If Curve_Name= 'FCD2[4] ' then Position_Matrix[n]:=52;
         If Curve_Name= 'FCD2[5] ' then Position_Matrix[n]:=54;
         If Curve_Name= 'FCD2[6] ' then Position_Matrix[n]:=56;
         If Curve_Name= 'FCD2[7] ' then Position_Matrix[n]:=58;
         If Curve_Name= 'FCD2[8] ' then Position_Matrix[n]:=60;
         If Curve_Name= 'FCD2[9] ' then Position_Matrix[n]:=62;
         If Curve_Name= 'FCD2[10]' then Position_Matrix[n]:=64;
         If Curve_Name= 'FCD2[11]' then Position_Matrix[n]:=66;
         If Curve_Name= 'FCD1[0] ' then Position_Matrix[n]:=45;
         If Curve_Name= 'FCD1[1] ' then Position_Matrix[n]:=47;
         If Curve_Name= 'FCD1[2] ' then Position_Matrix[n]:=49;
         If Curve_Name= 'FCD1[3] ' then Position_Matrix[n]:=51;
         If Curve_Name= 'FCD1[4] ' then Position_Matrix[n]:=53;
         If Curve_Name= 'FCD1[5] ' then Position_Matrix[n]:=55;
         If Curve_Name= 'FCD1[6] ' then Position_Matrix[n]:=57;
         If Curve_Name= 'FCD1[7] ' then Position_Matrix[n]:=59;
         If Curve_Name= 'FCD1[8] ' then Position_Matrix[n]:=61;
         If Curve_Name= 'FCD1[9] ' then Position_Matrix[n]:=63;
         If Curve_Name= 'FCD1[10]' then Position_Matrix[n]:=65;
         If Curve_Name= 'FCD1[11]' then Position_Matrix[n]:=67;

         If Curve_Name= 'FCC4[0] ' then Position_Matrix[n]:=68;
         If Curve_Name= 'FCC4[1] ' then Position_Matrix[n]:=70;
         If Curve_Name= 'FCC4[2] ' then Position_Matrix[n]:=72;
         If Curve_Name= 'FCC4[3] ' then Position_Matrix[n]:=74;
         If Curve_Name= 'FCC4[4] ' then Position_Matrix[n]:=76;
         If Curve_Name= 'FCC4[5] ' then Position_Matrix[n]:=78;
         If Curve_Name= 'FCC4[6] ' then Position_Matrix[n]:=80;
         If Curve_Name= 'FCC4[7] ' then Position_Matrix[n]:=82;
         If Curve_Name= 'FCC4[8] ' then Position_Matrix[n]:=84;
         If Curve_Name= 'FCC4[9] ' then Position_Matrix[n]:=86;
         If Curve_Name= 'FCC4[10]' then Position_Matrix[n]:=88;
         If Curve_Name= 'FCC4[11]' then Position_Matrix[n]:=90;
         If Curve_Name= 'FCC3[0] ' then Position_Matrix[n]:=69;
         If Curve_Name= 'FCC3[1] ' then Position_Matrix[n]:=71;
         If Curve_Name= 'FCC3[2] ' then Position_Matrix[n]:=73;
         If Curve_Name= 'FCC3[3] ' then Position_Matrix[n]:=75;
         If Curve_Name= 'FCC3[4] ' then Position_Matrix[n]:=77;
         If Curve_Name= 'FCC3[5] ' then Position_Matrix[n]:=79;
         If Curve_Name= 'FCC3[6] ' then Position_Matrix[n]:=81;
         If Curve_Name= 'FCC3[7] ' then Position_Matrix[n]:=83;
         If Curve_Name= 'FCC3[8] ' then Position_Matrix[n]:=85;
         If Curve_Name= 'FCC3[9] ' then Position_Matrix[n]:=87;
         If Curve_Name= 'FCC3[10]' then Position_Matrix[n]:=89;
         If Curve_Name= 'FCC3[11]' then Position_Matrix[n]:=91;
         If Curve_Name= 'FCC2[0] ' then Position_Matrix[n]:=92;
         If Curve_Name= 'FCC2[1] ' then Position_Matrix[n]:=94;
         If Curve_Name= 'FCC2[2] ' then Position_Matrix[n]:=96;
         If Curve_Name= 'FCC2[3] ' then Position_Matrix[n]:=98;
         If Curve_Name= 'FCC2[4] ' then Position_Matrix[n]:=100;
         If Curve_Name= 'FCC2[5] ' then Position_Matrix[n]:=102;
         If Curve_Name= 'FCC2[6] ' then Position_Matrix[n]:=104;
         If Curve_Name= 'FCC2[7] ' then Position_Matrix[n]:=106;
         If Curve_Name= 'FCC2[8] ' then Position_Matrix[n]:=108;
         If Curve_Name= 'FCC2[9] ' then Position_Matrix[n]:=110;
         If Curve_Name= 'FCC2[10]' then Position_Matrix[n]:=112;
         If Curve_Name= 'FCC2[11]' then Position_Matrix[n]:=114;
         If Curve_Name= 'FCC1[0] ' then Position_Matrix[n]:=93;
         If Curve_Name= 'FCC1[1] ' then Position_Matrix[n]:=95;
         If Curve_Name= 'FCC1[2] ' then Position_Matrix[n]:=97;
         If Curve_Name= 'FCC1[3] ' then Position_Matrix[n]:=99;
         If Curve_Name= 'FCC1[4] ' then Position_Matrix[n]:=101;
         If Curve_Name= 'FCC1[5] ' then Position_Matrix[n]:=103;
         If Curve_Name= 'FCC1[6] ' then Position_Matrix[n]:=105;
         If Curve_Name= 'FCC1[7] ' then Position_Matrix[n]:=107;
         If Curve_Name= 'FCC1[8] ' then Position_Matrix[n]:=109;
         If Curve_Name= 'FCC1[9] ' then Position_Matrix[n]:=111;
         If Curve_Name= 'FCC1[10]' then Position_Matrix[n]:=113;
         If Curve_Name= 'FCC1[11]' then Position_Matrix[n]:=115;

         If Curve_Name= 'FCB4[0] ' then Position_Matrix[n]:=116;
         If Curve_Name= 'FCB4[1] ' then Position_Matrix[n]:=118;
         If Curve_Name= 'FCB4[2] ' then Position_Matrix[n]:=120;
         If Curve_Name= 'FCB4[3] ' then Position_Matrix[n]:=122;
         If Curve_Name= 'FCB4[4] ' then Position_Matrix[n]:=124;
         If Curve_Name= 'FCB4[5] ' then Position_Matrix[n]:=126;
         If Curve_Name= 'FCB4[6] ' then Position_Matrix[n]:=128;
         If Curve_Name= 'FCB4[7] ' then Position_Matrix[n]:=130;
         If Curve_Name= 'FCB4[8] ' then Position_Matrix[n]:=132;
         If Curve_Name= 'FCB4[9] ' then Position_Matrix[n]:=134;
         If Curve_Name= 'FCB4[10]' then Position_Matrix[n]:=136;
         If Curve_Name= 'FCB4[11]' then Position_Matrix[n]:=138;
         If Curve_Name= 'FCB3[0] ' then Position_Matrix[n]:=117;
         If Curve_Name= 'FCB3[1] ' then Position_Matrix[n]:=119;
         If Curve_Name= 'FCB3[2] ' then Position_Matrix[n]:=121;
         If Curve_Name= 'FCB3[3] ' then Position_Matrix[n]:=123;
         If Curve_Name= 'FCB3[4] ' then Position_Matrix[n]:=125;
         If Curve_Name= 'FCB3[5] ' then Position_Matrix[n]:=127;
         If Curve_Name= 'FCB3[6] ' then Position_Matrix[n]:=129;
         If Curve_Name= 'FCB3[7] ' then Position_Matrix[n]:=131;
         If Curve_Name= 'FCB3[8] ' then Position_Matrix[n]:=133;
         If Curve_Name= 'FCB3[9] ' then Position_Matrix[n]:=135;
         If Curve_Name= 'FCB3[10]' then Position_Matrix[n]:=137;
         If Curve_Name= 'FCB3[11]' then Position_Matrix[n]:=139;
         If Curve_Name= 'FCB2[0] ' then Position_Matrix[n]:=140;
         If Curve_Name= 'FCB2[1] ' then Position_Matrix[n]:=142;
         If Curve_Name= 'FCB2[2] ' then Position_Matrix[n]:=144;
         If Curve_Name= 'FCB2[3] ' then Position_Matrix[n]:=146;
         If Curve_Name= 'FCB2[4] ' then Position_Matrix[n]:=148;
         If Curve_Name= 'FCB2[5] ' then Position_Matrix[n]:=150;
         If Curve_Name= 'FCB2[6] ' then Position_Matrix[n]:=152;
         If Curve_Name= 'FCB2[7] ' then Position_Matrix[n]:=154;
         If Curve_Name= 'FCB2[8] ' then Position_Matrix[n]:=156;
         If Curve_Name= 'FCB2[9] ' then Position_Matrix[n]:=158;
         If Curve_Name= 'FCB2[10]' then Position_Matrix[n]:=160;
         If Curve_Name= 'FCB2[11]' then Position_Matrix[n]:=162;
         If Curve_Name= 'FCB1[0] ' then Position_Matrix[n]:=141;
         If Curve_Name= 'FCB1[1] ' then Position_Matrix[n]:=143;
         If Curve_Name= 'FCB1[2] ' then Position_Matrix[n]:=145;
         If Curve_Name= 'FCB1[3] ' then Position_Matrix[n]:=147;
         If Curve_Name= 'FCB1[4] ' then Position_Matrix[n]:=149;
         If Curve_Name= 'FCB1[5] ' then Position_Matrix[n]:=151;
         If Curve_Name= 'FCB1[6] ' then Position_Matrix[n]:=153;
         If Curve_Name= 'FCB1[7] ' then Position_Matrix[n]:=155;
         If Curve_Name= 'FCB1[8] ' then Position_Matrix[n]:=157;
         If Curve_Name= 'FCB1[9] ' then Position_Matrix[n]:=159;
         If Curve_Name= 'FCB1[10]' then Position_Matrix[n]:=161;
         If Curve_Name= 'FCB1[11]' then Position_Matrix[n]:=163;

         If Curve_Name= 'FCA4[0] ' then Position_Matrix[n]:=164;
         If Curve_Name= 'FCA4[1] ' then Position_Matrix[n]:=166;
         If Curve_Name= 'FCA4[2] ' then Position_Matrix[n]:=168;
         If Curve_Name= 'FCA4[3] ' then Position_Matrix[n]:=170;
         If Curve_Name= 'FCA4[4] ' then Position_Matrix[n]:=172;
         If Curve_Name= 'FCA4[5] ' then Position_Matrix[n]:=174;
         If Curve_Name= 'FCA4[6] ' then Position_Matrix[n]:=176;
         If Curve_Name= 'FCA4[7] ' then Position_Matrix[n]:=178;
         If Curve_Name= 'FCA4[8] ' then Position_Matrix[n]:=180;
         If Curve_Name= 'FCA4[9] ' then Position_Matrix[n]:=182;
         If Curve_Name= 'FCA4[10]' then Position_Matrix[n]:=184;
         If Curve_Name= 'FCA4[11]' then Position_Matrix[n]:=186;
         If Curve_Name= 'FCA3[0] ' then Position_Matrix[n]:=165;
         If Curve_Name= 'FCA3[1] ' then Position_Matrix[n]:=167;
         If Curve_Name= 'FCA3[2] ' then Position_Matrix[n]:=169;
         If Curve_Name= 'FCA3[3] ' then Position_Matrix[n]:=171;
         If Curve_Name= 'FCA3[4] ' then Position_Matrix[n]:=173;
         If Curve_Name= 'FCA3[5] ' then Position_Matrix[n]:=175;
         If Curve_Name= 'FCA3[6] ' then Position_Matrix[n]:=177;
         If Curve_Name= 'FCA3[7] ' then Position_Matrix[n]:=179;
         If Curve_Name= 'FCA3[8] ' then Position_Matrix[n]:=181;
         If Curve_Name= 'FCA3[9] ' then Position_Matrix[n]:=183;
         If Curve_Name= 'FCA3[10]' then Position_Matrix[n]:=185;
         If Curve_Name= 'FCA3[11]' then Position_Matrix[n]:=187;
         If Curve_Name= 'FCA2[0] ' then Position_Matrix[n]:=188;
         If Curve_Name= 'FCA2[1] ' then Position_Matrix[n]:=190;
         If Curve_Name= 'FCA2[2] ' then Position_Matrix[n]:=192;
         If Curve_Name= 'FCA2[3] ' then Position_Matrix[n]:=194;
         If Curve_Name= 'FCA2[4] ' then Position_Matrix[n]:=196;
         If Curve_Name= 'FCA2[5] ' then Position_Matrix[n]:=198;
         If Curve_Name= 'FCA2[6] ' then Position_Matrix[n]:=200;
         If Curve_Name= 'FCA2[7] ' then Position_Matrix[n]:=202;
         If Curve_Name= 'FCA2[8] ' then Position_Matrix[n]:=204;
         If Curve_Name= 'FCA2[9] ' then Position_Matrix[n]:=206;
         If Curve_Name= 'FCA2[10]' then Position_Matrix[n]:=208;
         If Curve_Name= 'FCA2[11]' then Position_Matrix[n]:=210;
         If Curve_Name= 'FCA1[0] ' then Position_Matrix[n]:=189;
         If Curve_Name= 'FCA1[1] ' then Position_Matrix[n]:=191;
         If Curve_Name= 'FCA1[2] ' then Position_Matrix[n]:=193;
         If Curve_Name= 'FCA1[3] ' then Position_Matrix[n]:=195;
         If Curve_Name= 'FCA1[4] ' then Position_Matrix[n]:=197;
         If Curve_Name= 'FCA1[5] ' then Position_Matrix[n]:=199;
         If Curve_Name= 'FCA1[6] ' then Position_Matrix[n]:=201;
         If Curve_Name= 'FCA1[7] ' then Position_Matrix[n]:=203;
         If Curve_Name= 'FCA1[8] ' then Position_Matrix[n]:=205;
         If Curve_Name= 'FCA1[9] ' then Position_Matrix[n]:=207;
         If Curve_Name= 'FCA1[10]' then Position_Matrix[n]:=209;
         If Curve_Name= 'FCA1[11]' then Position_Matrix[n]:=211;

         Readln(Info_File,Read_Text);
         S:=Copy(Read_Text,0,1);
     until(S='#');
     memo1.lines.add('*** Positioning of Curve in Standard Form Completed ...');
     Number_of_Curves:=n;

     repeat Readln(Info_File,Read_Text); S:=Copy(Read_Text,0,2); until(S='~A');
     repeat
          Readln(Info_File,Read_Text);
          loop:=0;
          n:=0;
          Number_of_Data:=Number_of_Data+1;
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

          for Pad:= 0 to 7 do
               for Button:=0 to 23 do
                    Begin
                         Class_Distribution:=51+Trunc(Data_Matrix[20+Pad*24+Button]/10);
                         if (Class_Distribution<=0) then Class_Distribution:=1;
                         if (Class_Distribution>=300) then Class_Distribution:=300;
                         Distribution_Matrix[Class_Distribution,Pad+1]:=Distribution_Matrix[Class_Distribution,Pad+1]+1;
                         if Data_Matrix[20+Pad*24+Button]<Distribution_Matrix[301,Pad+1] then Distribution_Matrix[301,Pad+1]:=Data_Matrix[20+Pad*24+Button];
                         if Data_Matrix[20+Pad*24+Button]>Distribution_Matrix[302,Pad+1] then Distribution_Matrix[302,Pad+1]:=Data_Matrix[20+Pad*24+Button];
                    end;
          Progressbar1.Position:=Trunc(100*(Start_Depth-Data_Matrix[1])/(Start_Depth-Stop_Depth));
          If RadioButton2.Checked=True then Readln(Info_File,Read_Text);
     until (Data_Matrix[1]<=Stop_Depth+6);

     Max:=0; Min:=0;
     For Pad:= 1 to 8 do
          Begin
               if Distribution_Matrix[302,Pad]>Max then Max:=Distribution_Matrix[302,Pad];
               if Distribution_Matrix[301,Pad]<Min then Min:=Distribution_Matrix[301,Pad];
          end;


     If RadioButton1.Checked=True then Number_of_Data:=Number_of_Data*8*24 Else Number_of_Data:=2*Number_of_Data*8*24;
     For Pad:= 1 to 8 do
          memo1.lines.add('Pad '+FloatToStr(Pad)+' Min:Max >> '+FloatToStr(Distribution_Matrix[301,Pad])+':'+FloatToStr(Distribution_Matrix[302,Pad]));

     memo1.lines.add('Max: '+FloatToStr(Max)+'  Min: '+FloatToStr(Min));
     memo1.lines.add('Number of Data: '+FloatToStr(Number_of_Data));
     memo1.lines.add('*** Data Statistics Completed ...');

     Form8.ValueListEditor1.Refresh;
     Form8.ValueListEditor1.InsertRow('Number of Data on Image',FloatToStr(Number_of_Data),True);
     Form8.ValueListEditor1.InsertRow('Absolute Maximum',FloatToStr(Max), True);
     Form8.ValueListEditor1.InsertRow('Absolute Minimum',FloatToStr(Min), True);
     Form8.ValueListEditor1.InsertRow('Maximum on Pad #1',FloatToStr(Distribution_Matrix[301,1]),True);
     Form8.ValueListEditor1.InsertRow('Minimum on Pad #1',FloatToStr(Distribution_Matrix[302,1]),True);
     Form8.ValueListEditor1.InsertRow('Maximum on Flap #1',FloatToStr(Distribution_Matrix[301,2]),True);
     Form8.ValueListEditor1.InsertRow('Minimum on Flap #1',FloatToStr(Distribution_Matrix[302,2]),True);
     Form8.ValueListEditor1.InsertRow('Maximum on Pad #2',FloatToStr(Distribution_Matrix[301,3]),True);
     Form8.ValueListEditor1.InsertRow('Minimum on Pad #2',FloatToStr(Distribution_Matrix[302,3]),True);
     Form8.ValueListEditor1.InsertRow('Maximum on Flap #2',FloatToStr(Distribution_Matrix[301,4]),True);
     Form8.ValueListEditor1.InsertRow('Minimum on Flap #2',FloatToStr(Distribution_Matrix[302,4]),True);
     Form8.ValueListEditor1.InsertRow('Maximum on Pad #3',FloatToStr(Distribution_Matrix[301,5]),True);
     Form8.ValueListEditor1.InsertRow('Minimum on Pad #3',FloatToStr(Distribution_Matrix[302,5]),True);
     Form8.ValueListEditor1.InsertRow('Maximum on Flap #3',FloatToStr(Distribution_Matrix[301,6]),True);
     Form8.ValueListEditor1.InsertRow('Minimum on Flap #3',FloatToStr(Distribution_Matrix[302,6]),True);
     Form8.ValueListEditor1.InsertRow('Maximum on Pad #4',FloatToStr(Distribution_Matrix[301,7]),True);
     Form8.ValueListEditor1.InsertRow('Minimum on Pad #4',FloatToStr(Distribution_Matrix[302,7]),True);
     Form8.ValueListEditor1.InsertRow('Maximum on Flap #4',FloatToStr(Distribution_Matrix[301,8]),True);
     Form8.ValueListEditor1.InsertRow('Minimum on Flap #4',FloatToStr(Distribution_Matrix[302,8]),True);

     y_end:= Trunc((Start_Depth-Stop_Depth)/(Scale*10)*96);
     Form1.VertScrollBar.Range:=y_end+100;
     Form1.Image1.Height:=y_end;
     Form1.Image1.Canvas.Refresh;
     Form1.Image1.Visible:=False;
     Form1.Image2.Visible:=False;

{START OF FRAMEWORK FOR DETAIL VIEW WINDOW -----------------------------------------------------------------------------------------}
     Form1.Image1.Canvas.Pen.color:=RGB(150,150,150);
     Form1.Image1.Canvas.Pen.width:=1;

     Form1.Image1.Canvas.rectangle(0,99,400,y_end);
     Form1.Image1.Canvas.rectangle(450,99,700,y_end);
     Form1.Image1.Canvas.rectangle(699,99,800,y_end);

     Form1.Image1.Canvas.rectangle(0,0,400,100);
     Form1.Image1.Canvas.rectangle(450,0,800,100);

     Form1.Image1.Canvas.rectangle(0,70,400,100);

     Form1.Image1.Canvas.Font.color:=RGB(120,120,120);
     Form1.Image1.Canvas.Font.Size:=15;
     Form1.Image1.Canvas.TextOut(10,5,'GEOMANCY 2007');
     Form1.Image1.Canvas.Font.color:=RGB(150,150,150);
     Form1.Image1.Canvas.Font.Size:=7;
     Form1.Image1.Canvas.TextOut(10,25,'Copyrights 2007, All Rights Reserved.');

     Form1.Image1.Canvas.Font.Size:=12;
     Form1.Image1.Canvas.Font.color:=RGB(50,50,50);

     Form1.Image1.Canvas.TextOut(28,75,'N');
     Form1.Image1.Canvas.rectangle(32,94,33,98);

     Form1.Image1.Canvas.TextOut(72,75,'NE');
     Form1.Image1.Canvas.rectangle(80,94,81,98);

     Form1.Image1.Canvas.TextOut(124,75,'E');
     Form1.Image1.Canvas.rectangle(128,94,129,98);

     Form1.Image1.Canvas.TextOut(168,75,'SE');
     Form1.Image1.Canvas.rectangle(176,94,177,98);

     Form1.Image1.Canvas.TextOut(220,75,'S');
     Form1.Image1.Canvas.rectangle(224,94,225,98);

     Form1.Image1.Canvas.TextOut(264,75,'SW');
     Form1.Image1.Canvas.rectangle(272,94,273,98);

     Form1.Image1.Canvas.TextOut(316,75,'W');
     Form1.Image1.Canvas.rectangle(320,94,321,98);

     Form1.Image1.Canvas.TextOut(360,75,'NW');
     Form1.Image1.Canvas.rectangle(368,94,369,98);



{END OF FRAMEWORK FOR DETAIL VIEW WINDOW -------------------------------------------------------------------------------------------}

{START OF COLOR GUIDE --------------------------------------------------------------------------------------------------------------}
     for n:=0 to 255 do
          Begin
               if n<85 then
                    Begin
                         Form1.Image1.Canvas.Pen.color:=RGB(255,255,255-(n*3));
                         Form1.Image1.Canvas.moveto(n+65, 60);
                         Form1.Image1.Canvas.lineto(n+65, 65);
                    end;
               if (n>=85) and (n<170) then
                    Begin
                         Form1.Image1.Canvas.Pen.color:=RGB(255,510-(n*3),0);
                         Form1.Image1.Canvas.moveto(n+65,60);
                         Form1.Image1.Canvas.lineto(n+65,65);
                    end;
               if n >= 170 then
                    Begin
                         Form1.Image1.Canvas.Pen.color:=RGB(765-(n*3),0,0);
                         Form1.Image1.Canvas.moveto(n+65,60);
                         Form1.Image1.Canvas.lineto(n+65,65);
                    end;
            end;
            Form1.Image1.Canvas.Font.Size:=8;
            Form1.Image1.Canvas.Font.color:=RGB(100,100,100);
            Form1.Image1.Canvas.TextOut(65,45,FloatToStr(Min));
            Form1.Image1.Canvas.TextOut(300,45,FloatToStr(Max));

            {Scale of Resistivity}
            For Color_Scale:= 1 to 12 do
                Begin
                     Form1.Image1.Canvas.Pen.color:=RGB(200,200,200);
                     Form1.Image1.Canvas.MoveTo(450+Trunc((Color_Scale*100)/5),100+1);
                     Form1.Image1.Canvas.LineTo(450+Trunc((Color_Scale*100)/5),y_end-1);
                     Form1.Image1.Canvas.Font.Size:=5;
                     Form1.Image1.Canvas.Font.color:=RGB(100,100,100);
                     Form1.Image1.Canvas.TextOut(450+Trunc((Color_Scale*100)/5)-5,90,FloatToStr(Color_Scale*100));
               end;

            {Scale of Acceleration}
            For Acc_Scale:= -9 to 9 do
                Begin
                     Form1.Image1.Canvas.Pen.color:=RGB(200,200,200);
                     Form1.Image1.Canvas.MoveTo(720+Trunc(((Acc_Scale/10)+9.8-9.2)*50),100+1);
                     Form1.Image1.Canvas.LineTo(720+Trunc(((Acc_Scale/10)+9.8-9.2)*50),y_end-1);
                     Form1.Image1.Canvas.Font.Size:=4;
                     Form1.Image1.Canvas.Font.color:=RGB(100,100,100);
                     Form1.Image1.Canvas.TextOut(720+Trunc(((Acc_Scale/10)+9.8-9.2)*50)-5,90,FloatToStr(((Acc_Scale/10)+9.8-9.2)));
                end;

            Form1.Image1.Canvas.Pen.color:=RGB(100,100,100);
            Form1.Image1.Canvas.Pen.Width:=1;
            Form1.Image1.Canvas.MoveTo(720+Trunc((9.8-9.2)*50),100+1);
            Form1.Image1.Canvas.LineTo(720+Trunc((9.8-9.2)*50),y_end-1);


            Form1.Image1.Canvas.Font.Size:=8;
            Form1.Image1.Canvas.Font.color:=RGB(100,100,100);
            Form1.Image1.Canvas.TextOut(460,10,'Average Conductivity');
            Form1.Image1.Canvas.Pen.color:=RGB(100,100,100);
            Form1.Image1.Canvas.Pen.width:=2;
            Form1.Image1.Canvas.Rectangle(600,18,700-1,19);

            Form1.Image1.Canvas.Font.color:=RGB(200,0,0);
            Form1.Image1.Canvas.TextOut(460,25,'Accelaration Z');
            Form1.Image1.Canvas.Pen.color:=RGB(200,0,0);
            Form1.Image1.Canvas.Pen.width:=2;
            Form1.Image1.Canvas.Rectangle(600,32,700-1,33);

            Form1.Image1.Canvas.Font.color:=RGB(0,200,0);
            Form1.Image1.Canvas.TextOut(460,40,'Accelaration Y');
            Form1.Image1.Canvas.Pen.color:=RGB(0,200,0);
            Form1.Image1.Canvas.Pen.width:=2;
            Form1.Image1.Canvas.Rectangle(600,47,700-1,48);

            Form1.Image1.Canvas.Font.color:=RGB(0,0,200);
            Form1.Image1.Canvas.TextOut(460,55,'Accelaration X');
            Form1.Image1.Canvas.Pen.color:=RGB(0,0,200);
            Form1.Image1.Canvas.Pen.width:=2;
            Form1.Image1.Canvas.Rectangle(600,62,700-1,63);

{END OF COLOR GUIDE ----------------------------------------------------------------------------------------------------------------}

     For Pad:= 1 to 8 do
          For Button:= 1 to 300 do
               Distribution_Matrix[Button,Pad]:=0; {Zero Matrix, for sure ..}

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

          for Pad:= 0 to 7 do
              for Button:=0 to 23 do
                   Begin
                        Class_Distribution:=Trunc((Data_Matrix[20+Pad*24+Button]-Min)/((Max-Min)/300));
                        if (Class_Distribution<=0) then Class_Distribution:=1;
                        if (Class_Distribution>=300) then Class_Distribution:=300;
                        Distribution_Matrix[Class_Distribution,Pad+1]:=Distribution_Matrix[Class_Distribution,Pad+1]+1;
                   end;

          For Pad:= 1 to 8 do
              For n2:=1 to 300 do
                   Begin
                        Cumulative_Matrix[n2,Pad]:= Cumulative_Matrix[n2-1,Pad]+Distribution_Matrix[n2,Pad];
                   end;

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
                    {Max_R:=Distribution_Matrix[302,((Pad-20) div 24)+1];
                    Min_R:=Distribution_Matrix[301,((Pad-20) div 24)+1];}
                    Max_R:=Max;
                    Min_R:=Min;
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
                    {if RadioGroup2.Items. =true then
                         Begin
                              x:=8+(pad-20)*2;
                              form1.image1.Canvas.pixels[x,y]:=RGB(Red,Green,Blue);
                              form1.image1.Canvas.pixels[x+1,y]:=RGB(Red,Green,Blue);
                         end; }

                    {if radiobutton4.Checked=true then
                         Begin
                              x:=20+(pad-20)+((pad-20)div 24)*24;
                              form1.Image1.Canvas.pixels[x,y]:=RGB(Red,Green,Blue);
                         end; }
                    if Data_Matrix[14]>=360 then Data_Matrix[14]:=Data_Matrix[14]-360;
                    x:=20+(pad-20)+((pad-20)div 24)*24+Trunc(Data_Matrix[14]*1.06667);
                    if x>=400 then x:=x-400;
                    {if (((Pad-20) div 12) mod 2)=0 then x:=20+(pad-20)*2+((pad-20)div 24)*24;
                    if (((Pad-20) div 12) mod 2)=1 then x:=20+(pad-20-12)*2+1+((pad-20-12)div 24)*24;}

                    form1.Image1.Canvas.pixels[x,y]:=RGB(Red,Green,Blue);
                    If scale=5 then form1.Image1.Canvas.pixels[x,y+1]:=RGB(Red,Green,Blue);
               end;

               If Trunc(Data_Matrix[1]) mod Trunc(scale*10)=0 then
                    Begin
                         Form1.Image1.Canvas.Pen.color:=RGB(150,150,150);
                         Form1.Image1.Canvas.Pen.Width:=1;
                         Form1.Image1.Canvas.MoveTo(431,y);
                         Form1.Image1.Canvas.LineTo(435,y);
                         Form1.Image1.Canvas.Font.Size:=5;
                         Form1.Image1.Canvas.TextOut(402,y-5,FloatToStr(Data_Matrix[1]));
                    end;

               If Trunc(Data_Matrix[1]) mod 100=0 then
                    Begin
                         Form1.Image1.Canvas.Pen.color:=RGB(100,100,100);
                         Form1.Image1.Canvas.Pen.Width:=1;
                         Form1.Image1.Canvas.MoveTo(431,y);
                         Form1.Image1.Canvas.LineTo(439,y);
                    end;

               If Trunc(Data_Matrix[1]) mod 1000=0 then
                    Begin
                         Form1.Image1.Canvas.Pen.color:=RGB(0,0,0);
                         Form1.Image1.Canvas.Pen.Width:=1;
                         Form1.Image1.Canvas.MoveTo(431,y);
                         Form1.Image1.Canvas.LineTo(447,y);
                    end;

               Form1.Image1.Canvas.Pen.color:=RGB(100,100,100);
               Form1.Image1.Canvas.Pen.Width:=2;
               Form1.Image1.Canvas.MoveTo(450+Trunc(Resistivity_Sum_Previous/192/5),y-1);
               Form1.Image1.Canvas.LineTo(450+Trunc(Resistivity_Sum_Current/192/5),y);

               Form1.Image1.Canvas.Pen.color:=RGB(200,0,0);
               Form1.Image1.Canvas.Pen.Width:=1;
               Form1.Image1.Canvas.MoveTo(720+Trunc((AZ_Previous-9.2)*50),y-1);
               Form1.Image1.Canvas.LineTo(720+Trunc((AZ_Current-9.2)*50),y);

               Form1.Image1.Canvas.Pen.color:=RGB(0,200,0);
               Form1.Image1.Canvas.Pen.Width:=1;
               Form1.Image1.Canvas.MoveTo(720+Trunc((AY_Previous+9.8-9.2)*50),y-1);
               Form1.Image1.Canvas.LineTo(720+Trunc((AY_Current+9.8-9.2)*50),y);

               Form1.Image1.Canvas.Pen.color:=RGB(0,0,200);
               Form1.Image1.Canvas.Pen.Width:=1;
               Form1.Image1.Canvas.MoveTo(720+Trunc((AX_Previous+9.8-9.2)*50),y-1);
               Form1.Image1.Canvas.LineTo(720+Trunc((AX_Current+9.8-9.2)*50),y);

               Form1.Image1.Canvas.Pen.color:=RGB(150,50,200);
               Form1.Image1.Canvas.Pen.Width:=2;
               Form1.Image1.Canvas.MoveTo(450+Trunc(GR_Previous),y-1);
               Form1.Image1.Canvas.LineTo(450+Trunc(GR_Current),y);

               Progressbar2.Position:=Trunc(100*(Start_Depth-Data_Matrix[1])/(Start_Depth-Stop_Depth));
     until (Data_Matrix[1]<=Stop_Depth+6);
     memo1.lines.add('*** Raw Image Log Plotting Completed ...');
     For Loop:= 1 to 300 do
          Begin
               Cumulative:=Cumulative_Matrix[Loop,1] + Cumulative_Matrix[Loop-1,2] + Cumulative_Matrix[Loop-1,3] + Cumulative_Matrix[Loop-1,4] + Cumulative_Matrix[Loop-1,5] + Cumulative_Matrix[Loop-1,6] + Cumulative_Matrix[Loop-1,7] + Cumulative_Matrix[Loop-1,8];
               if Cumulative < Trunc(0.95*Number_of_Data) then Max_R:=min+((max-min)/300)*loop;
               if Cumulative < Trunc(0.05*Number_of_Data) then Min_R:=min+((max-min)/300)*loop;
          end;
     Memo1.Lines.Add('Max_R '+FloatToStr(Max_R));
     Memo1.Lines.Add('Min_R '+FloatToStr(Min_R));
     memo1.lines.add('*** DATA ANALYZING Completed ...');
     Form1.Image2.Visible:=False;
     Form1.Image1.Visible:=True;


end;

procedure TForm7.FormClose(Sender: TObject; var Action: TCloseAction);
begin
     ProgressBar1.Position:=0;
     ProgressBar2.Position:=0;
     Memo1.Lines.Clear;

end;

end.
