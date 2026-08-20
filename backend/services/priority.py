ISSUE_WEIGHTS = {
    "Pothole": 10,
    "Broken Light": 8,
    "Water Leakage": 7,
    "Garbage": 5,
    "Other": 3,
}

URGENCY_MULTIPLIERS = {
    "High": 3,
    "Medium": 2,
    "Low": 1,
}


def calculate_priority_score(issue_type, urgency_level):
    weight = ISSUE_WEIGHTS.get(issue_type, 3)
    multiplier = URGENCY_MULTIPLIERS.get(urgency_level, 1)
    return weight * multiplier


if __name__ == "__main__":
    assert calculate_priority_score("Pothole", "High") == 30
    assert calculate_priority_score("Garbage", "Low") == 5
    assert calculate_priority_score("Water Leakage", "Medium") == 14
    # unknown inputs fall back to the Other weight and the Low multiplier
    assert calculate_priority_score("Alien Invasion", "High") == 9
    assert calculate_priority_score("Pothole", "Whenever") == 10
    assert calculate_priority_score(None, None) == 3
    print("priority scoring OK")
