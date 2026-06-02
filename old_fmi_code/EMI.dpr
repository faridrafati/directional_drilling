program EMI;

uses
  Forms,
  main in 'main.pas' {Form1},
  Unit1 in 'Unit1.pas' {Frame1: TFrame},
  Unit5 in 'Unit5.pas' {Form5},
  Unit7 in 'Unit7.pas' {Form7},
  Unit8 in 'Unit8.pas' {Form8},
  Unit9 in 'Unit9.pas' {Form9},
  Unit10 in 'Unit10.pas' {Form10},
  Unit11 in 'Unit11.pas' {Form11};

{$R *.RES}


begin
  Application.Initialize;
  Application.Title := 'GEOMANCY Borehole Image Viewer';
  Application.CreateForm(TForm1, Form1);
  Application.CreateForm(TForm5, Form5);
  Application.CreateForm(TForm7, Form7);
  Application.CreateForm(TForm8, Form8);
  Application.CreateForm(TForm9, Form9);
  Application.CreateForm(TForm10, Form10);
  Application.CreateForm(TForm11, Form11);
  Application.Run;
end.
