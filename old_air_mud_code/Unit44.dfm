object Form44: TForm44
  Left = 0
  Top = 0
  Caption = 'REPORTING MENU'
  ClientHeight = 451
  ClientWidth = 722
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
  object PageControl1: TPageControl
    Left = 0
    Top = 0
    Width = 722
    Height = 451
    ActivePage = TabSheet3
    Align = alClient
    TabOrder = 0
    OnResize = PageControl1Resize
    object TabSheet3: TTabSheet
      Caption = 'TOTAL DATA TABLE'
      ImageIndex = 2
      object Splitter1: TSplitter
        Left = 0
        Top = 221
        Width = 714
        Height = 3
        Cursor = crVSplit
        Align = alBottom
        ExplicitTop = 374
      end
      object StringGrid3: TStringGrid
        Left = 0
        Top = 0
        Width = 714
        Height = 166
        Align = alClient
        ColCount = 8
        DefaultColWidth = 85
        FixedCols = 0
        RowCount = 100
        Options = [goFixedVertLine, goFixedHorzLine, goVertLine, goHorzLine, goRangeSelect, goEditing]
        TabOrder = 0
      end
      object StringGrid4: TStringGrid
        Left = 0
        Top = 166
        Width = 714
        Height = 55
        Align = alBottom
        ColCount = 8
        DefaultColWidth = 85
        FixedCols = 0
        RowCount = 2
        TabOrder = 1
        Visible = False
        OnDrawCell = StringGrid4DrawCell
        OnKeyUp = StringGrid4KeyUp
        ColWidths = (
          85
          85
          85
          85
          85
          85
          85
          85)
      end
      object ComboBox1: TComboBox
        Left = 72
        Top = 200
        Width = 145
        Height = 21
        ItemIndex = 0
        TabOrder = 2
        Text = 'STRG'
        Visible = False
        OnCloseUp = ComboBox1CloseUp
        Items.Strings = (
          'STRG'
          'ANLS')
      end
      object StringGrid5: TStringGrid
        Left = 0
        Top = 224
        Width = 714
        Height = 199
        Align = alBottom
        ColCount = 8
        DefaultColWidth = 85
        FixedCols = 0
        TabOrder = 3
        ColWidths = (
          85
          85
          85
          85
          85
          85
          85
          85)
      end
    end
    object TabSheet1: TTabSheet
      Caption = 'PRESSURE V.S. DEPTH'
      object Panel1: TPanel
        Left = 0
        Top = 0
        Width = 408
        Height = 423
        Align = alClient
        TabOrder = 0
        object Chart1: TChart
          Left = 1
          Top = 1
          Width = 406
          Height = 421
          Legend.Visible = False
          Title.Text.Strings = (
            'PRESSURE V.S. DEPTH')
          BottomAxis.Title.Caption = '2'
          Chart3DPercent = 1
          LeftAxis.Inverted = True
          LeftAxis.Title.Caption = '1'
          View3D = False
          Zoom.Animated = True
          Align = alClient
          AutoSize = True
          TabOrder = 0
          OnMouseDown = Chart1MouseDown
          DefaultCanvas = 'TGDIPlusCanvas'
          ColorPaletteIndex = 13
          object Series1: TLineSeries
            Brush.BackColor = clDefault
            LinePen.Color = 10708548
            Pointer.Brush.Gradient.EndColor = 10708548
            Pointer.Gradient.EndColor = 10708548
            Pointer.InflateMargins = True
            Pointer.Style = psRectangle
            XValues.Name = 'X'
            XValues.Order = loNone
            YValues.Name = 'Y'
            YValues.Order = loNone
            object TSmoothingFunction
              CalcByValue = False
              Period = 1.000000000000000000
              Factor = 8
            end
          end
          object Series2: TLineSeries
            Brush.BackColor = clDefault
            LinePen.Color = 3513587
            Pointer.Brush.Gradient.EndColor = 3513587
            Pointer.Gradient.EndColor = 3513587
            Pointer.InflateMargins = True
            Pointer.Style = psRectangle
            XValues.Name = 'X'
            XValues.Order = loNone
            YValues.Name = 'Y'
            YValues.Order = loNone
            object TSmoothingFunction
              CalcByValue = False
              Period = 1.000000000000000000
              Factor = 8
            end
          end
        end
      end
      object Panel2: TPanel
        Left = 408
        Top = 0
        Width = 306
        Height = 423
        Align = alRight
        TabOrder = 1
        object StringGrid6: TStringGrid
          Left = 1
          Top = 37
          Width = 304
          Height = 385
          Align = alClient
          ColCount = 4
          DefaultColWidth = 70
          FixedCols = 0
          RowCount = 500
          Options = [goFixedVertLine, goFixedHorzLine, goVertLine, goHorzLine, goRangeSelect, goRowSelect]
          TabOrder = 0
          OnSelectCell = StringGrid6SelectCell
          RowHeights = (
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24
            24)
        end
        object GroupBox1: TGroupBox
          Left = 1
          Top = 1
          Width = 304
          Height = 36
          Align = alTop
          Caption = 'DRAW:'
          TabOrder = 1
          object CheckBox1: TCheckBox
            Left = 9
            Top = 13
            Width = 132
            Height = 17
            Caption = 'PRESSURE V.S. DEPTH'
            Checked = True
            State = cbChecked
            TabOrder = 0
            OnClick = CheckBox1Click
          end
          object CheckBox2: TCheckBox
            Left = 148
            Top = 13
            Width = 114
            Height = 17
            Caption = 'DEN. P V.S. DEPTH'
            Checked = True
            State = cbChecked
            TabOrder = 1
            OnClick = CheckBox2Click
          end
        end
      end
    end
    object TabSheet2: TTabSheet
      Caption = 'FLOW RATE AND KINETIC DEN.'
      ImageIndex = 1
      object Panel3: TPanel
        Left = 408
        Top = 0
        Width = 306
        Height = 423
        Align = alRight
        TabOrder = 0
        object Panel5: TPanel
          Left = -1
          Top = 1
          Width = 306
          Height = 421
          Align = alRight
          TabOrder = 0
          object GroupBox2: TGroupBox
            Left = 1
            Top = 1
            Width = 304
            Height = 64
            Align = alTop
            Caption = 'DRAW:'
            TabOrder = 0
            object CheckBox3: TCheckBox
              Left = 10
              Top = 13
              Width = 132
              Height = 17
              Caption = 'FLOW RATE'
              Checked = True
              State = cbChecked
              TabOrder = 0
              OnClick = CheckBox3Click
            end
            object CheckBox4: TCheckBox
              Left = 9
              Top = 36
              Width = 135
              Height = 17
              Caption = 'KINETIC DEN.'
              Checked = True
              State = cbChecked
              TabOrder = 1
              OnClick = CheckBox4Click
            end
            object CheckBox5: TCheckBox
              Left = 168
              Top = 13
              Width = 125
              Height = 17
              Caption = 'STRING KINETIC DEN.'
              Checked = True
              State = cbChecked
              TabOrder = 2
              OnClick = CheckBox5Click
            end
            object CheckBox6: TCheckBox
              Left = 168
              Top = 36
              Width = 97
              Height = 17
              Caption = 'ANNULUS KINETIC DEN.'
              Checked = True
              State = cbChecked
              TabOrder = 3
              OnClick = CheckBox6Click
            end
          end
          object StringGrid7: TStringGrid
            Left = 1
            Top = 65
            Width = 304
            Height = 355
            Align = alClient
            ColCount = 4
            DefaultColWidth = 70
            FixedCols = 0
            RowCount = 500
            Options = [goFixedVertLine, goFixedHorzLine, goVertLine, goHorzLine, goRangeSelect, goRowSelect]
            TabOrder = 1
            OnSelectCell = StringGrid7SelectCell
            RowHeights = (
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24
              24)
          end
        end
      end
      object Panel4: TPanel
        Left = 0
        Top = 0
        Width = 408
        Height = 423
        Align = alClient
        TabOrder = 1
        object Chart2: TChart
          Left = 1
          Top = 1
          Width = 406
          Height = 421
          Legend.Visible = False
          Title.Text.Strings = (
            'PRESSURE V.S. DEPTH')
          Chart3DPercent = 1
          LeftAxis.Inverted = True
          View3D = False
          Zoom.Animated = True
          Align = alClient
          AutoSize = True
          TabOrder = 0
          OnMouseDown = Chart2MouseDown
          DefaultCanvas = 'TGDIPlusCanvas'
          ColorPaletteIndex = 13
          object Series3: TLineSeries
            Brush.BackColor = clDefault
            LinePen.Color = 10708548
            Pointer.Brush.Gradient.EndColor = 10708548
            Pointer.Gradient.EndColor = 10708548
            Pointer.InflateMargins = True
            Pointer.Style = psRectangle
            XValues.Name = 'X'
            XValues.Order = loNone
            YValues.Name = 'Y'
            YValues.Order = loNone
            object TSmoothingFunction
              CalcByValue = False
              Period = 1.000000000000000000
              Factor = 8
            end
          end
          object Series4: TLineSeries
            Brush.BackColor = clDefault
            LinePen.Color = 3513587
            Pointer.Brush.Gradient.EndColor = 3513587
            Pointer.Gradient.EndColor = 3513587
            Pointer.InflateMargins = True
            Pointer.Style = psRectangle
            XValues.Name = 'X'
            XValues.Order = loNone
            YValues.Name = 'Y'
            YValues.Order = loNone
            object TSmoothingFunction
              CalcByValue = False
              Period = 1.000000000000000000
              Factor = 8
            end
          end
        end
      end
    end
    object TabSheet4: TTabSheet
      Caption = 'ENERGY CONSUMPTIONS'
      ImageIndex = 3
      object Memo1: TMemo
        Left = 0
        Top = 0
        Width = 714
        Height = 423
        Align = alClient
        Lines.Strings = (
          
            'SHAFT POWER = NS x (K/(K-1)) x P1 x Q1 x [POWER((P2/P1),K/(K-1))' +
            '-1]'
          ''
          'OR'
          ''
          'SHAFT POWER = NS x (K/(K-1)) x P1 x Q1 x [T2/T1-1]'
          
            '----------------------------------------------------------------' +
            '--------------------------'
          'THAT CAN BE CALCULATED AS BELOW:'
          '')
        TabOrder = 0
      end
    end
  end
  object MainMenu1: TMainMenu
    Left = 464
    Top = 128
    object FILE1: TMenuItem
      Caption = 'FILE'
      object EXPORTTOEXCELFILE1: TMenuItem
        Caption = 'PRINT'
      end
      object xls1: TMenuItem
        Caption = 'EXIT'
        OnClick = xls1Click
      end
    end
    object OPTIONS1: TMenuItem
      Caption = 'OPTIONS'
      object VIEW1: TMenuItem
        Caption = 'VIEW'
        object ARBITPOINT1: TMenuItem
          Caption = 'ARBIT. POINT'
          OnClick = ARBITPOINT1Click
        end
        object DETAILEDPARTS1: TMenuItem
          Caption = 'DETAILED PARTS'
          Checked = True
          OnClick = DETAILEDPARTS1Click
        end
      end
      object UNITS1: TMenuItem
        Caption = 'UNITS'
        OnClick = UNITS1Click
      end
    end
  end
end
