import { useState } from 'react'
import { Plus, Trash2, KeyRound, ShieldCheck } from 'lucide-react'
import { useApp, call, toast } from '../../store.js'
import { Modal, Field, Seg, ConfirmBtn } from '../../ui.jsx'

export default function UsersPage() {
  const { staff, me } = useApp()
  const [creating, setCreating] = useState(false)
  const [pinFor, setPinFor] = useState(null)
  const [form, setForm] = useState({ name: '', role: 'barman', pin: '' })
  const [newPin, setNewPin] = useState('')

  if (!staff) return null

  const create = async () => {
    const r = await call('POST', '/api/users', form)
    if (r) {
      toast('success', 'Compte créé', `${form.name} peut se connecter avec son PIN.`)
      setCreating(false)
      setForm({ name: '', role: 'barman', pin: '' })
    }
  }

  const resetPin = async () => {
    const r = await call('PATCH', `/api/users/${pinFor.id}`, { pin: newPin })
    if (r) {
      toast('success', 'PIN mis à jour', `Nouveau code pour ${pinFor.name}.`)
      setPinFor(null)
      setNewPin('')
    }
  }

  return (
    <>
      <div className="toolbar">
        <div>
          <h2 className="page-title">Utilisateurs</h2>
          <p className="small muted">Comptes staff — connexion par code PIN sur l'écran de login.</p>
        </div>
        <div className="grow" />
        <button className="btn primary" onClick={() => setCreating(true)}><Plus size={17} /> Nouveau compte</button>
      </div>

      <div className="col" style={{ gap: 9, maxWidth: 640 }}>
        {staff.users.map(u => (
          <div key={u.id} className="card list-row">
            <span className="avatar" style={{ width: 44, height: 44, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--grad)', fontWeight: 750, fontFamily: 'var(--display)', fontSize: 17 }}>
              {u.name[0]?.toUpperCase()}
            </span>
            <div className="grow">
              <span className="bold">{u.name}{u.id === me.id && <span className="tiny faint"> (toi)</span>}</span>
              <div style={{ marginTop: 3 }}>
                <span className={u.role === 'admin' ? 'badge violet' : 'badge blue'}>
                  {u.role === 'admin' ? <><ShieldCheck size={12} /> Admin</> : 'Barman'}
                </span>
              </div>
            </div>
            <Seg
              value={u.role}
              onChange={role => call('PATCH', `/api/users/${u.id}`, { role })}
              options={[{ value: 'barman', label: 'Barman' }, { value: 'admin', label: 'Admin' }]}
            />
            <button className="btn icon sm" title="Changer le PIN" onClick={() => { setPinFor(u); setNewPin('') }}><KeyRound size={15} /></button>
            {u.id !== me.id && (
              <ConfirmBtn className="btn ghost icon sm" onConfirm={() => call('DELETE', `/api/users/${u.id}`)} confirmLabel="Sûr ?">
                <Trash2 size={15} />
              </ConfirmBtn>
            )}
          </div>
        ))}
      </div>

      <p className="small faint" style={{ marginTop: 18, maxWidth: 640 }}>
        💡 Le bouton clé 🔑 change le PIN d'un compte à tout moment.
        Après une remise à zéro complète de la base (suppression de <code>data/db.json</code>),
        les codes d'usine redeviennent : Admin <b>000000</b> · Barman <b>0000</b>.
      </p>

      <Modal open={creating} onClose={() => setCreating(false)} title="Nouveau compte staff">
        <Field label="Nom affiché">
          <input className="input" autoFocus value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Sasha" />
        </Field>
        <Field label="Rôle">
          <Seg
            value={form.role} onChange={role => setForm({ ...form, role })}
            options={[{ value: 'barman', label: '🍸 Barman' }, { value: 'admin', label: '🛡️ Admin' }]}
          />
        </Field>
        <Field label="Code PIN (4 à 6 chiffres)">
          <input className="input" inputMode="numeric" maxLength={6} value={form.pin}
            onChange={e => setForm({ ...form, pin: e.target.value.replace(/\D/g, '') })} placeholder="••••" />
        </Field>
        <button className="btn primary full" onClick={create}>Créer le compte</button>
      </Modal>

      <Modal open={!!pinFor} onClose={() => setPinFor(null)} title={`Nouveau PIN pour ${pinFor?.name}`}>
        <Field label="Code PIN (4 à 6 chiffres)">
          <input className="input" autoFocus inputMode="numeric" maxLength={6} value={newPin}
            onChange={e => setNewPin(e.target.value.replace(/\D/g, ''))} placeholder="••••"
            onKeyDown={e => e.key === 'Enter' && resetPin()} />
        </Field>
        <button className="btn primary full" onClick={resetPin}>Mettre à jour</button>
      </Modal>
    </>
  )
}
