"""Fills an empty database with demo accounts and realistic complaints.

Run after create_db.py. Safe to re-run: it skips anything already seeded, so it
never duplicates the demo data. `--wipe` removes what a previous run created
(seeded complaints and notifications, demo accounts) before seeding again.

Urgency is written explicitly here rather than being taken from the NLP model,
so the demo has a predictable spread of red/amber/green rows. A complaint filed
through the UI still gets its urgency from the model as usual.
"""

import sys
from datetime import datetime, timedelta

from app import app
from models import db, Complaint, Notification, User
from services.priority import calculate_priority_score

DEMO_PASSWORD = "demo1234"

CITIZENS = [
    ("Priya Menon", "citizen@civicpulse.local", "9820011223"),
    ("Rahul Deshmukh", "rahul@civicpulse.local", "9820044556"),
    ("Sana Qureshi", "sana@civicpulse.local", "9820077889"),
]

OFFICERS = [
    ("Anil Kadam", "officer@civicpulse.local", "Kalwa West", "9821000111"),
    ("Meera Joshi", "officer.majiwada@civicpulse.local", "Majiwada", "9821000222"),
    ("Sunil Pawar", "officer.wagle@civicpulse.local", "Wagle Estate", "9821000333"),
]

# (district, latitude, longitude) — the map clusters around Thane.
DISTRICTS = [
    ("Kalwa West", 19.1930, 72.9930),
    ("Majiwada", 19.2320, 72.9760),
    ("Wagle Estate", 19.1980, 72.9640),
    ("Vartak Nagar", 19.2100, 72.9700),
]

# (district index, issue type, urgency, status, days ago, description, landmark)
COMPLAINTS = [
    (0, "Pothole", "High", "Open", 1, "Deep pothole right at the junction, two bikes have already skidded in it this week. Water collects inside so nobody sees how deep it is.", "Near Kalwa Naka bus stop"),
    (0, "Water Leakage", "High", "In Progress", 3, "Main pipeline has burst and water has been running down the road for three days. Whole lane is flooded and supply pressure has dropped.", "Behind Shivaji Chowk market"),
    (0, "Broken Light", "Medium", "Open", 2, "Street light outside the school has not worked for two weeks. Children leaving evening classes walk in the dark.", "Opposite Municipal School No. 4"),
    (0, "Garbage", "Medium", "Resolved", 12, "Garbage bin overflowing since the weekend, stray dogs are dragging waste across the footpath.", "Kalwa West service road"),
    (0, "Pothole", "Medium", "In Progress", 6, "Series of potholes on the stretch after the flyover, autos slow to a crawl and traffic backs up every morning.", "Kalwa flyover exit"),
    (0, "Garbage", "Low", "Open", 4, "Construction debris dumped on the corner plot and not cleared for over a week.", "Near Sai Mandir lane"),
    (0, "Other", "Low", "Resolved", 20, "Footpath tiles are loose near the corner and wobble when stepped on.", "Kalwa station road"),
    (1, "Pothole", "High", "Open", 1, "Huge crater in the middle of the road after last night's rain, a school bus scraped its underside this morning.", "Majiwada junction"),
    (1, "Water Leakage", "Medium", "In Progress", 5, "Drain is choked and sewage is backing up onto the road outside the shops.", "Near Majiwada bridge"),
    (1, "Broken Light", "High", "Open", 2, "Entire row of street lights on the highway service road is dead, the stretch is pitch black after 8pm and feels unsafe.", "Service road near Viviana"),
    (1, "Garbage", "Medium", "Open", 3, "Garbage truck has skipped our lane for four days, bins are overflowing onto the road.", "Majiwada residential lane 2"),
    (1, "Pothole", "Low", "Resolved", 18, "Small pothole near the society gate, gets worse when it rains.", "Sunrise Society gate"),
    (1, "Other", "Medium", "In Progress", 8, "Stray cattle blocking the main road every evening, traffic has to squeeze past.", "Majiwada market road"),
    (2, "Broken Light", "Medium", "Open", 4, "Two street lights flickering all night outside the industrial gate, they go off completely for long stretches.", "Wagle Estate Road No. 16"),
    (2, "Garbage", "High", "In Progress", 2, "Illegal dumping ground has formed on the empty plot, the smell is unbearable and it is right next to the residential block.", "Behind Wagle Estate MIDC unit"),
    (2, "Water Leakage", "High", "Open", 1, "Water gushing from a broken valve near the factory gate, road is waterlogged and workers are wading through it.", "Wagle Estate Road No. 22"),
    (2, "Pothole", "Medium", "Open", 7, "Road surface has broken up outside the truck entrance, heavy vehicles jolt badly over it.", "MIDC truck entrance"),
    (2, "Garbage", "Low", "Resolved", 15, "Litter piling up around the bus stop bench.", "Wagle Estate bus depot"),
    (2, "Other", "Low", "Open", 9, "Signboard at the corner has come loose and hangs over the footpath.", "Road No. 16 corner"),
    (3, "Pothole", "High", "In Progress", 3, "Long stretch of broken road with sharp edges, an elderly man on a scooter fell here yesterday.", "Vartak Nagar main road"),
    (3, "Broken Light", "Low", "Resolved", 22, "One street light out at the end of the lane.", "Vartak Nagar lane 5"),
    (3, "Water Leakage", "Medium", "Open", 5, "Tap on the public standpost is broken and water runs continuously all day.", "Near Vartak Nagar garden"),
    (3, "Garbage", "High", "Open", 2, "Waste has been dumped along the nallah and is blocking the water flow, worried about flooding when it rains.", "Nallah side, Vartak Nagar"),
    (3, "Other", "Medium", "Resolved", 16, "Manhole cover was missing on the footpath, dangerous at night.", "Vartak Nagar crossing"),
]

STATUS_MESSAGE = {
    "In Progress": "Your complaint #{id} is now In Progress.",
    "Resolved": "Your complaint #{id} has been marked Resolved.",
}


def get_or_create_user(name, email, role, ward=None, phone=None):
    user = User.query.filter_by(email=email).first()
    if user:
        return user, False
    user = User(name=name, email=email, role=role, ward=ward, phone=phone)
    user.set_password(DEMO_PASSWORD)
    db.session.add(user)
    return user, True


def wipe():
    emails = [c[1] for c in CITIZENS] + [o[1] for o in OFFICERS]
    users = User.query.filter(User.email.in_(emails)).all()
    ids = [u.id for u in users]
    if ids:
        complaints = Complaint.query.filter(Complaint.citizen_id.in_(ids)).all()
        complaint_ids = [c.id for c in complaints]
        if complaint_ids:
            Notification.query.filter(
                Notification.complaint_id.in_(complaint_ids)
            ).delete(synchronize_session=False)
        # a notification can also point at the user without a complaint
        Notification.query.filter(Notification.user_id.in_(ids)).delete(
            synchronize_session=False
        )
        Complaint.query.filter(Complaint.citizen_id.in_(ids)).delete(
            synchronize_session=False
        )
        User.query.filter(User.id.in_(ids)).delete(synchronize_session=False)
        db.session.commit()
    print(f"wiped {len(ids)} demo accounts and their complaints")


def seed():
    citizens = [get_or_create_user(n, e, "citizen", phone=p)[0] for n, e, p in CITIZENS]
    officers = [
        get_or_create_user(n, e, "officer", ward=w, phone=p)[0]
        for n, e, w, p in OFFICERS
    ]
    db.session.flush()  # ids are needed below

    officer_by_ward = {o.ward: o for o in officers}
    now = datetime.now()
    created = 0

    for index, (district, issue, urgency, status, days, text, landmark) in enumerate(
        COMPLAINTS
    ):
        citizen = citizens[index % len(citizens)]
        ward, lat, lng = DISTRICTS[district]

        # re-running must not duplicate: the citizen plus the text is unique enough
        if Complaint.query.filter_by(citizen_id=citizen.id, description=text).first():
            continue

        officer = officer_by_ward.get(ward)
        filed_at = now - timedelta(days=days, hours=index % 12)
        complaint = Complaint(
            citizen_id=citizen.id,
            description=text,
            ward=ward,
            # spread the pins so the heatmap does not stack them on one point
            latitude=round(lat + (index % 5) * 0.0018 - 0.0036, 6),
            longitude=round(lng + (index % 4) * 0.0021 - 0.0031, 6),
            landmark=landmark,
            issue_type=issue,
            urgency_level=urgency,
            priority_score=calculate_priority_score(issue, urgency),
            status=status,
            officer_id=officer.id if officer and status != "Open" else None,
            created_at=filed_at,
            updated_at=filed_at if status == "Open" else filed_at + timedelta(days=1),
        )
        db.session.add(complaint)
        db.session.flush()
        created += 1

        if status in STATUS_MESSAGE:
            db.session.add(
                Notification(
                    user_id=citizen.id,
                    complaint_id=complaint.id,
                    message=STATUS_MESSAGE[status].format(id=complaint.id),
                    # recent ones stay unread so the bell shows a badge
                    is_read=days > 10,
                    created_at=complaint.updated_at,
                )
            )

    db.session.commit()
    print(f"seeded {created} complaints ({len(COMPLAINTS) - created} already present)")
    print(f"demo login: {CITIZENS[0][1]} / {OFFICERS[0][1]} — password {DEMO_PASSWORD}")


if __name__ == "__main__":
    with app.app_context():
        if "--wipe" in sys.argv:
            wipe()
        seed()
