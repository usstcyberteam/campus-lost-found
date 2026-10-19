import styles from './LayerToggles.module.css'

export interface LayerToggleOption {
  key: string
  label: string
  checked: boolean
  disabled?: boolean
  onChange: (checked: boolean) => void
}

interface LayerTogglesProps {
  options: LayerToggleOption[]
}

export default function LayerToggles({ options }: LayerTogglesProps) {
  return (
    <div className={styles.toggles}>
      {options.map((option) => (
        <label key={option.key} className={styles.toggle}>
          <input
            type="checkbox"
            checked={option.checked}
            disabled={option.disabled}
            onChange={(e) => option.onChange(e.target.checked)}
          />
          {option.label}
        </label>
      ))}
    </div>
  )
}