object Form22: TForm22
  Left = 320
  Top = 300
  Caption = 'Form22'
  ClientHeight = 256
  ClientWidth = 455
  Color = clBtnFace
  Font.Charset = DEFAULT_CHARSET
  Font.Color = clWindowText
  Font.Height = -11
  Font.Name = 'MS Sans Serif'
  Font.Style = []
  OldCreateOrder = False
  Position = poDesigned
  OnCreate = FormCreate
  PixelsPerInch = 96
  TextHeight = 13
  object Button1: TButton
    Left = 186
    Top = 216
    Width = 75
    Height = 25
    Caption = 'Ok'
    TabOrder = 0
    OnClick = Button1Click
  end
  object GroupBox3: TGroupBox
    Left = 9
    Top = 8
    Width = 440
    Height = 98
    TabOrder = 1
    object Image1: TImage
      Left = 268
      Top = 10
      Width = 160
      Height = 81
    end
    object RadioGroup1: TRadioGroup
      Left = 153
      Top = 10
      Width = 113
      Height = 81
      ItemIndex = 0
      Items.Strings = (
        'Rain Bow Colors'
        'Fire Colors'
        'Color Gradient')
      TabOrder = 0
      OnClick = RadioGroup1Click
    end
    object StringGrid1: TStringGrid
      Left = 5
      Top = 10
      Width = 145
      Height = 77
      ColCount = 2
      DefaultColWidth = 78
      DefaultRowHeight = 17
      RowCount = 4
      FixedRows = 0
      Options = [goFixedVertLine, goFixedHorzLine, goVertLine, goHorzLine, goRangeSelect, goEditing]
      TabOrder = 1
      RowHeights = (
        17
        17
        17
        17)
    end
  end
  object GroupBox2: TGroupBox
    Left = 8
    Top = 112
    Width = 440
    Height = 98
    TabOrder = 2
    object Label1: TLabel
      Left = 202
      Top = 50
      Width = 42
      Height = 13
      Caption = 'XRS No.'
    end
    object Label2: TLabel
      Left = 273
      Top = 50
      Width = 42
      Height = 13
      Caption = 'YRS No.'
    end
    object GroupBox4: TGroupBox
      Left = 200
      Top = 3
      Width = 135
      Height = 44
      Caption = 'Data Type'
      TabOrder = 0
      object ComboBox1: TComboBox
        Left = 3
        Top = 20
        Width = 121
        Height = 21
        ItemIndex = 0
        TabOrder = 0
        Text = 'Depth'
        Items.Strings = (
          'Depth'
          'Thickness'
          'Total Volume'
          'Oil Volume'
          'Water Volume'
          'Gas Volume')
      end
    end
    object ListBox1: TListBox
      Left = 341
      Top = 7
      Width = 87
      Height = 84
      Ctl3D = False
      ItemHeight = 13
      Items.Strings = (
        'Meters'
        'Kilo Meters'
        'Feet'
        'Yards'
        'Miles'
        'Nautical miles')
      ParentCtl3D = False
      TabOrder = 1
    end
    object CheckListBox1: TCheckListBox
      Left = 5
      Top = 7
      Width = 191
      Height = 79
      Ctl3D = False
      ItemHeight = 13
      Items.Strings = (
        '1'
        '2'
        '3')
      ParentCtl3D = False
      ParentShowHint = False
      ShowHint = True
      TabOrder = 2
      OnClick = CheckListBox1Click
    end
    object Edit1: TEdit
      Left = 202
      Top = 64
      Width = 64
      Height = 21
      TabOrder = 3
      Text = '6'
    end
    object Edit2: TEdit
      Left = 272
      Top = 64
      Width = 63
      Height = 21
      TabOrder = 4
      Text = '6'
    end
  end
  object ColorDialog1: TColorDialog
    Ctl3D = False
    CustomColors.Strings = (
      '2')
    Left = 264
    Top = 216
  end
end
