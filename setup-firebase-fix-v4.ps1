$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$ProjectId = "anime-imposteur-689187"

function Step($t){
  Write-Host ""
  Write-Host "============================================================" -ForegroundColor DarkCyan
  Write-Host $t -ForegroundColor Cyan
  Write-Host "============================================================" -ForegroundColor DarkCyan
}

function FirebaseCapture([string[]]$FirebaseArgs, [switch]$AllowFail) {
  $old = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    $raw = & npx.cmd -y firebase-tools@latest @FirebaseArgs 2>&1
    $code = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $old
  }

  $text = (($raw | ForEach-Object { $_.ToString() }) -join "`n")

  if($code -ne 0 -and -not $AllowFail){
    throw "Commande Firebase echouee : firebase $($FirebaseArgs -join ' ')`n$text"
  }

  [PSCustomObject]@{ ExitCode=$code; Output=$text }
}

function ExtractJson([string]$Text){
  if([string]::IsNullOrWhiteSpace($Text)){ return $null }
  $starts=@()
  $a=$Text.IndexOf("{"); if($a -ge 0){$starts+=$a}
  $b=$Text.IndexOf("["); if($b -ge 0){$starts+=$b}
  foreach($p in ($starts|Sort-Object)){
    try{ return ($Text.Substring($p)|ConvertFrom-Json) }catch{}
  }
  return $null
}

try {
  Step "Projet Firebase"
  Write-Host "[OK] Projet : $ProjectId" -ForegroundColor Green
  Write-Host "[OK] L'API Cloud Firestore a deja ete activee dans Google Cloud." -ForegroundColor Green

  @{projects=@{default=$ProjectId}} | ConvertTo-Json -Depth 5 | Set-Content ".firebaserc" -Encoding UTF8

  Step "Attente de propagation + creation de Firestore"

  $dbReady = $false

  for($i=1; $i -le 24; $i++){
    $db = FirebaseCapture @(
      "firestore:databases:get",
      "(default)",
      "--project",$ProjectId,
      "--non-interactive"
    ) -AllowFail

    if($db.ExitCode -eq 0){
      Write-Host "[OK] Firestore existe deja." -ForegroundColor Green
      $dbReady = $true
      break
    }

    Write-Host "Tentative $i/24 : creation de Firestore..." -ForegroundColor Yellow

    $create = FirebaseCapture @(
      "firestore:databases:create",
      "(default)",
      "--location","europe-west1",
      "--project",$ProjectId,
      "--non-interactive"
    ) -AllowFail

    if($create.ExitCode -eq 0 -or $create.Output -match "already exists"){
      Write-Host "[OK] Firestore cree." -ForegroundColor Green
      $dbReady = $true
      break
    }

    if($create.Output -match "403|has not been used|disabled|firestore.googleapis.com"){
      Write-Host "Google n'a pas encore propage l'activation. Attente 15 secondes..." -ForegroundColor DarkYellow
      Start-Sleep -Seconds 15
      continue
    }

    throw "Erreur inattendue lors de la creation Firestore.`n$($create.Output)"
  }

  if(-not $dbReady){
    throw "L'API est activee mais Google n'a pas termine la propagation apres 6 minutes. Relance simplement ce script un peu plus tard."
  }

  Step "Application Web Firebase"

  $appList = FirebaseCapture @(
    "apps:list","WEB",
    "--project",$ProjectId,
    "--json",
    "--non-interactive"
  )

  $appsJson = ExtractJson $appList.Output
  $appId = $null

  if($appsJson.result){
    $arr=@($appsJson.result)
    if($arr.Count -gt 0){$appId=$arr[0].appId}
  } elseif($appsJson.results){
    $arr=@($appsJson.results)
    if($arr.Count -gt 0){$appId=$arr[0].appId}
  }

  if([string]::IsNullOrWhiteSpace($appId)){
    $created = FirebaseCapture @(
      "apps:create","WEB","Anime Imposteur Multiplayer",
      "--project",$ProjectId,
      "--json",
      "--non-interactive"
    )
    $obj = ExtractJson $created.Output
    if($obj.result.appId){$appId=$obj.result.appId}
    elseif($obj.appId){$appId=$obj.appId}
  }

  if([string]::IsNullOrWhiteSpace($appId)){
    throw "Impossible de recuperer l'App ID Firebase Web."
  }

  Write-Host "[OK] App Web : $appId" -ForegroundColor Green

  Step "Recuperation du firebaseConfig"

  $sdk = FirebaseCapture @(
    "apps:sdkconfig","WEB",$appId,
    "--project",$ProjectId,
    "--non-interactive"
  )

  $text=$sdk.Output

  # Firebase CLI peut renvoyer :
  # 1) un objet JSON brut
  # 2) const firebaseConfig = {...};
  # 3) firebase.initializeApp({...});
  $config = $null

  # Essai 1 : extraire directement le bloc JSON de configuration.
  $jsonStart = $text.IndexOf("{")
  $jsonEnd   = $text.LastIndexOf("}")

  if($jsonStart -ge 0 -and $jsonEnd -gt $jsonStart){
    $candidate = $text.Substring($jsonStart, $jsonEnd - $jsonStart + 1)

    try{
      $obj = $candidate | ConvertFrom-Json

      if($obj.projectId -and $obj.appId -and $obj.apiKey){
        # Reconvertir proprement en JSON pour JavaScript.
        $config = $obj | ConvertTo-Json -Depth 20
      }
    }catch{}
  }

  # Essai 2 : ancien format JS.
  if([string]::IsNullOrWhiteSpace($config)){
    $m=[regex]::Match($text,'const\s+firebaseConfig\s*=\s*(\{[\s\S]*?\});')
    if($m.Success){
      $config=$m.Groups[1].Value
    }
  }

  # Essai 3 : firebase.initializeApp({...});
  if([string]::IsNullOrWhiteSpace($config)){
    $m=[regex]::Match($text,'firebase\.initializeApp\((\{[\s\S]*?\})\);')
    if($m.Success){
      $config=$m.Groups[1].Value
    }
  }

  if([string]::IsNullOrWhiteSpace($config)){
    throw "Le firebaseConfig n'a pas pu etre extrait.`n$text"
  }

  Set-Content "firebase-config.js" ("export const firebaseConfig = " + $config + ";") -Encoding UTF8
  Write-Host "[OK] firebase-config.js genere." -ForegroundColor Green

  Step "Authentication anonyme + regles Firestore"

  $authReady=$false

  for($i=1; $i -le 16; $i++){
    $deploy = FirebaseCapture @(
      "deploy",
      "--project",$ProjectId,
      "--only","auth,firestore",
      "--non-interactive"
    ) -AllowFail

    if($deploy.ExitCode -eq 0){
      $authReady=$true
      break
    }

    if($deploy.Output -match "identitytoolkit|Identity Toolkit|403|disabled"){
      if($i -eq 1){
        Write-Host "Firebase Authentication API doit etre activee." -ForegroundColor Yellow
        Start-Process "https://console.developers.google.com/apis/api/identitytoolkit.googleapis.com/overview?project=$ProjectId"
        Write-Host "Dans Edge, clique sur ACTIVER si le bouton est disponible." -ForegroundColor Yellow
        $null=Read-Host "Puis reviens ici et appuie sur ENTREE"
      }

      Write-Host "Propagation Authentication en cours. Attente 15 secondes..." -ForegroundColor DarkYellow
      Start-Sleep -Seconds 15
      continue
    }

    throw "Deploiement Firebase echoue.`n$($deploy.Output)"
  }

  if(-not $authReady){
    throw "Authentication n'est pas encore propagee. Relance ce script dans quelques minutes."
  }

  Step "FIREBASE PRET"
  Write-Host "[OK] Firestore actif" -ForegroundColor Green
  Write-Host "[OK] Authentication anonyme active" -ForegroundColor Green
  Write-Host "[OK] Regles Firestore deployees" -ForegroundColor Green
  Write-Host "[OK] firebase-config.js genere" -ForegroundColor Green
  Write-Host ""
  Write-Host "Maintenant lance : 2_PUBLISH_GITHUB.bat" -ForegroundColor Cyan
  exit 0
}
catch {
  Write-Host ""
  Write-Host "============================================================" -ForegroundColor Red
  Write-Host "ERREUR FIREBASE FIX V3" -ForegroundColor Red
  Write-Host "============================================================" -ForegroundColor Red
  Write-Host $_.Exception.Message -ForegroundColor Red
  Write-Host ""
  Write-Host "La fenetre reste ouverte." -ForegroundColor Yellow
  exit 1
}
