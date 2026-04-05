export interface Todo {
  id?: string;
  content: string;
  completed: boolean;
  category?: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateTodoDto {
  content: string;
  completed?: boolean;
  category?: string;
}

export interface UpdateTodoDto {
  content?: string;
  completed?: boolean;
  category?: string;
}
