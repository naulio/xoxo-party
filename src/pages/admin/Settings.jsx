import { useState } from 'react'
import { Copy, Download, RotateCcw, Trash2, Link2, Globe, Wifi, Github } from 'lucide-react'
import { useApp, call, toast, getToken } from '../../store.js'
import { apiUrl } from '../../net.js'
import { Modal, Field, Switch, ConfirmBtn, QRCanvas } from '../../ui.jsx'

export default function SettingsPage() {
  const { staff } = useApp()
  const [name, setName] = useState(null)
  const [resetOpen, setResetOpen] = useState(false)
  const [resetOpts, setResetOpts] = useState({ orders: true, guests: true, restock: true, donations: false })

  if (!staff) return null
  const s = staff.settings
  const m = staff.meta || {}
  const urls = m.urls || []
  const online = !!m.tunnel
  const bestUrl = m.appUrl || urls[0]
  const fixed = m.pagesUrl

  const saveName = async () => {
    if (name !== null && name.trim() && name !== s.partyName) {
      const r = await call('PATCH', '/api/settings', { partyName: name })
      if (r) toast('success', 'Nom mis à jour', `La soirée s'appelle « ${name} ».`)
    }
    setName(null)
  }

  const copy = async url => {
    try {
      await navigator.clipboard.writeText(url)
      toast('success', 'Copié', url)
    } catch {
      toast('info', 'Adresse', url)
    }
  }

  const doReset = async () => {
    const r = await call('POST', '/api/admin/reset', resetOpts)
    if (r) {
      toast('success', 'Soirée réinitialisée', 'Prêt pour le grand soir 🎉')
      setResetOpen(false)
    }
  }

  const exportData = async () => {
    const res = await fetch(apiUrl('/api/admin/export'), { headers: { Authorization: 'Bearer ' + getToken() } })
    const blob = await res.blob()
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `xoxo-party-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <>
      <div className="toolbar">
        <div>
          <h2 className="page-title">Réglages</h2>
          <p className="small muted">Paramètres généraux de la soirée.</p>
        </div>
      </div>

      <div className="col" style={{ gap: 14, maxWidth: 680 }}>
        <div className="card pad col" style={{ gap: 14 }}>
          <h3 style={{ fontSize: 16 }}>Général</h3>
          <Field label="Nom de la soirée (affiché sur la carte)">
            <div className="row">
              <input className="input grow" value={name ?? s.partyName} onChange={e => setName(e.target.value)} onBlur={saveName} onKeyDown={e => e.key === 'Enter' && e.target.blur()} />
            </div>
          </Field>
          <div className="row between">
            <div>
              <div className="bold small">Lier commandes et fiches invités</div>
              <div className="tiny muted">Quand une commande au nom d'un invité est servie, ses points sont ajoutés automatiquement à sa fiche.</div>
            </div>
            <Switch checked={s.autoLink} onChange={v => call('PATCH', '/api/settings', { autoLink: v })} />
          </div>
        </div>

        <div className="card pad col" style={{ gap: 14 }}>
          <div className="row between wrap">
            <h3 style={{ fontSize: 16 }}><Link2 size={16} style={{ verticalAlign: '-2.5px' }} /> Accès des appareils</h3>
            {online && fixed && m.pagesLive ? (
              <span className="badge green"><Github size={12} /> Lien fixe actif — partout (4G/5G)</span>
            ) : online ? (
              <span className="badge blue"><Globe size={12} /> En ligne{fixed ? ' — lien fixe en cours de mise à jour…' : ''}</span>
            ) : (
              <span className="badge orange"><Wifi size={12} /> Wi-Fi local uniquement</span>
            )}
          </div>
          <p className="small muted">
            {online
              ? (fixed
                ? 'Le lien GitHub ne change jamais : imprime le QR à l\'avance, il marche en Wi-Fi comme en 4G/5G, notifications comprises.'
                : 'Accessible partout, mais cette adresse change à chaque redémarrage (configure le lien fixe GitHub, voir README).')
              : 'Les appareils doivent être sur le même Wi-Fi que ce PC. Pour le lien fixe + notifications, lance start-en-ligne.bat.'}
          </p>
          <div className="row wrap" style={{ gap: 18, alignItems: 'flex-start' }}>
            <QRCanvas url={bestUrl} size={190} />
            <div className="col grow" style={{ gap: 8, minWidth: 220 }}>
              {fixed && (
                <>
                  {[['Carte & commandes', fixed], ['Borne iPad invités', fixed + '#/borne'], ['iPad barmans', fixed + '#/bar'], ['Écran donateurs', fixed + '#/ecran']].map(([label, u]) => (
                    <div key={u} className="row card" style={{ padding: '9px 12px', borderRadius: 12, borderColor: 'rgba(52,211,153,.3)' }}>
                      <span className="tiny muted nowrap" style={{ width: 120 }}>{label}</span>
                      <code className="grow small ellipsis" style={{ fontFamily: 'ui-monospace, monospace', color: 'var(--green)' }}>{u}</code>
                      <button className="btn ghost icon sm" onClick={() => copy(u)} aria-label="Copier"><Copy size={14} /></button>
                    </div>
                  ))}
                </>
              )}
              {online && (
                <div className="row card" style={{ padding: '9px 12px', borderRadius: 12 }}>
                  <span className="tiny muted nowrap" style={{ width: 120 }}>Tunnel (technique)</span>
                  <code className="grow small ellipsis" style={{ fontFamily: 'ui-monospace, monospace' }}>{m.publicUrl}</code>
                  <button className="btn ghost icon sm" onClick={() => copy(m.publicUrl)} aria-label="Copier"><Copy size={14} /></button>
                </div>
              )}
              {urls.map(u => (
                <div key={u} className="row card" style={{ padding: '9px 12px', borderRadius: 12 }}>
                  <code className="grow small ellipsis" style={{ fontFamily: 'ui-monospace, monospace' }}>{u}</code>
                  <button className="btn ghost icon sm" onClick={() => copy(u)} aria-label="Copier"><Copy size={14} /></button>
                </div>
              ))}
              <p className="tiny faint">
                {online
                  ? 'Les liens verts sont fixes. Les adresses locales ci-dessus restent utilisables sur le Wi-Fi.'
                  : 'La première adresse fonctionne sur ce PC, les suivantes sur le réseau local.'}
              </p>
            </div>
          </div>
        </div>

        <div className="card pad col" style={{ gap: 12 }}>
          <h3 style={{ fontSize: 16 }}>Données</h3>
          <div className="row wrap">
            <button className="btn" onClick={exportData}><Download size={15} /> Exporter une sauvegarde</button>
            <button className="btn" onClick={async () => {
              await Promise.all(staff.ingredients.map(i => call('POST', `/api/ingredients/${i.id}/restock`)))
              toast('success', 'Stocks rechargés', 'Tous les ingrédients sont à leur niveau de référence.')
            }}>
              <RotateCcw size={15} /> Recharger tous les stocks
            </button>
          </div>
          <p className="tiny faint">Les données vivent dans le dossier <code>data/</code> du projet (fichier JSON), les photos dans <code>uploads/</code>.</p>
        </div>

        <div className="card pad col danger-zone" style={{ gap: 12 }}>
          <h3 style={{ fontSize: 16, color: 'var(--red)' }}>Zone sensible</h3>
          <div className="row between wrap">
            <div>
              <div className="bold small">Réinitialiser la soirée</div>
              <div className="tiny muted">Efface commandes et fiches invités (dont les données de démo). Les cocktails et ingrédients restent.</div>
            </div>
            <button className="btn danger" onClick={() => setResetOpen(true)}><Trash2 size={15} /> Réinitialiser…</button>
          </div>
        </div>
      </div>

      <Modal open={resetOpen} onClose={() => setResetOpen(false)} title="Réinitialiser la soirée">
        <p className="small muted">Choisis ce qui doit être remis à zéro. Action immédiate sur tous les appareils.</p>
        {[
          ['orders', 'Supprimer toutes les commandes'],
          ['guests', 'Supprimer toutes les fiches invités'],
          ['donations', 'Remettre à zéro le tableau des donateurs'],
          ['restock', 'Recharger les stocks au niveau de référence'],
        ].map(([key, label]) => (
          <div key={key} className="row between card" style={{ padding: '10px 14px', borderRadius: 12 }}>
            <span className="small">{label}</span>
            <Switch checked={resetOpts[key]} onChange={v => setResetOpts({ ...resetOpts, [key]: v })} />
          </div>
        ))}
        <ConfirmBtn className="btn danger full" onConfirm={doReset} confirmLabel="Appuie encore pour confirmer">
          Réinitialiser maintenant
        </ConfirmBtn>
      </Modal>
    </>
  )
}
