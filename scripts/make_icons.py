"""Generate PWA icons: emerald rounded background + tri-color macro ring + center fork+spoon."""
from PIL import Image, ImageDraw
import os
import math

# 应用主色（emerald-500）
BG = (16, 185, 129)
WHITE = (255, 255, 255)
CARB = (59, 130, 246)     # blue-500
PROTEIN = (16, 185, 129)  # emerald-500 — same as bg → use lighter for ring
PROTEIN_RING = (52, 211, 153)  # emerald-400, brighter on emerald bg
FAT = (245, 158, 11)      # amber-500


def draw_arc_thick(draw, bbox, start, end, color, width):
    """Draw an arc on a transparent overlay, then composite. PIL's arc supports width."""
    draw.arc(bbox, start=start, end=end, fill=color, width=width)


def make_apple_overlay(size, color):
    """Optional: draw an apple-shape mask in white, kept very simple."""
    pass  # not used in v1


def make_icon(size, maskable=False):
    img = Image.new('RGB', (size, size), BG)
    draw = ImageDraw.Draw(img)

    # 圆角背景
    if not maskable:
        # 重新画一个 alpha mask 圆角矩形
        mask = Image.new('L', (size, size), 0)
        mdraw = ImageDraw.Draw(mask)
        radius = int(size * 0.22)
        mdraw.rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=255)
        bg = Image.new('RGB', (size, size), BG)
        # 透明部分填白？不，PWA 图标允许透明，但我们做不透明 PNG → 圆角外用白
        # 实际上 PNG 圆角可以保留 alpha
        out = Image.new('RGBA', (size, size), (0, 0, 0, 0))
        out.paste(bg, (0, 0), mask)
        img = out
        draw = ImageDraw.Draw(img)
    # maskable 不做圆角，铺满整个 canvas（PWA 平台会自己裁切）

    # 安全区域：maskable 至少 10%
    pad = int(size * 0.12) if maskable else int(size * 0.06)
    inner = size - pad * 2

    # —— 三色环 ——
    # 三段各 90°，从顶部 -90° 开始（顺时针）
    ring_w = max(8, int(inner * 0.10))
    ring_pad = pad + int(inner * 0.10)
    bbox = [ring_pad, ring_pad, size - ring_pad - 1, size - ring_pad - 1]
    # 让弧端有点圆润：用 arc + 较粗 width
    # 三段分别：碳水(顶, 蓝) / 蛋白(右下, 亮绿) / 脂肪(左下, 橙)
    # 角度偏移：旋转 -90° 让起点在 12 点方向
    draw.arc(bbox, start=-90, end=30, fill=CARB, width=ring_w)
    draw.arc(bbox, start=40, end=160, fill=PROTEIN_RING, width=ring_w)
    draw.arc(bbox, start=170, end=290, fill=FAT, width=ring_w)

    # —— 中央：白色叉子 + 勺子（简化几何，对称）——
    cx, cy = size // 2, size // 2
    # 整组宽 ≈ inner * 0.32, 高 ≈ inner * 0.42
    fork_spoon_h = int(inner * 0.42)
    half_gap = int(inner * 0.05)
    bar_w = max(3, int(inner * 0.035))

    # 叉子（左）
    fx = cx - half_gap - int(inner * 0.06)
    top_y = cy - fork_spoon_h // 2
    bot_y = cy + fork_spoon_h // 2
    # 主柄
    draw.rectangle([fx - bar_w // 2, top_y + int(fork_spoon_h * 0.22), fx + bar_w // 2, bot_y], fill=WHITE)
    # 三个齿
    tine_h = int(fork_spoon_h * 0.35)
    tine_w = max(2, int(inner * 0.018))
    tine_gap = int(inner * 0.025)
    for dx in (-tine_gap, 0, tine_gap):
        draw.rectangle([fx + dx - tine_w // 2, top_y, fx + dx + tine_w // 2, top_y + tine_h], fill=WHITE)
    # 横线连接齿根（让它看起来是叉头）
    draw.rectangle([fx - tine_gap - tine_w // 2, top_y + tine_h, fx + tine_gap + tine_w // 2, top_y + tine_h + max(2, int(inner * 0.012))], fill=WHITE)

    # 勺子（右）
    sx = cx + half_gap + int(inner * 0.06)
    # 主柄
    draw.rectangle([sx - bar_w // 2, top_y + int(fork_spoon_h * 0.32), sx + bar_w // 2, bot_y], fill=WHITE)
    # 椭圆勺头
    head_w = int(inner * 0.13)
    head_h = int(fork_spoon_h * 0.38)
    draw.ellipse([sx - head_w // 2, top_y, sx + head_w // 2, top_y + head_h], fill=WHITE)

    return img


def main():
    out_dir = r'D:\projects\nutrition-tracker\public'
    os.makedirs(out_dir, exist_ok=True)
    for size, fname in [(192, 'pwa-192.png'), (512, 'pwa-512.png')]:
        img = make_icon(size, maskable=False)
        img.save(os.path.join(out_dir, fname), 'PNG')
        print(f'wrote {fname} {size}x{size}')
    # maskable 版本
    img = make_icon(512, maskable=True)
    img.save(os.path.join(out_dir, 'pwa-512-maskable.png'), 'PNG')
    print('wrote pwa-512-maskable.png 512x512 (maskable)')


if __name__ == '__main__':
    main()
