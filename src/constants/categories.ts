export const CATEGORIES = [
  '主食', '水果', '碳水其他', '蛋白', '脂肪',
  '混合', 'KFC', '德克士', '喜茶', '茉莉奶白', '其他'
] as const;

export type Category = typeof CATEGORIES[number];
