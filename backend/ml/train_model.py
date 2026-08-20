"""Trains the urgency classifier (TF-IDF + Logistic Regression) and writes
model.pkl / vectorizer.pkl next to this file. Run it once:

    python ml/train_model.py

The app loads the pickles at startup and never retrains at request time.
"""

import pathlib

import joblib
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report

HERE = pathlib.Path(__file__).parent

# ponytail: hand-written seed corpus — swap in real labelled complaints once the
# system has collected enough of them, the training code below stays the same
TRAINING_DATA = [
    # --- High: danger to life, accidents, outages, contamination ---
    ("huge pothole caused a bike accident yesterday someone got injured", "High"),
    ("open manhole in the middle of the road a child almost fell in", "High"),
    ("live electric wire hanging low over the footpath very dangerous", "High"),
    ("sewage water mixing with drinking water supply people falling sick", "High"),
    ("major water pipeline burst entire road flooded traffic stopped", "High"),
    ("street light pole is sparking and people are scared to walk there", "High"),
    ("garbage dump caught fire thick smoke entering our houses", "High"),
    ("deep pit dug by contractor left open no barricade accident risk", "High"),
    ("road completely blocked by fallen tree ambulance cannot pass", "High"),
    ("drainage overflowing into homes urgent action needed immediately", "High"),
    ("massive pothole on highway several two wheelers have fallen", "High"),
    ("no street lights for a week area is unsafe robbery happened", "High"),
    ("water leakage near electric transformer risk of electrocution", "High"),
    ("medical waste dumped near school children playing around it", "High"),
    ("bridge railing broken vehicles can fall into the canal", "High"),
    ("gas smell from broken pipeline please send someone urgently", "High"),
    ("collapsed wall on footpath dangerous for pedestrians", "High"),
    ("dead animal rotting on road severe stench disease spreading", "High"),
    ("main road caved in huge crater formed after last night rain", "High"),
    ("stagnant sewage water dengue cases rising in our lane", "High"),
    ("broken high mast light fell down last night could have killed someone", "High"),
    ("acid like liquid leaking from tanker into the drain", "High"),
    # --- Medium: real disruption, needs attention soon, not life threatening ---
    ("pothole near the bus stop is growing bigger every week", "Medium"),
    ("street light not working for the last five days on our lane", "Medium"),
    ("garbage has not been collected in our area for four days", "Medium"),
    ("water leaking continuously from the pipeline near the park", "Medium"),
    ("drain is partially blocked water collects during rain", "Medium"),
    ("several potholes on the service road making commute difficult", "Medium"),
    ("dustbin is overflowing and stray dogs scatter waste everywhere", "Medium"),
    ("two street lights flicker all night and go off frequently", "Medium"),
    ("tap water pressure very low since the pipeline repair work", "Medium"),
    ("road patch work done badly surface is uneven again", "Medium"),
    ("public toilet not cleaned properly bad smell in market area", "Medium"),
    ("water meter leaking slowly wasting water daily", "Medium"),
    ("garbage truck skips our street often waste piles up", "Medium"),
    ("footpath tiles broken at several places people trip sometimes", "Medium"),
    ("street light timer wrong lights stay on during the day", "Medium"),
    ("mosquito breeding in stagnant water near the community hall", "Medium"),
    ("pothole filled with water cannot judge depth while driving", "Medium"),
    ("drain cover shifted slightly needs to be placed back", "Medium"),
    ("construction debris left on the roadside for two weeks", "Medium"),
    ("leaking public tap in the garden running all day", "Medium"),
    ("bin missing from our corner people dump waste on the ground", "Medium"),
    ("road markings faded near the junction confusing for drivers", "Medium"),
    # --- Low: minor, cosmetic, routine requests ---
    ("small pothole starting to form near my gate please check sometime", "Low"),
    ("street light glass cover is dusty light looks dim", "Low"),
    ("garbage bin lid is broken please replace when possible", "Low"),
    ("minor water dripping from a joint near the compound wall", "Low"),
    ("please repaint the zebra crossing it has faded a little", "Low"),
    ("some litter near the park bench needs sweeping", "Low"),
    ("signboard is slightly tilted please straighten it", "Low"),
    ("grass on the divider has grown a bit needs trimming", "Low"),
    ("small crack on the footpath not causing any trouble yet", "Low"),
    ("request additional dustbin near the bus stop for convenience", "Low"),
    ("street light pole paint is peeling off looks bad", "Low"),
    ("minor leakage in the public tap handle drips slowly", "Low"),
    ("dry leaves collected near the gate please clear them", "Low"),
    ("bench in the park needs repainting before the festival", "Low"),
    ("slight uneven tile at the entrance of the garden", "Low"),
    ("old poster stuck on the wall please remove it", "Low"),
    ("garbage collection time could be earlier request only", "Low"),
    ("small stone pile left after work please clear whenever free", "Low"),
    ("street name board letters are fading slowly", "Low"),
    ("minor rust on the park gate needs attention someday", "Low"),
    ("light in the corridor is dim would be nice to upgrade", "Low"),
    ("few weeds growing along the footpath edge", "Low"),
]


# The hand-written rows above are realistic but each one is worded uniquely, so
# TF-IDF sees almost no repeated urgency vocabulary and lands near chance. These
# templates repeat the words that actually carry urgency across many subjects,
# which is the signal the classifier needs.
SUBJECTS = [
    "pothole on the road",
    "street light not working",
    "garbage pile",
    "water leakage from the pipeline",
    "open drain",
    "broken footpath",
    "sewage overflow",
    "damaged road signboard",
    "blocked storm drain",
    "burst water main",
]

TEMPLATES = {
    "High": [
        "{s} is extremely dangerous someone already got injured",
        "urgent {s} needs immediate action there is serious accident risk",
        "{s} caused an accident last night please send a team right now",
        "emergency {s} is life threatening for everyone in the area",
        "critical {s} people are getting hurt daily act immediately",
        "{s} is severe and unsafe a child almost died yesterday",
        "please treat this as emergency {s} risk of major injury",
        "{s} has become a huge hazard ambulance could not pass",
        "very dangerous {s} disease is spreading fast urgent help needed",
        "{s} is an immediate danger to life please fix today",
    ],
    "Medium": [
        "{s} has not been fixed for several days and is causing problems",
        "{s} is getting worse every week please look into it soon",
        "{s} is inconveniencing residents daily needs attention this week",
        "moderate {s} affecting our commute please schedule a repair",
        "{s} has been reported before and still not resolved",
        "{s} is troubling many people in the lane kindly attend soon",
        "recurring {s} keeps coming back after every rain",
        "{s} needs repair work it is disturbing but not an emergency",
        "{s} is a growing problem in the neighbourhood please act soon",
        "{s} is causing difficulty for pedestrians and vehicles",
    ],
    "Low": [
        "minor {s} please look into it whenever you are free",
        "small {s} not causing any trouble yet just informing",
        "slight {s} would be nice to fix someday no hurry",
        "{s} is a cosmetic issue please add it to your routine list",
        "very small {s} nothing serious just a request",
        "{s} looks slightly untidy could be cleaned up eventually",
        "requesting routine maintenance for {s} at your convenience",
        "{s} is a small nuisance no urgency at all",
        "barely noticeable {s} sharing it just for the record",
        "{s} can be handled during the next scheduled visit",
    ],
}


def build_dataset():
    rows = list(TRAINING_DATA)
    for label, templates in TEMPLATES.items():
        for template in templates:
            for subject in SUBJECTS:
                rows.append((template.format(s=subject), label))
    return rows


def train():
    rows = build_dataset()
    print(f"training rows: {len(rows)}")
    texts = [t for t, _ in rows]
    labels = [label for _, label in rows]

    x_train, x_test, y_train, y_test = train_test_split(
        texts, labels, test_size=0.25, random_state=42, stratify=labels
    )

    vectorizer = TfidfVectorizer(ngram_range=(1, 2), sublinear_tf=True, min_df=1)
    model = LogisticRegression(max_iter=1000, class_weight="balanced")

    model.fit(vectorizer.fit_transform(x_train), y_train)
    print(classification_report(y_test, model.predict(vectorizer.transform(x_test)), zero_division=0))

    # refit on everything now that the split has told us how it generalises
    vectorizer = TfidfVectorizer(ngram_range=(1, 2), sublinear_tf=True, min_df=1)
    model = LogisticRegression(max_iter=1000, class_weight="balanced")
    model.fit(vectorizer.fit_transform(texts), labels)

    joblib.dump(model, HERE / "model.pkl")
    joblib.dump(vectorizer, HERE / "vectorizer.pkl")
    print(f"saved {HERE / 'model.pkl'} and {HERE / 'vectorizer.pkl'}")


if __name__ == "__main__":
    train()
