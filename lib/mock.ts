import { FinancialEntry, Goal, MoneySnapshot, Task, User } from "./types";

export const mockUser: User = {
  id: "demo-user",
  email: "",
  name: "",
  created_at: new Date().toISOString(),
};

export const mockGoals: Goal[] = [];
export const mockTasks: Task[] = [];
export const mockFinances: FinancialEntry[] = [];
export const mockSnapshots: MoneySnapshot[] = [];
