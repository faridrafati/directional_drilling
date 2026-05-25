object Form09: TForm09
  Left = 0
  Top = 0
  Caption = 'Form09'
  ClientHeight = 123
  ClientWidth = 326
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
  object Label1: TLabel
    Left = 155
    Top = 24
    Width = 117
    Height = 13
    Caption = 'Please Select New Name'
  end
  object edit1: TEdit
    Left = 155
    Top = 43
    Width = 163
    Height = 21
    TabOrder = 0
  end
  object Button1: TButton
    Left = 155
    Top = 73
    Width = 75
    Height = 25
    Caption = 'Ok'
    TabOrder = 1
    OnClick = Button1Click
  end
  object Button2: TButton
    Left = 243
    Top = 73
    Width = 75
    Height = 25
    Caption = 'Cancel'
    TabOrder = 2
    OnClick = Button2Click
  end
  object RadioGroup1: TRadioGroup
    Left = 1
    Top = 8
    Width = 148
    Height = 105
    Caption = 'Calc Group:'
    Items.Strings = (
      'Well Design'
      'Survey Editor')
    TabOrder = 3
  end
end
