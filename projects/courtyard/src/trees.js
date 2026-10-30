export function scatterTreeLeaves(rand, between, cx, cy, cz, rx, ry, rz, count, size, emit) {
  for (let i = 0; i < count; i++) {
    const u = rand() * Math.PI * 2, v = between(-1, 1), r = Math.cbrt(rand()), q = Math.sqrt(1 - v * v);
    emit(cx + Math.cos(u) * q * r * rx, cy + v * r * ry, cz + Math.sin(u) * q * r * rz, size * between(.7, 1.25));
  }
}

export function buildCourtyardTree({x, z, height, spread, style = 'broad', rand, between, cylinder, cluster}) {
  const base = .12, trunk = height * .53;
  cylinder([x, base, z], [x + .14, trunk, z - .11], height * .039, height * .021, 9);
  for (let i = 0; i < 5; i++) {
    const a = rand() * Math.PI * 2;
    cylinder([x + Math.cos(a) * .85, .08, z + Math.sin(a) * .85], [x, .6, z], .045, .12, 6);
  }
  const tiers = style === 'conifer' ? 5 : 3;
  for (let tier = 0; tier < tiers; tier++) {
    const yc = height * (style === 'conifer' ? .4 + tier * .115 : .56 + tier * .13);
    const radius = spread * (style === 'conifer' ? 1 - tier * .16 : .88 - tier * .14);
    for (let b = 0; b < (style === 'conifer' ? 7 : 6); b++) {
      const a = b * Math.PI * 2 / (style === 'conifer' ? 7 : 6) + tier * .72 + between(-.17, .17);
      const rr = radius * between(.6, 1), cx = x + Math.cos(a) * rr, cz = z + Math.sin(a) * rr, cy = yc + between(-.2, .35);
      cylinder([x + .08, yc - .8, z], [cx, cy, cz], .09 * (height / 7), .025, 6);
      const cr = spread * (style === 'conifer' ? .33 : .44);
      cluster(cx, cy, cz, cr, style === 'conifer' ? .38 : spread * .37, cr,
        style === 'conifer' ? 180 : 275, style === 'conifer' ? .31 : .37);
      for (let j = 0; j < 3; j++) {
        const aa = a + between(-.9, .9), tx = cx + Math.cos(aa) * cr * .7, tz = cz + Math.sin(aa) * cr * .7;
        cylinder([cx, cy, cz], [tx, cy + .45, tz], .023, .009, 5);
      }
    }
  }
  cluster(x + .1, height * .94, z - .1, spread * .52, spread * .45, spread * .5, 430, .36);
}
