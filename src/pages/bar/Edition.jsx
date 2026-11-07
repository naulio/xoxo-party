import { useState } from 'react'
import { Seg } from '../../ui.jsx'
import Cocktails from '../admin/Cocktails.jsx'
import Ingredients from '../admin/Ingredients.jsx'

/* Onglet barman : création / modification des cocktails et des ingrédients
   sans passer par l'espace admin (la suppression reste réservée aux admins). */
export default function Edition() {
  const [view, setView] = useState('cocktails')
  return (
    <>
      <div className="row" style={{ marginBottom: 18 }}>
        <Seg
          value={view} onChange={setView}
          options={[
            { value: 'cocktails', label: '🍸 Cocktails' },
            { value: 'ingredients', label: '📦 Ingrédients' },
          ]}
        />
      </div>
      {view === 'cocktails' ? <Cocktails /> : <Ingredients />}
    </>
  )
}
