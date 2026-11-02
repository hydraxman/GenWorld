import {FontLoader} from 'three/addons/loaders/FontLoader.js';
import lettering from './sem-lettering.json' with {type: 'json'};

export const SEM_WALL_TEXT = Object.freeze([...lettering.lines]);

export function addSEMWallLettering(THREE, builder, face, width) {
  const font = new FontLoader().parse(structuredClone(lettering));
  const sign = new THREE.Group();
  sign.name = 'Jianhua north red wall bilingual raised lettering';
  sign.position.set(width / 2, 10.8, .412);
  sign.userData = {role: 'photo-supported-sem-wall-lettering', lines: SEM_WALL_TEXT,
    source: 'User-provided north red-wall close-up; official north exterior',
    fontSource: lettering.sourceFont, fontLicense: 'SIL OFL 1.1',
    limitations: 'Wording and four-line layout observed; typeface, scale, mounting height and metal finish approximated, not original calligraphy.'};
  face.add(sign);
  const metal = new THREE.MeshStandardMaterial({name: 'Jianhua warm brushed metal raised letters',
    color: '#b8af91', metalness: .65, roughness: .42});
  metal.userData.campusMetalReflection = true;
  const rows = [[2.55, 1.45], [4.35, .15], [6.65, -.75], [3.95, -1.35]];
  SEM_WALL_TEXT.forEach((text, index) => {
    const shapes = font.generateShapes(text, 1);
    if (!shapes.length) throw new Error(`Missing SEM wall lettering outlines: ${text}`);
    const geometry = new THREE.ExtrudeGeometry(shapes, {depth: .065, bevelEnabled: false, curveSegments: 2});
    geometry.computeBoundingBox();
    const box = geometry.boundingBox, size = box.getSize(new THREE.Vector3()), center = box.getCenter(new THREE.Vector3());
    const scale = rows[index][0] / size.x;
    geometry.translate(-center.x, -center.y, 0);
    geometry.scale(scale, scale, 1);
    const line = new THREE.Group();
    line.name = `Raised SEM wall text line ${index + 1}`;
    line.position.y = rows[index][1];
    line.userData = {text, line: index + 1, role: 'raised-sign-line',
      outlineCount: shapes.length, counterCount: shapes.reduce((sum, shape) => sum + shape.holes.length, 0)};
    sign.add(line);
    builder.add(line, geometry, metal);
  });
  return sign;
}
