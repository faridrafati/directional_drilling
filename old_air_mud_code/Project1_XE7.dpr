program Project1_XE7;

uses
  Forms,
  Unit41 in 'Unit41.pas' {Form41},
  Unit42 in 'Unit42.pas' {Form42},
  ABOUT in 'ABOUT.pas' {AboutBox},
  Unit43 in 'Unit43.pas' {Form43},
  Unit44 in 'Unit44.pas' {Form44};

{$R *.res}

begin
  Application.Initialize;
  Application.MainFormOnTaskbar := True;
  Application.CreateForm(TForm41, Form41);
  Application.CreateForm(TForm44, Form44);
  Application.CreateForm(TForm42, Form42);
  Application.CreateForm(TAboutBox, AboutBox);
  Application.CreateForm(TForm43, Form43);
  Application.Run;
end.
