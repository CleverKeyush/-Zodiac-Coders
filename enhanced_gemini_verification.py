"""
Enhanced KYC Document Verification
This script demonstrates intelligent document verification that goes beyond simple text matching
"""

import google.generativeai as genai
import requests
import json
import base64
import os
from typing import Dict, List, Any, Optional
from dataclasses import dataclass
from pathlib import Path

# Configuration
GEMINI_API_KEY = "AIzaSyDWdj4Jgw_Ewz2cWkx1CU6MwGP3GFwj1qI"
PINATA_API_KEY = "5c3e3eb6db3ae1810e3e"
PINATA_SECRET_API_KEY = "ydc398e7d54a0d89f4b9be0ec364d09df7c39206b4438d0e1b8b6746fc04fc87b"

@dataclass
class DocumentData:
    extracted_data: Dict[str, Any]
    raw_text: str
    document_type: str
    confidence: float
    file_path: str

@dataclass
class VerificationResult:
    belongs_to_same_person: bool
    confidence: float
    analysis: str
    risk_factors: List[str]
    recommendations: List[str]
    individual_document_scores: List[float]

class GeminiDocumentVerifier:
    def __init__(self, api_key: str):
        genai.configure(api_key=api_key)
        self.model = genai.GenerativeModel('gemini-1.5-flash')
    
    def encode_image(self, image_path: str) -> str:
        """Convert image to base64 for Gemini API"""
        with open(image_path, "rb") as image_file:
            return base64.b64encode(image_file.read()).decode('utf-8')
    
    def extract_document_data(self, image_path: str, document_type: str) -> DocumentData:
        """Extract structured data from document Vision"""
        print(f"Extracting data from {document_type} document: {image_path}")
        
        # Create document-specific prompt
        prompt = self._get_extraction_prompt(document_type)
        
        # Process with Gemini
        try:
            with open(image_path, 'rb') as image_file:
                image_data = image_file.read()
            
            response = self.model.generate_content([
                prompt,
                {"mime_type": "image/jpeg", "data": image_data}
            ])
            
            result_text = response.text
            print(f"📝 Raw Gemini response: {result_text[:200]}...")
            
            # Try to parse JSON response
            try:
                extracted_data = json.loads(result_text)
            except json.JSONDecodeError:
                print("⚠️ Could not parse JSON, using text extraction fallback")
                extracted_data = self._parse_unstructured_text(result_text, document_type)
            
            # Calculate confidence based on data completeness
            confidence = self._calculate_confidence(extracted_data)
            
            return DocumentData(
                extracted_data=extracted_data,
                raw_text=result_text,
                document_type=document_type,
                confidence=confidence,
                file_path=image_path
            )
            
        except Exception as e:
            print(f"❌ Error extracting data: {e}")
            return DocumentData(
                extracted_data={},
                raw_text="",
                document_type=document_type,
                confidence=0.0,
                file_path=image_path
            )
    
    def verify_documents_belong_to_same_person(self, documents: List[DocumentData]) -> VerificationResult:
        """Use Gemini AI to intelligently verify if documents belong to the same person"""
        print(f"🧠 Analyzing {len(documents)} documents for person identity consistency...")
        
        # Prepare analysis prompt
        prompt = f"""
You are an expert KYC analyst with years of experience in document verification and fraud detection.

Analyze these {len(documents)} identity documents to determine if they ALL belong to the SAME PERSON.

Your task is to perform sophisticated cross-document analysis that goes beyond simple text matching. Consider:

1. **Name Analysis**: 
   - Account for spelling variations, nicknames, middle names
   - Consider cultural naming conventions
   - Look for phonetic similarities
   - Account for OCR errors in name extraction

2. **Date Consistency**:
   - Verify birth dates match across documents
   - Account for different date formats (DD/MM/YYYY vs MM/DD/YYYY)
   - Consider partial dates or year-only matches

3. **Address Analysis**:
   - Compare addresses for logical consistency
   - Account for different address formats (full vs abbreviated)
   - Consider address updates over time
   - Look for geographical consistency

4. **Cross-Reference Validation**:
   - Check if any document references another (e.g., PAN on Aadhaar)
   - Validate ID number formats and checksums where applicable
   - Look for document issue date consistency

5. **Fraud Detection**:
   - Identify potential red flags or inconsistencies
   - Look for signs of document tampering
   - Check for logical impossibilities (e.g., future dates, invalid age)
   - Assess document quality and authenticity markers

6. **Identity Coherence**:
   - Evaluate overall narrative coherence across documents
   - Consider if the person's profile makes logical sense
   - Check for suspicious patterns or anomalies

DOCUMENTS TO ANALYZE:
"""
        
        for i, doc in enumerate(documents, 1):
            prompt += f"""
Document {i} ({doc.document_type}):
- File: {Path(doc.file_path).name}
- Confidence: {doc.confidence:.1f}%
- Extracted Data: {json.dumps(doc.extracted_data, indent=2)}
- Raw Text: {doc.raw_text[:500]}{'...' if len(doc.raw_text) > 500 else ''}

"""
        
        prompt += """
ANALYSIS REQUIREMENTS:
Provide a comprehensive analysis in JSON format:

{
  "belongs_to_same_person": boolean,
  "confidence": number (0-100),
  "analysis": "detailed explanation of your findings and reasoning",
  "risk_factors": ["list of concerning issues or red flags"],
  "recommendations": ["actionable recommendations for verification"],
  "individual_document_scores": [array of scores 0-100 for each document's quality],
  "name_analysis": {
    "names_found": ["list of all name variations found"],
    "consistent": boolean,
    "explanation": "detailed name consistency analysis"
  },
  "date_analysis": {
    "dates_found": ["list of all birth dates found"],
    "consistent": boolean,
    "explanation": "date consistency analysis"
  },
  "address_analysis": {
    "addresses_found": ["list of addresses found"],
    "consistent": boolean,
    "explanation": "address consistency analysis"
  },
  "fraud_assessment": {
    "risk_level": "LOW|MEDIUM|HIGH",
    "indicators": ["list of fraud indicators if any"],
    "authenticity_score": number (0-100)
  },
  "final_recommendation": "APPROVE|REJECT|MANUAL_REVIEW with detailed reasoning"
}

Be thorough, objective, and err on the side of caution for security purposes.
"""
        
        try:
            response = self.model.generate_content(prompt)
            result_text = response.text
            
            # Clean up response (remove markdown formatting if present)
            if "```json" in result_text:
                result_text = result_text.split("```json")[1].split("```")[0]
            elif "```" in result_text:
                result_text = result_text.split("```")[1].split("```")[0]
            
            analysis_result = json.loads(result_text)
            
            return VerificationResult(
                belongs_to_same_person=analysis_result.get("belongs_to_same_person", False),
                confidence=analysis_result.get("confidence", 0),
                analysis=analysis_result.get("analysis", ""),
                risk_factors=analysis_result.get("risk_factors", []),
                recommendations=analysis_result.get("recommendations", []),
                individual_document_scores=analysis_result.get("individual_document_scores", [])
            )
            
        except Exception as e:
            print(f"❌ Error in verification analysis: {e}")
            return VerificationResult(
                belongs_to_same_person=False,
                confidence=0,
                analysis=f"Analysis failed due to error: {e}",
                risk_factors=["Technical analysis failure"],
                recommendations=["Retry analysis or manual review required"],
                individual_document_scores=[0] * len(documents)
            )
    
    def compare_with_stored_reference(self, new_document: DocumentData, stored_data_url: str) -> Dict[str, Any]:
        """Compare new document with previously stored reference data"""
        print(f"📦 Comparing new document with stored reference: {stored_data_url}")
        
        try:
            # Fetch stored reference data
            response = requests.get(stored_data_url)
            if response.status_code != 200:
                raise Exception(f"Failed to fetch reference data: {response.status_code}")
            
            stored_data = response.json()
            
            prompt = f"""
Compare this newly extracted document with previously stored reference data to determine if they represent the same person and document.

Focus on core identity consistency rather than exact text matches. Consider:
- OCR variations and extraction differences
- Different data formats
- Partial vs complete information
- Natural variations in how information is presented

NEW DOCUMENT:
Type: {new_document.document_type}
Extracted: {json.dumps(new_document.extracted_data, indent=2)}
Raw Text: {new_document.raw_text[:300]}...

STORED REFERENCE:
{json.dumps(stored_data, indent=2)}

Return JSON analysis:
{{
  "matches": boolean,
  "confidence": number (0-100),
  "differences": ["list of significant differences"],
  "analysis": "detailed comparison explanation",
  "core_identity_match": boolean,
  "data_quality_comparison": {{
    "new_document_quality": number (0-100),
    "stored_data_quality": number (0-100)
  }},
  "recommendation": "ACCEPT|REJECT|MANUAL_REVIEW"
}}
"""
            
            result = self.model.generate_content(prompt)
            return json.loads(result.text)
            
        except Exception as e:
            print(f"❌ Comparison error: {e}")
            return {
                "matches": False,
                "confidence": 0,
                "differences": [f"Comparison failed: {e}"],
                "analysis": "Technical error during comparison",
                "core_identity_match": False,
                "recommendation": "MANUAL_REVIEW"
            }
    
    def _get_extraction_prompt(self, document_type: str) -> str:
        """Get document-specific extraction prompt"""
        base_prompt = f"Extract all relevant information from this {document_type} document. "
        
        prompts = {
            "aadhaar": base_prompt + 'Return JSON: {"name": "", "aadhaar_number": "", "date_of_birth": "", "address": "", "gender": "", "mobile": ""}',
            "pan": base_prompt + 'Return JSON: {"name": "", "pan_number": "", "date_of_birth": "", "father_name": ""}',
            "passport": base_prompt + 'Return JSON: {"name": "", "passport_number": "", "date_of_birth": "", "place_of_birth": "", "nationality": "", "issue_date": "", "expiry_date": ""}',
            "voter_id": base_prompt + 'Return JSON: {"name": "", "voter_id_number": "", "date_of_birth": "", "address": "", "constituency": ""}',
            "driving_license": base_prompt + 'Return JSON: {"name": "", "license_number": "", "date_of_birth": "", "address": "", "issue_date": "", "expiry_date": ""}'
        }
        
        return prompts.get(document_type.lower(), 
                          base_prompt + 'Return JSON with all identifiable information: {"name": "", "id_number": "", "date_of_birth": "", "address": ""}')
    
    def _parse_unstructured_text(self, text: str, document_type: str) -> Dict[str, Any]:
        """Fallback parser for when JSON parsing fails"""
        result = {}
        
        # Basic regex patterns for common fields
        import re
        
        patterns = {
            'name': r'(?:name|नाम)[:\s]+([a-zA-Z\s]+)',
            'aadhaar': r'(\d{4}\s?\d{4}\s?\d{4})',
            'pan': r'([A-Z]{5}\d{4}[A-Z])',
            'date_of_birth': r'(?:dob|birth|जन्म)[:\s]*(\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4})',
            'mobile': r'(?:mobile|phone)[:\s]*(\d{10})'
        }
        
        for key, pattern in patterns.items():
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                result[key] = match.group(1).strip()
        
        return result
    
    def _calculate_confidence(self, extracted_data: Dict[str, Any]) -> float:
        """Calculate confidence score based on data completeness and quality"""
        if not extracted_data:
            return 0.0
        
        # Count meaningful fields
        meaningful_fields = [v for v in extracted_data.values() if v and str(v).strip()]
        field_score = len(meaningful_fields) * 15
        
        # Bonus for critical fields
        critical_fields = ['name', 'aadhaar_number', 'pan_number', 'passport_number', 'date_of_birth']
        critical_score = sum(10 for field in critical_fields if extracted_data.get(field))
        
        # Quality bonuses
        quality_score = 0
        if extracted_data.get('name') and len(str(extracted_data['name'])) > 3:
            quality_score += 10
        if any(extracted_data.get(f) for f in ['aadhaar_number', 'pan_number']):
            quality_score += 15
        
        total_score = min(field_score + critical_score + quality_score, 95)
        return total_score

def upload_to_ipfs(data: Dict[str, Any], filename: str) -> Optional[str]:
    """Upload verification results to IPFS via Pinata"""
    print(f"📤 Uploading {filename} to IPFS...")
    
    url = "https://api.pinata.cloud/pinning/pinJSONToIPFS"
    headers = {
        "pinata_api_key": PINATA_API_KEY,
        "pinata_secret_api_key": PINATA_SECRET_API_KEY,
        "Content-Type": "application/json"
    }
    
    payload = {
        "pinataMetadata": {"name": filename},
        "pinataContent": data
    }
    
    try:
        response = requests.post(url, headers=headers, data=json.dumps(payload))
        if response.status_code == 200:
            ipfs_hash = response.json()["IpfsHash"]
            ipfs_url = f"https://gateway.pinata.cloud/ipfs/{ipfs_hash}"
            print(f"✅ Uploaded! IPFS URL: {ipfs_url}")
            return ipfs_url
        else:
            print(f"❌ Upload failed: {response.status_code} - {response.text}")
            return None
    except Exception as e:
        print(f"❌ Upload error: {e}")
        return None

def main():
    print("🚀 Enhanced KYC Document Verification with Gemini AI")
    print("=" * 60)
    
    # Initialize Gemini verifier
    try:
        verifier = GeminiDocumentVerifier(GEMINI_API_KEY)
    except Exception as e:
        print(f"❌ Failed to initialize Gemini: {e}")
        return
    
    # Example document paths (update these to your actual document paths)
    document_paths = [
        # Add your document paths here
        # ("./documents/aadhaar.jpg", "aadhaar"),
        # ("./documents/pan.jpg", "pan"),
        # ("./documents/passport.jpg", "passport")
    ]
    
    # For demo purposes, let's create a simple example
    print("📝 Demo: Add your document paths to the document_paths list")
    print("Example: ('path/to/aadhaar.jpg', 'aadhaar')")
    
    # If you have documents, uncomment and modify the following:
    
    # # Step 1: Extract data from all documents
    # print("\n📋 Step 1: Extracting data from documents...")
    # documents = []
    # for path, doc_type in document_paths:
    #     if os.path.exists(path):
    #         doc_data = verifier.extract_document_data(path, doc_type)
    #         documents.append(doc_data)
    #         print(f"✅ Processed {doc_type}: {doc_data.confidence:.1f}% confidence")
    #     else:
    #         print(f"❌ File not found: {path}")
    # 
    # if not documents:
    #     print("❌ No documents to process")
    #     return
    # 
    # # Step 2: Verify documents belong to same person
    # print(f"\nStep 2: Cross-verifying {len(documents)} documents...")
    # verification_result = verifier.verify_documents_belong_to_same_person(documents)
    # 
    # # Display results
    # print("\n" + "=" * 60)
    # print("📊 VERIFICATION RESULTS")
    # print("=" * 60)
    # print(f"✅ Same Person: {verification_result.belongs_to_same_person}")
    # print(f"🎯 Confidence: {verification_result.confidence:.1f}%")
    # print(f"\n📝 Analysis:\n{verification_result.analysis}")
    # 
    # if verification_result.risk_factors:
    #     print(f"\n⚠️ Risk Factors:")
    #     for risk in verification_result.risk_factors:
    #         print(f"  - {risk}")
    # 
    # if verification_result.recommendations:
    #     print(f"\n💡 Recommendations:")
    #     for rec in verification_result.recommendations:
    #         print(f"  - {rec}")
    # 
    # # Step 3: Upload results to IPFS
    # print(f"\n📤 Step 3: Uploading results to IPFS...")
    # results_data = {
    #     "verification_timestamp": "2024-01-01T00:00:00Z",
    #     "documents_analyzed": len(documents),
    #     "belongs_to_same_person": verification_result.belongs_to_same_person,
    #     "confidence": verification_result.confidence,
    #     "analysis": verification_result.analysis,
    #     "risk_factors": verification_result.risk_factors,
    #     "recommendations": verification_result.recommendations
    # }
    # 
    # ipfs_url = upload_to_ipfs(results_data, "kyc_verification_results")
    # if ipfs_url:
    #     print(f"✅ Results stored on IPFS: {ipfs_url}")
    
    print("\n🎯 Setup Instructions:")
    print("1. Add your Gemini API key to GEMINI_API_KEY")
    print("2. Add document file paths to document_paths list")
    print("3. Run the script to see AI-powered verification in action")
    print("\nThis system provides:")
    print("✅ Intelligent cross-document verification")
    print("✅ Fraud detection and risk assessment")
    print("✅ OCR error tolerance")
    print("✅ Cultural naming convention awareness")
    print("✅ Comprehensive analysis beyond simple text matching")

if __name__ == "__main__":
    main()
