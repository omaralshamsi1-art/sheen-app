/**
 * Maps menu item names to local images from /public/images/.
 * Real SHEEN café photos.
 */
export const itemImages: Record<string, string> = {

  // ── COFFEE ──────────────────────────────────────────────────────────────────
  'V60':            '/images/V60 Hot.webp',
  'Espresso':       '/images/Espresso Hot.webp',
  'Americano':      '/images/Americano Hot.webp',
  'Piccolo':        '/images/Piccolo Hot.webp',
  'Cortado':        '/images/Cortado Hot.webp',
  'Latte':          '/images/Latte Hot.webp',
  'Cappuccino':     '/images/Cappucino Hot.webp',
  'Flatwhite':      '/images/Flatwhite Hot.webp',
  'Spanish Latte':  '/images/Spanish Latte Hot.webp',
  'Mocha':          '/images/Mocha Hot.webp',
  'Creamy Vanilla Coffee': '/images/Creamy Vanilla Coffee Hot.webp',
  'Spanish Cortado': '/images/Spanish Cortado Hot.webp',

  // ── MATCHA ──────────────────────────────────────────────────────────────────
  'Iced Matcha':           '/images/Iced Matcha.webp',
  'Matcha':                '/images/Matcha.webp',
  'Creamy Vanilla Matcha': '/images/Creamy Vanilla Matcha.webp',
  'Creamy Mango Matcha':   '/images/Creamy Mango Matcha.webp',
  'Matcha Blended':        '/images/Matcha Blended.webp',

  // ── COLD DRINKS ─────────────────────────────────────────────────────────────
  'Raspberry Iced Tea': '/images/Raspberry Iced Tea.webp',
  'Mango Iced Tea':     '/images/Mango Iced Tea.webp',
  'Hibiscus Iced Tea':  '/images/Hibiscus Iced Tea.webp',
  'Peach Iced Tea':     '/images/Peach Iced Tea.webp',

  // ── AÇAÍ ────────────────────────────────────────────────────────────────────
  'Acai Bowl':
    'https://images.unsplash.com/photo-1590301157890-4810ed352733?w=400&h=400&fit=crop&auto=format',
  'Acai Smoothie':  '/images/Acai Smoothie.webp',

  // ── DESSERTS ────────────────────────────────────────────────────────────────
  'Cheesecake':
    'https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=400&h=400&fit=crop&auto=format',
  'Cookies':
    'https://images.unsplash.com/photo-1499636136210-6f4ee915583e?w=400&h=400&fit=crop&auto=format',
  'Sheen Signature':
    'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400&h=400&fit=crop&auto=format',

  // ── BITES ───────────────────────────────────────────────────────────────────
  'Croissant':
    'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=400&h=400&fit=crop&auto=format',
  'Banana Bread':
    'https://images.unsplash.com/photo-1495147466023-ac5c588e2e94?w=400&h=400&fit=crop&auto=format',
}

export function getItemImage(name: string): string | undefined {
  return itemImages[name]
}
