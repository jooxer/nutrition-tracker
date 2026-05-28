export interface BarcodeFood {
  name: string;
  spec: string;
  carb: number;     // g per 100g
  protein: number;  // g per 100g
  fat: number;      // g per 100g
  brand?: string;
  imageUrl?: string;
  source?: string;
}

// 多数据源级联查询：OFF → UPCitemdb → 万能查
export async function lookupBarcode(barcode: string): Promise<BarcodeFood | null> {
  // 1. OpenFoodFacts（国际覆盖最广，中国商品偏少）
  const off = await queryOpenFoodFacts(barcode);
  if (off) return off;

  // 2. UPCitemdb（免费，覆盖面广，含部分中国商品）
  const upc = await queryUPCitemdb(barcode);
  if (upc) return upc;

  // 3. 中国商品条码查询（mxnzp.com 免费 API）
  const cn = await queryChinaBarcode(barcode);
  if (cn) return cn;

  return null;
}

async function queryOpenFoodFacts(barcode: string): Promise<BarcodeFood | null> {
  try {
    const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json?fields=product_name,product_name_zh,brands,nutriments,quantity,image_front_small_url`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.status !== 1 || !data.product) return null;
    const p = data.product;
    const nut = p.nutriments || {};
    if (!nut.carbohydrates_100g && !nut.proteins_100g && !nut.fat_100g) return null;
    return {
      name: p.product_name_zh || p.product_name || p.brands || '未命名食品',
      spec: p.quantity || '100g',
      carb: Number(nut.carbohydrates_100g) || 0,
      protein: Number(nut.proteins_100g) || 0,
      fat: Number(nut.fat_100g) || 0,
      brand: p.brands,
      imageUrl: p.image_front_small_url,
      source: 'OpenFoodFacts'
    };
  } catch { return null; }
}

async function queryUPCitemdb(barcode: string): Promise<BarcodeFood | null> {
  try {
    const res = await fetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${encodeURIComponent(barcode)}`, {
      signal: AbortSignal.timeout(5000)
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.items || !data.items.length) return null;
    const item = data.items[0];
    return {
      name: item.title || '未命名食品',
      spec: item.size || '100g',
      carb: 0,
      protein: 0,
      fat: 0,
      brand: item.brand,
      imageUrl: item.images?.[0],
      source: 'UPCitemdb'
    };
  } catch { return null; }
}

async function queryChinaBarcode(barcode: string): Promise<BarcodeFood | null> {
  try {
    const appId = import.meta.env.VITE_MXNZP_APP_ID || 'rgihdrm0kslojqvm';
    const appSecret = import.meta.env.VITE_MXNZP_APP_SECRET || 'WnhrK3RRMkdPZWFMbVdBbGtRRmhVZz09';
    const res = await fetch(`https://www.mxnzp.com/api/barcode/goods/details?barcode=${encodeURIComponent(barcode)}&app_id=${appId}&app_secret=${appSecret}`, {
      signal: AbortSignal.timeout(5000)
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.code !== 1 || !data.data) return null;
    const d = data.data;
    return {
      name: d.goodsName || '未命名食品',
      spec: d.goodsSpecification || '100g',
      carb: 0,
      protein: 0,
      fat: 0,
      brand: d.trademark,
      imageUrl: d.goodsImage,
      source: '中国商品条码'
    };
  } catch { return null; }
}

