#!/usr/bin/env python3
"""Gera a fixture de ESCALA da Fatia 1 — o manual grande que ainda não existe.

Por que existe
--------------
A Fatia 1 tem dois portões que a fixture visual (`gerar-fixture-visual.py`) não
consegue guardar: transporte e memória sob um arquivo GRANDE. Nove páginas
provam geometria; elas não estressam duração de função, contagem de requisições
de Range, nem o descarte de canvas num telefone.

E o manual real da GE foi excluído (§18.2.0, §18.3.3). Mesmo que não tivesse
sido, ele tem 11,3 MiB — quase uma ordem de grandeza abaixo do que o produto
promete aceitar. **Material de terceiro não volta para cá**: o sujeito de teste
de escala é construído, e é construído sintético.

Os dois limites, ao mesmo tempo
-------------------------------
`src/lib/import/limites.ts` declara dois tetos, e eles são independentes:

    maxBytes   = 100 * 1024 * 1024   (104.857.600)
    maxPaginas = 1000

Uma fixture que só tenha 1.000 páginas leves não prova o teto de bytes; uma que
só tenha bytes não prova o de páginas. Esta tem **os dois na mesma carga**:
exatamente 1.000 páginas e um tamanho logo abaixo de 100 MiB. É o pior caso
aceitável do produto — o arquivo maior que ele ainda deve dizer "sim".

A variante `--variante acima` isola o teto de BYTES: mantém as 1.000 páginas
(dentro do limite de página) e passa dos 100 MiB. Assim uma recusa só pode ter
vindo do tamanho. O teto de páginas já tem a sua própria fixture — a
`mil-e-uma-paginas.pdf` de `gerar-fixtures-pdf.py` — e misturar os dois numa
única fixture tornaria impossível saber qual regra reprovou o arquivo.

Determinismo
------------
Semente fixa (`--semente`, padrão 20260905). Duas execuções com a mesma semente
produzem o MESMO `sha256`. Sem isso não há como afirmar que uma medição de
transporte comparou o mesmo arquivo que a anterior.

Os bytes de imagem são ruído do gerador semeado, e isso é deliberado: dado
comprimível encolheria no `FlateDecode` e o arquivo nunca chegaria ao tamanho
alvo. O ruído não é fotografia — é volume de bytes com estrutura de imagem
válida, que é o que o portão de escala precisa medir.

O que esta fixture NÃO prova
----------------------------
Duas classificações que precisam viajar junto com qualquer número medido sobre
ela, senão o número vira uma conclusão que ele não sustenta.

**1. É fixture de volume, Range e limites — não simulação visual de manual.**
As imagens são ruído sem compressão. Isso é o que torna o tamanho previsível, e
é exatamente o que a desqualifica para tempo de renderização, memória de imagem
comprimida e qualidade visual. Um JPEG de 500 KB e 500 KB de ruído cru ocupam o
mesmo espaço no fio e comportamentos completamente diferentes no decodificador:
o JPEG custa CPU para descomprimir e ocupa, já em memória, muito mais que os
bytes que trafegaram. Medir renderização aqui mediria o decodificador errado.

**2. Prova que ESTA estrutura de PDF funciona — não "qualquer PDF".**
O que este gerador emite é uma variante só: PDF 1.4, xref clássico em tabela,
objetos soltos, sem linearização, sem criptografia, numa única revisão. Ficam
sem cobertura, e precisam de uma matriz de compatibilidade própria mais adiante:

    linearização (web-optimized)      xref stream (PDF 1.5+)
    object streams                    atualizações incrementais
    criptografia                      versões antigas e novas

Nada disso é defeito desta fixture — é o limite do que ela pode afirmar. Um
visualizador aprovado só contra ela está aprovado contra um PDF, não contra os
PDFs que uma agência vai enviar.

O que NÃO se versiona
---------------------
O PDF. Nunca. Ele sai em diretório ignorado pelo Git (`.fixtures-grandes/`), e
este gerador o reconstrói idêntico quando preciso. Versionado: este arquivo,
seu teste e esta documentação.

Uso
---
    python3 scripts/gerar-fixture-escala.py                    # 1.000 págs, ~100 MiB
    python3 scripts/gerar-fixture-escala.py --variante acima   # passa dos 100 MiB
    python3 scripts/gerar-fixture-escala.py --escala pequena   # o que o CI roda
    python3 scripts/gerar-fixture-escala.py --forcar           # sobrescreve
"""
import argparse
import hashlib
import pathlib
import random
import sys
import zlib

RAIZ = pathlib.Path(__file__).resolve().parent.parent
PADRAO = RAIZ / ".fixtures-grandes"

SEMENTE_PADRAO = 20260905

MIB = 1024 * 1024
LIMITE_BYTES = 100 * MIB          # espelha LIMITES_DE_IMPORTACAO.maxBytes
LIMITE_PAGINAS = 1000             # espelha LIMITES_DE_IMPORTACAO.maxPaginas

RETRATO = (612, 792)
PAISAGEM = (792, 612)

# Largura fixa das imagens pesadas. Ela define a granularidade do ajuste fino:
# uma linha de pixels custa LARGURA_IMAGEM * 3 bytes, e é esse o passo com que
# o alvo é perseguido.
LARGURA_IMAGEM = 480
BYTES_POR_LINHA = LARGURA_IMAGEM * 3

# ─── Perfis ────────────────────────────────────────────────────────────────
#
# `plena` é a fixture de verdade. `pequena` existe para o CI: mesma estrutura,
# mesmos cinco tipos de página, mesmo caminho de código — em segundos e em
# megabytes. Gerar 100 MiB a cada execução do CI seria pagar minutos de
# pipeline para reprovar exatamente os mesmos defeitos.

PERFIS = {
    "plena": {
        "paginas": {
            "texto_retrato": 520,
            "texto_paisagem": 130,
            "imagem_retrato": 140,
            "imagem_paisagem": 60,
            "sem_texto": 150,
        },
        # Logo abaixo do teto: perto o bastante para ser o pior caso aceitável,
        # com folga suficiente para o arquivo não virar reprovação por acidente.
        "alvo_abaixo": 104_000_000,   # ~99,2 MiB
        "alvo_acima": 105_500_000,    # ~100,6 MiB
    },
    "pequena": {
        "paginas": {
            "texto_retrato": 20,
            "texto_paisagem": 6,
            "imagem_retrato": 6,
            "imagem_paisagem": 3,
            "sem_texto": 5,
        },
        "alvo_abaixo": 1_500_000,
        "alvo_acima": 1_800_000,
    },
}

CORPO = [
    "The identity program provides the tools needed to determine the",
    "correct name and identifier for an acquired affiliate. Before any",
    "affiliate adopts a name or graphic identifier, minimum ownership",
    "requirements must be met and all required approvals obtained.",
    "A written trademark license is granted as set forth in the",
    "documentation that accompanies this section of the manual.",
    "Colour reproduction depends on substrate. On uncoated stock the",
    "institutional red shifts warm, and the correction table applies.",
    "Clear space is measured in units of the logotype cap height and",
    "is never reduced, not even in constrained digital placements.",
    "Photography shows the product in real application, never staged",
    "against a seamless background, and never with competing brands.",
]

TITULOS = [
    "Basic Standards", "Colour", "Typography", "Logotype", "Clear Space",
    "Photography", "Layout Grid", "Signage", "Stationery", "Vehicles",
    "Exhibits", "Packaging", "Digital", "Motion", "Co-branding",
]


# ─── Montagem do arquivo ───────────────────────────────────────────────────

def montar(objetos: list[bytes]) -> bytes:
    """Monta o arquivo com a tabela de referências cruzadas correta.

    Mesma disciplina de `gerar-fixture-visual.py`: a lista inteira é montada
    antes de o xref ser calculado, porque o xref precisa do deslocamento REAL
    de cada objeto. Calcular durante a escrita erra por um byte assim que
    qualquer objeto muda de tamanho — e aqui os objetos mudam de tamanho a cada
    iteração do ajuste fino.
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


# ─── Os cinco tipos de página ──────────────────────────────────────────────

def pagina_texto(n: int, rng: random.Random, paisagem: bool) -> str:
    """Texto corrido. O caminho comum, e o que alimenta o extrator."""
    topo = 540 if paisagem else 730
    titulo = f"{TITULOS[n % len(TITULOS)]} {n}"
    quantas = rng.randint(6, len(CORPO))
    inicio = rng.randrange(0, len(CORPO) - 4)
    corpo = (CORPO * 2)[inicio:inicio + quantas]
    return (
        texto([titulo], 22, 72, topo) + "\n"
        + texto(corpo, 11, 72, topo - 50) + "\n"
        + texto([str(n)], 8, 520 if not paisagem else 700, 30)
    )


def pagina_imagem(nome_xobject: str, n: int, paisagem: bool) -> str:
    """Imagem pesada com legenda. É onde o tamanho do arquivo mora."""
    larg, alt = (PAISAGEM if paisagem else RETRATO)
    cx, cy = larg - 144, (alt - 220) if not paisagem else (alt - 180)
    return (
        texto([f"Plate {n}"], 16, 72, alt - 62) + "\n"
        + f"q {cx} 0 0 {cy} 72 120 cm /{nome_xobject} Do Q\n"
        + texto(["Photography shows the product in real application."], 9, 72, 96)
    )


def pagina_sem_texto(n: int, rng: random.Random) -> str:
    """NENHUM operador de texto — só arte vetorial.

    É o caminho que `secoes.ts` descarta em silêncio, e o manual real da GE não
    tinha uma única página assim. Numa fixture de 1.000 páginas ele precisa
    aparecer em volume, não como curiosidade: 150 páginas mudas são o que
    obriga o manifesto a contá-las em vez de perdê-las.
    """
    partes = [f"0.{rng.randrange(1, 9)} 0.1 0.1 rg 0 0 612 792 re f", "1 1 1 rg"]
    for i in range(rng.randint(4, 8)):
        y = 140 + i * 84
        partes.append(f"{90 + (i % 3) * 20} {y} {300 + (i % 4) * 40} 44 re f")
    partes.append(f"0.1 0.1 0.1 rg {200 + (n % 5) * 10} 640 120 120 re f")
    return "\n".join(partes)


# ─── Índice hierárquico ────────────────────────────────────────────────────

class No:
    """Um nó do índice declarado pelo autor."""

    def __init__(self, titulo: str, pagina: int, filhos: list["No"] | None = None):
        self.titulo = titulo
        self.pagina = pagina
        self.filhos = filhos or []
        self.obj = 0

    def descendentes(self) -> int:
        return len(self.filhos) + sum(f.descendentes() for f in self.filhos)


def planejar_indice(total_paginas: int) -> list[No]:
    """Três níveis, distribuídos ao longo do documento inteiro.

    Três e não dois porque é a profundidade que distingue `outline_nodes` da
    árvore curada (mesma razão da fixture visual). Distribuído ao longo de todo
    o documento — e não só no começo — porque um índice que só aponta para as
    primeiras páginas não exercita a navegação de um manual longo.
    """
    capitulos: list[No] = []
    passo = max(1, total_paginas // 10)
    for c in range(10):
        base = c * passo
        secoes: list[No] = []
        for s in range(3):
            pagina = min(total_paginas - 1, base + s * max(1, passo // 4))
            subs: list[No] = []
            if s == 0:
                for t in range(2):
                    subs.append(No(
                        f"{TITULOS[c % len(TITULOS)]} detail {t + 1}",
                        min(total_paginas - 1, pagina + t + 1),
                    ))
            secoes.append(No(f"{TITULOS[(c + s) % len(TITULOS)]} {c}.{s}", pagina, subs))
        capitulos.append(No(f"{TITULOS[c % len(TITULOS)]}", base, secoes))
    return capitulos


def numerar_indice(nos: list[No], proximo: int) -> int:
    for no in nos:
        no.obj = proximo
        proximo += 1
        proximo = numerar_indice(no.filhos, proximo)
    return proximo


def emitir_indice(nos: list[No], pai: int, obj_pagina) -> list[tuple[int, bytes]]:
    """Serializa a árvore com /Parent, /Prev, /Next, /First, /Last e /Count."""
    saida: list[tuple[int, bytes]] = []
    for i, no in enumerate(nos):
        partes = [f"/Title ({no.titulo})", f"/Parent {pai} 0 R"]
        if i > 0:
            partes.append(f"/Prev {nos[i - 1].obj} 0 R")
        if i + 1 < len(nos):
            partes.append(f"/Next {nos[i + 1].obj} 0 R")
        if no.filhos:
            partes.append(f"/First {no.filhos[0].obj} 0 R")
            partes.append(f"/Last {no.filhos[-1].obj} 0 R")
            partes.append(f"/Count {no.descendentes()}")
        partes.append(f"/Dest [{obj_pagina(no.pagina)} 0 R /Fit]")
        saida.append((no.obj, ("<< " + " ".join(partes) + " >>").encode()))
        saida.extend(emitir_indice(no.filhos, no.obj, obj_pagina))
    return saida


# ─── Construção ────────────────────────────────────────────────────────────

def plano_de_paginas(perfil: dict, semente: int) -> list[str]:
    """A ordem das páginas, embaralhada de forma determinística.

    Contagens exatas primeiro, embaralhamento semeado depois: o resultado é
    reprodutível byte a byte, e ainda assim não tem o padrão regular que um
    laço `i % 5` produziria — e que faria a fixture testar um ritmo em vez de
    uma mistura.
    """
    tipos: list[str] = []
    for tipo, quantas in perfil["paginas"].items():
        tipos.extend([tipo] * quantas)
    random.Random(semente).shuffle(tipos)
    return tipos


def construir(tipos: list[str], semente: int, altura_img: int,
              linhas_extra_lastro: int) -> bytes:
    """Monta o PDF inteiro. Chamada várias vezes durante o ajuste fino.

    `rng` é recriado aqui, e não recebido pronto: o ajuste fino reconstrói o
    arquivo, e um gerador já consumido produziria texto diferente a cada
    iteração — o arquivo nunca convergiria, e o determinismo prometido no
    cabeçalho seria falso.
    """
    rng = random.Random(semente)
    total = len(tipos)
    indices_imagem = [i for i, t in enumerate(tipos) if t.startswith("imagem")]

    obj_catalogo, obj_pages = 1, 2
    primeiro_page = 3
    obj_fonte = primeiro_page + total * 2
    primeiro_img = obj_fonte + 1
    obj_outlines = primeiro_img + len(indices_imagem)

    capitulos = planejar_indice(total)
    numerar_indice(capitulos, obj_outlines + 1)

    def obj_pagina(indice: int) -> int:
        return primeiro_page + indice * 2

    objetos: list[bytes] = []
    objetos.append(
        f"<< /Type /Catalog /Pages {obj_pages} 0 R /Outlines {obj_outlines} 0 R "
        f"/PageMode /UseOutlines >>".encode()
    )
    kids = " ".join(f"{obj_pagina(i)} 0 R" for i in range(total))
    objetos.append(f"<< /Type /Pages /Kids [{kids}] /Count {total} >>".encode())

    ordem_img = {indice: k for k, indice in enumerate(indices_imagem)}

    for i, tipo in enumerate(tipos):
        paisagem = tipo.endswith("paisagem")
        largura, altura = PAISAGEM if paisagem else RETRATO
        recursos = f"/Font << /F1 {obj_fonte} 0 R >>"

        if tipo.startswith("imagem"):
            k = ordem_img[i]
            nome = f"Im{k}"
            recursos += f" /XObject << /{nome} {primeiro_img + k} 0 R >>"
            conteudo = pagina_imagem(nome, i + 1, paisagem)
        elif tipo == "sem_texto":
            conteudo = pagina_sem_texto(i + 1, rng)
        else:
            conteudo = pagina_texto(i + 1, rng, paisagem)

        objetos.append(
            f"<< /Type /Page /Parent {obj_pages} 0 R /MediaBox [0 0 {largura} {altura}] "
            f"/Resources << {recursos} >> /Contents {obj_pagina(i) + 1} 0 R >>".encode()
        )
        comprimido = zlib.compress(conteudo.encode("latin-1"))
        objetos.append(
            f"<< /Length {len(comprimido)} /Filter /FlateDecode >>\nstream\n".encode()
            + comprimido + b"\nendstream"
        )

    objetos.append(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")

    # As imagens. Sem filtro: os bytes do fluxo SÃO os bytes do arquivo, e é
    # isso que torna o tamanho final previsível o bastante para ser perseguido.
    # A última carrega o lastro — as linhas a mais que fecham a diferença até
    # o alvo. Ela continua sendo uma imagem legítima, só que mais alta.
    for k in range(len(indices_imagem)):
        alt = altura_img + (linhas_extra_lastro if k == len(indices_imagem) - 1 else 0)
        px = rng.randbytes(LARGURA_IMAGEM * alt * 3)
        objetos.append(
            f"<< /Type /XObject /Subtype /Image /Width {LARGURA_IMAGEM} /Height {alt} "
            f"/ColorSpace /DeviceRGB /BitsPerComponent 8 "
            f"/Length {len(px)} >>\nstream\n".encode() + px + b"\nendstream"
        )

    objetos.append(
        f"<< /Type /Outlines /First {capitulos[0].obj} 0 R "
        f"/Last {capitulos[-1].obj} 0 R "
        f"/Count {len(capitulos) + sum(c.descendentes() for c in capitulos)} >>".encode()
    )
    nos = emitir_indice(capitulos, obj_outlines, obj_pagina)
    for _, corpo in sorted(nos):
        objetos.append(corpo)

    return montar(objetos)


def convergir(tipos: list[str], semente: int, alvo: int) -> tuple[bytes, int, int]:
    """Persegue o tamanho alvo por baixo, ajustando a altura das imagens.

    Duas etapas. A grossa mede o custo de TUDO que não é pixel — texto, objetos
    de página, índice, xref — usando imagens mínimas, e daí deduz a altura
    comum. A fina fecha o que sobrar somando linhas à última imagem, com passo
    de uma linha (LARGURA_IMAGEM * 3 bytes).

    Por baixo, e nunca por cima: a fixture `abaixo` existe para ser aceita, e
    ultrapassar o alvo por um byte a transformaria no seu próprio contraexemplo.
    """
    n_img = sum(1 for t in tipos if t.startswith("imagem"))
    if n_img == 0:
        raise SystemExit("plano de páginas sem página de imagem: nada carrega o tamanho")

    sonda = construir(tipos, semente, altura_img=1, linhas_extra_lastro=0)
    custo_fixo = len(sonda) - n_img * BYTES_POR_LINHA
    altura = max(1, (alvo - custo_fixo) // (n_img * BYTES_POR_LINHA))

    extra = 0
    dados = b""
    for _ in range(12):
        dados = construir(tipos, semente, altura, extra)
        folga = alvo - len(dados)
        if 0 <= folga < BYTES_POR_LINHA:
            return dados, altura, extra
        passo = folga // BYTES_POR_LINHA
        if passo == 0:
            passo = 1 if folga > 0 else -1
        extra += passo
        if altura + extra < 1:
            altura = max(1, altura - 1)
            extra = 0
    return dados, altura, extra


# ─── Relatório e escrita ───────────────────────────────────────────────────

def relatar(caminho: pathlib.Path, dados: bytes, tipos: list[str],
            altura: int, extra: int, alvo: int) -> None:
    sha = hashlib.sha256(dados).hexdigest()
    tamanho = len(dados)
    print(f"{caminho.name}")
    print(f"  bytes      : {tamanho:,} ({tamanho / MIB:.2f} MiB)")
    print(f"  alvo       : {alvo:,} — folga de {alvo - tamanho:,} bytes")
    print(f"  limite     : {LIMITE_BYTES:,} ({LIMITE_BYTES / MIB:.0f} MiB) — "
          f"{'ABAIXO' if tamanho < LIMITE_BYTES else 'ACIMA'}")
    print(f"  páginas    : {len(tipos)} (limite {LIMITE_PAGINAS}) — "
          f"{'dentro' if len(tipos) <= LIMITE_PAGINAS else 'ACIMA'}")
    print(f"  sha256     : {sha}")
    contagem = {t: tipos.count(t) for t in sorted(set(tipos))}
    print(f"  composição : " + ", ".join(f"{k}={v}" for k, v in contagem.items()))
    print(f"  imagem     : {LARGURA_IMAGEM}x{altura} px, lastro +{extra} linhas")
    print(f"  caminho    : {caminho}")


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    p.add_argument("--destino", type=pathlib.Path, default=PADRAO,
                   help="diretório de saída (ignorado pelo Git)")
    p.add_argument("--escala", choices=sorted(PERFIS), default="plena")
    p.add_argument("--variante", choices=("abaixo", "acima"), default="abaixo")
    p.add_argument("--semente", type=int, default=SEMENTE_PADRAO)
    p.add_argument("--forcar", action="store_true",
                   help="sobrescreve um arquivo já existente")
    args = p.parse_args()

    perfil = PERFIS[args.escala]
    alvo = perfil["alvo_abaixo"] if args.variante == "abaixo" else perfil["alvo_acima"]
    tipos = plano_de_paginas(perfil, args.semente)

    nome = f"escala-{args.escala}-{args.variante}.pdf"
    caminho = args.destino / nome

    # A guarda vem ANTES de gerar: descobrir que não se pode escrever depois de
    # construir 100 MiB seria desperdiçar o trabalho inteiro.
    if caminho.exists() and not args.forcar:
        print(f"erro: {caminho} já existe. Use --forcar para sobrescrever.",
              file=sys.stderr)
        return 1

    dados, altura, extra = convergir(tipos, args.semente, alvo)

    # A conferência contra o teto do produto só vale para a escala plena: é ela
    # que existe para ficar dos dois lados da linha. A `pequena` é o mesmo
    # caminho de código em miniatura, e cobrar dela 100 MiB seria exigir
    # justamente o que ela existe para NÃO gerar.
    if args.escala == "plena":
        if args.variante == "abaixo" and len(dados) >= LIMITE_BYTES:
            print(f"erro: variante 'abaixo' saiu com {len(dados):,} bytes, "
                  f"no limite ou acima dele ({LIMITE_BYTES:,}).", file=sys.stderr)
            return 1
        if args.variante == "acima" and len(dados) <= LIMITE_BYTES:
            print(f"erro: variante 'acima' saiu com {len(dados):,} bytes, "
                  f"no limite ou abaixo dele ({LIMITE_BYTES:,}).", file=sys.stderr)
            return 1

    args.destino.mkdir(parents=True, exist_ok=True)
    caminho.write_bytes(dados)
    relatar(caminho, dados, tipos, altura, extra, alvo)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
