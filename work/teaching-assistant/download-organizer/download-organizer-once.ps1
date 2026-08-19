$Download = (New-Object -ComObject Shell.Application).NameSpace('shell:Downloads').Self.Path

$Folders = [ordered]@{
    "PPT" = @(".ppt", ".pptx", ".pptm")
    "PDF" = @(".pdf")
    "WORD" = @(".doc", ".docx", ".docm")
    "HWP" = @(".hwp", ".hwpx")
    "EXCEL" = @(".xls", ".xlsx", ".xlsm", ".xlsb", ".csv")
    "IMAGE" = @(
        ".jpg", ".jpeg", ".png", ".gif", ".bmp",
        ".webp", ".tif", ".tiff", ".svg", ".heic", ".heif", ".ico"
    )
    "INSTALL" = @(
        ".exe", ".msi", ".msix", ".msixbundle",
        ".appx", ".appxbundle", ".apk"
    )
    "DISK_IMAGE" = @(".iso")
    "HTML" = @(".html", ".htm", ".xhtml", ".mht", ".mhtml")
    "ZIP" = @(
        ".zip", ".7z", ".rar", ".tar", ".gz", ".bz2", ".xz",
        ".tgz", ".tbz", ".tbz2", ".zst"
    )
    "MD" = @(".md", ".markdown")
    "TXT" = @(".txt")
    "CODE" = @(
        ".py", ".pyw", ".pyx", ".ipynb",
        ".c", ".h", ".cc", ".cpp", ".cxx", ".hpp", ".hh", ".hxx",
        ".java", ".kt", ".kts",
        ".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx",
        ".css", ".scss", ".sass", ".less",
        ".sh", ".bash", ".zsh", ".ps1", ".psm1", ".bat", ".cmd",
        ".rs", ".go", ".swift", ".rb", ".php", ".sql",
        ".asm", ".s", ".cu", ".cuh", ".m", ".r",
        ".cmake", ".gradle",
        ".json", ".yaml", ".yml", ".toml", ".ini", ".cfg", ".xml"
    )
}

$CodeFileNames = @(
    "Makefile",
    "makefile",
    "GNUmakefile",
    "CMakeLists.txt",
    "Dockerfile",
    "Containerfile"
)

function Get-UniqueDestination {
    param(
        [Parameter(Mandatory = $true)][string]$TargetDirectory,
        [Parameter(Mandatory = $true)][string]$FileName
    )

    $Destination = Join-Path $TargetDirectory $FileName

    if (-not (Test-Path -LiteralPath $Destination)) {
        return $Destination
    }

    $Base = [System.IO.Path]::GetFileNameWithoutExtension($FileName)
    $Ext = [System.IO.Path]::GetExtension($FileName)
    $Timestamp = Get-Date -Format "yyyyMMdd-HHmmssfff"

    if ([string]::IsNullOrEmpty($Ext)) {
        return (Join-Path $TargetDirectory "$FileName-$Timestamp")
    }

    return (Join-Path $TargetDirectory "$Base-$Timestamp$Ext")
}

function Move-FileToCategory {
    param(
        [Parameter(Mandatory = $true)][System.IO.FileInfo]$File,
        [Parameter(Mandatory = $true)][string]$Category
    )

    $Target = Join-Path $Download $Category
    $Destination = Get-UniqueDestination -TargetDirectory $Target -FileName $File.Name
    Move-Item -LiteralPath $File.FullName -Destination $Destination
}

# 분류 폴더를 먼저 모두 생성합니다.
foreach ($Folder in $Folders.Keys) {
    $Target = Join-Path $Download $Folder
    if (-not (Test-Path -LiteralPath $Target)) {
        New-Item -ItemType Directory -Path $Target | Out-Null
    }
}

# Downloads 최상위의 기존 파일을 한 번 분류합니다.
Get-ChildItem -LiteralPath $Download -File | ForEach-Object {
    $File = $_
    $Category = $null

    if ($CodeFileNames -contains $File.Name) {
        $Category = "CODE"
    }
    else {
        foreach ($Folder in $Folders.Keys) {
            if ($Folders[$Folder] -contains $File.Extension.ToLowerInvariant()) {
                $Category = $Folder
                break
            }
        }
    }

    if ($Category) {
        Move-FileToCategory -File $File -Category $Category
    }
}

# 예전 버전에서 만든 DOCS 폴더가 있으면 WORD / HWP로 재분류합니다.
$LegacyDocs = Join-Path $Download "DOCS"

if (Test-Path -LiteralPath $LegacyDocs) {
    Get-ChildItem -LiteralPath $LegacyDocs -File | ForEach-Object {
        $File = $_
        $Ext = $File.Extension.ToLowerInvariant()

        if (@(".doc", ".docx", ".docm") -contains $Ext) {
            Move-FileToCategory -File $File -Category "WORD"
        }
        elseif (@(".hwp", ".hwpx") -contains $Ext) {
            Move-FileToCategory -File $File -Category "HWP"
        }
    }

    # DOCS 폴더가 완전히 비었을 때만 제거합니다.
    if (-not (Get-ChildItem -LiteralPath $LegacyDocs -Force | Select-Object -First 1)) {
        Remove-Item -LiteralPath $LegacyDocs
    }
}

Write-Host ""
Write-Host "Downloads 파일 정리 완료."
Write-Host "분류 위치: $Download"
