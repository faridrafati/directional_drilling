object Form05: TForm05
  Left = 411
  Top = 250
  Caption = 'Form05'
  ClientHeight = 157
  ClientWidth = 169
  Color = clBtnFace
  Font.Charset = DEFAULT_CHARSET
  Font.Color = clWindowText
  Font.Height = -11
  Font.Name = 'Tahoma'
  Font.Style = []
  OldCreateOrder = False
  Position = poDesigned
  PixelsPerInch = 96
  TextHeight = 13
  object RadioGroup1: TRadioGroup
    Left = 8
    Top = 8
    Width = 154
    Height = 105
    Caption = 'Hold To:'
    ItemIndex = 0
    Items.Strings = (
      'MD'
      'TVD'
      'Delta MD')
    TabOrder = 0
  end
  object Button1: TButton
    Left = 8
    Top = 124
    Width = 75
    Height = 25
    Caption = 'OK'
    TabOrder = 1
    OnClick = Button1Click
  end
  object Button2: TButton
    Left = 87
    Top = 124
    Width = 75
    Height = 25
    Caption = 'Cancel'
    TabOrder = 2
    OnClick = Button2Click
  end
end
