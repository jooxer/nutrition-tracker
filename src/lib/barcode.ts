// OpenFoodFacts 公开 API：根据条码查询食品营养信息
// https://wiki.openfoodfacts.org/API
export interface BarcodeFood {
  name: string;
  spec: string;
  carb: number;     // g per 100g
  protein: number;  // g per 100g
  fat: number;      // g per 100g
  brand?: string;
  imageUrl?: string;
}

export async function lookupBarcode(barcode: string): Promise<BarcodeFood | null> {
  const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json?fields=product_name,product_name_zh,brands,nutriments,quantity,image_front_small_url`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`查询失败: ${res.status}`);
  const data = await res.json();
  if (data.status !== 1 || !data.product) return null;
  const p = data.product;
  const nut = p.nutriments || {};
  return {
    name: p.product_name_zh || p.product_name || p.brands || '未命名食品',
    spec: p.quantity || '100g',
    carb: Number(nut.carbohydrates_100g) || 0,
    protein: Number(nut.proteins_100g) || 0,
    fat: Number(nut.fat_100g) || 0,
    brand: p.brands,
    imageUrl: p.image_front_small_url
  };
}
