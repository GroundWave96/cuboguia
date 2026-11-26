"""
Gera tests/fixtures/camera-samples.json a partir das fotos em tests/cube images/.

Cada foto tem a posição da face (4 cantos, ou pontos soltos no Megaminx) e a cor
certa de cada adesivo, marcadas à mão. A amostra imita o que a câmera do site faz:
reduz a imagem e tira a mediana de um quadrado no meio de cada adesivo.

Uso: python tools/extract-camera-samples.py [--check pasta]
     (--check desenha cada ponto marcado com a cor anotada, para conferir as marcações)
"""
import colorsys, json, os, sys
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


# ---------------------------------------------------------------------------
# Fotos de novembro/2026 (lote 2): coordenadas direto em pixels da foto (já em pé)
D = (0.0, 0.0, 1.0)

# 3x3: os 4 cantos da face e as cores linha a linha
FACES3_B = [
    ('IMG_6250', D, 'escuro', [(365, 653), (1080, 653), (1088, 1373), (360, 1373)], 'OGG YYO RBY'),
    # '-' = adesivo deixado de fora: estes dois ficam entre o vermelho e o laranja nesta foto
    ('IMG_6251', D, 'escuro', [(461, 715), (1093, 715), (1093, 1333), (461, 1333)], '-YG RR- RRY'),
    ('IMG_6252', D, 'escuro', [(480, 739), (1093, 715), (1093, 1320), (485, 1325)], 'WWW W*W WWW'),
    ('IMG_6253', D, 'escuro', [(552, 765), (1147, 760), (1147, 1347), (547, 1352)], 'YGO GOO BOO'),
    ('IMG_6254', D, 'escuro', [(435, 613), (1080, 613), (1088, 1245), (440, 1253)], 'YBB YBB RRB'),
    ('IMG_6255', D, 'escuro', [(360, 667), (973, 560), (1093, 1160), (480, 1293)], 'OYG OGG BBG'),
    # quase sem luz (só a luz do teclado): a mesma face da IMG_6250
    ('IMG_6256', D, 'muito-escuro', [(547, 741), (1080, 733), (1080, 1253), (547, 1259)], 'OGG YYO RBY'),
]
# 5x5: as 6 faces no escuro (6234–6239) e as mesmas 6 com luz (6240–6245, giradas)
FACES5 = [
    ('IMG_6234', D, 'escuro', [(541, 341), (1368, 341), (1368, 1168), (547, 1173)], 'GGGBG RROYR WOOYB OOGWG ORRWG'),
    ('IMG_6235', D, 'escuro', [(581, 333), (1453, 341), (1453, 1213), (573, 1205)], 'YWWOR YGGGG GWBOG YBYYO YGYYO'),
    ('IMG_6236', D, 'escuro', [(587, 405), (1413, 373), (1453, 1200), (621, 1235)], 'RYOOW BBWWR OBRRB BBYRR GWOOW'),
    ('IMG_6237', D, 'escuro', [(600, 395), (1440, 379), (1453, 1232), (608, 1240)], 'YGWWR YGRRB YGGOO OOBYW YYYOO'),
    ('IMG_6238', D, 'escuro', [(645, 261), (1472, 267), (1461, 1093), (632, 1088)], 'BGRBB RWWWB GYYRR RGRRO WGYWW'),
    ('IMG_6239', D, 'escuro', [(755, 413), (1541, 355), (1632, 1173), (808, 1227)], 'BWBWO BOBOR WGWWR BYBBY BGBYR'),
    ('IMG_6240', D, 'claro', [(147, 475), (1147, 453), (1173, 1453), (133, 1480)], 'ORRYR WOWBY BBWBB WOGYG BBWBB'),
    ('IMG_6241', D, 'claro', [(173, 645), (1093, 640), (1173, 1573), (147, 1600)], 'WOOWG RRYBB BRRBO RWWBB WOOYR'),
    ('IMG_6242', D, 'claro', [(187, 480), (1160, 520), (1187, 1480), (107, 1480)], 'WRGRB GGYWG YRYWR WRRWB WORBB'),
    ('IMG_6243', D, 'claro', [(200, 573), (1173, 653), (1232, 1613), (107, 1587)], 'GGGBG RROYR WOOYB OOGWG ORRWG'),
    ('IMG_6244', D, 'claro', [(173, 640), (1093, 613), (1147, 1573), (120, 1587)], 'YWWOR YGGGG GWBOG YBYYO YGYYO'),
    ('IMG_6245', D, 'claro', [(187, 539), (1187, 533), (1232, 1547), (120, 1560)], 'YGWWR YGRRB YGGOO OOBYW YYYOO'),
]
# Pyraminx: (vértice de cima, inf-esq, inf-dir) e as 9 cores na mesma ordem de PYRA
PYRA_B = [
    ('IMG_6246', 'claro', [(707, 461), (8, 1595), (1485, 1493)], 'YBRGYGYGB'),
    ('IMG_6247', 'claro', [(715, 333), (13, 1440), (1440, 1373)], 'RRGYRBGYB'),
    ('IMG_6248', 'claro', [(707, 459), (5, 1560), (1381, 1613)], 'GRYBGRYYB'),
    ('IMG_6249', 'claro', [(347, 619), (200, 1973), (1515, 1240)], 'RRBGGBBRY'),
    # faces inteiras de uma cor, com luz do dia
    ('IMG_6261', 'dia', [(680, 568), (400, 1293), (1173, 1107)], 'RRRRRRRRR'),
    ('IMG_6262', 'dia', [(688, 1373), (1120, 747), (373, 707)], 'GGGGGGGGG'),
]
# Megaminx: pontos soltos (pixels da foto) com a chave da cor; o 1º de cada foto é o centro.
# Chaves: U cinza, F verde-claro, R rosa, BR bege, BL azul-claro, L laranja, DR azul-escuro,
# DBR vermelho, B verde-escuro, DBL roxo, DL amarelo, D branco.
# '?G' = verde (claro ou escuro) e '?B' = azul (claro ou escuro): decididos pelo matiz,
# comparando com os centros dessas cores tirados na mesma sessão (veja resolve_pairs).
MEGA_B = [
    ('IMG_6263', [((779, 1025), 'D'), ((808, 848), 'R'), ((638, 972), '?G'), ((955, 966), '?G'), ((685, 1136), 'BR'), ((867, 1166), '?G'),
                  ((661, 825), '?B'), ((938, 836), '?G'), ((979, 1107), 'L'), ((761, 1272), '?G'), ((579, 1078), 'DBL')]),
    ('IMG_6264', [((859, 1080), 'U'), ((788, 956), 'L'), ((847, 874), 'DBR'), ((953, 939), 'L'), ((1059, 1033), 'U'), ((1024, 1139), 'U'),
                  ((1000, 1274), 'U'), ((859, 1256), 'BR'), ((735, 1274), 'DBL'), ((718, 1133), 'DL'), ((659, 1033), 'DL')]),
    ('IMG_6265', [((725, 1018), 'L'), ((690, 789), 'L'), ((796, 859), '?B'), ((925, 918), '?G'), ((890, 1048), '?B'), ((878, 1171), 'D'),
                  ((743, 1165), 'U'), ((619, 1200), 'L'), ((578, 1077), 'DL'), ((501, 953), 'DL'), ((625, 895), 'R')]),
    ('IMG_6266', [((775, 1089), 'DBR'), ((804, 842), '?B'), ((892, 948), 'U'), ((1039, 1012), 'BR'), ((957, 1136), '?G'), ((922, 1283), 'R'),
                  ((781, 1259), 'DBL'), ((628, 1277), 'D'), ((592, 1136), 'D'), ((563, 995), 'R'), ((698, 930), 'D')]),
    ('IMG_6267', [((753, 969), 'DL'), ((771, 734), '?B'), ((665, 810), '?B'), ((841, 852), '?B'), ((994, 899), '?B'), ((900, 1016), 'D'),
                  ((853, 1157), '?G'), ((688, 1134), '?B'), ((553, 1181), 'D'), ((565, 1028), 'DL'), ((535, 887), 'DBR')]),
    ('IMG_6268', [((776, 967), 'BR'), ((776, 743), 'L'), ((682, 837), 'R'), ((553, 873), 'L'), ((588, 990), 'DBR'), ((606, 1143), '?G'),
                  ((753, 1143), 'BR'), ((894, 1155), 'DBR'), ((929, 1020), 'DBR'), ((1000, 896), 'BR'), ((859, 837), 'DBR')]),
    ('IMG_6269', [((843, 1051), 'R'), ((819, 862), 'D'), ((755, 968), 'DBL'), ((637, 1027), '?B'), ((714, 1133), 'U'), ((761, 1251), 'U'),
                  ((878, 1210), '?B'), ((996, 1233), 'DBL'), ((996, 1110), '?B'), ((1043, 968), '?B'), ((914, 933), '?B')]),
    ('IMG_6270', [((841, 1100), 'DBL'), ((829, 853), 'U'), ((729, 959), 'D'), ((582, 1041), '?B'), ((659, 1170), 'BR'), ((688, 1300), 'DBL'),
                  ((841, 1288), 'DBL'), ((1006, 1312), 'DL'), ((1018, 1158), 'U'), ((1077, 1017), 'DBR'), ((923, 947), '?B')]),
    ('IMG_6271', [((723, 938), 'B'), ((735, 703), 'R'), ((606, 797), '?B'), ((453, 867), 'DBR'), ((547, 1009), 'BR'), ((559, 1162), 'BR'),
                  ((723, 1126), '?G'), ((888, 1150), '?B'), ((900, 985), 'D'), ((994, 844), 'U'), ((829, 785), 'R')]),
    ('IMG_6272', [((776, 1050), 'F'), ((787, 838), '?B'), ((682, 932), '?G'), ((540, 1014), '?G'), ((599, 1132), '?G'), ((611, 1273), 'R'),
                  ((752, 1262), 'L'), ((905, 1273), '?G'), ((940, 1120), 'DBL'), ((1023, 1014), 'DBL'), ((881, 944), 'L')]),
    ('IMG_6273', [((668, 1297), 'DR'), ((569, 1085), 'DBR'), ((781, 1071), 'DL'), ((979, 1170), 'D'), ((894, 1339), 'R'), ((866, 1551), '?G'),
                  ((640, 1565), '?G'), ((428, 1565), '?G'), ((400, 1339), 'DL'), ((371, 1142), 'DL')]),
    ('IMG_6274', [((635, 1025), 'BL'), ((660, 704), '?B'), ((784, 852), 'L'), ((932, 927), 'BR'), ((895, 1087), 'DBL'), ((858, 1309), 'BR'),
                  ((648, 1285), 'DBR'), ((425, 1309), 'R'), ((376, 1099), '?G'), ((326, 889), '?G'), ((524, 840), '?G')]),
]


# Mastermorphix (nov/2026): 10 regiões por face, marcadas no meio de cada uma (a face é
# arredondada, então as bordas "incham" e o meio de cada região é marcado à mão).
# Coordenadas na foto mostrada em 1500×2000 (× 1,44 = pixel da foto). Ordem das regiões:
# ponta de cima, pipa de cima, meio da aresta esquerda, meio da aresta direita, centro,
# pipa inf-esq, pipa inf-dir, ponta inf-esq, meio da aresta de baixo, ponta inf-dir.
# Cores: G verde, Y amarelo, R vermelho, B azul (mesmas chaves do Pyraminx).
MORPH = [
    ('IMG_6334', 'escuro', [(760, 640), (770, 840), (545, 880), (1000, 860), (790, 1030), (610, 1140), (960, 1110), (480, 1180), (790, 1250), (1120, 1150)], 'GRBGYRYGRG'),
    ('IMG_6335', 'escuro', [(700, 670), (720, 850), (470, 880), (950, 880), (720, 1040), (560, 1150), (880, 1150), (430, 1230), (710, 1265), (1020, 1230)], 'RRRBBYBRGR'),
    ('IMG_6336', 'escuro', [(710, 560), (710, 750), (500, 790), (950, 790), (720, 960), (550, 1080), (900, 1050), (430, 1150), (720, 1210), (1030, 1150)], 'YYGRGGBYYY'),
    ('IMG_6337', 'escuro', [(850, 620), (860, 800), (620, 820), (1090, 820), (850, 1000), (690, 1100), (1030, 1080), (560, 1150), (830, 1180), (1130, 1150)], 'BGYBRGBBYB'),
    ('IMG_6338', 'claro', [(700, 830), (720, 1040), (440, 1100), (1010, 1060), (740, 1300), (520, 1430), (1000, 1430), (330, 1560), (740, 1590), (1140, 1570)], 'YRYBRRGRBG'),
    ('IMG_6339', 'claro', [(680, 680), (680, 920), (380, 960), (950, 960), (660, 1170), (450, 1300), (870, 1300), (250, 1400), (660, 1470), (1030, 1450)], 'RBGYGBGBGG'),
    ('IMG_6340', 'claro', [(820, 760), (800, 960), (520, 1000), (1100, 1020), (780, 1210), (580, 1340), (1010, 1370), (420, 1470), (770, 1490), (1150, 1490)], 'BBGBBYGYYG'),
    ('IMG_6341', 'claro', [(840, 560), (850, 760), (540, 850), (1110, 880), (810, 1060), (590, 1180), (1020, 1200), (400, 1290), (780, 1340), (1170, 1320)], 'RYRRYYRYRB'),
]

# Kilominx (nov/2026): as 5 pipas da face de frente, marcadas no meio de cada uma (pixel da
# foto, já de pé). Chaves = as do Megaminx: U cinza, F verde-claro, R rosa, BR bege,
# BL azul-claro, L laranja, DR azul, DBR vermelho, B verde, DBL roxo, DL amarelo, D branco.
KILO = [
    ('IMG_6372', [((1177, 1206), 'BR'), ((869, 1433), 'D'), ((1436, 1449), 'R'), ((918, 1822), 'DL'), ((1291, 1822), 'DR')]),
    ('IMG_6373', [((967, 1287), 'DBL'), ((1210, 1562), 'DBR'), ((1080, 1886), 'U'), ((675, 1822), 'DL'), ((643, 1433), 'BR')]),
    ('IMG_6374', [((1129, 1271), 'B'), ((1436, 1465), 'BR'), ((1323, 1822), 'F'), ((950, 1838), 'L'), ((837, 1481), 'DR')]),
    ('IMG_6375', [((1112, 1530), 'B'), ((1436, 1822), 'D'), ((1307, 2178), 'L'), ((886, 2146), 'U'), ((756, 1773), 'DBL')]),
    ('IMG_6376', [((1075, 1440), 'BL'), ((1450, 1640), 'D'), ((1330, 2100), 'F'), ((870, 2140), 'R'), ((780, 1680), 'DBL')]),
    ('IMG_6377', [((886, 1400), 'F'), ((1210, 1417), 'B'), ((1323, 1822), 'U'), ((1048, 2048), 'DL'), ((789, 1789), 'L')]),
    ('IMG_6378', [((1015, 1384), 'DR'), ((1323, 1627), 'BR'), ((1145, 1984), 'BL'), ((740, 1951), 'DL'), ((659, 1562), 'BR')]),
    ('IMG_6379', [((1080, 1336), 'B'), ((1307, 1595), 'DBR'), ((1177, 1919), 'U'), ((788, 1886), 'BL'), ((740, 1498), 'D')]),
]


def find(folder, name):
    d = os.path.join(IMG, folder)
    return os.path.join(d, next(f for f in os.listdir(d) if f.split('.')[0] == name))


def load(path):
    return ImageOps.exif_transpose(Image.open(path)).convert('RGB')


def median_rgb(im, cx, cy, half):
    box = im.crop((int(cx - half), int(cy - half), int(cx + half) + 1, int(cy + half) + 1))
    px = list(box.get_flattened_data()) if hasattr(box, 'get_flattened_data') else list(box.getdata())
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


CHECK = []  # (foto, pontos [(x, y, rótulo)]) para as imagens de conferência


def cube_faces(folder, faces, n, batch=1):
    out = []
    for name, (x0, y0, s), light, quad, colors in faces:
        im = load(find(folder, name))
        Q = [(x0 + X / s, y0 + Y / s) for X, Y in quad]
        # reduz como a câmera do site (lado da face ≈ 0,66 × 360 px)
        side = ((Q[1][0] - Q[0][0]) + (Q[2][0] - Q[3][0])) / 2
        k = (0.66 * 360) / side
        small = im.resize((int(im.width * k), int(im.height * k)), Image.BILINEAR)
        Q = [(x * k, y * k) for x, y in Q]
        labels = colors.replace(' ', '')
        cs = 0.66 * 360 / n
        cells = []
        pts = []
        for r in range(n):
            for c in range(n):
                u, v = (c + 0.5) / n, (r + 0.5) / n
                px = (1 - u) * (1 - v) * Q[0][0] + u * (1 - v) * Q[1][0] + u * v * Q[2][0] + (1 - u) * v * Q[3][0]
                py = (1 - u) * (1 - v) * Q[0][1] + u * (1 - v) * Q[1][1] + u * v * Q[2][1] + (1 - u) * v * Q[3][1]
                lab = labels[r * n + c]
                pts.append((px / k, py / k, lab))
                if lab == '-':
                    continue
                cell = {'rgb': median_rgb(small, px, py, cs * 0.2), 'truth': CUBE3['W' if lab == '*' else lab]}
                if lab == '*':
                    cell['logo'] = True
                if n % 2 == 1 and r == c == n // 2:
                    cell['center'] = True
                    cell['pixels'] = grid_pixels(small, px, py, cs * 0.38)
                cells.append(cell)
        entry = {'photo': f'{folder}/{name}', 'puzzle': {2: 'cube2', 3: 'cube3', 5: 'cube5'}[n], 'light': light, 'cells': cells}
        if batch > 1:
            entry['batch'] = batch
        out.append(entry)
        CHECK.append((find(folder, name), pts))
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


def pyra_b():
    out = []
    for name, light, tri, colors in PYRA_B:
        path = find('pyraminx', name)
        im = load(path)
        side = max(abs(tri[a][0] - tri[b][0]) + abs(tri[a][1] - tri[b][1]) for a, b in ((0, 1), (1, 2), (0, 2))) * 0.8
        k = (0.8 * 360) / side
        small = im.resize((int(im.width * k), int(im.height * k)), Image.BILINEAR)
        cells, pts = [], []
        for (a, b, c), lab in zip(PYRA_BARY, colors):
            x = (a * tri[0][0] + b * tri[1][0] + c * tri[2][0]) / 9
            y = (a * tri[0][1] + b * tri[1][1] + c * tri[2][1]) / 9
            pts.append((x, y, lab))
            cells.append({'rgb': median_rgb(small, x * k, y * k, side * k * 0.03), 'truth': PYRA_KEYS[lab]})
        out.append({'photo': f'pyraminx/{name}', 'puzzle': 'pyraminx', 'light': light, 'batch': 2, 'cells': cells})
        CHECK.append((path, pts))
    return out


def morph():
    """Mastermorphix: pontos soltos no meio de cada região; o 5º de cada face é o triângulo do centro"""
    out = []
    for name, light, pts, colors in MORPH:
        path = find('mastermorphix', name)
        im = load(path)
        P = [(x * 1.44, y * 1.44) for x, y in pts]
        # reduz como a câmera: a face (~1060 px na foto mostrada) ocupa ~80% de 360 px
        k = (0.8 * 360) / (1060 * 1.44)
        small = im.resize((int(im.width * k), int(im.height * k)), Image.BILINEAR)
        cells, marks = [], []
        for i, ((x, y), lab) in enumerate(zip(P, colors)):
            cell = {'rgb': median_rgb(small, x * k, y * k, 7), 'truth': PYRA_KEYS[lab]}
            if i == 4:
                cell['center'] = True
            cells.append(cell)
            marks.append((x, y, lab))
        out.append({'photo': f'mastermorphix/{name}', 'puzzle': 'mastermorphix', 'light': light, 'batch': 2, 'cells': cells})
        CHECK.append((path, marks))
    return out


def kilo():
    """Kilominx: as 5 pipas da face de frente de cada foto"""
    out = []
    for name, pts in KILO:
        path = find('kibiminx', name)
        im = load(path)
        # reduz como a câmera: a face (~1050 px na foto) ocupa ~80% de 360 px
        k = (0.8 * 360) / 1050
        small = im.resize((int(im.width * k), int(im.height * k)), Image.BILINEAR)
        cells = [{'rgb': median_rgb(small, x * k, y * k, 6), 'truth': key} for (x, y), key in pts]
        out.append({'photo': f'kibiminx/{name}', 'puzzle': 'kilominx', 'light': 'claro', 'batch': 2, 'cells': cells})
        CHECK.append((path, [(x, y, key) for (x, y), key in pts]))
    return out


def hue(rgb):
    h, s, v = colorsys.rgb_to_hsv(*[c / 255 for c in rgb])
    return h * 360, s, v


def resolve_pairs(photos):
    """
    '?G' / '?B': verde-claro × verde-escuro e azul-claro × azul-escuro são as cores mais
    parecidas do Megaminx. A cor certa é a do centro (mesma sessão de fotos) mais parecida
    em matiz, saturação e brilho — e só fica decidida se a diferença for clara; senão o adesivo sai.
    """
    centers = {c['truth']: c['rgb'] for p in photos for c in p['cells'] if c.get('center')}
    pairs = {'?G': ('F', 'B'), '?B': ('BL', 'DR')}
    dropped = 0
    for p in photos:
        keep = []
        for c in p['cells']:
            if c['truth'] in pairs:
                a, b = pairs[c['truth']]
                ha, sa, va = hue(centers[a])
                hb, sb, vb = hue(centers[b])
                h, s_, v = hue(c['rgb'])
                # os verdes se separam pelo matiz (~79° × ~109°); os azuis, pela saturação (~0,5 × ~0,9)
                da = abs(h - ha) / 30 + abs(s_ - sa) * 2 + abs(v - va)
                db = abs(h - hb) / 30 + abs(s_ - sb) * 2 + abs(v - vb)
                if abs(da - db) < 0.35:
                    dropped += 1
                    continue
                c['truth'] = a if da < db else b
            keep.append(c)
        p['cells'] = keep
    print('megaminx: adesivos de cor duvidosa deixados de fora:', dropped)


def mega_b():
    out = []
    for name, pts in MEGA_B:
        path = find('magaminx', name)
        im = load(path)
        k = 0.5
        small = im.resize((int(im.width * k), int(im.height * k)), Image.BILINEAR)
        cells = []
        for i, ((x, y), key) in enumerate(pts):
            cell = {'rgb': median_rgb(small, x * k, y * k, 6), 'truth': key}
            if i == 0:
                cell['center'] = True
            cells.append(cell)
        out.append({'photo': f'magaminx/{name}', 'puzzle': 'megaminx', 'light': 'claro', 'batch': 2, 'cells': cells})
        CHECK.append((path, [(x, y, key) for (x, y), key in pts]))
    resolve_pairs(out)
    return out


def draw_checks(dst):
    from PIL import ImageDraw
    os.makedirs(dst, exist_ok=True)
    for path, pts in CHECK:
        im = load(path)
        k = 700 / max(im.size)
        sm = im.resize((int(im.width * k), int(im.height * k)))
        dr = ImageDraw.Draw(sm)
        for x, y, lab in pts:
            X, Y = x * k, y * k
            dr.ellipse((X - 4, Y - 4, X + 4, Y + 4), outline=(0, 0, 0), fill=(255, 255, 255))
            dr.rectangle((X + 5, Y - 7, X + 6 + 7 * len(lab), Y + 6), fill=(0, 0, 0))
            dr.text((X + 6, Y - 7), lab, fill=(255, 255, 0))
        sm.save(os.path.join(dst, os.path.basename(os.path.dirname(path)) + '_' + os.path.basename(path).split('.')[0] + '.png'))


if __name__ == '__main__':
    data = cube_faces('3x3', FACES3, 3) + cube_faces('2x2', FACES2, 2) + mega() + pyra()
    CHECK.clear()  # as imagens de conferência são só do lote novo
    data += cube_faces('3x3', FACES3_B, 3, batch=2) + cube_faces('5x5', FACES5, 5, batch=2) + pyra_b() + mega_b() + morph() + kilo()
    if '--check' in sys.argv:
        draw_checks(sys.argv[sys.argv.index('--check') + 1])
    dst = os.path.join(ROOT, 'fixtures', 'camera-samples.json')
    with open(dst, 'w') as fh:
        json.dump(data, fh, separators=(',', ':'))
    print(dst, len(data), 'fotos', sum(len(d['cells']) for d in data), 'adesivos')
