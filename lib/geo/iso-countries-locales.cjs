/**
 * CJS bridge so Node tests and Next can load i18n-iso-countries locale JSON.
 */
module.exports = {
  en: require('i18n-iso-countries/langs/en.json'),
  ru: require('i18n-iso-countries/langs/ru.json'),
  zh: require('i18n-iso-countries/langs/zh.json'),
}
