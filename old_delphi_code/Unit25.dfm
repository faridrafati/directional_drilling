object Form25: TForm25
  Left = 231
  Top = 133
  Caption = 'Form25'
  ClientHeight = 704
  ClientWidth = 727
  Color = clBtnFace
  Font.Charset = DEFAULT_CHARSET
  Font.Color = clWindowText
  Font.Height = -11
  Font.Name = 'MS Sans Serif'
  Font.Style = []
  Menu = MainMenu1
  OldCreateOrder = False
  OnShow = FormShow
  PixelsPerInch = 96
  TextHeight = 13
  object Image1: TImage
    Left = 8
    Top = 8
    Width = 586
    Height = 586
    OnMouseDown = Image1MouseDown
    OnMouseMove = Image1MouseMove
    OnMouseUp = Image1MouseUp
  end
  object Image2: TImage
    Left = 8
    Top = 8
    Width = 707
    Height = 586
    Visible = False
  end
  object Image5: TImage
    Left = 592
    Top = 72
    Width = 121
    Height = 481
  end
  object Image3: TImage
    Left = 114
    Top = 8
    Width = 105
    Height = 105
  end
  object Button1: TButton
    Left = 456
    Top = 608
    Width = 131
    Height = 73
    Caption = 'Draw'
    TabOrder = 0
    OnClick = Button1Click
  end
  object UpDown1: TUpDown
    Left = 296
    Top = 176
    Width = 73
    Height = 17
    Min = -720
    Max = 720
    Increment = 5
    Orientation = udHorizontal
    TabOrder = 1
    Visible = False
    OnChanging = UpDown1Changing
    OnClick = UpDown1Click
    OnMouseUp = UpDown1MouseUp
  end
  object UpDown2: TUpDown
    Left = 416
    Top = 136
    Width = 17
    Height = 73
    Min = -720
    Max = 720
    TabOrder = 2
    Visible = False
    OnChanging = UpDown2Changing
    OnClick = UpDown2Click
    OnMouseUp = UpDown2MouseUp
  end
  object UpDown3: TUpDown
    Left = 384
    Top = 136
    Width = 17
    Height = 65
    Min = -720
    Max = 720
    Increment = 5
    TabOrder = 3
    Visible = False
    OnChanging = UpDown3Changing
    OnClick = UpDown3Click
    OnMouseUp = UpDown3MouseUp
  end
  object CheckBox4: TCheckBox
    Left = 240
    Top = 608
    Width = 129
    Height = 17
    Caption = 'Show Contour Lines'
    TabOrder = 4
    OnClick = CheckBox4Click
  end
  object CheckBox2: TCheckBox
    Left = 240
    Top = 624
    Width = 97
    Height = 17
    Caption = 'Boundry Show'
    TabOrder = 5
    OnClick = CheckBox2Click
  end
  object CheckBox5: TCheckBox
    Left = 240
    Top = 648
    Width = 97
    Height = 17
    Caption = 'Border'
    TabOrder = 6
    OnClick = CheckBox5Click
  end
  object CheckBox1: TCheckBox
    Left = 344
    Top = 648
    Width = 97
    Height = 17
    Caption = 'CheckBox1'
    TabOrder = 7
  end
  object Edit1: TEdit
    Left = 592
    Top = 624
    Width = 121
    Height = 21
    TabOrder = 8
    Text = '50'
  end
  object GLSceneViewer1: TGLSceneViewer
    Left = 8
    Top = 8
    Width = 105
    Height = 105
    Camera = GLCamera1
    FieldOfView = 92.794364929199220000
    TabOrder = 9
  end
  object CheckBox3: TCheckBox
    Left = 241
    Top = 664
    Width = 97
    Height = 17
    Caption = 'location'
    TabOrder = 10
  end
  object RadioGroup1: TRadioGroup
    Left = 24
    Top = 600
    Width = 129
    Height = 73
    Caption = 'Actions'
    ItemIndex = 0
    Items.Strings = (
      'Move'
      'Zoom'
      'Rotation')
    TabOrder = 11
  end
  object ColorDialog1: TColorDialog
    Left = 400
    Top = 320
  end
  object MainMenu1: TMainMenu
    Left = 312
    Top = 360
    object File1: TMenuItem
      Caption = 'File'
      object Options3: TMenuItem
        Caption = 'Options'
        OnClick = Options3Click
      end
      object SaveasBitmap2: TMenuItem
        Caption = 'Save as Bitmap'
        OnClick = SaveasBitmap2Click
      end
    end
  end
  object SaveDialog1: TSaveDialog
    DefaultExt = '.BMP'
    Filter = '*.bmp|*.bmp'
    Left = 360
    Top = 360
  end
  object GLScene1: TGLScene
    Left = 8
    Top = 8
    object GLDummyCube1: TGLDummyCube
      ShowAxes = True
      CubeSize = 1.000000000000000000
    end
    object GLLightSource1: TGLLightSource
      ConstAttenuation = 1.000000000000000000
      Position.Coordinates = {0000803F0000803F0000803F0000803F}
      SpotCutOff = 180.000000000000000000
    end
    object GLLines1: TGLLines
      ObjectsSorting = osNone
      LineColor.Color = {EBE0E03EE4DB5B3F9A93133F0000803F}
      LineWidth = 4.000000000000000000
      Nodes = <
        item
          X = 0.250000000000000000
          Z = -0.500000000000000000
        end
        item
          X = 0.250000000000000000
        end
        item
          X = 0.500000000000000000
        end
        item
          Z = 0.500000000000000000
        end
        item
          X = -0.500000000000000000
        end
        item
          X = -0.250000000000000000
        end
        item
          X = -0.250000000000000000
          Z = -0.500000000000000000
        end
        item
          X = 0.250000000000000000
          Z = -0.500000000000000000
        end>
      Options = []
    end
    object GLCamera1: TGLCamera
      DepthOfView = 100.000000000000000000
      FocalLength = 50.000000000000000000
      NearPlaneBias = 0.100000001490116100
      TargetObject = GLDummyCube1
      Position.Coordinates = {0000000000000040000080C00000803F}
    end
  end
end
