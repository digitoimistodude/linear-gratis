'use client'

import React from 'react'

interface CheckboxProps {
  checked: boolean
  onChange: () => void
  onClick?: (e: React.MouseEvent) => void
  tabIndex?: number
}

export function Checkbox({ checked, onChange, onClick, tabIndex = -1 }: CheckboxProps) {
  return (
    <div
      className="relative flex flex-shrink-0 items-center justify-center w-4 h-4 cursor-pointer select-none"
      onClick={(e) => {
        e.stopPropagation()
        onChange()
        onClick?.(e)
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        readOnly
        tabIndex={tabIndex}
        className="appearance-none flex-shrink-0 h-3.5 w-3.5 rounded-[3px] border cursor-pointer transition-all duration-75 m-0 p-0"
        style={{
          background: checked ? 'lch(47.918% 59.303 288.421)' : 'transparent',
          borderColor: checked ? 'lch(47.918% 59.303 288.421)' : 'lch(20.573 4.707 272)',
        }}
      />
      {checked && (
        <svg
          className="absolute w-2.5 h-2.5 pointer-events-none"
          viewBox="0 0 16 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M13.5 4.5L6 12l-3.5-3.5L4 7l2 2 6-6 1.5 1.5z"
            fill="white"
            fillRule="evenodd"
          />
        </svg>
      )}
    </div>
  )
}
