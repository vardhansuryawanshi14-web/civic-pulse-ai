import pathlib

import joblib

ML_DIR = pathlib.Path(__file__).resolve().parent.parent / "ml"

# Loaded once at import — never retrain or reload per request.
try:
    _model = joblib.load(ML_DIR / "model.pkl")
    _vectorizer = joblib.load(ML_DIR / "vectorizer.pkl")
except Exception as e:
    _model = _vectorizer = None
    print(f"[nlp] urgency model not loaded ({e}); run: python ml/train_model.py", flush=True)

VALID = {"Low", "Medium", "High"}


def predict_urgency(description):
    """Classify a complaint description as Low, Medium or High.

    Falls back to Medium when the model is missing or the text is unusable, so a
    complaint is never rejected just because the classifier is unavailable.
    """
    if not description or not description.strip() or _model is None:
        return "Medium"

    try:
        prediction = _model.predict(_vectorizer.transform([description]))[0]
    except Exception as e:
        print(f"[nlp] prediction failed: {e}", flush=True)
        return "Medium"

    return prediction if prediction in VALID else "Medium"


if __name__ == "__main__":
    assert predict_urgency("open manhole someone got injured urgent danger") == "High"
    assert predict_urgency("minor crack please fix whenever you are free") == "Low"
    assert predict_urgency("") == "Medium"
    assert predict_urgency(None) == "Medium"
    print("urgency prediction OK")
