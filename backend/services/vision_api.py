import os

ISSUE_TYPES = ("Pothole", "Garbage", "Broken Light", "Water Leakage", "Other")

# Vision returns generic labels ("asphalt", "waste container"), so map label and
# description keywords onto our five issue types.
KEYWORDS = [
    ("Pothole", ("pothole", "crater", "asphalt", "road surface", "sinkhole", "manhole", "road damage", "crack", "tar")),
    ("Water Leakage", ("leak", "pipeline", "pipe", "water", "sewage", "drain", "flood", "tap", "burst")),
    ("Broken Light", ("street light", "streetlight", "street lamp", "lamp post", "lamppost", "light pole", "lamp", "light fixture", "bulb")),
    ("Garbage", ("garbage", "trash", "waste", "litter", "dump", "rubbish", "debris", "bin", "plastic bag")),
]

# A car in the frame drags in "Automotive lighting" and "Tail & Brake Light",
# which are not a broken street light. Same for a lit shop window.
IGNORED_LABELS = ("automotive", "vehicle", " car", "car ", "brake light", "tail light", "headlight", "traffic light")


def _match_labels(labels):
    """Vision returns labels in confidence order, so the first label that maps
    to an issue type wins. Scanning issue types first instead would let a
    low-confidence label outrank the actual subject of the photo."""
    for label in labels:
        text = (label or "").lower()
        if any(bad in text for bad in IGNORED_LABELS):
            continue
        for issue_type, words in KEYWORDS:
            if any(word in text for word in words):
                return issue_type
    return None


def _match(text):
    text = (text or "").lower()
    for issue_type, words in KEYWORDS:
        if any(word in text for word in words):
            return issue_type
    return None


def classify_image(image_bytes, description=""):
    """Return one of ISSUE_TYPES for a complaint photo.

    Takes the image bytes — photos live in the database, not on disk. Uses
    Google Cloud Vision label detection when credentials are configured and
    falls back to keyword matching on the description otherwise — an unconfigured
    or failing Vision API must not block a citizen from filing a complaint.
    """
    labels = _vision_labels(image_bytes)
    return _match_labels(labels) or _match(description) or "Other"


def _vision_labels(image_bytes):
    credentials = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
    if not credentials or not os.path.exists(credentials) or not image_bytes:
        return []

    try:
        from google.cloud import vision

        client = vision.ImageAnnotatorClient()
        image = vision.Image(content=image_bytes)
        response = client.label_detection(image=image, max_results=15)
        return [label.description for label in response.label_annotations]
    except Exception as e:
        print(f"[vision] classification failed, falling back to description: {e}", flush=True)
        return []


if __name__ == "__main__":
    assert classify_image(None, "huge pothole on the main road") == "Pothole"
    assert classify_image(None, "garbage not collected for days") == "Garbage"
    assert classify_image(None, "street light not working") == "Broken Light"
    assert classify_image(None, "water leaking from the pipeline") == "Water Leakage"
    assert classify_image(None, "the park bench is wobbly") == "Other"
    assert classify_image(None, "") == "Other"

    # real Vision output for a night photo of bin bags beside a parked car:
    # the car's lighting labels outrank the bags and used to win the whole match
    assert _match_labels(
        ["Automotive Exterior", "Automotive lighting", "Windshield", "Family car", "Car door", "Bin bag", "Night"]
    ) == "Garbage"
    # confidence order decides between two genuine matches
    assert _match_labels(["Street light", "Waste container"]) == "Broken Light"
    assert _match_labels(["Waste container", "Street light"]) == "Garbage"
    assert _match_labels(["Night", "Reflection", "Tar", "Manhole"]) == "Pothole"
    assert _match_labels(["Sky", "Cloud"]) is None
    print("image classification fallback OK")
