object Form23: TForm23
  Left = 157
  Top = 166
  Caption = 'Form23'
  ClientHeight = 354
  ClientWidth = 762
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
  object Image3: TImage
    Left = 432
    Top = 240
    Width = 105
    Height = 105
    Visible = False
  end
  object Image4: TImage
    Left = 352
    Top = 240
    Width = 105
    Height = 105
    Visible = False
  end
  object GroupBox2: TGroupBox
    Left = 424
    Top = 112
    Width = 329
    Height = 113
    TabOrder = 0
    object Label7: TLabel
      Left = 4
      Top = 28
      Width = 44
      Height = 13
      Caption = 'Font Size'
    end
    object ListBox1: TListBox
      Left = 224
      Top = 16
      Width = 97
      Height = 81
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
      TabOrder = 0
    end
    object StringGrid2: TStringGrid
      Left = 59
      Top = 31
      Width = 161
      Height = 55
      ColCount = 2
      DefaultColWidth = 79
      DefaultRowHeight = 25
      RowCount = 2
      FixedRows = 0
      Options = [goFixedVertLine, goFixedHorzLine, goVertLine, goHorzLine, goRangeSelect, goEditing]
      TabOrder = 1
      RowHeights = (
        24
        25)
    end
    object Edit8: TEdit
      Left = 4
      Top = 46
      Width = 51
      Height = 21
      ReadOnly = True
      TabOrder = 2
      Text = '8'
    end
    object UpDown5: TUpDown
      Left = 4
      Top = 71
      Width = 50
      Height = 18
      Min = 8
      Max = 20
      Orientation = udHorizontal
      Position = 8
      TabOrder = 3
      OnChanging = UpDown5Changing
    end
  end
  object GroupBox3: TGroupBox
    Left = 8
    Top = 7
    Width = 745
    Height = 103
    TabOrder = 1
    object Image1: TImage
      Left = 464
      Top = 16
      Width = 273
      Height = 79
    end
    object Label5: TLabel
      Left = 6
      Top = 22
      Width = 44
      Height = 13
      Caption = 'Font Size'
    end
    object RadioGroup1: TRadioGroup
      Left = 347
      Top = 13
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
      Left = 178
      Top = 17
      Width = 163
      Height = 76
      ColCount = 2
      DefaultColWidth = 80
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
    object RadioGroup2: TRadioGroup
      Left = 54
      Top = 13
      Width = 123
      Height = 80
      Caption = 'Data Type'
      ItemIndex = 0
      Items.Strings = (
        ' Depth'
        ' Thickness')
      TabOrder = 2
    end
    object Edit6: TEdit
      Left = 6
      Top = 40
      Width = 45
      Height = 21
      ReadOnly = True
      TabOrder = 3
      Text = '8'
    end
    object UpDown3: TUpDown
      Left = 8
      Top = 68
      Width = 42
      Height = 17
      Min = 8
      Max = 60
      Orientation = udHorizontal
      Position = 8
      TabOrder = 4
      OnChanging = UpDown3Changing
    end
  end
  object GroupBox4: TGroupBox
    Left = 224
    Top = 112
    Width = 193
    Height = 113
    TabOrder = 2
    object Label6: TLabel
      Left = 20
      Top = 46
      Width = 44
      Height = 13
      Caption = 'Font Size'
    end
    object ListBox2: TListBox
      Left = 88
      Top = 19
      Width = 89
      Height = 81
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
      TabOrder = 0
    end
    object Edit3: TEdit
      Left = 8
      Top = 21
      Width = 73
      Height = 21
      TabOrder = 1
      Text = '1'
    end
    object Edit7: TEdit
      Left = 20
      Top = 64
      Width = 47
      Height = 21
      ReadOnly = True
      TabOrder = 2
      Text = '12'
    end
    object UpDown4: TUpDown
      Left = 22
      Top = 89
      Width = 44
      Height = 16
      Min = 12
      Orientation = udHorizontal
      Position = 12
      TabOrder = 3
      OnChanging = UpDown4Changing
    end
  end
  object GroupBox5: TGroupBox
    Left = 8
    Top = 112
    Width = 217
    Height = 113
    TabOrder = 3
    object Image2: TImage
      Left = 124
      Top = 11
      Width = 85
      Height = 94
    end
  end
  object CheckBox2: TCheckBox
    Left = 480
    Top = 112
    Width = 73
    Height = 17
    Caption = 'Grid Lines'
    Checked = True
    State = cbChecked
    TabOrder = 4
    OnClick = CheckBox2Click
  end
  object CheckBox5: TCheckBox
    Left = 16
    Top = 112
    Width = 73
    Height = 17
    Caption = 'Azimooth'
    Checked = True
    State = cbChecked
    TabOrder = 5
    OnClick = CheckBox5Click
  end
  object CheckBox4: TCheckBox
    Left = 232
    Top = 112
    Width = 73
    Height = 17
    Caption = 'X Scale'
    Checked = True
    State = cbChecked
    TabOrder = 6
    OnClick = CheckBox4Click
  end
  object CheckBox3: TCheckBox
    Left = 16
    Top = 4
    Width = 113
    Height = 16
    Caption = 'Show Color Range'
    Checked = True
    State = cbChecked
    TabOrder = 7
    OnClick = CheckBox3Click
  end
  object RadioGroup3: TRadioGroup
    Left = 32
    Top = 144
    Width = 89
    Height = 57
    ItemIndex = 0
    Items.Strings = (
      'Default'
      'From File')
    TabOrder = 8
    OnClick = RadioGroup3Click
  end
  object GroupBox1: TGroupBox
    Left = 8
    Top = 240
    Width = 264
    Height = 106
    TabOrder = 9
    object Image5: TImage
      Left = 54
      Top = 48
      Width = 99
      Height = 50
    end
    object Label1: TLabel
      Left = 157
      Top = 50
      Width = 71
      Height = 13
      Caption = '# of Con./Con.'
    end
    object Label2: TLabel
      Left = 5
      Top = 39
      Width = 44
      Height = 13
      Caption = 'Font Size'
    end
    object Edit2: TEdit
      Left = 7
      Top = 54
      Width = 41
      Height = 21
      ReadOnly = True
      TabOrder = 0
      Text = '8'
    end
    object UpDown1: TUpDown
      Left = 7
      Top = 81
      Width = 40
      Height = 17
      Min = 8
      Orientation = udHorizontal
      Position = 8
      TabOrder = 1
      OnChanging = UpDown1Changing
    end
    object Button2: TButton
      Left = 160
      Top = 71
      Width = 97
      Height = 26
      Caption = 'Reset Con.'
      TabOrder = 2
      OnClick = Button2Click
    end
    object Edit4: TEdit
      Left = 231
      Top = 48
      Width = 25
      Height = 21
      TabOrder = 3
      Text = '2'
    end
    object CheckBox7: TCheckBox
      Left = 7
      Top = 15
      Width = 98
      Height = 17
      Caption = 'Contour Line'
      Checked = True
      State = cbChecked
      TabOrder = 4
      OnClick = CheckBox1Click
    end
    object CheckBox1: TCheckBox
      Left = 124
      Top = 17
      Width = 121
      Height = 15
      Caption = 'Contour Line Named'
      Checked = True
      State = cbChecked
      TabOrder = 5
      OnClick = CheckBox1Click
    end
  end
  object GroupBox8: TGroupBox
    Left = 278
    Top = 240
    Width = 201
    Height = 105
    TabOrder = 10
    object Label3: TLabel
      Left = 6
      Top = 30
      Width = 30
      Height = 13
      Caption = 'Zoom'
    end
    object Label8: TLabel
      Left = 6
      Top = 57
      Width = 44
      Height = 13
      Caption = 'Font Size'
    end
    object Label9: TLabel
      Left = 6
      Top = 84
      Width = 54
      Height = 13
      Caption = 'Well Thick.'
    end
    object Edit1: TEdit
      Left = 63
      Top = 27
      Width = 44
      Height = 21
      TabOrder = 0
      Text = '5'
    end
    object CheckBox8: TCheckBox
      Left = 11
      Top = 4
      Width = 97
      Height = 17
      Caption = 'Draw Wells'
      Checked = True
      State = cbChecked
      TabOrder = 1
    end
    object Button1: TButton
      Left = 113
      Top = 3
      Width = 83
      Height = 94
      Caption = 'Ok'
      TabOrder = 2
      OnClick = Button1Click
    end
    object Edit9: TEdit
      Left = 63
      Top = 54
      Width = 44
      Height = 21
      ReadOnly = True
      TabOrder = 3
      Text = '15'
    end
    object Edit10: TEdit
      Left = 64
      Top = 81
      Width = 44
      Height = 21
      TabOrder = 4
      Text = '1'
    end
  end
  object GroupBox6: TGroupBox
    Left = 480
    Top = 240
    Width = 281
    Height = 105
    TabOrder = 11
    object Label4: TLabel
      Left = 6
      Top = 25
      Width = 44
      Height = 13
      Caption = 'Font Size'
    end
    object ListBox3: TListBox
      Left = 56
      Top = 25
      Width = 217
      Height = 73
      Ctl3D = False
      ItemHeight = 13
      ParentCtl3D = False
      TabOrder = 0
    end
    object Edit5: TEdit
      Left = 6
      Top = 43
      Width = 45
      Height = 21
      ReadOnly = True
      TabOrder = 1
      Text = '10'
    end
    object UpDown2: TUpDown
      Left = 8
      Top = 71
      Width = 41
      Height = 17
      Min = 10
      Orientation = udHorizontal
      Position = 10
      TabOrder = 2
      OnChanging = UpDown2Changing
    end
    object CheckBox6: TCheckBox
      Left = 6
      Top = 2
      Width = 97
      Height = 17
      Caption = 'File Information'
      Checked = True
      State = cbChecked
      TabOrder = 3
    end
  end
  object ColorDialog1: TColorDialog
    Left = 128
    Top = 79
  end
  object OpenDialog1: TOpenDialog
    Filter = 'BMP|*.bmp'
    Left = 376
    Top = 184
  end
end
