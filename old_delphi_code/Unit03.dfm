object Form03: TForm03
  Left = 0
  Top = 0
  Caption = 'Form03'
  ClientHeight = 482
  ClientWidth = 763
  Color = clBtnFace
  Font.Charset = DEFAULT_CHARSET
  Font.Color = clWindowText
  Font.Height = -11
  Font.Name = 'Tahoma'
  Font.Style = []
  Menu = MainMenu1
  OldCreateOrder = False
  OnShow = FormShow
  PixelsPerInch = 96
  TextHeight = 13
  object Image1: TImage
    Left = 0
    Top = 0
    Width = 763
    Height = 420
    Align = alCustom
  end
  object GLSceneViewer1: TGLSceneViewer
    Left = 0
    Top = 0
    Width = 763
    Height = 426
    Camera = GLCamera1
    FieldOfView = 153.578933715820300000
    Align = alClient
    OnMouseDown = GLSceneViewer1MouseDown
    OnMouseMove = GLSceneViewer1MouseMove
    TabOrder = 0
    ExplicitHeight = 420
  end
  object Panel1: TPanel
    Left = 0
    Top = 426
    Width = 763
    Height = 56
    Align = alBottom
    BorderStyle = bsSingle
    Ctl3D = False
    ParentCtl3D = False
    TabOrder = 1
    OnResize = Panel1Resize
    object Label1: TLabel
      Left = 8
      Top = 5
      Width = 39
      Height = 13
      Align = alCustom
      Caption = 'Zoom X:'
    end
    object Label2: TLabel
      Left = 59
      Top = 5
      Width = 39
      Height = 13
      Align = alCustom
      Caption = 'Zoom Y:'
    end
    object Label3: TLabel
      Left = 104
      Top = 5
      Width = 39
      Height = 13
      Align = alCustom
      Caption = 'Zoom Z:'
    end
    object Button1: TButton
      Left = 165
      Top = 10
      Width = 75
      Height = 38
      Align = alCustom
      Caption = 'Apply'
      TabOrder = 0
      OnClick = Button1Click
    end
    object Button2: TButton
      Left = 246
      Top = 10
      Width = 75
      Height = 38
      Align = alCustom
      Caption = '3D Stereo'
      TabOrder = 1
      OnClick = Button2Click
    end
    object Button3: TButton
      Left = 327
      Top = 10
      Width = 75
      Height = 37
      Align = alCustom
      Caption = 'Print'
      TabOrder = 2
    end
    object Edit1: TEdit
      Left = 8
      Top = 22
      Width = 39
      Height = 19
      Align = alCustom
      Ctl3D = False
      ParentCtl3D = False
      TabOrder = 3
      Text = '1'
    end
    object Edit2: TEdit
      Left = 53
      Top = 22
      Width = 39
      Height = 19
      Align = alCustom
      Ctl3D = False
      ParentCtl3D = False
      TabOrder = 4
      Text = '1'
    end
    object Edit3: TEdit
      Left = 104
      Top = 22
      Width = 39
      Height = 19
      Align = alCustom
      Ctl3D = False
      ParentCtl3D = False
      TabOrder = 5
      Text = '1'
    end
  end
  object GLScene1: TGLScene
    Left = 8
    Top = 8
    object GLLightSource1: TGLLightSource
      ConstAttenuation = 1.000000000000000000
      Position.Coordinates = {00004040000080400000A0400000803F}
      SpotCutOff = 180.000000000000000000
    end
    object GLDummyCube1: TGLDummyCube
      CubeSize = 10.000000000000000000
    end
    object GLPipe1: TGLPipe
      ShowAxes = True
      Up.Coordinates = {000000000000803F0000008000000000}
      Nodes = <
        item
          RadiusFactor = 0.050000000745058060
        end>
      Parts = [ppOutside, ppInside, ppStartDisk, ppStopDisk]
      Radius = 1.000000000000000000
    end
    object GLPipe2: TGLPipe
      ShowAxes = True
      Up.Coordinates = {000000000000803F0000008000000000}
      Nodes = <
        item
          RadiusFactor = 0.050000000745058060
        end>
      Parts = [ppOutside, ppInside, ppStartDisk, ppStopDisk]
      Radius = 1.000000000000000000
    end
    object GLCamera1: TGLCamera
      DepthOfView = 100.000000000000000000
      FocalLength = 50.000000000000000000
      TargetObject = GLDummyCube1
      Position.Coordinates = {0000404100004041000040410000803F}
    end
    object GLCameraL: TGLCamera
      DepthOfView = 100.000000000000000000
      FocalLength = 50.000000000000000000
      TargetObject = GLDummyCube1
      Position.Coordinates = {0000404100004041000050410000803F}
    end
    object GLCameraR: TGLCamera
      DepthOfView = 100.000000000000000000
      FocalLength = 50.000000000000000000
      TargetObject = GLDummyCube1
      Position.Coordinates = {0000404100004041000030410000803F}
    end
  end
  object RvSystem1: TRvSystem
    TitleSetup = 'Output Options'
    TitleStatus = 'Report Status'
    TitlePreview = 'Report Preview'
    SystemFiler.StatusFormat = 'Generating page %p'
    SystemPreview.ZoomFactor = 100.000000000000000000
    SystemPrinter.ScaleX = 100.000000000000000000
    SystemPrinter.ScaleY = 100.000000000000000000
    SystemPrinter.StatusFormat = 'Printing page %p'
    SystemPrinter.Title = 'Rave Report'
    SystemPrinter.UnitsFactor = 1.000000000000000000
    Left = 376
    Top = 248
  end
  object MainMenu1: TMainMenu
    Left = 384
    Top = 256
    object File1: TMenuItem
      Caption = 'File'
    end
  end
end
