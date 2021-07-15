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

import styled from '@emotion/styled'
import React from 'react'

const CupertinoActivityIndicator = ({
  className,
  size = 32,
}: {
  className?: string
  size?: number
} = {}) => {
  return (
    <_Container className={className} size={size}>
      <div />
      <div />
      <div />
      <div />
      <div />
      <div />
      <div />
      <div />
    </_Container>
  )
}

function strokeWidth(size: number): number {
  if (size >= 32) {
    return 3
  } else if (size >= 24) {
    return 2
  }
  return 1
}

const _Container = styled.div<{ size: number }>`
  display: inline-block;
  vertical-align: middle;
  position: relative;
  width: ${props => props.size}px;
  height: ${props => props.size}px;
  border-radius: 50%;

  > div {
    width: ${props => strokeWidth(props.size)}px;
    min-width: 1px;
    height: 30%;
    background: currentColor;
    position: absolute;
    left: 0;
    right: 0;
    margin: auto;
    top: 35%;
    opacity: 1;
    border-radius: 100px;
    box-shadow: 0 0 4px rgba(0, 0, 0, 0.2);
    animation: fade 1s linear infinite;

    @keyframes fade {
      from {
        opacity: 0.5;
      }
      to {
        opacity: 0.25;
      }
    }

    &:nth-of-type(1) {
      transform: rotate(0deg) translate(0, -110%);
      animation-delay: 0s;
    }

    &:nth-of-type(2) {
      transform: rotate(45deg) translate(0, -110%);
      animation-delay: -0.875s;
    }

    &:nth-of-type(3) {
      transform: rotate(90deg) translate(0, -110%);
      animation-delay: -0.75s;
    }

    &:nth-of-type(4) {
      transform: rotate(135deg) translate(0, -110%);
      animation-delay: -0.625s;
    }

    &:nth-of-type(5) {
      transform: rotate(180deg) translate(0, -110%);
      animation-delay: -0.5s;
    }

    &:nth-of-type(6) {
      transform: rotate(225deg) translate(0, -110%);
      animation-delay: -0.375s;
    }

    &:nth-of-type(7) {
      transform: rotate(270deg) translate(0, -110%);
      animation-delay: -0.25s;
    }

    &:nth-of-type(8) {
      transform: rotate(315deg) translate(0, -110%);
      animation-delay: -0.125s;
    }
  }
`

export default CupertinoActivityIndicator
