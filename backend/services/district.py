"""Canonical form for the district (stored in the `ward` column).

Citizens type their district freely, so "kalwa  west", "Kalwa West" and
"KALWA WEST" all mean the same queue. Officer access is an exact string match
(`Complaint.ward == current_user.ward`), so every write path canonicalises here
first — otherwise a complaint silently becomes invisible to the officer who
should see it.
"""


def normalize_district(value):
    """Collapse whitespace and capitalise each word. Empty input returns ''."""
    return " ".join(word.capitalize() for word in (value or "").split())


if __name__ == "__main__":
    assert normalize_district("kalwa west") == "Kalwa West"
    assert normalize_district("  Kalwa   West  ") == "Kalwa West"
    assert normalize_district("KALWA WEST") == "Kalwa West"
    assert normalize_district("Ward 1") == "Ward 1"
    assert normalize_district("") == ""
    assert normalize_district(None) == ""
    # the point of all this: three spellings, one queue
    spellings = ["kalwa west", "KALWA WEST", " Kalwa  West "]
    assert len({normalize_district(s) for s in spellings}) == 1
    print("district normalization OK")
