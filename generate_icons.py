#!/usr/bin/env python3
"""Generate PNG icons for The Giftist extension."""
import zlib
import struct
import os

def create_png(width, height, pixels):
    """Create a PNG file from pixel data."""
    def make_chunk(chunk_type, data):
        chunk = chunk_type + data
        return struct.pack('>I', len(data)) + chunk + struct.pack('>I', zlib.crc32(chunk) & 0xffffffff)

    # PNG signature
    signature = b'\x89PNG\r\n\x1a\n'

    # IHDR chunk
    ihdr_data = struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0)  # 8-bit RGBA
    ihdr = make_chunk(b'IHDR', ihdr_data)

    # IDAT chunk (image data)
    raw_data = b''
    for y in range(height):
        raw_data += b'\x00'  # Filter byte (none)
        for x in range(width):
            raw_data += pixels[y * width + x]

    compressed = zlib.compress(raw_data, 9)
    idat = make_chunk(b'IDAT', compressed)

    # IEND chunk
    iend = make_chunk(b'IEND', b'')

    return signature + ihdr + idat + iend

def draw_gift_icon(size):
    """Draw a gift box icon."""
    pixels = []

    # Colors (RGBA)
    coral = bytes([232, 93, 76, 255])      # #E85D4C - Primary coral
    gold = bytes([248, 181, 0, 255])       # #F8B500 - Golden ribbon
    transparent = bytes([0, 0, 0, 0])
    white = bytes([255, 255, 255, 255])

    # Scale factors
    s = size / 128.0

    for y in range(size):
        for x in range(size):
            # Normalize coordinates to 0-128 space
            nx = x / s
            ny = y / s

            # Margins
            margin = 8
            box_left = margin
            box_right = 128 - margin
            box_top = 35
            box_bottom = 120
            lid_top = 20
            lid_bottom = 35
            ribbon_width = 12

            # Center lines for ribbon
            center_x = 64

            pixel = transparent

            # Check if we're in the rounded box area
            in_lid = (box_left <= nx <= box_right and lid_top <= ny <= lid_bottom)
            in_box = (box_left <= nx <= box_right and box_top <= ny <= box_bottom)

            # Ribbon bow at top
            bow_center_y = 15
            bow_radius = 12
            left_bow_x = center_x - 15
            right_bow_x = center_x + 15

            # Left bow circle
            dist_left = ((nx - left_bow_x) ** 2 + (ny - bow_center_y) ** 2) ** 0.5
            # Right bow circle
            dist_right = ((nx - right_bow_x) ** 2 + (ny - bow_center_y) ** 2) ** 0.5

            # Bow (two loops)
            if 8 < dist_left < bow_radius or 8 < dist_right < bow_radius:
                if ny < lid_top + 5:
                    pixel = gold

            # Vertical ribbon on box
            if abs(nx - center_x) < ribbon_width / 2:
                if in_lid or in_box:
                    pixel = gold

            # Horizontal ribbon on lid
            if lid_top + 5 <= ny <= lid_bottom - 2:
                if in_lid:
                    if pixel == transparent:
                        pixel = coral
                    # Add ribbon highlight
                    if abs(ny - (lid_top + lid_bottom) / 2) < 3:
                        pixel = gold

            # Box body
            if in_box and pixel == transparent:
                pixel = coral

            # Lid
            if in_lid and pixel == transparent:
                pixel = coral

            # Checkmark on the box
            check_start_x = 35
            check_mid_x = 55
            check_end_x = 85
            check_start_y = 75
            check_mid_y = 95
            check_end_y = 55

            # Draw checkmark line
            if box_top + 15 <= ny <= box_bottom - 15:
                # First segment (going down)
                if check_start_x <= nx <= check_mid_x:
                    expected_y = check_start_y + (check_mid_y - check_start_y) * (nx - check_start_x) / (check_mid_x - check_start_x)
                    if abs(ny - expected_y) < 5 * s:
                        pixel = white

                # Second segment (going up)
                if check_mid_x <= nx <= check_end_x:
                    expected_y = check_mid_y + (check_end_y - check_mid_y) * (nx - check_mid_x) / (check_end_x - check_mid_x)
                    if abs(ny - expected_y) < 5 * s:
                        pixel = white

            pixels.append(pixel)

    return pixels

def main():
    """Generate all icon sizes."""
    sizes = [16, 48, 128]
    output_dir = os.path.dirname(os.path.abspath(__file__))
    icons_dir = os.path.join(output_dir, 'icons')

    for size in sizes:
        pixels = draw_gift_icon(size)
        png_data = create_png(size, size, pixels)

        filename = os.path.join(icons_dir, f'icon{size}.png')
        with open(filename, 'wb') as f:
            f.write(png_data)
        print(f'Created {filename}')

if __name__ == '__main__':
    main()
