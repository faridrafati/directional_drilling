{

book.glscene.ru
  h1p2_Materials

article
  book.glscene.ru/index.php?title=FirstProject/Materials
source
  glsbook.svn.sourceforge.net/svnroot/glsbook/heads/h1p2_6Materials
download
  sourceforge.net/projects/glsbook/files/heads/h1p2_6Materials.7z/download

}

unit u_Main;


interface

uses
  Windows, Messages, SysUtils, Classes, Graphics, Forms,

  GLScene, GLObjects, GLCadencer, GLWin32Viewer, GLCrossPlatform, Controls,
  BaseClasses, GLCoordinates, GLHUDObjects, GLBitmapFont, GLGeomObjects,
  GLBehaviours, GLKeyboard, GLDCE, VectorGeometry, VectorTypes, GLWindowsFont,
  GLTexture, GLMaterial, GLCelShader, GLCompositeImage, GLShadowVolume,
  AsyncTimer, GLContext,

  u_MatUtils, u_Player;

type
  TForm1 = class(TForm)
    GLScene1: TGLScene;
    GLSceneViewer1: TGLSceneViewer;
    GLCamera1: TGLCamera;
    GLHUDText1: TGLHUDText;
    GLTorus1: TGLTorus;
    GLLightSource1: TGLLightSource;
    GLDummyCube1: TGLDummyCube;
    GLCube1: TGLCube;
    GLCadencer1: TGLCadencer;
    GLDCEManager1: TGLDCEManager;
    GLPlane1: TGLPlane;
    GLCube2: TGLCube;
    GLCube3: TGLCube;
    GLCube4: TGLCube;
    GLCube5: TGLCube;
    GLCube6: TGLCube;
    GLSphere1: TGLSphere;
    GLCone1: TGLCone;
    GLHUDText2: TGLHUDText;
    GLWindowsBitmapFont1: TGLWindowsBitmapFont;
    GLMaterialLibrary1: TGLMaterialLibrary;
    GLCelShader1: TGLCelShader;
    AsyncTimer1: TAsyncTimer;
    GLShadowVolume1: TGLShadowVolume;
    GLSphere2: TGLSphere;
    GLSprite1: TGLSprite;
    procedure FormCreate(Sender: TObject);
    procedure GLCadencer1Progress(Sender: TObject; const deltaTime,
      newTime: Double);
    procedure FormResize(Sender: TObject);
    procedure FormKeyDown(Sender: TObject; var Key: Word; Shift: TShiftState);

    procedure OnPause(Sender: TObject);
    procedure OnResume(Sender: TObject);
    procedure WMEnterSizeMove(var M: TMessage); message WM_ENTERSIZEMOVE;
    procedure WMExitSizeMove(var M: TMessage); message WM_EXITSIZEMOVE;
    procedure AsyncTimer1Timer(Sender: TObject);
    procedure GLSceneViewer1MouseDown(Sender: TObject; Button: TMouseButton;
      Shift: TShiftState; X, Y: Integer);
    procedure GLSceneViewer1MouseUp(Sender: TObject; Button: TMouseButton;
      Shift: TShiftState; X, Y: Integer);
    procedure FormMouseWheel(Sender: TObject; Shift: TShiftState;
      WheelDelta: Integer; MousePos: TPoint; var Handled: Boolean);
  end;

var
  Form1: TForm1;

  player: c_Player;


procedure playerOnGround(out a_Move: TVector3f);


implementation


{$R *.dfm}


//                                                               playerOnGround
//
procedure playerOnGround(out a_Move: TVector3f);
var
    dX: double;

begin

  { если на платформе, то двигаемся с ней /
    moving with platform }
  if form1.GLCube6.RayCastIntersect(player.obj.AbsolutePosition,
    vectormake(0, -1, 0)) then begin

    { производная от функции движения платформы /
      derivative of the motion platform }
    dX := 2*cos(player.ct/2);
    setvector(a_Move, dX, dX/2, 0);

    end;

end;


//                                                                   FormCreate
//
procedure TForm1.FormCreate(Sender: TObject);
begin

  { задаем вращение вокруг оси OZ со скоростью 180° в секунду /
    roll (OZ) cube by 180° per second }
  GetOrCreateInertia(GLCube1).RollSpeed := 180;

  { создаем игрока / create player }
  player := c_Player.Create(GLSphere1);
  player.onGround := playerOnGround;

  { события / events }
  // ...при сворачивании и разворачивании приложения
  Application.OnMinimize := OnPause;
  Application.OnRestore := OnResume;

  // ...при фокусировке и при потере фокуса приложением
  Application.OnActivate := OnResume;
  Application.OnDeactivate := OnPause;

  { сглаживание краёв граней / set 4x AntiAliasing }
  GLSceneViewer1.Buffer.AntiAliasing := aa4x;

  { загружаем текстуры / load dds-textures }
  setCurrentDir(ExtractFilePath(application.ExeName) + '../../media/');

  LoadTex(GLPlane1, 'checker.dds');
  LoadTex(GLCube1, 'checker.dds');
  LoadTex(GLMaterialLibrary1, 'platform', 'checker.dds');

  with LoadTex(GLSphere2, 'sky_03s.dds') do begin
    mappingMode := tmmCubeMapNormal;
    TextureWrap := twNone;
    end;

  LoadTex(GLSprite1, 'flash_01s.dds');

end;


//                                                                   FormResize
//
procedure TForm1.FormResize(Sender: TObject);
begin

  with GLSceneViewer1 do begin

    { фиксируем надпись приветствия / align label to right-bottom corner }
    GLHUDText1.Position.SetPoint(width-130, height-30, 0);

    { центруем надпись "Пауза" / align label 'Pause' to center }
    GLHUDText2.Position.SetPoint(width div 2, height div 2, 0);

    { пропорции камеры / cam proportions }
    FieldOfView := 154;

    end;

end;


//                                                       GLCadencer1.OnProgress
//
procedure TForm1.GLCadencer1Progress(Sender: TObject; const deltaTime,
  newTime: Double);
var
    obj: TGLBaseSceneObject;

begin

  { задаем вращение даммика вокруг оси OY со скоростью 90° в секунду /
    turn (OY) dummy by 90° per second }
  GLDummyCube1.TurnAngle := GLDummyCube1.TurnAngle + 90*deltaTime;

  { перемещение платформы / platform motion }
  with GLCube6.Position do begin
    X := 4*sin(newTime/2) + 3;
    Y := X/2 + 1;
    end;

  with GLSceneViewer1 do
    { преобразуем экранные координаты мыши в оконные и получаем объект /
      convert mouse screen coords to local and get a object }
    with ScreenToClient(mouse.CursorPos) do
      obj := Buffer.GetPickedObject(X, Y);

  { тор / torus }
  with GLTorus1.Material.FrontProperties.Emission do
    if obj = GLTorus1 then SetColor(0.8, 0.4, 0)
      else SetColor(0, 0, 0);

  { кубик / cube }
  with GLCube1.Material.FrontProperties.Emission do
    if obj = GLCube1 then SetColor(0, 0.8, 0.4)
      else SetColor(0, 0, 0);

  { конус / cone }
  with GLCone1.Material.FrontProperties.Emission do
    if obj = GLCone1 then SetColor(1, 0, 0)
      else SetColor(0, 0, 0);

  { управление игроком / player control }
  player.update(deltatime, newtime);

  { привязываем "небо" к камере / align sky to camera }
  GLSphere2.AbsolutePosition := GLCamera1.AbsolutePosition;

end;


//                                                     GLSceneViewer1.MouseDown
//
procedure TForm1.GLSceneViewer1MouseDown(Sender: TObject; Button: TMouseButton;
  Shift: TShiftState; X, Y: Integer);
begin

  { можно вращать камеру / can rotate cam }
  if button = mbRight then
    player.mouse_beginMove;

end;


//                                                       GLSceneViewer1.MouseUp
//
procedure TForm1.GLSceneViewer1MouseUp(Sender: TObject; Button: TMouseButton;
  Shift: TShiftState; X, Y: Integer);
begin

  { запрещаем вращать камеру / stop cam rotation }
  if button = mbRight then
    player.mouse_endMove;

end;


//                                                                  FormKeyDown
//
procedure TForm1.FormKeyDown(Sender: TObject; var Key: Word;
  Shift: TShiftState);
begin

  { пауза / pause }
  if key = vk_pause then
    if GLCadencer1.Enabled then OnPause(nil)
      else OnResume(nil);

end;


//                                                               FormMouseWheel
//
procedure TForm1.FormMouseWheel(Sender: TObject; Shift: TShiftState;
  WheelDelta: Integer; MousePos: TPoint; var Handled: Boolean);
begin

  { изменяем размер сцены / change scene scale }
  player.cam_zoom(WheelDelta);

end;


//                                                          AsyncTimer1.OnTimer
//
procedure TForm1.AsyncTimer1Timer(Sender: TObject);
begin

  caption := 'book.glscene.ru :  FirstProject/Materials ... '+
    GLSceneViewer1.FramesPerSecondText(2);
  GLSceneViewer1.ResetPerformanceMonitor;

end;


//                                                                      OnPause
//
procedure TForm1.OnPause(Sender: TObject);
begin

  GLCadencer1.Enabled := false;
  GLHUDText2.Visible := true;

end;


//                                                                     OnResume
//
procedure TForm1.OnResume(Sender: TObject);
begin

  GLCadencer1.Enabled := true;
  GLHUDText2.Visible := false;

end;


//                                                              WMEnterSizeMove
//
procedure TForm1.WMEnterSizeMove(var M: TMessage);
begin

  OnPause(nil);

  inherited;

end;


//                                                               WMExitSizeMove
//
procedure TForm1.WMExitSizeMove(var M: TMessage);
begin

  OnResume(nil);

  inherited;

end;

end.
