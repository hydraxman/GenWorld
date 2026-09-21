"""Rebuild the frozen outdoor route from the bundled OSM snapshot."""
import argparse,json,math,heapq,xml.etree.ElementTree as ET
from pathlib import Path
R=Path(__file__).resolve().parents[1]
def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--osm',type=Path,default=R/'campus.osm')
    parser.add_argument('--output',type=Path,default=R/'output/rebuilt-route.json')
    args=parser.parse_args()
    root=ET.parse(args.osm).getroot()
    def tags(e):return {t.attrib['k']:t.attrib['v'] for t in e.findall('tag')}
    nodes={e.attrib['id']:[float(e.attrib['lon']),float(e.attrib['lat'])] for e in root.findall('node')};node_tags={e.attrib['id']:tags(e) for e in root.findall('node')};ways={e.attrib['id']:e for e in root.findall('way')}
    def dist(a,b):return 6371000*math.hypot(math.radians(b[0]-a[0])*math.cos(math.radians((a[1]+b[1])/2)),math.radians(b[1]-a[1]))
    def polygon(e):return [nodes[n.attrib['ref']] for n in e.findall('nd') if n.attrib['ref'] in nodes]
    def inside(p,poly):
     x,y=p;c=False
     for a,b in zip(poly,poly[1:]+poly[:1]):
      if (a[1]>y)!=(b[1]>y) and x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0]:c=not c
     return c
    restricted=[polygon(e) for e in ways.values() if tags(e).get('leisure')=='park' and tags(e).get('access') in ('private','no')]
    blocked={n for n,p in nodes.items() if node_tags[n].get('foot') in ('no','private') or node_tags[n].get('barrier') in ('wall','fence') or any(inside(p,poly) for poly in restricted)}
    graph={};edgeways={}
    allowed={'footway','path','pedestrian','residential','service','unclassified','tertiary','secondary','living_street','steps'}
    for wid,e in ways.items():
     t=tags(e)
     if t.get('highway') not in allowed or t.get('area')=='yes' or t.get('indoor')=='yes' or t.get('foot') in ('no','private') or (t.get('access') in ('no','private') and t.get('foot') not in ('yes','permissive','designated')):continue
     ids=[n.attrib['ref'] for n in e.findall('nd')]
     for a,b in zip(ids,ids[1:]):
      if a not in nodes or b not in nodes or a in blocked or b in blocked:continue
      if any(inside([(nodes[a][k]+nodes[b][k])/2 for k in range(2)],poly) for poly in restricted):continue
      d=dist(nodes[a],nodes[b]);graph.setdefault(a,[]).append((b,d));edgeways[(a,b)]=wid
      if t.get('oneway:foot')!='yes':graph.setdefault(b,[]).append((a,d));edgeways[(b,a)]=wid
    # Select the main connected outdoor network; isolated courtyard fragments
    # cannot be advertised as continuous public walking routes.
    remaining=set(graph);components=[]
    while remaining:
     seed=next(iter(remaining));component={seed};stack=[seed];remaining.remove(seed)
     while stack:
      u=stack.pop()
      for v,_ in graph.get(u,[]):
       if v in remaining:remaining.remove(v);component.add(v);stack.append(v)
     components.append(component)
    main_component=max(components,key=len)
    graph={n:[(v,d) for v,d in es if v in main_component] for n,es in graph.items() if n in main_component}
    specs=[('新主楼','way','79699845'),('舜德楼','node','10173071017'),('二校门','node','941370305'),('日晷','node','941370303'),('大礼堂','way','33457842'),('水木清华','node','2354348604'),('工字厅','way','659826161'),('清华学堂','way','83805067'),('近春园','way','84273822'),('老图书馆','node','7072425636'),('西体育馆','way','226623363'),('紫荆园食堂','way','79696970')]
    stops=[]
    for name,kind,oid in specs:
     pts=polygon(ways[oid]) if kind=='way' else [nodes[oid]];p=[sum(x[i] for x in pts)/len(pts) for i in range(2)];near=min(graph,key=lambda n:dist(p,nodes[n]));stops.append(dict(name=name,osm=f'{kind}/{oid}',point=p,road_node=near,road_point=nodes[near],snap_m=dist(p,nodes[near])))
    def route(a,b):
     q=[(0,a)];ds={a:0};prev={}
     while q:
      d,u=heapq.heappop(q)
      if d!=ds[u]:continue
      if u==b:break
      for v,w in graph[u]:
       nd=d+w
       if nd<ds.get(v,float('inf')):ds[v]=nd;prev[v]=u;heapq.heappush(q,(nd,v))
     assert b in ds,('Disconnected',a,b)
     path=[b]
     while path[-1]!=a:path.append(prev[path[-1]])
     return path[::-1],ds[b]
    pairs={(i,j):route(a['road_node'],b['road_node']) for i,a in enumerate(stops) for j,b in enumerate(stops) if i!=j}
    def cost(seq):return sum(pairs[a,b][1] for a,b in zip(seq,seq[1:]))
    # Held-Karp exact dynamic programming for ten middle stops, fixed endpoints.
    N=len(stops);middle=list(range(1,N-1));full=(1<<len(middle))-1;dp={};back={}
    for j,node in enumerate(middle):dp[1<<j,j]=pairs[0,node][1];back[1<<j,j]=None
    for mask in range(1,full+1):
     for j,node in enumerate(middle):
      if (mask,j) not in dp:continue
      for k,nxt in enumerate(middle):
       if mask&(1<<k):continue
       newmask=mask|(1<<k);d=dp[mask,j]+pairs[node,nxt][1]
       if d<dp.get((newmask,k),float('inf')):dp[newmask,k]=d;back[newmask,k]=j
    last=min(range(len(middle)),key=lambda j:dp[full,j]+pairs[middle[j],N-1][1]);rev=[];mask=full
    while last is not None:
     rev.append(middle[last]);previous=back[mask,last];mask^=1<<last;last=previous
    optimal=(0,)+tuple(reversed(rev))+(N-1,)
    # Preserve the well-received V2 eight-stop narrative, then sweep north via
    # the western gym and old library to the dining finale. This is a deliberate
    # short detour for coherent sightseeing, not a claim of globally shortest tour.
    tour_names=['新主楼','舜德楼','二校门','日晷','清华学堂','大礼堂','水木清华','工字厅','近春园','西体育馆','老图书馆','紫荆园食堂']
    best=tuple(next(i for i,s in enumerate(stops) if s['name']==name) for name in tour_names)
    baseline=cost(tuple(range(N)));selected=[stops[i] for i in best];legs=[];allids=[]
    for ia,ib in zip(best,best[1:]):
     ids,d=pairs[ia,ib];legs.append(dict(start=stops[ia]['name'],end=stops[ib]['name'],distance_m=d,node_ids=ids,way_ids=list(dict.fromkeys(edgeways[a,b] for a,b in zip(ids,ids[1:])))));allids.extend(ids if not allids else ids[1:]);stops[ib]['route_index']=len(allids)-1
    selected[0]['route_index']=0;coords=[nodes[n] for n in allids];cum: list[float]=[0]
    for a,b in zip(coords,coords[1:]):cum.append(cum[-1]+dist(a,b))
    for s in selected:s['distance_m']=cum[s['route_index']]
    data=dict(crs='WGS84',stops=selected,coordinates=coords,cumulative_m=cum,total_m=cum[-1],legs=legs,optimization=dict(fixed_start='新主楼',fixed_end='紫荆园食堂',candidate_orders=math.factorial(len(middle)),dp_states=len(dp),baseline_m=baseline,shortest_network_order_m=cost(optimal),selected_tour_m=cost(best),extra_for_coherent_tour_m=cost(best)-cost(optimal),saved_vs_unordered_m=baseline-cost(best),method='Held-Karp lower bound; selected tour preserves the previous eight-stop sequence and then visits western gym/library before cafeteria. All legs use shortest outdoor network paths; no current gate-access guarantee'),restricted_park_polygons_excluded=len(restricted),source='https://www.openstreetmap.org/api/0.6/map?bbox=116.311,39.995,116.329,40.014')
    args.output.parent.mkdir(parents=True,exist_ok=True);args.output.write_text(json.dumps(data,ensure_ascii=False,indent=2));print(json.dumps({'stops':[dict(name=s['name'],snap_m=round(s['snap_m'],1)) for s in selected],'optimization':data['optimization'],'total_m':data['total_m']},ensure_ascii=False,indent=2))

if __name__=='__main__':
    main()
