unit Unit26;

interface

uses
  Windows, Messages, SysUtils, Variants, Classes, Graphics, Controls, Forms,
  Dialogs, StdCtrls, Grids;

type
  TForm26 = class(TForm)
    Edit1: TEdit;
    Edit2: TEdit;
    Edit3: TEdit;
    Edit6: TEdit;
    Button1: TButton;
    GroupBox1: TGroupBox;
    Edit10: TEdit;
    Edit11: TEdit;
    Edit12: TEdit;
    Label3: TLabel;
    Label1: TLabel;
    Label2: TLabel;
    Edit4: TEdit;
    Edit5: TEdit;
    Edit13: TEdit;
    CheckBox1: TCheckBox;
    Edit14: TEdit;
    StringGrid1: TStringGrid;
    Edit8: TEdit;
    Edit7: TEdit;
    CheckBox2: TCheckBox;
    Edit9: TEdit;
    procedure Button1Click(Sender: TObject);
    procedure CheckBox1Click(Sender: TObject);
    procedure FormShow(Sender: TObject);
    procedure FormCreate(Sender: TObject);
  private
    { Private declarations }
  public
    { Public declarations }
  end;

var
  Form26: TForm26;

implementation

uses Unit25, Unit22, Unit21, Unit35;

{$R *.dfm}

procedure TForm26.Button1Click(Sender: TObject);
var
 ii:integer;
 extra:real;
begin
 form35.Button1.Click;
 form26.Close;
end;

procedure TForm26.CheckBox1Click(Sender: TObject);
begin
 if CheckBox1.Checked then
  form25.sizing(1)
end;

procedure TForm26.FormShow(Sender: TObject);
begin
 if CheckBox1.Checked then
  form25.sizing(1);
 
end;
procedure TForm26.FormCreate(Sender: TObject);
begin
 stringgrid1.cells[0,0]:='Top Layer';
 stringgrid1.cells[0,1]:='Bot Layer';
end;



end.
