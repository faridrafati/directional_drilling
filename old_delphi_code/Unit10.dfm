object Form10: TForm10
  Left = 0
  Top = 0
  Caption = 'Form10'
  ClientHeight = 251
  ClientWidth = 402
  Color = clBtnFace
  Font.Charset = DEFAULT_CHARSET
  Font.Color = clWindowText
  Font.Height = -11
  Font.Name = 'Tahoma'
  Font.Style = []
  OldCreateOrder = False
  OnCreate = FormCreate
  OnShow = FormShow
  PixelsPerInch = 96
  TextHeight = 13
  object Image1: TImage
    Left = 200
    Top = 8
    Width = 166
    Height = 233
  end
  object Chart1: TChart
    Left = 372
    Top = 8
    Width = 320
    Height = 350
    Legend.Symbol.Visible = False
    Legend.Visible = False
    PrintProportional = False
    Title.Text.Strings = (
      'TVD V.S. V-SEC.')
    BottomAxis.Automatic = False
    BottomAxis.AutomaticMinimum = False
    BottomAxis.Minimum = -100.000000000000000000
    DepthAxis.Automatic = False
    DepthAxis.AutomaticMaximum = False
    DepthAxis.AutomaticMinimum = False
    DepthAxis.Maximum = 4.129999999999941000
    DepthAxis.Minimum = 3.129999999999940000
    DepthTopAxis.Automatic = False
    DepthTopAxis.AutomaticMaximum = False
    DepthTopAxis.AutomaticMinimum = False
    DepthTopAxis.Maximum = 4.129999999999941000
    DepthTopAxis.Minimum = 3.129999999999940000
    LeftAxis.Automatic = False
    LeftAxis.AutomaticMaximum = False
    LeftAxis.AutomaticMinimum = False
    LeftAxis.Inverted = True
    LeftAxis.Maximum = 1359.274999999991000000
    LeftAxis.Minimum = 1066.774999999990000000
    RightAxis.Automatic = False
    RightAxis.AutomaticMaximum = False
    RightAxis.AutomaticMinimum = False
    Shadow.Color = clWhite
    View3D = False
    TabOrder = 5
    Visible = False
    PrintMargins = (
      25
      19
      29
      13)
    ColorPaletteIndex = 13
    object Series1: TLineSeries
      Marks.Arrow.Visible = True
      Marks.Callout.Brush.Color = clBlack
      Marks.Callout.Arrow.Visible = True
      Marks.Visible = False
      LinePen.Color = 10708548
      Pointer.InflateMargins = True
      Pointer.Style = psRectangle
      Pointer.Visible = False
      XValues.Name = 'X'
      XValues.Order = loAscending
      YValues.Name = 'Y'
      YValues.Order = loNone
    end
  end
  object Chart2: TChart
    Left = 372
    Top = 119
    Width = 320
    Height = 331
    Legend.Symbol.Visible = False
    Legend.Visible = False
    Title.Text.Strings = (
      'N-S V.S. E-W')
    BottomAxis.Automatic = False
    BottomAxis.AutomaticMinimum = False
    BottomAxis.Minimum = -100.000000000000000000
    DepthAxis.Automatic = False
    DepthAxis.AutomaticMaximum = False
    DepthAxis.AutomaticMinimum = False
    DepthAxis.Maximum = 0.500000000000086600
    DepthAxis.Minimum = -0.499999999999906500
    DepthTopAxis.Automatic = False
    DepthTopAxis.AutomaticMaximum = False
    DepthTopAxis.AutomaticMinimum = False
    DepthTopAxis.Maximum = 0.500000000000086600
    DepthTopAxis.Minimum = -0.499999999999906500
    LeftAxis.Automatic = False
    LeftAxis.AutomaticMaximum = False
    LeftAxis.AutomaticMinimum = False
    LeftAxis.Maximum = 297.499999999989400000
    LeftAxis.Minimum = 4.999999999990086000
    RightAxis.Automatic = False
    RightAxis.AutomaticMaximum = False
    RightAxis.AutomaticMinimum = False
    Shadow.Color = clWhite
    View3D = False
    TabOrder = 6
    Visible = False
    ColorPaletteIndex = 13
    object Series2: TLineSeries
      Marks.Arrow.Visible = True
      Marks.Callout.Brush.Color = clBlack
      Marks.Callout.Arrow.Visible = True
      Marks.Visible = False
      LinePen.Color = 10708548
      Pointer.InflateMargins = True
      Pointer.Style = psRectangle
      Pointer.Visible = False
      XValues.Name = 'X'
      XValues.Order = loAscending
      YValues.Name = 'Y'
      YValues.Order = loNone
    end
  end
  object BitBtn1: TBitBtn
    Left = 9
    Top = 127
    Width = 152
    Height = 34
    Caption = '3D VIEW'
    DoubleBuffered = True
    ParentDoubleBuffered = False
    TabOrder = 0
    OnClick = BitBtn1Click
    OnMouseEnter = BitBtn1MouseEnter
  end
  object BitBtn2: TBitBtn
    Left = 9
    Top = 8
    Width = 152
    Height = 34
    Caption = 'TVD-VSC'
    DoubleBuffered = True
    ParentDoubleBuffered = False
    TabOrder = 1
    OnClick = BitBtn2Click
    OnMouseEnter = BitBtn2MouseEnter
  end
  object BitBtn3: TBitBtn
    Left = 9
    Top = 47
    Width = 152
    Height = 34
    Caption = 'NS-EW'
    DoubleBuffered = True
    ParentDoubleBuffered = False
    TabOrder = 2
    OnClick = BitBtn3Click
    OnMouseEnter = BitBtn3MouseEnter
  end
  object BitBtn4: TBitBtn
    Left = 9
    Top = 87
    Width = 152
    Height = 34
    Caption = '2D VIEW'
    DoubleBuffered = True
    ParentDoubleBuffered = False
    TabOrder = 3
    OnClick = BitBtn4Click
    OnMouseEnter = BitBtn4MouseEnter
  end
  object BitBtn5: TBitBtn
    Left = 9
    Top = 167
    Width = 152
    Height = 34
    Caption = 'REPORT'
    DoubleBuffered = True
    ParentDoubleBuffered = False
    TabOrder = 4
    OnClick = BitBtn5Click
  end
  object Button1: TButton
    Left = 9
    Top = 207
    Width = 152
    Height = 34
    Caption = 'Excel'
    TabOrder = 7
    OnClick = Button1Click
  end
  object ADOTable1: TADOTable
    Connection = Form01.ADOConnection1
    Left = 144
    Top = 8
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
    OnPrint = RvSystem1Print
    OnBeforePrint = RvSystem1BeforePrint
    OnPrintHeader = RvSystem1PrintHeader
    OnPrintFooter = RvSystem1PrintFooter
    Left = 8
    Top = 8
  end
  object RvSystem2: TRvSystem
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
    OnPrint = RvSystem2Print
    Left = 48
    Top = 8
  end
  object RvSystem3: TRvSystem
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
    OnPrint = RvSystem3Print
    Left = 88
    Top = 8
  end
  object SaveDialog1: TSaveDialog
    Filter = 'XLS|*.XLS'
    FilterIndex = 0
    Left = 192
    Top = 16
  end
end
