object Form43: TForm43
  Left = 0
  Top = 0
  Caption = 'Form43'
  ClientHeight = 165
  ClientWidth = 356
  Color = clBtnFace
  Font.Charset = DEFAULT_CHARSET
  Font.Color = clWindowText
  Font.Height = -11
  Font.Name = 'Tahoma'
  Font.Style = []
  OldCreateOrder = False
  OnCreate = FormCreate
  PixelsPerInch = 96
  TextHeight = 13
  object Panel2: TPanel
    Left = 135
    Top = 8
    Width = 212
    Height = 148
    Ctl3D = False
    ParentCtl3D = False
    TabOrder = 2
    object Label1: TLabel
      Left = 24
      Top = 46
      Width = 94
      Height = 13
      Caption = 'TOTAL FLOW AREA'
    end
    object Label2: TLabel
      Left = 167
      Top = 67
      Width = 9
      Height = 13
      Caption = ' 2'
    end
    object Edit1: TEdit
      Left = 24
      Top = 65
      Width = 140
      Height = 19
      TabOrder = 0
      Text = '0'
    end
  end
  object Panel1: TPanel
    Left = 136
    Top = 8
    Width = 212
    Height = 148
    Ctl3D = False
    ParentCtl3D = False
    TabOrder = 1
    object StringGrid1: TStringGrid
      Left = 7
      Top = 9
      Width = 196
      Height = 126
      ColCount = 3
      Ctl3D = False
      FixedCols = 0
      FixedRows = 0
      Options = [goFixedVertLine, goFixedHorzLine, goVertLine, goHorzLine, goRangeSelect, goEditing, goTabs]
      ParentCtl3D = False
      TabOrder = 0
    end
  end
  object RadioGroup1: TRadioGroup
    Left = 8
    Top = 1
    Width = 121
    Height = 105
    Caption = 'Nozzle Area'
    Ctl3D = False
    ItemIndex = 0
    Items.Strings = (
      'FIXED NOZZLES'
      'FIXED T.F.A.')
    ParentCtl3D = False
    TabOrder = 0
    OnClick = RadioGroup1Click
  end
  object Button1: TButton
    Left = 8
    Top = 112
    Width = 121
    Height = 44
    Caption = 'APPLY'
    TabOrder = 3
    OnClick = Button1Click
  end
  object FXDNZL: TADOTable
    Connection = Form41.ADOConnection1
    TableName = 'FIXEDNOZZLES'
    Left = 240
    Top = 24
  end
end
