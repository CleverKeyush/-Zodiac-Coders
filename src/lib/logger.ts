// Simple logging utility for the KYC system
export class Logger {
  private static instance: Logger;
  private isDevelopment = process.env.NODE_ENV === 'development';

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  info(message: string, data?: any) {
    if (this.isDevelopment) {
      console.log(`[KYC-INFO] ${message}`, data || '');
    }
  }

  error(message: string, error?: any) {
    console.error(`[KYC-ERROR] ${message}`, error || '');
  }

  warn(message: string, data?: any) {
    if (this.isDevelopment) {
      console.warn(`[KYC-WARN] ${message}`, data || '');
    }
  }

  debug(message: string, data?: any) {
    if (this.isDevelopment) {
      console.debug(`[KYC-DEBUG] ${message}`, data || '');
    }
  }

  // Log workflow events
  logWorkflowEvent(workflowId: string, event: string, data?: any) {
    this.info(`Workflow ${workflowId}: ${event}`, data);
  }

  // Log API requests
  logApiRequest(endpoint: string, method: string, duration?: number) {
    this.info(`API ${method} ${endpoint}${duration ? ` (${duration}ms)` : ''}`);
  }

  // Log errors with context
  logError(context: string, error: Error, additionalData?: any) {
    this.error(`${context}: ${error.message}`, {
      stack: error.stack,
      ...additionalData,
    });
  }
}