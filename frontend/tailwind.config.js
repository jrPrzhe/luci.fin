/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        telegram: {
          bg: '#F0F0F0',
          surface: '#FFFFFF',
          primary: '#3390EC',
          primaryHover: '#2B7DD8',
          primaryLight: '#6CC3F2',
          text: '#000000',
          textSecondary: '#707579',
          border: '#E5E5E5',
          hover: '#F7F7F7',
          success: '#4CAF50',
          danger: '#F44336',
          warning: '#FF9800',
          // Темная тема
          dark: {
            bg: '#212121',
            surface: '#2C2C2E',
            primary: '#3390EC',
            primaryHover: '#4AA3F0',
            primaryLight: '#6CC3F2',
            text: '#FFFFFF',
            textSecondary: '#98989D',
            border: '#38383A',
            hover: '#3A3A3C',
            success: '#4CAF50',
            danger: '#F44336',
            warning: '#FF9800',
          },
        },
      },
      borderRadius: {
        'telegram': '12px',
        'telegram-lg': '16px',
      },
      boxShadow: {
        'telegram': '0 2px 8px rgba(0, 0, 0, 0.04)',
        'telegram-lg': '0 4px 16px rgba(0, 0, 0, 0.06)',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}

