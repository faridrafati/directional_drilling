unit Unit35;

interface

uses
  Windows, Messages, SysUtils, Classes, Graphics, Controls, Forms, Dialogs,
  GLScene, GLObjects, VectorGeometry, GLTexture, ExtCtrls, GLCadencer,
  StdCtrls, GLMesh, GLWin32Viewer, GLState, VectorTypes, Menus, GLGraph,
  ComCtrls, GLExtrusion, ToolWin, GLGui, GLWindows, GLFeedback, Keyboard, OpenGL1x,
  ExtDlgs,GLHUDObjects, GLCoordinates, GLCrossPlatform, BaseClasses,GLColor,
  GLGeomObjects, GLMaterial, GLBitmapFont;


type
  TForm35 = class(TForm)
    Button1: TButton;
    GLScene1: TGLScene;
    GLSceneViewer1: TGLSceneViewer;
    GLLightSource1: TGLLightSource;
    GLDummyCube1: TGLDummyCube;
    GLMesh1: TGLMesh;
    GLCube1: TGLCube;
    MainMenu1: TMainMenu;
    File1: TMenuItem;
    Option1: TMenuItem;
    Save1: TMenuItem;
    Exit1: TMenuItem;
    GLXYZGrid1: TGLXYZGrid;
    TrackBar1: TTrackBar;
    Edit1: TEdit;
    Image1: TImage;
    GLLines1: TGLLines;
    Button2: TButton;
    Button3: TButton;
    Image2: TImage;
    Image3: TImage;
    Button4: TButton;
    GLCameraL: TGLCamera;
    GLCameraR: TGLCamera;
    GLCube2: TGLCube;
    GLCameraC: TGLCamera;
    GLCameraO: TGLCamera;
    GLCube3: TGLCube;
    RadioGroup2: TRadioGroup;
    CheckBox2: TCheckBox;
    RadioGroup1: TRadioGroup;
    GLSphere1: TGLSphere;
    PageControl1: TPageControl;
    TabSheet1: TTabSheet;
    TabSheet2: TTabSheet;
    TabSheet3: TTabSheet;
    TabSheet4: TTabSheet;
    CheckBox1: TCheckBox;
    TrackBar2: TTrackBar;
    TrackBar3: TTrackBar;
    Label1: TLabel;
    Label2: TLabel;
    Edit2: TEdit;
    Edit3: TEdit;
    SavePictureDialog1: TSavePictureDialog;
    GLCadencer1: TGLCadencer;
    GLPolygon1: TGLPolygon;
    RadioGroup3: TRadioGroup;
    GLCube4: TGLCube;
    GLLightSource2: TGLLightSource;
    GLLightSource3: TGLLightSource;
    GLMaterialLibrary1: TGLMaterialLibrary;
    procedure AddTriangle(const p1, p2, p3 : TAffineVector;
                         const color : TColorVector);
    procedure Formula1(const x, y: Single; var z: Single;
      var color: TColorVector; var texPoint: TTexPoint);

    procedure GLSceneViewer1MouseDown(Sender: TObject;
      Button: TMouseButton; Shift: TShiftState; X, Y: Integer);
    procedure GLSceneViewer1MouseMove(Sender: TObject; Shift: TShiftState;
      X, Y: Integer);
    procedure Button1Click(Sender: TObject);
    Procedure GrayScale(var Bitmap:TBitmap);
    procedure RenderToBitmap(scale : Single;var bmp:tbitmap);
    procedure redgreenblue(r:boolean; var Bitmap:TBitmap);
    procedure FormCreate(Sender: TObject);
    procedure FormShow(Sender: TObject);
    procedure Option1Click(Sender: TObject);
    procedure GLSceneViewer1MouseUp(Sender: TObject; Button: TMouseButton;
      Shift: TShiftState; X, Y: Integer);
    procedure CheckBox1Click(Sender: TObject);
    procedure TrackBar1Change(Sender: TObject);
    procedure Button2Click(Sender: TObject);
    procedure Button3Click(Sender: TObject);
    procedure Button4Click(Sender: TObject);
    procedure Positioning;
    PROCEDURE BLEND(bitmap1,bitmap2:tbitmap);
    procedure RadioGroup2Click(Sender: TObject);
    procedure PageControl1Change(Sender: TObject);
    procedure TrackBar2Change(Sender: TObject);
    procedure TrackBar3Change(Sender: TObject);
    procedure GLCadencer1Progress(Sender: TObject; const deltaTime,
      newTime: Double);
    procedure lineline(xmin,xmax,ymin,ymax,x:real;var y:real);
    procedure RadioGroup3Click(Sender: TObject);
    PROCEDURE MESHING;
    PROCEDURE CUBES;
  private
    { Private declarations }
  public
    { Public declarations }
  end;

var
   Form35: TForm35;
   x, y ,mx,my : Integer;
   pTopLeft, pTopRight, pBottomRight, pBottomLeft,pspherecenter : TAffineVector;
   diss2,diss3,zx,zy,zz : real;
   oldpick : TGLCustomSceneObject;
   mapno3,noofmap,RL3DNO:integer;
   cube:array[1..10000]of tglcube;
implementation

uses Unit21, Unit22, Unit27,ProEffectImage, Unit26;

{$R *.dfm}
procedure TForm35.lineline(xmin,xmax,ymin,ymax,x:real;var y:real);
begin
 y:=ymax+((ymax-ymin)/(xmax-xmin))*(x-xmax);
end;
procedure tForm35.Formula1(const x, y: Single; var z: Single;
      var color: TColorVector; var texPoint: TTexPoint);
begin
   // first formula
   z:=VectorNorm(x, y);
   z:=cos(z*12)/(2*(z*6.28+1));
   VectorLerp(clrBlue, clrRed, (z+1)/2, color);
end;
function MakeVect(const x, y : Single;const mn:integer) : TAffineVector;
   begin
      SetVector(Result, zx*(16*x/intro[1,mn]-8),zy*(8-16*(z.z[round(x),round(y),mn]
      -intro[3,mn])/(intro[4,mn]-intro[3,mn])), zz*(16*y/intro[2,mn]-8));
   end;

procedure tForm35.AddTriangle(const p1, p2, p3 : TAffineVector;
                         const color : TColorVector);
   begin
    with glMesh1.Vertices do
     begin
      AddVertex(p1, NullVector, color);
      AddVertex(p2, NullVector, color);
      AddVertex(p3, NullVector, color);
     end;
   end;

procedure TForm35.Positioning;
var
 local1,local2,localx,localy,localz:real;
 begin
  GLSphere1.Visible:=true;
  lineline(0,TrackBar2.max,1,intro[1,1],TrackBar2.Position,localx);
  lineline(0,TrackBar3.max,1,intro[2,1],TrackBar3.Position,localz);
  GLSphere1.Position.x:=zx*(16*round(localx)/intro[1,1]-8);
  GLSphere1.Position.z:=zz*(16*round(localz)/intro[2,1]-8);
  GLSphere1.Position.y:=zy*(8-16*(z.z[round(localx),round(localz),1]
      -intro[3,1])/(intro[4,1]-intro[3,1]));
  form35.Caption:=floattostr(GLSphere1.Position.x)+' '+floattostr(GLSphere1.Position.y)+' '+floattostr(GLSphere1.Position.z);
 end;


procedure TForm35.GLCadencer1Progress(Sender: TObject; const deltaTime,
  newTime: Double);
var
   speed : Single;
begin
   // handle keypresses
 {  if IsKeyDown(VK_SHIFT) then
      speed:=5*deltaTime
   else speed:=deltaTime;
   with GLCamerao.Position do begin
      if IsKeyDown(VK_RIGHT) then
         glDummyCube1.Translate(Z*speed, 0, -X*speed);
      if IsKeyDown(VK_LEFT) then
         glDummyCube1.Translate(-Z*speed, 0, X*speed);
      if IsKeyDown(VK_UP) then
         glDummyCube1.Translate(-X*speed, 0, -Z*speed);
      if IsKeyDown(VK_DOWN) then
         glDummyCube1.Translate(X*speed, 0, Z*speed);
{      if IsKeyDown(VK_PRIOR) then
         FCamHeight:=FCamHeight+10*speed;
      if IsKeyDown(VK_NEXT) then
         FCamHeight:=FCamHeight-10*speed;
      if IsKeyDown(VK_ESCAPE) then Close;
   end;
   // don't drop through terrain!
{   with glDummyCube1.Position do
      Y:=TerrainRenderer1.InterpolatedHeight(AsVector)+FCamHeight;}
end;

procedure TForm35.GLSceneViewer1MouseDown(Sender: TObject;
  Button: TMouseButton; Shift: TShiftState; X, Y: Integer);
var
	pick : TGLCustomSceneObject;
begin
 if PageControl1.ActivePageIndex=0 then
  if RadioGroup1.ItemIndex=3 then begin
   pick:=(GLSceneViewer1.Buffer.GetPickedObject(x, y) as TGLCustomSceneObject);
	if Assigned(pick) then begin
   if pick.Name<>'' then begin
		// ...turn it to yellow and show its name
    form35.Caption:=pick.Name;
   end;
	end;
end;
   mx:=x; my:=y;
end;

procedure TForm35.GLSceneViewer1MouseMove(Sender: TObject;
  Shift: TShiftState; X, Y: Integer);
var
	pick : TGLCustomSceneObject;
	dx, dy : Integer;
	v : TVector;
  ltx,lty,ltz:real;
  RL3DCX,RL3DCY,RL3DCZ:REAL;
begin
 if PageControl1.ActivePageIndex=0 then
  begin
   dx:=mx-x;
   dy:=my-y;
   if RadioGroup1.ItemIndex=0 then
    if ssLeft in Shift then
     begin
      TGLSceneViewer(Sender).Camera.MoveAroundTarget(my-y, mx-x);
      my:=y; mx:=x;
      GLLightSource1.Position:=GLCameraC.Position;
     end;
   if RadioGroup1.ItemIndex=1 then
    if ssLeft in Shift then
     begin
      v:=GLCameraC.ScreenDeltaToVectorXY(dx, -dy,
      0.001*GLCameraC.DistanceToTarget/GLCameraC.FocalLength);
		  glDummyCube1.Position.Translate(v);
		  // notify camera that its position/target has been changed
      GLCameraC.TransformationChanged;
	   end;
   if RadioGroup1.ItemIndex=2 then
   if ssLeft in Shift then
    begin
     if diss3+(my-y)/400>0 then
      diss2:=diss3+(my-y)/400;
      glcameraC.SceneScale:=diss2;
    end;
   if RadioGroup1.ItemIndex=3 then
    begin
	   // find what's under the mouse
	   pick:=(GLSceneViewer1.Buffer.GetPickedObject(x, y) as TGLCustomSceneObject);
	   if Assigned(pick) then
      begin
       if pick.Name<>'' then
        begin
	       // ...turn it to yellow and show its name
         form35.Caption:=pick.Name;
        end;
 	    end
    end
   else
    begin

    end;
   RL3DCX:=GLCameraC.Position.X;
   RL3DCZ:=GLCameraC.Position.Z;
   IF GLSceneViewer1.Camera=GLCameraC THEN
    BEGIN
     RL3DCY:=2*SQRT(RL3DCZ*RL3DCZ+RL3DCX*RL3DCX);
     GLCameraR.Position.X:=RL3DCX+(RL3DCZ/RL3DCY);
     GLCameraL.Position.X:=RL3DCX-(RL3DCZ/RL3DCY);
     GLCameraR.Position.Y:=GLCameraC.Position.Y;
     GLCameraL.Position.Y:=GLCameraC.Position.Y;
     GLCameraR.Position.Z:=RL3DCZ-(RL3DCX/RL3DCY);
     GLCameraL.Position.Z:=RL3DCZ+(RL3DCX/RL3DCY);
    END;
   GLCube1.Position:=GLCameraL.Position;
   GLCube2.Position:=GLCameraC.Position;
   GLCube3.Position:=GLCameraR.Position;
   LTX:=(GLCameraL.Position.X-GLCameraR.Position.X)*(GLCameraL.Position.X-GLCameraR.Position.X);
   LTY:=(GLCameraL.Position.Y-GLCameraR.Position.Y)*(GLCameraL.Position.Y-GLCameraR.Position.Y);
   LTZ:=(GLCameraL.Position.Z-GLCameraR.Position.Z)*(GLCameraL.Position.Z-GLCameraR.Position.Z);
   form35.Caption:=' Lx='+floattostr(GLCameraL.Position.X)+' Ly='+floattostr(GLCameraL.Position.y)+' Lz='+floattostr(GLCameraL.Position.Z)+
                 ' Dx='+floattostr(SQRT(LTX+LTY+LTZ));
  end;
end;
procedure TForm35.MESHING;
var
 clor: TVector4f;
 clr: tcolor;
 pointt,tmap,bmap,xyinc,cntr: integer;
 locala,localb:real;
begin
   with glMesh1 do
    begin
     Mode:=mmTriangles;
     Vertices.Clear;
    end;
   glcube1.DeleteChildren;
   if (mapno3=1)and(noofmap=2)then
    begin
     tmap:=strtoint(form26.StringGrid1.Cells[1,0]);
     bmap:=strtoint(form26.StringGrid1.Cells[1,1]);
    end;
   if (mapno3=1)and(noofmap=1)then
    begin
     tmap:=strtoint(form26.StringGrid1.Cells[1,0]);
     bmap:=strtoint(form26.StringGrid1.Cells[1,0]);
    end;
   if (mapno3=3)then
    begin
     tmap:=3;
     bmap:=3;
    end;
   zx:=strtofloat(form26.Edit10.Text);
   zy:=strtofloat(form26.Edit11.Text);
   zz:=strtofloat(form26.Edit12.Text);
   GLSceneViewer1.Visible:=false;
   locala:=-(Image1.Height/16/zy);
   localb:=-8*locala*zy;
   with glMesh1 do
    begin
     Mode:=mmTriangles;
     Vertices.Clear;
     y:=1;
     cntr:=strtoint(form26.Edit9.Text);
     while y<intro[2,mapno3]  do
      begin
       x:=1;
       while x<intro[1,mapno3]  do
        begin
         pTopLeft:=MakeVect(x, y+cntr,tmap);
         pTopRight:=MakeVect(x+cntr, y+cntr,tmap);
         pBottomRight:=MakeVect(x+cntr, y,tmap);
         pBottomLeft:=MakeVect(x, y,tmap);
         if (pTopleft[1]>=-8)and(pTopRight[1]>=-8)and
         (pBottomRight[1]>=-8)and(pBottomLeft[1]>=-8) then
          begin
           pointt:=round(locala*pTopleft[1]+localb);
           clr:=image1.Canvas.Pixels[3,pointt];
           clor:=ConvertWinColor(clr);
              // top left triangle
           AddTriangle(pBottomLeft, pTopLeft, pTopRight, clor);
           AddTriangle(pBottomLeft, pTopRight, pTopLeft, clor);
              // bottom right triangle
           AddTriangle(pTopRight, pBottomRight, pBottomLeft, clor);
           AddTriangle(pTopRight, pBottomLeft, pBottomRight, clor);
          end;
         if (mapno3=1)and(noofmap=2) then
          begin
         pTopLeft:=MakeVect(x, y+cntr,bmap);
         pTopRight:=MakeVect(x+cntr, y+cntr,bmap);
         pBottomRight:=MakeVect(x+cntr, y,bmap);
         pBottomLeft:=MakeVect(x, y,bmap);
           if (pTopleft[1]>=-8)and(pTopRight[1]>=-8)and
           (pBottomRight[1]>=-8)and(pBottomLeft[1]>=-8) then
            begin
             pointt:=round(locala*pTopleft[1]+localb);
             clr:=image1.Canvas.Pixels[3,pointt];
             clor:=ConvertWinColor(clr);
                // top left triangle
             AddTriangle(pBottomLeft, pTopLeft, pTopRight, clor);
             AddTriangle(pBottomLeft, pTopRight, pTopLeft, clor);
                // bottom right triangle
             AddTriangle(pTopRight, pBottomRight, pBottomLeft, clor);
             AddTriangle(pTopRight, pBottomLeft, pBottomRight, clor);
            end;
          end;
         x:=x+cntr;
        end;
       y:=y+cntr;
      end;
      CalcNormals(fwCounterClockWise);
//      Vertices.Locked:=True;
    end;
   GLSceneViewer1.Visible:=true;
   GLCube4.Material.FrontProperties.Diffuse.Alpha := 0.0;
end;
procedure TForm35.CUBES;
var
 clor: TVector4f;
 clr: tcolor;
 pointt,tmap,bmap,xyinc,XX,cntr: integer;
 locala,localb,xxx,yyy,zzz,min,max:real;
begin
 glcube4.material.texture.TextureMode := tmModulate;
 glcube4.material.FrontProperties.Diffuse.Alpha := 0.5;
 GLCube4.Visible:=true;


 with glMesh1 do
    begin
     Mode:=mmTriangles;
     Vertices.Clear;
    end;
   if (mapno3=1)and(noofmap=2)then
    begin
     tmap:=strtoint(form26.StringGrid1.Cells[1,0]);
     bmap:=strtoint(form26.StringGrid1.Cells[1,1]);
    end;
   if (mapno3=1)and(noofmap=1)then
    begin
     tmap:=strtoint(form26.StringGrid1.Cells[1,0]);
     bmap:=strtoint(form26.StringGrid1.Cells[1,0]);
    end;
   if (mapno3=3)then
    begin
     tmap:=3;
     bmap:=3;
    end;
   zx:=strtofloat(form26.Edit10.Text);
   zy:=strtofloat(form26.Edit11.Text);
   zz:=strtofloat(form26.Edit12.Text);
   GLSceneViewer1.Visible:=false;
   locala:=-(Image1.Height/16/zy);
   localb:=-8*locala*zy;

   //   Texture.Disabled := False;
     y:=1;
     x:=1;
     XX:=0;
     cntr:=strtoint(form26.Edit9.Text);
     while y<intro[2,mapno3]  do
      begin
       x:=1;
       while x<intro[1,mapno3]  do
        begin
          pTopLeft:=MakeVect(x, y+cntr,tmap);
          pTopRight:=MakeVect(x+cntr, y+cntr,tmap);
          pBottomRight:=MakeVect(x+cntr, y,tmap);
          pBottomLeft:=MakeVect(x, y,tmap);
          if (pTopleft[1]>=-8)and(pTopRight[1]>=-8)and
          (pBottomRight[1]>=-8)and(pBottomLeft[1]>=-8)AND(XX<10000) then
           begin
            XX:=XX+1;
            pointt:=round(locala*pTopleft[1]+localb);
            clr:=image1.Canvas.Pixels[3,pointt];
            clor:=ConvertWinColor(clr);
         	  cube[xx].Position.AsVector:=PointMake(pTopLeft);
		        cube[xx].CubeWidth:=pTopLeft[0]-pTopRight[0];
            min:=0.5*abs(pTopleft[1]+pTopRight[1])-0.5*abs(pTopleft[1]-pTopRight[1]);
            max:=0.5*abs(pTopleft[1]+pTopRight[1])+0.5*abs(pTopleft[1]-pTopRight[1]);
            min:=0.5*abs(min+pBottomRight[1])-0.5*abs(min-pBottomRight[1]);
            max:=0.5*abs(max+pBottomRight[1])+0.5*abs(max-pBottomRight[1]);
            min:=0.5*abs(min+pBottomLeft[1])-0.5*abs(min-pBottomLeft[1]);
            max:=0.5*abs(max+pBottomLeft[1])+0.5*abs(max-pBottomLeft[1]);
		        cube[xx].CubeHeight:=max-min;
		        cube[xx].CubeDepth:=pTopLeft[0]-pTopRight[0];
            with cube[xx].Material do
             begin
              cube[xx].Material.BlendingMode:=GLMaterialLibrary1.Materials.Items[0].Material.BlendingMode;
              FrontProperties.Diffuse.Color:=clor;
              texture.TextureMode := tmModulate;
              if (z.draw[x,y]=false)or(z.draw[x+cntr,y]=false)
               or(z.draw[x,y+cntr]=false)or(z.draw[x+cntr,y+cntr]=false) then
                FrontProperties.Diffuse.Alpha := 0.2
              else
                FrontProperties.Diffuse.Alpha := 1;
            end;
          end;
         x:=x+cntr;
        end;
       y:=y+cntr;
      end;
   GLSceneViewer1.Visible:=true;
   GLCube4.Material.FrontProperties.Diffuse.Alpha := 0.0;
end;
procedure TForm35.Button1Click(Sender: TObject);
BEGIN
  if RadioGroup3.ItemIndex=0 then
   MESHING
  ELSE if RadioGroup3.ItemIndex=1  then
   begin
    CUBES;
   end;

END;

procedure TForm35.FormCreate(Sender: TObject);
var
      ii:integer;
begin
 for ii := 1 to 10000 do
   cube[ii]:=TGLCube(GLCube4.AddNewChild(TGLCube));
 diss2:=1;
 diss3:=1;
 button1.Click;
 RL3DNO:=0;
end;

procedure TForm35.FormShow(Sender: TObject);
begin
 noofmap:=form22.checklistbox1.count;
 if form22.ComboBox1.ItemIndex=1 then
  mapno3:=3
 else
  mapno3:=1;
 TrackBar1.Min:=0;
 TrackBar1.max:=200;
 GLXYZGrid1.Position.Y:=zy*((0.05*TrackBar1.Position)-5);
 image1.Canvas.Rectangle(0,0,image1.Width,image1.Height);
 edit1.Text:=floattostr(-0.005*(intro[4,mapno3]-intro[3,mapno3])*(TrackBar1.Position)+intro[4,mapno3]);
 image1.Canvas.CopyRect(rect(0,0,image1.Width,image1.Height),form21.Image1.Canvas,rect(0,round(0.5*image1.Canvas.TextHeight('99')),10,form21.image1.Height-round(0.5*image1.Canvas.TextHeight('99')))); button1.Click;
end;

procedure TForm35.Option1Click(Sender: TObject);
begin
 form26.showmodal;
end;

procedure TForm35.GLSceneViewer1MouseUp(Sender: TObject;
  Button: TMouseButton; Shift: TShiftState; X, Y: Integer);
begin

     diss3:=diss2;
end;

procedure TForm35.CheckBox1Click(Sender: TObject);
begin
 if CheckBox1.Checked then
  GLXYZGrid1.Visible:=true
 else
  GLXYZGrid1.Visible:=false;
end;

procedure TForm35.TrackBar1Change(Sender: TObject);
begin
 GLXYZGrid1.Position.Y:=zy*((-16/(TrackBar1.Max-trackbar1.min)*TrackBar1.Position)+8);
 edit1.Text:=floattostr((intro[4,mapno3]-intro[3,mapno3])*(TrackBar1.Position)/(TrackBar1.Max-trackbar1.min)+intro[3,mapno3]);
end;

procedure TForm35.Button2Click(Sender: TObject);
var
  pipes: array[0..100] of TGLBaseSceneObject;
  TellerX, TellerY, TellerZ : Byte;
  Temp: TGLPipe;
  part:tpipeparts;
  ii,jj,kk:integer;
  xxx,yyy,zzz:real;
 mapno2:integer;
begin
  if form22.ComboBox1.ItemIndex=0 then
   begin
    mapno2:=mapno;
   end
  else if form22.ComboBox1.ItemIndex=1 then
   begin
    mapno2:=3;
   end;
  ii:=1;
  while welldd[ii,1].welnam<>'' do
   begin
    jj:=1;
    pipes[ii]:= GLScene1.Objects.AddNewChild(TGLPipe);
    if ii<10 then
     pipes[ii].Name:='pipe0'+inttostr(ii)
    else
     pipes[ii].Name:='pipe'+inttostr(ii);
    Temp := pipes[ii] as TGLPipe;
    temp.Radius:=0.15;
//    GLFlatText1.Text:=welldd[ii,1].welnam;
//    GLFlatText1.Position.X:=(zx*(16*((welldd[ii,1].x-intro[9,mapno2])/intro[5,mapno2])/intro[1,mapno2]-8));
//    GLFlatText1.Position.y:=zy*(8-16*(welldd[ii,1].y-intro[3,mapno2])
//      /(intro[4,mapno2]-intro[3,mapno2]));
//    GLFlatText1.Position.z:=(zz*(16*((welldd[ii,1].z-intro[11,mapno2])/intro[6,mapno2])/intro[2,mapno2]-8));

    while welldd[ii,jj].welnam<>'' do
     begin
      xxx:=(zx*(16*((welldd[ii,jj].x-intro[9,mapno2])/intro[5,mapno2])/intro[1,mapno2]-8));
      yyy:=zy*(8-16*(welldd[ii,jj].y-intro[3,mapno2])
      /(intro[4,mapno2]-intro[3,mapno2]));
      zzz:=(zz*(16*((welldd[ii,jj].z-intro[11,mapno2])/intro[6,mapno2])/intro[2,mapno2]-8));
      temp.Nodes.AddNode(xxx,yyy,zzz);
      jj:=jj+1;
     end;
    part:=[ppoutside,ppinside];
    temp.Parts:=part;
    ii:=ii+1;
   end;
end;

procedure TForm35.Button3Click(Sender: TObject);
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
   Image2.Picture.Graphic := Bitmap1;
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

procedure TForm35.RenderToBitmap(scale : Single;var bmp:tbitmap);
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







Procedure tForm35.GrayScale(var Bitmap:TBitmap);
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
Procedure tForm35.redgreenblue(r:boolean; var Bitmap:TBitmap);
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
      row.rgbtRed := (row.rgbtRed and $00);
      row.rgbtGreen := (row.rgbtGreen and $FF);
      row.rgbtblue := (row.rgbtblue and $FF);
      inc(Row);
     end;
   end
 ELSE
  for V:=0 to Bitmap.Height-1 do
   begin
    Row:=Bitmap.ScanLine[V];
    for H:=0 to Bitmap.Width -1 do
     begin
      row.rgbtRed := (row.rgbtRed and $FF);
      row.rgbtGreen := (row.rgbtGreen and $00);
      row.rgbtblue := (row.rgbtblue and $00);
      inc(Row);
     end;
   end
 end;

PROCEDURE TForm35.BLEND(bitmap1,bitmap2:tbitmap);
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
  Image2.Picture.Graphic := Bitmap2;
  image2.Picture.SaveToFile('LR.BMP');
  showmessage('Finish');
 end;
procedure TForm35.Button4Click(Sender: TObject);
var
  bitmap:tbitmap;
begin
   Bitmap := nil;
   try
    Bitmap := TBitmap.Create;
    bitmap.Width:=700;
    bitmap.Height:=700;
    Image2.Picture.Graphic := Bitmap;
    Image3.Picture.Graphic := Bitmap;
   finally
    Bitmap.Free;
   end;
   GLSceneViewer1.Buffer.CreateSnapShotBitmap.Canvas.Refresh;
 image2.Canvas.CopyRect(rect(0,0,image2.Width,image2.Height),GLSceneViewer1.Buffer.CreateSnapShotBitmap.Canvas,rect(0,0,image2.Width,image2.Height));
 if GLSceneViewer1.Camera=GLCameraL then
   image2.Picture.SaveToFile('c:\L.BMP')
 else
   image2.Picture.SaveToFile('c:\R.BMP');
end;


procedure TForm35.RadioGroup2Click(Sender: TObject);
begin
 IF RadioGroup2.ItemIndex=0 THEN
  GLSceneViewer1.Camera:=GLCameraL
 ELSE IF RadioGroup2.ItemIndex=1 THEN
  GLSceneViewer1.Camera:=GLCameraC
 ELSE IF RadioGroup2.ItemIndex=2 THEN
  GLSceneViewer1.Camera:=GLCameraR
 ELSE IF RadioGroup2.ItemIndex=3 THEN
  GLSceneViewer1.Camera:=GLCameraO;
end;

procedure TForm35.RadioGroup3Click(Sender: TObject);
begin
 BUTTON1.Click;
end;

procedure TForm35.PageControl1Change(Sender: TObject);
begin
 if PageControl1.ActivePageIndex<>1 then
  GLXYZGrid1.Visible:=false
 else if CheckBox1.Checked then
  GLXYZGrid1.Visible:=true
 else
  GLXYZGrid1.Visible:=false;
 if PageControl1.ActivePageIndex=4 then
  begin
   GLSphere1.Visible:=true;
   positioning;
  end
 else
  GLSphere1.Visible:=false;

end;

procedure TForm35.TrackBar2Change(Sender: TObject);
begin
 Positioning;
end;

procedure TForm35.TrackBar3Change(Sender: TObject);
begin
 Positioning;
end;

end.
