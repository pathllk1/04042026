import { reactive } from 'vue';

// Global real-time status store
const globalStatus = reactive({
  operations: [],
  isActive: false
});

export const useRealTimeStatus = () => {
  // Add new operation to real-time monitoring
  const startOperation = (operationId, title, description = '') => {
    const operation = {
      id: operationId,
      title,
      description,
      status: 'running',
      progress: 0,
      steps: [],
      startTime: new Date(),
      endTime: null,
      duration: null
    };
    
    globalStatus.operations.unshift(operation);
    globalStatus.isActive = true;
    
    return operation;
  };

  // Update operation progress
  const updateProgress = (operationId, step, message, progress = null) => {
    const operation = globalStatus.operations.find(op => op.id === operationId);
    if (operation) {
      const stepInfo = {
        step,
        message,
        timestamp: new Date(),
        progress: progress || operation.progress
      };
      
      operation.steps.push(stepInfo);
      operation.description = message;
      if (progress !== null) {
        operation.progress = progress;
      }
    }
  };

  // Complete operation
  const completeOperation = (operationId, success = true, finalMessage = '') => {
    const operation = globalStatus.operations.find(op => op.id === operationId);
    if (operation) {
      operation.status = success ? 'completed' : 'failed';
      operation.endTime = new Date();
      operation.duration = operation.endTime - operation.startTime;
      operation.description = finalMessage || operation.description;
      operation.progress = success ? 100 : operation.progress;
      
      // Remove completed operations after 10 seconds
      setTimeout(() => {
        const index = globalStatus.operations.findIndex(op => op.id === operationId);
        if (index > -1) {
          globalStatus.operations.splice(index, 1);
        }
        
        // Check if any operations are still active
        globalStatus.isActive = globalStatus.operations.some(op => op.status === 'running');
      }, 10000);
    }
  };

  // Clear all operations
  const clearAll = () => {
    globalStatus.operations = [];
    globalStatus.isActive = false;
  };

  return {
    globalStatus,
    startOperation,
    updateProgress,
    completeOperation,
    clearAll
  };
};

// Auto-export for global use
export default useRealTimeStatus;
