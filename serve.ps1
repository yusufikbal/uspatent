# Minimal static server for index.html (http://localhost:8765/)
$root = $PSScriptRoot
$l = New-Object Net.HttpListener
$l.Prefixes.Add('http://localhost:8765/')
$l.Start()
Write-Host 'Serving on http://localhost:8765/'
while ($l.IsListening) {
  $c = $l.GetContext()
  $p = $c.Request.Url.AbsolutePath.TrimStart('/')
  if ($p -eq '') { $p = 'index.html' }
  $f = Join-Path $root $p
  if ((Test-Path $f -PathType Leaf) -and ($f -like '*.html')) {
    $b = [IO.File]::ReadAllBytes($f)
    $c.Response.ContentType = 'text/html; charset=utf-8'
    $c.Response.OutputStream.Write($b, 0, $b.Length)
  } else { $c.Response.StatusCode = 404 }
  $c.Response.Close()
}
