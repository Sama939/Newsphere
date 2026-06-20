export const CITIES = [
  // East Asia
  { name: '北京',         nameEn: 'Beijing',        lat: 39.9,   lng: 116.4,   tz: 'Asia/Shanghai' },
  { name: '东京',         nameEn: 'Tokyo',           lat: 35.7,   lng: 139.7,   tz: 'Asia/Tokyo' },
  { name: '首尔',         nameEn: 'Seoul',           lat: 37.6,   lng: 127.0,   tz: 'Asia/Seoul' },
  // South / SE Asia
  { name: '新加坡',       nameEn: 'Singapore',       lat: 1.35,   lng: 103.8,   tz: 'Asia/Singapore' },
  { name: '曼谷',         nameEn: 'Bangkok',         lat: 13.75,  lng: 100.5,   tz: 'Asia/Bangkok' },
  { name: '孟买',         nameEn: 'Mumbai',          lat: 19.08,  lng: 72.88,   tz: 'Asia/Kolkata' },
  { name: '卡拉奇',       nameEn: 'Karachi',         lat: 24.86,  lng: 67.01,   tz: 'Asia/Karachi' },
  // Middle East / Central
  { name: '迪拜',         nameEn: 'Dubai',           lat: 25.2,   lng: 55.3,    tz: 'Asia/Dubai' },
  { name: '伊斯坦布尔',   nameEn: 'Istanbul',        lat: 41.01,  lng: 28.97,   tz: 'Europe/Istanbul' },
  // Europe
  { name: '莫斯科',       nameEn: 'Moscow',          lat: 55.75,  lng: 37.6,    tz: 'Europe/Moscow' },
  { name: '伦敦',         nameEn: 'London',          lat: 51.5,   lng: -0.12,   tz: 'Europe/London' },
  { name: '巴黎',         nameEn: 'Paris',           lat: 48.85,  lng: 2.35,    tz: 'Europe/Paris' },
  // Africa
  { name: '开罗',         nameEn: 'Cairo',           lat: 30.05,  lng: 31.25,   tz: 'Africa/Cairo' },
  { name: '拉各斯',       nameEn: 'Lagos',           lat: 6.45,   lng: 3.4,     tz: 'Africa/Lagos' },
  { name: '约翰内斯堡',   nameEn: 'Johannesburg',    lat: -26.2,  lng: 28.04,   tz: 'Africa/Johannesburg' },
  // Americas
  { name: '纽约',         nameEn: 'New York',        lat: 40.7,   lng: -74.0,   tz: 'America/New_York' },
  { name: '芝加哥',       nameEn: 'Chicago',         lat: 41.85,  lng: -87.65,  tz: 'America/Chicago' },
  { name: '丹佛',         nameEn: 'Denver',          lat: 39.74,  lng: -104.98, tz: 'America/Denver' },
  { name: '洛杉矶',       nameEn: 'Los Angeles',     lat: 34.05,  lng: -118.24, tz: 'America/Los_Angeles' },
  { name: '墨西哥城',     nameEn: 'Mexico City',     lat: 19.43,  lng: -99.13,  tz: 'America/Mexico_City' },
  { name: '圣保罗',       nameEn: 'São Paulo',       lat: -23.55, lng: -46.63,  tz: 'America/Sao_Paulo' },
  { name: '布宜诺斯艾利斯', nameEn: 'Buenos Aires',  lat: -34.6,  lng: -58.38,  tz: 'America/Argentina/Buenos_Aires' },
  // Pacific
  { name: '悉尼',         nameEn: 'Sydney',          lat: -33.87, lng: 151.2,   tz: 'Australia/Sydney' },
  { name: '奥克兰',       nameEn: 'Auckland',        lat: -36.86, lng: 174.77,  tz: 'Pacific/Auckland' },
  { name: '火奴鲁鲁',     nameEn: 'Honolulu',        lat: 21.31,  lng: -157.86, tz: 'Pacific/Honolulu' },
]

// Default selection – covers major timezone bands without cluttering the globe.
export const DEFAULT_CITY_NAMES = [
  '北京', '东京', '新加坡', '迪拜', '莫斯科', '伦敦', '纽约', '洛杉矶', '悉尼',
]
