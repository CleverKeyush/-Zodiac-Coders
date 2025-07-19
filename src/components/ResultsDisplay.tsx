'use client';

import React from 'react';
import { CheckCircle, AlertCircle, ExternalLink, Copy, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { KYCVerificationRecord } from '@/types';

interface ResultsDisplayProps {
  result: KYCVerificationRecord;
  onRetry?: () => void;
}

export default function ResultsDisplay({ result, onRetry }: ResultsDisplayProps) {
  const isSuccess = result.status === 'completed';

  // Copy to clipboard function
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    // You could add a toast notification here
  };

  // Open transaction in explorer
  const openInExplorer = (txHash: string) => {
    window.open(`https://sepolia.etherscan.io/tx/${txHash}`, '_blank');
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="glass-card p-8">
        {/* Header */}
        <div className="text-center mb-8">
          {isSuccess ? (
            <>
              <CheckCircle className="w-16 h-16 mx-auto mb-4 text-green-400" />
              <h3 className="text-2xl font-bold mb-2 text-green-400">
                KYC Verification Successful!
              </h3>
              <p className="text-muted-foreground">
                Your identity has been verified and stored securely on the blockchain.
              </p>
            </>
          ) : (
            <>
              <AlertCircle className="w-16 h-16 mx-auto mb-4 text-red-400" />
              <h3 className="text-2xl font-bold mb-2 text-red-400">
                KYC Verification Failed
              </h3>
              <p className="text-muted-foreground">
                Your verification could not be completed. Please review the details below.
              </p>
            </>
          )}
        </div>

        {/* Verification Details */}
        <div className="space-y-6">
          {/* Basic Information */}
          <div className="bg-white/5 rounded-lg p-4">
            <h4 className="font-semibold mb-3 metallic-text">Verification Details</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Workflow ID:</span>
                <div className="flex items-center space-x-2 mt-1">
                  <code className="bg-white/10 px-2 py-1 rounded text-xs">
                    {result.workflowId}
                  </code>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => copyToClipboard(result.workflowId)}
                  >
                    <Copy className="w-3 h-3" />
                  </Button>
                </div>
              </div>
              <div>
                <span className="text-muted-foreground">Status:</span>
                <div className={`mt-1 font-semibold ${
                  isSuccess ? 'text-green-400' : 'text-red-400'
                }`}>
                  {result.status.toUpperCase()}
                </div>
              </div>
              <div>
                <span className="text-muted-foreground">Started:</span>
                <div className="mt-1">
                  {result.createdAt.toLocaleString()}
                </div>
              </div>
              {result.completedAt && (
                <div>
                  <span className="text-muted-foreground">Completed:</span>
                  <div className="mt-1">
                    {result.completedAt.toLocaleString()}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Extracted Data */}
          {result.extractedData && Object.values(result.extractedData).some(v => v) && (
            <div className="bg-white/5 rounded-lg p-4">
              <h4 className="font-semibold mb-3 metallic-text">Extracted Information</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                {result.extractedData.name && (
                  <div>
                    <span className="text-muted-foreground">Name:</span>
                    <div className="mt-1 font-medium">{result.extractedData.name}</div>
                  </div>
                )}
                {result.extractedData.dateOfBirth && (
                  <div>
                    <span className="text-muted-foreground">Date of Birth:</span>
                    <div className="mt-1 font-medium">{result.extractedData.dateOfBirth}</div>
                  </div>
                )}
                {result.extractedData.idNumber && (
                  <div>
                    <span className="text-muted-foreground">ID Number:</span>
                    <div className="mt-1 font-medium">{result.extractedData.idNumber}</div>
                  </div>
                )}
                {result.extractedData.address && (
                  <div className="md:col-span-2">
                    <span className="text-muted-foreground">Address:</span>
                    <div className="mt-1 font-medium">{result.extractedData.address}</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Verification Results */}
          <div className="bg-white/5 rounded-lg p-4">
            <h4 className="font-semibold mb-3 metallic-text">Verification Results</h4>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">OCR Processing:</span>
                <span className={`text-sm font-semibold ${
                  result.verificationResults.ocrStatus === 'passed' 
                    ? 'text-green-400' 
                    : 'text-red-400'
                }`}>
                  {result.verificationResults.ocrStatus.toUpperCase()}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Face Verification:</span>
                <div className="text-right">
                  <span className={`text-sm font-semibold ${
                    result.verificationResults.faceVerificationStatus === 'passed' 
                      ? 'text-green-400' 
                      : 'text-red-400'
                  }`}>
                    {result.verificationResults.faceVerificationStatus.toUpperCase()}
                  </span>
                  {result.verificationResults.similarityScore && (
                    <div className="text-xs text-muted-foreground">
                      Similarity: {(result.verificationResults.similarityScore * 100).toFixed(1)}%
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Compliance Check:</span>
                <span className={`text-sm font-semibold ${
                  result.verificationResults.complianceStatus === 'passed' 
                    ? 'text-green-400' 
                    : 'text-red-400'
                }`}>
                  {result.verificationResults.complianceStatus.toUpperCase()}
                </span>
              </div>
            </div>
          </div>

          {/* Blockchain Information */}
          {isSuccess && result.transactionHash && (
            <div className="bg-white/5 rounded-lg p-4">
              <h4 className="font-semibold mb-3 metallic-text">Blockchain Verification</h4>
              <div className="space-y-3">
                {result.blockchainHash && (
                  <div>
                    <span className="text-muted-foreground text-sm">Verification Hash:</span>
                    <div className="flex items-center space-x-2 mt-1">
                      <code className="bg-white/10 px-2 py-1 rounded text-xs break-all">
                        {result.blockchainHash}
                      </code>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 flex-shrink-0"
                        onClick={() => copyToClipboard(result.blockchainHash!)}
                      >
                        <Copy className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                )}
                <div>
                  <span className="text-muted-foreground text-sm">Transaction Hash:</span>
                  <div className="flex items-center space-x-2 mt-1">
                    <code className="bg-white/10 px-2 py-1 rounded text-xs break-all">
                      {result.transactionHash}
                    </code>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 flex-shrink-0"
                      onClick={() => copyToClipboard(result.transactionHash!)}
                    >
                      <Copy className="w-3 h-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 flex-shrink-0"
                      onClick={() => openInExplorer(result.transactionHash!)}
                    >
                      <ExternalLink className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  Your verification is now permanently stored on Ethereum Sepolia testnet
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="mt-8 flex justify-center space-x-4">
          {!isSuccess && onRetry && (
            <Button
              onClick={onRetry}
              variant="gradient"
              className="px-6"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Try Again
            </Button>
          )}
          {isSuccess && result.transactionHash && (
            <Button
              onClick={() => openInExplorer(result.transactionHash!)}
              variant="outline"
              className="px-6"
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              View on Etherscan
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}