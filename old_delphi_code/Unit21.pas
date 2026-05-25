unit unit21;

interface

uses
  Windows, Messages, SysUtils, Variants, Classes, Graphics, Controls, Forms,
  Dialogs, Menus, ExtDlgs, ExtCtrls, Gauges, StdCtrls, Grids, ComCtrls,math,
  Buttons, DB, ADODB;
type
  mattt = record
  z:array[1..1000,1..1000,1..3]of real;
  draw:array[1..1000,1..1000]of boolean;
  CMT:string;
end;
type
 ddd = record
 x,y,z:real;
 welnam:string;
end;
type
  TForm21 = class(TForm)
    PrintDialog1: TPrintDialog;
    ColorDialog1: TColorDialog;
    OpenPictureDialog1: TOpenPictureDialog;
    SaveDialog1: TSaveDialog;
    MainMenu1: TMainMenu;
    File1: TMenuItem;
    Open1: TMenuItem;
    Options1: TMenuItem;
    Exit1: TMenuItem;
    Image1: TImage;
    Image2: TImage;
    PopupMenu1: TPopupMenu;
    Sect1: TMenuItem;
    StatusBar1: TStatusBar;
    N3d1: TMenuItem;
    Image3: TImage;
    UpDown1: TUpDown;
    Button1: TButton;
    Button3: TButton;
    Button2: TButton;
    MapMake1: TMenuItem;
    Map1: TMenuItem;
    Properties2: TMenuItem;
    Option1: TMenuItem;
    Image4: TImage;
    N3d21: TMenuItem;
    N3d3d1: TMenuItem;
    Properties1: TMenuItem;
    Units1: TMenuItem;
    Button4: TButton;
    ComboBox1: TComboBox;
    CheckBox1: TCheckBox;
    procedure gridline;
    procedure cross(x1,y1,x2,y2:integer);
    function max(a,b:real):real;
    procedure initialize;
    procedure draw(hh:integer);
    procedure Exit1Click(Sender: TObject);
    procedure Print1Click(Sender: TObject);
    procedure SaveAs1Click(Sender: TObject);
    procedure maxmin(erro:real;kk:integer;var max,min:real);
    procedure azim;
    procedure Button1Click(Sender: TObject);
    procedure DrawGrid1Click(Sender: TObject);
    procedure FormCreate(Sender: TObject);
    procedure imageone(min,max:real;sect:integer);
    procedure Sect1Click(Sender: TObject);
    procedure Image1DblClick(Sender: TObject);
    procedure Image2MouseMove(Sender: TObject; Shift: TShiftState; X,
      Y: Integer);
    procedure CheckBox1Click(Sender: TObject);
    procedure CrossSection1Click(Sender: TObject);
    procedure N3d1Click(Sender: TObject);
    procedure CheckBox2Click(Sender: TObject);
    procedure UpDown1Click(Sender: TObject; Button: TUDBtnType);
    procedure Image3MouseDown(Sender: TObject; Button: TMouseButton;
      Shift: TShiftState; X, Y: Integer);
    procedure Image3MouseUp(Sender: TObject; Button: TMouseButton;
      Shift: TShiftState; X, Y: Integer);
    procedure Image3MouseMove(Sender: TObject; Shift: TShiftState; X,
      Y: Integer);
    procedure Zoom1Click(Sender: TObject);
    procedure Options1Click(Sender: TObject);
    procedure Image2MouseDown(Sender: TObject; Button: TMouseButton;
      Shift: TShiftState; X, Y: Integer);
    procedure BitBtn1Click(Sender: TObject);
    procedure Button3Click(Sender: TObject);
    procedure Button2Click(Sender: TObject);
    procedure Image1MouseDown(Sender: TObject; Button: TMouseButton;
      Shift: TShiftState; X, Y: Integer);
    procedure Image1MouseMove(Sender: TObject; Shift: TShiftState; X,
      Y: Integer);
    procedure Image1MouseUp(Sender: TObject; Button: TMouseButton;
      Shift: TShiftState; X, Y: Integer);
    procedure MapMake1Click(Sender: TObject);
    procedure Properties2Click(Sender: TObject);
    procedure CrossSection2Click(Sender: TObject);
    procedure FormShow(Sender: TObject);
    procedure Option1Click(Sender: TObject);
    procedure N3d21Click(Sender: TObject);
    procedure Units1Click(Sender: TObject);
    procedure FieldExtract;
    function find(inp:string;jj:integer):integer;
    PROCEDURE WELLDRAWING2D(LL:integer);
    procedure Button4Click(Sender: TObject);
    procedure pttoimg(xx,yy:real;var x,y:integer);

  private
    { Private declarations }
  public
    { Public declarations }
  end;

var
  Form21: TForm21;
  doornot:array[1..20]of boolean;
  intro:array[1..20,1..3]of integer;
  {1.ncol,2.nrow,3.zmin,4.zmax,5.xinc,6.yinc,7.unit sys,8.portrate or not,9.xmin,10.xmax
  ,11.ymin,12.xmax,13.contuor line#,14.x move rather to bitmap,15.y move rather to bitmap,16.,17.,18.,19.,20.,}
  fltro:array[1..20,1..3]of real;
  mapno:integer;
  total:array[1..30]of integer;
  extraf1:array[1..30]of real;
  poly:array[0..20] of tpoint;
  polycount:integer;
  filenam:array[1..20]of string;
  lineno1:integer;
  line11:array[1..100,1..3]of tpoint;
  line1:array[1..2]of tpoint;
  error:real;
  z:mattt;
  welltablename:array [1..100]of string;
  wellddd:array[1..100,1..1000]of ddd;
  welldd:array[1..100,1..1000]of ddd;
  wlnumber:integer;
  DWDTODSNFAC:REAL;
implementation

uses Unit22, Unit23, Unit24, Unit26, Unit25, Unit27, Unit29, Unit30, Unit31,
  Unit35, Unit01;

{$R *.dfm}
procedure tform21.pttoimg(xx,yy:real; var x: integer; var y: integer);
var
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
 x:=trunc((xx-intro[9,mapno2])/intro[5,mapno2]+intro[14,mapno2]);
 y:=trunc((yy-intro[11,mapno2])/intro[6,mapno2]+intro[15,mapno2]);
end;
PROCEDURE TForm21.WELLDRAWING2D(LL:integer);
var
 HH,ii,jj,KK,MM:integer;
 ss,sss:string;
 bitmap:tbitmap;
 CNTTN,FLDTN,EX1,EX2:STRING;
 tables: TStringList;
 AA,qq:STRING;
 XX,YY,ZZ:ARRAY[1..100] OF REAL;
 x,y:integer;
 pt,pt2:array [1..3] of tpoint;
 mapno2:integer;
 C:REAL;
begin
 if form22.ComboBox1.ItemIndex=0 then
  begin
   mapno2:=mapno;
  end
 else if form22.ComboBox1.ItemIndex=1 then
  begin
   mapno2:=3;
  end;
  for jj:=1 to 100 do
   BEGIN
    for ii := 1 to 1000 do
      WElldd[JJ,ii].welnam:='';
    XX[JJ]:=0;
    YY[JJ]:=0;
    ZZ[JJ]:=0;

   END;
 Form01.FNDTABLE(ss);
 form01.ADOTable1.Active:=false;
 form01.ADOTable1.TableName:=ss;
 form01.ADOTable1.Active:=true;
 Form01.ADOTable1.First;
 image2.Canvas.CopyRect(rect(0,0,Image2.Width,image2.Height),image4.Canvas,rect(0,0,image4.width,image4.height));
 jj:=1;
 qq:='';
 while not(Form01.ADOTable1.Eof) do
  begin
   CNTTN:=form01.ADOTable1.FieldByName('COUNTRY').AsString;
   FLDTN:=form01.ADOTable1.FieldByName('FIELD').AsString;
   EX1:=Form01.ADOTable1.FieldByName('WELL').AsString;
   EX2:=form01.ADOTable1.FieldByName('CALC').AsString;
   welldd[JJ,1].welnam:=EX1+' => '+EX2;
   XX[JJ]:=form01.ADOTable1.FieldByName('EW').AsFloat;
   qq:=form01.ADOTable1.FieldByName('EW').asstring+
   form01.ADOTable1.FieldByName('NS').asstring+
   form01.ADOTable1.FieldByName('MSL').asstring;
   YY[JJ]:=form01.ADOTable1.FieldByName('NS').AsFloat;
   ZZ[JJ]:=form01.ADOTable1.FieldByName('MSL').AsFloat;
   jj:=jj+1;
   FORM01.ADOTABLE1.NEXT;
  end;
 form23.conversion(intro[7,mapno2],form22.ListBox1.ItemIndex+1,c);
 tables := TStringList.Create;
 JJ:=JJ-1;
 if (qq='')and(jj=1) then
  jj:=0;

 try
   FORM01.ADOConnection1.GetTableNames(TABLES);
   for KK := 1 to JJ do
    BEGIN
     ii:=0;
     MM:=1;
     while (ii<=tables.Count-1) do
      begin
       aA:=copy(tables[ii],1,2);
       FORM01.ADOTABLE1.Active:=false;
       FORM01.ADOTABLE1.TableName:=tables[ii];
       FORM01.ADOTABLE1.Active:=true;
       if AA='SE' then
        BEGIN
         if CNTTN=form01.ADOTable1.FieldByName('COUNTRY').AsString then
           IF FLDTN=form01.ADOTable1.FieldByName('FIELD').AsString THEN
            if welldd[KK,1].welnam=form01.ADOTable1.FieldByName('WELL').AsString+' => '+form01.ADOTable1.FieldByName('CALC').AsString  then
             BEGIN
              form01.DBGrid3.Visible:=FALSE;
              form01.ADOTABLE1.Open;
              form01.ADOTABLE1.first;
              HH:=1;
              while NOT(form01.ADOTable1.Eof) do
               BEGIN
                welldd[KK,HH].welnam:=welldd[KK,1].welnam;
                welldd[KK,HH].x:=c*(XX[KK]+form01.ADOTable1.FieldByName('EW').AsFloat*DWDTODSNFAC);
                welldd[KK,HH].z:=c*(YY[KK]-form01.ADOTable1.FieldByName('NS').AsFloat*DWDTODSNFAC);
                welldd[KK,HH].y:=c*(ZZ[KK]+form01.ADOTable1.FieldByName('TVD').AsFloat*DWDTODSNFAC);
                form01.ADOTable1.Next;
                HH:=HH+1;
               END;
             END;
        END;
       II:=II+1;
      end;
    END;
 finally
   tables.free;
  end;
 for ii := 1 to ll do
  begin
   kk:=1;
   while  wellddd[ii,kk].welnam<>'' do
    begin
     welldd[jj+ii,kk].welnam:=wellddd[ii,kk].welnam;
     welldd[jj+ii,kk].x:=wellddd[ii,kk].x;
     welldd[jj+ii,kk].z:=wellddd[ii,kk].z;
     welldd[jj+ii,kk].y:=wellddd[ii,kk].y;
     kk:=kk+1;
    end;
  end;
 for ii := 1 to jj+ll do
  begin
   pttoimg(welldd[ii,1].x,welldd[ii,1].z,x,y);
   pt[1].X:=x;
   pt[1].Y:=y-8;
   pt[2].X:=x-3;
   pt[2].Y:=y;
   pt[3].X:=x+3;
   pt[3].Y:=y;
   pt2[1].X:=x;
   pt2[1].Y:=y-8;
   pt2[2].X:=x-6;
   pt2[2].Y:=y+8;
   pt2[3].X:=x+6;
   pt2[3].Y:=y+8;
   Image2.Canvas.Brush.Style := bsClear;
   Image2.Canvas.Pen.Style   := psSolid;
   image2.Canvas.Polygon(pt2);
   image2.Canvas.Polygon(pt);
   form01.DBGrid3.Visible:=true;
   image2.Canvas.Font.Name:='Areal';
   kk:=1;
   SS:='';
   SSS:=welldd[ii,1].welnam;
   while COPY(SSS,kk,4)<>' => ' do
    BEGIN
     SS:=SS+COPY(SSS,kk,1);
     kk:=kk+1;
    END;
   image2.Canvas.TextOut(X-ROUND(0.5*Image2.Canvas.TextWidth(SS)),Y-6-image2.Canvas.TextHeight('A'),SS);
   kk:=1;
   while welldd[ii,kk+1].welnam<>'' do
    begin
     pttoimg(welldd[ii,kk].x,welldd[ii,kk].z,x,y);
     image2.Canvas.MoveTo(x,y);
     pttoimg(welldd[ii,kk+1].x,welldd[ii,kk+1].z,x,y);
     image2.Canvas.lineto(x,y);
     kk:=kk+1;
    end;
  end;
end;

function TForm21.find(inp:string;jj:integer):integer;
var
 extra3:string;
begin
 while inp[jj]=' ' do
  jj:=jj+1;
  extra3:='';
  while inp[jj]<>' ' do
   begin
    extra3:=extra3+inp[jj];
    jj:=jj+1;
   end;
  find:=round(strtofloat(extra3));
end;

procedure TForm21.FieldExtract;
var
 f:textfile;
 line,strdata,extra3:string;
 numofline,lineperdata,hh,ii,i,jj,j,kk,k,ll,l,mm,i1,i2,j1,j2,ii1,ii2,jj1,jj2,jj3,ex1,ex2,ex3,ex4,nn:integer;
 extra,x,y,max,min:real;
 extra2:char;
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
 strdata:='';
 form22.combobox1.ItemIndex:=0;
 form21.initialize;
 total[1]:=form22.checklistbox1.count;
 form26.stringgrid1.cells[1,0]:='1';
 form26.stringgrid1.cells[1,1]:=inttostr(form22.CheckListBox1.count);
 form21.UpDown1.Max:=total[1];
 for kk := 1 to form22.checklistbox1.count do
  filenam[kk]:=form22.checklistbox1.items[kk-1];
 kk:=1;
 if kk<>total[1]+2 then
  begin
   for kk:=1 to total[1] do
    begin
     form24.Memo1.Lines.Clear;
     assignfile(f,filenam[kk]);
       reset(f);
       readln(f,line);
       jj:=0;
       for mm:=1 to length(line)+1 do
        begin
         if (((line[mm]=#0)or(line[mm]=#9)or(line[mm]=' '))and(strdata<>'')) then
          begin
           jj:=jj+1;
           if jj=6 then
            error:=strtofloat(strdata);
           strdata:='';
          end;
         if (line[mm]<>' ')and(line[mm]<>#0)and(line[mm]<>#9) then
          begin
           strdata:=strdata+line[mm];
          end;
        end;
       while (line[1]<>'!') do
        readln(f,line);
       while (line[1]='!') do
        begin
         ii:=2;
         while ii<=length(line)do
          begin
           if line[ii]<>' ' then
            strdata:=strdata+line[ii]
           else if strdata<>'' then
            begin
             jj:=ii+1;
             if strdata='XMIN:' then
              begin
               intro[9,kk]:=find(line,jj);
              if line[ii+1]='m' then
               intro[7,kk]:=1
              else if line[ii+1]+line[ii+2]='km' then
               intro[7,kk]:=2
              else if line[ii+1]+line[ii+2]='ft' then
               intro[7,kk]:=3
              else if line[ii+1]+line[ii+2]='yd' then
               intro[7,kk]:=4
              else if line[ii+1]+line[ii+2]='ml' then
               intro[7,kk]:=5
              else if line[ii+1]+line[ii+2]='nm' then
               intro[7,kk]:=6;
              form30.listbox1.ItemIndex:=intro[7,kk]-1;
              end
             else if strdata='XMAX:' then
              begin
               intro[10,kk]:=find(line,jj);
              end
             else if strdata='YMIN:' then
              begin
               intro[11,kk]:=find(line,jj);
              end
             else if strdata='YMAX:' then
              begin
               intro[12,kk]:=find(line,jj);
              end
             else if strdata='XINC:' then
              begin
               intro[5,kk]:=find(line,jj);
              end
             else if strdata='YINC:' then
              begin
               intro[6,kk]:=find(line,jj);
              end
             else if strdata='NCOL:' then
              begin
               intro[1,kk]:=find(line,jj);
              end
             else if strdata='NROW:' then
              begin
               intro[2,kk]:=find(line,jj);
              end;
             strdata:='';
            end;
           extra2:=line[ii];
           ii:=ii+1;
          end;
         if (ii=length(line)+1)and(line[2]<>' ') then
          begin
           form23.ListBox3.Items.Append(line);
          end;
         readln(f,line);
        end;
       jj:=0;
       while(line[1]<>' ')do
        readln(f,line);
       strdata:='';
       for mm:=1 to length(line)+1 do
        begin
         if (((line[mm]=#0)or(line[mm]=#9)or(line[mm]=' '))and(strdata<>'')) then
          begin
           jj:=jj+1;
           strdata:='';
          end;
         if (line[mm]<>' ')and(line[mm]<>#0)and(line[mm]<>#9) then
          begin
           strdata:=strdata+line[mm];
          end;
        end;
       lineperdata:=trunc(intro[2,kk]/jj);
       numofline:=1;
       strdata:='';
       ii:=1;
       ii1:=0;
       jj2:=0;
       jj3:=0;
       ex1:=1;
       ex2:=0;
       ex3:=0;
       ex4:=1;
       ii:=1;
       while(ii<=intro[1,kk])and(ex4=1) do
        begin
         ex1:=ex1+1;
         ii2:=0;
         jj:=0;
         jj1:=0;
         for ll:=1 to lineperdata do
          begin
           for mm:=1 to length(line)+1 do
            begin
             if (((line[mm]=#0)or(line[mm]=#9)or(line[mm]=' '))and(strdata<>'')) then
              begin
               jj:=jj+1;
               if (strtofloat(strdata)<>error)and(ii1=0) then
                begin
                 ii1:=ii;
                 intro[9,kk]:=intro[9,kk]+ii*intro[5,kk];
                end;
               if (strtofloat(strdata)<>error) then
                begin
                 if (ii1<>0) then
                  ii2:=1;
                 if (jj1=0)  then
                  begin
                   jj1:=jj;
                   jj2:=jj;
                   if ex2=0 then
                    begin
                     ex2:=jj1;
                    end;
                  end;
                 jj2:=round(form21.max(jj,jj2));
                end;
               strdata:='';
              end;
             if (line[mm]<>' ')and(line[mm]<>#0)and(line[mm]<>#9) then
              begin
               strdata:=strdata+line[mm];
              end;
            end;
           line:='';
           readln(f,line);
          end;
         if (ii2=0)and(ii1<>0) then
          begin
           intro[10,kk]:=(ii-ii1)*intro[5,kk]+intro[9,kk];
           intro[1,kk]:=ii-ii1+1;
           ex4:=2;
          end;
         if jj1<>0 then
          begin
           ex2:=ex2+jj1-round(form21.max(ex2,jj1));
          end;
         jj3:=round(form21.max(jj2,jj3));
         ii:=ii+1;
        end;
       intro[2,kk]:=jj3-ex2+2;
       reset(f);
       while (line[1]<>'!') do
        readln(f,line);
       while (line[1]='!') do
        readln(f,line);
       for ii:=1 to ii1-1 do
         for ll:=1 to lineperdata do
          readln(f);
       for ii:=1 to intro[1,kk] do
        begin
         jj:=0;
         for ll:=1 to lineperdata do
          begin
           line:='';
           readln(f,line);
           for mm:=1 to length(line)+1 do
            begin
             if (((line[mm]=#0)or(line[mm]=#9)or(line[mm]=' '))and(strdata<>'')) then
              begin
               jj:=jj+1;
               if (jj>=ex2) then
                z.z[ii,jj-ex2+1,kk]:=strtofloat(strdata);
               strdata:='';
              end;
             if (line[mm]<>' ')and(line[mm]<>#0)and(line[mm]<>#9) then
              begin
               strdata:=strdata+line[mm];
              end;
            end;
          end;
        end;
       closefile(f);
    end;
   form21.UpDown1.Enabled:=true;
   form21.UpDown1.Position:=1;
   mapno:=1;
   form22.RadioGroup1.ItemIndex:=0;
   for ii:=1 to total[1] do
    begin
     form21.maxmin(error,ii,max,min);
     intro[3,ii]:=trunc(min);
     intro[4,ii]:=trunc(max);
{**************************************}
    end;
   form22.ListBox1.ItemIndex:=intro[7,1]-1;
  end;
 for nn := 1 to form22.checklistbox1.count do
  begin
   form21.image2.Canvas.Font.Size:=8;
   form21.image2.Canvas.Font.Name:='Areal';
   if (intro[2,nn]/intro[1,nn])>1 then
    intro[8,nn]:=1
   else
    intro[8,nn]:=-1;
   if power((intro[2,nn]/intro[1,nn]),intro[8,nn])<sqrt(2){A4} then
    begin
     intro[14,nn]:=form21.image2.Canvas.TextHeight('8')+4;
     intro[15,nn]:=round(((intro[1,nn]+2*intro[14,nn])*sqrt(2)-intro[2,nn])/2);
    end
   else
    begin
     intro[15,nn]:=form21.image2.Canvas.TextHeight('8')+4;
     intro[14,nn]:=round(((intro[2,nn]+2*intro[15,nn])/sqrt(2)-intro[1,nn])/2);
    end;
  end;
 for ii := 1 to 1000 do
   for jj := 1 to 1000 do
     if z.z[ii,jj,mapno2]<>error then
       z.draw[ii,jj]:=true
     else
       z.draw[ii,jj]:=false;
end;
procedure TForm21.gridline;
var
 ii,jj,mapno2,d,xos,yos:integer;
 c:real;
 logrec:tlogfont;
begin
 xos:=strtoint(form22.Edit1.Text);
 yos:=strtoint(form22.Edit2.Text);
 if form22.ComboBox1.ItemIndex=0 then
  begin
   mapno2:=mapno;
  end
 else if form22.ComboBox1.ItemIndex=1 then
  begin
   mapno2:=3;
  end;
 Image2.Canvas.Brush.Style := bsClear;
 Image2.Canvas.Pen.Style   := psDash;
 image2.Canvas.Font.Size:=8;
 image2.Canvas.Font.Name:='Areal';
 ii:=image2.Canvas.TextHeight('8')+4;
 jj:=0;
 d:=form22.ListBox1.ItemIndex+1;
 form23.conversion(intro[7,mapno2],d,c);
 while ii<image2.Width-image2.Canvas.TextHeight('8')+4  do
  begin
   image2.Canvas.Font.Size:=8;
   image2.Canvas.Font.Name:='Areal';
   image2.Canvas.MoveTo(ii,image2.Canvas.TextHeight('8')+4);
   image2.Canvas.Lineto(ii,image2.Height-4-image2.Canvas.TextHeight('8'));
   ii:=ii+trunc((image2.width-2*image2.Canvas.TextHeight('8')-8)/xos);
   if (ii>image2.Canvas.textwidth(floattostr(0.001*trunc(1000*c*(ii*intro[5,mapno2]+intro[9,mapno2])))))
   and((image2.width-ii)>image2.Canvas.textwidth(floattostr(0.001*trunc(1000*c*(ii*intro[5,mapno2]+intro[9,mapno2])))))then
    if jj<>0 then
     image2.Canvas.TextOut(round(ii-image2.Canvas.textwidth(floattostr(0.001*trunc(1000*c*(ii*intro[5,mapno2]+intro[9,mapno2]))))/2)
     ,image2.Height-4-image2.Canvas.textheight('88'),floattostr(0.001*round(1000*c*((ii-intro[14,mapno2])*intro[5,mapno2]/fltro[1,mapno2]+intro[9,mapno2]))))
    else
     begin
      image2.Canvas.Font.Size:=8;
      image2.Canvas.Font.Name:='Areal';
      image2.Canvas.TextOut(round(ii-image2.Canvas.textwidth(floattostr(0.001*trunc(1000*c*(ii*intro[5,mapno2]+intro[9,mapno2]))))/2)
      ,image2.Height-4-image2.Canvas.textheight('88'),floattostr(0.001*round(1000*c*((ii-intro[14,mapno2])*intro[5,mapno2]/fltro[1,mapno2]+intro[9,mapno2]))));
      image2.Canvas.TextOut(1,image2.Height-4-image2.Canvas.textheight('88'),form22.ListBox1.Items.Strings[d-1]);
      jj:=1;
     end;
  end;
 if ii<>image2.Width-image2.Canvas.TextHeight('8')+4  then
   ii:=ii-trunc((image2.width-2*image2.Canvas.TextHeight('8')-8)/xos);
 jj:=image2.Canvas.TextHeight('H')+4;
 while jj<=image2.Height-image2.Canvas.TextHeight('8')+4 do
  begin
   image2.Canvas.MoveTo(image2.Canvas.TextHeight('8')+4,jj);
   image2.Canvas.Lineto(ii,jj);
   jj:=jj+trunc((image2.Height-2*image2.Canvas.TextHeight('8')-8)/yos);
   if (jj>image2.Canvas.textwidth(floattostr(0.001*trunc(1000*c*(jj*intro[6,mapno2]+intro[12,mapno2])))))
   and((image2.Height-jj)>image2.Canvas.textwidth(floattostr(0.001*trunc(1000*c*((jj-intro[15,mapno2])*intro[6,mapno2]+intro[12,mapno2])))))then
    with image2.Canvas do
     begin
      image2.Canvas.Font.Size:=8;
      image2.Canvas.Font.Name:='Areal';
      GetObject(Font.Handle, SizeOf(LogRec),Addr(LogRec));
      LogRec.lfEscapement := trunc(900);
      image2.Canvas.Font.Handle := CreateFontIndirect( LogRec );
      image2.Canvas.TextOut(0,round(jj+Image2.Canvas.textwidth(floattostr(0.001*trunc(1000*c*(jj*intro[6,mapno2]+intro[12,mapno2]))))/2)
      ,floattostr(0.001*round(1000*c*((jj-intro[15,mapno2])*intro[6,mapno2]/fltro[2,mapno2]+intro[11,mapno2]))));
     end;
  end;
 Image2.Canvas.Brush.Style := bssolid;
 Image2.Canvas.Pen.Style   := pssolid;
end;

procedure TForm21.cross(x1,y1,x2,y2:integer);
var
 m,a:real;
 extra,ii,mapno2:integer;
begin
 if form22.ComboBox1.ItemIndex=0 then
  begin
   mapno2:=mapno;
  end
 else if form22.ComboBox1.ItemIndex=1 then
  begin
   mapno2:=3;
  end;
 form31.Label1.Caption:='A';
 form31.Label2.Caption:='B';
 m:=(y2-y1)/(x2-x1);
 a:=y2-m*x2;
 image1.canvas.pen.color:=clblack;
 if (m<=1)and(m>=-1) then
  begin
   ii:=x1;
   while(ii*sign(x2-x1)<=x2*sign(x2-x1)) do
    begin
     if z.draw[ii,round(m*ii+a)] then
      begin
       form31.Series1.AddXY(ii*intro[5,mapno2]+intro[9,mapno2],z.z[ii,round(m*ii+a),mapno2]);
      end;
     ii:=ii+sign(x2-x1);
    end;
  end
 else
  begin
   ii:=y1;
   while(ii*sign(y2-y1)<=y2*sign(y2-y1)) do
    begin
     if (z.draw[round((ii-a)/m),ii]) then
      begin
       form31.Series1.AddXY((ii-a)/m*intro[5,mapno2]+intro[9,mapno2],z.z[round((ii-a)/m),ii,mapno2]);
      end;
     ii:=ii+sign(y2-y1);
    end;
  end;
 if form22.ComboBox1.ItemIndex=1 then
  form31.Chart1.LeftAxis.Inverted:=false;
 if x1>x2 then
  begin
   form31.label1.Caption:='B';
   form31.label2.Caption:='A';
  end;
end;



function TForm21.max(a,b:real):real;
begin
 max:=(abs(a+b)+abs(a-b))/2;
end;
procedure TForm21.initialize;
var
 ii,jj,kk:integer;
begin
 for ii:=1 to 1000 do
  for jj:=1 to 1000 do
   for kk:=1 to 3 do
    z.z[ii,jj,kk]:=0;
end;

procedure TForm21.Exit1Click(Sender: TObject);
begin
 Form21.Close;
end;

procedure TForm21.Print1Click(Sender: TObject);
begin
 PrintDialog1.Execute;
end;

procedure TForm21.SaveAs1Click(Sender: TObject);
var
 Bitmap: TBitmap;
begin
 if SaveDialog1.Execute then
  image2.Picture.SaveToFile(SaveDialog1.FileName);
end;

procedure tForm21.maxmin(erro:real;kk:integer;var max,min:real);
var
  ii,jj,mapno2:integer;
begin
 if form22.ComboBox1.ItemIndex=0 then
  begin
   mapno2:=mapno;
  end
 else if form22.ComboBox1.ItemIndex=1 then
  begin
   mapno2:=3;
  end;
{1.initial value for maximum and Minimum}
 jj:=1;
 ii:=1;
 while (jj<=intro[2,mapno2]) do
  begin
   while (ii<=intro[1,mapno2]) do
    begin
     if z.z[ii,jj,kk]<>erro then
      begin
       max:=z.z[ii,jj,kk];
       min:=max;
       jj:=intro[2,mapno2];
       ii:=intro[1,mapno2];
      end;
     ii:=ii+1;
    end;
   jj:=jj+1;
   ii:=1;
  end;
 jj:=1;
 ii:=1;
 while (jj<=intro[2,mapno2]) do
  begin
   while (ii<=intro[1,mapno2]) do
    begin
     if (z.z[ii,jj,kk]<>erro)then
      begin
       max:=(abs(z.z[ii,jj,kk]+max)+abs(z.z[ii,jj,kk]-max))/2;
       min:=(abs(z.z[ii,jj,kk]+min)-abs(z.z[ii,jj,kk]-min))/2;
      end;
     ii:=ii+1;
    end;
   jj:=jj+1;
   ii:=1;
  end;
 max:=trunc((max/100)+1)*100;
 min:=trunc((min/100))*100;
end;
procedure tForm21.azim;
var
 ii,jj,kk:integer;
begin
 with image3.canvas do
  begin
 image3.Canvas.Pen.Width:=1;
 image3.Canvas.Polygon([point(50,0),point(40,30),point(50,45),point(60,30)]);
 image3.Canvas.Ellipse(5,45,95,135);
 for ii:=0 to 7 do
  begin
   image3.Canvas.MoveTo(50,90);
   Image3.Canvas.LineTo(trunc(50*sin(ii*3.14/4)+50),trunc(50*cos(ii*3.14/4)+90));
  end;
 image3.Canvas.MoveTo(50,0);
 image3.Canvas.LineTo(50,140);
 image3.Canvas.Font.Name:='Times New Roman';
 image3.Canvas.Font.Style:=[fsBold];
 image3.Canvas.Font.Size:=45;
 image3.Canvas.TextOut(28,52,'N');
  end;
end;
procedure TForm21.Button1Click(Sender: TObject);
var
 ii,jj,mapno2:integer;
 bitmap:tbitmap;
begin
 if form22.ComboBox1.ItemIndex=0 then
  begin
   mapno2:=mapno;
  end
 else if form22.ComboBox1.ItemIndex=1 then
  begin
   mapno2:=3;
  end;
 if form22.ComboBox1.ItemIndex=0 then
  begin
   form21.Caption:=filenam[UpDown1.position];
  end;
 draw(10*mapno2);
end;
procedure tForm21.draw(hh:integer);
var
 kk,ii,jj,point,LL,HHH:integer;
 fac,max,min,extra:real;
 bitmap: Tbitmap;
begin
 HHH:=HH;
 IF HH>=10 THEN
   HH:=HH DIV 10;
 max:=intro[4,hh];
 min:=intro[3,hh];
 imageone(intro[3,hh],intro[4,hh],strtoint(form22.StringGrid1.Cells[1,0]));
 Bitmap := nil;
 try
  Bitmap := TBitmap.Create;
  Bitmap.Width := intro[1,hh]+2*intro[14,hh];
  Bitmap.Height := intro[2,hh]+2*intro[15,hh];
  Image2.Picture.Graphic := Bitmap;
 finally
  Bitmap.Free;
  end;
 image2.Visible:=false;
 image2.Width:=intro[1,hh]+2*intro[14,hh];
 image2.Height:=intro[2,hh]+2*intro[15,hh];
 fac:=(image1.Height-image1.Canvas.TextHeight('99'))/(max-min);
 extra:=(image1.Canvas.TextHeight('99')/2);
 for ii:=1 to intro[1,hh] do
  begin
   for jj:=1 to intro[2,hh] do
    begin
     if ((z.z[ii,jj,hh]<>error)) then
      begin
       point:=round(fac*(z.z[ii,jj,hh]-min)+extra);
       with image2.Picture.Bitmap,Canvas do
        begin
         LL:=II+JJ;
         if ((LL MOD 2)=0)AND((Z.draw[II,JJ])OR(HHH DIV 10>0)) then
           pixels[ii+intro[14,hh],jj+intro[15,hh]]:=image1.Canvas.Pixels[10,point]
         ELSE if ((LL MOD 2)=1) then
           pixels[ii+intro[14,hh],jj+intro[15,hh]]:=image1.Canvas.Pixels[10,point];
          end;
      end;
    end;
  end;
 image2.Visible:=true;
 image3.Left:=image2.Left;
 azim;
 gridline;
 Bitmap := nil;
  try
   Bitmap := TBitmap.Create;
   bitmap.Width:=image2.Width;
   bitmap.Height:=image2.Height;
   Image4.Picture.Graphic := Bitmap;
  finally
   Bitmap.Free;
  end;
 image4.Width:=image2.Width;
 image4.Height:=image2.Height;
 image4.Canvas.CopyRect(rect(0,0,Image4.Width,image4.Height),image2.Canvas,rect(0,0,image2.width,image2.height));
 if CheckBox1.Checked then
  begin
   WELLDRAWING2D(wlnumber);
  end
 else
  begin
   image2.Canvas.CopyRect(rect(0,0,Image2.Width,image2.Height),image4.Canvas,rect(0,0,image4.width,image4.height));
  end;
end;


procedure TForm21.DrawGrid1Click(Sender: TObject);
begin
 ColorDialog1.Execute;
end;

procedure TForm21.FormCreate(Sender: TObject);
var
 ii:integer;
begin
 mapno:=1;
 for ii:=1 to 20 do
  doornot[ii]:=false;
// imageone(0,100,30);
 for ii:=1 to 3 do
  begin
   intro[7,ii]:=1;
   fltro[1,ii]:=1;
   fltro[2,ii]:=1;
  end;
 polycount:=0;
 total[21]:=2;
 DWDTODSNFAC:=1/0.5;
end;
procedure tForm21.imageone(min,max:real;sect:integer);
var
 ii,point:integer;
 jj,jjj,extra,extra2,extra3,kk,extra4,inc1,inc2:real;
 colour:longint;
 bitmap: Tbitmap;
begin
 extra4:=sect;
 Image1.Canvas.Font.Name:='areal';
 extra3:=(image1.Canvas.TextHeight('9')/2);
 extra:=((image1.Height-2*extra3)/extra4);
 extra:=(abs(extra+image1.Canvas.TextHeight('9'))/2+abs(extra-image1.Canvas.TextHeight('9'))/2);
 extra2:=image1.Canvas.TextWidth(floattostr(max)+'>>-');
 if extraf1[2]=0 then
  begin
   extraf1[2]:=image1.height;
  end;
 Bitmap := nil;
 try
  Bitmap := TBitmap.Create;
  bitmap.Width:=round(extra2)+65;
  bitmap.Height:=round(extraf1[2]+extraf1[1]);
  Image1.Picture.Graphic := Bitmap;
 finally
  Bitmap.Free;
  end;
 image1.Width:=round(extra2)+65;
 image1.Height:=round(extraf1[2]+extraf1[1]);
 image1.Canvas.Pen.Color:=clwhite;
 image1.Canvas.Rectangle(0,0,image1.Width,image1.Height);
 image1.Canvas.Font.Color:=clblack;
 jj:=0;
 image1.canvas.font.size:=8;
 while kk<=image1.Height-2*extra3 do
  begin
   image1.Canvas.TextOut(trunc(image1.Width-extra2),round(kk),'- '+floattostr(round((min+kk*(max-min)/(image1.Height-2*extra3)))));
   kk:=kk+extra;
  end;
 image1.Canvas.TextOut(trunc(image1.Width-extra2),image1.Height-round(2*extra3),'- '+floattostr(max));
 ii:=form22.RadioGroup1.ItemIndex;
 jj:=extra3;
 jjj:=1;
 inc1:=(image1.Height-2*extra3)/extra4;
 inc2:=(form22.image1.Width)/extra4;
 while jj<=image1.Height-round(2*extra3) do
  begin
   Image1.Canvas.Brush.Color:=form22.Image1.Canvas.Pixels[round(jjj),ii*27+3];
   Image1.Canvas.Pen.Color:=form22.Image1.Canvas.Pixels[round(jjj),ii*27+3];
   image1.Canvas.Rectangle(0,round(jj),image1.Width-round(extra2),round(jj+inc1));
   jj:=jj+inc1;
   jjj:=jjj+inc2;
  end;
end;


procedure TForm21.Sect1Click(Sender: TObject);
begin
 form22.ShowModal;
end;

procedure TForm21.Image1DblClick(Sender: TObject);
var
 ii,jj,kk,extra:integer;
begin
end;

procedure TForm21.Image2MouseMove(Sender: TObject; Shift: TShiftState; X,
  Y: Integer);
var
 ii,jj,mapno2,d:integer;
 c:real;
begin
 if form22.ComboBox1.ItemIndex=0 then
  begin
   mapno2:=mapno;
  end
 else if form22.ComboBox1.ItemIndex=1 then
  begin
   mapno2:=3;
  end;
 ii:=Y+1-intro[15,mapno2];
 jj:=X+1-intro[14,mapno2];
 d:=form22.ListBox1.ItemIndex+1;
 if d=0 then
  d:=1;
 form23.conversion(intro[7,mapno2],d,c);
 form21.Caption:=inttostr(x)+'    '+inttostr(y);
 if (z.z[jj,ii,mapno2]<>error)
{ and(ii<image2.Width-intro[14,mapno2])and(ii>intro[14,mapno2])
 and(jj<image2.Height-intro[15,mapno2])and(jj>intro[15,mapno2])} then
  begin
   if form22.ComboBox1.ItemIndex=0 then
    statusbar1.SimpleText:='Layer # '+inttostr(UpDown1.Position)+' : '+' : X= '
    +floattostr(c*(intro[9,mapno2]+intro[5,mapno2]*jj))+'   '+form22.ListBox1.Items.Strings[d-1]
    +'   Y= '+floattostr(c*(intro[11,mapno2]+intro[6,mapno2]*ii))
    +'   '+form22.ListBox1.Items.Strings[d-1]+'  Depth ='+floattostr(c*(z.z[jj,ii,UpDown1.Position]))+'   '+form22.ListBox1.Items.Strings[d-1]
   else if form22.ComboBox1.ItemIndex=1 then
    statusbar1.SimpleText:='Differences Layers # '+form22.StringGrid1.Cells[1,1]+' & '+form22.StringGrid1.Cells[1,2]+' are: '+' : X= '+floattostr(c*(intro[9,mapno2]+intro[5,mapno2]*jj))+'   '+form22.ListBox1.Items.Strings[d-1]+'   Y= '+floattostr(c*(intro[11,mapno2]+intro[6,mapno2]*ii))+'   '+form22.ListBox1.Items.Strings[d-1]+'  Depth ='+floattostr(c*(z.z[jj,ii,3]))+'   '+form22.ListBox1.Items.Strings[d-1]
  end
 else
  statusbar1.SimpleText:='Layer # '+inttostr(UpDown1.Position)+' : '+' : X= '+floattostr(c*(intro[9,mapno2]+intro[5,mapno2]*jj))+'   '+form22.ListBox1.Items.Strings[d-1]+'   Y= '+floattostr(c*(intro[11,mapno2]+intro[6,mapno2]*ii))+'   '+form22.ListBox1.Items.Strings[d-1]+'  Depth = Error';
end;


procedure TForm21.CheckBox1Click(Sender: TObject);
var
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
 draw(mapno2);
end;

procedure TForm21.CrossSection1Click(Sender: TObject);
begin
// form6.Draw;
end;

procedure TForm21.N3d1Click(Sender: TObject);
begin
 form25.showmodal;
end;

procedure TForm21.CheckBox2Click(Sender: TObject);
var
 ii,jj,mapno2:integer;
begin
 if form22.ComboBox1.ItemIndex=0 then
  begin
   mapno2:=mapno;
  end
 else if form22.ComboBox1.ItemIndex=1 then
  begin
   mapno2:=3;
  end;
   image2.Canvas.Brush.Style := bsClear;
   Image2.Canvas.Pen.Style   := psDash;
   Image2.Canvas.Pen.Mode    := pmNot;
   ii:=1;
   while ii<image2.Width  do
    begin
     image2.Canvas.MoveTo(ii,0);
     image2.Canvas.Lineto(ii,image2.Height);
     ii:=ii+trunc((intro[1,mapno2]+intro[2,mapno2])/10);
    end;
   jj:=1;
   while jj<image2.Height do
    begin
     image2.Canvas.MoveTo(0,jj);
     image2.Canvas.Lineto(Image2.Width,jj);
     jj:=jj+trunc((intro[1,mapno2]+intro[2,mapno2])/10);
    end;
end;


procedure TForm21.Units1Click(Sender: TObject);
begin
 form22.Show;
end;

procedure TForm21.UpDown1Click(Sender: TObject; Button: TUDBtnType);
var
 mapno2:integer;
begin
 mapno:=UpDown1.Position;
 if form22.ComboBox1.ItemIndex=0 then
  begin
   mapno2:=mapno;
  end
 else if form22.ComboBox1.ItemIndex=1 then
  begin
   mapno2:=3;
  end;
 DRAW(mapno2);
end;

procedure TForm21.Image3MouseDown(Sender: TObject; Button: TMouseButton;
  Shift: TShiftState; X, Y: Integer);
begin
 total[21]:=1;
end;

procedure TForm21.Image3MouseUp(Sender: TObject; Button: TMouseButton;
  Shift: TShiftState; X, Y: Integer);
begin
 total[21]:=0;
end;

procedure TForm21.Image3MouseMove(Sender: TObject; Shift: TShiftState; X,
  Y: Integer);
begin
 if total[21]=1 then
  begin
   image3.Left:=image3.Left+X;
   image3.Top:=Image3.Top+Y;
  end;
end;

procedure TForm21.Zoom1Click(Sender: TObject);
begin
 form23.ShowModal;
end;

procedure TForm21.Options1Click(Sender: TObject);
begin
 form30.ShowModal;
end;

procedure TForm21.Image2MouseDown(Sender: TObject; Button: TMouseButton;
  Shift: TShiftState; X, Y: Integer);
var
 D,mapno2:integer;
 bitmap:tbitmap;
 pt,pt2:array [1..3] of tpoint;
 SS,SSS:STRING;
 II,jj,kk:INTEGER;
 C:REAL;
begin
 d:=form22.ListBox1.ItemIndex+1;
 form23.conversion(intro[7,mapno2],d,c);
 if form22.ComboBox1.ItemIndex=0 then
  begin
   mapno2:=mapno;
  end
 else if form22.ComboBox1.ItemIndex=1 then
  begin
   mapno2:=3;
  end;
 ii:=X+1-intro[14,mapno2];
 jj:=Y+1-intro[15,mapno2];
 pt[1].X:=x;
 pt[1].Y:=y-8;
 pt[2].X:=x-3;
 pt[2].Y:=y;
 pt[3].X:=x+3;
 pt[3].Y:=y;
 pt2[1].X:=x;
 pt2[1].Y:=y-8;
 pt2[2].X:=x-6;
 pt2[2].Y:=y+8;
 pt2[3].X:=x+6;
 pt2[3].Y:=y+8;
 if doornot[3] then
  begin
   Image2.Canvas.Brush.Style := bsClear;
   Image2.Canvas.Pen.Style   := psSolid;
   image2.Canvas.Polygon(pt2);
   image2.Canvas.Polygon(pt);
   wlnumber:=wlnumber+1;
   Button4.Caption:='Accept Well';
   image2.Canvas.Font.Size:=8;
   form01.ADOTABLE1.Active:=false;
   form01.ADOTable1.TableName:=welltablename[ComboBox1.ItemIndex+1];
   form01.ADOTABLE1.Active:=true;
   form01.DBGrid3.Visible:=FALSE;
   form01.ADOTABLE1.Open;
   form01.ADOTABLE1.first;
   kk:=1;
{   edit1.text:='0';
   edit1.Top:=y+image2.Top+8;
   edit1.left:=x+image2.Left-round(edit1.Width/2);
   edit1.Visible:=true;      }
   form23.conversion(intro[7,mapno2],form22.ListBox1.ItemIndex+1,c);
   while NOT(form01.ADOTable1.Eof) do
    BEGIN
     wellddd[wlnumber,kk].welnam:=ComboBox1.Items[ComboBox1.ItemIndex];
     wellddd[wlnumber,kk].x:=c*(intro[9,mapno2]+intro[5,mapno2]*ii+form01.ADOTable1.FieldByName('EW').AsFloat*DWDTODSNFAC);
     wellddd[wlnumber,kk].z:=c*(intro[11,mapno2]+intro[6,mapno2]*jj-form01.ADOTable1.FieldByName('NS').AsFloat*DWDTODSNFAC);
     wellddd[wlnumber,kk].y:=c*(form01.ADOTable1.FieldByName('TVD').AsFloat*DWDTODSNFAC);
     form01.ADOTable1.Next;
     kk:=kk+1;
    END;
   DRAW(mapno2);
  end
 ELSE if (doornot[1]=true)or(doornot[2]=true) then
  begin
   poly[polycount]:=point(x,y);
   Image2.Canvas.Brush.Style := bsClear;
   Image2.Canvas.Pen.Style   := psSolid;
   image2.Canvas.Polygon(pt2);
   image2.Canvas.Polygon(pt);
   if polycount>0 then
    image2.Canvas.LineTo(x,y)
   else
    image2.Canvas.MoveTo(x,y);
   polycount:=polycount+1;
  end
 else if not(doornot[3]) then

  begin
   if lineno1=1 then
    begin
     DRAW(MAPNO2);
    //     image2.Canvas.CopyRect(rect(0,0,Image2.Width,image2.Height),image4.Canvas,rect(0,0,image4.width,image4.height));
     image2.Canvas.Font.Size:=16;
     image2.Canvas.Font.Name:='Areal';
     image2.Canvas.TextOut(X,Y-6-image2.Canvas.TextHeight('A'),'A');
    end;
   image2.Canvas.Pen.Style:=psSolid;
   line1[lineno1].X:=X;
   line1[lineno1].Y:=Y;
  // image2.Canvas.Ellipse(X-5,Y-5,X+5,Y+5);
   image2.Canvas.Polygon(pt2);
   image2.Canvas.Polygon(pt);

   if lineno1=2 then
    begin
     image2.Canvas.Font.Size:=16;
     image2.Canvas.Font.Name:='Areal';
     image2.Canvas.TextOut(X,Y-6-image2.Canvas.TextHeight('B'),'B');
     lineno1:=0;
     if (line1[2].x-line1[1].x)=0 then
      line1[2].x:=1+line1[1].x;
     if (line1[2].y-line1[1].y)=0 then
      line1[2].y:=1+line1[1].y;
     image2.Canvas.MoveTo(line1[1].x,line1[1].y);
     image2.Canvas.LineTo(line1[2].x,line1[2].y);
     button2.Enabled:=true;
    end;
   lineno1:=lineno1+1;
  end;
end;

procedure TForm21.BitBtn1Click(Sender: TObject);
var
bitmap:tbitmap;
begin

end;

procedure TForm21.Button3Click(Sender: TObject);
var
 ii,jj,mapno2:integer;
 bitmap:tbitmap;
begin
 if form22.ComboBox1.ItemIndex=0 then
  begin
   mapno2:=mapno;
  end
 else if form22.ComboBox1.ItemIndex=1 then
  begin
   mapno2:=3;
  end;
 if doornot[1]=false then
  begin
   Button3.Caption:='Draw Polygon';
   Bitmap := nil;
   try
    Bitmap := TBitmap.Create;
    Bitmap.Width := intro[1,mapno2];
    Bitmap.Height := intro[2,mapno2];
    Image4.Picture.Graphic := Bitmap;
   finally
    Bitmap.Free;
    image4.Width:=image2.Width;
    image4.Height:=image2.Height;
    Image4.Canvas.CopyRect(rect(0,0,Image4.Width,Image4.Height),image2.canvas,rect(0,0,Image2.Width,Image2.Height));
   end;
   doornot[1]:=true
  end
 else
  begin
   if polycount<>0 then
    begin
     image2.Canvas.Brush.Style:=bsDiagCross;
     image2.Canvas.Brush.Color:=claqua;
     image2.Canvas.Polygon(slice(poly,polycount));
     if MessageDlg('Do you Accept this region?',mtConfirmation, [mbYes, mbNo],-1) = mrYes then
      begin
       for ii:=1 to intro[1,mapno2] do
         for jj:=1 to intro[2,mapno2] do
           z.draw[ii,jj]:=TRUE;
       image2.Visible:=false;
       image2.Canvas.Brush.Style:=bssolid;
       image2.Canvas.Brush.Color:=clwhite;
       image2.Canvas.pen.Color:=clwhite;
       image2.Canvas.Rectangle(0,0,image2.Width,image2.Height);
       image2.Canvas.Brush.Color:=claqua;
       image2.Canvas.pen.Color:=claqua;
       image2.Canvas.Polygon(slice(poly,polycount));
       for ii:=1 to intro[1,mapno2] do
        for jj:=1 to intro[2,mapno2] do
         if image2.Canvas.Pixels[ii+intro[14,mapno2],jj+intro[15,mapno2]]<>claqua then
          z.draw[ii,jj]:=false;
       polycount:=0;
       if form22.ComboBox1.ItemIndex=0 then
        begin
         form21.Caption:=filenam[UpDown1.position];
         draw(UpDown1.Position);
        end
       else if form22.ComboBox1.ItemIndex=1 then
        draw(3)
      end
     else
      begin
       Bitmap := nil;
       try
        Bitmap := TBitmap.Create;
        Bitmap.Width := intro[1,mapno2]+intro[14,mapno2];
        Bitmap.Height := intro[2,mapno2]+intro[15,mapno2];
        Image2.Picture.Graphic := Bitmap;
       finally
        Bitmap.Free;
        Image2.Canvas.CopyRect(rect(0,0,Image2.Width,Image2.Height),image4.canvas,rect(0,0,Image4.Width,Image4.Height));
       end;
      end;
    end;
   doornot[1]:=false;
   polycount:=0;
   Button3.Caption:='Select Polygon';
  end;
end;

procedure TForm21.Button4Click(Sender: TObject);
var
 ii,jj,KK,mapno2,ll:integer;
 bitmap:tbitmap;
 ss,SSS,CT,FLD,qq:string;
begin
 if form22.ComboBox1.ItemIndex=0 then
  begin
   mapno2:=mapno;
  end
 else if form22.ComboBox1.ItemIndex=1 then
  begin
   mapno2:=3;
  end;
 if doornot[3]=false then
  begin
   for ii := 1 to 100 do
     for jj := 1 to 1000 do
      begin
       wellddd[ii,jj].x:=0;
       wellddd[ii,jj].z:=0;
       wellddd[ii,jj].y:=0;
       wellddd[ii,jj].welnam:='';
      end;
   wlnumber:=0;
   Button4.Caption:='Accept Well(s)';
   doornot[3]:=true;
   CheckBox1.Checked:=true;
   CheckBox1.Enabled:=false;
  end
 else
  begin
   Button4.Caption:='Well Locator';
   CheckBox1.Enabled:=true;
   doornot[3]:=false;
   if MessageDlg('Do you Accept this well(s)?',mtConfirmation, [mbYes, mbNo],-1) = mrYes then
    begin
     Form01.FNDTABLE(ss);
     form01.ADOTable1.Active:=false;
     form01.ADOTable1.TableName:=ss;
     form01.ADOTable1.Active:=true;
     Form01.ADOTable1.First;
     image2.Canvas.CopyRect(rect(0,0,Image2.Width,image2.Height),image4.Canvas,rect(0,0,image4.width,image4.height));
     ll:=0;
     qq:='';
     while not(Form01.ADOTable1.Eof) do
      begin
       CT:=form01.ADOTable1.FieldByName('COUNTRY').AsString;
       FLD:=form01.ADOTable1.FieldByName('FIELD').AsString;
       qq:=form01.ADOTable1.FieldByName('EW').asstring+
       form01.ADOTable1.FieldByName('NS').asstring+
       form01.ADOTable1.FieldByName('MSL').asstring;
       FORM01.ADOTABLE1.NEXT;
       ll:=ll+1;
      end;
     if ((ll=1)and(qq='')) then
      begin
       form01.ADOTABLE1.Open;
       form01.ADOTABLE1.edit;
       form01.ADOTable1.FieldByName('COUNTRY').AsString:=CT;
       form01.ADOTable1.FieldByName('FIELD').AsString:=FLD;
       kk:=1;
       SS:='';
       SSS:=WELLDDD[1,1].welnam;
       while COPY(SSS,kk,4)<>' => ' do
        BEGIN
         SS:=SS+COPY(SSS,kk,1);
         kk:=kk+1;
        END;
       form01.ADOTable1.FieldByName('WELL').AsString:=SS;
       SS:='';
       JJ:=KK+4;
       while JJ<=LENGTH(SSS) do
        BEGIN
         SS:=SS+COPY(SSS,JJ,1);
         JJ:=JJ+1;
        END;
       form01.ADOTable1.FieldByName('CALC').AsString:=SS;
       form01.ADOTable1.FieldByName('NS').ASFLOAT:=WELLDDD[1,1].z;
       form01.ADOTable1.FieldByName('EW').ASFLOAT:=WELLDDD[1,1].X;
       form01.ADOTable1.FieldByName('MSL').ASFLOAT:=WELLDDD[1,1].y;
       FORM01.ADOTable1.Post;
       FORM01.ADOTable1.Next;
       wlnumber:=wlnumber-1;
      end;
     for ii := 1 to wlnumber do
      begin
       form01.ADOTABLE1.Open;
       form01.ADOTABLE1.INSERT;
       form01.ADOTable1.FieldByName('COUNTRY').AsString:=CT;
       form01.ADOTable1.FieldByName('FIELD').AsString:=FLD;
       kk:=1;
       SS:='';
       SSS:=WELLDDD[ii,1].welnam;
       while COPY(SSS,kk,4)<>' => ' do
        BEGIN
         SS:=SS+COPY(SSS,kk,1);
         kk:=kk+1;
        END;
       form01.ADOTable1.FieldByName('WELL').AsString:=SS;
       SS:='';
       JJ:=KK+4;
       while JJ<=LENGTH(SSS) do
        BEGIN
         SS:=SS+COPY(SSS,JJ,1);
         JJ:=JJ+1;
        END;
       form01.ADOTable1.FieldByName('CALC').AsString:=SS;
       form01.ADOTable1.FieldByName('NS').ASFLOAT:=WELLDDD[ii,1].z;
       form01.ADOTable1.FieldByName('EW').ASFLOAT:=WELLDDD[ii,1].X;
       form01.ADOTable1.FieldByName('MSL').ASFLOAT:=WELLDDD[ii,1].y;
       FORM01.ADOTable1.Post;
       FORM01.ADOTable1.Next;
      end;
    end
   ELSE
    BEGIN
     wlnumber:=0;
    END;
   DRAW(mapno2);
  end
end;

procedure TForm21.Button2Click(Sender: TObject);
var
 ii,jj,kk,min,max,extra,mapno2:integer;
 a,b:real;
 Bitmap: TBitmap;
begin
 if form22.ComboBox1.ItemIndex=0 then
  begin
   mapno2:=mapno;
  end
 else if form22.ComboBox1.ItemIndex=1 then
  begin
   mapno2:=3;
  end;
 form31.series1.Clear;
 form21.cross(line1[1].x-intro[14,mapno2],line1[1].y-intro[15,mapno2]
 ,line1[2].x-intro[14,mapno2],line1[2].y-intro[15,mapno2]);
 form31.Show;
end;

procedure TForm21.Image1MouseDown(Sender: TObject; Button: TMouseButton;
  Shift: TShiftState; X, Y: Integer);
var
 r:real;
begin
 r:=sqrt((x-image1.Width)*(x-image1.Width)+(y-image1.Height)*(y-image1.Height));
 if r<=9 then
  begin
   extraf1[4]:=1;
   extraf1[3]:=y;
  end;
end;

procedure TForm21.Image1MouseMove(Sender: TObject; Shift: TShiftState; X,
  Y: Integer);
var
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
 if extraf1[4]=1 then
  begin
   extraf1[1]:=y-extraf1[3];
   if image1.Height+extraf1[1]>20 then
    begin
     imageone(intro[3,mapno2],intro[4,mapno2],strtoint(form22.StringGrid1.Cells[1,0]));
    end;
  end;
end;

procedure TForm21.Image1MouseUp(Sender: TObject; Button: TMouseButton;
  Shift: TShiftState; X, Y: Integer);
begin
 extraf1[4]:=0;
 extraf1[3]:=0;
 extraf1[1]:=0;
 extraf1[2]:=image1.Height;
end;

procedure TForm21.MapMake1Click(Sender: TObject);
begin
 form23.Show;
end;

procedure TForm21.Properties2Click(Sender: TObject);
begin
 form24.showmodal;
end;

procedure TForm21.CrossSection2Click(Sender: TObject);
begin
 form26.showmodal;
end;

procedure TForm21.FormShow(Sender: TObject);
begin
 lineno1:=1;
 doornot[3]:=false;
end;

procedure TForm21.Option1Click(Sender: TObject);
begin
 form29.ShowModal;
end;

procedure TForm21.N3d21Click(Sender: TObject);
begin
 draw(0);
 form35.showmodal;

end;

end.
