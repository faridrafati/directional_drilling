object Form28: TForm28
  Left = 0
  Top = 0
  Width = 746
  Height = 482
  VertScrollBar.ButtonSize = 10
  VertScrollBar.Margin = 10
  VertScrollBar.Smooth = True
  VertScrollBar.Tracking = True
  AutoScroll = True
  Caption = 'Form28'
  Color = clBtnFace
  Font.Charset = DEFAULT_CHARSET
  Font.Color = clWindowText
  Font.Height = -11
  Font.Name = 'Tahoma'
  Font.Style = []
  Menu = MainMenu1
  OldCreateOrder = False
  OnCreate = FormCreate
  PixelsPerInch = 96
  TextHeight = 13
  object Image1: TImage
    Left = 0
    Top = 0
    Width = 105
    Height = 105
    OnMouseDown = Image1MouseDown
    OnMouseMove = Image1MouseMove
  end
  object Image2: TImage
    Left = 111
    Top = 0
    Width = 105
    Height = 105
    OnMouseDown = Image2MouseDown
    OnMouseMove = Image2MouseMove
    OnMouseUp = Image2MouseUp
  end
  object Image3: TImage
    Left = 222
    Top = 0
    Width = 105
    Height = 105
    OnMouseDown = Image3MouseDown
    OnMouseMove = Image3MouseMove
    OnMouseUp = Image3MouseUp
  end
  object Image4: TImage
    Left = 333
    Top = 0
    Width = 105
    Height = 105
    OnMouseDown = Image4MouseDown
    OnMouseMove = Image4MouseMove
    OnMouseUp = Image4MouseUp
  end
  object Image5: TImage
    Left = 444
    Top = 0
    Width = 105
    Height = 105
    OnMouseDown = Image5MouseDown
    OnMouseMove = Image5MouseMove
    OnMouseUp = Image5MouseUp
  end
  object Image6: TImage
    Left = 555
    Top = 0
    Width = 105
    Height = 105
  end
  object Image7: TImage
    Left = 0
    Top = 111
    Width = 105
    Height = 105
    OnMouseDown = Image7MouseDown
    OnMouseMove = Image7MouseMove
    OnMouseUp = Image7MouseUp
  end
  object Image8: TImage
    Left = 111
    Top = 111
    Width = 105
    Height = 105
  end
  object Image9: TImage
    Left = 222
    Top = 111
    Width = 105
    Height = 105
    OnMouseDown = Image9MouseDown
    OnMouseMove = Image9MouseMove
    OnMouseUp = Image9MouseUp
  end
  object MainMenu1: TMainMenu
    Left = 352
    Top = 80
    object MAP: TMenuItem
      Caption = 'MAP'
      object MAPOPTION1: TMenuItem
        Caption = 'MAP OPTION'
        OnClick = MAPOPTION1Click
      end
      object MAPSAVE1: TMenuItem
        Caption = 'MAP SAVE...'
        OnClick = MAPSAVE1Click
      end
    end
  end
  object PopupMenu1: TPopupMenu
    Left = 296
    Top = 80
    object SaveAs1: TMenuItem
      Caption = 'Save As..'
    end
    object Print1: TMenuItem
      Caption = 'Print'
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
    Left = 48
    Top = 48
  end
end
