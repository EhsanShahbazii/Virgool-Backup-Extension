import os
from PIL import Image, ImageDraw, ImageFont

os.makedirs("assets/icons", exist_ok=True)

def create_icon(size):
    # Create image with RGBA
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Background rounded circle with smooth gradient simulation or sleek solid color
    # Virgool brand colors: primary blue #1c7ed6 (28, 126, 214) or vibrant deep blue #1864ab (24, 100, 171)
    padding = max(1, int(size * 0.05))
    bbox = [padding, padding, size - padding, size - padding]
    
    # Draw circle background
    draw.ellipse(bbox, fill=(24, 100, 171, 255))
    
    # Draw subtle inner highlight
    inner_pad = padding + max(1, int(size * 0.04))
    draw.ellipse([inner_pad, inner_pad, size - inner_pad, size - inner_pad], outline=(59, 130, 246, 180), width=max(1, size // 32))
    
    # Draw a stylized comma / virgool symbol (،) or backup arrow symbol
    # In Persian, virgool is "،". Let's draw an elegant comma shape and a small download indicator
    cx, cy = size / 2, size / 2
    r = size * 0.28
    
    # Elegant Persian comma shape:
    # A circular head at upper right, curving down and to the left
    head_r = size * 0.16
    head_cx = cx + size * 0.04
    head_cy = cy - size * 0.08
    draw.ellipse([head_cx - head_r, head_cy - head_r, head_cx + head_r, head_cy + head_r], fill=(255, 255, 255, 255))
    
    # Tail curving down-left
    tail_points = [
        (head_cx + head_r * 0.8, head_cy),
        (head_cx + head_r * 0.2, head_cy + size * 0.22),
        (head_cx - size * 0.22, head_cy + size * 0.32),
        (head_cx - size * 0.12, head_cy + size * 0.24),
        (head_cx - head_r * 0.6, head_cy + head_r * 0.5)
    ]
    draw.polygon(tail_points, fill=(255, 255, 255, 255))
    
    # Add a small emerald or cyan dot for backup indicator
    dot_r = max(2, int(size * 0.08))
    dot_x = int(cx - size * 0.24)
    dot_y = int(cy - size * 0.18)
    draw.ellipse([dot_x - dot_r, dot_y - dot_r, dot_x + dot_r, dot_y + dot_r], fill=(16, 185, 129, 255), outline=(255, 255, 255, 200), width=max(1, size // 48))

    return img

for s in [16, 32, 48, 128, 256]:
    icon = create_icon(s)
    icon.save(f"assets/icons/icon-{s}.png", "PNG")
    print(f"Created assets/icons/icon-{s}.png ({s}x{s})")
