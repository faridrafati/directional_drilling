unit Unit32;

interface

uses
  Windows, Messages, SysUtils, Variants, Classes, Graphics, Controls, Forms,
  Dialogs, ExtCtrls, Menus, StdCtrls;

type
  TForm32 = class(TForm)
    Image1: TImage;
    MainMenu1: TMainMenu;
    SaveasBitmap1: TMenuItem;
    SaveDialog1: TSaveDialog;
    RadioGroup1: TRadioGroup;
    Image2: TImage;
    CheckBox1: TCheckBox;
    Image3: TImage;
    procedure SaveasBitmap1Click(Sender: TObject);
    procedure RadioGroup1Click(Sender: TObject);
    procedure draw;
    procedure CheckBox1Click(Sender: TObject);
  private
    { Private declarations }
  public
    { Public declarations }
  end;

var
  Form32: TForm32;

implementation

uses Unit28;

{$R *.dfm}

procedure TForm32.SaveasBitmap1Click(Sender: TObject);
var
 bitmap:tbitmap;
 a,b:integer;
begin
 Bitmap := nil;
 if RadioGroup1.ItemIndex=0 then
  begin
   a:=form28.Image8.Width;
   b:=form28.Image8.Height;
  end
 else
  begin
   if (form28.image8.Width/form28.image8.Height<=(image1.Width/image1.Height)) then
    begin
     a:=form28.Image8.width;
     b:=round((a*image1.Width/image1.Height));
    end
   else
    begin
     b:=form28.Image8.height;
     a:=round((b*image1.Width/image1.Height));
    end;
  end;
 try
  Bitmap := TBitmap.Create;
  bitmap.Width:=a;
  bitmap.Height:=b;
  Image3.Picture.Graphic:= bitmap;
 finally
  Bitmap.Free;
 end;
 image3.Width:=a;
 image3.Height:=b;
 Image3.Canvas.CopyRect(rect(0,0,Image3.Width,Image3.Height),form28.image8.Canvas,rect(0,0,form28.image8.Width,form28.image8.Height));
 if SaveDialog1.Execute then
  begin
   Image3.Picture.SaveToFile(SaveDialog1.FileName);
  end;
end;

procedure TForm32.RadioGroup1Click(Sender: TObject);
begin
 draw;
end;
procedure TForm32.draw;
var
 bitmap:tbitmap;
begin
 Bitmap := nil;
 try
  Bitmap := TBitmap.Create;
  bitmap.Width:=614;
  bitmap.Height:=614;
  Image2.Picture.Graphic:= bitmap;
  image1.Picture.Graphic:= bitmap;
 finally
  Bitmap.Free;
 end;
 if CheckBox1.Checked then
  begin
   image1.Width:=614;
   image1.Height:=434;
  end
 else
  begin
   image1.Width:=434;
   image1.Height:=614;
  end;
 Image1.Canvas.Brush.Color:=clAqua;
 Image1.Canvas.Rectangle(0,0,Image1.Width,Image1.Height);
 if RadioGroup1.ItemIndex=1 then
  begin
   Image2.Width:=Image1.width;
   Image2.Height:=Image1.Height;
   Image2.Canvas.CopyRect(rect(0,0,Image2.Width,Image2.Height),form28.image8.Canvas,rect(0,0,form28.image8.Width,form28.image8.Height))
  end
 else
  begin
   if (form28.image8.Width/form28.image8.Height<=(image1.Width/image1.Height)) then
    begin
     Image2.Height:=Image1.Height;
     Image2.Width:=round(form28.Image8.Width*(Image2.Height/form28.image8.Height));
     Image2.Canvas.CopyRect(rect(0,0,Image2.Width,Image2.Height),form28.image8.Canvas,rect(0,0,form28.image8.Width,form28.image8.Height))
    end
   else
    begin
     Image2.Width:=Image1.width;
     Image2.Height:=round(form28.Image8.Height*(Image2.Width/form28.image8.Width));
     Image2.Canvas.CopyRect(rect(0,0,Image2.Width,Image2.Height),form28.image8.Canvas,rect(0,0,form28.image8.Width,form28.image8.Height));
    end;
  end;
 end;
procedure TForm32.CheckBox1Click(Sender: TObject);
begin
 draw;
end;

end.
