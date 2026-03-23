import { ImageResponse } from 'next/og'

export const size = { width: 32, height: 32 }
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        background: '#3b4fd8',
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '6px',
        color: 'white',
        fontSize: '20px',
        fontWeight: '700',
        fontFamily: 'sans-serif',
      }}
    >
      R
    </div>,
    { ...size }
  )
}
