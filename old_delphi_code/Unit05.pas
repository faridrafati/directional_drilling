unit Unit05;

interface

uses
  Windows, Messages, SysUtils, Variants, Classes, Graphics, Controls, Forms,
  Dialogs, StdCtrls, ExtCtrls;

type
  TForm05 = class(TForm)
    RadioGroup1: TRadioGroup;
    Button1: TButton;
    Button2: TButton;
    procedure Button2Click(Sender: TObject);
    procedure Button1Click(Sender: TObject);
  private
    { Private declarations }
  public
    { Public declarations }
  end;

var
  Form05: TForm05;

implementation

uses Unit02, Unit04;

{$R *.dfm}

procedure TForm05.Button1Click(Sender: TObject);
var
 ii:integer;
 wlpt,WLPT1:branch;
begin
 form02.ADOTABLE2.First;
 ii:=0;
 while form02.ADOTABLE2.FieldByName('TYPE').AsINTEGER<>-1 do
  BEGIN
   with form02.ADOTABLE2 do
    begin
     ii:=ii+1;
     wlpt.order:=FieldByName('ordr').AsInteger;
    end;
   form02.ADOTABLE2.Next;
  END;
 IF RadioGroup1.ItemIndex=0 THEN
   wlpt1.typ:=21
 else if RadioGroup1.ItemIndex=1 THEN
   wlpt1.typ:=22
 else if RadioGroup1.ItemIndex=2 THEN
   wlpt1.typ:=23;
 wlpt1.MD:=0;
 wlpt1.INC:=0;
 wlpt1.AZM:=0;
 wlpt1.TVD:=0;
 wlpt1.vsec:=0;
 wlpt1.NS:=0;
 wlpt1.EW:=0;
 wlpt1.DLS:=0;
 WLPT1.CMT:='KOP';
 wlpt1.order:=wlpt.order+1;
 FORM02.rowcolor(II,WLPT1.typ);
 form04.cellshow(wlpt1);
 form05.Close;
end;

procedure TForm05.Button2Click(Sender: TObject);
begin
 form05.Close;
end;

end.
