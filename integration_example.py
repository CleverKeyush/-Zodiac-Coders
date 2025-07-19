"""
Integration Example: Replace Simple Text Matching with AI-Powered Verification

This example shows how to upgrade from basic hardcoded verification 
to intelligent verification.
"""

import google.generativeai as genai
import requests
import json

# Your current configuration
GEMINI_API_KEY = "AIzaSyDWdj4Jgw_Ewz2cWkx1CU6MwGP3GFwj1qI"
PINATA_API_KEY = "5c3e3eb6db3ae1810e3e"
PINATA_SECRET_API_KEY = "ydc398e7d54a0d89f4b9be0ec364d09df7c39206b4438d0e1b8b6746fc04fc87b"

# Sample image path and IPFS URL from your code
image_path = "./1094D4_1.jpg"
ipfs_json_url = "https://gateway.pinata.cloud/ipfs/QmScUbX9mA49aQuQd9FkDPaX1QcG77ZSVbr3DdbJv9D8S8"

# Setup Gemini
genai.configure(api_key=GEMINI_API_KEY)
model = genai.GenerativeModel("gemini-1.5-flash")

def extract_text_gemini_enhanced(image_path):
    """Enhanced OCR extraction with intelligent document analysis"""
    print("Running enhanced OCR...")
    
    try:
        with open(image_path, 'rb') as image_file:
            image_data = image_file.read()
        
        response = model.generate_content([
            """Extract information from this Aadhaar card with high accuracy. 
            Focus on getting the exact text as it appears. 
            Return in JSON format with keys: name, aadhaar_number, date_of_birth, address, gender.
            Be precise with number extraction and handle any OCR challenges.""",
            {"mime_type": "image/jpeg", "data": image_data}
        ])
        
        result = response.text
        
        try:
            # Try to parse as JSON
            ocr_json = json.loads(result)
        except json.JSONDecodeError:
            print("⚠️ Response not in JSON format, attempting to parse...")
            # Fallback parsing if JSON parsing fails
            ocr_json = parse_text_response(result)
        
        return ocr_json
    
    except Exception as e:
        print(f"❌ Gemini OCR error: {e}")
        return None

def parse_text_response(text):
    """Parse non-JSON text response"""
    import re
    
    result = {}
    
    # Extract common patterns
    patterns = {
        'name': r'(?:name|नाम)[:\s]+([a-zA-Z\s]+)',
        'aadhaar_number': r'(\d{4}\s?\d{4}\s?\d{4})',
        'date_of_birth': r'(?:dob|birth|जन्म)[:\s]*(\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4})',
    }
    
    for key, pattern in patterns.items():
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            result[key] = match.group(1).strip()
    
    return result

def load_json_from_ipfs(ipfs_url):
    """Load reference data from IPFS (unchanged from your code)"""
    print("📦 Loading JSON from IPFS...")
    response = requests.get(ipfs_url)
    if response.status_code != 200:
        print("❌ Failed to load IPFS data:", response.status_code)
        return None
    return response.json()

def compare_data_simple(ocr_data, ipfs_data):
    """Your original simple comparison method"""
    return (
        ocr_data.get("name") == ipfs_data.get("name")
        and ocr_data.get("aadhaar_number") == ipfs_data.get("aadhaar_number")
    )

def compare_data_ai_powered(ocr_data, ipfs_data):
    """Enhanced AI-powered comparison that handles variations"""
    print("🧠 Running AI-powered data comparison...")
    
    prompt = f"""
Compare these two sets of data to determine if they represent the same person.
Be intelligent about variations - consider OCR errors, formatting differences, 
name variations, and data presentation differences.

NEW OCR DATA:
{json.dumps(ocr_data, indent=2)}

REFERENCE DATA FROM IPFS:
{json.dumps(ipfs_data, indent=2)}

Focus on core identity matching rather than exact text matches.
Consider:
1. Name variations (nicknames, spelling, case differences)
2. Number formatting (spaces, dashes in Aadhaar numbers)
3. Date format differences (DD/MM/YYYY vs MM/DD/YYYY vs YYYY-MM-DD)
4. OCR errors (8 vs B, 0 vs O, etc.)
5. Partial data matches

Return JSON:
{{
  "matches": boolean,
  "confidence": number (0-100),
  "analysis": "detailed explanation",
  "field_comparisons": {{
    "name": {{"matches": boolean, "explanation": ""}},
    "aadhaar_number": {{"matches": boolean, "explanation": ""}},
    "date_of_birth": {{"matches": boolean, "explanation": ""}}
  }},
  "recommendation": "ACCEPT|REJECT|MANUAL_REVIEW"
}}
"""
    
    try:
        response = model.generate_content(prompt)
        result = response.text
        
        # Clean JSON response
        if "```json" in result:
            result = result.split("```json")[1].split("```")[0]
        
        analysis = json.loads(result)
        return analysis
        
    except Exception as e:
        print(f"❌ AI comparison failed: {e}")
        return {
            "matches": False,
            "confidence": 0,
            "analysis": f"AI comparison failed: {e}",
            "recommendation": "MANUAL_REVIEW"
        }

def upload_json_to_pinata(json_data):
    """Upload verification results to IPFS (unchanged from your code)"""
    print("📤 Uploading verified data to IPFS via Pinata...")
    url = "https://api.pinata.cloud/pinning/pinJSONToIPFS"
    headers = {
        "pinata_api_key": PINATA_API_KEY,
        "pinata_secret_api_key": PINATA_SECRET_API_KEY,
        "Content-Type": "application/json"
    }
    payload = {
        "pinataMetadata": {"name": "verified_kyc_ai"},
        "pinataContent": json_data
    }
    
    try:
        res = requests.post(url, headers=headers, data=json.dumps(payload))
        if res.status_code == 200:
            ipfs_hash = res.json()["IpfsHash"]
            print("✅ Uploaded! IPFS Hash:", ipfs_hash)
            print("URL: https://gateway.pinata.cloud/ipfs/" + ipfs_hash)
            return ipfs_hash
        else:
            print("❌ Failed to upload:", res.status_code, res.text)
            return None
    except Exception as e:
        print(f"❌ Upload error: {e}")
        return None

def main():
    """Main execution with both simple and AI-powered comparison"""
    print("🚀 KYC Verification: Simple vs AI-Powered Comparison")
    print("=" * 60)
    
    # Check if image file exists
    import os
    if not os.path.exists(image_path):
        print(f"❌ Image file not found: {image_path}")
        print("📝 Please update the 'image_path' variable with your actual image file")
        return
    
    # Step 1: Extract text using enhanced Gemini OCR
    print("\n📋 Step 1: Enhanced OCR Extraction")
    ocr_data = extract_text_gemini_enhanced(image_path)
    
    if not ocr_data:
        print("❌ OCR extraction failed")
        return
    
    print("✅ OCR Extracted Data:", json.dumps(ocr_data, indent=2))
    
    # Step 2: Load reference data from IPFS
    print("\n📦 Step 2: Loading Reference Data")
    ipfs_data = load_json_from_ipfs(ipfs_json_url)
    
    if not ipfs_data:
        print("❌ Failed to load IPFS reference data")
        return
    
    print("✅ Reference Data from IPFS:", json.dumps(ipfs_data, indent=2))
    
    # Step 3: Compare using both methods
    print("\nStep 3: Comparison Methods")
    print("-" * 40)
    
    # Simple comparison (your original method)
    simple_match = compare_data_simple(ocr_data, ipfs_data)
    print(f"📊 Simple Comparison Result: {'✅ MATCH' if simple_match else '❌ NO MATCH'}")
    
    # AI-powered comparison
    ai_analysis = compare_data_ai_powered(ocr_data, ipfs_data)
    print(f"🧠 AI-Powered Analysis:")
    print(f"   📊 Matches: {'✅ YES' if ai_analysis.get('matches') else '❌ NO'}")
    print(f"   🎯 Confidence: {ai_analysis.get('confidence', 0)}%")
    print(f"   📝 Analysis: {ai_analysis.get('analysis', '')[:100]}...")
    print(f"   ✅ Recommendation: {ai_analysis.get('recommendation', 'UNKNOWN')}")
    
    # Show field-by-field comparison
    if 'field_comparisons' in ai_analysis:
        print(f"\n📋 Field-by-Field Analysis:")
        for field, comparison in ai_analysis['field_comparisons'].items():
            status = "✅" if comparison.get('matches') else "❌"
            print(f"   {status} {field}: {comparison.get('explanation', '')}")
    
    # Step 4: Upload results based on AI recommendation
    print(f"\n📤 Step 4: Final Decision")
    if ai_analysis.get('recommendation') == 'ACCEPT' or ai_analysis.get('matches'):
        print("✅ AI VERIFICATION PASSED - Uploading to IPFS...")
        
        # Enhanced verification data
        enhanced_verification_data = {
            "verification_method": "ai_powered",
            "ocr_data": ocr_data,
            "reference_data": ipfs_data,
            "ai_analysis": ai_analysis,
            "simple_match": simple_match,
            "final_status": "verified",
            "timestamp": "2024-01-01T00:00:00Z"
        }
        
        ipfs_hash = upload_json_to_pinata(enhanced_verification_data)
        if ipfs_hash:
            print(f"Enhanced verification stored: https://gateway.pinata.cloud/ipfs/{ipfs_hash}")
    
    elif ai_analysis.get('recommendation') == 'MANUAL_REVIEW':
        print("⚠️ MANUAL REVIEW REQUIRED - See AI analysis for details")
    
    else:
        print("❌ VERIFICATION FAILED - Data does not match")
    
    # Summary
    print(f"\n📊 COMPARISON SUMMARY")
    print("=" * 60)
    print(f"Simple Method Result: {'PASS' if simple_match else 'FAIL'}")
    print(f"AI Method Result: {ai_analysis.get('recommendation', 'UNKNOWN')}")
    print(f"AI Confidence: {ai_analysis.get('confidence', 0)}%")
    
    print(f"\n💡 KEY ADVANTAGES OF AI METHOD:")
    print("✅ Handles name variations and spelling differences")
    print("✅ Accounts for OCR errors and extraction inconsistencies")
    print("✅ Understands different formatting (dates, numbers)")
    print("✅ Provides confidence scores and detailed analysis")
    print("✅ Reduces false negatives from minor differences")
    print("✅ Enables manual review for borderline cases")

if __name__ == "__main__":
    main()
