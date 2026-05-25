object Form04: TForm04
  Left = 0
  Top = 0
  Caption = 'Form04'
  ClientHeight = 336
  ClientWidth = 492
  Color = clBtnFace
  Font.Charset = DEFAULT_CHARSET
  Font.Color = clWindowText
  Font.Height = -11
  Font.Name = 'Tahoma'
  Font.Style = []
  OldCreateOrder = False
  PixelsPerInch = 96
  TextHeight = 13
  object Button1: TButton
    Left = 345
    Top = 292
    Width = 71
    Height = 37
    Caption = 'OK'
    TabOrder = 0
    OnClick = Button1Click
  end
  object Button2: TButton
    Left = 417
    Top = 292
    Width = 71
    Height = 37
    Caption = 'CANCEL'
    TabOrder = 1
    OnClick = Button2Click
  end
  object GroupBox1: TGroupBox
    Left = 8
    Top = 288
    Width = 335
    Height = 41
    Caption = 'S-2D or S-3D (Hold Before Target) '
    TabOrder = 2
    object CheckBox1: TCheckBox
      Left = 7
      Top = 16
      Width = 145
      Height = 17
      Caption = 'End Curve Before Target'
      Enabled = False
      TabOrder = 0
      OnClick = CheckBox1Click
    end
  end
  object RadioGroup2: TRadioGroup
    Left = 200
    Top = 288
    Width = 143
    Height = 41
    Caption = 'S-2D Given Data'
    Columns = 2
    Ctl3D = False
    Enabled = False
    Font.Charset = DEFAULT_CHARSET
    Font.Color = clWindowText
    Font.Height = -11
    Font.Name = 'Tahoma'
    Font.Style = []
    ItemIndex = 0
    Items.Strings = (
      'Theta'
      'D MD')
    ParentCtl3D = False
    ParentFont = False
    TabOrder = 3
  end
  object RadioGroup1: TRadioGroup
    Left = 8
    Top = 8
    Width = 465
    Height = 278
    Caption = 'Standard Profiles'
    Color = clWhite
    Ctl3D = False
    ItemIndex = 0
    Items.Strings = (
      'HOLD CURVE (3D) TO FIXED TARGET (COMPUTE KOP & DLS)'
      'CURVE HOLD (3D) FROM  FIXED KOP (COMPUTE EOC & DLS)'
      'HOLD CURVE HOLD (3D) (GIVEN DLS, COMPUTE KOP)'
      'CURVE HOLD (3D) (GIVEN DLS)'
      'CURVE HOLD CURVE (2.5D)'
      'CURVE HOLD CURVE (3D) (Under Construction :D)'
      'HOLD OR CURVE TO TARGET (3D)'
      'CURVE CURVE (2.5D)')
    ParentBackground = False
    ParentColor = False
    ParentCtl3D = False
    TabOrder = 4
    OnClick = RadioGroup1Click
  end
  object GroupBox2: TGroupBox
    Left = 343
    Top = 8
    Width = 143
    Height = 278
    Caption = 'Inclination OR Azimuth'
    Ctl3D = False
    ParentCtl3D = False
    TabOrder = 5
    object CheckBox2: TCheckBox
      Left = 11
      Top = 24
      Width = 97
      Height = 17
      Caption = 'Inclination'
      TabOrder = 0
      OnClick = CheckBox4Click
    end
    object CheckBox3: TCheckBox
      Left = 11
      Top = 55
      Width = 97
      Height = 17
      Caption = 'Inclination'
      TabOrder = 1
      OnClick = CheckBox4Click
    end
    object CheckBox4: TCheckBox
      Left = 11
      Top = 89
      Width = 97
      Height = 17
      Caption = 'Inclination'
      TabOrder = 2
      OnClick = CheckBox4Click
    end
    object CheckBox5: TCheckBox
      Left = 11
      Top = 122
      Width = 97
      Height = 17
      Caption = 'Inclination'
      TabOrder = 3
      OnClick = CheckBox4Click
    end
  end
  object CheckBox6: TCheckBox
    Left = 354
    Top = 162
    Width = 97
    Height = 17
    Caption = 'Inclination'
    TabOrder = 6
    OnClick = CheckBox4Click
  end
  object CheckBox7: TCheckBox
    Left = 354
    Top = 195
    Width = 97
    Height = 17
    Caption = 'Inclination'
    TabOrder = 7
    OnClick = CheckBox4Click
  end
  object CheckBox8: TCheckBox
    Left = 354
    Top = 227
    Width = 97
    Height = 17
    Caption = 'Inclination'
    TabOrder = 8
    OnClick = CheckBox4Click
  end
  object CheckBox9: TCheckBox
    Left = 354
    Top = 258
    Width = 97
    Height = 17
    Caption = 'Inclination'
    TabOrder = 9
    OnClick = CheckBox4Click
  end
end
