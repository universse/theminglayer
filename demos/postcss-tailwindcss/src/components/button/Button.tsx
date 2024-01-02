import React from 'react'

// this can be generated from token files with a custom plugin
export interface ButtonVariants {
  intent?: 'primary' | 'critical'
  visual?: 'filled' | 'outline'
  disabled?: boolean
}

export interface ButtonProps extends ButtonVariants {
  children?: React.ReactNode
}

export function Button({
  intent = 'primary',
  visual = 'filled',
  disabled = false,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className='tl-button'
      data-intent={intent}
      data-visual={visual}
      disabled={disabled}
      type='button'
      {...props}
    >
      <span className='tl-button-label'>{children}</span>
    </button>
  )
}

Button.displayName = 'Button'
