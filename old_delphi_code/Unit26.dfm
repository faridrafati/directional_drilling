object Form26: TForm26
  Left = 216
  Top = 342
  Caption = 'Form26'
  ClientHeight = 253
  ClientWidth = 399
  Color = clBtnFace
  Font.Charset = DEFAULT_CHARSET
  Font.Color = clWindowText
  Font.Height = -11
  Font.Name = 'MS Sans Serif'
  Font.Style = []
  OldCreateOrder = False
  OnCreate = FormCreate
  OnShow = FormShow
  PixelsPerInch = 96
  TextHeight = 13
  object Edit1: TEdit
    Left = 136
    Top = 12
    Width = 121
    Height = 21
    TabOrder = 0
    Text = '0'
  end
  object Edit2: TEdit
    Left = 136
    Top = 36
    Width = 121
    Height = 21
    TabOrder = 1
    Text = '0'
  end
  object Edit3: TEdit
    Left = 136
    Top = 60
    Width = 121
    Height = 21
    TabOrder = 2
    Text = '0'
  end
  object Edit6: TEdit
    Left = 151
    Top = 198
    Width = 58
    Height = 21
    TabOrder = 3
    Text = '12'
    Visible = False
  end
  object Button1: TButton
    Left = 224
    Top = 223
    Width = 75
    Height = 25
    Caption = 'Ok'
    TabOrder = 4
    OnClick = Button1Click
  end
  object GroupBox1: TGroupBox
    Left = 8
    Top = 86
    Width = 249
    Height = 99
    Caption = 'XYZ Fractions'
    TabOrder = 5
    object Label3: TLabel
      Left = 9
      Top = 69
      Width = 106
      Height = 13
      Caption = 'Z fraction From Reality'
    end
    object Label1: TLabel
      Left = 9
      Top = 45
      Width = 106
      Height = 13
      Caption = 'Y fraction From Reality'
    end
    object Label2: TLabel
      Left = 9
      Top = 21
      Width = 106
      Height = 13
      Caption = 'X fraction From Reality'
    end
    object Edit10: TEdit
      Left = 125
      Top = 17
      Width = 116
      Height = 21
      TabOrder = 0
      Text = '1'
    end
    object Edit11: TEdit
      Left = 125
      Top = 41
      Width = 116
      Height = 21
      TabOrder = 1
      Text = '1'
    end
    object Edit12: TEdit
      Left = 125
      Top = 65
      Width = 116
      Height = 21
      TabOrder = 2
      Text = '1'
    end
  end
  object Edit4: TEdit
    Left = 264
    Top = 12
    Width = 121
    Height = 21
    TabOrder = 6
    Text = '0'
  end
  object Edit5: TEdit
    Left = 264
    Top = 36
    Width = 121
    Height = 21
    TabOrder = 7
    Text = '0'
  end
  object Edit13: TEdit
    Left = 264
    Top = 60
    Width = 121
    Height = 21
    TabOrder = 8
    Text = '0'
  end
  object CheckBox1: TCheckBox
    Left = 16
    Top = 200
    Width = 97
    Height = 17
    Caption = 'Auto Sizing'
    TabOrder = 9
    OnClick = CheckBox1Click
  end
  object Edit14: TEdit
    Left = 264
    Top = 103
    Width = 121
    Height = 21
    TabOrder = 10
    Text = '62000'
  end
  object StringGrid1: TStringGrid
    Left = 264
    Top = 128
    Width = 125
    Height = 53
    ColCount = 2
    DefaultColWidth = 60
    RowCount = 2
    FixedRows = 0
    Options = [goFixedVertLine, goFixedHorzLine, goVertLine, goHorzLine, goRangeSelect, goEditing]
    TabOrder = 11
    RowHeights = (
      24
      24)
  end
  object Edit8: TEdit
    Left = 8
    Top = 36
    Width = 121
    Height = 21
    TabOrder = 12
    Text = '12'
  end
  object Edit7: TEdit
    Left = 8
    Top = 12
    Width = 121
    Height = 21
    TabOrder = 13
    Text = '32'
  end
  object CheckBox2: TCheckBox
    Left = 17
    Top = 223
    Width = 97
    Height = 17
    Caption = 'Show Contour'
    TabOrder = 14
  end
  object Edit9: TEdit
    Left = 264
    Top = 196
    Width = 121
    Height = 21
    TabOrder = 15
    Text = '10'
  end
end
