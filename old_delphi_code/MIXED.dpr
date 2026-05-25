program MIXED;

uses
  Forms,
  Unit01 in 'Unit01.pas' {Form01},
  Unit02 in 'Unit02.pas' {Form02},
  Unit03 in 'Unit03.pas' {Form03},
  Unit04 in 'Unit04.pas' {Form04},
  Unit05 in 'Unit05.pas' {Form05},
  Unit06 in 'Unit06.pas' {Form06},
  Unit07 in 'Unit07.pas' {Form07},
  Unit08 in 'Unit08.pas' {Form08},
  Unit09 in 'Unit09.pas' {Form09},
  Unit10 in 'Unit10.pas' {Form10},
  Unit21 in 'Unit21.pas' {Form21},
  Unit22 in 'Unit22.pas' {Form22},
  Unit23 in 'Unit23.pas' {Form23},
  Unit24 in 'Unit24.pas' {Form24},
  Unit25 in 'Unit25.pas' {Form25},
  Unit26 in 'Unit26.pas' {Form26},
  Unit28 in 'Unit28.pas' {Form28},
  Unit29 in 'Unit29.pas' {Form29},
  Unit30 in 'Unit30.pas' {Form30},
  Unit31 in 'Unit31.pas' {Form31},
  Unit32 in 'Unit32.pas' {Form32},
  Unit33 in 'Unit33.pas' {Form33},
  Unit34 in 'Unit34.pas' {Form34},
  Unit35 in 'Unit35.pas' {Form35},
  Unit42 in 'Unit42.pas' {Form42},
  Unit41 in 'Unit41.pas' {Form41};

{$R *.res}

begin
  Application.Initialize;
  Application.MainFormOnTaskbar := True;
  Application.CreateForm(TForm01, Form01);
  Application.CreateForm(TForm02, Form02);
  Application.CreateForm(TForm03, Form03);
  Application.CreateForm(TForm04, Form04);
  Application.CreateForm(TForm05, Form05);
  Application.CreateForm(TForm06, Form06);
  Application.CreateForm(TForm07, Form07);
  Application.CreateForm(TForm08, Form08);
  Application.CreateForm(TForm09, Form09);
  Application.CreateForm(TForm10, Form10);
  Application.CreateForm(TForm21, Form21);
  Application.CreateForm(TForm22, Form22);
  Application.CreateForm(TForm23, Form23);
  Application.CreateForm(TForm24, Form24);
  Application.CreateForm(TForm25, Form25);
  Application.CreateForm(TForm26, Form26);
  Application.CreateForm(TForm28, Form28);
  Application.CreateForm(TForm29, Form29);
  Application.CreateForm(TForm30, Form30);
  Application.CreateForm(TForm31, Form31);
  Application.CreateForm(TForm32, Form32);
  Application.CreateForm(TForm33, Form33);
  Application.CreateForm(TForm34, Form34);
  Application.CreateForm(TForm35, Form35);
  Application.CreateForm(TForm42, Form42);
  Application.CreateForm(TForm41, Form41);
  Application.Run;
end.
