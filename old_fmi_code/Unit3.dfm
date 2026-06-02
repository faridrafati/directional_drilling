object Form3: TForm3
  Left = 391
  Top = 142
  BorderStyle = bsToolWindow
  Caption = 'Specail Coloring'
  ClientHeight = 223
  ClientWidth = 201
  Color = clBtnFace
  Font.Charset = DEFAULT_CHARSET
  Font.Color = clWindowText
  Font.Height = -11
  Font.Name = 'MS Sans Serif'
  Font.Style = []
  OldCreateOrder = False
  PixelsPerInch = 96
  TextHeight = 13
  object Label1: TLabel
    Left = 24
    Top = 32
    Width = 60
    Height = 13
    Caption = 'Max Value'
    Font.Charset = DEFAULT_CHARSET
    Font.Color = clWindowText
    Font.Height = -11
    Font.Name = 'MS Sans Serif'
    Font.Style = [fsBold]
    ParentFont = False
  end
  object Label2: TLabel
    Left = 24
    Top = 103
    Width = 60
    Height = 13
    Caption = 'Max Value'
    Font.Charset = DEFAULT_CHARSET
    Font.Color = clWindowText
    Font.Height = -11
    Font.Name = 'MS Sans Serif'
    Font.Style = [fsBold]
    ParentFont = False
  end
  object Label3: TLabel
    Left = 24
    Top = 176
    Width = 60
    Height = 13
    Caption = 'Max Value'
    Font.Charset = DEFAULT_CHARSET
    Font.Color = clWindowText
    Font.Height = -11
    Font.Name = 'MS Sans Serif'
    Font.Style = [fsBold]
    ParentFont = False
  end
  object Label4: TLabel
    Left = 136
    Top = 32
    Width = 57
    Height = 13
    Caption = 'Min Value'
    Font.Charset = DEFAULT_CHARSET
    Font.Color = clWindowText
    Font.Height = -11
    Font.Name = 'MS Sans Serif'
    Font.Style = [fsBold]
    ParentFont = False
  end
  object Label5: TLabel
    Left = 136
    Top = 104
    Width = 57
    Height = 13
    Caption = 'Min Value'
    Font.Charset = DEFAULT_CHARSET
    Font.Color = clWindowText
    Font.Height = -11
    Font.Name = 'MS Sans Serif'
    Font.Style = [fsBold]
    ParentFont = False
  end
  object Label6: TLabel
    Left = 136
    Top = 176
    Width = 57
    Height = 13
    Caption = 'Min Value'
    Font.Charset = DEFAULT_CHARSET
    Font.Color = clWindowText
    Font.Height = -11
    Font.Name = 'MS Sans Serif'
    Font.Style = [fsBold]
    ParentFont = False
  end
  object Check_filter1: TCheckBox
    Left = 8
    Top = 8
    Width = 137
    Height = 17
    Caption = 'Filter 1 (Blue)'
    Checked = True
    Font.Charset = DEFAULT_CHARSET
    Font.Color = clWindowText
    Font.Height = -13
    Font.Name = 'MS Sans Serif'
    Font.Style = [fsBold]
    ParentFont = False
    State = cbChecked
    TabOrder = 0
  end
  object Check_filter2: TCheckBox
    Left = 8
    Top = 80
    Width = 137
    Height = 17
    Caption = 'Filter 2 (Green)'
    Font.Charset = DEFAULT_CHARSET
    Font.Color = clWindowText
    Font.Height = -13
    Font.Name = 'MS Sans Serif'
    Font.Style = [fsBold]
    ParentFont = False
    TabOrder = 1
  end
  object Check_filter3: TCheckBox
    Left = 8
    Top = 152
    Width = 145
    Height = 17
    Caption = 'Filter 3 (Purple)'
    Font.Charset = DEFAULT_CHARSET
    Font.Color = clWindowText
    Font.Height = -13
    Font.Name = 'MS Sans Serif'
    Font.Style = [fsBold]
    ParentFont = False
    TabOrder = 2
  end
  object Edit_min1: TEdit
    Left = 136
    Top = 48
    Width = 57
    Height = 21
    TabOrder = 3
    Text = '0'
  end
  object Edit_max1: TEdit
    Left = 24
    Top = 48
    Width = 57
    Height = 21
    TabOrder = 4
    Text = '0'
  end
  object Edit_max2: TEdit
    Left = 24
    Top = 120
    Width = 57
    Height = 21
    TabOrder = 5
    Text = '0'
  end
  object Edit_min2: TEdit
    Left = 136
    Top = 120
    Width = 57
    Height = 21
    TabOrder = 6
    Text = '0'
  end
  object Edit_max3: TEdit
    Left = 24
    Top = 192
    Width = 57
    Height = 21
    TabOrder = 7
    Text = '0'
  end
  object Edit_min3: TEdit
    Left = 136
    Top = 192
    Width = 57
    Height = 21
    TabOrder = 8
    Text = '0'
  end
end
