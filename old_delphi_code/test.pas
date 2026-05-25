unit test;

interface

uses
  Windows, Messages, SysUtils, Variants, Classes, Graphics, Controls, Forms,
  Dialogs, StdCtrls,math, Grids;

type
 point = record
  ns,ew,tvd:real;
end;
type
  TForm1 = class(TForm)
    Button1: TButton;
    StringGrid1: TStringGrid;
    Button2: TButton;
    procedure Button1Click(Sender: TObject);
    procedure surtovct(inc,azm:real;var ns,ew,tvd:real);
    procedure vcttosur(ns,ew,tvd:real;var inc,azm:real);
    procedure Button2Click(Sender: TObject);
    procedure plane(a1,a2,a3:point; var a4:point;var theta:real);
    procedure revplane(a1,a2,a3:point;theta:real; var a4:point);
    procedure rotation(u: Real; v: Real; w: Real; a: Real; b: Real; c: Real; theta: real; var x: Real; var y: Real; var z: Real);
  private
    { Private declarations }
  public
    { Public declarations }
  end;

var
  Form1: TForm1;

implementation

{$R *.dfm}

procedure TForm1.Button2Click(Sender: TObject);
var
 a,b,c,d:real;
 e,f,g:real;
 p1,p2,p3,p4,p5,o:point;
begin
 p1.ns:=0;  p1.ew:=0;   p1.tvd:=0;
 p2.ns:=strtofloat(StringGrid1.Cells[0,1]);
 p2.ew:=strtofloat(StringGrid1.Cells[1,1]);
 p2.tvd:=strtofloat(StringGrid1.Cells[2,1]);
 d:=strtofloat(StringGrid1.Cells[3,1]);
 p3.ns:=strtofloat(StringGrid1.Cells[0,2]);
 p3.ew:=strtofloat(StringGrid1.Cells[1,2]);
 p3.tvd:=strtofloat(StringGrid1.Cells[2,2]);
 if d<>-999 then
  d:=d/180*pi;
 p4:=p2;
 p5:=p3;
 plane(p1,p2,p3,p4,d);
 a:=p4.ns;  b:=p4.ew;   c:=p4.tvd;
 StringGrid1.Cells[0,3]:=floattostr(a);
 StringGrid1.Cells[1,3]:=floattostr(b);
 StringGrid1.Cells[2,3]:=floattostr(c);
 plane(p1,p2,p3,p5,d);
 a:=p5.ns;  b:=p5.ew;   c:=p5.tvd;
 StringGrid1.Cells[0,4]:=floattostr(a);
 StringGrid1.Cells[1,4]:=floattostr(b);
 StringGrid1.Cells[2,4]:=floattostr(c);


 p1.ns:=0;  p1.ew:=0;   p1.tvd:=0;
 p4.ns:=strtofloat(StringGrid1.Cells[0,3]);
 p4.ew:=strtofloat(StringGrid1.Cells[1,3]);
 p4.tvd:=strtofloat(StringGrid1.Cells[2,3]);
 if StringGrid1.Cells[3,1]<>'-999' then
  d:=strtofloat(StringGrid1.Cells[3,1]);
 p5.ns:=strtofloat(StringGrid1.Cells[0,4]);
 p5.ew:=strtofloat(StringGrid1.Cells[1,4]);
 p5.tvd:=strtofloat(StringGrid1.Cells[2,4]);



 revplane(p1,p2,p3,d,p4);
 a:=p4.ns;  b:=p4.ew;   c:=p4.tvd;
 StringGrid1.Cells[0,5]:=floattostr(a);
 StringGrid1.Cells[1,5]:=floattostr(b);
 StringGrid1.Cells[2,5]:=floattostr(c);
 revplane(p1,p2,p3,d,p5);
 a:=p5.ns;  b:=p5.ew;   c:=p5.tvd;
 StringGrid1.Cells[0,6]:=floattostr(a);
 StringGrid1.Cells[1,6]:=floattostr(b);
 StringGrid1.Cells[2,6]:=floattostr(c);
end;
procedure tform1.plane(a1,a2,a3:point; var a4:point;var theta:real);
var
 a,b,c,d,t,tp:real;
 a5:point;
begin
 {a1:point, a2:VECTOR, a3:vector}
 if a4.ns<>0 then
  begin
   a5.ns:=a4.ns;
   a5.ew:=a4.ew;
   a5.tvd:=a4.tvd;

   a:=a2.ew*a3.tvd-a3.ew*a2.tvd;
   b:=-(a2.ns*a3.tvd-a3.ns*a2.tvd);
   c:=a2.ns*a3.ew-a3.ns*a2.ew;
   d:=sqrt(a*a+b*b+c*c);
   a:=a/d;
   b:=b/d;
   c:=c/d;
   d:=a*a1.ns+b*a1.ew+c*a1.tvd;
   tp:=(d-b)/(b*b+c*c);
   t:=a*a4.ns/(b*b+c*c);
   if theta=-999 then
    theta:=sign(a4.ns)*arccos(sign(tp*t)*abs(a));
   if (abs(b)>0.0000001)or(abs(c)>0.0000001) then
    begin
     if b<0 then
      begin
       b:=-b;
       c:=-c;
       d:=-d;
      end;
     if c<>0 then
      rotation(0,-c,b,0,0,d/c,theta,a4.ns,a4.ew,a4.tvd)
     else
      rotation(0,-c,b,0,d/b,0,theta,a4.ns,a4.ew,a4.tvd);
    end;
  end;
end;

procedure tform1.revplane(a1,a2,a3:point;theta:real; var a4:point);
var
 a,b,c:real;
begin
 a:=a3.ew*a2.tvd-a2.ew*a3.tvd;
 b:=-(a3.ns*a2.tvd-a2.ns*a3.tvd);
 c:=a3.ns*a2.ew-a2.ns*a3.ew;
 if (b<>0)or(c<>0) then
  begin
   if b<0 then
    begin
     a:=-a;
     b:=-b;
     c:=-c;
    end;
   if (abs(b)>0.0000001)or(abs(c)>0.0000001) then
    if c<>0 then
     rotation(0,-c,b,0,0,(a*a1.ns+b*a1.ew+c*a1.tvd)/c,-theta,a4.ns,a4.ew,a4.tvd)
    else
     rotation(0,0,b,0,(a*a1.ns+b*a1.ew)/b,0,-theta,a4.ns,a4.ew,a4.tvd);
  end;
end;
procedure tform1.rotation(u: Real; v: Real; w: Real; a: Real; b: Real; c: Real; theta: real; var x: Real; var y: Real; var z: Real);
var
 xx,yy,zz:real;
begin
//special thanks from: http://inside.mines.edu/~gmurray/arbitraryaxisrotation/
 xx:=(a*(sqr(v)+sqr(w))+u*(-b*v-c*w+u*x+v*y+w*z)+((x-a)*(sqr(v)+sqr(w))+u*(b*v+c*w-v*y-w*z))*cos(theta)
 +sqrt(sqr(u)+sqr(v)+sqr(w))*(b*w-c*v-w*y+v*z)*sin(theta))/(sqr(u)+sqr(v)+sqr(w));

 yy:=(b*(sqr(u)+sqr(w))+v*(-a*u-c*w+u*x+v*y+w*z)+((y-b)*(sqr(u)+sqr(w))+v*(a*u+c*w-u*x-w*z))*cos(theta)
 +sqrt(sqr(u)+sqr(v)+sqr(w))*(c*u-a*w-u*z+w*x)*sin(theta))/(sqr(u)+sqr(v)+sqr(w));

 zz:=(c*(sqr(u)+sqr(v))+w*(-a*u-b*v+u*x+v*y+w*z)+((z-c)*(sqr(u)+sqr(v))+w*(b*v+a*u-v*y-u*x))*cos(theta)
 +sqrt(sqr(u)+sqr(v)+sqr(w))*(a*v-b*u-v*x+u*y)*sin(theta))/(sqr(u)+sqr(v)+sqr(w));

 x:=xx;
 y:=yy;
 z:=zz;
end;
procedure TForm1.surtovct(inc,azm:real;var ns,ew,tvd:real);
begin
 tvd:=cos(inc);
 ns:=sign(sin(inc))*cos(azm)*sqrt(1-tvd*tvd);
 ew:=sign(sin(inc))*sin(azm)*sqrt(1-tvd*tvd);
end;
procedure tform1.vcttosur(ns,ew,tvd:real;var inc,azm:real);
begin
 if abs(ns)<0.00000001 then
  ns:=0;
 if (ns>0)and(ew>0) then
  begin
   azm:=arctan(ew/ns);
  end
 else if (ns<0)and(ew>0) then
  begin
   azm:=pi-arctan(abs(ew/ns));
  end
 else if (ns<0)and(ew<0) then
  begin
   azm:=pi+arctan(abs(ew/ns));
  end
 else if (ns>0)and(ew<0) then
  begin
   azm:=2*pi-arctan(abs(ew/ns));
  end
 else
  if (ew=0)and(ns=0) then
   azm:=0
 else
  if ns=0 then
   if ew>0 then
    azm:=pi/2
   else
    azm:=3*pi/2
 else
  if ew=0 then
   if ns>0 then
    azm:=0
   else
    azm:=pi;
 inc:=arccos(tvd/sqrt(ns*ns+ew*ew+tvd*tvd));
 if abs(inc)<0.0001 then
  azm:=0;
 if azm<0 then
  begin
   azm:=2*pi*(trunc(abs(azm)/(2*pi))+1)+azm
  end;
 if azm>=2*pi then
  begin
   azm:=-2*pi*(trunc(abs(azm)/(2*pi)))+azm
  end;

end;
procedure TForm1.Button1Click(Sender: TObject);
var
 a,b:real;
 c,d,e:real;
begin
 a:=strtofloat(StringGrid1.Cells[0,1]);
 b:=strtofloat(StringGrid1.Cells[1,1]);
 a:=a/180*pi;
 b:=b/180*pi;
 StringGrid1.Cells[2,1]:=floattostr(a);
 StringGrid1.Cells[3,1]:=floattostr(b);
 surtovct(a,b,c,d,e);
 StringGrid1.Cells[0,2]:=floattostr(c);
 StringGrid1.Cells[1,2]:=floattostr(d);
 StringGrid1.Cells[2,2]:=floattostr(e);
 vcttosur(c,d,e,a,b);
 StringGrid1.Cells[0,3]:=floattostr(180/pi*a);
 StringGrid1.Cells[1,3]:=floattostr(180/pi*b);
 surtovct(a,b,c,d,e);
 StringGrid1.Cells[0,4]:=floattostr(c);
 StringGrid1.Cells[1,4]:=floattostr(d);
 StringGrid1.Cells[2,4]:=floattostr(e);
end;

end.
