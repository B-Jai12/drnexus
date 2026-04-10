"""
Phase 3 — Data Augmentation
Boosts training data via synonym replacement, minority oversampling,
and text variations. Outputs augmented_dataset.csv.
"""

import sys, io, pathlib, random, re
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

import pandas as pd
import numpy as np

ROOT    = pathlib.Path(__file__).resolve().parent.parent
DATA    = ROOT / "training" / "data"

# Minimum samples per category before augmentation kicks in
MIN_SAMPLES = 100

# Synonym/alias map for augmentation
ALIASES = {
    "swiggy":       ["food delivery", "online food", "swiggy order", "food app"],
    "zomato":       ["food delivery", "restaurant order", "zomato order"],
    "amazon":       ["online shopping", "amazon order", "amazon purchase"],
    "flipkart":     ["online shopping", "flipkart order", "flipkart purchase"],
    "uber":         ["cab ride", "uber ride", "taxi"],
    "ola":          ["cab ride", "ola cab", "ola auto"],
    "rapido":       ["bike taxi", "rapido ride", "two wheeler taxi"],
    "netflix":      ["streaming", "ott subscription", "netflix subscription"],
    "spotify":      ["music streaming", "spotify premium", "music subscription"],
    "electricity":  ["power bill", "electricity charge", "current bill"],
    "petrol":       ["fuel", "petrol fill", "fuel charge"],
    "irctc":        ["train booking", "railway ticket", "rail booking"],
    "makemytrip":   ["flight booking", "hotel booking", "travel booking"],
    "apollo":       ["medicine", "pharmacy purchase", "health store"],
    "medplus":      ["pharmacy", "medicine shop", "health care"],
    "dominos":      ["pizza", "food order", "pizza delivery"],
    "kfc":          ["fried chicken", "fast food", "chicken order"],
    "metro":        ["metro card", "metro recharge", "city rail"],
    "fastag":       ["toll payment", "highway toll", "fastag recharge"],
    "airtel":       ["mobile bill", "phone recharge", "broadband bill"],
    "jio":          ["mobile bill", "jio recharge", "jio prepaid"],
}

# Simple text variation templates
VARIATIONS = [
    lambda t: t + " payment",
    lambda t: t + " charge",
    lambda t: "payment to " + t,
    lambda t: t + " order",
    lambda t: "paid to " + t,
]


def augment_with_aliases(text: str) -> list[str]:
    """Replace known merchants with aliases to create new training samples."""
    results = []
    for word, replacements in ALIASES.items():
        if word in text:
            for rep in replacements[:2]:  # max 2 aliases per word
                new_text = text.replace(word, rep)
                if new_text != text:
                    results.append(new_text)
    return results


def augment_with_variations(text: str) -> list[str]:
    """Apply simple text templates to create variations."""
    results = []
    for fn in VARIATIONS[:3]:
        results.append(fn(text))
    return results


def run_phase3(labeled_df: pd.DataFrame = None) -> pd.DataFrame:
    print("\n" + "="*60)
    print("PHASE 3 — DATA AUGMENTATION")
    print("="*60)

    # Load data
    if labeled_df is None:
        # Combine auto-labeled + any manually labeled review rows
        labeled_path = DATA / "phase2_labeled.csv"
        review_path  = DATA / "review_needed.csv"

        if not labeled_path.exists():
            raise FileNotFoundError("Run phase1 and phase2 first!")

        df = pd.read_csv(labeled_path, encoding='utf-8-sig')

        # Include manually labeled review rows if they exist and have categories
        if review_path.exists():
            rev = pd.read_csv(review_path, encoding='utf-8-sig')
            rev_labeled = rev[rev['category'].notna() & (rev['category'].str.strip() != '')]
            if len(rev_labeled) > 0:
                print(f"  + Including {len(rev_labeled)} manually labeled rows from review_needed.csv")
                df = pd.concat([df, rev_labeled], ignore_index=True)
    else:
        df = labeled_df

    # Drop rows with no category
    df = df[df['category'].notna() & (df['category'].str.strip() != '')].copy()
    df.reset_index(drop=True, inplace=True)

    desc_col = 'description_clean' if 'description_clean' in df.columns else 'description'

    # Before stats
    before_counts = df['category'].value_counts()
    print("\n  Before augmentation:")
    for cat, cnt in before_counts.items():
        bar = '█' * (cnt // 2)
        print(f"    {cat:<20} {cnt:>4}  {bar}")
    print(f"  Total: {len(df)}")

    # Augment minority classes
    new_rows = []
    for cat in df['category'].unique():
        cat_df = df[df['category'] == cat]
        count  = len(cat_df)

        if count >= MIN_SAMPLES:
            continue

        needed = MIN_SAMPLES - count
        print(f"\n  Augmenting '{cat}' — need {needed} more samples (have {count})...")

        samples = cat_df[desc_col].dropna().tolist()
        generated = 0

        for text in samples * 5:  # cycle through existing samples
            if generated >= needed:
                break

            # Try alias augmentation
            alias_variants = augment_with_aliases(str(text))
            for v in alias_variants:
                if generated >= needed:
                    break
                new_rows.append({
                    desc_col:   v,
                    'description_raw': v,
                    'category': cat,
                    'amount':   cat_df['amount'].mean() if 'amount' in cat_df else 100,
                    'type':     'DEBIT',
                    'source_file': 'augmented',
                    'augmented': True,
                })
                generated += 1

            # Try variation augmentation
            var_variants = augment_with_variations(str(text))
            for v in var_variants:
                if generated >= needed:
                    break
                new_rows.append({
                    desc_col:   v,
                    'description_raw': v,
                    'category': cat,
                    'amount':   cat_df['amount'].mean() if 'amount' in cat_df else 100,
                    'type':     'DEBIT',
                    'source_file': 'augmented',
                    'augmented': True,
                })
                generated += 1

        print(f"    Generated {generated} new samples for '{cat}'")

    if new_rows:
        aug_df = pd.DataFrame(new_rows)
        df = pd.concat([df, aug_df], ignore_index=True)

    df['augmented'] = df.get('augmented', False).fillna(False)

    # After stats
    after_counts = df['category'].value_counts()
    print("\n  After augmentation:")
    for cat, cnt in after_counts.items():
        bar = '█' * (cnt // 2)
        print(f"    {cat:<20} {cnt:>4}  {bar}")
    print(f"  Total: {len(df)}")

    orig = len(labeled_df) if labeled_df is not None else before_counts.sum()
    increase = round((len(df) - orig) / max(1, orig) * 100, 1)
    print(f"\n  Dataset size increase: +{increase}%")

    # Save
    out_path = DATA / "phase3_augmented.csv"
    df.to_csv(out_path, index=False, encoding='utf-8-sig')
    print(f"\n  Saved augmented data → {out_path}")

    print("\n✅ Phase 3 complete!\n")
    return df


if __name__ == '__main__':
    run_phase3()
