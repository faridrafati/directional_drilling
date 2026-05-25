object Form41: TForm41
  Left = 0
  Top = 0
  Caption = 'Air & Gas Drilling'
  ClientHeight = 441
  ClientWidth = 671
  Color = clBtnFace
  Font.Charset = DEFAULT_CHARSET
  Font.Color = clWindowText
  Font.Height = -11
  Font.Name = 'Tahoma'
  Font.Style = []
  Menu = MainMenu1
  OldCreateOrder = False
  OnCreate = FormCreate
  PixelsPerInch = 96
  TextHeight = 13
  object PageControl1: TPageControl
    Left = 0
    Top = 0
    Width = 671
    Height = 441
    ActivePage = TabSheet1
    Align = alClient
    TabOrder = 0
    object TabSheet1: TTabSheet
      Caption = 'CASING RUNNING'
      object DBGrid1: TDBGrid
        Left = 0
        Top = 57
        Width = 663
        Height = 356
        Align = alClient
        TabOrder = 0
        TitleFont.Charset = DEFAULT_CHARSET
        TitleFont.Color = clWindowText
        TitleFont.Height = -11
        TitleFont.Name = 'Tahoma'
        TitleFont.Style = []
      end
      object Panel4: TPanel
        Left = 0
        Top = 0
        Width = 663
        Height = 57
        Align = alTop
        TabOrder = 1
      end
    end
    object TabSheet2: TTabSheet
      Caption = 'BHA IN HOLE'
      ImageIndex = 1
      object Panel2: TPanel
        Left = 0
        Top = 0
        Width = 663
        Height = 57
        Align = alTop
        TabOrder = 0
      end
      object Panel3: TPanel
        Left = 0
        Top = 320
        Width = 663
        Height = 93
        Align = alBottom
        TabOrder = 1
      end
      object DBGrid2: TDBGrid
        Left = 0
        Top = 57
        Width = 663
        Height = 263
        Align = alClient
        TabOrder = 2
        TitleFont.Charset = DEFAULT_CHARSET
        TitleFont.Color = clWindowText
        TitleFont.Height = -11
        TitleFont.Name = 'Tahoma'
        TitleFont.Style = []
      end
    end
    object TabSheet3: TTabSheet
      Caption = 'CIRCULATED MUD'
      ImageIndex = 2
      object Panel1: TPanel
        Left = 0
        Top = 0
        Width = 663
        Height = 57
        Align = alTop
        TabOrder = 0
      end
      object DBGrid3: TDBGrid
        Left = 0
        Top = 57
        Width = 663
        Height = 263
        Align = alClient
        TabOrder = 1
        TitleFont.Charset = DEFAULT_CHARSET
        TitleFont.Color = clWindowText
        TitleFont.Height = -11
        TitleFont.Name = 'Tahoma'
        TitleFont.Style = []
      end
      object Panel5: TPanel
        Left = 0
        Top = 320
        Width = 663
        Height = 93
        Align = alBottom
        TabOrder = 2
      end
    end
    object TabSheet4: TTabSheet
      Caption = 'BIT AND DHM'
      ImageIndex = 3
      object Panel6: TPanel
        Left = 0
        Top = 0
        Width = 663
        Height = 57
        Align = alTop
        TabOrder = 0
      end
      object DBGrid4: TDBGrid
        Left = 0
        Top = 57
        Width = 663
        Height = 263
        Align = alClient
        TabOrder = 1
        TitleFont.Charset = DEFAULT_CHARSET
        TitleFont.Color = clWindowText
        TitleFont.Height = -11
        TitleFont.Name = 'Tahoma'
        TitleFont.Style = []
      end
      object Panel7: TPanel
        Left = 0
        Top = 320
        Width = 663
        Height = 93
        Align = alBottom
        TabOrder = 2
      end
    end
  end
  object MainMenu1: TMainMenu
    Left = 624
    Top = 8
    object File1: TMenuItem
      Caption = 'File'
      object New1: TMenuItem
        Caption = 'New'
      end
      object Save1: TMenuItem
        Caption = 'Save'
      end
      object Saveas1: TMenuItem
        Caption = 'Save as'
      end
      object Open1: TMenuItem
        Caption = 'Open'
      end
      object Exit1: TMenuItem
        Caption = 'Exit'
        OnClick = Exit1Click
      end
    end
    object Options1: TMenuItem
      Caption = 'Options'
      object Units1: TMenuItem
        Caption = 'Units'
        OnClick = Units1Click
      end
    end
  end
  object DataSource1: TDataSource
    DataSet = ADOTable1
    Left = 624
    Top = 160
  end
  object ADOConnection1: TADOConnection
    Mode = cmShareDenyNone
    Provider = 'Microsoft.Jet.OLEDB.4.0'
    Left = 624
    Top = 208
  end
  object ADOTable1: TADOTable
    Connection = ADOConnection1
    CursorType = ctStatic
    TableName = 'Bit_Size'
    Left = 624
    Top = 112
  end
  object ADOTable2: TADOTable
    Left = 624
    Top = 272
  end
  object DataSource2: TDataSource
    Left = 624
    Top = 328
  end
end
