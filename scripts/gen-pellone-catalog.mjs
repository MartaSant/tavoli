/**
 * One-off generator for public/cataloghi/glovo-pellone-napoli.json
 * Run: node scripts/gen-pellone-catalog.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const pizzeRaw = [
  ['Provola e Pepe', 900, "Pomodoro, provola, formaggio, pepe nero olio d'oliva e basilico"],
  ['Bufalina', 1300, "Pomodoro, mozzarella di bufala, formaggio, olio d'oliva e basilico"],
  ['Wurstel e patatine', 1400, 'Wurstel, patatine fritte*, fior di latte e formaggio'],
  ['4 Stagioni capricciosa', 1500, "Pomodoro, fior di latte, prosciutto cotto, funghi, olive, acciughe, origano, carciofini, formaggio, olio d'oliva e basilico"],
  ['Chef', 1400, "Fior di latte, panna, prosciutto cotto, funghi, formaggio, olio d'oliva e basilico"],
  ['Mais', 1300, "Fior di latte, panna, prosciutto cotto, mais, formaggio, olio d'oliva e basilico"],
  ['Diavola', 1200, "Pomodoro, salame, formaggio, provola, olio d'oliva e basilico"],
  ['Margherita', 800, "Pomodoro, fior di latte, formaggio, olio d'oliva e basilico"],
  ['Cosacca', 700, "Pomodoro, olio d'oliva, formaggio e basilico"],
  ['Marinara', 700, "Pomodoro, origano, aglio, olio d'oliva e basilico"],
  ['Ortolana', 1600, "Provola, melanzane, zucchine, peperoni con capperi e olive, formaggio, olio d'oliva e basilico"],
  ['Fumè', 1600, "Filetto di pomodoro, speck, funghi, formaggio, provola, olio d'oliva e basilico"],
  ['Primavera', 1600, "Fior di latte, a crudo: speck, rucola, scaglie di grano, olio d'oliva e basilico"],
  ['Pizza fritta', 1500, 'Ricotta, provola, cicoli e pepe'],
  ['Ripieno', 1500, "Ricotta, salame, provola, pepe, formaggio, pomodoro, olio d'oliva e basilico"],
  ['Fiocco', 1500, "Sbriciolata di crocchè, panna, prosciutto cotto, provola, formaggio, olio d'oliva e basilico"],
  ['Tonnata', 1300, "Provola, cipolla, tonno, olive, formaggio, olio d'oliva, basilico e origano"],
  ['Ripieno con scarole', 1600, "Scarole, provola, olive, acciughe, olio d'oliva e pepe"],
  ['Vesuvio', 1600, "Pomodoro, filetto di pomodoro, origano, aglio, acciughe, olive, rucola, capperi, formaggio, olio d'oliva, basilico e peperoncino"],
  ['Porcini', 1600, "Funghi porcini* saltati con speck e salsiccia, provola, formaggio, olio d'oliva e basilico"],
  ["'O sole mio", 1600, "Datterino giallo, provola di bufala, formaggio e basilico"],
  ["Bella 'mbriana", 1600, "Filetto di pomodoro, speck, provola, panna, olio d'oliva, formaggio e basilico"],
  ['Mastuciccio', 1500, "Zucca stufata con salsiccia e speck, provola, formaggio, olio d'oliva e basilico"],
  ['Contadina', 1400, "Provola, salsa bolognese, formaggio, olio d'oliva e basilico"],
  ['Provola di bufala', 1400, "Pomodoro, provola di bufala, formaggio, olio d'oliva e basilico"],
  ["'O primmo ammore", 1400, 'Pomodorini, provola di bufala, pepe, formaggio e basilico'],
  ['Salsiccia e friarielli', 1600, "Provola, salsiccia, friarielli, olio d'oliva"],
  ['Totonno', 1400, 'Ragù napoletano con salsiccia, provola, formaggio, pecorino e basilico'],
  ['Pizza alla genovese', 1400, 'Genovese napoletana, provola, formaggio, e basilico'],
  ['Arancino piccolo', 150, ''],
  ['Frittatina piccola', 150, ''],
  ['Crocchè piccolo', 150, ''],
]

const bibiteRaw = [
  ['Paulaner Spezi 50 cl', 500],
  ['Coca-Cola Lattina 330ml', 250],
  ['Coca-Cola Zero Lattina 330ml', 250],
  ['Aranciata 33 cl', 250],
  ['Sprite Lattina 330ml', 250],
  ['Acqua naturale 50 cl', 150],
  ['Acqua frizzante 50 cl', 150],
  ['Kbirr Natavota — birra napoletana 5.2% vol. 33 cl', 500],
  ['Charles Quint Gold 8.5% vol. 33 cl', 500],
  ['Charles Quint Rubis 33 cl', 500],
  ['Paulaner Weisse 5.4% vol. 50 cl', 500],
  ['Hacker-Pschorr Weisse 50 cl', 500],
  ['Hacker-Pschorr Münchner Hell 50 cl', 500],
  ['Hacker-Pschorr 1417 5.5% vol. 50 cl', 500],
  ['Kbirr Pullicenhell 33 cl', 450],
  ['Birra Heineken 66 cl', 400],
  ['Heineken 33 cl', 250],
]

function titleCaseIngredient(raw) {
  const t = raw.trim()
  if (!t) return t
  return t.charAt(0).toUpperCase() + t.slice(1)
}

function collectModifiers(descriptions) {
  const byKey = new Map()
  for (const d of descriptions) {
    if (!d) continue
    const parts = d.split(',')
    for (let part of parts) {
      part = part.replace(/^\s*a crudo:\s*/i, '').replace(/\*+/g, '').trim()
      if (part.length < 2) continue
      const key = part.toLowerCase()
      if (!byKey.has(key)) byKey.set(key, titleCaseIngredient(part))
    }
  }
  return [...byKey.entries()]
    .sort((a, b) => a[0].localeCompare(b[0], 'it'))
    .map(([, label], i) => ({
      nome: label,
      prezzoCentesimi: 0,
      attiva: true,
      ordineVisualizzazione: i,
    }))
}

const dedup = new Map()
for (const [nome, cents, desc] of pizzeRaw) {
  if (!dedup.has(nome)) dedup.set(nome, { nome, cents, desc })
}

const pizze = [...dedup.values()].map((p, i) => ({
  nome: p.desc ? `${p.nome} — ${p.desc}` : p.nome,
  prezzoCentesimi: p.cents,
  attiva: true,
  ordineVisualizzazione: i,
}))

const modificatori = collectModifiers([...dedup.values()].map((p) => p.desc).filter(Boolean))

const bibite = bibiteRaw.map(([nome, cents], i) => ({
  nome,
  prezzoCentesimi: cents,
  attiva: true,
  ordineVisualizzazione: i,
}))

const out = {
  schemaVersion: 1,
  menuCatalog: true,
  sourceNote:
    'Estratto dal listino pubblico Glovo (Pizzeria Pellone Napoli). Prezzi e voci da verificare in sede. Modificatori derivati dagli ingredienti in scheda (stesso prezzo 0 — aggiornare in Admin).',
  pizze,
  modificatori,
  bibite,
}

const destDir = join(__dirname, '..', 'public', 'cataloghi')
mkdirSync(destDir, { recursive: true })
const dest = join(destDir, 'glovo-pellone-napoli.json')
writeFileSync(dest, JSON.stringify(out, null, 2), 'utf8')
console.log('Wrote', dest, { pizze: pizze.length, modificatori: modificatori.length, bibite: bibite.length })
