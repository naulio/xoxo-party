import { forwardRef, memo, useCallback, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Lock, Timer, ArrowRight, Trophy, ScanLine, Smartphone, Gem } from 'lucide-react'
import { useApp } from '../store.js'
import { getPass, isStandalone, readMine } from '../net.js'
import { CocktailArt, PtsBadge, Modal, SearchBar, Empty, cls, plural, PT_LABEL, etaLabel, serviceStatus, useTick } from '../ui.jsx'
import { AppOnlyRule } from './Order.jsx'

const norm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

function WaitChip({ wait }) {
  const st = serviceStatus(wait)
  return (
    <div className="wait-chip fade-up" style={{ animationDelay: '0.25s' }}>
      <span className="dot" style={{ background: `var(--${st.tone === 'muted' ? 'text3' : st.tone})` }} />
      {wait.open ? (
        <>
          <Timer size={17} style={{ color: 'var(--blue)' }} />
          <span className="muted">Attente</span>
          <span className="w-num">{etaLabel(wait.minutes)}</span>
          {wait.queue > 0 && <span className="muted tiny">· {plural(wait.queue, 'commande')} en cours</span>}
        </>
      ) : (
        <span className="w-num">{st.label}</span>
      )}
    </div>
  )
}

/* Comment commander — la règle de la soirée, en 3 étapes. */
function HowTo({ pass }) {
  return (
    <section className="howto fade-up" style={{ animationDelay: '0.3s' }}>
      <AppOnlyRule />
      <div className="howto-steps">
        <div><span>1</span><b>Scanne la borne</b><p>Le QR sur l'iPad du bar</p></div>
        <div><span>2</span><b>Choisis</b><p>Ton cocktail + ton prénom</p></div>
        <div><span>3</span><b>Notif</b><p>Quand c'est prêt, viens le chercher</p></div>
      </div>
      <Link to="/commander" className={cls('btn lg full', pass ? 'primary' : '')}>
        {pass ? <><Smartphone size={18} /> Commander maintenant</> : <><ScanLine size={18} /> Commander (scanner la borne)</>}
      </Link>
    </section>
  )
}

function SkeletonGrid() {
  return (
    <div className="cocktail-grid">
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="card" style={{ overflow: 'hidden' }}>
          <div className="skel" style={{ aspectRatio: '16/10.5', borderRadius: 0 }} />
          <div className="col" style={{ padding: 18, gap: 10 }}>
            <div className="skel" style={{ height: 20, width: '55%' }} />
            <div className="skel" style={{ height: 13, width: '90%' }} />
            <div className="skel" style={{ height: 13, width: '70%' }} />
          </div>
        </div>
      ))}
    </div>
  )
}

function PointsSection() {
  return (
    <section className="pts-section" id="points">
      <p className="overline">Consommation responsable</p>
      <h2 style={{ fontSize: 26, marginTop: 6 }}>Comprendre les points</h2>
      <p className="muted" style={{ marginTop: 8, maxWidth: 640 }}>
        Chaque cocktail affiche un nombre de <b style={{ color: 'var(--text)' }}>points alcool</b> (léger : 1 · moyen : 2 · fort : 3).
        Ce système est purement indicatif : il ne bloque jamais une commande, il aide simplement chacun
        à garder un œil sur sa soirée.
      </p>
      <div className="pts-cards">
        <div className="card pts-card"><span className="p-emoji">🟢</span><b>Jusqu'à 3 points</b><p>Consommation faible. Tout va bien, santé !</p></div>
        <div className="card pts-card"><span className="p-emoji">🟠</span><b>Jusqu'à 5 points</b><p>Consommation modérée. Un verre d'eau entre deux ?</p></div>
        <div className="card pts-card"><span className="p-emoji">🔴</span><b>À partir de 6 points</b><p>Consommation élevée. On lève le pied, la nuit est longue.</p></div>
      </div>
      <p className="faint small" style={{ marginTop: 14 }}>L'abus d'alcool est dangereux pour la santé. Buvez de l'eau, mangez, dansez.</p>
    </section>
  )
}

/* Easter egg « Futur champion » : révèle le(s) cocktail(s) secret(s). */
function SecretModal({ open, onClose, secrets }) {
  const nav = useNavigate()
  return (
    <Modal open={open} onClose={onClose} title="🏆 Bien joué, champion." wide>
      {!secrets?.length ? (
        <Empty icon="🫥" title="Le secret s'est envolé" text="Reviens plus tard… ou demande gentiment au bar." />
      ) : (
        secrets.map(c => (
          <div key={c.id} className="col" style={{ gap: 14 }}>
            <div
              className="ck-detail-art"
              style={{
                background: `linear-gradient(135deg, hsl(${c.hue ?? 45} 82% 58%), hsl(${((c.hue ?? 45) + 55) % 360} 82% 42%))`,
                boxShadow: '0 0 44px rgba(251, 191, 36, 0.35)', marginBottom: 0,
              }}
            >
              {c.imageUrl ? <img src={c.imageUrl} alt="" /> : <span className="a-emoji">{c.emoji}</span>}
            </div>
            <div className="row between wrap">
              <h3 style={{ fontSize: 22 }}>{c.name}</h3>
              <div className="row wrap" style={{ gap: 6 }}>
                {c.available
                  ? <span className="badge green">● Disponible</span>
                  : <span className="badge orange">Victime de son succès</span>}
                <span className="badge violet">🍸 {c.points === 0 ? 'Sans alcool' : `${plural(c.points, 'point')} — ${PT_LABEL[c.points]}`}</span>
              </div>
            </div>
            <p className="muted">{c.description}</p>
            {c.ingredients.length > 0 && (
              <div className="row wrap" style={{ gap: 6 }}>
                {c.ingredients.map((n, i) => <span key={i} className="tag">{n}</span>)}
              </div>
            )}
            <p className="small" style={{ color: 'var(--orange)' }}>
              🤫 Ce cocktail n'est pas sur la carte — mais il se commande comme les autres, depuis l'app. Si tu sais, tu sais.
            </p>
            {c.available && (
              <button className="btn primary full" onClick={() => { onClose(); nav(`/commander?ck=${c.id}`) }}>
                🏆 Commander {c.name}
              </button>
            )}
          </div>
        ))
      )}
    </Modal>
  )
}

/* Carte de cocktail mémoïsée : ouvrir le détail ou recevoir un broadcast
   temps réel ne re-rend plus les 15-20 cartes animées (latence au tap sur
   mobile). Re-rendu uniquement si le cocktail change réellement. */
const CkCard = memo(forwardRef(function CkCard({ c, i, onOpen }, ref) {
  return (
    <motion.button
      ref={ref} layout
      className="card hover ck-card"
      initial={{ opacity: 0, y: 22, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.92 }}
      transition={{ type: 'spring', stiffness: 300, damping: 28, delay: Math.min(i * 0.04, 0.4) }}
      onClick={() => onOpen(c)}
    >
      <div className="ck-art" style={{ background: `linear-gradient(135deg, hsl(${c.hue ?? 300} 82% 58%), hsl(${((c.hue ?? 300) + 55) % 360} 82% 42%))` }}>
        {c.imageUrl ? <img src={c.imageUrl} alt="" loading="lazy" /> : <span className="a-emoji">{c.emoji}</span>}
        <div className="a-sheen" />
        <div className="a-badges">
          <span className="badge green" style={{ backdropFilter: 'blur(10px)', background: 'rgba(8,8,12,.55)' }}>● Disponible</span>
          <PtsBadge points={c.points} />
        </div>
      </div>
      <div className="ck-body">
        <div className="row between">
          <h3>{c.name}</h3>
          <span className="tiny faint nowrap">{c.category}</span>
        </div>
        <p className="desc">{c.description}</p>
        <div className="ck-ing">
          {c.ingredients.slice(0, 4).map((n, j) => <span key={j} className="tag">{n}</span>)}
          {c.ingredients.length > 4 && <span className="tag">+{c.ingredients.length - 4}</span>}
        </div>
      </div>
    </motion.button>
  )
}), (prev, next) => prev.i === next.i && prev.onOpen === next.onOpen && JSON.stringify(prev.c) === JSON.stringify(next.c))

function CocktailModal({ c, onClose }) {
  const nav = useNavigate()
  return (
    <Modal open={!!c} onClose={onClose} title={c ? `${c.emoji} ${c.name}` : ''} wide>
      {c && (
        <>
          <CocktailArt c={c} detail />
          <div className="row wrap" style={{ gap: 8 }}>
            <span className="badge green">● Disponible</span>
            <span className="badge violet">🍸 {c.points === 0 ? 'Sans alcool' : `${plural(c.points, 'point')} alcool — ${PT_LABEL[c.points]}`}</span>
            <span className="badge">{c.category}</span>
          </div>
          <p className="muted">{c.description}</p>
          <div>
            <p className="overline" style={{ marginBottom: 8 }}>Ingrédients</p>
            <div className="row wrap" style={{ gap: 6 }}>
              {c.ingredients.map((n, i) => <span key={i} className="tag">{n}</span>)}
            </div>
          </div>
          <button className="btn primary lg full" onClick={() => { onClose(); nav(`/commander?ck=${c.id}`) }}>
            <Smartphone size={18} /> Commander ce cocktail
          </button>
          <p className="faint small">Commande uniquement via l'app (pas au comptoir). Les points alcool sont indicatifs.</p>
        </>
      )}
    </Modal>
  )
}

export default function Public() {
  const { pub, me } = useApp()
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('Tous')
  const [detail, setDetail] = useState(null)
  const [secretOpen, setSecretOpen] = useState(false)
  const openDetail = useCallback(c => setDetail(c), [])
  useTick(15000)
  const pass = getPass()

  // Commande récente sur CE téléphone → raccourci de suivi.
  const lastOrder = useMemo(
    () => readMine().find(o => Date.now() - o.at < 6 * 3600 * 1000 && o.status !== 'served') || null,
    []
  )

  const list = useMemo(() => {
    if (!pub) return []
    return pub.cocktails
      .filter(c => cat === 'Tous' || c.category === cat)
      .filter(c => !q || norm(c.name + ' ' + c.ingredients.join(' ')).includes(norm(q)))
  }, [pub, q, cat])

  const cats = ['Tous', ...(pub?.categories || [])]

  return (
    <div className="pub">
      <header className="pub-top">
        <span className="logo-mark grad-text">XOXO</span>
        {me ? (
          <Link to={me.role === 'admin' ? '/admin' : '/bar'} className="btn sm">Espace staff <ArrowRight size={15} /></Link>
        ) : (
          <Link to="/login" className="btn ghost sm" style={{ color: 'var(--text3)' }}><Lock size={14} /> Staff</Link>
        )}
      </header>

      <section className="pub-hero">
        <p className="overline fade-up">Soirée privée · Projet XX</p>
        <h1 className="grad-text fade-up" style={{ animationDelay: '0.08s' }}>{pub?.partyName || 'XOXO PARTY'}</h1>
        <p className="sub fade-up" style={{ animationDelay: '0.16s' }}>
          La carte des cocktails, en direct du bar. Tout est offert ce soir. 🖤
        </p>
        {pub?.wait && <WaitChip wait={pub.wait} />}
        {(lastOrder || isStandalone()) && (
          <div className="fade-up row center wrap" style={{ marginTop: 14, gap: 8 }}>
            {lastOrder && (
              <Link to={`/c/${lastOrder.token}`} className="chip">{lastOrder.emoji} Suivre ma commande — {lastOrder.name} →</Link>
            )}
            <Link to="/moi" className="chip">Mes commandes</Link>
          </div>
        )}
      </section>

      <HowTo pass={pass} />

      <div className="pub-filters glass card">
        <SearchBar value={q} onChange={setQ} placeholder="Un cocktail, un ingrédient…" />
        <div className="chips-scroll">
          {cats.map(c => (
            <button key={c} className={cls('chip', cat === c && 'active')} onClick={() => setCat(c)}>
              {c}
              {c !== 'Tous' && <span style={{ opacity: 0.65, fontWeight: 500 }}>{pub.cocktails.filter(x => x.category === c).length}</span>}
            </button>
          ))}
        </div>
      </div>

      {!pub ? (
        <SkeletonGrid />
      ) : list.length ? (
        <div className="cocktail-grid">
          <AnimatePresence mode="popLayout">
            {list.map((c, i) => <CkCard key={c.id} c={c} i={i} onOpen={openDetail} />)}
          </AnimatePresence>
        </div>
      ) : (
        <Empty
          icon="🍸"
          title={q || cat !== 'Tous' ? 'Aucun cocktail ne correspond' : 'Le bar recharge ses stocks'}
          text={q || cat !== 'Tous' ? 'Essaie une autre recherche ou une autre catégorie.' : 'Les cocktails réapparaîtront ici dès qu\'ils seront à nouveau disponibles.'}
        />
      )}

      <PointsSection />

      {pub?.rules && (
        <section className="pts-section">
          <p className="overline">Équité au bar</p>
          <h2 style={{ fontSize: 26, marginTop: 6 }}>Premier arrivé, premier servi</h2>
          <p className="muted" style={{ marginTop: 8, maxWidth: 640 }}>
            Les barmans préparent dans l'ordre des commandes, sans passe-droit — chacun voit son temps d'attente en direct.
            Une commande à la fois par personne, pour que tout le monde soit servi.
          </p>
          <div className="card pad row" style={{ gap: 14, marginTop: 16, maxWidth: 640 }}>
            <Gem size={26} style={{ color: 'var(--blue)', flexShrink: 0 }} />
            <div>
              <b>Seule exception : {String(pub.rules.donationAmount).replace('.', ',')} € pour les barmans</b>
              <p className="small muted">Dans la boîte à tips du bar ou par PayPal : ta commande passe en priorité (validé par un barman) et ton prénom rejoint le tableau d'honneur.</p>
            </div>
          </div>
        </section>
      )}

      <footer className="pub-foot">
        <span className="grad-text bold" style={{ fontFamily: 'var(--display)' }}>XOXO PARTY</span>
        <span>Projet XX · Fait avec 🖤 pour une nuit inoubliable</span>
        <button className="secret-btn" onClick={() => setSecretOpen(true)}>
          <Trophy size={12} /> Futur champion
        </button>
      </footer>

      <CocktailModal c={detail} onClose={() => setDetail(null)} />
      <SecretModal open={secretOpen} onClose={() => setSecretOpen(false)} secrets={pub?.secrets} />
    </div>
  )
}
