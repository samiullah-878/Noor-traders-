# =========================================================
#  wa-a4.ps1  v1.2 (2026-11-04) - wa-parchi.js ka A4 PACKING page (System.Drawing) + chhoti tasveer (thumb)
#    v1.1: -Mode thlist -Spec <json> -Out <bin>  -> thermal (512 dots) 'parchi jaisi likhi': har line ke SHURU mein khaali dabba (tick ke liye),
#          Urdu = daayein dabba + Urdu font, English = baayein dabba. Ek BMP (24 bit) <bin> mein; 1-bit raster node banata hai. "OK <path>".
#    v1.2: "OK <path> H:<h1>,<h2>,..." - har line ki unchai (node line-war kaat kar beech mein likhai ke tukde rakhta hai).
#    -Mode page  -Spec <json> -Out <prefix>  -> <prefix>-1.jpg, <prefix>-2.jpg ... ; har safhe par ek line "OK <path>"
#    -Mode thumb -In <jpg> -Out <jpg> -Max 360 -Q 60
#  Ghalti = "ERR:<wajah>". AI NAHI. Sirf tasveer banata hai - chhapna a4-print.js (a4Jobs) karta hai.
#  File sirf ASCII (Urdu likhai JSON se aati hai).
# =========================================================
param([string]$Mode = 'page', [string]$Spec = '', [string]$Out = '', [string]$In = '', [int]$Max = 360, [int]$Q = 80)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

function Get-JpegCodec { foreach ($c in [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders()) { if ($c.MimeType -eq 'image/jpeg') { return $c } }; return $null }
function Save-Jpeg($bmp, [string]$path, [int]$quality) {
  $ep = New-Object System.Drawing.Imaging.EncoderParameters(1)
  $ep.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, [long]$quality)
  $bmp.Save($path, (Get-JpegCodec), $ep)
}
function Pick-Font([string]$list, [string]$fallback) {
  $inst = New-Object System.Drawing.Text.InstalledFontCollection
  $names = @{}; foreach ($f in $inst.Families) { $names[$f.Name.ToLower()] = $f.Name }
  foreach ($n in ($list -split ',')) { $key = $n.Trim().ToLower(); if ($key -and $names.ContainsKey($key)) { return $names[$key] } }
  return $fallback
}
function Is-Ur([string]$s) { return ($s -match '[\u0600-\u06FF]') }

try {
  # ---------------- chhoti tasveer ----------------
  if ($Mode -eq 'thumb') {
    $im = [System.Drawing.Image]::FromFile($In)
    try {
      $sc = [math]::Min(1.0, $Max / [double][math]::Max($im.Width, $im.Height))
      $w = [math]::Max(1, [int]($im.Width * $sc)); $h = [math]::Max(1, [int]($im.Height * $sc))
      $b = New-Object System.Drawing.Bitmap($w, $h)
      $g = [System.Drawing.Graphics]::FromImage($b)
      $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
      $g.DrawImage($im, 0, 0, $w, $h); $g.Dispose()
      Save-Jpeg $b $Out $Q; $b.Dispose()
    } finally { $im.Dispose() }
    Write-Output ('OK ' + $Out); exit 0
  }

  # ---------------- v1.1: thermal 'jaisi likhi' list (malik: "lafz same waise hi, shuru mein tick ka box, simple") ----------------
  if ($Mode -eq 'thlist') {
    $o = Get-Content -Raw -Encoding UTF8 -LiteralPath $Spec | ConvertFrom-Json
    $W = 512; $la = Pick-Font ([string]$o.fonts.la) 'Arial'; $urf = Pick-Font ([string]$o.fonts.ur) $la
    $pxU = [float]$o.pxU; if ($pxU -lt 20) { $pxU = 36 }; $pxL = [float]$o.pxL; if ($pxL -lt 18) { $pxL = 28 }
    $fU = New-Object System.Drawing.Font($urf, $pxU, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
    $fL = New-Object System.Drawing.Font($la, $pxL, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
    $BX = 28; $GAP = 14; $TW = $W - $BX - $GAP - 6
    $pen = New-Object System.Drawing.Pen([System.Drawing.Color]::Black, [float]3)
    $sfU2 = New-Object System.Drawing.StringFormat; $sfU2.FormatFlags = [System.Drawing.StringFormatFlags]::DirectionRightToLeft
    $sfL2 = New-Object System.Drawing.StringFormat
    # pehle naap (har line ki unchai), phir ek lambi tasveer - 1-bit raster node (wa-parchi bmpRaster) banata hai (PowerShell loop dheema)
    $rows = New-Object System.Collections.ArrayList
    $b0 = New-Object System.Drawing.Bitmap(10, 10); $g0 = [System.Drawing.Graphics]::FromImage($b0)
    foreach ($ln in @($o.lines)) {
      $t = [string]$ln.t; if (-not $t) { continue }
      $ur = Is-Ur $t; $f = $fL; $sf = $sfL2; if ($ur) { $f = $fU; $sf = $sfU2 }
      $h = [int][math]::Ceiling($g0.MeasureString($t, $f, $TW, $sf).Height); $lh = [int][math]::Ceiling($f.GetHeight($g0))
      [void]$rows.Add(@{ t = $t; ur = $ur; f = $f; sf = $sf; h = ([math]::Max($h, $BX) + 16); lh = $lh })
    }
    $g0.Dispose(); $b0.Dispose()
    if ($rows.Count -eq 0) { Write-Output 'ERR:khali'; exit 1 }
    $TH = 0; foreach ($r in $rows) { $TH += [int]$r.h }
    $bmp = New-Object System.Drawing.Bitmap($W, $TH, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.Clear([System.Drawing.Color]::White); $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
    $y = 0
    foreach ($r in $rows) {
      $by = $y + 8 + [int][math]::Max(0, ([int]$r.lh - $BX) / 2)
      if ($r.ur) {
        $g.DrawRectangle($pen, ($W - $BX - 4), $by, $BX, $BX)
        $g.DrawString([string]$r.t, $r.f, [System.Drawing.Brushes]::Black, (New-Object System.Drawing.RectangleF([float]2, [float]($y + 8), [float]$TW, [float]([int]$r.h - 8))), $r.sf)
      } else {
        $g.DrawRectangle($pen, 4, $by, $BX, $BX)
        $g.DrawString([string]$r.t, $r.f, [System.Drawing.Brushes]::Black, (New-Object System.Drawing.RectangleF([float]($BX + $GAP + 4), [float]($y + 8), [float]$TW, [float]([int]$r.h - 8))), $r.sf)
      }
      $y += [int]$r.h
    }
    $g.Dispose()
    $bmp.Save($Out, [System.Drawing.Imaging.ImageFormat]::Bmp); $bmp.Dispose()
    $hs = @(); foreach ($r in $rows) { $hs += [string]([int]$r.h) }
    Write-Output ('OK ' + $Out + ' H:' + ($hs -join ',')); exit 0
  }

  # ---------------- A4 packing page ----------------
  $o = Get-Content -Raw -Encoding UTF8 -LiteralPath $Spec | ConvertFrom-Json
  $PW = [int]$o.W; $PH = [int]$o.H; if ($PW -lt 600) { $PW = 1654 }; if ($PH -lt 800) { $PH = 2339 }
  $quality = [int]$o.q; if ($quality -lt 30 -or $quality -gt 95) { $quality = 82 }
  $k = $PW / 1654.0
  $M = [int](80 * $k); $CW = $PW - 2 * $M; $BOT = $PH - $M - [int](56 * $k)
  $la = Pick-Font ([string]$o.fonts.la) 'Arial'
  $urf = Pick-Font ([string]$o.fonts.ur) $la
  function Fnt([string]$fam, [double]$px, [bool]$bold) { $st = [System.Drawing.FontStyle]::Regular; if ($bold) { $st = [System.Drawing.FontStyle]::Bold }; return (New-Object System.Drawing.Font($fam, [float]($px * $k), $st, [System.Drawing.GraphicsUnit]::Pixel)) }
  $fTitle = Fnt $la 60 $true; $fBar = Fnt $la 34 $true; $fCust = Fnt $la 40 $true; $fPh = Fnt $la 46 $true; $fTx = Fnt $la 30 $false; $fHd = Fnt $la 24 $true
  $fRow = Fnt $la 31 $false; $fRowB = Fnt $la 31 $true; $fSm = Fnt $la 24 $false; $fGrp = Fnt $la 27 $true
  $fUr = Fnt $urf 34 $false; $fUrB = Fnt $urf 42 $true; $fUrRow = Fnt $urf 32 $false

  $navy = [System.Drawing.Color]::FromArgb(34, 59, 109)
  $bNavy = New-Object System.Drawing.SolidBrush($navy); $bBlack = [System.Drawing.Brushes]::Black; $bWhite = [System.Drawing.Brushes]::White
  $bGrey = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(105, 105, 105))
  $bRed = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(185, 28, 28))
  $bZebra = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(244, 246, 250))
  $bGrp = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(222, 231, 247))
  $bAmber = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 236, 179))
  $bAmberD = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(146, 64, 14))
  $pLine = New-Object System.Drawing.Pen($navy, [float](3 * $k))
  $pThin = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(190, 196, 208), [float](1.5 * $k))
  $pBox = New-Object System.Drawing.Pen([System.Drawing.Color]::Black, [float](3 * $k))

  $NW = [System.Drawing.StringFormatFlags]::NoWrap; $RTL = [System.Drawing.StringFormatFlags]::DirectionRightToLeft
  $sfL = New-Object System.Drawing.StringFormat; $sfL.FormatFlags = $NW; $sfL.Trimming = [System.Drawing.StringTrimming]::EllipsisCharacter; $sfL.LineAlignment = [System.Drawing.StringAlignment]::Center
  $sfR = New-Object System.Drawing.StringFormat; $sfR.FormatFlags = $NW; $sfR.Alignment = [System.Drawing.StringAlignment]::Far; $sfR.LineAlignment = [System.Drawing.StringAlignment]::Center; $sfR.Trimming = [System.Drawing.StringTrimming]::EllipsisCharacter
  $sfC = New-Object System.Drawing.StringFormat; $sfC.FormatFlags = $NW; $sfC.Alignment = [System.Drawing.StringAlignment]::Center; $sfC.LineAlignment = [System.Drawing.StringAlignment]::Center
  $sfU = New-Object System.Drawing.StringFormat; $sfU.FormatFlags = ($NW -bor $RTL); $sfU.LineAlignment = [System.Drawing.StringAlignment]::Center; $sfU.Trimming = [System.Drawing.StringTrimming]::EllipsisCharacter
  $sfW = New-Object System.Drawing.StringFormat; $sfW.Trimming = [System.Drawing.StringTrimming]::EllipsisWord
  $sfWU = New-Object System.Drawing.StringFormat; $sfWU.FormatFlags = $RTL; $sfWU.Trimming = [System.Drawing.StringTrimming]::EllipsisWord

  function Txt($g, [string]$s, $font, $brush, [double]$x, [double]$y, [double]$w, [double]$h, $sf) {
    if ($s) { $g.DrawString($s, $font, $brush, (New-Object System.Drawing.RectangleF([float]$x, [float]$y, [float]$w, [float]$h)), $sf) }
  }
  function Fit-Image($g, $img, [double]$x, [double]$y, [double]$w, [double]$h, $srcRect) {
    $sw = [double]$img.Width; $sh = [double]$img.Height
    if ($srcRect) { $sw = [double]$srcRect.Width; $sh = [double]$srcRect.Height }
    if ($sw -lt 1 -or $sh -lt 1 -or $w -lt 4 -or $h -lt 4) { return 0 }
    $s = [math]::Min($w / $sw, $h / $sh); if ($srcRect) { $s = [math]::Min($s, 2.0) }
    $dw = [int]($sw * $s); $dh = [int]($sh * $s)
    $dst = New-Object System.Drawing.Rectangle([int]$x, [int]$y, $dw, $dh)
    if ($srcRect) { $g.DrawImage($img, $dst, $srcRect, [System.Drawing.GraphicsUnit]::Pixel) } else { $g.DrawImage($img, $dst) }
    $g.DrawRectangle($pThin, $dst)
    return $dh
  }

  $src = $null
  if ($o.img -and (Test-Path -LiteralPath ([string]$o.img))) { try { $src = [System.Drawing.Image]::FromFile([string]$o.img) } catch { $src = $null } }
  function Crop-Rect($box) {
    if (-not $src -or -not $box) { return $null }
    $bb = @($box); if ($bb.Count -ne 4) { return $null }
    $x0 = [int]([double]$bb[1] / 1000.0 * $src.Width); $y0 = [int]([double]$bb[0] / 1000.0 * $src.Height)
    $x1 = [int]([double]$bb[3] / 1000.0 * $src.Width); $y1 = [int]([double]$bb[2] / 1000.0 * $src.Height)
    $x0 = [math]::Max(0, $x0); $y0 = [math]::Max(0, $y0); $x1 = [math]::Min($src.Width, $x1); $y1 = [math]::Min($src.Height, $y1)
    if ($x1 - $x0 -lt 4 -or $y1 - $y0 -lt 4) { return $null }
    return (New-Object System.Drawing.Rectangle($x0, $y0, ($x1 - $x0), ($y1 - $y0)))
  }

  # ---- safhe ----
  $pages = New-Object System.Collections.ArrayList
  $script:g = $null; $script:y = 0
  # kalam ki jagah: # | [ ] | naam | Urdu | Qty
  $xNo = $M; $xBox = $M + [int](64 * $k); $xName = $M + [int](122 * $k)
  $wQty = [int](230 * $k); $wUr = [int](380 * $k); $xQty = $PW - $M - $wQty; $xUr = $xQty - $wUr - [int](16 * $k); $wName = $xUr - $xName - [int](16 * $k)

  function New-Page([bool]$first) {
    $b = New-Object System.Drawing.Bitmap($PW, $PH)
    $b.SetResolution([float](200 * $k), [float](200 * $k))
    $gg = [System.Drawing.Graphics]::FromImage($b)
    $gg.Clear([System.Drawing.Color]::White)
    $gg.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $gg.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
    $gg.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    [void]$pages.Add(@{ b = $b; g = $gg })
    $script:g = $gg
    $yy = $M
    if ($first) {
      Txt $gg ([string]$o.title) $fTitle $bNavy $M $yy ($CW * 0.55) (78 * $k) $sfL
      if ($o.urT) { Txt $gg ([string]$o.urT) $fUrB $bNavy ($M + $CW * 0.45) $yy ($CW * 0.55) (78 * $k) $sfU }
      $yy += [int](86 * $k)
      $gg.FillRectangle($bNavy, $M, $yy, $CW, [int](58 * $k))
      Txt $gg ('  ' + [string]$o.sub) $fBar $bWhite $M $yy ($CW * 0.75) (58 * $k) $sfL
      Txt $gg ('Order #' + [string]$o.no + '  ') $fBar $bWhite ($M + $CW * 0.6) $yy ($CW * 0.4) (58 * $k) $sfR
      $yy += [int](72 * $k)
      if ($o.rp) { Txt $gg ([string]$o.rp) $fBar $bRed $M $yy $CW (44 * $k) $sfL; $yy += [int](48 * $k) }
      $half = $CW * 0.56
      $cust = [string]$o.cust
      if ($cust) {
        if (Is-Ur $cust) { Txt $gg $cust $fUrB $bBlack $M $yy $half (56 * $k) $sfU } else { Txt $gg ('Gahak: ' + $cust) $fCust $bBlack $M $yy $half (56 * $k) $sfL }
      } else { Txt $gg 'Gahak: -' $fCust $bGrey $M $yy $half (56 * $k) $sfL }
      Txt $gg ([string]$o.when) $fTx $bBlack ($M + $half) $yy ($CW - $half) (56 * $k) $sfR
      $yy += [int](60 * $k)
      Txt $gg ([string]$o.ph) $fPh $bNavy $M $yy $half (62 * $k) $sfL
      if ($o.urD) { Txt $gg ([string]$o.urD) $fUr $bBlack ($M + $half) $yy ($CW - $half) (62 * $k) $sfU }
      $yy += [int](64 * $k)
      Txt $gg ([string]$o.from) $fTx $bGrey $M $yy $CW (40 * $k) $sfL
      $yy += [int](48 * $k)
    } else {
      Txt $gg ([string]$o.title + '  -  PACKING  -  Order #' + [string]$o.no) $fBar $bNavy $M $yy ($CW * 0.7) (50 * $k) $sfL
      Txt $gg ([string]$o.ph) $fBar $bNavy ($M + $CW * 0.6) $yy ($CW * 0.4) (50 * $k) $sfR
      $yy += [int](58 * $k)
    }
    $gg.DrawLine($pLine, $M, $yy, $PW - $M, $yy)
    $script:y = $yy + [int](12 * $k)
  }
  function Table-Head {
    Txt $script:g '#' $fHd $bGrey $xNo $script:y (60 * $k) (36 * $k) $sfL
    Txt $script:g 'ITEM (POS)' $fHd $bGrey $xName $script:y $wName (36 * $k) $sfL
    Txt $script:g 'URDU' $fHd $bGrey $xUr $script:y $wUr (36 * $k) $sfR
    Txt $script:g 'QTY' $fHd $bGrey $xQty $script:y $wQty (36 * $k) $sfR
    $script:y += [int](40 * $k)
    $script:g.DrawLine($pThin, $M, $script:y, $PW - $M, $script:y)
    $script:y += [int](4 * $k)
  }
  function Unc-Head {
    $hh = [int](52 * $k)
    $script:g.FillRectangle($bAmber, $M, $script:y, $CW, $hh)
    Txt $script:g '  ?  SAMAJH NAHI AAYA - jaisa likha hai (tasveer dekh kar maal nikalein)' $fBar $bAmberD $M $script:y $CW $hh $sfL
    $script:y += $hh + [int](8 * $k)
  }
  function Need([int]$h, [string]$kind) {
    if ($script:y + $h -le $BOT) { return }
    New-Page $false
    if ($kind -eq 'row') { Table-Head } elseif ($kind -eq 'unc') { Unc-Head }
  }

  New-Page $true
  $rows = @($o.rows | Where-Object { $_ -ne $null })
  $unc = @($o.unc | Where-Object { $_ -ne $null })
  if ($o.fail) {
    $hh = [int](96 * $k)
    $g.FillRectangle($bAmber, $M, $script:y, $CW, $hh)
    Txt $script:g ('  AI NAHI PARH SAKA: ' + [string]$o.fail) $fTx $bAmberD $M $script:y $CW $hh $sfW
    $script:y += $hh + [int](16 * $k)
    if ($src) { [void](Fit-Image $script:g $src $M $script:y $CW ($BOT - $script:y) $null); $script:y = $BOT }
  }
  if ($rows.Count -gt 0) { Table-Head }
  $zebra = $false
  foreach ($r in $rows) {
    if ($r.g) {
      $hh = [int](48 * $k); Need ($hh + [int](64 * $k)) 'row'
      $script:g.FillRectangle($bGrp, $M, $script:y, $CW, $hh)
      Txt $script:g ('  ' + [string]$r.g) $fGrp $bNavy $M $script:y $CW $hh $sfL
      $script:y += $hh + [int](2 * $k); $zebra = $false; continue
    }
    $hh = [int](64 * $k); Need $hh 'row'
    if ($zebra) { $script:g.FillRectangle($bZebra, $M, $script:y, $CW, $hh) }
    $zebra = -not $zebra
    Txt $script:g ([string]$r.k) $fRow $bGrey $xNo $script:y (60 * $k) $hh $sfL
    $bs = [int](34 * $k); $script:g.DrawRectangle($pBox, $xBox, [int]($script:y + ($hh - $bs) / 2), $bs, $bs)
    Txt $script:g ([string]$r.nm) $fRowB $bBlack $xName $script:y $wName $hh $sfL
    if ($r.ur) { Txt $script:g ([string]$r.ur) $fUrRow $bBlack $xUr $script:y $wUr $hh $sfU }
    Txt $script:g ([string]$r.q) $fRowB $bNavy $xQty $script:y $wQty $hh $sfR
    $script:y += $hh
  }
  if ($unc.Count -gt 0) {
    $script:y += [int](18 * $k)
    Need ([int](52 * $k) + [int](120 * $k)) 'none'
    Unc-Head
    $wL = [int]($CW * 0.52); $xR = $M + $wL + [int](16 * $k); $wR = $PW - $M - $xR
    foreach ($u in $unc) {
      $cr = Crop-Rect $u.box
      $ch = 0; if ($cr) { $ch = [int][math]::Min(160 * $k, [math]::Min(2.0, $wR / [double]$cr.Width) * $cr.Height) }
      $hh = [int][math]::Max(118 * $k, $ch + 16 * $k); Need $hh 'unc'
      $y0 = $script:y
      Txt $script:g ([string]$u.k) $fRow $bGrey $xNo ($y0 + 4 * $k) (60 * $k) (44 * $k) $sfL
      $bs = [int](34 * $k); $script:g.DrawRectangle($pBox, $xBox, [int]($y0 + 9 * $k), $bs, $bs)
      $raw = [string]$u.raw
      if (Is-Ur $raw) { Txt $script:g $raw $fUrB $bBlack $xName $y0 ($wL - ($xName - $M)) (56 * $k) $sfU } else { Txt $script:g $raw $fRowB $bBlack $xName $y0 ($wL - ($xName - $M)) (52 * $k) $sfL }
      Txt $script:g ([string]$u.it) $fSm $bGrey $xName ($y0 + 56 * $k) ($wL - ($xName - $M)) (30 * $k) $sfL
      if ($u.g) { Txt $script:g ([string]$u.g) $fSm $bNavy $xName ($y0 + 84 * $k) ($wL - ($xName - $M)) (30 * $k) $sfL }
      if ($cr) { [void](Fit-Image $script:g $src $xR ($y0 + 6 * $k) $wR ($hh - 12 * $k) $cr) }
      $script:y = $y0 + $hh
      $script:g.DrawLine($pThin, $M, $script:y, $PW - $M, $script:y)
    }
  }
  # asal parchi (jagah ho to aakhri safhe par daayein neeche)
  if ($src -and -not $o.fail) {
    $room = $BOT - $script:y - [int](40 * $k)
    if ($room -ge [int](380 * $k)) {
      $aw = [int]($CW * 0.5); $ax = $PW - $M - $aw; $ay = $script:y + [int](30 * $k)
      Txt $script:g 'Asal parchi' $fSm $bGrey $ax $ay $aw (30 * $k) $sfL
      $ih = $room - [int](40 * $k)
      $sc = [math]::Min($aw / [double]$src.Width, $ih / [double]$src.Height)
      $dw = [int]($src.Width * $sc); $dh = [int]($src.Height * $sc)
      $dst = New-Object System.Drawing.Rectangle(($PW - $M - $dw), ($ay + [int](34 * $k)), $dw, $dh)
      $script:g.DrawImage($src, $dst); $script:g.DrawRectangle($pThin, $dst)
    }
  }
  # neeche ki patti + save
  $n = $pages.Count; $i = 0
  foreach ($p in $pages) {
    $i++
    $gg = $p.g; $fy = $PH - $M - [int](40 * $k)
    $gg.DrawLine($pThin, $M, $fy, $PW - $M, $fy)
    Txt $gg ([string]$o.foot) $fSm $bGrey $M ($fy + 4 * $k) ($CW * 0.8) (36 * $k) $sfL
    Txt $gg ('Safha ' + $i + ' / ' + $n) $fSm $bGrey ($M + $CW * 0.7) ($fy + 4 * $k) ($CW * 0.3) (36 * $k) $sfR
    $gg.Dispose()
    $path = $Out + '-' + $i + '.jpg'
    Save-Jpeg $p.b $path $quality
    $p.b.Dispose()
    Write-Output ('OK ' + $path)
  }
  if ($src) { $src.Dispose() }
  exit 0
} catch {
  Write-Output ('ERR:' + ($_.Exception.Message -replace "[\r\n]+", ' '))
  exit 4
}
