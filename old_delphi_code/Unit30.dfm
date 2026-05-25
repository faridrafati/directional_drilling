object Form30: TForm30
  Left = 487
  Top = 230
  Caption = 'Volume Calculations'
  ClientHeight = 167
  ClientWidth = 260
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
  object Label3: TLabel
    Left = 6
    Top = 126
    Width = 81
    Height = 13
    Caption = 'Volume of Shape'
  end
  object Edit3: TEdit
    Left = 6
    Top = 144
    Width = 259
    Height = 21
    TabOrder = 0
    Text = '0'
  end
  object RadioGroup1: TRadioGroup
    Left = 100
    Top = 9
    Width = 165
    Height = 115
    Caption = 'Volume Calculations'
    Items.Strings = (
      'Block Method'
      'Trapozoidal method'
      'Simpson 1/3'
      'SP Volume(New)')
    TabOrder = 1
    OnClick = RadioGroup1Click
  end
  object ListBox1: TListBox
    Left = 4
    Top = 14
    Width = 87
    Height = 109
    Ctl3D = False
    ItemHeight = 13
    Items.Strings = (
      'Meters'
      'Kilo Meters'
      'Feet'
      'Yards'
      'Miles'
      'Nautical miles'
      'Barrel'
      'Gallon')
    ParentCtl3D = False
    TabOrder = 2
    OnClick = RadioGroup1Click
  end
end
