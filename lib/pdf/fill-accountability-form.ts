import { readFile } from "node:fs/promises"
import path from "node:path"

import fontkit from "@pdf-lib/fontkit"
import {
  PDFDocument,
  rgb,
  type PDFFont,
  type PDFImage,
  type PDFPage,
} from "pdf-lib"

const DEFAULT_HR_NAME = "CAMILLE TUIBEO"

export type EquipmentRow = {
  item: string
  brand: string
  model: string
  serialNumber: string
  unitCount: number
}

export type AccountabilityFormData = {
  employeeName: string
  itOfficerName: string
  hrName: string
  generatedOn: string
  equipment: EquipmentRow[]
}

const LOGO_PATH = path.join(process.cwd(), "public/ardent-logo.png")
const FONTS_DIR = path.join(process.cwd(), "lib/pdf/fonts")

const PAGE_WIDTH = 612
const PAGE_HEIGHT = 792
const MARGIN_X = 72
const MARGIN_TOP = 36
const MARGIN_BOTTOM = 42
const CONTENT_RIGHT = PAGE_WIDTH - MARGIN_X
const CONTENT_WIDTH = CONTENT_RIGHT - MARGIN_X

const INK = rgb(0.07, 0.07, 0.07)
const MUTED = rgb(0.2, 0.2, 0.2)
const WHITE = rgb(1, 1, 1)
const BORDER = rgb(0, 0, 0)
const HEADER_FILL = rgb(0.95, 0.95, 0.95)
const LINK = rgb(0.02, 0.39, 0.76)

const COL_RATIOS = [0, 0.164, 0.29, 0.486, 0.741, 0.839, 1]

const TABLE = {
  left: MARGIN_X,
  right: CONTENT_RIGHT,
  columns: COL_RATIOS.map((ratio) => MARGIN_X + CONTENT_WIDTH * ratio),
  titleHeight: 22,
  headerHeight: 28,
  rowHeight: 42,
}

const ADDRESS = [
  "26th Floor, The Podium West Tower",
  "Dona Julia Vargas Avenue, Mandaluyong City",
]

const TERMS: string[] = [
  "I understand that I am being issued a laptop computer as a tool to facilitate my work.",
  "I understand that I am responsible for the laptop computer issued to me and that I will care for the equipment in such a manner as to prevent loss or damage. I further understand that:",
  "The laptop is a work tool and should be brought to work each day.",
  "The laptop should be transported in its case and stored carefully so it is not susceptible to damage. I may not make any permanent personally identifying marks on the laptop computer, including adhesive labels/stickers.",
  "The laptop should never be left unattended after office hours, weekends, holidays, etc.",
  "The laptop should not be left unattended in any public area.",
  "Acceptable storage of laptops during office hours includes locked desks, cabinets or other secured spaces not visible when the laptop is not in the user's possession.",
  "The laptop should not be left inside a vehicle where temperature extremes can permanently damage the unit and its components or could be visible resulting in theft.",
  "In the case of any damages or abuse of the laptop, or because I failed to follow company technology acceptable use policies, including this agreement, I understand I will be held responsible for payment of repairs or replacement. The company reserves the right to withhold payment from my paycheck if I fail to make appropriate payments.",
  "In case of damage, loss, or theft of the laptop, I am responsible for obtaining an incident-specific police report immediately. I will also immediately notify my manager or his/her designated representative and the Technology Department for repair or replacement matters.",
  "The laptop computer and any other accessories/components will be returned to the proper company authority immediately upon termination of my employment, or at any other time as specifically directed by district authority.",
  "Any data corruption or configuration errors caused by the installation of unauthorized or illegal software may result in losing all data on the laptop and /or system due to the need for a complete reload. No such data which is pornographic or communal may be stored on the laptop. Unauthorized or illegal software may not be installed on the laptop. Failure to follow this may result in a penalty to the employee and immediate seizure of the laptop",
  "I agree to the above terms and conditions, and as such, I agree to fully cooperate with property loss reporting requirements and incident investigations.",
]

const RECEIVED_NOTE =
  "I have received the following item(s) for my Laptop Computer and am responsible for replacing any lost item when the laptop is returned."

type SlotKey = "laptop" | "charger" | "mouse" | "headset" | "bag"

const KIT_SLOTS: { key: SlotKey; label: string }[] = [
  { key: "laptop", label: "Laptop" },
  { key: "charger", label: "Laptop Charger" },
  { key: "mouse", label: "Mouse" },
  { key: "headset", label: "Headset" },
  { key: "bag", label: "Laptop bag" },
]

function slotKeyFor(item: string): SlotKey | "extra" {
  const value = item.toLowerCase()
  if (value === "laptop") return "laptop"
  if (value.includes("charger")) return "charger"
  if (value === "mouse") return "mouse"
  if (value === "headset" || value === "headphone") return "headset"
  if (value.includes("bag")) return "bag"
  return "extra"
}

function assignRows(equipment: EquipmentRow[]) {
  const bySlot = new Map<SlotKey, EquipmentRow>()
  const extras: EquipmentRow[] = []

  for (const row of equipment) {
    const key = slotKeyFor(row.item)
    if (key === "extra" || bySlot.has(key)) {
      extras.push(row)
      continue
    }
    bySlot.set(key, row)
  }

  return { bySlot, extras }
}

function winAnsi(text: string) {
  return text
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2022/g, "")
    .replace(/[^\u0000-\u007E]/g, (ch) => {
      const map: Record<string, string> = {
        "\u00A0": " ",
        "\u00D1": "N",
        "\u00F1": "n",
        "\u00E9": "e",
        "\u00E8": "e",
      }
      return map[ch] ?? ""
    })
}

function fitSize(font: PDFFont, text: string, maxWidth: number, size: number) {
  let next = size
  while (next > 6 && font.widthOfTextAtSize(text, next) > maxWidth) {
    next -= 0.4
  }
  return next
}

function wrapText(font: PDFFont, text: string, size: number, maxWidth: number) {
  const words = winAnsi(text).split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let current = ""
  for (const word of words) {
    const next = current ? `${current} ${word}` : word
    if (font.widthOfTextAtSize(next, size) <= maxWidth) {
      current = next
    } else {
      if (current) lines.push(current)
      current = word
    }
  }
  if (current) lines.push(current)
  return lines
}

function drawCenteredText(
  page: PDFPage,
  font: PDFFont,
  text: string,
  x: number,
  y: number,
  width: number,
  size: number,
  color = INK,
) {
  const value = winAnsi(text)
  const fontSize = fitSize(font, value, width, size)
  const textWidth = font.widthOfTextAtSize(value, fontSize)
  page.drawText(value, {
    x: x + Math.max(0, (width - textWidth) / 2),
    y,
    size: fontSize,
    font,
    color,
  })
}

function drawCellText(
  page: PDFPage,
  font: PDFFont,
  text: string,
  x: number,
  bottom: number,
  width: number,
  height: number,
  size = 10,
) {
  const value = winAnsi(text).trim()
  if (!value) return
  const maxWidth = Math.max(8, width - 8)
  const lines = wrapText(font, value, size, maxWidth).slice(0, 3)
  const leading = size + 2
  const block = lines.length * leading
  let y = bottom + (height - block) / 2 + (lines.length - 1) * leading + 1
  for (const line of lines) {
    const fontSize = fitSize(font, line, maxWidth, size)
    page.drawText(line, {
      x: x + 4,
      y,
      size: fontSize,
      font,
      color: INK,
    })
    y -= leading
  }
}

function drawGridRow(
  page: PDFPage,
  bottom: number,
  height: number,
  fill?: ReturnType<typeof rgb>,
) {
  page.drawRectangle({
    x: TABLE.left,
    y: bottom,
    width: CONTENT_WIDTH,
    height,
    color: fill ?? WHITE,
    borderColor: BORDER,
    borderWidth: 0.6,
  })
  for (const x of TABLE.columns.slice(1, -1)) {
    page.drawLine({
      start: { x, y: bottom },
      end: { x, y: bottom + height },
      thickness: 0.6,
      color: BORDER,
    })
  }
}

function kitRows(bySlot: Map<SlotKey, EquipmentRow>): EquipmentRow[] {
  const rows: EquipmentRow[] = []
  for (const { key } of KIT_SLOTS) {
    const row = bySlot.get(key)
    if (row) rows.push(row)
  }
  return rows
}

type Fonts = { regular: PDFFont; bold: PDFFont }

class FormLayout {
  private readonly doc: PDFDocument
  private readonly fonts: Fonts
  private readonly logo: PDFImage
  private readonly logoSize: { width: number; height: number }
  page: PDFPage
  y: number

  constructor(doc: PDFDocument, fonts: Fonts, logo: PDFImage) {
    this.doc = doc
    this.fonts = fonts
    this.logo = logo
    const maxWidth = 210
    const maxHeight = 86
    const scale = Math.min(maxWidth / logo.width, maxHeight / logo.height)
    this.logoSize = {
      width: logo.width * scale,
      height: logo.height * scale,
    }
    this.page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
    this.y = PAGE_HEIGHT
    this.drawLetterhead()
  }

  private drawLetterhead() {
    const top = PAGE_HEIGHT - MARGIN_TOP
    this.page.drawImage(this.logo, {
      x: MARGIN_X,
      y: top - this.logoSize.height,
      width: this.logoSize.width,
      height: this.logoSize.height,
    })

    const addressSize = 10
    let addressY = top - 13
    for (const line of ADDRESS) {
      const width = this.fonts.regular.widthOfTextAtSize(line, addressSize)
      this.page.drawText(line, {
        x: CONTENT_RIGHT - width,
        y: addressY,
        size: addressSize,
        font: this.fonts.regular,
        color: INK,
      })
      addressY -= 13
    }
    const site = "www.ardentparalegal.com"
    const siteWidth = this.fonts.regular.widthOfTextAtSize(site, addressSize)
    const siteX = CONTENT_RIGHT - siteWidth
    this.page.drawText(site, {
      x: siteX,
      y: addressY,
      size: addressSize,
      font: this.fonts.regular,
      color: LINK,
    })
    this.page.drawLine({
      start: { x: siteX, y: addressY - 1.2 },
      end: { x: CONTENT_RIGHT, y: addressY - 1.2 },
      thickness: 0.6,
      color: LINK,
    })

    this.y = top - this.logoSize.height - 18
  }

  addPage() {
    this.page = this.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
    this.y = PAGE_HEIGHT
    this.drawLetterhead()
  }

  ensureSpace(height: number) {
    if (this.y - height < MARGIN_BOTTOM) this.addPage()
  }

  drawTitle(text: string) {
    this.ensureSpace(24)
    drawCenteredText(
      this.page,
      this.fonts.bold,
      text,
      MARGIN_X,
      this.y,
      CONTENT_WIDTH,
      15,
    )
    this.y -= 24
  }

  drawAccountabilityTable(rows: EquipmentRow[]) {
    const needed =
      TABLE.titleHeight + TABLE.headerHeight + rows.length * TABLE.rowHeight
    this.ensureSpace(needed)

    this.y -= TABLE.titleHeight
    this.page.drawRectangle({
      x: TABLE.left,
      y: this.y,
      width: CONTENT_WIDTH,
      height: TABLE.titleHeight,
      color: HEADER_FILL,
      borderColor: BORDER,
      borderWidth: 0.6,
    })
    drawCenteredText(
      this.page,
      this.fonts.bold,
      "Description of Equipment of Property Issued to the Employee",
      TABLE.left,
      this.y + 7,
      CONTENT_WIDTH,
      11,
    )

    this.y -= TABLE.headerHeight
    drawGridRow(this.page, this.y, TABLE.headerHeight, HEADER_FILL)
    const headers = [
      { text: "Item", col: 0 },
      { text: "Brand", col: 1 },
      { text: "Model", col: 2 },
      { text: "Serial Number", col: 3 },
      { text: "Unit Count", col: 4, split: true },
      { text: "Price", col: 5 },
    ]
    for (const header of headers) {
      const x = TABLE.columns[header.col]
      const width = TABLE.columns[header.col + 1] - x
      if (header.split) {
        drawCenteredText(
          this.page,
          this.fonts.bold,
          "Unit",
          x,
          this.y + 15,
          width,
          10,
        )
        drawCenteredText(
          this.page,
          this.fonts.bold,
          "Count",
          x,
          this.y + 4,
          width,
          10,
        )
      } else {
        drawCenteredText(
          this.page,
          this.fonts.bold,
          header.text,
          x,
          this.y + 10,
          width,
          10,
        )
      }
    }

    for (const row of rows) {
      this.y -= TABLE.rowHeight
      drawGridRow(this.page, this.y, TABLE.rowHeight)
      const values = [
        row.item,
        row.brand,
        row.model,
        row.serialNumber,
        row.unitCount > 0 ? String(row.unitCount) : "",
        "",
      ]
      values.forEach((value, index) => {
        const x = TABLE.columns[index]
        const width = TABLE.columns[index + 1] - x
        if (index === 4) {
          drawCenteredText(
            this.page,
            this.fonts.regular,
            value,
            x,
            this.y + 17,
            width,
            10,
          )
        } else {
          drawCellText(
            this.page,
            this.fonts.regular,
            value,
            x,
            this.y,
            width,
            TABLE.rowHeight,
            10,
          )
        }
      })
    }

    this.y -= 18
  }

  drawTerms(items: string[]) {
    const size = 11
    const leading = 14
    const indent = 16
    const bulletX = MARGIN_X + 6
    const textX = MARGIN_X + indent
    const textWidth = CONTENT_WIDTH - indent

    this.ensureSpace(20)
    this.page.drawText("Terms and Conditions", {
      x: MARGIN_X,
      y: this.y,
      size: 13,
      font: this.fonts.bold,
      color: INK,
    })
    this.y -= 20

    for (const item of items) {
      const lines = wrapText(this.fonts.regular, item, size, textWidth)
      let first = true
      for (const line of lines) {
        this.ensureSpace(leading)
        if (first) {
          this.page.drawCircle({
            x: bulletX,
            y: this.y + 3,
            size: 2,
            color: INK,
          })
          first = false
        }
        this.page.drawText(line, {
          x: textX,
          y: this.y,
          size,
          font: this.fonts.regular,
          color: INK,
        })
        this.y -= leading
      }
      this.y -= 2
    }
  }

  drawParagraph(text: string, size = 11) {
    const leading = size + 2.5
    const lines = wrapText(this.fonts.regular, text, size, CONTENT_WIDTH)
    for (const line of lines) {
      this.ensureSpace(leading)
      this.page.drawText(line, {
        x: MARGIN_X,
        y: this.y,
        size,
        font: this.fonts.regular,
        color: INK,
      })
      this.y -= leading
    }
  }

  drawSignatureBlock(data: AccountabilityFormData) {
    if (this.doc.getPages()[0] === this.page) this.addPage()
    this.y -= 4
    this.drawParagraph(
      "My signature below indicates I have thoroughly read and understood the above information.",
      11,
    )
    this.y -= 18

    this.drawSignRow(
      data.employeeName,
      "Employee Printed Name and Signature",
      "",
    )
    this.y -= 28
    this.drawSignRow(data.itOfficerName, "IT Officer", data.generatedOn)
    this.y -= 28
    this.drawSignRow(
      data.hrName.trim() || DEFAULT_HR_NAME,
      "Human Resource",
      "",
    )
    this.y -= 22
    this.drawParagraph(RECEIVED_NOTE, 11)
    this.y -= 8
  }

  private drawSignRow(name: string, caption: string, dateValue: string) {
    this.ensureSpace(60)
    const nameLineX = MARGIN_X
    const nameLineWidth = CONTENT_WIDTH * 0.48
    const dateLineWidth = CONTENT_WIDTH * 0.32
    const dateLineX = CONTENT_RIGHT - dateLineWidth
    const lineY = this.y - 16

    const printed = name.trim().toUpperCase()
    if (printed) {
      drawCenteredText(
        this.page,
        this.fonts.bold,
        printed,
        nameLineX,
        lineY + 4,
        nameLineWidth,
        12,
      )
    }

    this.page.drawLine({
      start: { x: nameLineX, y: lineY },
      end: { x: nameLineX + nameLineWidth, y: lineY },
      thickness: 0.8,
      color: BORDER,
    })
    this.page.drawLine({
      start: { x: dateLineX, y: lineY },
      end: { x: dateLineX + dateLineWidth, y: lineY },
      thickness: 0.8,
      color: BORDER,
    })

    if (dateValue) {
      drawCenteredText(
        this.page,
        this.fonts.regular,
        dateValue,
        dateLineX,
        lineY + 4,
        dateLineWidth,
        11,
      )
    }

    drawCenteredText(
      this.page,
      this.fonts.regular,
      caption,
      nameLineX,
      lineY - 14,
      nameLineWidth,
      10,
      MUTED,
    )
    drawCenteredText(
      this.page,
      this.fonts.regular,
      "Date",
      dateLineX,
      lineY - 14,
      dateLineWidth,
      10,
      MUTED,
    )

    this.y = lineY - 20
  }
}

export async function fillAccountabilityForm(data: AccountabilityFormData) {
  const doc = await PDFDocument.create()
  doc.registerFontkit(fontkit)
  const fonts = {
    regular: await doc.embedFont(
      await readFile(path.join(FONTS_DIR, "LiberationSans-Regular.ttf")),
    ),
    bold: await doc.embedFont(
      await readFile(path.join(FONTS_DIR, "LiberationSans-Bold.ttf")),
    ),
  }
  const logo = await doc.embedPng(await readFile(LOGO_PATH))
  const { bySlot, extras } = assignRows(data.equipment)

  const layout = new FormLayout(doc, fonts, logo)
  layout.drawTitle("Acknowledgment of Receipt of Company Property")
  layout.drawAccountabilityTable([...kitRows(bySlot), ...extras])
  layout.drawTerms(TERMS)
  layout.drawSignatureBlock(data)

  return Buffer.from(await doc.save())
}
