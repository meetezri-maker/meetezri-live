from fastapi import FastAPI
from dotenv import load_dotenv
import os

load_dotenv()

app = FastAPI()

@app.get("/health")
def health_check():
    return {"status": "ok", "service": "ai"}

@app.get("/v1/insights/daily-summary")
def get_daily_summary():
    return {"summary": "Placeholder summary"}
