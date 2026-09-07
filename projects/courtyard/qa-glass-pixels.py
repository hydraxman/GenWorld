"""Pixel-level A/B gate. Screenshots must come from the real qa-glass browser run."""
from pathlib import Path
from PIL import Image
import json
p=Path(__file__).parent/'qa/glass'
results=[]
for t in [18.5,36,40.5]:
    a=Image.open(p/f'{t}-on.png').convert('RGB')
    b=Image.open(p/f'{t}-off.png').convert('RGB')
    changed=sum(max(abs(x-y) for x,y in zip(c,d))>40 for c,d in zip(a.get_flattened_data(),b.get_flattened_data()))
    results.append({'time':t,'pixelsChangedOver40':changed})
print(json.dumps(results,indent=2))
(p/'pixel-check.json').write_text(json.dumps(results,indent=2))
for state in ['on','off']:
    Image.open(p/f'18.5-{state}.png').crop((1120,420,1225,620)).resize((420,800)).save(p/f'tree-reflection-detail-{state}.png')
assert all(r['pixelsChangedOver40']>1000 for r in results),'reflection too subtle: need visible high-contrast mapped environment, not tint-only change'
