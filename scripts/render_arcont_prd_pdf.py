#!/usr/bin/env python3

import argparse
import html
import re
import textwrap
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    BaseDocTemplate,
    CondPageBreak,
    Flowable,
    Frame,
    Image,
    ListFlowable,
    ListItem,
    LongTable,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    XPreformatted,
)
from reportlab.platypus.tableofcontents import TableOfContents


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SOURCE = ROOT / "docs" / "arcont-master-startup-prd.md"
LOGO = ROOT / "docs" / "assets" / "arcont-mark.png"

PAGE_W, PAGE_H = A4
LEFT = 18 * mm
RIGHT = 18 * mm
TOP = 20 * mm
BOTTOM = 18 * mm
CONTENT_W = PAGE_W - LEFT - RIGHT

NAVY = colors.HexColor("#052C5C")
DEEP_BLUE = colors.HexColor("#075391")
BLUE = colors.HexColor("#0A78B8")
CYAN = colors.HexColor("#34B6E4")
INK = colors.HexColor("#213248")
MUTED = colors.HexColor("#64748B")
PALE = colors.HexColor("#EAF5FB")
LIGHT = colors.HexColor("#F5F8FB")
BORDER = colors.HexColor("#D7E2EA")
WHITE = colors.white


def register_fonts():
    font_dir = Path("/System/Library/Fonts/Supplemental")
    variants = {
        "ArcontSans": "Arial.ttf",
        "ArcontSans-Bold": "Arial Bold.ttf",
        "ArcontSans-Italic": "Arial Italic.ttf",
        "ArcontSans-BoldItalic": "Arial Bold Italic.ttf",
    }
    for name, filename in variants.items():
        pdfmetrics.registerFont(TTFont(name, str(font_dir / filename)))
    pdfmetrics.registerFontFamily(
        "ArcontSans",
        normal="ArcontSans",
        bold="ArcontSans-Bold",
        italic="ArcontSans-Italic",
        boldItalic="ArcontSans-BoldItalic",
    )


register_fonts()


def styles():
    return {
        "cover_eyebrow": ParagraphStyle(
            "cover_eyebrow",
            fontName="ArcontSans-Bold",
            fontSize=9,
            leading=12,
            textColor=CYAN,
            alignment=TA_CENTER,
            spaceAfter=8,
        ),
        "cover_title": ParagraphStyle(
            "cover_title",
            fontName="ArcontSans-Bold",
            fontSize=30,
            leading=34,
            textColor=WHITE,
            alignment=TA_CENTER,
            spaceAfter=14,
        ),
        "cover_subtitle": ParagraphStyle(
            "cover_subtitle",
            fontName="ArcontSans",
            fontSize=13,
            leading=18,
            textColor=colors.HexColor("#D9EDF8"),
            alignment=TA_CENTER,
            spaceAfter=28,
        ),
        "cover_meta": ParagraphStyle(
            "cover_meta",
            fontName="ArcontSans",
            fontSize=9.5,
            leading=14,
            textColor=colors.HexColor("#D9EDF8"),
            alignment=TA_CENTER,
        ),
        "toc_title": ParagraphStyle(
            "toc_title",
            fontName="ArcontSans-Bold",
            fontSize=24,
            leading=28,
            textColor=NAVY,
            spaceAfter=18,
        ),
        "Heading1": ParagraphStyle(
            "Heading1",
            fontName="ArcontSans-Bold",
            fontSize=18,
            leading=22,
            textColor=NAVY,
            spaceBefore=4,
            spaceAfter=10,
            keepWithNext=True,
        ),
        "Heading2": ParagraphStyle(
            "Heading2",
            fontName="ArcontSans-Bold",
            fontSize=12.5,
            leading=16,
            textColor=DEEP_BLUE,
            spaceBefore=10,
            spaceAfter=6,
            keepWithNext=True,
        ),
        "Heading3": ParagraphStyle(
            "Heading3",
            fontName="ArcontSans-Bold",
            fontSize=10.5,
            leading=14,
            textColor=INK,
            spaceBefore=8,
            spaceAfter=4,
            keepWithNext=True,
        ),
        "body": ParagraphStyle(
            "body",
            fontName="ArcontSans",
            fontSize=9.2,
            leading=13.3,
            textColor=INK,
            spaceAfter=7,
            splitLongWords=True,
            allowWidows=0,
            allowOrphans=0,
        ),
        "bullet": ParagraphStyle(
            "bullet",
            fontName="ArcontSans",
            fontSize=8.9,
            leading=12.7,
            textColor=INK,
            spaceAfter=2.2,
            splitLongWords=True,
        ),
        "quote": ParagraphStyle(
            "quote",
            fontName="ArcontSans-Italic",
            fontSize=10.5,
            leading=15,
            textColor=DEEP_BLUE,
            leftIndent=12,
            rightIndent=8,
            borderColor=CYAN,
            borderWidth=2,
            borderPadding=8,
            backColor=PALE,
            spaceBefore=4,
            spaceAfter=9,
        ),
        "code": ParagraphStyle(
            "code",
            fontName="Courier",
            fontSize=7.25,
            leading=9.8,
            textColor=colors.HexColor("#18324A"),
            leftIndent=8,
            rightIndent=8,
            borderColor=BORDER,
            borderWidth=0.6,
            borderPadding=8,
            backColor=colors.HexColor("#F2F6F9"),
            spaceBefore=4,
            spaceAfter=9,
        ),
        "table_header": ParagraphStyle(
            "table_header",
            fontName="ArcontSans-Bold",
            fontSize=7.4,
            leading=9.4,
            textColor=WHITE,
            alignment=TA_LEFT,
        ),
        "table_cell": ParagraphStyle(
            "table_cell",
            fontName="ArcontSans",
            fontSize=7.3,
            leading=9.4,
            textColor=INK,
            splitLongWords=True,
        ),
    }


STYLES = styles()


def inline_markup(text):
    value = html.escape(text.strip())
    value = re.sub(
        r"\[([^\]]+)\]\((https?://[^)]+)\)",
        r'<link href="\2" color="#0A78B8"><u>\1</u></link>',
        value,
    )
    value = re.sub(r"`([^`]+)`", r'<font name="Courier" color="#075985">\1</font>', value)
    value = re.sub(r"\*\*([^*]+)\*\*", r"<b>\1</b>", value)
    value = re.sub(r"\*([^*]+)\*", r"<i>\1</i>", value)
    return value


def wrap_code(text, width=92):
    output = []
    for line in text.splitlines():
        if len(line) <= width:
            output.append(line)
            continue
        indent = len(line) - len(line.lstrip())
        chunks = textwrap.wrap(
            line.strip(),
            width=max(20, width - indent),
            subsequent_indent=" " * indent,
            break_long_words=True,
            break_on_hyphens=False,
        )
        output.extend([" " * indent + chunks[0], *chunks[1:]])
    return "\n".join(output)


class Diagram(Flowable):
    def __init__(self, kind):
        super().__init__()
        self.kind = kind
        self.width = CONTENT_W
        self.height = 70 * mm if kind == "project" else 82 * mm

    def box(self, canvas, x, y, width, height, label, font_size=7, fill=PALE):
        canvas.setFillColor(fill)
        canvas.setStrokeColor(BLUE)
        canvas.setLineWidth(0.8)
        canvas.roundRect(x, y, width, height, 4, fill=1, stroke=1)
        paragraph = Paragraph(
            inline_markup(label),
            ParagraphStyle(
                "diagram_node",
                fontName="ArcontSans-Bold",
                fontSize=font_size,
                leading=font_size + 2,
                alignment=TA_CENTER,
                textColor=NAVY,
            ),
        )
        pw, ph = paragraph.wrap(width - 7, height - 5)
        paragraph.drawOn(canvas, x + (width - pw) / 2, y + (height - ph) / 2)

    def arrow(self, canvas, x1, y1, x2, y2):
        canvas.setStrokeColor(BLUE)
        canvas.setLineWidth(1.1)
        canvas.line(x1, y1, x2, y2)
        if abs(x2 - x1) >= abs(y2 - y1):
            direction = 1 if x2 > x1 else -1
            canvas.line(x2, y2, x2 - 5 * direction, y2 - 3)
            canvas.line(x2, y2, x2 - 5 * direction, y2 + 3)
        else:
            direction = 1 if y2 > y1 else -1
            canvas.line(x2, y2, x2 - 3, y2 - 5 * direction)
            canvas.line(x2, y2, x2 + 3, y2 - 5 * direction)

    def draw(self):
        canvas = self.canv
        canvas.saveState()
        canvas.setFillColor(LIGHT)
        canvas.roundRect(0, 0, self.width, self.height, 7, fill=1, stroke=0)
        if self.kind == "project":
            labels = [
                "Crear tenant y proyecto",
                "Importar estructura y línea base",
                "Asignar responsables y actividades",
                "Capturar avance y evidencia",
                "Validar y consolidar",
                "Comparar planeado vs real",
                "Generar alerta y acción",
                "Cerrar ciclo con trazabilidad",
            ]
            gap = 7
            width = (self.width - 5 * gap) / 4
            height = 21 * mm
            top = self.height - height - 10
            bottom = 10
            positions = []
            for index in range(4):
                x = gap + index * (width + gap)
                positions.append((x, top))
                self.box(canvas, x, top, width, height, labels[index])
            for index in range(4):
                x = self.width - gap - width - index * (width + gap)
                positions.append((x, bottom))
                self.box(canvas, x, bottom, width, height, labels[index + 4])
            for index in range(3):
                x, y = positions[index]
                nx, ny = positions[index + 1]
                self.arrow(canvas, x + width, y + height / 2, nx, ny + height / 2)
            x, y = positions[3]
            nx, ny = positions[4]
            self.arrow(canvas, x + width / 2, y, nx + width / 2, ny + height)
            for index in range(4, 7):
                x, y = positions[index]
                nx, ny = positions[index + 1]
                self.arrow(canvas, x, y + height / 2, nx + width, ny + height / 2)
        else:
            height = 12.5 * mm
            top_width = 78 * mm
            mid_width = 58 * mm
            center = self.width / 2
            gap = 8
            y5 = 8
            y4 = y5 + height + gap
            y3 = y4 + height + gap
            y2 = y3 + height + gap
            y1 = y2 + height + gap
            self.box(canvas, center - top_width / 2, y1, top_width, height, "Control Plane: tenants, billing, módulos y marketplace", 6.8)
            self.box(canvas, center - top_width / 2, y2, top_width, height, "Experience Plane: Next.js web y Flutter mobile", 6.8)
            xs = [8, center - mid_width / 2, self.width - mid_width - 8]
            mids = [
                "Application Plane: kernel y módulos",
                "Extension Plane: SDK y custom apps",
                "Integration Plane: APIs, eventos y edge",
            ]
            for x, label in zip(xs, mids):
                self.box(canvas, x, y3, mid_width, height, label, 6.4)
            self.box(canvas, center - top_width / 2, y4, top_width, height, "Data Plane: relational, fiscal, object y telemetría", 6.8)
            self.box(canvas, center - top_width / 2, y5, top_width, height, "AI & Specialized Compute: BIM, visión, drones y ML", 6.8, colors.HexColor("#E7F8FB"))
            self.arrow(canvas, center, y1, center, y2 + height)
            for x in xs:
                self.arrow(canvas, center, y2, x + mid_width / 2, y3 + height)
                self.arrow(canvas, x + mid_width / 2, y3, center, y4 + height)
            self.arrow(canvas, center, y4, center, y5 + height)
        canvas.restoreState()


class PRDTemplate(BaseDocTemplate):
    def __init__(self, filename, version, date, **kwargs):
        super().__init__(filename, **kwargs)
        self.version = version
        self.date = date
        self.outline_seq = 0
        frame = Frame(LEFT, BOTTOM, CONTENT_W, PAGE_H - TOP - BOTTOM, id="main")
        self.addPageTemplates(PageTemplate(id="main", frames=frame, onPage=self.draw_page))

    def beforeDocument(self):
        self.outline_seq = 0

    def draw_page(self, canvas, doc):
        canvas.saveState()
        canvas.setTitle("ARCONT - Documento Maestro de Arranque y PRD")
        canvas.setAuthor("ARCONT")
        canvas.setSubject("PRD maestro, arquitectura modular y estrategia México")
        if doc.page == 1:
            canvas.setFillColor(NAVY)
            canvas.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
            canvas.setFillColor(DEEP_BLUE)
            canvas.circle(PAGE_W + 25 * mm, PAGE_H - 12 * mm, 82 * mm, fill=1, stroke=0)
            canvas.setFillColor(BLUE)
            canvas.circle(-15 * mm, 35 * mm, 65 * mm, fill=1, stroke=0)
            canvas.setFillColor(CYAN)
            canvas.setFillAlpha(0.22)
            canvas.circle(PAGE_W - 18 * mm, 25 * mm, 40 * mm, fill=1, stroke=0)
            canvas.setFillAlpha(1)
            canvas.setFillColor(WHITE)
            canvas.rect(0, 0, PAGE_W, 8 * mm, fill=1, stroke=0)
            canvas.restoreState()
            return
        canvas.setStrokeColor(BORDER)
        canvas.setLineWidth(0.5)
        canvas.line(LEFT, PAGE_H - 13 * mm, PAGE_W - RIGHT, PAGE_H - 13 * mm)
        if LOGO.exists():
            canvas.drawImage(str(LOGO), LEFT, PAGE_H - 11.2 * mm, width=12 * mm, height=8 * mm, preserveAspectRatio=True, mask="auto")
        canvas.setFont("ArcontSans-Bold", 7.6)
        canvas.setFillColor(NAVY)
        canvas.drawString(LEFT + 15 * mm, PAGE_H - 9.2 * mm, "ARCONT")
        canvas.setFont("ArcontSans", 7.2)
        canvas.setFillColor(MUTED)
        canvas.drawRightString(PAGE_W - RIGHT, PAGE_H - 9.2 * mm, "Documento Maestro de Arranque y PRD")
        canvas.line(LEFT, 11 * mm, PAGE_W - RIGHT, 11 * mm)
        canvas.setFont("ArcontSans", 7.1)
        canvas.drawString(LEFT, 7 * mm, f"Versión {self.version}  |  {self.date}")
        canvas.drawRightString(PAGE_W - RIGHT, 7 * mm, f"Página {doc.page}")
        canvas.restoreState()

    def afterFlowable(self, flowable):
        if not isinstance(flowable, Paragraph):
            return
        levels = {"Heading1": 0, "Heading2": 1, "Heading3": 2}
        if flowable.style.name not in levels:
            return
        level = levels[flowable.style.name]
        text = flowable.getPlainText()
        self.outline_seq += 1
        key = f"heading-{self.outline_seq}"
        self.canv.bookmarkPage(key)
        try:
            self.canv.addOutlineEntry(text, key, level=level, closed=level > 0)
        except ValueError:
            self.canv.addOutlineEntry(text, key, level=0, closed=False)
        if level == 0:
            self.notify("TOCEntry", (0, text, self.page, key))


def parse_table(lines, start):
    table_lines = []
    index = start
    while index < len(lines) and lines[index].strip().startswith("|"):
        table_lines.append(lines[index].strip())
        index += 1

    def cells(line):
        return [part.strip() for part in line.strip().strip("|").split("|")]

    rows = [cells(line) for line in table_lines]
    if len(rows) > 1 and all(re.fullmatch(r":?-{3,}:?", cell.replace(" ", "")) for cell in rows[1]):
        rows.pop(1)
    return rows, index


def make_table(rows):
    column_count = max(len(row) for row in rows)
    rows = [row + [""] * (column_count - len(row)) for row in rows]
    lengths = []
    for column in range(column_count):
        longest = max(len(re.sub(r"[`*]", "", row[column])) for row in rows)
        lengths.append(max(8, min(longest, 48)))
    total = sum(lengths)
    widths = [CONTENT_W * length / total for length in lengths]
    minimum = 20 * mm if column_count < 4 else 16 * mm
    widths = [max(width, minimum) for width in widths]
    scale = CONTENT_W / sum(widths)
    widths = [width * scale for width in widths]
    data = []
    for row_index, row in enumerate(rows):
        style = STYLES["table_header"] if row_index == 0 else STYLES["table_cell"]
        data.append([Paragraph(inline_markup(cell), style) for cell in row])
    table = LongTable(data, colWidths=widths, repeatRows=1, hAlign="LEFT", splitByRow=1)
    commands = [
        ("BACKGROUND", (0, 0), (-1, 0), NAVY),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("GRID", (0, 0), (-1, -1), 0.35, BORDER),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]
    for row_index in range(1, len(data)):
        commands.append(("BACKGROUND", (0, row_index), (-1, row_index), WHITE if row_index % 2 else LIGHT))
    table.setStyle(TableStyle(commands))
    return table


def make_list(items, ordered):
    flowables = []
    for item in items:
        item = re.sub(r"^\[ \]\s*", "[ ] ", item)
        flowables.append(ListItem(Paragraph(inline_markup(item), STYLES["bullet"]), leftIndent=12))
    kwargs = {
        "bulletType": "1" if ordered else "bullet",
        "leftIndent": 16,
        "bulletFontName": "ArcontSans-Bold",
        "bulletFontSize": 7.6,
        "bulletColor": BLUE,
        "spaceAfter": 7,
    }
    if ordered:
        kwargs["start"] = "1"
    return ListFlowable(flowables, **kwargs)


def parse_markdown(source):
    lines = source.splitlines()
    story = []
    index = 0
    while index < len(lines):
        line = lines[index].strip()
        if not line:
            index += 1
            continue
        if line.startswith("# "):
            index += 1
            continue
        if line.startswith("```"):
            language = line[3:].strip()
            index += 1
            code_lines = []
            while index < len(lines) and not lines[index].strip().startswith("```"):
                code_lines.append(lines[index])
                index += 1
            index += 1
            code = "\n".join(code_lines)
            if language == "mermaid" and "Crear tenant y proyecto" in code:
                story.extend([Spacer(1, 3), Diagram("project"), Spacer(1, 9)])
            elif language == "mermaid" and "Control Plane" in code:
                story.extend([Spacer(1, 3), Diagram("architecture"), Spacer(1, 9)])
            else:
                story.append(XPreformatted(html.escape(wrap_code(code)), STYLES["code"]))
            continue
        heading = re.match(r"^(#{2,4})\s+(.+)$", line)
        if heading:
            level = len(heading.group(1))
            text = heading.group(2)
            if level == 2 and re.match(r"^\d+\.", text):
                story.append(PageBreak() if text.startswith("1.") else CondPageBreak(55 * mm))
            style = STYLES[{2: "Heading1", 3: "Heading2", 4: "Heading3"}[level]]
            story.append(Paragraph(inline_markup(text), style))
            index += 1
            continue
        if line.startswith("|") and index + 1 < len(lines) and lines[index + 1].strip().startswith("|"):
            rows, index = parse_table(lines, index)
            story.extend([make_table(rows), Spacer(1, 9)])
            continue
        if line.startswith(">"):
            quote = []
            while index < len(lines) and lines[index].strip().startswith(">"):
                quote.append(lines[index].strip()[1:].strip())
                index += 1
            story.append(Paragraph(inline_markup(" ".join(quote)), STYLES["quote"]))
            continue
        if re.match(r"^-\s+", line):
            items = []
            while index < len(lines) and re.match(r"^-\s+", lines[index].strip()):
                items.append(re.sub(r"^-\s+", "", lines[index].strip()))
                index += 1
            story.append(make_list(items, False))
            continue
        if re.match(r"^\d+\.\s+", line):
            items = []
            while index < len(lines) and re.match(r"^\d+\.\s+", lines[index].strip()):
                items.append(re.sub(r"^\d+\.\s+", "", lines[index].strip()))
                index += 1
            story.append(make_list(items, True))
            continue
        paragraph_lines = [line]
        index += 1
        while index < len(lines):
            candidate = lines[index].strip()
            if not candidate or candidate.startswith(("##", "```", "|", ">", "- ")) or re.match(r"^\d+\.\s+", candidate):
                break
            paragraph_lines.append(candidate)
            index += 1
        story.append(Paragraph(inline_markup(" ".join(paragraph_lines)), STYLES["body"]))
    return story


def cover(version, date):
    logo = Image(str(LOGO), width=42 * mm, height=29 * mm, kind="proportional")
    card = Table([[logo]], colWidths=[58 * mm], rowHeights=[39 * mm], hAlign="CENTER")
    card.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), WHITE), ("ALIGN", (0, 0), (-1, -1), "CENTER"), ("VALIGN", (0, 0), (-1, -1), "MIDDLE")]))
    return [
        Spacer(1, 36 * mm),
        card,
        Spacer(1, 18 * mm),
        Paragraph("DOCUMENTO MAESTRO DE ARRANQUE", STYLES["cover_eyebrow"]),
        Paragraph("ARCONT", STYLES["cover_title"]),
        Paragraph("Product Requirements Document", STYLES["cover_subtitle"]),
        Spacer(1, 8 * mm),
        Paragraph("Plataforma componible de inteligencia para construcción", STYLES["cover_meta"]),
        Spacer(1, 8 * mm),
        Paragraph(f"Versión {version}&nbsp;&nbsp;|&nbsp;&nbsp;{date}", STYLES["cover_meta"]),
        Paragraph("México · Flutter · Finanzas · Fiscal · Plataforma modular", STYLES["cover_meta"]),
        Spacer(1, 27 * mm),
        Paragraph("Estrategia  ·  Producto  ·  Arquitectura  ·  Negocio  ·  Ejecución", STYLES["cover_meta"]),
        PageBreak(),
    ]


def metadata(source):
    version_match = re.search(r"^\| Versión \| ([^|]+) \|$", source, re.MULTILINE)
    date_match = re.search(r"^\| Fecha \| ([^|]+) \|$", source, re.MULTILINE)
    version = version_match.group(1).strip() if version_match else "draft"
    raw_date = date_match.group(1).strip() if date_match else ""
    if re.fullmatch(r"\d{4}-\d{2}-\d{2}", raw_date):
        year, month, day = raw_date.split("-")
        months = {"01": "enero", "02": "febrero", "03": "marzo", "04": "abril", "05": "mayo", "06": "junio", "07": "julio", "08": "agosto", "09": "septiembre", "10": "octubre", "11": "noviembre", "12": "diciembre"}
        date = f"{int(day)} {months[month]} {year}"
    else:
        date = raw_date
    return version, date


def build(source_path, output_path):
    source = source_path.read_text(encoding="utf-8")
    version, date = metadata(source)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    doc = PRDTemplate(
        str(output_path),
        version,
        date,
        pagesize=A4,
        leftMargin=LEFT,
        rightMargin=RIGHT,
        topMargin=TOP,
        bottomMargin=BOTTOM,
    )
    toc = TableOfContents()
    toc.levelStyles = [ParagraphStyle("toc_level", fontName="ArcontSans", fontSize=9.2, leading=13, textColor=INK, spaceBefore=2)]
    story = cover(version, date)
    story.extend(
        [
            Spacer(1, 7 * mm),
            Paragraph("Contenido", STYLES["toc_title"]),
            Paragraph("El índice y los marcadores permiten navegar por las decisiones principales del PRD.", STYLES["body"]),
            Spacer(1, 3 * mm),
            toc,
            PageBreak(),
        ]
    )
    story.extend(parse_markdown(source))
    doc.multiBuild(story)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    source = args.source.resolve()
    version, _ = metadata(source.read_text(encoding="utf-8"))
    output = args.output or ROOT / "output" / "pdf" / f"ARCONT_Documento_Maestro_Arranque_PRD_v{version}.pdf"
    build(source, output.resolve())
    print(output.resolve())


if __name__ == "__main__":
    main()
