// AB2-L1 FIX: suppress next/image TS resolution issue with React 19 + TS 5.9
// Next.js 16's Image type isn't resolved correctly — declare it explicitly.
declare module 'next/image' {
  import type { ComponentType, ImgHTMLAttributes, RefAttributes } from 'react'
  export interface ImageProps extends ImgHTMLAttributes<HTMLImageElement> {
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
    objectFit?: string
    objectPosition?: string
    onLoadingComplete?: (result: { naturalWidth: number; naturalHeight: number }) => void
  }
   
  export interface StaticImageData {
    src: string
    width: number
    height: number
    blurDataURL?: string
  }
  const Image: ComponentType<ImageProps & RefAttributes<HTMLImageElement | null>>
  export default Image
  export { ImageProps, StaticImageData }
}
