import source from '../docs/courtyard/source-footprint.json' with {type:'json'};
// OSM way84653293 v9: combined Weilun + Shunde, ODbL1.0.
// No source vertex is flattened, rotated, discarded or reinterpreted as survey.
export const SOURCE_ENU=source.geometry_enu_m.coordinates[0].slice(0,-1);
export const enuToScene=([east,north],height=0)=>[east,height,-north];
export const FOOTPRINT=SOURCE_ENU.map(([east,north])=>[east,-north]);
