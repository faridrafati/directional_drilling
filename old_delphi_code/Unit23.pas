unit Unit23;

interface

uses
  Windows, Messages, SysUtils, Variants, Classes, Graphics, Controls, Forms,
  Dialogs, Menus, ExtDlgs, ExtCtrls, Gauges, StdCtrls, Grids, ComCtrls,math,
  Buttons, CheckLst;

type
  TForm23 = class(TForm)
    Button1: TButton;
    GroupBox2: TGroupBox;
    GroupBox3: TGroupBox;
    GroupBox4: TGroupBox;
    GroupBox5: TGroupBox;
    CheckBox1: TCheckBox;
    CheckBox2: TCheckBox;
    CheckBox5: TCheckBox;
    CheckBox4: TCheckBox;
    ListBox1: TListBox;
    Image1: TImage;
    RadioGroup1: TRadioGroup;
    StringGrid1: TStringGrid;
    RadioGroup2: TRadioGroup;
    ColorDialog1: TColorDialog;
    CheckBox3: TCheckBox;
    StringGrid2: TStringGrid;
    ListBox2: TListBox;
    Edit3: TEdit;
    Image2: TImage;
    RadioGroup3: TRadioGroup;
    CheckBox6: TCheckBox;
    Label5: TLabel;
    Edit6: TEdit;
    UpDown3: TUpDown;
    Label6: TLabel;
    Edit7: TEdit;
    UpDown4: TUpDown;
    Edit8: TEdit;
    Label7: TLabel;
    UpDown5: TUpDown;
    Image3: TImage;
    Image4: TImage;
    GroupBox1: TGroupBox;
    Image5: TImage;
    Label1: TLabel;
    Label2: TLabel;
    Edit2: TEdit;
    UpDown1: TUpDown;
    Button2: TButton;
    Edit4: TEdit;
    CheckBox7: TCheckBox;
    GroupBox8: TGroupBox;
    Label3: TLabel;
    Edit1: TEdit;
    CheckBox8: TCheckBox;
    GroupBox6: TGroupBox;
    Label4: TLabel;
    ListBox3: TListBox;
    Edit5: TEdit;
    UpDown2: TUpDown;
    Label8: TLabel;
    Edit9: TEdit;
    OpenDialog1: TOpenDialog;
    Label9: TLabel;
    Edit10: TEdit;
    procedure predraw(h:integer);
    procedure conversion(a,b:shortint;var c:real);
    procedure Button1Click(Sender: TObject);
    procedure FormCreate(Sender: TObject);
    procedure CheckBox1Click(Sender: TObject);
    procedure CheckBox2Click(Sender: TObject);
    procedure CheckBox5Click(Sender: TObject);
    procedure CheckBox4Click(Sender: TObject);
    procedure RadioGroup1Click(Sender: TObject);
    procedure CheckBox3Click(Sender: TObject);
    procedure FormShow(Sender: TObject);
    procedure UpDown1Changing(Sender: TObject; var AllowChange: Boolean);
    procedure Button2Click(Sender: TObject);
    procedure UpDown2Changing(Sender: TObject; var AllowChange: Boolean);
    procedure UpDown3Changing(Sender: TObject; var AllowChange: Boolean);
    procedure UpDown4Changing(Sender: TObject; var AllowChange: Boolean);
    procedure UpDown5Changing(Sender: TObject; var AllowChange: Boolean);
    procedure RadioGroup3Click(Sender: TObject);
    procedure Button3Click(Sender: TObject);
    PROCEDURE WELLDRAWING2D;
  private
    { Private declarations }
  public
    { Public declarations }
  end;

var
  Form23: TForm23;
  extraf3:array[0..11]of boolean;
  extraf38:real;
  x14,y15:integer;
implementation

uses Unit21, Unit28, Unit22, Unit32, Unit01;

{$R *.dfm}
procedure TForm23.conversion(a,b:shortint;var c:real);
var
 ii:integer;
 extra:array[1..20]of real;
 extra2,extra3:real;
begin
 if b<>a then
  begin
   if b<a then
    b:=b+8;
   extra[1]:=10000;
   extra[2]:=10;
   extra[3]:=32808.39895;
   extra[4]:=10936.13298;
   extra[5]:=6.213712;
   extra[6]:=5.399568;
   extra[7]:=18459.18248864;
   extra[8]:=64163.4255851;
   extra[9]:=10000;
   extra[10]:=10;
   extra[11]:=32808.39895;
   extra[12]:=10936.13298;
   extra[13]:=6.213712;
   extra[14]:=5.399568;
   extra[15]:=18459.18248864;
   extra[16]:=64163.4255851;
   c:=1;
   for ii:=a+1 to b do
    c:=c*extra[ii]/extra[ii-1];
  end
 else
  c:=1;
end;

procedure TForm23.predraw(h:integer);
var
 ii:integer;
begin
if h=3 then
 begin
  for ii:=1 to 20 do
   begin
    intro[ii,3]:=intro[ii,1];
    fltro[ii,3]:=fltro[ii,1];
   end;
 end;
end;
procedure pttoimg(xx,yy:real; var x: integer; var y: integer);
var
 mapno2:integer;
 a:real;
begin
 if form22.ComboBox1.ItemIndex=0 then
  begin
   mapno2:=mapno;
  end
 else if form22.ComboBox1.ItemIndex=1 then
  begin
   mapno2:=3;
  end;
 a:=strtofloat(form23.Edit1.Text);
 x:=trunc(a*(xx-intro[9,mapno2])/intro[5,mapno2]+x14);
 y:=trunc(a*(yy-intro[11,mapno2])/intro[6,mapno2]+y15);
end;

PROCEDURE TForm23.WELLDRAWING2D;
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
// form28.image1.Canvas.CopyRect(rect(0,0,form28.image1.Width,form28.image1.Height),image4.Canvas,rect(0,0,image4.width,image4.height));
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
 for ii := 1 to jj do
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
   form28.image1.Canvas.Brush.Style := bsClear;
   form28.image1.Canvas.Pen.Style   := psSolid;
   form28.image1.Canvas.Polygon(pt2);
   form28.image1.Canvas.Polygon(pt);
   form01.DBGrid3.Visible:=true;
   form28.image1.Canvas.Font.Name:='Areal';
   kk:=1;
   SS:='';
   SSS:=welldd[ii,1].welnam;
   while COPY(SSS,kk,4)<>' => ' do
    BEGIN
     SS:=SS+COPY(SSS,kk,1);
     kk:=kk+1;
    END;
   form28.image1.Canvas.font.Size:=strtoint(edit9.Text);
   form28.image1.Canvas.TextOut(X-ROUND(0.5*form28.image1.Canvas.TextWidth(SS)),Y-6-form28.image1.Canvas.TextHeight('A'),SS);
   FORM28.Image1.Canvas.Pen.Width:=STRTOINT(edit10.text);
   kk:=1;
   while welldd[ii,kk+1].welnam<>'' do
    begin
     pttoimg(welldd[ii,kk].x,welldd[ii,kk].z,x,y);
     form28.image1.Canvas.MoveTo(x,y);
     pttoimg(welldd[ii,kk+1].x,welldd[ii,kk+1].z,x,y);
     form28.image1.Canvas.lineto(x,y);
     kk:=kk+1;
    end;
  end;
 FORM28.Image1.Canvas.Pen.Width:=1;
end;
procedure TForm23.Button1Click(Sender: TObject);
var
 bitmap: Tbitmap;
 ii,jj,point,h,hh,mapno2:integer;
 min,max,xos,yos:real;
 logrec:tlogfont;
 r:trect;
 c:real;
begin
 if form23.RadioGroup2.ItemIndex=0 then
  begin
   mapno2:=mapno;
  end
 else if form23.RadioGroup2.ItemIndex=1 then
  begin
   mapno2:=3;
  end;
 if form23.RadioGroup2.ItemIndex=1 then
  predraw(3);
 h:=strtoint(StringGrid1.Cells[1,1]);
 hh:=strtoint(StringGrid1.Cells[1,2]);
{ for ii:=0 to RadioGroup1.Items.count-1 do
  if RadioGroup1.Buttons[ii].Checked then
   begin
    form21.Label1.Caption:='Min '+RadioGroup1.Items.ValueFromIndex[ii]+'-';
    form21.Label2.Caption:='Max '+RadioGroup1.Items.ValueFromIndex[ii]+'-';
    form21.Label3.Caption:='Mid '+RadioGroup1.Items.ValueFromIndex[ii]+'-';
   end;          }
 if RadioGroup2.Buttons[1].Checked then
  begin
   for ii:=1 to intro[1,mapno2] do
    for jj:=1 to intro[2,mapno2] do
     if (z.z[ii,jj,h]<>error)and(z.z[ii,jj,hh]<>error)then
      z.z[ii,jj,3]:=abs(z.z[ii,jj,h]-z.z[ii,jj,hh])
     else
      z.z[ii,jj,3]:=error;
   form21.maxmin(error,3,max,min);
   intro[3,3]:=trunc(min);
   intro[4,3]:=trunc(max);
  end;
 if RadioGroup1.Buttons[0].Checked then
  begin
   form21.maxmin(error,mapno2,max,min);
  end;
 if form23.RadioGroup2.ItemIndex=0 then
  begin
   form28.Caption:=filenam[mapno2];
   form28.draw(mapno2);
  end
 else if form23.RadioGroup2.ItemIndex=1 then
  begin
   form28.draw(3);
  end;
 if (fltro[1,mapno2]-strtofloat(form23.Edit1.Text)<>0)or(fltro[2,mapno2]-strtofloat(form23.Edit1.Text)<>0)then
  for ii:=0 to 10 do
   extraf3[ii]:=false;
 fltro[1,mapno2]:=strtofloat(form23.Edit1.Text);
 fltro[2,mapno2]:=strtofloat(form23.Edit1.Text);
 form28.Image1.Visible:=false;
 Bitmap := nil;
 form28.image1.Canvas.Font.Size:=strtoint(edit8.Text);
 form28.image1.Canvas.Font.Name:='Areal';
 if (intro[2,mapno2]/intro[1,mapno2])>1 then
  intro[8,mapno2]:=1
 else
  intro[8,mapno2]:=-1;
 if power((intro[2,mapno2]/intro[1,mapno2]),intro[8,mapno2])<sqrt(2){A4} then
  begin
   x14:=form28.image1.Canvas.TextHeight('8')+4;
   y15:=round(((intro[1,mapno2]*fltro[1,mapno2]+2*x14)*sqrt(2)-intro[2,mapno2]*fltro[2,mapno2])/2);
  end
 else
  begin
   y15:=form28.image1.Canvas.TextHeight('8')+4;
   x14:=round(((intro[2,mapno2]*fltro[2,mapno2]+2*y15)/sqrt(2)-intro[1,mapno2]*fltro[1,mapno2])/2);
  end;
 try
   Bitmap := TBitmap.Create;
   Bitmap.Width := round(intro[1,mapno2]*fltro[1,mapno2])+2*x14;
   Bitmap.Height := round(intro[2,mapno2]*fltro[2,mapno2])+2*y15;
   form28.Image1.Picture.Graphic := Bitmap;
 finally
   Bitmap.Free;
  end;
 form28.Image1.Width := round(intro[1,mapno2]*fltro[1,mapno2])+2*x14;
 form28.Image1.Height := round(intro[2,mapno2]*fltro[2,mapno2])+2*y15;
 form28.Image1.Canvas.CopyRect(rect(x14,y15,round(fltro[1,mapno2]*form28.Image8.Width+x14)
                               ,round(fltro[2,mapno2]*form28.Image8.Height)+y15)
                               ,form28.image8.canvas,rect(0,0,form28.Image8.Width,form28.Image8.Height));

 if CheckBox7.Checked then
   form28.contour(mapno2,x14,y15);
 FORM28.Image1.Canvas.Pen.Width:=1;
 if (Checkbox2.Checked) then
  begin
   conversion(intro[7,mapno2],ListBox1.ItemIndex+1,c);
   form28.Image1.Canvas.Brush.Style := bsClear;
   form28.Image1.Canvas.Pen.Style   := psDash;
   form28.image1.Canvas.Font.Size:=strtoint(edit8.Text);
   form28.image1.Canvas.Font.Name:='Areal';
   xos:=strtoint(StringGrid2.Cells[1,0]);
   yos:=strtoint(StringGrid2.Cells[1,1]);
   ii:=form28.image1.Canvas.TextHeight('8')+4;
   jj:=0;
   while ii<form28.image1.Width-form28.image1.Canvas.TextHeight('8')+4  do
    begin
     form28.image1.Canvas.Font.Size:=strtoint(edit8.Text);
     form28.image1.Canvas.Font.Name:='Areal';
     form28.image1.Canvas.MoveTo(ii,form28.image1.Canvas.TextHeight('8')+4);
     form28.image1.Canvas.Lineto(ii,form28.image1.Height-4-form28.image1.Canvas.TextHeight('8'));
     ii:=ii+trunc((form28.image1.width-2*form28.image1.Canvas.TextHeight('8')-8)/xos);
     if (ii>form28.image1.Canvas.textwidth(floattostr(0.001*trunc(1000*c*(ii*intro[5,mapno2]+intro[9,mapno2])))))
     and((form28.image1.width-ii)>form28.image1.Canvas.textwidth(floattostr(0.001*trunc(1000*c*(ii*intro[5,mapno2]+intro[9,mapno2])))))then
      if jj<>0 then
       form28.image1.Canvas.TextOut(round(ii-form28.image1.Canvas.textwidth(floattostr(0.001*trunc(1000*c*(ii*intro[5,mapno2]+intro[9,mapno2]))))/2)
       ,form28.image1.Height-4-form28.image1.Canvas.textheight('88'),floattostr(0.001*round(1000*c*((ii-x14)*intro[5,mapno2]/fltro[1,mapno2]+intro[9,mapno2]))))
      else
       begin
        form28.image1.Canvas.Font.Size:=strtoint(edit8.Text);
        form28.image1.Canvas.Font.Name:='Areal';
        form28.image1.Canvas.TextOut(round(ii-form28.image1.Canvas.textwidth(floattostr(0.001*trunc(1000*c*(ii*intro[5,mapno2]+intro[9,mapno2]))))/2)
        ,form28.image1.Height-4-form28.image1.Canvas.textheight('88'),floattostr(0.001*round(1000*c*((ii-x14)*intro[5,mapno2]/fltro[1,mapno2]+intro[9,mapno2]))));
        form28.image1.Canvas.TextOut(1,form28.image1.Height-4-form28.image1.Canvas.textheight('88'),ListBox1.Items.Strings[listbox1.itemindex]);
        jj:=1;
       end;
    end;
   if ii<>form28.image1.Width-form28.image1.Canvas.TextHeight('8')+4  then
     ii:=ii-trunc((form28.image1.width-2*form28.image1.Canvas.TextHeight('8')-8)/xos);
   jj:=form28.image1.Canvas.TextHeight('H')+4;
   while jj<=form28.image1.Height-form28.image1.Canvas.TextHeight('8')+4 do
    begin
     form28.image1.Canvas.MoveTo(form28.image1.Canvas.TextHeight('8')+4,jj);
     form28.image1.Canvas.Lineto(ii,jj);
     jj:=jj+trunc((form28.image1.Height-2*form28.image1.Canvas.TextHeight('8')-8)/yos);
     if (jj>form28.image1.Canvas.textwidth(floattostr(0.001*trunc(1000*c*(jj*intro[6,mapno2]+intro[12,mapno2])))))
     and((form28.image1.Height-jj)>form28.image1.Canvas.textwidth(floattostr(0.001*trunc(1000*c*((jj-y15)*intro[6,mapno2]+intro[12,mapno2])))))then
      with form28.image1.Canvas do
       begin
        form28.image1.Canvas.Font.Size:=strtoint(edit8.Text);
        form28.image1.Canvas.Font.Name:='Areal';
        GetObject(Font.Handle, SizeOf(LogRec),Addr(LogRec));
        LogRec.lfEscapement := trunc(900);
        form28.image1.Canvas.Font.Handle := CreateFontIndirect( LogRec );
        form28.image1.Canvas.TextOut(0,round(jj+form28.image1.Canvas.textwidth(floattostr(0.001*trunc(1000*c*(jj*intro[6,mapno2]+intro[12,mapno2]))))/2)
        ,floattostr(0.001*round(1000*c*((jj-y15)*intro[6,mapno2]/fltro[2,mapno2]+intro[11,mapno2]))));
       end;
    end;
   form28.image1.Canvas.Brush.Style := bssolid;
   form28.image1.Canvas.Pen.Style   := pssolid;
  end;
 if CheckBox4.Checked then
  begin
   conversion(intro[7,mapno2],ListBox2.ItemIndex+1,c);
   form28.Imagefour(strtofloat(edit1.Text),c);
   form28.Image4.Visible:=True;
  end
 else
  begin
   form28.Image4.Visible:=false;
  end;
 if Checkbox5.Checked then
  begin
   form28.Image3.Visible:=true;
   form28.imagethree;
  end
 else
  begin
   form28.Image3.Visible:=false;
  end;
 if (CheckBox6.Checked)and(form23.RadioGroup2.ItemIndex=0) then
  begin
   form28.Image5.Visible:=true;
   form28.Imagefive;
  end
 else
  begin
   form28.Image5.Visible:=false;
  end;
 if (Checkbox8.Checked) then
  begin
   WELLDRAWING2D;
  end;
 for ii:=1 to intro[13,mapno2] do
  form28.contourdraw(line88[2*ii-1,mapno2].x,line88[2*ii-1,mapno2].y,line88[2*ii,mapno2].x,line88[2*ii,mapno2].y);
 if extraf3[11]=false then
  begin
   extraf3[11]:=true;
   form28.image2.top:=form28.image1.top+round((form28.image1.Height-form28.image2.Height)/2);
   form28.image2.left:=form28.image1.left+form28.Image1.Canvas.TextHeight('88')+8;
   form28.image3.Top:=form28.image1.top+form28.Image1.Canvas.TextHeight('88')+8;
   form28.image3.left:=form28.image1.left+form28.Image1.Width-form28.Image1.Canvas.TextHeight('88')-8-form28.image3.Width;
   form28.image4.Top:=form28.image1.top+form28.Image1.Canvas.TextHeight('88')+8;
   form28.image4.left:=form28.image1.left+form28.Image1.Canvas.TextHeight('88')+8;
   form28.image5.Top:=form28.image1.top+form28.Image1.Height-form28.Image5.Height-form28.Image1.Canvas.TextHeight('88')-8;
   form28.image5.left:=form28.image1.left+form28.Image1.Canvas.TextHeight('88')+8;
   form28.image7.Top:=form28.image1.top+form28.Image1.Height-form28.Image7.Height-form28.Image1.Canvas.TextHeight('88')-8;
   form28.image7.left:=form28.image1.left+form28.Image1.Width-form28.Image1.Canvas.TextHeight('88')-8-form28.image7.Width;
   form28.image9.Top:=form28.image1.top+form28.Image1.Height-form28.Image7.Height-form28.Image9.Height-form28.Image1.Canvas.TextHeight('88')-15;
   form28.image9.left:=form28.image1.left+form28.Image1.Width-form28.Image1.Canvas.TextHeight('88')-8-form28.image9.Width;
  end;
 form28.image1.Canvas.Font.Size:=strtoint(edit8.Text);
 form28.image1.Canvas.Font.Name:='Areal';
 ii:=form28.image1.Canvas.TextHeight('8')+8;

 JJ:=form28.Image2.top-form28.Image1.top;
 point:=form28.Image1.Height-form28.Image2.Height-2*ii;
 c:=(form28.Image1.Height*(extraf38/strtofloat(edit1.Text))-2*ii-form28.Image2.Height);
 form28.Image2.Top:=round(point*(jj-ii)/c)+ii+form28.Image1.Top;

 JJ:=form28.Image3.top-form28.Image1.top;
 point:=form28.Image1.Height-form28.Image3.Height-2*ii;
 c:=(form28.Image1.Height*(extraf38/strtofloat(edit1.Text))-2*ii-form28.Image3.Height);
 form28.Image3.Top:=round(point*(jj-ii)/c)+ii+form28.Image1.Top;

 JJ:=form28.Image4.top-form28.Image1.top;
 point:=form28.Image1.Height-form28.Image4.Height-2*ii;
 c:=(form28.Image1.Height*(extraf38/strtofloat(edit1.Text))-2*ii-form28.Image4.Height);
 form28.Image4.Top:=round(point*(jj-ii)/c)+ii+form28.Image1.Top;

 JJ:=form28.Image5.top-form28.Image1.top;
 point:=form28.Image1.Height-form28.Image5.Height-2*ii;
 c:=(form28.Image1.Height*(extraf38/strtofloat(edit1.Text))-2*ii-form28.Image5.Height);
 form28.Image5.Top:=round(point*(jj-ii)/c)+ii+form28.Image1.Top;

 JJ:=form28.Image7.top-form28.Image1.top;
 point:=form28.Image1.Height-form28.Image7.Height-2*ii;
 c:=(form28.Image1.Height*(extraf38/strtofloat(edit1.Text))-2*ii-form28.Image7.Height);
 form28.Image7.Top:=round(point*(jj-ii)/c)+ii+form28.Image1.Top;

 JJ:=form28.Image9.top-form28.Image1.top;
 point:=form28.Image1.Height-form28.Image9.Height-2*ii;
 c:=(form28.Image1.Height*(extraf38/strtofloat(edit1.Text))-2*ii-form28.Image9.Height);
 form28.Image9.Top:=round(point*(jj-ii)/c)+ii+form28.Image1.Top;



 JJ:=form28.Image2.left-form28.Image1.left;
 point:=form28.Image1.width-form28.Image2.width-2*ii;
 c:=(form28.Image1.width*(extraf38/strtofloat(edit1.Text))-2*ii-form28.Image2.width);
 form28.Image2.left:=round(point*(jj-ii)/c)+ii+form28.Image1.left;

 JJ:=form28.Image3.left-form28.Image1.left;
 point:=form28.Image1.width-form28.Image3.width-2*ii;
 c:=(form28.Image1.width*(extraf38/strtofloat(edit1.Text))-2*ii-form28.Image3.width);
 form28.Image3.left:=round(point*(jj-ii)/c)+ii+form28.Image1.left;

 JJ:=form28.Image4.left-form28.Image1.left;
 point:=form28.Image1.width-form28.Image4.width-2*ii;
 c:=(form28.Image1.width*(extraf38/strtofloat(edit1.Text))-2*ii-form28.Image4.width);
 form28.Image4.left:=round(point*(jj-ii)/c)+ii+form28.Image1.left;

 JJ:=form28.Image5.left-form28.Image1.left;
 point:=form28.Image1.width-form28.Image5.width-2*ii;
 c:=(form28.Image1.width*(extraf38/strtofloat(edit1.Text))-2*ii-form28.Image5.width);
 form28.Image5.left:=round(point*(jj-ii)/c)+ii+form28.Image1.left;

 JJ:=form28.Image7.left-form28.Image1.left;
 point:=form28.Image1.width-form28.Image7.width-2*ii;
 c:=(form28.Image1.width*(extraf38/strtofloat(edit1.Text))-2*ii-form28.Image7.width);
 form28.Image7.left:=round(point*(jj-ii)/c)+ii+form28.Image1.left;

 JJ:=form28.Image9.left-form28.Image1.left;
 point:=form28.Image1.width-form28.Image9.width-2*ii;
 c:=(form28.Image1.width*(extraf38/strtofloat(edit1.Text))-2*ii-form28.Image9.width);
 form28.Image9.left:=round(point*(jj-ii)/c)+ii+form28.Image1.left;

 extraf38:=strtofloat(edit1.Text);
 form28.Image1.Visible:=true;
 form23.close;
 form28.Show;
end;
procedure TForm23.FormCreate(Sender: TObject);
var
 ii,jj,point,sect:integer;
 c:array[1..7]of int64;
 bitmap: Tbitmap;
begin
 extraf38:=strtofloat(edit1.Text);
 Image1.Canvas.Rectangle(0,0,image1.Width,Image1.Height);
 c[1]:=clred;
 c[2]:=rgb(255,128,0);
 c[3]:=clyellow;
 c[4]:=clLime;
 c[5]:=claqua;
 c[6]:=clblue;
 c[7]:=clpurple;
 jj:=6;
 for ii:=1 to jj do
  form22.Degrade(image1.canvas, c[ii], c[ii+1], rect(round((ii-1)*image1.Width/jj),0,round((ii)*image1.Width/jj),26));
 c[1]:=clwhite;
 c[2]:=clyellow;
 c[3]:=clred;
 c[4]:=clblack;
 jj:=3;
 for ii:=1 to jj do
  form22.Degrade(image1.canvas, c[ii], c[ii+1], rect(round((ii-1)*image1.Width/jj),27,round((ii)*image1.Width/jj),53));
 StringGrid1.Cells[0,0]:='Color Range';
 StringGrid1.Cells[1,0]:='23';
 form22.StringGrid1.Cells[0,0]:='Color Range';
 form22.StringGrid1.Cells[1,0]:='23';
 StringGrid1.Cells[0,1]:='Top Lay.';
 StringGrid1.Cells[1,1]:='1';
 form22.StringGrid1.Cells[0,1]:='Top Lay.';
 form22.StringGrid1.Cells[1,1]:='1';
 StringGrid1.Cells[0,2]:='Bot Lay.';
 StringGrid1.Cells[1,2]:='2';
 form22.StringGrid1.Cells[0,2]:='Bot Lay.';
 form22.StringGrid1.Cells[1,2]:='2';
 StringGrid1.Cells[0,3]:='Arbit Color #';
 StringGrid1.Cells[1,3]:='2';
 form22.StringGrid1.Cells[0,3]:='Arbit Color #';
 form22.StringGrid1.Cells[1,3]:='2';
 StringGrid2.Cells[0,0]:='# of Line in X';
 StringGrid2.Cells[1,0]:='6';
 StringGrid2.Cells[0,1]:='# of Line in Y';
 StringGrid2.Cells[1,1]:='6';
end;


procedure TForm23.CheckBox1Click(Sender: TObject);
var
 ii:integer;
begin
 if CheckBox1.Checked then
  begin
   Groupbox1.Enabled:=true;
  end
 else
  Groupbox1.Enabled:=false;
end;

procedure TForm23.CheckBox2Click(Sender: TObject);
begin
 if CheckBox2.Checked then
  Groupbox2.Enabled:=true
 else
  Groupbox2.Enabled:=false;

end;

procedure TForm23.CheckBox5Click(Sender: TObject);
begin
 if CheckBox5.Checked then
  Groupbox5.Enabled:=true
 else
  Groupbox5.Enabled:=false;

end;

procedure TForm23.CheckBox4Click(Sender: TObject);
begin
 if CheckBox4.Checked then
  Groupbox4.Enabled:=true
 else
  Groupbox4.Enabled:=false;

end;

procedure TForm23.RadioGroup1Click(Sender: TObject);
var
 ii,jj,kk:integer;
 c:array[1..10]of int64;
begin
 jj:=strtoint(StringGrid1.Cells[1,3])-1;
 if RadioGroup1.ItemIndex=2 then
  begin
   ii:=1;
   while ii<=jj+1 do
    begin
     if ColorDialog1.Execute then
      begin
       c[ii]:=ColorDialog1.Color;
       ii:=ii+1;
      end
     else
      ii:=jj+3;
    end;
   if ii<>jj+3 then
    for ii:=1 to jj do
     form22.Degrade(image1.canvas, c[ii], c[ii+1], rect(round((ii-1)*image1.Width/jj),54,round((ii)*image1.Width/jj),image1.height));
  end;
end;
procedure TForm23.CheckBox3Click(Sender: TObject);
begin
 if CheckBox3.Checked then
  begin
   form28.Image2.Visible:=true;
   extraf3[2]:=true;
//   form28.Image2.Top:=round((form28.Image1.Height-form28.Image2.Height)/2)+form28.Image1.top;
//   form28.imagetwo(intro[3,mapno2],intro[4,mapno2],strtoint(form3.StringGrid1.Cells[1,0]));
  end
 else
  begin
   extraf3[2]:=false;
   form28.Image2.Visible:=false;
  end;
end;
procedure TForm23.FormShow(Sender: TObject);
var
 mapno2:integer;
begin
 image5.Canvas.Font.Name:='Areal';
 image5.Canvas.Font.Style:=[fsbold];
 image5.Canvas.Rectangle(0,0,Image5.Width,Image5.Height);
 image5.Canvas.Font.Size:=UpDown1.Position;
 image5.Canvas.TextOut(round((image5.Width-image5.Canvas.TextWidth('8000'))/2),round((image5.Height-image5.Canvas.TextHeight('8000'))/2) ,'8000');
 edit2.Text:=inttostr(UpDown1.Position);
 if form23.RadioGroup2.ItemIndex=0 then
  begin
   mapno2:=mapno;
  end
 else if form23.RadioGroup2.ItemIndex=1 then
  begin
   mapno2:=3;
  end;
 if listbox1.ItemIndex=-1 then
  begin
   listbox1.ItemIndex:=intro[7,mapno2]-1;
   listbox2.ItemIndex:=intro[7,mapno2];
  end;
 if ListBox3.ItemIndex=-2 then
  listbox3.Items.Append('None');
 if listbox3.ItemIndex=-1 then
  listbox3.ItemIndex:=0;
 if RadioGroup3.ItemIndex=0 then
  begin
   Image2.Canvas.CopyRect(rect(0,0,Image2.Width,Image2.Height),form21.image3.Canvas,rect(0,0,form21.Image3.Width,Form21.Image3.Height));
  end;
end;

procedure TForm23.UpDown1Changing(Sender: TObject;
  var AllowChange: Boolean);
begin
 image5.Canvas.Font.Name:='Areal';
 image5.Canvas.Font.Style:=[fsbold];
 image5.Canvas.Rectangle(0,0,Image5.Width,Image5.Height);
 image5.Canvas.Font.Size:=UpDown1.Position;
 image5.Canvas.TextOut(round((image5.Width-image5.Canvas.TextWidth('8000'))/2),round((image5.Height-image5.Canvas.TextHeight('8000'))/2) ,'8000');
 edit2.Text:=inttostr(UpDown1.Position);
end;

procedure TForm23.Button2Click(Sender: TObject);
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
end;


procedure TForm23.Button3Click(Sender: TObject);
begin
 form23.Close;
end;

procedure TForm23.UpDown2Changing(Sender: TObject;
  var AllowChange: Boolean);
begin
 edit5.Text:=inttostr(UpDown2.Position);
end;

procedure TForm23.UpDown3Changing(Sender: TObject;
  var AllowChange: Boolean);
begin
 edit6.Text:=inttostr(UpDown3.Position);
end;

procedure TForm23.UpDown4Changing(Sender: TObject;
  var AllowChange: Boolean);
begin
 edit7.Text:=inttostr(UpDown4.Position);
end;

procedure TForm23.UpDown5Changing(Sender: TObject;
  var AllowChange: Boolean);
begin
 edit8.Text:=inttostr(UpDown5.Position);
end;

procedure TForm23.RadioGroup3Click(Sender: TObject);
begin
 if RadioGroup3.ItemIndex=0 then
  begin
   Image2.Canvas.CopyRect(rect(0,0,Image2.Width,Image2.Height),form21.image3.Canvas,rect(0,0,form21.Image3.Width,Form21.Image3.Height));
  end;
 if RadioGroup3.ItemIndex=1 then
  begin
   if OpenDialog1.Execute then
    begin
     Image3.Picture.LoadFromFile(OpenDialog1.FileName);
     image3.Width:=image3.Picture.Width;
     image3.Height:=image3.Picture.Height;
     Image2.Canvas.CopyRect(rect(0,0,Image2.Width,Image2.Height),image3.Canvas,rect(0,0,Image3.Width,Image3.Height));
    end;
  end;
end;

end.
