const { TRANSLATIONS } = require('./client/src/i18n/translations.jsx');

console.log('Keys in ENG:', Object.keys(TRANSLATIONS.eng).length);
console.log('Keys in KINY:', Object.keys(TRANSLATIONS.kiny).length);

function compareObjects(obj1, obj2, path = '') {
    const keys1 = Object.keys(obj1);
    const keys2 = Object.keys(obj2);
    
    keys1.forEach(key => {
        if (!keys2.includes(key)) {
            console.log(`Missing key in KINY: ${path}${key}`);
        } else if (typeof obj1[key] === 'object' && obj1[key] !== null) {
            compareObjects(obj1[key], obj2[key], `${path}${key}.`);
        }
    });
}

compareObjects(TRANSLATIONS.eng, TRANSLATIONS.kiny);
