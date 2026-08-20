"""Re-run photo classification and priority scoring over existing complaints.

Complaints filed before the vision_api label-ordering fix kept whatever type
they were given at submit time, so a photo with a car in frame is still stored
as "Broken Light". This walks the table, recomputes issue type and score from
the stored photo, and reports what would change.

    python reclassify.py            # dry run, prints the diff
    python reclassify.py --apply    # writes the changes
"""

import os
import sys

from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env"))

from app import app  # noqa: E402  (app import needs the env loaded first)
from models import db  # noqa: E402
from models.complaint import Complaint  # noqa: E402
from services.priority import calculate_priority_score  # noqa: E402
from services.vision_api import classify_image  # noqa: E402

def main(apply_changes):
    with app.app_context():
        complaints = Complaint.query.order_by(Complaint.id).all()
        changed = 0

        for complaint in complaints:
            if not complaint.photo_data:
                print(f"#{complaint.id}: no stored photo, skipped")
                continue

            issue_type = classify_image(complaint.photo_data, complaint.description or "")
            score = calculate_priority_score(issue_type, complaint.urgency_level)

            if issue_type == complaint.issue_type and score == complaint.priority_score:
                continue

            changed += 1
            print(
                f"#{complaint.id}: {complaint.issue_type} ({complaint.priority_score})"
                f" -> {issue_type} ({score})"
            )
            if apply_changes:
                complaint.issue_type = issue_type
                complaint.priority_score = score

        if apply_changes:
            db.session.commit()
            print(f"\napplied to {changed} complaint(s)")
        else:
            print(f"\n{changed} complaint(s) would change. Re-run with --apply to write.")


if __name__ == "__main__":
    main("--apply" in sys.argv)
