"""Build the compact numeric table, never ship full corpora or learner data.

Requires wordfreq==3.1.1 in .cache/frequency-deps and cached upstream CSV.
targets.json is exported from the checked-in curriculum only, not drafts.
"""
import csv
import hashlib
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / '.cache/frequency-deps'))
from wordfreq import zipf_frequency
from wordfreq.tokens import lossy_tokenize

source = ROOT / '.cache/frequency-sources/en_top_sentences.csv'
rows = json.loads((ROOT / '.cache/frequency-sources/targets.json').read_text(encoding='utf-8'))

def tokens(value):
    return re.findall(r"[a-z]+(?:'[a-z]+)?", value.lower().replace('\u2019', "'"))

corpus = list(csv.DictReader(source.open(encoding='utf-8')))
weighted = [(tokens(row['sentence']), int(row['count'])) for row in corpus]
denominator = sum(len(words) * count for words, count in weighted)
counts = {}
for words, count in weighted:
    for size in range(2, min(len(words), 12) + 1):
        for start in range(len(words) - size + 1):
            label = ' '.join(words[start:start + size])
            counts[label] = counts.get(label, 0) + count

words, phrases = {}, {}
for row in rows:
    label = row['label'].strip().lower().replace('\u2019', "'")
    if row['category'] == 'phrase':
        if len(tokens(label)) >= 2 and ' '.join(tokens(label)) == label:
            count = counts.get(label, 0)
            if count:
                rate = count / denominator * 1e6
                phrases[label] = [3 if rate >= 100 else 2 if rate >= 10 else 1, count]
    elif len(lossy_tokenize(label, 'en')) == 1:
        score = zipf_frequency(label, 'en', wordlist='large')
        if score > 0:
            words[label] = [3 if score >= 5 else 2 if score >= 4 else 1, score]

metadata = {
    'version': 1, 'generatedAt': '2026-10-29',
    'wordSource': 'wordfreq 3.1.1 English large',
    'wordURL': 'https://github.com/rspeer/wordfreq',
    'wordLicense': 'CC BY-SA 4.0 (derived word-frequency data)',
    'phraseSource': 'OpenSubtitles2018 top English sentence sample via orgtre',
    'phraseURL': 'https://github.com/orgtre/top-open-subtitles-sentences',
    'phraseRows': len(corpus), 'phraseWeightedTokens': denominator,
    'phraseCSVsha256': hashlib.sha256(source.read_bytes()).hexdigest(),
    'thresholds': {'wordZipf': [4, 5], 'phrasePerMillion': [10, 100]},
    'partialFill': 'round(clamp(Zipf - 2, 0.1, 3), 1 decimal); phrases use sample-only log10(matches per million)+3',
    'limitations': 'Word-form mixed-genre frequency, not sense-specific or a native-speaker census. Exact phrase counts only in the top-sentence sample; absence is not rarity. Word and phrase scores use different sources. No task quotas or grades changed.'
}
payload = json.dumps({'metadata': metadata, 'words': dict(sorted(words.items())), 'phrases': dict(sorted(phrases.items()))}, ensure_ascii=True, separators=(',', ':'))
script = "/* Derived numeric frequency data; see frequency-data-notice.html. */\n(function(root){var data=" + payload + ";if(typeof module==='object'&&module.exports)module.exports=data;else root.StudyFrequencyData=data;})(typeof window==='object'?window:globalThis);\n"
(ROOT / 'frequency-reference-data.js').write_text(script, encoding='utf-8')
print(json.dumps({'words': len(words), 'phrases': len(phrases), 'bytes': len(script)}))
