unit Unit01;

interface

uses
  Windows, Messages, SysUtils, Variants, Classes, Graphics, Controls, Forms,
  Dialogs, StdCtrls, ComCtrls, Menus, ImgList, DB, DBTables, ExtCtrls, DBCtrls,
  Grids, DBGrids, OleServer, AccessXP, CategoryButtons, Buttons, ADODB,
  SqlExpr, DBXFirebird, RpBase, RpSystem, RpDefine, RpRave, RpCon, RpConDS,
  RpConBDE;

type
  TForm01 = class(TForm)
    Treeview1: TTreeView;
    MainMenu1: TMainMenu;
    File1: TMenuItem;
    New1: TMenuItem;
    Load1: TMenuItem;
    Save1: TMenuItem;
    Exit1: TMenuItem;
    SaveDialog1: TSaveDialog;
    ImageList1: TImageList;
    DataSource1: TDataSource;
    DBNavigator1: TDBNavigator;
    DBGrid3: TDBGrid;
    OpenDialog1: TOpenDialog;
    StatusBar1: TStatusBar;
    SaveAs1: TMenuItem;
    PopupMenu1: TPopupMenu;
    ADDWELLFromDWD1: TMenuItem;
    BUT_EDIT: TButton;
    Edit1: TEdit;
    ADOConnection1: TADOConnection;
    ADOTable1: TADOTable;
    ADOCommand1: TADOCommand;
    ADD1: TMenuItem;
    REMOVE1: TMenuItem;
    SURVEYEDITORBYDSE1: TMenuItem;
    Refresh1: TMenuItem;
    Splitter1: TSplitter;
    procedure refreshf;
    procedure Save1Click(Sender: TObject);
    procedure New1Click(Sender: TObject);
    procedure Load1Click(Sender: TObject);
    procedure Exit1Click(Sender: TObject);
    procedure TreeView1Click(Sender: TObject);
    procedure FormDestroy(Sender: TObject);
    procedure SaveAs1Click(Sender: TObject);
    procedure FormCreate(Sender: TObject);
    procedure BUT_EDITClick(Sender: TObject);
    procedure Edit1Exit(Sender: TObject);
    procedure ADDWELLFromDWD1Click(Sender: TObject);
    PROCEDURE DELTEMP;
    procedure Button2Click(Sender: TObject);
    function TableExists(const TableName: String): Boolean;
    procedure CopyTableStructure(Source: TTable; DB,Dest: string);
    PROCEDURE ADDTABLE(TABLE:STRING;VAR TABLENAME: STRING);
    PROCEDURE CHKTABLE(VAR TREENAME: STRING);
    PROCEDURE FNDTABLE(var tblname: string);
    procedure Button3Click(Sender: TObject);
    procedure TreeView1MouseDown(Sender: TObject; Button: TMouseButton;
      Shift: TShiftState; X, Y: Integer);
    procedure ADD1Click(Sender: TObject);
    procedure REMOVE1Click(Sender: TObject);
    procedure Edit1Click(Sender: TObject);
    procedure SURVEYEDITORBYDSE1Click(Sender: TObject);
    procedure TreeView1Edited(Sender: TObject; Node: TTreeNode; var S: string);
    procedure Button1Click(Sender: TObject);
    procedure FormResize(Sender: TObject);
    procedure FileSearch(const PathName, FileName : string; const InDir : boolean);
    PROCEDURE ADDWELL;
    procedure DBGrid3KeyDown(Sender: TObject; var Key: Word;
      Shift: TShiftState);
  private
    { Private declarations }
  public
    { Public declarations }
  end;

var
  Form01: TForm01;
  cancel:boolean;
  oldtext,oldfiles:string;
implementation

uses Unit02, Unit04, Unit07, Unit09, Unit10, Unit21, Unit35, Unit22, Unit41;

{$R *.dfm}

PROCEDURE TFORM01.ADDWELL;
var
  tables: TStringList;
  ii,JJ: integer;
  a,b: String;
  WL:ARRAY[1..2,1..100]OF STRING;
begin
 tables := TStringList.Create;
 try
   for ii := 1 to 100 do
    welltablename[ii]:='';
   ADOConnection1.GetTableNames(TABLES);
   ii:=0;
   JJ:=0;
   while (ii<=tables.Count-1) do
    begin
     a:=copy(tables[ii],1,2);
     ADOTABLE1.Active:=false;
     ADOTABLE1.TableName:=tables[ii];
     ADOTABLE1.Active:=true;
     ADOTABLE1.FIRST;
     IF(a='SE')then
      begin
       if (Treeview1.Selected.Text=ADOTABLE1.FieldByName('Field').AsString)and
       (Treeview1.Selected.parent.Text=ADOTABLE1.FieldByName('Country').AsString)then
        begin
         JJ:=JJ+1;
         WL[1,JJ]:=ADOTABLE1.FieldByName('WELL').AsString;
         WL[2,JJ]:=ADOTABLE1.FieldByName('CALC').AsString;
         welltablename[jj]:=tables[ii];
        end;
      end;
     ii:=ii+1;
    end;
 finally
   tables.free;
  end;
 form21.combobox1.clear;
 for II := 1 to JJ do
  BEGIN
   form21.ComboBox1.items.Add(wl[1,ii]+' => '+wl[2,ii]);
  END;
 form21.ComboBox1.ItemIndex:=0;
END;

procedure tform01.FileSearch(const PathName, FileName : string; const InDir : boolean);
var Rec  : TSearchRec;
    Path : string;
    ii:integer;
begin

form22.checklistbox1.Clear;
Path := IncludeTrailingBackslash(PathName);
if FindFirst(Path + FileName, faAnyFile - faDirectory, Rec) = 0 then
 try
   repeat
     form22.CheckListBox1.Items.Add(Path + Rec.Name);
   until FindNext(Rec) <> 0;
 finally
   FindClose(Rec);
 end;
for ii := 0 to Form22.CheckListBox1.Count-1 do
  form22.CheckListBox1.Checked[ii]:=true;
If not InDir then Exit;

if FindFirst(Path + '*.*', faDirectory, Rec) = 0 then
 try
   repeat
    if ((Rec.Attr and faDirectory) <> 0)  and (Rec.Name<>'.') and (Rec.Name<>'..') then
     FileSearch(Path + Rec.Name, FileName, True);
   until FindNext(Rec) <> 0;
 finally
   FindClose(Rec);
 end;
end; //procedure FileSearch



PROCEDURE tForm01.FNDTABLE(var tblname: string);
var
  tables: TStringList;
  ii,jj: integer;
  a,b: String;
begin
 if (treeview1.selected <>nil) and (trEEVIEW1.Selected.Level<=3) then
  BEGIN
   tables := TStringList.Create;
   try
     ADOConnection1.GetTableNames(TABLES);
     ii:=0;
     while (ii<=tables.Count-1) do
      begin
       a:=copy(tables[ii],1,2);
       ADOTABLE1.Active:=false;
       ADOTABLE1.TableName:=tables[ii];
       ADOTABLE1.Active:=true;
        if(Treeview1.Selected.Level=0) then
        begin
         if Treeview1.Selected.Text=ADOTABLE1.FieldByName('Country').AsString then
          begin
           tblname:=ADOTABLE1.TableName;
          end;
        end
       else if(Treeview1.Selected.Level=1)and(a='FI') then
        begin
         if (Treeview1.Selected.Text=ADOTABLE1.FieldByName('Field').AsString)and
         (Treeview1.Selected.parent.Text=ADOTABLE1.FieldByName('Country').AsString)then
          begin
           tblname:=ADOTABLE1.TableName;
          end;
        end
       else if(Treeview1.Selected.Level=2)and(a='WL') then
        begin
         if (Treeview1.Selected.Text=ADOTABLE1.FieldByName('Well').AsString)and
         (Treeview1.Selected.parent.Text=ADOTABLE1.FieldByName('Field').AsString)and
         (Treeview1.Selected.parent.Parent.Text=ADOTABLE1.FieldByName('Country').AsString)then
          begin
           tblname:=ADOTABLE1.TableName;
          end;
        end
       else if(Treeview1.Selected.Level=3)and((a='WD')OR(A='SE'))then
        begin
         if(Treeview1.Selected.parent.Parent.Parent.Text=ADOTABLE1.FieldByName('Country').AsString)then
         if(Treeview1.Selected.parent.Parent.Text=ADOTABLE1.FieldByName('Field').AsString)then
         if(Treeview1.Selected.parent.Text=ADOTABLE1.FieldByName('Well').AsString)then
         if (Treeview1.Selected.Text=ADOTABLE1.FieldByName('CALC').AsString)then
          begin
           tblname:=ADOTABLE1.TableName;
          end;
        end;
       ii:=ii+1;
      end;
   finally
     tables.free;
    end;
  END;

end;



procedure tForm01.CopyTableStructure(Source: TTable; DB,Dest: string);
var NewTable: TTable;

begin
  NewTable := TTable.Create(self);
  with NewTable do
  begin
    Databasename := DB;
    Tablename := Dest;
    FieldDefs.Assign(Source.FieldDefs);
    IndexDefs.Assign(Source.IndexDefs);
    CreateTable;
    NewTable.Destroy;
  end;
end;
procedure TForm01.BUT_EDITClick(Sender: TObject);
var
  tables: TStringList;
  ii,jj: integer;
  a,b,C,d: String;
begin
 if (treeview1.selected <>nil) and (trEEVIEW1.Selected.Level<=3)and(oldtext<>edit1.Text) then
  BEGIN
   d:=UPPERCASE(edit1.Text);
   for ii := 0 to treeview1.Items.Count-1 do
    begin
     if (treeview1.items.Item[ii].Level=treeview1.Selected.Level)
     and(treeview1.items.Item[ii].text=D)
     AND(treeview1.items.Item[ii].PARENT.Text=treeview1.Selected.parent.Text) then
      begin
       d:=d+' NEW';
      end;
    end;
   c:=Treeview1.Selected.Text;
   tables := TStringList.Create;
   try
     ADOConnection1.GetTableNames(TABLES);
     ii:=0;
     while (ii<=tables.Count-1) do
      begin
       a:=copy(tables[ii],1,2);
       B:=copy(tables[ii],1,5);
       ADOTABLE1.Active:=false;
       ADOTABLE1.TableName:=tables[ii];
       ADOTABLE1.Active:=true;
       if(Treeview1.Selected.Level=0)and not((a='TW')or(a='TS')OR(a='TC')) then
        begin
         if Treeview1.Selected.Text=ADOTABLE1.FieldByName('Country').AsString then
          begin
           ADOCommand1.CommandText:='UPDATE '+B+' SET '+'COUNTRY = '''+d+'''';
           ADOCommand1.Execute;
          end;
        end
       else if(Treeview1.Selected.Level=1)and not((a='CO')or(a='TW')or(a='TS')OR(a='TC')) then
        begin
         if (Treeview1.Selected.Text=ADOTABLE1.FieldByName('Field').AsString)and
         (Treeview1.Selected.parent.Text=ADOTABLE1.FieldByName('Country').AsString)then
          begin
           ADOCommand1.CommandText:='UPDATE '+B+' SET '+'FIELD = '''+d+'''';
           ADOCommand1.Execute;
          end;
        end
       else if(Treeview1.Selected.Level=2)and not((a='FI')or(a='CO')or(a='TW')or(a='TS')OR(a='TC')) then
        begin
         if (Treeview1.Selected.Text=ADOTABLE1.FieldByName('Well').AsString)and
         (Treeview1.Selected.parent.Text=ADOTABLE1.FieldByName('Field').AsString)and
         (Treeview1.Selected.parent.Parent.Text=ADOTABLE1.FieldByName('Country').AsString)then
          begin
           ADOCommand1.CommandText:='UPDATE '+B+' SET '+'WELL = '''+d+'''';
           ADOCommand1.Execute;
          end;
        end
       else if(Treeview1.Selected.Level=3)and((a='WD')OR(A='SE')OR(a='TC'))then
        begin
         if (Treeview1.Selected.Text=ADOTABLE1.FieldByName('CALC').AsString)and
         (Treeview1.Selected.parent.Text=ADOTABLE1.FieldByName('Well').AsString)and
         (Treeview1.Selected.parent.Parent.Text=ADOTABLE1.FieldByName('Field').AsString)AND
         (Treeview1.Selected.parent.Parent.Parent.Text=ADOTABLE1.FieldByName('Country').AsString)then
          begin
             ADOCommand1.CommandText:='UPDATE '+B+' SET '+'CALC = '''+d+'''';
             ADOCommand1.Execute;
          end;
        end;
       ii:=ii+1;
      end;
   finally
     tables.free;
    end;
   refreshf;
  END;

end;

procedure TForm01.ADDWELLFromDWD1Click(Sender: TObject);
begin
 form02.ShowModal;
end;


procedure TForm01.Button1Click(Sender: TObject);
begin
 FORM41.SHOWMODAL;
end;

procedure TForm01.Button2Click(Sender: TObject);
begin
 FORM21.SHOWMODAL;

end;

procedure TForm01.Button3Click(Sender: TObject);
VAR
 XXX:STRING;
begin
   ADDTABLE('CO',XXX);
   ADDTABLE('FI',XXX);
   ADDTABLE('WL',XXX);
   ADDTABLE('WD',XXX);
   ADDTABLE('SE',XXX);
   ADDTABLE('BD',XXX);
   ADDTABLE('CD',XXX);
   ADDTABLE('HD',XXX);
   ADDTABLE('MD',XXX);

end;

procedure tForm01.refreshf;
var
  tables: TStringList;
  ii,jj,kk,LL: integer;
  a,Cty,fld,WEL: String;
  list:tstringlist;
begin
     tables := TStringList.Create;
     List   := TStringList.Create;
     try
       ADOConnection1.GetTableNames(TABLES);
       for ii:=0 to tables.Count-1 do
        begin
         a:=copy(tables[ii],1,2);
         if a='CO' then
          begin
           ADOTable1.Active:=FALSE;
           ADOTABLE1.TableName:=tables[ii];
           ADOTABLE1.Active:=true;
           List.Add (ADOTABLE1.FieldByName('Country').AsString);
           cty:=ADOTABLE1.FieldByName('Country').AsString;
           for jj:=0 to tables.Count-1 do
            begin
             a:=copy(tables[jj],1,2);
             if a='FI' then
              begin
               ADOTABLE1.Active:=false;
               ADOTABLE1.TableName:=tables[jj];
               ADOTABLE1.Active:=true;
               if ADOTABLE1.FieldByName('Country').AsString=cty then
                begin
                 List.Add (#9+ADOTABLE1.FieldByName('Field').AsString);
                 fld:=ADOTABLE1.FieldByName('Field').AsString;
                 for kk:=0 to (tables.Count-1) do
                  begin
                   a:=copy(tables[kk],1,2);
                   if a='WL' then
                    begin
                     ADOTABLE1.Active:=false;
                     ADOTABLE1.TableName:=tables[kk];
                     ADOTABLE1.Active:=true;
                     if (ADOTABLE1.FieldByName('Field').AsString=fld)AND
                     (ADOTABLE1.FieldByName('Country').AsString=cty) then
                      begin
                       List.Add(#9+#9+ADOTABLE1.FieldByName('Well').AsString);
                       WEL:=ADOTABLE1.FieldByName('Well').AsString;
                       for LL := 0 to tables.Count-1 do
                        begin
                         a:=copy(tables[ll],1,2);
                         if (a='WD')or(a='SE')OR(a='CD')or(a='BD')or(a='MD')or(a='HD') then
                          begin
                           ADOTABLE1.Active:=false;
                           ADOTABLE1.TableName:=tables[ll];
                           ADOTABLE1.Active:=true;
                           if (ADOTABLE1.FieldByName('WELL').AsString=WEL)AND
                              (ADOTABLE1.FieldByName('Field').AsString=fld)AND
                              (ADOTABLE1.FieldByName('Country').AsString=cty)then
                            begin
                             List.Add(#9+#9+#9+ADOTABLE1.FieldByName('CALC').AsString);
                            end;
                          end;
                        end;
                      end;
                    end;
                  end;
                end;
              end;
            end;
          end;
        end;
       List.SaveToFile ('Temp.txt');
     finally
       tables.free;
       List.Free;
      end;
     TreeView1.LoadFromFile ('Temp.txt');
     TreeView1.LoadFromFile ('Temp.txt');
//     DeleteFile('Temp.txt');
end;
procedure TForm01.REMOVE1Click(Sender: TObject);
var
 ret:integer;
  tables: TStringList;
  ii,jj,aa,bb: integer;
  a,B: String;
begin
 if treeview1.Items.Count<>0 then
  begin
   Ret:=MessageDlg('Are You Sure to Delete This Treeview?',mtWarning,mbYesNoCancel,1);
   if ret=6 then
    begin
      {Make sure somthing is selected, before trying to
        delete it     }
     if(  treeview1.Selected = nil  ) then
      begin
       ShowMessage(  'Nothing selected'  );
       Exit;
      end;
      {Dont allow user to delete the root node  }
     treeview1.Selected.Delete;
     aa:=treeview1.Items.Count;
     tables := TStringList.Create;
     if treeview1.Items.Count<>0 then
      begin
       try
         ADOConnection1.GetTableNames(TABLES);
         ii:=0;
         while (ii<= tables.count-1) do
          begin
           a:=copy(tables[ii],1,2);
           B:=COPY(TABLES[II],1,5);
           jj:=0;
           bb:=0;
           while(jj<= aa - 1 )do
            begin
             ADOTABLE1.Active:=false;
             ADOTABLE1.TableName:=tables[ii];
             ADOTABLE1.Active:=true;
             ADOTable1.First;
             if (a='CO')and(Treeview1.items.item[jj].Level=0) then
              begin
               if Treeview1.items.item[jj].Text=ADOTABLE1.FieldByName('Country').AsString then
                begin
                 bb:=1;
                 jj:=aa;
                end;
              end
             else if (a='FI')and(Treeview1.items.item[jj].Level=1) then
              begin
               if (Treeview1.items.item[jj].Parent.Text=ADOTABLE1.FieldByName('Country').AsString)
               and (Treeview1.items.item[jj].Text=ADOTABLE1.FieldByName('Field').AsString)then
                begin
                 bb:=1;
                 jj:=aa;
                end;
              end
             else if (a='WL')and(Treeview1.items.item[jj].Level=2) then
              begin
               if (Treeview1.items.item[jj].Parent.Parent.Text=ADOTABLE1.FieldByName('Country').AsString)
               and(Treeview1.items.item[jj].Parent.Text=ADOTABLE1.FieldByName('Field').AsString)
               and(Treeview1.items.item[jj].Text=ADOTABLE1.FieldByName('Well').AsString)then
                begin
                 bb:=1;
                 jj:=aa;
                end
              end
             else if ((a='WD')OR(A='SE'))and(Treeview1.items.item[jj].Level=3) then
              begin
               if (Treeview1.items.item[jj].Parent.Parent.Parent.Text=ADOTABLE1.FieldByName('Country').AsString)
               and(Treeview1.items.item[jj].Parent.Parent.Text=ADOTABLE1.FieldByName('Field').AsString)
               and(Treeview1.items.item[jj].Parent.Text=ADOTABLE1.FieldByName('Well').AsString)
               and(Treeview1.items.item[jj].Text=ADOTABLE1.FieldByName('CALC').AsString)then
                begin
                 bb:=1;
                 jj:=aa;
                end;
              end;
             jj:=jj+1;
            end;
           if (bb=0)and((a<>'TW')and(a<>'TS')) then
            begin
             ADOCommand1.CommandText:='DROP TABLE '+B;
             ADOCommand1.Execute;
            end;
           ii:=ii+1;
          end;
       finally
         tables.free;
        end;
      end
     else
      begin
       New1.Click;
      end;
     refreshf;
    end;
  end;
end;


procedure TForm01.Edit1Click(Sender: TObject);
begin
 oldtext:=edit1.Text;
end;

procedure TForm01.Edit1Exit(Sender: TObject);
begin
 if treeview1.Selected= nil then
  showmessage('');
end;

procedure TForm01.Exit1Click(Sender: TObject);
var
 locala:integer;
begin
 locala:=MessageDlg('Are you sure?',mtConfirmation,mbYesNo,1);
 if locala=6 then
  begin
   locala:=MessageDlg('Do You Want To Save?',mtConfirmation,mbYesNo,1);
   if locala=6 then
    begin
     SaveAs1.Click;
    end;
   Form01.Destroy;
  end;
end;

procedure TForm01.FormCreate(Sender: TObject);
VAR
 FILENAM:STRING;
begin
 oldfiles:='';
 FILENAM:=ExtractFilePath (Application.ExeName);
 AdoConnection1.LoginPrompt := False;
 ADOConnection1.ConnectionString:='Provider=Microsoft.Jet.OLEDB.4.0;Data Source='+filenam+'BLANK.mdb'+';Persist Security Info=False';
 ADOTable1.Connection:=ADOConnection1;
 DATASOURCE1.DataSet:=ADOTable1;
 OpenDialog1.FileName:='';
 DeleteFile(ExtractFilePath (Application.ExeName) +'Temp.mdb');
end;
function TForm01.TableExists(const TableName: String): Boolean;
var
 List: TStringList;
begin
 result:= False;
 List:= TStringList.Create;
 ADOConnection1.GetTableNames(list);
 result:= List.IndexOf(TableName) > - 1;
 List.Free;
end;
procedure TForm01.FormDestroy(Sender: TObject);
begin
 deltemp;
end;
procedure TForm01.FormResize(Sender: TObject);
begin
 dbgrid3.Width:=form01.width-dbgrid3.left-20;
 dbgrid3.height:=form01.height-dbgrid3.top-85;
 Treeview1.Height:=(-treeview1.Top+dbgrid3.top)+dbgrid3.height;
end;

procedure TForm01.DBGrid3KeyDown(Sender: TObject; var Key: Word;
  Shift: TShiftState);
begin
if Key=VK_DELETE then
     DBNavigator1.BtnClick(nbdelete);
end;

PROCEDURE tForm01.Deltemp;
var
 fp:string;
begin
 fp:=ExtractFilePath (Application.ExeName)+ 'Temp.mdb';
 if FileExists(fp) then
  begin
   if TableExists('CO001') then
    begin
     ADOTABLE1.Close;
    end;
   ADOConnection1.Connected:=false;
   DeleteFile(fp);
  end;
end;
procedure TForm01.Load1Click(Sender: TObject);
var
  ret:integer;
  Newfilename:string;
  NewFile: TFileStream;
  OldFile: TFileStream;
begin
 Ret:=0;
 if(  Treeview1.Items.Count<>0  ) then
  begin
   Ret:=MessageDlg('Do You Want to Save this Treeview?',mtConfirmation,mbYesNoCancel,1);
   if Ret=6 then
    begin
     Save1.Click;
     if cancel=true then
      ret:=2;
    end;
  end;
 if (OpenDialog1.Execute)and(ret<>2) then
  begin
   oldfiles:=OpenDialog1.FileName;
   deltemp;
   NewFileName := ExtractFilePath(Application.ExeName) + ExtractFileName('Temp.MDB');
   OldFile := TFileStream.Create(OpenDialog1.FileName, fmOpenRead or fmShareDenyWrite);
   try
    NewFile := TFileStream.Create(NewFileName, fmCreate or fmShareDenyRead);
    try
      NewFile.CopyFrom(OldFile, OldFile.Size);
    finally
      FreeAndNil(NewFile);
     end;
   finally
     FreeAndNil(OldFile);
    end;
   ADOConnection1.ConnectionString:='Provider=Microsoft.Jet.OLEDB.4.0;Data Source='+ExtractFilePath (Application.ExeName)+'Temp.mdb'+';Persist Security Info=False';
   ADOTable1.Connection:=ADOConnection1;
   DATASOURCE1.DataSet:=ADOTable1;
   refreshf;
  end;
end;
//******************************************************
procedure TForm01.ADD1Click(Sender: TObject);
var
   sText,tname : string;
   ttext1,ttext2,ttext3,ttext4,ttext:string;
   Node: TTreeNode;
   ii,jj,kk: Integer;
   tables:TStringList;
begin
 if(  treeview1.Items.Count <> 0  ) then
  begin
   if (Treeview1.Selected <> nil) then
    begin
     ADOTable1.Active:=FALSE;
     if Treeview1.Selected.Level=0 then
      BEGIN
       InputQuery(  'New Node',  'Field ?',  sText  );
       STEXT:=UPPERCASE(STEXT);
       if sText='' then
        sText:='NEW FIELD';
       CHKTABLE(sText);
       treeview1.Items.addChild(  treeview1.Selected,  sText  ).MakeVisible;
       ADDTABLE('FI',TNAME);
       ADOTABLE1.ACTIVE:=FALSE;
       ADOTABLE1.tableName:=tname;
       ADOTABLE1.ACTIVE:=TRUE;
       ADOTABLE1.Open;
       ADOTABLE1.Insert;
       ADOTABLE1.FieldByName('Country').AsString:=Treeview1.Selected.Text;
       ADOTABLE1.FieldByName('Field').AsString:=sText;
       ADOTABLE1.Post;
      end
     ELSE if Treeview1.Selected.Level=1 then
      BEGIN
       InputQuery(  'New Node',  'WELL NAME ?',  sText  );
       STEXT:=UPPERCASE(STEXT);
       if sText='' then
        sText:='NEW WELL';
       CHKTABLE(sText);
       Node :=treeview1.Items.AddChild(  treeview1.Selected,  sText  );
       ADDTABLE('WL',tname);
       ADOTABLE1.ACTIVE:=FALSE;
       ADOTABLE1.tableName:=tname;
       ADOTABLE1.ACTIVE:=TRUE;
       ADOTABLE1.Open;
       ADOTABLE1.Insert;
       ADOTABLE1.FieldByName('Country').AsString:=Treeview1.Selected.parent.text;
       ADOTABLE1.FieldByName('Field').AsString:=Treeview1.Selected.Text;
       ADOTABLE1.FieldByName('Well').AsString:=sText;
       ADOTABLE1.Post;
       ADDTABLE('WD',tname);
       ADOTABLE1.ACTIVE:=FALSE;
       ADOTABLE1.tableName:=tname;
       ADOTABLE1.ACTIVE:=TRUE;
       ADOTABLE1.Open;
       ADOTABLE1.Edit;
       ADOTABLE1.FieldByName('Country').AsString:=Treeview1.Selected.parent.text;
       ADOTABLE1.FieldByName('Field').AsString:=Treeview1.Selected.Text;
       ADOTABLE1.FieldByName('Well').AsString:=sText;
       ADOTABLE1.FieldByName('CALC').AsString:='WELL DESIGN';
       ADOTABLE1.Post;
       ADDTABLE('SE',tname);
       ADOTABLE1.ACTIVE:=FALSE;
       ADOTABLE1.tableName:=tname;
       ADOTABLE1.ACTIVE:=TRUE;
       ADOTABLE1.Open;
       ADOTABLE1.Edit;
       ADOTABLE1.FieldByName('Country').AsString:=Treeview1.Selected.parent.text;
       ADOTABLE1.FieldByName('Field').AsString:=Treeview1.Selected.Text;
       ADOTABLE1.FieldByName('Well').AsString:=sText;
       ADOTABLE1.FieldByName('CALC').AsString:='SURVEY EDITOR';
       ADOTABLE1.Post;
      end
     ELSE if Treeview1.Selected.Level=2 then
      BEGIN
       form09.ShowModal;
       if nd=true then
        begin
         nd:=false;
         stext:=form09.edit1.text;
         Form09.edit1.Text:='';
         if form09.RadioGroup1.ItemIndex=0 then
          begin
           if sText='' then
            sText:='WELL DESIGN';
           CHKTABLE(sText);
           treeview1.Items.addChild(  treeview1.Selected,  sText  ).MakeVisible;
           ADDTABLE('WD',TNAME);
          end
         else if form09.RadioGroup1.ItemIndex=1 then
          begin
           if sText='' then
            sText:='SURVEY EDITOR';
           CHKTABLE(sText);
           treeview1.Items.addChild(  treeview1.Selected,  sText  ).MakeVisible;
           ADDTABLE('SE',TNAME);
          end;
         ADOTABLE1.ACTIVE:=FALSE;
         ADOTABLE1.tableName:=tname;
         ADOTABLE1.ACTIVE:=TRUE;
         ADOTABLE1.Open;
         ADOTABLE1.Insert;
         ADOTABLE1.FieldByName('Country').AsString:=Treeview1.Selected.parent.Parent.text;
         ADOTABLE1.FieldByName('Field').AsString:=Treeview1.Selected.Parent.Text;
         ADOTABLE1.FieldByName('Well').AsString:=Treeview1.Selected.Text;
         ADOTABLE1.FieldByName('CALC').AsString:=STEXT;
         ADOTABLE1.Post;
        end;
      end;
     refreshf;
    end
  end
 else
  begin
   New1.Click;
  end;

end;


PROCEDURE TForm01.ADDTABLE(TABLE: string;VAR TABLENAME: STRING);
var
   sText,tname : string;
   Node: TTreeNode;
   ii,jj,kk: Integer;
   tables:TStringList;
begin
 tables := TStringList.Create;
 kk:=0;
 try
   ADOConnection1.GetTableNames(TABLES);
   ii:=0;
   while ii<=tables.Count-1 do
    begin
     if copy(tables[ii],1,2)=TABLE then
      begin
       jj:=strtoint(copy(tables[ii],3,3));
       kk:=round(0.5*(abs(jj+kk)+abs(jj-kk)));
      end;
     ii:=ii+1;
    end;
   kk:=kk+1;
   if kk<10 then
    tname:=(TABLE+'00'+inttostr(kk))
   else if kk<100 then
    tname:=(TABLE+'0'+inttostr(kk))
   else if kk<1000 then
    tname:=(TABLE+inttostr(kk));
   TABLENAME:=TNAME;
   if TABLE='CO' then
    BEGIN
     ADOCommand1.CommandText :='CREATE TABLE '+tname+' ('+
     '  COUNTRY TEXT(50),'+
     '  AREA TEXT(50),'+
     '  FIELD INTEGER,'+
     '  DIRWELL INTEGER,'+
     '  FIELDTYPE TEXT(50),'+
     '  WELLNO INTEGER)';
     ADOCommand1.Execute;
    END
   ELSE if TABLE='FI' then
    BEGIN
     ADOCommand1.CommandText :='CREATE TABLE '+tname+' ('+
     '  COUNTRY TEXT(50),'+
     '  FIELD TEXT(50),'+
     '  WELL TEXT(50),'+
     '  CALC TEXT(50),'+
     '  NS FLOAT,'+
     '  EW FLOAT,'+
     '  MSL FLOAT)';
     ADOCommand1.Execute;
    END
   ELSE if TABLE='WL' then
    BEGIN
     ADOCommand1.CommandText :='CREATE TABLE '+tname+' ('+
     '  COUNTRY TEXT(50),'+
     '  FIELD TEXT(50),'+
     '  WELL TEXT(50),'+
     '  NS FLOAT,'+
     '  EW FLOAT,'+
     '  MSL FLOAT,'+
     '  WELLTYPE TEXT(50),'+
     '  TVD FLOAT,'+
     '  MD FLOAT,'+
     '  COMMENT TEXT(50))';
     ADOCommand1.Execute;
    END
   ELSE if TABLE='WD' then
    BEGIN
     ADOCommand1.CommandText :='CREATE TABLE '+tname+' ('+
     '  COUNTRY TEXT(50),'+
     '  FIELD TEXT(50),'+
     '  WELL TEXT(50),'+
     '  CALC TEXT(50),'+
     '  COMMENT TEXT(50),'+
     '  MD FLOAT,'+
     '  INCL FLOAT,'+
     '  AZM FLOAT,'+
     '  TVD FLOAT,'+
     '  VSEC FLOAT,'+
     '  NS FLOAT,'+
     '  EW FLOAT,'+
     '  DLS FLOAT,'+
     '  TF FLOAT,'+
     '  BR FLOAT,'+
     '  TR FLOAT,'+
     '  DMD FLOAT,'+
     '  SURVEYTOOLS TEXT(50),'+
     '  ORDR INTEGER,'+
     '  TYPE INTEGER)';
     ADOCommand1.Execute;
    END

   ELSE if TABLE='TW' then
    BEGIN
     ADOCommand1.CommandText :='CREATE TABLE '+tname+' ('+
     '  COMMENT TEXT(50),'+
     '  MD FLOAT,'+
     '  INCL FLOAT,'+
     '  AZM FLOAT,'+
     '  TVD FLOAT,'+
     '  VSEC FLOAT,'+
     '  NS FLOAT,'+
     '  EW FLOAT,'+
     '  DLS FLOAT,'+
     '  TF FLOAT,'+
     '  BR FLOAT,'+
     '  TR FLOAT,'+
     '  DMD FLOAT,'+
     '  SURVEYTOOLS TEXT(50),'+
     '  ORDR INTEGER,'+
     '  TYPE INTEGER)';
     ADOCommand1.Execute;
    END
   ELSE if TABLE='TS' then
    BEGIN
     ADOCommand1.CommandText :='CREATE TABLE '+tname+' ('+
     '  COMMENT TEXT(50),'+
     '  MD FLOAT,'+
     '  INCL FLOAT,'+
     '  AZM FLOAT,'+
     '  TVD FLOAT,'+
     '  VSEC FLOAT,'+
     '  NS FLOAT,'+
     '  EW FLOAT,'+
     '  DLS FLOAT,'+
     '  TF FLOAT,'+
     '  BR FLOAT,'+
     '  TR FLOAT,'+
     '  DMD FLOAT,'+
     '  SURVEYTOOLS TEXT(50),'+
     '  ORDR INTEGER,'+
     '  TYPE INTEGER)';
     ADOCommand1.Execute;
    END
   ELSE if TABLE='SE' then
    BEGIN
     ADOCommand1.CommandText :='CREATE TABLE '+tname+' ('+
     '  COUNTRY TEXT(50),'+
     '  FIELD TEXT(50),'+
     '  WELL TEXT(50),'+
     '  CALC TEXT(50),'+
     '  COMMENT TEXT(50),'+
     '  MD FLOAT,'+
     '  INCL FLOAT,'+
     '  AZM FLOAT,'+
     '  TVD FLOAT,'+
     '  VSEC FLOAT,'+
     '  NS FLOAT,'+
     '  EW FLOAT,'+
     '  DLS FLOAT,'+
     '  TF FLOAT,'+
     '  BR FLOAT,'+
     '  TR FLOAT,'+
     '  DMD FLOAT,'+
     '  SURVEYTOOLS TEXT(50),'+
     '  ORDR INTEGER,'+
     '  TYPE INTEGER)';
     ADOCommand1.Execute;
    END
   ELSE if TABLE='CD' then
    BEGIN
{     ADOCommand1.CommandText :='CREATE TABLE '+tname+' ('+
     '  COUNTRY TEXT(50),'+
     '  FIELD TEXT(50),'+
     '  WELL TEXT(50),'+
     '  CALC TEXT(50),'+
     '  COMMENT TEXT(50),'+
     '  CSGTYPE TEXT(50),'+
     '  CPLGOD FLOAT,'+
     '  OD FLOAT,'+
     '  WEIGHT FLOAT,'+
     '  TYPE TEXT(10),'+
     '  GRADE FLOAT,'+
     '  COLLAPSE FLOAT,'+
     '  BODYYEILD FLOAT,'+
     '  BURST FLOAT,'+
     '  THICKNESS FLOAT,'+
     '  DRIFT FLOAT,'+
     '  TTLLENGTH FLOAT,'+
     '  DEPTHIN FLOAT,'+
     '  DEPTHOUT FLOAT,';
     '  MDEPTHIN FLOAT,'+
     '  MDEPTHOUT FLOAT)';    }
     ADOCommand1.Execute;
    END
   ELSE if TABLE='TC' then
    BEGIN
{     ADOCommand1.CommandText :='CREATE TABLE '+tname+' ('+
     '  COMMENT TEXT(50),'+
     '  CSGTYPE TEXT(50),'+
     '  CPLGOD FLOAT,'+
     '  OD FLOAT,'+
     '  WEIGHT FLOAT,'+
     '  TYPE TEXT(10),'+
     '  GRADE FLOAT,'+
     '  COLLAPSE FLOAT,'+
     '  BODYYEILD FLOAT,'+
     '  BURST FLOAT,'+
     '  THICKNESS FLOAT,'+
     '  DRIFT FLOAT,'+
     '  TTLLENGTH FLOAT,'+
     '  DEPTHIN FLOAT,'+
     '  DEPTHOUT FLOAT,';
     '  MDEPTHIN FLOAT,'+
     '  MDEPTHOUT FLOAT)';   }
     ADOCommand1.Execute;
    END
   ELSE if TABLE='BD' then
    BEGIN
{     ADOCommand1.CommandText :='CREATE TABLE '+tname+' ('+
     '  COUNTRY TEXT(50),'+
     '  FIELD TEXT(50),'+
     '  WELL TEXT(50),'+
     '  CALC TEXT(50),'+
     '  COMMENT TEXT(50),'+
     '  BHATYPE TEXT(50),'+
     '  CPLGOD FLOAT,'+
     '  OD FLOAT,'+
     '  WEIGHT FLOAT,'+
     '  TYPE TEXT(10),'+
     '  GRADE FLOAT,'+
     '  COLLAPSE FLOAT,'+
     '  BODYYEILD FLOAT,'+
     '  BURST FLOAT,'+
     '  THICKNESS FLOAT,'+
     '  DRIFT FLOAT,'+
     '  ISBHA BOOLEAN,'+
     '  TTLLENGTH FLOAT,'+
     '  DEPTHIN FLOAT,'+
     '  DEPTHOUT FLOAT,';
     '  MDEPTHIN FLOAT,'+
     '  MDEPTHOUT FLOAT)';
     ADOCommand1.Execute;     }
    END
   ELSE if TABLE='TB' then
    BEGIN
{     ADOCommand1.CommandText :='CREATE TABLE '+tname+' ('+
     '  COMMENT TEXT(50),'+
     '  BHATYPE TEXT(50),'+
     '  CPLGOD FLOAT,'+
     '  OD FLOAT,'+
     '  WEIGHT FLOAT,'+
     '  TYPE TEXT(10),'+
     '  GRADE FLOAT,'+
     '  COLLAPSE FLOAT,'+
     '  BODYYEILD FLOAT,'+
     '  BURST FLOAT,'+
     '  THICKNESS FLOAT,'+
     '  DRIFT FLOAT,'+
     '  ISBHA BOOLEAN,'+
     '  TTLLENGTH FLOAT,'+
     '  DEPTHIN FLOAT,'+
     '  DEPTHOUT FLOAT,';
     '  MDEPTHIN FLOAT,'+
     '  MDEPTHOUT FLOAT)';
     ADOCommand1.Execute;     }
    END
   ELSE if TABLE='MD' then
    BEGIN
{     ADOCommand1.CommandText :='CREATE TABLE '+tname+' ('+
     '  COUNTRY TEXT(50),'+
     '  FIELD TEXT(50),'+
     '  WELL TEXT(50),'+
     '  CALC TEXT(50),'+
     '  COMMENT TEXT(50),'+
     '  MUDTYPE TEXT(50),'+
     '  MW FLOAT,'+
     '  APVIS FLOAT,'+
     '  T300 FLOAT,'+
     '  T600 FLOAT,'+
     '  YEILDP FLOAT,'+
     '  PLASTICVIS FLOAT,'+
     '  DEPTHIN FLOAT,'+
     '  DEPTHOUT FLOAT,';
     '  MDEPTHIN FLOAT,'+
     '  MDEPTHOUT FLOAT)';
     ADOCommand1.Execute;      }
    END
   ELSE if TABLE='TM' then
    BEGIN
{     ADOCommand1.CommandText :='CREATE TABLE '+tname+' ('+
     '  COMMENT TEXT(50),'+
     '  MUDTYPE TEXT(50),'+
     '  MW FLOAT,'+
     '  APVIS FLOAT,'+
     '  T300 FLOAT,'+
     '  T600 FLOAT,'+
     '  YEILDP FLOAT,'+
     '  PLASTICVIS FLOAT,'+
     '  DEPTHIN FLOAT,'+
     '  DEPTHOUT FLOAT,';
     '  MDEPTHIN FLOAT,'+
     '  MDEPTHOUT FLOAT)';
     ADOCommand1.Execute;     }
    END
   ELSE if TABLE='HD' then
    BEGIN
{     ADOCommand1.CommandText :='CREATE TABLE '+tname+' ('+
     '  COUNTRY TEXT(50),'+
     '  FIELD TEXT(50),'+
     '  WELL TEXT(50),'+
     '  CALC TEXT(50),'+
     '  HLID FLOAT,'+
     '  HLDRFT FLOAT,'+
     '  POD FLOAT,'+
     '  PID FLOAT,'+
     '  BITSZE FLOAT,'+
     '  BITTYP TEXT(10),'+
     '  BITTFA FLOAT,'+
     '  VARNZL TEXT(50),'+
     '  FIXNZL TEXT(50),'+
     '  MAXPRS FLOAT,'+
     '  MWDTYP TEXT(50),'+
     '  DHMTYP TEXT(50),'+
     '  BHALAM INTEGER,'+
     '  FLOWMIN FLOAT,'+
     '  FLOWMAX FLOAT,'+
     '  MDI FLOAT,'+
     '  MDO FLOAT,'+
     '  TVDI FLOAT,'+
     '  TVDO FLOAT,'+
     '  MWI FLOAT,'+
     '  MWO FLOAT,'+
     '  PVI FLOAT,'+
     '  PVO FLOAT,'+
     '  YPI FLOAT,'+
     '  YPO FLOAT,'+
     ')';
     ADOCommand1.Execute;        }
    END
   ELSE if TABLE='TH' then
    BEGIN
 {    ADOCommand1.CommandText :='CREATE TABLE '+tname+' ('+
     '  HLID FLOAT,'+
     '  HLDRFT FLOAT,'+
     '  POD FLOAT,'+
     '  PID FLOAT,'+
     '  BITSZE FLOAT,'+
     '  BITTYP TEXT(10),'+
     '  BITTFA FLOAT,'+
     '  VARNZL TEXT(50),'+
     '  FIXNZL TEXT(50),'+
     '  MAXPRS FLOAT,'+
     '  MWDTYP TEXT(50),'+
     '  DHMTYP TEXT(50),'+
     '  BHALAM INTEGER,'+
     '  FLOWMIN FLOAT,'+
     '  FLOWMAX FLOAT,'+
     '  MDI FLOAT,'+
     '  MDO FLOAT,'+
     '  TVDI FLOAT,'+
     '  TVDO FLOAT,'+
     '  MWI FLOAT,'+
     '  MWO FLOAT,'+
     '  PVI FLOAT,'+
     '  PVO FLOAT,'+
     '  YPI FLOAT,'+
     '  YPO FLOAT,'+
     ')';

     ADOCommand1.Execute;      }
    END
   ELSE if TABLE='SH' then
    BEGIN
 {    ADOCommand1.CommandText :='CREATE TABLE '+tname+' ('+
     '  COUNTRY TEXT(50),'+
     '  FIELD TEXT(50),'+
     '  WELL TEXT(50),'+
     '  CALC TEXT(50),'+
     '  COMMENT TEXT(50),'+
     '  FLRPHD FLOAT,'+
     '  SYSPRLS FLOAT,'+
     '  BITNZLPR FLOAT,'+
     '  ANLPRDRP FLOAT,'+
     '  JTINPCTFRC FLOAT,'+
     '  IFOVHA FLOAT,'+
     '  HYDHEAD FLOAT,'+
     '  ECD FLOAT,';
     '  CUTTINGSLPVEL FLOAT,'+
     '  BITNO FLOAT,'+
     '  BITSZ FLOAT,'+
     '  BITTY TEXT(50),'+
     '  NOZZLE TEXT(50),'+
     '  TTLFLAREA FLOAT,'+
     '  BITNO FLOAT,'+
     '  BITSZ FLOAT,'+
     '  BITHSII FLOAT,'+
     '  BITHSIO FLOAT,'+
     '  JIFOARI FLOAT,'+
     '  JIFOARO FLOAT,'+
     '  NZLVELI FLOAT,'+
     '  NZLVELO FLOAT,'+
     '  FLOWI FLOAT,'+
     '  FLOWO FLOAT,'+
     '  SPPI FLOAT,'+
     '  SPPO FLOAT,'+
     '  PERBITI FLOAT,'+
     '  PERBITO FLOAT,'+
     '  MDI FLOAT,'+
     '  MDO FLOAT,'+
     '  TVDI FLOAT,'+
     '  TVDO FLOAT,'+
     '  MWI FLOAT,'+
     '  MWO FLOAT,'+
     '  PVI FLOAT,'+
     '  PVO FLOAT,'+
     '  YPI FLOAT,'+
     '  YPO FLOAT,'+
     ')';                   }
     ADOCommand1.Execute;
{     ADOCommand1.CommandText :='CREATE TABLE '+tname+' ('+
     '  COUNTRY TEXT(50),'+
     '  FIELD TEXT(50),'+
     '  WELL TEXT(50),'+
     '  CALC TEXT(50),'+
     '  COMMENT TEXT(50),'+
     '  MUDTYPE TEXT(50),'+
     '  MW FLOAT,'+
     '  APVIS FLOAT,'+
     '  T300 FLOAT,'+
     '  T600 TEXT(10),'+
     '  YEILDP FLOAT,'+
     '  PLASTICVIS FLOAT,'+
     '  DEPTHIN FLOAT,'+
     '  DEPTHOUT FLOAT,';
     '  MDEPTHIN FLOAT,'+
     '  MDEPTHOUT FLOAT)';
     ADOCommand1.Execute;   }

    END

 finally
   tables.free;
  end;
end;
PROCEDURE TForm01.CHKTABLE(VAR TREENAME: STRING);
var
   sText,tname : string;
   Node: TTreeNode;
   ii,jj,kk: Integer;
   tables:TStringList;
begin
 tables := TStringList.Create;
 kk:=0;
 try
   ADOConnection1.GetTableNames(TABLES);
   if Treeview1.Selected.Level=0 then
    BEGIN
     stext:='FI';
     for ii := 0 to TABLES.Count-1 do
      BEGIN
       ADOTable1.Active:=false;
       ADOTable1.TableName:=tables[ii];
       ADOTable1.Active:=true;
       ADOTable1.First;
       if (copy(tables[ii],1,2)=stext)
       and(ADOTABLE1.FieldByName('Country').AsString=Treeview1.Selected.Text)
       and(ADOTABLE1.FieldByName('Field').AsString=treename) then
        begin
         kk:=1;
         treename:=treename+' New';
        end;
      END;
    END
   ELSE if Treeview1.Selected.Level=1 then
    begin
     stext:='WL';
     for ii := 0 to TABLES.Count-1 do
      BEGIN
       ADOTable1.Active:=false;
       ADOTable1.TableName:=tables[ii];
       ADOTable1.Active:=true;
       if (copy(tables[ii],1,2)=stext)
       and(ADOTABLE1.FieldByName('Country').AsString=Treeview1.Selected.PARENT.Text)
       and(ADOTABLE1.FieldByName('Field').AsString=Treeview1.Selected.Text)
       and(ADOTABLE1.FieldByName('WELL').AsString=treename) then
        begin
         kk:=1;
         treename:=treename+' New';
        end;
      END;
    end
   ELSE if Treeview1.Selected.Level=2 then
    begin
     IF FORM09.RadioGroup1.ItemIndex=0 THEN
      STEXT:='WD'
     ELSE IF FORM09.RadioGroup1.ItemIndex=1 THEN
      STEXT:='SE';
     FORM09.RadioGroup1.ItemIndex:=-1;
     for ii := 0 to TABLES.Count-1 do
      BEGIN
       ADOTable1.Active:=false;
       ADOTable1.TableName:=tables[ii];
       ADOTable1.Active:=true;
       if (copy(tables[ii],1,2)=stext)
       and(ADOTABLE1.FieldByName('Country').AsString=Treeview1.Selected.PARENT.Parent.Text)
       and(ADOTABLE1.FieldByName('Field').AsString=Treeview1.Selected.PARENT.Text)
       and(ADOTABLE1.FieldByName('WELL').AsString=Treeview1.Selected.Text)
       and(ADOTABLE1.FieldByName('CALC').AsString=treename) then
        begin
         kk:=1;
         treename:=treename+' New';
        end;
      END;
    end
 finally
   tables.free;
  end;
end;

// **************************************************



procedure TForm01.New1Click(Sender: TObject);
var
 Ret:integer;
 stext1,stext2,stext3,stext4,stext5:String;
 ttext1,ttext2,ttext3,ttext4,ttext5:String;

begin
 sText1:='';
 sText2:='';
 sText3:='';
 Ret:=0;
 if(  Treeview1.Items.Count<>0  ) then
  begin
   Ret:=MessageDlg('Do You Want to Save this Treeview?',mtConfirmation,mbYesNoCancel,1);
   if Ret=6 then
    begin
     Save1.Click;
     if cancel=true then
      ret:=2;
    end;
  end;
 if ret<>2 then
  begin
   oldfiles:='';
   deltemp;
   CopyFile('Blank.MDB','Temp.MDB',true);
   OpenDialog1.FileName:=ExtractFilePath (Application.ExeName)+'Temp.MDB';
   ADOConnection1.ConnectionString:='Provider=Microsoft.Jet.OLEDB.4.0;Data Source='+OpenDialog1.FileName+';Persist Security Info=False';
   ADOTable1.Connection:=ADOConnection1;
   ADDTABLE('CO',ttext1);
   ADOTable1.TableName:=TTEXT1;
   InputQuery(  'New Node',  'Country ?',  sText1  );
   InputQuery(  'New Node',  'Field ?',  sText2  );
   InputQuery(  'New Node',  'Well ?',  sText3  );
   STEXT1:=UPPERCASE(STEXT1);
   STEXT2:=UPPERCASE(STEXT2);
   STEXT3:=UPPERCASE(STEXT3);
   if stext1='' then
    Stext1:='NEW COUNTRY';
   if stext2='' then
    Stext2:='NEW FIELD';
   if stext3='' then
    Stext3:='NEW WELL';
   ADOTABLE1.Active:=False;
   ADOTABLE1.TableName :=ttext1;
   ADOTABLE1.Open;
   ADOTABLE1.Edit;
   ADOTABLE1.FieldByName('Country').AsString:=sText1;
   ADOTABLE1.Post;
   ADOTABLE1.Active:=False;
   ADDTABLE('FI',ttext2);
   ADOTable1.TableName:=TTEXT2;
   ADOTABLE1.Open;
   ADOTABLE1.Edit;
   ADOTABLE1.FieldByName('Country').AsString:=sText1;
   ADOTABLE1.FieldByName('Field').AsString:=sText2;
   ADOTABLE1.Post;
   ADOTABLE1.Active:=False;
   ADDTABLE('WL',ttext3);
   ADOTable1.TableName:=TTEXT3;
   ADOTABLE1.Open;
   ADOTABLE1.Edit;
   ADOTABLE1.FieldByName('Country').AsString:=sText1;
   ADOTABLE1.FieldByName('Field').AsString:=sText2;
   ADOTABLE1.FieldByName('Well').AsString:=sText3;
   ADOTABLE1.Post;
   ADOTABLE1.Active:=False;
   ADDTABLE('WD',ttext4);
   ADOTable1.TableName:=TTEXT4;
   ADOTABLE1.Open;
   ADOTABLE1.Edit;
   ADOTABLE1.FieldByName('Country').AsString:=sText1;
   ADOTABLE1.FieldByName('Field').AsString:=sText2;
   ADOTABLE1.FieldByName('Well').AsString:=sText3;
   ADOTABLE1.FieldByName('CALC').AsString:='WELL DESIGN';
   ADOTABLE1.Post;
   ADOTABLE1.Active:=False;
   ADDTABLE('SE',ttext5);
   ADOTable1.TableName:=TTEXT5;
   ADOTABLE1.Open;
   ADOTABLE1.Edit;
   ADOTABLE1.FieldByName('Country').AsString:=sText1;
   ADOTABLE1.FieldByName('Field').AsString:=sText2;
   ADOTABLE1.FieldByName('Well').AsString:=sText3;
   ADOTABLE1.FieldByName('CALC').AsString:='SURVEY EDITOR';
   ADOTABLE1.Post;
{   ADOTABLE1.Active:=False;
   ADDTABLE('BD',ttext4);
   ADOTable1.TableName:=TTEXT4;
   ADOTABLE1.Open;
   ADOTABLE1.Edit;
   ADOTABLE1.FieldByName('Country').AsString:=sText1;
   ADOTABLE1.FieldByName('Field').AsString:=sText2;
   ADOTABLE1.FieldByName('Well').AsString:=sText3;
   ADOTABLE1.FieldByName('CALC').AsString:='BHA DESIGN';
   ADOTABLE1.Post;
   ADOTABLE1.Active:=False;
   ADDTABLE('CD',ttext4);
   ADOTable1.TableName:=TTEXT4;
   ADOTABLE1.Open;
   ADOTABLE1.Edit;
   ADOTABLE1.FieldByName('Country').AsString:=sText1;
   ADOTABLE1.FieldByName('Field').AsString:=sText2;
   ADOTABLE1.FieldByName('Well').AsString:=sText3;
   ADOTABLE1.FieldByName('CALC').AsString:='CASING DESIGN';
   ADOTABLE1.Post;
   ADOTABLE1.Active:=False;
   ADDTABLE('HD',ttext4);
   ADOTable1.TableName:=TTEXT4;
   ADOTABLE1.Open;
   ADOTABLE1.Edit;
   ADOTABLE1.FieldByName('Country').AsString:=sText1;
   ADOTABLE1.FieldByName('Field').AsString:=sText2;
   ADOTABLE1.FieldByName('Well').AsString:=sText3;
   ADOTABLE1.FieldByName('CALC').AsString:='HYDRAULIC DESIGN';
   ADOTABLE1.Post;
   ADOTABLE1.Active:=False;
   ADDTABLE('MD',ttext4);
   ADOTable1.TableName:=TTEXT4;
   ADOTABLE1.Open;
   ADOTABLE1.Edit;
   ADOTABLE1.FieldByName('Country').AsString:=sText1;
   ADOTABLE1.FieldByName('Field').AsString:=sText2;
   ADOTABLE1.FieldByName('Well').AsString:=sText3;
   ADOTABLE1.FieldByName('CALC').AsString:='MUD DESIGN';
   ADOTABLE1.Post;          }


   ADOTABLE1.Active:=False;
   ADDTABLE('TS',ttext4);
   ADOTable1.TableName:=TTEXT4;
   ADOTABLE1.Active:=False;
   ADDTABLE('TW',ttext4);
   ADOTable1.TableName:=TTEXT4;
   ADOTABLE1.Active:=False;
{   ADDTABLE('TB',ttext4);
   ADOTable1.TableName:=TTEXT4;
   ADOTABLE1.Active:=False;
   ADDTABLE('TC',ttext4);
   ADOTable1.TableName:=TTEXT4;
   ADOTABLE1.Active:=False;
   ADDTABLE('TH',ttext4);
   ADOTable1.TableName:=TTEXT4;
   ADOTABLE1.Active:=False;
   ADDTABLE('TM',ttext4);
   ADOTable1.TableName:=TTEXT4;   }

   refreshf;
  end;
end;

procedure TForm01.Save1Click(Sender: TObject);
begin
 ADOTable1.Close;
 ADOConnection1.Connected:=false;
 if OldFiles='' then
  SaveAs1.Click
 else
  begin
   oldfiles:=copy(oldfiles,1,length(oldfiles)-4);
   if FileExists(OldFiles+'.mdb') then
    begin
     DeleteFile(OldFiles+'.mdb');
     DeleteFile(OldFiles+'.ldb');
    end;
   CopyFile('Temp.MDB',StringtoOleStr(oldfiles+'.mdb'),true);
   OpenDialog1.FileName:=ExtractFilePath (Application.ExeName)+'Temp.MDB';
   ADOConnection1.ConnectionString:='Provider=Microsoft.Jet.OLEDB.4.0;Data Source='+OpenDialog1.FileName+';Persist Security Info=False';
   ADOTable1.Connection:=ADOConnection1;
   OpenDialog1.FileName:=SaveDialog1.FileName;
   oldfiles:=OldFiles+'.mdb';
  end;
end;
procedure TForm01.SaveAs1Click(Sender: TObject);
var
  NewFileName: string;
  add: string;
  ii:integer;
  begin
 if Treeview1.Items.Count<>0 then
  BEGIN
   SaveDialog1.FileName:='NEW COUNTRY';
   ADOTable1.Close;
   ADOConnection1.Connected:=false;
   if SaveDialog1.Execute then
    begin
     add:='';
     for ii:=1 to length(savedialog1.FileName) do
      begin
       if savedialog1.FileName[ii]='.' then
        break;
       add:=add+savedialog1.FileName[ii];
      end;
     if FileExists(add+'.mdb') then
      begin
       DeleteFile(add+'.mdb');
       DeleteFile(add+'.ldb');
      end;
     CopyFile('Temp.MDB',StringtoOleStr(add+'.mdb'),true);
     OpenDialog1.FileName:=ExtractFilePath (Application.ExeName)+'Temp.MDB';
     ADOConnection1.ConnectionString:='Provider=Microsoft.Jet.OLEDB.4.0;Data Source='+OpenDialog1.FileName+';Persist Security Info=False';
     ADOTable1.Connection:=ADOConnection1;
     OpenDialog1.FileName:=SaveDialog1.FileName;
     oldfiles:=StringtoOleStr(add+'.mdb');
     refreshf;
    end;
  end;
end;



procedure TForm01.SURVEYEDITORBYDSE1Click(Sender: TObject);
VAR
 TN:STRING;
begin
if Treeview1.Selected.Level=1 then
 begin
  form21.FieldExtract;
  ADDWELL;
  FORM21.Button1.Click;
  FORM21.ShowModal;
 end;
if Treeview1.Selected.Level=3 then
 begin
  FNDTABLE(TN);
  FORM10.ADOTable1.Active:=FALSE;
  FORM10.ADOTable1.TableName:=TN;
  FORM10.ADOTable1.Active:=TRUE;
  FORM10.ShowMODAL;
 end;
end;

procedure TForm01.TreeView1Click(Sender: TObject);
var
  tables: TStringList;
  ii: integer;
  a,b: String;
begin
   if(  treeview1.Selected <> nil  ) then
    begin
     edit1.Text:=treeview1.Selected.Text;
     tables := TStringList.Create;
     try
       ADOConnection1.GetTableNames(TABLES);
       ii:=0;
       while (ii<=tables.Count-1) do
        begin
         a:=copy(tables[ii],1,2);
         if (a='CO')and(Treeview1.Selected.Level=0) then
          begin
           ADOTABLE1.Active:=false;
           ADOTABLE1.TableName:=tables[ii];
           ADOTABLE1.Active:=true;
           DBGRID3.Columns.Items[0].Visible:=FALSE;
           DBGRID3.Columns.Items[1].Visible:=TRUE;
           DBGRID3.Columns.Items[2].Visible:=TRUE;
           DBGRID3.Columns.Items[3].Visible:=TRUE;

           if Treeview1.Selected.Text=ADOTABLE1.FieldByName('Country').AsString then
            BEGIN
            // DBGrid3.Columns
             ii:=tables.Count;
            END
           else
            ADOTABLE1.Active:=false;
          end;
         if (a='FI')and(Treeview1.Selected.Level=1) then
          begin
           ADOTABLE1.Active:=false;
           ADOTABLE1.TableName:=tables[ii];
           ADOTABLE1.Active:=true;
           FileSearch(ExtractFilePath (Application.ExeName)+ADOTABLE1.FieldByName('Field').AsString,'*.grd',true);
           DBGRID3.Columns.Items[0].Visible:=FALSE;
           DBGRID3.Columns.Items[1].Visible:=FALSE;
           DBGRID3.Columns.Items[2].Visible:=TRUE;
           DBGRID3.Columns.Items[3].Visible:=TRUE;
           if form22.CheckListBox1.Count<>0 then
            begin
             PopupMenu1.Items[3].VISIBLE:=TRUE;
             PopupMenu1.Items[3].Caption:='Report From Field';
             PopupMenu1.Items[3].ImageIndex:=2;
            end
           else
            PopupMenu1.Items[3].VISIBLE:=false;

           if (Treeview1.Selected.Text=ADOTABLE1.FieldByName('Field').AsString)and
           (Treeview1.Selected.Parent.Text=ADOTABLE1.FieldByName('Country').AsString) then
            ii:=tables.Count
           else
            ADOTABLE1.Active:=false;
          end;
         if (a='WL')and(Treeview1.Selected.Level=3) then
          begin
           ADOTABLE1.Active:=false;
           ADOTABLE1.TableName:=tables[ii];
           ADOTABLE1.Active:=true;
           DBGRID3.Columns.Items[0].Visible:=FALSE;
           DBGRID3.Columns.Items[1].Visible:=FALSE;
           DBGRID3.Columns.Items[2].Visible:=FALSE;
           DBGRID3.Columns.Items[3].Visible:=TRUE;

           if(Treeview1.Selected.parent.Text=ADOTABLE1.FieldByName('Well').AsString)and
           (Treeview1.Selected.Parent.parent.Text=ADOTABLE1.FieldByName('Field').AsString)and
           (Treeview1.Selected.Parent.Parent.Parent.Text=ADOTABLE1.FieldByName('Country').AsString)then
            ii:=tables.Count
           else
            ADOTABLE1.Active:=false;
          end;
         if ((a='WD')OR(A='SE'))and(Treeview1.Selected.Level=3) then
          begin
           ADOTABLE1.Active:=false;
           ADOTABLE1.TableName:=tables[ii];
           ADOTABLE1.Active:=true;
           DBGRID3.Columns.Items[0].Visible:=FALSE;
           DBGRID3.Columns.Items[1].Visible:=FALSE;
           DBGRID3.Columns.Items[2].Visible:=FALSE;
           DBGRID3.Columns.Items[3].Visible:=FALSE;
           DBGRID3.Columns.Items[18].Visible:=FALSE;
           DBGRID3.Columns.Items[19].Visible:=FALSE;

           if(Treeview1.Selected.Text=ADOTABLE1.FieldByName('CALC').AsString)and
           (Treeview1.Selected.parent.Text=ADOTABLE1.FieldByName('Well').AsString)and
           (Treeview1.Selected.Parent.parent.Text=ADOTABLE1.FieldByName('Field').AsString)and
           (Treeview1.Selected.Parent.Parent.Parent.Text=ADOTABLE1.FieldByName('Country').AsString)then
            ii:=tables.Count
           else
            ADOTABLE1.Active:=false;
          end;
         ii:=ii+1;
        end;
     finally
       tables.free;
     end;
    end
end;


procedure TForm01.TreeView1Edited(Sender: TObject; Node: TTreeNode;
  var S: string);
begin
 Treeview1.Selected.Text:=edit1.Text;
 edit1.Text:=s;
 BUT_EDIT.Click;
end;

procedure TForm01.TreeView1MouseDown(Sender: TObject; Button: TMouseButton;
  Shift: TShiftState; X, Y: Integer);
var
 dbname:string;
begin
 PopupMenu1.Images:=imagelist1;
 if (treeview1.selected <>nil)then
  begin
   if Treeview1.Selected.Level=0 then
    BEGIN
     PopupMenu1.Items[0].VISIBLE:=TRUE;
     PopupMenu1.Items[0].Caption:='ADD a New Field';
     PopupMenu1.Items[0].ImageIndex:=0;

     PopupMenu1.Items[1].VISIBLE:=FALSE;
     PopupMenu1.Items[2].VISIBLE:=FALSE;
     PopupMenu1.Items[3].VISIBLE:=FALSE;
    END
   ELSE if Treeview1.Selected.Level=1 then
    BEGIN
     PopupMenu1.Items[0].VISIBLE:=TRUE;
     PopupMenu1.Items[0].Caption:='Add a New Well';
     PopupMenu1.Items[0].ImageIndex:=0;

     PopupMenu1.Items[1].VISIBLE:=TRUE;
     PopupMenu1.Items[1].Caption:='Remove The Field';
     PopupMenu1.Items[1].ImageIndex:=1;

     PopupMenu1.Items[2].VISIBLE:=FALSE;
    END
   ELSE if Treeview1.Selected.Level=2 then
    BEGIN
     PopupMenu1.Items[0].VISIBLE:=TRUE;
     PopupMenu1.Items[0].Caption:='Add a Calc. Colection';
     PopupMenu1.Items[0].ImageIndex:=0;

     PopupMenu1.Items[1].VISIBLE:=TRUE;
     PopupMenu1.Items[1].Caption:='Remove The Well';
     PopupMenu1.Items[1].ImageIndex:=1;

     PopupMenu1.Items[2].VISIBLE:=FALSE;
     PopupMenu1.Items[3].VISIBLE:=FALSE;
    END
   ELSE if Treeview1.Selected.Level=3 then
    BEGIN
     PopupMenu1.Items[0].VISIBLE:=FALSE;
     FNDTABLE(dbname);
     if copy(dbname,1,2)='WD' then
      BEGIN
       PopupMenu1.Items[1].VISIBLE:=TRUE;
       PopupMenu1.Items[1].Caption:='Remove The WELL DESIGN';
       PopupMenu1.Items[2].VISIBLE:=TRUE;
       PopupMenu1.Items[3].VISIBLE:=FALSE;
      END
     ELSE if copy(dbname,1,2)='SE' then
      BEGIN
       PopupMenu1.Items[1].VISIBLE:=TRUE;
       PopupMenu1.Items[1].Caption:='Remove The SURVEY EDITOR';
       PopupMenu1.Items[2].VISIBLE:=FALSE;
       PopupMenu1.Items[3].VISIBLE:=TRUE;
       PopupMenu1.Items[3].Caption:='Well Report';
       PopupMenu1.Items[3].ImageIndex:=2;
      END
    END;
  end;
end;

end.

