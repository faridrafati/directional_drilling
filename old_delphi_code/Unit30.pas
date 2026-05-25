unit Unit30;

interface

uses
  Windows, Messages, SysUtils, Variants, Classes, Graphics, Controls, Forms,
  Dialogs, StdCtrls, ExtCtrls,math, TeEngine, Series, TeeProcs, Chart;

type
  TForm30 = class(TForm)
    Edit3: TEdit;
    Label3: TLabel;
    RadioGroup1: TRadioGroup;
    ListBox1: TListBox;
    procedure Button1Click(Sender: TObject);
    procedure RadioGroup1Click(Sender: TObject);
    procedure surf(ll:integer;xx:integer;yy:integer);
    procedure integral(ll:integer;input:real;var output:real);
    procedure coff(ll:integer);
    procedure FormShow(Sender: TObject);
    procedure FormCreate(Sender: TObject);
  private
    { Private declarations }
  public
    { Public declarations }
  end;

var
  Form30: TForm30;
  valid:array[1..1000,1..1000] of boolean;
  mat:array[1..100,1..101] of real;
  cof:array[1..100]of real;
  h,hh:integer;
implementation

uses Unit21, Unit23;

{$R *.dfm}

procedure TForm30.Button1Click(Sender: TObject);
var
 i,j:integer;
begin
 for i:=1 to intro[1,mapno] do
  for j:=1 to intro[2,mapno] do
   if valid[i,j]=true then
    begin
     Application.ProcessMessages;
     form21.Image2.Canvas.Pixels[i,j]:=clgray;
    end;
end;
procedure TForm30.RadioGroup1Click(Sender: TObject);
var
 iii,ii,i,jjj,jj,j,kk,k,l,tru:integer;
 c,extra,sum,a1,a2,a3,yprin:real;
 sum2:array[1..1000]of real;
 extra2:integer;
begin
 form23.conversion(intro[7,mapno],ListBox1.ItemIndex+1,c);
 iii:=0;
 c:=c*c*c;
 extra2:=3;
 for ii:=1 to 1000 do
  for jj:=1 to 1000 do
   valid[ii,jj]:=false;
 form30.caption:='Please Wait';
 sum:=0;
 h:=1;
 hh:=2;
 if RadioGroup1.Buttons[0].Checked then
  begin
   for ii:=1 to intro[1,mapno]+1 do
    begin
     for jj:=1 to intro[2,mapno]+1 do
      begin
       if (z.z[ii,jj,hh]<>error)and(z.z[ii,jj,h]<>error) then
        begin
         sum:=sum+z.z[ii,jj,hh]-z.z[ii,jj,h];
        end;
      end;
    end;
  end;
 if RadioGroup1.Buttons[1].Checked then
  begin
   coff(2);
   integral(2,0,sum);
  end;
 if RadioGroup1.Buttons[2].Checked then
  begin
   coff(3);
   integral(3,0,sum);
   integral(2,sum,sum);
  end;
 if RadioGroup1.Buttons[3].Checked then
  begin
   for ii:=1 to 1000 do
    begin
     sum2[ii]:=0;
    end;
   ii:=1;
   while ii<=intro[1,mapno]-2 do
    begin
     sum:=0;
     yprin:=0;
     tru:=1;
     jj:=1;
     while jj<=intro[2,mapno]-2 do
      begin
       if (z.z[ii,jj,hh]<>error)and(z.z[ii,jj,h]<>error) and
       (z.z[ii,jj+1,hh]<>error)and(z.z[ii,jj+1,h]<>error)and
       (z.z[ii,jj+2,hh]<>error)and(z.z[ii,jj+2,h]<>error)and
       (tru=1) then
        begin
         a1:=0.5*((z.z[ii,jj,hh]-z.z[ii,jj,h])+(z.z[ii,jj+2,hh]-z.z[ii,jj+2,h]))-(z.z[ii,jj+1,hh]-z.z[ii,jj+1,h]);
         a2:=0.5*((z.z[ii,jj+2,hh]-z.z[ii,jj+2,h])-(z.z[ii,jj,hh]-z.z[ii,jj,h]));
         a3:=(z.z[ii,jj+1,hh]-z.z[ii,jj+1,h]);
         sum:=sum+(2/3)*a1+2*a3;
         tru:=2;
         jj:=jj+2;
         yprin:=2*a1+a2;
        end;
       if (z.z[ii,jj+1,hh]<>error)and(z.z[ii,jj+1,h]<>error)and(tru=2) then
        begin
         a2:=yprin;
         a3:=(z.z[ii,jj,hh]-z.z[ii,jj,h]);
         a1:=(z.z[ii,jj+1,hh]-z.z[ii,jj+1,h])-a2-a3;
         sum:=sum+(1/3)*a1+0.5*a2+a3;
        end
       else
        tru:=1;
       jj:=jj+1;
      end;
     if sum<>0 then
      begin
       iii:=iii+1;
       sum2[iii]:=sum;
       sum:=0;
      end;
     ii:=ii+1;
    end;
   sum:=0;
   a1:=0.5*(sum2[1]+sum2[3])-(sum2[2]);
   a2:=0.5*(sum2[3]-sum2[1]);
   a3:=sum2[2];
   sum:=sum+(2/3)*a1+2*a3;
   yprin:=2*a1+a2;
   ii:=3;
   while ii<iii do
    begin
     a2:=yprin;
     a3:=sum2[ii];
     a1:=sum2[ii+1]-a2-a3;
     sum:=sum+(1/3)*a1+0.5*a2+a3;
     ii:=ii+1;
    end;
  end;
 { if RadioGroup1.Buttons[3].Checked then
  begin
   coff(2);
   for ii:=1 to intro[1,mapno] do
    begin
     for jj:=1 to intro[2,mapno] do
      begin
       extra:=1;
       for i:=0 to 1 do
        for j:=0 to 1 do
         begin
          if(z.z[ii+i,jj+j,h]=error)or(z.z[ii+i,jj+j,hh]=error)then
           begin
            extra:=0;
            valid[ii,jj]:=false;
           end;
         end;
        if extra=1 then
         begin
          surf(2,ii,jj);
          for k:=1 to 2*2 do
           sum:=sum+mat[k,2*2+1]/cof[k];
         end;
      end;
    end;
   edit3.Text:=floattostr(abs(intro[5,mapno]*intro[6,mapno]*sum));
  end;
 if RadioGroup1.Buttons[4].Checked then
  begin
   coff(extra2);
   ii:=1;
   while(ii<=intro[1,mapno]-extra2+5)do
    begin
     jj:=1;
     while jj<=intro[2,mapno]-extra2+5 do
      begin
       extra:=1;
       for i:=0 to extra2-1 do
        for j:=0 to extra2-1 do
         begin
          if(z.z[ii+i,jj+j,h]=error)or(z.z[ii+i,jj+j,hh]=error)then
           begin
            extra:=0;
           end;
         end;
        if extra=1 then
         begin
          surf(extra2,ii,jj);
          Application.ProcessMessages;
          form21.Image2.Canvas.Rectangle(ii,jj,ii+extra2-1,jj+extra2-1);
          for k:=1 to extra2*extra2 do
           sum:=sum+mat[k,extra2*extra2+1]/cof[k];
         end
        else
         begin
          for i:=0 to extra2-1 do
           for j:=0 to extra2-1 do
            valid[ii+i,jj+j]:=false;
         end;
       jj:=jj+extra2-1;
      end;
     ii:=ii+extra2-1;
    end;
   edit3.Text:=floattostr(abs(intro[5,mapno]*intro[6,mapno]*sum));
  end;
{if RadioGroup1.Buttons[5].Checked then
 begin
 end;    }
 form30.caption:='Volume Calculations';
 if ListBox1.ItemIndex<6 then
  edit3.Text:=floattostr(c*abs(intro[5,mapno]*intro[6,mapno]*sum))+' Cubic'+' '+ListBox1.Items.Strings[ListBox1.ItemIndex]
 else
  edit3.Text:=floattostr(c*abs(intro[5,mapno]*intro[6,mapno]*sum))+' '+ListBox1.Items.Strings[ListBox1.ItemIndex];

end;
procedure TForm30.surf(ll:integer;xx:integer;yy:integer);
var
 aa,bb,ii,jj,kk,l:integer;
 extra,sum:real;
begin
 for ii:=1 to ll*ll do
  begin
   mat[ii,1]:=(ii-1)div(ll)+3;
   mat[ii,ll*ll-ll+1]:=(ii-1)mod(ll)+3;
   for jj:=1 to ll*ll-(ll) do
    begin
     if (jj-1) mod (ll)<>0 then
      mat[ii,jj]:=power(mat[ii,1],(jj) div (ll+1)+1)*power(mat[ii,ll*ll-ll+1],(jj-1) mod (ll))
     else
      mat[ii,jj]:=power(mat[ii,1],(jj) div (ll+1)+1);
    end;
   for jj:=1 to ll-2 do
    begin
     mat[ii,ll*ll-ll+jj+1]:=power(mat[ii,ll*ll-ll+1],jj+1);
    end;
   mat[ii,ll*ll]:=1;
   mat[ii,ll*ll+1]:=z.z[xx+trunc(mat[ii,1]),yy+trunc(mat[ii,ll*ll-ll+1]),h]-z.z[xx+trunc(mat[ii,1]),yy+trunc(mat[ii,ll*ll-ll+1]),hh];
  end;
 for kk:=1 to ll*ll do
  begin
   l:=kk;
   if abs(mat[l,kk])<1e-14 then
    begin
     while (abs(mat[l,kk])<1e-14)and(l<=ll*ll) do
      l:=l+1;
     for ii:=1 to ll*ll+1 do
      begin
       extra:=mat[kk,ii];
       mat[kk,ii]:=mat[l,ii];
       mat[l,ii]:=extra;
      end;
    end;
   for jj:=kk+1 to ll*ll do
    begin
     extra:=mat[jj,kk]/mat[kk,kk];
     for ii:=1 to ll*ll+1 do
      mat[jj,ii]:=-(extra)*mat[kk,ii]+mat[jj,ii];
    end;
  end;
 for kk:=ll*ll downto 1 do
  for jj:=kk-1 downto 1 do
   begin
    extra:=mat[jj,kk]/mat[kk,kk];
    for ii:=1 to ll*ll+1 do
     mat[jj,ii]:=-(extra)*mat[kk,ii]+mat[jj,ii];
   end;
 for kk:=ll*ll downto 1 do
  mat[kk,ll*ll+1]:=mat[kk,ll*ll+1]/mat[kk,kk];

end;
procedure tForm30.coff(ll:integer);
var
 jj:integer;
begin
 if ll=2 then
  for jj:=1 to ll*ll do
   cof[jj]:=1;
 if ll=3 then
  for jj:=1 to ll*ll do
   cof[jj]:=power(4,(((jj-1) div ll)mod 2))*(((jj mod 3)div 2)*3+1);



{ cof[1]:=2;
 cof[ll*ll-ll+1]:=2;
 for jj:=1 to ll*ll-(ll) do
  cof[jj]:=((jj-1) div (ll)+2)*(((jj-1) mod (ll))+1);
 for jj:=1 to ll-2 do
  cof[ll*ll-ll+jj+1]:=(jj+2);
 cof[ll*ll]:=1;   }
end;
procedure tForm30.integral(ll:integer;input:real;var output:real);
 var
  extra2,extra,ii,jj,kk,i,j,k:integer;
 begin
   ii:=1;
   extra2:=ll;
   while(ii<=intro[1,mapno]-extra2+5)do
    begin
     jj:=1;
     while jj<=intro[2,mapno]-extra2+5 do
      begin
       extra:=1;
       for i:=0 to extra2-1 do
        for j:=0 to extra2-1 do
         begin
          if(z.z[ii+i,jj+j,h]=error)or(z.z[ii+i,jj+j,hh]=error)then
           begin
            extra:=0;
           end;
         end;
       if extra=1 then
        for i:=0 to extra2-1 do
         for j:=0 to extra2-1 do
          begin
           if valid[ii+i,jj+j]=false then
            begin
             extra:=2;
            end;
          end;
       if extra=2 then
        begin
         for i:=0 to extra2-1 do
          for j:=0 to extra2-1 do
           begin
            valid[ii+i,jj+j]:=true;
            input:=input+(1/(ll*ll))*cof[j+1+ll*(i)]*(z.z[ii+i,jj+j,h]-z.z[ii+i,jj+j,hh]);
           end;
        end;
       jj:=jj+extra2-1;
      end;
     ii:=ii+extra2-1;
    end;
  output:=input;
 end;


procedure TForm30.FormShow(Sender: TObject);
begin
 if listbox1.ItemIndex=-1 then
  listbox1.ItemIndex:=intro[7,mapno]-1;
 if (not RadioGroup1.Buttons[0].Checked)and(not RadioGroup1.Buttons[1].Checked)and(not RadioGroup1.Buttons[2].Checked)and(not RadioGroup1.Buttons[3].Checked)then
  RadioGroup1.Buttons[0].Checked:=true;
end;

procedure TForm30.FormCreate(Sender: TObject);
begin
 form30.ListBox1.ItemIndex:=0;
end;

end.
