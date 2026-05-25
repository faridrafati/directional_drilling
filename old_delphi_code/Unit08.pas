unit Unit08;

interface

uses
  Windows, Messages, SysUtils, Variants, Classes, Graphics, Controls, Forms,
  Dialogs, StdCtrls;

type
  TForm08 = class(TForm)
    GroupBox1: TGroupBox;
    Button1: TButton;
    RadioButton1: TRadioButton;
    RadioButton2: TRadioButton;
    RadioButton3: TRadioButton;
    procedure Button1Click(Sender: TObject);
  private
    { Private declarations }
  public
    { Public declarations }
  end;

var
  Form08: TForm08;

implementation

{$R *.dfm}

procedure TForm08.Button1Click(Sender: TObject);
begin
 form08.Close;
end;

end.
