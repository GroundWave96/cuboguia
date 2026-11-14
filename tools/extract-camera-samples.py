"""
Gera tests/fixtures/camera-samples.json a partir das fotos em tests/cube images/.

Cada foto tem a posição da face (4 cantos, ou pontos soltos no Megaminx) e a cor
certa de cada adesivo, marcadas à mão. A amostra imita o que a câmera do site faz:
reduz a imagem e tira a mediana de um quadrado no meio de cada adesivo.

Uso: python tools/extract-camera-samples.py
"""
import json, os
from PIL import Image, ImageOps

ROOT = os.path.join(os.path.dirname(__file__), '..', 'tests')
IMG = os.path.join(ROOT, 'cube images')

# folhas de marcação: (x0, y0, escala) — coordenadas marcadas na folha → pixel da foto
A = (453.6, 1330.56, 0.28345)   # 3x3, primeiras fotos
B = (302.4, 806.4, 0.24802)     # 3x3, fotos escuras
C = (302.4, 1008.0, 0.24802)    # 2x2
CUBE3 = {'Y': 'U', 'O': 'R', 'G': 'F', 'W': 'D', 'R': 'L', 'B': 'B'}

# foto, folha, luz, cantos (sup-esq, sup-dir, inf-dir, inf-esq), cores linha a linha (* = logo)
FACES3 = [
    ('IMG_6155', A, 'claro', [(145, 60), (420, 55), (422, 332), (148, 335)], 'YOO WGB RBR'),
    ('IMG_6156', A, 'claro', [(142, 145), (412, 128), (420, 405), (147, 412)], 'BWW WOY GYG'),
    ('IMG_6157', A, 'claro', [(70, 183), (360, 181), (360, 478), (65, 478)], 'BOR RBO ORG'),
    ('IMG_6158', A, 'claro', [(102, 198), (410, 203), (385, 503), (85, 498)], 'YGG WRR YOB'),
    ('IMG_6159', A, 'claro', [(160, 92), (410, 112), (393, 332), (152, 338)], 'YBR GYR OGB'),
    ('IMG_6160', A, 'claro', [(85, 40), (410, 52), (400, 370), (80, 370)], 'WBO G*Y WYW'),
    ('IMG_6161', A, 'medio', [(92, -32), (465, -30), (468, 330), (100, 332)], 'WBO G*Y WYW'),
    ('IMG_6162', A, 'medio', [(100, -25), (510, -25), (500, 388), (80, 388)], 'BOR RBO ORG'),
    ('IMG_6166', A, 'medio', [(190, 118), (455, 125), (440, 393), (162, 378)], 'WYG WOY BWG'),
    ('IMG_6163', B, 'medio', [(130, 90), (490, 120), (470, 465), (115, 440)], 'YBR GYR OGB'),
    ('IMG_6164', B, 'medio', [(105, 85), (440, 105), (415, 440), (75, 425)], 'RBR BGW OOY'),
    ('IMG_6165', B, 'medio', [(65, 145), (390, 150), (390, 470), (75, 480)], 'WBO G*Y WYW'),
    ('IMG_6167', B, 'medio', [(165, 85), (475, 85), (485, 400), (175, 395)], 'YWY ORG BRG'),
    ('IMG_6169', B, 'escuro', [(135, 145), (435, 140), (440, 440), (145, 440)], 'YOO WGB RBR'),
    ('IMG_6170', B, 'escuro', [(155, 105), (475, 110), (465, 420), (165, 420)], 'BWW WOY GYG'),
    ('IMG_6171', B, 'escuro', [(185, 50), (530, 60), (535, 390), (200, 390)], 'BOR RBO ORG'),
    ('IMG_6172', B, 'escuro', [(205, 45), (540, 50), (530, 395), (195, 385)], 'YGG WRR YOB'),
    ('IMG_6173', B, 'escuro', [(150, 135), (450, 120), (450, 420), (155, 425)], 'YBR GYR OGB'),
    ('IMG_6174', B, 'escuro', [(195, 150), (520, 150), (510, 470), (190, 470)], 'WBO G*Y WYW'),
]
FACES2 = [
    ('IMG_6185', C, 'claro', [(75, 35), (490, 40), (490, 440), (85, 450)], 'GY WW'),
    ('IMG_6186', C, 'claro', [(105, 165), (450, 165), (455, 515), (100, 525)], 'GW RB'),
    ('IMG_6187', C, 'claro', [(110, 130), (445, 170), (425, 500), (75, 485)], 'GR WY'),
    ('IMG_6188', C, 'claro', [(115, 170), (435, 160), (440, 480), (125, 485)], 'OY BO'),
    ('IMG_6189', C, 'claro', [(60, 30), (450, 25), (445, 420), (65, 415)], 'RY BO'),
    ('IMG_6190', C, 'claro', [(155, 100), (500, 100), (495, 450), (150, 440)], 'RG OB'),
]
# Pyraminx: cantos da face na folha (ponta de cima, inf-esq, inf-dir) e as 9 cores na ordem:
# ponta de cima, aresta esq., centro de cima, aresta dir., ponta inf-esq, centro inf-esq,
# aresta de baixo, centro inf-dir, ponta inf-dir  (G verde, Y amarelo, R vermelho, B azul)
P = (0.0, 604.8, 0.19841)
PYRA_KEYS = {'G': 'F', 'Y': 'D', 'R': 'L', 'B': 'R'}
PYRA = [
    ('IMG_6191', [(278, 20), (45, 420), (495, 418)], 'GBGGBYYYR'),
    ('IMG_6192', [(338, 100), (135, 355), (468, 420)], 'RGRRYRYBG'),
    ('IMG_6193', [(310, 105), (105, 405), (465, 425)], 'BRBBYBYYG'),
    ('IMG_6196', [(308, 135), (152, 380), (448, 400)], 'YGGBRGRRB'),
]
PYRA_BARY = [(7, 1, 1), (4, 4, 1), (5, 2, 2), (4, 1, 4), (1, 7, 1), (2, 5, 2), (1, 4, 4), (2, 2, 5), (1, 1, 7)]

# Megaminx: pontos soltos (na folha, com o deslocamento do painel), chave da cor e se é o centro
MEGA = [
    ('1ceae760', (0, 0), [((300, 240), 'DL', 1), ((210, 105), 'DR', 0), ((295, 110), 'DBR', 0), ((390, 105), 'R', 0), ((400, 190), 'DBR', 0),
                          ((165, 215), 'DL', 0), ((140, 300), 'DL', 0), ((220, 295), 'DR', 0), ((435, 285), 'BL', 0), ((330, 315), 'U', 0),
                          ((290, 370), 'BR', 0), ((75, 170), 'DR', 0), ((480, 150), 'DBL', 0), ((210, 60), 'F', 0)]),
    ('3ab7b064', (610, 0), [((900, 265), 'U', 1), ((775, 250), 'BL', 0), ((1000, 230), 'DR', 0), ((1065, 325), 'BL', 0), ((980, 355), 'D', 0),
                            ((920, 450), 'B', 0), ((845, 380), 'BR', 0), ((740, 370), 'L', 0), ((875, 165), 'DBR', 0), ((780, 140), 'B', 0),
                            ((712, 240), 'DBL', 0)]),
    ('3ed68898', (0, 607), [((300, 840), 'R', 1), ((140, 860), 'DBL', 0), ((350, 735), 'DBL', 0), ((190, 790), 'U', 0), ((270, 710), 'BR', 0),
                            ((450, 830), 'L', 0), ((450, 740), 'DL', 0), ((360, 960), 'D', 0), ((230, 960), 'DL', 0), ((460, 960), 'DBR', 0),
                            ((250, 1040), 'DR', 0)]),
    ('5c8a5f4c', (610, 607), [((900, 820), 'DBL', 1), ((950, 680), 'L', 0), ((870, 750), 'DBR', 0), ((1005, 765), 'U', 0), ((1085, 820), 'D', 0),
                              ((1040, 900), 'B', 0), ((970, 980), 'R', 0), ((880, 950), 'DBL', 0), ((770, 960), 'BR', 0), ((800, 830), 'D', 0),
                              ((735, 730), 'U', 0), ((690, 955), 'DR', 0)]),
    ('5e690bda', (0, 0), [((310, 250), 'L', 1), ((420, 210), 'R', 0), ((190, 195), 'BL', 0), ((290, 110), 'L', 0), ((410, 95), 'BR', 0),
                          ((190, 95), 'U', 0), ((160, 300), 'DBR', 0), ((255, 355), 'BR', 0), ((365, 330), 'D', 0), ((480, 300), 'L', 0),
                          ((310, 430), 'DBR', 0)]),
    ('758fd92f', (610, 0), [((900, 190), 'BL', 1), ((1000, 230), 'DL', 0), ((750, 160), 'DBL', 0),
                            ((790, 225), 'BR', 0), ((1000, 325), 'DBL', 0), ((800, 310), 'U', 0), ((870, 50), 'R', 0), ((1030, 140), 'DBR', 0)]),
    ('9e3c06cf', (0, 579), [((290, 760), 'DR', 1), ((350, 860), 'DBL', 0), ((430, 840), 'DL', 0), ((260, 930), 'L', 0), ((200, 850), 'D', 0),
                            ((200, 650), 'DBL', 0), ((90, 800), 'DL', 0)]),
    ('c4ef0d97', (610, 579), [((890, 800), 'F', 1), ((1080, 800), 'R', 0), ((770, 700), 'BL', 0), ((870, 690), 'DBL', 0), ((950, 690), 'D', 0),
                              ((1000, 870), 'BL', 0), ((950, 990), 'R', 0), ((760, 830), 'BR', 0), ((770, 960), 'BL', 0)]),
    ('cb1ebe2a', (0, 0), [((270, 290), 'B', 1), ((365, 355), 'F', 0), ((140, 400), 'F', 0), ((250, 400), 'R', 0), ((335, 445), 'DBR', 0),
                          ((150, 300), 'DL', 0), ((440, 280), 'DL', 0), ((365, 215), 'L', 0), ((145, 190), 'DBL', 0), ((230, 175), 'BL', 0),
                          ((310, 140), 'DR', 0), ((420, 140), 'BR', 0)]),
]


def load(path):
    return ImageOps.exif_transpose(Image.open(path)).convert('RGB')


def median_rgb(im, cx, cy, half):
    box = im.crop((int(cx - half), int(cy - half), int(cx + half) + 1, int(cy + half) + 1))
    px = list(box.getdata())
    return [sorted(p[k] for p in px)[len(px) // 2] for k in range(3)]


def grid_pixels(im, cx, cy, half, n=8):
    """n×n pixels espalhados no quadrado (para analisar o centro com logo)"""
    out = []
    for i in range(n):
        for j in range(n):
            x = cx - half + (2 * half) * (j + 0.5) / n
            y = cy - half + (2 * half) * (i + 0.5) / n
            out.append(list(im.getpixel((int(x), int(y)))))
    return out


def cube_faces(folder, faces, n):
    out = []
    for name, (x0, y0, s), light, quad, colors in faces:
        im = load(os.path.join(IMG, folder, name + '.jpeg'))
        Q = [(x0 + X / s, y0 + Y / s) for X, Y in quad]
        # reduz como a câmera do site (lado da face ≈ 0,66 × 360 px)
        side = ((Q[1][0] - Q[0][0]) + (Q[2][0] - Q[3][0])) / 2
        k = (0.66 * 360) / side
        small = im.resize((int(im.width * k), int(im.height * k)), Image.BILINEAR)
        Q = [(x * k, y * k) for x, y in Q]
        labels = colors.replace(' ', '')
        cs = 0.66 * 360 / n
        cells = []
        for r in range(n):
            for c in range(n):
                u, v = (c + 0.5) / n, (r + 0.5) / n
                px = (1 - u) * (1 - v) * Q[0][0] + u * (1 - v) * Q[1][0] + u * v * Q[2][0] + (1 - u) * v * Q[3][0]
                py = (1 - u) * (1 - v) * Q[0][1] + u * (1 - v) * Q[1][1] + u * v * Q[2][1] + (1 - u) * v * Q[3][1]
                lab = labels[r * n + c]
                cell = {'rgb': median_rgb(small, px, py, cs * 0.2), 'truth': CUBE3['W' if lab == '*' else lab]}
                if lab == '*':
                    cell['logo'] = True
                if n % 2 == 1 and r == c == n // 2:
                    cell['center'] = True
                    cell['pixels'] = grid_pixels(small, px, py, cs * 0.38)
                cells.append(cell)
        out.append({'photo': f'{folder}/{name}', 'puzzle': 'cube3' if n == 3 else 'cube2', 'light': light, 'cells': cells})
    return out


def mega():
    out = []
    files = os.listdir(os.path.join(IMG, 'magaminx'))
    for prefix, (ox, oy), pts in MEGA:
        f = next(x for x in files if x.startswith(prefix))
        im = load(os.path.join(IMG, 'magaminx', f))
        x0, y0, s = 256.0, 0.18 * im.height, 0.78125
        k = 0.5  # reduz para um tamanho parecido com o da câmera
        small = im.resize((int(im.width * k), int(im.height * k)), Image.BILINEAR)
        cells = []
        for (X, Y), key, center in pts:
            px, py = (x0 + (X - ox) / s) * k, (y0 + (Y - oy) / s) * k
            cell = {'rgb': median_rgb(small, px, py, 6), 'truth': key}
            if center:
                cell['center'] = True
            cells.append(cell)
        out.append({'photo': f'magaminx/{f}', 'puzzle': 'megaminx', 'light': 'claro', 'cells': cells})
    return out


def pyra():
    out = []
    x0, y0, s = P
    for name, tri, colors in PYRA:
        im = load(os.path.join(IMG, 'pyraminx', name + '.jpeg'))
        T = [(x0 + X / s, y0 + Y / s) for X, Y in tri]
        side = T[2][0] - T[1][0]
        k = (0.8 * 360) / side  # na câmera o triângulo ocupa ~80% de 360 px
        small = im.resize((int(im.width * k), int(im.height * k)), Image.BILINEAR)
        T = [(x * k, y * k) for x, y in T]
        cells = []
        for (a, b, c), lab in zip(PYRA_BARY, colors):
            px = (a * T[0][0] + b * T[1][0] + c * T[2][0]) / 9
            py = (a * T[0][1] + b * T[1][1] + c * T[2][1]) / 9
            cells.append({'rgb': median_rgb(small, px, py, side * k * 0.03), 'truth': PYRA_KEYS[lab]})
        out.append({'photo': f'pyraminx/{name}', 'puzzle': 'pyraminx', 'light': 'claro', 'cells': cells})
    return out


if __name__ == '__main__':
    data = cube_faces('3x3', FACES3, 3) + cube_faces('2x2', FACES2, 2) + mega() + pyra()
    dst = os.path.join(ROOT, 'fixtures', 'camera-samples.json')
    with open(dst, 'w') as fh:
        json.dump(data, fh, separators=(',', ':'))
    print(dst, len(data), 'fotos', sum(len(d['cells']) for d in data), 'adesivos')
