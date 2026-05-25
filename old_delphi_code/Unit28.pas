unit Unit28;

interface

uses
  Windows, Messages, SysUtils, Variants, Classes, Graphics, Controls, Forms,
  Dialogs, ExtCtrls, Menus, ComCtrls,math, RpDefine, RpBase, RpSystem;

type
  TForm28 = class(TForm)
    Image1: TImage;
    Image2: TImage;
    Image3: TImage;
    Image4: TImage;
    Image5: TImage;
    Image6: TImage;
    Image7: TImage;
    Image8: TImage;
    Image9: TImage;
    MainMenu1: TMainMenu;
    PopupMenu1: TPopupMenu;
    MAP: TMenuItem;
    MAPSAVE1: TMenuItem;
    MAPOPTION1: TMenuItem;
    SaveAs1: TMenuItem;
    Print1: TMenuItem;
    RvSystem1: TRvSystem;
    procedure contourdraw(x1,y1,x2,y2:integer);
    procedure contour(hh,x14,y15:integer);
    procedure angle(xw,yw,mw,rw,vw:integer;var angw:integer);
    procedure imagethree;
    procedure imagefour(zox,conv:real);
    procedure imagefive;
    procedure imagenine;
    procedure draw(hh:integer);
    procedure imagetwo(min,max:real;sect:integer);
    procedure Image1MouseDown(Sender: TObject; Button: TMouseButton;
      Shift: TShiftState; X, Y: Integer);
    procedure Image1MouseMove(Sender: TObject; Shift: TShiftState; X,
      Y: Integer);

    procedure Image2MouseDown(Sender: TObject; Button: TMouseButton;
      Shift: TShiftState; X, Y: Integer);
    procedure Image2MouseMove(Sender: TObject; Shift: TShiftState; X,
      Y: Integer);
    procedure Image2MouseUp(Sender: TObject; Button: TMouseButton;
      Shift: TShiftState; X, Y: Integer);

    procedure Image3MouseDown(Sender: TObject; Button: TMouseButton;
      Shift: TShiftState; X, Y: Integer);
    procedure Image3MouseMove(Sender: TObject; Shift: TShiftState; X,
      Y: Integer);
    procedure Image3MouseUp(Sender: TObject; Button: TMouseButton;
      Shift: TShiftState; X, Y: Integer);

    procedure Image4MouseDown(Sender: TObject; Button: TMouseButton;
      Shift: TShiftState; X, Y: Integer);
    procedure Image4MouseMove(Sender: TObject; Shift: TShiftState; X,
      Y: Integer);
    procedure Image4MouseUp(Sender: TObject; Button: TMouseButton;
      Shift: TShiftState; X, Y: Integer);

    procedure Image5MouseDown(Sender: TObject; Button: TMouseButton;
      Shift: TShiftState; X, Y: Integer);
    procedure Image5MouseUp(Sender: TObject; Button: TMouseButton;
      Shift: TShiftState; X, Y: Integer);
    procedure Image5MouseMove(Sender: TObject; Shift: TShiftState; X,
      Y: Integer);

    procedure Image7MouseDown(Sender: TObject; Button: TMouseButton;
      Shift: TShiftState; X, Y: Integer);
    procedure Image7MouseMove(Sender: TObject; Shift: TShiftState; X,
      Y: Integer);
    procedure Image7MouseUp(Sender: TObject; Button: TMouseButton;
      Shift: TShiftState; X, Y: Integer);

    procedure Image9MouseDown(Sender: TObject; Button: TMouseButton;
      Shift: TShiftState; X, Y: Integer);
    procedure Image9MouseMove(Sender: TObject; Shift: TShiftState; X,
      Y: Integer);
    procedure Image9MouseUp(Sender: TObject; Button: TMouseButton;
      Shift: TShiftState; X, Y: Integer);

    procedure MapOptions1Click(Sender: TObject);
    procedure MapSave1Click(Sender: TObject);
    procedure FormCreate(Sender: TObject);
    procedure MAPOPTION1Click(Sender: TObject);
  private
    { Private declarations }
  public
    { Public declarations }
  end;

var
  Form28: TForm28;
  extraff8:array[1..100]of integer;
  extraf8:array[1..30]of real;
  line8:array[1..2]of tpoint;
  line88:array[1..100,1..3]of tpoint;
  lineno8:shortint;
implementation

uses Unit21, Unit22, Unit23, Unit24, Unit27, Unit32;

{$R *.dfm}

procedure TForm28.contourdraw(x1,y1,x2,y2:integer);
var
 m,a:real;
 extra,ii,iii,jj,kk,extra2,extra4,extra5,extra6,mapno2:integer;
 extra3:real;
 logrec:tlogfont;
begin
 if form23.RadioGroup2.ItemIndex=0 then
  begin
   mapno2:=mapno;
  end
 else if form23.RadioGroup2.ItemIndex=1 then
  begin
   mapno2:=3;
  end;
 extra6:=0;
 extra2:=strtoint(form23.StringGrid1.Cells[1,0]);
 m:=(y2-y1)/(x2-x1);
 a:=y2-m*x2;
 image1.Canvas.Font.Size:=16;
 image1.Canvas.Font.Name:='Areal';
 extra5:=round(intro[3,mapno2]);
 jj:=1;
 iii:=0;
 image1.canvas.pen.color:=clblack;
 if (m<=1)and(m>=-1) then
  begin
   if x1>x2 then
    begin
     extra:=x1;
     x1:=x2;
     x2:=extra;
     extra:=y1;
     y1:=y2;
     y2:=extra;
    end;
   ii:=x1;
   while (z.z[ii,round(m*ii+a),mapno2]=0.1e+10)and(ii<x2) do
    begin
     ii:=ii+1;
    end;
   x1:=ii;
   y1:=round(m*ii+a);
   ii:=x2;
   while (z.z[ii,round(m*ii+a),mapno2]=0.1e+10)and(ii>x1) do
    begin
     ii:=ii-1;
    end;
   x2:=ii;
   y2:=round(m*ii+a);
   ii:=x1+1;
   extra4:=0;
   extra3:=trunc(extra2*(z.z[ii,round(m*ii+a),mapno2]-intro[3,mapno2])/(intro[4,mapno2]-intro[3,mapno2]));
   while(ii<=x2) do
    begin
     if extra3<>trunc(extra2*(z.z[ii,round(m*ii+a),mapno2]-intro[3,mapno2])/(intro[4,mapno2]-intro[3,mapno2])) then
      begin
       with image1.Canvas do
        begin
         kk:=round(form21.max(extra3,trunc(extra2*(z.z[ii,round(m*ii+a),mapno2]-intro[3,mapno2])/(intro[4,mapno2]-intro[3,mapno2]))));
         image1.Canvas.Brush.Color:=image2.Canvas.Pixels[3,trunc((image2.Height-image2.Canvas.TextHeight('88'))*kk/(extra2))+1];
         extra5:=intro[3,mapno2]+round(kk*(intro[4,mapno2]-intro[3,mapno2])/extra2);
         Font.Name   := 'Arial';
         Font.Size := strtoint(form23.Edit2.Text);
         Font.Style := [fsBold];
         GetObject(Font.Handle, SizeOf(LogRec),Addr(LogRec));
         angle(ii,round(m*ii+a),mapno2,round(TextWidth(inttostr(intro[4,mapno2]))/2),round(extra3),extra4);
         LogRec.lfEscapement := extra4;  {escapement in 10ths of degrees}
         Font.Handle := CreateFontIndirect( LogRec );
         if extra6 mod strtoint(form23.Edit4.Text)=0 then
          begin
           Rectangle(round(strtofloat(form23.Edit1.Text)*ii)-4+x14,round((m*ii+a)*strtofloat(form23.Edit1.Text))-4+y15,round(strtofloat(form23.Edit1.Text)*ii)+4+x14,round((m*ii+a)*strtofloat(form23.Edit1.Text))+4+y15);
           TextOut(round(strtofloat(form23.Edit1.Text)*ii-cos(3.14*extra4/1800)*TextWidth(inttostr(extra5))/2-sin(3.14*extra4/1800)*TextHeight(inttostr(extra5))/2)+x14,round((m*ii+a)*strtofloat(form23.Edit1.Text)+sin(3.14*extra4/1800)*TextWidth(inttostr(extra5))/2-cos(3.14*extra4/1800)*TextHeight(inttostr(extra5))/2)+y15,inttostr(extra5));
          end;
        end;
       extra6:=extra6+1;
       extra3:=trunc(extra2*(z.z[ii,round(m*ii+a),mapno2]-intro[3,mapno2])/(intro[4,mapno2]-intro[3,mapno2]));
      end;
     ii:=ii+1;
    end;
  end
 else
  begin
   if y1>y2 then
    begin
     extra:=y1;
     y1:=y2;
     y2:=extra;
     extra:=x1;
     x1:=x2;
     x2:=extra;
    end;
   ii:=y1;
   while (z.z[round((ii-a)/m),ii,mapno2]=0.1e+10)and(ii<y2) do
    begin
     ii:=ii+1;
    end;
   y1:=ii;
   x1:=round((ii-a)/m);
   ii:=y2;
   while (z.z[round((ii-a)/m),ii,mapno2]=0.1e+10)and(ii>y1) do
    begin
     ii:=ii-1;
    end;
   y2:=ii;
   x2:=round((ii-a)/m);
   ii:=y1+1;
   extra4:=1;
   extra3:=trunc(extra2*(z.z[round((ii-a)/m),ii,mapno2]-intro[3,mapno2])/(intro[4,mapno2]-intro[3,mapno2]));
   while(ii<=y2) do
    begin
     if extra3<>trunc(extra2*(z.z[round((ii-a)/m),ii,mapno2]-intro[3,mapno2])/(intro[4,mapno2]-intro[3,mapno2])) then
      begin
       extra4:=1;
       with image1.Canvas do
        begin
         kk:=round(form21.max(extra3,trunc(extra2*(z.z[round((ii-a)/m),ii,mapno2]-intro[3,mapno2])/(intro[4,mapno2]-intro[3,mapno2]))));
         image1.Canvas.Brush.Color:=image2.Canvas.Pixels[3,round((image2.Height-image2.Canvas.TextHeight('88'))*kk/(extra2))+1];
         extra5:=intro[3,mapno2]+round(kk*(intro[4,mapno2]-intro[3,mapno2])/extra2);
         Font.Name   := 'Arial';
         Font.Size := strtoint(form23.Edit2.Text);
         Font.Style := [fsBold];
         GetObject(Font.Handle, SizeOf(LogRec),Addr(LogRec));
         angle(round((ii-a)/m),ii,mapno2,round(TextWidth(inttostr(extra5))/2),round(extra3),extra4);
         LogRec.lfEscapement := extra4;  {escapement in 10ths of degrees}
         Font.Handle := CreateFontIndirect( LogRec );
         if extra6 mod strtoint(form23.Edit4.Text)=0 then
          begin
           Rectangle(round(strtofloat(form23.Edit1.Text)*(ii-a)/m)-4+x14,round(ii*strtofloat(form23.Edit1.Text))-4+y15,round(strtofloat(form23.Edit1.Text)*(ii-a)/m)+4+x14,round(ii*strtofloat(form23.Edit1.Text))+4+y15);
           TextOut(round(strtofloat(form23.Edit1.Text)*(ii-a)/m-cos(3.14*extra4/1800)*TextWidth(inttostr(extra5))/2-sin(3.14*extra4/1800)*TextHeight(inttostr(extra5))/2)+x14,round(ii*strtofloat(form23.Edit1.Text)+sin(3.14*extra4/1800)*TextWidth(inttostr(extra5))/2-cos(3.14*extra4/1800)*TextHeight(inttostr(extra5))/2)+y15,inttostr(extra5));
          end;
        end;
       extra6:=extra6+1;
       extra3:=trunc(extra2*(z.z[round((ii-a)/m),ii,mapno2]-intro[3,mapno2])/(intro[4,mapno2]-intro[3,mapno2]));
      end;
     ii:=ii+1;
    end;
  end;
end;
procedure tForm28.contour(hh,x14,y15:integer);
var
 kk,ii,jj,point,extra,extra2:integer;
 fac,max,min:real;
 bitmap: Tbitmap;
 extra3:real;
begin
 extra3:=strtofloat(form23.Edit1.Text);
 max:=intro[4,hh];
 min:=intro[3,hh];
 fac:=(image2.Height-image2.Canvas.TextHeight('99'))/(max-min);
 extra:=round(image8.Canvas.TextHeight('99')/2);
 for ii:=1 to intro[1,hh] do
  begin
   for jj:=1 to intro[2,hh] do
    begin
     if (z.z[ii,jj,hh]<>error) then
      begin
       point:=round(fac*(z.z[ii,jj,hh]-min)+extra);
       with image1.Picture.Bitmap,Canvas do
        begin
         if extra2<>image2.Canvas.Pixels[10,point] then
          begin
           moveto(round(extra3*ii)+x14,round(extra3*jj)+y15);
           lineto(round(extra3*(ii+1))+x14,round(extra3*jj)+y15);
           extra2:=image2.Canvas.Pixels[10,point];
          end;
        end;
      end;
    end;
  end;
 for jj:=1 to intro[2,hh] do
  begin
   for ii:=1 to intro[1,hh] do
    begin
     if (z.z[ii,jj,hh]<>error) then
      begin
       point:=round(fac*(z.z[ii,jj,hh]-min)+extra);
       with image1.Picture.Bitmap,Canvas do
        begin
         if extra2<>image2.Canvas.Pixels[10,point] then
          begin
           moveto(round(extra3*ii)+x14,round(extra3*(jj))+y15);
           lineto(round(extra3*(ii))+x14,round(extra3*(jj+1))+y15);
           extra2:=image2.Canvas.Pixels[10,point];
          end;
        end;
      end;
    end;
  end;
end;


procedure TForm28.angle(xw,yw,mw,rw,vw:integer;var angw:integer);
var
 ii,jj,kk,mapno2:integer;
 extra8x,extra8y,extra81,extra82,extra2,extra3,extra4:real;
begin
 if form23.RadioGroup2.ItemIndex=0 then
  begin
   mapno2:=mapno;
  end
 else if form23.RadioGroup2.ItemIndex=1 then
  begin
   mapno2:=3;
  end;
 extra2:=strtofloat(form23.StringGrid1.Cells[1,0]);
 extra81:=strtofloat(form23.Edit1.Text);
 rw:=round(rw/strtofloat(form23.Edit1.Text));
 extra8x:=extra81*(xw);
 extra8y:=extra81*(yw);
 ii:=360;
 extra8x:=round((xw+rw*cos(ii*3.14/180)));
 extra8y:=round((yw+rw*sin(ii*3.14/180)));
 extra3:=vw;
 kk:=0;
 jj:=0;
 while (ii>=0)and(extra3=trunc(extra2*(z.z[round(extra8x),round(extra8y),mapno2]-intro[3,mapno2])/(intro[4,mapno2]-intro[3,mapno2]))) do
  begin
   extra8x:=(xw+rw*cos(ii*3.14/180));
   extra8y:=(yw+rw*sin(ii*3.14/180));
   ii:=ii-1;
  end;
 extra8x:=round((xw+rw*cos(ii*3.14/180)));
 extra8y:=round((yw+rw*sin(ii*3.14/180)));
 extra3:=vw;
 kk:=0;
 jj:=0;
 while (ii>=0)and(jj=0) do
  begin
   extra8x:=(xw+rw*cos(ii*3.14/180));
   extra8y:=(yw+rw*sin(ii*3.14/180));
   if extra3=trunc(extra2*(z.z[round(extra8x),round(extra8y),mapno2]-intro[3,mapno2])/(intro[4,mapno2]-intro[3,mapno2])) then
    begin
     jj:=jj+ii;
     extra3:=trunc(extra2*(z.z[round(extra8x),round(extra8y),mapno2]-intro[3,mapno2])/(intro[4,mapno2]-intro[3,mapno2]));
    end;
   ii:=ii-1;
  end;
 jj:=360-jj;
 angw:=round(10*jj);
end;

procedure TForm28.imagenine;
var
 bitmap:tbitmap;
begin
  if extraf8[22]=0 then
   begin
    extraf8[22]:=image9.Width;
   end;
  if extraf8[23]=0 then
   begin
    extraf8[23]:=image9.height;
   end;
  Bitmap := nil;
  try
   Bitmap := TBitmap.Create;
   Bitmap.Width := round(extraf8[22]+extraf8[18]);
   Bitmap.Height := round(extraf8[23]+extraf8[19]);
   form28.Image9.Picture.Graphic := Bitmap;
  finally
   Bitmap.Free;
   end;
  image9.Width:=round(extraf8[22]+extraf8[18]);
  image9.Height:=round(extraf8[23]+extraf8[19]);
  Image9.Canvas.CopyRect(rect(0,0,form28.Image9.Width,form28.Image9.Height),form23.image4.canvas,rect(0,0,form23.Image4.Width,form23.Image4.Height));
  image9.Canvas.Brush.Style:=bsclear;
  image9.Canvas.Rectangle(0,0,image9.Width,image9.Height);
 end;
procedure tForm28.draw(hh:integer);
var
 kk,ii,jj,point,extra,extra2:integer;
 fac,max,min:real;
 bitmap: Tbitmap;
begin
 max:=intro[4,hh];
 min:=intro[3,hh];
 imagetwo(min,max,strtoint(form23.StringGrid1.Cells[1,0]));
 Bitmap := nil;
 try
  Bitmap := TBitmap.Create;
  Bitmap.Width := intro[1,hh];
  Bitmap.Height := intro[2,hh];
  Image8.Picture.Graphic := Bitmap;
 finally
  Bitmap.Free;
  end;
 image8.Visible:=false;
 image8.Width:=intro[1,hh];
 image8.Height:=intro[2,hh];
 fac:=(image2.Height-image2.Canvas.TextHeight('99'))/(max-min);
 extra:=round(image8.Canvas.TextHeight('99')/2);
 for ii:=1 to intro[1,hh] do
  begin
   for jj:=1 to intro[2,hh] do
    begin
     if (z.z[ii,jj,hh]<>error) then
      begin
       point:=round(fac*(z.z[ii,jj,hh]-min)+extra);
       with image8.Picture.Bitmap,Canvas do
        begin
         if extra2<>image2.Canvas.Pixels[10,point] then
          extra2:=image2.Canvas.Pixels[10,point];
         pixels[ii,jj]:=extra2;
        end;
      end;
    end;
  end;
end;



procedure TForm28.imagefive;
var
 ii,iii,jj,kk,kkk,mapno2:integer;
 line,extra:string;
 f:textfile;
 bitmap:tbitmap;
 extra2:boolean;
begin
 if form23.RadioGroup2.ItemIndex=0 then
  begin
   mapno2:=mapno;
  end
 else if form23.RadioGroup2.ItemIndex=1 then
  begin
   mapno2:=3;
  end;
 extra:='';
 jj:=0;
 ii:=0;
 kk:=0;
 assignfile(f,filenam[mapno2]);
 reset(f);
 readln(f,line);
 while(line<>form23.ListBox3.Items[form23.ListBox3.ItemIndex])do
  begin
   ii:=ii+1;
   readln(f,line);
  end;
 if form23.ListBox3.ItemIndex+1<form23.ListBox3.Count then
  while (line<>form23.ListBox3.Items[form23.ListBox3.ItemIndex+1])and(Line[1]='!') do
   begin
    jj:=jj+1;
    readln(f,line);
    if kk<length(line) then
     begin
      kk:=length(line);
      extra:=line;
     end;
   end
  else
    while(Line[1]='!') do
     begin
      jj:=jj+1;
      readln(f,line);
      if kk<length(line) then
       begin
        kk:=length(line);
        extra:=line;
       end;
     end;
 Bitmap := nil;
 try
  Bitmap := TBitmap.Create;
  image5.Canvas.Font.Size:=strtoint(form23.Edit5.text);
  Bitmap.Width := image5.Canvas.TextWidth(extra)+20;
  Bitmap.Height := jj*(2+image5.Canvas.TextHeight(extra))+10;
  form28.Image5.Picture.Graphic := Bitmap;
 finally
  Bitmap.Free;
  end;
 image5.Canvas.Font.Size:=strtoint(form23.Edit5.text);
 image5.Width:= image5.Canvas.TextWidth(extra)+20;
 image5.Height:=jj*(2+image5.Canvas.TextHeight(extra))+10;
 image5.Canvas.Rectangle(0,0,image5.Width,image5.Height);
 reset(f);
 for kk:=1 to ii do
  readln(f);
 readln(f,line);
 jj:=0;
 if form23.ListBox3.ItemIndex+1<form23.ListBox3.Count then
  while (line<>form23.ListBox3.Items[form23.ListBox3.ItemIndex+1])and(Line[1]='!') do
   begin
    image5.Canvas.Font.Size:=strtoint(form23.Edit5.text);
    image5.Canvas.TextOut(3,3+jj*(image5.Canvas.TextHeight(line)+2),line);
    jj:=jj+1;
    readln(f,line);
   end
 else
  while(Line[1]='!') do
   begin
    image5.Canvas.Font.Size:=strtoint(form23.Edit5.text);
    image5.Canvas.TextOut(3,3+jj*(image5.Canvas.TextHeight(line)+2),line);
    jj:=jj+1;
    readln(f,line);
   end
end;
procedure TForm28.imagefour(zox,conv:real);
var
 extra,extra1:string;
 bitmap:tbitmap;
 ii,jj,kk,mapno2:integer;
 r1,r2,r3:real;
begin
 if form23.RadioGroup2.ItemIndex=0 then
  begin
   mapno2:=mapno;
  end
 else if form23.RadioGroup2.ItemIndex=1 then
  begin
   mapno2:=3;
  end;

  Bitmap := nil;
  try
   image4.Canvas.font.Name:='Times new roman';
   image4.Canvas.font.Size:=strtoint(form23.Edit7.Text);
   image4.Canvas.font.Style:=[fsbold];
   Bitmap := TBitmap.Create;
   Bitmap.Width := round(5*(strtofloat(form23.edit3.text)/(intro[5,mapno2]*conv))*fltro[1,mapno2]+image4.canvas.textwidth('8'));
   Bitmap.Height := 2*image4.Canvas.TextHeight('88')+15;
   form28.Image4.Picture.Graphic := Bitmap;
  finally
   Bitmap.Free;
   end;
  image4.Canvas.font.Name:='Times new roman';
  image4.Canvas.font.Size:=strtoint(form23.Edit7.Text);
  image4.Canvas.font.Style:=[fsbold];
  image4.Width:=  round(5*(strtofloat(form23.edit3.text)/(intro[5,mapno2]*conv))*fltro[1,mapno2]+image4.canvas.textwidth('8'));
  image4.Height:= 2*image4.Canvas.TextHeight('88')+15;
  with image4.canvas do
   begin
    font.Name:='Times new roman';
    font.Size:=strtoint(form23.Edit7.Text);
    font.Style:=[fsbold];
    rectangle(0,0,image4.Width,image4.Height);
    kk:=0;
    r1:=(image4.Width-image4.Canvas.TextWidth('8'))/(5);
    extra:=form23.edit3.text+' '+form23.listbox2.Items.Strings[form23.listbox2.itemindex];
    textout(round((image4.width-textwidth(extra))/2),1,extra);
    brush.Color:=clwhite;
    for ii:=0 to 5 do
     begin
      textout(1+ii*round(r1),TextHeight(extra)+10,inttostr(ii));
     end;
    for jj:=0 to 1 do
     begin
      for ii:=0 to 4 do
       begin
        if Brush.Color=clblack then
         brush.Color:=clwhite
        else
         brush.color:=clblack;
        kk:=kk+1;
        rectangle(round(textwidth('8')/2)+ii*round(r1),2+textheight(extra)+jj*5
                 ,round(textwidth('8')/2)+(ii+1)*round(r1),2+textheight(extra)+(jj+1)*5);
       end;
     end;
    brush.Color:=clwhite;
   end;
 end;
procedure TForm28.imagethree;
var
 bitmap:tbitmap;
 begin
  if extraf8[10]=0 then
   begin
    extraf8[10]:=image3.height;
   end;
  if extraf8[9]=0 then
   begin
    extraf8[9]:=image3.Width;
   end;
  Bitmap := nil;
  try
   Bitmap := TBitmap.Create;
   Bitmap.Width := round(extraf8[9]+extraf8[5]);
   Bitmap.Height := round(extraf8[10]+extraf8[6]);
   form28.Image3.Picture.Graphic := Bitmap;
  finally
   Bitmap.Free;
   end;
  image3.Width:=round(extraf8[9]+extraf8[5]);
  image3.Height:=round(extraf8[10]+extraf8[6]);
  form28.Image3.Canvas.CopyRect(rect(0,0,form28.Image3.Width,form28.Image3.Height),form23.image2.canvas,rect(0,0,form23.Image2.Width,form23.Image2.Height));
  image3.Canvas.Brush.Style:=bsclear;
  image3.Canvas.Rectangle(0,0,image3.Width,image3.Height);
 end;

procedure TForm28.imagetwo(min,max:real;sect:integer);
var
 ii,point:integer;
 jj,jjj,extra,extra2,extra3,kk,extra4,inc1,inc2:real;
 colour:longint;
 bitmap: Tbitmap;
begin
 image2.Canvas.Font.Size:=strtoint(form23.Edit6.Text);
 if extraf8[3]=0 then
  begin
   extraf8[3]:=round(form21.max(image2.height,(1.5*strtoint(form23.StringGrid1.Cells[1,0]))*image2.Canvas.TextHeight('h')+10));
  end;
 image2.Canvas.Font.Size:=strtoint(form23.Edit6.Text);
 extra2:=image2.Canvas.TextWidth(floattostr(max)+'>>-');
 Bitmap := nil;
 try
  Bitmap := TBitmap.Create;
  image2.Canvas.Font.Size:=strtoint(form23.Edit6.Text);
  bitmap.Width:=round(extra2)+65;
  bitmap.Height:=round(extraf8[3]+extraf8[1]);
  Image2.Picture.Graphic := Bitmap;
 finally
  Bitmap.Free;
  end;
 image2.Canvas.Font.Size:=strtoint(form23.Edit6.Text);
 image2.Width:=round(extra2)+65;
 image2.Height:=round(extraf8[3]+extraf8[1]);
 extra4:=sect;
 Image2.Canvas.Font.Name:='areal';
 image2.Canvas.Font.Size:=strtoint(form23.Edit6.Text);
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
  // extraff8[jj]:=round((min+kk*(max-min)/(image2.Height-2*extra3)));
   kk:=kk+extra;
   jj:=jj+1;
  end;
 image2.Canvas.TextOut(round(image2.Width-extra2),image2.Height-2*round(extra3),'- '+floattostr(max));
 for ii:=0 to form23.RadioGroup1.Items.count do
  if form23.RadioGroup1.Buttons[ii].Checked then
   break;
 jj:=extra3;
 jjj:=1;
 inc1:=(image2.Height-2*extra3)/extra4;
 inc2:=(form23.image1.Width)/extra4;
 while jj<=image2.Height-round(2*extra3) do
  begin
   Image2.Canvas.Brush.Color:=form23.Image1.Canvas.Pixels[round(jjj),ii*27+3];
   Image2.Canvas.Pen.Color:=form23.Image1.Canvas.Pixels[round(jjj),ii*27+3];
   image2.Canvas.Rectangle(0,round(jj),image2.Width-round(extra2),round(jj+inc1));
   jj:=jj+inc1;
   jjj:=jjj+inc2;
  end;
 image2.Canvas.Brush.Style:=bsClear;
 image2.Canvas.Pen.Color:=clblack;
 image2.Canvas.Rectangle(0,0,image2.Width,image2.Height);
end;
procedure TForm28.Image2MouseDown(Sender: TObject; Button: TMouseButton;
  Shift: TShiftState; X, Y: Integer);
var
 r:real;
begin
 r:=sqrt((x-image2.Width)*(x-image2.Width)+(y-image2.Height)*(y-image2.Height));
 if r<=12 then
  begin
   extraf8[4]:=1;
   extraf8[3]:=y;
  end
 else
  begin
   extraf8[4]:=2;
  end;
end;

procedure TForm28.Image2MouseMove(Sender: TObject; Shift: TShiftState; X,
  Y: Integer);
var
 mapno2:integer;
begin
 if form23.RadioGroup2.ItemIndex=0 then
  begin
   mapno2:=mapno;
  end
 else if form23.RadioGroup2.ItemIndex=1 then
  begin
   mapno2:=3;
  end;

 if extraf8[4]=1 then
  begin
   extraf8[1]:=y-extraf8[3];
   if image2.Height+extraf8[1]>20 then
    begin
     imagetwo(intro[3,mapno2],intro[4,mapno2],strtoint(form23.StringGrid1.Cells[1,0]));
    end;
  end
 else if extraf8[4]=2 then
  begin
   image2.Left:=image2.Left+X;
   image2.Top:=Image2.Top+Y;
  end;
end;

procedure TForm28.Image2MouseUp(Sender: TObject; Button: TMouseButton;
  Shift: TShiftState; X, Y: Integer);
begin
 extraf8[4]:=0;
 extraf8[3]:=0;
 extraf8[1]:=0;
 extraf8[2]:=image2.Height;
end;
procedure TForm28.Image3MouseDown(Sender: TObject; Button: TMouseButton;
  Shift: TShiftState; X, Y: Integer);
var
 r:real;
begin
 r:=sqrt((x-image3.Width)*(x-image3.Width)+(y-image3.Height)*(y-image3.Height));
 if r<=12 then
  begin
   extraf8[11]:=1;
   extraf8[8]:=y;
   extraf8[7]:=x;
  end
 else
  begin
   extraf8[11]:=2;
  end;

end;

procedure TForm28.Image3MouseMove(Sender: TObject; Shift: TShiftState; X,
  Y: Integer);
begin
 if extraf8[11]=1 then
  begin
   extraf8[5]:=x-extraf8[7];
   extraf8[6]:=y-extraf8[8];
   if ((extraf8[9]+extraf8[5])>20)and((extraf8[10]+extraf8[6])>20)then
    imagethree;
  end
 else if extraf8[11]=2 then
  begin
   image3.Left:=image3.Left+X;
   image3.Top:=Image3.Top+Y;
  end;
end;

procedure TForm28.Image3MouseUp(Sender: TObject; Button: TMouseButton;
  Shift: TShiftState; X, Y: Integer);
begin
 extraf8[11]:=0;
 extraf8[10]:=image3.Height;
 extraf8[9]:=image3.Width;
 extraf8[8]:=0;
 extraf8[7]:=0;
 extraf8[5]:=0;
 extraf8[6]:=0;
end;

procedure TForm28.Image4MouseDown(Sender: TObject; Button: TMouseButton;
  Shift: TShiftState; X, Y: Integer);
var
 r:real;
begin
 extraf8[15]:=1;
end;

procedure TForm28.Image4MouseMove(Sender: TObject; Shift: TShiftState; X,
  Y: Integer);
begin
 if extraf8[15]=1 then
  begin
   image4.Left:=image4.Left+X;
   image4.Top:=Image4.Top+Y;
  end;
end;

procedure TForm28.Image4MouseUp(Sender: TObject; Button: TMouseButton;
  Shift: TShiftState; X, Y: Integer);
begin
 extraf8[13]:=0;
 extraf8[12]:=0;
 extraf8[15]:=0;
end;

procedure TForm28.MapOptions1Click(Sender: TObject);
begin
 form23.ShowModal;
end;

procedure TForm28.Image7MouseDown(Sender: TObject; Button: TMouseButton;
  Shift: TShiftState; X, Y: Integer);
begin
 extraf8[16]:=1;
end;

procedure TForm28.Image7MouseMove(Sender: TObject; Shift: TShiftState; X,
  Y: Integer);
begin
 if extraf8[16]=1 then
  begin
   image7.Left:=image7.Left+X;
   image7.Top:=Image7.Top+Y;
  end;
end;

procedure TForm28.Image7MouseUp(Sender: TObject; Button: TMouseButton;
  Shift: TShiftState; X, Y: Integer);
begin
 extraf8[16]:=0;
end;


procedure TForm28.Image5MouseDown(Sender: TObject; Button: TMouseButton;
  Shift: TShiftState; X, Y: Integer);
begin
 extraf8[17]:=1;
end;

procedure TForm28.Image5MouseUp(Sender: TObject; Button: TMouseButton;
  Shift: TShiftState; X, Y: Integer);
begin
 extraf8[17]:=0;
end;

procedure TForm28.Image5MouseMove(Sender: TObject; Shift: TShiftState; X,
  Y: Integer);
begin
 if extraf8[17]=1 then
  begin
   image5.Left:=image5.Left+X;
   image5.Top:=Image5.Top+Y;
  end;
end;

procedure TForm28.Image9MouseDown(Sender: TObject; Button: TMouseButton;
  Shift: TShiftState; X, Y: Integer);
var
 r:real;
begin
 r:=sqrt((x-image9.Width)*(x-image9.Width)+(y-image9.Height)*(y-image9.Height));
 if r<=12 then
  begin
   extraf8[24]:=1;
   extraf8[21]:=y;
   extraf8[20]:=x;
  end
 else
  begin
   extraf8[24]:=2;
  end;

end;

procedure TForm28.Image9MouseMove(Sender: TObject; Shift: TShiftState; X,
  Y: Integer);
begin
 if extraf8[24]=1 then
  begin
   extraf8[18]:=x-extraf8[20];
   extraf8[19]:=y-extraf8[21];
   if ((extraf8[22]+extraf8[18])>20)and((extraf8[23]+extraf8[19])>20)then
    imagenine;
  end
 else if extraf8[24]=2 then
  begin
   image9.Left:=image9.Left+X;
   image9.Top:=Image9.Top+Y;
  end;

end;

procedure TForm28.Image9MouseUp(Sender: TObject; Button: TMouseButton;
  Shift: TShiftState; X, Y: Integer);
begin
 extraf8[24]:=0;
 extraf8[23]:=image9.Height;
 extraf8[22]:=image9.Width;
 extraf8[21]:=0;
 extraf8[20]:=0;
 extraf8[19]:=0;
 extraf8[18]:=0;

end;

procedure TForm28.MAPOPTION1Click(Sender: TObject);
begin
 form23.show;
end;

procedure TForm28.MapSave1Click(Sender: TObject);
var
 bitmap:tbitmap;
begin
 Bitmap := nil;
 try
  Bitmap := TBitmap.Create;
  bitmap.Width:=image1.Width;
  bitmap.Height:=image1.Height;
  Image8.Picture.Graphic := Bitmap;
  form32.Image2.Picture.Graphic:= bitmap;
 finally
  Bitmap.Free;
 end;
 image8.Width:=image1.Width;
 image8.Height:=image1.Height;
// image8.Canvas.CopyRect(rect(image1.Left-image8.Left,Image1.Top-Image8.Top,image1.Left-image8.Left+Image1.Width,Image1.Top-Image8.Top+image1.Height)
// ,image1.Canvas,rect(0,0,image1.width,image1.height));
 image8.Canvas.CopyRect(rect(0,0,image1.Width,image1.Height),image1.Canvas,rect(0,0,image1.width,image1.height));
 if image2.Visible then
  image8.Canvas.CopyRect(rect(image2.Left-image8.Left,Image2.Top-Image8.Top,image2.Left-image8.Left+Image2.Width,Image2.Top-Image8.Top+image2.Height)
  ,image2.Canvas,rect(0,0,image2.width,image2.height));

 if image3.Visible then
  image8.Canvas.CopyRect(rect(image3.Left-image8.Left,Image3.Top-Image8.Top,image3.Left-image8.Left+Image3.Width,Image3.Top-Image8.Top+image3.Height)
  ,image3.Canvas,rect(0,0,image3.width,image3.height));

 if image4.Visible then
  image8.Canvas.CopyRect(rect(image4.Left-image8.Left,Image4.Top-Image8.Top,image4.Left-image8.Left+Image4.Width,Image4.Top-Image8.Top+image4.Height)
  ,image4.Canvas,rect(0,0,image4.width,image4.height));

 if image5.Visible then
  image8.Canvas.CopyRect(rect(image5.Left-image8.Left,Image5.Top-Image8.Top,image5.Left-image8.Left+Image5.Width,Image5.Top-Image8.Top+image5.Height)
  ,image5.Canvas,rect(0,0,image5.width,image5.height));

 if image7.Visible then
  image8.Canvas.CopyRect(rect(image7.Left-image8.Left,Image7.Top-Image8.Top,image7.Left-image8.Left+Image7.Width,Image7.Top-Image8.Top+image7.Height)
  ,image7.Canvas,rect(0,0,image7.width,image7.height));

 if image9.Visible then
  image8.Canvas.CopyRect(rect(image9.Left-image8.Left,Image9.Top-Image8.Top,image9.Left-image8.Left+Image9.Width,Image9.Top-Image8.Top+image9.Height)
  ,image9.Canvas,rect(0,0,image9.width,image9.height));
 form32.draw;
 form32.ShowModal;
end;

procedure TForm28.FormCreate(Sender: TObject);
begin
 lineno8:=1;
end;

procedure TForm28.Image1MouseDown(Sender: TObject; Button: TMouseButton;
  Shift: TShiftState; X, Y: Integer);
var
 bitmap:tbitmap;
 mapno2:integer;
begin
 if form23.RadioGroup2.ItemIndex=0 then
  begin
   mapno2:=mapno;
  end
 else if form23.RadioGroup2.ItemIndex=1 then
  begin
   mapno2:=3;
  end;
 if form23.CheckBox1.Checked then
  begin
   if lineno8=1 then
    begin
     Bitmap := nil;
     try
      Bitmap := TBitmap.Create;
      bitmap.Width:=image1.Width;
      bitmap.Height:=image1.Height;
      Image8.Picture.Graphic := Bitmap;
     finally
      Bitmap.Free;
     end;
     image8.Width:=image1.Width;
     image8.Height:=image1.Height;
     image8.Canvas.CopyRect(rect(0,0,Image1.Width,image1.Height),image1.Canvas,rect(0,0,image1.width,image1.height));
    end;
   image1.Canvas.Pen.Style:=psSolid;
   line8[lineno8].X:=round((X-x14)/strtofloat(form23.Edit1.Text));
   line8[lineno8].Y:=round((Y-y15)/strtofloat(form23.Edit1.Text));
   image1.Canvas.Ellipse(X-5,Y-5,X+5,Y+5);
   if lineno8=2 then
    begin
     image1.Canvas.Pen.Style:=psSolid;
     lineno8:=0;
     if (line8[2].x-line8[1].x)=0 then
      line8[2].x:=1+line8[1].x;
     if (line8[2].y-line8[1].y)=0 then
      line8[2].y:=1+line8[1].y;
     contourdraw(line8[1].x,line8[1].y,line8[2].x,line8[2].y);
     if MessageDlg('Do you want these Contour Numbers?',
      mtConfirmation, [mbYes, mbNo], 0) = mrYes then
      begin
       image1.Canvas.CopyRect(rect(0,0,Image1.Width,image1.Height),image8.Canvas,rect(0,0,image1.width,image1.height));
       contourdraw(line8[1].x,line8[1].y,line8[2].x,line8[2].y);
       line88[2*intro[13,mapno2]+1,mapno2].x:=line8[1].X;
       line88[2*intro[13,mapno2]+1,mapno2].y:=line8[1].y;
       intro[13,mapno2]:=intro[13,mapno2]+1;
       line88[2*intro[13,mapno2],mapno2].x:=line8[2].X;
       line88[2*intro[13,mapno2],mapno2].y:=line8[2].y;
      end
     else
      begin
       image1.Canvas.CopyRect(rect(0,0,Image1.Width,image1.Height),image8.Canvas,rect(0,0,image1.width,image1.height));
      end;
    end;
   lineno8:=lineno8+1;
  end;
end;

procedure TForm28.Image1MouseMove(Sender: TObject; Shift: TShiftState; X,
  Y: Integer);
var
 a,c:real;
 ii,jj,mapno2:integer;
begin
 if form23.RadioGroup2.ItemIndex=0 then
  begin
   mapno2:=mapno;
  end
 else if form23.RadioGroup2.ItemIndex=1 then
  begin
   mapno2:=3;
  end;
 a:=strtofloat(form23.Edit1.Text);
 ii:=round((Y-y15)/a);
 jj:=round((X-x14)/a);
 form23.conversion(intro[7,mapno2],form23.ListBox1.ItemIndex+1,c);
 if z.z[jj,ii,mapno2]<>error then
  begin
   if form23.RadioGroup2.ItemIndex=0 then
    form28.Caption:='Layer # '+inttostr(mapno2)+' : '+' : X= '+floattostr(0.001*round(1000*c*(intro[9,mapno2]+intro[5,mapno2]*jj)))+'   '+form23.ListBox1.Items.Strings[form23.ListBox1.ItemIndex]+'   Y= '+floattostr(0.001*round(1000*c*(intro[11,mapno2]+intro[6,mapno2]*ii)))+'   '+form23.ListBox1.Items.Strings[form23.ListBox1.ItemIndex]+'  Depth ='+floattostr(z.z[jj,ii,mapno2])+'   '+form23.ListBox1.Items.Strings[intro[7,mapno2]-1]
   else if form23.RadioGroup2.ItemIndex=1 then
    form28.Caption:='Differences Layers # '+form23.StringGrid1.Cells[1,1]+' & '+form23.StringGrid1.Cells[1,2]+' are: '+' : X= '+floattostr(0.001*round(1000*c*(intro[9,mapno2]+intro[5,mapno2]*jj)))+'   '+form23.ListBox1.Items.Strings[form23.ListBox1.ItemIndex]+'   Y= '+floattostr(0.001*round(1000*c*(intro[11,mapno2]+intro[6,mapno2]*ii)))+'   '+form23.ListBox1.Items.Strings[form23.ListBox1.ItemIndex]+'  Depth ='+floattostr(z.z[jj,ii,3])+'   '+form23.ListBox1.Items.Strings[intro[7,mapno2]-1];
  end
 else
  form28.Caption:='Layer # '+inttostr(mapno2)+' : '+' : X= '+floattostr(0.001*round(1000*c*(intro[9,mapno2]+intro[5,mapno2]*jj)))+'   '+form23.ListBox1.Items.Strings[form23.ListBox1.ItemIndex]+'   Y= '+floattostr(0.001*round(1000*c*(intro[11,mapno2]+intro[6,mapno2]*ii)))+'   '+form23.ListBox1.Items.Strings[form23.ListBox1.ItemIndex]+'  Depth = Error';
 end;


end.
















