#!/usr/bin/env python3
"""
Draw every icon and splash image the two stores ask for, from one description
of the mark rather than by resampling a 512px PNG. Rebuild them with:

    pip install pillow
    python mobile/scripts/make-assets.py

The mark is the sprout already used on the web app: two cotyledons over a
straight stem, sitting in a bowl, on a green gradient. It is defined here in
unit coordinates (0..1 across the tile) so every size is drawn at its own
resolution and stays crisp — a 48px launcher icon is not a shrunken 512.

Written for the sizes each platform actually reads:

  Android  mipmap-*/ic_launcher.png          legacy square icon, rounded
           mipmap-*/ic_launcher_round.png    legacy round icon
           mipmap-*/ic_launcher_foreground.png  adaptive foreground, 108dp
                                             canvas with the mark inside the
                                             66dp circle that is guaranteed
                                             visible under every OEM mask
           mipmap-*/ic_launcher_monochrome.png  Android 13 themed icons
           drawable*/splash.png              launch image, per density and
                                             per orientation

  iOS      AppIcon-512@2x.png                1024x1024, flattened onto opaque
                                             pixels — App Store Connect
                                             rejects an icon with an alpha
                                             channel
           Splash.imageset/*.png             2732x2732, centre-cropped

  Listings play-icon-512.png                 Play Store icon
           play-feature-graphic-1024x500.png Play Store feature graphic
           appstore-icon-1024.png            App Store icon
"""

import math
import os
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
MOBILE = os.path.dirname(HERE)
REPO = os.path.dirname(MOBILE)
ANDROID_RES = os.path.join(MOBILE, "android", "app", "src", "main", "res")
IOS_ASSETS = os.path.join(MOBILE, "ios", "App", "App", "Assets.xcassets")
STORE = os.path.join(REPO, "store")

SS = 4  # supersampling factor; everything is drawn big and shrunk once

TOP = (31, 111, 74)       # #1f6f4a
BOTTOM = (54, 167, 111)   # #36a76f
LEAF_NEAR = (244, 249, 247)
LEAF_FAR = (196, 234, 211)
WHITE = (255, 255, 255)
PAPER = (246, 248, 245)   # #f6f8f5, the app's own background


# ---------------------------------------------------------------- background

def gradient(size, top=TOP, bottom=BOTTOM):
    """Vertical gradient tile, fully opaque."""
    im = Image.new("RGB", (1, size), top)
    px = im.load()
    for y in range(size):
        t = y / max(1, size - 1)
        px[0, y] = tuple(round(a + (b - a) * t) for a, b in zip(top, bottom))
    return im.resize((size, size), Image.BILINEAR).convert("RGBA")


# ---------------------------------------------------------------------- mark

def _ellipse(draw, cx, cy, rx, ry, deg, fill, S):
    """A rotated ellipse, drawn as a polygon so it can be rotated at all."""
    a = math.radians(deg)
    ca, sa = math.cos(a), math.sin(a)
    pts = []
    for i in range(180):
        t = 2 * math.pi * i / 180
        x, y = rx * math.cos(t), ry * math.sin(t)
        pts.append(((cx + x * ca - y * sa) * S, (cy + x * sa + y * ca) * S))
    draw.polygon(pts, fill=fill)


def mark(size, scale=1.0, mono=False):
    """The sprout on transparent pixels.

    scale shrinks the mark about the centre of the tile. The adaptive-icon
    foreground uses scale≈0.62 so nothing important sits outside the circle
    an OEM mask may crop to.
    """
    S = SS
    W = size * S
    im = Image.new("RGBA", (W, W), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)

    near = WHITE if mono else LEAF_NEAR
    far = WHITE if mono else LEAF_FAR

    def fx(u):  # unit coordinate -> pixels, with the mark scaled about centre
        return (0.5 + (u - 0.5) * scale) * size

    def L(u):   # unit length -> pixels
        return u * size * scale

    # stem
    sw = L(0.040)
    d.rounded_rectangle(
        [((fx(0.5) - sw / 2) * S, fx(0.352) * S),
         ((fx(0.5) + sw / 2) * S, fx(0.812) * S)],
        radius=sw * S / 2, fill=near + (250,))

    # cotyledons — the far one first so the near one overlaps it
    _ellipse(d, fx(0.668), fx(0.312), L(0.192), L(0.136), -28, far + (255,), S)
    _ellipse(d, fx(0.311), fx(0.453), L(0.158), L(0.112), -19, near + (255,), S)

    # bowl
    r = L(0.506)
    cx, cy = fx(0.5), fx(0.471)
    d.arc([((cx - r) * S, (cy - r) * S), ((cx + r) * S, (cy + r) * S)],
          start=47, end=133, fill=near + (255,), width=int(L(0.028) * S))

    return im.resize((size, size), Image.LANCZOS)


def rounded_mask(size, radius_ratio=0.2237):
    """iOS/Android legacy squircle-ish corner mask."""
    S = SS
    m = Image.new("L", (size * S, size * S), 0)
    ImageDraw.Draw(m).rounded_rectangle(
        [0, 0, size * S - 1, size * S - 1],
        radius=int(size * S * radius_ratio), fill=255)
    return m.resize((size, size), Image.LANCZOS)


def circle_mask(size):
    S = SS
    m = Image.new("L", (size * S, size * S), 0)
    ImageDraw.Draw(m).ellipse([0, 0, size * S - 1, size * S - 1], fill=255)
    return m.resize((size, size), Image.LANCZOS)


def icon(size, shape="rounded", scale=1.0):
    im = gradient(size)
    im.alpha_composite(mark(size, scale))
    if shape == "rounded":
        im.putalpha(rounded_mask(size))
    elif shape == "circle":
        im.putalpha(circle_mask(size))
    return im


def flatten(im, bg=(255, 255, 255)):
    """Drop the alpha channel — required for the App Store icon."""
    out = Image.new("RGB", im.size, bg)
    out.paste(im, mask=im.split()[-1] if im.mode == "RGBA" else None)
    return out


# -------------------------------------------------------------------- splash

def splash(w, h):
    """Launch image: the app's own paper background with the mark centred.

    Deliberately not the green icon — the app opens onto a light screen, and
    a dark splash that flips to light reads as a flash on every launch.
    """
    im = Image.new("RGBA", (w, h), PAPER + (255,))
    side = int(min(w, h) * 0.28)
    logo = icon(side, "rounded")
    im.alpha_composite(logo, ((w - side) // 2, (h - side) // 2))
    return im


# ----------------------------------------------------------- feature graphic

FONT_DIRS = [
    "/usr/share/fonts/truetype/google-fonts",
    "/usr/share/fonts/truetype/lato",
    "/usr/share/fonts/truetype/dejavu",
    "C:/Windows/Fonts",
    "/System/Library/Fonts/Supplemental",
]


def font(names, size):
    """First of `names` that exists on this machine, else Pillow's default."""
    from PIL import ImageFont
    for n in names:
        for d in FONT_DIRS:
            p = os.path.join(d, n)
            if os.path.exists(p):
                return ImageFont.truetype(p, size)
    return ImageFont.load_default()


def feature_graphic():
    """1024x500 banner for the Play listing.

    Play crops and overlays this differently across placements, so the mark
    sits left, the words sit in the middle, and the outer ~8% is kept empty.
    """
    W, H = 1024, 500
    im = Image.new("RGBA", (W, H))
    im.alpha_composite(gradient(W, (20, 74, 50), (37, 130, 87)).resize((W, H), Image.BILINEAR))

    m = mark(340)
    im.alpha_composite(m, (78, (H - 340) // 2))

    d = ImageDraw.Draw(im)
    d.text((452, 168), "Pocket Fertilizer",
           font=font(["Poppins-Bold.ttf", "Lato-Bold.ttf", "DejaVuSans-Bold.ttf"], 62),
           fill=(255, 255, 255, 255))
    d.text((455, 248), "Plan the beds. Track the seed.",
           font=font(["Lato-Regular.ttf", "Poppins-Regular.ttf", "DejaVuSans.ttf"], 34),
           fill=(226, 242, 233, 255))
    d.text((455, 292), "Read the leaves.",
           font=font(["Lato-Regular.ttf", "Poppins-Regular.ttf", "DejaVuSans.ttf"], 34),
           fill=(226, 242, 233, 255))
    # The strapline is shrunk until it clears the right margin, so a font
    # substitution on another machine cannot push it off the edge.
    strap = "Works offline  ·  No account  ·  Encrypted on your phone"
    for pt in range(23, 13, -1):
        f = font(["Lato-Regular.ttf", "Poppins-Regular.ttf", "DejaVuSans.ttf"], pt)
        if d.textlength(strap, font=f) <= W - 455 - 78:
            break
    d.text((455, 356), strap, font=f, fill=(178, 216, 195, 255))
    return im


# ---------------------------------------------------------------------- emit

def save(im, *path):
    p = os.path.join(*path)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    im.save(p, "PNG", optimize=True)
    return p


def main():
    written = []

    # ---- Android launcher icons
    # legacy sizes are 48dp; adaptive foreground is a 108dp canvas
    for bucket, legacy, adaptive in [
        ("mdpi", 48, 108), ("hdpi", 72, 162), ("xhdpi", 96, 216),
        ("xxhdpi", 144, 324), ("xxxhdpi", 192, 432),
    ]:
        d = os.path.join(ANDROID_RES, "mipmap-" + bucket)
        written.append(save(icon(legacy, "rounded"), d, "ic_launcher.png"))
        written.append(save(icon(legacy, "circle"), d, "ic_launcher_round.png"))
        written.append(save(mark(adaptive, 0.62), d, "ic_launcher_foreground.png"))
        written.append(save(mark(adaptive, 0.62, mono=True), d, "ic_launcher_monochrome.png"))

    # ---- Android splash, per density and orientation
    for bucket, (pw, ph) in [
        ("mdpi", (320, 480)), ("hdpi", (480, 800)), ("xhdpi", (720, 1280)),
        ("xxhdpi", (960, 1600)), ("xxxhdpi", (1280, 1920)),
    ]:
        written.append(save(splash(pw, ph), ANDROID_RES, "drawable-port-" + bucket, "splash.png"))
        written.append(save(splash(ph, pw), ANDROID_RES, "drawable-land-" + bucket, "splash.png"))
    written.append(save(splash(1280, 1920), ANDROID_RES, "drawable", "splash.png"))

    # ---- iOS
    written.append(save(flatten(icon(1024, "square")), IOS_ASSETS,
                        "AppIcon.appiconset", "AppIcon-512@2x.png"))
    sp = splash(2732, 2732)
    for name in ["splash-2732x2732.png", "splash-2732x2732-1.png", "splash-2732x2732-2.png"]:
        written.append(save(sp, IOS_ASSETS, "Splash.imageset", name))

    # ---- store listings
    written.append(save(icon(512, "square"), STORE, "play-icon-512.png"))
    written.append(save(flatten(icon(1024, "square")), STORE, "appstore-icon-1024.png"))

    # Play rejects a feature graphic that carries transparency, so it goes
    # out as 24-bit RGB rather than RGBA.
    written.append(save(flatten(feature_graphic(), (20, 74, 50)), STORE,
                        "play-feature-graphic-1024x500.png"))

    for p in written:
        print(os.path.relpath(p, REPO))
    print(f"\n{len(written)} images written.")


if __name__ == "__main__":
    main()
