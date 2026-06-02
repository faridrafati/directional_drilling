unit main;

interface

uses
  Windows, Messages, SysUtils, Classes, Graphics, Controls, Forms, Dialogs,
  Menus, StdCtrls, ComCtrls, ExtCtrls, jpeg, Buttons, Grids, ValEdit, ToolWin,
  ActnMan, ActnCtrls, ButtonGroup, ExtDlgs;



type
  TForm1 = class(TForm)
    MainMenu1: TMainMenu;
    Help1: TMenuItem;
    About1: TMenuItem;
    OpenDialog1: TOpenDialog;
    SaveDialog1: TSaveDialog;
    PrintDialog1: TPrintDialog;
    File4: TMenuItem;
    Exit5: TMenuItem;
    N6: TMenuItem;
    PrintSetup3: TMenuItem;
    Print3: TMenuItem;
    N7: TMenuItem;
    Save4: TMenuItem;
    Open4: TMenuItem;
    New4: TMenuItem;
    PrinterSetupDialog1: TPrinterSetupDialog;
    Image1: TImage;
    Label8: TLabel;
    Label2: TLabel;
    Image8: TImage;
    S1: TMenuItem;
    DataAnalyzer1: TMenuItem;
    Statistics1: TMenuItem;
    PreliminaryProcess1: TMenuItem;
    EnhancedProcess1: TMenuItem;
    Merge: TMenuItem;
    N1: TMenuItem;
    View1: TMenuItem;
    LogHeader1: TMenuItem;
    SavePictureDialog1: TSavePictureDialog;
    Image2: TImage;
    Button1: TButton;
    Button2: TButton;
    Button3: TButton;
    procedure Button3Click(Sender: TObject);
    procedure Button2Click(Sender: TObject);
    procedure LogHeader1Click(Sender: TObject);
    procedure MergeClick(Sender: TObject);
    procedure PreliminaryProcess1Click(Sender: TObject);
    procedure Statistics1Click(Sender: TObject);
    procedure DataAnalyzer1Click(Sender: TObject);
    procedure Exit2Click(Sender: TObject);
    procedure Open1Click(Sender: TObject);
    procedure Open4Click(Sender: TObject);
    procedure Print3Click(Sender: TObject);
    procedure Save4Click(Sender: TObject);
    procedure PrintSetup3Click(Sender: TObject);
    procedure Exit5Click(Sender: TObject);
    procedure OpenDialog1CanClose(Sender: TObject; var CanClose: Boolean);
    procedure FormCreate(Sender: TObject);
    procedure Graphic1Click(Sender: TObject);
    procedure Button1Click(Sender: TObject);
    procedure About1Click(Sender: TObject);
  private
    { Private declarations }
  public
    { Public declarations }
  end;

var
  Form1: TForm1;
  Start_Depth_str, Start_Depth_Unit, Stop_Depth_str, Stop_Depth_Unit, Step_Depth_Unit, Step_Depth_str, Null_Value_str, Company_Value_str :string;
  Start_Depth, Stop_Depth, Step_Depth, Null_Value, Max, Min :real;
  Number_of_Data, Number_of_Curves, Scale : Integer;
  Data_Matrix:array [1..211] of real;
  Position_Matrix:array [1..1000] of integer;
  Distribution_Matrix:array [1..302,1..8] of real;
  Cumulative_Matrix:array [1..302,1..8] of real;


implementation

uses Unit3, Unit4, Unit5, Unit6, Unit7, Unit8, Unit9, Unit10, Unit11;


{$R *.DFM}

procedure TForm1.Exit2Click(Sender: TObject);
begin
     Application.Terminate;
end;

procedure TForm1.Open1Click(Sender: TObject);
var
     InFile : TextFile;
     fname , InString : string;
begin
     If OpenDialog1.execute then
        Begin
           fname := OpenDialog1.filename;
        End;
end;

procedure TForm1.Open4Click(Sender: TObject);
var
     Fname : String;
     OpenFile : TextFile;

begin
     If OpenDialog1.Execute then
        Begin
           Fname := OpenDialog1.FileName;
        End;
end;

procedure TForm1.Print3Click(Sender: TObject);
begin
     If PrintDialog1.Execute then
        Begin
        End;
end;

procedure TForm1.Save4Click(Sender: TObject);
begin
     SavePictureDialog1.Execute;
     Form1.Image1.Picture.SaveToFile(SavePictureDialog1.FileName);
end;

procedure TForm1.PrintSetup3Click(Sender: TObject);
begin
     PrinterSetupDialog1.Execute;
end;

procedure TForm1.Exit5Click(Sender: TObject);
begin
     Application.Terminate;
end;

procedure TForm1.OpenDialog1CanClose(Sender: TObject;
  var CanClose: Boolean);
  var
      Read_Text, S, Speed :string;
      n, No_of_Pads :Integer;
      exit :boolean;
      Info_File :TextFile;
begin
     Form1.Caption := 'GEOMANCY Borehole Image Viewer      '+OpenDialog1.FileName;
     AssignFile (Info_File,OpenDialog1.FileName);
     Reset(Info_File);

     repeat
         Readln(Info_File,Read_Text);
         S:=Copy(Read_Text,0,4);
     until(S='STRT') or (S=' STR');

{START OF SEARCHING AND ASSIGNING FOR START DEPTH UNIT ----------------------------------------------------------------------------}
     n:=4;
     repeat
         n:=n+1;
         S:=Copy(Read_Text,n,1);
     until (S='.');
     n:=n+1;                 {Because of avoid '.' in Start_Depth_Unit}
     S:=Copy(Read_Text,n,1); {Because of avoid '.' in Start_Depth_Unit}
     repeat
         Start_Depth_Unit:=Start_Depth_Unit+S;
         n:=n+1;
         S:=Copy(Read_Text,n,1);
     until (S=' ');
{END OF SEARCHING AND ASSIGNING FOR START DEPTH UNIT ----------------------------------------------------------------------------}

{START OF SEARCHING AND ASSIGNING FOR START DEPTH ----------------------------------------------------------------------------}
     repeat
         n:=n+1;
         S:=Copy(Read_Text,n,1);
     until (S<>' ');
     repeat
         Start_Depth_str:=Start_Depth_str+S;
         n:=n+1;
         S:=Copy(Read_Text,n,1);
     until (S=' ');
     Start_Depth:=StrToFloat(Start_Depth_str);
{END OF SEARCHING AND ASSIGNING FOR START DEPTH ----------------------------------------------------------------------------}



     repeat
         Readln(Info_File,Read_Text);
         S:=Copy(Read_Text,0,4);
     until(S='STOP') or (S=' STO');

{START OF SEARCHING AND ASSIGNING FOR STOP DEPTH UNIT ----------------------------------------------------------------------------}
     n:=4;
     repeat
         n:=n+1;
         S:=Copy(Read_Text,n,1);
     until (S='.');
     n:=n+1;                 {Because of avoid '.' in Start_Depth_Unit}
     S:=Copy(Read_Text,n,1); {Because of avoid '.' in Start_Depth_Unit}
     repeat
         Stop_Depth_Unit:=Stop_Depth_Unit+S;
         n:=n+1;
         S:=Copy(Read_Text,n,1);
     until (S=' ');
{END OF SEARCHING AND ASSIGNING FOR STOP DEPTH UNIT ----------------------------------------------------------------------------}

{START OF SEARCHING AND ASSIGNING FOR STOP DEPTH ----------------------------------------------------------------------------}
     repeat
         n:=n+1;
         S:=Copy(Read_Text,n,1);
     until (S<>' ');
     repeat
         Stop_Depth_str:=Stop_Depth_str+S;
         n:=n+1;
         S:=Copy(Read_Text,n,1);
     until (S=' ');
     Stop_Depth:=StrToFloat(Stop_Depth_str);
{END OF SEARCHING AND ASSIGNING FOR STOP DEPTH ----------------------------------------------------------------------------}


     repeat
         Readln(Info_File,Read_Text);
         S:=Copy(Read_Text,0,4);
     until(S='STEP') or (S=' STE');

{START OF SEARCHING AND ASSIGNING FOR STEP DEPTH UNIT ----------------------------------------------------------------------------}
     n:=4;
     repeat
         n:=n+1;
         S:=Copy(Read_Text,n,1);
     until (S='.');
     n:=n+1;                 {Because of avoid '.' in Start_Depth_Unit}
     S:=Copy(Read_Text,n,1); {Because of avoid '.' in Start_Depth_Unit}
     repeat
         Step_Depth_Unit:=Step_Depth_Unit+S;
         n:=n+1;
         S:=Copy(Read_Text,n,1);
     until (S=' ');
{END OF SEARCHING AND ASSIGNING FOR STEP DEPTH UNIT ----------------------------------------------------------------------------}

{START OF SEARCHING AND ASSIGNING FOR STEP DEPTH ----------------------------------------------------------------------------}
     repeat
         n:=n+1;
         S:=Copy(Read_Text,n,1);
     until (S<>' ');
     repeat
         Step_Depth_str:=Step_Depth_str+S;
         n:=n+1;
         S:=Copy(Read_Text,n,1);
     until (S=' ');
     Step_Depth:=StrToFloat(Step_Depth_str);
{END OF SEARCHING AND ASSIGNING FOR STEP DEPTH ----------------------------------------------------------------------------}



     repeat
         Readln(Info_File,Read_Text);
         S:=Copy(Read_Text,0,4);
     until(S='NULL') or (S=' NUL');

{START OF SEARCHING AND ASSIGNING FOR Null Value ----------------------------------------------------------------------------}
     n:=4;
     repeat
         n:=n+1;
         S:=Copy(Read_Text,n,1);
     until (S='.');
     n:=n+1;                 {Because of avoid '.' in Start_Depth_Unit}
     S:=Copy(Read_Text,n,1); {Because of avoid '.' in Start_Depth_Unit}
     repeat
         n:=n+1;
         S:=Copy(Read_Text,n,1);
     until (S=' ');

     repeat
         n:=n+1;
         S:=Copy(Read_Text,n,1);
     until (S<>' ');
     repeat
         Null_Value_str:=Null_Value_str+S;
         n:=n+1;
         S:=Copy(Read_Text,n,1);
     until (S=' ');
     Null_Value:=StrToFloat(Null_Value_str);
{END OF SEARCHING AND ASSIGNING FOR Null Value ----------------------------------------------------------------------------}


     repeat
         Readln(Info_File,Read_Text);
         S:=Copy(Read_Text,0,4);
     until(S='COMP') or (S=' COM');

{START OF SEARCHING AND ASSIGNING FOR Company Value ----------------------------------------------------------------------------}
     n:=4;
     repeat
         n:=n+1;
         S:=Copy(Read_Text,n,1);
     until (S='.');
     n:=n+1;                 {Because of avoid '.' in Start_Depth_Unit}
     S:=Copy(Read_Text,n,1); {Because of avoid '.' in Start_Depth_Unit}
     repeat
         n:=n+1;
         S:=Copy(Read_Text,n,1);
     until (S=' ');

     repeat
         n:=n+1;
         S:=Copy(Read_Text,n,1);
     until (S<>' ');
     repeat
         Company_Value_str:=Company_Value_str+S;
         n:=n+1;
         S:=Copy(Read_Text,n,1);
     until (S=' ');
{END OF SEARCHING AND ASSIGNING FOR Company Value ----------------------------------------------------------------------------}


     form11.ValueListEditor1.Refresh;
     form11.ValueListEditor1.InsertRow('Start or Max Depth',FloatToStr(Start_Depth)+' ['+Start_Depth_Unit+']',True);
     form11.ValueListEditor1.InsertRow('Stop or Min Depth',FloatToStr(Stop_Depth)+' ['+Stop_Depth_Unit+']',True);
     form11.ValueListEditor1.InsertRow('Thickness of Interval',FloatToStr(Trunc(Start_Depth-Stop_Depth))+' ['+Stop_Depth_Unit+']',True);
     form11.ValueListEditor1.InsertRow('Recording Depth Step',FloatToStr(Step_Depth)+' ['+Step_Depth_Unit+']',True);
     form11.ValueListEditor1.InsertRow('Null Value',FloatToStr(Null_Value),True);
     form11.ValueListEditor1.InsertRow('Company',Company_Value_str,True);
     form11.ValueListEditor1.InsertRow('Well','',True);
     form11.ValueListEditor1.InsertRow('Field','',True);
     form11.ValueListEditor1.InsertRow('Location','',True);
     form11.ValueListEditor1.InsertRow('County','',True);
     form11.ValueListEditor1.InsertRow('State','',True);
     form11.ValueListEditor1.InsertRow('Country','',True);
     form11.ValueListEditor1.InsertRow('Service Company','',True);
     form11.ValueListEditor1.InsertRow('Field','',True);

     {Form1.VertScrollBar.Range:=Trunc(Start_Depth-Stop_Depth)+100;
     Form1.Image1.Canvas.Refresh;
     Form1.Image1.Height:=Trunc(Start_Depth-Stop_Depth);}


{START OF FRAMEWORK FOR DETAIL VIEW WINDOW -----------------------------------------------------------------------------------------}
     Image1.Canvas.Pen.color:=RGB(150,150,150);
     Form1.Image1.Canvas.Pen.width:=1;

     Image1.Canvas.rectangle(0,99,400,10000);
     Image1.Canvas.rectangle(450,99,700,10000);
     Image1.Canvas.rectangle(699,99,800,10000);

     Image1.Canvas.rectangle(0,0,400,100);
     Image1.Canvas.rectangle(450,0,800,100);

     Image1.Canvas.rectangle(0,70,400,100);

     Image1.Canvas.Font.color:=RGB(120,120,120);
     Image1.Canvas.Font.Size:=15;
     Image1.Canvas.TextOut(10,5,'GEOMANCY 2007');
     Image1.Canvas.Font.color:=RGB(150,150,150);
     Image1.Canvas.Font.Size:=7;
     Image1.Canvas.TextOut(10,25,'Copyrights 2007, All Rights Reserved.');

     Image1.Canvas.Font.Size:=12;
     Image1.Canvas.Font.color:=RGB(50,50,50);

     Image1.Canvas.TextOut(28,75,'N');
     Image1.Canvas.rectangle(32,94,33,98);

     Image1.Canvas.TextOut(72,75,'NE');
     Image1.Canvas.rectangle(80,94,81,98);

     Image1.Canvas.TextOut(124,75,'E');
     Image1.Canvas.rectangle(128,94,129,98);

     Image1.Canvas.TextOut(168,75,'SE');
     Image1.Canvas.rectangle(176,94,177,98);

     Image1.Canvas.TextOut(220,75,'S');
     Image1.Canvas.rectangle(224,94,225,98);

     Image1.Canvas.TextOut(264,75,'SW');
     Image1.Canvas.rectangle(272,94,273,98);

     Image1.Canvas.TextOut(316,75,'W');
     Image1.Canvas.rectangle(320,94,321,98);

     Image1.Canvas.TextOut(360,75,'NW');
     Image1.Canvas.rectangle(368,94,369,98);



{END OF FRAMEWORK FOR DETAIL VIEW WINDOW -------------------------------------------------------------------------------------------}

{START OF COLOR GUIDE --------------------------------------------------------------------------------------------------------------}
     for n:=0 to 255 do
          Begin
               if n<85 then
                    Begin
                         Image1.Canvas.Pen.color:=RGB(255,255,255-(n*3));
                         Image1.Canvas.moveto(n+65, 60);
                         Image1.Canvas.lineto(n+65, 65);
                    end;
               if (n>=85) and (n<170) then
                    Begin
                         Image1.Canvas.Pen.color:=RGB(255,510-(n*3),0);
                         Image1.Canvas.moveto(n+65,60);
                         Image1.Canvas.lineto(n+65,65);
                    end;
               if n >= 170 then
                    Begin
                         Image1.Canvas.Pen.color:=RGB(765-(n*3),0,0);
                         Image1.Canvas.moveto(n+65,60);
                         Image1.Canvas.lineto(n+65,65);
                    end;
            end;
{END OF COLOR GUIDE ----------------------------------------------------------------------------------------------------------------}
            Form1.Image1.Canvas.Pen.color:=RGB(200,200,200);
            {Scale of Resistivity}
            For Scale:= 1 to 12 do
                Begin
                     Form1.Image1.Canvas.Pen.color:=RGB(200,200,200);
                     Form1.Image1.Canvas.MoveTo(450+Trunc((Scale*100)/5),100+1);
                     Form1.Image1.Canvas.LineTo(450+Trunc((Scale*100)/5),10000-1);
                     Form1.Image1.Canvas.Font.Size:=5;
                     Form1.Image1.Canvas.Font.color:=RGB(100,100,100);
                     Form1.Image1.Canvas.TextOut(450+Trunc((Scale*100)/5)-5,90,FloatToStr(Scale*100));
               end;

            {Scale of Acceleration}
            For Scale:= -9 to 9 do
                Begin
                     Form1.Image1.Canvas.Pen.color:=RGB(200,200,200);
                     Form1.Image1.Canvas.MoveTo(720+Trunc(((Scale/10)+9.8-9.2)*50),100+1);
                     Form1.Image1.Canvas.LineTo(720+Trunc(((Scale/10)+9.8-9.2)*50),10000-1);
                     Form1.Image1.Canvas.Font.Size:=4;
                     Form1.Image1.Canvas.Font.color:=RGB(100,100,100);
                     Form1.Image1.Canvas.TextOut(720+Trunc(((Scale/10)+9.8-9.2)*50)-5,90,FloatToStr(((Scale/10)+9.8-9.2)));
                end;


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


end;







{*********** START OF GUIDE PART ***************************************************************************************************}
{********** START OF GUIDE PART ****************************************************************************************************}
{********* START OF GUIDE PART *****************************************************************************************************}
{******** START OF GUIDE PART ******************************************************************************************************}
{******* START OF GUIDE PART *******************************************************************************************************}
{WHEN FORM1 CREATES ----------------------------------------------------------------------------------------------------------------}
procedure TForm1.FormCreate(Sender: TObject);
var
     n,n2,loop,y,No_of_Pads:integer;
     Inf_File:TextFile;
Begin
{START OF FRAMEWORK FOR DETAIL VIEW WINDOW -----------------------------------------------------------------------------------------}

     Image1.Canvas.Pen.color:=RGB(150,150,150);
     Form1.Image1.Canvas.Pen.width:=1;

     Image1.Canvas.rectangle(0,99,400,10000);
     Image1.Canvas.rectangle(450,99,700,10000);
     Image1.Canvas.rectangle(699,99,800,10000);

     Image1.Canvas.rectangle(0,0,400,100);
     Image1.Canvas.rectangle(450,0,800,100);

     Image1.Canvas.rectangle(0,70,400,100);

     Image1.Canvas.Font.color:=RGB(120,120,120);
     Image1.Canvas.Font.Size:=15;
     Image1.Canvas.TextOut(10,5,'GEOMANCY 2007');
     Image1.Canvas.Font.color:=RGB(150,150,150);
     Image1.Canvas.Font.Size:=7;
     Image1.Canvas.TextOut(10,25,'Copyrights 2007, All Rights Reserved.');

     Image1.Canvas.Font.Size:=12;
     Image1.Canvas.Font.color:=RGB(50,50,50);

     Image1.Canvas.TextOut(28,75,'N');
     Image1.Canvas.rectangle(32,94,33,98);

     Image1.Canvas.TextOut(72,75,'NE');
     Image1.Canvas.rectangle(80,94,81,98);

     Image1.Canvas.TextOut(124,75,'E');
     Image1.Canvas.rectangle(128,94,129,98);

     Image1.Canvas.TextOut(168,75,'SE');
     Image1.Canvas.rectangle(176,94,177,98);

     Image1.Canvas.TextOut(220,75,'S');
     Image1.Canvas.rectangle(224,94,225,98);

     Image1.Canvas.TextOut(264,75,'SW');
     Image1.Canvas.rectangle(272,94,273,98);

     Image1.Canvas.TextOut(316,75,'W');
     Image1.Canvas.rectangle(320,94,321,98);

     Image1.Canvas.TextOut(360,75,'NW');
     Image1.Canvas.rectangle(368,94,369,98);



{END OF FRAMEWORK FOR DETAIL VIEW WINDOW -------------------------------------------------------------------------------------------}

{START OF COLOR GUIDE --------------------------------------------------------------------------------------------------------------}
     for n:=0 to 255 do
          Begin
               if n<85 then
                    Begin
                         Image1.Canvas.Pen.color:=RGB(255,255,255-(n*3));
                         Image1.Canvas.moveto(n+65, 60);
                         Image1.Canvas.lineto(n+65, 65);
                    end;
               if (n>=85) and (n<170) then
                    Begin
                         Image1.Canvas.Pen.color:=RGB(255,510-(n*3),0);
                         Image1.Canvas.moveto(n+65,60);
                         Image1.Canvas.lineto(n+65,65);
                    end;
               if n >= 170 then
                    Begin
                         Image1.Canvas.Pen.color:=RGB(765-(n*3),0,0);
                         Image1.Canvas.moveto(n+65,60);
                         Image1.Canvas.lineto(n+65,65);
                    end;
            end;
{END OF COLOR GUIDE ----------------------------------------------------------------------------------------------------------------}
            Form1.Image1.Canvas.Pen.color:=RGB(200,200,200);
            {Scale of Resistivity}
            For Scale:= 1 to 12 do
                Begin
                     Form1.Image1.Canvas.Pen.color:=RGB(200,200,200);
                     Form1.Image1.Canvas.MoveTo(450+Trunc((Scale*100)/5),100+1);
                     Form1.Image1.Canvas.LineTo(450+Trunc((Scale*100)/5),10000-1);
                     Form1.Image1.Canvas.Font.Size:=5;
                     Form1.Image1.Canvas.Font.color:=RGB(100,100,100);
                     Form1.Image1.Canvas.TextOut(450+Trunc((Scale*100)/5)-5,90,FloatToStr(Scale*100));
               end;

            {Scale of Acceleration}
            For Scale:= -9 to 9 do
                Begin
                     Form1.Image1.Canvas.Pen.color:=RGB(200,200,200);
                     Form1.Image1.Canvas.MoveTo(720+Trunc(((Scale/10)+9.8-9.2)*50),100+1);
                     Form1.Image1.Canvas.LineTo(720+Trunc(((Scale/10)+9.8-9.2)*50),10000-1);
                     Form1.Image1.Canvas.Font.Size:=4;
                     Form1.Image1.Canvas.Font.color:=RGB(100,100,100);
                     Form1.Image1.Canvas.TextOut(720+Trunc(((Scale/10)+9.8-9.2)*50)-5,90,FloatToStr(((Scale/10)+9.8-9.2)));
                end;

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


end;
{*********** END OF GUIDE PART *****************************************************************************************************}
{********** END OF GUIDE PART ******************************************************************************************************}
{********* END OF GUIDE PART *******************************************************************************************************}
{******** END OF GUIDE PART ********************************************************************************************************}
{******* END OF GUIDE PART *********************************************************************************************************}











procedure TForm1.Graphic1Click(Sender: TObject);
begin
Form3.Visible:=True;
end;


procedure TForm1.Button1Click(Sender: TObject);
begin
Form4.Visible:=True;
end;


procedure TForm1.About1Click(Sender: TObject);
begin
Form5.Visible:=True;
end;


procedure TForm1.DataAnalyzer1Click(Sender: TObject);
begin
Form7.Visible:=True;
end;

procedure TForm1.Statistics1Click(Sender: TObject);
begin
Form8.Visible:=True;
end;

procedure TForm1.PreliminaryProcess1Click(Sender: TObject);
begin
Form9.Visible:=True;
end;

procedure TForm1.MergeClick(Sender: TObject);
begin
Form10.Visible:=True;
end;

procedure TForm1.LogHeader1Click(Sender: TObject);
begin
form11.Visible:=True;
end;

procedure TForm1.Button2Click(Sender: TObject);
begin
Form1.Image2.Visible:=False;
Form1.Image1.Visible:=True;
Form1.VertScrollBar.Range:=Form1.Image1.Height;
end;

procedure TForm1.Button3Click(Sender: TObject);
begin
Form1.Image1.Visible:=False;
Form1.Image2.Visible:=True;
Form1.VertScrollBar.Range:=Form1.Image2.Height;

end;

end.
