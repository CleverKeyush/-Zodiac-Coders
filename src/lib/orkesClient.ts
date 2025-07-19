/**
 * Custom implementation of the Orkes Conductor client
 * This provides the same API as the original client but works without the dependency
 */

export interface OrkesApiConfig {
  keyId: string;
  keySecret: string;
  serverUrl: string;
  secondaryServerUrl?: string;
}

export interface TaskResult {
  taskId: string;
  status: string;
  outputData: any;
  reasonForIncompletion?: string;
}

export class OrkesApiClient {
  private config: OrkesApiConfig;
  private baseUrl: string;
  private headers: Record<string, string>;

  constructor(config: OrkesApiConfig) {
    this.config = config;
    this.baseUrl = config.serverUrl;
    
    // Set up authentication headers if credentials are provided
    this.headers = {
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': 'true',
      'User-Agent': 'Orkes-Client/1.0.0'
    };
    
    if (config.keyId && config.keySecret) {
      const authToken = Buffer.from(`${config.keyId}:${config.keySecret}`).toString('base64');
      this.headers['Authorization'] = `Basic ${authToken}`;
    }
    
    console.log('🔌 Orkes client initialized with config:', {
      serverUrl: config.serverUrl,
      hasSecondaryUrl: !!config.secondaryServerUrl,
      hasCredentials: !!(config.keyId && config.keySecret)
    });
  }

  private async makeRequest(method: string, path: string, body?: any): Promise<any> {
    const url = `${this.baseUrl}${path}`;
    
    try {
      console.log(`Making ${method} request to: ${url}`);
      
      const response = await fetch(url, {
        method,
        headers: this.headers,
        body: body ? JSON.stringify(body) : undefined,
      });
      
      console.log(`Response status: ${response.status}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`API Error Response: ${errorText}`);
        throw new Error(`Orkes API error (${response.status}): ${errorText}`);
      }
      
      const responseText = await response.text();
      console.log(`Response text length: ${responseText.length}`);
      
      // Handle empty responses
      if (!responseText || responseText.trim() === '') {
        console.log('Empty response received, returning empty array');
        return [];
      }
      
      try {
        return JSON.parse(responseText);
      } catch (parseError) {
        console.error('JSON parse error:', parseError);
        console.error('Response text:', responseText.substring(0, 200));
        throw new Error(`Invalid JSON response: ${responseText.substring(0, 100)}...`);
      }
    } catch (error) {
      console.error(`Error making ${method} request to ${path}:`, error);
      
      // Try secondary URL if available
      if (this.config.secondaryServerUrl && this.baseUrl === this.config.serverUrl) {
        console.log(`Retrying with secondary URL: ${this.config.secondaryServerUrl}`);
        this.baseUrl = this.config.secondaryServerUrl;
        return this.makeRequest(method, path, body);
      }
      
      throw error;
    }
  }

  taskResource = {
    getTaskTypes: async () => {
      return this.makeRequest('GET', '/api/metadata/taskdefs');
    },

    executeTask: async (taskName: string, taskData: any) => {
      console.log(`🔄 Executing task: ${taskName} with data:`, taskData);
      
      // Execute task via Orkes Conductor API
      const payload = {
        taskType: taskName,
        inputData: taskData,
        taskId: `task-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
      };
      
      const result = await this.makeRequest('POST', '/api/tasks', payload);
      
      return {
        taskId: result.taskId || payload.taskId,
        status: 'SCHEDULED'
      };
    },

    getTask: async (taskId: string) => {
      const result = await this.makeRequest('GET', `/api/tasks/${taskId}`);
      return result as TaskResult;
    }
  };

  workflowResource = {
    startWorkflow: async (workflowName: string, version: number, input: any) => {
      const payload = {
        name: workflowName,
        version,
        input
      };
      
      const result = await this.makeRequest('POST', '/api/workflow', payload);
      return {
        workflowId: result.workflowId,
        status: 'RUNNING'
      };
    },

    getWorkflow: async (workflowId: string, includeTasks: boolean = false) => {
      const result = await this.makeRequest('GET', `/api/workflow/${workflowId}?includeTasks=${includeTasks}`);
      return result;
    }
  };
}

export class OrkesWorkerClient {
  private config: OrkesApiConfig;
  private baseUrl: string;
  private headers: Record<string, string>;
  private pollingInterval: number;
  private workers: Map<string, Function> = new Map();

  constructor(config: OrkesApiConfig, pollingInterval: number = 1000) {
    this.config = config;
    this.baseUrl = config.serverUrl;
    this.pollingInterval = pollingInterval;
    
    // Set up authentication headers if credentials are provided
    this.headers = {
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': 'true',
      'User-Agent': 'Orkes-Worker-Client/1.0.0'
    };
    
    if (config.keyId && config.keySecret) {
      const authToken = Buffer.from(`${config.keyId}:${config.keySecret}`).toString('base64');
      this.headers['Authorization'] = `Basic ${authToken}`;
    }
    
    console.log('🔌 Orkes worker client initialized with config:', {
      serverUrl: config.serverUrl,
      pollingInterval: `${pollingInterval}ms`,
      hasCredentials: !!(config.keyId && config.keySecret)
    });
  }

  private async makeRequest(method: string, path: string, body?: any): Promise<any> {
    const url = `${this.baseUrl}${path}`;
    
    try {
      console.log(`Making ${method} request to: ${url}`);
      
      const response = await fetch(url, {
        method,
        headers: this.headers,
        body: body ? JSON.stringify(body) : undefined,
      });
      
      console.log(`Response status: ${response.status}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`API Error Response: ${errorText}`);
        throw new Error(`Orkes API error (${response.status}): ${errorText}`);
      }
      
      const responseText = await response.text();
      console.log(`Response text length: ${responseText.length}`);
      
      // Handle empty responses
      if (!responseText || responseText.trim() === '') {
        console.log('Empty response received, returning empty array');
        return [];
      }
      
      try {
        return JSON.parse(responseText);
      } catch (parseError) {
        console.error('JSON parse error:', parseError);
        console.error('Response text:', responseText.substring(0, 200));
        throw new Error(`Invalid JSON response: ${responseText.substring(0, 100)}...`);
      }
    } catch (error) {
      console.error(`Error making ${method} request to ${path}:`, error);
      
      // Try secondary URL if available
      if (this.config.secondaryServerUrl && this.baseUrl === this.config.serverUrl) {
        console.log(`Retrying with secondary URL: ${this.config.secondaryServerUrl}`);
        this.baseUrl = this.config.secondaryServerUrl;
        return this.makeRequest(method, path, body);
      }
      
      throw error;
    }
  }

  registerWorker(taskType: string, taskVersion: number, executeFunction: Function, options?: {
    pollingInterval?: number;
    domain?: string;
    concurrency?: number;
  }) {
    console.log(`📝 Registering worker for task: ${taskType} v${taskVersion}`);
    this.workers.set(taskType, executeFunction);
    
    // Update polling interval if provided
    if (options?.pollingInterval) {
      this.pollingInterval = options.pollingInterval;
    }
    
    // Start polling for tasks
    this.startPolling(taskType);
    
    return this;
  }

  private async startPolling(taskType: string) {
    console.log(`🔄 Starting polling for task: ${taskType}`);
    
    const pollForTask = async () => {
      try {
        // Poll for tasks
        const tasks = await this.makeRequest('GET', `/api/tasks/poll/${taskType}`);
        
        if (tasks && tasks.length > 0) {
          for (const task of tasks) {
            this.processTask(task);
          }
        }
      } catch (error) {
        console.error(`Error polling for task ${taskType}:`, error);
      }
      
      // Schedule next poll
      setTimeout(pollForTask, this.pollingInterval);
    };
    
    // Start polling
    pollForTask();
  }

  private async processTask(task: any) {
    const taskType = task.taskDefName;
    const executeFunction = this.workers.get(taskType);
    
    if (!executeFunction) {
      console.error(`No worker registered for task type: ${taskType}`);
      return;
    }
    
    try {
      console.log(`🔄 Processing task: ${task.taskId} (${taskType})`);
      
      // Execute the task
      const result = await executeFunction(task.inputData);
      
      // Update task status
      await this.makeRequest('POST', `/api/tasks/${task.taskId}`, {
        status: 'COMPLETED',
        outputData: result,
        taskId: task.taskId,
        workflowInstanceId: task.workflowInstanceId,
        taskDefName: task.taskDefName
      });
      
      console.log(`✅ Task completed: ${task.taskId}`);
    } catch (error) {
      console.error(`Error processing task ${task.taskId}:`, error);
      
      // Update task status as failed
      await this.makeRequest('POST', `/api/tasks/${task.taskId}`, {
        status: 'FAILED',
        outputData: {},
        taskId: task.taskId,
        workflowInstanceId: task.workflowInstanceId,
        taskDefName: task.taskDefName,
        reasonForIncompletion: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}