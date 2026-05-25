object Form32: TForm32
  Left = 284
  Top = 0
  Caption = 'Form32'
  ClientHeight = 662
  ClientWidth = 449
  Color = clBtnFace
  Font.Charset = DEFAULT_CHARSET
  Font.Color = clWindowText
  Font.Height = -11
  Font.Name = 'MS Sans Serif'
  Font.Style = []
  Menu = MainMenu1
  OldCreateOrder = False
  PixelsPerInch = 96
  TextHeight = 13
  object Image1: TImage
    Left = 8
    Top = 3
    Width = 434
    Height = 614
  end
  object Image2: TImage
    Left = 8
    Top = 3
    Width = 105
    Height = 105
  end
  object Image3: TImage
    Left = 64
    Top = 280
    Width = 105
    Height = 105
    Visible = False
  end
  object RadioGroup1: TRadioGroup
    Left = 16
    Top = 624
    Width = 265
    Height = 33
    Caption = 'Size '
    Columns = 2
    ItemIndex = 0
    Items.Strings = (
      'Actual Size'
      'A 4~3 Size')
    TabOrder = 0
    OnClick = RadioGroup1Click
  end
  object CheckBox1: TCheckBox
    Left = 296
    Top = 632
    Width = 97
    Height = 17
    Caption = 'Landscape'
    TabOrder = 1
    OnClick = CheckBox1Click
  end
  object MainMenu1: TMainMenu
    Left = 152
    Top = 152
    object SaveasBitmap1: TMenuItem
      Caption = 'Save as Bitmap'
      OnClick = SaveasBitmap1Click
    end
  end
  object SaveDialog1: TSaveDialog
    DefaultExt = '.BMP'
    Filter = '*.BMP|*.BMP'
    Left = 184
    Top = 224
  end
end
