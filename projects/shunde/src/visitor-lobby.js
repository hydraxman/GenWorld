export function addVisitorLobby(THREE, B, parent, materials, kind, {textured}) {
  const shunde = kind === 'shunde', floor = shunde ? .9 : .45, back = shunde ? -6 : -8;
  const width = shunde ? 11.6 : 20.1;
  const box = (name, x, y, z, w, h, d, material) => B.box(parent, name, x, y, z, w, h, d, material);
  if (shunde) {
    box('Illustrative lobby floor', 0, floor - .05, -.4, width, .1, 11.6, materials.floor);
    box('Illustrative lobby ceiling', 0, 4.3, -2.4, width, .16, 7.4, materials.wall);
    box('Illustrative lobby back wall', 0, 2.6, back, width, 3.4, .18, materials.wall);
    for (const sign of [-1, 1]) box('Illustrative lobby side wall', sign * width / 2, 2.6, -2.4, .18, 3.4, 7.4, materials.wall);
  } else box('Open entrance threshold', 0, floor - .06, .12, 4.4, .12, .7, materials.floor);
  box('Illustrative interior wall lining', 0, floor + 1.65, back + .13, width - .4, 3.3, .06, materials.wall);
  box('Illustrative stone skirting', 0, floor + .12, back + .18, width - .4, .24, .08, materials.floor);
  for (const x of [-3.1, 3.1]) {
    box('Illustrative wall batten', x, floor + 1.8, back + .2, .08, 3, .12, materials.frame);
  }
  const notice = new THREE.MeshStandardMaterial({name: 'Illustrative visitor lobby notice', color: '#c6bba3', roughness: .8});
  if (textured) {
    const canvas = document.createElement('canvas');
    canvas.width = 768; canvas.height = 384;
    const context = canvas.getContext('2d');
    context.fillStyle = '#e9e4d8'; context.fillRect(0, 0, 768, 384);
    context.fillStyle = '#344b43'; context.textAlign = 'center';
    context.font = '72px sans-serif'; context.fillText(shunde ? '舜德楼' : '建华楼', 384, 216);
    notice.map = B.texture(canvas, true); notice.color.set('#ffffff');
  }
  box('Illustrative visitor notice surround', 0, floor + 1.85, back + .24, 2.8, 1.48, .1, materials.frame);
  box('Illustrative visitor notice face', 0, floor + 1.85, back + .30, 2.68, 1.34, .03, notice);
  for (const sign of [-1, 1]) {
    const x = sign * 4.3;
    box('Illustrative lobby bench seat', x, floor + .43, back + 1.3, 1.8, .10, .55, materials.floor);
    box('Illustrative lobby bench back', x, floor + .72, back + 1.05, 1.8, .45, .08, materials.wall);
    for (const offset of [-.65, .65]) box('Illustrative lobby bench leg', x + offset, floor + .20, back + 1.3, .06, .4, .4, materials.frame);
  }
  for (let x = -4; x <= 4; x += 2) box('Illustrative floor joint', x, floor + .003, back / 2, .012, .006, Math.abs(back) - .8, materials.frame);
  const zones = shunde ? [
    {min: [-3, 2.9], max: [3, 5.3], floor},
    {min: [-.96, .7], max: [.96, 3.05], floor},
    {min: [-5.5, -5.7], max: [5.5, .85], floor},
  ] : [
    {min: [-3.4, .7], max: [3.4, 6], floor: .24},
    {min: [-1.85, -2.2], max: [1.85, .95], floor},
    {min: [-5.3, -7.5], max: [5.3, -2.05], floor},
  ];
  parent.userData.walkthrough = {id: kind, title: shunde ? '舜德楼 · 门厅' : '建华楼 · 北门中庭',
    limitations: '入口外观有照片参照；室内铺装、座椅及可漫游门厅范围为示意，不代表完整室内平面或实测现状。',
    spawn: [0, shunde ? 4.5 : 4.6], entryTarget: [0, shunde ? .2 : -2.6], yaw: Math.PI, eyeHeight: 1.65, zones,
    obstacles: [-1, 1].map(sign => ({min: [sign * 4.3 - .95, back + .75], max: [sign * 4.3 + .95, back + 1.65]}))};
}
