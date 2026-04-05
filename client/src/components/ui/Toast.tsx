import { Toaster } from 'react-hot-toast'

export default function ToastProvider() {
  return (
    <Toaster
      position="top-right"
      toastOptions={{
        duration: 3000,
        style: {
          fontFamily: '"DM Sans", sans-serif',
          background: '#1A1A1A',
          color: '#F5F0E8',
          borderRadius: '8px',
        },
        success: {
          iconTheme: { primary: '#D4A843', secondary: '#1A1A1A' },
        },
        error: {
          iconTheme: { primary: '#ef4444', secondary: '#1A1A1A' },
        },
      }}
    />
  )
}
