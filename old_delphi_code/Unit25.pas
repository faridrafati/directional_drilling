unit Unit25;

interface

uses
  Windows, Messages, SysUtils, Variants, Classes, Graphics, Controls, Forms,
  Dialogs, ComCtrls, StdCtrls, ExtCtrls, TeEngine, Series, TeeProcs, Chart,
  Menus, ArrowCha,math, CheckLst, GLScene, GLObjects, GLWin32Viewer,
  GLGeomObjects, GLCoordinates, GLCrossPlatform, BaseClasses;

type
  TForm25 = class(TForm)
    Image1: TImage;
    Button1: TButton;
    UpDown1: TUpDown;
    UpDown2: TUpDown;
    UpDown3: TUpDown;
    ColorDialog1: TColorDialog;
    MainMenu1: TMainMenu;
    File1: TMenuItem;
    SaveasBitmap2: TMenuItem;
    CheckBox4: TCheckBox;
    CheckBox2: TCheckBox;
    Image2: TImage;
    SaveDialog1: TSaveDialog;
    CheckBox5: TCheckBox;
    Image5: TImage;
    Options3: TMenuItem;
    CheckBox1: TCheckBox;
    Edit1: TEdit;
    GLScene1: TGLScene;
    GLSceneViewer1: TGLSceneViewer;
    GLCamera1: TGLCamera;
    GLDummyCube1: TGLDummyCube;
    GLLightSource1: TGLLightSource;
    Image3: TImage;
    GLLines1: TGLLines;
    CheckBox3: TCheckBox;
    RadioGroup1: TRadioGroup;
    procedure inout(x,y:integer;triin:array of real;var triout:boolean);
    procedure imagetwo(min,max:real;sect:integer);
    Function ApplyDark(Color:TColor; HowMuch:Byte):TColor;
    procedure det(x1,y1,z1,x2,y2,z2,th1,th2,th3:real;var x3,y3,z3:real);
    procedure Button1Click(Sender: TObject);
    procedure sizing(s:integer);
    procedure imagethree;
    procedure xyztoxz(s,m,r,d,x,y,z,thh1,thh2,thh3:integer;var xx,yy:integer;var dis:real);
    procedure UpDown1MouseUp(Sender: TObject; Button: TMouseButton;
      Shift: TShiftState; X, Y: Integer);
    procedure UpDown1Changing(Sender: TObject; var AllowChange: Boolean);
    procedure UpDown4Changing(Sender: TObject; var AllowChange: Boolean);
    procedure UpDown4MouseUp(Sender: TObject; Button: TMouseButton;
      Shift: TShiftState; X, Y: Integer);
    procedure UpDown2MouseUp(Sender: TObject; Button: TMouseButton;
      Shift: TShiftState; X, Y: Integer);
    procedure UpDown6MouseUp(Sender: TObject; Button: TMouseButton;
      Shift: TShiftState; X, Y: Integer);
    procedure UpDown3MouseUp(Sender: TObject; Button: TMouseButton;
      Shift: TShiftState; X, Y: Integer);
    procedure UpDown3Changing(Sender: TObject; var AllowChange: Boolean);
    procedure UpDown2Changing(Sender: TObject; var AllowChange: Boolean);
    procedure UpDown5Changing(Sender: TObject; var AllowChange: Boolean);
    procedure UpDown6Changing(Sender: TObject; var AllowChange: Boolean);
    procedure FormShow(Sender: TObject);
    procedure CheckBox1Click(Sender: TObject);
    procedure CheckBox2Click(Sender: TObject);
    procedure Image3MouseDown(Sender: TObject; Button: TMouseButton;
      Shift: TShiftState; X, Y: Integer);
    procedure Image3MouseMove(Sender: TObject; Shift: TShiftState; X,
      Y: Integer);
    procedure Image3MouseUp(Sender: TObject; Button: TMouseButton;
      Shift: TShiftState; X, Y: Integer);
    procedure UpDown1Click(Sender: TObject; Button: TUDBtnType);
    procedure UpDown2Click(Sender: TObject; Button: TUDBtnType);
    procedure UpDown3Click(Sender: TObject; Button: TUDBtnType);
    procedure LayersDrawing1Click(Sender: TObject);
    procedure LayerDrawing1Click(Sender: TObject);
    procedure Image1MouseDown(Sender: TObject; Button: TMouseButton;
      Shift: TShiftState; X, Y: Integer);
    procedure Image1MouseUp(Sender: TObject; Button: TMouseButton;
      Shift: TShiftState; X, Y: Integer);
    procedure Image1MouseMove(Sender: TObject; Shift: TShiftState; X,
      Y: Integer);
    procedure UpDown4Click(Sender: TObject; Button: TUDBtnType);
    procedure zoom3d(x,y,z:real);
    procedure CheckBox4Click(Sender: TObject);
    procedure SaveasBitmap2Click(Sender: TObject);
    procedure Options2Click(Sender: TObject);
    procedure CheckBox5Click(Sender: TObject);
    procedure Options3Click(Sender: TObject);
  private
    { Private declarations }
  public
    { Public declarations }
  end;
type
 four = record
  point:array[1..4]of tpoint;
  dis:real;
  col:tcolor;
 end;
type
 two = record
  point:array[1..2]of tpoint;
  dis:real;
  col:tcolor;
 end;
var
  Form25: TForm25;
  mousex,mousey,xf,zf,xmv,ymv,zmv,xmv0,ymv0,zmv0,xx0,yy0,zz0:longint;
  valid:array[1..10] of boolean;
  rec:array[1..10] of real;

  a,b,c,x0,y0,z0,xmax,yf,zmax,zmin,r0,t1,t2,t3,t01,t03,t11,t13:integer;
  zoom:array[1..3]of real;
  shape:array[1..50000]of four;
  Num:array[1..50000]of word;
  line:array[1..50000,1..102]of word;

implementation

uses Unit21, Unit26, Unit29, Unit30, Unit22;

{$R *.dfm}
procedure TForm25.imagetwo(min,max:real;sect:integer);
var
 ii,point:integer;
 jj,jjj,extra,extra2,extra3,kk,extra4,inc1,inc2:real;
 colour:longint;
 bitmap: Tbitmap;
begin
 image2.Canvas.Font.Size:=10;
 extra2:=image2.Canvas.TextWidth(floattostr(max)+'>>-');
 Bitmap := nil;
 try
  Bitmap := TBitmap.Create;
  image2.Canvas.Font.Size:=10;
  bitmap.Width:=round(extra2)+65;
  bitmap.Height:= round(form21.max(image2.height,(1.2*strtoint(form22.StringGrid1.Cells[1,0]))*image2.Canvas.TextHeight('h')+10));
  Image2.Picture.Graphic := Bitmap;
 finally
  Bitmap.Free;
  end;
 image2.Canvas.Font.Size:=10;
 image2.Width:=round(extra2)+65;
 image2.Height:= round(form21.max(image2.height,(1.2*strtoint(form22.StringGrid1.Cells[1,0]))*image2.Canvas.TextHeight('h')+10));
 extra4:=sect;
 Image2.Canvas.Font.Name:='areal';
 image2.Canvas.Font.Size:=10;
 extra3:=(image2.Canvas.TextHeight('9')/2);
 extra:=((image2.Height-2*extra3)/extra4);
 extra:=form21.max(extra,image2.Canvas.TextHeight('9'));
 image2.Canvas.Pen.Color:=clwhite;
 image2.Canvas.Rectangle(0,0,image2.Width,image2.Height);
 image2.Canvas.Font.Color:=clblack;
 jj:=1;
 kk:=0;
 while kk<=image2.Height-2*extra3 do
  begin
   image2.Canvas.TextOut(round(image2.Width-extra2),round(kk),'- '+floattostr(round((min+kk*(max-min)/(image2.Height-2*extra3)))));
   kk:=kk+extra;
   jj:=jj+1;
  end;
 image2.Canvas.TextOut(round(image2.Width-extra2),image2.Height-2*round(extra3),'- '+floattostr(max));
 for ii:=0 to form22.RadioGroup1.Items.count do
  if form22.RadioGroup1.Buttons[ii].Checked then
   break;
 jj:=extra3;
 jjj:=1;
 inc1:=(image2.Height-2*extra3)/extra4;
 inc2:=(form22.image1.Width)/extra4;
 while jj<=image2.Height-round(2*extra3) do
  begin
   Image2.Canvas.Brush.Color:=form22.Image1.Canvas.Pixels[round(jjj),ii*27+3];
   Image2.Canvas.Pen.Color:=form22.Image1.Canvas.Pixels[round(jjj),ii*27+3];
   image2.Canvas.Rectangle(0,round(jj),image2.Width-round(extra2),round(jj+inc1));
   jj:=jj+inc1;
   jjj:=jjj+inc2;
  end;
 image2.Canvas.Brush.Style:=bsClear;
 image2.Canvas.Pen.Color:=clblack;
 image2.Canvas.Rectangle(0,0,image2.Width,image2.Height);
 image5.Canvas.CopyRect(rect(0,0,image5.Width,image5.Height),image2.Canvas,rect(0,0,image2.Width,image2.Height));
end;
Function tForm25.ApplyDark(Color:TColor; HowMuch:Byte):TColor;
Var
 r,g,b:Byte;
Begin
	Color:=ColorToRGB(Color);
	r:=GetRValue(Color);
	g:=GetGValue(Color);
	b:=GetBValue(Color);
	if r>HowMuch then r:=r-HowMuch else r:=0;
	if g>HowMuch then g:=g-HowMuch else g:=0;
	if b>HowMuch then b:=b-HowMuch else b:=0;
	result:=RGB(r,g,b);
End;



procedure TForm25.zoom3d(x,y,z:real);
begin
 zoom[1]:=1/x;
 zoom[2]:=1/y;
 zoom[3]:=1/z;
end;
procedure tForm25.imagethree;
var
 x,y:integer;
 a1,a2,a3:single;
 x1,y1,z1,disex:real;
 triang:array[1..10]of tpoint;
begin
    xyztoxz(2,0,1,0,50,0,0,t1,t2,t3,x,y,disex);
    triang[1].X:=x;
    triang[1].y:=y+20;
    xyztoxz(2,0,1,0,10,30,0,t1,t2,t3,x,y,disex);
    triang[2].X:=x;
    triang[2].y:=y+20;
    xyztoxz(2,0,1,0,30,30,0,t1,t2,t3,x,y,disex);
    triang[3].X:=x;
    triang[3].y:=y+20;
    xyztoxz(2,0,1,0,30,80,0,t1,t2,t3,x,y,disex);
    triang[4].X:=x;
    triang[4].y:=y+20;
    xyztoxz(2,0,1,0,70,80,0,t1,t2,t3,x,y,disex);
    triang[5].X:=x;
    triang[5].y:=y+20;
    xyztoxz(2,0,1,0,70,30,0,t1,t2,t3,x,y,disex);
    triang[6].X:=x;
    triang[6].y:=y+20;
    xyztoxz(2,0,1,0,90,30,0,t1,t2,t3,x,y,disex);
    triang[7].X:=x;
    triang[7].y:=y+20;
    xyztoxz(2,0,1,0,50,0,0,t1,t2,t3,x,y,disex);
    triang[8].X:=x;
    triang[8].y:=y+20;
    det(20,30,0,40,30,0,t1,t2,t3,x1,y1,z1);
    if (5*y1-z1<=0) then
     image3.Canvas.Brush.Color:=clblue
    else
     image3.Canvas.Brush.Color:=clred;
    image3.Canvas.Polygon(slice(triang,8));
    xyztoxz(3,0,1,0,0,0,1,t1,t2,t3,x,y,disex);
    xyztoxz(4,0,1,0,0,1,0,t1,t2,t3,x,y,disex);
    GLLines1.TurnAngle:=-t3;
    GLLines1.PitchAngle:=-t1;
    FORM25.Caption:=FLOATTOSTR(T1)+' '+FLOATTOSTR(T2)+' '+FLOATTOSTR(T3)+' ';


end;

procedure tForm25.sizing(s:integer);
var
 kk,maxz,minz,mapno2:integer;
begin
 mapno2:=mapno;
 if s=1 then
  begin
   form26.Edit1.Text:=inttostr(1*intro[5,mapno2]);
   form26.Edit4.Text:=inttostr(intro[1,mapno2]*intro[5,mapno2]);
   form26.Edit2.Text:=inttostr(1*intro[6,mapno2]);
   form26.Edit5.Text:=inttostr(intro[2,mapno2]*intro[6,mapno2]);
   xf:=trunc(intro[1,mapno2]*intro[5,mapno2]/(1000));
   zf:=trunc(intro[2,mapno2]*intro[6,mapno2]/(100));
  end else if s=2 then
   begin
    form26.Edit1.Text:=inttostr(1);
    form26.Edit4.Text:=inttostr(intro[1,mapno2]);
    form26.Edit2.Text:=inttostr(1);
    form26.Edit5.Text:=inttostr(intro[2,mapno2]);
    xf:=trunc(intro[1,mapno2]/(1000));
    zf:=trunc(intro[2,mapno2]/(100));
   end;
 if mapno2<>3 then
  begin
   maxz:=intro[4,1];
   minz:=intro[3,1];
   for kk:=1 to total[1] do
    begin
     maxz:=trunc((abs(maxz+intro[4,kk])+abs(maxz-intro[4,kk]))/2);
     minz:=trunc((abs(minz+intro[3,kk])-abs(minz-intro[3,kk]))/2);
    end;
   form26.Edit3.Text:=inttostr(minz);
   form26.Edit13.Text:=inttostr(maxz);
  end
 else
  begin
   maxz:=intro[4,3];
   minz:=intro[3,3];
   form26.Edit3.Text:=inttostr(minz);
   form26.Edit13.Text:=inttostr(maxz);
  end;
end;
procedure TForm25.Button1Click(Sender: TObject);
var
 bitmap:TBitmap;
 ss,s,x,y,ii,iii,jj,jjj,kk,maxz,minz,hh,ll,lll,pointt,extra2,extra3:integer;
 fac,extra,disex:real;
 acp,triacp1,triacp2:boolean;
 zbound:array[1..4,1..2]of integer;
 kkk,xex,yex,exsh,xi,yi,si,ssi,sssi:integer;
 matind:array[1..4,1..2]of integer;
 interval:array[1..40]of integer;
 triin:array[0..8]of real;
begin
 triacp1:=false;
 triacp2:=false;
 Bitmap := nil;
 matind[1,1]:=0;matind[1,2]:=0;
 matind[2,1]:=1;matind[2,2]:=0;
 matind[3,1]:=1;matind[3,2]:=1;
 matind[4,1]:=0;matind[4,2]:=1;
  try
    Bitmap := TBitmap.Create;
    Bitmap.Width := 600;
    Bitmap.Height := 600;
    Image1.Picture.Graphic := Bitmap;
    image3.Picture.Graphic := bitmap;
  finally
    Bitmap.Free;
  end;
 valid[2]:=true;
 valid[3]:=true;
 imagethree;
 image1.Canvas.Rectangle(1,1,image1.Width,Image1.Height);
 minz:=intro[3,1];
 maxz:=intro[4,1];
 for kk:=2 to total[1] do
  begin
   maxz:=trunc((abs(maxz+intro[4,kk])+abs(maxz-intro[4,kk]))/2);
   minz:=trunc((abs(minz+intro[3,kk])-abs(minz-intro[3,kk]))/2);
  end;
 exsh:=strtoint(form22.StringGrid1.Cells[1,0]);
 if valid[6] then
  for ii:=0 to exsh do
   begin
    interval[ii+1]:=round(ii*(maxz-minz)/exsh+minz);
   end;
 s:=0;
 jj:=1;
 kkk:=0;
 fac:=(form21.image1.Height-form21.Image1.Canvas.TextHeight('8'))/(maxz-minz);
 ll:=strtoint(form26.edit6.Text);
 kk:=1;
 extra2:=total[1];
 while kk<=extra2  do
  begin
   if kk=3 then
    begin
     extra3:=7;
     acp:=true;
    end
   else
    begin
     acp:=false;
     extra3:=1;
    end;
   if {(form9.CheckListBox1.Checked[kk-extra3])or(acp)}true then
    begin
     ii:=1;
     while (ii)*ll+1<=intro[1,kk] do
      begin
       jj:=1;
       while (jj)*ll+1<=intro[2,kk] do
        begin
         si:=0;
         ssi:=0;
         for xi:=0 to 1 do
          begin
           yi:=xi;
           while yi*sign(0.5-xi)<=(1-xi) do
            begin
             ssi:=ssi+1;
             if (z.z[(ii-xi)*ll+1,(jj-yi)*ll+1,kk]<>error) then
              begin
               si:=si+1;
               zbound[si,1]:=(ii-xi)*ll+1;
               zbound[si,2]:=(jj-yi)*ll+1;
              end
             else
              sssi:=ssi;
             yi:=yi+1*sign(0.5-xi);
            end;
          end;
         if (si=2)and(valid[9]=true)and(kk=1) then
          begin
           s:=s+1;
           num[s]:=s;
           si:=1;
           xyztoxz(1,1,1,s,round(0.5*(zbound[1,1]+zbound[2,1])*intro[5,1]),round(0.5*(zbound[1,2]+zbound[2,2])*intro[6,1]),trunc(0.5*z.z[zbound[1,1],zbound[1,2],2]+0.5*z.z[zbound[1,1],zbound[1,2],1]),t1,t2,t3,lll,iii,shape[s].dis);
           xyztoxz(1,1,1,0,trunc(zbound[si,1]*intro[5,1]),trunc(zbound[si,2]*intro[6,1]),trunc(z.z[zbound[si,1],zbound[si,2],1]),t1,t2,t3,shape[s].point[1].x,shape[s].point[1].y,shape[s].dis);
           si:=2;
           xyztoxz(1,1,1,0,trunc(zbound[si,1]*intro[5,1]),trunc(zbound[si,2]*intro[6,1]),trunc(z.z[zbound[si,1],zbound[si,2],1]),t1,t2,t3,shape[s].point[2].x,shape[s].point[2].y,disex);
           si:=2;
           xyztoxz(1,1,1,0,trunc(zbound[si,1]*intro[5,2]),trunc(zbound[si,2]*intro[6,2]),trunc(z.z[zbound[si,1],zbound[si,2],2]),t1,t2,t3,shape[s].point[3].x,shape[s].point[3].y,disex);
           si:=1;
           xyztoxz(1,1,1,0,trunc(zbound[si,1]*intro[5,2]),trunc(zbound[si,2]*intro[6,2]),trunc(z.z[zbound[si,1],zbound[si,2],2]),t1,t2,t3,shape[s].point[4].x,shape[s].point[4].y,disex);
           shape[s].col:=clgray;
          end;
         if (si=3) then
          begin
           s:=s+1;
           num[s]:=s;
           xyztoxz(1,1,1,s,trunc(zbound[3,1]*intro[5,1]),trunc(zbound[3,2]*intro[6,1]),trunc(z.z[zbound[3,1],zbound[3,2],kk]),t1,t2,t3,shape[s].point[4].x,shape[s].point[4].y,shape[s].dis);
           xyztoxz(1,1,1,0,trunc(zbound[1,1]*intro[5,1]),trunc(zbound[1,2]*intro[6,1]),trunc(z.z[zbound[1,1],zbound[1,2],kk]),t1,t2,t3,shape[s].point[1].x,shape[s].point[1].y,disex);
           xyztoxz(1,1,1,0,trunc(zbound[2,1]*intro[5,1]),trunc(zbound[2,2]*intro[6,1]),trunc(z.z[zbound[2,1],zbound[2,2],kk]),t1,t2,t3,shape[s].point[2].x,shape[s].point[2].y,disex);
           xyztoxz(1,1,1,0,trunc(zbound[3,1]*intro[5,1]),trunc(zbound[3,2]*intro[6,1]),trunc(z.z[zbound[3,1],zbound[3,2],kk]),t1,t2,t3,shape[s].point[3].x,shape[s].point[3].y,disex);
           pointt:=round(fac*(z.z[zbound[1,1],zbound[1,2],kk]-minz)+1);
           shape[s].col:=form21.image1.Canvas.Pixels[3,pointt];
          end;
         if (si=4) then
          begin
           s:=s+1;
           num[s]:=s;
           xyztoxz(1,1,1,s,trunc(zbound[1,1]*intro[5,kk]),trunc(zbound[1,2]*intro[6,kk]),trunc(z.z[zbound[1,1],zbound[1,2],kk]),t1,t2,t3,shape[s].point[1].x,shape[s].point[1].y,shape[s].dis);
           xyztoxz(1,1,1,0,trunc(zbound[2,1]*intro[5,kk]),trunc(zbound[2,2]*intro[6,kk]),trunc(z.z[zbound[2,1],zbound[2,2],kk]),t1,t2,t3,shape[s].point[2].x,shape[s].point[2].y,disex);
           xyztoxz(1,1,1,0,trunc(zbound[3,1]*intro[5,kk]),trunc(zbound[3,2]*intro[6,kk]),trunc(z.z[zbound[3,1],zbound[3,2],kk]),t1,t2,t3,shape[s].point[3].x,shape[s].point[3].y,disex);
           xyztoxz(1,1,1,0,trunc(zbound[si,1]*intro[5,kk]),trunc(zbound[si,2]*intro[6,kk]),trunc(z.z[zbound[si,1],zbound[si,2],kk]),t1,t2,t3,shape[s].point[4].x,shape[s].point[4].y,disex);

           triin[0]:=0;
           triin[1]:=shape[s].point[1].x;triin[2]:=shape[s].point[1].y;
           triin[3]:=shape[s].point[2].x;triin[4]:=shape[s].point[2].y;
           triin[5]:=shape[s].point[3].x;triin[6]:=shape[s].point[3].y;
           triin[7]:=shape[s].point[4].x;triin[8]:=shape[s].point[4].y;
           inout(mousex,mousey,triin,triacp2);
           pointt:=round(fac*(0.25*(z.z[zbound[1,1],zbound[1,2],kk]+z.z[zbound[2,1],zbound[2,2],kk]+z.z[zbound[3,1],zbound[3,2],kk]+z.z[zbound[si,1],zbound[si,2],kk])-minz)+1);
           if (triacp1)or(triacp2) then
            shape[s].col:=clblue
           else
            shape[s].col:=form21.image1.Canvas.Pixels[3,pointt];
           if (valid[6]) then
            begin
             valid[7]:=true;
             for lll:=1 to exsh do
              begin
               if not(((interval[lll]<z.z[zbound[1,1],zbound[1,2],kk])and(interval[lll]<z.z[zbound[2,1],zbound[2,2],kk])
               and(interval[lll]<z.z[zbound[2,1],zbound[2,2],kk])and(interval[lll]<z.z[zbound[3,1],zbound[3,2],kk]))
               or((interval[lll]>z.z[zbound[3,1],zbound[3,2],kk])and(interval[lll]>z.z[zbound[4,1],zbound[4,2],kk])
               and(interval[lll]>z.z[zbound[4,1],zbound[4,2],kk])and(interval[lll]>z.z[zbound[1,1],zbound[1,2],kk])))then
                begin
                 if valid[7] then
                  begin
                   kkk:=kkk+1;
                   valid[7]:=false;
                  end;
                 jjj:=0;
                 line[kkk,1]:=s;
                 line[kkk,2]:=line[kkk,2]+1;
                 for iii:=1 to 4 do
                  begin
                   if(interval[lll]-z.z[(ii-1+matind[iii,1])*ll+1,(jj-1+matind[iii,2])*ll+1,kk])*(interval[lll]-z.z[(ii-1+matind[((iii) mod 4)+1,1])*ll+1,(jj-1+matind[((iii) mod 4)+1,2])*ll+1,kk])<0 then
                    begin
                     jjj:=jjj+1;
                     extra:=(interval[lll]-z.z[(ii-1+matind[iii,1])*ll+1,(jj-1+matind[iii,2])*ll+1,kk])/(z.z[(ii-1+matind[((iii) mod 4)+1,1])*ll+1,(jj-1+matind[((iii) mod 4)+1,2])*ll+1,kk]-z.z[(ii-1+matind[iii,1])*ll+1,(jj-1+matind[iii,2])*ll+1,kk]);
                     xex:=round(intro[5,kk]*(extra*ll*(matind[((iii) mod 4)+1,1]-matind[iii,1])+(ii-1+matind[iii,1])*ll+1));
                     yex:=round(intro[6,kk]*(extra*ll*(matind[((iii) mod 4)+1,2]-matind[iii,2])+(jj-1+matind[iii,2])*ll+1));
                     //xyztoxz(1,1,1,0,xex,yex,interval[lll],t1,t2,t3,line[kkk,3+2*(jjj-1)+4*(line[kkk,2]-1)],line[kkk,4+2*(jjj-1)+4*(line[kkk,2]-1)],disex);
                    end;
                  end;
                end;
              end;
            end;
          end
         else if (valid[8])then
          begin
          end;
         jj:=jj+1;
        end;
       ii:=ii+1;
      end;
    end;
   kk:=kk+1;
  end;
 for jj:=1 to s do
  begin
   pointt:=0;
   for ii:=jj to s do
    begin
     if (shape[Num[ii]].dis)>(shape[Num[jj]].dis) then
      begin
       exsh:=Num[ii];
       Num[ii]:=Num[jj];
       Num[jj]:=exsh;
      end;
    end;
  end;
 for ii:=1 to s do
  with image1.Canvas do
   begin
    if CheckBox1.Checked then
     begin
      Application.ProcessMessages;
      sleep(strtoint(edit1.Text));
     end;
    brush.Style:=bsSolid;
    brush.Color:=shape[Num[ii]].col;
    Pen.Color:=applydark(brush.Color,30);
    Polygon(slice(shape[num[ii]].point,4));
    if (valid[6])  then
     begin
      jj:=1;
      while (line[jj,1]<>num[ii])and(jj<=s) do
       jj:=jj+1;
      for kk:=0 to line[jj,2]-1 do
       begin
        Pen.Color:=clblack;
        polygon([point(line[jj,3+4*kk],line[jj,4+4*kk]),point(line[jj,5+4*kk],line[jj,6+4*kk])]);
       end;
     end;
   end;
 { for kk:=1 to total[1] do
  begin
   if Form9.CheckListBox1.Checked[kk-1] then
    begin
     ii:=1;
     while (ii-1)*ll+1<=intro[1,mapno]+1 do
      begin
       jj:=1;
       while (jj-1)*ll+1<=1+intro[2,mapno] do
        begin
         if (z.z[(ii-1)*ll+1,(jj-1)*ll+1,kk]<>error)and(z.z[(ii-1)*ll+1,(jj)*ll+1,kk]<>error) then
          begin
           point:=trunc(fac*(z.z[(ii-1)*ll+1,(jj-1)*ll+1,kk]-minz)+1);
           image1.Canvas.Pen.Color:=form21.image1.Canvas.Pixels[3,point];
           image1.Canvas.MoveTo(xx[ii,jj,kk],yy[ii,jj,kk]);
           image1.Canvas.LineTo(xx[ii,jj+1,kk],yy[ii,jj+1,kk]);
          end;
         jj:=jj+1;
        end;
       ii:=ii+1;
      end;
    end;
  end;
{ minz:=strtoint(form10.Edit3.Text);
 maxz:=strtoint(form10.Edit4.Text);
 intro[1,mapno]:=strtoint(form10.Edit1.Text);
 intro[2,mapno]:=strtoint(form10.Edit2.Text);   }
 image1.Canvas.Pen.Color:=clblue;
 image1.Canvas.Brush.Color:=clblack;
 if CheckBox2.Checked then
  begin
   xyztoxz(1,1,1,0,1,1,minz,t1,t2,t3,x,y,disex);
   image1.Canvas.MoveTo(x,y);
   ii:=x;
   jj:=y;
   xyztoxz(1,1,1,0,intro[1,mapno]*intro[5,1],1,minz,t1,t2,t3,x,y,disex);
   image1.Canvas.LineTo(x,y);
   xyztoxz(1,1,1,0,1,1,minz,t1,t2,t3,x,y,disex);
   image1.Canvas.MoveTo(x,y);
   xyztoxz(1,1,1,0,1,intro[2,mapno]*intro[5,1],minz,t1,t2,t3,x,y,disex);
   image1.Canvas.LineTo(x,y);
   xyztoxz(1,1,1,0,1,1,minz,t1,t2,t3,x,y,disex);
   image1.Canvas.MoveTo(x,y);
   xyztoxz(1,1,1,0,1,1,maxz,t1,t2,t3,x,y,disex);
   image1.Canvas.LineTo(x,y);
   image1.Canvas.TextOut(ii,jj-image1.Canvas.TextHeight('88')-2,'('+inttostr(intro[9,1])+','+inttostr(intro[11,1])+','+inttostr(minz)+')');

   xyztoxz(1,1,1,0,1,intro[2,mapno]*intro[5,1],maxz,t1,t2,t3,x,y,disex);
   image1.Canvas.MoveTo(x,y);
   xyztoxz(1,1,1,0,1,intro[2,mapno]*intro[5,1],minz,t1,t2,t3,x,y,disex);
   image1.Canvas.LineTo(x,y);
   xyztoxz(1,1,1,0,1,intro[2,mapno]*intro[5,1],maxz,t1,t2,t3,x,y,disex);
   image1.Canvas.MoveTo(x,y);
   xyztoxz(1,1,1,0,1,1,maxz,t1,t2,t3,x,y,disex);
   image1.Canvas.LineTo(x,y);
   xyztoxz(1,1,1,0,1,intro[2,mapno]*intro[5,1],maxz,t1,t2,t3,x,y,disex);
   image1.Canvas.MoveTo(x,y);
   xyztoxz(1,1,1,0,intro[1,mapno]*intro[5,1],intro[2,mapno]*intro[5,1],maxz,t1,t2,t3,x,y,disex);
   image1.Canvas.LineTo(x,y);

   xyztoxz(1,1,1,0,intro[1,mapno]*intro[5,1],intro[2,mapno]*intro[5,1],minz,t1,t2,t3,x,y,disex);
   image1.Canvas.MoveTo(x,y);
   xyztoxz(1,1,1,0,1,intro[2,mapno]*intro[5,1],minz,t1,t2,t3,x,y,disex);
   image1.Canvas.LineTo(x,y);
   xyztoxz(1,1,1,0,intro[1,mapno]*intro[5,1],intro[2,mapno]*intro[5,1],minz,t1,t2,t3,x,y,disex);
   image1.Canvas.MoveTo(x,y);
   xyztoxz(1,1,1,0,intro[1,mapno]*intro[5,1],1,minz,t1,t2,t3,x,y,disex);
   image1.Canvas.LineTo(x,y);
   xyztoxz(1,1,1,0,intro[1,mapno]*intro[5,1],intro[2,mapno]*intro[5,1],minz,t1,t2,t3,x,y,disex);
   image1.Canvas.MoveTo(x,y);
   xyztoxz(1,1,1,0,intro[1,mapno]*intro[5,1],intro[2,mapno]*intro[5,1],maxz,t1,t2,t3,x,y,disex);
   image1.Canvas.LineTo(x,y);

   xyztoxz(1,1,1,0,intro[1,mapno]*intro[5,1],1,maxz,t1,t2,t3,x,y,disex);
   image1.Canvas.MoveTo(x,y);
   xyztoxz(1,1,1,0,intro[1,mapno]*intro[5,1],1,minz,t1,t2,t3,x,y,disex);
   image1.Canvas.LineTo(x,y);
   xyztoxz(1,1,1,0,intro[1,mapno]*intro[5,1],1,maxz,t1,t2,t3,x,y,disex);
   image1.Canvas.MoveTo(x,y);
   xyztoxz(1,1,1,0,1,1,maxz,t1,t2,t3,x,y,disex);
   image1.Canvas.LineTo(x,y);
   xyztoxz(1,1,1,0,intro[1,mapno]*intro[5,1],1,maxz,t1,t2,t3,x,y,disex);
   image1.Canvas.MoveTo(x,y);
   xyztoxz(1,1,1,0,intro[1,mapno]*intro[5,1],intro[2,mapno]*intro[5,1],maxz,t1,t2,t3,x,y,disex);
   image1.Canvas.LineTo(x,y);
   image1.Canvas.TextOut(x-image1.Canvas.TextWidth('('+inttostr(intro[10,1])+','+inttostr(intro[12,1])+','+inttostr(maxz)+')'),y+2,'('+inttostr(intro[9,1])+','+inttostr(intro[12,1])+','+inttostr(maxz)+')');
  end;
{ if CheckBox1.Checked then
  begin
   ii:=1;
   image1.Canvas.Pen.Color:=clgray;
   while ii<=intro[1,mapno]+1 do
    begin
     jj:=1;
     while jj<=intro[2,mapno]+1 do
      begin
       xyztoxz(1,1,1,ii+15,jj,maxz,t1,t2,t3,x,y);
       image1.Canvas.MoveTo(x,y);
       xyztoxz(1,1,1,ii+25,jj,maxz,t1,t2,t3,x,y);
       image1.Canvas.LineTo(x,y);
       jj:=jj+trunc(intro[2,mapno]/5);
      end;
     ii:=ii+trunc(intro[1,mapno]/5);
    end;
   ii:=1;
   while ii<=intro[1,mapno]+1 do
    begin
     jj:=1;
     while jj<=intro[2,mapno]+1 do
      begin
       xyztoxz(1,1,1,ii,jj+40,maxz,t1,t2,t3,x,y);
       image1.Canvas.MoveTo(x,y);
       xyztoxz(1,1,1,ii,jj+50,maxz,t1,t2,t3,x,y);
       image1.Canvas.LineTo(x,y);
       jj:=jj+trunc(intro[2,mapno]/5);
      end;
     ii:=ii+trunc(intro[1,mapno]/5);
    end;
  end;      }
end;

procedure tForm25.xyztoxz(s,m,r,d,x,y,z,thh1,thh2,thh3:integer;var xx,yy:integer;var dis:real);
var
th1,th2,th3:real;
zzz,yyy,yf:integer;
begin
 th1:=r*pi*thh1/180;
 th2:=r*pi*thh2/180;
 th3:=r*pi*thh3/180;
 if (s=1)and(valid[2]) then
  begin
   valid[2]:=false;
   r0:=strtoint(form26.Edit14.Text);
   x0:=strtoint(form26.edit1.Text)+strtoint(form26.edit4.Text);
   y0:=strtoint(form26.edit2.Text)+strtoint(form26.edit5.Text);
   z0:=strtoint(form26.edit3.Text)+strtoint(form26.edit13.Text);
   x0:=trunc(x0/2);
   y0:=trunc(y0/2);
   z0:=trunc(z0/2);
   a:=ROUND(0.5*intro[1,mapno]*intro[5,1]);
   b:=ROUND(0.5*intro[2,mapno]*intro[6,1]);
   c:=trunc(0.5*intro[3,1]+0.5*intro[4,1]);
   xmax:=x0+round(zoom[1]*(strtoint(form26.edit4.Text)-x0));
   yf:=y0+round(zoom[2]*(strtoint(form26.edit5.Text)-y0));
   zmax:=z0+round(zoom[3]*(strtoint(form26.edit13.Text)-z0));
   zmin:=z0-round(zoom[3]*(strtoint(form26.edit13.Text)-z0));
   rec[1]:=(xmax-x0)*r0/(r0+(y0-yf));
   rec[2]:=(zmax-z0)*r0/(r0+(y0-yf));
   rec[3]:=(r0+(y0-yf))*Image1.Width/(2*(xmax-x0)*r0);
   rec[4]:=(r0+(y0-yf))*Image1.Height/((zmax-zmin)*r0);
  end
 else if (s=2)and(valid[3]) then
  begin
   valid[3]:=false;
   r0:=500;
   x0:=50;
   y0:=35;
   z0:=-100;
   a:=50;
   b:=35;
   c:=0;
   xmax:=100;
   yf:=100;
   zmax:=100;
   zmin:=-100;
   total[4]:=round(power(10,trunc(ln(r0)/ln(10))+1)/2);
   rec[1]:=(x0-1)*r0/(r0+(y0-yf));
   rec[2]:=(z0-zmin)*r0/(r0+(y0-yf));
   rec[3]:=Image3.Width/((xmax-1)*r0/(r0+(y0-yf)));
   rec[4]:=Image3.Height/((zmax-zmin)*r0/(r0+(y0-yf)));
  end
 else if (s=3)or(s=4) then
      begin
        a:=0;
        b:=0;
        c:=0;
        m:=0;
      end;
 x:=x-a;
 y:=y-b;
 z:=z-c;
 zzz:=trunc(z*cos(th2)+x*sin(th2));
 x:=trunc(x*cos(th2)-z*sin(th2));
 z:=zzz;

 yyy:=trunc(y*cos(th3)+x*sin(th3));
 x:=trunc(x*cos(th3)-y*sin(th3));
 y:=yyy;

 yyy:=trunc(y*cos(th1)+z*sin(th1));
 z:=trunc(z*cos(th1)-y*sin(th1));
 y:=yyy;
 z:=z+m*zmv+c;
 x:=x+m*xmv+a;
 y:=y+m*ymv+b;
 if r0+(y0-y)<>0 then
  begin
   xx:=round(((x-x0)*r0/(r0+(y0-y))+rec[1])*rec[3]);
   yy:=round(((z-z0)*r0/(r0+(y0-y))+rec[2])*rec[4]);
  end;
 if d<>0 then
  begin
   dis:=sqrt(((r0+y0-y)/total[4]*(r0+y0-y)/total[4]+(x-x0)/total[4]*(x-x0)/total[4]+(z-z0)/total[4]*(z-z0)/total[4]));
  end;
 { xx2:=(x-x0)/(xmax-x0)*rec[3]+rec[1];
 xx1:=(x-x0)/(xmax-x0)*rec[1]+rec[1];
 aa:=r0/(r0+(y0-y));
 xx:=+trunc(aa*(xx1-xx2)+xx2);

 yy2:=(z-z0)/(zmax-z0)*rec[4]+rec[2];
 yy1:=(z-z0)/(zmax-z0)*rec[2]+rec[2];
 yy:=+trunc(aa*(yy1-yy2)+yy2);   }
end;
procedure tForm25.det(x1,y1,z1,x2,y2,z2,th1,th2,th3:real;var x3,y3,z3:real);
var
 zzz:real;
 begin
 th1:=pi*th1/180;
 th2:=pi*th2/180;
 th3:=pi*th3/180;

 zzz:=trunc(z1*cos(th2)+x1*sin(th2));
 x1:=trunc(x1*cos(th2)-z1*sin(th2));
 z1:=zzz;

 zzz:=trunc(y1*cos(th3)+x1*sin(th3));
 x1:=trunc(x1*cos(th3)-y1*sin(th3));
 y1:=zzz;

 zzz:=trunc(y1*cos(th1)+z1*sin(th1));
 z1:=trunc(z1*cos(th1)-y1*sin(th1));
 y1:=zzz;

 zzz:=trunc(z2*cos(th2)+x2*sin(th2));
 x2:=trunc(x2*cos(th2)-z2*sin(th2));
 z2:=zzz;

 zzz:=trunc(y2*cos(th3)+x2*sin(th3));
 x2:=trunc(x2*cos(th3)-y2*sin(th3));
 y2:=zzz;

 zzz:=trunc(y2*cos(th1)+z2*sin(th1));
 z2:=trunc(z2*cos(th1)-y2*sin(th1));
 y2:=zzz;


  x3:=y1*z2-z1*y2;
  y3:=z1*x2-x1*z2;
  z3:=x1*y2-x2*y1;
 end;



procedure TForm25.UpDown1MouseUp(Sender: TObject; Button: TMouseButton;
  Shift: TShiftState; X, Y: Integer);
begin
 form26.edit6.Text:=form26.edit8.text;
 button1.Click;
end;

procedure TForm25.UpDown1Changing(Sender: TObject;
  var AllowChange: Boolean);
begin
 form26.edit6.Text:=form26.edit7.text;
 button1.Click;
end;

procedure TForm25.UpDown4Changing(Sender: TObject;
  var AllowChange: Boolean);
begin
 form26.edit6.Text:=form26.edit7.text;
 button1.Click;
end;

procedure TForm25.UpDown4MouseUp(Sender: TObject; Button: TMouseButton;
  Shift: TShiftState; X, Y: Integer);
begin
 form26.edit6.Text:=form26.edit8.text;
 button1.Click;
end;

procedure TForm25.UpDown2MouseUp(Sender: TObject; Button: TMouseButton;
  Shift: TShiftState; X, Y: Integer);
begin
 form26.edit6.Text:=form26.edit8.text;
 button1.Click;
end;

procedure TForm25.UpDown6MouseUp(Sender: TObject; Button: TMouseButton;
  Shift: TShiftState; X, Y: Integer);
begin
 form26.edit6.Text:=form26.edit8.text;
 button1.Click;
end;

procedure TForm25.UpDown3MouseUp(Sender: TObject; Button: TMouseButton;
  Shift: TShiftState; X, Y: Integer);
begin
 form26.edit6.Text:=form26.edit8.text;
 button1.Click;
end;

procedure TForm25.UpDown3Changing(Sender: TObject;
  var AllowChange: Boolean);
begin
 form26.edit6.Text:=form26.edit7.text;
 button1.Click;
end;

procedure TForm25.UpDown2Changing(Sender: TObject;
  var AllowChange: Boolean);
begin
 form26.edit6.Text:=form26.edit7.text;
 button1.Click;
end;

procedure TForm25.UpDown5Changing(Sender: TObject;
  var AllowChange: Boolean);
begin
 form26.edit6.Text:=form26.edit7.text;
 button1.Click;
end;

procedure TForm25.UpDown6Changing(Sender: TObject;
  var AllowChange: Boolean);
begin
 form26.edit6.Text:=form26.edit7.text;
 button1.Click;
end;




procedure TForm25.FormShow(Sender: TObject);
var
 ii:integer;
begin
// image2.Canvas.CopyRect(rect(0,0,image2.Width,image2.Height),form21.Image1.Canvas,rect(0,0,image2.Width,image2.Height));
 zoom[1]:=1/strtofloat(form26.Edit10.Text);
 zoom[2]:=1/strtofloat(form26.Edit11.Text);
 zoom[3]:=1/strtofloat(form26.Edit12.Text);
 xmv:=0;
 ymv:=0;
 zmv:=0;
 sizing(1);
 button1.Click;
 imagetwo(StrToInt(form26.Edit3.Text),StrToInt(form26.Edit13.Text),strtoint(form22.StringGrid1.Cells[1,0])); t3:=updown1.Position;
 t2:=updown2.Position;
 t1:=updown3.Position;
 xmv:=0;
 ymv:=0;
 zmv:=0;
end;

procedure TForm25.CheckBox1Click(Sender: TObject);
begin
 button1.Click;
end;

procedure TForm25.CheckBox2Click(Sender: TObject);
begin

 Button1.Click;
end;

procedure TForm25.Image3MouseDown(Sender: TObject; Button: TMouseButton;
  Shift: TShiftState; X, Y: Integer);
begin
 total[22]:=1;
end;

procedure TForm25.Image3MouseMove(Sender: TObject; Shift: TShiftState; X,
  Y: Integer);
begin
 if total[22]=1 then
  begin
   image3.Left:=image3.Left+X;
   image3.Top:=Image3.Top+Y;
  end;
end;

procedure TForm25.Image3MouseUp(Sender: TObject; Button: TMouseButton;
  Shift: TShiftState; X, Y: Integer);
begin
 total[22]:=0;
end;

procedure TForm25.UpDown1Click(Sender: TObject; Button: TUDBtnType);
begin
 if  updown1.Position>360 then
  updown1.Position:=updown1.Position mod 360;
 if  updown1.Position<0 then
  updown1.Position:=updown1.Position + 360;
 t3:=updown1.Position;
end;

procedure TForm25.UpDown2Click(Sender: TObject; Button: TUDBtnType);
begin
 if updown2.Position>360 then
  updown2.Position:=updown2.Position mod 360;
 if  updown2.Position<0 then
  updown2.Position:=updown2.Position + 360;
 form26.edit6.Text:=form26.edit7.text;
 t2:=UpDown2.Position;
end;

procedure TForm25.UpDown3Click(Sender: TObject; Button: TUDBtnType);
begin
 if updown3.Position>360 then
  updown3.Position:=updown3.Position mod 360;
 if  updown3.Position<0 then
  updown3.Position:=updown3.Position + 360;
 form26.edit6.Text:=form26.edit7.text;
 t1:=UpDown3.Position;
end;

procedure TForm25.LayersDrawing1Click(Sender: TObject);
begin
 form29.showmodal;
end;

procedure TForm25.LayerDrawing1Click(Sender: TObject);
begin
 form29.ShowModal;
end;

procedure TForm25.Image1MouseDown(Sender: TObject; Button: TMouseButton;
  Shift: TShiftState; X, Y: Integer);
begin
 valid[1]:=true;
 form26.edit6.Text:=form26.edit7.text;
 if RadioGroup1.ItemIndex=0 then
  begin
   xx0:=x;
   zz0:=y;
  end;
 if RadioGroup1.ItemIndex=1 then
  begin
   xx0:=x;
   zz0:=y;
  end;
 if RadioGroup1.ItemIndex=2 then
  begin
   xx0:=x;
   zz0:=y;
  end;
end;

procedure TForm25.Image1MouseUp(Sender: TObject; Button: TMouseButton;
  Shift: TShiftState; X, Y: Integer);
begin
 form26.edit6.Text:=form26.edit8.text;
 if RadioGroup1.ItemIndex=0 then
  begin
   xmv0:=xmv;
   zmv0:=zmv;
  end;
 if RadioGroup1.ItemIndex=1 then
  begin
   ymv0:=ymv;
  end;
 if RadioGroup1.ItemIndex=2 then
  begin
   t01:=t1;
   t03:=t3;
  end;
 valid[1]:=false;
 image1.Cursor:=crDefault;
 if CheckBox4.Checked then
  valid[6]:=true
 else
  valid[6]:=false;
 if CheckBox5.Checked then
  valid[9]:=true
 else
  valid[9]:=false;
 button1.Click;

end;

procedure TForm25.Image1MouseMove(Sender: TObject; Shift: TShiftState; X,
  Y: Integer);
var
 a,b,c:real;
begin
 if valid[1]=true then
  begin
   if RadioGroup1.ItemIndex=0 then
    begin
     xmv:=xmv0+trunc(intro[1,mapno]*intro[5,1]/image1.Width*(x-xx0));
     zmv:=zmv0+trunc((strtofloat(form26.edit13.text)-strtofloat(form26.edit3.text))/image1.Height*(y-zz0));
    end
   else if RadioGroup1.ItemIndex=1 then
    begin
     ymv:=ymv0+trunc(intro[1,mapno]*((y-zz0)/(image1.Height/2)*intro[6,1]));
    end
   else if RadioGroup1.ItemIndex=2 then
    begin
     a:=(strtofloat(form26.edit1.Text)-strtofloat(form26.edit4.Text))*(-x+xx0)/(image1.Width);
     c:=(strtofloat(form26.edit2.Text)-strtofloat(form26.edit5.Text))*(-y+zz0)/(image1.Height);
     b:=strtofloat(form26.edit14.Text);
     t1:=t01+round(180*arctan(4*c*b/(4*c*c-b*b))/3.14);
     t3:=t03+round(180*arctan(4*a*b/(4*A*A-b*b))/3.14);
    end;
   valid[6]:=false;
   valid[9]:=false;
   button1.Click;
  end;
 if checkbox3.Checked=true then
  begin
   mousex:=x;
   mousey:=y;
   button1.Click;
  end;
end;
procedure TForm25.inout(x,y:integer;triin:array of real;var triout:boolean);
var
 m,b,a:array [1..3] of real;
 ot:real;
begin
 m[1]:=(triin[2]-triin[4])/(triin[1]-triin[3]);
 b[1]:=triin[2]-m[1]*triin[1];
 m[2]:=(triin[6]-triin[4])/(triin[5]-triin[3]);
 b[2]:=triin[4]-m[2]*triin[3];
 m[3]:=(triin[2]-triin[6])/(triin[1]-triin[5]);
 b[3]:=triin[6]-m[3]*triin[5];
 a[1]:=sign((y-m[1]*x-b[1])*(triin[6]-m[1]*triin[5]-b[1]));
 a[2]:=sign((y-m[2]*x-b[2])*(triin[2]-m[2]*triin[1]-b[2]));
 a[3]:=sign((y-m[3]*x-b[3])*(triin[4]-m[3]*triin[3]-b[3]));
 ot:=a[1]+a[2]+a[3];
 if ot=3 then
  triout:=true
 else
  triout:=false;
end;

procedure TForm25.UpDown4Click(Sender: TObject; Button: TUDBtnType);
begin
 button1.Click;
end;

procedure TForm25.CheckBox4Click(Sender: TObject);
begin
 if CheckBox4.Checked then
  valid[6]:=true
 else
  valid[6]:=false;
 button1.Click;
end;

procedure TForm25.SaveasBitmap2Click(Sender: TObject);
var
bitmap:tbitmap;
begin
 Bitmap := nil;
  try
   Bitmap := TBitmap.Create;
   bitmap.Width:=image1.Width+image5.width;
   bitmap.Height:=image1.Height;
   Image2.Picture.Graphic := Bitmap;
  finally
   Bitmap.Free;
  end;
 image2.Width:=image1.Width+image5.width;
 image2.Height:=image1.Height;
 image2.Canvas.CopyRect(rect(0,0,image1.Width,image1.Height),image1.Canvas,rect(0,0,image1.Width,image1.Height));
 image2.Canvas.CopyRect(rect(0,0,image3.Width,image3.Height),image3.Canvas,rect(0,0,image3.Width,image3.Height));
 image2.Canvas.CopyRect(rect(image1.Width,50,image1.Width+image5.Width,image5.Height+50),image5.Canvas,rect(0,0,image5.Width,image5.Height));
 if SaveDialog1.Execute then
  image2.Picture.SaveToFile(SaveDialog1.FileName);
end;

procedure TForm25.Options2Click(Sender: TObject);
begin
 form29.Show;
end;

procedure TForm25.Options3Click(Sender: TObject);
begin
 form26.ShowModal;
end;

procedure TForm25.CheckBox5Click(Sender: TObject);
begin
 if CheckBox5.Checked then
  valid[9]:=true
 else
  valid[9]:=false;
 button1.Click;
end;


end.
