import { additionalLanguages, additionalCopy, additionalTopics, additionalExtras } from './languages-extra.js';

export const LANGUAGES = { en: 'English', bg: 'Български - Bulgarian', fr: 'Français - French', hi: 'हिन्दी - Hindi', ...additionalLanguages };
const copy = {
  ...additionalCopy,
  en: ['Pick a box', 'Categories', 'All categories', 'Search categories…', 'No matching categories.', 'Discoveries', 'CLEARED ON CLOSE', 'Nothing yet. Open a box to start.', 'Close', 'About', 'Sources', 'Privacy', 'Random discovery', 'On this day', 'Science', 'History', 'Space', 'Nature', 'Reveal', 'Open box', 'Loading discovery', 'Opened', 'This box came back empty.', 'The sources did not answer. Please try another box.', 'Try again', 'Source & notices', 'Article history', 'Information', 'Language', 'selected', 'Original image'],
  bg: ['Избери квадрат', 'Категории', 'Всички категории', 'Търси категории…', 'Няма намерени категории.', 'Открития', 'ИЗЧИСТВАТ СЕ ПРИ ЗАТВАРЯНЕ', 'Все още няма открития. Отвори квадрат.', 'Затвори', 'За Foly', 'Източници', 'Поверителност', 'Случайно откритие', 'На този ден', 'Наука', 'История', 'Космос', 'Природа', 'Разкрий', 'Отвори квадрат', 'Зареждане на откритие', 'Отворено', 'Този квадрат се оказа празен.', 'Източниците не отговориха. Опитай друг квадрат.', 'Опитай отново', 'Източник и бележки', 'История на статията', 'Информация', 'Език', 'избрани', 'Оригинално изображение'],
  fr: ['Choisissez une case', 'Catégories', 'Toutes les catégories', 'Rechercher une catégorie…', 'Aucune catégorie trouvée.', 'Découvertes', 'EFFACÉES À LA FERMETURE', 'Rien pour le moment. Ouvrez une case.', 'Fermer', 'À propos', 'Sources', 'Confidentialité', 'Découverte aléatoire', 'Ce jour-là', 'Sciences', 'Histoire', 'Espace', 'Nature', 'Révéler', 'Ouvrir une case', 'Chargement', 'Ouvert', 'Cette case est vide.', 'Les sources ne répondent pas. Essayez une autre case.', 'Réessayer', 'Source et mentions', 'Historique de l’article', 'Informations', 'Langue', 'sélectionnées', 'Image originale'],
  hi: ['एक वर्ग चुनें', 'श्रेणियाँ', 'सभी श्रेणियाँ', 'श्रेणियाँ खोजें…', 'कोई श्रेणी नहीं मिली।', 'खोजें', 'बंद करने पर मिट जाती हैं', 'अभी कुछ नहीं। एक वर्ग खोलें।', 'बंद करें', 'परिचय', 'स्रोत', 'गोपनीयता', 'यादृच्छिक खोज', 'आज के दिन', 'विज्ञान', 'इतिहास', 'अंतरिक्ष', 'प्रकृति', 'दिखाएँ', 'वर्ग खोलें', 'खोज लोड हो रही है', 'खोला गया', 'यह वर्ग खाली है।', 'स्रोत उपलब्ध नहीं हैं। दूसरा वर्ग आज़माएँ।', 'फिर कोशिश करें', 'स्रोत और सूचनाएँ', 'लेख का इतिहास', 'जानकारी', 'भाषा', 'चयनित', 'मूल चित्र'],
};
const keys = ['pick', 'categories', 'all', 'search', 'noCategories', 'discoveries', 'cleared', 'empty', 'close', 'about', 'sources', 'privacy', 'random', 'today', 'science', 'history', 'space', 'nature', 'reveal', 'open', 'loading', 'opened', 'failed', 'failedDetail', 'retry', 'notices', 'articleHistory', 'information', 'language', 'selected', 'originalImage'];
export function normalizeLanguage(value) { return Object.hasOwn(LANGUAGES, value) ? value : 'en'; }
export function currentLanguage() {
  return normalizeLanguage(typeof document === 'undefined' ? 'en' : document.documentElement?.lang);
}
export function t(key, language = currentLanguage()) {
  language = normalizeLanguage(language);
  if (additionalTopics[language]?.[key]) return additionalTopics[language][key];
  if (additionalExtras[key]?.[language]) return additionalExtras[key][language];
  const extra = {
    machineTranslation: { en: 'Machine translation', bg: 'Машинен превод', fr: 'Traduction automatique', hi: 'मशीनी अनुवाद', es: 'Traducción automática', pt: 'Tradução automática', de: 'Maschinelle Übersetzung', zh: '机器翻译', ar: 'ترجمة آلية', ru: 'Машинный перевод' },
    translationFailed: { en: 'Translation unavailable. Original text retained.', bg: 'Преводът не е достъпен. Оригиналният текст е запазен.', fr: 'Traduction indisponible. Texte original conservé.', hi: 'अनुवाद उपलब्ध नहीं है। मूल पाठ सुरक्षित है।', es: 'Traducción no disponible. Se conserva el original.', pt: 'Tradução indisponível. Original preservado.', de: 'Übersetzung nicht verfügbar. Originaltext beibehalten.', zh: '翻译不可用。保留原文。', ar: 'الترجمة غير متاحة. تم الاحتفاظ بالنص الأصلي.', ru: 'Перевод недоступен. Оригинал сохранён.' },
    art: { en: 'Art', bg: 'Изкуство', fr: 'Art', hi: 'कला' },
    architecture: { en: 'Architecture', bg: 'Архитектура', fr: 'Architecture', hi: 'स्थापत्य' },
    music: { en: 'Music', bg: 'Музика', fr: 'Musique', hi: 'संगीत' },
    literature: { en: 'Literature', bg: 'Литература', fr: 'Littérature', hi: 'साहित्य' },
    geography: { en: 'Geography', bg: 'География', fr: 'Géographie', hi: 'भूगोल' },
    technology: { en: 'Technology', bg: 'Технологии', fr: 'Technologie', hi: 'प्रौद्योगिकी' },
    mathematics: { en: 'Mathematics', bg: 'Математика', fr: 'Mathématiques', hi: 'गणित' },
    animals: { en: 'Animals', bg: 'Животни', fr: 'Animaux', hi: 'प्राणी' },
    plants: { en: 'Plants', bg: 'Растения', fr: 'Plantes', hi: 'पादप' },
    sport: { en: 'Sport', bg: 'Спорт', fr: 'Sport', hi: 'खेल' },
    excerptShort: { en: 'Excerpt', bg: 'Откъс', fr: 'Extrait', hi: 'अंश' },
    dyk: { en: 'Did you know?', bg: 'Знаете ли, че…', fr: 'Le saviez-vous ?', hi: 'क्या आप जानते हैं?' },
    unavailable: { en: 'Connection unavailable', bg: 'Няма връзка с източниците', fr: 'Connexion indisponible', hi: 'कनेक्शन उपलब्ध नहीं है' },
  };
  if (extra[key]) return extra[key][language] || extra[key].en;
  if (key === 'excerpt') return { en: 'Wikipedia excerpt. Selected and shortened where needed. Not translated by Foly.', bg: 'Откъс от Wikipedia. Подбран и съкратен при нужда. Без превод от Foly.', fr: 'Extrait de Wikipedia. Sélectionné et raccourci si nécessaire. Sans traduction par Foly.', hi: 'Wikipedia का अंश। चुना गया और आवश्यकतानुसार छोटा किया गया। Foly द्वारा अनुवाद नहीं।' }[normalizeLanguage(language)];
  const index = keys.indexOf(key);
  return index < 0 ? key : copy[normalizeLanguage(language)][index];
}
export { information } from './information.js';
