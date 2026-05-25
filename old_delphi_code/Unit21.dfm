object Form21: TForm21
  Left = 0
  Top = 0
  Width = 792
  Height = 735
  AutoScroll = True
  Caption = 'Form21'
  Color = clBtnFace
  Font.Charset = DEFAULT_CHARSET
  Font.Color = clWindowText
  Font.Height = -11
  Font.Name = 'MS Sans Serif'
  Font.Style = []
  Menu = MainMenu1
  OldCreateOrder = False
  Position = poDesigned
  OnCreate = FormCreate
  OnShow = FormShow
  PixelsPerInch = 96
  TextHeight = 13
  object Image1: TImage
    Left = 111
    Top = 80
    Width = 121
    Height = 481
    PopupMenu = PopupMenu1
    OnMouseDown = Image1MouseDown
    OnMouseMove = Image1MouseMove
    OnMouseUp = Image1MouseUp
  end
  object Image2: TImage
    Left = 238
    Top = 55
    Width = 129
    Height = 177
    OnMouseDown = Image2MouseDown
    OnMouseMove = Image2MouseMove
  end
  object Image3: TImage
    Left = 238
    Top = 55
    Width = 100
    Height = 140
    OnMouseDown = Image3MouseDown
    OnMouseMove = Image3MouseMove
    OnMouseUp = Image3MouseUp
  end
  object Image4: TImage
    Left = 40
    Top = 80
    Width = 105
    Height = 105
    Visible = False
  end
  object StatusBar1: TStatusBar
    Left = 0
    Top = 658
    Width = 776
    Height = 19
    Panels = <>
    SimplePanel = True
  end
  object UpDown1: TUpDown
    Left = 89
    Top = 352
    Width = 16
    Height = 41
    Min = 1
    Position = 1
    TabOrder = 1
    OnClick = UpDown1Click
  end
  object Button1: TButton
    Left = 9
    Top = 0
    Width = 80
    Height = 49
    Caption = 'Draw'
    TabOrder = 2
    OnClick = Button1Click
  end
  object Button3: TButton
    Left = 249
    Top = 0
    Width = 80
    Height = 48
    Caption = 'Select Polygon '
    TabOrder = 3
    OnClick = Button3Click
  end
  object Button2: TButton
    Left = 169
    Top = 0
    Width = 80
    Height = 49
    Caption = 'Select Cross.'
    Enabled = False
    TabOrder = 4
    OnClick = Button2Click
  end
  object Button4: TButton
    Left = 89
    Top = 0
    Width = 80
    Height = 49
    Caption = 'Well Locator'
    TabOrder = 5
    OnClick = Button4Click
  end
  object ComboBox1: TComboBox
    Left = 463
    Top = 8
    Width = 234
    Height = 21
    Ctl3D = False
    ParentCtl3D = False
    TabOrder = 6
  end
  object CheckBox1: TCheckBox
    Left = 335
    Top = 15
    Width = 97
    Height = 17
    Caption = 'Show Wells'
    Checked = True
    State = cbChecked
    TabOrder = 7
    OnClick = CheckBox1Click
  end
  object PrintDialog1: TPrintDialog
    Left = 408
    Top = 384
  end
  object ColorDialog1: TColorDialog
    Left = 440
    Top = 384
  end
  object OpenPictureDialog1: TOpenPictureDialog
    Filter = 
      'All (*.gif;*.jpg;*.jpeg;*.bmp;*.ico;*.emf;*.wmf)|*.gif;*.jpg;*.j' +
      'peg;*.bmp;*.ico;*.emf;*.wmf|GIF Image (*.gif)|*.gif|JPEG Image F' +
      'ile (*.jpg)|*.jpg|JPEG Image File (*.jpeg)|*.jpeg|Bitmaps (*.bmp' +
      ')|*.bmp|Icons (*.ico)|*.ico|Enhanced Metafiles (*.emf)|*.emf|Met' +
      'afiles (*.wmf)|*.wmf'
    Left = 488
    Top = 440
  end
  object SaveDialog1: TSaveDialog
    DefaultExt = '.BMP'
    Filter = '*.BMP|*.BMP'
    Left = 520
    Top = 384
  end
  object MainMenu1: TMainMenu
    Left = 424
    Top = 344
    object File1: TMenuItem
      Caption = 'File'
      object Open1: TMenuItem
        Caption = 'Open'
      end
      object Options1: TMenuItem
        Caption = 'Volume Calculations'
        OnClick = Options1Click
      end
      object N3d1: TMenuItem
        Caption = '3D'
        OnClick = N3d1Click
      end
      object N3d21: TMenuItem
        Caption = '3d2'
        OnClick = N3d21Click
      end
      object N3d3d1: TMenuItem
        Caption = '3d 3d'
      end
      object Option1: TMenuItem
        Caption = 'Option'
        OnClick = Option1Click
      end
      object Exit1: TMenuItem
        Caption = 'Exit'
        OnClick = Exit1Click
      end
    end
    object Map1: TMenuItem
      Caption = 'Map'
      object MapMake1: TMenuItem
        Caption = 'Map Make'
        OnClick = MapMake1Click
      end
      object Properties2: TMenuItem
        Caption = 'Properties'
        OnClick = Properties2Click
      end
    end
    object Properties1: TMenuItem
      Caption = 'Options'
      object Units1: TMenuItem
        Caption = 'Prop...'
        OnClick = Units1Click
      end
    end
  end
  object PopupMenu1: TPopupMenu
    Left = 456
    Top = 344
    object Sect1: TMenuItem
      Caption = 'Depth Section'
      OnClick = Sect1Click
    end
  end
end
