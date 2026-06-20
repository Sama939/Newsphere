"""
Translate English news summaries to Chinese using a FULLY SELF-HOSTED model
(Helsinki-NLP/opus-mt-en-zh via transformers). No external API is called, so
this is safe for commercial / ad-supported use.

The model (~300 MB) downloads once from the Hugging Face hub on first run,
then runs locally and offline. Requires: transformers, torch, sentencepiece.

Reads events JSON from stdin, writes events with an added summaryZh field to
stdout. If the model can't be loaded, summaries are left untranslated (the
front-end falls back to the English text).
"""

import sys
import json
import io
import re
import html

sys.stdin = io.TextIOWrapper(sys.stdin.buffer, encoding='utf-8-sig')
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

MODEL_NAME = 'Helsinki-NLP/opus-mt-en-zh'
BATCH_SIZE = 16


def prep(text):
    """Extract clean English plain text before translating."""
    t = text.strip()
    t = html.unescape(t)                      # &amp; -> &
    t = re.sub(r'https?://\S+', '', t)        # drop URLs
    t = re.sub(r'<[^>]+>', '', t)             # drop HTML tags
    t = re.sub(r'[^\x00-\x7F]', '', t)        # drop non-ASCII noise
    # Title-case words so lowercase URL-slug proper nouns survive translation.
    t = re.sub(r'\b([a-z])', lambda m: m.group(1).upper(), t)
    t = re.sub(r'\s+', ' ', t).strip()
    if t and t[-1] not in '.!?':
        t = t.rstrip(' ,;:-') + '.'
    return t


def main():
    events = json.loads(sys.stdin.read())
    if not events:
        print(json.dumps([]))
        return

    # Only translate real summaries, not hostname fallbacks.
    to_translate = [
        (i, prep(e['summary']))
        for i, e in enumerate(events)
        if e.get('summary') and '来源:' not in e['summary']
    ]
    to_translate = [(i, t) for i, t in to_translate if t.strip()]

    translations = {}
    try:
        import warnings
        warnings.filterwarnings('ignore')
        from transformers import MarianMTModel, MarianTokenizer
        import torch

        tokenizer = MarianTokenizer.from_pretrained(MODEL_NAME)
        model = MarianMTModel.from_pretrained(MODEL_NAME)
        model.eval()

        texts = [t for _, t in to_translate]
        outputs = []
        for start in range(0, len(texts), BATCH_SIZE):
            batch = texts[start:start + BATCH_SIZE]
            enc = tokenizer(batch, return_tensors='pt', padding=True,
                            truncation=True, max_length=128)
            with torch.no_grad():
                gen = model.generate(**enc, max_length=128, num_beams=4)
            outputs.extend(tokenizer.batch_decode(gen, skip_special_tokens=True))

        for k, (ev_idx, _) in enumerate(to_translate):
            translations[ev_idx] = outputs[k]
    except Exception as exc:
        sys.stderr.write(
            f'[translate] self-hosted model unavailable ({exc}); '
            f'keeping English. Install with: pip install transformers torch sentencepiece\n'
        )

    translated = 0
    for i, e in enumerate(events):
        zh = translations.get(i, '')
        e['summaryZh'] = zh
        if zh:
            translated += 1

    sys.stderr.write(f'[translate] done: {translated}/{len(to_translate)} translated (self-hosted)\n')
    print(json.dumps(events, ensure_ascii=False))


if __name__ == '__main__':
    main()
