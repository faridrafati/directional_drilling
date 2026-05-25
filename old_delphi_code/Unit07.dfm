object Form07: TForm07
  Left = 0
  Top = 0
  Caption = 'Form07'
  ClientHeight = 167
  ClientWidth = 369
  Color = clWindow
  Ctl3D = False
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
    Top = 9
    Width = 353
    Height = 113
    Ctl3D = False
    ParentCtl3D = False
    TabOrder = 0
    object label2: TLabel
      Left = 217
      Top = 83
      Width = 19
      Height = 13
      Caption = 'Deg'
      Visible = False
    end
    object Label1: TLabel
      Left = 100
      Top = 83
      Width = 27
      Height = 13
      Caption = 'Angle'
      Visible = False
    end
    object Memo1: TMemo
      Left = 3
      Top = 3
      Width = 342
      Height = 41
      Ctl3D = False
      Lines.Strings = (
        
          'Compute two values for Azimuth, Select the value you want to use' +
          ':')
      ParentCtl3D = False
      ReadOnly = True
      TabOrder = 0
    end
    object Edit1: TEdit
      Left = 136
      Top = 81
      Width = 75
      Height = 19
      TabOrder = 1
      Text = '0'
      Visible = False
    end
  end
  object Button1: TButton
    Left = 135
    Top = 128
    Width = 84
    Height = 31
    Caption = 'OK'
    TabOrder = 1
    OnClick = Button1Click
  end
  object RadioButton1: TRadioButton
    Left = 137
    Top = 59
    Width = 113
    Height = 17
    Caption = 'RadioButton1'
    Checked = True
    TabOrder = 2
    TabStop = True
  end
  object RadioButton2: TRadioButton
    Left = 137
    Top = 91
    Width = 113
    Height = 17
    Caption = 'RadioButton2'
    TabOrder = 3
  end
  object ListBox1: TListBox
    Left = 10
    Top = 59
    Width = 121
    Height = 50
    ItemHeight = 13
    TabOrder = 4
    Visible = False
    OnClick = ListBox1Click
  end
end
