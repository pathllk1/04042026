export interface Task {
  id?: string;
  title: string;
  description?: string;
  dueDate?: string;
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'completed';
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateTaskDto {
  title: string;
  description?: string;
  dueDate?: string;
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'completed';
}

export interface UpdateTaskDto {
  title?: string;
  description?: string;
  dueDate?: string;
  priority?: 'low' | 'medium' | 'high';
  status?: 'pending' | 'completed';
}
