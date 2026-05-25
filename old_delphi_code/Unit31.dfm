object Form31: TForm31
  Left = 153
  Top = 139
  Caption = 'Form31'
  ClientHeight = 384
  ClientWidth = 680
  Color = clBtnFace
  Font.Charset = DEFAULT_CHARSET
  Font.Color = clWindowText
  Font.Height = -11
  Font.Name = 'MS Sans Serif'
  Font.Style = []
  OldCreateOrder = False
  OnClose = FormClose
  OnCreate = FormCreate
  PixelsPerInch = 96
  TextHeight = 13
  object Chart1: TChart
    Left = 8
    Top = 0
    Width = 673
    Height = 385
    BackWall.Brush.Color = clWhite
    BackWall.Brush.Style = bsClear
    Legend.ColorWidth = 25
    Legend.LegendStyle = lsSeries
    Legend.Shadow.HorizSize = 2
    Legend.Shadow.VertSize = 2
    Legend.Symbol.Width = 25
    Legend.TopPos = 38
    Legend.Visible = False
    MarginBottom = 5
    MarginLeft = 0
    MarginRight = 5
    MarginTop = 5
    Title.Text.Strings = (
      'Cross Section')
    BottomAxis.Title.Caption = 'X Values'
    DepthAxis.Visible = True
    LeftAxis.Inverted = True
    LeftAxis.MinorTickLength = 3
    LeftAxis.TickLength = 3
    LeftAxis.Title.Caption = 'Depth'
    View3D = False
    BevelOuter = bvNone
    BevelWidth = 0
    TabOrder = 0
    PrintMargins = (
      15
      21
      15
      21)
    ColorPaletteIndex = 13
    object Label1: TLabel
      Left = 24
      Top = 8
      Width = 15
      Height = 24
      Caption = 'A'
      Font.Charset = ARABIC_CHARSET
      Font.Color = clWindowText
      Font.Height = -21
      Font.Name = 'Times New Roman'
      Font.Style = [fsBold]
      ParentFont = False
    end
    object Label2: TLabel
      Left = 636
      Top = 8
      Width = 15
      Height = 24
      Caption = 'B'
      Font.Charset = ARABIC_CHARSET
      Font.Color = clWindowText
      Font.Height = -21
      Font.Name = 'Times New Roman'
      Font.Style = [fsBold]
      ParentFont = False
    end
    object Series1: TLineSeries
      Marks.Arrow.Visible = True
      Marks.Callout.Brush.Color = clBlack
      Marks.Callout.Arrow.Visible = True
      Marks.Emboss.Color = 8487297
      Marks.Shadow.Color = 8553090
      Marks.Style = smsXValue
      Marks.Visible = False
      SeriesColor = clRed
      Dark3D = False
      LinePen.Color = clRed
      Pointer.Brush.Gradient.EndColor = clRed
      Pointer.Gradient.EndColor = clRed
      Pointer.InflateMargins = True
      Pointer.Style = psRectangle
      Pointer.Visible = False
      XValues.Name = 'X'
      XValues.Order = loAscending
      YValues.Name = 'Y'
      YValues.Order = loNone
    end
    object Series2: TAreaSeries
      Marks.Arrow.Visible = True
      Marks.Callout.Brush.Color = clBlack
      Marks.Callout.Arrow.Visible = True
      Marks.Visible = False
      SeriesColor = clGreen
      DrawArea = True
      Pointer.Brush.Gradient.EndColor = clGreen
      Pointer.Gradient.EndColor = clGreen
      Pointer.InflateMargins = True
      Pointer.Style = psRectangle
      Pointer.Visible = False
      XValues.Name = 'X'
      XValues.Order = loAscending
      YValues.Name = 'Y'
      YValues.Order = loNone
    end
  end
end
