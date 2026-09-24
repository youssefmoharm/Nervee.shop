const img = (id, w = 900, h = 1200) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&h=${h}&q=80`

export const CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'outerwear', label: 'Outerwear' },
  { id: 'tops', label: 'Tops' },
  { id: 'bottoms', label: 'Bottoms' },
  { id: 'knitwear', label: 'Knitwear' },
  { id: 'accessories', label: 'Accessories' },
]

export const SIZES = ['XS', 'S', 'M', 'L', 'XL']

export const PRODUCTS = [
  {
    id: 'nv-01',
    slug: 'graphite-field-jacket',
    name: 'Graphite Field Jacket',
    price: 248,
    category: 'outerwear',
    colors: ['Graphite', 'Ink'],
    sizes: SIZES,
    tag: 'Core',
    images: [
      img('photo-1520975916090-3105956dac38'),
      img('photo-1490114538077-0a7f8cd89c70'),
      img('photo-1488161625613-41eeea975b87'),
    ],
    description:
      'A structured field jacket in dense cotton-twill. Storm flap, hidden snap placket, and articulated sleeves for movement without bulk.',
    details: ['100% cotton twill', 'Regular fit', 'Dry clean', 'Made in Portugal'],
  },
  {
    id: 'nv-02',
    slug: 'signal-tee',
    name: 'Signal Tee',
    price: 68,
    category: 'tops',
    colors: ['Bone', 'Black', 'Oxide'],
    sizes: SIZES,
    tag: 'Essential',
    images: [
      img('photo-1521572163474-6864f9cf17ab'),
      img('photo-1503342217505-b0a15ec3261c'),
      img('photo-1487222477894-8943e31ef7b2'),
    ],
    description:
      'Heavyweight jersey with a clean crew neck and dropped shoulder. Cut to sit off the body without swallowing it.',
    details: ['240gsm organic cotton', 'Relaxed fit', 'Machine wash cold', 'Made in Portugal'],
  },
  {
    id: 'nv-03',
    slug: 'ridge-wide-trouser',
    name: 'Ridge Wide Trouser',
    price: 178,
    category: 'bottoms',
    colors: ['Stone', 'Black'],
    sizes: SIZES,
    tag: 'New',
    images: [
      img('photo-1506629082955-511b1aa562c8'),
      img('photo-1473966968600-fa801b869a1a'),
      img('photo-1552374196-1ab2a1c593e8'),
    ],
    description:
      'Wide-leg trouser with a high rise and pressed crease. Soft wool-blend that holds shape through the day.',
    details: ['Wool / viscose blend', 'High rise, wide leg', 'Dry clean', 'Made in Italy'],
  },
  {
    id: 'nv-04',
    slug: 'volt-knit-crew',
    name: 'Volt Knit Crew',
    price: 198,
    category: 'knitwear',
    colors: ['Charcoal', 'Ecru'],
    sizes: SIZES,
    tag: 'Core',
    images: [
      img('photo-1434389677669-e08b4cac3105'),
      img('photo-1576566588028-4147f3842f27'),
      img('photo-1620799140408-edc6dcb6d33f'),
    ],
    description:
      'Merino crew with a dense 12-gauge knit. Ribbed cuffs and hem, slightly cropped body, no branding.',
    details: ['100% merino wool', 'Regular fit', 'Hand wash', 'Made in Scotland'],
  },
  {
    id: 'nv-05',
    slug: 'noir-overshirt',
    name: 'Noir Overshirt',
    price: 188,
    category: 'outerwear',
    colors: ['Noir', 'Olive'],
    sizes: SIZES,
    tag: 'Limited',
    images: [
      img('photo-1591047139829-d91aecb6caea'),
      img('photo-1551028719-00167b16eac5'),
      img('photo-1617137968427-85924c800a22'),
    ],
    description:
      'Boxy overshirt in washed canvas. Two chest pockets, horn buttons, and a slightly longer back hem.',
    details: ['Washed cotton canvas', 'Boxy fit', 'Machine wash cold', 'Made in Portugal'],
  },
  {
    id: 'nv-06',
    slug: 'pulse-tank',
    name: 'Pulse Tank',
    price: 54,
    category: 'tops',
    colors: ['Ivory', 'Black'],
    sizes: SIZES,
    tag: 'Essential',
    images: [
      img('photo-1618354691373-d851c5c3a990'),
      img('photo-1562157873-818bc0726f68'),
      img('photo-1583743814966-8936f5b7be1a'),
    ],
    description:
      'Ribbed tank with a deep armhole and binding at the neck. Built as a layer or worn alone.',
    details: ['Cotton / elastane rib', 'Slim fit', 'Machine wash cold', 'Made in Portugal'],
  },
  {
    id: 'nv-07',
    slug: 'axis-cargo',
    name: 'Axis Cargo',
    price: 168,
    category: 'bottoms',
    colors: ['Khaki', 'Black'],
    sizes: SIZES,
    tag: 'New',
    images: [
      img('photo-1624378439575-d8705ad7ae80'),
      img('photo-1542272604-787c3835535d'),
      img('photo-1475178626620-a4d074967452'),
    ],
    description:
      'Tapered cargo with concealed zip pockets and a drawcord hem. Technical nylon that still drapes.',
    details: ['Recycled nylon', 'Tapered fit', 'Machine wash cold', 'Made in Vietnam'],
  },
  {
    id: 'nv-08',
    slug: 'ember-cardigan',
    name: 'Ember Cardigan',
    price: 228,
    category: 'knitwear',
    colors: ['Rust', 'Black'],
    sizes: SIZES,
    tag: 'Core',
    images: [
      img('photo-1614252235316-8c857d38b5f4'),
      img('photo-1594938298603-c8148cfe5588'),
      img('photo-1434389677669-e08b4cac3105', 900, 1100),
    ],
    description:
      'Open-front cardigan in boiled wool. No buttons, clean edges, weight that hangs rather than clings.',
    details: ['Boiled wool', 'Relaxed fit', 'Dry clean', 'Made in Italy'],
  },
  {
    id: 'nv-09',
    slug: 'line-belt',
    name: 'Line Belt',
    price: 88,
    category: 'accessories',
    colors: ['Black', 'Tan'],
    sizes: ['S', 'M', 'L'],
    tag: 'Essential',
    images: [
      img('photo-1624222247344-550fb60583dc'),
      img('photo-1553062407-98eeb64c6a31'),
      img('photo-1590874103328-eac38a683ce7'),
    ],
    description:
      'Vegetable-tanned leather belt with a matte brass buckle. Thin enough to sit under a jacket, strong enough to last.',
    details: ['Vegetable-tanned leather', 'Brass hardware', 'Wipe clean', 'Made in Spain'],
  },
  {
    id: 'nv-10',
    slug: 'orbit-cap',
    name: 'Orbit Cap',
    price: 48,
    category: 'accessories',
    colors: ['Black', 'Bone'],
    sizes: ['One Size'],
    tag: 'New',
    images: [
      img('photo-1588850561407-73954769c7a4'),
      img('photo-1521369909029-2afed882baee'),
      img('photo-1575428652377-a2d80e2277fc'),
    ],
    description:
      'Unstructured six-panel cap in washed cotton. Low profile, tonal stitching, no logo.',
    details: ['Washed cotton', 'Adjustable strap', 'Spot clean', 'Made in Portugal'],
  },
  {
    id: 'nv-11',
    slug: 'current-hoodie',
    name: 'Current Hoodie',
    price: 148,
    category: 'tops',
    colors: ['Ash', 'Black'],
    sizes: SIZES,
    tag: 'Core',
    images: [
      img('photo-1556821840-3a69f8430b75'),
      img('photo-1578768079052-aa76e52d838d'),
      img('photo-1509942774463-acf339cf87d5'),
    ],
    description:
      'Loopback hoodie with a double-layer hood and kangaroo pocket. Fleece that does not pill after a season.',
    details: ['Organic cotton loopback', 'Relaxed fit', 'Machine wash cold', 'Made in Portugal'],
  },
  {
    id: 'nv-12',
    slug: 'fault-coat',
    name: 'Fault Coat',
    price: 420,
    category: 'outerwear',
    colors: ['Camel', 'Black'],
    sizes: SIZES,
    tag: 'Limited',
    images: [
      img('photo-1539533018447-63fcce2678e3'),
      img('photo-1544022613-e87ca75a784a'),
      img('photo-1591047139829-d91aecb6caea', 900, 1100),
    ],
    description:
      'Single-breasted wool coat with a hidden button placket and deep welt pockets. Cut to layer over bulk without looking it.',
    details: ['Virgin wool', 'Regular fit', 'Dry clean', 'Made in Italy'],
  },
]

export function getProduct(slug) {
  return PRODUCTS.find((p) => p.slug === slug)
}

export function getRelated(product, limit = 4) {
  const same = PRODUCTS.filter((p) => p.id !== product.id && p.category === product.category)
  const rest = PRODUCTS.filter((p) => p.id !== product.id && p.category !== product.category)
  return [...same, ...rest].slice(0, limit)
}
