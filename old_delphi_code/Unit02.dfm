object Form02: TForm02
  Left = 0
  Top = 100
  Caption = 'Form02'
  ClientHeight = 682
  ClientWidth = 1216
  Color = clBtnFace
  Font.Charset = DEFAULT_CHARSET
  Font.Color = clWindowText
  Font.Height = -11
  Font.Name = 'Tahoma'
  Font.Style = []
  Menu = MainMenu1
  OldCreateOrder = False
  Position = poDesigned
  OnShow = FormShow
  PixelsPerInch = 96
  TextHeight = 13
  object Splitter1: TSplitter
    Left = 0
    Top = 65
    Width = 4
    Height = 617
    ExplicitLeft = 185
  end
  object Panel1: TPanel
    Left = 0
    Top = 0
    Width = 1216
    Height = 65
    Align = alTop
    Ctl3D = False
    ParentCtl3D = False
    TabOrder = 0
    object Button1: TButton
      Left = 87
      Top = 14
      Width = 74
      Height = 38
      Caption = 'REPORTING'
      TabOrder = 0
      OnClick = Button1Click
    end
    object Button3: TButton
      Left = 16
      Top = 14
      Width = 65
      Height = 38
      Caption = 'CALCULATE'
      TabOrder = 1
      OnClick = Button3Click
    end
    object Button5: TButton
      Left = 175
      Top = 14
      Width = 74
      Height = 38
      Caption = 'DELETE'
      TabOrder = 2
      OnClick = Button5Click
    end
    object ListBox1: TListBox
      Left = 331
      Top = 5
      Width = 198
      Height = 56
      ItemHeight = 13
      TabOrder = 3
      OnDblClick = ListBox1DblClick
    end
  end
  object Panel2: TPanel
    Left = 4
    Top = 65
    Width = 1212
    Height = 617
    Align = alClient
    TabOrder = 1
    object Splitter2: TSplitter
      Left = 1
      Top = 425
      Width = 1210
      Height = 4
      Cursor = crVSplit
      Align = alTop
      ExplicitWidth = 903
    end
    object DBGrid1: TDBGrid
      Left = 1
      Top = 429
      Width = 1210
      Height = 187
      Align = alClient
      BiDiMode = bdLeftToRight
      Ctl3D = False
      DataSource = DataSource1
      Options = [dgEditing, dgTitles, dgIndicator, dgColLines, dgRowLines, dgTabs, dgConfirmDelete, dgCancelOnExit, dgMultiSelect]
      ParentBiDiMode = False
      ParentCtl3D = False
      TabOrder = 0
      TitleFont.Charset = DEFAULT_CHARSET
      TitleFont.Color = clWindowText
      TitleFont.Height = -11
      TitleFont.Name = 'Tahoma'
      TitleFont.Style = []
    end
    object DBGrid2: TDBGrid
      Left = 1
      Top = 1
      Width = 1210
      Height = 424
      Align = alTop
      DataSource = DataSource2
      TabOrder = 1
      TitleFont.Charset = DEFAULT_CHARSET
      TitleFont.Color = clWindowText
      TitleFont.Height = -11
      TitleFont.Name = 'Tahoma'
      TitleFont.Style = []
      OnCellClick = DBGrid2CtypeellClick
      OnDrawColumnCell = DBGrid2DrawColumnCell
    end
  end
  object OpenDialog1: TOpenDialog
    Left = 136
    Top = 64
  end
  object DataSource1: TDataSource
    DataSet = ADOTable1
    Left = 16
    Top = 64
  end
  object DataSource2: TDataSource
    DataSet = ADOTable2
    Left = 16
    Top = 112
  end
  object MainMenu1: TMainMenu
    Left = 136
    Top = 112
    object ACTIONS1: TMenuItem
      Caption = 'ACTIONS...'
      object NEW1: TMenuItem
        Caption = 'NEW'
        OnClick = NEW1Click
      end
      object Calculate1: TMenuItem
        Caption = 'Calculate'
        OnClick = Calculate1Click
      end
      object N3DView1: TMenuItem
        Caption = '3D-View'
        OnClick = N3DView1Click
      end
      object delete1: TMenuItem
        Caption = 'delete'
        OnClick = delete1Click
      end
      object Save1: TMenuItem
        Caption = 'Save'
        OnClick = Save1Click
      end
      object Exit1: TMenuItem
        Caption = 'Exit'
        OnClick = Exit1Click
      end
    end
    object ADD1: TMenuItem
      Caption = 'ADD'
      OnClick = ADD1Click
      object Hold1: TMenuItem
        Caption = 'Hold...'
        OnClick = Hold1Click
      end
      object Curve1: TMenuItem
        Caption = 'Curve...'
        OnClick = Curve1Click
      end
      object SurveyStation1: TMenuItem
        Caption = 'Survey Station'
        OnClick = SurveyStation1Click
      end
      object PlanningTargets1: TMenuItem
        Caption = 'Planning Targets'
        OnClick = PlanningTargets1Click
      end
      object STANDARDPROFILES1: TMenuItem
        Caption = 'Standard Profiles'
        GroupIndex = 1
        OnClick = STANDARDPROFILES1Click
      end
    end
  end
  object ADOTable1: TADOTable
    Connection = Form01.ADOConnection1
    CursorLocation = clUseServer
    Left = 72
    Top = 64
  end
  object ADOTable2: TADOTable
    Connection = Form01.ADOConnection1
    CursorLocation = clUseServer
    Left = 80
    Top = 112
  end
end
