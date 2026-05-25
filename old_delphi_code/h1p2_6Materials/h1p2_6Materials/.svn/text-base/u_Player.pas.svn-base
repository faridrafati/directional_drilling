unit u_Player;


interface


uses
  Windows, Classes, SysUtils, Controls, Forms,

  GLScene, GLDCE, VectorTypes, VectorGeometry, GLKeyboard;


type

  t_onGround = procedure (out a_Move: TVector3f);

  c_Player = class
  protected

    f_Obj: TGLSceneObject;
    f_DCE: TGLDCEDynamic;

    f_Cam: TGLCamera;
    f_camMove: boolean;
    f_camZoom: integer;
    f_mPos: TPoint;

    f_dt,f_ct: double;

    f_onGround: t_onGround;

    function _toLocal(v: TVector3f): TVector3f;
    function _getMotion: TVector3f;
    procedure _moveCam;
    procedure _zoomCam;

  public

    constructor Create(a_Object: TGLSceneObject); reintroduce;

    procedure update(a_DeltaTime,a_NewTime: double);

    property obj: TGLSceneObject read f_Obj;
    property cam: TGLCamera read f_Cam;
    property dt: double read f_dt;
    property ct: double read f_ct;
    property cam_move: boolean read f_camMove;
    procedure cam_zoom(z: integer);
    procedure mouse_beginMove;
    procedure mouse_endMove;

    property onGround: t_onGround read f_onGround write f_onGround;

  end;


implementation


//                                                                  constructor
//
constructor c_Player.Create(a_Object: TGLSceneObject);
var
    a1: integer;

begin

  inherited Create;

  { поиск камеры в объекте-игроке / search cam in object }
  for a1 := 0 to a_Object.Count - 1 do
    if a_Object.Children[a1] is TGLCamera then begin
      f_Cam := TGLCamera(a_Object.Children[a1]);
      break;
      end;

  assert(f_Cam <> nil, 'Переместите камеру в объект "'+a_Object.Name+'".');

  f_Obj := a_Object;
  f_DCE := GetOrCreateDCEDynamic(a_Object);

end;


//                                                                     _tolocal
//
function c_Player._toLocal(v: TVector3f): TVector3f;
begin

  result := VectorCombine(f_Obj.AffineLeftVector,
    f_Obj.Direction.AsAffineVector, v[0], v[2]);

end;


//                                                                   _getMotion
//
function c_Player._getMotion: TVector3f;
begin

  setvector(result, 0, 0, 0);

  { движение влево, вправо, вперед и назад соответственно /
    slide to left, slide to right, move forward, move backward }
  if iskeydown(ord('A')) then addVector(result, MinusXVector);
  if iskeydown(ord('D')) then addVector(result, XVector);
  if iskeydown(ord('W')) then addVector(result, MinusZVector);
  if iskeydown(ord('S')) then addVector(result, ZVector);

  { нормализуем и масштабируем / normalize and scale }
  result := _toLocal(result);
  NormalizeVector(result);
  ScaleVector(result, 15);

end;


//                                                                     _moveCam
// осуществляем вращение камеры вокруг игрока, восстанавливаем курсор
// do turn and pitch cam around player, return mouse to screen center
procedure c_Player._moveCam;
begin

  if not f_camMove then exit;

  with mouse,screen do begin
    f_Obj.Turn((CursorPos.X - width div 2) * 0.5);
    f_Cam.MoveAroundTarget((height div 2 - CursorPos.Y) * 0.5, 0);
    CursorPos := point(width div 2, height div 2);
    end;

end;


//                                                                     _zoomCam
// настройка фокуса камеры
// zoom cam
procedure c_Player._zoomCam;
begin

  if f_camZoom = 0 then exit;

  with f_Cam do
    if (f_camZoom < 0) and (SceneScale > 0.5) then
      SceneScale := SceneScale - 0.05
    else if (f_camZoom > 0) and (SceneScale < 1.5) then
      SceneScale := SceneScale + 0.05;
  f_camZoom := 0;

end;


//                                                                       update
//
procedure c_Player.update(a_DeltaTime,a_NewTime: double);
var
    v,vm: TVector3f;

begin

  f_dt := a_DeltaTime;
  f_ct := a_NewTime;

  { вектор движения / motion vector }
  v := _getMotion;

  { вращение камеры / cam rotation }
  _moveCam;

  { фокус камеры / cam scale }
  _zoomCam;

  { перемещение игрока }
  with f_DCE do

    { игрок на поверхности / player in ground }
    if InGround then begin

      { осуществляем прыжок / do jump }
      if iskeydown(32) then Jump(0.5, 10);

      { внешняя обработка / onGround callback }
      if assigned(f_onGround) then begin
        setvector(vm, 0, 0, 0);
        f_onGround(vm);
        { прямое смещение / move player }
        if not VectorIsNull(vm) then
          move(vm, f_dt);
        end;

      { ускоренное движение / accelerated move on ground }
      if iskeyDown(vk_Shift) then ApplyAbsAccel(VectorScale(v, 1.5))
        { простое перемещение / move on ground }
        else ApplyAbsAccel(v);

      end
    else
      { смещение при падении / move in fall }
      ApplyAbsAccel(VectorScale(v, 0.25));

  { падение за пределы сцены / when falling outside }
  with f_Obj.Position do
    if Y < -10 then
      setPoint(0, 10, 0);

end;


//                                                                     cam_zoom
//
procedure c_Player.cam_zoom(z: integer);
begin

  f_camZoom := z;

end;


//                                                              mouse_beginMove
//
procedure c_Player.mouse_beginMove;
begin

  { прячем курсор / hide cursor }
  showCursor(false);

  { запоминаем текущую позицию курсора мыши / remember mouse cursor pos }
  f_mPos := mouse.CursorPos;

  { разрешаем вращение вокруг объекта / begin cam rotation }
  f_camMove := true;

  { выставляем кусор мыши в центр экрана / set mouse cursor to screen center }
  mouse.CursorPos := point(screen.width div 2, screen.height div 2);

end;


//                                                                mouse_endMove
//
procedure c_Player.mouse_endMove;
begin

  { восстанавливаем позицию курсора / return mouse cursor pos }
  mouse.CursorPos := f_mPos;

  { запрещаем вращение вокруг объекта / stop cam rotation }
  f_camMove := false;

  { показываем курсор / show cursor }
  showCursor(true);

end;


end.
