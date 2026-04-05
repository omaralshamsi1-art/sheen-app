/**
 * Maps menu item names to image URLs.
 * Talabat CDN images for featured items; Unsplash for the rest.
 */
export const itemImages: Record<string, string> = {

  // ── COFFEE ──────────────────────────────────────────────────────────────────
  'V60':
    'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400&h=400&fit=crop&auto=format',
  'Espresso':
    'https://images.unsplash.com/photo-1510591509098-f4fdc6d0ff04?w=400&h=400&fit=crop&auto=format',
  'Americano':
    'https://images.unsplash.com/photo-1580661869408-55ab23f2ca6e?w=400&h=400&fit=crop&auto=format',
  'Piccolo':
    'https://images.unsplash.com/photo-1561047029-3000c68339ca?w=400&h=400&fit=crop&auto=format',
  'Cortado':
    'https://images.unsplash.com/photo-1514432324607-6a8d8b2ba5c1?w=400&h=400&fit=crop&auto=format',
  'Latte':
    'https://images.unsplash.com/photo-1504630083234-14187a9df0f5?w=400&h=400&fit=crop&auto=format',
  'Cappuccino':
    'https://images.unsplash.com/photo-1572442388796-11668a67e53d?w=400&h=400&fit=crop&auto=format',
  'Flatwhite':
    'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=400&fit=crop&auto=format',
  'Spanish Latte':
    'https://images.unsplash.com/photo-1611854779393-1b2da9d400fe?w=400&h=400&fit=crop&auto=format',
  'Mocha':
    'https://images.unsplash.com/photo-1545665277-5937489579f2?w=400&h=400&fit=crop&auto=format',
  'Creamy Vanilla Coffee':
    'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=400&h=400&fit=crop&auto=format',
  'Creamy Vanilla Coffee Cold':
    'https://images.deliveryhero.io/image/talabat/MenuItems/Creamy_Vanilla_Coffee_Col639088334943989690.jpg',
  'Spanish Cortado':
    'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=400&h=400&fit=crop&auto=format',

  // ── MATCHA ──────────────────────────────────────────────────────────────────
  'Iced Matcha':
    'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=400&h=400&fit=crop&auto=format',
  'Matcha':
    'https://images.unsplash.com/photo-1616085290814-c663de3e6cda?w=400&h=400&fit=crop&auto=format',
  'Creamy Vanilla Matcha':
    'https://images.deliveryhero.io/image/talabat/MenuItems/Creamy_Vanilla_Matcha639088353306696676.jpg',
  'Creamy Mango Matcha':
    'https://images.deliveryhero.io/image/talabat/MenuItems/Creamy_Mango_Matcha639088353350640362.jpg',
  'Matcha Blended':
    'https://images.unsplash.com/photo-1570856503770-f699bf175b00?w=400&h=400&fit=crop&auto=format',

  // ── COLD DRINKS ─────────────────────────────────────────────────────────────
  'V60 Cold':
    'https://images.deliveryhero.io/image/talabat/MenuItems/V60_Cold639088333653667142.jpg',
  'Raspberry Iced Tea':
    'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=400&h=400&fit=crop&auto=format',
  'Mango Iced Tea':
    'https://images.unsplash.com/photo-1546173159-315724a31696?w=400&h=400&fit=crop&auto=format',
  'Hibiscus Iced Tea':
    'https://images.unsplash.com/photo-1523362628745-0c100150b504?w=400&h=400&fit=crop&auto=format',
  'Peach Iced Tea':
    'https://images.unsplash.com/photo-1499638673689-79a0b5115d87?w=400&h=400&fit=crop&auto=format',

  // ── AÇAÍ ────────────────────────────────────────────────────────────────────
  'Acai Bowl':
    'https://images.unsplash.com/photo-1590301157890-4810ed352733?w=400&h=400&fit=crop&auto=format',
  'Acai Smoothie':
    'https://images.unsplash.com/photo-1638176067030-8a12afd00e37?w=400&h=400&fit=crop&auto=format',

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
