unit Unit03;

interface

uses
  Windows, Messages, SysUtils, Variants, Classes, Graphics, Controls, Forms,
  Dialogs, GLScene, GLObjects, GLWin32Viewer, GLExtrusion,
  GLCrossPlatform, StdCtrls, ExtCtrls, GLCoordinates, BaseClasses, RpDefine,
  RpBase, RpSystem, Menus;


type
  TForm03 = class(TForm)
    GLScene1: TGLScene;
    GLSceneViewer1: TGLSceneViewer;
    GLCamera1: TGLCamera;
    GLLightSource1: TGLLightSource;
    GLDummyCube1: TGLDummyCube;
    GLPipe1: TGLPipe;
    GLPipe2: TGLPipe;
    Edit1: TEdit;
    Edit2: TEdit;
    Edit3: TEdit;
    Label1: TLabel;
    Label2: TLabel;
    Label3: TLabel;
    Button1: TButton;
    Button2: TButton;
    GLCameraL: TGLCamera;
    GLCameraR: TGLCamera;
    Button3: TButton;
    RvSystem1: TRvSystem;
    Panel1: TPanel;
    Image1: TImage;
    MainMenu1: TMainMenu;
    File1: TMenuItem;
    procedure FormShow(Sender: TObject);
    procedure reax(var1,var2:real;var var3:real);
    procedure GLSceneViewer1MouseDown(Sender: TObject; Button: TMouseButton;
      Shift: TShiftState; X, Y: Integer);
    procedure GLSceneViewer1MouseMove(Sender: TObject; Shift: TShiftState; X,
      Y: Integer);
    procedure graphshow;
    procedure Button1Click(Sender: TObject);
    procedure Button2Click(Sender: TObject);
    Procedure GrayScale(var Bitmap:TBitmap);
    procedure RenderToBitmap(scale : Single;var bmp:tbitmap);
    PROCEDURE BLEND(bitmap1,bitmap2:tbitmap);
    Procedure redgreenblue(r:boolean; var Bitmap:TBitmap);
    procedure Panel1Resize(Sender: TObject);

  private
    { Private declarations }
  public
    { Public declarations }
  end;

var
  Form03: TForm03;
  mx,my:integer;
implementation

uses Unit01, Unit02, Unit10;

{$R *.dfm}
 procedure tForm03.reax(var1,var2: Real; var var3: Real);
 begin
  var3:=(5/var1)*var2;
 end;
procedure tForm03.graphshow;
var
 maxtvd,xzm,yzm,zzm:real;
begin
 xzm:=strtofloat(edit1.Text);
 yzm:=strtofloat(edit2.Text);
 zzm:=strtofloat(edit3.Text);
 form10.ADOTABLE1.First;
 while not(FORM10.ADOTABLE1.Eof) do
  begin
   maxtvd:=FORM10.ADOTABLE1.FieldByName('tvd').AsFloat;
   FORM10.ADOTABLE1.Next;
  end;
 maxtvd:=10/maxtvd;
 FORM10.ADOTABLE1.First;
 GLPipe1.Nodes.Clear;
 while not(FORM10.ADOTABLE1.Eof) do
  begin
   GLPipe1.AddNode(xzm*maxtvd*FORM10.ADOTABLE1.FieldByName('ns').AsFloat,yzm*(10-maxtvd*FORM10.ADOTABLE1.FieldByName('TVD').AsFloat),zzm*maxtvd*FORM10.ADOTABLE1.FieldByName('Ew').AsFloat);
   GLPipe1.Radius:=0.1;
   FORM10.ADOTABLE1.Next;
  end;
end;
procedure TForm03.Button1Click(Sender: TObject);
begin
 graphshow;
end;
procedure TForm03.Button2Click(Sender: TObject);
type
  TRGBArray = array[0..700] of TRGBTriple;
  PRGBArray = ^TRGBArray;


var
  X, Y,RL3DI, Gray: Integer;
  P   : TColor;
  r1,g1,b1,R2,G2,B2: byte;
  RP,GP,BP:single;
  bitmap1,BITMAP2:tbitmap;
  Row: PRGBArray;
  p0 : pbytearray;
 begin
  Bitmap1 := nil;
  try
   Bitmap1 := TBitmap.Create;
   bitmap1.Width:=700;
   bitmap1.Height:=700;
   Image1.Picture.Graphic := Bitmap1;
  finally
   Bitmap1.Free;
  end;
  Bitmap2 := nil;
  try
   Bitmap2 := TBitmap.Create;
   bitmap2.Width:=700;
   bitmap2.Height:=700;
  finally
   Bitmap2.Free;
  end;
 for RL3DI := 1 to 2 do
  BEGIN
   if RL3DI = 1 then
    BEGIN
     GLSceneViewer1.Camera:=GLCameraR;
     Bitmap1 := TBitmap.Create;
     RenderToBitmap(1,bitmap1);
     GrayScale(bitmap1);
     redgreenblue(true,bitmap1);
    END
   else
    BEGIN
     GLSceneViewer1.Camera:=GLCameral;
     Bitmap2 := TBitmap.Create;
     RenderToBitmap(1,bitmap2);
     GrayScale(bitmap2);
     redgreenblue(false,bitmap2);
    END;
  END;
 BLEND(bitmap1,bitmap2);
End;
Procedure tForm03.redgreenblue(r:boolean; var Bitmap:TBitmap);
var
Row:^TRGBTriple; // wskaźnik do rekordu reprezentującego składowe RGB Pixela
H,V,Index:Integer;
begin
 Bitmap.PixelFormat:=pf24bit;
 if r then
  for V:=0 to Bitmap.Height-1 do
   begin
    Row:=Bitmap.ScanLine[V];
    for H:=0 to Bitmap.Width -1 do
     begin
      row.rgbtRed := (255);
     // row.rgbtGreen := (row.rgbtGreen and $FF);
     // row.rgbtblue := (row.rgbtblue and $FF);
      inc(Row);
     end;
   end
 ELSE
  for V:=0 to Bitmap.Height-1 do
   begin
    Row:=Bitmap.ScanLine[V];
    for H:=0 to Bitmap.Width -1 do
     begin
    //  row.rgbtRed := (row.rgbtRed and $FF);
      row.rgbtGreen := ( 255);
      row.rgbtblue := ( 255);
      inc(Row);
     end;
   end
 end;

PROCEDURE TForm03.BLEND(bitmap1,bitmap2:tbitmap);
var
  X, Y,RL3DI, Gray: Integer;
  P   : TColor;
  r1,g1,b1,R2,G2,B2: byte;
  RP,GP,BP:single;
  p0 : pbytearray;
Row1,Row2:^TRGBTriple; // wskaźnik do rekordu reprezentującego składowe RGB Pixela
H,V,Index:Integer;
begin

  for x:=0 to bitmap1.Width-1 do
   begin
    for y:=0 to bitmap1.Height-1 do
     begin
      P := bitmap1.Canvas.Pixels[x,y];
      r1 := (P and $0000FF);
      g1 := (P and $00FF00) shr 8;
      b1 := (P and $FF0000) shr 16;
      P := bitmap2.Canvas.Pixels[x,y];
      r2 := (P and $0000FF);
      g2 := (P and $00FF00) shr 8;
      b2 := (P and $FF0000) shr 16;
      r2 := round( 0.5*r1 + 0.5*r2 );
      g2 := round( 0.5*g1 + 0.5*g2 );
      b2 := round( 0.5*b1 + 0.5*b2 );
      bitmap2.Canvas.Pixels[x,y] := r2 + g2 shl 8 + b2 shl 16
     end;
   end;
  Image1.Picture.Graphic := Bitmap2;
  image1.Picture.SaveToFile('LR.BMP');
  showmessage('Finish');
 end;
Procedure tForm03.GrayScale(var Bitmap:TBitmap);
var
Row:^TRGBTriple; // wskaźnik do rekordu reprezentującego składowe RGB Pixela
H,V,Index:Integer;
begin
 Bitmap.PixelFormat:=pf24bit;
 for V:=0 to Bitmap.Height-1 do
  begin
   Row:=Bitmap.ScanLine[V];
   for H:=0 to Bitmap.Width -1 do
    begin
    Index := ((Row.rgbtRed * 77 +       //77 to stała dla czerwieni
       Row.rgbtGreen* 150 +           //150 stała dla zielonego
       Row.rgbtBlue * 29) shr 8);    //29  stała dla niebieskiego
       Row.rgbtBlue:=Index;
       Row.rgbtGreen:=Index;
       Row.rgbtRed:=Index;
       inc(Row); { Nie wolno przypisywać X:=0 lub 1,2 bo to Wskaźnk!!!
 poruszamy się inc() lub dec()}

    end;
  end;
end;
procedure TForm03.Panel1Resize(Sender: TObject);
begin
 image1.Top:=GLSceneViewer1.Top;
 image1.Height:=GLSceneViewer1.Height;
 image1.left:=GLSceneViewer1.left;
 image1.Width:=GLSceneViewer1.Width;

end;

procedure TForm03.RenderToBitmap(scale : Single;var bmp:tbitmap);
var
   pt : Int64;
   delta : Double;
begin
   // Rendering to a bitmap requires an existing bitmap,
   // so we create and size a new one
   bmp:=TBitmap.Create;
   // Don't forget to specify a PixelFormat, or current screen pixel format
   // will be used, which may not suit your purposes!
   bmp.PixelFormat:=pf24bit;
   bmp.Width:=Round(GLSceneViewer1.Width*scale);
   bmp.Height:=Round(GLSceneViewer1.Height*scale);
   // Here we just request a render
   // The second parameter specifies DPI (Dots Per Inch), which is
   // linked to the bitmap's scaling
   // "96" is the "magic" DPI scale of the screen under windows
   GLSceneViewer1.Buffer.RenderToBitmap(bmp, Round(96*scale));
end;
procedure tForm03.FormShow(Sender: TObject);
var
 i:integer;
 ex1,ex2,ex3,ex4,ex5,ex6:real;
begin
 graphshow;
end;
procedure TForm03.GLSceneViewer1MouseDown(Sender: TObject; Button: TMouseButton;
  Shift: TShiftState; X, Y: Integer);
begin
 mx:=x; my:=y;
end;

procedure TForm03.GLSceneViewer1MouseMove(Sender: TObject; Shift: TShiftState; X,
  Y: Integer);
var
 dx, dy : Integer;
begin
 dx:=mx-x;
 dy:=my-y;
 if ssLeft in Shift then
  begin
   TGLSceneViewer(Sender).Camera.MoveAroundTarget(my-y, mx-x);
   my:=y; mx:=x;
   GLLightSource1.Position:=GLCamera1.Position;
  end;
end;

end.
