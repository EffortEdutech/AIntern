/**
 * WorkLedger - Tailwind CSS Configuration (Minimal)
 * 
 * Custom design system with contract-specific colors,
 * status colors, and offline sync indicators.
 * 
 * Minimal plugin setup - only includes what we actually need.
 * 
 * @file tailwind.config.js
 * @created January 25, 2026
 * @updated January 29, 2026 - Minimal plugins only
 */

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Primary brand color
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
          950: '#172554',
        },
        
        // Contract category colors (Malaysian market)
        contract: {
          pmc: '#dbeafe',        // PMC - Preventive Maintenance (blue-100)
          cmc: '#e9d5ff',        // CMC - Comprehensive Maintenance (purple-100)
          amc: '#d1fae5',        // AMC - Annual Maintenance (green-100)
          sla: '#fee2e2',        // SLA - Service Level Agreement (red-100)
          corrective: '#fed7aa', // Corrective Maintenance (orange-100)
          emergency: '#ffe4e6',  // Emergency On-Call (rose-100)
          tm: '#cffafe',         // Time & Material (cyan-100)
          construction: '#fef3c7' // Construction Daily Diary (amber-100)
        },
        
        // Entry status colors
        status: {
          draft: '#f3f4f6',      // gray-100
          submitted: '#dbeafe',  // blue-100
          approved: '#d1fae5',   // green-100
          rejected: '#fee2e2'    // red-100
        },
        
        // Offline sync status colors
        sync: {
          pending: '#fef3c7',    // amber-100
          syncing: '#dbeafe',    // blue-100
          synced: '#d1fae5',     // green-100
          failed: '#fee2e2',     // red-100
          conflict: '#fed7aa'    // orange-100
        }
      },
      
      fontFamily: {
        sans: [
          'Inter',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          '"Helvetica Neue"',
          'Arial',
          'sans-serif',
        ],
      },
      
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        '128': '32rem',
      },
      
      maxWidth: {
        '8xl': '88rem',
        '9xl': '96rem',
      },
      
      zIndex: {
        '60': '60',
        '70': '70',
        '80': '80',
        '90': '90',
        '100': '100',
      },
      
      animation: {
        'spin-slow': 'spin 3s linear infinite',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'bounce-slow': 'bounce 2s infinite',
      },
      
      boxShadow: {
        'soft': '0 2px 15px 0 rgba(0, 0, 0, 0.08)',
        'hard': '0 4px 20px 0 rgba(0, 0, 0, 0.15)',
      },
      
      // Aspect ratio utilities (now built-in since Tailwind v3.15)
      aspectRatio: {
        auto: 'auto',
        square: '1 / 1',
        video: '16 / 9',
        '4/3': '4 / 3',
        '21/9': '21 / 9',
      },
    },
  },
  plugins: [
    // Only include @tailwindcss/forms for better form styling
    // This is essential for login, work entry forms, etc.
    require('@tailwindcss/forms'),
    
    // REMOVED (now built into Tailwind core):
    // - @tailwindcss/line-clamp (built-in since v3.3+)
    // - @tailwindcss/aspect-ratio (built-in since v3.15+)
    
    // OPTIONAL (add later if needed):
    // - @tailwindcss/typography (for rich text / prose styling)
    //   Only needed if we have blog posts or rich text content
    //   To add: npm install @tailwindcss/typography
  ],
}
