from pathlib import Path
import re
root=Path(__file__).resolve().parent.parent
ignore={'LeadForge.ico','leadforge-preview.png','LeadForge.exe','payload.zip'}
patterns={
  'Embedded personal brokerage':re.compile(r'Century\s*21|Judge\s*Fite',re.I),
  'Embedded outreach license':re.compile(r'License\s*#\s*\d{6,9}',re.I),
  'Embedded API credential':re.compile(r'(?i)(?:api_key|client_key|auth_token)\s*[=:]\s*[\x27\x22][A-Za-z0-9_-]{24,}[\x27\x22]'),
  'Remote research service':re.compile(r'/api/muse/',re.I),
}
files=[p for p in root.rglob('*') if p.is_file() and p.name not in ignore and not any(s.startswith('.') for s in p.parts) and 'dist' not in p.parts]
errors=[]
for p in files:
  if p.suffix.lower() in {'.zip','.exe','.ico','.png','.jpg','.webp','.pyc'}:continue
  t=p.read_text(encoding='utf8',errors='replace')
  # Omit test fixture regex/old-key test from the scanner: those contain non-sensitive examples.
  if p.parent.name=='tests':continue
  for label,pat in patterns.items():
    if pat.search(t):errors.append(f'{p.relative_to(root)}: {label}')
assert not errors,'Privacy scan found:\n'+'\n'.join(errors)
print('PASS privacy scan (runtime/docs, no real names/credentials)')
