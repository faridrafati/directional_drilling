object Form06: TForm06
  Left = 0
  Top = 0
  Caption = 'Form06'
  ClientHeight = 311
  ClientWidth = 377
  Color = clBtnFace
  Font.Charset = DEFAULT_CHARSET
  Font.Color = clWindowText
  Font.Height = -11
  Font.Name = 'Tahoma'
  Font.Style = []
  OldCreateOrder = False
  PixelsPerInch = 96
  TextHeight = 13
  object pagecontrol2: TPageControl
    Left = 1
    Top = 2
    Width = 375
    Height = 307
    ActivePage = TabSheet4
    BiDiMode = bdLeftToRight
    MultiLine = True
    ParentBiDiMode = False
    TabOrder = 0
    object TabSheet4: TTabSheet
      Caption = 'Constant DLS'
      object RadioGroup1: TRadioGroup
        Left = 7
        Top = 3
        Width = 352
        Height = 241
        Caption = 'Constant DLS'
        ItemIndex = 0
        Items.Strings = (
          'Maintain Constant DLS to a MD and  Inclination'
          'Maintain Constant DLS to a MD and  Azimuth'
          'Maintain Constant DLS to a Inclination  and  Azimuth'
          'Maintain Constant DLS to a TVD  and  Inclination'
          'Compute DLS to a TVD, Inclination and Azimuth')
        TabOrder = 0
      end
      object Button1: TButton
        Left = 105
        Top = 250
        Width = 75
        Height = 25
        Caption = 'OK'
        TabOrder = 1
        OnClick = Button1Click
      end
    end
    object TabSheet5: TTabSheet
      Caption = 'Build Rate/Turn Rate'
      ImageIndex = 1
      object GroupBox4: TGroupBox
        Left = 7
        Top = 3
        Width = 127
        Height = 182
        Caption = 'Maintain '
        Ctl3D = False
        ParentCtl3D = False
        TabOrder = 0
        object CheckBox1: TCheckBox
          Left = 16
          Top = 25
          Width = 97
          Height = 17
          Caption = 'Build Rate'
          Checked = True
          State = cbChecked
          TabOrder = 0
          OnClick = CheckBox1Click
        end
        object CheckBox2: TCheckBox
          Left = 16
          Top = 48
          Width = 97
          Height = 17
          Caption = 'Turn Rate'
          TabOrder = 1
          OnClick = CheckBox2Click
        end
      end
      object RadioGroup2: TRadioGroup
        Left = 141
        Top = 3
        Width = 218
        Height = 182
        BiDiMode = bdLeftToRight
        Caption = 'To '
        Ctl3D = False
        ItemIndex = 0
        Items.Strings = (
          'MD'
          'TVD'
          'for a Course (Delta MD)'
          'Inclination'
          'Azimuth')
        ParentBiDiMode = False
        ParentCtl3D = False
        TabOrder = 1
        OnClick = RadioGroup2Click
      end
      object Memo1: TMemo
        Left = 7
        Top = 196
        Width = 352
        Height = 48
        Ctl3D = False
        Lines.Strings = (
          'Note:'
          '1. Station Will be Computed Using Radius of Cervature'
          '2. Build and Turn to a TVD is an Itterative Solution')
        ParentCtl3D = False
        ReadOnly = True
        TabOrder = 2
      end
      object Button4: TButton
        Left = 105
        Top = 250
        Width = 75
        Height = 25
        Caption = 'OK'
        TabOrder = 3
        OnClick = Button4Click
      end
    end
    object TabSheet6: TTabSheet
      Caption = 'DLS - TF'
      ImageIndex = 2
      object RadioGroup3: TRadioGroup
        Left = 7
        Top = 3
        Width = 352
        Height = 182
        Caption = 'Maintain Dogleg (DLS) With Initial Toolface  '
        Ctl3D = False
        ItemIndex = 0
        Items.Strings = (
          'to a MD'
          'to a TVD'
          'for a Course (Delta MD)'
          'to an Inclination'
          'to an Azimuth')
        ParentCtl3D = False
        TabOrder = 0
      end
      object Button3: TButton
        Left = 105
        Top = 250
        Width = 75
        Height = 25
        Caption = 'OK'
        TabOrder = 1
        OnClick = Button3Click
      end
      object Memo2: TMemo
        Left = 7
        Top = 196
        Width = 352
        Height = 48
        Ctl3D = False
        Lines.Strings = (
          'Note:'
          '1. Station Will be Computed Using Minimum of Cervature'
          
            '2. Maintain DLS With Intitial Toolface to a TVD is an Itterative' +
            ' Solution')
        ParentCtl3D = False
        ReadOnly = True
        TabOrder = 2
      end
    end
  end
  object Button2: TButton
    Left = 191
    Top = 276
    Width = 75
    Height = 25
    Caption = 'Cancel'
    TabOrder = 1
    OnClick = Button2Click
  end
end
