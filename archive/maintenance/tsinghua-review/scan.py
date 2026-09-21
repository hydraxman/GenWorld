from pathlib import Path
import subprocess,re,json
R=Path('/Users/bryannathan/.hermes/worktrees/GenWorld-tsinghua-pr')
OUT=Path(__file__).resolve().parent

def git(*args):return subprocess.check_output(['git',*args],cwd=R)
names=[x for x in git('diff','--cached','--name-only','-z').decode().split('\0') if x]
patterns={'machine_path':r'/(?:Users|home)/[A-Za-z0-9_.-]+/', 'chat_identifier':r'(?:oc_[a-f0-9]{20,}|om_x[0-9a-f]{15,})', 'private_key':r'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----', 'github_token':r'gh[pousr]_[A-Za-z0-9]{25,}', 'aws_key':r'AKIA[0-9A-Z]{16}'}
findings=[];sizes=[]
for name in names:
    data=git('show',':'+name);p=Path(name);sizes.append((len(data),name))
    if p.suffix in {'.py','.mjs','.cjs','.json','.html','.md','.txt','.osm','.svg','.example'}:
        text=data.decode(errors='replace')
        for rule,pattern in patterns.items():
            if re.search(pattern,text):findings.append({'path':name,'rule':rule})
    if any(x in p.parts for x in ['node_modules','delivery-private','output']) or p.name=='.env':findings.append({'path':name,'rule':'excluded_directory'})
assert not findings,findings
assert max(x[0] for x in sizes)<100000000
report={'index_tree':git('write-tree').decode().strip(),'staged_files':len(names),'staged_bytes':sum(x[0] for x in sizes),'largest_files':sorted(sizes,reverse=True)[:5],'static_findings':findings,'note':'Negative test asserting absence of a generic user-home prefix is not a machine-specific path'}
(OUT/'scan.json').write_text(json.dumps(report,indent=2))
paths=['README.md','WORKSPACE.md']+['projects/tsinghua-tour/'+x for x in ['tools','tests','map.html','package.json','requirements.txt','.env.example','.gitattributes','.gitignore','README.md','docs','skills','assets-manifest.json','evidence/packaging-checks.json']]
(OUT/'code.patch').write_bytes(git('diff','--cached','--',*paths))
print(json.dumps(report))
