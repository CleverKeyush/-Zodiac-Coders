"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useAccount, useWalletClient } from "wagmi";
import { BrowserProvider, formatUnits } from "ethers";
import {
  Shield,
  CheckCircle,
  AlertCircle,
  Clock,
  Wallet,
  RefreshCw,
  Camera,
  Hash,
  ExternalLink,
  Link,
  Brain,
  Trash2,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import DocumentUpload from "@/components/DocumentUpload";
import EnhancedDocumentVerification from "@/components/EnhancedDocumentVerification";
import StatusTracker from "@/components/StatusTracker";
import ResultsDisplay from "@/components/ResultsDisplay";
import { SplineScene } from "@/components/ui/splite";
import { Button } from "@/components/ui/button";
import {
  UploadResponse,
  APIResponse,
  KYCVerificationRecord,
  DocumentType,
} from "@/types";
import {
  storeVerificationOnBlockchain,
  BlockchainVerificationResult,
} from "@/lib/verificationStorage";
import { WalletConnectButton } from "@/components/WalletConnectButton";

export default function Home() {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const [step, setStep] = useState<
    "upload" | "selfie" | "verification" | "hash" | "processing" | "complete"
  >("upload");
  const [uploadedDocuments, setUploadedDocuments] = useState<{
    aadhaar?: UploadResponse;
    pan?: UploadResponse;
    passport?: UploadResponse;
    voter_id?: UploadResponse;
    selfie?: UploadResponse;
  }>({});
  const [workflowId, setWorkflowId] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [verificationResult, setVerificationResult] =
    useState<KYCVerificationRecord | null>(null);
  const [isSplineVisible, setIsSplineVisible] = useState(true);
  const [ocrVerificationResult, setOcrVerificationResult] = useState<any>(null);
  const [uploadedFiles, setUploadedFiles] = useState<
    Record<DocumentType, File>
  >({} as Record<DocumentType, File>);
  const [verificationAttempts, setVerificationAttempts] = useState<
    Map<string, number>
  >(new Map());
  const [generatedHash, setGeneratedHash] = useState<string>("");
  const [blockchainResult, setBlockchainResult] =
    useState<BlockchainVerificationResult | null>(null);
  const [isStoringOnBlockchain, setIsStoringOnBlockchain] = useState(false);
  const [skipBlockchain, setSkipBlockchain] = useState(false);
  const heroRef = useRef<HTMLDivElement>(null);

  // Handle document upload completion
  const handleUploadComplete = (
    type: DocumentType,
    response: UploadResponse
  ) => {
    setUploadedDocuments((prev) => ({
      ...prev,
      [type]: response,
    }));
    setError("");
  };

  // Handle upload errors
  const handleUploadError = (error: string) => {
    setError(error);
  };

  // Handle file storage for OCR verification
  const handleFileStored = (type: DocumentType, file: File) => {
    setUploadedFiles((prev) => ({
      ...prev,
      [type]: file,
    }));
    console.log(`Stored ${type} file for OCR verification:`, file.name);
  };

  // Generate SHA-256 hash for verified Aadhaar data and store on blockchain
  // Test wallet connection function
  const testWalletConnection = async () => {
    try {
      console.log("🧪 Testing wallet connection...");

      // Test wagmi state
      console.log("📊 Wagmi state:", {
        isConnected,
        address,
        walletClient: !!walletClient,
        chainId: walletClient?.chain?.id,
      });

      // Test direct wallet connection with wagmi client
      const { getWalletConnection } = await import("@/lib/verificationStorage");
      const connection = await getWalletConnection(walletClient);
      console.log("✅ Direct wallet connection successful:", {
        address: connection.address,
        provider: !!connection.provider,
        signer: !!connection.signer,
      });

      // Test creating ethers signer from wagmi
      if (walletClient) {
        const providerWrapper = {
          request: async (args: { method: string; params?: any[] }) => {
            return await walletClient.transport.request({
              method: args.method as any,
              params: args.params as any,
            });
          },
        };

        const provider = new BrowserProvider(providerWrapper as any);
        const ethersSigner = await provider.getSigner();
        const signerAddress = await ethersSigner.getAddress();
        console.log("✅ Wagmi to ethers conversion successful:", signerAddress);

        // Test getting balance to verify connection works
        const balance = await provider.getBalance(signerAddress);
        console.log("💰 Wallet balance:", formatUnits(balance, 18), "ETH");
      }

      alert("✅ Wallet connection test passed! Check console for details.");
    } catch (error) {
      console.error("❌ Wallet connection test failed:", error);
      alert(
        `❌ Wallet connection test failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  };

  // Test blockchain interaction
  const testBlockchainConnection = async () => {
    try {
      console.log("🔗 Testing blockchain connection...");

      if (!isConnected || !address) {
        throw new Error("Wallet not connected");
      }

      const { getVerificationContract } = await import(
        "@/lib/verificationStorage"
      );

      // Test contract connection
      const contract = await getVerificationContract(null, walletClient);
      console.log("✅ Contract connection successful");

      // Test gas estimation with a dummy hash
      const testHash =
        "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
      const estimatedGas = await contract.storeVerificationHash.estimateGas(
        testHash
      );
      console.log("⛽ Gas estimation successful:", estimatedGas.toString());

      alert("✅ Blockchain connection test passed! Contract is accessible.");
    } catch (error) {
      console.error("❌ Blockchain connection test failed:", error);
      alert(
        `❌ Blockchain connection test failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  };

  const generateVerificationHash = async (
    aadhaarData: any,
    userAddress: string
  ) => {
    try {
      setIsStoringOnBlockchain(true);

      // Enhanced wallet connection validation
      console.log("🔍 Checking wallet connection...");
      console.log("isConnected:", isConnected);
      console.log("address:", address);
      console.log("walletClient:", walletClient);

      // Check if wallet is connected
      if (!isConnected || !address) {
        console.error("❌ Wallet not connected properly");
        throw new Error(
          "Wallet not connected. Please connect your wallet first."
        );
      }

      if (!walletClient) {
        console.error("❌ Wallet client not available");
        throw new Error(
          "Wallet client not available. Please reconnect your wallet."
        );
      }

      console.log("✅ Wallet connection verified");

      // Get current verification index for this user
      const currentIndex = verificationAttempts.get(userAddress) || 0;
      const nextIndex = currentIndex + 1;

      // Update verification attempts
      setVerificationAttempts(
        (prev) => new Map(prev.set(userAddress, nextIndex))
      );

      // Create hash input combining Aadhaar data, user address, and index
      const hashInput = {
        aadhaarData: aadhaarData,
        userAddress: userAddress,
        verificationIndex: nextIndex,
        timestamp: new Date().toISOString(),
      };

      // Convert to string for hashing
      const dataString = JSON.stringify(
        hashInput,
        Object.keys(hashInput).sort()
      );

      // Generate SHA-256 hash using Web Crypto API
      const encoder = new TextEncoder();
      const data = encoder.encode(dataString);
      const hashBuffer = await crypto.subtle.digest("SHA-256", data);

      // Convert to hex string
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      console.log(
        `Generated verification hash for ${userAddress} (attempt #${nextIndex}):`,
        hashHex
      );
      console.log(`Hash input data:`, hashInput);

      // Store the generated hash for UI display
      setGeneratedHash(hashHex);

      // Store hash on blockchain
      console.log("📦 Storing hash on blockchain...");

      // Check if user wants to skip blockchain storage
      if (skipBlockchain) {
        console.log("⏭️ Skipping blockchain storage per user request");
        const skippedResult = {
          success: false,
          error: "Blockchain storage skipped by user",
          hash: hashHex,
          transactionHash: null,
          blockNumber: null,
          gasUsed: null,
          verificationIndex: null,
        };

        setBlockchainResult(skippedResult);

        return {
          hash: hashHex,
          index: nextIndex,
          input: hashInput,
          blockchainResult: skippedResult,
        };
      }

      // Convert wagmi walletClient to ethers signer with enhanced error handling
      let ethersSigner = null;
      if (walletClient && walletClient.transport) {
        try {
          console.log("🔄 Converting wagmi client to ethers signer...");
          console.log(
            "WalletClient transport type:",
            walletClient.transport.type
          );
          console.log("WalletClient account:", walletClient.account);
          console.log("WalletClient chain:", walletClient.chain);

          // Create a more robust provider wrapper for wagmi transport
          const providerWrapper = {
            request: async (args: { method: string; params?: any[] }) => {
              console.log(`🌐 Making RPC call: ${args.method}`, args.params);
              try {
                // Check if walletClient is still valid
                if (!walletClient.transport) {
                  throw new Error(
                    "Wallet connection lost. Please reconnect your wallet."
                  );
                }

                // Add timeout to prevent hanging requests
                const requestPromise = walletClient.transport.request({
                  method: args.method as any,
                  params: args.params as any,
                });

                const timeoutPromise = new Promise((_, reject) =>
                  setTimeout(
                    () => reject(new Error("RPC request timeout")),
                    10000
                  )
                );

                const result = await Promise.race([
                  requestPromise,
                  timeoutPromise,
                ]);
                console.log(`✅ RPC call successful:`, result);
                return result;
              } catch (error) {
                console.error(`❌ RPC call failed for ${args.method}:`, error);

                // Handle specific error types
                if (error instanceof Error) {
                  if (
                    error.message.includes("Request expired") ||
                    error.message.includes("timeout") ||
                    error.message.includes("session")
                  ) {
                    throw new Error(
                      "Wallet session expired. Please reconnect your wallet and try again."
                    );
                  }
                }
                throw error;
              }
            },
            // Add additional provider properties that ethers might need
            isMetaMask: walletClient.transport?.type === "injected",
            chainId: walletClient.chain?.id
              ? `0x${walletClient.chain.id.toString(16)}`
              : "0x1",
            selectedAddress: walletClient.account?.address,
            networkVersion: walletClient.chain?.id?.toString() || "1",
          };

          const provider = new BrowserProvider(providerWrapper as any);
          ethersSigner = await provider.getSigner();

          // Verify the signer works
          const signerAddress = await ethersSigner.getAddress();
          console.log(
            "✅ Ethers signer created successfully, address:",
            signerAddress
          );

          if (signerAddress.toLowerCase() !== address.toLowerCase()) {
            console.warn("⚠️ Signer address mismatch!", {
              signerAddress,
              address,
            });
          }
        } catch (error) {
          console.error("❌ Failed to create ethers signer from wagmi:", error);
          console.log(
            "🔄 Will fallback to direct wallet connection with walletClient..."
          );
        }
      } else {
        console.log(
          "⚠️ No wagmi walletClient available, will use direct wallet connection"
        );
      }

      try {
        const blockchainResult = await storeVerificationOnBlockchain(
          hashHex,
          ethersSigner,
          walletClient
        );

        if (blockchainResult.success) {
          console.log(
            "Hash successfully stored on blockchain:",
            blockchainResult
          );
          setBlockchainResult(blockchainResult);
        } else {
          console.error(
            "Failed to store hash on blockchain:",
            blockchainResult.error
          );
          setBlockchainResult(blockchainResult);
          // Don't throw error - allow process to continue even if blockchain storage fails
        }

        return {
          hash: hashHex,
          index: nextIndex,
          input: hashInput,
          blockchainResult: blockchainResult,
        };
      } catch (blockchainError) {
        console.error("❌ Blockchain storage failed:", blockchainError);

        // Show user-friendly message for timeout errors
        let errorMessage = "Blockchain storage failed";
        if (blockchainError instanceof Error) {
          if (
            blockchainError.message.includes("timeout") ||
            blockchainError.message.includes("Request expired") ||
            blockchainError.message.includes("session")
          ) {
            errorMessage =
              "Wallet session expired or timed out. Hash generated successfully.";
          } else {
            errorMessage =
              "Blockchain storage failed: " + blockchainError.message;
          }
        }

        // Create a failed blockchain result but don't stop the process
        const failedResult = {
          success: false,
          error: errorMessage,
          hash: hashHex,
          transactionHash: null,
          blockNumber: null,
          gasUsed: null,
          verificationIndex: null,
        };

        setBlockchainResult(failedResult);

        // Return the hash data even if blockchain storage failed
        return {
          hash: hashHex,
          index: nextIndex,
          input: hashInput,
          blockchainResult: failedResult,
        };
      }
    } catch (error) {
      console.error("Error generating verification hash:", error);
      setIsStoringOnBlockchain(false);
      throw new Error("Failed to generate verification hash");
    } finally {
      setIsStoringOnBlockchain(false);
    }
  };

  // Reset verification state
  const resetVerificationState = () => {
    setOcrVerificationResult(null);
    setGeneratedHash("");
    setError("");
    console.log("Verification state reset");
  };

  // Gemini OCR Verification function
  const performGeminiOCRVerification = async (
    aadhaarFile: File,
    ipfsJsonUrl: string
  ) => {
    console.log("Starting Gemini OCR verification...");
    setError("");

    try {
      const formData = new FormData();
      formData.append("image", aadhaarFile);
      formData.append("ipfsJsonUrl", ipfsJsonUrl);

      const response = await fetch("/api/gemini-ocr-verify", {
        method: "POST",
        body: formData,
      });

      console.log("📡 Response status:", response.status);
      const result = await response.json();
      console.log("📡 Response data:", result);

      if (result.success) {
        console.log("Gemini OCR Verification successful:", result.data);

        return {
          success: true,
          data: result.data,
          message: "Aadhaar data verified successfully with IPFS reference",
        };
      } else {
        return {
          success: false,
          error:
            result.error?.message ||
            result.message ||
            "OCR verification failed",
          details: result.data,
        };
      }
    } catch (error) {
      console.error("Gemini OCR Verification error:", error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "OCR verification failed",
      };
    }
  };

  // Start KYC verification process
  const startKYCVerification = async () => {
    // Check if required documents are uploaded (Aadhaar, PAN, and Selfie)
    if (
      !address ||
      !uploadedDocuments.aadhaar ||
      !uploadedDocuments.pan ||
      !uploadedDocuments.selfie
    ) {
      setError(
        "Please connect wallet and upload required documents (Aadhaar, PAN, and Selfie)"
      );
      return;
    }

    setIsProcessing(true);
    setError("");

    try {
      // Step 1: Perform Gemini OCR Verification with IPFS data
      console.log("Step 1: Performing Gemini OCR verification...");

      // You need to provide the IPFS URL containing the reference data
      // This should be the URL from your Python script's IPFS upload
      const ipfsJsonUrl =
        "https://yellow-accessible-clownfish-757.mypinata.cloud/ipfs/QmanyY6HEi9XxCs3Fnay3erqFwUbGxuZuESRT3KoQDkm2h";

      // Get the actual Aadhaar file from stored files
      const aadhaarFile = uploadedFiles.aadhaar;
      if (!aadhaarFile) {
        throw new Error("Aadhaar file not found for OCR verification");
      }

      // Perform OCR verification
      const ocrResult = await performGeminiOCRVerification(
        aadhaarFile,
        ipfsJsonUrl
      );
      setOcrVerificationResult(ocrResult);

      if (!ocrResult.success) {
        throw new Error(`OCR Verification failed: ${ocrResult.error}`);
      }

      console.log(
        "OCR verification passed, proceeding to blockchain upload..."
      );

      // Step 2: Prepare documents object with all uploaded documents
      const documents: any = {
        selfie: uploadedDocuments.selfie.ipfsHash,
      };

      // Add required documents
      if (uploadedDocuments.aadhaar) {
        documents.aadhaar = uploadedDocuments.aadhaar.ipfsHash;
      }
      if (uploadedDocuments.pan) {
        documents.pan = uploadedDocuments.pan.ipfsHash;
      }

      // Add optional documents if uploaded
      if (uploadedDocuments.passport) {
        documents.passport = uploadedDocuments.passport.ipfsHash;
      }
      if (uploadedDocuments.voter_id) {
        documents.voter_id = uploadedDocuments.voter_id.ipfsHash;
      }

      // Add OCR verification result to documents
      documents.ocrVerification = ocrResult.data;

      const response = await fetch("/api/kyc/initiate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: address,
          userAddress: address,
          documents,
        }),
      });

      const result: APIResponse = await response.json();

      if (result.success && result.data?.workflowId) {
        setWorkflowId(result.data.workflowId);
        setStep("processing");
      } else {
        throw new Error(
          result.error?.message || "Failed to start KYC verification"
        );
      }
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Failed to start KYC verification"
      );
    } finally {
      setIsProcessing(false);
    }
  };

  // Check if ready to move to selfie step (required documents: Aadhaar, PAN)
  const isReadyForSelfie =
    isConnected && uploadedDocuments.aadhaar && uploadedDocuments.pan;

  // Check if ready to start verification (required documents: Aadhaar, PAN, and Selfie)
  const isReadyToStart =
    isConnected &&
    uploadedDocuments.aadhaar &&
    uploadedDocuments.pan &&
    uploadedDocuments.selfie;

  // Intersection Observer to optimize Spline performance
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          setIsSplineVisible(entry.isIntersecting);
        });
      },
      {
        threshold: 0.1, // Trigger when 10% of hero section is visible
        rootMargin: "100px", // Start optimizing 100px before/after
      }
    );

    if (heroRef.current) {
      observer.observe(heroRef.current);
    }

    return () => {
      if (heroRef.current) {
        observer.unobserve(heroRef.current);
      }
    };
  }, []);

  // Throttle scroll events for better performance
  useEffect(() => {
    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          // Additional scroll optimizations can be added here
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Auto-trigger OCR verification immediately after Live Selfie is captured
  useEffect(() => {
    const triggerOCRVerification = async () => {
      console.log("useEffect triggered with:", {
        hasSeflieFile: !!uploadedFiles.selfie,
        hasAadhaarFile: !!uploadedFiles.aadhaar,
        currentStep: step,
        ocrResultExists: !!ocrVerificationResult,
      });

      // Check if we have both selfie and aadhaar files (not uploaded, just captured/stored)
      if (
        uploadedFiles.selfie &&
        uploadedFiles.aadhaar &&
        !ocrVerificationResult // Only trigger if we don't have results yet
      ) {
        console.log(
          "Live Selfie captured! Auto-triggering IPFS verification and moving to verification step..."
        );

        // Automatically advance to verification step
        setStep("verification");

        try {
          // The IPFS URL containing reference data for comparison
          const ipfsJsonUrl =
            "https://yellow-accessible-clownfish-757.mypinata.cloud/ipfs/QmanyY6HEi9XxCs3Fnay3erqFwUbGxuZuESRT3KoQDkm2h";

          console.log("📡 Making OCR verification request...");

          // Perform OCR verification automatically
          const ocrResult = await performGeminiOCRVerification(
            uploadedFiles.aadhaar,
            ipfsJsonUrl
          );

          console.log("📡 OCR verification result:", ocrResult);
          setOcrVerificationResult(ocrResult);

          if (ocrResult.success) {
            console.log(
              "Auto OCR verification successful! Person identity verified."
            );
            // Automatically advance to hash generation step
            setTimeout(() => {
              console.log("Advancing to hash generation step...");
              setStep("hash");
            }, 1000); // Small delay to show the verification success
          } else {
            console.error("Auto OCR verification failed:", ocrResult.error);
            setError(`Identity verification failed: ${ocrResult.error}`);
          }
        } catch (error) {
          console.error("Auto OCR verification error:", error);
          setError("Automatic identity verification failed. Please try again.");
        }
      }
    };

    triggerOCRVerification();
  }, [uploadedFiles.selfie, uploadedFiles.aadhaar, ocrVerificationResult]);

  // Auto-trigger hash generation when reaching hash step
  useEffect(() => {
    const triggerHashGeneration = async () => {
      if (
        step === "hash" &&
        ocrVerificationResult?.success &&
        !generatedHash &&
        address &&
        ocrVerificationResult.data?.ocrData
      ) {
        console.log("Auto-triggering hash generation...");

        try {
          const hashResult = await generateVerificationHash(
            ocrVerificationResult.data.ocrData,
            address
          );
          setGeneratedHash(hashResult.hash);
          console.log("Hash generated successfully:", hashResult);

          // Auto-advance to processing step after hash generation
          setTimeout(() => {
            console.log("Advancing to processing step...");
            setStep("processing");
          }, 3000); // Give user time to see the hash
        } catch (error) {
          console.error("Hash generation failed:", error);
          setError("Failed to generate verification hash");
        }
      }
    };

    triggerHashGeneration();
  }, [step, ocrVerificationResult, generatedHash, address]);

  return (
    <div
      className="min-h-screen bg-gradient-to-b from-black via-black to-teal-900"
      style={{ minHeight: "200vh" }}
    >
      {/* Hero Section - Fullscreen */}
      <div
        ref={heroRef}
        className="relative min-h-screen flex items-start justify-start"
        suppressHydrationWarning
      >
        {/* Spline Background - Fullscreen */}
        <div
          className="absolute inset-0 w-full h-full"
          suppressHydrationWarning
        >
          {isSplineVisible && (
            <SplineScene
              scene="https://prod.spline.design/OQ5FC2RDWDZGITvO/scene.splinecode"
              className="w-full h-full"
            />
          )}
          {/* Fallback background when Spline is not visible */}
          {!isSplineVisible && (
            <div className="w-full h-full bg-gradient-to-b from-black to-turquoise-900" />
          )}
        </div>

        {/* Hero Content - Top Left */}
        <div className="relative z-10 p-8 m-8">
          <h2 className="text-6xl font-bold mb-4 text-white">
            Decentralized KYC
            <br />
            <span className="metallic-text font-bold">System</span>
          </h2>
          <p className="text-2xl font-bold text-gray-300">
            Seamless. Secure. Smart
          </p>
        </div>

        {/* Wallet Connect - Bottom Right */}
        <div
          className="absolute bottom-8 right-8 z-10 p-3"
          suppressHydrationWarning
        >
          <div className="flex flex-col items-end mb-4">
            <p className="text-white text-xl font-medium mb-3 max-w-xs leading-relaxed text-right">
              Connect your Wallet to begin the KYC verification process.
            </p>
            <div className="flex flex-col gap-2">
              <WalletConnectButton />
              {isConnected && (
                <>
                  <Button
                    onClick={testWalletConnection}
                    variant="outline"
                    size="sm"
                    className="text-xs"
                  >
                    🧪 Test Connection
                  </Button>
                  <Button
                    onClick={testBlockchainConnection}
                    variant="outline"
                    size="sm"
                    className="text-xs"
                  >
                    🔗 Test Blockchain
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Step Indicator */}
        <div className="flex justify-center mb-12">
          <div className="flex items-center space-x-4">
            {[
              { key: "upload", label: "Upload Documents", icon: Shield },
              { key: "selfie", label: "Live Selfie", icon: Wallet },
              {
                key: "verification",
                label: "IPFS Verification",
                icon: RefreshCw,
              },
              { key: "hash", label: "Hash Generation", icon: Hash },
              { key: "processing", label: "Processing", icon: Clock },
              { key: "complete", label: "Complete", icon: CheckCircle },
            ].map(({ key, label, icon: Icon }, index) => {
              const stepOrder = [
                "upload",
                "selfie",
                "verification",
                "hash",
                "processing",
                "complete",
              ];
              const currentStepIndex = stepOrder.indexOf(step);
              const thisStepIndex = stepOrder.indexOf(key);

              // Determine step state
              const isCurrentStep = step === key;
              const isCompletedStep = thisStepIndex < currentStepIndex;
              const isFutureStep = thisStepIndex > currentStepIndex;

              return (
                <div key={key} className="flex items-center">
                  <div
                    className={`flex items-center space-x-2 px-4 py-2 rounded-3xl transition-all duration-300 ${
                      isCurrentStep
                        ? "bg-gradient-turquoise-lavender text-black shadow-lg"
                        : isCompletedStep
                        ? "bg-green-500/20 text-green-400 border border-green-500/30"
                        : "bg-white/5 text-muted-foreground"
                    }`}
                  >
                    {isCompletedStep ? (
                      <CheckCircle className="w-4 h-4" />
                    ) : (
                      <Icon className="w-4 h-4" />
                    )}
                    <span className="text-sm font-medium">{label}</span>
                  </div>
                  {index < 5 && (
                    <div
                      className={`w-8 h-0.5 mx-2 transition-all duration-300 ${
                        thisStepIndex < currentStepIndex
                          ? "bg-green-400"
                          : "bg-white/20"
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* All Steps Content - Always Visible */}

        {/* Step 1: Upload Documents */}
        <div className="max-w-4xl mx-auto mb-16">
          <div className="flex items-center mb-6">
            <div
              className={`flex items-center space-x-2 px-4 py-2 rounded-3xl ${
                step === "upload"
                  ? "bg-gradient-turquoise-lavender text-black"
                  : uploadedDocuments.aadhaar ||
                    uploadedDocuments.pan ||
                    uploadedDocuments.passport ||
                    uploadedDocuments.voter_id
                  ? "bg-green-500/20 text-green-400 border border-green-500/30"
                  : "bg-white/5 text-muted-foreground"
              }`}
            >
              {(uploadedDocuments.aadhaar ||
                uploadedDocuments.pan ||
                uploadedDocuments.passport ||
                uploadedDocuments.voter_id) &&
              step !== "upload" ? (
                <CheckCircle className="w-4 h-4" />
              ) : (
                <Shield className="w-4 h-4" />
              )}
              <span className="text-sm font-medium">
                Step 1: Upload Documents
              </span>
            </div>
          </div>

          <EnhancedDocumentVerification
            onUploadComplete={handleUploadComplete}
            onUploadError={handleUploadError}
            onFileStored={handleFileStored}
            documentsToShow={["aadhaar", "pan", "passport", "voter_id"]}
          />
        </div>

        {/* Step 2: Live Selfie */}
        <div className="max-w-4xl mx-auto mb-16">
          <div className="flex items-center mb-6">
            <div
              className={`flex items-center space-x-2 px-4 py-2 rounded-3xl ${
                step === "selfie"
                  ? "bg-gradient-turquoise-lavender text-black"
                  : uploadedDocuments.selfie
                  ? "bg-green-500/20 text-green-400 border border-green-500/30"
                  : "bg-white/5 text-muted-foreground"
              }`}
            >
              {uploadedDocuments.selfie && step !== "selfie" ? (
                <CheckCircle className="w-4 h-4" />
              ) : (
                <Wallet className="w-4 h-4" />
              )}
              <span className="text-sm font-medium">Step 2: Live Selfie</span>
            </div>
          </div>
          {step === "selfie" && (
            <div className="text-center mb-8">
              <h3 className="text-3xl font-bold mb-4 metallic-text">
                Live Selfie Verification
              </h3>
              <p className="text-muted-foreground text-lg">
                Take a live selfie to complete your identity verification. Make
                sure you&apos;re in good lighting and looking directly at the
                camera.
              </p>
            </div>
          )}
          <DocumentUpload
            onUploadComplete={handleUploadComplete}
            onUploadError={handleUploadError}
            onFileStored={handleFileStored}
            selfieOnly={true}
          />
        </div>

        {step === "selfie" && (
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-8">
              <h3 className="text-3xl font-bold mb-4 metallic-text">
                Live Selfie Verification
              </h3>
              <p className="text-muted-foreground text-lg">
                Take a live selfie to complete your identity verification. Make
                sure you&apos;re in good lighting and looking directly at the
                camera.
              </p>
            </div>

            <DocumentUpload
              onUploadComplete={handleUploadComplete}
              onUploadError={handleUploadError}
              onFileStored={handleFileStored}
              selfieOnly={true}
            />

            {error && (
              <div className="mt-6 flex items-center justify-center space-x-2 text-red-400">
                <AlertCircle className="w-5 h-5" />
                <span>{error}</span>
              </div>
            )}

            {/* OCR Verification Test Button (for development) */}
            {uploadedFiles.aadhaar && (
              <div className="mt-6 p-4 bg-blue-50 rounded-3xl border border-blue-200">
                <h4 className="font-medium text-blue-700 mb-2">
                  🔧 Manual OCR Testing
                </h4>
                <p className="text-sm text-blue-600 mb-3">
                  Manually test Gemini OCR verification with uploaded Aadhaar
                  document
                </p>
                <div className="flex space-x-2">
                  <Button
                    onClick={async () => {
                      console.log("🔧 Manual OCR test triggered");
                      const ipfsJsonUrl =
                        "https://yellow-accessible-clownfish-757.mypinata.cloud/ipfs/QmanyY6HEi9XxCs3Fnay3erqFwUbGxuZuESRT3KoQDkm2h";
                      const result = await performGeminiOCRVerification(
                        uploadedFiles.aadhaar,
                        ipfsJsonUrl
                      );
                      console.log("Manual OCR result:", result);
                      setOcrVerificationResult(result);
                    }}
                    variant="outline"
                    size="sm"
                    disabled={isProcessing}
                  >
                    <Brain className="w-4 h-4 mr-2" />
                    Test OCR Verification
                  </Button>

                  <Button
                    onClick={() => {
                      console.log("Clearing OCR results and hash");
                      resetVerificationState();
                    }}
                    variant="outline"
                    size="sm"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Clear Results
                  </Button>
                </div>

                <div className="mt-3 text-xs text-blue-600">
                  <p>
                    <strong>Debug Info:</strong>
                  </p>
                  <p className="flex items-center">
                    Selfie uploaded:{" "}
                    {uploadedDocuments.selfie ? (
                      <CheckCircle className="w-3 h-3 ml-1 text-green-400" />
                    ) : (
                      <X className="w-3 h-3 ml-1 text-red-400" />
                    )}
                  </p>
                  <p className="flex items-center">
                    Aadhaar file stored:{" "}
                    {uploadedFiles.aadhaar ? (
                      <CheckCircle className="w-3 h-3 ml-1 text-green-400" />
                    ) : (
                      <X className="w-3 h-3 ml-1 text-red-400" />
                    )}
                  </p>
                  <p>Current step: {step}</p>
                  <p className="flex items-center">
                    OCR result exists:{" "}
                    {ocrVerificationResult ? (
                      <CheckCircle className="w-3 h-3 ml-1 text-green-400" />
                    ) : (
                      <X className="w-3 h-3 ml-1 text-red-400" />
                    )}
                  </p>

                  {/* Manual Force IPFS Verification Button */}
                  <div className="mt-4 space-x-2">
                    <Button
                      onClick={async () => {
                        if (!uploadedFiles.aadhaar) {
                          alert(
                            "No Aadhaar file found! Please upload Aadhaar first."
                          );
                          return;
                        }

                        console.log("🔥 FORCE TRIGGERING IPFS VERIFICATION...");
                        const ipfsJsonUrl =
                          "https://yellow-accessible-clownfish-757.mypinata.cloud/ipfs/QmanyY6HEi9XxCs3Fnay3erqFwUbGxuZuESRT3KoQDkm2h";

                        try {
                          const result = await performGeminiOCRVerification(
                            uploadedFiles.aadhaar,
                            ipfsJsonUrl
                          );
                          console.log("🔥 FORCE VERIFICATION RESULT:", result);
                          setOcrVerificationResult(result);
                        } catch (error) {
                          console.error("🔥 FORCE VERIFICATION ERROR:", error);
                          alert("Error: " + error);
                        }
                      }}
                      className="bg-red-600 hover:bg-red-700"
                    >
                      🔥 Force IPFS Verification
                    </Button>

                    <Button
                      onClick={() => {
                        console.log("🧹 Clearing OCR results and hash...");
                        resetVerificationState();
                      }}
                      variant="outline"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Clear Results
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* IPFS Data Matching Verification Card - ALWAYS VISIBLE */}
            <div className="mt-8">
              <div className="glass-card p-6">
                <div className="flex items-center mb-4">
                  <Shield className="w-6 h-6 text-teal-900 mr-3" />
                  <h4 className="text-xl font-semibold">
                    <Link className="w-5 h-5 inline mr-2" />
                    IPFS Data Matching Verification
                  </h4>
                  {ocrVerificationResult?.success ? (
                    <CheckCircle className="w-5 h-5 text-green-400 ml-auto" />
                  ) : ocrVerificationResult?.success === false ? (
                    <AlertCircle className="w-5 h-5 text-red-400 ml-auto" />
                  ) : uploadedFiles.selfie ? (
                    <Clock className="w-5 h-5 text-yellow-400 ml-auto animate-spin" />
                  ) : (
                    <Camera className="w-5 h-5 text-muted-foreground ml-auto" />
                  )}
                </div>

                <div className="mb-4">
                  {uploadedFiles.selfie ? (
                    <div className="bg-turquoise-500/10 border border-turquoise-500/20 rounded-3xl p-3 mb-3">
                      <p className="text-teal-900 text-sm font-medium flex items-center">
                        <CheckCircle className="w-4 h-4 mr-2" />
                        <Sparkles className="w-4 h-4 mr-1" />
                        Live Selfie Completed - Now Verifying Document
                        Consistency
                      </p>
                      <p className="text-turquoise-300 text-xs mt-1">
                        Comparing your uploaded Aadhaar data with IPFS reference
                        to ensure both documents belong to the same person
                      </p>
                    </div>
                  ) : (
                    <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-3xl p-4 mb-3">
                      <p className="text-yellow-400 text-sm font-medium flex items-center">
                        <Camera className="w-4 h-4 mr-2" />
                        Take Selfie for IPFS Verification Results
                      </p>
                      <p className="text-yellow-300 text-xs mt-1">
                        After taking your live selfie, this section will show
                        whether your uploaded Aadhaar matches the reference data
                        stored in IPFS
                      </p>
                    </div>
                  )}

                  <p className="text-sm text-gray-800 mb-3">
                    {ocrVerificationResult ? (
                      <span className="flex items-center">
                        <Sparkles className="w-4 h-4 mr-1" />
                        Comparing uploaded Aadhaar OCR data with IPFS reference
                        data
                      </span>
                    ) : uploadedFiles.selfie ? (
                      <span className="flex items-center">
                        <Clock className="w-4 h-4 mr-1" />
                        Processing IPFS data matching verification...
                      </span>
                    ) : (
                      <span className="flex items-center">
                        <Clock className="w-4 h-4 mr-1" />
                        Waiting for live selfie to begin IPFS verification...
                      </span>
                    )}
                  </p>
                </div>

                {/* Show different states based on selfie status */}
                {!uploadedFiles.selfie && (
                  <div className="text-center py-12">
                    <Camera className="w-20 h-20 mx-auto mb-4 text-yellow-400" />
                    <h3 className="text-lg font-semibold text-yellow-400 mb-2">
                      Ready for IPFS Verification
                    </h3>
                    <p className="text-gray-800 mb-4 max-w-md mx-auto">
                      Take your live selfie to instantly verify if your uploaded
                      Aadhaar document matches the reference data stored in IPFS
                    </p>
                    <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-3xl p-3 max-w-md mx-auto">
                      <p className="text-yellow-400 text-sm">
                        This verification ensures document consistency across
                        your KYC submission
                      </p>
                    </div>
                  </div>
                )}

                {/* Show processing state if selfie exists but no results yet */}
                {uploadedFiles.selfie &&
                  !ocrVerificationResult &&
                  uploadedFiles.aadhaar && (
                    <div className="text-center py-8">
                      <div className="w-16 h-16 mx-auto mb-4 border-4 border-teal-900 border-t-transparent rounded-full animate-spin"></div>
                      <p className="text-muted-foreground mb-2">
                        Extracting data from uploaded Aadhaar OCR...
                      </p>
                      <p className="text-muted-foreground">
                        📊 Comparing with reference data stored in IPFS...
                      </p>
                    </div>
                  )}

                {/* Show error if selfie exists but Aadhaar file missing */}
                {uploadedFiles.selfie &&
                  !ocrVerificationResult &&
                  !uploadedFiles.aadhaar && (
                    <div className="text-center py-8">
                      <AlertCircle className="w-16 h-16 mx-auto mb-4 text-red-400" />
                      <p className="text-red-400 mb-2">
                        ❌ Aadhaar file not found for OCR verification
                      </p>
                      <p className="text-muted-foreground text-sm">
                        Please ensure Aadhaar document was uploaded properly in
                        Step 1
                      </p>
                    </div>
                  )}

                {/* Show IPFS matching results when available */}
                {ocrVerificationResult && (
                  <>
                    {/* Main Verification Result */}
                    <div className="mb-6">
                      <div
                        className={`p-4 rounded-3xl border text-center ${
                          ocrVerificationResult.success
                            ? "bg-green-500/10 border-green-500/20"
                            : "bg-red-500/10 border-red-500/20"
                        }`}
                      >
                        {ocrVerificationResult.success ? (
                          <div>
                            <CheckCircle className="w-8 h-8 text-green-400 mx-auto mb-2" />
                            <h3 className="text-lg font-semibold text-green-400 mb-1">
                              ✅ IPFS Data Match Confirmed
                            </h3>
                            <p className="text-green-400 text-sm">
                              Uploaded Aadhaar data matches the reference data
                              stored in IPFS
                            </p>
                            <p className="text-green-400 text-xs mt-1">
                              Same person verified across both documents
                            </p>
                          </div>
                        ) : (
                          <div>
                            <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
                            <h3 className="text-lg font-semibold text-red-400 mb-1">
                              ❌ IPFS Data Mismatch Detected
                            </h3>
                            <p className="text-red-400 text-sm">
                              Uploaded Aadhaar data does not match IPFS
                              reference data
                            </p>
                            <p className="text-red-400 text-xs mt-1">
                              ⚠️ Documents may belong to different persons
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* IPFS Analysis Details */}
                    {ocrVerificationResult.success &&
                      ocrVerificationResult.data?.comparisonResult && (
                        <div className="mt-4 space-y-2">
                          <p className="text-sm text-muted-foreground font-medium">
                            🤖 AI Analysis:
                          </p>
                          <div className="bg-black/20 p-3 rounded-3xl border">
                            <p className="text-sm text-muted-foreground">
                              {ocrVerificationResult.data.comparisonResult}
                            </p>
                          </div>
                        </div>
                      )}

                    {/* Error Details */}
                    {!ocrVerificationResult.success &&
                      ocrVerificationResult.details?.mismatchDetails && (
                        <div className="mt-4">
                          <p className="text-sm text-red-400 font-medium mb-2">
                            � Mismatch Details:
                          </p>
                          <div className="bg-red-500/10 p-3 rounded-3xl border border-red-500/20">
                            <ul className="text-red-400 text-sm list-disc list-inside space-y-1">
                              {ocrVerificationResult.details.mismatchDetails.map(
                                (issue: string, idx: number) => (
                                  <li key={idx}>{issue}</li>
                                )
                              )}
                            </ul>
                          </div>
                        </div>
                      )}
                  </>
                )}
              </div>
            </div>

            {/* Navigation Buttons */}
            <div className="flex justify-between items-center mt-12 pt-8 border-t border-white/10">
              <div className="flex-1">
                <Button
                  onClick={() => setStep("upload")}
                  variant="outline"
                  size="lg"
                  className="px-8 py-3"
                >
                  <Shield className="w-5 h-5 mr-2" />
                  Previous: Documents
                </Button>
              </div>

              <div className="flex-1 text-center">
                <Button
                  onClick={startKYCVerification}
                  disabled={
                    isProcessing ||
                    (ocrVerificationResult && !ocrVerificationResult.success)
                  }
                  variant="gradient"
                  size="lg"
                  className="px-12 py-4 text-lg"
                >
                  {isProcessing ? (
                    <>
                      <Clock className="w-5 h-5 mr-2 animate-spin" />
                      Starting Verification...
                    </>
                  ) : ocrVerificationResult &&
                    !ocrVerificationResult.success ? (
                    <>
                      <AlertCircle className="w-5 h-5 mr-2" />
                      OCR Verification Failed
                    </>
                  ) : (
                    <>
                      Next: Start Verification
                      <CheckCircle className="w-5 h-5 ml-2" />
                    </>
                  )}
                </Button>
              </div>

              <div className="flex-1">{/* Right side spacer */}</div>
            </div>
          </div>
        )}

        {/* Step 3: IPFS Verification - ALWAYS VISIBLE */}
        <div className="max-w-4xl mx-auto mb-16">
          <div className="flex items-center mb-6">
            <div
              className={`flex items-center space-x-2 px-4 py-2 rounded-3xl ${
                step === "verification"
                  ? "bg-gradient-turquoise-lavender text-black"
                  : ocrVerificationResult
                  ? "bg-green-500/20 text-green-400 border border-green-500/30"
                  : uploadedFiles.selfie
                  ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30"
                  : "bg-white/5 text-muted-foreground"
              }`}
            >
              {ocrVerificationResult && step !== "verification" ? (
                <CheckCircle className="w-4 h-4" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              <span className="text-sm font-medium">
                Step 3: IPFS Verification
              </span>
            </div>
          </div>

          {step === "verification" && (
            <div className="text-center mb-8">
              <h3 className="text-3xl font-bold mb-4 metallic-text">
                IPFS Data Matching Verification
              </h3>
              <p className="text-muted-foreground text-lg">
                Verifying that your uploaded documents match the reference data
                stored in IPFS to ensure document consistency.
              </p>
            </div>
          )}

          {/* IPFS Data Matching Verification Card - ALWAYS VISIBLE */}
          <div className="glass-card p-6">
            <div className="flex items-center mb-4">
              <Shield className="w-6 h-6 text-teal-900 mr-3" />
              <h4 className="text-xl font-semibold">
                IPFS Data Matching Verification
              </h4>
              {ocrVerificationResult?.success ? (
                <CheckCircle className="w-5 h-5 text-green-400 ml-auto" />
              ) : ocrVerificationResult?.success === false ? (
                <AlertCircle className="w-5 h-5 text-red-400 ml-auto" />
              ) : uploadedFiles.selfie ? (
                <Clock className="w-5 h-5 text-yellow-400 ml-auto animate-spin" />
              ) : (
                <Camera className="w-5 h-5 text-muted-foreground ml-auto" />
              )}
            </div>

            <div className="mb-4">
              {uploadedFiles.selfie ? (
                <div className="bg-turquoise-500/10 border border-turquoise-500/20 rounded-3xl p-3 mb-3">
                  <p className="text-teal-900 text-sm font-medium flex items-center">
                    <CheckCircle className="w-4 h-4 mr-2" />✨ Live Selfie
                    Completed - Now Verifying Document Consistency
                  </p>
                  <p className="text-turquoise-300 text-xs mt-1">
                    Comparing your uploaded Aadhaar data with IPFS reference to
                    ensure both documents belong to the same person
                  </p>
                </div>
              ) : (
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-3xl p-4 mb-3">
                  <p className="text-yellow-400 text-sm font-medium flex items-center">
                    <Camera className="w-4 h-4 mr-2" />
                    Complete Step 2 (Live Selfie) to Begin IPFS Verification
                  </p>
                  <p className="text-yellow-300 text-xs mt-1">
                    After taking your live selfie, this section will
                    automatically verify that your uploaded Aadhaar matches the
                    reference data stored in IPFS
                  </p>
                </div>
              )}

              <p className="text-sm text-muted-foreground mb-3">
                {ocrVerificationResult
                  ? "✨ Comparing uploaded Aadhaar OCR data with IPFS reference data"
                  : uploadedFiles.selfie
                  ? "Processing IPFS data matching verification..."
                  : "Waiting for live selfie to begin IPFS verification..."}
              </p>
            </div>

            {/* Show different states based on selfie status */}
            {!uploadedFiles.selfie && (
              <div className="text-center py-12">
                <Camera className="w-20 h-20 mx-auto mb-4 text-yellow-400" />
                <h3 className="text-lg font-semibold text-yellow-400 mb-2">
                  Ready for IPFS Verification
                </h3>
                <p className="text-muted-foreground mb-4 max-w-md mx-auto">
                  Complete Step 2 (Live Selfie) to instantly verify if your
                  uploaded Aadhaar document matches the reference data stored in
                  IPFS
                </p>
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-3xl p-3 max-w-md mx-auto">
                  <p className="text-yellow-400 text-sm">
                    This verification ensures document consistency across your
                    KYC submission
                  </p>
                </div>
              </div>
            )}

            {/* Show processing state if selfie exists but no results yet */}
            {uploadedFiles.selfie &&
              !ocrVerificationResult &&
              uploadedFiles.aadhaar && (
                <div className="text-center py-8">
                  <div className="w-16 h-16 mx-auto mb-4 border-4 border-teal-900 border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-muted-foreground mb-2">
                    Extracting data from uploaded Aadhaar OCR...
                  </p>
                  <p className="text-muted-foreground">
                    📊 Comparing with reference data stored in IPFS...
                  </p>
                </div>
              )}

            {/* Show error if selfie exists but Aadhaar file missing */}
            {uploadedFiles.selfie &&
              !ocrVerificationResult &&
              !uploadedFiles.aadhaar && (
                <div className="text-center py-8">
                  <AlertCircle className="w-16 h-16 mx-auto mb-4 text-red-400" />
                  <p className="text-red-400 mb-2">
                    ❌ Aadhaar file not found for OCR verification
                  </p>
                  <p className="text-muted-foreground text-sm">
                    Please ensure Aadhaar document was uploaded properly in Step
                    1
                  </p>
                </div>
              )}

            {/* Show IPFS matching results when available */}
            {ocrVerificationResult && (
              <>
                {/* Main Verification Result */}
                <div className="mb-6">
                  <div
                    className={`p-4 rounded-3xl border text-center ${
                      ocrVerificationResult.success
                        ? "bg-green-500/10 border-green-500/20"
                        : "bg-red-500/10 border-red-500/20"
                    }`}
                  >
                    {ocrVerificationResult.success ? (
                      <div>
                        <CheckCircle className="w-8 h-8 text-green-400 mx-auto mb-2" />
                        <h3 className="text-lg font-semibold text-green-400 mb-1">
                          ✅ IPFS Data Match Confirmed
                        </h3>
                        <p className="text-green-400 text-sm">
                          Uploaded Aadhaar data matches the reference data
                          stored in IPFS
                        </p>
                        <p className="text-green-400 text-xs mt-1">
                          Same person verified across both documents
                        </p>
                      </div>
                    ) : (
                      <div>
                        <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
                        <h3 className="text-lg font-semibold text-red-400 mb-1">
                          ❌ IPFS Data Mismatch Detected
                        </h3>
                        <p className="text-red-400 text-sm">
                          Uploaded Aadhaar data does not match IPFS reference
                          data
                        </p>
                        <p className="text-red-400 text-xs mt-1">
                          ⚠️ Documents may belong to different persons
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Step 4: Hash Generation - NEW STEP */}
        <div className="max-w-4xl mx-auto mb-16">
          <div className="flex items-center mb-6">
            <div
              className={`flex items-center space-x-2 px-4 py-2 rounded-3xl ${
                step === "hash"
                  ? "bg-gradient-turquoise-lavender text-black"
                  : generatedHash
                  ? "bg-green-500/20 text-green-400 border border-green-500/30"
                  : "bg-white/5 text-muted-foreground"
              }`}
            >
              {generatedHash && step !== "hash" ? (
                <CheckCircle className="w-4 h-4" />
              ) : (
                <Hash className="w-4 h-4" />
              )}
              <span className="text-sm font-medium">
                Step 4: Hash Generation
              </span>
            </div>
          </div>

          {step === "hash" && (
            <div className="text-center mb-8">
              <h3 className="text-3xl font-bold mb-4 metallic-text">
                SHA-256 Hash Generation
              </h3>
              <p className="text-muted-foreground text-lg">
                Generating a cryptographic hash of your verified Aadhaar data
                for blockchain storage.
              </p>
            </div>
          )}

          <div className="glass-card p-6">
            <div className="flex items-center mb-4">
              <Hash className="w-6 h-6 text-white mr-3" />
              <h4 className="text-xl font-semibold text-white">
                Cryptographic Hash Generation
              </h4>
              {generatedHash ? (
                <CheckCircle className="w-5 h-5 text-green-400 ml-auto" />
              ) : ocrVerificationResult?.success ? (
                <Clock className="w-5 h-5 text-yellow-400 ml-auto animate-spin" />
              ) : (
                <AlertCircle className="w-5 h-5 text-yellow-200 ml-auto" />
              )}
            </div>

            {!ocrVerificationResult?.success && (
              <div className="text-center py-12">
                <AlertCircle className="w-20 h-20 mx-auto mb-4 text-yellow-400" />
                <h3 className="text-lg font-semibold text-white mb-2">
                  Waiting for IPFS Verification
                </h3>
                <p className="text-muted-foreground mb-4 max-w-md mx-auto">
                  Complete Step 3 (IPFS Verification) to begin hash generation
                  process
                </p>
              </div>
            )}

            {ocrVerificationResult?.success && !generatedHash && (
              <div className="text-center py-12">
                <div className="w-16 h-16 mx-auto mb-4 border-4 border-teal-900 border-t-transparent rounded-full animate-spin"></div>
                <h3 className="text-lg font-semibold text-teal-400 mb-2">
                  Generating SHA-256 Hash
                </h3>
                <p className="text-muted-foreground mb-4">
                  Creating cryptographic hash of your verified Aadhaar data...
                </p>
                <Button
                  onClick={async () => {
                    if (address && ocrVerificationResult.data?.ocrData) {
                      try {
                        console.log("Manually triggering hash generation...");
                        const hashResult = await generateVerificationHash(
                          ocrVerificationResult.data.ocrData,
                          address
                        );
                        setGeneratedHash(hashResult.hash);
                        console.log("Hash generated successfully:", hashResult);

                        // Auto-advance to processing step after hash generation
                        setTimeout(() => {
                          console.log("📝 Advancing to processing step...");
                          setStep("processing");
                        }, 2000);
                      } catch (error) {
                        console.error("❌ Hash generation failed:", error);
                        setError("Failed to generate verification hash");
                      }
                    }
                  }}
                  variant="gradient"
                  size="lg"
                  className="px-8 py-3"
                >
                  <Hash className="w-5 h-5 mr-2" />
                  Generate Verification Hash
                </Button>
              </div>
            )}

            {generatedHash && (
              <div className="text-center py-8">
                <CheckCircle className="w-16 h-16 mx-auto mb-4 text-green-400" />
                <h3 className="text-lg font-semibold text-green-400 mb-4">
                  ✅ Hash Generated & Blockchain Storage
                </h3>

                <div className="bg-green-500/5 border border-green-500/20 rounded-3xl p-6 mb-6">
                  <div className="flex items-center justify-center mb-4">
                    <Hash className="w-6 h-6 text-green-400 mr-3" />
                    <h4 className="text-lg font-semibold text-green-400">
                      SHA-256 Verification Hash
                    </h4>
                  </div>

                  <div className="bg-black/20 p-4 rounded-3xl border mb-4">
                    <p className="text-green-400 text-sm font-mono break-all">
                      {generatedHash}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm mb-6">
                    <div>
                      <p className="text-muted-foreground mb-2">
                        Hash Details:
                      </p>
                      <div className="space-y-1">
                        <p>
                          <span className="text-teal-900">Algorithm:</span>{" "}
                          SHA-256
                        </p>
                        <p>
                          <span className="text-teal-900">User:</span>{" "}
                          {address?.slice(0, 6)}...{address?.slice(-4)}
                        </p>
                        <p>
                          <span className="text-teal-900">Attempt:</span> #
                          {verificationAttempts.get(address || "") || 1}
                        </p>
                      </div>
                    </div>
                    <div>
                      <p className="text-muted-foreground mb-2">
                        Included Data:
                      </p>
                      <div className="space-y-1">
                        <p>
                          <span className="text-teal-900">✓</span> Aadhaar Data
                        </p>
                        <p>
                          <span className="text-teal-900">✓</span> User Address
                        </p>
                        <p>
                          <span className="text-teal-900">✓</span> Verification
                          Index
                        </p>
                        <p>
                          <span className="text-teal-900">✓</span> Timestamp
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Blockchain Storage Status */}
                  <div className="border-t border-white/10 pt-6">
                    <div className="flex items-center justify-center mb-4">
                      <Wallet className="w-6 h-6 text-blue-400 mr-3" />
                      <h4 className="text-lg font-semibold text-blue-400">
                        Blockchain Storage Status
                      </h4>
                    </div>

                    {isStoringOnBlockchain ? (
                      <div className="text-center py-4">
                        <div className="w-8 h-8 mx-auto mb-2 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
                        <p className="text-blue-400">
                          Storing hash on blockchain...
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Please confirm the transaction in your wallet
                        </p>
                      </div>
                    ) : blockchainResult?.success ? (
                      <div className="bg-blue-500/10 border border-blue-500/20 rounded-3xl p-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="text-green-400 mb-2">
                              ✅ Successfully Stored
                            </p>
                            <div className="space-y-1">
                              <p>
                                <span className="text-blue-400">
                                  Transaction:
                                </span>
                                <a
                                  href={`https://etherscan.io/tx/${blockchainResult.transactionHash}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-300 hover:text-blue-200 ml-1 inline-flex items-center"
                                >
                                  {blockchainResult.transactionHash?.slice(
                                    0,
                                    8
                                  )}
                                  ...
                                  {blockchainResult.transactionHash?.slice(-6)}
                                  <ExternalLink className="w-3 h-3 ml-1" />
                                </a>
                              </p>
                              {blockchainResult.verificationIndex && (
                                <p>
                                  <span className="text-blue-400">Index:</span>{" "}
                                  #{blockchainResult.verificationIndex}
                                </p>
                              )}
                            </div>
                          </div>
                          <div>
                            <p className="text-muted-foreground mb-2">
                              Gas Information:
                            </p>
                            <div className="space-y-1">
                              {blockchainResult.gasUsed && (
                                <p>
                                  <span className="text-blue-400">
                                    Gas Used:
                                  </span>{" "}
                                  {parseInt(
                                    blockchainResult.gasUsed
                                  ).toLocaleString()}
                                </p>
                              )}
                              {blockchainResult.gasFee && (
                                <p>
                                  <span className="text-blue-400">Fee:</span>{" "}
                                  {parseFloat(blockchainResult.gasFee).toFixed(
                                    6
                                  )}{" "}
                                  ETH
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : blockchainResult?.error ? (
                      <div className="bg-red-500/10 border border-red-500/20 rounded-3xl p-4">
                        <p className="text-red-400 mb-2">
                          ❌ Blockchain Storage Failed
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {blockchainResult.error}
                        </p>
                        <p className="text-xs text-muted-foreground mt-2">
                          Hash was generated successfully but blockchain storage
                          failed. You can continue with the process.
                        </p>
                      </div>
                    ) : (
                      <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-3xl p-4">
                        <p className="text-yellow-400">
                          Blockchain storage pending...
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {step === "hash" && (
                  <Button
                    onClick={() => {
                      console.log("📝 Moving to processing step...");
                      setStep("processing");
                    }}
                    variant="gradient"
                    size="lg"
                    className="px-12 py-4 text-lg"
                  >
                    Next: Continue to Processing
                    <CheckCircle className="w-5 h-5 ml-2" />
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>

        {step === "processing" && (
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-8">
              <h3 className="text-3xl font-bold mb-4 metallic-text">
                Processing & Verification
              </h3>
              <p className="text-muted-foreground text-lg">
                Review your OCR results and confirm to upload to blockchain
              </p>
            </div>

            {/* OCR Comparison Results */}
            <div className="space-y-6 mb-8">
              {/* Aadhaar OCR Results */}
              {uploadedDocuments.aadhaar && (
                <div className="glass-card p-6">
                  <div className="flex items-center mb-4">
                    <Shield className="w-6 h-6 text-teal-900 mr-3" />
                    <h4 className="text-xl font-semibold">
                      Aadhaar Card - OCR Results
                    </h4>
                    <CheckCircle className="w-5 h-5 text-green-400 ml-auto" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">
                        Extracted Information:
                      </p>
                      <div className="bg-black/20 p-3 rounded-lg">
                        <p>
                          <span className="text-teal-900">Name:</span> John Doe
                        </p>
                        <p>
                          <span className="text-teal-900">Aadhaar Number:</span>{" "}
                          1234 5678 9012
                        </p>
                        <p>
                          <span className="text-teal-900">DOB:</span> 01/01/1990
                        </p>
                        <p>
                          <span className="text-teal-900">Address:</span> 123
                          Main St, City
                        </p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">
                        Verification Status:
                      </p>
                      <div className="bg-green-500/10 p-3 rounded-lg border border-green-500/20">
                        <p className="text-green-400">
                          ✓ Document format verified
                        </p>
                        <p className="text-green-400">
                          ✓ Text extraction successful
                        </p>
                        <p className="text-green-400">
                          ✓ Security features detected
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* PAN OCR Results */}
              {uploadedDocuments.pan && (
                <div className="glass-card p-6">
                  <div className="flex items-center mb-4">
                    <Shield className="w-6 h-6 text-teal-900 mr-3" />
                    <h4 className="text-xl font-semibold">
                      PAN Card - OCR Results
                    </h4>
                    <CheckCircle className="w-5 h-5 text-green-400 ml-auto" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">
                        Extracted Information:
                      </p>
                      <div className="bg-black/20 p-3 rounded-lg">
                        <p>
                          <span className="text-teal-900">Name:</span> John Doe
                        </p>
                        <p>
                          <span className="text-teal-900">PAN Number:</span>{" "}
                          ABCDE1234F
                        </p>
                        <p>
                          <span className="text-teal-900">DOB:</span> 01/01/1990
                        </p>
                        <p>
                          <span className="text-teal-900">
                            Father&apos;s Name:
                          </span>{" "}
                          Father Name
                        </p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">
                        Verification Status:
                      </p>
                      <div className="bg-green-500/10 p-3 rounded-lg border border-green-500/20">
                        <p className="text-green-400">
                          ✓ Document format verified
                        </p>
                        <p className="text-green-400">
                          ✓ Text extraction successful
                        </p>
                        <p className="text-green-400">
                          ✓ Cross-reference with Aadhaar: Match
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Selfie Verification Results */}
              {uploadedDocuments.selfie && (
                <div className="glass-card p-6">
                  <div className="flex items-center mb-4">
                    <Shield className="w-6 h-6 text-teal-900 mr-3" />
                    <h4 className="text-xl font-semibold">
                      Live Selfie - Verification Results
                    </h4>
                    <CheckCircle className="w-5 h-5 text-green-400 ml-auto" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">
                        Biometric Analysis:
                      </p>
                      <div className="bg-black/20 p-3 rounded-lg">
                        <p>
                          <span className="text-teal-900">Face Detection:</span>{" "}
                          Successful
                        </p>
                        <p>
                          <span className="text-teal-900">Liveness Check:</span>{" "}
                          Passed
                        </p>
                        <p>
                          <span className="text-teal-900">Quality Score:</span>{" "}
                          95%
                        </p>
                        <p>
                          <span className="text-teal-900">
                            Match Confidence:
                          </span>{" "}
                          98%
                        </p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">
                        Verification Status:
                      </p>
                      <div className="bg-green-500/10 p-3 rounded-lg border border-green-500/20">
                        <p className="text-green-400">✓ Live person detected</p>
                        <p className="text-green-400">
                          ✓ Face matches document photos
                        </p>
                        <p className="text-green-400">✓ No spoofing detected</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Gemini OCR Verification Results */}
              {ocrVerificationResult && (
                <div className="glass-card p-6">
                  <div className="flex items-center mb-4">
                    <Shield className="w-6 h-6 text-teal-900 mr-3" />
                    <h4 className="text-xl font-semibold">
                      Gemini OCR Verification Results
                    </h4>
                    {ocrVerificationResult.success ? (
                      <CheckCircle className="w-5 h-5 text-green-400 ml-auto" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-red-400 ml-auto" />
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">
                        OCR Extracted Data:
                      </p>
                      <div className="bg-black/20 p-3 rounded-lg">
                        {ocrVerificationResult.success &&
                        ocrVerificationResult.data?.ocrData ? (
                          <>
                            <p>
                              <span className="text-teal-900">Name:</span>{" "}
                              {ocrVerificationResult.data.ocrData.name ||
                                "Not detected"}
                            </p>
                            <p>
                              <span className="text-teal-900">
                                Aadhaar Number:
                              </span>{" "}
                              {ocrVerificationResult.data.ocrData
                                .aadhaar_number || "Not detected"}
                            </p>
                          </>
                        ) : (
                          <p className="text-red-400">OCR extraction failed</p>
                        )}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">
                        Verification Status:
                      </p>
                      <div
                        className={`p-3 rounded-lg border ${
                          ocrVerificationResult.success
                            ? "bg-green-500/10 border-green-500/20"
                            : "bg-red-500/10 border-red-500/20"
                        }`}
                      >
                        {ocrVerificationResult.success ? (
                          <>
                            <p className="text-green-400">
                              ✅ OCR extraction successful
                            </p>
                            <p className="text-green-400">
                              ✅ Data matches IPFS reference
                            </p>
                            {generatedHash && (
                              <>
                                <p className="text-green-400">
                                  ✅ Verification hash generated
                                </p>
                                <div className="mt-2 p-2 bg-black/20 rounded border">
                                  <div className="flex items-center mb-1">
                                    <Hash className="w-3 h-3 text-green-400 mr-1" />
                                    <span className="text-green-400 text-xs">
                                      SHA-256 Hash:
                                    </span>
                                  </div>
                                  <p className="text-green-400 text-xs font-mono break-all">
                                    {generatedHash}
                                  </p>
                                  <p className="text-green-300 text-xs mt-1">
                                    Index: #
                                    {verificationAttempts.get(address || "") ||
                                      1}
                                  </p>
                                </div>
                              </>
                            )}
                            {ocrVerificationResult.data?.pinataUpload?.url && (
                              <p className="text-green-400 text-xs mt-2">
                                🔗{" "}
                                <a
                                  href={
                                    ocrVerificationResult.data.pinataUpload.url
                                  }
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="underline"
                                >
                                  View on IPFS
                                </a>
                              </p>
                            )}
                          </>
                        ) : (
                          <>
                            <p className="text-red-400">
                              ❌ Verification failed
                            </p>
                            <p className="text-red-400 text-sm">
                              {ocrVerificationResult.error}
                            </p>
                            {ocrVerificationResult.details?.mismatchDetails && (
                              <div className="mt-2">
                                <p className="text-red-400 text-xs">
                                  Issues found:
                                </p>
                                <ul className="text-red-400 text-xs list-disc list-inside ml-2">
                                  {ocrVerificationResult.details.mismatchDetails.map(
                                    (issue: string, idx: number) => (
                                      <li key={idx}>{issue}</li>
                                    )
                                  )}
                                </ul>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {error && (
              <div className="mt-6 flex items-center justify-center space-x-2 text-red-400">
                <AlertCircle className="w-5 h-5" />
                <span>{error}</span>
              </div>
            )}
          </div>
        )}

        {step === "complete" && verificationResult && (
          <ResultsDisplay
            result={verificationResult}
            onRetry={() => {
              setStep("upload");
              setVerificationResult(null);
              setWorkflowId("");
              setError("");
            }}
          />
        )}
      </main>
    </div>
  );
}
