import os
import sys

def setup_icons():
    try:
        from PIL import Image, ImageDraw, ImageFont
    except ImportError:
        print("Pillow is not installed. Installing pillow...")
        import subprocess
        subprocess.check_call([sys.executable, "-m", "pip", "install", "pillow"])
        from PIL import Image, ImageDraw, ImageFont

    # Create icons directory relative to project root
    os.makedirs("icons", exist_ok=True)

    sizes = [16, 48, 128]
    for size in sizes:
        # Create an image with transparent background
        img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        draw = ImageDraw.Draw(img)

        # Draw a beautiful circle with emerald/teal color (#10B981)
        margin = max(1, size // 10)
        draw.ellipse([margin, margin, size - margin, size - margin], fill=(16, 185, 129, 255))

        # Draw white letter 'T'
        text = "T"
        font_size = int(size * 0.6)
        try:
            font = ImageFont.truetype("arial.ttf", font_size)
        except IOError:
            font = ImageFont.load_default()

        # Get text bounding box to center it
        try:
            bbox = draw.textbbox((0, 0), text, font=font)
            w = bbox[2] - bbox[0]
            h = bbox[3] - bbox[1]
        except AttributeError:
            w, h = draw.textsize(text, font=font)

        x = (size - w) // 2
        # Adjust vertical position for better centering
        y = (size - h) // 2 - max(1, size // 16)

        draw.text((x, y), text, fill=(255, 255, 255, 255), font=font)

        img_path = os.path.join("icons", f"icon{size}.png")
        img.save(img_path)
        print(f"Generated {img_path}")

if __name__ == "__main__":
    setup_icons()
