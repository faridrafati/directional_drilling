unit Unit10;

interface

uses
  Windows, Messages, SysUtils, Variants, Classes, Graphics, Controls, Forms,
  Dialogs, StdCtrls, ComCtrls, RpBase, RpSystem, RpDefine, RpRave, CheckLst,
  Buttons, DB, ADODB, TeEngine, Series, ExtCtrls, TeeProcs, Chart, Grids,  RPMemo,
  DBGrids, Menus, math,ComObj, DBCtrls,ClipBrd;
type
  TForm10 = class(TForm)
    ADOTable1: TADOTable;
    BitBtn1: TBitBtn;
    BitBtn2: TBitBtn;
    BitBtn3: TBitBtn;
    RvSystem1: TRvSystem;
    BitBtn4: TBitBtn;
    BitBtn5: TBitBtn;
    RvSystem2: TRvSystem;
    Chart1: TChart;
    Series1: TLineSeries;
    Chart2: TChart;
    Series2: TLineSeries;
    RvSystem3: TRvSystem;
    Button1: TButton;
    SaveDialog1: TSaveDialog;
    Image1: TImage;
    procedure BitBtn1Click(Sender: TObject);
    procedure RvSystem1BeforePrint(Sender: TObject);
    procedure RvSystem1Print(Sender: TObject);
    procedure RvSystem1PrintFooter(Sender: TObject);
    procedure RvSystem1PrintHeader(Sender: TObject);
    procedure FormCreate(Sender: TObject);
    procedure BitBtn5Click(Sender: TObject);
    procedure BitBtn2Click(Sender: TObject);
    procedure RvSystem2Print(Sender: TObject);
    procedure BitBtn3Click(Sender: TObject);
    procedure FormShow(Sender: TObject);
    procedure BitBtn4Click(Sender: TObject);
    procedure RvSystem3Print(Sender: TObject);
    procedure Button1Click(Sender: TObject);
    procedure BitBtn2MouseEnter(Sender: TObject);
    procedure BitBtn3MouseEnter(Sender: TObject);
    procedure BitBtn4MouseEnter(Sender: TObject);
    procedure BitBtn1MouseEnter(Sender: TObject);

  private
    { Private declarations }
  public
    { Public declarations }
  end;

var
  Form10: TForm10;

implementation

uses Unit01, Unit09, Unit03, Unit02;

{$R *.dfm}
function RefToCell(ARow, ACol: Integer): string;
begin
  Result := Chr(Ord('A') + ACol - 1) + IntToStr(ARow);
end;
function SaveAsExcelFile(adotable:tadotable; ASheetName, AFileName: string): Boolean;
const
  xlWBATWorksheet = -4167;
var
  Row, Col: Integer;
  GridPrevFile: string;
  XLApp, Sheet, Data: OLEVariant;
  i, j,rowcount,colcount: Integer;
begin
  // Prepare Data
  rowcount:=0;
  colcount:=13;
  adotable.First;
  while not(adotable.eof) do
   begin
    rowcount:=rowcount+1;
    adotable.next;
   end;
  rowcount:=rowcount+1;
  adotable.First;
  Data := VarArrayCreate([1,RowCount, 1,ColCount], varVariant);
  Data[1,1] :=   'COMMENT';
  Data[1,2] :=   'MD';
  Data[1,3] :=   'INCL';
  Data[1,4] :=   'AZM';
  Data[1,5] :=   'TVD';
  Data[1,6] :=   'VSEC';
  Data[1,7] :=   'NS';
  Data[1,8] :=   'EW';
  Data[1,9] :=   'DLS';
  Data[1,10] :=   'TF';
  Data[1,11] :=   'BR';
  Data[1,12] :=   'TR';
  Data[1,13] :=   'DMD';
  for j := 1 to RowCount - 1 do
   begin
    for i := 0 to ColCount - 1 do
     begin
      Data[j + 1, i + 1] := adotable.Fields.FieldByNumber(i+5).asstring;
  // Create Excel-OLE Object
     end;
    adotable.Next;
   end;
  Result := False;
  XLApp := CreateOleObject('Excel.Application');
  try
    // Hide Excel
    XLApp.Visible := False;
    // Add new Workbook
    XLApp.Workbooks.Add(xlWBatWorkSheet);
    Sheet := XLApp.Workbooks[1].WorkSheets[1];
    Sheet.Name := ASheetName;
    // Fill up the sheet
    Sheet.Range[RefToCell(1, 1), RefToCell(RowCount,
      ColCount)].Value := Data;
    // Save Excel Worksheet
    try
      XLApp.Workbooks[1].SaveAs(AFileName);
      Result := True;
    except
      // Error ?
    end;
  finally
    // Quit Excel
    if not VarIsEmpty(XLApp) then
     begin
      XLApp.DisplayAlerts := False;
      XLApp.Quit;
      XLAPP := Unassigned;
      Sheet := Unassigned;
     end;
  end;
end;


procedure TForm10.BitBtn1Click(Sender: TObject);
begin
 FORM03.SHOWMODAL;
end;

procedure TForm10.BitBtn1MouseEnter(Sender: TObject);
var
  Bitmap: TBitmap;
begin
 form03.graphshow;
 Bitmap := nil;
 try
   Bitmap := TBitmap.Create;
   bitmap.Width:=166;
   bitmap.Height:=93;
   form03.RenderToBitmap(1,bitmap);
   Image1.Picture.Graphic := Bitmap;
   image1.Width:=166;
   image1.Height:=93;
   image1.Top:=74;
   image1.Canvas.CopyRect(rect(0,0,image1.Width,image1.Height),bitmap.Canvas,rect(0,0,bitmap.Width,bitmap.Height));
 finally
   bitmap.Free;
  end;

end;

procedure TForm10.BitBtn2Click(Sender: TObject);
begin
 RVSystem2.DefaultDest := rdPreview;
 chart1.SaveToBitmapFile('temp.bmp');
 RvSystem2.Execute;

end;

procedure TForm10.BitBtn2MouseEnter(Sender: TObject);
var
  Picture: TPicture;
  Bitmap: TBitmap;
begin
 Chart1.Width:=780;
 Chart1.Height:=1120;
 Bitmap := nil;
 try
  Bitmap := TBitmap.Create;
  bitmap.Width:=166;
  bitmap.Height:=233;
  chart1.SaveToBitmapFile('temp.bmp');
  Image1.Picture.Graphic := Bitmap;
  Picture := TPicture.Create;
  try
    Picture.LoadFromFile('temp.bmp');
    Bitmap := TBitmap.Create;
    Bitmap.Width := Picture.Width;
    Bitmap.Height := Picture.Height;
    Bitmap.Canvas.Draw(0, 0, Picture.Graphic);
    image1.Width:=166;
    image1.Height:= 233;
    image1.Top:=8;
    image1.Canvas.CopyRect(rect(0,0,image1.Width,image1.Height),bitmap.Canvas,rect(0,0,bitmap.Width,bitmap.Height));

  finally
    Bitmap.Free;
   end;
 finally
   Picture.Free;
  end;
end;

procedure TForm10.BitBtn3Click(Sender: TObject);
begin
 chart2.SaveToBitmapFile('temp.bmp');
 RvSystem2.Execute;
end;

procedure TForm10.BitBtn3MouseEnter(Sender: TObject);
var
  Picture: TPicture;
  Bitmap: TBitmap;
begin
 Chart2.Width:=780;
 Chart2.Height:=1120;
 Bitmap := nil;
 try
  Bitmap := TBitmap.Create;
  bitmap.Width:=166;
  bitmap.Height:=233;
  chart2.SaveToBitmapFile('temp.bmp');
  Image1.Picture.Graphic := Bitmap;
  Picture := TPicture.Create;
  try
    Picture.LoadFromFile('temp.bmp');
    Bitmap := TBitmap.Create;
    Bitmap.Width := Picture.Width;
    Bitmap.Height := Picture.Height;
    Bitmap.Canvas.Draw(0, 0, Picture.Graphic);
    image1.Width:=166;
    image1.Height:= 233;
    image1.Top:=8;
    image1.Canvas.CopyRect(rect(0,0,image1.Width,image1.Height),bitmap.Canvas,rect(0,0,bitmap.Width,bitmap.Height));

  finally
    Bitmap.Free;
   end;
 finally
   Picture.Free;
  end;
end;

procedure TForm10.BitBtn4Click(Sender: TObject);
BEGIN
 RvSystem3.Execute;
END;


procedure TForm10.BitBtn4MouseEnter(Sender: TObject);
var
 Picture: TPicture;
 Bitmap: TBitmap;
 ii:real;
begin
 series1.Clear;
 series2.Clear;
 series1.XValues.Order:=loNone;
 series2.XValues.Order:=loNone;
 Chart1.Width:=780;
 Chart1.Height:=560;
 Chart2.Width:=780;
 Chart2.Height:=560;
 chart1.Axes.Reset;
 chart2.Axes.Reset;
 ADOTABLE1.First;
 while not(ADOTABLE1.Eof) do
  begin
   series1.AddXY(ADOTABLE1.FieldByName('VSEC').AsFloat,ADOTABLE1.FieldByName('TVD').AsFloat);
   series2.AddXY(ADOTABLE1.FieldByName('EW').AsFloat,ADOTABLE1.FieldByName('NS').AsFloat);
   ADOTABLE1.Next;
  end;


 Bitmap := nil;
 try
   Bitmap := TBitmap.Create;
   bitmap.Width:=166;
   bitmap.Height:=233;
   chart1.SaveToBitmapFile('temp.bmp');
   chart2.SaveToBitmapFile('temp2.bmp');
   Image1.Picture.Graphic := Bitmap;
   Picture := TPicture.Create;
   try
     Picture.LoadFromFile('temp.bmp');
     Bitmap := TBitmap.Create;
     Bitmap.Width := Picture.Width;
     Bitmap.Height := Picture.Height;
     Bitmap.Canvas.Draw(0, 0, Picture.Graphic);
     image1.Width:=166;
     image1.Height:= 233;
     image1.Top:=8;
     image1.Canvas.CopyRect(rect(0,0,image1.Width,round(0.5*image1.Height)),bitmap.Canvas,rect(0,0,bitmap.Width,bitmap.Height));
     Picture.LoadFromFile('temp2.bmp');
     Bitmap.Canvas.Draw(0, 0, Picture.Graphic);
     image1.Canvas.CopyRect(rect(0,round(0.5*image1.Height),image1.Width,image1.Height),bitmap.Canvas,rect(0,0,bitmap.Width,bitmap.Height));
    finally
      Bitmap.Free;
     end;
   finally
     Picture.Free;
    end;
end;
procedure TForm10.BitBtn5Click(Sender: TObject);
begin
 RvSystem1.Execute;
end;

procedure TForm10.Button1Click(Sender: TObject);
begin
 SaveDialog1.InitialDir :=ExtractFilePath(Application.ExeName);
 SaveDialog1.FileName:=form01.Treeview1.Selected.parent.Text;
 if SaveDialog1.Execute then
   SaveAsExcelFile(ADOTable1,form01.Treeview1.Selected.Text,SaveDialog1.FileName+'.xls');
end;

procedure TForm10.FormCreate(Sender: TObject);
begin
 RvSystem1.SystemPrinter.Orientation := poLandScape;
end;

procedure TForm10.FormShow(Sender: TObject);
var
 ii:real;
begin
 series1.Clear;
 series2.Clear;
 series1.XValues.Order:=loNone;
 series2.XValues.Order:=loNone;
 Chart1.Width:=780;
 Chart1.Height:=1120;
 Chart2.Width:=780;
 Chart2.Height:=1120;
 chart1.Axes.Reset;
 chart2.Axes.Reset;
 ADOTABLE1.First;
 while not(ADOTABLE1.Eof) do
  begin
   series1.AddXY(ADOTABLE1.FieldByName('VSEC').AsFloat,ADOTABLE1.FieldByName('TVD').AsFloat);
   series2.AddXY(ADOTABLE1.FieldByName('EW').AsFloat,ADOTABLE1.FieldByName('NS').AsFloat);
   ADOTABLE1.Next;
  end;
end;


procedure TForm10.RvSystem1BeforePrint(Sender: TObject);
begin
 with Sender as TBaseReport do
  begin
    RvSystem1.SystemPrinter.Orientation := poLandScape;
    SetPaperSize(DMPAPER_A4, 0, 0);
    ClearTabs;
    SetTab(0.75, pjLeft, 5, 0, BOXLINEHORIZ, 15);
    SetTab(NA , pjLeft, 5.5, 0, BOXLINEHORIZ, 15);
    SaveTabs(1);
    ClearTabs;
    SetTab(0.75, pjCenter, 1.5, 0, BOXLINENONE, 0);
    SetTab(NA , pjCenter, 0.75, 0, BOXLINENONE, 0);
    SetTab(NA , pjCenter, 0.75, 0, BOXLINENONE, 0);
    SetTab(NA , pjCenter, 0.75, 0, BOXLINENONE, 0);
    SetTab(NA , pjCenter, 0.75, 0, BOXLINENONE, 0);
    SetTab(NA , pjCenter, 0.75, 0, BOXLINENONE, 0);
    SetTab(NA , pjCenter, 0.75, 0, BOXLINENONE, 0);
    SetTab(NA , pjCenter, 0.75, 0, BOXLINENONE, 0);
    SetTab(NA , pjCenter, 0.75, 0, BOXLINENONE, 0);
    SetTab(NA , pjCenter, 0.75, 0, BOXLINENONE, 0);
    SetTab(NA , pjCenter, 0.75, 0, BOXLINENONE, 0);
    SetTab(NA , pjCenter, 0.75, 0, BOXLINENONE, 0);
    SetTab(NA , pjCenter, 0.75, 0, BOXLINENONE, 0);
    SaveTabs(2);
    ClearTabs;
    SetTab(0.75, pjCenter, 1.5, 0, BOXLINENONE, 15);
    SetTab(NA , pjCenter, 0.75, 0, BOXLINENONE, 15);
    SetTab(NA , pjCenter, 0.75, 0, BOXLINENONE, 15);
    SetTab(NA , pjCenter, 0.75, 0, BOXLINENONE, 15);
    SetTab(NA , pjCenter, 0.75, 0, BOXLINENONE, 15);
    SetTab(NA , pjCenter, 0.75, 0, BOXLINENONE, 15);
    SetTab(NA , pjCenter, 0.75, 0, BOXLINENONE, 15);
    SetTab(NA , pjCenter, 0.75, 0, BOXLINENONE, 15);
    SetTab(NA , pjCenter, 0.75, 0, BOXLINENONE, 15);
    SetTab(NA , pjCenter, 0.75, 0, BOXLINENONE, 15);
    SetTab(NA , pjCenter, 0.75, 0, BOXLINENONE, 15);
    SetTab(NA , pjCenter, 0.75, 0, BOXLINENONE, 15);
    SetTab(NA , pjCenter, 0.75, 0, BOXLINENONE, 15);
    SaveTabs(3);

    //Items
  end;
end;

procedure TForm10.RvSystem1Print(Sender: TObject);
var

  intOrderNo, intCustNo,ii : Integer;
  MemoBuf: TMemoBuf;
  Stream: TMemoryStream;
begin
  intOrderNo := 0;
  intCustNo := 0;
  with Sender as TBaseReport do
   begin
    ADOTABLE1.DisableControls;
    adotable1.first;
    II:=0;
    while not ADOTABLE1.Eof do
     begin
      if (ii=33)or(ii=0) then
       begin
        if II<>0 then
         newpage;
        RestoreTabs(1);
        SetFont('Arial', 14);
        PrintTab('Field Name: ' + FORM01.Treeview1.Selected.Parent.Parent.Text);
        PrintTab('Position: 100,100');
        ii:=0;
        SetFont('Arial',11);
        NewLine;
        Bold := True;
        RestoreTabs(2);
        printtab('COMMENT');
        printtab('MD');
        printtab('INCL');
        printtab('AZM');
        printtab('TVD');
        printtab('VSEC');
        printtab('NS');
        printtab('EW');
        printtab('DLS');
        printtab('TF');
        printtab('BR');
        printtab('TR');
        printtab('DMD');
        Bold := False;
        NewLine;
        ii:=0;
       end;
      if II MOD 2 =0 then
        RestoreTabs(3)
      ELSE
        RestoreTabs(2);
      PrintTab(ADOTABLE1.FieldByName('Comment').AsString);
      PrintTab(FormatFloat('0.0', ADOTABLE1.FieldByName('md').AsFloat));
      PrintTab(FormatFloat('0.00', ADOTABLE1.FieldByName('INCL').AsFloat));
      PrintTab(FormatFloat('0.00', ADOTABLE1.FieldByName('AZM').AsFloat));
      PrintTab(FormatFloat('0.0', ADOTABLE1.FieldByName('TVD').AsFloat));
      PrintTab(FormatFloat('0.0', ADOTABLE1.FieldByName('VSEC').AsFloat));
      PrintTab(FormatFloat('0.0', ADOTABLE1.FieldByName('NS').AsFloat));
      PrintTab(FormatFloat('0.0', ADOTABLE1.FieldByName('EW').AsFloat));
      PrintTab(FormatFloat('0.00', ADOTABLE1.FieldByName('DLS').AsFloat));
      PrintTab(FormatFloat('0.00', ADOTABLE1.FieldByName('TF').AsFloat));
      PrintTab(FormatFloat('0.00', ADOTABLE1.FieldByName('BR').AsFloat));
      PrintTab(FormatFloat('0.00', ADOTABLE1.FieldByName('TR').AsFloat));
      PrintTab(FormatFloat('0.0', ADOTABLE1.FieldByName('DMD').AsFloat));
      newline;
      ADOTABLE1.Next;
      ii:=ii+1;
    end;
   ADOTABLE1.EnableControls;
  end;
end;

procedure TForm10.RvSystem1PrintFooter(Sender: TObject);
 begin
  with Sender as TBaseReport do
   begin
    YPos := 8.1;
    SetFont('Arial',10);
    PrintLEFT('Print Date: ' + Macro(midCurrDateShort) + ' ' + Macro(midCurrTimeShort), 0.75);
   end;
 end;

procedure TForm10.RvSystem1PrintHeader(Sender: TObject);
 BEGIN
  with Sender as TBaseReport do
   begin
    SetFont('Arial',10);
    NewLine;
    PrintRight('Page ' + Macro(midCurrentPage) + ' of ' + Macro(midTotalPages)+'    ', PageWidth - MarginRight);
    NewLine;
    NewLine;
    NewLine;
    NewLine;
    SetFont('Arial',16);
    Bold := True;
    PrintCenter(FORM01.treeview1.Selected.Parent.Text, PageWidth / 2);
    Bold := False;
    NewLine;
   end;
 END;

procedure TForm10.RvSystem2Print(Sender: TObject);
var
 bitmap:tbitmap;
begin
 with Sender as TBaseReport do
  begin
    Bitmap := TBitmap.Create;
    try
      Bitmap.LoadFromFile('temp.bmp');
      PrintBitmap(0.1,0.05,1,1, Bitmap);
    finally
      Bitmap.Free;
    end;
  end;
end;

procedure TForm10.RvSystem3Print(Sender: TObject);
var
 Bitmap: TBitmap;
 ii:real;
begin
 series1.Clear;
 series2.Clear;
 series1.XValues.Order:=loNone;
 series2.XValues.Order:=loNone;
 Chart1.Width:=780;
 Chart1.Height:=560;
 Chart2.Width:=780;
 Chart2.Height:=560;
 chart1.Axes.Reset;
 chart2.Axes.Reset;
 ADOTABLE1.First;
 while not(ADOTABLE1.Eof) do
  begin
   series1.AddXY(ADOTABLE1.FieldByName('VSEC').AsFloat,ADOTABLE1.FieldByName('TVD').AsFloat);
   series2.AddXY(ADOTABLE1.FieldByName('EW').AsFloat,ADOTABLE1.FieldByName('NS').AsFloat);
   ADOTABLE1.Next;
  end;
 chart1.SaveToBitmapFile('temp.bmp');
 chart2.SaveToBitmapFile('temp2.bmp');
 Bitmap := TBitmap.Create;

 with Sender as TBaseReport do
  begin
   try
     Bitmap.LoadFromFile('temp.bmp');
     PrintBitmap(0.1,0.05,1,1,Bitmap);
     Bitmap.LoadFromFile('temp2.bmp');
     PrintBitmap(0.1,5.9,1,1,BITMAP);
   finally
     Bitmap.Free;
    end;
  end;
end;

END.

