$ErrorActionPreference = 'Stop'
$Port = 8765
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$PageSize = 750
$BatchSize = 600
$EnrichBatchSize = 150
$FootprintUrl = 'https://mapit.fortworthtexas.gov/ags/rest/services/Planning_Development/PlanningDevelopment/MapServer/22/query'
$LotsTractsUrl = 'https://mapit.fortworthtexas.gov/ags/rest/services/Planning_Development/PlanningDevelopment/MapServer/18/query'

# Primary source first. Layer 19 is the full Fort Worth parcel feature layer.
$ParcelSources = @(
    @{ Name = 'Fort Worth Planning Parcels'; Url = 'https://mapit.fortworthtexas.gov/ags/rest/services/Planning_Development/PlanningDevelopment/MapServer/19/query' },
    @{ Name = 'Fort Worth Civic Parcels'; Url = 'https://mapit.fortworthtexas.gov/ags/rest/services/CIVIC/CIVIC_BASEMAP_Simple/MapServer/5/query' },
    @{ Name = 'Fort Worth Zoning Parcels'; Url = 'https://mapit.fortworthtexas.gov/ags/rest/services/Planning_Development/Zoning/MapServer/35/query' }
)

$OutFields = 'OBJECTID,ACCOUNT,PIDN,TAXPIN,PROPERTY_CLASS_CODE,YR_BUILT,STATE_USE_CODE,LIVING_AREA,GARAGE_CAP,BEDROOM_CNT,BATHROOM_CNT,STRUCT_CNT,LAND_VAL,IMPR_VAL,MARKET_VALUE,APPRAISED_VALUE,LAND_ACRE,LAND_SQFT,AG_DEFERRAL_CODE,AG_ACRE,EXEMPTION_CODE,SITUS_ADDR,PARCEL_LEGAL_DESCRIPTION,OWNER_NAME,OWNER_ADDRESS,OWNER_CITY_ST,OWNER_ZIP_CODE,STREET_ADDRESS,COUNTYNAME,CITYNAME,BUILDING_TYPE,BUILDING_NUM,Situs_ZipCode,CalcAcres,Data_Load_Date'
$VacantOutFields = $OutFields + ',DEED_DATE'
$OwnerOutFields = $OutFields + ',DEED_DATE'
$CommercialOutFields = $OutFields + ',DEED_DATE'
$OwnerScanFields = 'OBJECTID,ACCOUNT,DEED_DATE,OWNER_NAME,OWNER_ADDRESS,OWNER_ZIP_CODE,SITUS_ADDR,Situs_ZipCode,CITYNAME,COUNTYNAME,PARCEL_LEGAL_DESCRIPTION,STATE_USE_CODE,PROPERTY_CLASS_CODE,STRUCT_CNT,IMPR_VAL,YR_BUILT,LIVING_AREA'
$ResponseCache = [hashtable]::Synchronized(@{})
$CacheTtlSeconds = 300

function Write-Log([string]$Message) {
    $stamp = Get-Date -Format 'HH:mm:ss'
    Write-Host "[$stamp] $Message"
}

$ZipCityCache = [hashtable]::Synchronized(@{
    '76179' = 'Fort Worth'
    '76177' = 'Fort Worth'
    '76137' = 'Fort Worth'
    '76135' = 'Fort Worth'
    '76131' = 'Fort Worth'
    '76148' = 'Watauga'
    '76180' = 'North Richland Hills'
    '76182' = 'North Richland Hills'
    '76052' = 'Haslet'
    '76020' = 'Azle'
    '76021' = 'Bedford'
    '76022' = 'Bedford'
    '76034' = 'Colleyville'
    '76039' = 'Euless'
    '76040' = 'Euless'
    '76051' = 'Grapevine'
    '76053' = 'Hurst'
    '76054' = 'Hurst'
    '76060' = 'Kennedale'
    '76063' = 'Mansfield'
    '76092' = 'Southlake'
})

function Test-InvalidCity([string]$City) {
    $c = ([string]$City).Trim()
    if ([string]::IsNullOrWhiteSpace($c)) { return $true }
    return $c -match '^(?i)(NO\s+CITY\s+LIMITS?|UNINCORPORATED|NONE|N/A)$'
}

function Resolve-PostalCity([string]$Zip, [string]$Mode, [string]$Location) {
    $z = ([string]$Zip).Trim()
    if ([string]::IsNullOrWhiteSpace($z)) {
        if ($Mode -eq 'city' -and -not [string]::IsNullOrWhiteSpace($Location)) { return $Location.Trim() }
        return 'Fort Worth'
    }
    if ($ZipCityCache.ContainsKey($z)) { return [string]$ZipCityCache[$z] }

    try {
        $r = Invoke-RestMethod -Uri "https://api.zippopotam.us/us/$z" -Method Get -TimeoutSec 8
        $place = [string]$r.places[0].'place name'
        if (-not [string]::IsNullOrWhiteSpace($place)) {
            $ZipCityCache[$z] = $place.Trim()
            return $place.Trim()
        }
    }
    catch {
        Write-Log "ZIP-city lookup skipped for ${z}: $($_.Exception.Message)"
    }

    if ($z -match '^761\d{2}$') { return 'Fort Worth' }
    if ($Mode -eq 'city' -and -not [string]::IsNullOrWhiteSpace($Location)) { return $Location.Trim() }
    return 'Fort Worth'
}

function Add-DisplayCities([array]$Features, [string]$Mode, [string]$Location) {
    if ($null -eq $Features -or $Features.Count -eq 0) { return }
    $cache = @{}
    foreach ($f in $Features) {
        $a = $f.attributes
        if ($null -eq $a) { continue }
        $city = [string]$a.CITYNAME
        if (-not (Test-InvalidCity $city)) {
            Add-Attr $f 'DISPLAY_CITY' $city.Trim()
            continue
        }
        $zip = ([string]$a.Situs_ZipCode).Trim()
        if (-not $cache.ContainsKey($zip)) { $cache[$zip] = Resolve-PostalCity $zip $Mode $Location }
        Add-Attr $f 'DISPLAY_CITY' ([string]$cache[$zip])
    }
}

function ConvertTo-JsonText($Object) {
    return ($Object | ConvertTo-Json -Depth 40 -Compress)
}

function Get-ErrorMessage($Response) {
    if ($null -eq $Response) { return 'No response received.' }
    if ($Response.PSObject.Properties.Name -contains 'error' -and $null -ne $Response.error) {
        $m = [string]$Response.error.message
        $d = ''
        if ($Response.error.details) { $d = (($Response.error.details | Where-Object { $_ }) -join ' ') }
        return (($m + ' ' + $d).Trim())
    }
    return $null
}

function Invoke-ArcPost([string]$Url, [hashtable]$Body) {
    try {
        $r = Invoke-RestMethod -Uri $Url -Method Post -Body $Body -ContentType 'application/x-www-form-urlencoded' -TimeoutSec 60
        $arcError = Get-ErrorMessage $r
        if ($arcError) { throw $arcError }
        return $r
    }
    catch {
        throw "ArcGIS request failed: $($_.Exception.Message)"
    }
}

function Escape-Sql([string]$Value) {
    return $Value.Replace("'", "''").Trim()
}

function Get-LocationWhereCandidates([string]$Mode, [string]$Location) {
    $safe = Escape-Sql $Location
    if ($Mode -eq 'zip') {
        return @("Situs_ZipCode='$safe'")
    }
    if ($Mode -eq 'city') {
        $up = $safe.ToUpperInvariant()
        return @("CITYNAME='$up'", "CITYNAME='$safe'", "CITYNAME LIKE '%$safe%'")
    }
    if ($Mode -eq 'subdivision') {
        return @("PARCEL_LEGAL_DESCRIPTION LIKE '%$safe%'")
    }

    $county = ($safe -replace '(?i)\s+COUNTY$', '').Trim()
    $upc = $county.ToUpperInvariant()
    return @("COUNTYNAME='$upc'", "COUNTYNAME='$county'", "COUNTYNAME LIKE '%$county%'")
}

function Add-VacantCodeFilter([string]$LocationWhere) {
    # TAD: C1 = Vacant Land Residential, C1C = Vacant Land Commercial,
    # O = Residential Inventory. Keep this expression deliberately simple.
    return "($LocationWhere) AND (STATE_USE_CODE='C1' OR STATE_USE_CODE='C1C' OR STATE_USE_CODE='O')"
}

function Get-PagedFeatures($Source, [string]$Where, [bool]$ReturnGeometry, [string]$Fields = $OutFields) {
    # IMPORTANT: use List[psobject] created with ::new().
    # New-Object List[object] + @($list) can throw "Argument types do not match"
    # in Windows PowerShell 5.1. That was the v2.0 failure.
    $features = [System.Collections.Generic.List[psobject]]::new()
    $offset = 0

    while ($true) {
        $body = @{
            where = $Where
            outFields = $Fields
            returnGeometry = $(if ($ReturnGeometry) { 'true' } else { 'false' })
            outSR = '4326'
            resultOffset = [string]$offset
            resultRecordCount = [string]$PageSize
            orderByFields = 'OBJECTID ASC'
            returnZ = 'false'
            returnM = 'false'
            f = 'json'
        }
        $r = Invoke-ArcPost $Source.Url $body
        $page = @($r.features)
        if ($page.Count -eq 0) { break }

        foreach ($f in $page) { [void]$features.Add([psobject]$f) }
        $offset += $page.Count
        Write-Log "$($Source.Name): loaded $offset matching parcels"

        if ($page.Count -lt $PageSize -and -not $r.exceededTransferLimit) { break }
        if ($offset -gt 100000) { throw 'Search stopped because the result set exceeded 100,000 parcels.' }
    }

    return $features.ToArray()
}

function Get-LimitedFeaturesByWhere($Source, [string]$Where, [bool]$ReturnGeometry, [string]$Fields = $OutFields, [int]$Limit = 25) {
    $body = @{
        where = $Where
        outFields = $Fields
        returnGeometry = $(if ($ReturnGeometry) { 'true' } else { 'false' })
        outSR = '4326'
        resultOffset = '0'
        resultRecordCount = [string]([Math]::Max(1, [Math]::Min($Limit, 100)))
        orderByFields = 'OBJECTID ASC'
        returnZ = 'false'
        returnM = 'false'
        f = 'json'
    }
    $r = Invoke-ArcPost $Source.Url $body
    return @($r.features)
}

function Get-PagedFeaturesByGeometry($Source, [string]$Where, [string]$GeometryJson, [bool]$ReturnGeometry, [string]$Fields = $OutFields) {
    $features = [System.Collections.Generic.List[psobject]]::new()
    $offset = 0
    while ($true) {
        $body = @{
            where = $Where
            geometry = $GeometryJson
            geometryType = 'esriGeometryPolygon'
            inSR = '4326'
            spatialRel = 'esriSpatialRelIntersects'
            outFields = $Fields
            returnGeometry = $(if ($ReturnGeometry) { 'true' } else { 'false' })
            outSR = '4326'
            resultOffset = [string]$offset
            resultRecordCount = [string]$PageSize
            orderByFields = 'OBJECTID ASC'
            returnZ = 'false'
            returnM = 'false'
            f = 'json'
        }
        $r = Invoke-ArcPost $Source.Url $body
        $page = @($r.features)
        if ($page.Count -eq 0) { break }
        foreach ($f in $page) { [void]$features.Add([psobject]$f) }
        $offset += $page.Count
        Write-Log "$($Source.Name): loaded $offset parcels inside drawn boundary"
        if ($page.Count -lt $PageSize -and -not $r.exceededTransferLimit) { break }
        if ($offset -gt 100000) { throw 'Map search stopped because the result set exceeded 100,000 parcels.' }
    }
    return $features.ToArray()
}

function Normalize-PolygonJson([string]$PolygonText) {
    if ([string]::IsNullOrWhiteSpace($PolygonText)) { throw 'Drawn boundary is required.' }
    try { $g = $PolygonText | ConvertFrom-Json } catch { throw 'Drawn boundary could not be read.' }
    if ($null -eq $g.rings -or $g.rings.Count -lt 1 -or $g.rings[0].Count -lt 4) { throw 'Draw at least 3 boundary points.' }
    $ring = @($g.rings[0])
    foreach ($pt in $ring) {
        if ($null -eq $pt -or $pt.Count -lt 2) { throw 'Drawn boundary contains an invalid point.' }
        $x = 0.0; $y = 0.0
        if (-not [double]::TryParse(([string]$pt[0]), [ref]$x) -or -not [double]::TryParse(([string]$pt[1]), [ref]$y)) { throw 'Drawn boundary contains a non-numeric point.' }
        if ($x -lt -180 -or $x -gt 180 -or $y -lt -90 -or $y -gt 90) { throw 'Drawn boundary contains a point outside valid map coordinates.' }
    }
    return ($g | ConvertTo-Json -Depth 10 -Compress)
}

function Get-ObjectIdsByWhere($Source, [string]$Where) {
    $body = @{ where = $Where; returnIdsOnly = 'true'; returnGeometry = 'false'; f = 'json' }
    $r = Invoke-ArcPost $Source.Url $body
    if ($null -eq $r.objectIds) { return @() }
    return [array]($r.objectIds | Sort-Object)
}

function Get-FeaturesByIds($Source, [array]$Ids, [bool]$ReturnGeometry, [string]$Fields = $OutFields) {
    $features = [System.Collections.Generic.List[psobject]]::new()
    if ($null -eq $Ids -or $Ids.Count -eq 0) { return $features.ToArray() }

    for ($i = 0; $i -lt $Ids.Count; $i += $BatchSize) {
        $end = [Math]::Min($i + $BatchSize - 1, $Ids.Count - 1)
        $batch = [array]$Ids[$i..$end]
        $body = @{
            where = '1=1'
            objectIds = ($batch -join ',')
            outFields = $Fields
            returnGeometry = $(if ($ReturnGeometry) { 'true' } else { 'false' })
            outSR = '4326'
            returnZ = 'false'
            returnM = 'false'
            f = 'json'
        }
        $r = Invoke-ArcPost $Source.Url $body
        if ($r.features) {
            foreach ($f in $r.features) { [void]$features.Add([psobject]$f) }
        }
    }
    return $features.ToArray()
}


function Add-Attr($Feature, [string]$Name, $Value) {
    if ($null -eq $Feature -or $null -eq $Feature.attributes) { return }
    $Feature.attributes | Add-Member -NotePropertyName $Name -NotePropertyValue $Value -Force
}

function Normalize-Key($Value) {
    if ($null -eq $Value) { return '' }
    return ([string]$Value).Trim().ToUpperInvariant()
}

function Normalize-NumericKey($Value) {
    $s = Normalize-Key $Value
    if ([string]::IsNullOrWhiteSpace($s)) { return '' }
    $s = $s.TrimStart('0')
    if ([string]::IsNullOrWhiteSpace($s)) { return '0' }
    return $s
}

function Quote-SqlList([array]$Values) {
    return (($Values | ForEach-Object { "'" + ([string]$_).Replace("'", "''") + "'" }) -join ',')
}

function Add-BuildingFootprintFlags([array]$Features) {
    if ($null -eq $Features -or $Features.Count -eq 0) { return }
    $matched = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)

    for ($i = 0; $i -lt $Features.Count; $i += $EnrichBatchSize) {
        $end = [Math]::Min($i + $EnrichBatchSize - 1, $Features.Count - 1)
        $slice = [array]$Features[$i..$end]
        $accounts = [array]($slice | ForEach-Object { Normalize-Key $_.attributes.ACCOUNT } | Where-Object { $_ } | Sort-Object -Unique)
        $taxpins = [array]($slice | ForEach-Object { Normalize-Key $_.attributes.TAXPIN } | Where-Object { $_ } | Sort-Object -Unique)
        $clauses = [System.Collections.Generic.List[string]]::new()
        if ($accounts.Count -gt 0) { [void]$clauses.Add("TAD_ACCOUNT IN ($(Quote-SqlList $accounts))") }
        if ($taxpins.Count -gt 0) { [void]$clauses.Add("TAXPIN IN ($(Quote-SqlList $taxpins))") }
        if ($clauses.Count -eq 0) { continue }
        $body = @{ where = '(' + ($clauses -join ' OR ') + ')'; outFields = 'TAD_ACCOUNT,TAXPIN'; returnGeometry = 'false'; resultRecordCount = '1000'; f = 'json' }
        $r = Invoke-ArcPost $FootprintUrl $body
        foreach ($f in @($r.features)) {
            $a = Normalize-Key $f.attributes.TAD_ACCOUNT; if ($a) { [void]$matched.Add("A:$a") }
            $t = Normalize-Key $f.attributes.TAXPIN; if ($t) { [void]$matched.Add("T:$t") }
        }
    }

    $count = 0
    foreach ($f in $Features) {
        $a = Normalize-Key $f.attributes.ACCOUNT
        $t = Normalize-Key $f.attributes.TAXPIN
        $has = ($a -and $matched.Contains("A:$a")) -or ($t -and $matched.Contains("T:$t"))
        Add-Attr $f 'HAS_BUILDING_FOOTPRINT' ([bool]$has)
        if ($has) { $count++ }
    }
    Write-Log "Building-footprint cross-check flagged $count candidate parcels as already built on"
}

function Add-LotTractInfo([array]$Features) {
    if ($null -eq $Features -or $Features.Count -eq 0) { return }
    $byAccount = @{}
    $numericAccounts = [array]($Features | ForEach-Object { Normalize-NumericKey $_.attributes.ACCOUNT } | Where-Object { $_ -match '^\d+$' } | Sort-Object -Unique)
    for ($i = 0; $i -lt $numericAccounts.Count; $i += $EnrichBatchSize) {
        $end = [Math]::Min($i + $EnrichBatchSize - 1, $numericAccounts.Count - 1)
        $batch = [array]$numericAccounts[$i..$end]
        if ($batch.Count -eq 0) { continue }
        $body = @{ where = "TAD_ACCOUNT IN ($($batch -join ','))"; outFields = 'TAD_ACCOUNT,SUBDIVISION,BLOCK,LOT,SUBTYPE,ADDRESS,PARCEL_LEGAL_DESCRIPTION,IMPRVALUE'; returnGeometry = 'false'; resultRecordCount = '1000'; f = 'json' }
        $r = Invoke-ArcPost $LotsTractsUrl $body
        foreach ($f in @($r.features)) {
            $k = Normalize-NumericKey $f.attributes.TAD_ACCOUNT
            if ($k -and -not $byAccount.ContainsKey($k)) { $byAccount[$k] = $f.attributes }
        }
    }

    $matched = 0
    foreach ($f in $Features) {
        $k = Normalize-NumericKey $f.attributes.ACCOUNT
        if ($k -and $byAccount.ContainsKey($k)) {
            $x = $byAccount[$k]
            Add-Attr $f 'SUBDIVISION' ([string]$x.SUBDIVISION)
            Add-Attr $f 'BLOCK' ([string]$x.BLOCK)
            Add-Attr $f 'LOT' ([string]$x.LOT)
            Add-Attr $f 'LOT_SUBTYPE' $x.SUBTYPE
            Add-Attr $f 'LOTTRACT_ADDRESS' ([string]$x.ADDRESS)
            Add-Attr $f 'LOTTRACT_IMPRVALUE' $x.IMPRVALUE
            $matched++
        } else {
            Add-Attr $f 'SUBDIVISION' ''
            Add-Attr $f 'BLOCK' ''
            Add-Attr $f 'LOT' ''
            Add-Attr $f 'LOT_SUBTYPE' $null
            Add-Attr $f 'LOTTRACT_ADDRESS' ''
            Add-Attr $f 'LOTTRACT_IMPRVALUE' $null
        }
    }
    Write-Log "Lot/tract cross-check matched $matched candidate parcels to subdivision records"
}

function Enrich-CandidateFeatures([array]$Features, $Warnings) {
    if ($null -eq $Features -or $Features.Count -eq 0) { return }
    try { Add-BuildingFootprintFlags $Features }
    catch {
        Write-Log "Building-footprint cross-check skipped: $($_.Exception.Message)"
        [void]$Warnings.Add('Building-footprint cross-check was unavailable; built-on filtering used appraisal fields only.')
        foreach ($f in $Features) { Add-Attr $f 'HAS_BUILDING_FOOTPRINT' $false }
    }
    try { Add-LotTractInfo $Features }
    catch {
        Write-Log "Subdivision/lot cross-check skipped: $($_.Exception.Message)"
        [void]$Warnings.Add('Subdivision/lot enrichment was unavailable for this search.')
    }
}

function Test-VacantCode($Feature) {
    if ($null -eq $Feature -or $null -eq $Feature.attributes) { return $false }
    $code = ([string]$Feature.attributes.STATE_USE_CODE).Trim().ToUpperInvariant()
    return @('C1','C1C','O') -contains $code
}

function Test-FeatureLocation($Feature, [string]$Mode, [string]$Location) {
    $a = $Feature.attributes
    if ($null -eq $a) { return $false }

    if ($Mode -eq 'zip') {
        return ([string]$a.Situs_ZipCode).Trim() -eq $Location.Trim()
    }
    if ($Mode -eq 'city') {
        $c = ([string]$a.CITYNAME).Trim().ToUpperInvariant()
        return $c.Contains($Location.Trim().ToUpperInvariant())
    }
    if ($Mode -eq 'subdivision') {
        $legal = ([string]$a.PARCEL_LEGAL_DESCRIPTION).Trim().ToUpperInvariant()
        return $legal.Contains($Location.Trim().ToUpperInvariant())
    }

    $wanted = (($Location -replace '(?i)\s+COUNTY$', '').Trim()).ToUpperInvariant()
    $county = ([string]$a.COUNTYNAME).Trim().ToUpperInvariant()
    return $county.Contains($wanted)
}

function Search-ByCandidateWhere($Source, [string]$Mode, [string]$Location, [string]$LocationWhere) {
    $where = Add-VacantCodeFilter $LocationWhere
    Write-Log "Trying $($Source.Name) with vacant-lot query: $where"
    $features = [array](Get-PagedFeatures $Source $where $true $VacantOutFields)
    $features = [array]($features | Where-Object { Test-FeatureLocation $_ $Mode $Location })
    if ($features.Count -gt 0) {
        return @{ features = $features; checked = $features.Count; method = 'vacant-code-paged' }
    }
    return $null
}

function Search-ByLocationThenFilter($Source, [string]$Mode, [string]$Location, [string]$LocationWhere) {
    Write-Log "Fallback: loading parcel IDs from $($Source.Name) with $LocationWhere"
    $ids = [array](Get-ObjectIdsByWhere $Source $LocationWhere)
    if ($ids.Count -eq 0) { return $null }

    Write-Log "$($Source.Name) returned $($ids.Count) parcel IDs; retrieving attributes"
    $attributeFeatures = [array](Get-FeaturesByIds $Source $ids $false $VacantOutFields)
    $candidateFeatures = [array]($attributeFeatures | Where-Object { (Test-FeatureLocation $_ $Mode $Location) -and (Test-VacantCode $_) })
    Write-Log "Local vacant-code filter kept $($candidateFeatures.Count) parcels"
    if ($candidateFeatures.Count -eq 0) {
        return @{ features = @(); checked = $ids.Count; method = 'location-ids-local-filter' }
    }

    # Now fetch geometry only for the much smaller vacant-lot candidate set.
    $candidateIds = [array]($candidateFeatures | ForEach-Object { $_.attributes.OBJECTID } | Where-Object { $null -ne $_ })
    $geoFeatures = [array](Get-FeaturesByIds $Source $candidateIds $true $VacantOutFields)
    return @{ features = $geoFeatures; checked = $ids.Count; method = 'location-ids-local-filter' }
}

function Search-Parcels([string]$Mode, [string]$Location) {
    $warnings = [System.Collections.Generic.List[string]]::new()
    $whereCandidates = Get-LocationWhereCandidates $Mode $Location

    foreach ($source in $ParcelSources) {
        foreach ($locationWhere in $whereCandidates) {
            try {
                $result = Search-ByCandidateWhere $source $Mode $Location $locationWhere
                if ($null -ne $result -and $result.features.Count -gt 0) {
                    Enrich-CandidateFeatures $result.features $warnings
                    Add-DisplayCities $result.features $Mode $Location
                    return @{
                        features = $result.features
                        totalParcels = $result.checked
                        source = $source.Name
                        warnings = $warnings.ToArray()
                        method = $result.method
                    }
                }
            }
            catch {
                Write-Log "Vacant-lot query failed on $($source.Name): $($_.Exception.Message)"
                [void]$warnings.Add("$($source.Name) rejected the direct vacant-lot query; a fallback was tried.")
            }

            try {
                $fallback = Search-ByLocationThenFilter $source $Mode $Location $locationWhere
                if ($null -ne $fallback) {
                    Enrich-CandidateFeatures $fallback.features $warnings
                    Add-DisplayCities $fallback.features $Mode $Location
                    return @{
                        features = $fallback.features
                        totalParcels = $fallback.checked
                        source = $source.Name
                        warnings = $warnings.ToArray()
                        method = $fallback.method
                    }
                }
            }
            catch {
                Write-Log "Location-ID fallback failed on $($source.Name): $($_.Exception.Message)"
            }
        }
    }

    throw 'All parcel sources rejected the search. Check the PowerShell window for the exact source error.'
}


function Add-ResidentialHomeFilter([string]$LocationWhere) {
    # TAD residential single-family family of codes: A/A1-A5 plus rural residential E.
    # Keep the server expression simple; deed-age filtering happens locally because DEED_DATE is stored as text.
    return "($LocationWhere) AND (STATE_USE_CODE='A' OR STATE_USE_CODE='A1' OR STATE_USE_CODE='A2' OR STATE_USE_CODE='A3' OR STATE_USE_CODE='A4' OR STATE_USE_CODE='A5' OR STATE_USE_CODE='E')"
}

function Convert-ToDeedDate($Value) {
    $s = ([string]$Value).Trim()
    if ([string]::IsNullOrWhiteSpace($s) -or $s -match '^0+$') { return $null }

    $numeric = 0L
    if ([long]::TryParse($s, [ref]$numeric)) {
        try {
            if ($numeric -gt 100000000000) { $d = [DateTimeOffset]::FromUnixTimeMilliseconds($numeric).LocalDateTime.Date }
            elseif ($numeric -gt 1000000000) { $d = [DateTimeOffset]::FromUnixTimeSeconds($numeric).LocalDateTime.Date }
            else { $d = $null }
            if ($null -ne $d -and $d -ge [datetime]'1900-01-01' -and $d -le (Get-Date).Date) { return $d }
        } catch {}
    }

    $dt = [datetime]::MinValue
    if ([datetime]::TryParse($s, [ref]$dt)) {
        $d = $dt.Date
        if ($d -ge [datetime]'1900-01-01' -and $d -le (Get-Date).Date) { return $d }
    }
    return $null
}

function Get-FullYearsOwned([datetime]$DeedDate) {
    if ($null -eq $DeedDate -or $DeedDate -eq [datetime]::MinValue) { return 0 }
    $today = (Get-Date).Date
    $years = $today.Year - $DeedDate.Year
    if ($years -gt 0 -and $today -lt $DeedDate.Date.AddYears($years)) { $years-- }
    return [Math]::Max(0, $years)
}

function Normalize-AddressForMatch($Value) {
    $s = ([string]$Value).Trim().ToUpperInvariant()
    if ([string]::IsNullOrWhiteSpace($s)) { return '' }
    $s = $s -replace '\bSTREET\b','ST' -replace '\bDRIVE\b','DR' -replace '\bROAD\b','RD' -replace '\bAVENUE\b','AVE'
    $s = $s -replace '\bBOULEVARD\b','BLVD' -replace '\bLANE\b','LN' -replace '\bCOURT\b','CT' -replace '\bTRAIL\b','TRL'
    $s = $s -replace '\bPARKWAY\b','PKWY' -replace '\bPLACE\b','PL'
    return ($s -replace '[^A-Z0-9]','')
}

function Test-LikelyOwnerOccupied($Attributes) {
    $situs = Normalize-AddressForMatch $Attributes.SITUS_ADDR
    $owner = Normalize-AddressForMatch $Attributes.OWNER_ADDRESS
    if ([string]::IsNullOrWhiteSpace($situs) -or [string]::IsNullOrWhiteSpace($owner) -or $situs -ne $owner) { return $false }
    $sz = ([string]$Attributes.Situs_ZipCode).Trim()
    $oz = ([string]$Attributes.OWNER_ZIP_CODE).Trim()
    if ($sz.Length -ge 5) { $sz = $sz.Substring(0,5) }
    if ($oz.Length -ge 5) { $oz = $oz.Substring(0,5) }
    return [string]::IsNullOrWhiteSpace($sz) -or [string]::IsNullOrWhiteSpace($oz) -or $sz -eq $oz
}

function Convert-ToNumber($Value) {
    $n = 0.0
    [void][double]::TryParse(([string]$Value), [ref]$n)
    return $n
}

function Test-ImprovedResidence($Feature) {
    $a = $Feature.attributes
    if ($null -eq $a) { return $false }
    return (Convert-ToNumber $a.STRUCT_CNT) -gt 0 -or (Convert-ToNumber $a.IMPR_VAL) -gt 0 -or (Convert-ToNumber $a.YR_BUILT) -gt 0 -or (Convert-ToNumber $a.LIVING_AREA) -gt 0
}

function Test-ResidentialCode($Feature) {
    if ($null -eq $Feature -or $null -eq $Feature.attributes) { return $false }
    $code = ([string]$Feature.attributes.STATE_USE_CODE).Trim().ToUpperInvariant()
    return @('A','A1','A2','A3','A4','A5','E') -contains $code
}

function Search-LongTermOwners([string]$Mode, [string]$Location, [int]$Years, [bool]$OwnerOnly) {
    $warnings = [System.Collections.Generic.List[string]]::new()
    $whereCandidates = Get-LocationWhereCandidates $Mode $Location
    $cutoff = (Get-Date).Date.AddYears(-1 * $Years)

    foreach ($source in $ParcelSources) {
        foreach ($locationWhere in $whereCandidates) {
            $scanFeatures = @()
            try {
                $where = Add-ResidentialHomeFilter $locationWhere
                Write-Log "Trying $($source.Name) for long-term residential owners by ${Mode}: $Location"
                $scanFeatures = [array](Get-PagedFeatures $source $where $false $OwnerScanFields)
            }
            catch {
                Write-Log "Direct owner query failed on $($source.Name): $($_.Exception.Message). Trying location-ID fallback."
                try {
                    $ids = [array](Get-ObjectIdsByWhere $source $locationWhere)
                    if ($ids.Count -gt 0) {
                        $scanFeatures = [array](Get-FeaturesByIds $source $ids $false $OwnerScanFields)
                        $scanFeatures = [array]($scanFeatures | Where-Object { Test-ResidentialCode $_ })
                    }
                }
                catch {
                    Write-Log "Owner location-ID fallback failed on $($source.Name): $($_.Exception.Message)"
                    [void]$warnings.Add("$($source.Name) could not complete the long-term owner search; another parcel source was tried.")
                    continue
                }
            }

            try {
                $scanFeatures = [array]($scanFeatures | Where-Object { (Test-FeatureLocation $_ $Mode $Location) -and (Test-ResidentialCode $_) })
                if ($scanFeatures.Count -eq 0) { continue }

                $matchingIds = [System.Collections.Generic.List[object]]::new()
                foreach ($f in $scanFeatures) {
                    if (-not (Test-ImprovedResidence $f)) { continue }
                    $deed = Convert-ToDeedDate $f.attributes.DEED_DATE
                    if ($null -eq $deed -or $deed -gt $cutoff) { continue }
                    if ($OwnerOnly -and -not (Test-LikelyOwnerOccupied $f.attributes)) { continue }
                    [void]$matchingIds.Add($f.attributes.OBJECTID)
                }

                Write-Log "$($source.Name): $($matchingIds.Count) residential properties match $Years+ years with verified deed dates"
                if ($matchingIds.Count -eq 0) {
                    return @{ features = @(); source = $source.Name; warnings = $warnings.ToArray(); method = 'verified-deed-date-resilient-filter'; totalResidential = $scanFeatures.Count }
                }

                $features = [array](Get-FeaturesByIds $source $matchingIds.ToArray() $true $OwnerOutFields)
                $verified = [System.Collections.Generic.List[psobject]]::new()
                foreach ($f in $features) {
                    $deed = Convert-ToDeedDate $f.attributes.DEED_DATE
                    if ($null -eq $deed) { continue }
                    $yrs = Get-FullYearsOwned $deed
                    if ($yrs -lt $Years) { continue }
                    Add-Attr $f 'OWNERSHIP_YEARS' $yrs
                    Add-Attr $f 'LIKELY_OWNER_OCCUPIED' ([bool](Test-LikelyOwnerOccupied $f.attributes))
                    [void]$verified.Add([psobject]$f)
                }
                $resultFeatures = $verified.ToArray()
                Add-DisplayCities $resultFeatures $Mode $Location
                return @{ features = $resultFeatures; source = $source.Name; warnings = $warnings.ToArray(); method = 'verified-deed-date-resilient-filter'; totalResidential = $scanFeatures.Count }
            }
            catch {
                Write-Log "Long-term owner verification failed on $($source.Name): $($_.Exception.Message)"
                [void]$warnings.Add("$($source.Name) returned owner records but verification could not complete; another parcel source was tried.")
            }
        }
    }
    throw 'All parcel sources rejected the long-term owner search. Check the PowerShell window for the exact source error.'
}

function Add-CommercialPropertyFilter([string]$LocationWhere) {
    # TAD codes included here: C1C vacant commercial land, C2C commercial land with improvement value,
    # F1 commercial, F2 industrial, B/BC multifamily, and EC rural commercial.
    return "($LocationWhere) AND (STATE_USE_CODE='C1C' OR STATE_USE_CODE='C2C' OR STATE_USE_CODE='F1' OR STATE_USE_CODE='F2' OR STATE_USE_CODE='B' OR STATE_USE_CODE='BC' OR STATE_USE_CODE='EC')"
}

function Test-CommercialCode($Feature) {
    if ($null -eq $Feature -or $null -eq $Feature.attributes) { return $false }
    $code = ([string]$Feature.attributes.STATE_USE_CODE).Trim().ToUpperInvariant()
    return @('C1C','C2C','F1','F2','B','BC','EC') -contains $code
}

function Test-CommercialHasBuilding($Feature) {
    if ($null -eq $Feature -or $null -eq $Feature.attributes) { return $false }
    $a = $Feature.attributes
    $code = ([string]$a.STATE_USE_CODE).Trim().ToUpperInvariant()
    if ($code -eq 'C1C') { return $false }
    $signals = 0
    if ((Convert-ToNumber $a.STRUCT_CNT) -gt 0) { $signals++ }
    if ((Convert-ToNumber $a.LIVING_AREA) -gt 0) { $signals++ }
    if ((Convert-ToNumber $a.YR_BUILT) -gt 0) { $signals++ }
    if ((Convert-ToNumber $a.IMPR_VAL) -gt 0) { $signals++ }
    if (-not [string]::IsNullOrWhiteSpace([string]$a.BUILDING_TYPE)) { $signals++ }
    if (-not [string]::IsNullOrWhiteSpace([string]$a.BUILDING_NUM)) { $signals++ }
    return $signals -ge 2
}

function Search-CommercialProperties([string]$Mode, [string]$Location) {
    $warnings = [System.Collections.Generic.List[string]]::new()
    $whereCandidates = Get-LocationWhereCandidates $Mode $Location

    foreach ($source in $ParcelSources) {
        foreach ($locationWhere in $whereCandidates) {
            try {
                $where = Add-CommercialPropertyFilter $locationWhere
                Write-Log "Trying $($source.Name) for commercial properties by ${Mode}: $Location"
                $features = [array](Get-PagedFeatures $source $where $true $CommercialOutFields)
                $features = [array]($features | Where-Object { (Test-FeatureLocation $_ $Mode $Location) -and (Test-CommercialCode $_) })
                if ($features.Count -eq 0) { continue }
                Add-DisplayCities $features $Mode $Location
                return @{ features = $features; source = $source.Name; warnings = $warnings.ToArray(); method = 'commercial-code-paged' }
            }
            catch {
                Write-Log "Commercial search failed on $($source.Name): $($_.Exception.Message)"
                [void]$warnings.Add("$($source.Name) could not complete the direct commercial search; another parcel source was tried.")
            }

            try {
                Write-Log "Commercial fallback: loading parcel IDs from $($source.Name)"
                $ids = [array](Get-ObjectIdsByWhere $source $locationWhere)
                if ($ids.Count -eq 0) { continue }
                $attributeFeatures = [array](Get-FeaturesByIds $source $ids $false $CommercialOutFields)
                $candidateFeatures = [array]($attributeFeatures | Where-Object { (Test-FeatureLocation $_ $Mode $Location) -and (Test-CommercialCode $_) })
                if ($candidateFeatures.Count -eq 0) { return @{ features = @(); source = $source.Name; warnings = $warnings.ToArray(); method = 'location-ids-commercial-filter' } }
                $candidateIds = [array]($candidateFeatures | ForEach-Object { $_.attributes.OBJECTID } | Where-Object { $null -ne $_ })
                $geoFeatures = [array](Get-FeaturesByIds $source $candidateIds $true $CommercialOutFields)
                Add-DisplayCities $geoFeatures $Mode $Location
                return @{ features = $geoFeatures; source = $source.Name; warnings = $warnings.ToArray(); method = 'location-ids-commercial-filter' }
            }
            catch {
                Write-Log "Commercial fallback failed on $($source.Name): $($_.Exception.Message)"
            }
        }
    }
    throw 'All parcel sources rejected the commercial search. Check the PowerShell window for the exact source error.'
}


function Geocode-SearchCenter([string]$Text) {
    if ([string]::IsNullOrWhiteSpace($Text)) { throw 'Radius center is required.' }
    $q = [Uri]::EscapeDataString(($Text.Trim() + ', Texas, USA'))
    $url = "https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=us&q=$q"
    try {
        $r = Invoke-RestMethod -Uri $url -Method Get -Headers @{ 'User-Agent'='LeadForge/1.0 local real-estate prospecting app' } -TimeoutSec 30
        if ($null -eq $r -or @($r).Count -eq 0) { throw 'No matching location was found.' }
        return @{ lat=[double]$r[0].lat; lon=[double]$r[0].lon; label=[string]$r[0].display_name }
    }
    catch { throw "Radius center could not be geocoded: $($_.Exception.Message)" }
}

function Get-PagedCommercialByDistance($Source, [double]$Lat, [double]$Lon, [double]$Miles) {
    $features = [System.Collections.Generic.List[psobject]]::new(); $offset=0
    while ($true) {
        $body = @{
            where = "STATE_USE_CODE='C1C' OR STATE_USE_CODE='C2C' OR STATE_USE_CODE='F1' OR STATE_USE_CODE='F2' OR STATE_USE_CODE='B' OR STATE_USE_CODE='BC' OR STATE_USE_CODE='EC'"
            geometry = "$Lon,$Lat"; geometryType='esriGeometryPoint'; inSR='4326'; spatialRel='esriSpatialRelIntersects'
            distance=[string]$Miles; units='esriSRUnit_StatuteMile'; outFields=$CommercialOutFields; returnGeometry='true'; outSR='4326'
            resultOffset=[string]$offset; resultRecordCount=[string]$PageSize; orderByFields='OBJECTID ASC'; f='json'
        }
        $r=Invoke-ArcPost $Source.Url $body; $page=@($r.features); if($page.Count -eq 0){break}
        foreach($f in $page){[void]$features.Add([psobject]$f)}; $offset += $page.Count
        if($page.Count -lt $PageSize -and -not $r.exceededTransferLimit){break}; if($offset -gt 100000){throw 'Radius search exceeded 100,000 parcels.'}
    }
    return $features.ToArray()
}

function Search-VacantCommercialCandidates($Query) {
    $zip=[string]$Query['zip']; $city=[string]$Query['city']; $county=[string]$Query['county']; $neighborhood=[string]$Query['neighborhood']; $corridor=[string]$Query['corridor']; $radiusCenter=[string]$Query['radiusCenter']; $radiusText=[string]$Query['radius']
    if (-not [string]::IsNullOrWhiteSpace($radiusCenter) -and -not [string]::IsNullOrWhiteSpace($radiusText)) {
        $miles=0.0; if(-not [double]::TryParse($radiusText,[ref]$miles) -or $miles -le 0 -or $miles -gt 50){throw 'Radius must be between 0 and 50 miles.'}
        $center=Geocode-SearchCenter $radiusCenter
        foreach($source in $ParcelSources){try{$features=[array](Get-PagedCommercialByDistance $source $center.lat $center.lon $miles); $features=[array]($features | Where-Object { Test-CommercialHasBuilding $_ }); if($features.Count -eq 0){continue}; Add-DisplayCities $features 'city' 'Fort Worth'; return @{features=$features;source=$source.Name;method='commercial-radius-building-search';center=$center.label}}catch{Write-Log "Vacant commercial radius search failed on $($source.Name): $($_.Exception.Message)"}}
        throw 'All parcel sources rejected the vacant-commercial radius search.'
    }
    $mode='';$location=''
    if(-not [string]::IsNullOrWhiteSpace($zip)){$mode='zip';$location=$zip}
    elseif(-not [string]::IsNullOrWhiteSpace($city)){$mode='city';$location=$city}
    elseif(-not [string]::IsNullOrWhiteSpace($neighborhood)){$mode='subdivision';$location=$neighborhood}
    elseif(-not [string]::IsNullOrWhiteSpace($county)){$mode='county';$location=$county}
    elseif(-not [string]::IsNullOrWhiteSpace($corridor)){
        $safe=Escape-Sql $corridor; $warnings=[System.Collections.Generic.List[string]]::new()
        foreach($source in $ParcelSources){try{$where="(SITUS_ADDR LIKE '%$safe%' OR STREET_ADDRESS LIKE '%$safe%') AND (STATE_USE_CODE='C1C' OR STATE_USE_CODE='C2C' OR STATE_USE_CODE='F1' OR STATE_USE_CODE='F2' OR STATE_USE_CODE='B' OR STATE_USE_CODE='BC' OR STATE_USE_CODE='EC')";$features=[array](Get-PagedFeatures $source $where $true $CommercialOutFields); $features=[array]($features | Where-Object { Test-CommercialHasBuilding $_ });if($features.Count -eq 0){continue};Add-DisplayCities $features 'city' 'Fort Worth';return @{features=$features;source=$source.Name;warnings=$warnings.ToArray();method='commercial-corridor-building-search'}}catch{Write-Log "Corridor search failed on $($source.Name): $($_.Exception.Message)"}}
        throw 'All parcel sources rejected the corridor search.'
    }
    else { throw 'At least one location filter is required.' }
    $result = Search-CommercialProperties $mode $location
    $result.features = [array](@($result.features) | Where-Object { Test-CommercialHasBuilding $_ })
    $result.method = ([string]$result.method) + '-building-required'
    return $result
}


function Search-PropertyByAddress([string]$Address) {
    $inputAddress = ([string]$Address).Trim()
    if ([string]::IsNullOrWhiteSpace($inputAddress)) { throw 'Property address is required.' }

    $street = ($inputAddress -split ',')[0].Trim()
    if ([string]::IsNullOrWhiteSpace($street)) { $street = $inputAddress }
    $safeStreet = Escape-Sql $street
    $warnings = [System.Collections.Generic.List[string]]::new()

    # Fast path: one limited address query per parcel source instead of two
    # separate paged queries. This keeps drive-by address lookups responsive.
    foreach ($source in $ParcelSources) {
        try {
            $where = "(SITUS_ADDR LIKE '%$safeStreet%' OR STREET_ADDRESS LIKE '%$safeStreet%')"
            Write-Log "Property lookup on $($source.Name): combined address query"
            $features = [array](Get-LimitedFeaturesByWhere $source $where $true $OwnerOutFields 20)
            if ($features.Count -gt 0) {
                Add-DisplayCities $features 'address' $inputAddress
                return @{ features = @($features | Select-Object -First 12); source = $source.Name; method = 'address-attribute-fast'; warnings = $warnings.ToArray() }
            }
        }
        catch {
            [void]$warnings.Add("$($source.Name) rejected the direct address query; geocode fallback continued.")
        }
    }

    # Fallback: geocode once, then intersect that point with parcel sources.
    try {
        $encoded = [Uri]::EscapeDataString($inputAddress)
        $geo = Invoke-RestMethod -Uri "https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=us&q=$encoded" -Method Get -Headers @{ 'User-Agent'='LeadForge/1.0 local real-estate prospecting app' } -TimeoutSec 15
        if ($geo -and @($geo).Count -gt 0) {
            $lat = [double]$geo[0].lat
            $lon = [double]$geo[0].lon
            foreach ($source in $ParcelSources) {
                try {
                    $body = @{
                        where = '1=1'
                        geometry = "$lon,$lat"
                        geometryType = 'esriGeometryPoint'
                        inSR = '4326'
                        spatialRel = 'esriSpatialRelIntersects'
                        outFields = $OwnerOutFields
                        returnGeometry = 'true'
                        outSR = '4326'
                        resultRecordCount = '12'
                        f = 'json'
                    }
                    $r = Invoke-ArcPost $source.Url $body
                    $features = @($r.features)
                    if ($features.Count -gt 0) {
                        Add-DisplayCities $features 'address' $inputAddress
                        return @{ features = @($features | Select-Object -First 12); source = $source.Name; method = 'geocode-point'; geocoded = @{ lat=$lat; lon=$lon }; warnings = $warnings.ToArray() }
                    }
                }
                catch {
                    [void]$warnings.Add("$($source.Name) rejected the geocoded point lookup.")
                }
            }
        }
    }
    catch {
        [void]$warnings.Add("Free address geocoding was unavailable: $($_.Exception.Message)")
    }

    return @{ features = @(); source = 'Public parcel/GIS records'; method = 'no-match'; warnings = $warnings.ToArray() }
}

function Search-VacantByPolygon([string]$GeometryJson) {
    $warnings = [System.Collections.Generic.List[string]]::new()
    $where = "STATE_USE_CODE='C1' OR STATE_USE_CODE='C1C' OR STATE_USE_CODE='O'"
    foreach ($source in $ParcelSources) {
        try {
            Write-Log "Trying $($source.Name) for vacant lots inside drawn boundary"
            $features = [array](Get-PagedFeaturesByGeometry $source $where $GeometryJson $true $VacantOutFields)
            if ($features.Count -eq 0) { continue }
            Enrich-CandidateFeatures $features $warnings
            Add-DisplayCities $features 'city' 'Fort Worth'
            return @{ features = $features; totalParcels = $features.Count; source = $source.Name; warnings = $warnings.ToArray(); method = 'polygon-vacant-search' }
        }
        catch {
            Write-Log "Vacant map search failed on $($source.Name): $($_.Exception.Message)"
            [void]$warnings.Add("$($source.Name) could not complete the drawn-area vacant search; another parcel source was tried.")
        }
    }
    throw 'All parcel sources rejected the drawn-area vacant search. Check the PowerShell window for the exact source error.'
}

function Search-CommercialByPolygon([string]$GeometryJson) {
    $warnings = [System.Collections.Generic.List[string]]::new()
    $where = "STATE_USE_CODE='C1C' OR STATE_USE_CODE='C2C' OR STATE_USE_CODE='F1' OR STATE_USE_CODE='F2' OR STATE_USE_CODE='B' OR STATE_USE_CODE='BC' OR STATE_USE_CODE='EC'"
    foreach ($source in $ParcelSources) {
        try {
            Write-Log "Trying $($source.Name) for commercial properties inside drawn boundary"
            $features = [array](Get-PagedFeaturesByGeometry $source $where $GeometryJson $true $CommercialOutFields)
            $features = [array]($features | Where-Object { Test-CommercialCode $_ })
            if ($features.Count -eq 0) { continue }
            Add-DisplayCities $features 'city' 'Fort Worth'
            return @{ features = $features; source = $source.Name; warnings = $warnings.ToArray(); method = 'polygon-commercial-search' }
        }
        catch {
            Write-Log "Commercial map search failed on $($source.Name): $($_.Exception.Message)"
            [void]$warnings.Add("$($source.Name) could not complete the drawn-area commercial search; another parcel source was tried.")
        }
    }
    throw 'All parcel sources rejected the drawn-area commercial search. Check the PowerShell window for the exact source error.'
}

function Search-OwnersByPolygon([string]$GeometryJson, [int]$Years, [bool]$OwnerOnly) {
    $warnings = [System.Collections.Generic.List[string]]::new()
    $where = "STATE_USE_CODE='A' OR STATE_USE_CODE='A1' OR STATE_USE_CODE='A2' OR STATE_USE_CODE='A3' OR STATE_USE_CODE='A4' OR STATE_USE_CODE='A5' OR STATE_USE_CODE='E'"
    $cutoff = (Get-Date).Date.AddYears(-1 * $Years)
    foreach ($source in $ParcelSources) {
        try {
            Write-Log "Trying $($source.Name) for long-term residential owners inside drawn boundary"
            $scanFeatures = [array](Get-PagedFeaturesByGeometry $source $where $GeometryJson $false $OwnerScanFields)
            if ($scanFeatures.Count -eq 0) { continue }
            $matchingIds = [System.Collections.Generic.List[object]]::new()
            foreach ($f in $scanFeatures) {
                if (-not (Test-ImprovedResidence $f)) { continue }
                $deed = Convert-ToDeedDate $f.attributes.DEED_DATE
                if ($null -eq $deed -or $deed -gt $cutoff) { continue }
                if ($OwnerOnly -and -not (Test-LikelyOwnerOccupied $f.attributes)) { continue }
                [void]$matchingIds.Add($f.attributes.OBJECTID)
            }
            if ($matchingIds.Count -eq 0) { return @{ features=@(); source=$source.Name; warnings=$warnings.ToArray(); method='polygon-verified-deed-date'; totalResidential=$scanFeatures.Count } }
            $features = [array](Get-FeaturesByIds $source $matchingIds.ToArray() $true $OwnerOutFields)
            $verified = [System.Collections.Generic.List[psobject]]::new()
            foreach ($f in $features) {
                $deed = Convert-ToDeedDate $f.attributes.DEED_DATE
                if ($null -eq $deed) { continue }
                $yrs = Get-FullYearsOwned $deed
                if ($yrs -lt $Years) { continue }
                Add-Attr $f 'OWNERSHIP_YEARS' $yrs
                Add-Attr $f 'LIKELY_OWNER_OCCUPIED' ([bool](Test-LikelyOwnerOccupied $f.attributes))
                [void]$verified.Add([psobject]$f)
            }
            $resultFeatures=$verified.ToArray()
            Add-DisplayCities $resultFeatures 'city' 'Fort Worth'
            return @{ features=$resultFeatures; source=$source.Name; warnings=$warnings.ToArray(); method='polygon-verified-deed-date'; totalResidential=$scanFeatures.Count }
        }
        catch {
            Write-Log "Owner map search failed on $($source.Name): $($_.Exception.Message)"
            [void]$warnings.Add("$($source.Name) could not complete the drawn-area owner search; another parcel source was tried.")
        }
    }
    throw 'All parcel sources rejected the drawn-area owner search. Check the PowerShell window for the exact source error.'
}

function Test-ParcelService {
    try {
        $source = $ParcelSources[0]
        $body = @{
            where = "ACCOUNT='07126514'"
            outFields = 'OBJECTID,ACCOUNT,STATE_USE_CODE,SITUS_ADDR'
            returnGeometry = 'false'
            resultRecordCount = '1'
            f = 'json'
        }
        $r = Invoke-ArcPost $source.Url $body
        if ($r.features -and $r.features.Count -gt 0) {
            $a = $r.features[0].attributes
            Write-Host "Data check passed: $($a.ACCOUNT) | $($a.SITUS_ADDR) | $($a.STATE_USE_CODE)" -ForegroundColor Green
            return
        }
        Write-Host 'Data check warning: parcel service responded but the known test parcel was not returned.' -ForegroundColor Yellow
    }
    catch {
        Write-Host "Data check warning: $($_.Exception.Message)" -ForegroundColor Yellow
    }
}

function Get-RequestCacheKey([string]$Path, $Query) {
    $parts = [System.Collections.Generic.List[string]]::new()
    foreach ($k in @($Query.Keys | Sort-Object)) { [void]$parts.Add("$k=$([string]$Query[$k])") }
    $raw = "$Path?" + ($parts -join '&')
    $sha = [Security.Cryptography.SHA256]::Create()
    try {
        $bytes = [Text.Encoding]::UTF8.GetBytes($raw)
        return ($sha.ComputeHash($bytes) | ForEach-Object { $_.ToString('x2') }) -join ''
    }
    finally { $sha.Dispose() }
}

function Get-CachedJson([string]$Key) {
    if ([string]::IsNullOrWhiteSpace($Key)) { return $null }
    $entry = $ResponseCache[$Key]
    if ($null -eq $entry) { return $null }
    if (((Get-Date) - $entry.Timestamp).TotalSeconds -gt $CacheTtlSeconds) {
        [void]$ResponseCache.Remove($Key)
        return $null
    }
    Write-Log "Cache hit: $Key"
    return [string]$entry.Json
}

function Set-CachedJson([string]$Key, [string]$Json) {
    if ([string]::IsNullOrWhiteSpace($Key) -or [string]::IsNullOrWhiteSpace($Json)) { return }
    $ResponseCache[$Key] = @{ Timestamp = Get-Date; Json = $Json }
}

function Send-ApiResult($Stream, $Result, [string]$CacheKey = '') {
    $json = ConvertTo-JsonText $Result
    if (-not [string]::IsNullOrWhiteSpace($CacheKey)) { Set-CachedJson $CacheKey $json }
    Send-Text $Stream 200 'OK' 'application/json; charset=utf-8' $json
}

function Parse-QueryString([string]$Query) {
    $result = @{}
    if ([string]::IsNullOrWhiteSpace($Query)) { return $result }
    $q = $Query.TrimStart('?')
    foreach ($pair in $q.Split('&')) {
        if ([string]::IsNullOrWhiteSpace($pair)) { continue }
        $parts = $pair.Split('=', 2)
        $k = [Uri]::UnescapeDataString(($parts[0] -replace '\+', ' '))
        $v = if ($parts.Count -gt 1) { [Uri]::UnescapeDataString(($parts[1] -replace '\+', ' ')) } else { '' }
        $result[$k] = $v
    }
    return $result
}

function Send-Bytes($Stream, [int]$StatusCode, [string]$StatusText, [string]$ContentType, [byte[]]$Bytes) {
    $headers = "HTTP/1.1 $StatusCode $StatusText`r`nContent-Type: $ContentType`r`nContent-Length: $($Bytes.Length)`r`nCache-Control: no-store`r`nConnection: close`r`n`r`n"
    $headerBytes = [Text.Encoding]::ASCII.GetBytes($headers)
    $Stream.Write($headerBytes, 0, $headerBytes.Length)
    if ($Bytes.Length -gt 0) { $Stream.Write($Bytes, 0, $Bytes.Length) }
    $Stream.Flush()
}

function Send-Text($Stream, [int]$StatusCode, [string]$StatusText, [string]$ContentType, [string]$Text) {
    Send-Bytes $Stream $StatusCode $StatusText $ContentType ([Text.Encoding]::UTF8.GetBytes($Text))
}

function Get-ContentType([string]$Path) {
    switch ([IO.Path]::GetExtension($Path).ToLowerInvariant()) {
        '.html' { return 'text/html; charset=utf-8' }
        '.js'   { return 'application/javascript; charset=utf-8' }
        '.css'  { return 'text/css; charset=utf-8' }
        '.png'  { return 'image/png' }
        '.ico'  { return 'image/x-icon' }
        '.svg'  { return 'image/svg+xml' }
        default { return 'application/octet-stream' }
    }
}

function Process-Client($client) {
    try {
        $stream = $client.GetStream()
        $reader = New-Object IO.StreamReader($stream, [Text.Encoding]::ASCII, $false, 4096, $true)
        $requestLine = $reader.ReadLine()
        if ([string]::IsNullOrWhiteSpace($requestLine)) { $client.Close(); return }
        $headers = @{}
        while ($true) {
            $line = $reader.ReadLine()
            if ([string]::IsNullOrEmpty($line)) { break }
            $sep = $line.IndexOf(':')
            if ($sep -gt 0) { $headers[$line.Substring(0,$sep).Trim().ToLowerInvariant()] = $line.Substring($sep+1).Trim() }
        }

        $parts = $requestLine.Split(' ')
        $method = if ($parts.Count -gt 0) { $parts[0].ToUpperInvariant() } else { '' }
        if ($parts.Count -lt 2 -or @('GET','POST') -notcontains $method) {
            Send-Text $stream 405 'Method Not Allowed' 'text/plain; charset=utf-8' 'GET or POST only'
            return
        }
        $bodyText = ''
        if ($method -eq 'POST') {
            $contentLength = 0
            if ($headers.ContainsKey('content-length')) { [void][int]::TryParse([string]$headers['content-length'], [ref]$contentLength) }
            if ($contentLength -gt 0) {
                if ($contentLength -gt 65536) { Send-Text $stream 413 'Payload Too Large' 'application/json; charset=utf-8' '{"error":"Request too large"}'; return }
                $buffer = New-Object char[] $contentLength
                $offset = 0
                while ($offset -lt $contentLength) {
                    $read = $reader.Read($buffer, $offset, $contentLength - $offset)
                    if ($read -le 0) { break }
                    $offset += $read
                }
                if ($offset -gt 0) { $bodyText = New-Object string($buffer, 0, $offset) }
            }
        }
        $target = $parts[1]
        $uri = [Uri]("http://127.0.0.1:$Port$target")
        $path = $uri.AbsolutePath
        $query = Parse-QueryString $uri.Query
        $cacheKey = ''
        if ($method -eq 'GET' -and $path -like '/api/*' -and $path -ne '/api/health') {
            $cacheKey = Get-RequestCacheKey $path $query
            $cachedJson = Get-CachedJson $cacheKey
            if (-not [string]::IsNullOrWhiteSpace($cachedJson)) {
                Send-Text $stream 200 'OK' 'application/json; charset=utf-8' $cachedJson
                return
            }
        }

        if ($path -eq '/api/health') {
            Send-Text $stream 200 'OK' 'application/json; charset=utf-8' (ConvertTo-JsonText @{ ok = $true; version = '1.0' })
            return
        }
        if ($path -eq '/api/search') {
            try {
                $mode = [string]$query['mode']
                $location = [string]$query['location']
                if (@('zip','city','county') -notcontains $mode) { throw 'Invalid search mode.' }
                if ([string]::IsNullOrWhiteSpace($location)) { throw 'Location is required.' }
                if ($mode -eq 'zip' -and $location -notmatch '^\d{5}$') { throw 'ZIP code must be 5 digits.' }
                $result = Search-Parcels $mode $location
                Send-ApiResult $stream $result $cacheKey
            }
            catch {
                $message = $_.Exception.Message
                Write-Log "SEARCH ERROR: $message"
                Send-Text $stream 500 'Internal Server Error' 'application/json; charset=utf-8' (ConvertTo-JsonText @{ error = $message })
            }
            return
        }
        if ($path -eq '/api/commercial') {
            try {
                $mode = [string]$query['mode']
                $location = [string]$query['location']
                if (@('zip','city','subdivision') -notcontains $mode) { throw 'Invalid commercial search mode.' }
                if ([string]::IsNullOrWhiteSpace($location)) { throw 'Location is required.' }
                if ($mode -eq 'zip' -and $location -notmatch '^\d{5}$') { throw 'ZIP code must be 5 digits.' }
                $result = Search-CommercialProperties $mode $location
                Send-ApiResult $stream $result $cacheKey
            }
            catch {
                $message = $_.Exception.Message
                Write-Log "COMMERCIAL SEARCH ERROR: $message"
                Send-Text $stream 500 'Internal Server Error' 'application/json; charset=utf-8' (ConvertTo-JsonText @{ error = $message })
            }
            return
        }
        if ($path -eq '/api/owners') {
            try {
                $mode = [string]$query['mode']
                $location = [string]$query['location']
                if ([string]::IsNullOrWhiteSpace($mode)) { $mode = 'zip' }
                if ([string]::IsNullOrWhiteSpace($location)) { $location = [string]$query['zip'] }
                if (@('zip','city','subdivision') -notcontains $mode) { throw 'Invalid owner search mode.' }
                if ([string]::IsNullOrWhiteSpace($location)) { throw 'Location is required.' }
                if ($mode -eq 'zip' -and $location -notmatch '^\d{5}$') { throw 'ZIP code must be 5 digits.' }
                $yearsText = [string]$query['years']
                $years = 5
                if (-not [string]::IsNullOrWhiteSpace($yearsText)) {
                    $parsedYears = 0
                    if (-not [int]::TryParse($yearsText, [ref]$parsedYears)) { throw 'Years must be a number.' }
                    $years = $parsedYears
                }
                if ($years -lt 1 -or $years -gt 100) { throw 'Years must be between 1 and 100.' }
                $occupancy = [string]$query['occupancy']
                $ownerOnly = $occupancy -ne 'all'
                $result = Search-LongTermOwners $mode $location $years $ownerOnly
                Send-ApiResult $stream $result $cacheKey
            }
            catch {
                $message = $_.Exception.Message
                Write-Log "OWNER SEARCH ERROR: $message"
                Send-Text $stream 500 'Internal Server Error' 'application/json; charset=utf-8' (ConvertTo-JsonText @{ error = $message })
            }
            return
        }


        if ($path -eq '/api/property') {
            try {
                $address = [string]$query['address']
                if ([string]::IsNullOrWhiteSpace($address)) { throw 'Property address is required.' }
                $result = Search-PropertyByAddress $address
                Send-ApiResult $stream $result $cacheKey
            }
            catch {
                $message=$_.Exception.Message; Write-Log "PROPERTY SEARCH ERROR: $message"
                Send-Text $stream 500 'Internal Server Error' 'application/json; charset=utf-8' (ConvertTo-JsonText @{ error=$message })
            }
            return
        }

        if ($path -eq '/api/vacant-commercial') {
            try {
                $result = Search-VacantCommercialCandidates $query
                Send-ApiResult $stream $result $cacheKey
            }
            catch {
                $message=$_.Exception.Message; Write-Log "VACANT COMMERCIAL SEARCH ERROR: $message"
                Send-Text $stream 500 'Internal Server Error' 'application/json; charset=utf-8' (ConvertTo-JsonText @{ error=$message })
            }
            return
        }

        if ($path -eq '/api/search-area') {
            try {
                $geometryJson = Normalize-PolygonJson ([string]$query['polygon'])
                $result = Search-VacantByPolygon $geometryJson
                Send-ApiResult $stream $result $cacheKey
            }
            catch {
                $message = $_.Exception.Message
                Write-Log "VACANT MAP SEARCH ERROR: $message"
                Send-Text $stream 500 'Internal Server Error' 'application/json; charset=utf-8' (ConvertTo-JsonText @{ error = $message })
            }
            return
        }
        if ($path -eq '/api/commercial-area') {
            try {
                $geometryJson = Normalize-PolygonJson ([string]$query['polygon'])
                $result = Search-CommercialByPolygon $geometryJson
                Send-ApiResult $stream $result $cacheKey
            }
            catch {
                $message = $_.Exception.Message
                Write-Log "COMMERCIAL MAP SEARCH ERROR: $message"
                Send-Text $stream 500 'Internal Server Error' 'application/json; charset=utf-8' (ConvertTo-JsonText @{ error = $message })
            }
            return
        }
        if ($path -eq '/api/owners-area') {
            try {
                $geometryJson = Normalize-PolygonJson ([string]$query['polygon'])
                $yearsText = [string]$query['years']; $years = 5
                if (-not [string]::IsNullOrWhiteSpace($yearsText)) {
                    $parsedYears = 0
                    if (-not [int]::TryParse($yearsText, [ref]$parsedYears)) { throw 'Years must be a number.' }
                    $years = $parsedYears
                }
                if ($years -lt 1 -or $years -gt 100) { throw 'Years must be between 1 and 100.' }
                $occupancy = [string]$query['occupancy']; $ownerOnly = $occupancy -ne 'all'
                $result = Search-OwnersByPolygon $geometryJson $years $ownerOnly
                Send-ApiResult $stream $result $cacheKey
            }
            catch {
                $message = $_.Exception.Message
                Write-Log "OWNER MAP SEARCH ERROR: $message"
                Send-Text $stream 500 'Internal Server Error' 'application/json; charset=utf-8' (ConvertTo-JsonText @{ error = $message })
            }
            return
        }

        if ($method -eq 'POST') {
            Send-Text $stream 405 'Method Not Allowed' 'application/json; charset=utf-8' '{"error":"This endpoint only supports GET"}'
            return
        }

        if ($path -eq '/') { $path = '/index.html' }
        $relative = $path.TrimStart('/').Replace('/', [IO.Path]::DirectorySeparatorChar)
        if ($relative.Contains('..')) { Send-Text $stream 400 'Bad Request' 'text/plain' 'Bad path'; return }
        $file = Join-Path $Root $relative
        if (-not (Test-Path -LiteralPath $file -PathType Leaf)) { Send-Text $stream 404 'Not Found' 'text/plain; charset=utf-8' 'Not found'; return }
        $bytes = [IO.File]::ReadAllBytes($file)
        Send-Bytes $stream 200 'OK' (Get-ContentType $file) $bytes
    }
    catch {
        try { Send-Text $stream 500 'Internal Server Error' 'text/plain; charset=utf-8' $_.Exception.Message } catch {}
    }
    finally { try { $client.Close() } catch {} }
}

$listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, $Port)
try {
    $listener.Start()
    Write-Host ''
    Write-Host 'LEADFORGE v1.0' -ForegroundColor Yellow
    Write-Host "Running at http://127.0.0.1:$Port" -ForegroundColor Green
    Write-Host 'Keep this window open while using LeadForge.' -ForegroundColor Gray
    Write-Host ''
    # Defer remote GIS health checks until search time, so offline app startup is fast.
    Write-Host ''
    # Launch Chrome in a separate window on the primary display without changing
    # the user's Chrome profile. Existing local lead data remains accessible.
    Start-Process -FilePath 'powershell.exe' -WindowStyle Hidden -ArgumentList @(
        '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ('"' + (Join-Path $PSScriptRoot 'launch_chrome.ps1') + '"'),
        '-Url', ('"http://127.0.0.1:' + $Port + '/"')
    )

    # Handle up to four browser/API requests concurrently. This prevents one long GIS search
    # from blocking other tabs or static requests. Shared API results are cached for five minutes.
    $iss = [System.Management.Automation.Runspaces.InitialSessionState]::CreateDefault()
    $functionNames = @(
        'Write-Log',
        'Test-InvalidCity',
        'Resolve-PostalCity',
        'Add-DisplayCities',
        'ConvertTo-JsonText',
        'Get-ErrorMessage',
        'Invoke-ArcPost',
        'Escape-Sql',
        'Get-LocationWhereCandidates',
        'Add-VacantCodeFilter',
        'Get-PagedFeatures',
        'Get-LimitedFeaturesByWhere',
        'Get-PagedFeaturesByGeometry',
        'Normalize-PolygonJson',
        'Get-ObjectIdsByWhere',
        'Get-FeaturesByIds',
        'Add-Attr',
        'Normalize-Key',
        'Normalize-NumericKey',
        'Quote-SqlList',
        'Add-BuildingFootprintFlags',
        'Add-LotTractInfo',
        'Enrich-CandidateFeatures',
        'Test-VacantCode',
        'Test-FeatureLocation',
        'Search-ByCandidateWhere',
        'Search-ByLocationThenFilter',
        'Search-Parcels',
        'Add-ResidentialHomeFilter',
        'Convert-ToDeedDate',
        'Get-FullYearsOwned',
        'Normalize-AddressForMatch',
        'Test-LikelyOwnerOccupied',
        'Convert-ToNumber',
        'Test-ImprovedResidence',
        'Test-ResidentialCode',
        'Search-LongTermOwners',
        'Add-CommercialPropertyFilter',
        'Test-CommercialCode',
        'Test-CommercialHasBuilding',
        'Search-CommercialProperties',
        'Geocode-SearchCenter',
        'Get-PagedCommercialByDistance',
        'Search-VacantCommercialCandidates',
        'Search-PropertyByAddress',
        'Search-VacantByPolygon',
        'Search-CommercialByPolygon',
        'Search-OwnersByPolygon',
        'Get-RequestCacheKey',
        'Get-CachedJson',
        'Set-CachedJson',
        'Send-ApiResult',
        'Parse-QueryString',
        'Send-Bytes',
        'Send-Text',
        'Get-ContentType',
        'Process-Client'
    )
    foreach ($functionName in $functionNames) {
        $cmd = Get-Command $functionName -CommandType Function -ErrorAction SilentlyContinue
        if ($null -ne $cmd) {
            $iss.Commands.Add(([System.Management.Automation.Runspaces.SessionStateFunctionEntry]::new($functionName, $cmd.Definition)))
        }
    }
    $iss.Variables.Add(([System.Management.Automation.Runspaces.SessionStateVariableEntry]::new('Port', $Port, 'LeadForge shared state')))
    $iss.Variables.Add(([System.Management.Automation.Runspaces.SessionStateVariableEntry]::new('Root', $Root, 'LeadForge shared state')))
    $iss.Variables.Add(([System.Management.Automation.Runspaces.SessionStateVariableEntry]::new('PageSize', $PageSize, 'LeadForge shared state')))
    $iss.Variables.Add(([System.Management.Automation.Runspaces.SessionStateVariableEntry]::new('BatchSize', $BatchSize, 'LeadForge shared state')))
    $iss.Variables.Add(([System.Management.Automation.Runspaces.SessionStateVariableEntry]::new('EnrichBatchSize', $EnrichBatchSize, 'LeadForge shared state')))
    $iss.Variables.Add(([System.Management.Automation.Runspaces.SessionStateVariableEntry]::new('FootprintUrl', $FootprintUrl, 'LeadForge shared state')))
    $iss.Variables.Add(([System.Management.Automation.Runspaces.SessionStateVariableEntry]::new('LotsTractsUrl', $LotsTractsUrl, 'LeadForge shared state')))
    $iss.Variables.Add(([System.Management.Automation.Runspaces.SessionStateVariableEntry]::new('ParcelSources', $ParcelSources, 'LeadForge shared state')))
    $iss.Variables.Add(([System.Management.Automation.Runspaces.SessionStateVariableEntry]::new('OutFields', $OutFields, 'LeadForge shared state')))
    $iss.Variables.Add(([System.Management.Automation.Runspaces.SessionStateVariableEntry]::new('VacantOutFields', $VacantOutFields, 'LeadForge shared state')))
    $iss.Variables.Add(([System.Management.Automation.Runspaces.SessionStateVariableEntry]::new('OwnerOutFields', $OwnerOutFields, 'LeadForge shared state')))
    $iss.Variables.Add(([System.Management.Automation.Runspaces.SessionStateVariableEntry]::new('CommercialOutFields', $CommercialOutFields, 'LeadForge shared state')))
    $iss.Variables.Add(([System.Management.Automation.Runspaces.SessionStateVariableEntry]::new('OwnerScanFields', $OwnerScanFields, 'LeadForge shared state')))
    $iss.Variables.Add(([System.Management.Automation.Runspaces.SessionStateVariableEntry]::new('ZipCityCache', $ZipCityCache, 'LeadForge shared state')))
    $iss.Variables.Add(([System.Management.Automation.Runspaces.SessionStateVariableEntry]::new('ResponseCache', $ResponseCache, 'LeadForge shared state')))
    $iss.Variables.Add(([System.Management.Automation.Runspaces.SessionStateVariableEntry]::new('CacheTtlSeconds', $CacheTtlSeconds, 'LeadForge shared state')))
    $iss.Variables.Add(([System.Management.Automation.Runspaces.SessionStateVariableEntry]::new('ErrorActionPreference', 'Stop', '')))
    $iss.Variables.Add(([System.Management.Automation.Runspaces.SessionStateVariableEntry]::new('ProgressPreference', 'SilentlyContinue', '')))
    $runspacePool = [System.Management.Automation.Runspaces.RunspaceFactory]::CreateRunspacePool(1, 4, $iss, $Host)
    $runspacePool.Open()
    $activeRequests = New-Object System.Collections.ArrayList

    while ($true) {
        $client = $listener.AcceptTcpClient()
        for ($i = $activeRequests.Count - 1; $i -ge 0; $i--) {
            $job = $activeRequests[$i]
            if ($job.Handle.IsCompleted) {
                try { [void]$job.PowerShell.EndInvoke($job.Handle) } catch { Write-Log "Request worker error: $($_.Exception.Message)" }
                try { $job.PowerShell.Dispose() } catch {}
                $activeRequests.RemoveAt($i)
            }
        }
        $ps = [PowerShell]::Create()
        $ps.RunspacePool = $runspacePool
        [void]$ps.AddScript('param($client) Process-Client $client').AddArgument($client)
        $handle = $ps.BeginInvoke()
        [void]$activeRequests.Add([pscustomobject]@{ PowerShell = $ps; Handle = $handle })
    }
}
finally {
    try { $listener.Stop() } catch {}
    try { if ($runspacePool) { $runspacePool.Close(); $runspacePool.Dispose() } } catch {}
    try { foreach ($job in @($activeRequests)) { $job.PowerShell.Dispose() } } catch {}
}
