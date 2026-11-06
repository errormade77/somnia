"""Render a lightweight abstract interpretation of the running-girl dream.

Requires numpy, Pillow, FFmpeg. Palette and motion come from the source frames.
python scripts/prepare-abstract-dream.py --ffmpeg /path/to/ffmpeg
"""
import argparse
import json
from pathlib import Path
import subprocess
import numpy as np
from PIL import Image

parser = argparse.ArgumentParser()
parser.add_argument('--ffmpeg', default='ffmpeg')
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]
source = root / 'assets/dreams/dream-10.mp4'
destination = root / 'assets/dreams/running-abstract.mp4'
fps, size, sample = 24, 512, 64
decoded = subprocess.run([args.ffmpeg, '-v', 'error', '-i', str(source), '-vf',
    f'fps={fps},scale={sample}:{sample}', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'],
    check=True, capture_output=True).stdout
frames = np.frombuffer(decoded, dtype=np.uint8).reshape(-1, sample, sample, 3).astype(np.float32)
count = len(frames)
sy, sx = np.mgrid[0:sample, 0:sample] / sample
palettes, positions = [], []
for frame in frames:
    r, g, b = np.moveaxis(frame, -1, 0)
    masks = [
        (sy < .35) & (b > r) & (g > r),
        (sy > .5) & (b < g * .8) & (r < 155) & (g < 150),
        (r > 145) & (r > g) & (r < g * 1.32) & (g > b) & (sx > .15) & (sx < .85),
        (r > 145) & (r > g * 1.22) & (g > b * 1.25),
    ]
    palette = [np.median(frame[mask], axis=0) if mask.any() else frame.mean(axis=(0, 1)) for mask in masks]
    palettes.append(palette)
    subject = masks[2] | masks[3]
    positions.append([sx[subject].mean(), sy[subject].mean()])

def smooth(values, radius):
    # Circular smoothing avoids a pop at the loop boundary.
    return sum(np.roll(values, offset, axis=0) for offset in range(-radius, radius + 1)) / (2 * radius + 1)

palettes = smooth(np.asarray(palettes), 9)
positions = smooth(np.asarray(positions), 7)
motion = smooth(np.abs(frames - np.roll(frames, 1, axis=0)).mean(axis=(1, 2, 3)), 7)
motion /= max(float(motion.max()), 1)
y, x = np.mgrid[0:size, 0:size].astype(np.float32) / size

def blend(a, b, weight):
    return a * (1 - weight[..., None]) + b * weight[..., None]

def soft_edge(distance, softness):
    t = np.clip(.5 - distance / softness, 0, 1)
    return t * t * (3 - 2 * t)

def ellipse(cx, cy, rx, ry, angle, softness=.13):
    dx, dy = x - cx, y - cy
    u = (dx * np.cos(angle) + dy * np.sin(angle)) / rx
    v = (-dx * np.sin(angle) + dy * np.cos(angle)) / ry
    return soft_edge(np.sqrt(u * u + v * v) - 1, softness)

encoder = subprocess.Popen([args.ffmpeg, '-hide_banner', '-loglevel', 'error', '-y',
    '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{size}x{size}', '-r', str(fps), '-i', '-',
    '-an', '-c:v', 'libx264', '-preset', 'slow', '-crf', '24', '-pix_fmt', 'yuv420p',
    '-g', '48', '-threads', '2', '-movflags', '+faststart', str(destination)], stdin=subprocess.PIPE)
snapshots = []
for i in range(count):
    phase = 2 * np.pi * i / count
    sky, olive, cream, gold = palettes[i]
    drift_x = float(positions[i, 0] - .5)
    drift_y = float(positions[i, 1] - .5)
    energy = float(motion[i])
    # Broad colour fields retain the sky/grass relationship without a literal landscape.
    horizon = .66 + .07 * np.sin(x * 4.5 + phase) + .07 * drift_y
    weight = np.clip((y - horizon + .18) / .4, 0, 1)
    picture = blend(sky, olive, weight)
    picture = blend(picture, cream, ellipse(.12 + .08 * np.cos(phase), .92, .62, .31, -.45, .4) * .45)

    # A warm oval echoes the movement of the hair, with a soft gradient through it.
    amber_mask = ellipse(.67 + drift_x * .7 + .09 * np.sin(phase), .3 + drift_y * .35,
                         .29, .4, -.5 + .4 * np.cos(phase), .16)
    amber = blend(gold, cream, np.clip(.8 - y - x * .25, 0, 1))
    picture = blend(picture, amber, amber_mask)

    # Flowing fabric becomes a folded cream ribbon; shape responds to source motion.
    center = .44 + .15 * np.sin(y * 6.1 - phase) + drift_x * .55
    width = .15 + .045 * np.cos(y * 5 + phase) + energy * .025
    ribbon_mask = soft_edge(np.abs(x - center) - width, .045)
    fold = np.clip((x - center + width) / (2 * width), 0, 1)
    ribbon = blend(cream, gold, np.power(fold, 2) * .62)
    ribbon = blend(ribbon, sky, (1 - fold) ** 3 * .36)
    picture = blend(picture, ribbon, ribbon_mask)

    # The meadow becomes a second rounded form, opening a blue negative space.
    green_mask = ellipse(.8 + .1 * np.sin(phase + .8), .91, .46, .29,
                         -.45 + .18 * np.sin(phase), .16)
    meadow = blend(olive, gold, np.clip(1 - y + x * .25, 0, 1) * .6)
    picture = blend(picture, meadow, green_mask)
    blue_mask = ellipse(.24 + .055 * np.sin(phase), .34 + .07 * np.cos(phase),
                        .14 + energy * .02, .21, .6 + .5 * np.cos(phase), .22)
    blue = blend(sky, cream, np.clip(y * .55 + x * .25, 0, 1))
    picture = blend(picture, blue, blue_mask * .92)
    output = np.clip(picture, 0, 255).astype(np.uint8)
    encoder.stdin.write(output.tobytes())
    if i in [0, count // 3, 2 * count // 3]:
        snapshots.append(Image.fromarray(output))
encoder.stdin.close()
if encoder.wait():
    raise SystemExit('Video encoding failed')
subprocess.run([args.ffmpeg, '-v', 'error', '-y', '-i', str(destination), '-frames:v', '1',
                '-q:v', '3', str(destination.with_suffix('.jpg'))], check=True)
qa = root / '.qa'
qa.mkdir(exist_ok=True)
contact = Image.new('RGB', (768, 256))
for index, image in enumerate(snapshots):
    contact.paste(image.resize((256, 256)), (index * 256, 0))
contact.save(qa / 'abstract-dream-frames.jpg', quality=93)
print(json.dumps({'source': source.name, 'frames': count, 'duration': count / fps,
    'bytes': destination.stat().st_size,
    'palette': ['#' + ''.join(f'{int(c):02x}' for c in color) for color in palettes.mean(axis=0)]}, indent=2))
