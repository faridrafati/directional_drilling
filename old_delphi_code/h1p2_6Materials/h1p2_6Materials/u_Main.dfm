object Form1: TForm1
  Left = 199
  Top = 150
  Caption = 'book.glscene.ru :  FirstProject/Materials'
  ClientHeight = 400
  ClientWidth = 600
  Color = clBtnFace
  Font.Charset = DEFAULT_CHARSET
  Font.Color = clWindowText
  Font.Height = -11
  Font.Name = 'MS Sans Serif'
  Font.Style = []
  KeyPreview = True
  OldCreateOrder = False
  Position = poScreenCenter
  OnCreate = FormCreate
  OnKeyDown = FormKeyDown
  OnMouseWheel = FormMouseWheel
  OnResize = FormResize
  PixelsPerInch = 96
  TextHeight = 13
  object GLSceneViewer1: TGLSceneViewer
    Left = 0
    Top = 0
    Width = 600
    Height = 400
    Camera = GLCamera1
    Buffer.BackgroundColor = clWhite
    Buffer.ContextOptions = [roDoubleBuffer, roStencilBuffer, roRenderToWindow, roNoColorBufferClear]
    FieldOfView = 141.797821044921900000
    Align = alClient
    OnMouseDown = GLSceneViewer1MouseDown
    OnMouseUp = GLSceneViewer1MouseUp
    TabOrder = 0
  end
  object GLScene1: TGLScene
    Left = 8
    Top = 8
    object GLSphere1: TGLSphere
      Material.Texture.ImageClassName = 'TGLCompositeImage'
      Material.Texture.Image.Width = 256
      Material.Texture.Image.Height = 256
      Material.Texture.Image.Depth = 0
      Radius = 0.699999988079071100
      BehavioursData = {
        0458434F4C02010201060D54474C44434544796E616D69630201020012000000
        000200060D474C4443454D616E616765723102000909090F0000803F0F000000
        00020502000200093333333F3333333F3333333F00000000}
      object GLCamera1: TGLCamera
        DepthOfView = 100.000000000000000000
        FocalLength = 69.260459899902350000
        TargetObject = GLSphere1
        Position.Coordinates = {0000000000000041000020410000803F}
      end
    end
    object GLTorus1: TGLTorus
      Material.MaterialLibrary = GLMaterialLibrary1
      Material.LibMaterialName = 'tor'
      MajorRadius = 2.000000000000000000
      MinorRadius = 0.500000000000000000
      Rings = 64
      Sides = 32
      BehavioursData = {
        0458434F4C02010201060B54474C42496E657274696102001200000000020002
        00050000000000000080FF3F0200080500000000000000000000050000000000
        00000000000500000000000000B4044009020008020008}
    end
    object GLDummyCube1: TGLDummyCube
      CubeSize = 1.000000000000000000
      object GLCube1: TGLCube
        Material.FrontProperties.Ambient.Color = {0000803F0000803F0000803F0000803F}
        Material.FrontProperties.Diffuse.Color = {0000803F0000803F0000803F0000803F}
        Material.Texture.TextureMode = tmModulate
        Position.Coordinates = {0000804000000000000000000000803F}
        object GLCone1: TGLCone
          Material.FrontProperties.Diffuse.Color = {0000803F0000803F0000803F0000803F}
          Position.Coordinates = {000000000000803F000000000000803F}
          BottomRadius = 0.500000000000000000
          Height = 1.000000000000000000
        end
      end
    end
    object GLPlane1: TGLPlane
      Direction.Coordinates = {000000000000803F0000000000000000}
      Position.Coordinates = {00000000000040C0000000000000803F}
      Up.Coordinates = {0000000000000000000080BF00000000}
      Height = 20.000000000000000000
      Width = 20.000000000000000000
      XTiles = 4
      YTiles = 4
      BehavioursData = {
        0458434F4C02010201060C54474C444345537461746963020102001200000000
        0200060D474C4443454D616E61676572310201020009090F0000803F0F000000
        0002000900007042000070420AD7233C00000000}
    end
    object GLCube2: TGLCube
      Material.FrontProperties.Diffuse.Color = {EBE0E03EE4DB5B3FE4DB5B3F0000803F}
      Material.FrontProperties.Emission.Color = {F1F0F03EC1C0403EB1B0303E0000803F}
      Position.Coordinates = {0000C0C0000000C00000C0400000803F}
      Scale.Coordinates = {000080400000803F0000804000000000}
      BehavioursData = {
        0458434F4C02010201060C54474C444345537461746963020102001200000000
        0200060D474C4443454D616E61676572310201020009090F0000803F0F000000
        00020008}
    end
    object GLCube3: TGLCube
      Material.FrontProperties.Diffuse.Color = {EBE0E03EE4DB5B3FE4DB5B3F0000803F}
      Material.FrontProperties.Emission.Color = {C1C0C03E8281013FD9D8D83D0000803F}
      Position.Coordinates = {0000C0C0000080BF000000400000803F}
      Scale.Coordinates = {000080400000803F0000804000000000}
      BehavioursData = {
        0458434F4C02010201060C54474C444345537461746963020102001200000000
        0200060D474C4443454D616E61676572310201020009090F0000803F0F000000
        00020008}
    end
    object GLCube4: TGLCube
      Material.BackProperties.Diffuse.Color = {EBE0E03EE4DB5B3FE4DB5B3F0000003F}
      Material.FrontProperties.Diffuse.Color = {EBE0E03EE4DB5B3FE4DB5B3F0000803F}
      Material.FrontProperties.Emission.Color = {8180003EF7F6F63EF7F6F63E0000803F}
      Position.Coordinates = {0000C0C000000000000000C00000803F}
      Scale.Coordinates = {000080400000803F0000804000000000}
      BehavioursData = {
        0458434F4C02010201060C54474C444345537461746963020102001200000000
        0200060D474C4443454D616E61676572310201020009090F0000803F0F000000
        00020008}
    end
    object GLCube5: TGLCube
      Material.FrontProperties.Diffuse.Color = {000000000000003F0000003F0000803F}
      Material.FrontProperties.Emission.Color = {0AD7633FD7A3F03ECDCC4C3E0000803F}
      Position.Coordinates = {0000C0C00000803F0000C0C00000803F}
      RollAngle = -30.000000000000000000
      Scale.Coordinates = {000000410000803F0000804000000000}
      Up.Coordinates = {0100003FD7B35D3F0000000000000000}
      BehavioursData = {
        0458434F4C02010201060C54474C444345537461746963020102001200000000
        0200060D474C4443454D616E61676572310201020009090F0000803F0F000000
        00020008}
    end
    object GLCube6: TGLCube
      Material.MaterialLibrary = GLMaterialLibrary1
      Material.LibMaterialName = 'platform'
      Position.Coordinates = {00000000000000000000C0C00000803F}
      Scale.Coordinates = {000080400000803F0000804000000000}
      BehavioursData = {
        0458434F4C02010201060C54474C444345537461746963020102001200000000
        0200060D474C4443454D616E61676572310201020009090F0000803F0F000000
        00020008}
    end
    object GLShadowVolume1: TGLShadowVolume
      Lights = <
        item
          LightSource = GLLightSource1
        end>
      Occluders = <
        item
          Caster = GLSphere1
        end
        item
          Caster = GLCube1
        end
        item
          Caster = GLCone1
        end
        item
          Caster = GLCube2
        end
        item
          Caster = GLCube3
        end
        item
          Caster = GLCube4
        end
        item
          Caster = GLCube5
        end
        item
          Caster = GLCube6
        end>
      Capping = svcNever
      Mode = svmDarkening
      DarkeningColor.Color = {0000000000000000000000009A99993E}
    end
    object GLSphere2: TGLSphere
      NormalDirection = ndInside
      Radius = 50.000000000000000000
    end
    object GLLightSource1: TGLLightSource
      ConstAttenuation = 1.000000000000000000
      Position.Coordinates = {0000000000004041000000000000803F}
      SpotCutOff = 180.000000000000000000
      object GLSprite1: TGLSprite
        Material.BlendingMode = bmAdditive
        Width = 5.000000000000000000
        Height = 5.000000000000000000
      end
    end
    object GLHUDText1: TGLHUDText
      Position.Coordinates = {0000B44300004843000000000000803F}
      Up.Coordinates = {000000800000803F0000000000000000}
      BitmapFont = GLWindowsBitmapFont1
      Text = #1055#1088#1080#1074#1077#1090', GLScene!'
      Alignment = taCenter
      Layout = tlCenter
      ModulateColor.Color = {0000803FF8FEFE3E000000000000803F}
    end
    object GLHUDText2: TGLHUDText
      Position.Coordinates = {0000964300004843000000000000803F}
      Up.Coordinates = {000000800000803F0000000000000000}
      BitmapFont = GLWindowsBitmapFont1
      Text = #1055#1072#1091#1079#1072
      Alignment = taCenter
      Layout = tlCenter
      ModulateColor.Color = {000000000000803F000000000000803F}
    end
  end
  object GLCadencer1: TGLCadencer
    Scene = GLScene1
    FixedDeltaTime = 0.020000000000000000
    SleepLength = 1
    OnProgress = GLCadencer1Progress
    Left = 8
    Top = 40
  end
  object GLDCEManager1: TGLDCEManager
    Gravity = -20.000000000000000000
    WorldScale = 1.000000000000000000
    MovimentScale = 1.000000000000000000
    StandardiseLayers = ccsDCEStandard
    ManualStep = False
    Left = 40
    Top = 40
  end
  object GLWindowsBitmapFont1: TGLWindowsBitmapFont
    Font.Charset = RUSSIAN_CHARSET
    Font.Color = clWhite
    Font.Height = -23
    Font.Name = 'Courier New'
    Font.Style = [fsBold]
    Ranges = <
      item
        StartASCII = ' '
        StopASCII = '~'
        StartGlyphIdx = 0
      end
      item
        StartASCII = #1072
        StopASCII = #1103
        StartGlyphIdx = 95
      end
      item
        StartASCII = #1040
        StopASCII = #1071
        StartGlyphIdx = 127
      end>
    Left = 40
    Top = 8
  end
  object GLMaterialLibrary1: TGLMaterialLibrary
    Materials = <
      item
        Name = 'platform'
        Tag = 0
        Material.FrontProperties.Ambient.Color = {0000803F0000803F0000803F0000803F}
        Material.FrontProperties.Diffuse.Color = {0000803F0000803F0000803F0000803F}
        Material.Texture.TextureMode = tmModulate
        Material.Texture.FilteringQuality = tfAnisotropic
        TextureScale.Coordinates = {00004040000040400000803F00000000}
      end
      item
        Name = 'tor'
        Tag = 0
        Material.FrontProperties.Diffuse.Color = {000000000000803F000000000000803F}
        Shader = GLCelShader1
      end>
    Left = 8
    Top = 72
  end
  object GLCelShader1: TGLCelShader
    CelShaderOptions = []
    OutlineWidth = 2.000000000000000000
    Left = 40
    Top = 72
  end
  object AsyncTimer1: TAsyncTimer
    Enabled = True
    Interval = 500
    OnTimer = AsyncTimer1Timer
    Left = 72
    Top = 8
  end
end
