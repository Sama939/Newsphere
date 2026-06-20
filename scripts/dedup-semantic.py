"""
Semantic deduplication for news headlines using all-MiniLM-L6-v2.
Uses transformers directly to avoid sentence-transformers API issues.
Reads events JSON from stdin, writes deduplicated events to stdout.
"""

import sys
import json
import warnings
import io
warnings.filterwarnings('ignore')

# On Windows, Node pipes stdin as UTF-8 but Python may default to cp1252.
sys.stdin = io.TextIOWrapper(sys.stdin.buffer, encoding='utf-8')

def cosine_sim(a, b):
    dot = sum(x * y for x, y in zip(a, b))
    na  = sum(x * x for x in a) ** 0.5
    nb  = sum(x * x for x in b) ** 0.5
    return dot / (na * nb + 1e-9)

def mean_pool(token_embeddings, attention_mask):
    """Mean pooling — take attention mask into account."""
    import torch
    mask = attention_mask.unsqueeze(-1).expand(token_embeddings.size()).float()
    return (token_embeddings * mask).sum(1) / mask.sum(1).clamp(min=1e-9)

def encode(texts, tokenizer, model):
    import torch
    encoded = tokenizer(
        texts,
        padding=True,
        truncation=True,
        max_length=128,
        return_tensors='pt',
    )
    with torch.no_grad():
        out = model(**encoded)
    embeddings = mean_pool(out.last_hidden_state, encoded['attention_mask'])
    # L2-normalise
    norms = (embeddings ** 2).sum(dim=1, keepdim=True) ** 0.5
    return (embeddings / norms.clamp(min=1e-9)).tolist()

SIMILARITY_THRESHOLD = 0.75
MODEL_NAME = 'sentence-transformers/all-MiniLM-L6-v2'

def main():
    events = json.loads(sys.stdin.read())
    if not events:
        print(json.dumps([]))
        return

    real     = [(i, e) for i, e in enumerate(events) if '来源:' not in e.get('summary', '')]
    fallback = {i for i, e in enumerate(events) if '来源:'     in e.get('summary', '')}

    if not real:
        print(json.dumps(events))
        return

    from transformers import AutoTokenizer, AutoModel
    # use_fast=False avoids the Rust tokenizer which is incompatible with Python 3.14
    tokenizer  = AutoTokenizer.from_pretrained(MODEL_NAME, use_fast=False)
    model      = AutoModel.from_pretrained(MODEL_NAME)
    model.eval()

    # Ensure all summaries are plain str — tokenizers is strict about types
    summaries  = [str(e['summary']) for _, e in real]
    embeddings = encode(summaries, tokenizer, model)

    # Map from real-list index to list of dropped events' data (for sources display).
    merged = {}  # real_list_idx -> [dropped event dicts]
    dropped = set()
    kept_orig = []  # original event indices that survive

    for i in range(len(real)):
        if i in dropped:
            continue
        orig_i = real[i][0]
        kept_orig.append(orig_i)
        merged[i] = []
        for j in range(i + 1, len(real)):
            if j in dropped:
                continue
            if cosine_sim(embeddings[i], embeddings[j]) >= SIMILARITY_THRESHOLD:
                dropped.add(j)
                merged[i].append(real[j][1])  # store dropped event dict

    # Build result preserving original event dicts, adding sources list.
    kept_set = set(kept_orig) | fallback
    # Build mapping: original_event_index -> real_list_index (for survivors).
    orig_to_real = {real[i][0]: i for i in range(len(real)) if i not in dropped}
    result = []
    for orig_idx, e in enumerate(events):
        if orig_idx not in kept_set:
            continue
        e_out = dict(e)
        real_i = orig_to_real.get(orig_idx)
        if real_i is not None and merged.get(real_i):
            e_out['sources'] = [
                {'url': s['url'], 'summary': s.get('summary', ''), 'summaryZh': s.get('summaryZh', '')}
                for s in merged[real_i]
            ]
        result.append(e_out)
    print(json.dumps(result))

if __name__ == '__main__':
    main()
