// Central API Inspector for capturing and visualizing AWS SDK operations

export interface ApiCallLog {
  id: string;
  timestamp: string;
  service: 'S3' | 'SQS' | 'SNS' | 'DynamoDB' | 'Pipeline';
  action: string;
  requestParams?: any;
  responseSummary?: any;
  status: 'success' | 'error';
  executionTimeMs?: number;
}

type LogListener = (logs: ApiCallLog[]) => void;

class ApiInspectorStore {
  private logs: ApiCallLog[] = [];
  private listeners: LogListener[] = [];

  subscribe(listener: LogListener) {
    this.listeners.push(listener);
    listener([...this.logs]);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  record(log: Omit<ApiCallLog, 'id' | 'timestamp'>) {
    const entry: ApiCallLog = {
      id: `api-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toLocaleTimeString(),
      ...log,
    };
    this.logs = [entry, ...this.logs].slice(0, 50); // Keep last 50
    this.notify();
    return entry;
  }

  clear() {
    this.logs = [];
    this.notify();
  }

  private notify() {
    this.listeners.forEach((l) => l([...this.logs]));
  }
}

export const apiInspector = new ApiInspectorStore();

export async function monitoredFetch(
  service: 'S3' | 'SQS' | 'SNS' | 'DynamoDB' | 'Pipeline',
  action: string,
  url: string,
  options?: RequestInit,
  requestParams?: any
): Promise<any> {
  const start = performance.now();
  try {
    const res = await fetch(url, options);
    const data = await res.json();
    const duration = Math.round(performance.now() - start);

    apiInspector.record({
      service,
      action,
      requestParams: requestParams || (options?.body ? JSON.parse(options.body as string) : undefined),
      responseSummary: data,
      status: res.ok ? 'success' : 'error',
      executionTimeMs: duration,
    });

    if (!res.ok) {
      throw new Error(data.detail || `HTTP Error ${res.status}`);
    }
    return data;
  } catch (err: any) {
    const duration = Math.round(performance.now() - start);
    apiInspector.record({
      service,
      action,
      requestParams,
      responseSummary: { error: err.message },
      status: 'error',
      executionTimeMs: duration,
    });
    throw err;
  }
}
