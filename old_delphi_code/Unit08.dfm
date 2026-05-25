object Form08: TForm08
  Left = 0
  Top = 0
  Caption = 'Form08'
  ClientHeight = 144
  ClientWidth = 301
  Color = clBtnFace
  Font.Charset = DEFAULT_CHARSET
  Font.Color = clWindowText
  Font.Height = -11
  Font.Name = 'Tahoma'
  Font.Style = []
  OldCreateOrder = False
  PixelsPerInch = 96
  TextHeight = 13
  object GroupBox1: TGroupBox
    Left = 8
    Top = 8
    Width = 281
    Height = 97
    Caption = 'Select Item that must be Calculated:'
    TabOrder = 0
    object RadioButton1: TRadioButton
      Left = 18
      Top = 23
      Width = 113
      Height = 17
      Caption = 'RadioButton1'
      Checked = True
      TabOrder = 0
      TabStop = True
    end
    object RadioButton2: TRadioButton
      Left = 18
      Top = 46
      Width = 113
      Height = 17
      Caption = 'RadioButton2'
      TabOrder = 1
    end
    object RadioButton3: TRadioButton
      Left = 18
      Top = 69
      Width = 113
      Height = 17
      Caption = 'RadioButton3'
      TabOrder = 2
    end
  end
  object Button1: TButton
    Left = 120
    Top = 111
    Width = 75
    Height = 25
    Caption = 'OK'
    TabOrder = 1
    OnClick = Button1Click
  end
end
