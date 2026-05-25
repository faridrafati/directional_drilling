unit Unit41;

interface

uses
  Windows, Messages, SysUtils, Variants, Classes, Graphics, Controls, Forms,
  Dialogs, Menus, DB, Grids, DBGrids, ADODB, ComCtrls, ExtCtrls;

type
  TForm41 = class(TForm)
    MainMenu1: TMainMenu;
    File1: TMenuItem;
    New1: TMenuItem;
    Save1: TMenuItem;
    Saveas1: TMenuItem;
    Open1: TMenuItem;
    Exit1: TMenuItem;
    Options1: TMenuItem;
    Units1: TMenuItem;
    DataSource1: TDataSource;
    ADOConnection1: TADOConnection;
    ADOTable1: TADOTable;
    PageControl1: TPageControl;
    TabSheet1: TTabSheet;
    TabSheet2: TTabSheet;
    TabSheet3: TTabSheet;
    TabSheet4: TTabSheet;
    DBGrid1: TDBGrid;
    Panel2: TPanel;
    Panel3: TPanel;
    DBGrid2: TDBGrid;
    ADOTable2: TADOTable;
    DataSource2: TDataSource;
    Panel4: TPanel;
    Panel1: TPanel;
    DBGrid3: TDBGrid;
    Panel5: TPanel;
    Panel6: TPanel;
    DBGrid4: TDBGrid;
    Panel7: TPanel;
    procedure Exit1Click(Sender: TObject);
    procedure Units1Click(Sender: TObject);
    procedure FormCreate(Sender: TObject);
  private
    { Private declarations }
  public
    { Public declarations }
  end;

var
  Form41: TForm41;

implementation

uses Unit42;

{$R *.dfm}

procedure TForm41.Exit1Click(Sender: TObject);
begin
 form41.Close;
end;

procedure TForm41.FormCreate(Sender: TObject);
var
 FILENAM:STRING;
begin
 FILENAM:=ExtractFilePath (Application.ExeName);
 AdoConnection1.LoginPrompt := False;
 ADOConnection1.ConnectionString:='Provider=Microsoft.Jet.OLEDB.4.0;Data Source='+filenam+'BLANK.mdb'+';Persist Security Info=False';

end;

procedure TForm41.Units1Click(Sender: TObject);
begin
 form42.ShowModal;
end;

end.
