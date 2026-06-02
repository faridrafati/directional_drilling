object Form42: TForm42
  Left = 0
  Top = 0
  Caption = 'Form42'
  ClientHeight = 475
  ClientWidth = 584
  Color = clBtnFace
  Font.Charset = DEFAULT_CHARSET
  Font.Color = clWindowText
  Font.Height = -11
  Font.Name = 'Tahoma'
  Font.Style = []
  OldCreateOrder = False
  OnCreate = FormCreate
  OnShow = FormShow
  PixelsPerInch = 96
  TextHeight = 13
  object RadioGroup1: TRadioGroup
    Left = 8
    Top = 8
    Width = 567
    Height = 50
    BiDiMode = bdLeftToRight
    Columns = 5
    Ctl3D = True
    Font.Charset = DEFAULT_CHARSET
    Font.Color = clWindowText
    Font.Height = -13
    Font.Name = 'Tahoma'
    Font.Style = [fsBold]
    ItemIndex = 0
    Items.Strings = (
      'Iranian'
      'USA'
      'Canadaian'
      'Russian'
      'Custom Units ')
    ParentBiDiMode = False
    ParentCtl3D = False
    ParentFont = False
    TabOrder = 0
    OnClick = RadioGroup1Click
  end
  object RadioGroup2: TRadioGroup
    Left = 8
    Top = 64
    Width = 185
    Height = 73
    Caption = 'Depth/Length'
    ItemIndex = 0
    Items.Strings = (
      'Feet'
      'Meters')
    TabOrder = 1
    OnClick = RadioGroup3Click
  end
  object RadioGroup3: TRadioGroup
    Left = 8
    Top = 137
    Width = 185
    Height = 73
    Caption = 'Hole, Pipes and Pump Size'
    ItemIndex = 0
    Items.Strings = (
      'Inches'
      'mm')
    TabOrder = 2
    OnClick = RadioGroup3Click
  end
  object RadioGroup4: TRadioGroup
    Left = 8
    Top = 204
    Width = 185
    Height = 73
    Caption = 'Nozzle Size Units'
    ItemIndex = 0
    Items.Strings = (
      '32nd of Inches'
      'mm')
    TabOrder = 3
    OnClick = RadioGroup4Click
  end
  object RadioGroup5: TRadioGroup
    Left = 8
    Top = 283
    Width = 185
    Height = 140
    Caption = 'Pressure'
    ItemIndex = 0
    Items.Strings = (
      'PSI'
      'KPA'
      'ATM'
      'Bars'
      'Kg/cm2')
    TabOrder = 4
    OnClick = RadioGroup5Click
  end
  object RadioGroup6: TRadioGroup
    Left = 199
    Top = 64
    Width = 185
    Height = 213
    Caption = 'Mud Weight'
    ItemIndex = 0
    Items.Strings = (
      'PPG'
      'Kg/m3'
      'Sg'
      'KPa/m'
      'PSI/100 ft'
      'lbs/ft3'
      'g/cm3')
    TabOrder = 5
    OnClick = RadioGroup6Click
  end
  object RadioGroup7: TRadioGroup
    Left = 199
    Top = 283
    Width = 185
    Height = 86
    Caption = 'Viscosity'
    ItemIndex = 0
    Items.Strings = (
      'lbs/100 ft3'
      'Pa'
      'Kg/100m2')
    TabOrder = 6
    OnClick = RadioGroup7Click
  end
  object RadioGroup8: TRadioGroup
    Left = 390
    Top = 283
    Width = 185
    Height = 140
    Caption = 'Weight on Bit'
    ItemIndex = 0
    Items.Strings = (
      'lbs.'
      'daN'
      'Tonnes'
      'KN')
    TabOrder = 7
    OnClick = RadioGroup9Click
  end
  object RadioGroup9: TRadioGroup
    Left = 390
    Top = 64
    Width = 185
    Height = 213
    Caption = 'Flow Rate'
    ItemIndex = 0
    Items.Strings = (
      'GPM'
      'm3/min'
      'LPM'
      'LPS'
      'bbl/min'
      'ft3/min'
      'IMP GPM')
    TabOrder = 8
    OnClick = RadioGroup8Click
  end
  object Button1: TButton
    Left = 239
    Top = 434
    Width = 82
    Height = 35
    Caption = 'Done'
    TabOrder = 9
    OnClick = Button1Click
  end
  object RadioGroup10: TRadioGroup
    Left = 199
    Top = 375
    Width = 185
    Height = 48
    Caption = 'Temperature Gradient'
    Columns = 2
    ItemIndex = 0
    Items.Strings = (
      'DEG R'
      'DEG K')
    TabOrder = 10
  end
  object ADOTable1: TADOTable
    Connection = Form41.ADOConnection1
    Left = 288
    Top = 232
  end
end
