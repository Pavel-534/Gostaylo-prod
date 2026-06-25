import path from 'node:path'

export const SW_TEMPLATE_PATH = path.join(process.cwd(), 'src', 'pwa', 'sw.template.js')
export const SW_OUTPUT_PATH = path.join(process.cwd(), 'public', 'sw.js')
export const CACHE_NAME_PLACEHOLDER = '__AIRENTO_SW_CACHE_NAME__'
