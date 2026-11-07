import { randomUUID } from 'node:crypto'
import { id } from './db.js'
import { hashPin } from './auth.js'

// Données initiales : ingrédients réalistes, vraie carte de cocktails,
// quelques fiches invités et commandes de démonstration (supprimables
// via Réglages → Réinitialiser la soirée).
export function seed() {
  const now = Date.now()
  const ing = (name, emoji, unit, stock, low, step) =>
    ({ id: id(), name, emoji, unit, stock, initialStock: stock, low, step })

  const I = {
    vodka: ing('Vodka', '❄️', 'cl', 210, 30, 5),
    gin: ing('Gin', '🌲', 'cl', 140, 20, 5),
    rhum: ing('Rhum blanc', '🏝️', 'cl', 210, 30, 5),
    tequila: ing('Tequila', '🌵', 'cl', 140, 20, 5),
    whisky: ing('Whisky', '🥃', 'cl', 70, 10, 5),
    tripleSec: ing('Triple sec', '🍊', 'cl', 70, 10, 5),
    peche: ing('Liqueur de pêche', '🍑', 'cl', 70, 10, 5),
    curacao: ing('Curaçao bleu', '💙', 'cl', 70, 10, 5),
    sucre: ing('Sirop de sucre', '🍬', 'cl', 100, 15, 5),
    grenadine: ing('Sirop de grenadine', '🌺', 'cl', 75, 10, 5),
    jusOrange: ing("Jus d'orange", '🍊', 'cl', 400, 50, 10),
    cranberry: ing('Jus de cranberry', '🍒', 'cl', 200, 30, 10),
    ananas: ing("Jus d'ananas", '🍍', 'cl', 200, 30, 10),
    jusCitron: ing('Jus de citron vert', '🍋', 'cl', 120, 20, 5),
    coca: ing('Coca-Cola', '🥤', 'cl', 600, 60, 10),
    limonade: ing('Limonade', '🫧', 'cl', 400, 50, 10),
    tonic: ing('Schweppes Tonic', '💧', 'cl', 400, 50, 10),
    ginger: ing('Ginger beer', '🫚', 'cl', 330, 40, 10),
    eauGazeuse: ing('Eau gazeuse', '💦', 'cl', 300, 40, 10),
    coco: ing('Lait de coco', '🥥', 'cl', 60, 10, 5),
    citronVert: ing('Citron vert', '🍋', 'pièce', 30, 5, 1),
    menthe: ing('Menthe fraîche', '🌿', 'brin', 40, 8, 1),
    glace: ing('Glaçons', '🧊', 'portion', 120, 20, 5),
  }

  const cocktail = (name, emoji, hue, category, points, description, steps, lines) => ({
    id: id(), name, emoji, hue, category, points, description, steps,
    imageUrl: null, visible: true, secret: false, createdAt: now,
    ingredients: lines.map(([ref, qty]) => ({ ingredientId: ref.id, qty })),
  })

  // Cocktail secret « Le 2-0 » : révélé uniquement par le bouton
  // « Futur champion » en bas de la carte publique. Placeholder à configurer.
  const secret20 = {
    id: id(), name: 'Le 2-0', emoji: '🏆', hue: 45, category: 'Secrets',
    points: 2, visible: true, secret: true, imageUrl: null, createdAt: now,
    description: 'Le cocktail des futurs champions. Recette confidentielle — demande-le au bar, si tu sais, tu sais.',
    steps: 'Recette à définir par le patron 😉',
    ingredients: [{ ingredientId: I.glace.id, qty: 1 }],
  }

  const cocktails = [
    cocktail('Mojito', '🌿', 150, 'Classiques', 2,
      'Le classique cubain : rhum blanc, menthe fraîche écrasée, citron vert et eau pétillante.',
      'Piler la menthe avec le citron vert et le sirop de sucre\nAjouter le rhum et la glace pilée\nCompléter avec l\'eau gazeuse, remuer doucement\nDécorer d\'un brin de menthe',
      [[I.rhum, 5], [I.citronVert, 0.5], [I.menthe, 1], [I.sucre, 2], [I.eauGazeuse, 8], [I.glace, 1]]),
    cocktail('Cuba Libre', '🥃', 25, 'Classiques', 2,
      'Rhum, cola et citron vert pressé. Simple, efficace, iconique.',
      'Remplir le verre de glaçons\nVerser le rhum puis le cola\nPresser le quartier de citron vert et le laisser dans le verre',
      [[I.rhum, 5], [I.coca, 12], [I.citronVert, 0.25], [I.glace, 1]]),
    cocktail('Gin Tonic', '🌲', 190, 'Classiques', 2,
      'Gin premium et tonic bien frais, relevé d\'un zeste de citron vert.',
      'Remplir un grand verre de glaçons\nVerser le gin puis le tonic\nAjouter un quartier de citron vert, remuer une fois',
      [[I.gin, 5], [I.tonic, 12], [I.citronVert, 0.25], [I.glace, 1]]),
    cocktail('Moscow Mule', '🫚', 45, 'Classiques', 2,
      'Vodka, ginger beer et citron vert. Servi glacé, piquant juste ce qu\'il faut.',
      'Remplir la tasse de glaçons\nVerser la vodka et le jus de citron vert\nCompléter avec la ginger beer, remuer doucement',
      [[I.vodka, 5], [I.jusCitron, 1], [I.ginger, 12], [I.glace, 1]]),
    cocktail('Whisky Cola', '🥃', 30, 'Classiques', 2,
      'Whisky et cola sur glace. Un incontournable qui ne déçoit jamais.',
      'Remplir le verre de glaçons\nVerser le whisky puis le cola\nRemuer une fois',
      [[I.whisky, 4], [I.coca, 10], [I.glace, 1]]),
    cocktail('Margarita', '🌵', 90, 'Classiques', 3,
      'Tequila, triple sec et citron vert dans un verre givré. Force et fraîcheur.',
      'Givrer le bord du verre avec du citron et du sel\nShaker tequila, triple sec et jus de citron vert avec de la glace\nFiltrer dans le verre',
      [[I.tequila, 5], [I.tripleSec, 3], [I.jusCitron, 3], [I.glace, 1]]),
    cocktail('Tequila Sunrise', '🌅', 15, 'Signatures', 2,
      'Un lever de soleil dans un verre : tequila, jus d\'orange et grenadine.',
      'Remplir le verre de glaçons\nVerser la tequila puis le jus d\'orange\nAjouter la grenadine le long du verre pour créer le dégradé',
      [[I.tequila, 5], [I.jusOrange, 12], [I.grenadine, 2], [I.glace, 1]]),
    cocktail('Sex on the Beach', '🍑', 330, 'Signatures', 2,
      'Vodka, pêche, cranberry et orange. Le cocktail signature de la soirée XOXO.',
      'Remplir le verre de glaçons\nVerser vodka et liqueur de pêche\nCompléter moitié cranberry, moitié jus d\'orange\nRemuer doucement',
      [[I.vodka, 4], [I.peche, 2], [I.cranberry, 6], [I.jusOrange, 6], [I.glace, 1]]),
    cocktail('Blue Lagoon', '💙', 210, 'Signatures', 2,
      'Plongée en eaux néon : vodka, curaçao bleu et limonade glacée.',
      'Remplir le verre de glaçons\nVerser la vodka et le curaçao\nCompléter avec la limonade, remuer une fois',
      [[I.vodka, 4], [I.curacao, 3], [I.limonade, 10], [I.glace, 1]]),
    cocktail('Piña Colada', '🥥', 50, 'Signatures', 2,
      'Rhum blanc, lait de coco et ananas, mixés en douceur. Vacances immédiates.',
      'Mixer rhum, lait de coco, jus d\'ananas et glace pilée\nVerser sans filtrer\nDécorer d\'un morceau d\'ananas',
      [[I.rhum, 4], [I.coco, 4], [I.ananas, 10], [I.glace, 1]]),
    cocktail('Long Island Iced Tea', '⚡', 280, 'Signatures', 3,
      'Cinq alcools, un cola, zéro pitié. À réserver aux connaisseurs.',
      'Verser les cinq alcools et le jus de citron vert sur glace\nCompléter avec le cola\nRemuer doucement, servir avec une paille',
      [[I.vodka, 1.5], [I.gin, 1.5], [I.rhum, 1.5], [I.tequila, 1.5], [I.tripleSec, 1.5], [I.jusCitron, 2], [I.coca, 6], [I.glace, 1]]),
    cocktail('Virgin Mojito', '🍃', 130, 'Sans alcool', 0,
      'Toute la fraîcheur du mojito, sans l\'alcool. Menthe, citron vert et bulles.',
      'Piler la menthe avec le citron vert et le sirop de sucre\nAjouter la glace pilée\nCompléter avec l\'eau gazeuse, remuer doucement',
      [[I.citronVert, 0.5], [I.menthe, 1], [I.sucre, 2], [I.eauGazeuse, 12], [I.glace, 1]]),
    cocktail('Sunset Punch', '🧡', 20, 'Sans alcool', 0,
      'Orange, ananas et grenadine. Le soleil couchant en version soft.',
      'Remplir le verre de glaçons\nVerser les jus d\'orange et d\'ananas\nAjouter la grenadine le long du verre',
      [[I.jusOrange, 8], [I.ananas, 6], [I.grenadine, 2], [I.glace, 1]]),
    cocktail('Shot de Tequila', '🔥', 60, 'Shots', 1,
      'Sel, tequila, citron. Dans cet ordre, et sans trembler.',
      'Servir la tequila dans un verre à shot\nAccompagner d\'un quartier de citron vert et de sel',
      [[I.tequila, 4], [I.citronVert, 0.25]]),
    secret20,
  ]

  const byName = n => cocktails.find(c => c.name === n)
  const drink = (name, qty, minAgo) => {
    const c = byName(name)
    return { cocktailId: c.id, name: c.name, emoji: c.emoji, qty, points: c.points * qty, at: now - minAgo * 60000 }
  }

  const guests = [
    { id: id(), name: 'Léa', comment: 'Team mojito 🌿', adjust: 0, demo: true, createdAt: now - 90 * 60000,
      deviceId: 'demo-lea-iphone', drinks: [drink('Mojito', 1, 45)] },
    { id: id(), name: 'Max', comment: 'À surveiller gentiment 😄', adjust: 0, demo: true, createdAt: now - 80 * 60000,
      deviceId: null, drinks: [drink('Sex on the Beach', 1, 70), drink('Margarita', 1, 25)] },
    { id: id(), name: 'Jules', comment: 'A promis de rentrer en taxi 🚕', adjust: 1, demo: true, createdAt: now - 120 * 60000,
      deviceId: 'demo-jules-android', drinks: [drink('Long Island Iced Tea', 1, 100), drink('Shot de Tequila', 1, 60), drink('Cuba Libre', 1, 15)] },
  ]

  const order = (name, qty, guestName, status, minAgo, note = '') => {
    const c = byName(name)
    return {
      id: id(), token: randomUUID(), cocktailId: c.id, name: c.name, emoji: c.emoji, points: c.points, qty,
      guestName, note, status, demo: true, subscriptions: [], deviceId: null,
      createdAt: now - minAgo * 60000, updatedAt: now - Math.max(0, minAgo - 3) * 60000,
      servedAt: status === 'served' ? now - Math.max(0, minAgo - 6) * 60000 : null,
      stockDeducted: status !== 'pending', pointsCredited: status === 'served', archived: false,
    }
  }

  const orders = [
    order('Mojito', 2, 'Léa', 'pending', 4),
    order('Gin Tonic', 1, 'Noah', 'pending', 2, 'Sans citron'),
    order('Sex on the Beach', 1, 'Emma', 'preparing', 7),
    order('Blue Lagoon', 1, 'Max', 'ready', 11),
    order('Margarita', 1, 'Jules', 'served', 30),
    order('Cuba Libre', 1, 'Sasha', 'served', 48),
  ]

  return {
    users: [
      { id: id(), name: 'Admin', role: 'admin', pinHash: hashPin('000000'), pinLen: 6, createdAt: now },
      { id: id(), name: 'Barman', role: 'barman', pinHash: hashPin('0000'), pinLen: 4, createdAt: now },
    ],
    sessions: {},
    pushSubs: {},
    donations: [],
    ingredients: Object.values(I),
    cocktails,
    orders,
    guests,
    settings: {
      partyName: 'XOXO PARTY',
      waitTime: 5,
      autoLink: true,
      categories: ['Classiques', 'Signatures', 'Sans alcool', 'Shots'],
      schema: 4,
    },
  }
}

// Mise à niveau des données existantes (data/db.json) vers le schéma courant.
export function migrate(s) {
  const v = s.settings.schema || 1
  if (v < 2) {
    for (const u of s.users) {
      if (u.role === 'admin' && u.name === 'Admin') { u.pinHash = hashPin('000000'); u.pinLen = 6 }
      else if (u.role === 'barman' && u.name === 'Barman') { u.pinHash = hashPin('0000'); u.pinLen = 4 }
      else u.pinLen = u.pinLen || 4
    }
    s.settings.schema = 2
  }
  for (const o of s.orders) {
    o.token = o.token || randomUUID()
    o.subscriptions = o.subscriptions || []
    if (o.deviceId === undefined) o.deviceId = null
  }
  for (const g of s.guests) {
    if (g.deviceId === undefined) g.deviceId = null
  }
  for (const u of s.users) u.pinLen = u.pinLen || 4
  // v4 : cocktails secrets + placeholder « Le 2-0 » (bouton Futur champion).
  for (const c of s.cocktails) {
    if (c.secret === undefined) c.secret = false
  }
  if ((s.settings.schema || 1) < 4 && !s.cocktails.some(c => c.secret || c.name.toLowerCase() === 'le 2-0')) {
    const glace = s.ingredients.find(i => i.name === 'Glaçons')
    s.cocktails.push({
      id: id(), name: 'Le 2-0', emoji: '🏆', hue: 45, category: 'Secrets',
      points: 2, visible: true, secret: true, imageUrl: null, createdAt: Date.now(),
      description: 'Le cocktail des futurs champions. Recette confidentielle — demande-le au bar, si tu sais, tu sais.',
      steps: 'Recette à définir par le patron 😉',
      ingredients: glace ? [{ ingredientId: glace.id, qty: 1 }] : [],
    })
  }
  // v5 : abonnements push par appareil + alias d'identités (Safari iOS et
  // l'app installée ont des stockages séparés → on fusionne les deux ID).
  s.pushSubs = s.pushSubs || {}
  for (const g of s.guests) {
    if (!Array.isArray(g.altIds)) g.altIds = []
  }
  // v6 (XOXO PARTY 2) : file d'attente live, commandes via l'app uniquement,
  // priorité contre don, tableau d'honneur, borne iPad, cocktails archivés.
  s.donations = s.donations || []
  for (const c of s.cocktails) {
    if (c.archived === undefined) c.archived = false
  }
  const defaults = {
    barmen: 2, paceMinutes: 2, learnedPace: null, learnedSamples: 0, waitMargin: 0,
    ordersOpen: true, pauseUntil: null, maxQueue: 20, maxActivePerDevice: 1, maxQty: 2,
    donationAmount: 2, paypalEmail: '', requirePass: true, kioskMessage: null,
  }
  for (const [k, v] of Object.entries(defaults)) {
    if (s.settings[k] === undefined) s.settings[k] = v
  }
  s.settings.schema = 6
}
