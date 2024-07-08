import React from 'react'

// this can be generated from token files with a custom plugin
export interface ButtonVariants {
  tone?: 'accent' | 'critical'
  visual?: 'filled' | 'outline'
  disabled?: boolean
}

export interface ButtonProps extends ButtonVariants {
  children?: React.ReactNode
}

export function Button({
  tone = 'accent',
  visual = 'filled',
  disabled = false,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className='tl-button'
      data-tone={tone}
      data-visual={visual}
      disabled={disabled}
      type='button'
      {...props}
    >
      <span className='tl-button-label'>{children}</span>
    </button>
  )
}
