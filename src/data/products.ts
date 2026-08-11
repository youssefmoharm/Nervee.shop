import type { Collection, Product } from '../types'

// Placeholder imagery — swap with real campaign photography.
// Seeded picsum images keep each product visually consistent across pages.
const img = (seed: string, w = 900, h = 1125) => `https://picsum.photos/seed/${seed}/${w}/${h}`

export const collections: Collection[] = [
  {
    id: 'core-essentials',
    name: 'CORE ESSENTIALS',
    tagline: 'EVERYDAY PIECES',
    description:
      'The foundation of the NERVE closet — heavyweight cotton staples designed to be lived in, worn out, and reached for first.',
    image: img('nerve-core-essentials', 1400, 1750),
  },
  {
    id: 'nerve-archive',
    name: 'NERVE ARCHIVE',
    tagline: 'LIMITED EDITIONS',
    description:
      'Small-batch releases that don\u2019t come back. Numbered pieces for the ones who were there first.',
    image: img('nerve-archive-edit', 1400, 1750),
  },
  {
    id: 'street-form',
    name: 'STREET FORM',
    tagline: 'BUILT FOR MOVEMENT',
    description:
      'Technical fabrics and articulated cuts built for the pace of the city — engineered comfort with a sharp silhouette.',
    image: img('nerve-street-form', 1400, 1750),
  },
]

const sizesFull = (excluded: string[] = []) =>
  (['XS', 'S', 'M', 'L', 'XL', 'XXL'] as const).map((size) => ({
    size,
    inStock: !excluded.includes(size),
  }))

export const products: Product[] = [
  {
    id: 'p-001',
    slug: 'nerve-core-tee',
    name: 'NERVE CORE TEE',
    category: 'T-Shirts',
    collectionId: 'core-essentials',
    price: 1250,
    currency: 'EGP',
    badge: 'NEW',
    isBestSeller: true,
    createdAt: '2026-06-01',
    colors: [
      { name: 'Navy', hex: '#061735', image: img('core-tee-navy'), hoverImage: img('core-tee-navy-b') },
      { name: 'White', hex: '#FFFFFF', image: img('core-tee-white'), hoverImage: img('core-tee-white-b') },
      { name: 'Gray', hex: '#A7A7A7', image: img('core-tee-gray'), hoverImage: img('core-tee-gray-b') },
    ],
    sizes: sizesFull(['XXL']),
    description:
      'The tee that started it all. Heavyweight 240gsm cotton, boxy body, dropped shoulder. Built to hold its shape wash after wash.',
    material: '100% heavyweight combed cotton, 240gsm',
    care: ['Machine wash cold, inside out', 'Do not bleach', 'Tumble dry low', 'Iron on reverse'],
    gallery: [img('core-tee-navy'), img('core-tee-navy-b'), img('core-tee-detail')],
  },
  {
    id: 'p-002',
    slug: 'nerve-oversized-tee',
    name: 'NERVE OVERSIZED TEE',
    category: 'T-Shirts',
    collectionId: 'street-form',
    price: 1250,
    currency: 'EGP',
    badge: 'NEW',
    isBestSeller: false,
    createdAt: '2026-06-10',
    colors: [
      { name: 'Black', hex: '#000000', image: img('oversized-tee-black'), hoverImage: img('oversized-tee-black-b') },
      { name: 'Navy', hex: '#061735', image: img('oversized-tee-navy'), hoverImage: img('oversized-tee-navy-b') },
    ],
    sizes: sizesFull(),
    description:
      'A drop-shoulder oversized fit with an extended hem. Garment-washed for a broken-in feel from the first wear.',
    material: '100% cotton jersey, garment-dyed',
    care: ['Machine wash cold', 'Do not iron print', 'Hang dry recommended'],
    gallery: [img('oversized-tee-black'), img('oversized-tee-black-b'), img('oversized-tee-detail')],
    fitNotes: 'Runs oversized — size down for a closer fit.',
  },
  {
    id: 'p-003',
    slug: 'core-zip-hoodie',
    name: 'CORE ZIP HOODIE',
    category: 'Hoodies',
    collectionId: 'core-essentials',
    price: 2450,
    compareAtPrice: 2900,
    currency: 'EGP',
    badge: 'SALE',
    isBestSeller: true,
    createdAt: '2026-05-20',
    colors: [
      { name: 'Navy', hex: '#061735', image: img('zip-hoodie-navy'), hoverImage: img('zip-hoodie-navy-b') },
      { name: 'Gray', hex: '#A7A7A7', image: img('zip-hoodie-gray'), hoverImage: img('zip-hoodie-gray-b') },
    ],
    sizes: sizesFull(['XS']),
    description:
      'Full-zip hoodie in brushed-back fleece with a lined hood and ribbed cuffs. Metal NERVE zip pull, embroidered wordmark on chest.',
    material: '80% cotton, 20% polyester fleece, 380gsm',
    care: ['Machine wash cold', 'Zip up before washing', 'Do not tumble dry'],
    gallery: [img('zip-hoodie-navy'), img('zip-hoodie-navy-b'), img('zip-hoodie-detail')],
  },
  {
    id: 'p-004',
    slug: 'nerve-track-pants',
    name: 'NERVE TRACK PANTS',
    category: 'Pants',
    collectionId: 'street-form',
    price: 1850,
    currency: 'EGP',
    badge: null,
    isBestSeller: false,
    createdAt: '2026-04-15',
    colors: [
      { name: 'Black', hex: '#000000', image: img('track-pants-black'), hoverImage: img('track-pants-black-b') },
      { name: 'Navy', hex: '#061735', image: img('track-pants-navy'), hoverImage: img('track-pants-navy-b') },
    ],
    sizes: sizesFull(['XS', 'XXL']),
    description:
      'Tapered track pants in a brushed technical weave with articulated knees for movement. Side zip pockets, elastic drawcord waist.',
    material: '92% polyester, 8% elastane, brushed technical weave',
    care: ['Machine wash cold', 'Do not bleach', 'Low iron if needed'],
    gallery: [img('track-pants-black'), img('track-pants-black-b'), img('track-pants-detail')],
  },
  {
    id: 'p-005',
    slug: 'archive-denim',
    name: 'ARCHIVE DENIM',
    category: 'Denim',
    collectionId: 'nerve-archive',
    price: 2650,
    currency: 'EGP',
    badge: 'LIMITED',
    isBestSeller: false,
    createdAt: '2026-03-02',
    colors: [
      { name: 'Raw Indigo', hex: '#1c2b4a', image: img('archive-denim-indigo'), hoverImage: img('archive-denim-indigo-b') },
      { name: 'Washed Black', hex: '#0d0d0d', image: img('archive-denim-black'), hoverImage: img('archive-denim-black-b') },
    ],
    sizes: sizesFull(['XS', 'S']),
    description:
      'Numbered archive release. Straight-leg selvedge denim, 14oz rigid cotton that breaks in to your shape. Each pair individually numbered on the inner waistband.',
    material: '100% rigid selvedge cotton denim, 14oz',
    care: ['Wash sparingly, cold water', 'Hang dry', 'Avoid dryer to preserve shrink-to-fit'],
    gallery: [img('archive-denim-indigo'), img('archive-denim-indigo-b'), img('archive-denim-detail')],
  },
  {
    id: 'p-006',
    slug: 'everyday-cap',
    name: 'EVERYDAY CAP',
    category: 'Caps',
    collectionId: 'core-essentials',
    price: 850,
    currency: 'EGP',
    badge: 'NEW',
    isBestSeller: false,
    createdAt: '2026-06-18',
    colors: [
      { name: 'Navy', hex: '#061735', image: img('cap-navy'), hoverImage: img('cap-navy-b') },
      { name: 'White', hex: '#FFFFFF', image: img('cap-white'), hoverImage: img('cap-white-b') },
    ],
    sizes: [{ size: 'S', inStock: true }, { size: 'M', inStock: true }, { size: 'L', inStock: true }],
    description:
      'Six-panel unstructured cap in washed cotton twill with a curved brim and embroidered NERVE checkerboard tab at the back.',
    material: '100% washed cotton twill',
    care: ['Spot clean only', 'Do not machine wash'],
    gallery: [img('cap-navy'), img('cap-navy-b'), img('cap-detail')],
  },
  {
    id: 'p-007',
    slug: 'signature-jacket',
    name: 'SIGNATURE JACKET',
    category: 'Jackets',
    collectionId: 'nerve-archive',
    price: 3450,
    currency: 'EGP',
    badge: 'LIMITED',
    isBestSeller: true,
    createdAt: '2026-02-11',
    colors: [
      { name: 'Navy', hex: '#061735', image: img('sig-jacket-navy'), hoverImage: img('sig-jacket-navy-b') },
    ],
    sizes: sizesFull(['XS', 'XXL']),
    description:
      'The NERVE signature coach jacket. Water-resistant shell, checkerboard-lined interior, snap-button front and embroidered chest wordmark.',
    material: 'Shell: 100% nylon, water-resistant finish. Lining: 100% cotton checkerboard jacquard.',
    care: ['Wipe clean', 'Dry clean for deep clean', 'Do not tumble dry'],
    gallery: [img('sig-jacket-navy'), img('sig-jacket-navy-b'), img('sig-jacket-detail')],
  },
  {
    id: 'p-008',
    slug: 'nerve-essentials-tee',
    name: 'NERVE ESSENTIALS TEE',
    category: 'T-Shirts',
    collectionId: 'core-essentials',
    price: 1050,
    currency: 'EGP',
    badge: 'BEST SELLER',
    isBestSeller: true,
    createdAt: '2026-01-22',
    colors: [
      { name: 'White', hex: '#FFFFFF', image: img('ess-tee-white'), hoverImage: img('ess-tee-white-b') },
      { name: 'Black', hex: '#000000', image: img('ess-tee-black'), hoverImage: img('ess-tee-black-b') },
      { name: 'Navy', hex: '#061735', image: img('ess-tee-navy'), hoverImage: img('ess-tee-navy-b') },
    ],
    sizes: sizesFull(),
    description:
      'A slim, everyday tee in mid-weight cotton with a clean crew neck. The one you buy in every color.',
    material: '100% combed cotton, 180gsm',
    care: ['Machine wash cold', 'Tumble dry low'],
    gallery: [img('ess-tee-white'), img('ess-tee-white-b'), img('ess-tee-detail')],
  },
  {
    id: 'p-009',
    slug: 'street-form-jacket',
    name: 'STREET FORM SHELL',
    category: 'Jackets',
    collectionId: 'street-form',
    price: 2950,
    currency: 'EGP',
    badge: null,
    isBestSeller: false,
    createdAt: '2026-05-02',
    colors: [
      { name: 'Black', hex: '#000000', image: img('shell-black'), hoverImage: img('shell-black-b') },
      { name: 'Silver', hex: '#A7A7A7', image: img('shell-silver'), hoverImage: img('shell-silver-b') },
    ],
    sizes: sizesFull(['XS']),
    description:
      'Lightweight technical shell built for motion — articulated sleeves, taped seams, packable hood.',
    material: '100% recycled polyester ripstop, DWR coating',
    care: ['Machine wash cold, gentle cycle', 'Do not iron', 'Reproof as needed'],
    gallery: [img('shell-black'), img('shell-black-b'), img('shell-detail')],
  },
  {
    id: 'p-010',
    slug: 'core-crew-top',
    name: 'CORE CREW TOP',
    category: 'Tops',
    collectionId: 'core-essentials',
    price: 1650,
    currency: 'EGP',
    badge: 'RESTOCKED',
    isBestSeller: false,
    createdAt: '2026-06-15',
    colors: [
      { name: 'Gray', hex: '#A7A7A7', image: img('crew-top-gray'), hoverImage: img('crew-top-gray-b') },
      { name: 'Navy', hex: '#061735', image: img('crew-top-navy'), hoverImage: img('crew-top-navy-b') },
    ],
    sizes: sizesFull(),
    description:
      'A midweight crewneck in a looped-back cotton terry. Ribbed collar, cuffs and hem for a fit that holds.',
    material: '100% cotton loopback terry',
    care: ['Machine wash cold', 'Tumble dry low'],
    gallery: [img('crew-top-gray'), img('crew-top-gray-b'), img('crew-top-detail')],
  },
  {
    id: 'p-011',
    slug: 'motion-accessory-belt',
    name: 'NERVE UTILITY BELT',
    category: 'Accessories',
    collectionId: 'street-form',
    price: 750,
    currency: 'EGP',
    badge: null,
    isBestSeller: false,
    createdAt: '2026-04-28',
    colors: [{ name: 'Black', hex: '#000000', image: img('belt-black'), hoverImage: img('belt-black-b') }],
    sizes: [{ size: 'S', inStock: true }, { size: 'M', inStock: true }, { size: 'L', inStock: true }],
    description:
      'Woven technical webbing belt with a matte metal NERVE buckle. Adjustable, one size fits most within range.',
    material: 'Nylon webbing, matte alloy hardware',
    care: ['Wipe clean with damp cloth'],
    gallery: [img('belt-black'), img('belt-black-b')],
  },
  {
    id: 'p-012',
    slug: 'archive-denim-jacket',
    name: 'ARCHIVE TRUCKER',
    category: 'Jackets',
    collectionId: 'nerve-archive',
    price: 2850,
    currency: 'EGP',
    badge: 'LIMITED',
    isBestSeller: false,
    createdAt: '2026-01-09',
    colors: [{ name: 'Raw Indigo', hex: '#1c2b4a', image: img('trucker-indigo'), hoverImage: img('trucker-indigo-b') }],
    sizes: sizesFull(['XS', 'XXL']),
    description:
      'Cropped trucker cut from the same 14oz selvedge as the Archive Denim. Numbered edition, checkerboard-jacquard inner collar.',
    material: '100% rigid selvedge cotton denim, 14oz',
    care: ['Wash sparingly, cold water', 'Hang dry'],
    gallery: [img('trucker-indigo'), img('trucker-indigo-b')],
  },
]

export const getBestSellers = () => products.filter((p) => p.isBestSeller)
export const getNewDrop = () =>
  [...products].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)).slice(0, 8)
export const getProductBySlug = (slug: string) => products.find((p) => p.slug === slug)
export const getRelated = (product: Product, count = 4) =>
  products.filter((p) => p.id !== product.id && p.category === product.category).slice(0, count)
export const getCollection = (id: string) => collections.find((c) => c.id === id)
export const getProductsByCollection = (id: string) => products.filter((p) => p.collectionId === id)

export const categories: Category_[] = [
  'New Arrivals',
  'T-Shirts',
  'Hoodies',
  'Pants',
  'Denim',
  'Tops',
  'Jackets',
  'Caps',
  'Accessories',
]
type Category_ = 'New Arrivals' | Product['category']
