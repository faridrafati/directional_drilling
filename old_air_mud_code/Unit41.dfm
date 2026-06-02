object Form41: TForm41
  Left = 320
  Top = 100
  Caption = 'Air & Gas Drilling'
  ClientHeight = 547
  ClientWidth = 750
  Color = clBtnFace
  Font.Charset = ANSI_CHARSET
  Font.Color = clWindowText
  Font.Height = -13
  Font.Name = 'Gloucester MT Extra Condensed'
  Font.Style = []
  Menu = MainMenu1
  OldCreateOrder = False
  Position = poDesigned
  OnClose = FormClose
  OnCreate = FormCreate
  OnResize = FormResize
  PixelsPerInch = 96
  TextHeight = 16
  object PageControl1: TPageControl
    Left = 0
    Top = 0
    Width = 750
    Height = 547
    ActivePage = TabSheet1
    Align = alClient
    Font.Charset = ANSI_CHARSET
    Font.Color = clWindowText
    Font.Height = -15
    Font.Name = 'Gloucester MT Extra Condensed'
    Font.Style = []
    ParentFont = False
    TabOrder = 0
    OnResize = PageControl1Resize
    object TabSheet1: TTabSheet
      Caption = 'WELL HEADER'
      object Panel8: TPanel
        Left = 0
        Top = 0
        Width = 527
        Height = 514
        Align = alClient
        Caption = 'Panel8'
        TabOrder = 0
        object Panel2: TPanel
          Left = 1
          Top = 1
          Width = 525
          Height = 177
          Align = alTop
          Color = clMedGray
          ParentBackground = False
          TabOrder = 0
          object Label2: TLabel
            Left = 13
            Top = 74
            Width = 61
            Height = 18
            Caption = 'CONTRACTOR'
          end
          object Label3: TLabel
            Left = 9
            Top = 108
            Width = 50
            Height = 18
            Caption = 'OPERATOR'
          end
          object Label4: TLabel
            Left = 9
            Top = 142
            Width = 65
            Height = 18
            Caption = 'PREPARED BY'
          end
          object Label5: TLabel
            Left = 273
            Top = 40
            Width = 46
            Height = 18
            BiDiMode = bdRightToLeft
            Caption = 'LOCATION'
            Color = clFuchsia
            ParentBiDiMode = False
            ParentColor = False
          end
          object Label6: TLabel
            Left = 273
            Top = 74
            Width = 44
            Height = 18
            Caption = 'RIG NAME'
          end
          object Label7: TLabel
            Left = 273
            Top = 108
            Width = 65
            Height = 18
            Caption = 'PREPARE FOR'
          end
          object Label8: TLabel
            Left = 273
            Top = 142
            Width = 91
            Height = 18
            Caption = 'PREPARE COMPANY'
          end
          object Label1: TLabel
            Left = 9
            Top = 40
            Width = 54
            Height = 18
            Caption = 'WELL NAME'
          end
          object DBEdit1: TDBEdit
            Left = 121
            Top = 37
            Width = 121
            Height = 26
            BevelInner = bvNone
            BevelWidth = 2
            BiDiMode = bdLeftToRight
            Color = clYellow
            DataSource = DataSource1
            ParentBiDiMode = False
            TabOrder = 0
          end
          object DBEdit2: TDBEdit
            Left = 121
            Top = 73
            Width = 121
            Height = 26
            Color = clAqua
            DataSource = DataSource1
            TabOrder = 1
            OnExit = DBEdit2Exit
          end
          object DBEdit3: TDBEdit
            Left = 121
            Top = 105
            Width = 121
            Height = 26
            Color = clAqua
            DataSource = DataSource1
            TabOrder = 2
            OnExit = DBEdit3Exit
          end
          object DBEdit4: TDBEdit
            Left = 121
            Top = 141
            Width = 121
            Height = 26
            Color = clAqua
            DataSource = DataSource1
            TabOrder = 3
            OnExit = DBEdit4Exit
          end
          object DBEdit5: TDBEdit
            Left = 392
            Top = 37
            Width = 121
            Height = 26
            Color = clAqua
            DataSource = DataSource1
            TabOrder = 4
            OnExit = DBEdit5Exit
          end
          object DBEdit6: TDBEdit
            Left = 392
            Top = 71
            Width = 121
            Height = 26
            Color = clAqua
            DataSource = DataSource1
            TabOrder = 5
            OnExit = DBEdit6Exit
          end
          object DBEdit7: TDBEdit
            Left = 392
            Top = 105
            Width = 121
            Height = 26
            Color = clAqua
            DataSource = DataSource1
            TabOrder = 6
            OnExit = DBEdit7Exit
          end
          object DBEdit8: TDBEdit
            Left = 392
            Top = 139
            Width = 121
            Height = 26
            Color = clAqua
            DataSource = DataSource1
            TabOrder = 7
            OnExit = DBEdit8Exit
          end
          object Button4: TButton
            Left = 121
            Top = 6
            Width = 60
            Height = 25
            Caption = 'ADD'
            TabOrder = 8
            OnClick = Button4Click
          end
          object Button5: TButton
            Left = 179
            Top = 6
            Width = 63
            Height = 25
            Caption = 'DEL'
            TabOrder = 9
            OnClick = Button5Click
          end
          object COMBOBOX4: TComboBox
            Left = 121
            Top = 37
            Width = 121
            Height = 26
            TabOrder = 10
            OnCloseUp = COMBOBOX4CloseUp
            OnDropDown = COMBOBOX4DropDown
          end
        end
        object Panel3: TPanel
          Left = 1
          Top = 307
          Width = 525
          Height = 206
          Align = alClient
          Color = clGrayText
          ParentBackground = False
          TabOrder = 1
          object Label10: TLabel
            Left = 67
            Top = 88
            Width = 114
            Height = 18
            Caption = 'RISER PUMP FLOW RATE '
          end
          object Label9: TLabel
            Left = 40
            Top = 48
            Width = 165
            Height = 18
            Caption = 'EQUIVALENT 3" LENGHT OF PIPE IN '
            Color = clYellow
            ParentColor = False
          end
          object DBNavigator2: TDBNavigator
            Left = 248
            Top = 6
            Width = 240
            Height = 25
            DataSource = DataSource1
            TabOrder = 0
            Visible = False
          end
          object Edit2: TEdit
            Left = 248
            Top = 77
            Width = 121
            Height = 26
            Color = clAqua
            NumbersOnly = True
            TabOrder = 1
            Text = '0'
            OnChange = Edit2Change
          end
          object Edit1: TEdit
            Left = 248
            Top = 45
            Width = 121
            Height = 26
            Color = clAqua
            NumbersOnly = True
            ReadOnly = True
            TabOrder = 2
            Text = '0'
            OnChange = Edit1Change
            OnExit = Edit1Exit
          end
        end
        object StringGrid3: TStringGrid
          Left = 1
          Top = 178
          Width = 525
          Height = 129
          Align = alTop
          BiDiMode = bdLeftToRight
          FixedCols = 0
          Options = [goFixedVertLine, goFixedHorzLine, goVertLine, goHorzLine, goRangeSelect, goRowSelect]
          ParentBiDiMode = False
          TabOrder = 2
          OnSelectCell = StringGrid3SelectCell
        end
      end
      object Panel9: TPanel
        Left = 527
        Top = 0
        Width = 215
        Height = 514
        Align = alRight
        Caption = 'Panel9'
        TabOrder = 1
        object StringGrid8: TStringGrid
          Left = 1
          Top = 1
          Width = 213
          Height = 376
          Align = alTop
          ColCount = 2
          DefaultColWidth = 104
          RowCount = 14
          FixedRows = 0
          Options = [goFixedVertLine, goFixedHorzLine, goVertLine, goHorzLine, goRangeSelect, goColSizing, goEditing]
          TabOrder = 0
          OnKeyUp = StringGrid8KeyUp
        end
        object RadioGroup2: TRadioGroup
          Left = 1
          Top = 377
          Width = 213
          Height = 80
          Align = alTop
          Caption = 'FLUID TYPE:'
          Columns = 2
          ItemIndex = 3
          Items.Strings = (
            'GAS'
            'FOAM'
            'STABLE FOAM'
            'AIREATED MUD')
          TabOrder = 1
          OnClick = RadioGroup2Click
        end
        object Button10: TButton
          Left = 34
          Top = 463
          Width = 159
          Height = 42
          Caption = 'CALCLATE'
          TabOrder = 2
          OnClick = Button10Click
        end
      end
    end
    object TabSheet3: TTabSheet
      Caption = 'DRILL STRING'
      ImageIndex = 2
      object StringGrid7: TStringGrid
        Left = 0
        Top = 97
        Width = 557
        Height = 417
        Align = alClient
        ColCount = 6
        DefaultColWidth = 84
        FixedCols = 0
        RowCount = 300
        PopupMenu = PopupMenu1
        TabOrder = 3
        OnDblClick = StringGrid7DblClick
        OnDrawCell = StringGrid7DrawCell
        OnSelectCell = StringGrid7SelectCell
        OnSetEditText = StringGrid7SetEditText
      end
      object Panel5: TPanel
        Left = 0
        Top = 0
        Width = 742
        Height = 97
        Align = alTop
        TabOrder = 0
        object Label16: TLabel
          Left = 16
          Top = 6
          Width = 34
          Height = 18
          Caption = 'Label16'
        end
        object Label18: TLabel
          Left = 16
          Top = 52
          Width = 34
          Height = 18
          Caption = 'Label18'
        end
        object Label17: TLabel
          Left = 284
          Top = 6
          Width = 52
          Height = 18
          Caption = 'Safty Factor'
        end
        object Label19: TLabel
          Left = 284
          Top = 52
          Width = 34
          Height = 18
          Caption = 'Label19'
        end
        object ComboBox9: TComboBox
          Left = 544
          Top = 52
          Width = 156
          Height = 26
          TabOrder = 0
          OnCloseUp = ComboBox9CloseUp
          OnDropDown = ComboBox9DropDown
        end
        object Button8: TButton
          Left = 544
          Top = 21
          Width = 75
          Height = 25
          Caption = 'ADD'
          TabOrder = 1
          OnClick = Button8Click
        end
        object Button9: TButton
          Left = 625
          Top = 21
          Width = 75
          Height = 25
          Caption = 'DELETE'
          TabOrder = 2
          OnClick = Button9Click
        end
        object Edit6: TEdit
          Left = 149
          Top = 3
          Width = 121
          Height = 26
          NumbersOnly = True
          TabOrder = 3
          Text = '0'
          OnChange = Edit6Change
        end
        object Edit8: TEdit
          Left = 149
          Top = 49
          Width = 121
          Height = 26
          NumbersOnly = True
          ReadOnly = True
          TabOrder = 4
          Text = '0'
          OnChange = Edit8Change
        end
        object Edit7: TEdit
          Left = 405
          Top = 3
          Width = 121
          Height = 26
          NumbersOnly = True
          TabOrder = 5
          Text = '15'
          OnChange = Edit7Change
        end
        object Edit9: TEdit
          Left = 405
          Top = 49
          Width = 121
          Height = 26
          ReadOnly = True
          TabOrder = 6
          Text = '0'
        end
      end
      object Panel6: TPanel
        Left = 557
        Top = 97
        Width = 185
        Height = 417
        Align = alRight
        TabOrder = 1
      end
      object StringGrid6: TStringGrid
        Left = 32
        Top = 192
        Width = 446
        Height = 181
        DefaultColWidth = 84
        FixedCols = 0
        RowCount = 300
        Options = [goFixedVertLine, goFixedHorzLine, goVertLine, goHorzLine, goRangeSelect, goRowSelect]
        TabOrder = 2
        Visible = False
        OnDblClick = StringGrid6DblClick
        OnExit = StringGrid6Exit
        OnSelectCell = StringGrid6SelectCell
      end
      object ComboBox7: TComboBox
        Left = 64
        Top = 280
        Width = 145
        Height = 26
        ItemIndex = 0
        TabOrder = 4
        Text = 'DRILL PIPE'
        Visible = False
        OnCloseUp = ComboBox7CloseUp
        OnDropDown = ComboBox7DropDown
        Items.Strings = (
          'DRILL PIPE'
          'HW PIPE'
          'DRILL COLLAR')
      end
      object ComboBox8: TComboBox
        Left = 280
        Top = 296
        Width = 145
        Height = 26
        ItemIndex = 0
        TabOrder = 5
        Text = 'YES'
        Visible = False
        OnCloseUp = ComboBox8CloseUp
        Items.Strings = (
          'YES'
          'NO')
      end
    end
    object TabSheet2: TTabSheet
      Caption = 'CASING'
      ImageIndex = 1
      object StringGrid5: TStringGrid
        Left = 0
        Top = 53
        Width = 593
        Height = 461
        Align = alClient
        ColCount = 7
        DefaultColWidth = 77
        FixedCols = 0
        RowCount = 300
        PopupMenu = PopupMenu1
        TabOrder = 4
        OnDblClick = StringGrid5DblClick
        OnDrawCell = StringGrid5DrawCell
        OnEnter = StringGrid5Enter
        OnExit = StringGrid5Exit
        OnSelectCell = StringGrid5SelectCell
        OnSetEditText = StringGrid5SetEditText
      end
      object Panel1: TPanel
        Left = 593
        Top = 53
        Width = 149
        Height = 461
        Align = alRight
        Caption = 'Panel1'
        TabOrder = 0
      end
      object Panel4: TPanel
        Left = 0
        Top = 0
        Width = 742
        Height = 53
        Align = alTop
        TabOrder = 1
        object ComboBox6: TComboBox
          Left = 568
          Top = 8
          Width = 145
          Height = 26
          TabOrder = 0
          OnCloseUp = ComboBox6CloseUp
          OnDropDown = ComboBox6DropDown
        end
        object Button6: TButton
          Left = 406
          Top = 8
          Width = 75
          Height = 25
          Caption = 'ADD'
          TabOrder = 1
          OnClick = Button6Click
        end
        object Button7: TButton
          Left = 487
          Top = 8
          Width = 75
          Height = 25
          Caption = 'DELETE'
          TabOrder = 2
          OnClick = Button7Click
        end
      end
      object ComboBox5: TComboBox
        Left = 96
        Top = 304
        Width = 145
        Height = 26
        ItemIndex = 0
        TabOrder = 2
        Text = 'K-55'
        Visible = False
        OnCloseUp = ComboBox5CloseUp
        Items.Strings = (
          'K-55'
          'J-55'
          'C-75'
          'N-80'
          'L-80'
          'T-95'
          'P-110'
          'C-110'
          'Q-125'
          'V-150')
      end
      object StringGrid4: TStringGrid
        Left = 3
        Top = 128
        Width = 332
        Height = 177
        ColCount = 4
        DefaultColWidth = 77
        FixedCols = 0
        RowCount = 234
        Options = [goFixedVertLine, goFixedHorzLine, goVertLine, goHorzLine, goRangeSelect, goRowSelect]
        TabOrder = 3
        Visible = False
        OnDblClick = StringGrid4DblClick
        OnSelectCell = StringGrid4SelectCell
      end
    end
    object TabSheet4: TTabSheet
      Caption = 'BIT RUN MWD/DHM'
      ImageIndex = 3
      object Label11: TLabel
        Left = 3
        Top = 104
        Width = 34
        Height = 18
        Caption = 'Bit Type'
      end
      object Label12: TLabel
        Left = 3
        Top = 132
        Width = 97
        Height = 18
        Caption = 'NO. of Variable Nozzles'
      end
      object Label13: TLabel
        Left = 3
        Top = 228
        Width = 101
        Height = 18
        Caption = 'MAX. PUMP PRESSURE'
      end
      object Label14: TLabel
        Left = 23
        Top = 328
        Width = 100
        Height = 18
        Caption = '% FLOW LOSS IN DHM'
      end
      object Label15: TLabel
        Left = 340
        Top = 19
        Width = 89
        Height = 18
        Caption = 'DRILL STRING NAME'
      end
      object ComboBox1: TComboBox
        Left = 106
        Top = 72
        Width = 133
        Height = 26
        Color = clAqua
        TabOrder = 0
        Text = 'ComboBox1'
        OnCloseUp = ComboBox1CloseUp
      end
      object ComboBox2: TComboBox
        Left = 106
        Top = 43
        Width = 133
        Height = 26
        Color = clAqua
        TabOrder = 1
        Text = 'ComboBox2'
        OnCloseUp = ComboBox2CloseUp
        OnDropDown = ComboBox2DropDown
      end
      object Button1: TButton
        Left = 3
        Top = 44
        Width = 75
        Height = 25
        Caption = 'ADD BIT'
        TabOrder = 2
        OnClick = Button1Click
      end
      object Button2: TButton
        Left = 3
        Top = 73
        Width = 75
        Height = 25
        Caption = 'DELETE BIT'
        TabOrder = 3
        OnClick = Button2Click
      end
      object DBEdit9: TDBEdit
        Left = 106
        Top = 101
        Width = 133
        Height = 26
        Color = clAqua
        DataField = 'BitType'
        DataSource = DataSource4
        TabOrder = 4
      end
      object DBEdit10: TDBEdit
        Left = 106
        Top = 129
        Width = 133
        Height = 26
        Color = clAqua
        DataField = 'NumberOfVariableNozzles'
        DataSource = DataSource4
        TabOrder = 5
      end
      object Button3: TButton
        Left = 106
        Top = 188
        Width = 134
        Height = 25
        Caption = 'ADV. NZL SELECT'
        Enabled = False
        TabOrder = 6
        OnClick = Button3Click
      end
      object DBEdit11: TDBEdit
        Left = 106
        Top = 157
        Width = 133
        Height = 26
        Color = clAqua
        DataField = 'TotalNumberofNozzles'
        DataSource = DataSource4
        TabOrder = 7
        OnChange = DBEdit11Change
      end
      object Edit3: TEdit
        Left = 152
        Top = 225
        Width = 88
        Height = 26
        Color = clAqua
        NumbersOnly = True
        TabOrder = 8
        Text = '0'
        OnExit = Edit3Exit
      end
      object DBCheckBox1: TDBCheckBox
        Left = 3
        Top = 252
        Width = 175
        Height = 17
        Caption = 'MWD PRESSURE DROP'
        DataField = 'MWDPRESSUREDROP'
        DataSource = DataSource4
        TabOrder = 9
      end
      object DBCheckBox2: TDBCheckBox
        Left = 3
        Top = 276
        Width = 143
        Height = 17
        Caption = 'DHM PRESSURE DROP'
        DataField = 'DHMPressureDrop'
        DataSource = DataSource4
        TabOrder = 10
      end
      object Edit4: TEdit
        Left = 152
        Top = 248
        Width = 88
        Height = 26
        Color = clAqua
        NumbersOnly = True
        TabOrder = 11
        Text = '0'
        OnExit = Edit4Exit
      end
      object Edit5: TEdit
        Left = 152
        Top = 272
        Width = 87
        Height = 26
        Color = clAqua
        NumbersOnly = True
        TabOrder = 12
        Text = '0'
        OnExit = Edit5Exit
      end
      object DBEdit12: TDBEdit
        Left = 176
        Top = 325
        Width = 121
        Height = 26
        DataField = 'PercFlowLoss'
        DataSource = DataSource4
        TabOrder = 13
      end
      object StringGrid1: TStringGrid
        Left = 336
        Top = 43
        Width = 306
        Height = 161
        BevelWidth = 5
        Color = clLime
        ColCount = 3
        Ctl3D = False
        DefaultColWidth = 100
        FixedColor = clMaroon
        RowCount = 6
        GradientEndColor = clRed
        GradientStartColor = clCaptionText
        GridLineWidth = 2
        Options = [goFixedVertLine, goFixedHorzLine, goVertLine, goHorzLine, goRangeSelect, goRowSizing, goEditing]
        ParentCtl3D = False
        TabOrder = 14
        OnKeyPress = StringGrid1KeyPress
        OnKeyUp = StringGrid1KeyUp
        RowHeights = (
          24
          24
          24
          24
          24
          24)
      end
      object ComboBox3: TComboBox
        Left = 497
        Top = 11
        Width = 145
        Height = 26
        Color = clAqua
        TabOrder = 15
        Text = 'ComboBox3'
      end
      object StringGrid2: TStringGrid
        Left = 336
        Top = 210
        Width = 309
        Height = 88
        BevelWidth = 2
        Color = clMenuText
        ColCount = 3
        DefaultColWidth = 100
        FixedColor = clBackground
        RowCount = 3
        GradientEndColor = clBlack
        GradientStartColor = clBlack
        GridLineWidth = 2
        Options = [goFixedVertLine, goFixedHorzLine, goVertLine, goHorzLine, goRangeSelect, goEditing]
        TabOrder = 16
        OnKeyUp = StringGrid2KeyUp
        RowHeights = (
          24
          24
          24)
      end
      object RadioGroup1: TRadioGroup
        Left = 3
        Top = 304
        Width = 301
        Height = 118
        Caption = 'FLOW REGIME'
        Color = clMoneyGreen
        ItemIndex = 0
        Items.Strings = (
          'LAMINAR FLOW REQUIRED AROUND DRILL PIPE'
          'LAMINAR FLOW REQUIRED AROUND BHA'
          'TURBULENT FLOW REQUIRED AROUND BHA')
        ParentBackground = False
        ParentColor = False
        TabOrder = 17
        OnExit = RadioGroup1Exit
      end
      object StringGrid12: TStringGrid
        Left = 336
        Top = 304
        Width = 306
        Height = 161
        BevelWidth = 5
        Color = clWhite
        ColCount = 2
        Ctl3D = False
        DefaultColWidth = 150
        FixedColor = clMedGray
        RowCount = 6
        FixedRows = 0
        GradientEndColor = clGray
        GridLineWidth = 2
        Options = [goFixedVertLine, goFixedHorzLine, goVertLine, goHorzLine, goRangeSelect, goRowSizing, goEditing]
        ParentCtl3D = False
        TabOrder = 18
        OnKeyUp = StringGrid12KeyUp
        RowHeights = (
          24
          24
          24
          24
          24
          24)
      end
    end
  end
  object MainMenu1: TMainMenu
    Left = 624
    Top = 8
    object File1: TMenuItem
      Caption = 'File'
      object New1: TMenuItem
        Caption = 'New'
        OnClick = New1Click
      end
      object Save1: TMenuItem
        Caption = 'Save'
        OnClick = Save1Click
      end
      object Saveas1: TMenuItem
        Caption = 'Save as'
        OnClick = Saveas1Click
      end
      object LOAD1: TMenuItem
        Caption = 'LOAD'
        OnClick = LOAD1Click
      end
      object Exit1: TMenuItem
        Caption = 'Exit'
        OnClick = Exit1Click
      end
    end
    object Options1: TMenuItem
      Caption = 'Options'
      object Units1: TMenuItem
        Caption = 'Units'
        OnClick = Units1Click
      end
    end
  end
  object ADOConnection1: TADOConnection
    LoginPrompt = False
    Mode = cmShareDenyNone
    Provider = 'Microsoft.Jet.OLEDB.4.0'
    Left = 624
    Top = 208
  end
  object TWELLHEADER: TADOTable
    Connection = ADOConnection1
    CursorLocation = clUseServer
    CursorType = ctStatic
    Left = 480
    Top = 64
  end
  object OpenDialog1: TOpenDialog
    Filter = 'DATABASE|*.mdb|ALL FILES|*.*'
    Left = 624
    Top = 320
  end
  object SaveDialog1: TSaveDialog
    DefaultExt = 'mdb'
    Filter = 'DATA BASE|*.MDB'
    Options = [ofReadOnly, ofOverwritePrompt, ofHideReadOnly, ofEnableSizing]
    Left = 616
    Top = 272
  end
  object DataSource1: TDataSource
    DataSet = TWELLHEADER
    Left = 432
    Top = 72
  end
  object TDRILLSTRING: TADOTable
    Connection = ADOConnection1
    Left = 584
    Top = 96
  end
  object TCASING: TADOTable
    Connection = ADOConnection1
    CursorLocation = clUseServer
    Left = 584
    Top = 136
  end
  object TBITRUN: TADOTable
    Connection = ADOConnection1
    CursorLocation = clUseServer
    CursorType = ctStatic
    TableName = 'BitRun'
    Left = 584
    Top = 176
  end
  object DataSource2: TDataSource
    DataSet = TDRILLSTRING
    Left = 544
    Top = 96
  end
  object DataSource3: TDataSource
    DataSet = TCASING
    Left = 544
    Top = 136
  end
  object DataSource4: TDataSource
    DataSet = TBITRUN
    Left = 536
    Top = 184
  end
  object DataSource5: TDataSource
    DataSet = teqlength
    Left = 448
    Top = 264
  end
  object teqlength: TADOTable
    Connection = ADOConnection1
    Left = 584
    Top = 216
  end
  object DataSource6: TDataSource
    DataSet = tbitsize
    Left = 544
    Top = 272
  end
  object tbitsize: TADOTable
    Connection = ADOConnection1
    CursorLocation = clUseServer
    CursorType = ctStatic
    TableName = 'Bit_Size'
    Left = 592
    Top = 272
  end
  object Tcasinge: TADOTable
    Connection = ADOConnection1
    CursorLocation = clUseServer
    TableName = 'CASINGE'
    Left = 592
    Top = 312
  end
  object PopupMenu1: TPopupMenu
    Left = 664
    Top = 128
    object DeleteRow1: TMenuItem
      Caption = 'Delete Row'
      OnClick = DeleteRow1Click
    end
  end
  object TBHA: TADOTable
    Connection = ADOConnection1
    CursorLocation = clUseServer
    Left = 552
    Top = 360
  end
  object ADOCommand1: TADOCommand
    Connection = ADOConnection1
    Parameters = <>
    Left = 656
    Top = 360
  end
  object BHALIST: TADOTable
    Connection = ADOConnection1
    CursorLocation = clUseServer
    Left = 400
    Top = 240
  end
end
