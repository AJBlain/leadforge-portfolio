from pathlib import Path
from html.parser import HTMLParser
import re
root=Path(__file__).resolve().parent.parent
class Scan(HTMLParser):
  def __init__(self):super().__init__();self.ids=[];self.files=[]
  def handle_starttag(self,tag,attrs):
    a=dict(attrs)
    if 'id' in a:self.ids.append(a['id'])
    if tag=='script' and a.get('src'):self.files.append(a['src'])
    if tag=='link' and a.get('rel')=='stylesheet' and a.get('href'):self.files.append(a['href'])
for html in ['index.html','saved.html','completed.html','about.html']:
  x=Scan();x.feed((root/html).read_text());dup=[i for i in x.ids if x.ids.count(i)>1];assert set(dup).issubset({'detailMap'}),(html,set(dup)) # existing mutually exclusive detail templates
  for file in x.files:
    if file.startswith(('https://','http://')):continue
    assert (root/file).is_file(),(html,file)
  print('HTML PASS',html,'ids',len(x.ids),'refs',len(x.files))
app=(root/'app.js').read_text();html=(root/'index.html').read_text()
for k in ['redditBatchSelect','redditCoverageGrid','redditStatusFilter','redditReviewCount','redditArchiveCount','redditFilterInput']:
  assert ('id="'+k+'"') in html,k
  assert ("$('"+k+"')") in app,k
assert html.index('src="reddit-engine.js"') < html.index('src="app.js"')
assert 'state.redditPosts=state.redditPosts.map(normalizeRedditPost).filter(Boolean)' not in app
assert 'Search reported by ChatGPT' in app
assert "version = '1.0'" in (root/'server.ps1').read_text()
assert 'v1.0' in (root/'START_APP.bat').read_text()
assert 'v1.0' in html
assert 'src="brand-ui.js"' in html
assert 'src="muse-research.js"' not in html
print('WIRES PASS six filters+controls, model load order, backend/launcher version, non-mutating render')
