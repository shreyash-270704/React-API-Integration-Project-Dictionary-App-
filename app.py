from flask import Flask, render_template, request, jsonify, Response
import requests
import json
from openai import OpenAI
import re
import asyncio
import edge_tts
import langid
from gtts import gTTS
import io
import random
import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Handle optional dependencies for speech recognition to prevent app crash
try:
    import speech_recognition as sr
    from pydub import AudioSegment
    SPEECH_RECOGNITION_AVAILABLE = True
except ImportError:
    sr = None
    AudioSegment = None
    SPEECH_RECOGNITION_AVAILABLE = False
    print("Warning: speech_recognition or pydub not installed. Audio transcription will be disabled.")

# Handle optional dependency for wordfreq
try:
    from wordfreq import top_n_list
    WORDFREQ_AVAILABLE = True
except ImportError:
    WORDFREQ_AVAILABLE = False
    print("Warning: wordfreq not installed. Falling back to static list.")

app = Flask(__name__)

# --- CONFIGURATION ---
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
OPEN_FM_API_KEY = os.getenv("OPEN_FM_API_KEY")
PEXELS_API_KEY = os.getenv("PEXELS_API_KEY")

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"

# Initialize OpenAI client only if key is available
client = OpenAI(api_key=OPEN_FM_API_KEY) if OPEN_FM_API_KEY else None

# --- EDGE TTS VOICE MAPPING (ISO CODES) ---
EDGE_TTS_VOICES = {
    'hi': "hi-IN-SwaraNeural",
    'mr': "mr-IN-AarohiNeural",
    'bn': "bn-IN-TanishaaNeural",
    'te': "te-IN-ShrutiNeural",
    'ta': "ta-IN-PallaviNeural",
    'gu': "gu-IN-DhwaniNeural",
    'ur': "ur-IN-GulshanNeural",
    'kn': "kn-IN-SapnaNeural",
    'ml': "ml-IN-SobhanaNeural",
    'pa': "pa-IN-OjasNeural",
    'ja': "ja-JP-NanamiNeural",
    'zh': "zh-CN-XiaoxiaoNeural",
    'es': "es-ES-ElviraNeural",
    'fr': "fr-FR-DeniseNeural",
    'de': "de-DE-KatjaNeural",
    'ko': "ko-KR-SunHiNeural"
}

# --- OPENAI VOICE MAP (Fallback) ---
VOICE_MAP = {
    'en-US': 'nova', 'en-GB': 'shimmer', 'en-AU': 'nova', 'en-IN': 'shimmer',
    'mr-IN': 'shimmer', 'hi-IN': 'shimmer', 'Marathi': 'shimmer', 'Hindi': 'shimmer'
}

LANGUAGES = {
    "Popular Global": ["English", "Spanish", "French", "German", "Italian", "Portuguese", "Russian", "Japanese", "Chinese (Simplified)", "Arabic"],
    "Indian Languages": ["Hindi", "Marathi", "Bengali", "Telugu", "Tamil", "Gujarati", "Urdu", "Kannada", "Malayalam", "Punjabi"],
    "Other": ["Turkish", "Thai", "Dutch", "Korean", "Indonesian"]
}

# Expanded list of hard/interesting words for fallback
WOTD_LIST = [
    "Serendipity", "Petrichor", "Ineffable", "Ephemeral", "Limerence", "Sonder", "Vellichor", "Solitude", "Aurora", "Euphoria", "Eloquence", "Mellifluous",
    "Sesquipedalian", "Perspicacious", "Obfuscate", "Esoteric", "Pulchritudinous", "Quixotic", "Recalcitrant", "Syophant", "Ubiquitous", "Vicarious",
    "Cacophony", "Ennui", "Halcyon", "Idyllic", "Juxtaposition", "Kaleidoscope", "Lackadaisical", "Magnanimous", "Nefarious", "Onomatopoeia",
    "Panacea", "Quintessential", "Rambunctious", "Sagacious", "Taciturn", "Umbrage", "Vacillate", "Wanderlust", "Xenophobia", "Zephyr",
    "Absquatulate", "Bamboozle", "Canoodle", "Discombobulate", "Flummox", "Gobbledygook", "Hodgepodge", "Kerfuffle", "Lollygag", "Malarkey",
    "Nincompoop", "Skedaddle", "Shenanigans", "Whippersnapper"
]

@app.route('/')
def home():
    return render_template('index.html', languages=LANGUAGES)

# --- BACKEND LOGIC HELPERS ---

def detect_language_code(text):
    if not text or not text.strip(): return 'en'
    try:
        lang, confidence = langid.classify(text)
        return lang
    except Exception as e:
        print(f"Detection Error: {e}")
        return 'en'

async def _edge_tts_generator(text, voice):
    communicate = edge_tts.Communicate(text, voice)
    audio_data = b""
    async for chunk in communicate.stream():
        if chunk["type"] == "audio": audio_data += chunk["data"]
    return audio_data

def generate_edge_audio_sync(text, voice):
    try: return asyncio.run(_edge_tts_generator(text, voice))
    except Exception as e: print(f"Edge TTS Error: {e}"); return None

def generate_gtts_audio(text, lang='en'):
    try:
        mp3_fp = io.BytesIO()
        tts = gTTS(text=text, lang=lang)
        tts.write_to_fp(mp3_fp)
        mp3_fp.seek(0)
        return mp3_fp.read()
    except Exception as e:
        print(f"gTTS Error: {e}")
        return None

def query_openrouter(messages, model="google/gemini-2.0-flash-001"):
    headers = {"Authorization": f"Bearer {OPENROUTER_API_KEY}", "HTTP-Referer": "http://localhost:5000", "X-Title": "Sanatan Sangrahalaya", "Content-Type": "application/json"}
    try:
        response = requests.post(OPENROUTER_URL, headers=headers, json={ "model": model, "messages": messages })
        response.raise_for_status()
        return response.json()
    except Exception as e: print(f"OpenRouter Error: {e}"); raise

def build_concept_graph(data, theme='light'):
    is_dark = (theme == 'dark')
    color_main = '#ea580c'
    color_syn = '#10b981'
    color_ant = '#ef4444'
    color_rel = '#3b82f6'
    color_edge = '#475569' if is_dark else '#64748b' 
    font_color_main = 'white'
    font_color_other = '#ffffff' if is_dark else '#000000'

    nodes = [{
        "id": 0, "label": data.get('word'), "group": "main",
        "color": {"background": color_main, "border": color_main},
        "font": {"color": font_color_main, "size": 24}, "shape": "box", "margin": 10
    }]
    edges = []
    id_counter = 1

    def add_node(word, group, color, dashed=False):
        nonlocal id_counter
        if any(n['label'] == word for n in nodes): return
        nodes.append({
            "id": id_counter, "label": word, "group": group,
            "color": {"background": color, "border": color},
            "font": {"color": font_color_other, "size": 16}, "shape": "dot", "margin": 10
        })
        edges.append({
            "from": 0, "to": id_counter, 
            "color": {"color": color_edge}, "dashes": dashed
        })
        id_counter += 1

    for s in data.get('synonyms', []): add_node(s, "synonym", color_syn)
    for a in data.get('antonyms', []): add_node(a, "antonym", color_ant, True)
    for r in data.get('related_words', []): add_node(r['word'], "related", color_rel)

    return {"nodes": nodes, "edges": edges}

def process_interactive_text(text):
    if not text: return ""
    parts = re.split(r'(\s+)', text)
    html_parts = []
    for p in parts:
        if re.match(r'^\s+$', p): 
            html_parts.append(p)
        else:
            clean = re.sub(r'[.,\/#!$%\^&\*;:{}=\-_`~()?"\']', "", p)
            if clean:
                html_parts.append(f'<span class="cursor-pointer hover:bg-orange-100 dark:hover:bg-orange-900/50 rounded transition-colors" onclick="defineWord(\'{clean}\')">{p}</span>')
            else:
                html_parts.append(p)
    return "".join(html_parts)

def generate_word_card_html(data, images):
    word = data.get('word', '')
    safe_word = word.replace("'", "\\'")
    target_language = data.get('language', 'English')
    is_foreign = target_language != 'English'
    
    # Translation Logic for Word Title
    translated_word = data.get('translated_word')
    display_word = translated_word if is_foreign and translated_word else word
    safe_display_word = display_word.replace("'", "\\'")
    
    sub_display = f'<span class="text-3xl text-slate-400 ml-3 font-normal">({word})</span>' if is_foreign and translated_word and translated_word.lower() != word.lower() else ""

    english_def_text = data.get('translated_definition', '') if is_foreign else data.get('definition', '')
    target_def_text = data.get('definition', '') if is_foreign else None
    
    if is_foreign and not english_def_text and target_def_text:
         english_def_text = "Translation not available."
    
    # Safely escape for onclick - using English definition text for pronunciation if needed
    safe_english_def = english_def_text.replace("'", "\\'") if english_def_text else ""
    safe_target_def = target_def_text.replace("'", "\\'") if target_def_text else ""

    language_badge = f'<div class="mb-2"><span class="inline-flex items-center rounded-md bg-orange-50 px-2 py-1 text-xs font-bold uppercase text-orange-700 ring-1 ring-inset ring-orange-600/10 dark:bg-orange-900/20 dark:text-orange-400 dark:ring-orange-500/20 tracking-wider"><i data-lucide="globe" class="w-3 h-3 mr-1"></i> {target_language}</span></div>'

    pronunciation_html = f'<div class="text-slate-500 font-mono text-lg mt-1">{data.get("pronunciation")}</div>' if data.get('pronunciation') else ""
    etymology_html = f'<div class="p-4 bg-orange-50 dark:bg-slate-800/50 rounded-xl mt-6 border border-orange-100 dark:border-slate-700"><h3 class="text-xs font-bold text-orange-600 dark:text-orange-500 uppercase tracking-wider mb-2 flex items-center gap-2"><i data-lucide="history" class="w-3 h-3"></i> Origin</h3><p class="text-sm italic text-slate-600 dark:text-slate-400 font-serif interactive-text">{process_interactive_text(data.get("etymology", ""))}</p></div>' if data.get('etymology') else ""
    
    # Added pronunciation button to English Definition
    english_def_html = f'<div><h3 class="text-xs font-bold text-slate-400 uppercase mb-2 flex items-center gap-2">Definition (English) <button onclick="speakText(this, \'{safe_english_def}\')" class="text-orange-500 hover:text-orange-600" title="Pronounce Definition"><i data-lucide="volume-2" class="w-4 h-4"></i></button></h3><p class="text-xl text-slate-800 dark:text-slate-100 leading-relaxed font-medium interactive-text">{process_interactive_text(english_def_text)}</p></div>'
    
    target_def_html = ""
    if target_def_text:
        # Added pronunciation button to Target Definition
        target_def_html = f'<div class="pt-4 mt-4 border-t border-orange-100 dark:border-slate-800"><h3 class="text-xs font-bold text-orange-500 uppercase tracking-wider mb-1 flex items-center gap-2">Definition ({target_language}) <button onclick="speakText(this, \'{safe_target_def}\')" class="text-orange-500 hover:text-orange-600" title="Pronounce Definition"><i data-lucide="volume-2" class="w-4 h-4"></i></button></h3><p class="text-lg text-slate-800 dark:text-slate-200 leading-relaxed font-medium interactive-text">{process_interactive_text(target_def_text)}</p></div>'

    example_html = ""
    if data.get('example'):
        safe_example = data.get('example').replace("'", "\\'")
        example_html = f'<div class="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800"><h3 class="text-xs font-bold text-slate-400 uppercase mb-2">Example</h3><div class="flex items-start gap-3"><p class="text-lg text-slate-600 dark:text-slate-300 italic interactive-text">{process_interactive_text(data.get("example"))}</p><button onclick="speakText(this, \'{safe_example}\')" class="text-orange-500 hover:text-orange-600 mt-1"><i data-lucide="volume-2" class="w-4 h-4"></i></button></div></div>'

    # NEW: Sentence Translation Block
    sentence_translation = data.get('sentence_translation')
    translation_html = ""
    if sentence_translation:
        safe_trans_sentence = sentence_translation.replace("'", "\\'")
        translation_html = f"""
        <div class="translation-section mt-4 pt-4 border-t border-orange-100 dark:border-slate-800">
            <h3 class="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                <i data-lucide="languages" class="w-3 h-3"></i> Sentence Translation
                <button onclick="speakText(this, '{safe_trans_sentence}')" class="text-emerald-500 hover:text-emerald-600" title="Pronounce Translation"><i data-lucide="volume-2" class="w-4 h-4"></i></button>
            </h3>
            <p class="translated-sentence text-lg text-slate-700 dark:text-slate-300 italic leading-relaxed">
                {sentence_translation}
            </p>
        </div>
        """

    related_html = ""
    for rw in data.get('related_words', []):
        rw_safe_word = rw['word'].replace("'", "\\'")
        rw_safe_sentence = rw['sentence'].replace("'", "\\'")
        related_html += f'<div class="p-5 hover:bg-orange-50 dark:hover:bg-slate-800 transition-colors group border-b border-orange-100 dark:border-slate-800 last:border-0"><div class="flex justify-between items-start"><div><div class="flex items-center gap-2 mb-1"><span class="font-bold text-orange-600 dark:text-orange-400 text-lg interactive-text cursor-pointer hover:underline" onclick="defineWord(\'{rw_safe_word}\')">{rw["word"]}</span><button onclick="speakText(this, \'{rw_safe_word}\')" class="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-slate-300 hover:text-orange-600"><i data-lucide="volume-2" class="w-3 h-3"></i></button></div><p class="text-slate-600 dark:text-slate-400 italic interactive-text">{process_interactive_text(rw["sentence"])}</p></div><button onclick="speakText(this, \'{rw_safe_sentence}\')" class="text-slate-300 hover:text-orange-600"><i data-lucide="play-circle" class="w-5 h-5"></i></button></div></div>'

    # Make Context & Usage block conditional
    context_usage_block = ""
    if related_html:
        context_usage_block = f'<div class="bg-white dark:bg-slate-900 rounded-3xl shadow-xl overflow-hidden border border-orange-100 dark:border-slate-800"><div class="p-6 border-b border-orange-100 dark:border-slate-800 bg-orange-50 dark:bg-slate-800/50"><h3 class="font-semibold dark:text-white flex items-center gap-2"><i data-lucide="sparkles" class="w-4 h-4 text-orange-500"></i> Context & Usage</h3></div><div class="divide-y divide-orange-100 dark:divide-slate-800">{related_html}</div></div>'

    images_html = "".join([f'<div class="aspect-square rounded-xl overflow-hidden shadow-sm"><img src="{img["src"]["medium"]}" class="w-full h-full object-cover transition-transform hover:scale-110 duration-500"></div>' for img in images[:4]]) if images else '<p class="col-span-2 text-sm text-slate-400 text-center py-4">No images found</p>'
    
    if images:
        ai_image_src = images[0]["src"]["large"] 
    else:
        ai_image_src = "https://placehold.co/512x512/orange/white?text=No+Image"
    
    ai_image_display = f'<img src="{ai_image_src}" class="w-full h-full object-cover animate-in">'

    html = f"""
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div class="lg:col-span-2 space-y-6">
            <div class="bg-white dark:bg-slate-900 rounded-3xl p-8 shadow-xl relative overflow-hidden border border-orange-100 dark:border-slate-800">
                <div class="flex justify-between items-start mb-6">
                    <div class="flex flex-col">
                        {language_badge}
                        <div class="flex items-center gap-3"><h2 class="text-6xl font-bold text-slate-900 dark:text-white tracking-tight cursor-pointer hover:text-orange-600 transition-colors" onclick="defineWord('{word}')">{display_word}</h2>{sub_display}<button onclick="pronounceWord(this, '{safe_display_word}')" class="p-3 bg-slate-100 dark:bg-slate-800 rounded-full text-orange-600 hover:bg-orange-100 transition-colors mt-2 ml-2"><i data-lucide="volume-2" class="w-6 h-6"></i></button></div>
                        {pronunciation_html}
                    </div>
                    <button onclick="toggleSave(this, '{safe_word}')" class="p-3 rounded-xl transition-colors bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-emerald-600 save-btn" data-word="{word}"><i data-lucide="download" class="w-6 h-6"></i></button>
                </div>
                <div class="space-y-4">
                    {english_def_html}
                    {target_def_html}
                    {translation_html}
                    {example_html}
                    {etymology_html}
                </div>
            </div>
            {context_usage_block}
        </div>
        <div class="space-y-6">
            <div class="bg-gradient-to-br from-orange-600 to-red-700 rounded-3xl p-1 shadow-xl text-white"><div class="p-5 flex items-center justify-between"><div class="flex items-center gap-2"><i data-lucide="wand-2" class="w-5 h-5 text-orange-200"></i> <span class="font-semibold">Featured Image</span></div></div><div class="aspect-square bg-black/20 m-1 rounded-2xl overflow-hidden relative">{ai_image_display}</div></div>
            <div class="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-xl border border-orange-100 dark:border-slate-800"><h3 class="font-semibold mb-4 dark:text-white flex items-center gap-2"><i data-lucide="image" class="w-4 h-4 text-slate-400"></i> Gallery</h3><div class="grid grid-cols-2 gap-2">{images_html}</div></div>
        </div>
    </div>
    """
    return html

def generate_chat_html(role, text):
    safe_text = text.replace("'", "\\'").replace('"', '&quot;').replace('\n', ' ')
    processed_text = process_interactive_text(text)
    if role == 'user':
        return f"""<div class="flex justify-end mb-4"><div class="bg-orange-600 text-white px-5 py-3 rounded-2xl rounded-tr-none max-w-[80%] shadow-md text-lg interactive-text">{processed_text}</div></div>"""
    return f"""<div class="flex justify-start gap-3 mb-4 items-end"><div class="w-8 h-8 rounded-full bg-orange-100 dark:bg-slate-800 flex items-center justify-center text-orange-600 shrink-0 border border-orange-200 dark:border-slate-700"><i data-lucide="ghost" class="w-5 h-5"></i></div><div class="bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl rounded-tl-none max-w-[80%] border border-slate-100 dark:border-slate-700 dark:text-slate-200 shadow-sm text-lg leading-relaxed interactive-text">{processed_text}</div><button onclick="playChatAudio(this, '{safe_text}')" class="p-2 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-orange-100 text-slate-400 hover:text-orange-600 transition-colors self-center"><i data-lucide="volume-2" class="w-4 h-4"></i></button></div>"""

# --- API ENDPOINTS ---

@app.route('/api/dictionary', methods=['POST'])
def dictionary_lookup():
    data = request.json
    term = data.get('term')
    language = data.get('language')
    if not language or language.strip() == "":
        language = 'English'
    theme = data.get('theme', 'light')
    
    system_instruction = f"""Act as a smart dictionary backend. Target Language: "{language}". Analyze Input. 
    
    If the input is a SENTENCE or PHRASE (contains multiple words or is a question):
       - "word": The original sentence.
       - "translated_word": The sentence translated into {language} (if target is not English).
       - "definition": A brief explanation or grammatical breakdown in {language}.
       - "sentence_translation": The direct full translation of the sentence into {language}.
       - "translated_definition": Explanation in English.
       - "example": Another similar usage example.

    If the input is a SINGLE WORD:
       - "word": The original search term.
       - "translated_word": The search term translated into {language}.
       - "definition" field MUST contain the definition written in {language}.
       - "translated_definition" field MUST contain the definition written in English.
       - "sentence_translation": null.
       - "example" field should be in {language} if possible.
    
    Return ONLY raw JSON (wrap in 'results' array). 
    Structure: {{ "results": [ {{ "word": "...", "translated_word": "...", "sentence_translation": "...", "pronunciation": "/.../", "definition": "...", "translated_definition": "...", "example": "...", "etymology": "...", "related_words": [{{...}}], "synonyms": [...], "antonyms": [...], "language": "{language}" }} ] }}"""
    try:
        messages = [{"role": "system", "content": system_instruction}, {"role": "user", "content": f"Define: {term}"}]
        ai_data = query_openrouter(messages)
        content = ai_data['choices'][0]['message']['content']
        
        try:
            clean_content = content.replace('```json', '').replace('```', '').strip()
            result_data = json.loads(clean_content)
        except json.JSONDecodeError:
            match = re.search(r'\{.*\}', content, re.DOTALL)
            if match:
                result_data = json.loads(match.group())
            else:
                print(f"AI Response JSON Parse Error: {content}")
                raise ValueError("Failed to parse JSON from AI response")
        
        results_with_html = []
        for item in result_data.get('results', []):
            try:
                # Add Header to Pexels Request
                headers = {'Authorization': PEXELS_API_KEY} if PEXELS_API_KEY else {}
                img_res = requests.get(f"https://api.pexels.com/v1/search?query={item.get('correction') or item.get('word')}&per_page=4", headers=headers)
                images = img_res.json().get('photos', []) if img_res.status_code == 200 else []
            except Exception as img_err:
                print(f"Image Fetch Error: {img_err}")
                images = []
            
            item['html'] = generate_word_card_html(item, images)
            item['graph'] = build_concept_graph(item, theme)
            results_with_html.append(item)
            
        return jsonify({"results": results_with_html})
    except Exception as e: 
        print(f"Dictionary Lookup Error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/chat', methods=['POST'])
def chat():
    data = request.json
    history = data.get('history', [])
    formatted_messages = [{"role": "system", "content": "You are Andy, the dictionary spirit. Witty, loves words. Concise answers."}]
    for msg in history[-6:]: formatted_messages.append({"role": "user" if msg.get('role') == 'user' else "assistant", "content": msg.get('text', '')})
    if not history or history[-1].get('text') != data.get('message'): formatted_messages.append({"role": "user", "content": data.get('message')})
    try:
        answer = query_openrouter(formatted_messages)['choices'][0]['message']['content']
        html = generate_chat_html('assistant', answer)
        return jsonify({"response": answer, "html": html})
    except Exception as e: return jsonify({"error": "Error"}), 500

@app.route('/api/analyze', methods=['POST'])
def analyze_text():
    data = request.json
    system_instruction = f'''Act as a linguistics expert. Target: "{data.get('language', 'English')}". Analyze text. Return ONLY JSON: {{ "analysis_paragraphs": ["Para 1"], "pronunciation_guide": [ {{ "word": "ex", "ipa": "/ex/" }} ] }}'''
    try:
        messages = [{"role": "system", "content": system_instruction}, {"role": "user", "content": f"Analyze: {data.get('text')}"}]
        ai_data = query_openrouter(messages)
        content = json.loads(ai_data['choices'][0]['message']['content'].replace('```json', '').replace('```', '').strip())
        html = '<div class="space-y-4 mb-6">'
        if 'analysis_paragraphs' in content:
            for para in content['analysis_paragraphs']:
                safe_para = para.replace("'", "\\\\'").replace('"', '&quot;')
                html += f'''<div class="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-orange-100 dark:border-slate-700"><p class="text-slate-700 dark:text-slate-300 text-sm leading-relaxed mb-2 interactive-text">{process_interactive_text(para)}</p><button onclick="playChatAudio(this, '{safe_para}')" class="flex items-center gap-2 text-orange-600 text-xs font-bold hover:underline"><i data-lucide="volume-2" class="w-3 h-3"></i> Listen</button></div>'''
        html += '</div>'
        if 'pronunciation_guide' in content:
            html += '<div class="mb-4"><h4 class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Key Pronunciations</h4><div class="space-y-2">'
            for item in content['pronunciation_guide']:
                html += f'''<div class="flex items-center justify-between p-2 rounded-lg hover:bg-orange-50 dark:hover:bg-slate-800 transition-colors"><div><span class="text-slate-900 dark:text-white font-medium text-sm interactive-text">{item['word']}</span><span class="text-slate-400 text-xs ml-2 font-mono">{item['ipa']}</span></div><button onclick="pronounceWord(this, '{item['word']}')" class="text-slate-400 hover:text-orange-600" title="Pronounce"><i data-lucide="volume-2" class="w-4 h-4"></i></button></div>'''
            html += '</div></div>'
        return jsonify({"html": html})
    except Exception as e: return jsonify({"error": str(e)}), 500

@app.route('/api/fix_grammar', methods=['POST'])
def fix_grammar():
    data = request.json
    text = data.get('text')
    if not text: return jsonify({"error": "No text provided"}), 400
    
    system_instruction = "Act as a strict grammar corrector. Fix all grammatical, spelling, and punctuation errors in the user's text. Return ONLY the corrected text. Do not add conversational filler."
    try:
        messages = [{"role": "system", "content": system_instruction}, {"role": "user", "content": text}]
        ai_data = query_openrouter(messages)
        corrected = ai_data['choices'][0]['message']['content'].strip()
        return jsonify({"corrected_text": corrected})
    except Exception as e: return jsonify({"error": str(e)}), 500

@app.route('/api/reader_format', methods=['POST'])
def format_reader_text():
    data = request.json
    text = data.get('text')
    html = process_interactive_text(text)
    return jsonify({"html": html})

@app.route('/api/tts', methods=['POST'])
def text_to_speech():
    data = request.json
    # Handle both 'text' and 'word' keys to fix audibility issues
    text = data.get('text') or data.get('word', '')
    
    if not text:
        return jsonify({"error": "No text provided"}), 400

    detected_lang = detect_language_code(text)
    print(f"Detected Language: {detected_lang}")
    if detected_lang in EDGE_TTS_VOICES:
        voice = EDGE_TTS_VOICES[detected_lang]
        audio = generate_edge_audio_sync(text, voice)
        if audio: return Response(audio, content_type='audio/mpeg')

    # Try gTTS as a fallback or for other languages
    gtts_audio = generate_gtts_audio(text, lang=detected_lang)
    if gtts_audio:
        return Response(gtts_audio, content_type='audio/mpeg')

    # Use OpenAI voice if available
    if client and VOICE_MAP:
        voice = VOICE_MAP.get(data.get('accent'), 'nova')
        try:
            response = client.audio.speech.create(model="tts-1", voice=voice, input=text)
            return Response(response.iter_bytes(chunk_size=4096), content_type='audio/mpeg')
        except Exception as e: 
            print(f"OpenAI TTS error: {e}")
            return jsonify({"error": str(e)}), 500
    
    return jsonify({"error": "No TTS service available"}), 500

@app.route('/api/pronounce', methods=['POST'])
def pronounce_word():
    return text_to_speech()

@app.route('/api/transcribe', methods=['POST'])
def transcribe_audio():
    if not SPEECH_RECOGNITION_AVAILABLE:
        return jsonify({"error": "Server missing speech libraries (SpeechRecognition, pydub)"}), 503

    if 'file' not in request.files: return jsonify({"error": "No file"}), 400
    file = request.files['file']
    if file.filename == '': return jsonify({"error": "No selected file"}), 400
    try:
        # Read file into memory
        file_content = file.read()
        
        # Use SpeechRecognition with Google Speech API
        # Needs pydub to convert audio to WAV for SpeechRecognition
        try:
            audio_segment = AudioSegment.from_file(io.BytesIO(file_content))
            wav_io = io.BytesIO()
            audio_segment.export(wav_io, format="wav")
            wav_io.seek(0)
        except Exception as conv_err:
            print(f"Conversion Error (ffmpeg installed?): {conv_err}")
            return jsonify({"error": "Audio conversion failed. Is ffmpeg installed?"}), 500

        recognizer = sr.Recognizer()
        with sr.AudioFile(wav_io) as source:
            audio_data = recognizer.record(source)
            try:
                text = recognizer.recognize_google(audio_data)
                return jsonify({"text": text})
            except sr.UnknownValueError:
                return jsonify({"error": "Could not understand audio"}), 400
            except sr.RequestError as req_err:
                return jsonify({"error": f"Speech service error: {req_err}"}), 503
            
    except Exception as e: 
        print(f"Transcribe Error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/wotd', methods=['GET'])
def word_of_the_day():
    # Pick a random word using wordfreq if available
    if WORDFREQ_AVAILABLE:
        # Pick from top 2000-8000 English words to be interesting
        word_list = top_n_list('en', 8000)[2000:]
        term = random.choice(word_list)
    else:
        # Fallback to static list
        term = random.choice(WOTD_LIST)
    
    # We reuse dictionary lookup logic
    language = request.args.get('language', 'English')
    theme = request.args.get('theme', 'light')
    
    system_instruction = f"""Act as a smart dictionary backend. Target Language: "{language}". Analyze Input. 
    If the input contains multiple words (comma separated or list), return an array of result objects for each word.
    
    CRITICAL INSTRUCTION FOR TRANSLATION:
    1. If the Target Language is "{language}" (and it is NOT English):
       - "word": The original search term.
       - "translated_word": The search term translated into {language}.
       - "definition" field MUST contain the definition written in {language}.
       - "translated_definition" field MUST contain the definition written in English.
       - "example" field should be in {language} if possible.
    
    2. If the Target Language is English:
       - "word": The original search term.
       - "translated_word": null or same as word.
       - "definition" field MUST be in English.
       - "translated_definition" can be null or empty string.
    
    Return ONLY raw JSON (wrap in 'results' array). 
    Structure: {{ "results": [ {{ "word": "Word", "translated_word": "TransWord", "pronunciation": "/IPA/", "definition": "Def", "translated_definition": "Def in English", "example": "Sentence...", "etymology": "Origin", "related_words": [{{"word": "R1", "sentence": "S1"}}], "synonyms": ["s1"], "antonyms": ["a1"], "language": "{language}" }} ] }}"""
    
    try:
        messages = [{"role": "system", "content": system_instruction}, {"role": "user", "content": f"Define: {term}"}]
        ai_data = query_openrouter(messages)
        content = ai_data['choices'][0]['message']['content'].replace('```json', '').replace('```', '').strip()
        result_data = json.loads(content)
        
        results_with_html = []
        for item in result_data.get('results', []):
            try:
                # Add Header to Pexels Request
                headers = {'Authorization': PEXELS_API_KEY} if PEXELS_API_KEY else {}
                img_res = requests.get(f"https://api.pexels.com/v1/search?query={item.get('correction') or item.get('word')}&per_page=4", headers=headers)
                images = img_res.json().get('photos', []) if img_res.status_code == 200 else []
            except Exception:
                images = []
            
            item['html'] = generate_word_card_html(item, images)
            item['graph'] = build_concept_graph(item, theme)
            results_with_html.append(item)
            
        return jsonify({"results": results_with_html})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/images', methods=['GET'])
def get_images():
    try:
        headers = {'Authorization': PEXELS_API_KEY} if PEXELS_API_KEY else {}
        return jsonify(requests.get(f"https://api.pexels.com/v1/search?query={request.args.get('term')}&per_page=4", headers=headers).json())
    except Exception as e: return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)