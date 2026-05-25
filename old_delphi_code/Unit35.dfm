object Form35: TForm35
  Left = 0
  Top = 0
  Caption = 'Form 15'
  ClientHeight = 721
  ClientWidth = 934
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
    Left = 720
    Top = 7
    Width = 57
    Height = 405
  end
  object Image2: TImage
    Left = 8
    Top = 8
    Width = 700
    Height = 700
    Visible = False
  end
  object Image3: TImage
    Left = 8
    Top = 8
    Width = 700
    Height = 700
  end
  object Button1: TButton
    Left = 839
    Top = 482
    Width = 75
    Height = 25
    Caption = 'DRAW'
    TabOrder = 0
    OnClick = Button1Click
  end
  object GLSceneViewer1: TGLSceneViewer
    Left = 8
    Top = 8
    Width = 700
    Height = 700
    Camera = GLCameraC
    VSync = vsmSync
    Buffer.BackgroundColor = clBtnHighlight
    FieldOfView = 163.739791870117200000
    OnMouseDown = GLSceneViewer1MouseDown
    OnMouseMove = GLSceneViewer1MouseMove
    OnMouseUp = GLSceneViewer1MouseUp
    TabOrder = 1
  end
  object Edit1: TEdit
    Left = 832
    Top = 447
    Width = 81
    Height = 19
    Ctl3D = False
    ParentCtl3D = False
    ReadOnly = True
    TabOrder = 2
    Text = 'Edit1'
  end
  object Button2: TButton
    Left = 839
    Top = 513
    Width = 75
    Height = 25
    Caption = 'PIPE'
    TabOrder = 3
    OnClick = Button2Click
  end
  object Button3: TButton
    Left = 747
    Top = 482
    Width = 75
    Height = 25
    Caption = '3D 3D'
    TabOrder = 4
    OnClick = Button3Click
  end
  object Button4: TButton
    Left = 747
    Top = 513
    Width = 75
    Height = 25
    Caption = 'Button4'
    TabOrder = 5
    OnClick = Button4Click
  end
  object CheckBox2: TCheckBox
    Left = 758
    Top = 544
    Width = 97
    Height = 17
    Caption = 'CheckBox2'
    TabOrder = 6
  end
  object PageControl1: TPageControl
    Left = 832
    Top = 8
    Width = 105
    Height = 433
    ActivePage = TabSheet1
    MultiLine = True
    TabOrder = 7
    TabPosition = tpRight
    OnChange = PageControl1Change
    object TabSheet1: TTabSheet
      Caption = 'Action'
      object RadioGroup1: TRadioGroup
        Left = 0
        Top = 0
        Width = 75
        Height = 425
        Caption = 'Actions'
        ItemIndex = 0
        Items.Strings = (
          'Rotation'
          'Move'
          'Zoom')
        TabOrder = 0
      end
    end
    object TabSheet2: TTabSheet
      Caption = 'Leveling'
      ImageIndex = 1
      object TrackBar1: TTrackBar
        Left = 24
        Top = 0
        Width = 25
        Height = 401
        Ctl3D = True
        Max = 200
        Orientation = trVertical
        ParentCtl3D = False
        ParentShowHint = False
        Position = 100
        ShowHint = False
        TabOrder = 0
        ThumbLength = 15
        TickMarks = tmTopLeft
        OnChange = TrackBar1Change
      end
      object CheckBox1: TCheckBox
        Left = 5
        Top = 407
        Width = 73
        Height = 17
        Caption = 'Mesh Pos.'
        Checked = True
        State = cbChecked
        TabOrder = 1
        OnClick = CheckBox1Click
      end
    end
    object TabSheet3: TTabSheet
      Caption = 'Camera'
      ImageIndex = 2
      object RadioGroup2: TRadioGroup
        Left = 0
        Top = 0
        Width = 75
        Height = 425
        Caption = 'Camera'
        ItemIndex = 1
        Items.Strings = (
          'Left'
          'Center'
          'Right'
          'Out')
        TabOrder = 0
        OnClick = RadioGroup2Click
      end
    end
    object TabSheet4: TTabSheet
      Caption = 'Positioning'
      ImageIndex = 3
      object Label1: TLabel
        Left = 0
        Top = 0
        Width = 10
        Height = 13
        Caption = 'X:'
      end
      object Label2: TLabel
        Left = 0
        Top = 216
        Width = 10
        Height = 13
        Caption = 'Z:'
      end
      object TrackBar2: TTrackBar
        Left = 52
        Top = 8
        Width = 29
        Height = 200
        Max = 50
        Orientation = trVertical
        TabOrder = 0
        ThumbLength = 10
        TickMarks = tmTopLeft
        OnChange = TrackBar2Change
      end
      object TrackBar3: TTrackBar
        Left = 52
        Top = 224
        Width = 29
        Height = 200
        Ctl3D = True
        Max = 50
        Orientation = trVertical
        ParentCtl3D = False
        TabOrder = 1
        ThumbLength = 10
        TickMarks = tmTopLeft
        OnChange = TrackBar3Change
      end
      object Edit2: TEdit
        Left = 0
        Top = 96
        Width = 57
        Height = 21
        TabOrder = 2
        Text = '99999999'
      end
      object Edit3: TEdit
        Left = 0
        Top = 304
        Width = 57
        Height = 21
        TabOrder = 3
        Text = '99999999'
      end
    end
  end
  object RadioGroup3: TRadioGroup
    Left = 714
    Top = 418
    Width = 108
    Height = 65
    Caption = 'RadioGroup3'
    ItemIndex = 0
    Items.Strings = (
      'MESHING'
      'CUBES')
    TabOrder = 8
    OnClick = RadioGroup3Click
  end
  object GLScene1: TGLScene
    OnProgress = GLCadencer1Progress
    Left = 760
    Top = 240
    object GLMesh1: TGLMesh
      Material.BlendingMode = bmTransparency
      Up.Coordinates = {000000000000803F0000008000000000}
      Mode = mmTriangleStrip
    end
    object GLLightSource1: TGLLightSource
      ConstAttenuation = 1.000000000000000000
      Position.Coordinates = {000000000000A041000000000000803F}
      SpotCutOff = 180.000000000000000000
    end
    object GLDummyCube1: TGLDummyCube
      Direction.Coordinates = {000000000000F027FFFF7F3F00000000}
      ShowAxes = True
      Up.Coordinates = {000000000000803F0100003300000000}
      CubeSize = 1.000000000000000000
    end
    object GLCube1: TGLCube
      Material.BlendingMode = bmTransparency
      CubeSize = {0000003F0000003F0000003F}
    end
    object GLXYZGrid1: TGLXYZGrid
      Scale.Coordinates = {0000A0400000A0400000A04000000000}
      AntiAliased = True
      LineColor.Color = {CDCC4C3FF8FEFE3EACC8483E0000803F}
      LineWidth = 2.000000000000000000
      XSamplingScale.Min = -1.000000000000000000
      XSamplingScale.max = 1.000000000000000000
      XSamplingScale.step = 0.100000001490116100
      YSamplingScale.step = 0.100000001490116100
      ZSamplingScale.Min = -1.000000000000000000
      ZSamplingScale.max = 1.000000000000000000
      ZSamplingScale.step = 0.200000002980232200
      Parts = [gpX, gpZ]
    end
    object GLLines1: TGLLines
      Nodes = <
        item
        end>
      Options = []
    end
    object GLCube2: TGLCube
      CubeSize = {0000003F0000003F0000003F}
    end
    object GLCube3: TGLCube
      CubeSize = {0000003F0000003F0000003F}
    end
    object GLSphere1: TGLSphere
      Visible = False
      Radius = 0.200000002980232200
    end
    object GLCameraL: TGLCamera
      DepthOfView = 100.000000000000000000
      FocalLength = 50.000000000000000000
      NearPlaneBias = 0.100000001490116100
      TargetObject = GLDummyCube1
      Position.Coordinates = {000080BF00004041000040410000803F}
    end
    object GLCameraC: TGLCamera
      DepthOfView = 100.000000000000000000
      FocalLength = 50.000000000000000000
      TargetObject = GLDummyCube1
      Position.Coordinates = {0000000000009041000090410000803F}
    end
    object GLCameraR: TGLCamera
      DepthOfView = 100.000000000000000000
      FocalLength = 50.000000000000000000
      NearPlaneBias = 0.100000001490116100
      TargetObject = GLDummyCube1
      Position.Coordinates = {0000803F00004041000040410000803F}
    end
    object GLCameraO: TGLCamera
      DepthOfView = 100.000000000000000000
      FocalLength = 50.000000000000000000
      Position.Coordinates = {0000A0410000A0410000A0410000803F}
    end
    object GLPolygon1: TGLPolygon
      Nodes = <>
    end
    object GLCube4: TGLCube
      Material.BlendingMode = bmTransparency
    end
    object GLLightSource2: TGLLightSource
      ConstAttenuation = 1.000000000000000000
      Position.Coordinates = {0000F04100000000000000000000803F}
      LightStyle = lsOmni
      SpotCutOff = 180.000000000000000000
      SpotDirection.Coordinates = {000080BF000000800000000000000000}
    end
    object GLLightSource3: TGLLightSource
      ConstAttenuation = 1.000000000000000000
      Position.Coordinates = {0000F0C100000000000000000000803F}
      SpotCutOff = 180.000000000000000000
      SpotDirection.Coordinates = {0000803F000000000000000000000000}
    end
  end
  object MainMenu1: TMainMenu
    Left = 88
    Top = 40
    object File1: TMenuItem
      Caption = 'File'
      object Option1: TMenuItem
        Caption = 'Option'
        OnClick = Option1Click
      end
      object Save1: TMenuItem
        Caption = 'Save'
      end
      object Exit1: TMenuItem
        Caption = 'Exit'
      end
    end
  end
  object SavePictureDialog1: TSavePictureDialog
    Left = 120
    Top = 40
  end
  object GLCadencer1: TGLCadencer
    Scene = GLScene1
    Left = 56
    Top = 8
  end
  object GLMaterialLibrary1: TGLMaterialLibrary
    Materials = <
      item
        Name = 'LibMaterial'
        Material.BlendingMode = bmTransparency
        Tag = 0
        TextureOffset.Coordinates = {0000000000000000000000000000803F}
        TextureScale.Coordinates = {0000803F0000803F0000803F0000803F}
      end>
    Left = 176
    Top = 16
  end
end
