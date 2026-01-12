let currentResults = [], activeResultIndex = 0, savedWords = JSON.parse(localStorage.getItem('offline_dictionary') || '[]'), recentSearches = JSON.parse(localStorage.getItem('recent_searches') || '[]'), chatHistory = [], selectedAccent = 'en-US', availableVoices = [], isRecording = false, isInitializing = false, network = null, mediaRecorder = null, recognition = null;

// Concise Language UI Dictionary
const languageUI = {
    'hi': { meanings: 'अर्थ', visual: 'दृश्य संदर्भ', synonyms: 'पर्यायवाची', antonyms: 'विलोम', placeholder: 'अंग्रेजी या हिंदी में शब्द लिखें...', origin: 'शब्द मूल', example: 'उदाहरण', context: 'संदर्भ और उपयोग', imagination: 'AI कल्पना', gallery: 'चित्रदीर्घा', definition: 'परिभाषा', ui: { search: 'खोजें', reader: 'रीडर', map: 'मैप', chat: 'एंडी', saved: 'सहेजे गए', wotd: 'आज का शब्द', dictionary: 'शब्दकोश', title: 'सनातन संग्रहालय', exploreTitle: 'शब्दों की <span class="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-red-600">दुनिया</span> खोजें', savedWordsTitle: 'सहेजे गए शब्द', readerInput: 'रीडर इनपुट', readMode: 'रीड मोड', editText: 'टेक्स्ट संपादित करें', analyze: 'पैराग्राफ विश्लेषण', clickToDefine: 'परिभाषा के लिए किसी भी शब्द पर क्लिक करें', mapPlaceholder: 'संकल्पना मानचित्र बनाने के लिए कोई शब्द खोजें', chatIntro: 'नमस्ते! मैं एंडी हूँ। मुझसे शब्दों, मुहावरों या भाषाओं के बारे में कुछ भी पूछें!', loading: 'लोड हो रहा है...', micProcessing: 'सुन रहा हूँ...', chatPlaceholder: 'एंडी से पूछें...', readerPlaceholder: 'यहाँ टेक्स्ट पेस्ट करें...' } },
    'bn': { meanings: 'অর্থ', visual: 'দৃশ্য প্রেক্ষাপট', synonyms: 'সমার্থক শব্দ', antonyms: 'বিপরীত শব্দ', placeholder: 'ইংরেজি বা বাংলায় শব্দ টাইপ করুন...', ui: { search: 'অনুসন্ধান', reader: 'রিডার', map: 'মানচিত্র', chat: 'অ্যান্ডি', saved: 'সংরক্ষিত', wotd: 'আজকের শব্দ', dictionary: 'অভিধান', title: 'सनातन संग्रहालय', exploreTitle: 'শব্দের <span class="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-red-600">মহাবিশ্ব</span> অন্বেষণ করুন', savedWordsTitle: 'সংরক্ষিত শব্দ', readerInput: 'রিডার ইনপুট', readMode: 'রিড মোড', editText: 'টেক্সট সম্পাদনা', analyze: 'অনুচ্ছেদ বিশ্লেষণ', clickToDefine: 'সংজ্ঞা জানতে যেকোনো শব্দে ক্লিক করুন', mapPlaceholder: 'ধারণা মানচিত্র তৈরি করতে একটি শব্দ অনুসন্ধান করুন', chatIntro: 'হাই! আমি অ্যান্ডি। আমাকে শব্দ, বাগধারা বা ভাষা সম্পর্কে কিছু জিজ্ঞাসা করুন!', loading: 'লোড হচ্ছে...', micProcessing: 'শুনছি...', chatPlaceholder: 'অ্যান্ডিকে জিজ্ঞাসা করুন...', readerPlaceholder: 'এখানে টেক্সট পেস্ট করুন...' } },
    'es': { meanings: 'Significados', visual: 'Contexto Visual', synonyms: 'Sinónimos', antonyms: 'Antónimos', placeholder: 'Escribe en inglés o español...', ui: { search: 'Buscar', reader: 'Lector', map: 'Mapa', chat: 'Andy', saved: 'Guardado', wotd: 'Palabra del Día', dictionary: 'Diccionario', title: 'सनातन संग्रहालय', exploreTitle: 'Explora el <span class="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-red-600">Universo</span> de las Palabras', savedWordsTitle: 'Palabras Guardadas', readerInput: 'Entrada del Lector', readMode: 'Modo Lectura', editText: 'Editar Texto', analyze: 'Analizar Párrafo', clickToDefine: 'Haz clic en cualquier palabra para definirla', mapPlaceholder: 'Busca una palabra para generar su mapa conceptual', chatIntro: '¡Hola! Soy Andy. ¡Pregúntame cualquier cosa sobre palabras, modismos o idiomas!', loading: 'Cargando...', micProcessing: 'Escuchando...', chatPlaceholder: 'Pregúntale a Andy...', readerPlaceholder: 'Pega el texto aquí...' } }
};

const langCodeMap = { 'Hindi': 'hi', 'Marathi': 'mr', 'Bengali': 'bn', 'Telugu': 'te', 'Tamil': 'ta', 'Gujarati': 'gu', 'Urdu': 'ur', 'Kannada': 'kn', 'Malayalam': 'ml', 'Punjabi': 'pa', 'Spanish': 'es', 'French': 'fr', 'German': 'de', 'Italian': 'it', 'Portuguese': 'pt', 'Russian': 'ru', 'Japanese': 'ja', 'Chinese (Simplified)': 'zh-cn', 'Arabic': 'ar', 'Turkish': 'tr', 'Thai': 'th', 'Dutch': 'nl', 'Korean': 'ko', 'Indonesian': 'id' };

const getEl = (id) => document.getElementById(id);
const querySel = (sel) => document.querySelector(sel);
const apiCall = async (endpoint, body) => (await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).json();

document.addEventListener('DOMContentLoaded', () => {
    if (typeof lucide !== 'undefined') lucide.createIcons();
    loadVoices(); renderOfflineLib(); injectChatFeatures(); injectClearButton(); injectWotdButton();
    const langSelect = getEl('language-selector');
    if (langSelect.value && langSelect.value !== 'English') translateUI(langCodeMap[langSelect.value]);

    langSelect.addEventListener('change', (e) => {
        const code = langCodeMap[e.target.value];
        const ui = languageUI[code];
        getEl('search-input').placeholder = ui ? ui.placeholder : "Enter word(s) e.g. 'sun, moon'...";
        translateUI(code || 'en');
        if (getEl('search-input').value.trim()) handleSearch();
    });

    getEl('search-input').addEventListener('input', (e) => getEl('clear-search-btn').style.display = e.target.value.trim() ? 'block' : 'none');
    if (localStorage.getItem('theme') === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) document.documentElement.classList.add('dark');
});

function loadVoices() { availableVoices = window.speechSynthesis.getVoices(); window.speechSynthesis.onvoiceschanged = () => availableVoices = window.speechSynthesis.getVoices(); }
function updateAccent() { selectedAccent = getEl('accent-selector').value; }
function toggleTheme() { document.documentElement.classList.toggle('dark'); localStorage.setItem('theme', document.documentElement.classList.contains('dark') ? 'dark' : 'light'); }

function switchMode(mode) {
    document.querySelectorAll('.mode-btn').forEach(btn => btn.classList.remove('active'));
    if (mode === 'wotd') { getEl('btn-mode-search').classList.add('active'); handleWotd(); mode = 'search'; }
    else getEl(`btn-mode-${mode}`).classList.add('active');
    
    document.querySelectorAll('.view-section').forEach(view => view.classList.add('hidden'));
    getEl(`view-${mode}`).classList.remove('hidden');
    if(mode === 'offline') renderOfflineLib();
    if(mode === 'map' && currentResults.length > 0) setTimeout(() => renderConceptMap(currentResults[activeResultIndex]), 50);
}

async function handleWotd() {
    getEl('loading-indicator').classList.remove('hidden'); getEl('search-results').classList.add('hidden');
    try {
        const lang = getEl('language-selector').value;
        const theme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
        const res = await fetch(`/api/wotd?language=${lang}&theme=${theme}`);
        const data = await res.json();
        
        currentResults = data.results; activeResultIndex = 0;
        
        if(currentResults.length > 0) {
            getEl('search-input').value = currentResults[0].word;
            getEl('clear-search-btn').style.display = 'block';
            
            const tabs = getEl('tabs-container');
            if (currentResults.length > 1) {
                tabs.innerHTML = currentResults.map((r, i) => `<button onclick="setActiveResult(${i})" class="tab-btn ${i === 0 ? 'active' : ''} px-5 py-2 rounded-full text-sm font-bold transition-all whitespace-nowrap border border-transparent ${i === 0 ? 'bg-orange-600 text-white shadow-md' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:border-orange-200'}">${r.word}</button>`).join('');
                getEl('results-tabs').classList.remove('hidden');
            } else { getEl('results-tabs').classList.add('hidden'); }
            
            addToRecent(currentResults[0].word);
            getEl('search-results').innerHTML = localizeHtml(currentResults[0].html, lang);
        }
        updateSaveIcons(); makeInteractive('search-results'); if (typeof lucide !== 'undefined') lucide.createIcons();
    } catch(e) { console.error(e); alert("Error fetching Word of the Day"); }
    finally { getEl('loading-indicator').classList.add('hidden'); getEl('search-results').classList.remove('hidden'); }
}

function translateUI(langCode) {
    const uiData = languageUI[langCode]?.ui;
    const setHtml = (id, html) => { const el = getEl(id); if(el && html) el.innerHTML = html; };
    const setText = (id, text) => { const el = getEl(id); if(el && text) el.innerText = text; };
    
    const defaults = { search: 'Search', reader: 'Reader', map: 'Map', chat: 'Andy', saved: 'Saved', wotd: 'Daily Word', exploreTitle: 'Explore the <span class="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-red-600">Universe</span> of Words', savedWordsTitle: 'Saved Words', readerInputTitle: 'Reader Input', readerModeBtn: 'Read Mode', analyzeBtn: 'Analyze Paragraph', readerPlaceholder: 'Click any word to define.', mapPlaceholderText: 'Search for a word to generate its concept map.', chatIntro: "Hi! I'm Andy. Ask me anything about words, idioms, or languages!", loading: 'Loading...', chatPlaceholder: 'Ask Andy...', readerPlaceholder: 'Paste text here...', dictionary: 'Dictionary', title: 'Sanatan Sangrahalaya' };
    const d = (langCode === 'en' || !uiData) ? defaults : uiData;

    const icons = { search: 'search', reader: 'book-open', map: 'network', chat: 'message-square', saved: 'wifi-off', wotd: 'calendar' };
    Object.keys(icons).forEach(k => {
        const el = k === 'wotd' ? getEl('btn-mode-wotd') : getEl(`btn-mode-${k}`);
        if(el) el.innerHTML = `<i data-lucide="${icons[k]}" class="w-4 h-4"></i> ${d[k]}`;
    });

    if(d.exploreTitle) querySel('#view-search h2').innerHTML = d.exploreTitle;
    if(d.savedWordsTitle) querySel('#view-offline h2').innerText = d.savedWordsTitle;
    if(d.readerInput) querySel('#view-reader h3').innerHTML = `<i data-lucide="book-open" class="w-4 h-4 text-orange-500"></i> ${d.readerInput || defaults.readerInputTitle}`;
    
    setText('reader-mode-btn', d.readMode || defaults.readerModeBtn);
    const anBtn = querySel('button[onclick="analyzeReaderParagraph()"]'); if(anBtn) anBtn.innerText = d.analyze || defaults.analyzeBtn;
    const rP = querySel('#reader-definition-card p'); if(rP) rP.innerText = d.clickToDefine || defaults.readerPlaceholder;
    const mP = querySel('#map-placeholder p'); if(mP) mP.innerText = d.mapPlaceholder || defaults.mapPlaceholderText;
    
    const chatIntro = querySel('#chat-history > div > div:last-child');
    if(chatIntro && getEl('chat-history').children.length <= 1) chatIntro.innerText = d.chatIntro || defaults.chatIntro;

    getEl('chat-input').placeholder = d.chatPlaceholder || defaults.chatPlaceholder;
    getEl('reader-input').placeholder = d.readerPlaceholder || defaults.readerPlaceholder;
    const loadP = querySel('#loading-indicator p'); if(loadP) loadP.innerText = d.loading || defaults.loading;

    const navTitle = querySel('nav h1');
    if(navTitle) {
        navTitle.innerHTML = `<span class="text-orange-600">Sanatan Sangrahalaya</span>`;
    }
    
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function injectChatFeatures() {
    const form = querySel('form[onsubmit="handleChat(event)"]');
    if (form && !getEl('chat-mic-btn')) {
        const inp = form.querySelector('input');
        if(inp) {
            inp.classList.add('pr-20'); inp.classList.remove('pr-12');
            const btn = document.createElement('button');
            btn.id = 'chat-mic-btn'; btn.className = 'absolute right-10 top-2 p-2 text-slate-400 hover:text-orange-600 rounded-full transition-colors';
            btn.innerHTML = '<i data-lucide="mic" class="w-5 h-5"></i>'; btn.onclick = () => handleVoice('chat');
            form.appendChild(btn);
            if (typeof lucide !== 'undefined') lucide.createIcons();
        }
    }
}

function injectClearButton() {
    const searchInput = getEl('search-input');
    if (searchInput && !getEl('clear-search-btn')) {
        const container = searchInput.parentElement.querySelector('.flex.items-center.gap-1.pr-2');
        if (container) {
            const clearBtn = document.createElement('button');
            clearBtn.id = 'clear-search-btn';
            clearBtn.className = 'p-3 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-colors hidden';
            clearBtn.innerHTML = '<i data-lucide="x" class="w-5 h-5"></i>';
            clearBtn.onclick = () => { searchInput.value = ''; clearBtn.style.display = 'none'; searchInput.focus(); };
            container.insertBefore(clearBtn, container.firstChild);
            if (typeof lucide !== 'undefined') lucide.createIcons();
        }
    }
}

function injectWotdButton() {
    if (getEl('btn-mode-wotd')) return;
    const container = document.querySelector('.flex.items-center.gap-2.bg-slate-100');
    if (container) {
        const wotdBtn = document.createElement('button'); wotdBtn.id = 'btn-mode-wotd'; wotdBtn.onclick = () => switchMode('wotd');
        wotdBtn.className = 'mode-btn px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2';
        wotdBtn.innerHTML = '<i data-lucide="calendar" class="w-4 h-4"></i> Daily Word';
        const offlineBtn = getEl('btn-mode-offline'); offlineBtn ? container.insertBefore(wotdBtn, offlineBtn) : container.appendChild(wotdBtn);
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }
}

function addToRecent(word) {
    const idx = recentSearches.indexOf(word); if (idx > -1) recentSearches.splice(idx, 1);
    recentSearches.unshift(word); if (recentSearches.length > 20) recentSearches.pop();
    localStorage.setItem('recent_searches', JSON.stringify(recentSearches));
}

function localizeHtml(html, langName) {
    const code = langCodeMap[langName]; if (!code || !languageUI[code]) return html;
    const dict = languageUI[code]; const div = document.createElement('div'); div.innerHTML = html;

    if (langName !== 'English') {
        const h3s = Array.from(div.querySelectorAll('h3'));
        const enH = h3s.find(h => h.innerText.includes('Definition (English)'));
        const trH = h3s.find(h => h.innerText.includes(`Definition (${langName})`));
        if (enH && trH) { const enC = enH.parentElement; const trC = trH.parentElement; const t = enC.innerHTML; enC.innerHTML = trC.innerHTML; trC.innerHTML = t; }
    }

    let processed = div.innerHTML;
    ['origin', 'example', 'context', 'imagination', 'gallery'].forEach(k => { if(dict[k]) processed = processed.replace(new RegExp(`>${k.charAt(0).toUpperCase() + k.slice(1)}<`, 'g'), `>${dict[k]}<`).replace(new RegExp(`>${k.charAt(0).toUpperCase() + k.slice(1)} &`, 'g'), `>${dict[k]} &`); });
    if (dict.definition) processed = processed.replace(/>Definition \(/g, `>${dict.definition} (`);
    return processed;
}

async function handleSearch() {
    const inp = getEl('search-input').value; const lang = getEl('language-selector').value;
    if (!inp.trim()) return;
    
    getEl('loading-indicator').classList.remove('hidden'); getEl('search-results').classList.add('hidden');
    
    try {
        const offline = savedWords.find(w => w.word.toLowerCase() === inp.toLowerCase());
        if (!navigator.onLine && offline) {
            currentResults = [offline]; activeResultIndex = 0; addToRecent(offline.word);
            getEl('search-results').innerHTML = localizeHtml(offline.html || "<p>Offline view.</p>", lang);
        } else {
            // UPDATED ENDPOINT HERE: /api/dictionary -> /api/search
            const data = await apiCall('/api/search', { term: inp, language: lang, theme: document.documentElement.classList.contains('dark') ? 'dark' : 'light' });
            currentResults = data.results; activeResultIndex = 0;
            const tabs = getEl('tabs-container');
            if (currentResults.length > 1) {
                tabs.innerHTML = currentResults.map((r, i) => `<button onclick="setActiveResult(${i})" class="tab-btn ${i === 0 ? 'active' : ''} px-5 py-2 rounded-full text-sm font-bold transition-all whitespace-nowrap border border-transparent ${i === 0 ? 'bg-orange-600 text-white shadow-md' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:border-orange-200'}">${r.word}</button>`).join('');
                getEl('results-tabs').classList.remove('hidden');
            } else { getEl('results-tabs').classList.add('hidden'); }
            if (currentResults.length > 0) addToRecent(currentResults[0].word);
            getEl('search-results').innerHTML = localizeHtml(currentResults[0].html, lang);
        }
        updateSaveIcons(); makeInteractive('search-results'); if (typeof lucide !== 'undefined') lucide.createIcons();
    } catch (e) { alert("Error fetching data."); }
    finally { getEl('loading-indicator').classList.add('hidden'); getEl('search-results').classList.remove('hidden'); }
}

function setActiveResult(index) {
    activeResultIndex = index; const lang = getEl('language-selector').value;
    document.querySelectorAll('.tab-btn').forEach((btn, i) => {
        btn.className = `tab-btn px-5 py-2 rounded-full text-sm font-bold transition-all whitespace-nowrap border border-transparent ${i === index ? 'active bg-orange-600 text-white shadow-md' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:border-orange-200'}`;
    });
    getEl('search-results').innerHTML = localizeHtml(currentResults[index].html, lang);
    updateSaveIcons(); makeInteractive('search-results'); if (typeof lucide !== 'undefined') lucide.createIcons();
    if (!getEl('view-map').classList.contains('hidden')) renderConceptMap(currentResults[index]);
}

async function pronounceWord(btn, word) { 
    if (btn) { var original = btn.innerHTML; btn.innerHTML = `<i data-lucide="loader-2" class="w-5 h-5 animate-spin"></i>`; if (typeof lucide !== 'undefined') lucide.createIcons(); }
    try {
        const blob = await (await fetch('/api/pronounce', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ word: word, accent: selectedAccent }) })).blob();
        new Audio(URL.createObjectURL(blob)).play();
    } catch(e) { nativeSpeak(word); }
    finally { if (btn) { setTimeout(() => { btn.innerHTML = original; if (typeof lucide !== 'undefined') lucide.createIcons(); }, 1000); } }
}

async function speakText(btn, text) {
    if (btn) { var original = btn.innerHTML; btn.innerHTML = `<i data-lucide="loader-2" class="w-3 h-3 animate-spin"></i>`; if (typeof lucide !== 'undefined') lucide.createIcons(); }
    try {
        const blob = await (await fetch('/api/tts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: text, accent: selectedAccent }) })).blob();
        new Audio(URL.createObjectURL(blob)).play();
    } catch(e) { nativeSpeak(text); }
    finally { if (btn) { setTimeout(() => { btn.innerHTML = original; if (typeof lucide !== 'undefined') lucide.createIcons(); }, 1000); } }
}

async function playChatAudio(btn, text) { if (typeof btn === 'string') { text = btn; btn = null; } speakText(btn, text); }

function nativeSpeak(text) {
    window.speechSynthesis.cancel(); const utt = new SpeechSynthesisUtterance(text);
    const voice = availableVoices.find(v => v.lang.startsWith(selectedAccent.split('-')[0]));
    if (voice) utt.voice = voice; window.speechSynthesis.speak(utt);
}

async function handleChat(e) {
    e.preventDefault(); const msg = getEl('chat-input').value; if (!msg.trim()) return;
    const con = getEl('chat-history');
    con.innerHTML += `<div class="flex justify-end mb-4"><div class="bg-orange-600 text-white px-5 py-3 rounded-2xl rounded-tr-none max-w-[80%] shadow-md">${msg}</div></div>`;
    chatHistory.push({ role: 'user', text: msg }); getEl('chat-input').value = '';
    const lid = 'load-'+Date.now();
    con.innerHTML += `<div id="${lid}" class="flex gap-3 mb-4"><div class="w-8 h-8 rounded-full bg-orange-100 dark:bg-slate-800 flex items-center justify-center text-orange-600"><i data-lucide="ghost" class="w-5 h-5 animate-pulse"></i></div><div class="bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl rounded-tl-none text-slate-500">Thinking...</div></div>`;
    if (typeof lucide !== 'undefined') lucide.createIcons();
    try {
        const data = await apiCall('/api/chat', { message: msg, history: chatHistory });
        getEl(lid).remove(); chatHistory.push({ role: 'assistant', text: data.response });
        con.insertAdjacentHTML('beforeend', data.html); makeInteractive('chat-history');
        if (typeof lucide !== 'undefined') lucide.createIcons(); con.scrollTop = con.scrollHeight;
    } catch(e) { console.error(e); }
}

async function handleVoice(mode) {
    const btn = getEl(mode === 'chat' ? 'chat-mic-btn' : 'mic-btn');
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) { alert("Your browser does not support voice search. Please try Chrome or Edge."); return; }

    if (isRecording) { if (recognition) recognition.stop(); isRecording = false; btn.classList.remove('text-red-500', 'bg-red-50'); return; }
    isRecording = true; btn.classList.add('text-red-500', 'bg-red-50');

    recognition = new SpeechRecognition();
    recognition.lang = selectedAccent === 'en-IN' ? 'en-IN' : 'en-US';
    recognition.interimResults = false; recognition.maxAlternatives = 1;

    const inp = getEl(mode === 'chat' ? 'chat-input' : 'search-input');
    const oldP = inp.placeholder; inp.placeholder = "Listening...";

    recognition.onresult = (e) => {
        const transcript = e.results[0][0].transcript;
        if (transcript) { inp.value = transcript; if (mode === 'search') getEl('clear-search-btn').style.display = 'block'; }
    };
    recognition.onerror = (e) => { console.error(e); alert("Voice error: " + e.error); isRecording = false; btn.classList.remove('text-red-500', 'bg-red-50'); inp.placeholder = oldP; };
    recognition.onend = () => { isRecording = false; btn.classList.remove('text-red-500', 'bg-red-50'); inp.placeholder = oldP; };
    recognition.start();
}

function toggleVoiceSearch() { handleVoice('search'); }
function toggleChatVoice() { handleVoice('chat'); }

async function analyzeReaderParagraph() {
    const text = getEl('reader-input').value; if (!text.trim()) return;
    const card = getEl('reader-definition-card'); card.innerHTML = '<div class="flex justify-center mt-10"><i data-lucide="loader-2" class="animate-spin text-orange-600"></i></div>';
    if (typeof lucide !== 'undefined') lucide.createIcons();
    try {
        const data = await apiCall('/api/analyze', { text: text, language: getEl('language-selector').value });
        card.innerHTML = `<div class="flex flex-col h-full"><h3 class="text-xl font-bold dark:text-white mb-4 sticky top-0 bg-white dark:bg-slate-900 py-2 border-b border-slate-100 dark:border-slate-800">Text Analysis</h3><div class="overflow-y-auto scrollbar-thin flex-1 pr-2" id="analysis-content">${data.html}</div><button onclick="resetReaderCard()" class="text-orange-600 text-sm font-bold flex items-center gap-1 hover:underline mt-auto pt-4 border-t border-slate-100 dark:border-slate-800">Back <i data-lucide="arrow-left" class="w-3 h-3"></i></button></div>`;
        makeInteractive('analysis-content'); if (typeof lucide !== 'undefined') lucide.createIcons();
    } catch (e) { card.innerHTML = '<p class="text-center mt-10 text-slate-400">Analysis failed.</p>'; }
}

async function fixGrammar() {
    const text = getEl('reader-input').value; if (!text.trim()) return;
    const card = getEl('reader-definition-card'); card.innerHTML = '<div class="flex justify-center mt-10"><i data-lucide="loader-2" class="animate-spin text-orange-600"></i></div>';
    if (typeof lucide !== 'undefined') lucide.createIcons();
    try {
        const data = await apiCall('/api/fix_grammar', { text: text });
        const safeText = data.corrected_text.replace(/'/g, "\\'").replace(/"/g, '&quot;');
        card.innerHTML = `<div class="flex flex-col h-full"><h3 class="text-xl font-bold dark:text-white mb-4 sticky top-0 bg-white dark:bg-slate-900 py-2 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2"><i data-lucide="check-circle-2" class="w-5 h-5 text-emerald-500"></i> Grammar Check</h3><div class="overflow-y-auto scrollbar-thin flex-1 pr-2"><p class="text-lg text-slate-800 dark:text-slate-200 leading-relaxed font-medium bg-emerald-50 dark:bg-emerald-900/10 p-4 rounded-xl border border-emerald-100 dark:border-emerald-900/30">${data.corrected_text}</p></div><div class="mt-auto pt-4 border-t border-slate-100 dark:border-slate-800 flex gap-3"><button onclick="applyGrammarFix('${safeText}')" class="flex-1 bg-emerald-600 text-white py-2 rounded-xl font-bold hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-600/20">Apply Fix</button><button onclick="resetReaderCard()" class="px-4 py-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl font-medium transition-colors">Cancel</button></div></div>`;
        if (typeof lucide !== 'undefined') lucide.createIcons();
    } catch (e) { card.innerHTML = '<div class="text-center mt-10"><p class="text-slate-400 mb-4">Grammar check failed.</p><button onclick="resetReaderCard()" class="text-orange-600 font-bold hover:underline">Back</button></div>'; }
}

function applyGrammarFix(text) { getEl('reader-input').value = text; resetReaderCard(); }

async function toggleReaderMode() {
    const input = getEl('reader-input'), display = getEl('reader-display'), btn = getEl('reader-mode-btn');
    if (input.classList.contains('hidden')) { input.classList.remove('hidden'); display.classList.add('hidden'); btn.textContent = "Read Mode"; } 
    else {
        const text = input.value; if (!text.trim()) return;
        try {
            const data = await apiCall('/api/reader_format', { text: text });
            display.innerHTML = data.html; input.classList.add('hidden'); display.classList.remove('hidden'); btn.textContent = "Edit Text"; resetReaderCard();
        } catch(e) { console.error("Format error", e); }
    }
}

function resetReaderCard() {
    getEl('reader-definition-card').innerHTML = `<div class="text-center mt-10"><i data-lucide="book-open-text" class="w-12 h-12 mx-auto text-slate-300 mb-2"></i><p class="text-slate-400 text-sm mb-4">Click any word to define.</p><button onclick="analyzeReaderParagraph()" class="px-4 py-2 bg-orange-100 dark:bg-slate-800 text-orange-700 dark:text-orange-400 rounded-lg text-sm font-bold hover:bg-orange-200 transition-colors">Analyze Paragraph</button></div>`;
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

async function defineWord(word) { getEl('search-input').value = word.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g,""); getEl('clear-search-btn').style.display = 'block'; handleSearch(); switchMode('search'); }
function speakReaderText() { speakText(null, getEl('reader-input').value); }

function renderConceptMap(data) {
    if (!data || !data.graph) return;
    getEl('map-placeholder').classList.add('hidden');
    const nodes = data.graph.nodes.filter(n => n.group !== 'related').map(n => ({ id: n.id, label: n.label, color: { background: n.group === 'main' ? '#ea580c' : (n.group === 'synonym' ? '#10b981' : '#ef4444'), border: n.group === 'main' ? '#ea580c' : (n.group === 'synonym' ? '#10b981' : '#ef4444') }, font: { color: 'white', size: n.group === 'main' ? 24 : 16 }, shape: n.group === 'main' ? 'box' : 'dot', margin: 10 }));
    const edges = data.graph.edges.filter(e => { const ids = new Set(nodes.map(n => n.id)); return ids.has(e.from) && ids.has(e.to); }).map(e => ({ from: e.from, to: e.to, color: { color: document.documentElement.classList.contains('dark') ? '#475569' : '#cbd5e1' }, dashes: e.dashes }));
    if (typeof vis !== 'undefined') {
        if (network) network.destroy();
        network = new vis.Network(getEl('concept-network'), { nodes: new vis.DataSet(nodes), edges: new vis.DataSet(edges) }, { physics: { stabilization: false, barnesHut: { gravitationalConstant: -3000 } } });
        network.on("click", p => { if (p.nodes.length > 0) pronounceWord(null, nodes.find(n => n.id === p.nodes[0]).label); });
        network.on("doubleClick", p => { if (p.nodes.length > 0) defineWord(nodes.find(n => n.id === p.nodes[0]).label); });
    }
}

function makeInteractive(id) {
    const el = getEl(id); if (!el) return;
    el.querySelectorAll('.interactive-text').forEach(e => e.innerHTML = e.innerText.split(/(\s+)/).map(p => { const c = p.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"']/g, ""); return c ? `<span class="cursor-pointer hover:bg-orange-100 dark:hover:bg-orange-900/50 rounded transition-colors" onclick="defineWord('${c}')">${p}</span>` : p; }).join(''));
}

function updateSaveIcons() {
    document.querySelectorAll('.save-btn').forEach(btn => {
        const exists = savedWords.some(w => w.word === btn.getAttribute('data-word'));
        btn.innerHTML = `<i data-lucide="${exists ? 'check' : 'download'}" class="w-5 h-5"></i>`;
        btn.classList.toggle('text-emerald-600', exists); btn.classList.toggle('text-slate-400', !exists);
    });
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function toggleSave(btn, word) {
    const idx = savedWords.findIndex(w => w.word === word);
    if (idx !== -1) { savedWords.splice(idx, 1); if(!getEl('view-offline').classList.contains('hidden')) renderOfflineLib(); } 
    else { const d = currentResults.find(r => r.word === word); if (d) savedWords.push({ ...d, savedAt: Date.now() }); }
    localStorage.setItem('offline_dictionary', JSON.stringify(savedWords)); updateSaveIcons();
}

function renderOfflineLib() {
    const grid = getEl('offline-grid');
    if (savedWords.length === 0) { grid.innerHTML = '<div class="col-span-3 text-center py-20 bg-orange-50 dark:bg-slate-900 rounded-3xl border-2 border-dashed border-orange-200"><i data-lucide="download" class="w-12 h-12 mx-auto text-slate-300 mb-4"></i><p class="text-slate-500">Empty.</p></div>'; if (typeof lucide !== 'undefined') lucide.createIcons(); return; }
    grid.innerHTML = savedWords.map(w => `<div onclick="loadSavedWord('${w.word.replace("'", "\\'")}')" class="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-lg border border-slate-100 dark:border-slate-800 cursor-pointer hover:border-orange-300 transition-colors group relative"><button onclick="event.stopPropagation(); toggleSave(null, '${w.word.replace("'", "\\'")}');" class="absolute top-4 right-4 opacity-0 group-hover:opacity-100 p-2 hover:bg-red-50 text-slate-300 hover:text-red-500 rounded"><i data-lucide="trash-2" class="w-4 h-4"></i></button><h3 class="text-xl font-bold dark:text-white mb-2">${w.word}</h3><p class="text-sm text-slate-500 line-clamp-2">${w.definition}</p></div>`).join('');
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function loadSavedWord(word) {
    const wData = savedWords.find(w => w.word === word);
    if (wData) { currentResults = [wData]; addToRecent(wData.word); switchMode('search'); getEl('search-results').innerHTML = wData.html; updateSaveIcons(); if (typeof lucide !== 'undefined') lucide.createIcons(); }
}
