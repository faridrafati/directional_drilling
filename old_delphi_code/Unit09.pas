unit Unit09;

interface

uses
  Windows, Messages, SysUtils, Variants, Classes, Graphics, Controls, Forms,
  Dialogs, DB, ADODB, StdCtrls, Grids, DBGrids, ExtCtrls;

type
  TForm09 = class(TForm)
    edit1: TEdit;
    Button1: TButton;
    Button2: TButton;
    Label1: TLabel;
    RadioGroup1: TRadioGroup;
    procedure Button1Click(Sender: TObject);
    procedure Button2Click(Sender: TObject);
    procedure FormCreate(Sender: TObject);
  private
    { Private declarations }
  public
    { Public declarations }
  end;

var
  Form09: TForm09;
  nd:boolean;

implementation

{$R *.dfm}

procedure TForm09.Button1Click(Sender: TObject);
begin
 if RadioGroup1.ItemIndex<>-1 then
  BEGIN
   nd:=true;
   form09.Close;
  END
 ELSE
  ShowMessage('Please Select Your Calculation Type!');
end;

procedure TForm09.Button2Click(Sender: TObject);
begin
 nd:=false;
 RadioGroup1.ItemIndex:=-1;
 form09.Close;
end;

procedure TForm09.FormCreate(Sender: TObject);
begin
 nd:=false;
end;

end.
