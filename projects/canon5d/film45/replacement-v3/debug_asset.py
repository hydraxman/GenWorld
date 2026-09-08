import bpy,json
from mathutils import Vector
s=bpy.data.scenes['Canon5D_Replacement_V3'];bpy.context.window.scene=s;s.frame_set(1)
print('COLLECTIONS',[(c.name,c.hide_render,c.hide_viewport,len(c.objects)) for c in s.collection.children])
print('LAYER',[(c.name,c.exclude,c.hide_viewport) for c in s.view_layers[0].layer_collection.children])
items=[]
for o in s.objects:
 if o.name.startswith('V3_Asset_'):
  p=[o.matrix_world@Vector(c) for c in o.bound_box]
  items.append({'name':o.name,'hide':o.hide_render,'verts':len(o.data.vertices),'polys':len(o.data.polygons),'pos':list(o.location),'scale':list(o.scale),'bbox':[[min(v[i] for v in p) for i in range(3)],[max(v[i] for v in p) for i in range(3)]],'collections':[c.name for c in o.users_collection]})
print('ASSETS',json.dumps(items))
