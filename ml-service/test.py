import requests
with open("test.csv", "w") as f:
    f.write("date,amount,description\n2023-01-01,-50,Test Merchant")

response = requests.post("http://127.0.0.1:8000/api/process-statement", files={"file": open("test.csv", "rb")})
print(response.status_code)
print(response.text)
