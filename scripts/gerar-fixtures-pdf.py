#!/usr/bin/env python3
"""Gera os PDFs de teste do importador, sem dependência externa.

Eles precisam ser construídos e não baixados: um PDF de cliente não pode entrar
no repositório, e um PDF "de exemplo" da internet muda de conteúdo sem aviso.
Aqui cada arquivo existe para exercitar um caminho específico do leitor.

Uso: python3 scripts/gerar-fixtures-pdf.py
"""
import pathlib
import sys

DESTINO = pathlib.Path(__file__).resolve().parent.parent / "e2e" / "fixtures"


def montar(objetos: list[bytes], trailer_extra: str = "") -> bytes:
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
        f"trailer\n<< /Size {len(objetos)+1} /Root 1 0 R{trailer_extra} >>\n"
        f"startxref\n{xref}\n%%EOF\n"
    ).encode()
    return bytes(saida)


def fluxo(linhas: list[str], tamanho: int = 14, x: int = 72, y: int = 720) -> bytes:
    if not linhas:
        return b"BT ET"
    partes = ["BT", f"/F1 {tamanho} Tf", f"{x} {y} Td", f"{tamanho + 4} TL"]
    for i, linha in enumerate(linhas):
        partes.append(f"({linha}) Tj" if i == 0 else f"T* ({linha}) Tj")
    partes.append("ET")
    return "\n".join(partes).encode("latin-1")


def documento(paginas: list[list[str]], com_outline: bool = False,
              cabecalho_numerado: bool = False) -> bytes:
    """Um PDF simples. `paginas` é uma lista de listas de linhas."""
    total = len(paginas)
    objetos: list[bytes] = []
    # 1 catalogo, 2 pages, depois pares (page, contents), depois fonte
    primeiro_page_obj = 3
    fonte_obj = primeiro_page_obj + total * 2
    outline_obj = fonte_obj + 1

    catalogo = f"<< /Type /Catalog /Pages 2 0 R"
    if com_outline:
        catalogo += f" /Outlines {outline_obj} 0 R /PageMode /UseOutlines"
    catalogo += " >>"
    objetos.append(catalogo.encode())

    kids = " ".join(f"{primeiro_page_obj + i*2} 0 R" for i in range(total))
    objetos.append(f"<< /Type /Pages /Kids [{kids}] /Count {total} >>".encode())

    for i, linhas in enumerate(paginas):
        conteudo_linhas = list(linhas)
        if cabecalho_numerado:
            # Cabecalho identico e numero de pagina que muda: o par que a
            # deteccao de repetidos precisa reconhecer como moldura.
            conteudo = fluxo(["Brand Guidelines"], 8, 72, 780)
            conteudo += b"\n" + fluxo(conteudo_linhas, 14, 72, 700)
            conteudo += b"\n" + fluxo([str(i + 1)], 8, 520, 30)
        elif conteudo_linhas:
            # A primeira linha e um TITULO: maior que o corpo. Sem esse
            # contraste nao ha o que detectar, e um manual sem hierarquia
            # tipografica nao e um manual.
            conteudo = fluxo(conteudo_linhas[:1], 24, 72, 720)
            if conteudo_linhas[1:]:
                conteudo += b"\n" + fluxo(conteudo_linhas[1:], 12, 72, 660)
        else:
            conteudo = fluxo(conteudo_linhas)
        objetos.append(
            f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
            f"/Resources << /Font << /F1 {fonte_obj} 0 R >> >> "
            f"/Contents {primeiro_page_obj + i*2 + 1} 0 R >>".encode()
        )
        objetos.append(
            f"<< /Length {len(conteudo)} >>\nstream\n".encode() + conteudo + b"\nendstream"
        )

    objetos.append(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")

    if com_outline:
        primeiro = outline_obj + 1
        segundo = outline_obj + 2
        objetos.append(
            f"<< /Type /Outlines /First {primeiro} 0 R /Last {segundo} 0 R /Count 2 >>".encode()
        )
        objetos.append(
            f"<< /Title (Cor) /Parent {outline_obj} 0 R /Next {segundo} 0 R "
            f"/Dest [{primeiro_page_obj} 0 R /Fit] >>".encode()
        )
        pagina_dois = primeiro_page_obj + 2
        objetos.append(
            f"<< /Title (Tipografia) /Parent {outline_obj} 0 R /Prev {primeiro} 0 R "
            f"/Dest [{pagina_dois} 0 R /Fit] >>".encode()
        )

    return montar(objetos)


def acima_do_teto(bytes_alvo: int) -> bytes:
    """Um PDF valido de poucas paginas e tamanho ALVO, para o teto de fatia.

    Por que ele existe: o teto de fatia da rota de transporte recusava pedido de
    intervalo maior que ele, e o manual real que expos isso tem 4,07 MiB —
    apenas 70 KB acima do teto de 4 MiB. Esse manual e material de terceiro e
    nao pode entrar no repositorio; o que precisa ser reproduzido nao e o
    conteudo dele, e a PROPRIEDADE: um documento logo acima do teto.

    O tamanho vem de um objeto de preenchimento NAO REFERENCIADO. O leitor o
    ignora, a estrutura continua valida, e o padrao e repetido em vez de
    aleatorio para o arquivo ser identico a cada geracao.
    """
    conteudo = fluxo(["Acima do teto", "Uma pagina, muitos bytes."])
    objetos = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
        b"/Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
        f"<< /Length {len(conteudo)} >>\nstream\n".encode() + conteudo + b"\nendstream",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ]

    # Duas passagens: monta sem preenchimento para medir o custo fixo, depois
    # com a sobra exata. Chutar o tamanho deixaria a fixture perto do teto sem
    # garantia de estar ACIMA dele, que e a unica coisa que ela precisa provar.
    base = len(montar(objetos + [b"<< /Length 0 >>\nstream\n\nendstream"]))
    sobra = max(bytes_alvo - base, 1024)
    recheio = (b"%" + b"A" * 78 + b"\n") * (sobra // 80)
    objetos.append(
        f"<< /Length {len(recheio)} >>\nstream\n".encode() + recheio + b"\nendstream"
    )
    return montar(objetos)


def main() -> int:
    DESTINO.mkdir(parents=True, exist_ok=True)

    arquivos = {
        # Valido, com texto: o caminho feliz.
        "manual-de-teste.pdf": documento([
            ["Cores", "O vermelho institucional e a cor de superficie.",
             "Nunca em texto corrido."],
            ["Tipografia", "Uma familia, quatro pesos."],
            [],
        ]),
        # Sem texto extraivel: precisa virar aviso de OCR, nao erro generico.
        "sem-texto.pdf": documento([[], [], []]),
        # Cabecalho repetido + numeros 12 e 13: a colisao de chave que o
        # detector de repetidos precisa acertar.
        "cabecalho-repetido.pdf": documento(
            [[f"Conteudo da pagina {n}"] for n in range(1, 15)],
            cabecalho_numerado=True,
        ),
        # Indice declarado pelo autor: a fonte de secao mais confiavel.
        "com-outline.pdf": documento([
            ["Cor", "A paleta."],
            ["Tipografia", "A familia."],
        ], com_outline=True),
    }

    for nome, conteudo in arquivos.items():
        (DESTINO / nome).write_bytes(conteudo)
        print(f"{nome}: {len(conteudo)} bytes")

    # Corrompido: assinatura valida, estrutura destruida. Precisa de mensagem
    # propria — nao e "nao e um PDF".
    # Logo acima do teto de fatia de 4 MiB da rota de transporte. Fica fora do
    # git pelo tamanho; o gerador a reconstroi identica.
    TETO_DA_FATIA = 4 * 1024 * 1024
    acima = acima_do_teto(TETO_DA_FATIA + 128 * 1024)
    (DESTINO / "acima-do-teto.pdf").write_bytes(acima)
    print(f"acima-do-teto.pdf: {len(acima)} bytes ({len(acima) / 1048576:.2f} MiB)")
    assert len(acima) > TETO_DA_FATIA, "a fixture precisa ficar ACIMA do teto"

    valido = arquivos["manual-de-teste.pdf"]
    corrompido = bytearray(valido)
    inicio_xref = corrompido.rfind(b"xref")
    corrompido[inicio_xref:inicio_xref + 40] = b"xref\n0 99\nLIXO NO LUGAR DA TABELA\n"
    (DESTINO / "corrompido.pdf").write_bytes(bytes(corrompido))
    print(f"corrompido.pdf: {len(corrompido)} bytes")

    # Protegido: dicionario /Encrypt presente. O leitor precisa dizer "senha",
    # e nao "corrompido".
    protegido = documento([["Confidencial"]])
    protegido = protegido.replace(
        b"/Root 1 0 R",
        b"/Root 1 0 R /Encrypt << /Filter /Standard /V 1 /R 2 /O <"
        + b"41" * 32 + b"> /U <" + b"42" * 32 + b"> /P -1 >>",
    )
    (DESTINO / "protegido.pdf").write_bytes(protegido)
    print(f"protegido.pdf: {len(protegido)} bytes")

    # Mil paginas: o teto do produto, exercitado de ponta a ponta. Fica fora
    # do git — 1000 paginas de texto sao grandes demais para versionar, e o
    # gerador as reconstroi identicas quando preciso.
    mil = documento([[f"Secao {n}", f"Corpo da pagina {n}."] for n in range(1, 1001)])
    (DESTINO / "mil-paginas.pdf").write_bytes(mil)
    print(f"mil-paginas.pdf: {len(mil)} bytes")

    # Mil e uma: uma a mais que o teto. Precisa ser recusada com mensagem
    # propria, nao com erro generico.
    mil_e_uma = documento([[f"Secao {n}"] for n in range(1, 1002)])
    (DESTINO / "mil-e-uma-paginas.pdf").write_bytes(mil_e_uma)
    print(f"mil-e-uma-paginas.pdf: {len(mil_e_uma)} bytes")

    # Nao e PDF, apesar da extensao.
    (DESTINO / "nao-e-pdf.pdf").write_bytes(b"<!doctype html>\n<h1>isto e uma pagina</h1>\n")
    print("nao-e-pdf.pdf: escrito")
    return 0


if __name__ == "__main__":
    sys.exit(main())
