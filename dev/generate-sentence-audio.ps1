param([Parameter(Mandatory=$true)][string]$JobFile,[Parameter(Mandatory=$true)][string]$Encoder,[Parameter(Mandatory=$true)][string]$ResultFile)
$ErrorActionPreference = 'Stop'
$batch = Get-Content -LiteralPath $JobFile -Raw -Encoding UTF8 | ConvertFrom-Json
$projectSpeechRoot = [IO.Path]::GetFullPath($batch.root)
$audioRoot = [IO.Path]::GetFullPath((Join-Path $projectSpeechRoot 'audio\sentences')) + [IO.Path]::DirectorySeparatorChar
$cacheRoot = [IO.Path]::GetFullPath((Join-Path $projectSpeechRoot '.cache\sentence-audio')) + [IO.Path]::DirectorySeparatorChar
$utf8 = New-Object System.Text.UTF8Encoding($false)
Add-Type -AssemblyName System.Speech
$speech = New-Object System.Speech.Synthesis.SpeechSynthesizer
$speech.SelectVoice($batch.profile.voice)
$speech.Rate = 0
$speech.Volume = 100
$done = 0
$failed = 0
try {
 foreach ($job in $batch.jobs) {
  $wav = [IO.Path]::GetFullPath($job.wav)
  $output = [IO.Path]::GetFullPath($job.output)
  if (!$wav.StartsWith($cacheRoot,[StringComparison]::OrdinalIgnoreCase) -or !$output.StartsWith($audioRoot,[StringComparison]::OrdinalIgnoreCase)) { throw 'Generated paths leave the sentence audio workspace' }
  $partial = $output + '.partial.mp3'
  $watch = [Diagnostics.Stopwatch]::StartNew()
  try {
   $format = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(22050,[System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen,[System.Speech.AudioFormat.AudioChannel]::Mono)
   $speech.SetOutputToWaveFile($wav,$format)
   $speech.Speak([string]$job.text)
   $speech.SetOutputToNull()
   & $Encoder -nostdin -hide_banner -loglevel error -i $wav -vn -ac 1 -ar 22050 -codec:a libmp3lame -b:a 40k -map_metadata -1 -write_xing 0 -y $partial
   if ($LASTEXITCODE -ne 0 -or !(Test-Path -LiteralPath $partial) -or (Get-Item -LiteralPath $partial).Length -lt 250) { throw 'FFmpeg did not produce a complete MP3' }
   Move-Item -LiteralPath $partial -Destination $output -Force
   $record = @{ sha256=$job.sha256; ok=$true; bytes=(Get-Item -LiteralPath $output).Length; seconds=$watch.Elapsed.TotalSeconds }
   $done++
  } catch {
   $record = @{ sha256=$job.sha256; ok=$false; error=$_.Exception.Message }
   $failed++
  } finally {
   $speech.SetOutputToNull()
   if (Test-Path -LiteralPath $wav) { Remove-Item -LiteralPath $wav -Force }
   if (Test-Path -LiteralPath $partial) { Remove-Item -LiteralPath $partial -Force }
  }
  [IO.File]::AppendAllText($ResultFile,(($record | ConvertTo-Json -Compress) + [Environment]::NewLine),$utf8)
  if (($done + $failed) % 50 -eq 0 -or !$record.ok) { Write-Output ($record | ConvertTo-Json -Compress) }
 }
} finally { $speech.Dispose() }
Write-Output (@{ completed=$done; failed=$failed } | ConvertTo-Json -Compress)
if ($failed -gt 0) { exit 1 }
