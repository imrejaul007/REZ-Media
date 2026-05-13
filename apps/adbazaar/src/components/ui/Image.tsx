'use client'

// AB2-L1 FIX: Wraps next/image to work around React 19 + TS 5.9 type resolution conflict.
// Direct import of 'next/image' fails because TypeScript resolves Image to the
// HTMLImageElement constructor instead of the Next.js component.
// This wrapper re-exports the component with explicit interface typing.
import NextImage from 'next/image'
import type { ComponentType, ImgHTMLAttributes } from 'react'

interface Props extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'width' | 'height'> {
  src: string | { src: string; width: number; height: number; blurDataURL?: string }
  alt: string
  width?: number | string
  height?: number | string
  fill?: boolean
  loader?: (props: { src: string; width: number }) => string
  quality?: number | string
  priority?: boolean
  loading?: 'lazy' | 'eager'
  placeholder?: 'blur' | 'empty'
  blurDataURL?: string
  unoptimized?: boolean
  overrideSrc?: string
  onLoadingComplete?: (result: { naturalWidth: number; naturalHeight: number }) => void
}

const Image = NextImage as ComponentType<Props>

export default Image
