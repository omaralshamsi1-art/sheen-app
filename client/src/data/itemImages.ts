/**
 * Maps menu item names to their Talabat image URLs.
 * Add more entries here as photos become available.
 */
export const itemImages: Record<string, string> = {
  'Creamy Vanilla Matcha':
    'https://images.deliveryhero.io/image/talabat/MenuItems/Creamy_Vanilla_Matcha639088353306696676.jpg',
  'Creamy Vanilla Coffee Cold':
    'https://images.deliveryhero.io/image/talabat/MenuItems/Creamy_Vanilla_Coffee_Col639088334943989690.jpg',
  'V60 Cold':
    'https://images.deliveryhero.io/image/talabat/MenuItems/V60_Cold639088333653667142.jpg',
  'Creamy Mango Matcha':
    'https://images.deliveryhero.io/image/talabat/MenuItems/Creamy_Mango_Matcha639088353350640362.jpg',
}

export function getItemImage(name: string): string | undefined {
  return itemImages[name]
}
