import json
from app.services.classifier import categorize_transactions

mock_data = [
    # Should be Personal & UPI (<500, small word count, no digits)
    {"description": "Rahul Sharma", "amount": 150.0},
    {"description": "amita", "amount": 40.0},
    
    # Should be Food & Dining (contains food keywords)
    {"description": "krishna tiffin center", "amount": 80.0},
    {"description": "shree ram hotel", "amount": 300.0},
    {"description": "eat fit online", "amount": 250.0},
    {"description": "mess fee", "amount": 1000.0},
    
    # Should be Shopping (contains shopping keywords)
    {"description": "surya super mart", "amount": 1200.0},
    {"description": "vijaya stores", "amount": 450.0},
    {"description": "local bazaar", "amount": 600.0},
    
    # Should be caught by TF-IDF or explicit rules
    {"description": "Zomato online", "amount": 200.0}, # Food & Dining
    {"description": "Uber ride", "amount": 150.0}, # Transportation
    {"description": "Amazon pay", "amount": 500.0}, # Shopping
    {"description": "Jio recharge", "amount": 299.0}, # Utilities
    {"description": "Spotify monthly", "amount": 119.0}, # Subscriptions
    
    # Still Unrecognizable -> Review
    {"description": "p1 xqy abcd", "amount": 1000.0},
    {"description": "txn 9912", "amount": 25000.0},
    {"description": "ACH 5519", "amount": 30.0}
]

for txn in mock_data:
    txn['type'] = 'DEBIT'
    txn['date'] = '2025-02-15'

resp = categorize_transactions(mock_data)
with open('dist_result.json', 'w', encoding='utf-8') as f:
    json.dump({
        "transactions": [
            {"desc": t["description"], "amount": t["amount"], "category": t["category"]}
            for t in resp['transactions']
        ],
        "breakdown": resp['category_breakdown']
    }, f, indent=2)
