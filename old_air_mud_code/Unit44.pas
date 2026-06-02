unit Unit44;

interface

uses
  Windows, Messages, SysUtils, Variants, Classes, Graphics, Controls, Forms,
  Dialogs, TeEngine, ExtCtrls, TeeProcs, Chart, Series, Menus, Grids, DB,
  TeeData, StdCtrls, ComCtrls, ComObj, DBClient, TeeSpline, VclTee.TeeGDIPlus;
type
  TForm44 = class(TForm)
    MainMenu1: TMainMenu;
    FILE1: TMenuItem;
    EXPORTTOEXCELFILE1: TMenuItem;
    xls1: TMenuItem;
    VIEW1: TMenuItem;
    ARBITPOINT1: TMenuItem;
    DETAILEDPARTS1: TMenuItem;
    OPTIONS1: TMenuItem;
    UNITS1: TMenuItem;
    PageControl1: TPageControl;
    TabSheet3: TTabSheet;
    Splitter1: TSplitter;
    StringGrid3: TStringGrid;
    StringGrid4: TStringGrid;
    ComboBox1: TComboBox;
    StringGrid5: TStringGrid;
    TabSheet1: TTabSheet;
    Panel1: TPanel;
    Chart1: TChart;
    Series1: TLineSeries;
    Series2: TLineSeries;
    Panel2: TPanel;
    StringGrid6: TStringGrid;
    GroupBox1: TGroupBox;
    CheckBox1: TCheckBox;
    CheckBox2: TCheckBox;
    TabSheet2: TTabSheet;
    Panel3: TPanel;
    Panel5: TPanel;
    GroupBox2: TGroupBox;
    CheckBox3: TCheckBox;
    CheckBox4: TCheckBox;
    CheckBox5: TCheckBox;
    CheckBox6: TCheckBox;
    StringGrid7: TStringGrid;
    Panel4: TPanel;
    Chart2: TChart;
    Series3: TLineSeries;
    Series4: TLineSeries;
    TabSheet4: TTabSheet;
    Memo1: TMemo;
    procedure charting1(ii:integer);
    procedure charting2(ii:integer);
    procedure StringGrid6SelectCell(Sender: TObject; ACol, ARow: Integer;
      var CanSelect: Boolean);
    procedure StringGrid7SelectCell(Sender: TObject; ACol, ARow: Integer;
      var CanSelect: Boolean);
    procedure CheckBox1Click(Sender: TObject);
    procedure CheckBox2Click(Sender: TObject);
    procedure CheckBox3Click(Sender: TObject);
    procedure CheckBox4Click(Sender: TObject);
    procedure Chart1MouseDown(Sender: TObject; Button: TMouseButton;
      Shift: TShiftState; X, Y: Integer);
    procedure Chart2MouseDown(Sender: TObject; Button: TMouseButton;
      Shift: TShiftState; X, Y: Integer);
    procedure CheckBox5Click(Sender: TObject);
    procedure CheckBox6Click(Sender: TObject);
    procedure CheckBox7Click(Sender: TObject);
    procedure PageControl1Resize(Sender: TObject);
    procedure RvSystem1BeforePrint(Sender: TObject);
    procedure RvSystem1Print(Sender: TObject);
    procedure RvSystem1PrintHeader(Sender: TObject);
    procedure RvSystem1PrintFooter(Sender: TObject);
    procedure FormCreate(Sender: TObject);
    procedure xls1Click(Sender: TObject);
    procedure StringGrid4DrawCell(Sender: TObject; ACol, ARow: Integer;
      Rect: TRect; State: TGridDrawState);
    procedure ComboBox1CloseUp(Sender: TObject);
    procedure StringGrid4KeyUp(Sender: TObject; var Key: Word;
      Shift: TShiftState);
    procedure ARBITPOINT1Click(Sender: TObject);
    procedure DETAILEDPARTS1Click(Sender: TObject);
    procedure UNITS1Click(Sender: TObject);
    procedure Button1Click(Sender: TObject);
  private
    { Private declarations }
  public
    { Public declarations }
  end;
Type
   TColumnMap= Array [0..7] Of String; // fieldnames

var
  Form44: TForm44;


  implementation

uses Unit42, Unit41;

{$R *.dfm}
procedure TForm44.ARBITPOINT1Click(Sender: TObject);
begin
 ARBITPOINT1.Checked := NOT (ARBITPOINT1.Checked);
 STRINGGRID4.Visible:=ARBITPOINT1.Checked;
end;

procedure TForm44.Button1Click(Sender: TObject);
begin
//  memo1.Lines.Add('line1' + #13#10 + 'line2' + #13#10 + 'with xx do' + #13#10 + 'begin' + #13#10 + '  ' + #13#10 + 'end;' + #13#10);

end;

procedure TForm44.Chart1MouseDown(Sender: TObject; Button: TMouseButton;
  Shift: TShiftState; X, Y: Integer);
VAR
 II:INTEGER;
begin
 if SERIES1.Clicked(X,Y)<>-1 then
  BEGIN
   II:=SERIES1.Clicked(X,Y)+1;
   CHARTING1(II);
   STRINGGRID6.Row:=II;
  END;
 if SERIES2.Clicked(X,Y)<>-1 then
  BEGIN
   II:=SERIES2.Clicked(X,Y)+1;
   CHARTING1(SERIES2.Clicked(X,Y)+1);
   STRINGGRID6.Row:=II;
  END;
end;
procedure TForm44.Chart2MouseDown(Sender: TObject; Button: TMouseButton;
  Shift: TShiftState; X, Y: Integer);
VAR
 II:INTEGER;
begin
 if SERIES3.Clicked(X,Y)<>-1 then
  BEGIN
   II:=SERIES3.Clicked(X,Y)+1;
   CHARTING2(II);
   STRINGGRID7.Row:=II;
  END;
 if SERIES4.Clicked(X,Y)<>-1 then
  BEGIN
   II:=SERIES4.Clicked(X,Y)+1;
   CHARTING2(II);
   STRINGGRID7.Row:=II;
  END;
end;

procedure tform44.charting1(ii:integer);
var
 jj:integer;
 ccolor:tcolor;
begin
  series1.clear;
  SERIES2.CLEAR;
  for jj := 1 to stringgrid6.RowCount do
   begin
    if(form41.radiogroup2.itemindex=0) then
     begin
      if (stringgrid6.Cells[0,jj]='')then
        exit;
      if ii=jj then
       BEGIN
        if CHECKBOX1.Checked THEN
          series1.AddXY(strtofloat(stringgrid6.Cells[2,jj]),strtofloat(stringgrid6.Cells[1,jj]),'',clRed);
        if CHECKBOX2.Checked THEN
          series2.AddXY(strtofloat(stringgrid6.Cells[3,jj]),strtofloat(stringgrid6.Cells[1,jj]),'',CLRED)
       end
      else
       BEGIN
        if CHECKBOX1.Checked THEN
          series1.AddXY(strtofloat(stringgrid6.Cells[2,jj]),strtofloat(stringgrid6.Cells[1,jj]),'',CLBLUE);
        if CHECKBOX2.Checked THEN
          series2.AddXY(strtofloat(stringgrid6.Cells[3,jj]),strtofloat(stringgrid6.Cells[1,jj]),'',CLBLUE)
       end
     END
    else if(form41.radiogroup2.itemindex=3)AND(stringgrid6.Cells[0,jj]<>'') then
     begin
      if ii=jj then
       BEGIN
        if CHECKBOX1.Checked THEN
          series1.AddXY(strtofloat(stringgrid6.Cells[2,jj]),strtofloat(stringgrid6.Cells[1,jj]),'',clRed);
        if CHECKBOX2.Checked THEN
          series2.AddXY(strtofloat(stringgrid6.Cells[3,jj]),strtofloat(stringgrid6.Cells[1,jj]),'',CLRED)
       end
      else
       BEGIN
        if copy(stringgrid6.Cells[0,jj],1,3)='ANL' then
          CCOLOR:=CLBLUE
        ELSE
          CCOLOR:=CLGREEN;
        if CHECKBOX1.Checked THEN
          series1.AddXY(strtofloat(stringgrid6.Cells[2,jj]),strtofloat(stringgrid6.Cells[1,jj]),'',ccolor);
        if CHECKBOX2.Checked THEN
          series2.AddXY(strtofloat(stringgrid6.Cells[3,jj]),strtofloat(stringgrid6.Cells[1,jj]),'',ccolor)
       end

     end;
   end;
end;
procedure tform44.charting2(ii:integer);
var
 jj:integer;
begin
  series3.clear;
  SERIES4.CLEAR;
  for jj := 1 to stringgrid7.RowCount do
   begin
    if stringgrid7.Cells[0,jj]='' then
      exit;
    if ii=jj then
     BEGIN
      if CHECKBOX3.Checked THEN
        series3.AddXY(strtofloat(stringgrid7.Cells[2,jj]),strtofloat(stringgrid7.Cells[1,jj]),'',clRed);
      if CHECKBOX4.Checked THEN
       BEGIN
        if ((CHECKBOX5.Checked)AND(CHECKBOX5.Enabled)AND(COPY(stringgrid7.Cells[0,jj],1,3)='STR')) THEN
          series4.AddXY(strtofloat(stringgrid7.Cells[3,jj]),strtofloat(stringgrid7.Cells[1,jj]),'',CLRED);
        if ((CHECKBOX6.Checked)AND(CHECKBOX6.Enabled)AND((COPY(stringgrid7.Cells[0,jj],1,3)='ANL')
        OR(COPY(stringgrid7.Cells[0,jj],1,3)='BLO')OR(COPY(stringgrid7.Cells[0,jj],1,3)='SUR'))) THEN
          series4.AddXY(strtofloat(stringgrid7.Cells[3,jj]),strtofloat(stringgrid7.Cells[1,jj]),'',CLRED);
       END
     END
    else
     BEGIN
      if CHECKBOX3.Checked THEN
        series3.AddXY(strtofloat(stringgrid7.Cells[2,jj]),strtofloat(stringgrid7.Cells[1,jj]),'',CLBLUE);
      if CHECKBOX4.Checked THEN
       BEGIN
        if ((CHECKBOX5.Checked)AND(CHECKBOX5.Enabled)AND(COPY(stringgrid7.Cells[0,jj],1,3)='STR')) THEN
          series4.AddXY(strtofloat(stringgrid7.Cells[3,jj]),strtofloat(stringgrid7.Cells[1,jj]),'',CLBLUE);
        if ((CHECKBOX6.Checked)AND(CHECKBOX6.Enabled)AND((COPY(stringgrid7.Cells[0,jj],1,3)='ANL')
        OR(COPY(stringgrid7.Cells[0,jj],1,3)='BLO')OR(COPY(stringgrid7.Cells[0,jj],1,3)='SUR'))) THEN
          series4.AddXY(strtofloat(stringgrid7.Cells[3,jj]),strtofloat(stringgrid7.Cells[1,jj]),'',CLBLUE);
       END
     END
   end;
end;

procedure TForm44.CheckBox1Click(Sender: TObject);
begin
 charting1(0);
end;

procedure TForm44.CheckBox2Click(Sender: TObject);
begin
 charting1(0);
end;
procedure TForm44.CheckBox3Click(Sender: TObject);
begin
 charting2(0);
end;

procedure TForm44.CheckBox4Click(Sender: TObject);
begin
 if CHECKBOX4.Checked then
  BEGIN
   CHECKBOX5.Enabled:=TRUE;
   CHECKBOX6.Enabled:=TRUE;
  END
 ELSE
  BEGIN
   CHECKBOX5.Enabled:=FALSE;
   CHECKBOX6.Enabled:=FALSE;
  END;
 charting2(0);
end;

procedure TForm44.CheckBox5Click(Sender: TObject);
begin
 charting2(0);
end;

procedure TForm44.CheckBox6Click(Sender: TObject);
begin
 charting2(0);
end;

procedure TForm44.CheckBox7Click(Sender: TObject);
begin
 charting2(0);
end;
procedure TForm44.ComboBox1CloseUp(Sender: TObject);
begin
 StringGrid4.CELLS[0,1]:=combobox1.Items.Strings[ComboBox1.ItemIndex];
 form41.CALCULATE(0,STRTOFLOAT(STRINGGRID4.Cells[1,1])*cnv[0].conv,STRINGGRID4.Cells[0,1]);
end;

procedure TForm44.DETAILEDPARTS1Click(Sender: TObject);
begin
  DETAILEDPARTS1.Checked := NOT (DETAILEDPARTS1.Checked);
  STRINGGRID5.Visible:=DETAILEDPARTS1.Checked;
end;

procedure TForm44.FormCreate(Sender: TObject);
begin
 if StringGrid4.cells[1,1]='' then
   stringgrid4.Cells[1,1]:='0';
  stringgrid4.Cells[0,1]:='STRG';
end;

procedure TForm44.PageControl1Resize(Sender: TObject);
begin
 stringgrid3.DefaultColWidth:=(stringgrid3.Width-STRINGGRID3.ColCount-20) div STRINGGRID3.ColCount;
 stringgrid4.DefaultColWidth:=stringgrid3.DefaultColWidth;
 stringgrid5.DefaultColWidth:=stringgrid3.DefaultColWidth;
 COMBOBOX1.Width:=stringgrid3.DefaultColWidth;
end;

procedure TForm44.RvSystem1BeforePrint(Sender: TObject);
begin
{ with Sender as TBaseReport do
  begin
    RvSystem1.SystemPrinter.Orientation := poLandScape;
    SetPaperSize(DMPAPER_A4, 0, 0);
    ClearTabs;
    SetTab(0.75, pjLeft, 5, 0, BOXLINEHORIZ, 15);
    SetTab(NA , pjLeft, 5.5, 0, BOXLINEHORIZ, 15);
    SaveTabs(1);
    ClearTabs;
    SetTab(0.5, pjCenter, 1.3, 0, BOXLINENONE, 0);
    SetTab(NA , pjCenter, 1.3, 0, BOXLINENONE, 0);
    SetTab(NA , pjCenter, 1.3, 0, BOXLINENONE, 0);
    SetTab(NA , pjCenter, 1.3, 0, BOXLINENONE, 0);
    SetTab(NA , pjCenter, 1.3, 0, BOXLINENONE, 0);
    SetTab(NA , pjCenter, 1.3, 0, BOXLINENONE, 0);
    SetTab(NA , pjCenter, 1.3, 0, BOXLINENONE, 0);
    SetTab(NA , pjCenter, 1.3, 0, BOXLINENONE, 0);
//    SetTab(NA , pjCenter, 0.75, 0, BOXLINENONE, 0);
//    SetTab(NA , pjCenter, 0.75, 0, BOXLINENONE, 0);
//    SetTab(NA , pjCenter, 0.75, 0, BOXLINENONE, 0);
//   SetTab(NA , pjCenter, 0.75, 0, BOXLINENONE, 0);
//    SetTab(NA , pjCenter, 0.75, 0, BOXLINENONE, 0);
    SaveTabs(2);
    ClearTabs;
    SetTab(0.5, pjCenter, 1.3, 0, BOXLINENONE, 12);
    SetTab(NA , pjCenter, 1.3, 0, BOXLINENONE, 12);
    SetTab(NA , pjCenter, 1.3, 0, BOXLINENONE, 12);
    SetTab(NA , pjCenter, 1.3, 0, BOXLINENONE, 12);
    SetTab(NA , pjCenter, 1.3, 0, BOXLINENONE, 12);
    SetTab(NA , pjCenter, 1.3, 0, BOXLINENONE, 12);
    SetTab(NA , pjCenter, 1.3, 0, BOXLINENONE, 12);
    SetTab(NA , pjCenter, 1.3, 0, BOXLINENONE, 12);
//    SetTab(NA , pjCenter, 0.75, 0, BOXLINENONE, 15);
//    SetTab(NA , pjCenter, 0.75, 0, BOXLINENONE, 15);
//    SetTab(NA , pjCenter, 0.75, 0, BOXLINENONE, 15);
//    SetTab(NA , pjCenter, 0.75, 0, BOXLINENONE, 15);
//    SetTab(NA , pjCenter, 0.75, 0, BOXLINENONE, 15);
    SaveTabs(3);

    //Items
  end;       }
end;

procedure TForm44.RvSystem1Print(Sender: TObject);
var

  intOrderNo, intCustNo,ii,jj : Integer;
  Stream: TMemoryStream;
begin
{  intOrderNo := 0;
  intCustNo := 0;
  with Sender as TBaseReport do
   begin
    II:=0;
    jj:=1;
    while (jj<=stringgrid3.RowCount)and(stringgrid3.Cells[0,jj]<>'') do
     begin
      if (ii=33)or(ii=0) then
       begin
        if II<>0 then
         newpage;
        RestoreTabs(1);
        SetFont('Arial', 11);
        PrintTab('Field Name: ' + form41.COMBOBOX4.Text);
        PrintTab('Position: 100,100');
        ii:=0;
        SetFont('Arial',11);
        NewLine;
        Bold := True;
        RestoreTabs(2);
        printtab(stringgrid3.cells[0,0]);
        printtab(stringgrid3.cells[1,0]);
        printtab(stringgrid3.cells[2,0]);
        printtab(stringgrid3.cells[3,0]);
        printtab(stringgrid3.cells[4,0]);
        printtab(stringgrid3.cells[5,0]);
        printtab(stringgrid3.cells[6,0]);
        printtab(stringgrid3.cells[7,0]);
        Bold := False;
        NewLine;
        ii:=0;
       end;
      if II MOD 2 =0 then
        RestoreTabs(3)
      ELSE
        RestoreTabs(2);

      PrintTab(stringgrid3.cells[0,jj]);
      PrintTab(FormatFloat('0.00', strtofloat(stringgrid3.cells[1,jj])));
      PrintTab(FormatFloat('0.00', strtofloat(stringgrid3.cells[2,jj])));
      PrintTab(FormatFloat('0.00', strtofloat(stringgrid3.cells[3,jj])));
      PrintTab(FormatFloat('0.00', strtofloat(stringgrid3.cells[4,jj])));
      PrintTab(FormatFloat('0.00', strtofloat(stringgrid3.cells[5,jj])));
      PrintTab(FormatFloat('0.00', strtofloat(stringgrid3.cells[6,jj])));
      PrintTab(FormatFloat('0.00', strtofloat(stringgrid3.cells[7,jj])));
   //   PrintTab(FormatFloat('0.00', ADOTABLE1.FieldByName('DLS').AsFloat));
  //    PrintTab(FormatFloat('0.00', ADOTABLE1.FieldByName('TF').AsFloat));
 //     PrintTab(FormatFloat('0.00', ADOTABLE1.FieldByName('BR').AsFloat));
//      PrintTab(FormatFloat('0.00', ADOTABLE1.FieldByName('TR').AsFloat));
//      PrintTab(FormatFloat('0.0', ADOTABLE1.FieldByName('DMD').AsFloat));
      newline;
    //  ADOTABLE1.Next;
      ii:=ii+1;
      jj:=jj+1;
    end;
  end;  }
end;

procedure TForm44.RvSystem1PrintFooter(Sender: TObject);
begin
{  with Sender as TBaseReport do
   begin
    YPos := 8.1;
    SetFont('Arial',10);
    PrintLEFT('Print Date: ' + Macro(midCurrDateShort) + ' ' + Macro(midCurrTimeShort), 0.75);
   end;        }

end;

procedure TForm44.RvSystem1PrintHeader(Sender: TObject);
begin
{  with Sender as TBaseReport do
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
    PrintCenter(form41.COMBOBOX4.Text, PageWidth / 2);
    Bold := False;
    NewLine;
   end;       }

end;

procedure TForm44.StringGrid6SelectCell(Sender: TObject; ACol, ARow: Integer;
  var CanSelect: Boolean);
begin
 charting1(arow);
end;
procedure TForm44.StringGrid7SelectCell(Sender: TObject; ACol, ARow: Integer;
  var CanSelect: Boolean);
begin
 charting2(arow);
end;
procedure TForm44.StringGrid4DrawCell(Sender: TObject; ACol, ARow: Integer;
  Rect: TRect; State: TGridDrawState);
BEGIN
 if (gdFocused in State) then
  begin
   if ((ACol=0) and (ARow=1)) then
    BEGIN
     ComboBox1.Top:=RECT.Top+STRINGGRID4.Top+2;
     COMBOBOX1.Left:=RECT.Left+STRINGGRID4.LEFT+2;
     COMBOBOX1.Width:=STRINGGRID4.DefaultColWidth;
     COMBOBOX1.Visible:=TRUE;
    END
   ELSE
     COMBOBOX1.Visible:=FALSE;
   if ((ACol=1) and (ARow=1)) then
     StringGrid4.Options:=StringGrid4.Options+[GOEDITING]
   ELSE
     StringGrid4.Options:=StringGrid4.Options-[GOEDITING];
  end;
 if ((ACol=1) and (ARow=1)) then
  begin
   StringGrid4.Canvas.Brush.Color:=CLYELLOW; //red brush
   StringGrid4.Canvas.FillRect(Rect);  //paint the backgorund red
   //draw the original text
   StringGrid4.Canvas.TextRect(Rect, Rect.Left, Rect.Top, StringGrid4.Cells[ACol, ARow]);
   //draw focused rectangle if the current cell is selected by user
   if gdFocused in State then
     StringGrid4.Canvas.DrawFocusRect(Rect);
  end;
end;
procedure TForm44.StringGrid4KeyUp(Sender: TObject; var Key: Word;
  Shift: TShiftState);
begin
 if StringGrid4.cells[1,1]='' then
   stringgrid4.Cells[1,1]:='0';
 form41.CALCULATE(0,STRTOFLOAT(STRINGGRID4.Cells[1,1])*cnv[0].conv,STRINGGRID4.Cells[0,1]);

end;

procedure TForm44.UNITS1Click(Sender: TObject);
begin
 form42.ShowModal;
 FORM41.SENDTOCASINGFORM;
 FORM41.SENDTOBITFORM;
 FORM41.SENDTOBHAFORM;
 FORM41.SENDTOWELLFORM;
 FORM41.CALCULATE(FORM41.radiogroup2.ItemIndex,0,'');

end;

procedure TForm44.xls1Click(Sender: TObject);
begin
FORM44.Close;
end;

end.
