unit Unit31;

interface

uses
  Windows, Messages, SysUtils, Variants, Classes, Graphics, Controls, Forms,
  Dialogs, ExtCtrls, TeEngine, Series, TeeProcs, Chart, StdCtrls;

type
  TForm31 = class(TForm)
    Chart1: TChart;
    Label1: TLabel;
    Label2: TLabel;
    Series1: TLineSeries;
    Series2: TAreaSeries;
    procedure FormClose(Sender: TObject; var Action: TCloseAction);
    procedure FormCreate(Sender: TObject);
  private
    { Private declarations }
  public
    { Public declarations }
  end;

var
  Form31: TForm31;

implementation

uses Unit21, Unit22;

{$R *.dfm}

procedure TForm31.FormClose(Sender: TObject; var Action: TCloseAction);
VAR
MAPNO2:INTEGER;
begin
 if form22.ComboBox1.ItemIndex=0 then
  begin
   mapno2:=mapno;
  end
 else if form22.ComboBox1.ItemIndex=1 then
  begin
   mapno2:=3;
  end;
 series1.Clear;
 FORM21.draw(MAPNO2);
 form21.button2.Enabled:=false;
end;

procedure TForm31.FormCreate(Sender: TObject);
begin
  With Series1 do
   begin
    XValues.Order:=loNone;
    YValues.Order:=loNone;
   end;
end;

end.
