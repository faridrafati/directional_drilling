object Form10: TForm10
  Left = 0
  Top = 0
  Width = 434
  Height = 429
  Caption = 'Merge Channels'
  Color = clBtnFace
  Font.Charset = DEFAULT_CHARSET
  Font.Color = clWindowText
  Font.Height = -11
  Font.Name = 'Tahoma'
  Font.Style = []
  OldCreateOrder = False
  PixelsPerInch = 96
  TextHeight = 13
  object Label1: TLabel
    Left = 8
    Top = 8
    Width = 164
    Height = 13
    Caption = 'Enter High Resolution Channel File'
  end
  object Label2: TLabel
    Left = 8
    Top = 72
    Width = 162
    Height = 13
    Caption = 'Enter Low Resolution Channel File'
  end
  object Label3: TLabel
    Left = 8
    Top = 136
    Width = 92
    Height = 13
    Caption = 'Output Merged File'
  end
  object Button1: TButton
    Left = 320
    Top = 48
    Width = 97
    Height = 25
    Caption = 'Browse ...'
    TabOrder = 0
    OnClick = Button1Click
  end
  object Button2: TButton
    Left = 320
    Top = 112
    Width = 97
    Height = 25
    Caption = 'Browse ...'
    TabOrder = 1
    OnClick = Button2Click
  end
  object Edit1: TEdit
    Left = 8
    Top = 24
    Width = 409
    Height = 21
    TabOrder = 2
  end
  object Edit2: TEdit
    Left = 8
    Top = 88
    Width = 409
    Height = 21
    TabOrder = 3
  end
  object ProgressBar1: TProgressBar
    Left = 8
    Top = 216
    Width = 409
    Height = 17
    TabOrder = 4
  end
  object Button3: TButton
    Left = 8
    Top = 240
    Width = 409
    Height = 33
    Caption = ' M E R G E    F I L E S . . .'
    TabOrder = 5
    OnClick = Button3Click
  end
  object Edit3: TEdit
    Left = 8
    Top = 152
    Width = 409
    Height = 21
    TabOrder = 6
  end
  object Button4: TButton
    Left = 320
    Top = 176
    Width = 97
    Height = 25
    Caption = 'Browse ...'
    TabOrder = 7
    OnClick = Button4Click
  end
  object Memo1: TMemo
    Left = 8
    Top = 280
    Width = 409
    Height = 105
    TabOrder = 8
  end
  object OpenDialog1: TOpenDialog
    Filter = 'LAS files (*.las)|*.las|All files (*.*)|*.*'
    Left = 360
    Top = 65528
  end
  object OpenDialog2: TOpenDialog
    Filter = 'LAS files (*.las)|*.las|All files (*.*)|*.*'
    Left = 392
    Top = 65528
  end
  object SaveDialog1: TSaveDialog
    DefaultExt = 'gml'
    FileName = 'default'
    Filter = 'GEOMANCY Adapted Merged LAS files (*.gml)|*.gml'
    Left = 328
    Top = 65528
  end
end
