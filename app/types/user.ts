export interface User {
  username: string;
  email: string;
  fullname: string;
  role?: string;
  firm?: {
    id: string;
    name: string;
  };
  createdAt: Date;
  lastLogin: Date;
}