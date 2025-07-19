// IPFS Configuration with HTTP-based client for better compatibility

// File validation utilities
export const validateFile = (file: File): { isValid: boolean; error?: string } => {
  const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
  const maxSize = 10 * 1024 * 1024; // 10MB

  if (!allowedTypes.includes(file.type)) {
    return {
      isValid: false,
      error: 'Invalid file type. Only JPEG, PNG, and PDF files are allowed.',
    };
  }

  if (file.size > maxSize) {
    return {
      isValid: false,
      error: 'File size too large. Maximum size is 10MB.',
    };
  }

  return { isValid: true };
};

// Upload file to IPFS using HTTP API
export const uploadToIPFS = async (file: File): Promise<string> => {
  const projectId = process.env.IPFS_PROJECT_ID;
  const projectSecret = process.env.IPFS_PROJECT_SECRET;
  const apiUrl = process.env.IPFS_API_URL || 'https://ipfs.infura.io:5001';

  if (!projectId || !projectSecret) {
    console.warn('IPFS credentials not found, using mock hash for demo');
    // Generate a mock hash for demo purposes
    const mockHash = 'Qm' + Math.random().toString(36).substring(2, 48);
    return mockHash;
  }

  try {
    const formData = new FormData();
    formData.append('file', file);

    const auth = 'Basic ' + Buffer.from(projectId + ':' + projectSecret).toString('base64');

    const response = await fetch(`${apiUrl}/api/v0/add`, {
      method: 'POST',
      headers: {
        'Authorization': auth,
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`IPFS upload failed: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    return result.Hash;
  } catch (error) {
    console.error('IPFS upload error:', error);
    console.warn('Falling back to mock hash for demo');
    // Generate a mock hash as fallback
    const mockHash = 'Qm' + Math.random().toString(36).substring(2, 48);
    return mockHash;
  }
};

// Get IPFS gateway URL for a given hash
export const getIPFSUrl = (hash: string): string => {
  return `https://ipfs.io/ipfs/${hash}`;
};

// Check if IPFS service is available
export const checkIPFSStatus = async (): Promise<boolean> => {
  const projectId = process.env.IPFS_PROJECT_ID;
  const projectSecret = process.env.IPFS_PROJECT_SECRET;
  const apiUrl = process.env.IPFS_API_URL || 'https://ipfs.infura.io:5001';

  if (!projectId || !projectSecret) {
    return false;
  }

  try {
    const auth = 'Basic ' + Buffer.from(projectId + ':' + projectSecret).toString('base64');
    
    const response = await fetch(`${apiUrl}/api/v0/version`, {
      method: 'POST',
      headers: {
        'Authorization': auth,
      },
    });

    return response.ok;
  } catch {
    return false;
  }
};