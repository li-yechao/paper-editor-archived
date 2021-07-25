// Copyright 2021 LiYechao
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

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
