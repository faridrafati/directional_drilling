unit Unit10;

interface

uses
  Windows, Messages, SysUtils, Variants, Classes, Graphics, Controls, Forms,
  Dialogs, Menus, StdCtrls, ComCtrls;

type
  TForm10 = class(TForm)
    OpenDialog1: TOpenDialog;
    OpenDialog2: TOpenDialog;
    Button1: TButton;
    Button2: TButton;
    Edit1: TEdit;
    Edit2: TEdit;
    ProgressBar1: TProgressBar;
    Button3: TButton;
    Label1: TLabel;
    Label2: TLabel;
    Edit3: TEdit;
    Label3: TLabel;
    SaveDialog1: TSaveDialog;
    Button4: TButton;
    Memo1: TMemo;
    procedure Button3Click(Sender: TObject);
    procedure Button4Click(Sender: TObject);
    procedure Button2Click(Sender: TObject);
    procedure Button1Click(Sender: TObject);
  private
    { Private declarations }
  public
    { Public declarations }
  end;

var
  Form10: TForm10;

implementation
uses
  main;
{$R *.dfm}

procedure TForm10.Button1Click(Sender: TObject);
begin
     If OpenDialog1.execute then
        Begin
           edit1.text := OpenDialog1.filename;
        End;
end;

procedure TForm10.Button2Click(Sender: TObject);
begin
     If OpenDialog2.execute then
        Begin
           edit2.text := OpenDialog2.filename;
        End;

end;

procedure TForm10.Button4Click(Sender: TObject);
begin
     If SaveDialog1.execute then
        Begin
           edit3.text := SaveDialog1.filename;
        End;
end;

procedure TForm10.Button3Click(Sender: TObject);
var
     loop,pad,n, Number_of_Curves1, Number_of_Curves2, x :integer;
     Data, Depth1, Depth2A, Depth2B, Start_Depth_Merge, Stop_Depth_Merge, Step_Depth_Merge :real;
     Hi_Res_File, Lo_Res_File, Save_File :TextFile;
     Data_String, Read_Text, S, Curve_Name, Data_str, Start_Depth_Unit_Merge, Stop_Depth_Unit_Merge, Start_Depth_str_Merge, Stop_Depth_str_Merge, Step_Depth_str_Merge, Step_Depth_Unit_Merge :string;
begin

{COPY HEADER OF HIGH RESOLUTION FILE ON THE HEAD OF MERGED FILE ------------------------------------------------------------}
     AssignFile (Hi_Res_File,OpenDialog1.FileName);
     Reset(Hi_Res_File);
     AssignFile (Save_File, SaveDialog1.FileName);
     Rewrite (Save_File);
     repeat Readln(Hi_Res_File,Read_Text); S:=Copy(Read_Text,0,2); Writeln(Save_File,Read_Text); until (S='~C');
     Readln(Hi_Res_File,Read_Text); Writeln(Save_File,Read_Text);
     Readln(Hi_Res_File,Read_Text); Writeln(Save_File,Read_Text);
     Writeln(Save_File,'TDEP      ..1in                                   :BOREHOLE-DEPTH');
     Writeln(Save_File,'TIME      .ms                                     :0.1 Inch River Time Index');
     Writeln(Save_File,'EV        .V                                      :Emex Voltage');
     Writeln(Save_File,'FCAX      .m/s2                                   :High Resolution X Acceleration');
     Writeln(Save_File,'FCAY      .m/s2                                   :High Resolution Y Acceleration');
     Writeln(Save_File,'FCAZ      .m/s2                                   :High Resolution Z Acceleration');
     Writeln(Save_File,'FTIM      .ms                                     :Fast Channels Acquisition Time');
     Writeln(Save_File,'CS        .ft/h                                   :Cable Speed');
     Writeln(Save_File,'CVEL      .ft/min                                 :Cable Velocity');
     Writeln(Save_File,'TENS      .lbf                                    :Cable Tension');
     Writeln(Save_File,'ETIM      .s                                      :Elapsed Logging Time');
     Writeln(Save_File,'DEVI      .deg                                    :Deviation');
     Writeln(Save_File,'ANOR      .m/s2                                   :Acceleration Computed Norm');
     Writeln(Save_File,'P1AZ      .deg                                    :Pad 1 Azimuth');
     Writeln(Save_File,'EI        .mA                                     :EMEX current');
     Writeln(Save_File,'GR        .gAPI                                   :Gamma Ray');
     Writeln(Save_File,'FCD4[0]   .                                       :FMI Buttons, Pad D, Row #4');
     Writeln(Save_File,'FCD4[1]   .                                       :FMI Buttons, Pad D, Row #4');
     Writeln(Save_File,'FCD4[2]   .                                       :FMI Buttons, Pad D, Row #4');
     Writeln(Save_File,'FCD4[3]   .                                       :FMI Buttons, Pad D, Row #4');
     Writeln(Save_File,'FCD4[4]   .                                       :FMI Buttons, Pad D, Row #4');
     Writeln(Save_File,'FCD4[5]   .                                       :FMI Buttons, Pad D, Row #4');
     Writeln(Save_File,'FCD4[6]   .                                       :FMI Buttons, Pad D, Row #4');
     Writeln(Save_File,'FCD4[7]   .                                       :FMI Buttons, Pad D, Row #4');
     Writeln(Save_File,'FCD4[8]   .                                       :FMI Buttons, Pad D, Row #4');
     Writeln(Save_File,'FCD4[9]   .                                       :FMI Buttons, Pad D, Row #4');
     Writeln(Save_File,'FCD4[10]  .                                       :FMI Buttons, Pad D, Row #4');
     Writeln(Save_File,'FCD4[11]  .                                       :FMI Buttons, Pad D, Row #4');
     Writeln(Save_File,'FCD3[0]   .                                       :FMI Buttons, Pad D, Row #3');
     Writeln(Save_File,'FCD3[1]   .                                       :FMI Buttons, Pad D, Row #3');
     Writeln(Save_File,'FCD3[2]   .                                       :FMI Buttons, Pad D, Row #3');
     Writeln(Save_File,'FCD3[3]   .                                       :FMI Buttons, Pad D, Row #3');
     Writeln(Save_File,'FCD3[4]   .                                       :FMI Buttons, Pad D, Row #3');
     Writeln(Save_File,'FCD3[5]   .                                       :FMI Buttons, Pad D, Row #3');
     Writeln(Save_File,'FCD3[6]   .                                       :FMI Buttons, Pad D, Row #3');
     Writeln(Save_File,'FCD3[7]   .                                       :FMI Buttons, Pad D, Row #3');
     Writeln(Save_File,'FCD3[8]   .                                       :FMI Buttons, Pad D, Row #3');
     Writeln(Save_File,'FCD3[9]   .                                       :FMI Buttons, Pad D, Row #3');
     Writeln(Save_File,'FCD3[10]  .                                       :FMI Buttons, Pad D, Row #3');
     Writeln(Save_File,'FCD3[11]  .                                       :FMI Buttons, Pad D, Row #3');
     Writeln(Save_File,'FCD2[0]   .                                       :FMI Buttons, Pad D, Row #2');
     Writeln(Save_File,'FCD2[1]   .                                       :FMI Buttons, Pad D, Row #2');
     Writeln(Save_File,'FCD2[2]   .                                       :FMI Buttons, Pad D, Row #2');
     Writeln(Save_File,'FCD2[3]   .                                       :FMI Buttons, Pad D, Row #2');
     Writeln(Save_File,'FCD2[4]   .                                       :FMI Buttons, Pad D, Row #2');
     Writeln(Save_File,'FCD2[5]   .                                       :FMI Buttons, Pad D, Row #2');
     Writeln(Save_File,'FCD2[6]   .                                       :FMI Buttons, Pad D, Row #2');
     Writeln(Save_File,'FCD2[7]   .                                       :FMI Buttons, Pad D, Row #2');
     Writeln(Save_File,'FCD2[8]   .                                       :FMI Buttons, Pad D, Row #2');
     Writeln(Save_File,'FCD2[9]   .                                       :FMI Buttons, Pad D, Row #2');
     Writeln(Save_File,'FCD2[10]  .                                       :FMI Buttons, Pad D, Row #2');
     Writeln(Save_File,'FCD2[11]  .                                       :FMI Buttons, Pad D, Row #2');
     Writeln(Save_File,'FCD1[0]   .                                       :FMI Buttons, Pad D, Row #1');
     Writeln(Save_File,'FCD1[1]   .                                       :FMI Buttons, Pad D, Row #1');
     Writeln(Save_File,'FCD1[2]   .                                       :FMI Buttons, Pad D, Row #1');
     Writeln(Save_File,'FCD1[3]   .                                       :FMI Buttons, Pad D, Row #1');
     Writeln(Save_File,'FCD1[4]   .                                       :FMI Buttons, Pad D, Row #1');
     Writeln(Save_File,'FCD1[5]   .                                       :FMI Buttons, Pad D, Row #1');
     Writeln(Save_File,'FCD1[6]   .                                       :FMI Buttons, Pad D, Row #1');
     Writeln(Save_File,'FCD1[7]   .                                       :FMI Buttons, Pad D, Row #1');
     Writeln(Save_File,'FCD1[8]   .                                       :FMI Buttons, Pad D, Row #1');
     Writeln(Save_File,'FCD1[9]   .                                       :FMI Buttons, Pad D, Row #1');
     Writeln(Save_File,'FCD1[10]  .                                       :FMI Buttons, Pad D, Row #1');
     Writeln(Save_File,'FCD1[11]  .                                       :FMI Buttons, Pad D, Row #1');
     Writeln(Save_File,'FCC4[0]   .                                       :FMI Buttons, Pad C, Row #4');
     Writeln(Save_File,'FCC4[1]   .                                       :FMI Buttons, Pad C, Row #4');
     Writeln(Save_File,'FCC4[2]   .                                       :FMI Buttons, Pad C, Row #4');
     Writeln(Save_File,'FCC4[3]   .                                       :FMI Buttons, Pad C, Row #4');
     Writeln(Save_File,'FCC4[4]   .                                       :FMI Buttons, Pad C, Row #4');
     Writeln(Save_File,'FCC4[5]   .                                       :FMI Buttons, Pad C, Row #4');
     Writeln(Save_File,'FCC4[6]   .                                       :FMI Buttons, Pad C, Row #4');
     Writeln(Save_File,'FCC4[7]   .                                       :FMI Buttons, Pad C, Row #4');
     Writeln(Save_File,'FCC4[8]   .                                       :FMI Buttons, Pad C, Row #4');
     Writeln(Save_File,'FCC4[9]   .                                       :FMI Buttons, Pad C, Row #4');
     Writeln(Save_File,'FCC4[10]  .                                       :FMI Buttons, Pad C, Row #4');
     Writeln(Save_File,'FCC4[11]  .                                       :FMI Buttons, Pad C, Row #4');
     Writeln(Save_File,'FCC3[0]   .                                       :FMI Buttons, Pad C, Row #3');
     Writeln(Save_File,'FCC3[1]   .                                       :FMI Buttons, Pad C, Row #3');
     Writeln(Save_File,'FCC3[2]   .                                       :FMI Buttons, Pad C, Row #3');
     Writeln(Save_File,'FCC3[3]   .                                       :FMI Buttons, Pad C, Row #3');
     Writeln(Save_File,'FCC3[4]   .                                       :FMI Buttons, Pad C, Row #3');
     Writeln(Save_File,'FCC3[5]   .                                       :FMI Buttons, Pad C, Row #3');
     Writeln(Save_File,'FCC3[6]   .                                       :FMI Buttons, Pad C, Row #3');
     Writeln(Save_File,'FCC3[7]   .                                       :FMI Buttons, Pad C, Row #3');
     Writeln(Save_File,'FCC3[8]   .                                       :FMI Buttons, Pad C, Row #3');
     Writeln(Save_File,'FCC3[9]   .                                       :FMI Buttons, Pad C, Row #3');
     Writeln(Save_File,'FCC3[10]  .                                       :FMI Buttons, Pad C, Row #3');
     Writeln(Save_File,'FCC3[11]  .                                       :FMI Buttons, Pad C, Row #3');
     Writeln(Save_File,'FCC2[0]   .                                       :FMI Buttons, Pad C, Row #2');
     Writeln(Save_File,'FCC2[1]   .                                       :FMI Buttons, Pad C, Row #2');
     Writeln(Save_File,'FCC2[2]   .                                       :FMI Buttons, Pad C, Row #2');
     Writeln(Save_File,'FCC2[3]   .                                       :FMI Buttons, Pad C, Row #2');
     Writeln(Save_File,'FCC2[4]   .                                       :FMI Buttons, Pad C, Row #2');
     Writeln(Save_File,'FCC2[5]   .                                       :FMI Buttons, Pad C, Row #2');
     Writeln(Save_File,'FCC2[6]   .                                       :FMI Buttons, Pad C, Row #2');
     Writeln(Save_File,'FCC2[7]   .                                       :FMI Buttons, Pad C, Row #2');
     Writeln(Save_File,'FCC2[8]   .                                       :FMI Buttons, Pad C, Row #2');
     Writeln(Save_File,'FCC2[9]   .                                       :FMI Buttons, Pad C, Row #2');
     Writeln(Save_File,'FCC2[10]  .                                       :FMI Buttons, Pad C, Row #2');
     Writeln(Save_File,'FCC2[11]  .                                       :FMI Buttons, Pad C, Row #2');
     Writeln(Save_File,'FCC1[0]   .                                       :FMI Buttons, Pad C, Row #1');
     Writeln(Save_File,'FCC1[1]   .                                       :FMI Buttons, Pad C, Row #1');
     Writeln(Save_File,'FCC1[2]   .                                       :FMI Buttons, Pad C, Row #1');
     Writeln(Save_File,'FCC1[3]   .                                       :FMI Buttons, Pad C, Row #1');
     Writeln(Save_File,'FCC1[4]   .                                       :FMI Buttons, Pad C, Row #1');
     Writeln(Save_File,'FCC1[5]   .                                       :FMI Buttons, Pad C, Row #1');
     Writeln(Save_File,'FCC1[6]   .                                       :FMI Buttons, Pad C, Row #1');
     Writeln(Save_File,'FCC1[7]   .                                       :FMI Buttons, Pad C, Row #1');
     Writeln(Save_File,'FCC1[8]   .                                       :FMI Buttons, Pad C, Row #1');
     Writeln(Save_File,'FCC1[9]   .                                       :FMI Buttons, Pad C, Row #1');
     Writeln(Save_File,'FCC1[10]  .                                       :FMI Buttons, Pad C, Row #1');
     Writeln(Save_File,'FCC1[11]  .                                       :FMI Buttons, Pad C, Row #1');
     Writeln(Save_File,'FCB4[0]   .                                       :FMI Buttons, Pad B, Row #4');
     Writeln(Save_File,'FCB4[1]   .                                       :FMI Buttons, Pad B, Row #4');
     Writeln(Save_File,'FCB4[2]   .                                       :FMI Buttons, Pad B, Row #4');
     Writeln(Save_File,'FCB4[3]   .                                       :FMI Buttons, Pad B, Row #4');
     Writeln(Save_File,'FCB4[4]   .                                       :FMI Buttons, Pad B, Row #4');
     Writeln(Save_File,'FCB4[5]   .                                       :FMI Buttons, Pad B, Row #4');
     Writeln(Save_File,'FCB4[6]   .                                       :FMI Buttons, Pad B, Row #4');
     Writeln(Save_File,'FCB4[7]   .                                       :FMI Buttons, Pad B, Row #4');
     Writeln(Save_File,'FCB4[8]   .                                       :FMI Buttons, Pad B, Row #4');
     Writeln(Save_File,'FCB4[9]   .                                       :FMI Buttons, Pad B, Row #4');
     Writeln(Save_File,'FCB4[10]  .                                       :FMI Buttons, Pad B, Row #4');
     Writeln(Save_File,'FCB4[11]  .                                       :FMI Buttons, Pad B, Row #4');
     Writeln(Save_File,'FCB3[0]   .                                       :FMI Buttons, Pad B, Row #3');
     Writeln(Save_File,'FCB3[1]   .                                       :FMI Buttons, Pad B, Row #3');
     Writeln(Save_File,'FCB3[2]   .                                       :FMI Buttons, Pad B, Row #3');
     Writeln(Save_File,'FCB3[3]   .                                       :FMI Buttons, Pad B, Row #3');
     Writeln(Save_File,'FCB3[4]   .                                       :FMI Buttons, Pad B, Row #3');
     Writeln(Save_File,'FCB3[5]   .                                       :FMI Buttons, Pad B, Row #3');
     Writeln(Save_File,'FCB3[6]   .                                       :FMI Buttons, Pad B, Row #3');
     Writeln(Save_File,'FCB3[7]   .                                       :FMI Buttons, Pad B, Row #3');
     Writeln(Save_File,'FCB3[8]   .                                       :FMI Buttons, Pad B, Row #3');
     Writeln(Save_File,'FCB3[9]   .                                       :FMI Buttons, Pad B, Row #3');
     Writeln(Save_File,'FCB3[10]  .                                       :FMI Buttons, Pad B, Row #3');
     Writeln(Save_File,'FCB3[11]  .                                       :FMI Buttons, Pad B, Row #3');
     Writeln(Save_File,'FCB2[0]   .                                       :FMI Buttons, Pad B, Row #2');
     Writeln(Save_File,'FCB2[1]   .                                       :FMI Buttons, Pad B, Row #2');
     Writeln(Save_File,'FCB2[2]   .                                       :FMI Buttons, Pad B, Row #2');
     Writeln(Save_File,'FCB2[3]   .                                       :FMI Buttons, Pad B, Row #2');
     Writeln(Save_File,'FCB2[4]   .                                       :FMI Buttons, Pad B, Row #2');
     Writeln(Save_File,'FCB2[5]   .                                       :FMI Buttons, Pad B, Row #2');
     Writeln(Save_File,'FCB2[6]   .                                       :FMI Buttons, Pad B, Row #2');
     Writeln(Save_File,'FCB2[7]   .                                       :FMI Buttons, Pad B, Row #2');
     Writeln(Save_File,'FCB2[8]   .                                       :FMI Buttons, Pad B, Row #2');
     Writeln(Save_File,'FCB2[9]   .                                       :FMI Buttons, Pad B, Row #2');
     Writeln(Save_File,'FCB2[10]  .                                       :FMI Buttons, Pad B, Row #2');
     Writeln(Save_File,'FCB2[11]  .                                       :FMI Buttons, Pad B, Row #2');
     Writeln(Save_File,'FCB1[0]   .                                       :FMI Buttons, Pad B, Row #1');
     Writeln(Save_File,'FCB1[1]   .                                       :FMI Buttons, Pad B, Row #1');
     Writeln(Save_File,'FCB1[2]   .                                       :FMI Buttons, Pad B, Row #1');
     Writeln(Save_File,'FCB1[3]   .                                       :FMI Buttons, Pad B, Row #1');
     Writeln(Save_File,'FCB1[4]   .                                       :FMI Buttons, Pad B, Row #1');
     Writeln(Save_File,'FCB1[5]   .                                       :FMI Buttons, Pad B, Row #1');
     Writeln(Save_File,'FCB1[6]   .                                       :FMI Buttons, Pad B, Row #1');
     Writeln(Save_File,'FCB1[7]   .                                       :FMI Buttons, Pad B, Row #1');
     Writeln(Save_File,'FCB1[8]   .                                       :FMI Buttons, Pad B, Row #1');
     Writeln(Save_File,'FCB1[9]   .                                       :FMI Buttons, Pad B, Row #1');
     Writeln(Save_File,'FCB1[10]  .                                       :FMI Buttons, Pad B, Row #1');
     Writeln(Save_File,'FCB1[11]  .                                       :FMI Buttons, Pad B, Row #1');
     Writeln(Save_File,'FCA4[0]   .                                       :FMI Buttons, Pad A, Row #4');
     Writeln(Save_File,'FCA4[1]   .                                       :FMI Buttons, Pad A, Row #4');
     Writeln(Save_File,'FCA4[2]   .                                       :FMI Buttons, Pad A, Row #4');
     Writeln(Save_File,'FCA4[3]   .                                       :FMI Buttons, Pad A, Row #4');
     Writeln(Save_File,'FCA4[4]   .                                       :FMI Buttons, Pad A, Row #4');
     Writeln(Save_File,'FCA4[5]   .                                       :FMI Buttons, Pad A, Row #4');
     Writeln(Save_File,'FCA4[6]   .                                       :FMI Buttons, Pad A, Row #4');
     Writeln(Save_File,'FCA4[7]   .                                       :FMI Buttons, Pad A, Row #4');
     Writeln(Save_File,'FCA4[8]   .                                       :FMI Buttons, Pad A, Row #4');
     Writeln(Save_File,'FCA4[9]   .                                       :FMI Buttons, Pad A, Row #4');
     Writeln(Save_File,'FCA4[10]  .                                       :FMI Buttons, Pad A, Row #4');
     Writeln(Save_File,'FCA4[11]  .                                       :FMI Buttons, Pad A, Row #4');
     Writeln(Save_File,'FCA3[0]   .                                       :FMI Buttons, Pad A, Row #3');
     Writeln(Save_File,'FCA3[1]   .                                       :FMI Buttons, Pad A, Row #3');
     Writeln(Save_File,'FCA3[2]   .                                       :FMI Buttons, Pad A, Row #3');
     Writeln(Save_File,'FCA3[3]   .                                       :FMI Buttons, Pad A, Row #3');
     Writeln(Save_File,'FCA3[4]   .                                       :FMI Buttons, Pad A, Row #3');
     Writeln(Save_File,'FCA3[5]   .                                       :FMI Buttons, Pad A, Row #3');
     Writeln(Save_File,'FCA3[6]   .                                       :FMI Buttons, Pad A, Row #3');
     Writeln(Save_File,'FCA3[7]   .                                       :FMI Buttons, Pad A, Row #3');
     Writeln(Save_File,'FCA3[8]   .                                       :FMI Buttons, Pad A, Row #3');
     Writeln(Save_File,'FCA3[9]   .                                       :FMI Buttons, Pad A, Row #3');
     Writeln(Save_File,'FCA3[10]  .                                       :FMI Buttons, Pad A, Row #3');
     Writeln(Save_File,'FCA3[11]  .                                       :FMI Buttons, Pad A, Row #3');
     Writeln(Save_File,'FCA2[0]   .                                       :FMI Buttons, Pad A, Row #2');
     Writeln(Save_File,'FCA2[1]   .                                       :FMI Buttons, Pad A, Row #2');
     Writeln(Save_File,'FCA2[2]   .                                       :FMI Buttons, Pad A, Row #2');
     Writeln(Save_File,'FCA2[3]   .                                       :FMI Buttons, Pad A, Row #2');
     Writeln(Save_File,'FCA2[4]   .                                       :FMI Buttons, Pad A, Row #2');
     Writeln(Save_File,'FCA2[5]   .                                       :FMI Buttons, Pad A, Row #2');
     Writeln(Save_File,'FCA2[6]   .                                       :FMI Buttons, Pad A, Row #2');
     Writeln(Save_File,'FCA2[7]   .                                       :FMI Buttons, Pad A, Row #2');
     Writeln(Save_File,'FCA2[8]   .                                       :FMI Buttons, Pad A, Row #2');
     Writeln(Save_File,'FCA2[9]   .                                       :FMI Buttons, Pad A, Row #2');
     Writeln(Save_File,'FCA2[10]  .                                       :FMI Buttons, Pad A, Row #2');
     Writeln(Save_File,'FCA2[11]  .                                       :FMI Buttons, Pad A, Row #2');
     Writeln(Save_File,'FCA1[0]   .                                       :FMI Buttons, Pad A, Row #1');
     Writeln(Save_File,'FCA1[1]   .                                       :FMI Buttons, Pad A, Row #1');
     Writeln(Save_File,'FCA1[2]   .                                       :FMI Buttons, Pad A, Row #1');
     Writeln(Save_File,'FCA1[3]   .                                       :FMI Buttons, Pad A, Row #1');
     Writeln(Save_File,'FCA1[4]   .                                       :FMI Buttons, Pad A, Row #1');
     Writeln(Save_File,'FCA1[5]   .                                       :FMI Buttons, Pad A, Row #1');
     Writeln(Save_File,'FCA1[6]   .                                       :FMI Buttons, Pad A, Row #1');
     Writeln(Save_File,'FCA1[7]   .                                       :FMI Buttons, Pad A, Row #1');
     Writeln(Save_File,'FCA1[8]   .                                       :FMI Buttons, Pad A, Row #1');
     Writeln(Save_File,'FCA1[9]   .                                       :FMI Buttons, Pad A, Row #1');
     Writeln(Save_File,'FCA1[10]  .                                       :FMI Buttons, Pad A, Row #1');
     Writeln(Save_File,'FCA1[11]  .                                       :FMI Buttons, Pad A, Row #1');
     Writeln(Save_File,'#--------------------------------------------------');
     Writeln(Save_File,'~A');

{START OF SEARCHING AND ASSIGNING FOR START DEPTH UNIT ----------------------------------------------------------------------------}
     Reset(Hi_Res_File);
     repeat Readln(Hi_Res_File,Read_Text); S:=Copy(Read_Text,0,4); until(S='STRT') or (S=' STR');
     n:=4;
     repeat n:=n+1; S:=Copy(Read_Text,n,1); until (S='.');
     n:=n+1;                 {Because of avoid '.' in Start_Depth_Unit}
     S:=Copy(Read_Text,n,1); {Because of avoid '.' in Start_Depth_Unit}
     repeat
          Start_Depth_Unit_Merge:=Start_Depth_Unit_Merge+S;
          n:=n+1;
          S:=Copy(Read_Text,n,1);
     until (S=' ');
{END OF SEARCHING AND ASSIGNING FOR START DEPTH UNIT ----------------------------------------------------------------------------}

{START OF SEARCHING AND ASSIGNING FOR START DEPTH ----------------------------------------------------------------------------}
     repeat n:=n+1; S:=Copy(Read_Text,n,1); until (S<>' ');
     repeat
          Start_Depth_str_Merge:=Start_Depth_str_Merge+S;
          n:=n+1;
          S:=Copy(Read_Text,n,1);
     until (S=' ');
     Start_Depth_Merge:=StrToFloat(Start_Depth_str_Merge);
{END OF SEARCHING AND ASSIGNING FOR START DEPTH ----------------------------------------------------------------------------}

{START OF SEARCHING AND ASSIGNING FOR STOP DEPTH UNIT ----------------------------------------------------------------------------}
     repeat Readln(Hi_Res_File,Read_Text); S:=Copy(Read_Text,0,4); until(S='STOP') or (S=' STO');
     n:=4;
     repeat n:=n+1; S:=Copy(Read_Text,n,1); until (S='.');
     n:=n+1;                 {Because of avoid '.' in Start_Depth_Unit}
     S:=Copy(Read_Text,n,1); {Because of avoid '.' in Start_Depth_Unit}
     repeat
          Stop_Depth_Unit_Merge:=Stop_Depth_Unit_Merge+S;
          n:=n+1;
          S:=Copy(Read_Text,n,1);
     until (S=' ');
{END OF SEARCHING AND ASSIGNING FOR STOP DEPTH UNIT ----------------------------------------------------------------------------}

{START OF SEARCHING AND ASSIGNING FOR STOP DEPTH ----------------------------------------------------------------------------}
     repeat n:=n+1; S:=Copy(Read_Text,n,1); until (S<>' ');
     repeat
          Stop_Depth_str_Merge:=Stop_Depth_str_Merge+S;
          n:=n+1;
          S:=Copy(Read_Text,n,1);
     until (S=' ');
     Stop_Depth_Merge:=StrToFloat(Stop_Depth_str_Merge);
{END OF SEARCHING AND ASSIGNING FOR STOP DEPTH ----------------------------------------------------------------------------}

{START OF SEARCHING AND ASSIGNING FOR STEP DEPTH UNIT ----------------------------------------------------------------------------}
     repeat Readln(Hi_Res_File,Read_Text); S:=Copy(Read_Text,0,4); until(S='STEP') or (S=' STE');
     n:=4;
     repeat n:=n+1; S:=Copy(Read_Text,n,1); until (S='.');
     n:=n+1;                 {Because of avoid '.' in Start_Depth_Unit}
     S:=Copy(Read_Text,n,1); {Because of avoid '.' in Start_Depth_Unit}
     repeat
          Step_Depth_Unit_Merge:=Step_Depth_Unit_Merge+S;
          n:=n+1;
          S:=Copy(Read_Text,n,1);
     until (S=' ');
{END OF SEARCHING AND ASSIGNING FOR STEP DEPTH UNIT ----------------------------------------------------------------------------}

{START OF SEARCHING AND ASSIGNING FOR STEP DEPTH ----------------------------------------------------------------------------}
     repeat n:=n+1; S:=Copy(Read_Text,n,1); until (S<>' ');
     repeat
          Step_Depth_str_Merge:=Step_Depth_str_Merge+S;
          n:=n+1;
          S:=Copy(Read_Text,n,1);
     until (S=' ');
     Step_Depth_Merge:=StrToFloat(Step_Depth_str_Merge);
{END OF SEARCHING AND ASSIGNING FOR STEP DEPTH ----------------------------------------------------------------------------}


{SET ALL MATRICES EQUAL TO ZERO ----------------------------------------------------------------------------------------}
     For loop:= 1 to 211 do Data_Matrix[loop]:=0; {Zero Matrix, for sure ..}
     For loop:= 1 to 1000 do Position_Matrix[loop]:=0; {Zero Matrix, for sure ..}

     Number_of_Data:=0;

{START OF DETERMINING AND SETTING POSITION OF CURVES IN HIGH RESOLUTION FILE ---------------------------------------------------------------------------------------------}
     Reset(Hi_Res_File);
     repeat Readln(Hi_Res_File,Read_Text); S:=Copy(Read_Text,0,2); until(S='~C');
     repeat Readln(Hi_Res_File,Read_Text); S:=Copy(Read_Text,0,1); until(S<>'#');
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
         If Curve_Name= 'FCD4[0] ' then Position_Matrix[n]:=20;
         If Curve_Name= 'FCD4[1] ' then Position_Matrix[n]:=21;
         If Curve_Name= 'FCD4[2] ' then Position_Matrix[n]:=22;
         If Curve_Name= 'FCD4[3] ' then Position_Matrix[n]:=23;
         If Curve_Name= 'FCD4[4] ' then Position_Matrix[n]:=24;
         If Curve_Name= 'FCD4[5] ' then Position_Matrix[n]:=25;
         If Curve_Name= 'FCD4[6] ' then Position_Matrix[n]:=26;
         If Curve_Name= 'FCD4[7] ' then Position_Matrix[n]:=27;
         If Curve_Name= 'FCD4[8] ' then Position_Matrix[n]:=28;
         If Curve_Name= 'FCD4[9] ' then Position_Matrix[n]:=29;
         If Curve_Name= 'FCD4[10]' then Position_Matrix[n]:=30;
         If Curve_Name= 'FCD4[11]' then Position_Matrix[n]:=31;
         If Curve_Name= 'FCD3[0] ' then Position_Matrix[n]:=32;
         If Curve_Name= 'FCD3[1] ' then Position_Matrix[n]:=33;
         If Curve_Name= 'FCD3[2] ' then Position_Matrix[n]:=34;
         If Curve_Name= 'FCD3[3] ' then Position_Matrix[n]:=35;
         If Curve_Name= 'FCD3[4] ' then Position_Matrix[n]:=36;
         If Curve_Name= 'FCD3[5] ' then Position_Matrix[n]:=37;
         If Curve_Name= 'FCD3[6] ' then Position_Matrix[n]:=38;
         If Curve_Name= 'FCD3[7] ' then Position_Matrix[n]:=39;
         If Curve_Name= 'FCD3[8] ' then Position_Matrix[n]:=40;
         If Curve_Name= 'FCD3[9] ' then Position_Matrix[n]:=41;
         If Curve_Name= 'FCD3[10]' then Position_Matrix[n]:=42;
         If Curve_Name= 'FCD3[11]' then Position_Matrix[n]:=43;
         If Curve_Name= 'FCD2[0] ' then Position_Matrix[n]:=44;
         If Curve_Name= 'FCD2[1] ' then Position_Matrix[n]:=45;
         If Curve_Name= 'FCD2[2] ' then Position_Matrix[n]:=46;
         If Curve_Name= 'FCD2[3] ' then Position_Matrix[n]:=47;
         If Curve_Name= 'FCD2[4] ' then Position_Matrix[n]:=48;
         If Curve_Name= 'FCD2[5] ' then Position_Matrix[n]:=49;
         If Curve_Name= 'FCD2[6] ' then Position_Matrix[n]:=50;
         If Curve_Name= 'FCD2[7] ' then Position_Matrix[n]:=51;
         If Curve_Name= 'FCD2[8] ' then Position_Matrix[n]:=52;
         If Curve_Name= 'FCD2[9] ' then Position_Matrix[n]:=53;
         If Curve_Name= 'FCD2[10]' then Position_Matrix[n]:=54;
         If Curve_Name= 'FCD2[11]' then Position_Matrix[n]:=55;
         If Curve_Name= 'FCD1[0] ' then Position_Matrix[n]:=56;
         If Curve_Name= 'FCD1[1] ' then Position_Matrix[n]:=57;
         If Curve_Name= 'FCD1[2] ' then Position_Matrix[n]:=58;
         If Curve_Name= 'FCD1[3] ' then Position_Matrix[n]:=59;
         If Curve_Name= 'FCD1[4] ' then Position_Matrix[n]:=60;
         If Curve_Name= 'FCD1[5] ' then Position_Matrix[n]:=61;
         If Curve_Name= 'FCD1[6] ' then Position_Matrix[n]:=62;
         If Curve_Name= 'FCD1[7] ' then Position_Matrix[n]:=63;
         If Curve_Name= 'FCD1[8] ' then Position_Matrix[n]:=64;
         If Curve_Name= 'FCD1[9] ' then Position_Matrix[n]:=65;
         If Curve_Name= 'FCD1[10]' then Position_Matrix[n]:=66;
         If Curve_Name= 'FCD1[11]' then Position_Matrix[n]:=67;
         If Curve_Name= 'FCC4[0] ' then Position_Matrix[n]:=68;
         If Curve_Name= 'FCC4[1] ' then Position_Matrix[n]:=69;
         If Curve_Name= 'FCC4[2] ' then Position_Matrix[n]:=70;
         If Curve_Name= 'FCC4[3] ' then Position_Matrix[n]:=71;
         If Curve_Name= 'FCC4[4] ' then Position_Matrix[n]:=72;
         If Curve_Name= 'FCC4[5] ' then Position_Matrix[n]:=73;
         If Curve_Name= 'FCC4[6] ' then Position_Matrix[n]:=74;
         If Curve_Name= 'FCC4[7] ' then Position_Matrix[n]:=75;
         If Curve_Name= 'FCC4[8] ' then Position_Matrix[n]:=76;
         If Curve_Name= 'FCC4[9] ' then Position_Matrix[n]:=77;
         If Curve_Name= 'FCC4[10]' then Position_Matrix[n]:=78;
         If Curve_Name= 'FCC4[11]' then Position_Matrix[n]:=79;
         If Curve_Name= 'FCC3[0] ' then Position_Matrix[n]:=80;
         If Curve_Name= 'FCC3[1] ' then Position_Matrix[n]:=81;
         If Curve_Name= 'FCC3[2] ' then Position_Matrix[n]:=82;
         If Curve_Name= 'FCC3[3] ' then Position_Matrix[n]:=83;
         If Curve_Name= 'FCC3[4] ' then Position_Matrix[n]:=84;
         If Curve_Name= 'FCC3[5] ' then Position_Matrix[n]:=85;
         If Curve_Name= 'FCC3[6] ' then Position_Matrix[n]:=86;
         If Curve_Name= 'FCC3[7] ' then Position_Matrix[n]:=87;
         If Curve_Name= 'FCC3[8] ' then Position_Matrix[n]:=88;
         If Curve_Name= 'FCC3[9] ' then Position_Matrix[n]:=89;
         If Curve_Name= 'FCC3[10]' then Position_Matrix[n]:=90;
         If Curve_Name= 'FCC3[11]' then Position_Matrix[n]:=91;
         If Curve_Name= 'FCC2[0] ' then Position_Matrix[n]:=92;
         If Curve_Name= 'FCC2[1] ' then Position_Matrix[n]:=93;
         If Curve_Name= 'FCC2[2] ' then Position_Matrix[n]:=94;
         If Curve_Name= 'FCC2[3] ' then Position_Matrix[n]:=95;
         If Curve_Name= 'FCC2[4] ' then Position_Matrix[n]:=96;
         If Curve_Name= 'FCC2[5] ' then Position_Matrix[n]:=97;
         If Curve_Name= 'FCC2[6] ' then Position_Matrix[n]:=98;
         If Curve_Name= 'FCC2[7] ' then Position_Matrix[n]:=99;
         If Curve_Name= 'FCC2[8] ' then Position_Matrix[n]:=100;
         If Curve_Name= 'FCC2[9] ' then Position_Matrix[n]:=101;
         If Curve_Name= 'FCC2[10]' then Position_Matrix[n]:=102;
         If Curve_Name= 'FCC2[11]' then Position_Matrix[n]:=103;
         If Curve_Name= 'FCC1[0] ' then Position_Matrix[n]:=104;
         If Curve_Name= 'FCC1[1] ' then Position_Matrix[n]:=105;
         If Curve_Name= 'FCC1[2] ' then Position_Matrix[n]:=106;
         If Curve_Name= 'FCC1[3] ' then Position_Matrix[n]:=107;
         If Curve_Name= 'FCC1[4] ' then Position_Matrix[n]:=108;
         If Curve_Name= 'FCC1[5] ' then Position_Matrix[n]:=109;
         If Curve_Name= 'FCC1[6] ' then Position_Matrix[n]:=110;
         If Curve_Name= 'FCC1[7] ' then Position_Matrix[n]:=111;
         If Curve_Name= 'FCC1[8] ' then Position_Matrix[n]:=112;
         If Curve_Name= 'FCC1[9] ' then Position_Matrix[n]:=113;
         If Curve_Name= 'FCC1[10]' then Position_Matrix[n]:=114;
         If Curve_Name= 'FCC1[11]' then Position_Matrix[n]:=115;
         If Curve_Name= 'FCB4[0] ' then Position_Matrix[n]:=116;
         If Curve_Name= 'FCB4[1] ' then Position_Matrix[n]:=117;
         If Curve_Name= 'FCB4[2] ' then Position_Matrix[n]:=118;
         If Curve_Name= 'FCB4[3] ' then Position_Matrix[n]:=119;
         If Curve_Name= 'FCB4[4] ' then Position_Matrix[n]:=120;
         If Curve_Name= 'FCB4[5] ' then Position_Matrix[n]:=121;
         If Curve_Name= 'FCB4[6] ' then Position_Matrix[n]:=122;
         If Curve_Name= 'FCB4[7] ' then Position_Matrix[n]:=123;
         If Curve_Name= 'FCB4[8] ' then Position_Matrix[n]:=124;
         If Curve_Name= 'FCB4[9] ' then Position_Matrix[n]:=125;
         If Curve_Name= 'FCB4[10]' then Position_Matrix[n]:=126;
         If Curve_Name= 'FCB4[11]' then Position_Matrix[n]:=127;
         If Curve_Name= 'FCB3[0] ' then Position_Matrix[n]:=128;
         If Curve_Name= 'FCB3[1] ' then Position_Matrix[n]:=129;
         If Curve_Name= 'FCB3[2] ' then Position_Matrix[n]:=130;
         If Curve_Name= 'FCB3[3] ' then Position_Matrix[n]:=131;
         If Curve_Name= 'FCB3[4] ' then Position_Matrix[n]:=132;
         If Curve_Name= 'FCB3[5] ' then Position_Matrix[n]:=133;
         If Curve_Name= 'FCB3[6] ' then Position_Matrix[n]:=134;
         If Curve_Name= 'FCB3[7] ' then Position_Matrix[n]:=135;
         If Curve_Name= 'FCB3[8] ' then Position_Matrix[n]:=136;
         If Curve_Name= 'FCB3[9] ' then Position_Matrix[n]:=137;
         If Curve_Name= 'FCB3[10]' then Position_Matrix[n]:=138;
         If Curve_Name= 'FCB3[11]' then Position_Matrix[n]:=139;
         If Curve_Name= 'FCB2[0] ' then Position_Matrix[n]:=140;
         If Curve_Name= 'FCB2[1] ' then Position_Matrix[n]:=141;
         If Curve_Name= 'FCB2[2] ' then Position_Matrix[n]:=142;
         If Curve_Name= 'FCB2[3] ' then Position_Matrix[n]:=143;
         If Curve_Name= 'FCB2[4] ' then Position_Matrix[n]:=144;
         If Curve_Name= 'FCB2[5] ' then Position_Matrix[n]:=145;
         If Curve_Name= 'FCB2[6] ' then Position_Matrix[n]:=146;
         If Curve_Name= 'FCB2[7] ' then Position_Matrix[n]:=147;
         If Curve_Name= 'FCB2[8] ' then Position_Matrix[n]:=148;
         If Curve_Name= 'FCB2[9] ' then Position_Matrix[n]:=149;
         If Curve_Name= 'FCB2[10]' then Position_Matrix[n]:=150;
         If Curve_Name= 'FCB2[11]' then Position_Matrix[n]:=151;
         If Curve_Name= 'FCB1[0] ' then Position_Matrix[n]:=152;
         If Curve_Name= 'FCB1[1] ' then Position_Matrix[n]:=153;
         If Curve_Name= 'FCB1[2] ' then Position_Matrix[n]:=154;
         If Curve_Name= 'FCB1[3] ' then Position_Matrix[n]:=155;
         If Curve_Name= 'FCB1[4] ' then Position_Matrix[n]:=156;
         If Curve_Name= 'FCB1[5] ' then Position_Matrix[n]:=157;
         If Curve_Name= 'FCB1[6] ' then Position_Matrix[n]:=158;
         If Curve_Name= 'FCB1[7] ' then Position_Matrix[n]:=159;
         If Curve_Name= 'FCB1[8] ' then Position_Matrix[n]:=160;
         If Curve_Name= 'FCB1[9] ' then Position_Matrix[n]:=161;
         If Curve_Name= 'FCB1[10]' then Position_Matrix[n]:=162;
         If Curve_Name= 'FCB1[11]' then Position_Matrix[n]:=163;
         If Curve_Name= 'FCA4[0] ' then Position_Matrix[n]:=164;
         If Curve_Name= 'FCA4[1] ' then Position_Matrix[n]:=165;
         If Curve_Name= 'FCA4[2] ' then Position_Matrix[n]:=166;
         If Curve_Name= 'FCA4[3] ' then Position_Matrix[n]:=167;
         If Curve_Name= 'FCA4[4] ' then Position_Matrix[n]:=168;
         If Curve_Name= 'FCA4[5] ' then Position_Matrix[n]:=169;
         If Curve_Name= 'FCA4[6] ' then Position_Matrix[n]:=170;
         If Curve_Name= 'FCA4[7] ' then Position_Matrix[n]:=171;
         If Curve_Name= 'FCA4[8] ' then Position_Matrix[n]:=172;
         If Curve_Name= 'FCA4[9] ' then Position_Matrix[n]:=173;
         If Curve_Name= 'FCA4[10]' then Position_Matrix[n]:=174;
         If Curve_Name= 'FCA4[11]' then Position_Matrix[n]:=175;
         If Curve_Name= 'FCA3[0] ' then Position_Matrix[n]:=176;
         If Curve_Name= 'FCA3[1] ' then Position_Matrix[n]:=177;
         If Curve_Name= 'FCA3[2] ' then Position_Matrix[n]:=178;
         If Curve_Name= 'FCA3[3] ' then Position_Matrix[n]:=179;
         If Curve_Name= 'FCA3[4] ' then Position_Matrix[n]:=180;
         If Curve_Name= 'FCA3[5] ' then Position_Matrix[n]:=181;
         If Curve_Name= 'FCA3[6] ' then Position_Matrix[n]:=182;
         If Curve_Name= 'FCA3[7] ' then Position_Matrix[n]:=183;
         If Curve_Name= 'FCA3[8] ' then Position_Matrix[n]:=184;
         If Curve_Name= 'FCA3[9] ' then Position_Matrix[n]:=185;
         If Curve_Name= 'FCA3[10]' then Position_Matrix[n]:=186;
         If Curve_Name= 'FCA3[11]' then Position_Matrix[n]:=187;
         If Curve_Name= 'FCA2[0] ' then Position_Matrix[n]:=188;
         If Curve_Name= 'FCA2[1] ' then Position_Matrix[n]:=189;
         If Curve_Name= 'FCA2[2] ' then Position_Matrix[n]:=190;
         If Curve_Name= 'FCA2[3] ' then Position_Matrix[n]:=191;
         If Curve_Name= 'FCA2[4] ' then Position_Matrix[n]:=192;
         If Curve_Name= 'FCA2[5] ' then Position_Matrix[n]:=193;
         If Curve_Name= 'FCA2[6] ' then Position_Matrix[n]:=194;
         If Curve_Name= 'FCA2[7] ' then Position_Matrix[n]:=195;
         If Curve_Name= 'FCA2[8] ' then Position_Matrix[n]:=196;
         If Curve_Name= 'FCA2[9] ' then Position_Matrix[n]:=197;
         If Curve_Name= 'FCA2[10]' then Position_Matrix[n]:=198;
         If Curve_Name= 'FCA2[11]' then Position_Matrix[n]:=199;
         If Curve_Name= 'FCA1[0] ' then Position_Matrix[n]:=200;
         If Curve_Name= 'FCA1[1] ' then Position_Matrix[n]:=201;
         If Curve_Name= 'FCA1[2] ' then Position_Matrix[n]:=202;
         If Curve_Name= 'FCA1[3] ' then Position_Matrix[n]:=203;
         If Curve_Name= 'FCA1[4] ' then Position_Matrix[n]:=204;
         If Curve_Name= 'FCA1[5] ' then Position_Matrix[n]:=205;
         If Curve_Name= 'FCA1[6] ' then Position_Matrix[n]:=206;
         If Curve_Name= 'FCA1[7] ' then Position_Matrix[n]:=207;
         If Curve_Name= 'FCA1[8] ' then Position_Matrix[n]:=208;
         If Curve_Name= 'FCA1[9] ' then Position_Matrix[n]:=209;
         If Curve_Name= 'FCA1[10]' then Position_Matrix[n]:=210;
         If Curve_Name= 'FCA1[11]' then Position_Matrix[n]:=211;
         Readln(Hi_Res_File,Read_Text);
         S:=Copy(Read_Text,0,1);
     until(S='#');
{END OF DETERMINING AND SETTING POSITION OF CURVES IN HIGH RESOLUTION FILE ---------------------------------------------------------------------------------------------}

     Number_of_Curves1:=n;

{START OF DETERMINING AND SETTING POSITION OF CURVES IN LOW RESOLUTION FILE ---------------------------------------------------------------------------------------------}
     AssignFile (Lo_Res_File,form10.OpenDialog2.FileName);
     Reset(Lo_Res_File);
     repeat Readln(Lo_Res_File,Read_Text); S:=Copy(Read_Text,0,2); until(S='~C');
     repeat Readln(Lo_Res_File,Read_Text); S:=Copy(Read_Text,0,1); until(S<>'#');
     repeat
         n:=n+1;
         Curve_Name:=Copy(Read_Text,0,8);
         If Curve_Name= 'CS      ' then Position_Matrix[n]:=8;
         If Curve_Name= 'CVEL    ' then Position_Matrix[n]:=9;
         If Curve_Name= 'TENS    ' then Position_Matrix[n]:=10;
         If Curve_Name= 'ETIM    ' then Position_Matrix[n]:=11;
         If Curve_Name= 'DEVI    ' then Position_Matrix[n]:=12;
         If Curve_Name= 'ANOR    ' then Position_Matrix[n]:=13;
         If Curve_Name= 'P1AZ    ' then Position_Matrix[n]:=14;
         If Curve_Name= 'EI      ' then Position_Matrix[n]:=15;
         If Curve_Name= 'GR      ' then Position_Matrix[n]:=16;
         Readln(Lo_Res_File,Read_Text);
         S:=Copy(Read_Text,0,1);
     until(S='#');
{END OF DETERMINING AND SETTING POSITION OF CURVES IN HIGH RESOLUTION FILE ---------------------------------------------------------------------------------------------}

     Number_of_Curves2:=n-Number_of_Curves1;

{START OF SETTING HIGH AND LOW RESOLUTION IMAGE IN START POINT ---------------------------------------------------------------------------------------------}
     repeat Readln(Hi_Res_File,Read_Text); S:=Copy(Read_Text,0,2); until(S='~A');
     repeat Readln(Lo_Res_File,Read_Text); S:=Copy(Read_Text,0,2); until(S='~A');
     repeat
          Readln(Lo_Res_File,Read_Text);
          loop:=0;
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
          Depth2A:=StrToFloat(Data_str);
     until (Depth2A<=Start_Depth_Merge);
     repeat
          Readln(Lo_Res_File,Read_Text);
          loop:=0;
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
          Depth2B:=StrToFloat(Data_str);
          memo1.Lines.add(FloatToStr(Depth2A));
          memo1.Lines.add(FloatToStr(Depth2B));
{END OF SETTING HIGH AND LOW RESOLUTION IMAGE IN START POINT ---------------------------------------------------------------------------------------------}

{START OF MERGING TWO LOGS  ---------------------------------------------------------------------------------------------}
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
               Data_Matrix[Position_Matrix[Number_of_Curves1+n]]:=Data;
          until (n=Number_of_Curves2);
          Memo1.Lines.Add('s');
          repeat
               Readln(Hi_Res_File,Read_Text);
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
               until (n=Number_of_Curves1);
          Data_String:='';
          For x:=1 to 211 do If (x<>17) and (x<>18) and (x<>19) then Data_String:=Data_String+FloatToStr(Data_Matrix[x])+'   ';
          Writeln(Save_File,Data_String);
          until (Data_Matrix[1]<=Depth2B);
          Depth2A:=Depth2B;
     until (depth2B<=Stop_Depth_Merge);
{END OF MERGING TWO LOGS  ---------------------------------------------------------------------------------------------}



end;

end.
