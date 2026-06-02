unit Unit3;

interface

uses
  Windows, Messages, SysUtils, Classes, Graphics, Controls, Forms, Dialogs,
  StdCtrls;

type
  TForm3 = class(TForm)
    Check_filter1: TCheckBox;
    Check_filter2: TCheckBox;
    Check_filter3: TCheckBox;
    Edit_min1: TEdit;
    Edit_max1: TEdit;
    Edit_max2: TEdit;
    Edit_min2: TEdit;
    Edit_max3: TEdit;
    Edit_min3: TEdit;
    Label1: TLabel;
    Label2: TLabel;
    Label3: TLabel;
    Label4: TLabel;
    Label5: TLabel;
    Label6: TLabel;
  private
    { Private declarations }
  public
    { Public declarations }
  end;

var
  Form3: TForm3;

implementation

{$R *.DFM}

end.
