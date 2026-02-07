import { useState } from 'react'
import { useAppStore, Image } from '@/lib/store'

/**
 * Shared logic for opening / closing the MotionStudio modal
 * and tracking the currently-selected image.
 *
 * Used by both the Mosaic page and the Viral Architect view.
 */
export function useStudioHandlers() {
  const { setSelectedImageId } = useAppStore()
  const [selectedImage, setSelectedImage] = useState<Image | null>(null)
  const [isStudioOpen, setIsStudioOpen] = useState(false)

  const handleImageClick = (image: Image) => {
    setSelectedImage(image)
    setSelectedImageId(image.id)
    setIsStudioOpen(true)
  }

  const handleCloseStudio = () => {
    setIsStudioOpen(false)
    setSelectedImage(null)
    setSelectedImageId(null)
  }

  return {
    selectedImage,
    isStudioOpen,
    handleImageClick,
    handleCloseStudio,
  }
}
