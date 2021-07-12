import { OverridableComponent } from '@material-ui/core/OverridableComponent'
import React, { useEffect, useRef } from 'react'

export interface LazyComponentTypeMap<P = {}, D extends React.ElementType = 'div'> {
  props: P & { onVisibleChange: (visible: boolean) => void; exposureTime?: number }
  defaultComponent: D
  classKey: ''
}

const intersectionObserver = new IntersectionObserver(entries => {
  for (const entry of entries) {
    ;(entry.target as any).onVisibleChange(entry.isIntersecting)
  }
})

export const LazyComponent: OverridableComponent<LazyComponentTypeMap> = ({
  component: C,
  onVisibleChange,
  exposureTime = 500,
  ...props
}: LazyComponentTypeMap['props'] & any) => {
  const ref = useRef<HTMLElement>(null)

  useEffect(() => {
    if (ref.current) {
      let timeout: any
      ;(ref.current as any).onVisibleChange = (visible: boolean) => {
        if (visible) {
          timeout = setTimeout(() => onVisibleChange(visible), exposureTime)
        } else {
          clearTimeout(timeout)
        }
      }
      intersectionObserver.observe(ref.current)
    }

    return () => {
      ref.current && intersectionObserver.unobserve(ref.current)
    }
  }, [])

  return <C ref={ref} {...props} />
}
