'use client'

import { Play, Smartphone, Loader2 } from 'lucide-react'
import { SHOT_ZONES } from '@/lib/biomechanics'
import styles from './TrainingSetup.module.css'

const SETUP_TIPS = {
  user: 'Câmera frontal: apoie o celular de pé no chão ou numa garrafa, a uns 2 metros, virado para você.',
  environment: 'Câmera traseira: use um tripé ou apoio a 4–6 metros, de lado para o arremessador, com o corpo inteiro no quadro.',
}

function Segmented({ options, value, onChange }) {
  return (
    <div className={styles.segmented}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          className={value === o.value ? styles.segActive : ''}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/**
 * Configuração comum antes de começar: dica de posicionamento, mão, meta,
 * câmera, dica do Coach Carter e botão de início.
 * `showReps` e `showHand` controlam os seletores opcionais; o seletor de zona
 * aparece quando `onZoneChange` é passado (drill sem zona fixa).
 */
export default function TrainingSetup({
  drill,
  cameraFacing,
  onCameraChange,
  dominantHand,
  onHandChange,
  handLabel = 'Mão de arremesso',
  showHand = true,
  targetReps,
  onRepsChange,
  showReps = true,
  zone,
  onZoneChange,
  aiReady,
  startLabel = 'Começar',
  onStart,
}) {
  return (
    <>
      <div className={styles.setupTip}>
        <Smartphone size={18} />
        <span>{SETUP_TIPS[cameraFacing]}</span>
      </div>

      {showHand && (
        <div className={styles.field}>
          <span className={styles.fieldLabel}>{handLabel}</span>
          <Segmented
            value={dominantHand}
            onChange={onHandChange}
            options={[
              { value: 'right', label: 'Direita' },
              { value: 'left', label: 'Esquerda' },
            ]}
          />
        </div>
      )}

      {onZoneChange && (
        <div className={styles.field}>
          <span className={styles.fieldLabel}>De onde você vai arremessar?</span>
          <Segmented
            value={zone}
            onChange={onZoneChange}
            options={SHOT_ZONES.map((z) => ({ value: z.id, label: z.id === 'LL' ? 'Lance livre' : z.id }))}
          />
        </div>
      )}

      {showReps && (
        <div className={styles.field}>
          <span className={styles.fieldLabel}>{drill.mode === 'targets' ? 'Alvos' : 'Meta de arremessos'}</span>
          <Segmented
            value={targetReps}
            onChange={onRepsChange}
            options={[...drill.presetReps.map((r) => ({ value: r, label: r })), { value: 'free', label: 'Livre' }]}
          />
        </div>
      )}

      <div className={styles.field}>
        <span className={styles.fieldLabel}>Câmera</span>
        <Segmented
          value={cameraFacing}
          onChange={onCameraChange}
          options={[
            { value: 'user', label: 'Frontal' },
            { value: 'environment', label: 'Traseira' },
          ]}
        />
      </div>

      <div className={styles.coachTip}>
        <strong>Coach Carter</strong>
        {drill.targetTip}
      </div>

      <button type="button" className={styles.startBtn} onClick={onStart} disabled={!aiReady}>
        {aiReady ? (
          <>
            <Play size={20} fill="currentColor" /> {startLabel}
          </>
        ) : (
          <>
            <Loader2 size={20} className={styles.spin} /> Carregando IA…
          </>
        )}
      </button>
    </>
  )
}
