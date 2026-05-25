unit Unit24;

interface

uses
  Windows, Messages, SysUtils, Variants, Classes, Graphics, Controls, Forms,
  Dialogs, StdCtrls, ComCtrls, Grids;

type
  TForm24 = class(TForm)
    Label1: TLabel;
    Memo1: TMemo;
    procedure open;
    procedure FormShow(Sender: TObject);
    procedure UpDown1Click(Sender: TObject; Button: TUDBtnType);
  private
    { Private declarations }
  public
    { Public declarations }
  end;

var
  Form24: TForm24;

implementation

uses Unit21, Unit22;

{$R *.dfm}

procedure TForm24.FormShow(Sender: TObject);
begin
 open;
end;
procedure tForm24.open;
var
 f:textfile;
 line,strdata:string;
 numofline,lineperdata,hh,ii,jj,kk,ll,mm,mapno2:integer;
begin
  if form22.ComboBox1.ItemIndex=0 then
  begin
   mapno2:=mapno;
  end
 else if form22.ComboBox1.ItemIndex=1 then
  begin
   mapno2:=3;
  end;
 form24.Memo1.Lines.Clear;
 assignfile(f,filenam[mapno2]);
 Label1.Caption:=filenam[mapno2];
 reset(f);
 readln(f,line);
 form24.Memo1.Lines.Append(line);
 readln(f,line);
 form24.Memo1.Lines.Append(line);
 readln(f,line);
 form24.Memo1.Lines.Append(line);
 while (line[1]='!')or(line[1]='-') do
  begin
   form24.Memo1.Lines.Append(line);
   readln(f,line);
  end;
end;
procedure TForm24.UpDown1Click(Sender: TObject; Button: TUDBtnType);
begin
 open;
end;

end.
