#!/usr/bin/env python3
"""Genera los iconos de la app (PWA) en public/icons/.

Uso:  python3 scripts/generar-iconos.py
Necesita Pillow (pip install pillow) y una tipografía negrita del sistema.

Diseño: una "r" gruesa en crema sobre fondo tinta, con un punto esmeralda: la misma
identidad que el logotipo "rumbo" de la web. Para cambiar colores, edita las constantes.
"""
import os
from PIL import Image, ImageDraw, ImageFont

TINTA = (11, 18, 32)        # #0B1220
CREMA = (250, 247, 242)     # #FAF7F2
ESMERALDA = (16, 185, 129)  # #10B981

FUENTES = [
    "/System/Library/Fonts/Supplemental/Arial Black.ttf",
    "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
    "/Library/Fonts/Arial Black.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
]
SALIDA = os.path.join(os.path.dirname(__file__), "..", "public", "icons")
G = 1024  # lienzo grande; se reduce al final para que los bordes salgan suaves


def fuente(tam):
    for f in FUENTES:
        if os.path.exists(f):
            return ImageFont.truetype(f, tam)
    raise SystemExit("No encuentro una tipografía negrita. Edita FUENTES en el script.")


def dibujar(fondo_redondeado: bool, zona: float) -> Image.Image:
    """zona = fracción del lienzo que ocupa el dibujo (1.0 = todo; <1 deja margen seguro)."""
    img = Image.new("RGBA", (G, G), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if fondo_redondeado:
        d.rounded_rectangle((0, 0, G - 1, G - 1), radius=int(G * 0.225), fill=TINTA)
    else:
        d.rectangle((0, 0, G, G), fill=TINTA)

    # La "r" en crema, centrada ópticamente dentro de la zona segura.
    tam = int(G * 0.78 * zona)
    f = fuente(tam)
    caja = d.textbbox((0, 0), "r", font=f)
    w, h = caja[2] - caja[0], caja[3] - caja[1]
    # un poco a la izquierda: el punto esmeralda ocupa el hueco de la derecha
    x = (G - w) / 2 - caja[0] - G * 0.035 * zona
    y = (G - h) / 2 - caja[1] - G * 0.01 * zona
    d.text((x, y), "r", font=f, fill=CREMA)

    # Punto esmeralda abajo a la derecha, como el punto final de "rumbo."
    r = int(G * 0.062 * zona)
    cx = int(x + caja[0] + w + G * 0.045 * zona + r)
    cy = int(y + caja[3] - r)
    d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=ESMERALDA)
    return img


def guardar(img: Image.Image, nombre: str, tam: int, opaco: bool = False):
    out = img.resize((tam, tam), Image.LANCZOS)
    if opaco:  # iOS no admite transparencia en el icono de pantalla de inicio
        base = Image.new("RGB", (tam, tam), TINTA)
        base.paste(out, mask=out.split()[3])
        out = base
    os.makedirs(SALIDA, exist_ok=True)
    ruta = os.path.join(SALIDA, nombre)
    out.save(ruta, "PNG", optimize=True)
    print(f"{nombre:28} {tam}x{tam}  {os.path.getsize(ruta) // 1024} KB")


if __name__ == "__main__":
    normal = dibujar(fondo_redondeado=True, zona=1.0)        # "any": esquinas redondeadas
    maskable = dibujar(fondo_redondeado=False, zona=0.66)    # Android recorta a su forma: dibujo en zona segura
    cuadrado = dibujar(fondo_redondeado=False, zona=1.0)     # iOS lo redondea él
    guardar(normal, "icon-192.png", 192)
    guardar(normal, "icon-512.png", 512)
    guardar(maskable, "icon-maskable-512.png", 512)
    guardar(cuadrado, "apple-touch-icon.png", 180, opaco=True)
    guardar(normal, "favicon-32.png", 32)
