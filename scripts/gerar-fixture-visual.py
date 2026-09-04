#!/usr/bin/env python3
"""Gera a fixture sintética da Fatia 0 — os casos visuais que o manual real não cobre.

Por que existe, e por que sintética
-----------------------------------
Material de marca de terceiro não entra no repositório (decisão de licença), e
o CI precisa provar regressão sozinho. Então o sujeito de teste automatizado é
construído aqui, e o manual real serve só ao teste manual local.

A medição da Fatia 0 mostrou POR QUE ela é indispensável: no manual real da GE,
TODAS as 743 páginas têm texto extraível. O caminho de código que descarta
página sem texto — o defeito mais grave que o replanejamento aponta — nunca
dispara com ele. Sem esta fixture, esse defeito não tem teste possível.

Cada página abaixo existe para exercitar um caminho específico:

  1  retrato, texto corrido            extração de texto, o caminho comum
  2  paisagem                          orientação que muda no meio do manual
  3  fotografia (imagem rasterizada)   XObject de imagem, o sinal do classificador
  4  imagem achatada (página inteira)  página que É uma imagem, sem texto por cima
  5  vetor                             traço e preenchimento, sem imagem
  6  diagrama com cotas                vetor + rótulos curtos, o caso da pág. 372 da GE
  7  SEM TEXTO EXTRAÍVEL               só arte; o caso que a GE não tem
  8  tipografia convertida em curvas   desenho de letra, sem operador de texto
  9  abertura de seção em cor sólida   pouco texto sobre fundo cheio

O índice declarado tem TRÊS níveis, de propósito: é o que expõe a diferença
entre `outline_nodes` (árvore preservada) e `navigation_nodes` (árvore curada).

Uso: python3 scripts/gerar-fixture-visual.py [destino]

O destino é opcional e existe para o teste: gerar num diretório temporário
permite comparar bytes com o arquivo versionado (correspondência) e comparar
duas gerações entre si (determinismo) sem sobrescrever a fixture do repositório.
"""
import pathlib
import sys
import zlib

PADRAO = pathlib.Path(__file__).resolve().parent.parent / "e2e" / "fixtures"
NOME = "manual-visual.pdf"

RETRATO = (612, 792)
PAISAGEM = (792, 612)


def montar(objetos: list[bytes]) -> bytes:
    """Monta o arquivo com a tabela de referências cruzadas correta.

    O xref precisa do deslocamento REAL de cada objeto em bytes. Montar a lista
    inteira antes de calcular é o que garante isso — calcular durante a escrita
    erra por um byte assim que qualquer objeto muda de tamanho.
    """
    saida = bytearray(b"%PDF-1.4\n")
    posicoes = []
    for n, corpo in enumerate(objetos, start=1):
        posicoes.append(len(saida))
        saida += f"{n} 0 obj\n".encode() + corpo + b"\nendobj\n"
    xref = len(saida)
    saida += f"xref\n0 {len(objetos)+1}\n0000000000 65535 f \n".encode()
    for pos in posicoes:
        saida += f"{pos:010d} 00000 n \n".encode()
    saida += (
        f"trailer\n<< /Size {len(objetos)+1} /Root 1 0 R >>\n"
        f"startxref\n{xref}\n%%EOF\n"
    ).encode()
    return bytes(saida)


def texto(linhas: list[str], tamanho: int = 12, x: int = 72, y: int = 720) -> str:
    if not linhas:
        return ""
    partes = ["BT", f"/F1 {tamanho} Tf", f"{x} {y} Td", f"{tamanho + 4} TL"]
    for i, linha in enumerate(linhas):
        partes.append(f"({linha}) Tj" if i == 0 else f"T* ({linha}) Tj")
    partes.append("ET")
    return "\n".join(partes)


def imagem_rgb(largura: int, altura: int, achatada: bool = False) -> bytes:
    """Bytes RGB crus. Sem compressão: o PDF aceita fluxo direto, e assim a
    fixture não depende de nada além da biblioteca padrão."""
    px = bytearray()
    for y in range(altura):
        for x in range(largura):
            if achatada:
                # Simula página escaneada/achatada: gradiente com "sujeira".
                v = (x * 3 + y * 5) % 256
                px += bytes((v, v, v))
            else:
                # Simula fotografia: canais independentes, muita variação.
                px += bytes(((x * 7) % 256, (y * 11) % 256, ((x + y) * 5) % 256))
    return bytes(px)


def pagina_texto() -> str:
    corpo = [
        "Naming Process Overview",
        "",
        "To help determine the best name and identifier for an acquired",
        "affiliate, the identity program provides these tools. Before",
        "permitting an acquired affiliate to adopt any name or graphic",
        "identifier, you must ensure that minimum ownership requirements",
        "are met, that all required approvals are obtained, and that a",
        "written trademark license is granted as set forth in the",
        "documentation. Thus, before proceeding, obtain the document from",
        "the identity website or hotline and familiarize yourself with it.",
    ]
    return texto(corpo[:1], 22, 72, 730) + "\n" + texto(corpo[2:], 11, 72, 680)


def pagina_paisagem() -> str:
    return (
        texto(["Exhibit Layout - Landscape"], 20, 72, 540) + "\n"
        + texto(["A page whose orientation differs from its neighbours."], 11, 72, 500) + "\n"
        + "0.85 0.85 0.85 rg 72 120 648 340 re f\n"
        + "0.8 0.1 0.1 RG 3 w 72 120 648 340 re S\n"
    )


def pagina_vetor() -> str:
    partes = ["0.1 0.1 0.1 RG 2 w"]
    for i in range(12):
        x = 90 + i * 40
        partes.append(f"{x} 300 m {x} 560 l S")
    partes.append("0.8 0.1 0.1 rg 90 200 430 60 re f")
    partes.append(texto(["Grid System"], 20, 72, 620))
    return "\n".join(partes)


def pagina_diagrama() -> str:
    """Vetor + rótulos curtos e cotas. O caso da página 372 da GE: pouquíssimo
    texto, mas 463 caracteres — acima do limiar de 300 do classificador atual."""
    partes = ["0.2 0.2 0.2 RG 1.5 w"]
    partes.append("150 250 m 150 600 l 400 640 l 400 290 l h S")
    partes.append("150 420 m 400 460 l S")
    partes.append("0.5 0.5 0.5 RG 0.8 w [3 3] 0 d")
    partes.append("420 640 m 480 640 l S")
    partes.append("420 290 m 480 290 l S")
    partes.append("450 640 m 450 290 l S")
    partes.append("[] 0 d")
    partes.append(texto(["Wall Lights"], 16, 72, 700))
    partes.append(texto(['42"'], 9, 455, 470))
    partes.append(texto(['18"'], 9, 250, 445))
    partes.append(texto([
        "Wall lights, the light fixtures that attach to a wall panel,",
        "contain low-voltage lamps to light a product or graphics on",
        "walls. They are available in lengths from 18 inches to 42 inches.",
        "Note: the longer length is used to illuminate a large product",
        "or one placed away from a wall.",
    ], 9, 150, 220))
    return "\n".join(partes)


def pagina_sem_texto() -> str:
    """NENHUM operador de texto. É o caso que o manual real da GE não tem e que
    o produto hoje descarta em silêncio (secoes.ts:271,289)."""
    partes = ["0.8 0.1 0.1 rg 0 0 612 792 re f", "1 1 1 rg"]
    for i in range(6):
        y = 180 + i * 90
        partes.append(f"120 {y} 372 40 re f")
    partes.append("0.1 0.1 0.1 rg 246 620 120 120 re f")
    return "\n".join(partes)


def pagina_curvas() -> str:
    """Letra desenhada como caminho preenchido — 'tipografia convertida em
    curvas'. Nenhum operador de texto, nenhuma fonte embutida: para o extrator
    é arte, e é exatamente isso que ela é."""
    partes = ["0.1 0.1 0.1 rg"]
    # Um "G" grande, aproximado por bezier — o suficiente para haver curva real.
    partes.append(
        "300 600 m "
        "200 600 150 520 150 440 c "
        "150 360 200 280 300 280 c "
        "380 280 430 330 440 400 c "
        "340 400 l 340 350 l 390 350 l "
        "380 320 340 310 300 310 c "
        "230 310 190 370 190 440 c "
        "190 510 230 570 300 570 c "
        "f"
    )
    partes.append("0.8 0.1 0.1 rg 150 200 290 12 re f")
    return "\n".join(partes)


def pagina_abertura() -> str:
    """Abertura de seção em cor sólida com pouco texto — o caso da página 730
    da GE (94 caracteres, e visualmente é a página inteira)."""
    return (
        "0.1 0.1 0.1 rg 0 0 612 792 re f\n"
        "0.8 0.1 0.1 rg 0 640 612 6 re f\n"
        "1 1 1 rg\n"
        + texto(["Basic Standards"], 34, 72, 540) + "\n"
        + texto(["Section 01"], 12, 72, 500)
    )


def pagina_foto(nome_xobject: str) -> str:
    return (
        texto(["Promotional Brochures"], 16, 72, 730) + "\n"
        + f"q 400 0 0 300 106 380 cm /{nome_xobject} Do Q\n"
        + texto(["Photography shows the product in real application."], 10, 106, 340)
    )


def pagina_achatada(nome_xobject: str) -> str:
    """Página que É uma imagem: sem texto nenhum por cima."""
    return f"q 612 0 0 792 0 0 cm /{nome_xobject} Do Q"


def main() -> int:
    destino = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else PADRAO
    destino.mkdir(parents=True, exist_ok=True)

    paginas = [
        (RETRATO, pagina_texto(), None),
        (PAISAGEM, pagina_paisagem(), None),
        (RETRATO, pagina_foto("ImFoto"), "ImFoto"),
        (RETRATO, pagina_achatada("ImFlat"), "ImFlat"),
        (RETRATO, pagina_vetor(), None),
        (RETRATO, pagina_diagrama(), None),
        (RETRATO, pagina_sem_texto(), None),
        (RETRATO, pagina_curvas(), None),
        (RETRATO, pagina_abertura(), None),
    ]
    total = len(paginas)

    # Layout dos objetos, fixado antes de escrever para os /Ref baterem.
    obj_catalogo, obj_pages = 1, 2
    primeiro_page = 3                       # pares (page, contents)
    obj_fonte = primeiro_page + total * 2
    obj_foto = obj_fonte + 1
    obj_flat = obj_fonte + 2
    obj_outlines = obj_fonte + 3            # raiz + 6 nós em três níveis

    objetos: list[bytes] = []
    objetos.append(
        f"<< /Type /Catalog /Pages {obj_pages} 0 R /Outlines {obj_outlines} 0 R "
        f"/PageMode /UseOutlines >>".encode()
    )
    kids = " ".join(f"{primeiro_page + i*2} 0 R" for i in range(total))
    objetos.append(f"<< /Type /Pages /Kids [{kids}] /Count {total} >>".encode())

    for i, (medida, conteudo, xobj) in enumerate(paginas):
        largura, altura = medida
        recursos = f"/Font << /F1 {obj_fonte} 0 R >>"
        if xobj == "ImFoto":
            recursos += f" /XObject << /ImFoto {obj_foto} 0 R >>"
        elif xobj == "ImFlat":
            recursos += f" /XObject << /ImFlat {obj_flat} 0 R >>"
        objetos.append(
            f"<< /Type /Page /Parent {obj_pages} 0 R /MediaBox [0 0 {largura} {altura}] "
            f"/Resources << {recursos} >> /Contents {primeiro_page + i*2 + 1} 0 R >>".encode()
        )
        bruto = conteudo.encode("latin-1")
        comprimido = zlib.compress(bruto)
        objetos.append(
            f"<< /Length {len(comprimido)} /Filter /FlateDecode >>\nstream\n".encode()
            + comprimido + b"\nendstream"
        )

    objetos.append(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")

    for nome, (larg, alt, achatada) in {
        "foto": (48, 36, False),
        "flat": (60, 78, True),
    }.items():
        px = zlib.compress(imagem_rgb(larg, alt, achatada))
        objetos.append(
            f"<< /Type /XObject /Subtype /Image /Width {larg} /Height {alt} "
            f"/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode "
            f"/Length {len(px)} >>\nstream\n".encode() + px + b"\nendstream"
        )

    # Índice de TRÊS níveis. É ele que distingue outline_nodes de
    # navigation_nodes: a árvore declarada é fina; a navegação curada não
    # precisa ser.
    n1, n1a, n1b, n1b1, n2, n2a = (obj_outlines + i for i in range(1, 7))
    pg = lambda i: primeiro_page + i * 2
    objetos.append(f"<< /Type /Outlines /First {n1} 0 R /Last {n2} 0 R /Count 2 >>".encode())
    objetos.append(
        f"<< /Title (Basic Standards) /Parent {obj_outlines} 0 R /Next {n2} 0 R "
        f"/First {n1a} 0 R /Last {n1b} 0 R /Count 2 /Dest [{pg(0)} 0 R /Fit] >>".encode()
    )
    objetos.append(
        f"<< /Title (Layout) /Parent {n1} 0 R /Next {n1b} 0 R /Dest [{pg(1)} 0 R /Fit] >>".encode()
    )
    objetos.append(
        f"<< /Title (Photography) /Parent {n1} 0 R /Prev {n1a} 0 R "
        f"/First {n1b1} 0 R /Last {n1b1} 0 R /Count 1 /Dest [{pg(2)} 0 R /Fit] >>".encode()
    )
    objetos.append(
        f"<< /Title (Flattened artwork) /Parent {n1b} 0 R /Dest [{pg(3)} 0 R /Fit] >>".encode()
    )
    objetos.append(
        f"<< /Title (Exhibits) /Parent {obj_outlines} 0 R /Prev {n1} 0 R "
        f"/First {n2a} 0 R /Last {n2a} 0 R /Count 1 /Dest [{pg(4)} 0 R /Fit] >>".encode()
    )
    objetos.append(
        f"<< /Title (Wall lights) /Parent {n2} 0 R /Dest [{pg(5)} 0 R /Fit] >>".encode()
    )

    dados = montar(objetos)
    (destino / NOME).write_bytes(dados)
    print(f"{NOME}: {len(dados)} bytes, {total} páginas")
    print("  casos: retrato, paisagem, fotografia, imagem achatada, vetor,")
    print("         diagrama, SEM TEXTO, curvas, abertura em cor sólida")
    print("  índice: 3 níveis (Basic Standards > Photography > Flattened artwork)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
