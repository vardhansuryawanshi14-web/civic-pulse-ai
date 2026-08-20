import io
from datetime import datetime

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

TABLE_STYLE = TableStyle(
    [
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1f2937")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#9ca3af")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f3f4f6")]),
    ]
)


def _breakdown_table(title, mapping, styles):
    rows = [[title, "Complaints"]] + [[str(k), str(v)] for k, v in sorted(mapping.items())]
    if len(rows) == 1:
        return Paragraph(f"<b>{title}</b>: no data yet", styles["Normal"])
    table = Table(rows, colWidths=[90 * mm, 30 * mm])
    table.setStyle(TABLE_STYLE)
    return table


def build_report(analytics, complaints):
    """Render the admin PDF report into an in-memory buffer."""
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=A4, title="CivicPulse Report",
        leftMargin=18 * mm, rightMargin=18 * mm, topMargin=18 * mm, bottomMargin=18 * mm,
    )
    styles = getSampleStyleSheet()
    cell = styles["BodyText"].clone("cell")
    cell.fontSize = 8
    cell.leading = 10

    story = [
        Paragraph("CivicPulse — Complaint Report", styles["Title"]),
        Paragraph(
            f"Generated {datetime.now().strftime('%d %b %Y, %H:%M')} · "
            f"{analytics['total']} complaints · {analytics['citizens']} citizens · "
            f"{analytics['officers']} officers",
            styles["Normal"],
        ),
        Spacer(1, 8 * mm),
        _breakdown_table("Issue type", analytics["by_issue_type"], styles),
        Spacer(1, 5 * mm),
        _breakdown_table("Status", analytics["by_status"], styles),
        Spacer(1, 5 * mm),
        _breakdown_table("District", analytics["by_ward"], styles),
        Spacer(1, 8 * mm),
        Paragraph("Complaints by priority", styles["Heading2"]),
    ]

    if complaints:
        rows = [["ID", "Issue", "Urgency", "Score", "Status", "District", "Description"]]
        for c in complaints:
            rows.append([
                str(c.id), c.issue_type or "-", c.urgency_level or "-", str(c.priority_score),
                c.status, c.ward, Paragraph((c.description or "")[:180], cell),
            ])
        table = Table(rows, colWidths=[10 * mm, 22 * mm, 17 * mm, 12 * mm, 20 * mm, 20 * mm, 73 * mm], repeatRows=1)
        table.setStyle(TABLE_STYLE)
        story.append(table)
    else:
        story.append(Paragraph("No complaints recorded yet.", styles["Normal"]))

    doc.build(story)
    buffer.seek(0)
    return buffer


if __name__ == "__main__":
    class FakeComplaint:
        id, issue_type, urgency_level, priority_score = 1, "Pothole", "High", 30
        status, ward, description = "Open", "Ward 1", "Deep pothole near the bus stop."

    data = {
        "by_issue_type": {"Pothole": 1}, "by_status": {"Open": 1}, "by_ward": {"Ward 1": 1},
        "by_urgency": {"High": 1}, "total": 1, "officers": 1, "citizens": 2,
    }
    pdf = build_report(data, [FakeComplaint()]).read()
    assert pdf[:4] == b"%PDF", pdf[:20]
    assert len(pdf) > 1000, len(pdf)
    # empty system must still produce a valid report, not crash
    empty = build_report(
        {"by_issue_type": {}, "by_status": {}, "by_ward": {}, "by_urgency": {},
         "total": 0, "officers": 0, "citizens": 0}, []
    ).read()
    assert empty[:4] == b"%PDF"
    print("pdf report OK", len(pdf), "bytes")
