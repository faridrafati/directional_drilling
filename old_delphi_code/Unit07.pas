unit Unit07;

interface

uses
  Windows, Messages, SysUtils, Variants, Classes, Graphics, Controls, Forms,
  Dialogs, StdCtrls, ExtCtrls;

type
  TForm07 = class(TForm)
    GroupBox1: TGroupBox;
    Memo1: TMemo;
    Button1: TButton;
    RadioButton1: TRadioButton;
    RadioButton2: TRadioButton;
    label2: TLabel;
    Edit1: TEdit;
    Label1: TLabel;
    ListBox1: TListBox;
    procedure Button2Click(Sender: TObject);
    procedure Button1Click(Sender: TObject);
    procedure ListBox1Click(Sender: TObject);
    procedure radio;
  private
    { Private declarations }
  public
    { Public declarations }
  end;

var
  Form07: TForm07;

implementation

uses Unit02;

{$R *.dfm}
procedure tform07.radio;
begin
 RadioButton1.Enabled:=azmazm[listbox1.ItemIndex+1,1];
 RadioButton2.Enabled:=azmazm[listbox1.ItemIndex+1,2];
 if RadioButton1.Enabled then
   RadioButton1.checked:=true;
 if RadioButton2.Enabled then
   RadioButton2.checked:=true;
end;

procedure TForm07.Button1Click(Sender: TObject);
begin
 form07.Close;
 listbox1.Visible:=false;
end;

procedure TForm07.Button2Click(Sender: TObject);
begin
form07.Close;
end;

procedure TForm07.ListBox1Click(Sender: TObject);
begin
 radio;
end;

end.
