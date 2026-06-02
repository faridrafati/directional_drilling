unit Unit43;

interface

uses
  Windows, Messages, SysUtils, Variants, Classes, Graphics, Controls, Forms,
  Dialogs, StdCtrls, ExtCtrls, DB, ADODB, Grids;

type
  TForm43 = class(TForm)
    FXDNZL: TADOTable;
    RadioGroup1: TRadioGroup;
    Panel1: TPanel;
    Panel2: TPanel;
    Edit1: TEdit;
    Label1: TLabel;
    Label2: TLabel;
    StringGrid1: TStringGrid;
    Button1: TButton;
    procedure RadioGroup1Click(Sender: TObject);
    procedure Button1Click(Sender: TObject);
    procedure FormCreate(Sender: TObject);
    procedure newstringgrid;
  private
    { Private declarations }
  public
    { Public declarations }
  end;

var
  Form43: TForm43;

implementation

uses Unit41, Unit42;

{$R *.dfm}


procedure TForm43.Button1Click(Sender: TObject);
var
ii,jj:integer;
begin
 form43.FXDNZL.Active:=false;
 form43.FXDNZL.TableName:='FixedNozzles';
 form43.FXDNZL.Active:=true;
 form43.FXDNZL.open;
 form43.FXDNZL.First;
 while not((form43.FXDNZL.FieldByName('wellname').asstring=form41.dbedit1.Text)and
 (form43.FXDNZL.FieldByName('bitnumber').asstring=form41.combobox2.Text))do
   form43.FXDNZL.Next;
 for ii := 0 to 2 do
  begin
   for jj := 0 to 4 do
    begin
     form43.FXDNZL.Open;
     form43.FXDNZL.Edit;
     if form43.StringGrid1.Cells[ii,jj]='' then
       form43.StringGrid1.Cells[ii,jj]:='0';
     form43.FXDNZL.Fields.FieldByNumber(7+ii+3*jj).AsFloat:=strtofloat(form43.StringGrid1.Cells[ii,jj])*cnv[2].conv;
    end;
  end;
 if edit1.Text='' then
   edit1.Text:='0';
 form43.FXDNZL.Fields.FieldByName('fixedtfa').AsFloat:=strtofloat(edit1.Text)*cnv[1].conv*cnv[1].conv;
 form43.FXDNZL.Post;
 form41.TBITRUN.Open;
 form41.TBITRUN.Edit;
 form41.TBITRUN.Fields.FieldByName('tfa').AsFloat:=form43.FXDNZL.Fields.FieldByName('fixedtfa').AsFloat;
 if RadioGroup1.ItemIndex=1 then
  begin
   FXDNZL.Open;
   FXDNZL.Edit;
   FXDNZL.FieldByName('usefixedTFA').AsBoolean:=TRUE;
   FXDNZL.Close;
  end
 Else
  begin
   FXDNZL.Open;
   FXDNZL.Edit;
   FXDNZL.FieldByName('usefixedTFA').AsBoolean:=false;
   FXDNZL.Close;
  end;
 form41.sendtodbbitrun;
 form43.Close;
end;
procedure tform43.newstringgrid;
var
 ii,jj:integer;
begin
 //fixed nozzle size initial value
 for ii := 0 to 2 do
   for jj := 0 to 4 do
     form43.StringGrid1.Cells[ii,jj]:='0';
end;

procedure TForm43.FormCreate(Sender: TObject);
begin
 newstringgrid;
 form41.edit1.text:='0';
 formlbl[6]:=FORM43.Label2.Caption;
end;

procedure TForm43.RadioGroup1Click(Sender: TObject);
begin
 if RadioGroup1.ItemIndex=1 then
  begin
   panel1.Visible:=false;
   panel2.Visible:=true;
  end
 else
  begin
   panel2.Visible:=false;
   panel1.Visible:=true;
  end;
end;

end.
