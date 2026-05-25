unit Unit34;

interface

uses
  Windows, Messages, SysUtils, Classes, Graphics, Controls, Forms, Dialogs,
  GLScene, GLObjects, VectorGeometry, GLTexture, ExtCtrls, GLCadencer,
  StdCtrls, GLMesh, GLWin32Viewer, GLState, GLCoordinates, GLCrossPlatform,
  BaseClasses,Glcolor;

type
  TForm34 = class(TForm)
    GLScene1: TGLScene;
    GLSceneViewer1: TGLSceneViewer;
    GLCamera1: TGLCamera;
    GLDummyCube1: TGLDummyCube;
    GLLightSource1: TGLLightSource;
    Button1: TButton;
    GLMesh1: TGLMesh;
    procedure GLSceneViewer1MouseDown(Sender: TObject;
      Button: TMouseButton; Shift: TShiftState; X, Y: Integer);
    procedure GLSceneViewer1MouseMove(Sender: TObject; Shift: TShiftState;
      X, Y: Integer);
    procedure AddTriangle(const p1, p2, p3 : TAffineVector;
                        const color : TColorVector);
    procedure Button1Click(Sender: TObject);
  private
    { Private declarations }
  public
    { Public declarations }
  end;

var
  Form34: TForm34;
  mmx,mmy:integer;
 invRes,invRes2:real;
 x,y,cResolution:integer;
  implementation

uses Unit22, Unit21, Unit26;

{$R *.dfm}

procedure TForm34.GLSceneViewer1MouseDown(Sender: TObject;
  Button: TMouseButton; Shift: TShiftState; X, Y: Integer);
begin
   mmx:=x; mmy:=y;
end;

procedure TForm34.GLSceneViewer1MouseMove(Sender: TObject;
  Shift: TShiftState; X, Y: Integer);
begin
   if ssLeft in Shift then begin
      TGLSceneViewer(Sender).Camera.MoveAroundTarget(mmy-y, mmx-x);
      mmy:=y; mmx:=x;
   end;
end;
function MakeVect(const x, y : Single) : TAffineVector;
   begin
      SetVector(Result, x*invRes, sin((x*x+y*y)*invRes2), y*invRes);
   end;
procedure tForm34.AddTriangle(const p1, p2, p3 : TAffineVector;
                        const color : TColorVector);
begin
      with glMesh1.Vertices do begin
         AddVertex(p1, NullVector, color);
         AddVertex(p2, NullVector, color);
         AddVertex(p3, NullVector, color);
      end;
end;


procedure TForm34.Button1Click(Sender: TObject);
var
 pTopLeft, pTopRight, pBottomRight , pBottomLeft : TAffineVector;
begin
cResolution:=50;
   invRes:=10/cResolution;
   invRes2:=0.1*Sqr(invRes);

   // scaling precalcs for our math func
   //
   // Triangles
   //
   // this one is basic : we calculate the corner points for each grid quad and
   // add the two triangles that make it
   with glMesh1 do begin
      Mode:=mmTriangles;
      Vertices.Clear;
      for y:=-cResolution to cResolution do begin
         for x:=-cResolution to cResolution do begin
            pTopLeft:=MakeVect(x, y+1);
            pTopRight:=MakeVect(x+1, y+1);
            pBottomRight:=MakeVect(x+1, y);
            pBottomLeft:=MakeVect(x, y);
            // top left triangle
            AddTriangle(pBottomLeft, pTopLeft, pTopRight, clrBlue);
            // bottom right triangle \

            AddTriangle(pTopRight, pBottomRight, pBottomLeft, clrBlue);
         end;
      end;
//      Vertices.Locked:=True;
   end;
   //
   // TriangleStrip
   //
   // Same as triangle, however trianglestrips are continuous, and to cover
   // the grid, "null" segments are used at both ends of a strip (to avoid a
   // visible triangle that would stretch for the full width of the grid).
   // Note : this can be avoided by reversing grid traversing direction (one line
   // from left to right, one from right to left, etc.)
//      Vertices.Locked:=True;
   end;


end.


