# app/services/llm_report.py

from groq import Groq 
from app.core.config import settings

def generate_anomaly_report(crime_label: str, confidence: float) -> str:
    api_key = settings.GROQ_API_KEY
    if not api_key:
        return f"Warning: GROQ_API_KEY is not set. Cannot generate an anomaly report for {crime_label}."
    
    client = Groq(api_key=api_key)
    prompt = f"""
A video anomaly detection system has predicted a crime.

Crime type: {crime_label}
Model confidence: {confidence:.4f}

Explain in simple English:
1) What this type of crime usually looks like in CCTV footage.
2) Why it is dangerous.
3) How security staff / shop owners / authorities can prevent or reduce this crime.
Use short headings and bullet points where helpful.
"""

    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {"role": "system", "content": "You are a helpful security and crime-prevention expert."},
            {"role": "user", "content": prompt},
        ],
        temperature=0.4,
    )

    return response.choices[0].message.content
