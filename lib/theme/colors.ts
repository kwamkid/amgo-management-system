// Theme Colors Configuration - Modern Red Theme
export const colors = {
  // Primary Colors - Modern Red Tone (No Pink)
  primary: {
    50: '#fef2f2',
    100: '#fee2e2',
    200: '#fecaca',
    300: '#fca5a5',
    400: '#f87171',
    500: '#ef4444',
    600: '#dc2626',
    700: '#b91c1c',
    800: '#991b1b',
    900: '#7f1d1d',
  },

  // Gray Scale - Neutral with slight warm tone
  gray: {
    50: '#fafafa',
    100: '#f4f4f5',
    200: '#e4e4e7',
    300: '#d4d4d8',
    400: '#a1a1aa',
    500: '#71717a',
    600: '#52525b',
    700: '#3f3f46',
    800: '#27272a',
    900: '#18181b',
  },

  // Success - Modern Teal/Emerald
  success: {
    50: '#f0fdfa',
    100: '#ccfbf1',
    200: '#99f6e4',
    300: '#5eead4',
    400: '#2dd4bf',
    500: '#14b8a6',
    600: '#0d9488',
    700: '#0f766e',
    800: '#115e59',
    900: '#134e4a',
  },

  // Warning - Modern Orange
  warning: {
    50: '#fff7ed',
    100: '#ffedd5',
    200: '#fed7aa',
    300: '#fdba74',
    400: '#fb923c',
    500: '#f97316',
    600: '#ea580c',
    700: '#c2410c',
    800: '#9a3412',
    900: '#7c2d12',
  },

  // Error - Deep Red
  error: {
    50: '#fef2f2',
    100: '#fee2e2',
    200: '#fecaca',
    300: '#fca5a5',
    400: '#f87171',
    500: '#ef4444',
    600: '#dc2626',
    700: '#b91c1c',
    800: '#991b1b',
    900: '#7f1d1d',
  },

  // Info - Modern Blue
  info: {
    50: '#f0f9ff',
    100: '#e0f2fe',
    200: '#bae6fd',
    300: '#7dd3fc',
    400: '#38bdf8',
    500: '#0ea5e9',
    600: '#0284c7',
    700: '#0369a1',
    800: '#075985',
    900: '#0c4a6e',
  },

  // Additional Modern Colors
  purple: {
    50: '#fdf4ff',
    100: '#fae8ff',
    200: '#f5d0fe',
    300: '#f0abfc',
    400: '#e879f9',
    500: '#d946ef',
    600: '#c026d3',
    700: '#a21caf',
    800: '#86198f',
    900: '#701a75',
  },

  pink: {
    50: '#fdf2f8',
    100: '#fce7f3',
    200: '#fbcfe8',
    300: '#f9a8d4',
    400: '#f472b6',
    500: '#ec4899',
    600: '#db2777',
    700: '#be185d',
    800: '#9d174d',
    900: '#831843',
  },

  // Background & Surface Colors
  background: {
    primary: '#ffffff',
    secondary: '#fafafa', // gray-50
    tertiary: '#f4f4f5',  // gray-100
    accent: '#fff1f2',    // primary-50
  },

  // Text Colors
  text: {
    primary: '#18181b',   // gray-900
    secondary: '#52525b', // gray-600
    tertiary: '#a1a1aa',  // gray-400
    inverse: '#ffffff',
    accent: '#dc2626',    // primary-600 (red)
  },

  // Border Colors
  border: {
    primary: '#e4e4e7',   // gray-200
    secondary: '#d4d4d8', // gray-300
    focus: '#ef4444',     // primary-500 (red)
    accent: '#fecaca',    // primary-200 (red)
  },
};

// Semantic Color Mappings
export const semanticColors = {
  // Status Colors
  status: {
    active: colors.success[500],
    inactive: colors.gray[400],
    pending: colors.warning[500],
    error: colors.error[500],
    approved: colors.success[600],
    rejected: colors.error[600],
  },

  // Leave Type Colors
  leaveType: {
    sick: colors.pink[500],
    personal: colors.info[500],
    vacation: colors.success[500],
  },

  // Role Colors
  role: {
    admin: colors.primary[600],
    hr: colors.purple[600],
    manager: colors.warning[600],
    employee: colors.gray[600],
  },
};

// Modern Gradient Presets
export const gradients = {
  // Primary Gradients - Pure Red
  primary: 'from-red-500 to-rose-600',
  primaryLight: 'from-red-50 to-rose-100',
  primarySubtle: 'from-red-100 to-rose-200',
  primaryDark: 'from-red-600 to-red-800',

  // Status Gradients
  success: 'from-teal-500 to-emerald-600',
  successLight: 'from-teal-50 to-emerald-100',
  
  warning: 'from-orange-500 to-amber-600',
  warningLight: 'from-orange-50 to-amber-100',
  
  error: 'from-red-600 to-red-700',
  errorLight: 'from-red-50 to-red-100',
  
  info: 'from-blue-500 to-indigo-600',
  infoLight: 'from-blue-50 to-indigo-100',

  // Neutral Gradients
  gray: 'from-gray-500 to-slate-600',
  grayLight: 'from-gray-50 to-slate-100',

  // Special Modern Gradients
  purple: 'from-purple-500 to-violet-600',
  purpleLight: 'from-purple-50 to-violet-100',
  
  sunset: 'from-orange-400 to-red-600',
  fire: 'from-yellow-400 via-orange-500 to-red-600',
  ruby: 'from-red-500 to-red-700',
  
  // Vibrant Gradients
  vibrant: 'from-red-500 via-rose-500 to-orange-600',
  warm: 'from-orange-400 via-red-500 to-rose-600',
};

// Tailwind Class Helpers
export const colorClasses = {
  // Background Classes
  bg: {
    primary: 'bg-white',
    secondary: 'bg-gray-50',
    tertiary: 'bg-gray-100',
    accent: 'bg-red-50',
    
    primarySolid: 'bg-red-600',
    primaryLight: 'bg-red-50',
    primaryMedium: 'bg-red-100',
    
    success: 'bg-teal-600',
    successLight: 'bg-teal-50',
    
    warning: 'bg-orange-600',
    warningLight: 'bg-orange-50',
    
    error: 'bg-red-600',
    errorLight: 'bg-red-50',
    
    info: 'bg-blue-600',
    infoLight: 'bg-blue-50',
  },

  // Text Classes
  text: {
    primary: 'text-gray-900',
    secondary: 'text-gray-600',
    tertiary: 'text-gray-400',
    inverse: 'text-white',
    accent: 'text-red-600',
    
    success: 'text-teal-600',
    warning: 'text-orange-600',
    error: 'text-red-600',
    info: 'text-blue-600',
  },

  // Border Classes
  border: {
    primary: 'border-gray-200',
    secondary: 'border-gray-300',
    accent: 'border-red-200',
    
    success: 'border-teal-500',
    warning: 'border-orange-500',
    error: 'border-red-500',
    info: 'border-blue-500',
  },

  // Ring Classes for Focus States
  ring: {
    primary: 'ring-red-500',
    success: 'ring-teal-500',
    warning: 'ring-orange-500',
    error: 'ring-red-500',
    info: 'ring-blue-500',
  },

  // Hover Classes
  hover: {
    primary: 'hover:bg-red-700',
    primaryLight: 'hover:bg-red-100',
    success: 'hover:bg-teal-700',
    warning: 'hover:bg-orange-700',
    error: 'hover:bg-red-700',
  },
};

// Shadow Presets - Modern Colored Shadows
export const shadows = {
  primary: 'shadow-red-500/25',
  success: 'shadow-teal-500/25',
  warning: 'shadow-orange-500/25',
  error: 'shadow-red-500/25',
  
  // Elevated shadows
  elevated: {
    sm: 'shadow-sm shadow-gray-200/50',
    md: 'shadow-md shadow-gray-300/30',
    lg: 'shadow-lg shadow-gray-400/25',
    xl: 'shadow-xl shadow-gray-500/20',
  },
};