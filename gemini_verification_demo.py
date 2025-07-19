"""
Quick Demo: Enhanced Document Verification using AI
This shows how to use the intelligent document cross-verification
"""

import google.generativeai as genai
import json
import base64
from typing import Dict, List

# Configuration - Replace with your actual API key
GEMINI_API_KEY = "AIzaSyDWdj4Jgw_Ewz2cWkx1CU6MwGP3GFwj1qI"

def setup_gemini():
    """Initialize Gemini AI model"""
    genai.configure(api_key=GEMINI_API_KEY)
    return genai.GenerativeModel('gemini-1.5-flash')

def intelligent_document_verification(documents_data: List[Dict], model):
    """
    Use Gemini AI to intelligently verify if multiple documents belong to the same person
    This goes beyond simple text matching and considers:
    - Name variations and spelling differences
    - OCR errors and extraction inconsistencies  
    - Different document formats and standards
    - Cultural naming conventions
    - Logical consistency of information
    """
    
    prompt = f"""
You are an expert KYC analyst. Analyze these {len(documents_data)} documents to determine if they belong to the same person.

Your analysis should be INTELLIGENT and consider:

1. **Name Variations**: Account for nicknames, middle names, spelling variations, OCR errors
2. **Date Consistency**: Handle different date formats, partial dates
3. **Address Analysis**: Compare addresses logically (abbreviations, updates, formats)
4. **Document Authenticity**: Look for signs of tampering or inconsistencies
5. **Cross-Reference**: Check if documents reference each other
6. **Fraud Detection**: Identify red flags or suspicious patterns

DOCUMENTS TO ANALYZE:
"""
    
    for i, doc in enumerate(documents_data, 1):
        prompt += f"""
Document {i}:
Type: {doc.get('type', 'unknown')}
Extracted Data: {json.dumps(doc.get('extracted_data', {}), indent=2)}
Raw OCR Text: {doc.get('raw_text', '')[:300]}...

"""
    
    prompt += """
PROVIDE COMPREHENSIVE ANALYSIS IN JSON FORMAT:
{
  "same_person": boolean,
  "confidence_score": number (0-100),
  "analysis_summary": "detailed explanation of findings",
  "name_analysis": {
    "names_found": ["all name variations"],
    "consistent": boolean,
    "explanation": "name consistency analysis"
  },
  "date_analysis": {
    "dates_found": ["all birth dates found"],
    "consistent": boolean,
    "explanation": "date consistency analysis"  
  },
  "authenticity_assessment": {
    "risk_level": "LOW|MEDIUM|HIGH",
    "fraud_indicators": ["list any red flags"],
    "document_quality_scores": [0-100 for each document]
  },
  "recommendations": ["actionable next steps"],
  "final_decision": "APPROVE|REJECT|MANUAL_REVIEW"
}

Be thorough and prioritize security. Err on the side of caution.
"""
    
    try:
        response = model.generate_content(prompt)
        result = response.text
        
        # Clean up markdown formatting if present
        if "```json" in result:
            result = result.split("```json")[1].split("```")[0]
        
        return json.loads(result)
    
    except Exception as e:
        return {
            "same_person": False,
            "confidence_score": 0,
            "analysis_summary": f"Analysis failed: {e}",
            "final_decision": "MANUAL_REVIEW"
        }

def compare_with_reference(new_doc_data: Dict, reference_data: Dict, model):
    """
    Compare newly extracted document data with stored reference
    Uses Gemini AI to handle OCR variations and extraction differences
    """
    
    prompt = f"""
Compare this new document extraction with stored reference data. 
Determine if they represent the same person/document, accounting for:
- OCR variations and extraction method differences
- Partial vs complete information
- Different data formats
- Natural variations in presentation

NEW DOCUMENT DATA:
{json.dumps(new_doc_data, indent=2)}

STORED REFERENCE DATA:  
{json.dumps(reference_data, indent=2)}

Return JSON analysis:
{{
  "matches": boolean,
  "confidence": number (0-100),
  "key_differences": ["significant differences found"],
  "analysis": "detailed comparison explanation",
  "recommendation": "ACCEPT|REJECT|REVIEW"
}}
"""
    
    try:
        response = model.generate_content(prompt)
        result = response.text
        
        if "```json" in result:
            result = result.split("```json")[1].split("```")[0]
            
        return json.loads(result)
    
    except Exception as e:
        return {
            "matches": False,
            "confidence": 0,
            "key_differences": [f"Comparison failed: {e}"],
            "recommendation": "REVIEW"
        }

def demo_usage():
    """Demonstrate the enhanced verification system"""
    
    print("🧠 Enhanced Document Verification with Gemini AI")
    print("="*50)
    
    # Initialize Gemini
    try:
        model = setup_gemini()
        print("✅ Gemini AI initialized successfully")
    except Exception as e:
        print(f"❌ Failed to initialize Gemini: {e}")
        return
    
    # Example 1: Cross-document verification
    print("\n📋 Example 1: Cross-Document Verification")
    print("-" * 40)
    
    # Sample document data (in real usage, this would come from OCR)
    sample_documents = [
        {
            "type": "aadhaar",
            "extracted_data": {
                "name": "RAJESH KUMAR SINGH",
                "aadhaar_number": "1234 5678 9012",
                "date_of_birth": "15/08/1985",
                "address": "123 MG Road, Mumbai, Maharashtra"
            },
            "raw_text": "Name: RAJESH KUMAR SINGH, Aadhaar: 1234 5678 9012, DOB: 15/08/1985"
        },
        {
            "type": "pan",
            "extracted_data": {
                "name": "RAJESH K SINGH",  # Slight variation
                "pan_number": "ABCDE1234F",
                "date_of_birth": "15/08/1985",
                "father_name": "SURESH SINGH"
            },
            "raw_text": "Name: RAJESH K SINGH, PAN: ABCDE1234F, DOB: 15-08-1985"
        }
    ]
    
    # Run intelligent verification
    verification_result = intelligent_document_verification(sample_documents, model)
    
    print(f"🎯 Same Person: {verification_result.get('same_person', False)}")
    print(f"📊 Confidence: {verification_result.get('confidence_score', 0)}%")
    print(f"📝 Analysis: {verification_result.get('analysis_summary', '')}")
    print(f"✅ Decision: {verification_result.get('final_decision', 'UNKNOWN')}")
    
    # Example 2: Compare with reference data
    print(f"\n📦 Example 2: Compare with Stored Reference")
    print("-" * 40)
    
    new_extraction = {
        "name": "Rajesh Kumar Singh",  # Different case/format
        "aadhaar_number": "1234567890123",  # Without spaces
        "date_of_birth": "1985-08-15"  # Different date format
    }
    
    stored_reference = {
        "name": "RAJESH KUMAR SINGH",
        "aadhaar_number": "1234 5678 9012 3",
        "date_of_birth": "15/08/1985"
    }
    
    comparison_result = compare_with_reference(new_extraction, stored_reference, model)
    
    print(f"Matches: {comparison_result.get('matches', False)}")
    print(f"📊 Confidence: {comparison_result.get('confidence', 0)}%")
    print(f"📝 Analysis: {comparison_result.get('analysis', '')}")
    print(f"✅ Recommendation: {comparison_result.get('recommendation', 'UNKNOWN')}")
    
    if comparison_result.get('key_differences'):
        print("⚠️ Key Differences:")
        for diff in comparison_result['key_differences']:
            print(f"  - {diff}")
    
    print(f"\n🎯 Key Benefits of AI-Powered Verification:")
    print("✅ Handles OCR errors and extraction variations")
    print("✅ Understands name variations and cultural conventions")
    print("✅ Detects fraud patterns and anomalies")  
    print("✅ Provides confidence scores and detailed analysis")
    print("✅ Goes beyond simple text matching")
    print("✅ Reduces false negatives from formatting differences")

if __name__ == "__main__":
    demo_usage()
